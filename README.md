# Firebase Migration Guide
## From: Supabase + Custom Express API → Firebase (complete backend)

---

## What changed

| Old | New |
|-----|-----|
| `src/lib/supabase.js` | `src/lib/firebase.js` |
| `src/lib/api.js` | `src/lib/firestore.js` |
| `src/hooks/useAuth.jsx` | `src/hooks/useAuth.jsx` (rewritten) |
| `src/hooks/useSubmissions.jsx` | `src/hooks/useSubmissions.jsx` (rewritten) |
| `src/hooks/useOrganizations.jsx` | `src/hooks/useOrganizations.jsx` (rewritten) |
| `src/hooks/useCardtemplates.jsx` | `src/hooks/useCardtemplates.jsx` (rewritten) |
| `src/hooks/useFormConfigs.jsx` | `src/hooks/useFormConfigs.jsx` (rewritten) |
| `src/pages/DetailsForm.jsx` | `src/pages/DetailsForm.jsx` (updated imports only) |
| Your Express backend server | **DELETED — no longer needed** |

**Pages that need NO changes:**
`Admin.jsx`, `Organizations.jsx`, `Dashboard.jsx`, `AllTemplates.jsx`,
`AddTemplate.jsx`, `Idcardbuilder.jsx`, `Success.jsx`, `Home.jsx`, `About.jsx`, `Navbar.jsx`, `App.jsx`

---

## Step 1 — Install Firebase, remove Supabase

```bash
npm remove @supabase/supabase-js
npm install firebase
```

---

## Step 2 — Copy migrated files into your project

Replace these files with the ones provided:
```
src/lib/firebase.js          ← NEW (replaces supabase.js)
src/lib/firestore.js         ← NEW (replaces api.js)
src/hooks/useAuth.jsx        ← REPLACED
src/hooks/useSubmissions.jsx ← REPLACED
src/hooks/useOrganizations.jsx ← REPLACED
src/hooks/useCardtemplates.jsx ← REPLACED
src/hooks/useFormConfigs.jsx ← REPLACED
src/pages/DetailsForm.jsx    ← REPLACED
```

Delete these files:
```
src/lib/supabase.js   ← DELETE
src/lib/api.js        ← DELETE
```

---

## Step 3 — Set up Firebase project

1. Go to n
2. Create a new project
3. Enable **Authentication** → Email/Password sign-in
4. Enable **Firestore Database** → Start in production mode
5. Enable **Storage** → Start in production mode
6. Go to Project Settings → Your apps → Add Web app → copy config

---

## Step 4 — Set up .env.local

```env
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=your-app.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-app-id
VITE_FIREBASE_STORAGE_BUCKET=your-app.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
```

---

## Step 5 — Deploy security rules

Install Firebase CLI if you haven't:
```bash
npm install -g firebase-tools
firebase login
firebase init   # select Firestore + Storage
```

Copy `firestore.rules` and `storage.rules` from this package,
then deploy:
```bash
firebase deploy --only firestore:rules,storage
```

---

## Step 6 — Create your admin user

In Firebase Console → Authentication → Add user manually
(or use the sign-up form on your app)

---

## Step 7 — Firestore indexes needed

Firebase will tell you in the browser console when an index is missing.
Click the link it provides — it auto-creates the index for you.

Common ones needed:
- `submissions` collection: `submitted_at DESC`
- `formConfigs` collection: `url_id ASC`
- `organizations` collection: `name ASC`

---

## Realtime updates

Your old code used Supabase `postgres_changes` for real-time.
The new `useSubmissions.jsx` uses Firebase `onSnapshot` which works the same way —
the admin page will instantly show new submissions without refreshing.

---

## Free tier comparison

| | Supabase Free | Firebase Free (Spark) |
|--|--|--|
| Storage | 512 MB | **5 GB** |
| Database reads | Limited | **50,000/day** |
| Database writes | Limited | **20,000/day** |
| Auth users | Unlimited | Unlimited |
| Custom backend needed | Yes | **No** |
| Realtime | Yes | **Yes** |
