import { useState, useRef, useEffect, useCallback } from 'react'
import { useSubmissions } from '../hooks/useSubmissions'
import { useOrganizations } from '../hooks/useOrganizations'
import { useNavigate } from 'react-router-dom'
import { useCardTemplates } from '../hooks/useCardtemplates'
import { Badge, Btn, Spinner, EmptyState, ConfirmDialog } from '../components/shared/index'
import IDCard, { TEMPLATES } from '../components/idcard/IDCard'
import { db } from '../lib/firebase'
import {
  collection, query, where, orderBy, limit,
  getDocs, startAfter, getCountFromServer,
} from 'firebase/firestore'
import toast from 'react-hot-toast'

const PAGE_SIZE = 25


/* ── Responsive hook ─────────────────────────────────────── */
function useWindowWidth() {
  const [w, setW] = useState(typeof window !== 'undefined' ? window.innerWidth : 1200)
  useEffect(() => {
    const fn = () => setW(window.innerWidth)
    window.addEventListener('resize', fn)
    return () => window.removeEventListener('resize', fn)
  }, [])
  return w
}

/* ── Scale-to-fit card wrapper ───────────────────────────── */
function CardWrapper({ sub, templateId, customConfig, orgLogo, onDownload, onDelete, onEdit, cardRefs }) {
  const wrapRef = useRef(null)
  const [scale, setScale] = useState(1)
  const naturalW = customConfig ? (customConfig.cardW || 340) : 280

  useEffect(() => {
    const measure = () => {
      if (!wrapRef.current) return
      const available = wrapRef.current.offsetWidth
      setScale(available < naturalW ? available / naturalW : 1)
    }
    measure()
    const ro = new ResizeObserver(measure)
    if (wrapRef.current) ro.observe(wrapRef.current)
    return () => ro.disconnect()
  }, [naturalW])

  const naturalH = customConfig ? (customConfig.cardH || 480) + 48 : 480
  const scaledH  = Math.round(naturalH * scale)

  return (
    <div ref={wrapRef} style={{ width:'100%' }}>
      <div style={{ height: scaledH, position:'relative', overflow:'visible' }}>
        <div style={{
          transform: `scale(${scale})`,
          transformOrigin: 'top left',
          width: naturalW,
          position:'absolute', top:0, left:0,
        }}>
          <IDCard
            ref={el => { if (cardRefs) cardRefs.current[sub.id] = el }}
            submission={sub}
            templateId={templateId}
            customConfig={customConfig}
            orgLogo={orgLogo}
            showActions
            onDownload={onDownload}
            onDelete={onDelete}
            onEdit={onEdit}
          />
        </div>
      </div>
    </div>
  )
}

/* ── Progress bar modal shown during ZIP generation ─────── */
function ProgressModal({ done, total, label }) {
  const pct = total > 0 ? Math.round((done / total) * 100) : 0
  return (
    <div style={{
      position:'fixed', inset:0, zIndex:9000,
      background:'rgba(0,0,0,.55)', display:'flex',
      alignItems:'center', justifyContent:'center',
    }}>
      <div style={{
        background:'var(--paper)', borderRadius:20,
        padding:'32px 36px', width:340, boxShadow:'0 24px 64px rgba(0,0,0,.22)',
        display:'flex', flexDirection:'column', alignItems:'center', gap:16,
      }}>
        <div style={{ fontSize:32 }}>📦</div>
        <div style={{ fontSize:15, fontWeight:800, color:'var(--ink)', textAlign:'center' }}>
          Generating ZIP
        </div>
        <div style={{ fontSize:13, color:'var(--ink3)', textAlign:'center', lineHeight:1.5 }}>
          {label}
        </div>
        <div style={{ width:'100%', height:10, background:'var(--border)', borderRadius:99, overflow:'hidden' }}>
          <div style={{
            height:'100%', borderRadius:99,
            background:'var(--blue)',
            width:`${pct}%`,
            transition:'width .3s ease',
          }}/>
        </div>
        <div style={{ fontSize:12, fontWeight:700, color:'var(--blue)' }}>
          {done} / {total} cards · {pct}%
        </div>
      </div>
    </div>
  )
}

