/**
 * setup-indexes.js
 *
 * Automatically creates all Firestore composite indexes defined in
 * firestore.indexes.json using the Firestore REST API.
 *
 * Requirements:
 *   node setup-indexes.js
 *
 * Before running, set these environment variables (or create a .env file):
 *   FIREBASE_PROJECT_ID      — your Firebase project ID
 *   GOOGLE_APPLICATION_CREDENTIALS — path to your service account JSON key
 *
 * How to get a service account key:
 *   Firebase Console → Project Settings → Service Accounts → Generate new private key
 *
 * Install deps once:
 *   npm install google-auth-library
 */

import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { GoogleAuth } from 'google-auth-library'

const __dirname = dirname(fileURLToPath(import.meta.url))

// ── Load .env manually (no dotenv dep needed) ───────────────────────────────
const envPath = resolve(__dirname, '.env')
try {
  const lines = readFileSync(envPath, 'utf8').split('\n')
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eqIdx = trimmed.indexOf('=')
    if (eqIdx < 0) continue
    const key = trimmed.slice(0, eqIdx).trim()
    const val = trimmed.slice(eqIdx + 1).trim().replace(/^['"]|['"]$/g, '')
    if (!process.env[key]) process.env[key] = val
  }
} catch {
  // .env not found — rely on environment variables set externally
}

// ── Config ───────────────────────────────────────────────────────────────────
const PROJECT_ID = process.env.VITE_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID
const CREDS_PATH = process.env.GOOGLE_APPLICATION_CREDENTIALS

if (!PROJECT_ID) {
  console.error('\n❌  FIREBASE_PROJECT_ID is not set.')
  console.error('    Add it to your .env file as FIREBASE_PROJECT_ID=your-project-id\n')
  process.exit(1)
}

if (!CREDS_PATH) {
  console.error('\n❌  GOOGLE_APPLICATION_CREDENTIALS is not set.')
  console.error('    Download a service account key from Firebase Console →')
  console.error('    Project Settings → Service Accounts → Generate new private key')
  console.error('    Then add to .env:  GOOGLE_APPLICATION_CREDENTIALS=./serviceAccount.json\n')
  process.exit(1)
}

// ── Load indexes ─────────────────────────────────────────────────────────────
const indexesFile = resolve(__dirname, 'firestore.indexes.json')
const { indexes: INDEX_DEFINITIONS } = JSON.parse(readFileSync(indexesFile, 'utf8'))

// ── Firestore REST API helpers ────────────────────────────────────────────────
const BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/collectionGroups`

async function getAuthToken() {
  const auth = new GoogleAuth({
    keyFile: CREDS_PATH,
    scopes: ['https://www.googleapis.com/auth/cloud-platform'],
  })
  const client = await auth.getClient()
  const token  = await client.getAccessToken()
  return token.token
}

async function listExistingIndexes(token) {
  // Firestore indexes are per-collectionGroup — collect all unique groups first
  const groups = [...new Set(INDEX_DEFINITIONS.map(i => i.collectionGroup))]
  const existing = []

  for (const group of groups) {
    const url = `${BASE}/${group}/indexes`
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) {
      const text = await res.text()
      console.warn(`  ⚠ Could not list indexes for ${group}: ${text}`)
      continue
    }
    const data = await res.json()
    if (data.indexes) existing.push(...data.indexes)
  }
  return existing
}

function indexKey(index) {
  // Stable string key for deduplication — collectionGroup + sorted fields
  const fields = index.fields
    .map(f => `${f.fieldPath}:${f.order}`)
    .join(',')
  return `${index.collectionGroup}|${index.queryScope}|${fields}`
}

function toApiPayload(def) {
  return {
    queryScope: def.queryScope,
    fields: def.fields.map(f => ({
      fieldPath: f.fieldPath,
      order:     f.order,
    })),
  }
}

async function createIndex(token, collectionGroup, payload) {
  const url = `${BASE}/${collectionGroup}/indexes`
  const res = await fetch(url, {
    method:  'POST',
    headers: {
      Authorization:  `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })
  const data = await res.json()
  if (!res.ok) {
    // 409 = already exists (race condition) — not an error
    if (res.status === 409 || data?.error?.status === 'ALREADY_EXISTS') {
      return { skipped: true }
    }
    throw new Error(data?.error?.message || res.statusText)
  }
  return data
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`\n🔥  Firestore Index Setup`)
  console.log(`    Project : ${PROJECT_ID}`)
  console.log(`    Indexes : ${INDEX_DEFINITIONS.length} defined in firestore.indexes.json\n`)

  // 1. Authenticate
  console.log('🔑  Authenticating with service account...')
  let token
  try {
    token = await getAuthToken()
    console.log('    ✅ Authenticated\n')
  } catch (err) {
    console.error('❌  Auth failed:', err.message)
    process.exit(1)
  }

  // 2. Fetch existing indexes to skip duplicates
  console.log('📋  Fetching existing indexes...')
  const existing = await listExistingIndexes(token)
  const existingKeys = new Set(existing.map(indexKey))
  console.log(`    Found ${existing.length} existing index(es)\n`)

  // 3. Create missing indexes
  let created = 0, skipped = 0, failed = 0

  for (const def of INDEX_DEFINITIONS) {
    const key     = indexKey(def)
    const label   = def.fields.map(f => `${f.fieldPath} ${f.order}`).join(' + ')
    const display = `[${def.collectionGroup}] ${label}`

    if (existingKeys.has(key)) {
      console.log(`  ⏭  SKIP    ${display}`)
      skipped++
      continue
    }

    try {
      const result = await createIndex(token, def.collectionGroup, toApiPayload(def))
      if (result.skipped) {
        console.log(`  ⏭  SKIP    ${display}`)
        skipped++
      } else {
        console.log(`  ✅ CREATED  ${display}`)
        console.log(`             ↳ Building: ${result.name?.split('/').pop() ?? '—'}`)
        created++
      }
    } catch (err) {
      console.log(`  ❌ FAILED   ${display}`)
      console.log(`             ↳ ${err.message}`)
      failed++
    }

    // Small delay to avoid hitting API rate limits
    await new Promise(r => setTimeout(r, 150))
  }

  // 4. Summary
  console.log('\n─────────────────────────────────────────')
  console.log(`  ✅ Created : ${created}`)
  console.log(`  ⏭  Skipped : ${skipped}  (already existed)`)
  if (failed > 0)
    console.log(`  ❌ Failed  : ${failed}`)
  console.log('─────────────────────────────────────────')

  if (created > 0) {
    console.log(`
ℹ️   Indexes are now BUILDING in Firebase.
    This takes 1–5 minutes depending on collection size.
    Check status at:
    https://console.firebase.google.com/project/${PROJECT_ID}/firestore/indexes
`)
  }

  if (failed > 0) process.exit(1)
}

main().catch(err => {
  console.error('\n❌ Unexpected error:', err)
  process.exit(1)
})
