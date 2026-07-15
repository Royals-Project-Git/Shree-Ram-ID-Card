import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'

// ── Firebase Config ──────────────────────────────────────────

const firebaseConfig = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId:             import.meta.env.VITE_FIREBASE_APP_ID,
}

const app = initializeApp(firebaseConfig)

export const auth = getAuth(app)
export const db   = getFirestore(app)

// ── Cloudinary Config ─────────────────────────────────────────

const CLD_URL = `https://api.cloudinary.com/v1_1/${import.meta.env.VITE_CLOUDINARY_CLOUD_NAME}/image/upload`
const CLD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET

// ── Upload Function ───────────────────────────────────────────

async function uploadToCloudinary(fileOrBlob, folder = "uploads") {
  if (!fileOrBlob) {
    throw new Error("No file provided")
  }

  const fd = new FormData()
  fd.append('file', fileOrBlob, 'upload.jpg')
  fd.append('upload_preset', CLD_PRESET)
  fd.append('folder', folder)

  let res
  try {
    res = await fetch(CLD_URL, {
      method: 'POST',
      body: fd
    })
  } catch (err) {
    console.error("FETCH ERROR:", err)
    throw new Error("Network error — check your connection")
  }

  let data = {}
  try {
    const text = await res.text()
    console.log("RAW RESPONSE:", text?.slice(0, 200))
    data = text ? JSON.parse(text) : {}
  } catch (err) {
    // Response body unreadable (e.g. CORS opaque response) — but upload may have succeeded
    console.warn("Response parse warning:", err)
    // If status is in 2xx range despite parse issue, treat as success but we can't get secure_url
    if (res.ok) {
      throw new Error("Upload may have succeeded but response was unreadable. Please refresh and check.")
    }
    throw new Error("Upload failed — could not read server response")
  }

  if (!res.ok) {
    console.error("Cloudinary ERROR:", data)
    throw new Error(data?.error?.message || "Upload failed from server")
  }

  if (!data.secure_url) {
    console.error("No secure_url in response:", data)
    throw new Error("Upload succeeded but no URL returned")
  }

  return data.secure_url
}

// ── Convert dataURL → Blob (FIXED) ───────────────────────────

function dataURLtoBlob(dataURL) {
  if (!dataURL) throw new Error("Invalid dataURL")

  const arr = dataURL.split(',')
  const mimeMatch = arr[0].match(/:(.*?);/)

  if (!mimeMatch) {
    throw new Error("Invalid dataURL format")
  }

  const mime = mimeMatch[1]
  const bstr = atob(arr[1])
  let n = bstr.length
  const u8arr = new Uint8Array(n)

  while (n--) {
    u8arr[n] = bstr.charCodeAt(n)
  }

  return new Blob([u8arr], { type: mime })
}

// ── Public Upload Functions ──────────────────────────────────

export async function uploadBgImage(file) {
  return uploadToCloudinary(file, 'backgrounds')
}

export async function uploadPhoto(submissionId, dataUrl) {
  try {
    console.log("DATA URL:", dataUrl?.slice(0, 50))

    const blob = dataURLtoBlob(dataUrl)
    console.log("BLOB:", blob)

    return await uploadToCloudinary(blob, `submissions/${submissionId}`)

  } catch (err) {
    console.error("UPLOAD ERROR:", err)
    throw err
  }
}

export async function uploadOrgLogo(orgId, file) {
  return uploadToCloudinary(file, 'org-logos')
}

// ── Helper ───────────────────────────────────────────────────

export function getPhotoUrl(path) {
  return path || null
}