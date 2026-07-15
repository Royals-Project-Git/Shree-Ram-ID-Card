/**
 * firestore.js  —  replaces api.js entirely.
 * All data now goes directly to Firestore. No custom backend needed.
 * Storage handled by Cloudinary (not Firebase Storage).
 */
import {
  collection, doc, addDoc, getDoc, getDocs, updateDoc,
  deleteDoc, query, where, orderBy, limit,
  getCountFromServer, serverTimestamp,
} from 'firebase/firestore'
import { db, auth, uploadPhoto as uploadPhotoToStorage, uploadOrgLogo } from './firebase'
import toast from 'react-hot-toast'



/* ═══════════════════════════════════════════════════════════
   SUBMISSIONS
═══════════════════════════════════════════════════════════ */
export const submissionsApi = {

  list: async (params = {}) => {
    let q = collection(db, 'submissions')
    const constraints = [orderBy('submitted_at', 'desc')]
    if (params.status && params.status !== 'All') {
      constraints.push(where('status', '==', params.status))
    }
    if (params.school) {
      constraints.push(where('school_name', '==', params.school))
    }
    if (params.limit) {
      constraints.push(limit(Number(params.limit)))
    }
    q = query(q, ...constraints)
    const snap = await getDocs(q)
    return snap.docs.map(d => ({ id: d.id, ...d.data() }))
  },

  get: async (id) => {
    const snap = await getDoc(doc(db, 'submissions', id))
    if (!snap.exists()) throw new Error('Submission not found')
    return { id: snap.id, ...snap.data() }
  },

  create: async (body) => {
    const docRef = await addDoc(collection(db, 'submissions'), {
      ...body,
      status:       'pending',
      submitted_at: serverTimestamp(),
    })
    return { id: docRef.id, ...body, status: 'pending' }
  },

  updateStatus: async (id, status) => {
    await updateDoc(doc(db, 'submissions', id), { status })
  },

  bulkUpdateStatus: async (ids, status) => {
    await Promise.all(ids.map(id => updateDoc(doc(db, 'submissions', id), { status })))
    return { updated: ids.length }
  },

  delete: async (id) => {
    await deleteDoc(doc(db, 'submissions', id))
  },

  stats: async () => {
    const snap = await getCountFromServer(collection(db, 'submissions'))
    return { total: snap.data().count }
  },

  uploadPhoto: async (submissionId, dataUrl) => {
    const url = await uploadPhotoToStorage(submissionId, dataUrl)
    await updateDoc(doc(db, 'submissions', submissionId), { photo_url: url })
    return { photo_url: url }
  },
}

/* ═══════════════════════════════════════════════════════════
   FORM CONFIGS
═══════════════════════════════════════════════════════════ */
export const formConfigsApi = {

  list: async () => {
    const q    = query(collection(db, 'formConfigs'), orderBy('created_at', 'desc'))
    const snap = await getDocs(q)
    return snap.docs.map(d => ({ id: d.id, ...d.data() }))
  },

  getByUrlId: async (urlId) => {
    const q    = query(collection(db, 'formConfigs'), where('url_id', '==', urlId))
    const snap = await getDocs(q)
    if (snap.empty) throw new Error('Form not found')
    const d = snap.docs[0]
    return { id: d.id, ...d.data() }
  },

  create: async (body) => {
    const docRef = await addDoc(collection(db, 'formConfigs'), {
      ...body,
      is_active:  true,
      created_at: serverTimestamp(),
    })
    const newDoc = { id: docRef.id, ...body, is_active: true }
    return {
      data: newDoc,
      url:  `${window.location.origin}/form/${body.url_id || docRef.id}`,
    }
  },

  update: async (id, body) => {
    await updateDoc(doc(db, 'formConfigs', id), body)
    return { id, ...body }
  },

  delete: async (id) => {
    await deleteDoc(doc(db, 'formConfigs', id))
  },
}

