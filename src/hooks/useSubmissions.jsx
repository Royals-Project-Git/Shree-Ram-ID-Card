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
  const [deletedCount,   setDeletedCount]   = useState(0)
  const [cursors,       setCursors]       = useState([null])
  const [activeFilters, setActiveFilters] = useState({
    filterRole: 'All',
    filterSch:  'All',
    filterStat: 'All',
    sortBy:     'date_desc',
    dateFilterType: 'none',
    filterDate: '',
    filterStartDate: '',
    filterEndDate: '',
  })

  // Client-side date filter storage
  const [fullFilteredSubmissions, setFullFilteredSubmissions] = useState(null)

  const snapshotUnsub = useRef(null)
  const isFirstLoad   = useRef(true)

  /* Helper to extract firebase index link */
  const handleFirebaseError = (err) => {
    console.error('Firestore operation failed:', err)
    const indexMatch = err.message?.match(/https:\/\/console\.firebase\.google\.com[^\s]*/)
    if (indexMatch) {
      toast.error(
        <div>
          Missing Firestore Index. Click <a href={indexMatch[0]} target="_blank" rel="noreferrer" style={{ textDecoration:'underline', fontWeight:'bold', color: 'white' }}>here</a> to create it.
        </div>,
        { duration: 15000 }
      )
    }
  }

  // Client-side helper to check if document matches date constraint
  // Falls back to submitted_at if the status-specific date field doesn't exist (for older records)
  const checkDateConstraint = useCallback((doc, dateField, dateFilterType, filterDate, filterStartDate, filterEndDate) => {
    let dVal = doc[dateField]
    // Fallback to submitted_at for older records that don't have approved_at/deleted_at/rejected_at
    if (!dVal && dateField !== 'submitted_at') {
      dVal = doc['submitted_at']
    }
    if (!dVal) return false
    const date = dVal.toDate ? dVal.toDate() : new Date(dVal)
    if (isNaN(date)) return false

    if (dateFilterType === 'single' && filterDate) {
      const targetDate = new Date(filterDate + 'T00:00:00')
      return date.getFullYear() === targetDate.getFullYear() &&
             date.getMonth() === targetDate.getMonth() &&
             date.getDate() === targetDate.getDate()
    } else if (dateFilterType === 'range') {
      let matches = true
      if (filterStartDate) {
        const start = new Date(filterStartDate + 'T00:00:00')
        matches = matches && date >= start
      }
      if (filterEndDate) {
        const end = new Date(filterEndDate + 'T23:59:59.999')
        matches = matches && date <= end
      }
      return matches
    }
    return true
  }, [])

  /* ── Build Firestore constraints ─────────────────────────────── */
  const buildConstraints = useCallback((filters, cursor = null, ignorePaginationForDate = false) => {
    const { filterRole, filterSch, filterStat, sortBy } = filters
    const c = []

    if (filterStat !== 'All') {
      c.push(where('status', '==', filterStat.toLowerCase()))
    } else {
      const hasDateFilter = (filters.dateFilterType === 'single' && filters.filterDate) || (filters.dateFilterType === 'range' && (filters.filterStartDate || filters.filterEndDate))
      if (!hasDateFilter) {
        c.push(where('status', 'in', ['pending', 'approved', 'rejected']))
      }
    }
    if (filterRole !== 'All') c.push(where('role',        '==', filterRole))
    if (filterSch  !== 'All') c.push(where('school_name', '==', filterSch))

    const sortField = sortBy === 'name_asc' ? 'name' : 'submitted_at'
    const sortDir   = (sortBy === 'date_asc' || sortBy === 'name_asc') ? 'asc' : 'desc'
    c.push(orderBy(sortField, sortDir))

    const hasDateFilter = (filters.dateFilterType === 'single' && filters.filterDate) || (filters.dateFilterType === 'range' && (filters.filterStartDate || filters.filterEndDate))
    if (!hasDateFilter || !ignorePaginationForDate) {
      if (cursor) c.push(startAfter(cursor))
      c.push(limit(PAGE_SIZE))
    }
    return c
  }, [])

  /* Fetch total count + per-status counts for current filters */
  const refreshCount = useCallback(async (filters) => {
    try {
      const { filterRole, filterSch, filterStat, dateFilterType, filterDate, filterStartDate, filterEndDate } = filters
      const base = []
      if (filterRole !== 'All') base.push(where('role',        '==', filterRole))
      if (filterSch  !== 'All') base.push(where('school_name', '==', filterSch))

      const hasDateFilter = (dateFilterType === 'single' && filterDate) || (dateFilterType === 'range' && (filterStartDate || filterEndDate))

      if (hasDateFilter) {
        // Query ALL matching submissions (without status and date constraints) and count in memory
        const q = query(collection(db, 'submissions'), ...base)
        const snap = await getDocs(q)
        const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }))

        const appCount = docs.filter(s => s.status === 'approved' && checkDateConstraint(s, 'approved_at', dateFilterType, filterDate, filterStartDate, filterEndDate)).length
        const penCount = docs.filter(s => s.status === 'pending' && checkDateConstraint(s, 'submitted_at', dateFilterType, filterDate, filterStartDate, filterEndDate)).length
        const rejCount = docs.filter(s => s.status === 'rejected' && checkDateConstraint(s, 'submitted_at', dateFilterType, filterDate, filterStartDate, filterEndDate)).length
        const delCount = docs.filter(s => s.status === 'deleted' && checkDateConstraint(s, 'deleted_at', dateFilterType, filterDate, filterStartDate, filterEndDate)).length

        setApprovedCount(appCount)
        setPendingCount(penCount)
        setRejectedCount(rejCount)
        setDeletedCount(delCount)

        if (filterStat === 'approved') {
          setTotalCount(appCount)
        } else if (filterStat === 'pending') {
          setTotalCount(penCount)
        } else if (filterStat === 'rejected') {
          setTotalCount(rejCount)
        } else if (filterStat === 'deleted') {
          setTotalCount(delCount)
        } else {
          setTotalCount(appCount + penCount + rejCount)
        }
      } else {
        // No date filter active — use fast server-side aggregation counts (no index required!)
        const [appSnap, penSnap, rejSnap, delSnap] = await Promise.all([
          getCountFromServer(query(collection(db, 'submissions'), ...base, where('status', '==', 'approved'))),
          getCountFromServer(query(collection(db, 'submissions'), ...base, where('status', '==', 'pending'))),
          getCountFromServer(query(collection(db, 'submissions'), ...base, where('status', '==', 'rejected'))),
          getCountFromServer(query(collection(db, 'submissions'), ...base, where('status', '==', 'deleted'))),
        ])

        const appVal = appSnap.data().count
        const penVal = penSnap.data().count
        const rejVal = rejSnap.data().count
        const delVal = delSnap.data().count

        setApprovedCount(appVal)
        setPendingCount(penVal)
        setRejectedCount(rejVal)
        setDeletedCount(delVal)

        if (filterStat === 'approved') {
          setTotalCount(appVal)
        } else if (filterStat === 'pending') {
          setTotalCount(penVal)
        } else if (filterStat === 'rejected') {
          setTotalCount(rejVal)
        } else if (filterStat === 'deleted') {
          setTotalCount(delVal)
        } else {
          setTotalCount(appVal + penVal + rejVal)
        }
      }
    } catch (err) {
      console.warn('Count failed:', err)
      handleFirebaseError(err)
    }
  }, [checkDateConstraint])

  /* Start real-time listener for page 1 */
  const startListener = useCallback((filters) => {
    if (snapshotUnsub.current) { snapshotUnsub.current(); snapshotUnsub.current = null }
    const hasDateFilter = (filters.dateFilterType === 'single' && filters.filterDate) || (filters.dateFilterType === 'range' && (filters.filterStartDate || filters.filterEndDate))

    const constraints = buildConstraints(filters, null, hasDateFilter)
    const q = query(collection(db, 'submissions'), ...constraints)
    snapshotUnsub.current = onSnapshot(q, (snap) => {
      let docs = snap.docs.map(d => ({ id: d.id, _docRef: d, ...d.data() }))

      // Client-side filter for deleted status when on 'All' tab
      if (filters.filterStat === 'All') {
        docs = docs.filter(s => s.status !== 'deleted')
      }

      if (hasDateFilter) {
        let dateField = 'submitted_at'
        if (filters.filterStat === 'approved') dateField = 'approved_at'
        else if (filters.filterStat === 'deleted') dateField = 'deleted_at'
        else if (filters.filterStat === 'rejected') dateField = 'rejected_at'

        docs = docs.filter(doc => checkDateConstraint(doc, dateField, filters.dateFilterType, filters.filterDate, filters.filterStartDate, filters.filterEndDate))

        setFullFilteredSubmissions(docs)
        setTotalCount(docs.length)
        setPage(docs.slice(0, PAGE_SIZE))
        setCurrentPage(1)
        setCursors([null])
      } else {
        setFullFilteredSubmissions(null)
        setPage(docs)
        setCurrentPage(1)
        setCursors([null, snap.docs[snap.docs.length - 1] || null])
      }
      setLoading(false)
    }, (err) => {
      console.error('Submissions listener error:', err)
      setLoading(false)
      handleFirebaseError(err)
    })
  }, [buildConstraints, checkDateConstraint])

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
        setPage([]); setTotalCount(0); setApprovedCount(0); setPendingCount(0); setRejectedCount(0); setDeletedCount(0); setLoading(false)
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

    if (fullFilteredSubmissions) {
      setPageLoading(true)
      const start = (pageNum - 1) * PAGE_SIZE
      const end = pageNum * PAGE_SIZE
      setPage(fullFilteredSubmissions.slice(start, end))
      setCurrentPage(pageNum)
      setPageLoading(false)
      return
    }

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
          query(collection(db, 'submissions'), ...buildConstraints(activeFilters, prevCursor, false))
        )
        if (snap.empty) break
        cursorSnaps.push(snap.docs[snap.docs.length - 1])
      }

      const targetCursor = cursorSnaps[pageNum - 1]
      const snap = await getDocs(
        query(collection(db, 'submissions'), ...buildConstraints(activeFilters, targetCursor, false))
      )
      let docs = snap.docs.map(d => ({ id: d.id, _docRef: d, ...d.data() }))

      // Client-side filter for deleted status when on 'All' tab and date filter is active
      const hasDateFilter = (activeFilters.dateFilterType === 'single' && activeFilters.filterDate) || (activeFilters.dateFilterType === 'range' && (activeFilters.filterStartDate || activeFilters.filterEndDate))
      if (activeFilters.filterStat === 'All' && hasDateFilter) {
        docs = docs.filter(s => s.status !== 'deleted')
      }

      // Detach live listener when browsing beyond page 1
      if (snapshotUnsub.current) { snapshotUnsub.current(); snapshotUnsub.current = null }

      cursorSnaps[pageNum] = snap.docs[snap.docs.length - 1] || null
      setCursors(cursorSnaps)
      setPage(docs)
      setCurrentPage(pageNum)
    } catch (err) {
      console.error('Page fetch error:', err)
      toast.error('Failed to load page')
      handleFirebaseError(err)
    } finally {
      setPageLoading(false)
    }
  }, [currentPage, cursors, activeFilters, buildConstraints, startListener, fullFilteredSubmissions])

  /* ── CRUD ───────────────────────────────────────────────────── */
  const createSubmission = async (formData, photoDataUrl) => {
    const payload = mapToFirestore(formData)

    // If there's a photo, upload to Cloudinary FIRST
    if (photoDataUrl) {
      try {
        const { uploadPhoto } = await import('../lib/firebase')
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
      const updates = { status }
      const now = new Date()
      if (status === 'approved') updates.approved_at = now
      else if (status === 'deleted') updates.deleted_at = now
      else if (status === 'rejected') updates.rejected_at = now

      await submissionsApi.updateStatus(id, status)
      toast.success(`Submission ${status}`)
      setPage(prev => prev.map(s => s.id === id ? { ...s, ...updates } : s))
      const icons = { approved: '✅', rejected: '❌', pending: '⏳', deleted: '🗑' }
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
      const updates = { status }
      const now = new Date()
      if (status === 'approved') updates.approved_at = now
      else if (status === 'deleted') updates.deleted_at = now
      else if (status === 'rejected') updates.rejected_at = now

      const res = await submissionsApi.bulkUpdateStatus(ids, status)
      toast.success(`${res.updated} submissions ${status}`)
      setPage(prev => prev.map(s => ids.includes(s.id) ? { ...s, ...updates } : s))
      refreshCount(activeFilters)
      return true
    } catch (err) { toast.error(err.message || 'Bulk update failed'); return false }
  }

  const deleteSubmission = async (id) => {
    try {
      await submissionsApi.delete(id)
      toast.success('Submission moved to Deleted tab')
      setPage(prev => prev.filter(s => s.id !== id))
      refreshCount(activeFilters)
      return true
    } catch (err) { toast.error(err.message || 'Delete failed'); return false }
  }

  const hardDeleteSubmission = async (id) => {
    try {
      await submissionsApi.hardDelete(id)
      toast.success('Submission permanently deleted')
      setPage(prev => prev.filter(s => s.id !== id))
      refreshCount(activeFilters)
      return true
    } catch (err) { toast.error(err.message || 'Delete failed'); return false }
  }

  const bulkDeleteSubmissions = async (ids) => {
    try {
      await Promise.all(ids.map(id => submissionsApi.delete(id)))
      toast.success(`${ids.length} submissions moved to Deleted tab`)
      setPage(prev => prev.filter(s => !ids.includes(s.id)))
      refreshCount(activeFilters)
      return true
    } catch (err) { toast.error(err.message || 'Bulk delete failed'); return false }
  }

  const bulkHardDeleteSubmissions = async (ids) => {
    try {
      await Promise.all(ids.map(id => submissionsApi.hardDelete(id)))
      toast.success(`${ids.length} submissions permanently deleted`)
      setPage(prev => prev.filter(s => !ids.includes(s.id)))
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

  const checkDuplicateNow = useCallback(async (schoolName, contactNumber, cls, sec, role) => {
    if (!schoolName || !contactNumber) return null
    try {
      const constraints = [
        where('school_name',    '==', schoolName),
        where('contact_number', '==', contactNumber),
      ]
      const isStaffOrEmployee = role === 'Staff' || role === 'Employee'
      if (!isStaffOrEmployee) {
        if (cls) constraints.push(where('class',   '==', cls))
        if (sec) constraints.push(where('section', '==', sec))
      }
      constraints.push(limit(1))
      const snap = await getDocs(query(collection(db, 'submissions'), ...constraints))
      return snap.empty ? null : { id: snap.docs[0].id, ...snap.docs[0].data() }
    } catch (err) {
      console.warn('Final duplicate check failed:', err)
      return null
    }
  }, [])

  const fetchAllSubmissions = useCallback(async (filters) => {
    const { filterRole, filterSch, filterStat, sortBy, dateFilterType, filterDate, filterStartDate, filterEndDate } = filters
    const c = []
    
    if (filterStat !== 'All') {
      c.push(where('status', '==', filterStat.toLowerCase()))
    } else {
      const hasDateFilter = (dateFilterType === 'single' && filterDate) || (dateFilterType === 'range' && (filterStartDate || filterEndDate))
      if (!hasDateFilter) {
        c.push(where('status', 'in', ['pending', 'approved', 'rejected']))
      }
    }
    if (filterRole !== 'All') c.push(where('role',        '==', filterRole))
    if (filterSch  !== 'All') c.push(where('school_name', '==', filterSch))

    let dateField = 'submitted_at'
    if (filterStat === 'approved') dateField = 'approved_at'
    else if (filterStat === 'deleted') dateField = 'deleted_at'
    else if (filterStat === 'rejected') dateField = 'rejected_at'

    const hasDateFilter = (dateFilterType === 'single' && filterDate) || (dateFilterType === 'range' && (filterStartDate || filterEndDate))
    if (dateFilterType === 'single' && filterDate) {
      const start = new Date(filterDate + 'T00:00:00')
      const end = new Date(filterDate + 'T23:59:59.999')
      c.push(where(dateField, '>=', start))
      c.push(where(dateField, '<=', end))
    } else if (dateFilterType === 'range') {
      if (filterStartDate) {
        const start = new Date(filterStartDate + 'T00:00:00')
        c.push(where(dateField, '>=', start))
      }
      if (filterEndDate) {
        const end = new Date(filterEndDate + 'T23:59:59.999')
        c.push(where(dateField, '<=', end))
      }
    }

    const sortField = hasDateFilter ? dateField : (sortBy === 'name_asc' ? 'name' : 'submitted_at')
    const sortDir   = (sortBy === 'date_asc' || sortBy === 'name_asc') ? 'asc' : 'desc'
    c.push(orderBy(sortField, sortDir))

    const snap = await getDocs(query(collection(db, 'submissions'), ...c))
    let docs = snap.docs.map(d => ({ id: d.id, ...d.data() }))

    if (filterStat === 'All' && hasDateFilter) {
      docs = docs.filter(s => s.status !== 'deleted')
    }
    return docs
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
      deletedCount,
      totalPages,
      activeFilters,
      applyFilters,
      goToPage,
      createSubmission,
      updateStatus,
      updateSubmission,
      bulkUpdateStatus,
      deleteSubmission,
      hardDeleteSubmission,
      bulkDeleteSubmissions,
      bulkHardDeleteSubmissions,
      checkDuplicate,
      checkDuplicateNow,
      fetchAllSubmissions,
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