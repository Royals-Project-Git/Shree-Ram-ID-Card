import { useState, useEffect, useCallback, useRef, createContext, useContext } from 'react'
import {
  onSnapshot, collection, query, orderBy, limit,
  startAfter, getCountFromServer, where, getDocs,
} from 'firebase/firestore'
import { onAuthStateChanged } from 'firebase/auth'
import { db, auth } from '../lib/firebase'
import { submissionsApi, notificationsApi } from '../lib/firestore'
import toast from 'react-hot-toast'

/* ── camelCase form fields → Firestore field names ─────────────── */
function mapToFirestore(formData) {
  return {
    form_config_id:    formData.formConfigId         || null,
    school_name:       formData.schoolName           || formData.school_name || '',
    role:              formData.role                 || 'Student',
    name:              formData.Name                 || null,
    fathers_name:      formData.FathersName          || formData.fathers_name    || null,
    class:             formData.ClassN               || formData.class       || null,
    section:           formData.Section              || formData.section     || null,
    roll_number:       formData.RollNumber           || formData.roll_number || null,
    admission_number:  formData.AdmissionNumber      || formData.admission_number || null,
    date_of_birth:     formData.DateofBirth          || formData.date_of_birth    || null,
    contact_number:    formData.ContactNumber        || formData.contact_number   || null,
    emergency_contact: formData.EmergencyContact     || formData.emergency_contact|| null,
    blood_group:       formData.BloodGroup           || formData.blood_group      || null,
    address:           formData.Address              || formData.address          || null,
    mode_of_transport: formData.ModeOfTransportation || formData.mode_of_transport|| null,
    designation:       formData.Designation          || formData.designation      || null,
    department:        formData.Department           || formData.department       || null,
    aadhar_card:       formData.AadhaarNumber        || formData.AadharCard       || formData.aadhar_card      || null,
    employee_id:       formData.EmployeeID           || formData.employee_id      || null,
    email_id:          formData.EmailId              || formData.email_id         || null,
    valid_from:        formData.ValidFrom            || formData.valid_from       || null,
    valid_till:        formData.ValidTill            || formData.valid_till       || null,
    batch_timing:      formData.BatchTiming          || formData.batch_timing     || null,
  }
}

const SubmissionsContext = createContext(null)

export const PAGE_SIZE = 25

