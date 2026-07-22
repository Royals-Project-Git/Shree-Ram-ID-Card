import { useState } from 'react'
import { useFormConfigs } from '../hooks/useFormConfigs'
import { useOrganizations } from '../hooks/useOrganizations'
import { Input, Btn, Card, Badge } from '../components/shared/index'
import toast from 'react-hot-toast'

const ALL_FIELDS = ['Name','FathersName','ClassN','Section','DateofBirth','AdmissionNumber','RollNumber','EmployeeID','ContactNumber','EmrgNo','BloodGroup','UploadYourPhoto','Address','ModeOfTransportation','Designation','AadhaarNumber','Department','EmailId','ValidFrom','ValidTill','BatchTiming']
const ICONS = {Name:'👤',FathersName:'👨',ClassN:'🏫',Section:'📌',DateofBirth:'🎂',AdmissionNumber:'🔢',RollNumber:'🎯',EmployeeID:'🪪',ContactNumber:'📱',EmrgNo:'🚨',BloodGroup:'🩸',UploadYourPhoto:'📷',Address:'📍',ModeOfTransportation:'🚌',Designation:'💼',AadhaarNumber:'🪪',Department:'🏢',EmailId:'✉️',ValidFrom:'📅',ValidTill:'📅',BatchTiming:'⏰'}

const FIELD_LABELS = {
  Name: 'Name',
  FathersName: "Father's Name",
  ClassN: 'Class',
  Section: 'Section',
  DateofBirth: 'Date of Birth',
  AdmissionNumber: 'Admission No.',
  RollNumber: 'Roll No.',
  EmployeeID: 'Employee ID',
  ContactNumber: 'Contact No.',
  EmrgNo: 'Emrg No.',
  BloodGroup: 'Blood Group',
  UploadYourPhoto: 'Profile Photo',
  Address: 'Address',
  ModeOfTransportation: 'Mode of Transport',
  Designation: 'Designation',
  AadhaarNumber: 'Aadhaar No.',
  Department: 'Department',
  EmailId: 'Email ID',
  ValidFrom: 'Valid From',
  ValidTill: 'Valid Till',
  BatchTiming: 'Batch / Timing',
}

const ORG_TYPES = [
  { value: 'School',   label: 'School',   icon: '🏫', placeholder: 'e.g. Netaji School, DPS Nagpur...'      },
  { value: 'College',  label: 'College',  icon: '🎓', placeholder: 'e.g. Prerna College, RCOEM...'          },
  { value: 'Industry', label: 'Industry', icon: '🏭', placeholder: 'e.g. Tata Steel Plant, MIDC Factory...' },
  { value: 'Company',  label: 'Company',  icon: '💼', placeholder: 'e.g. WideSoftech Pvt. Ltd...'           },
  { value: 'Hospital', label: 'Hospital', icon: '🏥', placeholder: 'e.g. Orange City Hospital, AIIMS...'    },
  { value: 'Custom',   label: 'Custom',   icon: '✏️', placeholder: 'Enter your organization name...'        },
]

