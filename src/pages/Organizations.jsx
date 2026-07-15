import { useState, useRef } from 'react'
import { useOrganizations } from '../hooks/useOrganizations'
import { Spinner, ConfirmDialog } from '../components/shared/index'
import toast from 'react-hot-toast'

/* ── Constants ────────────────────────────────────────────────── */
const ORG_TYPES  = ['School','College','Industry','Company','Hospital','Custom']
const ORG_ICONS  = { School:'🏫', College:'🎓', Industry:'🏭', Company:'💼', Hospital:'🏥', Custom:'✏️' }
const EMPTY_FORM = { name:'', type:'School', address:'', contact:'', email:'', website:'', classes_config:[] }
const fmtDate    = d => {
  if (!d) return '—'
  const date = d?.toDate ? d.toDate() : new Date(d)
  return isNaN(date) ? '—' : date.toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' })
}

function dInput(hasErr=false) {
  return {
    width:'100%', padding:'11px 14px', borderRadius:8,
    border:`1.5px solid ${hasErr ? 'var(--red)' : 'var(--border)'}`,
    fontSize:14, color:'var(--ink)', background:'var(--paper2)',
    outline:'none', fontFamily:'inherit', transition:'border-color .18s',
    boxSizing:'border-box',
  }
}
function onFocusDark(e)       { e.target.style.borderColor='var(--blue)'; e.target.style.boxShadow='0 0 0 3px rgba(35,82,255,.1)' }
function onBlurDark(e,hasErr) { e.target.style.borderColor=hasErr?'var(--red)':'var(--border)'; e.target.style.boxShadow='none' }

function DLabel({ children, required }) {
  return (
    <label style={{ display:'block', fontSize:12, fontWeight:600, color:'var(--ink)', marginBottom:7 }}>
      {children}{required && <span style={{ color:'var(--red)', marginLeft:3 }}>*</span>}
    </label>
  )
}

function DField({ label, value, onChange, placeholder, type='text', required=false, error='' }) {
  return (
    <div>
      <DLabel required={required}>{label}</DLabel>
      <input type={type} value={value} onChange={onChange} placeholder={placeholder}
        style={dInput(!!error)} onFocus={onFocusDark} onBlur={e => onBlurDark(e, !!error)} />
      {error && <p style={{ fontSize:11, color:'var(--red)', marginTop:4 }}>{error}</p>}
    </div>
  )
}

/* ── Detail row used inside the view panel ────────────────────── */
function InfoRow({ icon, label, value, isLink=false }) {
  if (!value) return null
  return (
    <div style={{ display:'flex', gap:14, alignItems:'flex-start', padding:'13px 0', borderBottom:'1px solid var(--border)' }}>
      <div style={{ width:36, height:36, borderRadius:9, background:'var(--blue-s)', border:'1px solid rgba(35,82,255,.15)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, fontSize:16 }}>
        {icon}
      </div>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontSize:11, fontWeight:600, color:'var(--ink3)', textTransform:'uppercase', letterSpacing:.5, marginBottom:3 }}>{label}</div>
        {isLink
          ? <a href={value} target="_blank" rel="noopener noreferrer"
              style={{ fontSize:13, color:'var(--blue)', fontWeight:600, wordBreak:'break-word', textDecoration:'none' }}>{value}</a>
          : <div style={{ fontSize:13, color:'var(--ink)', fontWeight:500, lineHeight:1.5, wordBreak:'break-word' }}>{value}</div>
        }
      </div>
    </div>
  )
}