/* ═══════════════════════════════════════════════════════════
   ORGANIZATIONS
═══════════════════════════════════════════════════════════ */
export const organizationsApi = {

  list: async () => {
    const q    = query(collection(db, 'organizations'), orderBy('created_at', 'desc'))
    const snap = await getDocs(q)
    return snap.docs.map(d => ({ id: d.id, ...d.data() }))
  },

  /* Find org by name — used by DetailsForm to get classes_config */
  getByName: async (name) => {
    const trimmed = (name || '').trim()
    const q    = query(collection(db, 'organizations'), where('name', '==', trimmed))
    const snap = await getDocs(q)
    if (snap.empty) return null
    const d = snap.docs[0]
    return { id: d.id, ...d.data() }
  },

  create: async (formData, logoFile) => {
    const docRef = await addDoc(collection(db, 'organizations'), {
      name:           formData.name,
      type:           formData.type,
      address:        formData.address        || null,
      contact:        formData.contact        || null,
      email:          formData.email          || null,
      website:        formData.website        || null,
      classes_config: formData.classes_config || [],
      logo_url:       null,
      created_at:     serverTimestamp(),
    })
    let org = { id: docRef.id, ...formData, logo_url: null }

    if (logoFile) {
      try {
        const logoUrl = await uploadOrgLogo(docRef.id, logoFile)
        await updateDoc(doc(db, 'organizations', docRef.id), { logo_url: logoUrl })
        org.logo_url = `${logoUrl}?t=${Date.now()}`
      } catch (err) {
        console.warn('Logo upload failed:', err.message)
        toast.error('Organization saved but logo upload failed.')
      }
    }
    return org
  },

  update: async (id, updates, logoFile = null, removeLogo = false) => {
    const payload = {
      name:           updates.name,
      type:           updates.type,
      address:        updates.address        || null,
      contact:        updates.contact        || null,
      email:          updates.email          || null,
      website:        updates.website        || null,
      classes_config: Array.isArray(updates.classes_config) ? updates.classes_config : [],
    }

    if (removeLogo && !logoFile) {
      payload.logo_url = null
    }

    await updateDoc(doc(db, 'organizations', id), payload)
    // Preserve existing logo_url in local state when no logo change occurred
    let org = { id, logo_url: updates.logo_url || null, ...payload }

    if (logoFile) {
      try {
        const logoUrl = await uploadOrgLogo(id, logoFile)
        await updateDoc(doc(db, 'organizations', id), { logo_url: logoUrl })
        org.logo_url = `${logoUrl}?t=${Date.now()}`
      } catch (err) {
        console.warn('Logo upload error:', err.message)
        toast.error('Organization updated but logo upload failed.')
      }
    }
    return org
  },

  delete: async (id) => {
    await deleteDoc(doc(db, 'organizations', id))
    // Cloudinary image cleanup requires server-side API secret — skipped
  },
}

/* ═══════════════════════════════════════════════════════════
   CARD TEMPLATES
═══════════════════════════════════════════════════════════ */
export const cardTemplatesApi = {

  list: async () => {
    const q    = query(collection(db, 'cardTemplates'), orderBy('created_at', 'desc'))
    const snap = await getDocs(q)
    return snap.docs.map(d => ({ id: d.id, ...d.data() }))
  },

  save: async (templateData) => {
    const docRef = await addDoc(collection(db, 'cardTemplates'), {
      ...templateData,
      created_at: serverTimestamp(),
    })
    return { id: docRef.id, ...templateData }
  },

  update: async (id, templateData) => {
    await updateDoc(doc(db, 'cardTemplates', id), templateData)
    return { id, ...templateData }
  },

  delete: async (id) => {
    await deleteDoc(doc(db, 'cardTemplates', id))
  },
}
export const notificationsApi = {

  // ✅ Add userId to every notification on creation
  create: async (payload) => {
    const uid = auth.currentUser?.uid  // import auth from './firebase'
    const docRef = await addDoc(collection(db, 'notifications'), {
      type:       payload.type  || 'info',
      title:      payload.title || '',
      body:       payload.body  || '',
      icon:       payload.icon  || '🔔',
      read:       false,
      link:       payload.link  || null,
      meta:       payload.meta  || {},
      userId:     uid || null,          // 👈 add this
      created_at: serverTimestamp(),
    })
    return { id: docRef.id, ...payload, read: false }
  },

  markRead: async (id) => {
    await updateDoc(doc(db, 'notifications', id), { read: true })
  },

  markAllRead: async () => {
    const uid = auth.currentUser?.uid
    if (!uid) return
    const snap = await getDocs(
      query(collection(db, 'notifications'), where('userId', '==', uid), where('read', '==', false))
    )
    await Promise.all(snap.docs.map(d => updateDoc(d.ref, { read: true })))
  },

  delete: async (id) => {
    await deleteDoc(doc(db, 'notifications', id))
  },

  deleteAll: async () => {
    const uid = auth.currentUser?.uid
    if (!uid) return
    const snap = await getDocs(
      query(collection(db, 'notifications'), where('userId', '==', uid), limit(50))
    )
    await Promise.all(snap.docs.map(d => deleteDoc(d.ref)))
  },
}