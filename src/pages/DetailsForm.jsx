import { useState, useRef, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useSubmissions } from '../hooks/useSubmissions'
import { formConfigsApi, organizationsApi } from '../lib/firestore'
import { Btn, Modal, Spinner } from '../components/shared/index'
import toast from 'react-hot-toast'
import Cropper from 'react-easy-crop'
import 'react-easy-crop/react-easy-crop.css'

/* ═══════════════════════════════════════════════════════════════
   MODULE-LEVEL CONSTANTS & HELPERS
═══════════════════════════════════════════════════════════════ */
const FIELD_META = {
  Name:                 { label:'Full Name',          icon:'👤', type:'text',     required:true  },
  FathersName:          { label:"Father's Name",      icon:'👨', type:'text',     required:false },
  ClassN:               { label:'Class',              icon:'🏫', type:'text',     required:false },
  Section:              { label:'Section',            icon:'📌', type:'text',     required:false },
  DateofBirth:          { label:'Date of Birth',      icon:'🎂', type:'date',     required:false },
  AdmissionNumber:      { label:'Admission Number',   icon:'🔢', type:'text',     required:false },
  RollNumber:           { label:'Roll Number',        icon:'🎯', type:'text',     required:false },
  EmployeeID:           { label:'Employee ID',        icon:'🪪', type:'text',     required:false },
  ContactNumber:        { label:'Contact Number',     icon:'📱', type:'tel',      required:false },
  EmergencyContact:     { label:'Emergency Contact',  icon:'🚨', type:'tel',      required:false },
  BloodGroup:           { label:'Blood Group',        icon:'🩸', type:'select',   required:false,
    options:['','A+','A-','B+','B-','AB+','AB-','O+','O-'] },
  Address:              { label:'Address',            icon:'📍', type:'textarea', required:false },
  ModeOfTransportation: { label:'Mode of Transport', icon:'🚌', type:'select',   required:false,
    options:['','School Bus','Auto Rickshaw','Private Vehicle','Walking','Bicycle','Public Transport'] },
  Designation:          { label:'Designation',       icon:'💼', type:'text',     required:false },
  AadhaarNumber:        { label:'Aadhaar Number',     icon:'🪪', type:'text',     required:false },
  AadharCard:           { label:'Aadhaar Number',     icon:'🪪', type:'text',     required:false },
  Department:           { label:'Department',         icon:'🏢', type:'text',     required:false },
  EmailId:              { label:'Email ID',           icon:'✉️', type:'email',    required:false },
  ValidFrom:            { label:'Valid From',         icon:'📅', type:'date',     required:false },
  ValidTill:            { label:'Valid Till',         icon:'📅', type:'date',     required:false },
  BatchTiming:          { label:'Batch / Timing',    icon:'⏰', type:'text',     required:false },
}

/* ── Format date YYYY-MM-DD → DD/MM/YYYY for display ── */
function formatDOB(val) {
  if (!val) return val
  if (!/^\d{4}-\d{2}-\d{2}$/.test(val)) return val
  const [y, m, d] = val.split('-')
  return `${d}/${m}/${y}`
}

const inputStyle = (hasErr) => ({
  width:'100%', padding:'11px 14px', borderRadius:'var(--r)',
  border:`1.5px solid ${hasErr?'var(--red)':'var(--border)'}`,
  fontSize:14, color:'var(--ink)', background:'var(--paper)',
  outline:'none', transition:'all .18s', fontFamily:'inherit', boxSizing:'border-box',
})
const onFocusField = e => { e.target.style.borderColor='var(--blue)'; e.target.style.boxShadow='0 0 0 3px rgba(35,82,255,.1)' }
const onBlurField  = (e, hasErr) => { e.target.style.borderColor=hasErr?'var(--red)':'var(--border)'; e.target.style.boxShadow='none' }

/* ── Crop helpers ──────────────────────────────────────────────── */

async function getCroppedImg(imageSrc, croppedAreaPixels) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width  = croppedAreaPixels.width
      canvas.height = croppedAreaPixels.height
      const ctx = canvas.getContext('2d')
      ctx.drawImage(img, croppedAreaPixels.x, croppedAreaPixels.y, croppedAreaPixels.width, croppedAreaPixels.height, 0, 0, croppedAreaPixels.width, croppedAreaPixels.height)
      resolve(canvas.toDataURL('image/jpeg', 0.92))
    }
    img.onerror = reject
    img.src = imageSrc
  })
}