/* ── Clickable list card ──────────────────────────────────────── */
function OrgCard({ org, onView, onEdit, onDelete }) {
  return (
    <div
      onClick={() => onView(org)}
      style={{ background:'var(--paper)', border:'1px solid var(--border)', borderRadius:14, overflow:'hidden', transition:'all .2s', cursor:'pointer' }}
      onMouseEnter={e => { e.currentTarget.style.borderColor='var(--blue)'; e.currentTarget.style.transform='translateY(-2px)'; e.currentTarget.style.boxShadow='0 6px 24px rgba(35,82,255,.10)' }}
      onMouseLeave={e => { e.currentTarget.style.borderColor='var(--border)'; e.currentTarget.style.transform='translateY(0)'; e.currentTarget.style.boxShadow='none' }}>
      <div style={{ height:4, background:'linear-gradient(90deg,var(--blue),#7c5cfc)' }}/>
      <div style={{ padding:18 }}>
        {/* Logo + name */}
        <div style={{ display:'flex', gap:14, alignItems:'flex-start', marginBottom:14 }}>
          <div style={{ width:52, height:52, borderRadius:12, overflow:'hidden', flexShrink:0, background:'var(--paper2)', border:'1.5px solid var(--border)', display:'flex', alignItems:'center', justifyContent:'center' }}>
            {org.logo_url
              ? <img src={org.logo_url} style={{ width:'100%', height:'100%', objectFit:'cover' }} alt=""/>
              : <span style={{ fontFamily:'Outfit,sans-serif', fontWeight:900, fontSize:18, color:'var(--blue)' }}>{org.name.slice(0,2).toUpperCase()}</span>
            }
          </div>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ fontFamily:'Outfit,sans-serif', fontSize:15, fontWeight:800, color:'var(--ink)', letterSpacing:-.2, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{org.name}</div>
            <div style={{ display:'inline-flex', alignItems:'center', gap:5, marginTop:6, padding:'3px 10px', borderRadius:20, background:'var(--blue-s)', border:'1px solid rgba(35,82,255,.2)' }}>
              <span style={{ fontSize:12 }}>{ORG_ICONS[org.type]}</span>
              <span style={{ fontSize:11, fontWeight:700, color:'var(--blue)' }}>{org.type}</span>
            </div>
          </div>
        </div>

        {/* Info rows */}
        <div style={{ display:'flex', flexDirection:'column', gap:7, marginBottom:14 }}>
          {org.address && <div style={{ display:'flex', gap:8, alignItems:'flex-start' }}><span style={{ fontSize:13, flexShrink:0 }}>📍</span><span style={{ fontSize:12, color:'var(--ink2)', lineHeight:1.5, wordBreak:'break-word' }}>{org.address}</span></div>}
          {org.contact && <div style={{ display:'flex', gap:8, alignItems:'flex-start' }}><span style={{ fontSize:13, flexShrink:0 }}>📞</span><span style={{ fontSize:12, color:'var(--ink2)', lineHeight:1.5 }}>{org.contact}</span></div>}
          {org.email   && <div style={{ display:'flex', gap:8, alignItems:'flex-start' }}><span style={{ fontSize:13, flexShrink:0 }}>✉</span><span style={{ fontSize:12, color:'var(--ink2)', lineHeight:1.5, wordBreak:'break-word' }}>{org.email}</span></div>}
          {org.website && <div style={{ display:'flex', gap:8, alignItems:'center' }}><span style={{ fontSize:13, flexShrink:0 }}>🌐</span><span style={{ fontSize:12, color:'var(--blue)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', maxWidth:200 }}>{org.website}</span></div>}
        </div>

        {/* Footer */}
        <div style={{ paddingTop:12, borderTop:'1px solid var(--border)', display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:8 }}>
          <span style={{ fontSize:11, color:'var(--ink3)', fontFamily:'JetBrains Mono,monospace' }}>Added {fmtDate(org.created_at)}</span>
          <div style={{ display:'flex', gap:6 }}>
            <button
              onClick={e => { e.stopPropagation(); onEdit(org) }} title="Edit"
              style={{ width:30, height:30, borderRadius:7, border:'1px solid var(--border)', background:'var(--blue-s)', color:'var(--blue)', cursor:'pointer', fontSize:14 }}>✏</button>
            <button
              onClick={e => { e.stopPropagation(); onDelete(org.id) }} title="Delete"
              style={{ width:30, height:30, borderRadius:7, border:'1px solid var(--border)', background:'var(--red-s)', color:'var(--red)', cursor:'pointer', fontSize:14 }}>🗑</button>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ── Slide-in View Panel ──────────────────────────────────────── */
function OrgViewPanel({ org, onClose, onEdit, onDelete }) {
  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.45)', zIndex:1000, backdropFilter:'blur(3px)', WebkitBackdropFilter:'blur(3px)', animation:'ovl-in .18s ease' }}
      />

      {/* Drawer */}
      <div style={{
        position:'fixed', top:0, right:0, bottom:0, width:'100%', maxWidth:460,
        background:'var(--paper)', zIndex:1001, overflowY:'auto',
        boxShadow:'-8px 0 48px rgba(0,0,0,.18)',
        animation:'drw-in .22s cubic-bezier(.22,1,.36,1)',
        display:'flex', flexDirection:'column',
      }}>
        <style>{`
          @keyframes ovl-in { from{opacity:0} to{opacity:1} }
          @keyframes drw-in { from{transform:translateX(100%)} to{transform:translateX(0)} }
          .ovp-scroll::-webkit-scrollbar{width:5px}
          .ovp-scroll::-webkit-scrollbar-track{background:transparent}
          .ovp-scroll::-webkit-scrollbar-thumb{background:var(--border2);border-radius:99px}
        `}</style>

        {/* ── Gradient header ── */}
        <div style={{ background:'linear-gradient(135deg,var(--blue) 0%,#7c5cfc 100%)', padding:'24px 20px 22px', flexShrink:0 }}>
          {/* Top bar: close + action buttons */}
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
            <button onClick={onClose}
              style={{ background:'rgba(255,255,255,.18)', border:'none', color:'#fff', borderRadius:8, width:34, height:34, cursor:'pointer', fontSize:17, display:'flex', alignItems:'center', justifyContent:'center' }}>
              ✕
            </button>
            <div style={{ display:'flex', gap:8 }}>
              <button onClick={() => onEdit(org)}
                style={{ display:'flex', alignItems:'center', gap:6, padding:'7px 16px', borderRadius:8, border:'1.5px solid rgba(255,255,255,.4)', background:'rgba(255,255,255,.15)', color:'#fff', cursor:'pointer', fontSize:13, fontWeight:700 }}
                onMouseEnter={e=>e.currentTarget.style.background='rgba(255,255,255,.28)'}
                onMouseLeave={e=>e.currentTarget.style.background='rgba(255,255,255,.15)'}>
                ✏ Edit
              </button>
              <button onClick={() => onDelete(org.id)}
                style={{ display:'flex', alignItems:'center', gap:6, padding:'7px 16px', borderRadius:8, border:'1.5px solid rgba(255,100,100,.5)', background:'rgba(220,38,38,.22)', color:'#fecaca', cursor:'pointer', fontSize:13, fontWeight:700 }}
                onMouseEnter={e=>e.currentTarget.style.background='rgba(220,38,38,.4)'}
                onMouseLeave={e=>e.currentTarget.style.background='rgba(220,38,38,.22)'}>
                🗑 Delete
              </button>
            </div>
          </div>

          {/* Logo + org name */}
          <div style={{ display:'flex', gap:16, alignItems:'center' }}>
            <div style={{ width:70, height:70, borderRadius:16, overflow:'hidden', background:'rgba(255,255,255,.2)', border:'2.5px solid rgba(255,255,255,.4)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
              {org.logo_url
                ? <img src={org.logo_url} style={{ width:'100%', height:'100%', objectFit:'cover' }} alt=""/>
                : <span style={{ fontFamily:'Outfit,sans-serif', fontWeight:900, fontSize:24, color:'#fff' }}>{org.name.slice(0,2).toUpperCase()}</span>
              }
            </div>
            <div style={{ flex:1, minWidth:0 }}>
              <h2 style={{ fontFamily:'Outfit,sans-serif', fontSize:21, fontWeight:900, color:'#fff', letterSpacing:-.4, margin:'0 0 8px', lineHeight:1.2, wordBreak:'break-word' }}>{org.name}</h2>
              <div style={{ display:'inline-flex', alignItems:'center', gap:6, padding:'4px 12px', borderRadius:20, background:'rgba(255,255,255,.2)', border:'1px solid rgba(255,255,255,.3)' }}>
                <span style={{ fontSize:13 }}>{ORG_ICONS[org.type]}</span>
                <span style={{ fontSize:12, fontWeight:700, color:'#fff' }}>{org.type}</span>
              </div>
            </div>
          </div>
        </div>

        {/* ── Scrollable body ── */}
        <div className="ovp-scroll" style={{ flex:1, overflowY:'auto', padding:'0 20px 32px' }}>

          {/* Date chip */}
          <div style={{ display:'flex', justifyContent:'flex-end', padding:'14px 0 6px' }}>
            <span style={{ fontSize:11, color:'var(--ink3)', fontFamily:'JetBrains Mono,monospace', background:'var(--paper2)', border:'1px solid var(--border)', borderRadius:6, padding:'3px 9px' }}>
              📅 Registered {fmtDate(org.created_at)}
            </span>
          </div>

          {/* Detail rows */}
          <div>
            <InfoRow icon="📍" label="Address"        value={org.address} />
            <InfoRow icon="📞" label="Contact Number" value={org.contact} />
            <InfoRow icon="✉"  label="Email Address"  value={org.email}   />
            <InfoRow icon="🌐" label="Website"        value={org.website} isLink />
          </div>

          {!org.address && !org.contact && !org.email && !org.website && (
            <div style={{ textAlign:'center', padding:'36px 0', color:'var(--ink3)', fontSize:13 }}>
              No additional contact details added.
            </div>
          )}

          {/* Tip banner */}
          <div style={{ marginTop:22, padding:'12px 14px', background:'var(--blue-s)', borderRadius:10, border:'1px solid rgba(35,82,255,.2)', fontSize:13, color:'var(--blue)', fontWeight:600, display:'flex', gap:10, alignItems:'flex-start' }}>
            <span style={{ fontSize:16, flexShrink:0 }}>💡</span>
            <div>
              <div style={{ marginBottom:3 }}>Used on ID Cards</div>
              <div style={{ fontSize:12, fontWeight:400, color:'var(--ink2)' }}>This organization's name and logo appear on all generated ID cards for this institution.</div>
            </div>
          </div>

          {/* Bottom action buttons */}
          <div style={{ display:'flex', gap:10, marginTop:24 }}>
            <button onClick={() => onEdit(org)}
              style={{ flex:1, padding:'12px', borderRadius:10, border:'1.5px solid var(--blue)', background:'var(--blue-s)', color:'var(--blue)', fontSize:14, fontWeight:700, cursor:'pointer', fontFamily:'inherit', transition:'all .18s' }}
              onMouseEnter={e=>{e.currentTarget.style.background='var(--blue)';e.currentTarget.style.color='#fff'}}
              onMouseLeave={e=>{e.currentTarget.style.background='var(--blue-s)';e.currentTarget.style.color='var(--blue)'}}>
              ✏ Edit Organization
            </button>
            <button onClick={() => onDelete(org.id)}
              style={{ flex:1, padding:'12px', borderRadius:10, border:'1.5px solid var(--red)', background:'var(--red-s)', color:'var(--red)', fontSize:14, fontWeight:700, cursor:'pointer', fontFamily:'inherit', transition:'all .18s' }}
              onMouseEnter={e=>{e.currentTarget.style.background='var(--red)';e.currentTarget.style.color='#fff'}}
              onMouseLeave={e=>{e.currentTarget.style.background='var(--red-s)';e.currentTarget.style.color='var(--red)'}}>
              🗑 Delete
            </button>
          </div>
        </div>
      </div>
    </>
  )
}

const CLASS_SECTIONS_APPLICABLE = ['School', 'College']

function ClassesConfig({ value = [], onChange }) {
  // value = [{ name: '1', sections: ['A','B','C'] }, ...]
  const addClass = () => {
    onChange([...value, { name: '', sections: ['A'] }])
  }
  const removeClass = (ci) => {
    onChange(value.filter((_, i) => i !== ci))
  }
  const updateClassName = (ci, name) => {
    onChange(value.map((c, i) => i === ci ? { ...c, name } : c))
  }
  const addSection = (ci) => {
    onChange(value.map((c, i) => i === ci ? { ...c, sections: [...c.sections, ''] } : c))
  }
  const removeSection = (ci, si) => {
    onChange(value.map((c, i) => i === ci ? { ...c, sections: c.sections.filter((_, j) => j !== si) } : c))
  }
  const updateSection = (ci, si, val) => {
    onChange(value.map((c, i) => i === ci ? { ...c, sections: c.sections.map((s, j) => j === si ? val : s) } : c))
  }

  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
        <DLabel>Classes & Sections</DLabel>
        <button onClick={addClass}
          style={{ padding:'5px 12px', borderRadius:7, border:'1.5px solid var(--blue)', background:'var(--blue-s)', color:'var(--blue)', cursor:'pointer', fontSize:12, fontWeight:700 }}>
          + Add Class
        </button>
      </div>

      {value.length === 0 ? (
        <div style={{ textAlign:'center', padding:'20px', background:'var(--paper2)', borderRadius:10, border:'1px dashed var(--border2)', color:'var(--ink3)', fontSize:13 }}>
          No classes added yet. Click "+ Add Class" to start.
        </div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          {value.map((cls, ci) => (
            <div key={ci} style={{ background:'var(--paper2)', borderRadius:10, border:'1px solid var(--border)', padding:14 }}>
              {/* Class name row */}
              <div style={{ display:'flex', gap:8, alignItems:'center', marginBottom:10 }}>
                <span style={{ fontSize:16 }}>🏫</span>
                <input
                  value={cls.name}
                  onChange={e => updateClassName(ci, e.target.value)}
                  placeholder="Class name (e.g. 1, 2, 10, LKG...)"
                  style={{ ...dInput(false), flex:1 }}
                  onFocus={onFocusDark} onBlur={e => onBlurDark(e, false)}
                />
                <button onClick={() => removeClass(ci)}
                  style={{ width:32, height:32, borderRadius:7, border:'1px solid var(--border)', background:'var(--red-s)', color:'var(--red)', cursor:'pointer', fontSize:14, flexShrink:0 }}>
                  🗑
                </button>
              </div>

              {/* Sections */}
              <div style={{ paddingLeft:24 }}>
                <div style={{ fontSize:11, fontWeight:600, color:'var(--ink3)', marginBottom:6 }}>Sections:</div>
                <div style={{ display:'flex', flexWrap:'wrap', gap:6, alignItems:'center' }}>
                  {cls.sections.map((sec, si) => (
                    <div key={si} style={{ display:'flex', alignItems:'center', gap:4, background:'var(--paper)', borderRadius:6, border:'1px solid var(--border)', padding:'4px 8px' }}>
                      <input
                        value={sec}
                        onChange={e => updateSection(ci, si, e.target.value)}
                        placeholder="A"
                        style={{ width:48, border:'none', outline:'none', background:'transparent', fontSize:13, fontWeight:700, color:'var(--blue)', textAlign:'center', fontFamily:'inherit' }}
                      />
                      {cls.sections.length > 1 && (
                        <button onClick={() => removeSection(ci, si)}
                          style={{ border:'none', background:'transparent', color:'var(--red)', cursor:'pointer', fontSize:12, padding:0, lineHeight:1 }}>✕</button>
                      )}
                    </div>
                  ))}
                  <button onClick={() => addSection(ci)}
                    style={{ padding:'4px 10px', borderRadius:6, border:'1.5px dashed var(--border2)', background:'transparent', color:'var(--ink3)', cursor:'pointer', fontSize:12, fontWeight:600 }}>
                    + Section
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <p style={{ fontSize:11, color:'var(--ink3)', marginTop:8 }}>
        💡 Students will see these as dropdowns in the form. Class → Section auto-filters.
      </p>
    </div>
  )
}
/* ── Main Component ───────────────────────────────────────────── */
export default function Organizations() {
  const { organizations, loading, createOrganization, updateOrganization, deleteOrganization } = useOrganizations()

  const [view,        setView]        = useState('list')
  const [viewOrg,     setViewOrg]     = useState(null)   // org shown in side panel
  const [editOrg,     setEditOrg]     = useState(null)
  const [form,        setForm]        = useState(EMPTY_FORM)
  const [errors,      setErrors]      = useState({})
  const [logoFile,    setLogoFile]    = useState(null)
  const [logoPreview, setLogoPreview] = useState(null)
  const [logoRemoved, setLogoRemoved] = useState(false)
  const [saving,      setSaving]      = useState(false)
  const [deleteId,    setDeleteId]    = useState(null)
  const [filterType,  setFilterType]  = useState('All')
  const logoRef = useRef()

  const set = (k,v) => { setForm(p=>({...p,[k]:v})); if(errors[k]) setErrors(p=>({...p,[k]:''})) }

  const handleLogo = e => {
    const file = e.target.files?.[0]; if(!file) return
    if(file.size > 2*1024*1024) { toast.error('Logo too large. Max 2MB.'); return }
    setLogoFile(file)
    setLogoRemoved(false)
    const r = new FileReader(); r.onload = ev => setLogoPreview(ev.target.result); r.readAsDataURL(file)
    e.target.value = ''
  }

  const validate = () => {
    const e = {}
    if(!form.name.trim())    e.name    = 'Organization name is required'
    if(!form.type)           e.type    = 'Organization type is required'
    if(!form.address.trim()) e.address = 'Full address is required'
    if(form.contact && !/^\+?[\d\s\-]{7,15}$/.test(form.contact)) e.contact = 'Enter a valid contact number'
    if(form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = 'Enter a valid email'
    setErrors(e); return Object.keys(e).length === 0
  }

  const resetForm = () => {
    setForm(EMPTY_FORM); setErrors({}); setLogoFile(null); setLogoPreview(null)
    setLogoRemoved(false); setEditOrg(null); setView('list')
  }

  const handleSave = async () => {
    if(!validate()) return
    setSaving(true)
    try {
      await createOrganization(form, logoFile)
      toast.success(`${form.name} added successfully! 🎉`)
      resetForm()
    } catch(err) { toast.error(err.message || 'Failed to save') }
    finally { setSaving(false) }
  }

  const handleUpdate = async () => {
    if(!form.name.trim()) { setErrors({name:'Name is required'}); return }
    setSaving(true)
    try {
      await updateOrganization(editOrg.id, form, logoFile, logoRemoved)
      toast.success('Organization updated!')
      resetForm()
    } catch(err) { toast.error(err.message || 'Failed to update') }
    finally { setSaving(false) }
  }

  /* Panel helpers — always close panel before navigating away */
  const openView   = org => setViewOrg(org)
  const closeView  = ()  => setViewOrg(null)

  const openEdit = org => {
    setViewOrg(null)
    setEditOrg(org)
    setForm({ 
      name:org.name||'', type:org.type||'School', address:org.address||'', 
      contact:org.contact||'', email:org.email||'', website:org.website||'',
      classes_config: org.classes_config || [] 
    })
    setErrors({}); setLogoFile(null); setLogoPreview(org.logo_url||null); setLogoRemoved(false)
    setView('edit')
  }

  const openDelete = id => {
    setViewOrg(null)
    setDeleteId(id)
  }

  const filtered = filterType==='All' ? organizations : organizations.filter(o=>o.type===filterType)

  /* ── ADD / EDIT FORM ── */
  if(view==='add' || view==='edit') {
    const isEdit = view==='edit'
    return (
      <div style={{ minHeight:'100vh', background:'var(--paper2)', paddingTop:64, paddingBottom:60 }}>
        <style>{`
          .org-form-wrap { max-width: 860px; margin: 0 auto; padding: 40px 32px 0; }
          .org-form-grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 20px; }
          .org-form-title { font-size: 32px; }
          @media (max-width: 700px) {
            .org-form-wrap { padding: 20px 16px 0 !important; }
            .org-form-grid2 { grid-template-columns: 1fr !important; gap: 14px !important; margin-bottom: 14px !important; }
            .org-form-title { font-size: 24px !important; }
          }
        `}</style>

        <div className="org-form-wrap">
          <button onClick={resetForm}
            style={{ display:'flex', alignItems:'center', gap:8, fontSize:13, fontWeight:600, color:'var(--ink2)', background:'none', border:'none', cursor:'pointer', marginBottom:24, padding:0 }}>
            ← Back to Organizations
          </button>
          <h1 className="org-form-title" style={{ fontFamily:'Outfit,sans-serif', fontWeight:900, color:'var(--ink)', letterSpacing:-.8, marginBottom:6 }}>
            {isEdit ? 'Edit Organization' : 'Add New Organization'}
          </h1>
          <p style={{ fontSize:14, color:'var(--ink2)', marginBottom:28 }}>
            Set up a new school, college, company, or institution to manage ID cards.
          </p>

          <div style={{ background:'var(--paper)', border:'1px solid var(--border)', borderRadius:16, padding:24, marginBottom:20 }}>
            <div className="org-form-grid2">
              <DField label="Organization Name" value={form.name} onChange={e=>set('name',e.target.value)}
                placeholder="e.g. Springfield High School" required error={errors.name}/>
              <div>
                <DLabel required>Organization Type</DLabel>
                <select value={form.type} onChange={e=>set('type',e.target.value)}
                  style={{ ...dInput(!!errors.type), cursor:'pointer' }}
                  onFocus={onFocusDark} onBlur={e=>onBlurDark(e,!!errors.type)}>
                  {ORG_TYPES.map(t=><option key={t} value={t}>{ORG_ICONS[t]} {t}</option>)}
                </select>
                {errors.type && <p style={{ fontSize:11, color:'var(--red)', marginTop:4 }}>{errors.type}</p>}
              </div>
            </div>

            <div className="org-form-grid2">
              <DField label="Full Address" value={form.address} onChange={e=>set('address',e.target.value)}
                placeholder="123 Main St, City, State" required error={errors.address}/>
              <DField label="Contact Number" value={form.contact} onChange={e=>set('contact',e.target.value)}
                placeholder="+91-9999999999" error={errors.contact}/>
            </div>

            <div className="org-form-grid2">
              <DField label="Email Address" value={form.email} onChange={e=>set('email',e.target.value)}
                placeholder="contact@org.com" type="email" error={errors.email}/>
              <DField label="Website (Optional)" value={form.website} onChange={e=>set('website',e.target.value)}
                placeholder="https://www.org.com" error={errors.website}/>
            </div>

            {/* Logo upload */}
            <div style={{ marginBottom:20 }}>
              <DLabel>Organization Logo</DLabel>
              {!logoPreview ? (
                <div onClick={()=>logoRef.current?.click()}
                  style={{ border:'2px dashed var(--border2)', borderRadius:12, padding:'32px 20px', textAlign:'center', cursor:'pointer', transition:'all .2s' }}
                  onMouseEnter={e=>{e.currentTarget.style.borderColor='var(--blue)';e.currentTarget.style.background='var(--blue-s)'}}
                  onMouseLeave={e=>{e.currentTarget.style.borderColor='var(--border2)';e.currentTarget.style.background='transparent'}}>
                  <div style={{ fontSize:36, marginBottom:10, opacity:.7 }}>⬆</div>
                  <div style={{ fontSize:15, fontWeight:700, color:'var(--ink)', marginBottom:4 }}>Click to upload logo</div>
                  <div style={{ fontSize:12, color:'var(--ink2)' }}>PNG, JPG, WebP up to 2MB</div>
                  <input type="file" ref={logoRef} accept="image/jpeg,image/png,image/webp" onChange={handleLogo} style={{ display:'none' }}/>
                </div>
              ) : (
                <div style={{ display:'flex', gap:14, alignItems:'center', padding:'14px 16px', background:'var(--paper2)', borderRadius:12, border:'1px solid var(--border)', flexWrap:'wrap' }}>
                  <img src={logoPreview} style={{ width:56, height:56, objectFit:'cover', borderRadius:10, border:'2px solid var(--blue)', flexShrink:0 }} alt=""/>
                  <div style={{ flex:1, minWidth:120 }}>
                    <div style={{ fontSize:13, fontWeight:700, color:'var(--ink)' }}>Logo uploaded ✓</div>
                    <div style={{ fontSize:12, color:'var(--ink2)', marginTop:3 }}>Will appear on the ID card header</div>
                  </div>
                  <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                    <button onClick={()=>logoRef.current?.click()} style={{ padding:'6px 12px', borderRadius:7, border:'1px solid var(--border)', background:'var(--paper2)', color:'var(--ink2)', cursor:'pointer', fontSize:12, fontWeight:600 }}>🔄 Change</button>
                    <button onClick={()=>{setLogoFile(null);setLogoPreview(null);setLogoRemoved(true)}} style={{ padding:'6px 12px', borderRadius:7, border:'1px solid var(--border)', background:'var(--red-s)', color:'var(--red)', cursor:'pointer', fontSize:12, fontWeight:600 }}>🗑 Remove</button>
                  </div>
                  <input type="file" ref={logoRef} accept="image/jpeg,image/png,image/webp" onChange={handleLogo} style={{ display:'none' }}/>
                </div>
              )}
            </div>


            {/* Classes & Sections — only for School / College */}
            {CLASS_SECTIONS_APPLICABLE.includes(form.type) && (
              <div style={{ marginBottom:20 }}>
                <ClassesConfig
                  value={form.classes_config || []}
                  onChange={val => set('classes_config', val)}
                />
              </div>
            )}

            <div style={{ padding:'12px 14px', background:'var(--blue-s)', borderRadius:10, border:'1px solid rgba(35,82,255,.2)', fontSize:13, color:'var(--blue)', fontWeight:600, display:'flex', gap:10, alignItems:'flex-start' }}>
              <span style={{ fontSize:16, flexShrink:0 }}>💡</span>
              <div>
                <div style={{ marginBottom:3 }}>Default ID Card Format</div>
                <div style={{ fontSize:12, fontWeight:400, color:'var(--ink2)' }}>The organization name and logo will appear on all generated ID cards for this institution.</div>
              </div>
            </div>
          </div>

          <div style={{ display:'flex', gap:12 }}>
            <button onClick={resetForm}
              style={{ flex:1, padding:'13px', borderRadius:10, border:'1.5px solid var(--border)', background:'transparent', color:'var(--ink2)', fontSize:14, fontWeight:700, cursor:'pointer', transition:'all .18s', fontFamily:'inherit' }}
              onMouseEnter={e=>{e.currentTarget.style.borderColor='var(--border2)';e.currentTarget.style.background='var(--paper2)'}}
              onMouseLeave={e=>{e.currentTarget.style.borderColor='var(--border)';e.currentTarget.style.background='transparent'}}>
              Cancel
            </button>
            <button onClick={isEdit ? handleUpdate : handleSave} disabled={saving}
              style={{ flex:2, padding:'13px', borderRadius:10, border:'none', background:saving?'var(--border)':'var(--blue)', color:'#fff', fontSize:14, fontWeight:700, cursor:saving?'not-allowed':'pointer', transition:'all .18s', fontFamily:'inherit', opacity:saving?.7:1 }}
              onMouseEnter={e=>{if(!saving)e.currentTarget.style.background='var(--blue-d)'}}
              onMouseLeave={e=>{if(!saving)e.currentTarget.style.background='var(--blue)'}}>
              {saving ? '⏳ Saving...' : isEdit ? '✓ Update Organization' : '✓ Save Organization'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  /* ── LIST PAGE ── */
  if(loading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'80vh', background:'var(--paper2)' }}>
      <Spinner size={36}/>
    </div>
  )

  return (
    <div style={{ minHeight:'100vh', background:'var(--paper2)', paddingTop:64 }}>
      <style>{`
        .org-list-wrap { max-width: 1200px; margin: 0 auto; padding: 40px 32px; }
        .org-stats-grid { display: grid; grid-template-columns: repeat(6,1fr); gap: 12px; margin-bottom: 28px; }
        .org-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 28px; }
        @media (max-width: 900px) { .org-stats-grid { grid-template-columns: repeat(3,1fr) !important; } }
        @media (max-width: 600px) {
          .org-list-wrap { padding: 20px 14px !important; }
          .org-stats-grid { grid-template-columns: repeat(2,1fr) !important; gap: 8px !important; }
          .org-header { flex-direction: column !important; gap: 14px !important; }
          .org-header button { width: 100% !important; justify-content: center !important; }
        }
      `}</style>

      <div className="org-list-wrap">
        {/* Header */}
        <div className="org-header">
          <div>
            <h1 style={{ fontFamily:'Outfit,sans-serif', fontSize:28, fontWeight:900, color:'var(--ink)', letterSpacing:-.5 }}>Organizations</h1>
            <p style={{ fontSize:14, color:'var(--ink2)', marginTop:4 }}>{organizations.length} organizations registered</p>
          </div>
          <button onClick={()=>{setForm(EMPTY_FORM);setErrors({});setLogoFile(null);setLogoPreview(null);setView('add')}}
            style={{ padding:'10px 20px', borderRadius:10, border:'none', background:'var(--blue)', color:'#fff', fontSize:14, fontWeight:700, cursor:'pointer', fontFamily:'inherit', display:'flex', alignItems:'center', gap:8, flexShrink:0 }}
            onMouseEnter={e=>e.currentTarget.style.background='var(--blue-d)'}
            onMouseLeave={e=>e.currentTarget.style.background='var(--blue)'}>
            + Add Organization
          </button>
        </div>

        {/* Stats */}
        <div className="org-stats-grid">
          {ORG_TYPES.map(t => {
            const count = organizations.filter(o=>o.type===t).length
            const active = filterType===t
            return (
              <div key={t} onClick={()=>setFilterType(active?'All':t)}
                style={{ padding:'14px 10px', borderRadius:12, border:`1.5px solid ${active?'var(--blue)':'var(--border)'}`, background:active?'var(--blue-s)':'var(--paper)', cursor:'pointer', textAlign:'center', transition:'all .15s' }}>
                <div style={{ fontSize:20, marginBottom:5 }}>{ORG_ICONS[t]}</div>
                <div style={{ fontFamily:'Outfit,sans-serif', fontSize:20, fontWeight:900, color:active?'var(--blue)':'var(--ink)' }}>{count}</div>
                <div style={{ fontSize:11, fontWeight:600, color:'var(--ink2)', marginTop:2 }}>{t}</div>
              </div>
            )
          })}
        </div>

        {/* Filter pills */}
        <div style={{ display:'flex', gap:8, marginBottom:22, flexWrap:'wrap' }}>
          {['All',...ORG_TYPES].map(t => (
            <div key={t} onClick={()=>setFilterType(t)}
              style={{ padding:'6px 14px', borderRadius:20, border:`1.5px solid ${filterType===t?'var(--blue)':'var(--border)'}`, background:filterType===t?'var(--blue-s)':'var(--paper)', cursor:'pointer', fontSize:12, fontWeight:700, color:filterType===t?'var(--blue)':'var(--ink2)', display:'flex', alignItems:'center', gap:5, transition:'all .15s' }}>
              {t!=='All'&&<span>{ORG_ICONS[t]}</span>}
              <span>{t==='All'?'All Organizations':t}</span>
            </div>
          ))}
        </div>

        {/* Card grid */}
        {filtered.length===0 ? (
          <div style={{ textAlign:'center', padding:'56px 24px' }}>
            <div style={{ fontSize:56, marginBottom:16 }}>🏢</div>
            <h3 style={{ fontFamily:'Outfit,sans-serif', fontSize:20, fontWeight:700, color:'var(--ink)', marginBottom:8 }}>
              {filterType==='All' ? 'No organizations yet' : `No ${filterType} added yet`}
            </h3>
            <p style={{ fontSize:14, color:'var(--ink2)', marginBottom:24 }}>Add your first organization to get started.</p>
            <button onClick={()=>setView('add')}
              style={{ padding:'11px 24px', borderRadius:10, border:'none', background:'var(--blue)', color:'#fff', fontSize:14, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>
              + Add Organization
            </button>
          </div>
        ) : (
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))', gap:18 }}>
            {filtered.map(org => (
              <OrgCard key={org.id} org={org} onView={openView} onEdit={openEdit} onDelete={openDelete}/>
            ))}
          </div>
        )}
      </div>

      {/* View panel */}
      {viewOrg && (
        <OrgViewPanel org={viewOrg} onClose={closeView} onEdit={openEdit} onDelete={openDelete}/>
      )}

      <ConfirmDialog
        open={!!deleteId} onClose={()=>setDeleteId(null)}
        onConfirm={()=>deleteOrganization(deleteId)}
        title="Delete Organization"
        message="This will permanently delete this organization and its logo. This cannot be undone."
        confirmLabel="Delete" danger/>
    </div>
  )
}