/* ── Range picker modal ──────────────────────────────────── */
function RangePickerModal({ totalCards, school, filterClass, filterSection, onConfirm, onClose }) {
  const totalPages  = Math.ceil(totalCards / PAGE_SIZE)
  const [from, setFrom] = useState(1)
  const [to,   setTo]   = useState(totalPages)

  useEffect(() => {
    setTo(t => Math.min(Math.max(t, from), totalPages))
  }, [from, totalPages])

  const cardCount  = (to - from + 1) * PAGE_SIZE
  const capped     = Math.min(cardCount, totalCards - (from - 1) * PAGE_SIZE)
  const pageOptions = Array.from({ length: totalPages }, (_, i) => i + 1)

  // Build a human-readable label for what's being downloaded
  const scopeLabel = [
    school !== 'All' ? school : 'All Schools',
    filterClass !== 'All' ? `Class ${filterClass}` : null,
    filterSection !== 'All' ? `Sec ${filterSection}` : null,
  ].filter(Boolean).join(' · ')

  return (
    <div style={{
      position:'fixed', inset:0, zIndex:8000,
      background:'rgba(0,0,0,.5)', display:'flex',
      alignItems:'center', justifyContent:'center',
    }}>
      <div style={{
        background:'var(--paper)', borderRadius:20, width:380,
        padding:'28px 28px 24px', boxShadow:'0 24px 64px rgba(0,0,0,.2)',
        display:'flex', flexDirection:'column', gap:20,
      }}>
        {/* Header */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <div>
            <div style={{ fontSize:16, fontWeight:800, color:'var(--ink)' }}>Download ID Cards</div>
            <div style={{ fontSize:12, color:'var(--ink3)', marginTop:2 }}>
              {scopeLabel} · {totalCards} approved cards · {totalPages} page{totalPages !== 1 ? 's' : ''}
            </div>
          </div>
          <button onClick={onClose}
            style={{ border:'none', background:'transparent', fontSize:20, cursor:'pointer', color:'var(--ink3)', lineHeight:1 }}>
            ✕
          </button>
        </div>

        {/* Page range selectors */}
        <div>
          <div style={{ fontSize:12, fontWeight:700, color:'var(--ink2)', marginBottom:10 }}>
            Select page range to download
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr auto 1fr', alignItems:'center', gap:10 }}>
            <div>
              <div style={{ fontSize:11, color:'var(--ink3)', fontWeight:600, marginBottom:4 }}>From page</div>
              <select value={from} onChange={e => setFrom(Number(e.target.value))}
                style={{ width:'100%', padding:'9px 10px', borderRadius:10,
                  border:'1.5px solid var(--border)', fontSize:14, fontWeight:600,
                  color:'var(--ink)', background:'var(--paper)', outline:'none', cursor:'pointer' }}>
                {pageOptions.map(p => (
                  <option key={p} value={p}>Page {p}</option>
                ))}
              </select>
            </div>
            <div style={{ fontSize:16, color:'var(--ink3)', paddingTop:18 }}>→</div>
            <div>
              <div style={{ fontSize:11, color:'var(--ink3)', fontWeight:600, marginBottom:4 }}>To page</div>
              <select value={to} onChange={e => setTo(Number(e.target.value))}
                style={{ width:'100%', padding:'9px 10px', borderRadius:10,
                  border:'1.5px solid var(--border)', fontSize:14, fontWeight:600,
                  color:'var(--ink)', background:'var(--paper)', outline:'none', cursor:'pointer' }}>
                {pageOptions
                  .filter(p => p >= from)
                  .map(p => (
                    <option key={p} value={p}>Page {p}</option>
                  ))}
              </select>
            </div>
          </div>
        </div>

        {/* Visual page strip */}
        <div style={{ display:'flex', gap:4, flexWrap:'wrap' }}>
          {pageOptions.map(p => {
            const inRange = p >= from && p <= to
            const isFrom  = p === from
            const isTo    = p === to
            return (
              <div key={p}
                onClick={() => {
                  if (p < from) {
                    setFrom(p)
                  } else {
                    setTo(p)
                  }
                }}
                style={{
                  width:34, height:34, borderRadius:8, display:'flex',
                  alignItems:'center', justifyContent:'center',
                  fontSize:12, fontWeight:700, cursor:'pointer',
                  transition:'all .15s',
                  background: inRange ? 'var(--blue)' : 'var(--paper2)',
                  color:      inRange ? '#fff' : 'var(--ink3)',
                  border: `1.5px solid ${inRange ? 'var(--blue)' : 'var(--border)'}`,
                  boxShadow: (isFrom || isTo) ? '0 0 0 3px rgba(35,82,255,.2)' : 'none',
                }}>
                {p}
              </div>
            )
          })}
        </div>

        {/* Summary info */}
        <div style={{
          background:'var(--blue-s)', borderRadius:10,
          padding:'10px 14px', display:'flex', alignItems:'center', gap:10,
        }}>
          <div style={{ fontSize:22 }}>📦</div>
          <div>
            <div style={{ fontSize:13, fontWeight:700, color:'var(--blue)' }}>
              {to - from + 1} page{to - from + 1 !== 1 ? 's' : ''} · ~{capped} cards
            </div>
            <div style={{ fontSize:11, color:'var(--ink3)' }}>
              Pages {from}–{to} · {(capped * 0.4).toFixed(1)} MB estimated ZIP size
            </div>
          </div>
        </div>

        {/* Warning if range is large */}
        {to - from + 1 > 3 && (
          <div style={{
            fontSize:11, color:'#c2410c', background:'#fff7ed',
            border:'1px solid #ffedd5', borderRadius:10, padding:'8px 10px',
            lineHeight:1.4, fontWeight:600, display:'flex', gap:6, alignItems:'center'
          }}>
            <span>⚠️</span>
            <span>Large range: rendering may take a few minutes. Keep window open.</span>
          </div>
        )}

        {/* Actions */}
        <div style={{ display:'flex', gap:10 }}>
          <button onClick={onClose}
            style={{ flex:1, padding:'11px', borderRadius:10,
              border:'1.5px solid var(--border)', background:'transparent',
              fontSize:13, fontWeight:700, color:'var(--ink2)', cursor:'pointer', fontFamily:'inherit' }}>
            Cancel
          </button>
          <button onClick={() => onConfirm(from, to)}
            style={{ flex:2, padding:'11px', borderRadius:10,
              border:'none', background:'var(--blue)',
              fontSize:13, fontWeight:800, color:'#fff', cursor:'pointer', fontFamily:'inherit' }}
            onMouseEnter={e => e.currentTarget.style.background='#1538d4'}
            onMouseLeave={e => e.currentTarget.style.background='var(--blue)'}>
            ⬇ Download ZIP
          </button>
        </div>
      </div>
    </div>
  )
}

/* ── Edit individual card details modal ──────────────────── */
function EditCardModal({ submission, onSave, onClose }) {
  const [fields, setFields] = useState({
    name:              submission.name || '',
    fathers_name:      submission.fathers_name || '',
    class:             submission.class || '',
    section:           submission.section || '',
    roll_number:       submission.roll_number || '',
    admission_number:  submission.admission_number || '',
    student_id:        submission.student_id || '',
    employee_id:       submission.employee_id || '',
    designation:       submission.designation || '',
    department:        submission.department || '',
    date_of_birth:     submission.date_of_birth || '',
    blood_group:       submission.blood_group || '',
    contact_number:    submission.contact_number || '',
    emergency_contact: submission.emergency_contact || '',
    aadhar_card:       submission.aadhar_card || '',
    mode_of_transport: submission.mode_of_transport || '',
    valid_from:        submission.valid_from || '',
    valid_till:        submission.valid_till || '',
    batch_timing:      submission.batch_timing || '',
    address:           submission.address || '',
  })

  const [saving, setSaving] = useState(false)

  const handleChange = (key, value) => {
    setFields(prev => ({ ...prev, [key]: value }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      await onSave(fields)
    } finally {
      setSaving(false)
    }
  }

  const inputStyle = {
    width: '100%',
    padding: '8px 12px',
    borderRadius: '8px',
    border: '1.5px solid var(--border)',
    fontSize: '13px',
    color: 'var(--ink)',
    background: 'var(--paper)',
    outline: 'none',
    boxSizing: 'border-box',
    fontFamily: 'inherit',
  }

  const labelStyle = {
    fontSize: '11px',
    fontWeight: '700',
    color: 'var(--ink3)',
    textTransform: 'uppercase',
    letterSpacing: '.5px',
    marginBottom: '4px',
    display: 'block',
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 8500,
      background: 'rgba(0,0,0,.5)', display: 'flex',
      alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        background: 'var(--paper)', borderRadius: 20, width: 560, maxWidth: '95vw',
        padding: '24px', boxShadow: '0 24px 64px rgba(0,0,0,.2)',
        display: 'flex', flexDirection: 'column', gap: 16,
        maxHeight: '90vh', overflowY: 'auto',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', paddingBottom: '12px' }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--ink)' }}>Edit ID Card Details</div>
            <div style={{ fontSize: 12, color: 'var(--ink3)', marginTop: 2 }}>
              Make adjustments for {submission.name || 'this individual'}
            </div>
          </div>
          <button onClick={onClose}
            style={{ border: 'none', background: 'transparent', fontSize: 20, cursor: 'pointer', color: 'var(--ink3)', lineHeight: 1 }}>
            ✕
          </button>
        </div>

        {/* Scrollable form fields */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 16px' }}>
            <div>
              <label style={labelStyle}>Full Name</label>
              <input style={inputStyle} type="text" value={fields.name} onChange={e => handleChange('name', e.target.value)} required />
            </div>
            <div>
              <label style={labelStyle}>Father's Name</label>
              <input style={inputStyle} type="text" value={fields.fathers_name} onChange={e => handleChange('fathers_name', e.target.value)} />
            </div>
            <div>
              <label style={labelStyle}>Class</label>
              <input style={inputStyle} type="text" value={fields.class} onChange={e => handleChange('class', e.target.value)} />
            </div>
            <div>
              <label style={labelStyle}>Section</label>
              <input style={inputStyle} type="text" value={fields.section} onChange={e => handleChange('section', e.target.value)} />
            </div>
            <div>
              <label style={labelStyle}>Roll No.</label>
              <input style={inputStyle} type="text" value={fields.roll_number} onChange={e => handleChange('roll_number', e.target.value)} />
            </div>
            <div>
              <label style={labelStyle}>Admission No.</label>
              <input style={inputStyle} type="text" value={fields.admission_number} onChange={e => handleChange('admission_number', e.target.value)} />
            </div>
            <div>
              <label style={labelStyle}>Student ID</label>
              <input style={inputStyle} type="text" value={fields.student_id} onChange={e => handleChange('student_id', e.target.value)} />
            </div>
            <div>
              <label style={labelStyle}>Employee ID</label>
              <input style={inputStyle} type="text" value={fields.employee_id} onChange={e => handleChange('employee_id', e.target.value)} />
            </div>
            <div>
              <label style={labelStyle}>Designation</label>
              <input style={inputStyle} type="text" value={fields.designation} onChange={e => handleChange('designation', e.target.value)} />
            </div>
            <div>
              <label style={labelStyle}>Department</label>
              <input style={inputStyle} type="text" value={fields.department} onChange={e => handleChange('department', e.target.value)} />
            </div>
            <div>
              <label style={labelStyle}>Date of Birth (YYYY-MM-DD)</label>
              <input style={inputStyle} type="text" placeholder="YYYY-MM-DD" value={fields.date_of_birth} onChange={e => handleChange('date_of_birth', e.target.value)} />
            </div>
            <div>
              <label style={labelStyle}>Blood Group</label>
              <select style={inputStyle} value={fields.blood_group} onChange={e => handleChange('blood_group', e.target.value)}>
                <option value="">Select Blood Group</option>
                {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map(bg => (
                  <option key={bg} value={bg}>{bg}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Contact No.</label>
              <input style={inputStyle} type="text" value={fields.contact_number} onChange={e => handleChange('contact_number', e.target.value)} />
            </div>
            <div>
              <label style={labelStyle}>Emergency Contact</label>
              <input style={inputStyle} type="text" value={fields.emergency_contact} onChange={e => handleChange('emergency_contact', e.target.value)} />
            </div>
            <div>
              <label style={labelStyle}>Aadhaar No.</label>
              <input style={inputStyle} type="text" value={fields.aadhar_card} onChange={e => handleChange('aadhar_card', e.target.value)} />
            </div>
            <div>
              <label style={labelStyle}>Transport</label>
              <input style={inputStyle} type="text" value={fields.mode_of_transport} onChange={e => handleChange('mode_of_transport', e.target.value)} />
            </div>
            <div>
              <label style={labelStyle}>Valid From</label>
              <input style={inputStyle} type="text" value={fields.valid_from} onChange={e => handleChange('valid_from', e.target.value)} />
            </div>
            <div>
              <label style={labelStyle}>Valid Till</label>
              <input style={inputStyle} type="text" value={fields.valid_till} onChange={e => handleChange('valid_till', e.target.value)} />
            </div>
            <div style={{ gridColumn: 'span 2' }}>
              <label style={labelStyle}>Batch / Timing</label>
              <input style={inputStyle} type="text" value={fields.batch_timing} onChange={e => handleChange('batch_timing', e.target.value)} />
            </div>
            <div style={{ gridColumn: 'span 2' }}>
              <label style={labelStyle}>Address</label>
              <textarea style={{ ...inputStyle, height: '60px', resize: 'vertical' }} value={fields.address} onChange={e => handleChange('address', e.target.value)} />
            </div>
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', gap: 10, borderTop: '1px solid var(--border)', paddingTop: '16px', marginTop: '8px' }}>
            <button type="button" onClick={onClose} disabled={saving}
              style={{ flex: 1, padding: '11px', borderRadius: 10,
                border: '1.5px solid var(--border)', background: 'transparent',
                fontSize: '13px', fontWeight: 700, color: 'var(--ink2)', cursor: 'pointer', fontFamily: 'inherit' }}>
              Cancel
            </button>
            <button type="submit" disabled={saving}
              style={{ flex: 2, padding: '11px', borderRadius: 10,
                border: 'none', background: 'var(--blue)',
                fontSize: '13px', fontWeight: 800, color: '#fff', cursor: 'pointer', fontFamily: 'inherit',
                opacity: saving ? 0.7 : 1 }}>
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

/* ── Reusable filter select ──────────────────────────────── */
function FilterSelect({ label, value, onChange, options, placeholder }) {
  return (
    <div>
      <div style={{ fontSize:10, fontWeight:700, color:'var(--ink3)', textTransform:'uppercase',
        letterSpacing:.5, marginBottom:4 }}>{label}</div>
      <select value={value} onChange={e => onChange(e.target.value)}
        style={{ padding:'7px 10px', borderRadius:'var(--r)', border:'1.5px solid var(--border)',
          fontSize:13, color: value !== 'All' ? 'var(--blue)' : 'var(--ink)',
          background: value !== 'All' ? 'var(--blue-s)' : 'var(--paper)',
          outline:'none', cursor:'pointer', fontWeight: value !== 'All' ? 700 : 400,
          borderColor: value !== 'All' ? 'var(--blue-m)' : 'var(--border)',
          transition:'all .15s', minWidth:100 }}>
        <option value="All">{placeholder}</option>
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  )
}

/* ════════════════════════════════════════════════════════════
   MAIN PAGE
════════════════════════════════════════════════════════════ */
export default function AllTemplates() {
  const { submissions, loading, updateSubmission, deleteSubmission, activeFilters } = useSubmissions()
  const { organizations } = useOrganizations()
  const navigate          = useNavigate()
  const { templates, deleteTemplate, fetchTemplates } = useCardTemplates()

  const [templateId,     setTemplateId]     = useState('T1')
  const [customTemplate, setCustomTemplate] = useState(null)

  // Keep customTemplate in sync with the live `templates` array.
  // Without this, customTemplate stays a frozen snapshot from the moment it was
  // selected — so edits made later in the ID Card Builder (e.g. reordering fields)
  // never show up here until the page is fully reloaded.
  useEffect(() => {
    if (!customTemplate) return
    const fresh = templates.find(t => t.id === customTemplate.id)
    if (fresh && fresh !== customTemplate) setCustomTemplate(fresh)
  }, [templates, customTemplate])

  // If the ID Card Builder is open in a SEPARATE browser tab, edits saved there
  // live only in that tab's memory until Firestore is re-fetched here. Refetch
  // automatically whenever this tab regains focus/visibility, so switching back
  // from the Builder tab always shows the latest saved template.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') fetchTemplates()
    }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', onVisible)
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', onVisible)
    }
  }, [fetchTemplates])

  /* ── Cascading filters ── */
  const [school,        setSchool]        = useState('All')
  const [filterClass,   setFilterClass]   = useState('All')
  const [filterSection, setFilterSection] = useState('All')

  const [deleteId,    setDeleteId]    = useState(null)
  const [deleteTplId, setDeleteTplId] = useState(null)
  const [leftOpen,    setLeftOpen]    = useState(false)
  const [rightOpen,   setRightOpen]   = useState(false)
  const [editingSubmission, setEditingSubmission] = useState(null)

  /* ZIP download state */
  const [showRangePicker, setShowRangePicker] = useState(false)
  const [zipProgress,     setZipProgress]     = useState(null)

  /* Off-screen container */
  const offscreenRef = useRef(null)
  const cardRefs     = useRef({})

  const winW     = useWindowWidth()
  const isMobile = winW < 700
  const isTablet = winW >= 700 && winW < 1100

  /* ── Derived data ──────────────────────────────────────── */
  const approved = submissions.filter(s => s.status === 'approved')
  const orgNames = organizations.map(o => o.name)
  const subNames = approved.map(s => s.school_name).filter(Boolean)
  const schools  = ['All', ...new Set([...orgNames, ...subNames])]

  /* ── Firestore-driven card display with pagination ── */
  const [displayCards,   setDisplayCards]   = useState([])
  const [displayLoading, setDisplayLoading] = useState(false)
  const [displayPage,    setDisplayPage]    = useState(1)
  const [displayCursors, setDisplayCursors] = useState([null])

  const fetchDisplayPage = useCallback(async (pageNum, cursors, filters) => {
    const { school, filterClass, filterSection } = filters
    setDisplayLoading(true)
    try {
      const constraints = [
        where('status', '==', 'approved'),
        orderBy('submitted_at', 'desc'),
      ]
      if (school        !== 'All') constraints.push(where('school_name', '==', school))
      if (filterClass   !== 'All') constraints.push(where('class',       '==', filterClass))
      if (filterSection !== 'All') constraints.push(where('section',     '==', filterSection))

      let cursorChain = [...cursors]
      while (cursorChain.length < pageNum) {
        const prevCursor = cursorChain[cursorChain.length - 1]
        const walkConstraints = [...constraints]
        if (prevCursor) walkConstraints.push(startAfter(prevCursor))
        walkConstraints.push(limit(PAGE_SIZE))
        const snap = await getDocs(query(collection(db, 'submissions'), ...walkConstraints))
        if (snap.empty) break
        cursorChain.push(snap.docs[snap.docs.length - 1])
      }

      const targetCursor = cursorChain[pageNum - 1]
      const pageConstraints = [...constraints]
      if (targetCursor) pageConstraints.push(startAfter(targetCursor))
      pageConstraints.push(limit(PAGE_SIZE))

      const snap = await getDocs(query(collection(db, 'submissions'), ...pageConstraints))
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }))

      const newCursors = [...cursorChain]
      newCursors[pageNum] = snap.docs[snap.docs.length - 1] || null

      setDisplayCards(docs)
      setDisplayCursors(newCursors)
      setDisplayPage(pageNum)
    } catch (err) {
      console.warn('Display page fetch failed:', err)
      setDisplayCards([])
    } finally {
      setDisplayLoading(false)
    }
  }, [])

  // Re-fetch page 1 whenever filters change
  useEffect(() => {
    setDisplayPage(1)
    setDisplayCursors([null])
    setDisplayCards([])
    fetchDisplayPage(1, [null], { school, filterClass, filterSection })
  }, [school, filterClass, filterSection, fetchDisplayPage])

  const filtered = displayCards

  /* ── Fetch ALL distinct classes for the selected school from Firestore ── */
  const [availableClasses, setAvailableClasses] = useState([])
  useEffect(() => {
    let cancelled = false
    const fetchClasses = async () => {
      try {
        const constraints = [where('status', '==', 'approved')]
        if (school !== 'All') constraints.push(where('school_name', '==', school))
        // Fetch enough docs to cover all classes; class field is low-cardinality
        constraints.push(limit(1000))
        const snap = await getDocs(query(collection(db, 'submissions'), ...constraints))
        if (cancelled) return
        const classes = [...new Set(snap.docs.map(d => d.data().class).filter(Boolean))].sort((a, b) => {
          const na = parseInt(a), nb = parseInt(b)
          return !isNaN(na) && !isNaN(nb) ? na - nb : a.localeCompare(b)
        })
        setAvailableClasses(classes)
      } catch (err) {
        console.warn('Class fetch failed:', err)
      }
    }
    fetchClasses()
    return () => { cancelled = true }
  }, [school])

  /* ── Fetch ALL distinct sections for the selected school+class from Firestore ── */
  const [availableSections, setAvailableSections] = useState([])
  useEffect(() => {
    let cancelled = false
    const fetchSections = async () => {
      try {
        const constraints = [where('status', '==', 'approved')]
        if (school !== 'All') constraints.push(where('school_name', '==', school))
        if (filterClass !== 'All') constraints.push(where('class', '==', filterClass))
        constraints.push(limit(1000))
        const snap = await getDocs(query(collection(db, 'submissions'), ...constraints))
        if (cancelled) return
        const sections = [...new Set(snap.docs.map(d => d.data().section).filter(Boolean))].sort()
        setAvailableSections(sections)
      } catch (err) {
        console.warn('Section fetch failed:', err)
      }
    }
    fetchSections()
    return () => { cancelled = true }
  }, [school, filterClass])

  // Reset class & section when school changes
  const handleSchoolChange = (val) => {
    setSchool(val)
    setFilterClass('All')
    setFilterSection('All')
    setAvailableClasses([])
    setAvailableSections([])
  }

  // Reset section when class changes
  const handleClassChange = (val) => {
    setFilterClass(val)
    setFilterSection('All')
    setAvailableSections([])
  }

  const cardNatW = customTemplate?.config?.cardW || 340
  const panelW   = isMobile ? 0 : isTablet ? 180 : 200
  const rightW   = isMobile ? 0 : 160
  const centerW  = winW - panelW - rightW - 48
  const cols     = Math.max(1, Math.floor(centerW / (cardNatW + 22)))

  /* ── Build Firestore base constraints for current filters ── */
  const buildBaseConstraints = useCallback(() => {
    const base = [
      where('status', '==', 'approved'),
      orderBy('submitted_at', 'desc'),
    ]
    if (school        !== 'All') base.push(where('school_name', '==', school))
    if (filterClass   !== 'All') base.push(where('class',       '==', filterClass))
    if (filterSection !== 'All') base.push(where('section',     '==', filterSection))
    return base
  }, [school, filterClass, filterSection])

  /* ── Fetch a range of pages directly from Firestore ──────── */
  const fetchPageRange = useCallback(async (fromPage, toPage) => {
    const base    = buildBaseConstraints()
    const results = []
    let cursor    = null

    for (let p = 1; p <= toPage; p++) {
      const constraints = [...base]
      if (cursor) constraints.push(startAfter(cursor))
      constraints.push(limit(PAGE_SIZE))

      const snap = await getDocs(query(collection(db, 'submissions'), ...constraints))
      if (snap.empty) break

      if (p >= fromPage) {
        snap.docs.forEach(d => results.push({ id: d.id, ...d.data() }))
      }
      cursor = snap.docs[snap.docs.length - 1]
    }
    return results
  }, [buildBaseConstraints])

  /* ── Render one card off-screen and capture it ───────────── */
  // Convert any URL to a base64 data URL by fetching through a proxy approach
  const urlToBase64 = async (url) => {
    try {
      // Try fetching with CORS first
      const res = await fetch(url, { mode: 'cors', cache: 'no-cache' })
      const blob = await res.blob()
      return await new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload  = () => resolve(reader.result)
        reader.onerror = reject
        reader.readAsDataURL(blob)
      })
    } catch {
      // Fallback: try without CORS (tainted but better than nothing)
      try {
        const res = await fetch(url, { cache: 'no-cache' })
        const blob = await res.blob()
        return await new Promise((resolve, reject) => {
          const reader = new FileReader()
          reader.onload  = () => resolve(reader.result)
          reader.onerror = reject
          reader.readAsDataURL(blob)
        })
      } catch { return null }
    }
  }

  const captureCard = useCallback(async (sub, html2canvas) => {
    const orgLogo = organizations.find(o => o.name === sub.school_name)?.logo_url || null
    const activeConfig  = sub.customConfig || customTemplate?.config || null
    const tplId         = sub.customConfig ? null : (customTemplate ? null : templateId)

    const cardW = activeConfig?.cardW || 340
    const cardH = activeConfig?.cardH || 480

    // Pre-convert all external images to base64 BEFORE rendering
    // so html2canvas never has to deal with CORS at all
    const photoBase64  = sub.photo_url          ? await urlToBase64(sub.photo_url)    : null
    const logoBase64   = orgLogo                ? await urlToBase64(orgLogo)           : null
    const bgBase64     = activeConfig?.bgImage  ? await urlToBase64(activeConfig.bgImage)   : null

    // Build a patched submission with base64 URLs
    const patchedSub = {
      ...sub,
      photo_url: photoBase64 || sub.photo_url,
    }
    const patchedLogo   = logoBase64 || orgLogo
    const patchedConfig = activeConfig
      ? { ...activeConfig, bgImage: bgBase64 || activeConfig.bgImage }
      : null

    const container = document.createElement('div')
    container.style.cssText = [
      'position:fixed',
      'left:-9999px',
      'top:0',
      `width:${cardW + 40}px`,
      'opacity:0',
      'pointer-events:none',
      'z-index:-1',
    ].join(';')
    document.body.appendChild(container)

    let root = null

    try {
      const { createRoot } = await import('react-dom/client')
      const { default: IDCard } = await import('../components/idcard/IDCard')

      root = createRoot(container)

      await new Promise(resolveRender => {
        root.render(
          <IDCard
            submission={patchedSub}
            templateId={tplId}
            customConfig={patchedConfig}
            orgLogo={patchedLogo}
            showActions={false}
          />
        )
        requestAnimationFrame(() =>
          requestAnimationFrame(() =>
            setTimeout(resolveRender, 300)
          )
        )
      })

      const cardEl = container.querySelector(`[id="card-${sub.id}"]`) || container

      // Wait for any remaining images (already base64 so should be instant)
      const images = Array.from(cardEl.querySelectorAll('img'))
      await Promise.all(images.map(img =>
        img.complete ? Promise.resolve() : new Promise(r => { img.onload = r; img.onerror = r })
      ))

      const SCALE = 4   // 4x = ~384 DPI — crisp for print and screen

      const canvas = await html2canvas(cardEl, {
        scale:           SCALE,
        useCORS:         false,   // not needed — all images are already base64
        allowTaint:      true,
        backgroundColor: '#ffffff',
        logging:         false,
        width:           cardW,
        height:          cardH,
        windowWidth:     cardW + 40,
        imageTimeout:    0,
        x: 0, y: 0, scrollX: 0, scrollY: 0,
      })

      return canvas.toDataURL('image/jpeg', 1.0).split(',')[1]

    } catch (err) {
      console.warn('captureCard failed for', sub.name, err)
      return null
    } finally {
      try {
        if (root) {
          root.unmount()
          await new Promise(r => setTimeout(r, 50))
        }
      } catch { /* ignore */ }
      container.remove()
    }
  }, [organizations, customTemplate, templateId])

  /* ── Download individual card ─────────────────────────────── */
  const downloadCard = async (sub) => {
    try {
      const { default: html2canvas } = await import('html2canvas')
      const base64 = await captureCard(sub, html2canvas)
      if (!base64) { toast.error('Download failed'); return }

      const link = document.createElement('a')
      link.download = `${sub.name?.replace(/\s+/g,'_')}_IDCard.jpg`
      link.href     = `data:image/jpeg;base64,${base64}`
      link.click()
      toast.success(`Downloaded ${sub.name}'s card`)
    } catch {
      toast.error('Download failed')
    }
  }

  /* ── Main ZIP generation ─────────────────────────────────── */
  const generateZip = useCallback(async (fromPage, toPage, customSubs = null) => {
    setShowRangePicker(false)

    try {
      const [{ default: html2canvas }, { default: JSZip }] = await Promise.all([
        import('html2canvas'),
        import('jszip'),
      ])

      setZipProgress({ done: 0, total: 0, label: 'Fetching records from database…' })
      const subs = customSubs || await fetchPageRange(fromPage, toPage)

      if (!subs.length) {
        toast.error('No cards found')
        setZipProgress(null)
        return
      }

      const zip   = new JSZip()
      const total = subs.length

      for (let i = 0; i < subs.length; i++) {
        const sub = subs[i]
        setZipProgress({
          done:  i,
          total,
          label: `Rendering card ${i + 1} of ${total}: ${sub.name || '—'}`,
        })

        const base64 = await captureCard(sub, html2canvas)
        if (base64) {
          const filename = `${sub.name?.replace(/\s+/g,'_') || sub.id}_IDCard.jpg`
          zip.file(filename, base64, { base64: true })
        }
      }

      setZipProgress({ done: total, total, label: 'Building ZIP file…' })
      const blob = await zip.generateAsync({ type:'blob' })
      const link = document.createElement('a')

      // Build a descriptive filename from active filters
      const parts = [
        school        !== 'All' ? school.replace(/\s+/g,'_')          : 'AllSchools',
        filterClass   !== 'All' ? `Class${filterClass.replace(/\s+/g,'_')}` : null,
        filterSection !== 'All' ? `Sec${filterSection.replace(/\s+/g,'_')}` : null,
        customSubs ? 'current' : `p${fromPage}-p${toPage}`,
      ].filter(Boolean)
      link.download = `ID_Cards_${parts.join('_')}.zip`
      link.href     = URL.createObjectURL(blob)
      link.click()
      URL.revokeObjectURL(link.href)

      setZipProgress(null)
      toast.success(customSubs 
        ? `✅ Downloaded ${total} cards (current view)`
        : `✅ Downloaded ${total} cards (pages ${fromPage}–${toPage})`
      )
    } catch (err) {
      console.error('ZIP error:', err)
      setZipProgress(null)
      toast.error('ZIP generation failed.')
    }
  }, [fetchPageRange, captureCard, school, filterClass, filterSection])

  /* ── Approved count (respects all 3 filters) ─────────────── */
  const [totalApprovedCount, setTotalApprovedCount] = useState(0)

  useEffect(() => {
    let cancelled = false
    const fetchCount = async () => {
      try {
        const constraints = [where('status', '==', 'approved')]
        if (school        !== 'All') constraints.push(where('school_name', '==', school))
        if (filterClass   !== 'All') constraints.push(where('class',       '==', filterClass))
        if (filterSection !== 'All') constraints.push(where('section',     '==', filterSection))
        const snap = await getCountFromServer(query(collection(db, 'submissions'), ...constraints))
        if (!cancelled) setTotalApprovedCount(snap.data().count)
      } catch (err) {
        console.warn('Count fetch failed:', err)
      }
    }
    fetchCount()
    return () => { cancelled = true }
  }, [school, filterClass, filterSection])

  const totalPages = Math.ceil(totalApprovedCount / PAGE_SIZE) || 1

  if (loading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'80vh' }}>
      <Spinner size={36}/>
    </div>
  )

  /* ── Active filter summary pill (shown in toolbar) ── */
  const activeFilterCount = [school, filterClass, filterSection].filter(v => v !== 'All').length
  const filterSummary = [
    school        !== 'All' ? school          : null,
    filterClass   !== 'All' ? `Class ${filterClass}`   : null,
    filterSection !== 'All' ? `Sec ${filterSection}` : null,
  ].filter(Boolean).join(' › ')

  /* ── Reusable template list ── */
  const TemplateSelectorContent = () => (
    <div>
      {templates.length > 0 && (
        <>
          <div style={{ fontSize:11, fontWeight:700, color:'var(--ink3)', textTransform:'uppercase',
            letterSpacing:.5, marginBottom:10, padding:'0 4px' }}>My Templates</div>
          {templates.map(t => {
            const c          = t.config || {}
            const isSelected = customTemplate?.id === t.id
            const bgStyle    = c.headerStyle === 'gradient'
              ? `linear-gradient(135deg,${c.c1||'#555'},${c.c2||'#333'})`
              : (c.c1 || '#555')
            return (
              <div key={t.id}
                onClick={() => { setCustomTemplate(t); setTemplateId(null); setLeftOpen(false) }}
                style={{ borderRadius:'var(--r)', border:`2px solid ${isSelected?'var(--blue)':'var(--border)'}`,
                  overflow:'hidden', marginBottom:8, cursor:'pointer', transition:'all .18s',
                  boxShadow:isSelected?'0 0 0 3px rgba(35,82,255,.15)':'none' }}>
                <div style={{ height:48, background:bgStyle, display:'flex',
                  alignItems:'center', justifyContent:'space-between', padding:'0 10px' }}>
                  <span style={{ fontSize:11, fontWeight:700, color:'#fff', overflow:'hidden',
                    textOverflow:'ellipsis', whiteSpace:'nowrap', maxWidth:100 }}>{t.name}</span>
                  <div style={{ display:'flex', gap:3 }}>
                    {c.c1 && <div style={{ width:9, height:9, borderRadius:'50%', background:c.c1, border:'1.5px solid rgba(255,255,255,.5)' }}/>}
                    {c.c2 && <div style={{ width:9, height:9, borderRadius:'50%', background:c.c2, border:'1.5px solid rgba(255,255,255,.5)' }}/>}
                  </div>
                </div>
                <div style={{ padding:'5px 8px 4px', fontSize:10, fontWeight:600,
                  color:isSelected?'var(--blue)':'var(--ink3)',
                  background:isSelected?'var(--blue-s)':'var(--paper)',
                  display:'flex', justifyContent:'space-between' }}>
                  <span>{isSelected ? '✓ Selected' : 'Click to select'}</span>
                  <span>{c.visibleFields?.length||0} fields</span>
                </div>
                <div
                  onClick={e => e.stopPropagation()}
                  style={{ display:'flex', gap:6, padding:'5px 8px 7px',
                    background:isSelected ? 'var(--blue-s)' : 'var(--paper)',
                    borderTop:`1px solid ${isSelected ? 'var(--blue-m)' : 'var(--border)'}` }}>
                  <button
                    onClick={e => {
                      e.stopPropagation()
                      navigate(`/card-builder?edit=${t.id}`)
                      setLeftOpen(false)
                    }}
                    style={{ flex:1, height:26, borderRadius:6,
                      border:'1.5px solid var(--blue-m)', background:'var(--blue-s)',
                      color:'var(--blue)', fontSize:11, fontWeight:700,
                      cursor:'pointer', fontFamily:'inherit', display:'flex',
                      alignItems:'center', justifyContent:'center', gap:4 }}>
                    ✎ Edit
                  </button>
                  <button
                    onClick={e => {
                      e.stopPropagation()
                      setDeleteTplId(t.id)
                    }}
                    style={{ flex:1, height:26, borderRadius:6,
                      border:'1.5px solid var(--red-m, #fca5a5)', background:'var(--red-s)',
                      color:'var(--red)', fontSize:11, fontWeight:700,
                      cursor:'pointer', fontFamily:'inherit', display:'flex',
                      alignItems:'center', justifyContent:'center', gap:4 }}>
                    🗑 Delete
                  </button>
                </div>
              </div>
            )
          })}
          <div style={{ height:1, background:'var(--border)', margin:'12px 4px 14px' }}/>
        </>
      )}

      <div style={{ fontSize:11, fontWeight:700, color:'var(--ink3)', textTransform:'uppercase',
        letterSpacing:.5, marginBottom:10, padding:'0 4px' }}>Built-in</div>
      {Object.entries(TEMPLATES).map(([id, t]) => {
        const isSelected = !customTemplate && templateId === id
        return (
          <div key={id}
            onClick={() => { setTemplateId(id); setCustomTemplate(null); setLeftOpen(false) }}
            style={{ borderRadius:'var(--r)', border:`2px solid ${isSelected?'var(--blue)':'var(--border)'}`,
              overflow:'hidden', marginBottom:10, cursor:'pointer', transition:'all .18s',
              boxShadow:isSelected?'0 0 0 3px rgba(35,82,255,.15)':'none' }}>
            <div style={{ height:56, background:`linear-gradient(135deg,${t.c1},${t.c2})`,
              display:'flex', alignItems:'center', justifyContent:'center',
              fontSize:11, fontWeight:700, color:'#fff', textTransform:'uppercase' }}>
              {t.name}
            </div>
            <div style={{ padding:'5px 8px', fontSize:11, fontWeight:600,
              color:isSelected?'var(--blue)':'var(--ink2)',
              background:isSelected?'var(--blue-s)':'var(--paper)' }}>
              {isSelected ? '✓ Selected' : 'Click to select'}
            </div>
          </div>
        )
      })}

      <button onClick={() => { navigate('/card-builder'); setLeftOpen(false) }}
        style={{ width:'100%', padding:'10px 8px', borderRadius:'var(--r)',
          border:'1.5px dashed var(--blue-m)', background:'var(--blue-s)',
          color:'var(--blue)', fontSize:12, fontWeight:700, cursor:'pointer',
          marginTop:4, fontFamily:'inherit' }}>
        + Create New Template
      </button>
    </div>
  )

  /* ── Download panel (right sidebar / mobile drawer) ── */
  const FormatDownloadContent = () => (
    <>
      <div style={{ fontSize:11, fontWeight:700, color:'var(--ink3)', textTransform:'uppercase',
        letterSpacing:.5, marginBottom:10 }}>Download Cards</div>

      {/* Active filter summary */}
      {activeFilterCount > 0 && (
        <div style={{ background:'var(--blue-s)', borderRadius:8, padding:'8px 10px',
          marginBottom:10, border:'1px solid var(--blue-m)',
          display:'flex', alignItems:'center', gap:6 }}>
          <span style={{ fontSize:14 }}>🎯</span>
          <div>
            <div style={{ fontSize:11, fontWeight:700, color:'var(--blue)' }}>Filtered scope</div>
            <div style={{ fontSize:10, color:'var(--ink3)', marginTop:1 }}>{filterSummary}</div>
          </div>
        </div>
      )}

      {/* Stats */}
      <div style={{ background:'var(--paper2)', borderRadius:10, padding:'10px 12px', marginBottom:14, border:'1px solid var(--border)' }}>
        <div style={{ fontSize:12, fontWeight:700, color:'var(--ink)', marginBottom:2 }}>
          {totalApprovedCount} approved cards
        </div>
        <div style={{ fontSize:11, color:'var(--ink3)' }}>
          {activeFilterCount > 0 ? filterSummary : 'All schools'} · {totalPages} page{totalPages !== 1 ? 's' : ''}
        </div>
      </div>

      {/* Current view only */}
      <div style={{ fontSize:11, fontWeight:700, color:'var(--ink3)', textTransform:'uppercase',
        letterSpacing:.5, marginBottom:8 }}>Current view only</div>
      <button
        onClick={async () => {
          if (!filtered.length) { toast.error('No cards in current view'); return }
          await generateZip(displayPage, displayPage, filtered)
        }}
        style={{ width:'100%', padding:'10px 8px', borderRadius:10,
          border:'1.5px solid var(--border)', background:'var(--paper)',
          color:'var(--ink2)', fontSize:12, fontWeight:700, cursor:'pointer',
          fontFamily:'inherit', marginBottom:16, lineHeight:1.4, textAlign:'left',
          display:'flex', alignItems:'center', gap:8 }}
        onMouseEnter={e=>{ e.currentTarget.style.borderColor='var(--blue)'; e.currentTarget.style.background='var(--blue-s)'; e.currentTarget.style.color='var(--blue)' }}
        onMouseLeave={e=>{ e.currentTarget.style.borderColor='var(--border)'; e.currentTarget.style.background='var(--paper)'; e.currentTarget.style.color='var(--ink2)' }}>
        <span style={{ fontSize:16 }}>📄</span>
        <span>This view ({filtered.length} cards)</span>
      </button>

      {/* Multi-page range */}
      <div style={{ fontSize:11, fontWeight:700, color:'var(--ink3)', textTransform:'uppercase',
        letterSpacing:.5, marginBottom:8 }}>Multiple pages</div>
      <button
        onClick={() => {
          if (!totalApprovedCount) { toast.error('No approved cards found'); return }
          setShowRangePicker(true)
          setRightOpen(false)
        }}
        style={{ width:'100%', padding:'12px 8px', borderRadius:10,
          border:'1.5px solid var(--border)', background:'var(--paper)',
          color:'var(--ink2)', fontSize:12, fontWeight:700, cursor:'pointer',
          fontFamily:'inherit', marginBottom:16, lineHeight:1.4, textAlign:'left',
          display:'flex', alignItems:'center', gap:8 }}
        onMouseEnter={e=>{ e.currentTarget.style.borderColor='var(--blue)'; e.currentTarget.style.background='var(--blue-s)'; e.currentTarget.style.color='var(--blue)' }}
        onMouseLeave={e=>{ e.currentTarget.style.borderColor='var(--border)'; e.currentTarget.style.background='var(--paper)'; e.currentTarget.style.color='var(--ink2)' }}>
        <span style={{ fontSize:16 }}>📦</span>
        <span>Download Page Range…</span>
      </button>

      {/* Download All at once */}
      <div style={{ fontSize:11, fontWeight:700, color:'var(--ink3)', textTransform:'uppercase',
        letterSpacing:.5, marginBottom:8 }}>All cards</div>
      <button
        onClick={async () => {
          if (!totalApprovedCount) { toast.error('No approved cards found'); return }
          setRightOpen(false)
          await generateZip(1, totalPages)
        }}
        style={{ width:'100%', padding:'12px 8px', borderRadius:10,
          background:'var(--blue)', color:'#fff', border:'none', fontSize:12,
          fontWeight:800, cursor:'pointer', letterSpacing:.3, lineHeight:1.4,
          display:'flex', alignItems:'center', justifyContent:'center', gap:8 }}
        onMouseEnter={e=>e.currentTarget.style.background='#1538d4'}
        onMouseLeave={e=>e.currentTarget.style.background='var(--blue)'}>
        <span style={{ fontSize:16 }}>⚡</span>
        <span>Download All ({totalApprovedCount} cards)</span>
      </button>
    </>
  )

  /* ── Filter bar used in both desktop toolbar and mobile bar ── */
  const FilterBar = ({ mobile = false }) => (
    <div style={{
      display:'flex', alignItems: mobile ? 'stretch' : 'flex-end',
      gap: mobile ? 8 : 10,
      flexDirection: mobile ? 'column' : 'row',
      flexWrap: mobile ? 'nowrap' : 'wrap',
    }}>
      {/* School */}
      <FilterSelect
        label="School"
        value={school}
        onChange={handleSchoolChange}
        options={schools.filter(s => s !== 'All')}
        placeholder="All Schools"
      />

      {/* Class — only show options that exist in the current school */}
      <FilterSelect
        label="Class"
        value={filterClass}
        onChange={handleClassChange}
        options={availableClasses}
        placeholder="All Classes"
      />

      {/* Section — only show options that exist in current school+class */}
      <FilterSelect
        label="Section"
        value={filterSection}
        onChange={setFilterSection}
        options={availableSections}
        placeholder="All Sections"
      />

      {/* Clear button — only show when a filter is active */}
      {activeFilterCount > 0 && (
        <button
          onClick={() => { handleSchoolChange('All') }}
          style={{ padding: mobile ? '9px 12px' : '7px 10px', borderRadius:'var(--r)',
            border:'1.5px solid var(--border)', background:'var(--paper2)',
            color:'var(--ink3)', fontSize:12, fontWeight:700, cursor:'pointer',
            fontFamily:'inherit', alignSelf: mobile ? 'flex-start' : 'flex-end',
            display:'flex', alignItems:'center', gap:4 }}>
          ✕ Clear
        </button>
      )}
    </div>
  )

  const activeLabel = customTemplate?.name || TEMPLATES[templateId]?.name || 'None'

  return (
    <div className="anim-fade-up" style={{ paddingTop:64, minHeight:'100vh', background:'var(--paper2)' }}>

      {/* Off-screen rendering container */}
      <div ref={offscreenRef} style={{ position:'fixed', left:'-9999px', top:0, pointerEvents:'none', zIndex:-1 }}/>

      {/* ─────────────────── DESKTOP / TABLET ─────────────────── */}
      {!isMobile && (
        <div style={{
          display:'grid',
          gridTemplateColumns: isTablet ? '180px 1fr 140px' : '200px 1fr 160px',
          minHeight:'calc(100vh - 64px)',
        }}>
          <div style={{ background:'var(--paper)', borderRight:'1px solid var(--border)',
            padding:'16px 10px', overflowY:'auto' }}>
            <TemplateSelectorContent/>
          </div>

          <div style={{ padding:'20px 16px', overflowY:'auto', overflowX:'hidden' }}>
            {/* Toolbar */}
            <div style={{ display:'flex', alignItems:'flex-end', gap:10, marginBottom:18, flexWrap:'wrap' }}>
              <button onClick={() => navigate(-1)}
                style={{ padding:'7px 12px', borderRadius:'var(--r)', border:'1.5px solid var(--border)',
                  background:'var(--paper)', color:'var(--ink2)', fontSize:13, fontWeight:700,
                  cursor:'pointer', fontFamily:'inherit', flexShrink:0 }}
                onMouseEnter={e=>{ e.currentTarget.style.borderColor='var(--blue)'; e.currentTarget.style.color='var(--blue)'; e.currentTarget.style.background='var(--blue-s)' }}
                onMouseLeave={e=>{ e.currentTarget.style.borderColor='var(--border)'; e.currentTarget.style.color='var(--ink2)'; e.currentTarget.style.background='var(--paper)' }}>
                ← Back
              </button>

              <FilterBar />

              <div style={{ marginLeft:'auto', display:'flex', alignItems:'center', gap:8 }}>
                <Badge type={filtered.length > 0 ? 'teal' : 'gray'}>{displayPage > 1 ? `p${displayPage} · ` : ''}{filtered.length} shown</Badge>
                <button onClick={() => navigate('/card-builder')}
                  style={{ padding:'7px 12px', borderRadius:'var(--r)', border:'1.5px dashed var(--blue-m)',
                    background:'var(--blue-s)', color:'var(--blue)', fontSize:12, fontWeight:700,
                    cursor:'pointer', fontFamily:'inherit', whiteSpace:'nowrap' }}>
                  + New Template
                </button>
              </div>
            </div>

            {/* Active filter breadcrumb */}
            {activeFilterCount > 0 && (
              <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:14,
                padding:'7px 12px', background:'var(--blue-s)', borderRadius:8,
                border:'1px solid var(--blue-m)', width:'fit-content' }}>
                <span style={{ fontSize:13 }}>🎯</span>
                <span style={{ fontSize:12, fontWeight:600, color:'var(--blue)' }}>{filterSummary}</span>
                <span style={{ fontSize:11, color:'var(--ink3)' }}>· {totalApprovedCount} cards total</span>
              </div>
            )}

            {displayLoading ? (
              <div style={{ display:'flex', alignItems:'center', justifyContent:'center', padding:60 }}>
                <Spinner size={32}/>
              </div>
            ) : filtered.length === 0 ? (
              <EmptyState icon="🪪" title="No approved cards for this filter"
                desc={activeFilterCount > 0
                  ? `No approved cards match: ${filterSummary}. Try changing the filters.`
                  : "Approve submissions in the Admin panel to see ID cards here."}
                action={
                  <div style={{ display:'flex', gap:8 }}>
                    {activeFilterCount > 0 && (
                      <Btn onClick={() => handleSchoolChange('All')}>Clear Filters</Btn>
                    )}
                    <Btn onClick={() => window.history.back()}>← Go to Admin</Btn>
                  </div>
                }/>
            ) : (
              <>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: `repeat(${cols}, 1fr)`,
                  gap: 20,
                }}>
                  {filtered.map(sub => (
                    <CardWrapper
                      key={sub.id}
                      sub={sub}
                      templateId={customTemplate ? null : templateId}
                      customConfig={customTemplate?.config || null}
                      orgLogo={organizations.find(o => o.name === sub.school_name)?.logo_url || null}
                      onDownload={() => downloadCard(sub)}
                      onDelete={() => setDeleteId(sub.id)}
                      onEdit={() => {
                        if (customTemplate) {
                          navigate(`/card-builder?edit=${customTemplate.id}&sub=${sub.id}`)
                        } else {
                          navigate(`/card-builder?sub=${sub.id}&tpl=${templateId}`)
                        }
                      }}
                      cardRefs={cardRefs}
                    />
                  ))}
                </div>
                {/* Pagination controls */}
                <div style={{ display:'flex', alignItems:'center', justifyContent:'center',
                  gap:10, marginTop:28, paddingBottom:20 }}>
                  <button
                    disabled={displayPage <= 1}
                    onClick={() => fetchDisplayPage(displayPage - 1, displayCursors, { school, filterClass, filterSection })}
                    style={{ padding:'8px 18px', borderRadius:'var(--r)',
                      border:'1.5px solid var(--border)', background:'var(--paper)',
                      color: displayPage <= 1 ? 'var(--ink4)' : 'var(--ink2)',
                      fontSize:13, fontWeight:700, cursor: displayPage <= 1 ? 'default' : 'pointer',
                      fontFamily:'inherit', opacity: displayPage <= 1 ? .4 : 1 }}>
                    ← Prev
                  </button>
                  <span style={{ fontSize:12, fontWeight:600, color:'var(--ink3)', minWidth:90, textAlign:'center' }}>
                    Page {displayPage} of {totalPages}
                  </span>
                  <button
                    disabled={displayPage >= totalPages || filtered.length < PAGE_SIZE}
                    onClick={() => fetchDisplayPage(displayPage + 1, displayCursors, { school, filterClass, filterSection })}
                    style={{ padding:'8px 18px', borderRadius:'var(--r)',
                      border:'1.5px solid var(--border)', background:'var(--paper)',
                      color: (displayPage >= totalPages || filtered.length < PAGE_SIZE) ? 'var(--ink4)' : 'var(--ink2)',
                      fontSize:13, fontWeight:700,
                      cursor: (displayPage >= totalPages || filtered.length < PAGE_SIZE) ? 'default' : 'pointer',
                      fontFamily:'inherit',
                      opacity: (displayPage >= totalPages || filtered.length < PAGE_SIZE) ? .4 : 1 }}>
                    Next →
                  </button>
                </div>
              </>
            )}
          </div>

          <div style={{ background:'var(--paper)', borderLeft:'1px solid var(--border)',
            padding:'16px 12px', display:'flex', flexDirection:'column', gap:12 }}>
            <FormatDownloadContent/>
          </div>
        </div>
      )}

      {/* ─────────────────── MOBILE ─────────────────── */}
      {isMobile && (
        <div style={{ minHeight:'calc(100vh - 64px)' }}>
          <div style={{ position:'sticky', top:64, zIndex:100, background:'var(--paper)',
            borderBottom:'1px solid var(--border)', padding:'10px 12px',
            display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
            <button onClick={() => navigate(-1)}
              style={{ padding:'7px 10px', borderRadius:8, border:'1.5px solid var(--border)',
                background:'var(--paper2)', color:'var(--ink2)', fontSize:13, fontWeight:700,
                cursor:'pointer', fontFamily:'inherit' }}>
              ←
            </button>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontSize:10, color:'var(--ink3)', fontWeight:600 }}>Template</div>
              <div style={{ fontSize:12, fontWeight:700, color:'var(--blue)',
                overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                {activeLabel}
              </div>
            </div>
            <button onClick={() => setLeftOpen(true)}
              style={{ padding:'7px 10px', borderRadius:8, border:'1.5px solid var(--border)',
                background:'var(--paper2)', color:'var(--ink2)', fontSize:12, fontWeight:700,
                cursor:'pointer', fontFamily:'inherit' }}>
              🎨 Template
            </button>
            <button onClick={() => setRightOpen(true)}
              style={{ padding:'7px 10px', borderRadius:8, border:'1.5px solid var(--blue)',
                background:'var(--blue-s)', color:'var(--blue)', fontSize:12, fontWeight:700,
                cursor:'pointer', fontFamily:'inherit' }}>
              ⬇ Download
            </button>
          </div>

          {/* Mobile filter bar */}
          <div style={{ padding:'10px 12px', background:'var(--paper)', borderBottom:'1px solid var(--border)' }}>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
              {/* School */}
              <div>
                <div style={{ fontSize:10, fontWeight:700, color:'var(--ink3)', textTransform:'uppercase',
                  letterSpacing:.5, marginBottom:3 }}>School</div>
                <select value={school} onChange={e => handleSchoolChange(e.target.value)}
                  style={{ width:'100%', padding:'8px 10px', borderRadius:8,
                    border:`1.5px solid ${school !== 'All' ? 'var(--blue-m)' : 'var(--border)'}`,
                    fontSize:12, color: school !== 'All' ? 'var(--blue)' : 'var(--ink)',
                    background: school !== 'All' ? 'var(--blue-s)' : 'var(--paper)',
                    outline:'none', cursor:'pointer', fontWeight: school !== 'All' ? 700 : 400 }}>
                  <option value="All">All Schools</option>
                  {schools.filter(s => s !== 'All').map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>

              {/* Class */}
              <div>
                <div style={{ fontSize:10, fontWeight:700, color:'var(--ink3)', textTransform:'uppercase',
                  letterSpacing:.5, marginBottom:3 }}>Class</div>
                <select value={filterClass} onChange={e => handleClassChange(e.target.value)}
                  style={{ width:'100%', padding:'8px 10px', borderRadius:8,
                    border:`1.5px solid ${filterClass !== 'All' ? 'var(--blue-m)' : 'var(--border)'}`,
                    fontSize:12, color: filterClass !== 'All' ? 'var(--blue)' : 'var(--ink)',
                    background: filterClass !== 'All' ? 'var(--blue-s)' : 'var(--paper)',
                    outline:'none', cursor:'pointer', fontWeight: filterClass !== 'All' ? 700 : 400 }}>
                  <option value="All">All Classes</option>
                  {availableClasses.map(c => <option key={c} value={c}>Class {c}</option>)}
                </select>
              </div>

              {/* Section */}
              <div>
                <div style={{ fontSize:10, fontWeight:700, color:'var(--ink3)', textTransform:'uppercase',
                  letterSpacing:.5, marginBottom:3 }}>Section</div>
                <select value={filterSection} onChange={e => setFilterSection(e.target.value)}
                  style={{ width:'100%', padding:'8px 10px', borderRadius:8,
                    border:`1.5px solid ${filterSection !== 'All' ? 'var(--blue-m)' : 'var(--border)'}`,
                    fontSize:12, color: filterSection !== 'All' ? 'var(--blue)' : 'var(--ink)',
                    background: filterSection !== 'All' ? 'var(--blue-s)' : 'var(--paper)',
                    outline:'none', cursor:'pointer', fontWeight: filterSection !== 'All' ? 700 : 400 }}>
                  <option value="All">All Sections</option>
                  {availableSections.map(s => <option key={s} value={s}>Section {s}</option>)}
                </select>
              </div>

              {/* Badge + clear */}
              <div style={{ display:'flex', flexDirection:'column', justifyContent:'flex-end', gap:4 }}>
                <Badge type={filtered.length > 0 ? 'teal' : 'gray'}>{displayPage > 1 ? `p${displayPage} · ` : ""}{filtered.length} shown</Badge>
                {activeFilterCount > 0 && (
                  <button onClick={() => handleSchoolChange('All')}
                    style={{ padding:'5px 8px', borderRadius:6, border:'1.5px solid var(--border)',
                      background:'var(--paper2)', color:'var(--ink3)', fontSize:11, fontWeight:700,
                      cursor:'pointer', fontFamily:'inherit' }}>
                    ✕ Clear filters
                  </button>
                )}
              </div>
            </div>

            {/* Active filter breadcrumb on mobile */}
            {activeFilterCount > 0 && (
              <div style={{ marginTop:8, padding:'5px 8px', background:'var(--blue-s)',
                borderRadius:6, fontSize:11, fontWeight:600, color:'var(--blue)',
                border:'1px solid var(--blue-m)' }}>
                🎯 {filterSummary} · {totalApprovedCount} total
              </div>
            )}
          </div>

          <div style={{ padding:'12px', display:'flex', flexDirection:'column', gap:20 }}>
            {displayLoading ? (
              <div style={{ display:'flex', alignItems:'center', justifyContent:'center', padding:48 }}>
                <Spinner size={32}/>
              </div>
            ) : filtered.length === 0 ? (
              <EmptyState icon="🪪" title="No approved cards for this filter"
                desc={activeFilterCount > 0
                  ? `No approved cards match: ${filterSummary}. Try changing the filters.`
                  : "Approve submissions in the Admin panel to see ID cards here."}
                action={
                  <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                    {activeFilterCount > 0 && (
                      <Btn onClick={() => handleSchoolChange('All')}>Clear Filters</Btn>
                    )}
                    <Btn onClick={() => window.history.back()}>← Go to Admin</Btn>
                  </div>
                }/>
            ) : (
              <>
                {filtered.map(sub => (
                  <CardWrapper
                    key={sub.id}
                    sub={sub}
                    templateId={customTemplate ? null : templateId}
                    customConfig={customTemplate?.config || null}
                    orgLogo={organizations.find(o => o.name === sub.school_name)?.logo_url || null}
                    onDownload={() => downloadCard(sub)}
                    onDelete={() => setDeleteId(sub.id)}
                    onEdit={() => {
                      if (customTemplate) {
                        navigate(`/card-builder?edit=${customTemplate.id}&sub=${sub.id}`)
                      } else {
                        navigate(`/card-builder?sub=${sub.id}&tpl=${templateId}`)
                      }
                    }}
                    cardRefs={cardRefs}
                  />
                ))}
                {/* Mobile pagination */}
                <div style={{ display:'flex', alignItems:'center', justifyContent:'center',
                  gap:10, paddingBottom:16 }}>
                  <button
                    disabled={displayPage <= 1}
                    onClick={() => fetchDisplayPage(displayPage - 1, displayCursors, { school, filterClass, filterSection })}
                    style={{ padding:'9px 18px', borderRadius:8,
                      border:'1.5px solid var(--border)', background:'var(--paper)',
                      color: displayPage <= 1 ? 'var(--ink4)' : 'var(--ink2)',
                      fontSize:13, fontWeight:700, cursor: displayPage <= 1 ? 'default' : 'pointer',
                      fontFamily:'inherit', opacity: displayPage <= 1 ? .4 : 1 }}>
                    ← Prev
                  </button>
                  <span style={{ fontSize:12, fontWeight:600, color:'var(--ink3)', minWidth:80, textAlign:'center' }}>
                    Page {displayPage} of {totalPages}
                  </span>
                  <button
                    disabled={displayPage >= totalPages || filtered.length < PAGE_SIZE}
                    onClick={() => fetchDisplayPage(displayPage + 1, displayCursors, { school, filterClass, filterSection })}
                    style={{ padding:'9px 18px', borderRadius:8,
                      border:'1.5px solid var(--border)', background:'var(--paper)',
                      color: (displayPage >= totalPages || filtered.length < PAGE_SIZE) ? 'var(--ink4)' : 'var(--ink2)',
                      fontSize:13, fontWeight:700,
                      cursor: (displayPage >= totalPages || filtered.length < PAGE_SIZE) ? 'default' : 'pointer',
                      fontFamily:'inherit',
                      opacity: (displayPage >= totalPages || filtered.length < PAGE_SIZE) ? .4 : 1 }}>
                    Next →
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── Mobile drawers ── */}
      {leftOpen && (
        <div style={{ position:'fixed', inset:0, zIndex:300, display:'flex' }}>
          <div style={{ flex:1, background:'rgba(0,0,0,.45)' }} onClick={() => setLeftOpen(false)}/>
          <div style={{ width: Math.min(280, winW - 40), background:'var(--paper)',
            overflowY:'auto', padding:20, boxShadow:'-4px 0 24px rgba(0,0,0,.15)' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
              <span style={{ fontSize:15, fontWeight:800, color:'var(--ink)' }}>Select Template</span>
              <button onClick={() => setLeftOpen(false)}
                style={{ border:'none', background:'transparent', fontSize:22, cursor:'pointer', color:'var(--ink3)' }}>✕</button>
            </div>
            <TemplateSelectorContent/>
          </div>
        </div>
      )}

      {rightOpen && (
        <div style={{ position:'fixed', inset:0, zIndex:300, display:'flex' }}>
          <div style={{ flex:1, background:'rgba(0,0,0,.45)' }} onClick={() => setRightOpen(false)}/>
          <div style={{ width: Math.min(280, winW - 40), background:'var(--paper)',
            overflowY:'auto', padding:20, boxShadow:'-4px 0 24px rgba(0,0,0,.15)' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
              <span style={{ fontSize:15, fontWeight:800, color:'var(--ink)' }}>Download</span>
              <button onClick={() => setRightOpen(false)}
                style={{ border:'none', background:'transparent', fontSize:22, cursor:'pointer', color:'var(--ink3)' }}>✕</button>
            </div>
            <FormatDownloadContent/>
          </div>
        </div>
      )}

      {/* ── Range picker modal ── */}
      {showRangePicker && (
        <RangePickerModal
          totalCards={totalApprovedCount}
          school={school}
          filterClass={filterClass}
          filterSection={filterSection}
          onConfirm={generateZip}
          onClose={() => setShowRangePicker(false)}
        />
      )}

      {/* ── Progress modal ── */}
      {zipProgress && (
        <ProgressModal
          done={zipProgress.done}
          total={zipProgress.total}
          label={zipProgress.label}
        />
      )}

      {/* ── Edit card details modal ── */}
      {editingSubmission && (
        <EditCardModal
          submission={editingSubmission}
          onSave={async (updatedFields) => {
            const success = await updateSubmission(editingSubmission.id, updatedFields)
            if (success) {
              // Immediately update local display list
              setDisplayCards(prev => prev.map(s => s.id === editingSubmission.id ? { ...s, ...updatedFields } : s))
              setEditingSubmission(null)
            }
          }}
          onClose={() => setEditingSubmission(null)}
        />
      )}

      <ConfirmDialog open={!!deleteId} onClose={() => setDeleteId(null)}
        onConfirm={() => deleteSubmission(deleteId)} title="Delete ID Card"
        message="This will permanently delete this submission and ID card."
        confirmLabel="Delete" danger/>

      <ConfirmDialog open={!!deleteTplId} onClose={() => setDeleteTplId(null)}
        onConfirm={async () => {
          await deleteTemplate(deleteTplId)
          if (customTemplate?.id === deleteTplId) {
            setCustomTemplate(null)
            setTemplateId('T1')
          }
          setDeleteTplId(null)
        }}
        title="Delete Template"
        message="This will permanently delete this template. Cards already generated with it won't be affected."
        confirmLabel="Delete Template" danger/>
    </div>
  )
}