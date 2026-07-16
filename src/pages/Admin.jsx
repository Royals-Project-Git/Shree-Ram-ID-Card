import { useState, useMemo, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSubmissions, PAGE_SIZE } from '../hooks/useSubmissions'
import { useOrganizations } from '../hooks/useOrganizations'
import { submissionsApi } from '../lib/firestore'
import { Badge, Btn, Card, Avatar, Modal, Spinner, EmptyState, ConfirmDialog } from '../components/shared/index'
import toast from 'react-hot-toast'

const formatDOB = val => {
  if (!val) return val
  if (!/^\d{4}-\d{2}-\d{2}$/.test(val)) return val
  const [y, m, d] = val.split('-')
  return `${d}/${m}/${y}`
}

const fmtDate = d => {
  if (!d) return '—'
  const date = d?.toDate ? d.toDate() : new Date(d)
  return isNaN(date) ? '—' : date.toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' })
}

const CSV_COLUMNS = [
  { key:'name',               label:'Name'              },
  { key:'role',               label:'Role'              },
  { key:'school_name',        label:'Organization'      },
  { key:'class',              label:'Class'             },
  { key:'section',            label:'Section'           },
  { key:'year',               label:'Year'              },
  { key:'roll_number',        label:'Roll No.'          },
  { key:'admission_number',   label:'Admission No.'     },
  { key:'student_id',         label:'Student ID'        },
  { key:'fathers_name',       label:"Father's Name"     },
  { key:'date_of_birth',      label:'Date of Birth'     },
  { key:'blood_group',        label:'Blood Group'       },
  { key:'contact_number',     label:'Contact No.'       },
  { key:'emergency_contact',  label:'Emergency No.'     },
  { key:'email_id',           label:'Email'             },
  { key:'employee_id',        label:'Employee ID'       },
  { key:'designation',        label:'Designation'       },
  { key:'department',         label:'Department'        },
  { key:'aadhar_card',        label:'Aadhaar No.'       },
  { key:'valid_from',         label:'Valid From'        },
  { key:'valid_till',         label:'Valid Till'        },
  { key:'batch_timing',       label:'Batch / Timing'   },
  { key:'address',            label:'Address'           },
  { key:'mode_of_transport',  label:'Mode of Transport' },
  { key:'status',             label:'Status'            },
  { key:'submitted_at',       label:'Submitted At'      },
]

function exportCSV(rows, filename = 'submissions.csv') {
  const escape = v => {
    if (v == null) return ''
    let s = typeof v === 'object' && v.toDate ? v.toDate().toLocaleDateString('en-IN') : String(v)
    if (s.includes(',') || s.includes('"') || s.includes('\n')) s = `"${s.replace(/"/g, '""')}"`
    return s
  }
  const header = CSV_COLUMNS.map(c => c.label).join(',')
  const body   = rows.map(row => CSV_COLUMNS.map(c => escape(row[c.key])).join(',')).join('\n')
  const blob   = new Blob([`${header}\n${body}`], { type:'text/csv;charset=utf-8;' })
  const url    = URL.createObjectURL(blob)
  const a      = document.createElement('a')
  a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}

const ORG_TYPE_ICONS = {
  School: '🏫', College: '🎓', Industry: '🏭',
  Company: '💼', Hospital: '🏥', Custom: '✏️',
}

/* ── Pagination Controls ─────────────────────────────────────── */
function PaginationBar({ currentPage, totalPages, totalCount, pageSize, onPage, loading }) {
  const showing = Math.min(pageSize, totalCount - (currentPage - 1) * pageSize)

  const pages = []
  const win = 2
  for (let p = 1; p <= totalPages; p++) {
    if (p === 1 || p === totalPages || (p >= currentPage - win && p <= currentPage + win)) {
      pages.push(p)
    }
  }
  const withEllipsis = []
  pages.forEach((p, i) => {
    if (i > 0 && p - pages[i - 1] > 1) withEllipsis.push('...')
    withEllipsis.push(p)
  })

  return (
    <div style={{ padding:'14px 16px', borderTop:'1px solid var(--border)', display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:10, background:'var(--paper2)' }}>
      <span style={{ fontSize:13, color:'var(--ink3)' }}>
        {loading ? 'Loading…' : `Showing ${showing} of ${totalCount.toLocaleString()} submissions · Page ${currentPage} of ${totalPages || 1}`}
      </span>
      <div style={{ display:'flex', gap:5, alignItems:'center' }}>
        <button
          disabled={currentPage <= 1 || loading}
          onClick={() => onPage(currentPage - 1)}
          style={{ padding:'5px 11px', borderRadius:8, border:'1.5px solid var(--border)', background:'var(--paper)', color:'var(--ink2)', fontSize:13, fontWeight:700, cursor: currentPage <= 1 ? 'not-allowed' : 'pointer', opacity: currentPage <= 1 ? .4 : 1 }}>
          ← Prev
        </button>

        {withEllipsis.map((p, i) =>
          p === '...'
            ? <span key={`e${i}`} style={{ color:'var(--ink3)', padding:'0 4px', fontSize:13 }}>…</span>
            : <button key={p} onClick={() => onPage(p)} disabled={loading}
                style={{ width:32, height:32, borderRadius:8, border:'1.5px solid', borderColor: p === currentPage ? 'var(--blue)' : 'var(--border)', background: p === currentPage ? 'var(--blue)' : 'var(--paper)', color: p === currentPage ? '#fff' : 'var(--ink2)', fontSize:13, fontWeight:700, cursor:'pointer', opacity: loading ? .6 : 1 }}>
                {p}
              </button>
        )}

        <button
          disabled={currentPage >= totalPages || loading}
          onClick={() => onPage(currentPage + 1)}
          style={{ padding:'5px 11px', borderRadius:8, border:'1.5px solid var(--border)', background:'var(--paper)', color:'var(--ink2)', fontSize:13, fontWeight:700, cursor: currentPage >= totalPages ? 'not-allowed' : 'pointer', opacity: currentPage >= totalPages ? .4 : 1 }}>
          Next →
        </button>
      </div>
    </div>
  )
}