/* ── CropModal ─────────────────────────────────────────────────── */
function CropModal({ open, imageUrl, onDone, onClose }) {
  const [mode, setMode]                         = useState(null)
  const [crop, setCrop]                         = useState({ x: 0, y: 0 })
  const [zoom, setZoom]                         = useState(1)
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null)
  const [applying, setApplying]                 = useState(false)

  useEffect(() => {
    if (!open) return
    setMode(null); setCrop({ x:0, y:0 }); setZoom(1)
    setCroppedAreaPixels(null)
  }, [open, imageUrl])

  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [open])

  const pickCustom = () => {
    setCrop({ x:0, y:0 }); setZoom(1)
    setMode('custom')
  }

  const handleApply = async () => {
    setApplying(true)
    try {
      const result = await getCroppedImg(imageUrl, croppedAreaPixels); onDone(result); onClose()
    } catch { toast.error('Crop failed') } finally { setApplying(false) }
  }

  return (
    <Modal open={open} onClose={onClose} title="📷 Crop Your Photo" width={600}>
      <style>{`
        .crop-mode-btns { display:flex; gap:10px; margin-bottom:14px; }
        .crop-mode-btn  { flex:1; padding:10px 0; border-radius:9px; font-weight:700; font-size:13px; cursor:pointer; transition:all .18s; border:2px solid var(--border); background:var(--paper); color:var(--ink); }
        .crop-mode-btn.active { border-color:#2352ff; background:#eef1ff; color:#2352ff; }
        .easy-crop-wrap { position:relative; width:100%; height:320px; background:#111; border-radius:12px; overflow:hidden; }
        .reactEasyCrop_CropArea { border:3px solid #2352ff !important; }
        .reactEasyCrop_CropAreaGrid::before, .reactEasyCrop_CropAreaGrid::after { border-color:rgba(255,255,255,0.35) !important; }
        .zoom-row { display:flex; align-items:center; gap:12px; margin-top:12px; }
        .zoom-row input[type=range] { flex:1; accent-color:#2352ff; height:4px; cursor:pointer; }
        .crop-actions { display:flex; gap:10px; margin-top:16px; }
        @media(max-width:520px){
          .easy-crop-wrap{ height:260px; }
          .crop-actions > * { flex:1; }
        }
      `}</style>

      <div className="crop-mode-btns">
        <button className={`crop-mode-btn${mode==='custom'?' active':''}`} onClick={pickCustom}>✂️ Custom Crop</button>
      </div>

      <div className="easy-crop-wrap">
        {!mode && (
          <>
            <img src={imageUrl} alt="" style={{ width:'100%', height:'100%', objectFit:'contain', opacity:.4 }}/>
            <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center', pointerEvents:'none' }}>
              <div style={{ background:'rgba(0,0,0,.55)', color:'#fff', fontSize:13, padding:'8px 18px', borderRadius:20 }}>Select a crop option above ↑</div>
            </div>
          </>
        )}
        {mode === 'custom' && (
          <Cropper
            image={imageUrl}
            crop={crop}
            zoom={zoom}
            aspect={3/4}
            cropShape="rect"
            showGrid
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={(_, px) => setCroppedAreaPixels(px)}
            style={{
              containerStyle: { borderRadius:12 },
              cropAreaStyle:  { border:'3px solid #2352ff', borderRadius:6 },
            }}
          />
        )}
      </div>

      {mode === 'custom' && (
        <div className="zoom-row">
          <span style={{ fontSize:12, color:'var(--ink3)', flexShrink:0 }}>🔍 Zoom</span>
          <input type="range" min={1} max={3} step={0.01} value={zoom} onChange={e => setZoom(Number(e.target.value))}/>
          <span style={{ fontSize:12, color:'var(--ink3)', width:36, textAlign:'right' }}>{zoom.toFixed(1)}×</span>
        </div>
      )}

      <div className="crop-actions">
        <Btn variant="teal" onClick={handleApply}
          disabled={applying || !mode || (mode==='custom' && !croppedAreaPixels)}>
          {applying ? '⏳ Applying…' : '✅ Apply Crop'}
        </Btn>
        <Btn variant="ghost" onClick={onClose} disabled={applying}>Cancel</Btn>
      </div>
    </Modal>
  )
}
/* ── RenderField ────────────────────────────────────────────────── */
function RenderField({ f, formData, errors, update, orgClassesConfig = [] }) {
  const meta = FIELD_META[f]; if (!meta) return null
  const val = formData[f] || '', hasErr = Boolean(errors[f])

  const label = (
    <label style={{ display:'block', fontSize:11, fontWeight:700, color:'var(--ink3)', textTransform:'uppercase', letterSpacing:.5, marginBottom:6 }}>
      {meta.icon} {meta.label}{meta.required && <span style={{ color:'var(--red)', marginLeft:3 }}>*</span>}
    </label>
  )
  const errMsg = hasErr && <p style={{ fontSize:11, color:'var(--red)', marginTop:4 }}>{errors[f]}</p>

  if (f === 'ClassN' && orgClassesConfig.length > 0) {
    return (
      <div>
        {label}
        <select value={val} onChange={e => { update('ClassN', e.target.value); update('Section', '') }}
          onFocus={onFocusField} onBlur={e => onBlurField(e, hasErr)}
          style={{ ...inputStyle(hasErr), cursor:'pointer', color: val ? 'var(--ink)' : 'var(--ink3)' }}>
          <option value="">-- Select Class --</option>
          {orgClassesConfig.map(c => (
            <option key={c.name} value={c.name}>{c.name}</option>
          ))}
        </select>
        {errMsg}
      </div>
    )
  }

  if (f === 'Section' && orgClassesConfig.length > 0) {
    const selectedClass = orgClassesConfig.find(c => c.name === formData['ClassN'])
    const sections = selectedClass?.sections || []
    return (
      <div>
        {label}
        <select value={val} onChange={e => update('Section', e.target.value)}
          onFocus={onFocusField} onBlur={e => onBlurField(e, hasErr)}
          disabled={!formData['ClassN']}
          style={{ ...inputStyle(hasErr), cursor: formData['ClassN'] ? 'pointer' : 'not-allowed', color: val ? 'var(--ink)' : 'var(--ink3)', opacity: formData['ClassN'] ? 1 : 0.6 }}>
          <option value="">{formData['ClassN'] ? '-- Select Section --' : '-- Select Class first --'}</option>
          {sections.map(s => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        {errMsg}
      </div>
    )
  }

  if (meta.type === 'select') return (
    <div>
      {label}
      <select value={val} onChange={e => update(f, e.target.value)} onFocus={onFocusField} onBlur={e => onBlurField(e, hasErr)}
        style={{ ...inputStyle(hasErr), cursor:'pointer', color: val ? 'var(--ink)' : 'var(--ink3)' }}>
        {meta.options.map(o => <option key={o} value={o}>{o || `-- Select ${meta.label} --`}</option>)}
      </select>{errMsg}
    </div>
  )
  if (meta.type === 'textarea') return (
    <div style={{ gridColumn:'1 / -1' }}>
      {label}
      <textarea value={val} onChange={e => update(f, e.target.value)} onFocus={onFocusField} onBlur={e => onBlurField(e, hasErr)}
        placeholder={`Enter ${meta.label.toLowerCase()}`} rows={3} style={{ ...inputStyle(hasErr), resize:'vertical' }}/>{errMsg}
    </div>
  )
  return (
    <div>
      {label}
      <input type={meta.type} value={val} onChange={e => update(f, e.target.value)} onFocus={onFocusField} onBlur={e => onBlurField(e, hasErr)}
        placeholder={meta.type === 'date' ? '' : `Enter ${meta.label.toLowerCase()}`} style={inputStyle(hasErr)}/>{errMsg}
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════
   MAIN COMPONENT
═══════════════════════════════════════════════════════════════ */
export default function DetailsForm() {
  const { urlId }  = useParams()
  const navigate   = useNavigate()
  const { createSubmission, checkDuplicate, checkDuplicateNow } = useSubmissions()

  const [config,           setConfig]           = useState(null)
  const [configLoad,       setConfigLoad]       = useState(true)
  const [notFound,         setNotFound]         = useState(false)
  const [formData,         setFormData]         = useState({})
  const [errors,           setErrors]           = useState({})
  const [accepted,         setAccepted]         = useState(false)
  const [dupWarn,          setDupWarn]          = useState('')
  const [photoRaw,         setPhotoRaw]         = useState(null)
  const [photoCropped,     setPhotoCropped]     = useState(null)
  const [showCrop,         setShowCrop]         = useState(false)
  const [showConfirm,      setShowConfirm]      = useState(false)
  const [submitting,       setSubmitting]       = useState(false)
  const [orgClassesConfig, setOrgClassesConfig] = useState([])
  const fileRef = useRef()

  useEffect(() => {
    if (!urlId) { setNotFound(true); setConfigLoad(false); return }
    let cancelled = false

    formConfigsApi.getByUrlId(urlId)
      .then(async config => {
        if (cancelled) return
        setConfig(config)

        // ── Fetch org's classes_config directly from Firestore ──
        try {
          // Primary: exact match (trimmed)
          let org = await organizationsApi.getByName(config.school_name.trim())

          // Fallback: case-insensitive match in case org name casing differs
          if (!org || !org.classes_config?.length) {
            const allOrgs = await organizationsApi.list()
            const normalised = config.school_name.trim().toLowerCase()
            org = allOrgs.find(o => o.name.trim().toLowerCase() === normalised) || null
          }

          if (org?.classes_config?.length > 0) {
            setOrgClassesConfig(org.classes_config)
          } else {
            console.warn('[DetailsForm] No classes_config found for org:', config.school_name)
          }
        } catch (e) { console.warn('[DetailsForm] Org lookup failed:', e.message) }
      })
      .catch(() => { if (!cancelled) setNotFound(true) })
      .finally(() => { if (!cancelled) setConfigLoad(false) })

    return () => { cancelled = true }
  }, [urlId])

  const schoolName = config?.school_name ?? ''
  const hasPhoto   = config?.fields?.includes('UploadYourPhoto') ?? false

  // Helper: build a human-readable location string for the error message
  const locationLabel = (cls, sec) => {
    if (cls && sec) return `Class ${cls} - ${sec}`
    if (cls)        return `Class ${cls}`
    return ''
  }

  const isStaffOrEmployee = config?.role === 'Staff' || config?.role === 'Employee'

  // Helper: re-run contact check whenever class or section changes
  const reCheckContact = useCallback((newClass, newSection) => {
    const contact = formData.ContactNumber || ''
    if (contact.length !== 10) return
    // Staff/Employee: never scope by class/section, even if those fields
    // happen to be present on this form — checked school-wide instead.
    const cls = isStaffOrEmployee ? '' : newClass
    const sec = isStaffOrEmployee ? '' : newSection
    checkDuplicate(schoolName, '', '', dup => {
      setErrors(prev => ({
        ...prev,
        ContactNumber: dup
          ? (isStaffOrEmployee
              ? `⚠ This contact is already registered at ${schoolName}.`
              : `⚠ This contact is already registered in ${locationLabel(newClass, newSection) || 'this school'}.`)
          : (prev.ContactNumber?.includes('already registered') ? '' : prev.ContactNumber)
      }))
    }, contact, cls, sec)
  }, [checkDuplicate, schoolName, formData.ContactNumber, isStaffOrEmployee])

  const update = useCallback((k, v) => {
    setFormData(prev => ({ ...prev, [k]:v }))
    setErrors(prev => prev[k] ? { ...prev, [k]:'' } : prev)

    if ((k==='Name'||k==='RollNumber') && v.length>2 && schoolName) {
      // Name / roll-number: not class/section scoped
      checkDuplicate(schoolName, k==='Name'?v:'', k==='RollNumber'?v:'',
        dup => setDupWarn(dup?`⚠ A record for "${v}" already exists at ${schoolName}.`:''))

    } else if (k==='ContactNumber' && v.length===10) {
      // Contact: check using CURRENT class + section from formData
      // (Staff/Employee: ignore class/section, check school-wide instead.)
      const cls = isStaffOrEmployee ? '' : (formData.ClassN  || '')
      const sec = isStaffOrEmployee ? '' : (formData.Section || '')
      checkDuplicate(schoolName, '', '', dup => {
        setErrors(prev => ({
          ...prev,
          ContactNumber: dup
            ? (isStaffOrEmployee
                ? `⚠ This contact is already registered at ${schoolName}.`
                : `⚠ This contact is already registered in ${locationLabel(cls, sec) || 'this school'}.`)
            : (prev.ContactNumber?.includes('already registered') ? '' : prev.ContactNumber)
        }))
      }, v, cls, sec)

    } else if (k==='ClassN') {
      // Class changed → section resets (already done by RenderField); re-check contact
      reCheckContact(v, '')   // section cleared when class changes

    } else if (k==='Section') {
      // Section changed → re-check contact with current class + new section
      reCheckContact(formData.ClassN || '', v)

    } else if (v.length<=2 && k==='Name') setDupWarn('')
  }, [checkDuplicate, schoolName, formData, reCheckContact, isStaffOrEmployee])


  const handlePhoto = e => {
    const file=e.target.files?.[0]; if(!file) return
    if(file.size>10*1024*1024){toast.error('File too large. Max 10MB.');return}
    const r=new FileReader()
    r.onload=ev=>{ setPhotoRaw(ev.target.result); setShowCrop(true) }
    r.readAsDataURL(file); e.target.value=''
  }

  const validateAll = () => {
    const e={}
    const dataFields = config.fields.filter(f => f!=='UploadYourPhoto')
    dataFields.forEach(f => {
      const meta=FIELD_META[f]; if(!meta) return
      if(meta.required && !formData[f]?.trim()) e[f]=`${meta.label} is required`
      if((f==='ContactNumber'||f==='EmergencyContact') && formData[f] && !/^\d{10}$/.test(formData[f]))
        e[f]='Enter a valid 10-digit number'
      if(f==='EmailId' && formData[f] && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData[f]))
        e[f]='Enter a valid email address'
      if(f==='ContactNumber' && errors[f]?.includes('already registered')) e[f]=errors[f]
    })
    if(hasPhoto && !photoCropped) e.photo='Profile photo is required'
    if(!accepted) e.accept='You must accept the declaration to proceed'
    setErrors(e)
    return Object.keys(e).length===0
  }

  const handleSubmitClick = () => {
    if(!validateAll()){
      toast.error('Please fix the errors before submitting')
      setTimeout(()=>{
        const el = document.querySelector('[data-has-error="true"]')
        el?.scrollIntoView({ behavior:'smooth', block:'center' })
      }, 100)
      return
    }
    setShowConfirm(true)
  }

  const handleConfirm = async () => {
    setSubmitting(true)
    try {
      // Final authoritative duplicate check — runs fresh, right now, against
      // Firestore (not the debounced live-typing check). This is what
      // actually blocks a duplicate submission; the earlier inline warning
      // is advisory only and can be stale if the user submits quickly.
      // For Staff/Employee, the check ignores class/section (they don't have
      // one) and looks school-wide across ALL roles — so the same contact
      // number can't be reused across Students, Staff, and Employees either.
      const contact = formData.ContactNumber || ''
      const isStaffOrEmployee = config.role === 'Staff' || config.role === 'Employee'
      if (contact) {
        const dup = await checkDuplicateNow(config.school_name, contact, formData.ClassN || '', formData.Section || '', config.role)
        if (dup) {
          setShowConfirm(false)
          setSubmitting(false)
          setErrors(prev => ({
            ...prev,
            ContactNumber: isStaffOrEmployee
              ? `⚠ This contact is already registered at ${config.school_name}.`
              : `⚠ This contact is already registered in ${locationLabel(formData.ClassN, formData.Section) || 'this school'}.`
          }))
          toast.error('This contact number is already registered. Submission blocked.')
          setTimeout(() => {
            const el = document.querySelector('[data-has-error="true"]')
            el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
          }, 100)
          return
        }
      }

      const sub = await createSubmission({ formConfigId:config.id, schoolName:config.school_name, role:config.role, ...formData }, photoCropped)
      setShowConfirm(false)
      navigate('/success', { state:{ submission:sub, school:config.school_name, role:config.role } })
    } catch(err) { toast.error(err.message||'Submission failed. Please try again.') }
    finally { setSubmitting(false) }
  }

  if (configLoad) return (
    <div style={{ display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',minHeight:'100vh',gap:16,background:'linear-gradient(135deg,#f0f4ff,#f5f6fc)' }}>
      <Spinner size={44}/><p style={{ fontSize:14,color:'var(--ink3)',fontWeight:600 }}>Loading form...</p>
    </div>
  )
  if (notFound) return (
    <div style={{ display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',minHeight:'100vh',gap:16,background:'linear-gradient(135deg,#f0f4ff,#f5f6fc)',padding:24 }}>
      <div style={{ fontSize:64 }}>🔗</div>
      <h2 style={{ fontFamily:'Outfit,sans-serif',fontSize:24,fontWeight:900,color:'var(--ink)',textAlign:'center' }}>Link Not Found or Expired</h2>
      <p style={{ color:'var(--ink3)',fontSize:14,textAlign:'center',maxWidth:320 }}>This form link is invalid or has expired. Please contact your school administrator.</p>
    </div>
  )

  const dataFields = config.fields.filter(f => f!=='UploadYourPhoto')

  return (
    <div style={{ minHeight:'100vh', background:'linear-gradient(150deg,#f0f4ff 0%,#eef0f8 50%,#f5f6fc 100%)', padding:'24px 12px 48px' }}>
      <style>{`
        .df-wrap { max-width: 700px; margin: 0 auto; }
        .df-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
        .df-confirm-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
        @media (max-width: 600px) {
          .df-grid { grid-template-columns: 1fr !important; gap: 12px !important; }
          .df-confirm-grid { grid-template-columns: 1fr !important; }
          .df-header-meta { display: none !important; }
          .df-photo-preview { flex-direction: column !important; align-items: center !important; }
          .df-photo-preview img { width: 90px !important; height: 114px !important; }
        }
      `}</style>

      <div className="df-wrap">

        {/* ── School header ── */}
        <div className="anim-fade-up" style={{ background:'linear-gradient(135deg,#2352ff,#1538d4)', borderRadius:16, padding:'18px 20px', marginBottom:16, display:'flex', alignItems:'center', gap:14, boxShadow:'0 8px 32px rgba(35,82,255,.25)' }}>
          <div style={{ width:50,height:50,borderRadius:14,background:'rgba(255,255,255,.18)',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:'Outfit,sans-serif',fontWeight:900,fontSize:18,color:'#fff',flexShrink:0,border:'2px solid rgba(255,255,255,.25)' }}>
            {config.school_name.slice(0,2).toUpperCase()}
          </div>
          <div style={{ flex:1,minWidth:0 }}>
            <div style={{ fontFamily:'Outfit,sans-serif',fontSize:17,fontWeight:800,color:'#fff',letterSpacing:-.2,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' }}>{config.school_name}</div>
            <div style={{ fontSize:11,color:'rgba(255,255,255,.75)',marginTop:2 }}>{config.role} ID Card Registration Form</div>
          </div>
          <div className="df-header-meta" style={{ textAlign:'right',flexShrink:0 }}>
            <div style={{ fontSize:10,color:'rgba(255,255,255,.6)',fontWeight:600 }}>FIELDS</div>
            <div style={{ fontFamily:'Outfit,sans-serif',fontSize:20,fontWeight:800,color:'#fff' }}>{config.fields.length}</div>
          </div>
        </div>

        {dupWarn && (
          <div style={{ background:'var(--amber-s)',borderRadius:'var(--r)',padding:'10px 14px',marginBottom:12,fontSize:13,color:'#92400e',fontWeight:600,border:'1px solid #fcd34d',display:'flex',alignItems:'center',gap:8 }}>
            <span>⚠️</span>{dupWarn}
          </div>
        )}

        <div className="anim-fade-up" style={{ background:'var(--paper)', borderRadius:16, border:'1px solid var(--border)', boxShadow:'0 8px 32px rgba(35,82,255,.1)', overflow:'hidden' }}>

          <div style={{ padding:'18px 20px', borderBottom:'1px solid var(--border)', background:'var(--paper2)' }}>
            <h2 style={{ fontFamily:'Outfit,sans-serif',fontSize:18,fontWeight:800,color:'var(--ink)',margin:0 }}>📋 Personal Information</h2>
            <p style={{ fontSize:12,color:'var(--ink3)',marginTop:4,marginBottom:0 }}>Fill in all your details below. Fields marked with * are required.</p>
          </div>

           <div style={{ padding:'20px' }}>

            <div className="df-grid">
            {dataFields.map(f => (
              <div key={f} data-has-error={Boolean(errors[f]) ? 'true' : 'false'}>
                <RenderField f={f} formData={formData} errors={errors} update={update} orgClassesConfig={orgClassesConfig} />
              </div>
            ))}
            </div>


            
            {hasPhoto && (
              <div style={{ marginBottom:24, paddingBottom:24, borderBottom:'1px solid var(--border)' }}>
                <div style={{ fontSize:11,fontWeight:700,color:'var(--ink3)',textTransform:'uppercase',letterSpacing:.5,marginBottom:10 }}>📷 Profile Photo *</div>
                {!photoCropped ? (
                  <div onClick={()=>fileRef.current?.click()}
                    style={{ border:`2px dashed ${errors.photo?'var(--red)':'var(--border2)'}`,borderRadius:12,padding:'28px 16px',textAlign:'center',cursor:'pointer',background:'var(--paper2)',transition:'all .2s' }}
                    onMouseEnter={e=>{e.currentTarget.style.borderColor='#2352ff';e.currentTarget.style.background='var(--blue-s)'}}
                    onMouseLeave={e=>{e.currentTarget.style.borderColor=errors.photo?'var(--red)':'var(--border2)';e.currentTarget.style.background='var(--paper2)'}}>
                    <div style={{ fontSize:40,marginBottom:8 }}>📷</div>
                    <div style={{ fontSize:14,fontWeight:700,color:'var(--ink2)',marginBottom:4 }}>Tap to upload your photo</div>
                    <div style={{ fontSize:12,color:'var(--ink3)' }}>JPG, PNG or WEBP · Max 10MB</div>
                    <input type="file" ref={fileRef} accept="image/jpeg,image/png,image/webp" onChange={handlePhoto} style={{ display:'none' }}/>
                  </div>
                ) : (
                  <div className="df-photo-preview" style={{ display:'flex',gap:16,alignItems:'flex-start',padding:16,background:'linear-gradient(135deg,var(--teal-s),var(--blue-s))',borderRadius:12,border:'1.5px solid #00c48c' }}>
                    <div style={{ position:'relative',flexShrink:0 }}>
                      <img src={photoCropped} alt="Preview" style={{ width:80,height:100,objectFit:'cover',borderRadius:12,border:'3px solid #2352ff',boxShadow:'0 4px 16px rgba(35,82,255,.2)',display:'block' }}/>
                      <div style={{ position:'absolute',top:-8,right:-8,width:24,height:24,borderRadius:'50%',background:'#00c48c',border:'3px solid white',display:'flex',alignItems:'center',justifyContent:'center',fontSize:12,color:'#fff',fontWeight:900 }}>✓</div>
                    </div>
                    <div style={{ flex:1,minWidth:0 }}>
                      <div style={{ fontSize:14,fontWeight:700,color:'var(--ink)',marginBottom:4 }}>Photo ready ✓</div>
                      <div style={{ fontSize:12,color:'var(--ink2)',marginBottom:12,lineHeight:1.5 }}>Cropped to 3:4 ratio for your ID card.</div>
                      <div style={{ display:'flex',gap:8,flexWrap:'wrap' }}>
                        <Btn size="sm" variant="soft"  onClick={()=>setShowCrop(true)}>✂ Re-crop</Btn>
                        <Btn size="sm" variant="ghost" onClick={()=>fileRef.current?.click()}>🔄 Change</Btn>
                        <Btn size="sm" variant="ghost" style={{ color:'var(--red)' }} onClick={()=>{setPhotoCropped(null);setPhotoRaw(null)}}>🗑 Remove</Btn>
                      </div>
                      <input type="file" ref={fileRef} accept="image/jpeg,image/png,image/webp" onChange={handlePhoto} style={{ display:'none' }}/>
                    </div>
                  </div>
                )}
                {errors.photo && <p data-has-error="true" style={{ fontSize:12,color:'var(--red)',marginTop:6,fontWeight:600 }}>{errors.photo}</p>}
              </div>
            )}


            <div style={{ marginTop:24, paddingTop:20, borderTop:'1px solid var(--border)' }}>
              <div
                style={{ background:accepted?'var(--teal-s)':'var(--paper2)', borderRadius:'var(--r)', padding:'14px 16px', border:`1.5px solid ${accepted?'#00c48c':'var(--border)'}`, marginBottom:4, transition:'all .2s', cursor:'pointer' }}
                onClick={()=>setAccepted(a=>!a)}>
                <label style={{ display:'flex',alignItems:'flex-start',gap:12,cursor:'pointer' }}>
                  <div style={{ width:20,height:20,borderRadius:5,border:`2px solid ${accepted?'#00c48c':'var(--border2)'}`,background:accepted?'#00c48c':'transparent',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,marginTop:1,transition:'all .15s' }}>
                    {accepted&&<span style={{ color:'#fff',fontSize:12,fontWeight:900 }}>✓</span>}
                  </div>
                  <span style={{ fontSize:13,color:'var(--ink2)',lineHeight:1.6,fontWeight:500,pointerEvents:'none' }}>
                    I hereby declare that all information provided above is <strong>true and correct</strong>. I accept responsibility for any false information submitted.
                  </span>
                </label>
              </div>
              {errors.accept&&<p data-has-error="true" style={{ fontSize:12,color:'var(--red)',marginTop:4,fontWeight:600 }}>{errors.accept}</p>}
            </div>

            <div style={{ marginTop:20 }}>
              <Btn variant="teal" full onClick={handleSubmitClick} disabled={submitting} style={{ fontSize:16, padding:'14px', borderRadius:12 }}>
                {submitting ? '⏳ Submitting...' : '✓ Submit Form'}
              </Btn>
            </div>
            </div>
          </div>

        <p style={{ textAlign:'center',fontSize:11,color:'var(--ink3)',marginTop:16 }}>
          🔒 Your data is securely stored and will only be used for ID card generation.
        </p>
      </div>

      {photoRaw && <CropModal open={showCrop} imageUrl={photoRaw} onDone={setPhotoCropped} onClose={()=>setShowCrop(false)}/>}

      <Modal open={showConfirm} onClose={()=>!submitting&&setShowConfirm(false)} title="Confirm Submission" width={520}>
        <p style={{ fontSize:13,color:'var(--ink3)',marginBottom:16 }}>Please review your details before submitting. You cannot edit after submission.</p>
        <div style={{ background:'var(--paper2)',borderRadius:12,padding:16,marginBottom:14,maxHeight:'50vh',overflowY:'auto' }}>
          <div style={{ display:'flex',alignItems:'center',gap:12,marginBottom:14,paddingBottom:14,borderBottom:'1px solid var(--border)' }}>
            {photoCropped
              ? <img src={photoCropped} style={{ width:52,height:66,objectFit:'cover',borderRadius:8,border:'2px solid #2352ff',flexShrink:0 }} alt=""/>
              : <div style={{ width:52,height:66,borderRadius:8,background:'var(--blue-s)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:24,flexShrink:0 }}>👤</div>
            }
            <div>
              <div style={{ fontFamily:'Outfit,sans-serif',fontSize:17,fontWeight:800,color:'var(--ink)' }}>{formData.Name||'—'}</div>
              <div style={{ fontSize:12,color:'var(--ink3)',marginTop:2 }}>{config.role} · {config.school_name}</div>
            </div>
          </div>
          <div className="df-confirm-grid">
            {dataFields.filter(f => { const v=formData[f]; return v&&v.trim?.() }).map(f => {
              const meta=FIELD_META[f]; if(!meta) return null
              return (
                <div key={f} style={{ background:'var(--paper)',borderRadius:8,padding:'8px 10px',border:'1px solid var(--border)' }}>
                  <div style={{ fontSize:9,fontWeight:700,color:'var(--ink3)',textTransform:'uppercase',letterSpacing:.4 }}>{meta.label}</div>
                  <div style={{ fontSize:13,fontWeight:600,color:'var(--ink)',marginTop:2,wordBreak:'break-word' }}>{f === 'DateofBirth' ? formatDOB(formData[f]) : formData[f]}</div>
                </div>
              )
            })}
          </div>
        </div>
        <div style={{ display:'flex',gap:10 }}>
          <Btn variant="ghost" full onClick={()=>setShowConfirm(false)} disabled={submitting}>← Edit</Btn>
          <Btn variant="teal"  full onClick={handleConfirm} disabled={submitting}>
            {submitting?'⏳ Submitting...':'✓ Confirm & Submit'}
          </Btn>
        </div>
      </Modal>
    </div>
  )
}