export function SubmissionsProvider({ children }) {
  const [page,          setPage]          = useState([])
  const [loading,       setLoading]       = useState(true)
  const [pageLoading,   setPageLoading]   = useState(false)
  const [currentPage,   setCurrentPage]   = useState(1)
  const [totalCount,    setTotalCount]    = useState(0)
  const [approvedCount,  setApprovedCount]  = useState(0)
  const [pendingCount,   setPendingCount]   = useState(0)
  const [rejectedCount,  setRejectedCount]  = useState(0)
  const [cursors,       setCursors]       = useState([null])
  const [activeFilters, setActiveFilters] = useState({
    filterRole: 'All',
    filterSch:  'All',
    filterStat: 'All',
    sortBy:     'date_desc',
  })

  const snapshotUnsub = useRef(null)
  const isFirstLoad   = useRef(true)

  /* ── Build Firestore constraints ─────────────────────────────── */
  const buildConstraints = useCallback((filters, cursor = null) => {
    const { filterRole, filterSch, filterStat, sortBy } = filters
    const c = []

    // NOTE: Firestore requires equality filters BEFORE range/orderBy.
    // Status, role, and school_name are all equality filters — safe to combine.
    if (filterStat !== 'All') c.push(where('status',      '==', filterStat.toLowerCase()))
    if (filterRole !== 'All') c.push(where('role',        '==', filterRole))
    // school_name stores the org name for ALL org types (schools, colleges, hospitals…)
    if (filterSch  !== 'All') c.push(where('school_name', '==', filterSch))

    const sortField = sortBy === 'name_asc' ? 'name' : 'submitted_at'
    const sortDir   = (sortBy === 'date_asc' || sortBy === 'name_asc') ? 'asc' : 'desc'
    c.push(orderBy(sortField, sortDir))
    if (cursor) c.push(startAfter(cursor))
    c.push(limit(PAGE_SIZE))
    return c
  }, [])

  /* Fetch total count + per-status counts for current filters */
  const refreshCount = useCallback(async (filters) => {
    try {
      const { filterRole, filterSch, filterStat } = filters
      const base = []
      if (filterRole !== 'All') base.push(where('role',        '==', filterRole))
      if (filterSch  !== 'All') base.push(where('school_name', '==', filterSch))

      // Total count (respects status filter if set)
      const totalC = filterStat !== 'All'
        ? [...base, where('status', '==', filterStat.toLowerCase())]
        : base
      const totalSnap = await getCountFromServer(query(collection(db, 'submissions'), ...totalC))
      setTotalCount(totalSnap.data().count)

      // Per-status counts always ignore the status filter so all are always accurate
      const [appSnap, penSnap, rejSnap] = await Promise.all([
        getCountFromServer(query(collection(db, 'submissions'), ...base, where('status', '==', 'approved'))),
        getCountFromServer(query(collection(db, 'submissions'), ...base, where('status', '==', 'pending'))),
        getCountFromServer(query(collection(db, 'submissions'), ...base, where('status', '==', 'rejected'))),
      ])
      setApprovedCount(appSnap.data().count)
      setPendingCount(penSnap.data().count)
      setRejectedCount(rejSnap.data().count)
    } catch (err) { console.warn('Count failed:', err) }
  }, [])

  /* Start real-time listener for page 1 */
  const startListener = useCallback((filters) => {
    if (snapshotUnsub.current) { snapshotUnsub.current(); snapshotUnsub.current = null }
    const constraints = buildConstraints(filters, null)
    const q = query(collection(db, 'submissions'), ...constraints)
    snapshotUnsub.current = onSnapshot(q, (snap) => {
      const docs = snap.docs.map(d => ({ id: d.id, _docRef: d, ...d.data() }))

      if (!isFirstLoad.current) {
        snap.docChanges().forEach(change => {
          if (change.type === 'added') {
            const newDoc = { id: change.doc.id, ...change.doc.data() }
            const orgName = newDoc.school_name || 'Unknown organization'
            notificationsApi.create({
              type:  'new_submission',
              title: `New submission from ${newDoc.name || 'Someone'}`,
              body:  `${orgName} · ${newDoc.role || 'Student'}${newDoc.class ? ' · Class ' + newDoc.class : ''}${newDoc.section ? ' ' + newDoc.section : ''}`.trim().replace(/·\s*$/, ''),
              icon:  '📋', link: '/admin',
              meta:  { submissionId: newDoc.id, org: orgName, name: newDoc.name },
            }).catch(err => console.warn('Notification create failed:', err))
            toast.success(`New submission from ${newDoc.name || 'someone'}!`)
            setTotalCount(c => c + 1)
          }
        })
      }
      isFirstLoad.current = false
      setPage(docs)
      setCurrentPage(1)
      // cursors[0] = null (start of collection), cursors[1] = last doc of page 1
      setCursors([null, snap.docs[snap.docs.length - 1] || null])
      setLoading(false)
    }, (err) => {
      console.error('Submissions listener error:', err)
      setLoading(false)
    })
  }, [buildConstraints])

  /* Auth init */
  useEffect(() => {
    const authUnsub = onAuthStateChanged(auth, (user) => {
      if (user) {
        setLoading(true)
        isFirstLoad.current = true
        startListener(activeFilters)
        refreshCount(activeFilters)
      } else {
        if (snapshotUnsub.current) { snapshotUnsub.current(); snapshotUnsub.current = null }
        setPage([]); setTotalCount(0); setApprovedCount(0); setPendingCount(0); setRejectedCount(0); setLoading(false)
      }
    })
    return () => {
      authUnsub()
      if (snapshotUnsub.current) snapshotUnsub.current()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  /* Apply new filters — always resets to page 1 and clears cursor chain */
  const applyFilters = useCallback((newFilters) => {
    setActiveFilters(newFilters)
    setLoading(true)
    setCurrentPage(1)
    setCursors([null])   // ← clear cursor chain so goToPage builds fresh for new filters
    isFirstLoad.current = true
    startListener(newFilters)
    refreshCount(newFilters)
  }, [startListener, refreshCount])

  /* Go to page N — builds cursor chain using the ACTIVE filters */
  const goToPage = useCallback(async (pageNum) => {
    if (pageNum === currentPage) return

    if (pageNum === 1) {
      setLoading(true)
      isFirstLoad.current = false
      startListener(activeFilters)
      return
    }

    setPageLoading(true)
    try {
      let cursorSnaps = [...cursors]

      // Walk forward through pages to build missing cursors
      while (cursorSnaps.length <= pageNum) {
        const prevCursor = cursorSnaps[cursorSnaps.length - 1]
        // If there's no cursor for the previous page, we're past the end
        if (prevCursor === undefined) break
        const snap = await getDocs(
          query(collection(db, 'submissions'), ...buildConstraints(activeFilters, prevCursor))
        )
        if (snap.empty) break
        cursorSnaps.push(snap.docs[snap.docs.length - 1])
      }

      const targetCursor = cursorSnaps[pageNum - 1]
      const snap = await getDocs(
        query(collection(db, 'submissions'), ...buildConstraints(activeFilters, targetCursor))
      )
      const docs = snap.docs.map(d => ({ id: d.id, _docRef: d, ...d.data() }))

      // Detach live listener when browsing beyond page 1
      if (snapshotUnsub.current) { snapshotUnsub.current(); snapshotUnsub.current = null }

      cursorSnaps[pageNum] = snap.docs[snap.docs.length - 1] || null
      setCursors(cursorSnaps)
      setPage(docs)
      setCurrentPage(pageNum)
    } catch (err) {
      console.error('Page fetch error:', err)
      toast.error('Failed to load page')
    } finally {
      setPageLoading(false)
    }
  }, [currentPage, cursors, activeFilters, buildConstraints, startListener])

  /* ── CRUD ───────────────────────────────────────────────────── */
  const createSubmission = async (formData, photoDataUrl) => {
    const payload = mapToFirestore(formData)

    // If there's a photo, upload to Cloudinary FIRST (before creating the Firestore doc)
    // so we can include photo_url in the initial create — avoiding a separate updateDoc
    // which would fail because the public form user is not authenticated.
    if (photoDataUrl) {
      try {
        const { uploadPhoto } = await import('../lib/firebase')
        // Upload with a temp key; we'll use the real doc ID after
        const tempId = `temp_${Date.now()}`
        const url = await uploadPhoto(tempId, photoDataUrl)
        payload.photo_url = url
      } catch (err) {
        console.warn('Photo upload failed:', err.message)
        toast.error('Details saved but photo upload failed — please contact admin to re-upload.')
      }
    }

    const sub = await submissionsApi.create(payload)
    refreshCount(activeFilters)
    return { ...sub }
  }

  const updateStatus = async (id, status, submissionName = '') => {
    try {
      await submissionsApi.updateStatus(id, status)
      toast.success(`Submission ${status}`)
      setPage(prev => prev.map(s => s.id === id ? { ...s, status } : s))
      const icons = { approved: '✅', rejected: '❌', pending: '⏳' }
      notificationsApi.create({
        type: 'status_change',
        title: `Submission ${status}`,
        body: submissionName ? `${submissionName}'s ID card was ${status}` : `A submission was marked as ${status}`,
        icon: icons[status] || '🔔', link: '/admin',
        meta: { submissionId: id, status },
      }).catch(err => console.warn('Notification create failed:', err))
      refreshCount(activeFilters)
      return true
    } catch (err) { toast.error(err.message || 'Update failed'); return false }
  }

  const updateSubmission = async (id, fields) => {
    try {
      const { db } = await import('../lib/firebase')
      const { doc, updateDoc } = await import('firebase/firestore')
      await updateDoc(doc(db, 'submissions', id), fields)
      setPage(prev => prev.map(s => s.id === id ? { ...s, ...fields } : s))
      toast.success('Submission updated')
      return true
    } catch (err) { toast.error(err.message || 'Update failed'); return false }
  }

  const bulkUpdateStatus = async (ids, status) => {
    try {
      const res = await submissionsApi.bulkUpdateStatus(ids, status)
      toast.success(`${res.updated} submissions ${status}`)
      setPage(prev => prev.map(s => ids.includes(s.id) ? { ...s, status } : s))
      refreshCount(activeFilters)
      return true
    } catch (err) { toast.error(err.message || 'Bulk update failed'); return false }
  }

  const deleteSubmission = async (id) => {
    try {
      await submissionsApi.delete(id)
      toast.success('Submission deleted')
      setPage(prev => prev.filter(s => s.id !== id))
      setTotalCount(c => Math.max(0, c - 1))
      refreshCount(activeFilters)
      return true
    } catch (err) { toast.error(err.message || 'Delete failed'); return false }
  }

  const bulkDeleteSubmissions = async (ids) => {
    try {
      await Promise.all(ids.map(id => submissionsApi.delete(id)))
      toast.success(`${ids.length} submission${ids.length > 1 ? 's' : ''} deleted`)
      setPage(prev => prev.filter(s => !ids.includes(s.id)))
      setTotalCount(c => Math.max(0, c - ids.length))
      refreshCount(activeFilters)
      return true
    } catch (err) { toast.error(err.message || 'Bulk delete failed'); return false }
  }

  const dupTimer = useRef(null)
  const checkDuplicate = useCallback((schoolName, name, rollNumber, callback, contactNumber, cls, sec) => {
    if (dupTimer.current) clearTimeout(dupTimer.current)
    if (!schoolName || (!name && !rollNumber && !contactNumber)) { callback(null); return }
    dupTimer.current = setTimeout(async () => {
      try {
        const constraints = [where('school_name', '==', schoolName)]
        if (contactNumber)   constraints.push(where('contact_number', '==', contactNumber))
        else if (rollNumber) constraints.push(where('roll_number',    '==', rollNumber))
        else if (name)       constraints.push(where('name',           '==', name))
        // Narrow to class/section when provided (contact duplicate checks)
        if (cls) constraints.push(where('class',   '==', cls))
        if (sec) constraints.push(where('section', '==', sec))
        constraints.push(limit(5))
        const snap = await getDocs(query(collection(db, 'submissions'), ...constraints))
        callback(snap.empty ? null : { id: snap.docs[0].id, ...snap.docs[0].data() })
      } catch { callback(null) }
    }, 400)
  }, [])

  // ── Final, non-debounced duplicate check — used right before actually
  // creating a submission. The live `checkDuplicate` above is debounced
  // (400ms) and only updates UI warning state, so a fast typer/clicker could
  // hit "Submit" before that warning ever lands, letting a real duplicate
  // through. This one runs synchronously (awaited) at the moment of submit,
  // queries Firestore fresh, and is the actual gate that blocks duplicates.
  //
  // Scoping by role:
  //   - Student: narrowed to the same school + class + section (a contact
  //     number can legitimately repeat across different classes/sections —
  //     e.g. siblings/guardians — so we only block exact same-class repeats).
  //   - Staff / Employee: no class/section exists for these roles, so the
  //     check is school-wide instead. It also does NOT filter by role —
  //     a contact number already used by a Student, Staff, or Employee at
  //     that school will block a new Staff/Employee submission too, so the
  //     same person can't end up registered twice under different roles.
  const checkDuplicateNow = useCallback(async (schoolName, contactNumber, cls, sec, role) => {
    if (!schoolName || !contactNumber) return null
    try {
      const constraints = [
        where('school_name',    '==', schoolName),
        where('contact_number', '==', contactNumber),
      ]
      const isStaffOrEmployee = role === 'Staff' || role === 'Employee'
      // Only narrow by class/section for Student submissions.
      if (!isStaffOrEmployee) {
        if (cls) constraints.push(where('class',   '==', cls))
        if (sec) constraints.push(where('section', '==', sec))
      }
      // Staff/Employee checks intentionally omit a role filter, so they
      // catch duplicates against ANY existing submission at the school —
      // Student, Staff, or Employee alike.
      constraints.push(limit(1))
      const snap = await getDocs(query(collection(db, 'submissions'), ...constraints))
      return snap.empty ? null : { id: snap.docs[0].id, ...snap.docs[0].data() }
    } catch (err) {
      console.warn('Final duplicate check failed:', err)
      return null
    }
  }, [])

  const totalPages = Math.ceil(totalCount / PAGE_SIZE)

  return (
    <SubmissionsContext.Provider value={{
      submissions: page,
      page,
      loading,
      pageLoading,
      currentPage,
      totalCount,
      approvedCount,
      pendingCount,
      rejectedCount,
      totalPages,
      activeFilters,
      applyFilters,
      goToPage,
      createSubmission,
      updateStatus,
      updateSubmission,
      bulkUpdateStatus,
      deleteSubmission,
      bulkDeleteSubmissions,
      checkDuplicate,
      checkDuplicateNow,
      fetchSubmissions: () => {},
    }}>
      {children}
    </SubmissionsContext.Provider>
  )
}

export function useSubmissions() {
  const ctx = useContext(SubmissionsContext)
  if (!ctx) throw new Error('useSubmissions must be inside SubmissionsProvider')
  return ctx
}