/* ── Main Admin Component ───────────────────────────────────── */
export default function Admin() {
  const {
    submissions, loading, pageLoading,
    currentPage, totalCount, totalPages,
    applyFilters, goToPage,
    updateStatus, updateSubmission, bulkUpdateStatus, deleteSubmission, bulkDeleteSubmissions,
    fetchAllSubmissions,
  } = useSubmissions()

  const [exporting, setExporting] = useState(false)

  // ALL organizations from DB — not filtered by current page
  const { organizations } = useOrganizations()

  const navigate = useNavigate()

  const [search,     setSearch]     = useState('')
  const [filterRole, setFilterRole] = useState('All')
  const [filterOrg,  setFilterOrg]  = useState('All')   // org name → Firestore where clause
  const [filterType, setFilterType] = useState('All')   // org type → client-side filter
  const [filterStat, setFilterStat] = useState('All')
  const [sortBy,     setSortBy]     = useState('date_desc')
  const [selected,   setSelected]   = useState([])
  const [viewSub,    setViewSub]    = useState(null)
  const [editSub,    setEditSub]    = useState(null)
  const [editForm,   setEditForm]   = useState({})
  const [editSaving, setEditSaving] = useState(false)
  const [editPhoto,  setEditPhoto]  = useState(null)  // { dataUrl, file } | null
  const [deleteId,      setDeleteId]      = useState(null)
  const [bulkDeleteIds, setBulkDeleteIds] = useState([])

  // All unique org types present in the organizations collection
  const orgTypes = useMemo(() => {
    const types = [...new Set(organizations.map(o => o.type).filter(Boolean))].sort()
    return types
  }, [organizations])

  // Org names scoped to selected type (or all if type = 'All')
  const orgNames = useMemo(() => {
    const list = filterType !== 'All'
      ? organizations.filter(o => o.type === filterType)
      : organizations
    return [...new Set(list.map(o => o.name).filter(Boolean))].sort()
  }, [organizations, filterType])

  // If the selected org no longer belongs to the newly selected type, reset it
  useEffect(() => {
    if (filterOrg !== 'All' && filterType !== 'All') {
      const org = organizations.find(o => o.name === filterOrg)
      if (org && org.type !== filterType) setFilterOrg('All')
    }
  }, [filterType, filterOrg, organizations])

  // Push name/role/status/sort to Firestore whenever they change
  useEffect(() => {
    const t = setTimeout(() => {
      applyFilters({ filterRole, filterSch: filterOrg, filterStat, sortBy })
    }, 50)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterRole, filterOrg, filterStat, sortBy])

  // Client-side: org-type filter + text search on top of the Firestore page
  const filtered = useMemo(() => {
    let rows = submissions

    // Org type is not stored in submissions — look it up from organizations list
    if (filterType !== 'All') {
      const namesForType = new Set(
        organizations.filter(o => o.type === filterType).map(o => o.name)
      )
      rows = rows.filter(s => namesForType.has(s.school_name))
    }

    if (search) {
      const q = search.toLowerCase()
      rows = rows.filter(s =>
        (s.name        || '').toLowerCase().includes(q) ||
        (s.school_name || '').toLowerCase().includes(q)
      )
    }

    return rows
  }, [submissions, filterType, search, organizations])

  // Helper: resolve org type for a given submission's school_name
  const getOrgType = name => organizations.find(o => o.name === name)?.type || null

  const toggleSelect = id => setSelected(p => p.includes(id) ? p.filter(x=>x!==id) : [...p, id])
  const toggleAll    = () => setSelected(selected.length === filtered.length ? [] : filtered.map(s => s.id))
  const clearFilters = () => {
    setFilterType('All'); setFilterOrg('All')
    setFilterRole('All'); setFilterStat('All'); setSearch('')
  }

  // All possible editable fields with their labels (excluding system fields)
  const EDIT_FIELD_META = [
    { key:'name',              label:'Full Name',          type:'text'  },
    { key:'fathers_name',      label:"Father's Name",      type:'text'  },
    { key:'class',             label:'Class',              type:'text'  },
    { key:'section',           label:'Section',            type:'text'  },
    { key:'roll_number',       label:'Roll No.',           type:'text'  },
    { key:'admission_number',  label:'Admission No.',      type:'text'  },
    { key:'date_of_birth',     label:'Date of Birth',      type:'date'  },
    { key:'blood_group',       label:'Blood Group',        type:'text'  },
    { key:'contact_number',    label:'Contact No.',        type:'tel'   },
    { key:'emergency_contact', label:'Emergency Contact',  type:'tel'   },
    { key:'email_id',          label:'Email',              type:'email' },
    { key:'employee_id',       label:'Employee ID',        type:'text'  },
    { key:'designation',       label:'Designation',        type:'text'  },
    { key:'department',        label:'Department',         type:'text'  },
    { key:'aadhar_card',       label:'Aadhaar No.',        type:'text'  },
    { key:'mode_of_transport', label:'Mode of Transport',  type:'text'  },
    { key:'address',           label:'Address',            type:'textarea'},
    { key:'valid_from',        label:'Valid From',         type:'date'  },
    { key:'valid_till',        label:'Valid Till',         type:'date'  },
    { key:'batch_timing',      label:'Batch / Timing',    type:'text'  },
  ]

  const openEdit = (sub) => {
    // Only pre-populate fields that actually have data in this submission
    const form = {}
    EDIT_FIELD_META.forEach(({ key }) => {
      if (sub[key] != null && sub[key] !== '') form[key] = sub[key]
    })
    setEditForm(form)
    setEditPhoto(null)
    setEditSub(sub)
  }

  const handleEditSave = async () => {
    if (!editSub) return
    setEditSaving(true)
    const payload = Object.fromEntries(
      Object.entries(editForm).map(([k, v]) => [k, typeof v === 'string' ? v.trim() || null : v])
    )
    // Upload new photo first if one was selected
    if (editPhoto?.dataUrl) {
      try {
        const res = await submissionsApi.uploadPhoto(editSub.id, editPhoto.dataUrl)
        payload.photo_url = res.photo_url
      } catch (err) {
        toast.error('Photo upload failed — other changes will still save.')
      }
    }
    const ok = await updateSubmission(editSub.id, payload)
    setEditSaving(false)
    if (ok) {
      setViewSub(prev => prev?.id === editSub.id ? { ...prev, ...payload } : prev)
      setEditPhoto(null)
      setEditSub(null)
    }
  }

  const handleExportCSV = async () => {
    if (exporting) return
    setExporting(true)
    const toastId = toast.loading('Fetching all records for export...')
    try {
      const allSubmissions = await fetchAllSubmissions({ filterRole, filterSch: filterOrg, filterStat, sortBy })
      
      // Client-side: org-type filter + text search on top of the Firestore results
      let rows = allSubmissions

      if (filterType !== 'All') {
        const namesForType = new Set(
          organizations.filter(o => o.type === filterType).map(o => o.name)
        )
        rows = rows.filter(s => namesForType.has(s.school_name))
      }

      if (search) {
        const q = search.toLowerCase()
        rows = rows.filter(s =>
          (s.name        || '').toLowerCase().includes(q) ||
          (s.school_name || '').toLowerCase().includes(q)
        )
      }

      if (rows.length === 0) {
        toast.error('No data to export', { id: toastId })
        return
      }

      const parts = ['submissions']
      if (filterOrg  !== 'All') parts.push(filterOrg.replace(/\s+/g, '_'))
      if (filterRole !== 'All') parts.push(filterRole)
      if (filterStat !== 'All') parts.push(filterStat)
      parts.push(new Date().toISOString().slice(0, 10))
      
      exportCSV(rows, `${parts.join('_')}.csv`)
      toast.success(`Exported all ${rows.length} rows successfully!`, { id: toastId })
    } catch (err) {
      console.error('Export failed:', err)
      toast.error('Export failed: ' + (err.message || 'unknown error'), { id: toastId })
    } finally {
      setExporting(false)
    }
  }

  const isLoading = loading || pageLoading
  const hasActiveFilters = filterType !== 'All' || filterOrg !== 'All' || filterRole !== 'All' || filterStat !== 'All'

  if (loading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'80vh' }}>
      <Spinner size={36}/>
    </div>
  )

  return (
    <div className="anim-fade-up">
      <style>{`
        .admin-wrap { padding: 40px; padding-top: 104px; }
        .admin-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 28px; }
        .admin-header-btns { display: flex; gap: 10px; flex-wrap: wrap; }
        .admin-col-contact, .admin-col-org, .admin-col-date { display: table-cell; }
        .admin-filters { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
        .admin-filter-select { padding: 9px 12px; border-radius: var(--r); border: 1.5px solid var(--border); font-size: 13px; color: var(--ink2); background: var(--paper); outline: none; cursor: pointer; transition: border-color .15s; }
        .admin-filter-select:focus { border-color: var(--blue); box-shadow: 0 0 0 3px rgba(35,82,255,.1); }

        @media (max-width: 900px) {
          .admin-wrap { padding: 20px !important; padding-top: 80px !important; }
          .admin-col-date { display: none !important; }
        }
        @media (max-width: 700px) {
          .admin-header { flex-direction: column !important; gap: 14px !important; }
          .admin-header-btns { width: 100%; }
          .admin-col-contact { display: none !important; }
          .admin-col-org { max-width: 90px !important; font-size: 11px !important; }
          .admin-filter-select { font-size: 12px; padding: 7px 8px; }
        }
        @media (max-width: 480px) {
          .admin-col-org { display: none !important; }
        }
      `}</style>

      <div className="admin-wrap">
        <div className="admin-header">
          <div>
            <h1 style={{ fontFamily:'Outfit,sans-serif', fontSize:28, fontWeight:900, color:'var(--ink)', letterSpacing:-.5 }}>Admin Panel</h1>
            <p style={{ fontSize:14, color:'var(--ink2)', marginTop:4 }}>
              {totalCount.toLocaleString()} total submissions · {organizations.length} organizations
            </p>
          </div>
          <div className="admin-header-btns">
            <Btn variant="ghost" size="sm" onClick={() => navigate(-1)}>← Back</Btn>
            <Btn variant="ghost" size="sm" onClick={() => navigate('/templates')}>🪪 View ID Cards</Btn>
            <Btn variant="ghost" size="sm" onClick={handleExportCSV} disabled={exporting}>
              {exporting ? '⏳ Exporting...' : '⬇ Export CSV'}
            </Btn>
            <Btn size="sm" onClick={() => navigate('/add-template')}>+ New Link</Btn>
          </div>
        </div>

        {/* Stat pills */}
        <div style={{ display:'flex', gap:8, marginBottom:20, flexWrap:'wrap' }}>
          {[['All','All'],['Pending','pending'],['Approved','approved'],['Rejected','rejected']].map(([label, val]) => (
            <div key={label} onClick={() => setFilterStat(val)}
              style={{ padding:'7px 14px', borderRadius:'var(--r)', border:`2px solid ${filterStat === val ? 'var(--blue)' : 'var(--border)'}`, background: filterStat === val ? 'var(--blue-s)' : 'var(--paper)', cursor:'pointer', display:'flex', alignItems:'center', gap:8, transition:'all .15s' }}>
              <span style={{ fontSize:13, fontWeight:700, color: filterStat === val ? 'var(--blue)' : 'var(--ink2)' }}>{label}</span>
            </div>
          ))}
        </div>

        <Card style={{ padding:0, overflow:'hidden' }}>
          {/* Toolbar */}
          <div style={{ padding:'14px 16px', borderBottom:'1px solid var(--border)', background:'var(--paper2)' }}>
            <div className="admin-filters">

              {/* Search */}
              <div style={{ position:'relative', flex:1, minWidth:180 }}>
                <span style={{ position:'absolute', left:11, top:'50%', transform:'translateY(-50%)', fontSize:15, color:'var(--ink3)' }}>🔍</span>
                <input value={search} onChange={e => setSearch(e.target.value)}
                  placeholder="Search name or organization…"
                  style={{ width:'100%', padding:'9px 14px 9px 36px', borderRadius:'var(--r)', border:'1.5px solid var(--border)', fontSize:13, color:'var(--ink)', background:'var(--paper)', outline:'none', boxSizing:'border-box' }}
                  onFocus={e => { e.target.style.borderColor='var(--blue)'; e.target.style.boxShadow='0 0 0 3px rgba(35,82,255,.1)' }}
                  onBlur={e  => { e.target.style.borderColor='var(--border)'; e.target.style.boxShadow='none' }}/>
              </div>

              {/* Role */}
              <select className="admin-filter-select" value={filterRole} onChange={e => setFilterRole(e.target.value)}>
                <option value="All">All Roles</option>
                <option value="Student">🎓 Student</option>
                <option value="Staff">👨‍🏫 Staff</option>
                <option value="Employee">💼 Employee</option>
              </select>

              {/* Org Type — scopes the Org Name dropdown below */}
              <select className="admin-filter-select" value={filterType}
                onChange={e => { setFilterType(e.target.value); setFilterOrg('All') }}>
                <option value="All">All Org Types</option>
                {orgTypes.map(t => (
                  <option key={t} value={t}>{ORG_TYPE_ICONS[t] || '🏢'} {t}</option>
                ))}
              </select>

              {/* Org Name — populated from ALL orgs in DB, filtered by type if set */}
              <select className="admin-filter-select" value={filterOrg} onChange={e => setFilterOrg(e.target.value)}>
                <option value="All">All Organizations</option>
                {orgNames.map(name => {
                  const org = organizations.find(o => o.name === name)
                  return (
                    <option key={name} value={name}>
                      {ORG_TYPE_ICONS[org?.type] || '🏢'} {name}
                    </option>
                  )
                })}
              </select>

              {/* Sort */}
              <select className="admin-filter-select" value={sortBy} onChange={e => setSortBy(e.target.value)}>
                <option value="date_desc">Newest First</option>
                <option value="date_asc">Oldest First</option>
                <option value="name_asc">Name A–Z</option>
              </select>

              <Btn size="sm" variant="ghost" onClick={() => navigate('/templates')}>Templates →</Btn>
            </div>

            {/* Active filter chips */}
            {hasActiveFilters && (
              <div style={{ display:'flex', gap:6, marginTop:10, flexWrap:'wrap', alignItems:'center' }}>
                <span style={{ fontSize:11, color:'var(--ink3)', fontWeight:600 }}>Filters:</span>
                {filterType !== 'All' && (
                  <span onClick={() => { setFilterType('All'); setFilterOrg('All') }}
                    style={{ fontSize:12, fontWeight:700, color:'var(--blue)', background:'var(--blue-s)', padding:'3px 10px', borderRadius:20, cursor:'pointer' }}>
                    {ORG_TYPE_ICONS[filterType]} {filterType} ✕
                  </span>
                )}
                {filterOrg !== 'All' && (
                  <span onClick={() => setFilterOrg('All')}
                    style={{ fontSize:12, fontWeight:700, color:'var(--blue)', background:'var(--blue-s)', padding:'3px 10px', borderRadius:20, cursor:'pointer' }}>
                    🏢 {filterOrg} ✕
                  </span>
                )}
                {filterRole !== 'All' && (
                  <span onClick={() => setFilterRole('All')}
                    style={{ fontSize:12, fontWeight:700, color:'#00875f', background:'var(--teal-s)', padding:'3px 10px', borderRadius:20, cursor:'pointer' }}>
                    👤 {filterRole} ✕
                  </span>
                )}
                {filterStat !== 'All' && (
                  <span onClick={() => setFilterStat('All')}
                    style={{ fontSize:12, fontWeight:700, color:'#b45309', background:'var(--amber-s)', padding:'3px 10px', borderRadius:20, cursor:'pointer' }}>
                    ● {filterStat} ✕
                  </span>
                )}
                <button onClick={clearFilters}
                  style={{ fontSize:11, color:'var(--ink3)', background:'none', border:'none', cursor:'pointer', fontWeight:700, padding:'3px 8px', textDecoration:'underline' }}>
                  Clear all
                </button>
              </div>
            )}

            {/* Bulk actions */}
            {selected.length > 0 && (
              <div style={{ display:'flex', gap:8, padding:'8px 12px', background:'var(--blue-s)', borderRadius:'var(--r)', border:'1px solid var(--blue-m)', marginTop:10, flexWrap:'wrap', alignItems:'center' }}>
                <span style={{ fontSize:13, fontWeight:600, color:'var(--blue)' }}>{selected.length} selected</span>
                <button onClick={() => bulkUpdateStatus(selected,'approved').then(() => setSelected([]))} style={{ fontSize:12,fontWeight:700,color:'#00875f',background:'var(--teal-s)',border:'none',padding:'4px 10px',borderRadius:6,cursor:'pointer' }}>✓ Approve All</button>
                <button onClick={() => bulkUpdateStatus(selected,'rejected').then(() => setSelected([]))} style={{ fontSize:12,fontWeight:700,color:'#b91c1c',background:'var(--red-s)',border:'none',padding:'4px 10px',borderRadius:6,cursor:'pointer' }}>✕ Reject All</button>
                <button onClick={() => setBulkDeleteIds([...selected])} style={{ fontSize:12,fontWeight:700,color:'#b91c1c',background:'var(--red-s)',border:'1px solid #fca5a5',padding:'4px 10px',borderRadius:6,cursor:'pointer' }}>🗑 Delete All</button>
                <button onClick={() => setSelected([])} style={{ fontSize:12,fontWeight:700,color:'var(--ink3)',background:'var(--paper3)',border:'none',padding:'4px 10px',borderRadius:6,cursor:'pointer' }}>Clear</button>
              </div>
            )}
          </div>

          {/* Page loading overlay */}
          {pageLoading && (
            <div style={{ display:'flex', alignItems:'center', justifyContent:'center', padding:40 }}>
              <Spinner size={28}/><span style={{ marginLeft:12, fontSize:13, color:'var(--ink3)' }}>Loading page…</span>
            </div>
          )}

          {/* Table */}
          {!pageLoading && (filtered.length === 0 ? (
            <EmptyState icon="🔍" title="No results found" desc="Try adjusting your search or filters." />
          ) : (
            <div style={{ overflowX:'auto' }}>
              <table style={{ width:'100%', borderCollapse:'collapse', minWidth:360 }}>
                <thead>
                  <tr style={{ background:'var(--paper2)' }}>
                    <th style={{ padding:'11px 12px', textAlign:'left', fontSize:11, fontWeight:700, color:'var(--ink3)', textTransform:'uppercase', letterSpacing:.5, borderBottom:'2px solid var(--border)' }}>
                      <input type="checkbox" checked={selected.length===filtered.length && filtered.length>0} onChange={toggleAll} style={{ accentColor:'var(--blue)' }}/>
                    </th>
                    {['Name','Contact','Organization','Role','Status','Submitted','Actions'].map(h => (
                      <th key={h}
                        className={h==='Contact'?'admin-col-contact':h==='Submitted'?'admin-col-date':h==='Organization'?'admin-col-org':''}
                        style={{ padding:'11px 12px', textAlign:'left', fontSize:11, fontWeight:700, color:'var(--ink3)', textTransform:'uppercase', letterSpacing:.5, borderBottom:'2px solid var(--border)', whiteSpace:'nowrap' }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(s => {
                    const orgType = getOrgType(s.school_name)
                    return (
                      <tr key={s.id} style={{ borderBottom:'1px solid var(--border)', transition:'background .15s', cursor:'pointer' }}
                        onMouseEnter={e => e.currentTarget.style.background='var(--paper2)'}
                        onMouseLeave={e => e.currentTarget.style.background='transparent'}>
                        <td style={{ padding:'11px 12px' }}>
                          <input type="checkbox" checked={selected.includes(s.id)} onChange={() => toggleSelect(s.id)} onClick={e => e.stopPropagation()} style={{ accentColor:'var(--blue)' }}/>
                        </td>
                        <td style={{ padding:'11px 12px' }} onClick={() => setViewSub(s)}>
                          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                            <Avatar name={s.name||''} size={32} src={s.photo_url}/>
                            <div>
                              <div style={{ fontSize:13, fontWeight:700, color:'var(--ink)' }}>{s.name||'—'}</div>
                              <div style={{ fontSize:10, fontFamily:'JetBrains Mono,monospace', color:'var(--ink3)', marginTop:1 }}>{s.id.slice(0,8).toUpperCase()}</div>
                            </div>
                          </div>
                        </td>
                        <td className="admin-col-contact" style={{ padding:'11px 12px', fontSize:13, color:'var(--ink2)' }}>{s.contact_number||'—'}</td>
                        <td className="admin-col-org" style={{ padding:'11px 12px', maxWidth:160 }}>
                          <div style={{ fontSize:13, color:'var(--ink)', fontWeight:600, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                            {s.school_name || '—'}
                          </div>
                          {orgType && (
                            <div style={{ fontSize:10, color:'var(--ink3)', marginTop:1 }}>
                              {ORG_TYPE_ICONS[orgType] || '🏢'} {orgType}
                            </div>
                          )}
                        </td>
                        <td style={{ padding:'11px 12px' }}><Badge type={s.role==='Student'?'blue':s.role==='Staff'?'teal':'amber'}>{s.role}</Badge></td>
                        <td style={{ padding:'11px 12px' }}><Badge type={s.status==='approved'?'teal':s.status==='pending'?'amber':'red'} dot>{s.status}</Badge></td>
                        <td className="admin-col-date" style={{ padding:'11px 12px', fontSize:12, color:'var(--ink3)', fontFamily:'JetBrains Mono,monospace', whiteSpace:'nowrap' }}>{fmtDate(s.submitted_at)}</td>
                        <td style={{ padding:'11px 12px' }}>
                          <div style={{ display:'flex', gap:5 }}>
                            <button onClick={e=>{e.stopPropagation();setViewSub(s)}} title="View" style={{ width:30,height:30,borderRadius:7,border:'none',background:'var(--blue-s)',color:'var(--blue)',cursor:'pointer',fontSize:14 }}>👁</button>
                            <button onClick={e=>{e.stopPropagation();openEdit(s)}} title="Edit" style={{ width:30,height:30,borderRadius:7,border:'none',background:'var(--paper3)',color:'var(--ink2)',cursor:'pointer',fontSize:14 }}>✏️</button>
                            {s.status!=='approved' && <button onClick={e=>{e.stopPropagation();updateStatus(s.id,'approved',s.name)}} title="Approve" style={{ width:30,height:30,borderRadius:7,border:'none',background:'var(--teal-s)',color:'#00875f',cursor:'pointer',fontSize:14 }}>✓</button>}
                            {s.status!=='rejected' && <button onClick={e=>{e.stopPropagation();updateStatus(s.id,'rejected',s.name)}} title="Reject" style={{ width:30,height:30,borderRadius:7,border:'none',background:'var(--red-s)',color:'#b91c1c',cursor:'pointer',fontSize:14 }}>✕</button>}
                            <button onClick={e=>{e.stopPropagation();setDeleteId(s.id)}} title="Delete" style={{ width:30,height:30,borderRadius:7,border:'none',background:'var(--paper3)',color:'var(--ink3)',cursor:'pointer',fontSize:14 }}>🗑</button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          ))}

          {/* Pagination */}
          <PaginationBar
            currentPage={currentPage}
            totalPages={totalPages}
            totalCount={totalCount}
            pageSize={PAGE_SIZE}
            onPage={goToPage}
            loading={isLoading}
          />
        </Card>

        {/* View detail modal */}
        <Modal open={!!viewSub} onClose={() => setViewSub(null)} title="Submission Details" width={560}>
          {viewSub && (() => {
            const orgType = getOrgType(viewSub.school_name)
            return (
              <div>
                <div style={{ display:'flex', gap:16, alignItems:'flex-start', marginBottom:20, padding:16, background:'var(--paper2)', borderRadius:'var(--rl)', flexWrap:'wrap' }}>
                  {viewSub.photo_url
                    ? <img src={viewSub.photo_url} style={{ width:80,height:100,objectFit:'cover',borderRadius:10,border:'2px solid var(--blue)',flexShrink:0 }} alt=""/>
                    : <Avatar name={viewSub.name||''} size={80} style={{ borderRadius:10, flexShrink:0 }}/>
                  }
                  <div>
                    <div style={{ fontFamily:'Outfit,sans-serif',fontSize:20,fontWeight:800,color:'var(--ink)' }}>{viewSub.name}</div>
                    <div style={{ fontSize:13,color:'var(--ink3)',marginTop:3 }}>
                      {orgType && <span style={{ fontWeight:600 }}>{ORG_TYPE_ICONS[orgType]} {orgType} · </span>}
                      {viewSub.school_name}
                    </div>
                    <div style={{ display:'flex',gap:8,marginTop:8,flexWrap:'wrap' }}>
                      <Badge type={viewSub.role==='Student'?'blue':viewSub.role==='Staff'?'teal':'amber'}>{viewSub.role}</Badge>
                      <Badge type={viewSub.status==='approved'?'teal':viewSub.status==='pending'?'amber':'red'} dot>{viewSub.status}</Badge>
                    </div>
                  </div>
                </div>
                <div style={{ display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(140px,1fr))',gap:12,marginBottom:20 }}>
                  {[
                    ["Father's Name", viewSub.fathers_name],
                    ['Contact',    viewSub.contact_number],
                    ['Blood Group',viewSub.blood_group],
                    ['Class',      viewSub.class],
                    ['Section',    viewSub.section],
                    ['Roll No.',viewSub.roll_number],
                    ['Admission No.',viewSub.admission_number],
                    ['Date of Birth', formatDOB(viewSub.date_of_birth)],
                    ['Emergency',  viewSub.emergency_contact],
                    ['Designation',viewSub.designation],
                    ['Department', viewSub.department],
                    ['Employee ID',viewSub.employee_id],
                    ['Email',      viewSub.email_id],
                    ['Aadhaar No.', viewSub.aadhar_card],
                    ['Address',    viewSub.address],
                    ['Transport',  viewSub.mode_of_transport],
                    ['Valid From', formatDOB(viewSub.valid_from)],
                    ['Valid Till', formatDOB(viewSub.valid_till)],
                    ['Batch / Timing', viewSub.batch_timing],
                  ].filter(([,v])=>v).map(([k,v]) => (
                    <div key={k} style={{ background:'var(--paper2)',borderRadius:8,padding:'10px 12px' }}>
                      <div style={{ fontSize:10,fontWeight:700,color:'var(--ink3)',textTransform:'uppercase',letterSpacing:.4 }}>{k}</div>
                      <div style={{ fontSize:13,fontWeight:600,color:'var(--ink)',marginTop:2 }}>{v}</div>
                    </div>
                  ))}
                </div>
                <div style={{ display:'flex',gap:10,flexWrap:'wrap' }}>
                  {viewSub.status!=='approved' && <Btn variant="teal" full onClick={()=>{updateStatus(viewSub.id,'approved',viewSub.name);setViewSub(null)}}>✓ Approve</Btn>}
                  {viewSub.status!=='rejected' && <Btn variant="danger" full onClick={()=>{updateStatus(viewSub.id,'rejected',viewSub.name);setViewSub(null)}}>✕ Reject</Btn>}
                  <Btn variant="ghost" onClick={() => { openEdit(viewSub); setViewSub(null) }}>✏️ Edit</Btn>
                  <Btn variant="ghost" onClick={() => setViewSub(null)}>Close</Btn>
                </div>
              </div>
            )
          })()}
        </Modal>

        {/* Edit modal — shows only fields present in this submission */}
        <Modal open={!!editSub} onClose={() => !editSaving && setEditSub(null)} title={`Edit — ${editSub?.name || 'Submission'}`} width={580}>
          {editSub && (() => {
            const presentFields = EDIT_FIELD_META.filter(f => f.key in editForm)
            const inputStyle = { width:'100%', padding:'9px 11px', borderRadius:8, border:'1.5px solid var(--border)', fontSize:13, color:'var(--ink)', background:'var(--paper)', outline:'none', boxSizing:'border-box' }
            const focusStyle = e => { e.target.style.borderColor='var(--blue)'; e.target.style.boxShadow='0 0 0 3px rgba(35,82,255,.1)' }
            const blurStyle  = e => { e.target.style.borderColor='var(--border)'; e.target.style.boxShadow='none' }
            return (
              <div>
                <p style={{ fontSize:13, color:'var(--ink3)', marginBottom:16 }}>
                  Only fields collected in this form are shown below.
                </p>

                {/* Photo section */}
                <div style={{ display:'flex', alignItems:'center', gap:16, padding:14, background:'var(--paper2)', borderRadius:10, marginBottom:18 }}>
                  <div style={{ position:'relative', flexShrink:0 }}>
                    {(editPhoto?.dataUrl || editSub.photo_url)
                      ? <img src={editPhoto?.dataUrl || editSub.photo_url} alt="preview"
                          style={{ width:72, height:90, objectFit:'cover', borderRadius:8, border:'2px solid var(--blue)', display:'block' }}/>
                      : <Avatar name={editSub.name || ''} size={72} style={{ borderRadius:8 }}/>
                    }
                    {editPhoto && (
                      <div style={{ position:'absolute', top:-6, right:-6, width:18, height:18, background:'var(--teal)', borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', fontSize:10 }}>✓</div>
                    )}
                  </div>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:13, fontWeight:700, color:'var(--ink)', marginBottom:4 }}>
                      {editPhoto ? '✅ New photo selected' : 'Profile Photo'}
                    </div>
                    <div style={{ fontSize:12, color:'var(--ink3)', marginBottom:10 }}>
                      {editPhoto ? editPhoto.name : 'JPG or PNG, max 10MB'}
                    </div>
                    <div style={{ display:'flex', gap:8 }}>
                      <label style={{ padding:'6px 14px', borderRadius:7, border:'1.5px solid var(--blue)', color:'var(--blue)', fontSize:12, fontWeight:700, cursor:'pointer', background:'var(--blue-s)' }}>
                        📷 {editPhoto ? 'Change Photo' : 'Upload Photo'}
                        <input type="file" accept="image/*" style={{ display:'none' }}
                          onChange={e => {
                            const file = e.target.files?.[0]
                            if (!file) return
                            if (file.size > 10 * 1024 * 1024) { toast.error('Image must be under 10MB'); return }
                            const reader = new FileReader()
                            reader.onload = ev => setEditPhoto({ dataUrl: ev.target.result, name: file.name })
                            reader.readAsDataURL(file)
                            e.target.value = ''
                          }}
                        />
                      </label>
                      {editPhoto && (
                        <button onClick={() => setEditPhoto(null)}
                          style={{ padding:'6px 12px', borderRadius:7, border:'1.5px solid var(--border)', color:'var(--ink3)', fontSize:12, fontWeight:700, cursor:'pointer', background:'transparent' }}>
                          ✕ Remove
                        </button>
                      )}
                    </div>
                  </div>
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14, marginBottom:20 }}>
                  {presentFields.map(({ key, label, type }) => {
                    const isWide = type === 'textarea' || key === 'name' || key === 'fathers_name'
                    return (
                      <div key={key} style={{ gridColumn: isWide ? 'span 2' : 'span 1' }}>
                        <label style={{ fontSize:11, fontWeight:700, color:'var(--ink3)', textTransform:'uppercase', letterSpacing:.5, display:'block', marginBottom:5 }}>{label}</label>
                        {type === 'textarea'
                          ? <textarea rows={2} value={editForm[key] ?? ''}
                              onChange={e => setEditForm(p => ({ ...p, [key]: e.target.value }))}
                              style={{ ...inputStyle, resize:'vertical' }}
                              onFocus={focusStyle} onBlur={blurStyle}/>
                          : <input type={type} value={editForm[key] ?? ''}
                              onChange={e => setEditForm(p => ({ ...p, [key]: e.target.value }))}
                              style={inputStyle}
                              onFocus={focusStyle} onBlur={blurStyle}/>
                        }
                      </div>
                    )
                  })}
                </div>
                <div style={{ display:'flex', gap:10 }}>
                  <Btn variant="teal" onClick={handleEditSave} disabled={editSaving}>
                    {editSaving ? '⏳ Saving…' : '💾 Save Changes'}
                  </Btn>
                  <Btn variant="ghost" onClick={() => setEditSub(null)} disabled={editSaving}>Cancel</Btn>
                </div>
              </div>
            )
          })()}
        </Modal>

        {/* Delete confirm */}
        <ConfirmDialog open={!!deleteId} onClose={() => setDeleteId(null)} onConfirm={() => deleteSubmission(deleteId)} title="Delete Submission" message="This will permanently delete this submission. This action cannot be undone." confirmLabel="Delete" danger />
        <ConfirmDialog open={bulkDeleteIds.length > 0} onClose={() => setBulkDeleteIds([])} onConfirm={() => bulkDeleteSubmissions(bulkDeleteIds).then(() => { setSelected([]); setBulkDeleteIds([]) })} title={`Delete ${bulkDeleteIds.length} Submission${bulkDeleteIds.length > 1 ? 's' : ''}`} message={`This will permanently delete ${bulkDeleteIds.length} selected submission${bulkDeleteIds.length > 1 ? 's' : ''}. This action cannot be undone.`} confirmLabel="Delete All" danger />
      </div>
    </div>
  )
}