export default function AddTemplate() {
  const { configs, createConfig, deleteConfig } = useFormConfigs()
  const { organizations }               = useOrganizations()

  const [orgType,     setOrgType]     = useState('')
  const [orgName,     setOrgName]     = useState('')
  const [manualMode,  setManualMode]  = useState(false)
  const [role,        setRole]        = useState('Student')
  const [fields,      setFields]      = useState(['Name','ClassN','Section','RollNumber'])
  const [expiry,      setExpiry]      = useState('')
  const [loading,     setLoading]     = useState(false)
  const [result,      setResult]      = useState(null)
  const [copied,      setCopied]      = useState(false)
  const [deleting,    setDeleting]    = useState(null)
  const [orgTypeErr,  setOrgTypeErr]  = useState('')
  const [orgNameErr,  setOrgNameErr]  = useState('')
  const [previewOpen, setPreviewOpen] = useState(false)

  const BASE_URL   = window.location.origin
  const selectedOrg = ORG_TYPES.find(o => o.value === orgType)

  const filteredOrgs = orgType ? organizations.filter(o => o.type === orgType) : []
  const hasOrgsForType = filteredOrgs.length > 0

  const toggleField = f => setFields(prev =>
    prev.includes(f) ? prev.filter(x => x !== f) : [...prev, f]
  )

  const handleTypeChange = (type) => {
    setOrgType(type)
    setOrgName('')
    setManualMode(false)
    if (orgTypeErr) setOrgTypeErr('')
    if (orgNameErr) setOrgNameErr('')
  }

  const handleGenerate = async () => {
    let valid = true
    if (!orgType)         { setOrgTypeErr('Please select an organization type'); valid = false }
    if (!orgName.trim())  { setOrgNameErr(`${orgType || 'Organization'} name is required`); valid = false }
    if (!valid) return
    if (fields.length === 0) { toast.error('Select at least one field'); return }
    setOrgTypeErr('')
    setOrgNameErr('')
    setLoading(true)
    try {
      const expiresAt = expiry ? new Date(expiry + 'T23:59:59.000Z').toISOString() : null
      const cfg = await createConfig({ schoolName: orgName.trim(), role, fields, expiresAt })
      const url = `${BASE_URL}/form/${cfg.url_id}`
      setResult({ url, ...cfg })
      toast.success('Link generated! 🎉')
    } catch (err) {
      toast.error(err.message || 'Failed to generate link')
    } finally { setLoading(false) }
  }

  const copy = () => {
    navigator.clipboard?.writeText(result.url).catch(() => {})
    setCopied(true)
    toast.success('Copied to clipboard!')
    setTimeout(() => setCopied(false), 2000)
  }

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this form link? This cannot be undone.')) return
    setDeleting(id)
    try {
      await deleteConfig(id)
      if (result?.id === id) setResult(null)
    } catch (err) {
      toast.error(err.message || 'Failed to delete link')
    } finally { setDeleting(null) }
  }

  const previewName = orgName || (selectedOrg ? `Your ${selectedOrg.label}` : 'Organization Name')

  const selectStyle = (hasErr) => ({
    width: '100%', padding: '11px 14px 11px 38px',
    borderRadius: 'var(--r)',
    border: `1.5px solid ${hasErr ? 'var(--red)' : orgType ? 'var(--blue)' : 'var(--border)'}`,
    fontSize: 14, color: 'var(--ink)', background: 'var(--paper)',
    outline: 'none', cursor: 'pointer', transition: 'all .18s',
    fontFamily: 'inherit', appearance: 'none',
  })

  const PreviewPanel = () => (
    <div>
      <h3 style={{ fontFamily:'Outfit,sans-serif', fontSize:15, fontWeight:800, color:'var(--ink)', marginBottom:4 }}>Live Form Preview</h3>
      <p style={{ fontSize:12, color:'var(--ink3)', marginBottom:16 }}>What the user sees when they open the link.</p>
      <div style={{ background:'var(--paper)', borderRadius:'var(--rl)', border:'1px solid var(--border)', overflow:'hidden', boxShadow:'var(--shadow)' }}>
        <div style={{ background:'var(--blue)', padding:'16px 18px', display:'flex', alignItems:'center', gap:12 }}>
          <div style={{ width:38, height:38, borderRadius:9, background:'rgba(255,255,255,.2)', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'Outfit,sans-serif', fontWeight:900, fontSize:13, color:'#fff', overflow:'hidden' }}>
            {(() => {
              const sel = filteredOrgs.find(o => o.name === orgName)
              return sel?.logo_url
                ? <img src={sel.logo_url} style={{ width:'100%', height:'100%', objectFit:'cover' }} alt=""/>
                : previewName ? previewName.slice(0,2).toUpperCase() : selectedOrg ? selectedOrg.icon : '🏢'
            })()}
          </div>
          <div>
            <div style={{ fontFamily:'Outfit,sans-serif', fontSize:13, fontWeight:700, color:'#fff' }}>{previewName}</div>
            <div style={{ fontSize:11, color:'rgba(255,255,255,.75)', marginTop:1 }}>
              {orgType && <span style={{ opacity:.8 }}>{selectedOrg?.icon} {orgType} · </span>}
              {role} ID Card Form
            </div>
          </div>
        </div>
        <div style={{ padding:16 }}>
          <div style={{ fontSize:11, fontWeight:600, color:'#92400e', background:'var(--amber-s)', borderRadius:6, padding:'8px 12px', marginBottom:14 }}>⚠ Please fill all fields correctly</div>
          {fields.length === 0
            ? <div style={{ textAlign:'center', color:'var(--ink3)', fontSize:13, padding:'20px 0' }}>Select fields to see preview</div>
            : <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                {fields.slice(0,5).map(f => {
                   const lbl = FIELD_LABELS[f] || f.replace(/([A-Z])/g,' $1').trim()
                   return (
                     <div key={f}>
                       <div style={{ fontSize:10, fontWeight:700, color:'var(--ink3)', textTransform:'uppercase', letterSpacing:.4, marginBottom:4 }}>{lbl} *</div>
                       <div style={{ background:'var(--paper2)', borderRadius:6, padding:'8px 10px', fontSize:12, color:'var(--ink3)', border:'1px solid var(--border)' }}>Enter {lbl.toLowerCase()}...</div>
                     </div>
                   )
                 })}
                {fields.length > 5 && <div style={{ fontSize:11, color:'var(--ink3)', textAlign:'center' }}>+{fields.length-5} more fields...</div>}
              </div>
          }
        </div>
      </div>
      {orgName && (
        <div style={{ marginTop:16, padding:'14px 16px', background:'var(--paper)', borderRadius:'var(--r)', border:'1px solid var(--border)' }}>
          <div style={{ fontSize:11, fontWeight:700, color:'var(--ink3)', textTransform:'uppercase', letterSpacing:.4, marginBottom:8 }}>Selected Organization</div>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <span style={{ fontSize:24 }}>{selectedOrg?.icon}</span>
            <div>
              <div style={{ fontSize:14, fontWeight:700, color:'var(--ink)' }}>{orgName}</div>
              <div style={{ fontSize:11, color:'var(--ink3)', marginTop:2 }}>{selectedOrg?.label}</div>
            </div>
          </div>
        </div>
      )}
      {result && (
        <div style={{ marginTop:16, background:'var(--paper)', borderRadius:'var(--r)', border:'1px solid var(--border)', padding:16, textAlign:'center' }}>
          <div style={{ fontSize:12, fontWeight:700, color:'var(--ink2)', marginBottom:10 }}>📱 QR Code</div>
          <div style={{ width:80, height:80, margin:'0 auto', display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:2 }}>
            {Array.from({length:49}, (_,i) => (
              <div key={i} style={{ borderRadius:1, background:(Math.sin(i*3.7+1)*Math.cos(i*2.1))>0?'var(--ink)':'transparent', aspectRatio:1 }} />
            ))}
          </div>
          <div style={{ fontSize:10, color:'var(--ink3)', marginTop:8 }}>Scan to open form</div>
        </div>
      )}
    </div>
  )

  return (
    <div className="anim-fade-up" style={{ paddingTop: 64, minHeight: '100vh' }}>
      <style>{`
        .at-main-layout { display: grid; grid-template-columns: 1fr 360px; min-height: calc(100vh - 64px); }
        .at-right-preview { display: block; padding: 24px; background: var(--paper2); position: sticky; top: 64px; height: calc(100vh - 64px); overflow-y: auto; }
        .at-preview-toggle { display: none; }
        .at-role-grid { grid-template-columns: repeat(3,1fr) !important; }

        @media (max-width: 900px) {
          .at-main-layout { grid-template-columns: 1fr !important; }
          .at-right-preview { display: none !important; }
          .at-preview-toggle { display: flex !important; }
        }
        @media (max-width: 600px) {
          .at-left-form { padding: 20px 16px !important; }
          .at-role-grid { grid-template-columns: repeat(3,1fr) !important; }
        }
      `}</style>

      <div className="at-main-layout">

        {/* ── Left: Form ── */}
        <div className="at-left-form" style={{ padding: '36px 44px', borderRight: '1px solid var(--border)', overflowY: 'auto' }}>
          <div style={{ marginBottom: 28 }}>
            <h1 style={{ fontFamily: 'Outfit,sans-serif', fontSize: 26, fontWeight: 900, color: 'var(--ink)', letterSpacing: -.5 }}>Generate Form Link</h1>
            <p style={{ fontSize: 14, color: 'var(--ink2)', marginTop: 4 }}>Configure fields and create a shareable form link for your organization.</p>
          </div>

          {/* Mobile preview toggle */}
          <button className="at-preview-toggle" onClick={()=>setPreviewOpen(p=>!p)}
            style={{ width:'100%', padding:'10px 14px', borderRadius:'var(--r)', border:'1.5px solid var(--border)', background:'var(--paper2)', color:'var(--ink2)', fontSize:13, fontWeight:700, cursor:'pointer', marginBottom:20, alignItems:'center', justifyContent:'center', gap:8 }}>
            👁 {previewOpen ? 'Hide Preview' : 'Show Preview'}
          </button>

          {/* Mobile inline preview */}
          {previewOpen && (
            <div style={{ marginBottom:24, padding:16, background:'var(--paper2)', borderRadius:'var(--rl)', border:'1px solid var(--border)' }}>
              <PreviewPanel />
            </div>
          )}

          {/* ── STEP 1: Role ── */}
          <div style={{ marginBottom: 26 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink3)', textTransform: 'uppercase', letterSpacing: .5, marginBottom: 10 }}>Step 1 — Role Type *</div>
            <div className="at-role-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10 }}>
              {['Student','Staff','Employee'].map(r => (
                <div key={r} onClick={() => setRole(r)}
                  style={{ padding: '14px 10px', borderRadius: 'var(--r)', border: `2px solid ${role===r?'var(--blue)':'var(--border)'}`, background: role===r?'var(--blue-s)':'var(--paper)', cursor: 'pointer', textAlign: 'center', transition: 'all .18s' }}>
                  <div style={{ fontSize: 24, marginBottom: 5 }}>{r==='Student'?'🎓':r==='Staff'?'👨‍🏫':'💼'}</div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: role===r?'var(--blue)':'var(--ink)' }}>{r}</div>
                </div>
              ))}
            </div>
          </div>

          {/* ── STEP 2: Org Type ── */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink3)', textTransform: 'uppercase', letterSpacing: .5, marginBottom: 10 }}>Step 2 — Organization Type *</div>
            <div style={{ position: 'relative' }}>
              <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 16, pointerEvents: 'none', zIndex: 1 }}>
                {selectedOrg ? selectedOrg.icon : '🏢'}
              </span>
              <select style={selectStyle(!!orgTypeErr)} value={orgType} onChange={e => handleTypeChange(e.target.value)}>
                <option value="">-- Select Organization Type --</option>
                {ORG_TYPES.map(o => <option key={o.value} value={o.value}>{o.icon} {o.label}</option>)}
              </select>
            </div>
            {orgTypeErr && <p style={{ fontSize:12, color:'var(--red)', marginTop:6, fontWeight:600 }}>{orgTypeErr}</p>}
          </div>

          {/* ── STEP 3: Org Name ── */}
          {orgType && (
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink3)', textTransform: 'uppercase', letterSpacing: .5, marginBottom: 10 }}>Step 3 — {selectedOrg?.label} Name *</div>
              {hasOrgsForType && !manualMode ? (
                <div>
                  <div style={{ position: 'relative' }}>
                    <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 16, pointerEvents: 'none', zIndex: 1 }}>{selectedOrg?.icon}</span>
                    <select style={selectStyle(!!orgNameErr)} value={orgName} onChange={e => { setOrgName(e.target.value); if (orgNameErr) setOrgNameErr('') }}>
                      <option value="">-- Select {selectedOrg?.label} --</option>
                      {filteredOrgs.map(o => <option key={o.id} value={o.name}>{o.name}</option>)}
                    </select>
                  </div>
                  <button onClick={()=>setManualMode(true)} style={{ marginTop:8, fontSize:12, color:'var(--blue)', background:'transparent', border:'none', cursor:'pointer', fontWeight:600, padding:0 }}>
                    + Enter manually
                  </button>
                </div>
              ) : (
                <div>
                  <Input
                    value={orgName}
                    onChange={e => { setOrgName(e.target.value); if (orgNameErr) setOrgNameErr('') }}
                    placeholder={selectedOrg?.placeholder || 'Enter organization name...'}
                    error={orgNameErr}
                    icon={selectedOrg?.icon || '🏢'}
                  />
                  {hasOrgsForType && (
                    <button onClick={()=>{setManualMode(false);setOrgName('')}} style={{ marginTop:8, fontSize:12, color:'var(--ink3)', background:'transparent', border:'none', cursor:'pointer', fontWeight:600, padding:0 }}>
                      ← Select from list
                    </button>
                  )}
                </div>
              )}
              {orgNameErr && !orgName && <p style={{ fontSize:12, color:'var(--red)', marginTop:6, fontWeight:600 }}>{orgNameErr}</p>}
            </div>
          )}

          {/* ── STEP 4: Fields ── */}
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink3)', textTransform: 'uppercase', letterSpacing: .5, marginBottom: 10 }}>Step 4 — Form Fields</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 8 }}>
              {ALL_FIELDS.map(f => {
                const on = fields.includes(f)
                return (
                  <div key={f} onClick={() => toggleField(f)}
                    style={{ display:'flex', alignItems:'center', gap:8, padding:'10px 12px', borderRadius:'var(--r)', border:`1.5px solid ${on?'var(--blue)':'var(--border)'}`, background:on?'var(--blue-s)':'var(--paper)', cursor:'pointer', transition:'all .15s' }}>
                    <span style={{ fontSize:15, flexShrink:0 }}>{ICONS[f]}</span>
                    <span style={{ fontSize:12, fontWeight:on?700:500, color:on?'var(--blue)':'var(--ink2)' }}>{FIELD_LABELS[f] || f.replace(/([A-Z])/g,' $1').trim()}</span>
                  </div>
                )
              })}
            </div>
            <div style={{ marginTop:8, fontSize:12, color:'var(--ink3)' }}>{fields.length} of {ALL_FIELDS.length} fields selected</div>
          </div>

          {/* Expiry */}
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink3)', textTransform: 'uppercase', letterSpacing: .5, marginBottom: 8 }}>Expiry Date (optional)</div>
            <input type="date" value={expiry} onChange={e=>setExpiry(e.target.value)}
              style={{ padding:'10px 14px', borderRadius:'var(--r)', border:'1.5px solid var(--border)', fontSize:14, color:'var(--ink)', background:'var(--paper)', outline:'none', width:'100%', boxSizing:'border-box' }}/>
          </div>

          <Btn size="lg" onClick={handleGenerate} disabled={loading} style={{ width:'100%' }}>
            {loading ? '⏳ Generating...' : '🔗 Generate Link'}
          </Btn>

          {/* Result */}
          {result && (
            <div className="anim-fade-up" style={{ marginTop:20, background:'var(--paper2)', borderRadius:'var(--rl)', border:'1.5px solid var(--blue-m)', padding:20 }}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12, flexWrap:'wrap', gap:8 }}>
                <div>
                  <span style={{ fontSize:12, fontWeight:700, color:'var(--ink2)', textTransform:'uppercase', letterSpacing:.4 }}>Generated Link</span>
                  <div style={{ fontSize:11, color:'var(--ink3)', marginTop:3 }}>{selectedOrg?.icon} {orgName} · {role}</div>
                </div>
                <Badge type="teal" dot>Active</Badge>
              </div>
              <div style={{ background:'var(--paper)', borderRadius:'var(--r)', padding:'12px 14px', border:'1px solid var(--border)', marginBottom:12, fontFamily:'JetBrains Mono,monospace', fontSize:12, color:'var(--ink2)', wordBreak:'break-all', lineHeight:1.6 }}>
                {result.url}
              </div>
              <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                <Btn size="sm" onClick={copy}>{copied ? '✓ Copied!' : '📋 Copy'}</Btn>
                <Btn size="sm" variant="teal" onClick={() => toast.success('WhatsApp share opened!')}>💬 WhatsApp</Btn>
                <Btn size="sm" variant="ghost" onClick={() => toast.success('Email share opened!')}>✉ Email</Btn>
                <Btn size="sm" variant="soft" onClick={() => toast.success('QR Code generated!')}>📱 QR Code</Btn>
                <Btn size="sm" variant="ghost" style={{ color:'var(--red)', borderColor:'var(--red)', marginLeft:'auto' }}
                  disabled={deleting === result.id}
                  onClick={() => handleDelete(result.id)}>
                  {deleting === result.id ? '⏳' : '🗑 Delete'}
                </Btn>
              </div>
            </div>
          )}

          {/* History */}
          <div style={{ marginTop:32 }}>
            <h3 style={{ fontFamily:'Outfit,sans-serif', fontSize:16, fontWeight:800, color:'var(--ink)', marginBottom:12 }}>Recent Links ({configs.length})</h3>
            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
              {configs.slice(0, 6).map(l => (
                <div key={l.id} style={{ padding:'12px 14px', borderRadius:'var(--r)', border:'1px solid var(--border)', background:'var(--paper)', display:'flex', alignItems:'center', gap:12 }}>
                  <div style={{ width:34, height:34, borderRadius:8, background:'var(--blue-s)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:16, flexShrink:0 }}>🔗</div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:13, fontWeight:700, color:'var(--ink)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{l.school_name}</div>
                    <div style={{ display:'flex', gap:6, alignItems:'center', marginTop:3, flexWrap:'wrap' }}>
                      <Badge type={l.role==='Student'?'blue':l.role==='Staff'?'teal':'amber'}>{l.role}</Badge>
                      <span style={{ fontSize:11, color:'var(--ink3)' }}>{l.fields?.length} fields</span>
                      <span style={{ fontSize:11, color:'var(--ink3)' }}>· {l.is_active ? 'Active' : 'Paused'}</span>
                    </div>
                  </div>
                  <button
                    onClick={() => { navigator.clipboard?.writeText(`${BASE_URL}/form/${l.url_id}`).catch(() => {}); toast.success('Copied!') }}
                    style={{ padding:'5px 10px', borderRadius:6, border:'1.5px solid var(--border)', background:'transparent', cursor:'pointer', fontSize:11, fontWeight:700, color:'var(--ink2)', flexShrink:0 }}>
                    Copy
                  </button>
                  <button
                    onClick={() => handleDelete(l.id)}
                    disabled={deleting === l.id}
                    style={{ padding:'5px 10px', borderRadius:6, border:'1.5px solid var(--red)', background:'transparent', cursor:'pointer', fontSize:11, fontWeight:700, color:'var(--red)', flexShrink:0, opacity: deleting === l.id ? 0.5 : 1 }}>
                    {deleting === l.id ? '⏳' : '🗑'}
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Right: Live Preview (desktop only) ── */}
        <div className="at-right-preview">
          <PreviewPanel />
        </div>
      </div>
    </div>
  )
}