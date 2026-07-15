import { useState, useCallback, useRef, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useSubmissions } from '../hooks/useSubmissions'
import { useOrganizations } from '../hooks/useOrganizations'
import { useCardTemplates } from '../hooks/useCardtemplates'
import { Btn, Spinner } from '../components/shared/index'
import { uploadBgImage } from '../lib/firebase'
import toast from 'react-hot-toast'
import QRCode from 'qrcode'

const SNAP         = 8
const GUIDE_THRESH = 7

const SIZE_PRESETS = {
  standard:  { label:'Standard',  w:340, h:480 },
  large:     { label:'Large',     w:400, h:560 },
  small:     { label:'Small',     w:280, h:400 },
  landscape: { label:'Landscape', w:500, h:320 },
  square:    { label:'Square',    w:380, h:380 },
}


/* ─────────────────────────────────────────────────────────────
   LAYOUT PRESETS  — one-click field positioning for common
   real-world ID card styles (portrait & landscape)
───────────────────────────────────────────────────────────── */
const LAYOUT_PRESETS = {

  /* ── PORTRAIT layouts ── */

  portrait_classic: {
    label: 'Classic Portrait',
    icon: '🪪',
    orientation: 'portrait',
    desc: 'Photo top-left, fields stacked right',
    cardW: 340, cardH: 480,
    photoX: 16, photoY: 90, photoSize: 80,
    fieldPositions: {
      name:              { x: 110, y: 96  },
      designation:       { x: 110, y: 116 },
      class:             { x: 110, y: 136 },
      section:           { x: 200, y: 136 },
      roll_number:       { x: 110, y: 156 },
      admission_number:  { x: 110, y: 176 },
      date_of_birth:     { x: 16,  y: 210 },
      blood_group:       { x: 180, y: 210 },
      contact_number:    { x: 16,  y: 235 },
      emergency_contact: { x: 16,  y: 258 },
      department:        { x: 110, y: 196 },
      address:           { x: 16,  y: 295 },
      mode_of_transport: { x: 16,  y: 340 },
    },
  },

  portrait_center: {
    label: 'Centered Portrait',
    icon: '📋',
    orientation: 'portrait',
    desc: 'Photo center-top, all fields centered below',
    cardW: 340, cardH: 480,
    photoX: 126, photoY: 88, photoSize: 88,
    fieldPositions: {
      name:              { x: 20, y: 210 },
      designation:       { x: 20, y: 232 },
      class:             { x: 20, y: 254 },
      section:           { x: 170, y: 254 },
      roll_number:       { x: 20, y: 276 },
      admission_number:  { x: 20, y: 298 },
      date_of_birth:     { x: 20, y: 320 },
      blood_group:       { x: 180, y: 320 },
      contact_number:    { x: 20, y: 342 },
      emergency_contact: { x: 20, y: 364 },
      department:        { x: 20, y: 298 },
      address:           { x: 20, y: 386 },
      mode_of_transport: { x: 20, y: 408 },
    },
  },

  portrait_twocol: {
    label: 'Two-Column Portrait',
    icon: '📑',
    orientation: 'portrait',
    desc: 'Photo left, two-column fields layout',
    cardW: 340, cardH: 480,
    photoX: 16, photoY: 88, photoSize: 80,
    fieldPositions: {
      name:              { x: 16,  y: 210 },
      designation:       { x: 16,  y: 232 },
      class:             { x: 16,  y: 258 },
      section:           { x: 172, y: 258 },
      roll_number:       { x: 16,  y: 282 },
      admission_number:  { x: 172, y: 282 },
      date_of_birth:     { x: 16,  y: 306 },
      blood_group:       { x: 172, y: 306 },
      contact_number:    { x: 16,  y: 330 },
      emergency_contact: { x: 172, y: 330 },
      department:        { x: 16,  y: 254 },
      address:           { x: 16,  y: 358 },
      mode_of_transport: { x: 16,  y: 382 },
    },
  },

  /* ── LANDSCAPE layouts ── */

  landscape_classic: {
    label: 'Classic Landscape',
    icon: '💳',
    orientation: 'landscape',
    desc: 'Photo left, all fields stacked right (like Image 2)',
    cardW: 500, cardH: 320,
    photoX: 16, photoY: 72, photoSize: 88,
    fieldPositions: {
      name:              { x: 130, y: 72  },
      designation:       { x: 130, y: 94  },
      class:             { x: 130, y: 118 },
      section:           { x: 260, y: 118 },
      roll_number:       { x: 130, y: 140 },
      admission_number:  { x: 130, y: 162 },
      date_of_birth:     { x: 130, y: 184 },
      blood_group:       { x: 310, y: 184 },
      contact_number:    { x: 130, y: 206 },
      emergency_contact: { x: 130, y: 228 },
      department:        { x: 130, y: 162 },
      address:           { x: 130, y: 252 },
      mode_of_transport: { x: 130, y: 276 },
    },
  },

  landscape_split: {
    label: 'Split Landscape',
    icon: '🗂',
    orientation: 'landscape',
    desc: 'Two equal columns, photo top-left',
    cardW: 500, cardH: 320,
    photoX: 16, photoY: 68, photoSize: 80,
    fieldPositions: {
      name:              { x: 16,  y: 200 },
      designation:       { x: 16,  y: 222 },
      class:             { x: 16,  y: 244 },
      section:           { x: 130, y: 244 },
      roll_number:       { x: 260, y: 72  },
      admission_number:  { x: 260, y: 94  },
      date_of_birth:     { x: 260, y: 118 },
      blood_group:       { x: 260, y: 140 },
      contact_number:    { x: 260, y: 164 },
      emergency_contact: { x: 260, y: 188 },
      department:        { x: 260, y: 212 },
      address:           { x: 16,  y: 268 },
      mode_of_transport: { x: 260, y: 236 },
    },
  },

  landscape_compact: {
    label: 'Compact Landscape',
    icon: '📇',
    orientation: 'landscape',
    desc: 'Minimal — photo small left, dense fields (like Image 3)',
    cardW: 480, cardH: 300,
    photoX: 14, photoY: 68, photoSize: 72,
    fieldPositions: {
      name:              { x: 106, y: 70  },
      designation:       { x: 106, y: 90  },
      class:             { x: 106, y: 112 },
      section:           { x: 240, y: 112 },
      roll_number:       { x: 106, y: 134 },
      admission_number:  { x: 106, y: 156 },
      date_of_birth:     { x: 106, y: 178 },
      blood_group:       { x: 300, y: 178 },
      contact_number:    { x: 106, y: 200 },
      emergency_contact: { x: 106, y: 222 },
      department:        { x: 106, y: 156 },
      address:           { x: 106, y: 246 },
      mode_of_transport: { x: 106, y: 268 },
    },
  },
}

const ALL_FIELDS = [
  { key:'name',              label:'Full Name',         icon:'👤' },
  { key:'fathers_name',      label:"Father's Name",     icon:'👨' },
  { key:'class',             label:'Class',             icon:'🏫' },
  { key:'section',           label:'Section',           icon:'📌' },
  { key:'roll_number',       label:'Roll No.',          icon:'🎯' },
  { key:'admission_number',  label:'Admission No.',     icon:'🔢' },
  { key:'date_of_birth',     label:'Date of Birth',     icon:'🎂' },
  { key:'blood_group',       label:'Blood Group',       icon:'🩸' },
  { key:'contact_number',    label:'Contact',           icon:'📱' },
  { key:'emergency_contact', label:'Emergency Contact', icon:'🚨' },
  { key:'address',           label:'Address',           icon:'📍' },
  { key:'designation',       label:'Designation',       icon:'💼' },
  { key:'department',        label:'Department',        icon:'🏢' },
  { key:'mode_of_transport', label:'Transport',         icon:'🚌' },
  { key:'employee_id',       label:'Employee ID',       icon:'🪪' },
]

const DEFAULT_FIELD_POSITIONS = {
  name:              { x:110, y:100 },
  fathers_name:      { x:110, y:130 },
  class:             { x:110, y:160 },
  section:           { x:200, y:160 },
  roll_number:       { x:110, y:185 },
  admission_number:  { x:110, y:208 },
  date_of_birth:     { x:16,  y:240 },
  blood_group:       { x:175, y:240 },
  contact_number:    { x:16,  y:265 },
  emergency_contact: { x:16,  y:298 },
  address:           { x:16,  y:330 },
  designation:       { x:110, y:148 },
  department:        { x:110, y:170 },
  mode_of_transport: { x:16,  y:365 },
  employee_id:       { x:110, y:192 },
}

const DEFAULT_CONFIG = {
  c1:'#2352ff', c2:'#1538d4', accent:'#e8ecff',
  photoShape:'rounded', showHeader:true, showBarcode:true,
  headerStyle:'gradient', logoPosition:'left',
  borderStyle:'thin', fontSize:11, orientation:'portrait',
  sizePreset:'standard', cardW:340, cardH:480,
  bgImage:null, bgOpacity:0.15, bgFit:'cover',
  visibleFields:['name','class','roll_number','blood_group','contact_number'],
  fieldPositions:{}, photoX:16, photoY:90, photoSize:72,
  layoutMode:'drag',     // 'drag' | 'flow'
  fieldAlign:'left',     // 'left' | 'center' | 'right'  (flow mode)
  labelWidth:72,         // px — fixed label column width  (flow mode)
  rowGap:22,             // px between rows               (flow mode)
  flowStartY:null,       // null = auto (below photo)     (flow mode)
  flowStartX:null,       // null = auto (margin)          (flow mode)
  showQR:false,          // show real QR code on card
  qrData:'id',           // 'id' | 'name' | 'roll_number' | 'employee_id' | 'contact_number' | 'custom'
  qrCustomText:'',       // custom text when qrData='custom'
  qrSize:56,             // px size of QR on card
  qrX:null,              // null = auto bottom-right
  qrY:null,              // null = auto bottom-right
  fieldStyles:{},        // per-field style overrides { [key]: { highlight, bgColor, textColor, fontSize, fontWeight, uppercase, showLabel, borderRadius, fontFamily } }
  globalFontFamily: 'Instrument Sans',  // default font for all fields
  cornerStyle: 'rounded', // 'rounded' | 'sharp'
}

const snapTo = (v) => Math.round(v / SNAP) * SNAP

function computeGuides(dragKey, dragX, dragY, dragW, dragH, otherItems) {
  const guides = []
  const dCX = dragX + dragW / 2, dCY = dragY + dragH / 2
  const dR  = dragX + dragW,     dB  = dragY + dragH
  for (const it of otherItems) {
    const { x, y, w = 90, h = 32 } = it
    const iCX = x + w / 2, iCY = y + h / 2
    const iR  = x + w,     iB  = y + h
    const vPairs = [
      [dragX, x,   'L-L'], [dragX, iR,  'L-R'], [dCX, iCX, 'C-C'],
      [dR,   x,    'R-L'], [dR,   iR,   'R-R'],
    ]
    for (const [a, b, label] of vPairs) {
      if (Math.abs(a - b) <= GUIDE_THRESH)
        guides.push({ axis:'v', pos:b, from:Math.min(dragY,y)-8, to:Math.max(dB,iB)+8, label })
    }
    const hPairs = [
      [dragY, y,   'T-T'], [dragY, iB,  'T-B'], [dCY, iCY, 'M-M'],
      [dB,   y,    'B-T'], [dB,   iB,   'B-B'],
    ]
    for (const [a, b, label] of hPairs) {
      if (Math.abs(a - b) <= GUIDE_THRESH)
        guides.push({ axis:'h', pos:b, from:Math.min(dragX,x)-8, to:Math.max(dR,iR)+8, label })
    }
  }
  return guides
}

/* ══════════════════════════════════════════════════════════
   QR CODE CANVAS ELEMENT  — real QR, black, draggable
══════════════════════════════════════════════════════════ */
function QRElement({ config, sub, onMove, selected, onSelect }) {
  const canvasRef = useRef(null)
  const dragRef   = useRef(null)
  const CW = config.cardW || 340
  const CH = config.cardH || 480
  const size = config.qrSize || 56

  // Determine QR content from submission data
  const getQRText = useCallback(() => {
    if (!sub) return 'VIRA-ID-PREVIEW'
    if (config.qrData === 'custom') return config.qrCustomText || 'VIRA-ID'
    if (config.qrData === 'name')           return sub.name           || 'VIRA-ID'
    if (config.qrData === 'roll_number')    return sub.roll_number    || sub.id || 'VIRA-ID'
    if (config.qrData === 'contact_number') return sub.contact_number || 'VIRA-ID'
    if (config.qrData === 'employee_id')    return sub.employee_id    || sub.id || 'VIRA-ID'
    // default: 'id' — encode the submission id (most useful for scanning)
    return sub.id || sub.admission_number || sub.roll_number || 'VIRA-ID'
  }, [sub, config.qrData, config.qrCustomText])

  // Auto position: bottom-right corner above barcode area
  const barcodeH = config.showBarcode ? 30 : 0
  const autoX = CW - size - 10
  const autoY = CH - size - barcodeH - 10
  const qrX = config.qrX ?? autoX
  const qrY = config.qrY ?? autoY

  // Render QR into canvas whenever text or size changes
  useEffect(() => {
    if (!canvasRef.current) return
    QRCode.toCanvas(canvasRef.current, getQRText(), {
      width: size,
      margin: 1,
      color: { dark: '#000000', light: '#ffffff' },
      errorCorrectionLevel: 'M',
    }).catch(() => {})
  }, [getQRText, size])

  const isSel = selected === '__qr__'

  const startDrag = (e) => {
    e.preventDefault(); e.stopPropagation()
    onSelect('__qr__')
    dragRef.current = { sx: e.clientX, sy: e.clientY, ox: qrX, oy: qrY }
    const onMouseMove = (ev) => {
      if (!dragRef.current) return
      const dx = ev.clientX - dragRef.current.sx
      const dy = ev.clientY - dragRef.current.sy
      const nx = Math.max(0, Math.min(CW - size, dragRef.current.ox + dx))
      const ny = Math.max(0, Math.min(CH - size, dragRef.current.oy + dy))
      onMove('__qr__', Math.round(nx / 8) * 8, Math.round(ny / 8) * 8)
    }
    const onMouseUp = () => {
      dragRef.current = null
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
  }

  return (
    <div
      onMouseDown={startDrag}
      style={{
        position: 'absolute', left: qrX, top: qrY,
        width: size, height: size, zIndex: isSel ? 60 : 12,
        cursor: 'grab',
        outline: isSel ? `2px dashed #2352ff` : 'none',
        outlineOffset: 3,
        boxShadow: isSel ? '0 0 0 4px #2352ff33' : 'none',
        borderRadius: 4,
        background: '#fff',
        transition: 'box-shadow .15s',
      }}
    >
      <canvas ref={canvasRef} style={{ width: size, height: size, display: 'block', borderRadius: 3 }} />
      {isSel && (
        <div style={{ position:'absolute', top:-18, left:0, fontSize:9, color:'#2352ff',
          fontWeight:700, whiteSpace:'nowrap', background:'#fff', padding:'2px 6px',
          borderRadius:4, border:'1px solid #2352ff44', pointerEvents:'none' }}>↕↔ drag QR</div>
      )}
    </div>
  )
}

/* ══════════════════════════════════════════════════════════
   FIELD STYLE HELPERS
══════════════════════════════════════════════════════════ */
const _DFP = {
  name:{x:110,y:100},fathers_name:{x:110,y:130},class:{x:110,y:160},section:{x:200,y:160},
  roll_number:{x:110,y:185},admission_number:{x:110,y:208},
  date_of_birth:{x:16,y:240},blood_group:{x:175,y:240},
  contact_number:{x:16,y:265},emergency_contact:{x:16,y:298},
  address:{x:16,y:330},designation:{x:110,y:148},
  department:{x:110,y:170},mode_of_transport:{x:16,y:365},
  employee_id:{x:110,y:192},
}
function _gfp(config, key) {
  return config.fieldPositions?.[key] || _DFP[key] || { x:20, y:200 }
}
function _gfs(config, key) { return config.fieldStyles?.[key] || {} }

function DragField({ f, config, val, isSel, isMul, onMouseDown, onClick }) {
  const fs        = _gfs(config, f.key)
  const highlight = fs.highlight || false
  const pos       = _gfp(config, f.key)
  const c1        = config.c1 || '#2352ff'
  const fSize     = fs.fontSize  ?? (config.fontSize || 11)
  const lSize     = Math.max(fSize - 1, 7)
  const fWeight   = fs.fontWeight ?? (highlight ? 700 : 600)
  const textColor = fs.textColor  || (highlight ? '#fff' : '#1a1a2e')
  const bgColor   = fs.bgColor    || c1
  const uppercase = fs.uppercase  || false
  const showLabel = fs.showLabel  !== false
  const brad      = fs.borderRadius ?? 4
  const fontFam   = fs.fontFamily  || config.globalFontFamily || 'Instrument Sans'
  const padX      = 7
  const padY      = 3
  const displayVal = uppercase ? (val||'').toUpperCase() : val

  if (highlight) {
    return (
      <div key={f.key} onMouseDown={onMouseDown} onClick={onClick}
        style={{ position:'absolute', left:pos.x, top:pos.y, zIndex:isSel?60:10,
          background:bgColor, borderRadius:brad, padding:`${padY}px ${padX}px`, minWidth:80,
          border: isSel?`2px dashed rgba(255,255,255,.7)`:isMul?'2px dashed #f59e0b':'2px dashed transparent',
          cursor:'grab', boxShadow:isSel?`0 0 0 3px ${c1}55`:'none', transition:'border .15s' }}>
        <span style={{ fontSize:fSize, fontWeight:fWeight, color:textColor,
          whiteSpace:'nowrap', letterSpacing:uppercase?1.5:0.2,
          textTransform:uppercase?'uppercase':'none', display:'block', fontFamily:fontFam }}>
          {displayVal}
        </span>
        {isSel && (
          <div style={{ position:'absolute', top:-16, left:0, fontSize:9, color:c1, fontWeight:700,
            whiteSpace:'nowrap', background:'#fff', padding:'1px 5px', borderRadius:4,
            border:`1px solid ${c1}44`, pointerEvents:'none' }}>↕↔ drag</div>
        )}
      </div>
    )
  }

  return (
    <div key={f.key} onMouseDown={onMouseDown} onClick={onClick}
      style={{ position:'absolute', left:pos.x, top:pos.y, zIndex:isSel?60:10,
        padding:`${padY}px ${padX}px`, borderRadius:5, minWidth:55,
        border: isSel?`1.5px dashed ${c1}`:isMul?'1.5px dashed #f59e0b':'1.5px dashed transparent',
        background: isSel?`${c1}11`:isMul?'#fef3c722':'transparent',
        cursor:'grab', transition:'border .15s, background .15s' }}>
      <div style={{ display:'flex', alignItems:'baseline', gap:0 }}>
        {showLabel && <span style={{ fontSize:lSize, fontWeight:700, color:'#555', whiteSpace:'nowrap' }}>{f.label}</span>}
        {showLabel && <span style={{ fontSize:lSize, fontWeight:700, color:'#555', margin:'0 3px' }}>{' : '}</span>}
        <span style={{ fontSize:fSize, fontWeight:fWeight, color:textColor, whiteSpace:'nowrap',
          textTransform:uppercase?'uppercase':'none', fontFamily:fontFam }}>{displayVal}</span>
      </div>
      {isSel && (
        <div style={{ position:'absolute', top:-16, left:0, fontSize:9, color:c1, fontWeight:700,
          whiteSpace:'nowrap', background:'#fff', padding:'1px 5px', borderRadius:4,
          border:`1px solid ${c1}44`, pointerEvents:'none' }}>↕↔ drag</div>
      )}
    </div>
  )
}

/* ══════════════════════════════════════════════════════════
   CARD CANVAS
══════════════════════════════════════════════════════════ */
function CardCanvas({ config, sub, orgName, onMove, selected, onSelect, multiSelected, onMultiSelect }) {
  const dragRef   = useRef(null)
  const [guides,  setGuides]  = useState([])
  const isDragging = useRef(false)
  const CW = config.cardW || 340
  const CH = config.cardH || 480
  const headerBg    = config.headerStyle==='gradient' ? `linear-gradient(135deg,${config.c1},${config.c2})` : config.c1
  const cardBorder  = config.borderStyle==='none' ? 'none' : config.borderStyle==='thick' ? `3px solid ${config.c1}` : `1.5px solid ${config.c1}55`
  const photoRadius = config.photoShape==='circle' ? '50%' : config.photoShape==='square' ? 4 : 10
  const getFieldPos = (key) => config.fieldPositions?.[key] || DEFAULT_FIELD_POSITIONS[key] || { x:20, y:200 }

  const getAllItems = useCallback((excludeKey) => {
    const items = []
    ALL_FIELDS.filter(f => config.visibleFields.includes(f.key)).forEach(f => {
      if (f.key === excludeKey) return
      const p = getFieldPos(f.key)
      items.push({ key:f.key, x:p.x, y:p.y, w:90, h:32 })
    })
    if (excludeKey !== '__photo__') {
      const pw = config.photoSize||72
      items.push({ key:'__photo__', x:config.photoX??16, y:config.photoY??90, w:pw, h:Math.round(pw*4/3) })
    }
    if (excludeKey !== '__qr__' && config.showQR) {
      const qs = config.qrSize||56
      const barcodeH = config.showBarcode ? 30 : 0
      const autoX = CW - qs - 10, autoY = CH - qs - barcodeH - 10
      items.push({ key:'__qr__', x:config.qrX??autoX, y:config.qrY??autoY, w:qs, h:qs })
    }
    return items
  }, [config])

  const startDrag = (e, key, curX, curY) => {
    e.preventDefault(); e.stopPropagation()
    onSelect(key)
    isDragging.current = false
    const pw = config.photoSize||72, ph = Math.round(pw*4/3)
    const isPhoto = key==='__photo__'
    const iW = isPhoto ? pw : 90, iH = isPhoto ? ph : 32
    dragRef.current = { key, sx:e.clientX, sy:e.clientY, ox:curX, oy:curY, iW, iH }

    const onMouseMove = (ev) => {
      if (!dragRef.current) return
      isDragging.current = true
      const dx = ev.clientX - dragRef.current.sx
      const dy = ev.clientY - dragRef.current.sy
      const maxX = isPhoto ? CW-pw : CW-80
      const maxY = isPhoto ? CH-ph-30 : CH-20
      let fx = snapTo(Math.max(0, Math.min(maxX, dragRef.current.ox+dx)))
      let fy = snapTo(Math.max(0, Math.min(maxY, dragRef.current.oy+dy)))

      const others = getAllItems(key)
      const gs = computeGuides(key, fx, fy, dragRef.current.iW, dragRef.current.iH, others)

      for (const g of gs) {
        if (g.axis==='v') {
          if (g.label==='L-L'||g.label==='T-B') fx = g.pos
          if (g.label==='R-R'||g.label==='L-R') fx = g.pos - dragRef.current.iW
          if (g.label==='C-C') fx = g.pos - dragRef.current.iW/2
        }
        if (g.axis==='h') {
          if (g.label==='T-T'||g.label==='B-T') fy = g.pos
          if (g.label==='B-B'||g.label==='T-B') fy = g.pos - dragRef.current.iH
          if (g.label==='M-M') fy = g.pos - dragRef.current.iH/2
        }
      }

      setGuides(computeGuides(key, fx, fy, dragRef.current.iW, dragRef.current.iH, others))
      onMove(key, fx, fy)
    }
    const onMouseUp = () => {
      dragRef.current = null; isDragging.current = false
      setGuides([])
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
  }

  const visibleFields = config.visibleFields
    .map(key => ALL_FIELDS.find(f => f.key === key))
    .filter(Boolean)
  const pw = config.photoSize||72, ph = Math.round(pw*4/3)
  const px = config.photoX??16,   py = config.photoY??90
  const isPhotoSel = selected==='__photo__'
  const headerH = config.orientation==='landscape' ? 64 : 80

  const cardRadius = config.cornerStyle === 'sharp' ? 0 : 16

  return (
    <div style={{ position:'relative', width:CW, height:CH, background:'#fff', borderRadius:cardRadius,
      overflow:'hidden', border:cardBorder, boxShadow:'0 12px 48px rgba(0,0,0,.18)',
      userSelect:'none', flexShrink:0, fontFamily:'Instrument Sans,sans-serif' }}>

      {config.bgImage && (
        <div style={{ position:'absolute', inset:0, zIndex:0, backgroundImage:`url(${config.bgImage})`,
          backgroundSize:config.bgFit==='repeat'?'auto':config.bgFit,
          backgroundRepeat:config.bgFit==='repeat'?'repeat':'no-repeat',
          backgroundPosition:'center', opacity:config.bgOpacity??0.15, pointerEvents:'none' }}/>
      )}

      {config.showHeader !== false && (
        <div style={{ position:'relative', zIndex:1, background:headerBg, height:headerH,
          display:'flex', alignItems:'center', gap:12, padding:'0 16px',
          justifyContent:config.logoPosition==='center'?'center':'flex-start',
          flexDirection:config.logoPosition==='center'?'column':'row' }}>
          <div style={{ width:40, height:40, borderRadius:10, background:'rgba(255,255,255,.22)',
            display:'flex', alignItems:'center', justifyContent:'center',
            fontFamily:'Outfit,sans-serif', fontWeight:900, fontSize:14, color:'#fff', flexShrink:0 }}>
            {(orgName||sub?.school_name||'SC').slice(0,2).toUpperCase()}
          </div>
          <div style={{ textAlign:config.logoPosition==='center'?'center':'left' }}>
            <div style={{ fontFamily:'Outfit,sans-serif', fontSize:12, fontWeight:800, color:'#fff', lineHeight:1.3 }}>
              {orgName||sub?.school_name||'Organization Name'}
            </div>
            <div style={{ fontSize:9, color:'rgba(255,255,255,.75)', marginTop:2 }}>{sub?.role||'Student'} Identity Card</div>
          </div>
        </div>
      )}

      {/* Photo */}
      <div onMouseDown={e => startDrag(e,'__photo__',px,py)}
        style={{ position:'absolute', left:px, top:py, width:pw, height:ph, zIndex:15,
          borderRadius:photoRadius, border:`2.5px solid ${config.c1}`,
          outline: isPhotoSel ? `2px dashed ${config.c1}` : multiSelected?.includes('__photo__') ? '2px dashed #f59e0b' : 'none',
          outlineOffset:3, background:config.accent,
          display:'flex', alignItems:'center', justifyContent:'center',
          overflow:'hidden', cursor:'grab', boxShadow:isPhotoSel?`0 0 0 4px ${config.c1}33`:'none',
          transition:'box-shadow .15s' }}>
        {sub?.photo_url
          ? <img src={sub.photo_url} style={{ width:'100%', height:'100%', objectFit:'cover', pointerEvents:'none' }} alt=""/>
          : <span style={{ fontSize:Math.round(pw*0.38), pointerEvents:'none' }}>👤</span>}
        {isPhotoSel && (
          <div style={{ position:'absolute', bottom:-20, left:0, fontSize:9, color:config.c1,
            fontWeight:700, whiteSpace:'nowrap', background:'#fff', padding:'2px 6px',
            borderRadius:4, border:`1px solid ${config.c1}44`, pointerEvents:'none' }}>↕↔ drag</div>
        )}
      </div>

      {/* Fields — DRAG mode: absolute positions */}
      {config.layoutMode !== 'flow' && visibleFields.map(f => {
        const pos   = getFieldPos(f.key)
        const val   = sub?.[f.key] || `[${f.label}]`
        const isSel = selected===f.key
        const isMul = multiSelected?.includes(f.key)
        return (
          <DragField key={f.key} f={f} config={config} val={val} isSel={isSel} isMul={isMul}
            onMouseDown={e => startDrag(e, f.key, pos.x, pos.y)}
            onClick={e => { e.stopPropagation(); if (e.shiftKey && onMultiSelect) onMultiSelect(f.key) }}
          />
        )
      })}

      {/* Fields — FLOW mode: tabular list, equal label column, value aligned */}
      {config.layoutMode === 'flow' && (() => {
        const fSize    = config.fontSize || 11
        const lSize    = Math.max(fSize - 1, 7)
        const lw       = config.labelWidth || 72
        const rowGap   = config.rowGap || 22
        const align    = config.fieldAlign || 'left'
        const headerH  = config.showHeader !== false ? (config.orientation === 'landscape' ? 64 : 80) : 0
        const pw       = config.photoSize || 72
        const ph       = Math.round(pw * 4 / 3)
        const px       = config.photoX ?? 16
        const py       = config.photoY ?? 90
        // auto startY: below photo bottom or below header, whichever is lower
        const autoStartY = Math.max(headerH + 8, py + ph + 10)
        const startY   = config.flowStartY ?? autoStartY
        // auto startX: right of photo if photo is in left region, else margin
        const photoRight = px + pw + 10
        const autoStartX = photoRight < CW * 0.55 ? photoRight : 12
        const startX   = config.flowStartX ?? autoStartX
        const availW   = CW - startX - 12

        return visibleFields.map((f, idx) => {
          const val       = sub?.[f.key] || `[${f.label}]`
          const topY      = startY + idx * rowGap
          const isSel     = selected === f.key
          const fs        = config.fieldStyles?.[f.key] || {}
          const highlight = fs.highlight || false
          const ffSize    = fs.fontSize  ?? fSize
          const ffWeight  = fs.fontWeight ?? (highlight ? 700 : 600)
          const textColor = fs.textColor  || (highlight ? '#fff' : '#1a1a2e')
          const bgColor   = fs.bgColor    || (config.c1 || '#2352ff')
          const uppercase = fs.uppercase  || false
          const showLabel = fs.showLabel  !== false
          const brad      = fs.borderRadius ?? 4
          const fontFam   = fs.fontFamily  || config.globalFontFamily || 'Instrument Sans'
          const displayVal = uppercase ? (val||'').toUpperCase() : val

          if (highlight) {
            return (
              <div key={f.key}
                onClick={e => { e.stopPropagation(); onSelect(f.key) }}
                style={{
                  position: 'absolute', left: startX, top: topY, width: availW, zIndex: isSel ? 60 : 10,
                  display: 'flex', alignItems: 'center',
                  background: bgColor, borderRadius: brad, padding: '3px 8px',
                  border: isSel ? `2px dashed rgba(255,255,255,.7)` : '2px dashed transparent',
                  cursor: 'default',
                  justifyContent: align === 'center' ? 'center' : align === 'right' ? 'flex-end' : 'flex-start',
                }}>
                <span style={{
                  fontSize: ffSize, fontWeight: ffWeight, color: textColor,
                  letterSpacing: uppercase ? 1.5 : 0.2, textTransform: uppercase ? 'uppercase' : 'none',
                  flex: 1, textAlign: align === 'center' ? 'center' : align === 'right' ? 'right' : 'left',
                  fontFamily: fontFam,
                }}>{displayVal}</span>
              </div>
            )
          }

          return (
            <div key={f.key}
              onClick={e => { e.stopPropagation(); onSelect(f.key) }}
              style={{
                position: 'absolute', left: startX, top: topY, width: availW, zIndex: isSel ? 60 : 10,
                display: 'flex', alignItems: 'baseline',
                border: isSel ? `1.5px dashed ${config.c1}` : '1.5px dashed transparent',
                background: isSel ? `${config.c1}09` : 'transparent',
                borderRadius: 4, padding: '1px 4px', cursor: 'default',
                justifyContent: align === 'center' ? 'center' : align === 'right' ? 'flex-end' : 'flex-start',
              }}>
              {showLabel && <span style={{
                fontSize: lSize, fontWeight: 700, color: '#333',
                width: lw, minWidth: lw, flexShrink: 0, whiteSpace: 'nowrap',
                textAlign: align === 'right' ? 'right' : 'left',
              }}>{f.label}</span>}
              {showLabel && <span style={{ fontSize: lSize, fontWeight: 700, color: '#555', margin: '0 4px 0 0', flexShrink: 0 }}>:</span>}
              <span style={{
                fontSize: ffSize, fontWeight: ffWeight, color: textColor,
                flex: 1, wordBreak: 'break-word', lineHeight: 1.3,
                textAlign: align === 'right' ? 'right' : 'left',
                textTransform: uppercase ? 'uppercase' : 'none',
                fontFamily: fontFam,
              }}>{displayVal}</span>
            </div>
          )
        })
      })()}

      {/* Snap grid dots — only while dragging */}
      {isDragging.current && (
        <svg style={{ position:'absolute', inset:0, width:'100%', height:'100%', zIndex:3, pointerEvents:'none', opacity:.12 }}>
          {Array.from({ length:Math.floor(CW/SNAP)+1 }, (_,i) =>
            Array.from({ length:Math.floor(CH/SNAP)+1 }, (_,j) => (
              <circle key={`${i}-${j}`} cx={i*SNAP} cy={j*SNAP} r={0.8} fill="#2352ff"/>
            ))
          )}
        </svg>
      )}

      {/* Guide lines */}
      {guides.map((g,i) => (
        <div key={i} style={{
          position:'absolute', zIndex:100, pointerEvents:'none',
          background: g.label==='C-C'||g.label==='M-M' ? '#8b5cf6' : '#ef4444',
          opacity:.9,
          ...(g.axis==='v' ? { left:g.pos, top:g.from, width:1, height:g.to-g.from }
                           : { top:g.pos, left:g.from, height:1, width:g.to-g.from })
        }}/>
      ))}

      {/* QR Code */}
      {config.showQR && (
        <QRElement
          config={config}
          sub={sub}
          onMove={onMove}
          selected={selected}
          onSelect={onSelect}
        />
      )}

      {/* Barcode */}
      {config.showBarcode && (
        <div style={{ position:'absolute', bottom:0, left:0, right:0, zIndex:5,
          background:`${config.c1}12`, padding:'7px 14px',
          display:'flex', justifyContent:'space-between', alignItems:'center',
          borderTop:`1px solid ${config.c1}22` }}>
          <div style={{ display:'flex', gap:1.5, alignItems:'flex-end' }}>
            {Array.from({length:28},(_,i) => (
              <div key={i} style={{ width:1.5, height:9+Math.abs(Math.sin(i*2.3))*11, background:config.c1, opacity:.6, borderRadius:1 }}/>
            ))}
          </div>
          <div style={{ fontSize:9, fontFamily:'JetBrains Mono,monospace', color:config.c1, fontWeight:600, opacity:.8 }}>
            {(sub?.id||'ID000000').slice(0,8).toUpperCase()}
          </div>
        </div>
      )}

      {visibleFields.length===0 && (
        <div style={{ position:'absolute', left:100, top:110, color:'#ddd', fontSize:12, fontWeight:600, lineHeight:1.8, zIndex:20 }}>
          ← Add fields<br/>from panel
        </div>
      )}
    </div>
  )
}

/* ══════════════════════════════════════════════════════════
   ALIGNMENT TOOLBAR  (MS Word / PowerPoint style)
══════════════════════════════════════════════════════════ */
function AlignIcon({ type }) {
  const s = { width:16, height:16, display:'block' }
  const map = {
    /* Align to card */
    'card-left':   <svg {...s} viewBox="0 0 16 16"><rect x="2" y="2" width="1.5" height="12" fill="currentColor" rx=".5"/><rect x="4" y="4.5" width="8" height="2.5" fill="currentColor" rx="1" opacity=".5"/><rect x="4" y="9" width="5" height="2.5" fill="currentColor" rx="1"/></svg>,
    'card-ch':     <svg {...s} viewBox="0 0 16 16"><rect x="7.25" y="1" width="1.5" height="14" fill="currentColor" rx=".5"/><rect x="3" y="4.5" width="10" height="2.5" fill="currentColor" rx="1" opacity=".5"/><rect x="4.5" y="9" width="7" height="2.5" fill="currentColor" rx="1"/></svg>,
    'card-right':  <svg {...s} viewBox="0 0 16 16"><rect x="12.5" y="2" width="1.5" height="12" fill="currentColor" rx=".5"/><rect x="4" y="4.5" width="8" height="2.5" fill="currentColor" rx="1" opacity=".5"/><rect x="7" y="9" width="5" height="2.5" fill="currentColor" rx="1"/></svg>,
    'card-top':    <svg {...s} viewBox="0 0 16 16"><rect x="2" y="2" width="12" height="1.5" fill="currentColor" rx=".5"/><rect x="4.5" y="4" width="2.5" height="8" fill="currentColor" rx="1" opacity=".5"/><rect x="9" y="4" width="2.5" height="5" fill="currentColor" rx="1"/></svg>,
    'card-mv':     <svg {...s} viewBox="0 0 16 16"><rect x="2" y="7.25" width="12" height="1.5" fill="currentColor" rx=".5"/><rect x="4.5" y="3" width="2.5" height="10" fill="currentColor" rx="1" opacity=".5"/><rect x="9" y="5" width="2.5" height="6" fill="currentColor" rx="1"/></svg>,
    'card-bottom': <svg {...s} viewBox="0 0 16 16"><rect x="2" y="12.5" width="12" height="1.5" fill="currentColor" rx=".5"/><rect x="4.5" y="4" width="2.5" height="8" fill="currentColor" rx="1" opacity=".5"/><rect x="9" y="7" width="2.5" height="5" fill="currentColor" rx="1"/></svg>,
    /* Align group (amber) */
    'grp-left':   <svg {...s} viewBox="0 0 16 16"><rect x="2" y="2" width="1.5" height="12" fill="currentColor" rx=".5"/><rect x="4" y="3.5" width="9" height="3" fill="#f59e0b" rx="1"/><rect x="4" y="9.5" width="6" height="3" fill="#f59e0b" rx="1" opacity=".8"/></svg>,
    'grp-ch':     <svg {...s} viewBox="0 0 16 16"><rect x="7.25" y="1" width="1.5" height="14" fill="currentColor" rx=".5"/><rect x="3" y="3.5" width="10" height="3" fill="#f59e0b" rx="1"/><rect x="4.5" y="9.5" width="7" height="3" fill="#f59e0b" rx="1" opacity=".8"/></svg>,
    'grp-right':  <svg {...s} viewBox="0 0 16 16"><rect x="12.5" y="2" width="1.5" height="12" fill="currentColor" rx=".5"/><rect x="3" y="3.5" width="9" height="3" fill="#f59e0b" rx="1"/><rect x="6" y="9.5" width="6" height="3" fill="#f59e0b" rx="1" opacity=".8"/></svg>,
    'grp-top':    <svg {...s} viewBox="0 0 16 16"><rect x="2" y="2" width="12" height="1.5" fill="currentColor" rx=".5"/><rect x="3.5" y="4" width="3" height="9" fill="#f59e0b" rx="1"/><rect x="9.5" y="4" width="3" height="6" fill="#f59e0b" rx="1" opacity=".8"/></svg>,
    'grp-mv':     <svg {...s} viewBox="0 0 16 16"><rect x="2" y="7.25" width="12" height="1.5" fill="currentColor" rx=".5"/><rect x="3.5" y="2" width="3" height="12" fill="#f59e0b" rx="1"/><rect x="9.5" y="4" width="3" height="8" fill="#f59e0b" rx="1" opacity=".8"/></svg>,
    'grp-bottom': <svg {...s} viewBox="0 0 16 16"><rect x="2" y="12.5" width="12" height="1.5" fill="currentColor" rx=".5"/><rect x="3.5" y="3" width="3" height="9" fill="#f59e0b" rx="1"/><rect x="9.5" y="6" width="3" height="6" fill="#f59e0b" rx="1" opacity=".8"/></svg>,
    /* Distribute */
    'dist-h':     <svg {...s} viewBox="0 0 16 16"><rect x="1" y="4" width="1.5" height="8" fill="currentColor" rx=".5"/><rect x="13.5" y="4" width="1.5" height="8" fill="currentColor" rx=".5"/><rect x="6" y="5" width="4" height="6" fill="#f59e0b" rx="1"/></svg>,
    'dist-v':     <svg {...s} viewBox="0 0 16 16"><rect x="4" y="1" width="8" height="1.5" fill="currentColor" rx=".5"/><rect x="4" y="13.5" width="8" height="1.5" fill="currentColor" rx=".5"/><rect x="5" y="6" width="6" height="4" fill="#f59e0b" rx="1"/></svg>,
  }
  return map[type] || null
}

function AlignToolbar({ selected, multiSelected, config, onAlignOne, onAlignMulti, onDistribute, onNudge }) {
  const CW      = config.cardW || 340
  const CH      = config.cardH || 480
  const hasOne  = !!(selected && selected !== '__photo__' || selected === '__photo__')
  const hasAny  = !!(selected)
  const hasGrp  = multiSelected && multiSelected.length >= 2
  const has3    = multiSelected && multiSelected.length >= 3
  const c1      = config.c1 || '#2352ff'

  const btn = (onClick, iconType, tip, enabled, highlight) => (
    <button title={tip} onClick={enabled ? onClick : undefined}
      style={{
        width:30, height:30, borderRadius:7, border:`1.5px solid ${highlight && enabled ? c1 : 'var(--border)'}`,
        background: highlight && enabled ? `${c1}14` : 'var(--paper)',
        color: enabled ? (highlight ? c1 : 'var(--ink2)') : 'var(--ink3)',
        cursor: enabled ? 'pointer' : 'not-allowed', opacity: enabled ? 1 : 0.38,
        display:'flex', alignItems:'center', justifyContent:'center',
        transition:'all .13s', flexShrink:0, padding:0,
      }}>
      <AlignIcon type={iconType} />
    </button>
  )

  const alignToCard = (type) => {
    if (!hasAny) return
    const key = selected
    const pos = config.fieldPositions?.[key] || DEFAULT_FIELD_POSITIONS[key] || { x:20, y:200 }
    const isPhoto = key === '__photo__'
    const pw = config.photoSize||72
    const W = isPhoto ? pw : 90
    const H = isPhoto ? Math.round(pw*4/3) : 32
    let x = pos.x, y = pos.y
    if (type==='L')  x = 0
    if (type==='CH') x = Math.round((CW-W)/2)
    if (type==='R')  x = CW-W
    if (type==='T')  y = 0
    if (type==='MV') y = Math.round((CH-H)/2)
    if (type==='B')  y = CH-H-(config.showBarcode?26:0)
    onAlignOne(key, snapTo(x), snapTo(y))
    toast.success(`Aligned to card`)
  }

  const getPos = (k) => {
    const p = config.fieldPositions?.[k] || DEFAULT_FIELD_POSITIONS[k] || { x:20, y:200 }
    const isPhoto = k==='__photo__'
    const pw = config.photoSize||72
    return { x:p.x, y:p.y, w:isPhoto?pw:90, h:isPhoto?Math.round(pw*4/3):32 }
  }

  const alignGroup = (type) => {
    if (!hasGrp) return
    const items = multiSelected.map(k => ({ key:k, ...getPos(k) }))
    let refX, refY
    if (type==='L')  refX = Math.min(...items.map(p=>p.x))
    if (type==='R')  refX = Math.max(...items.map(p=>p.x+p.w))
    if (type==='CH') refX = Math.round(items.reduce((s,p)=>s+p.x+p.w/2,0)/items.length)
    if (type==='T')  refY = Math.min(...items.map(p=>p.y))
    if (type==='B')  refY = Math.max(...items.map(p=>p.y+p.h))
    if (type==='MV') refY = Math.round(items.reduce((s,p)=>s+p.y+p.h/2,0)/items.length)
    const updates = items.map(p => {
      let nx=p.x, ny=p.y
      if (type==='L')  nx=refX
      if (type==='R')  nx=refX-p.w
      if (type==='CH') nx=refX-Math.round(p.w/2)
      if (type==='T')  ny=refY
      if (type==='B')  ny=refY-p.h
      if (type==='MV') ny=refY-Math.round(p.h/2)
      return { key:p.key, x:snapTo(nx), y:snapTo(ny) }
    })
    onAlignMulti(updates)
    toast.success('Fields aligned')
  }

  const Div = () => <div style={{ width:1, height:20, background:'var(--border)', flexShrink:0, margin:'0 2px' }}/>
  const Label = ({ t, amber }) => (
    <span style={{ fontSize:9, fontWeight:700, color:amber&&hasGrp?'#d97706':'var(--ink3)',
      textTransform:'uppercase', letterSpacing:.5, whiteSpace:'nowrap', padding:'0 4px' }}>{t}</span>
  )

  return (
    <div style={{ display:'flex', alignItems:'center', gap:3, padding:'6px 10px',
      background:'var(--paper)', borderRadius:10, border:'1px solid var(--border)',
      boxShadow:'0 2px 8px rgba(0,0,0,.07)', flexWrap:'wrap', rowGap:6 }}>

      <Label t="To card" />
      {btn(() => alignToCard('L'),  'card-left',   'Align Left to Card',            hasAny)}
      {btn(() => alignToCard('CH'), 'card-ch',     'Center Horizontal on Card',     hasAny)}
      {btn(() => alignToCard('R'),  'card-right',  'Align Right to Card',           hasAny)}
      {btn(() => alignToCard('T'),  'card-top',    'Align Top to Card',             hasAny)}
      {btn(() => alignToCard('MV'), 'card-mv',     'Center Vertical on Card',       hasAny)}
      {btn(() => alignToCard('B'),  'card-bottom', 'Align Bottom to Card',          hasAny)}

      <Div/>
      <Label t="Group" amber />
      {btn(() => alignGroup('L'),  'grp-left',   'Align Left Edges',              hasGrp, true)}
      {btn(() => alignGroup('CH'), 'grp-ch',     'Center Horizontally',           hasGrp, true)}
      {btn(() => alignGroup('R'),  'grp-right',  'Align Right Edges',             hasGrp, true)}
      {btn(() => alignGroup('T'),  'grp-top',    'Align Top Edges',               hasGrp, true)}
      {btn(() => alignGroup('MV'), 'grp-mv',     'Center Vertically',             hasGrp, true)}
      {btn(() => alignGroup('B'),  'grp-bottom', 'Align Bottom Edges',            hasGrp, true)}

      <Div/>
      <Label t="Distribute" amber />
      {btn(() => onDistribute('h'), 'dist-h', 'Distribute Horizontally (need 3+)', has3, true)}
      {btn(() => onDistribute('v'), 'dist-v', 'Distribute Vertically (need 3+)',   has3, true)}

      <Div/>
      <Label t="Nudge" />
      {[['←',-SNAP,0,'Nudge Left'],['↑',0,-SNAP,'Nudge Up'],['↓',0,SNAP,'Nudge Down'],['→',SNAP,0,'Nudge Right']].map(([icon,dx,dy,tip]) => (
        <button key={tip} title={tip} onClick={() => hasAny && onNudge(selected,dx,dy)}
          style={{ width:30, height:30, borderRadius:7, border:'1.5px solid var(--border)',
            background:'var(--paper)', color: hasAny?'var(--ink2)':'var(--ink3)',
            cursor: hasAny?'pointer':'not-allowed', opacity: hasAny?1:0.38,
            fontSize:13, fontWeight:700, display:'flex', alignItems:'center', justifyContent:'center',
            flexShrink:0, transition:'all .13s' }}>
          {icon}
        </button>
      ))}

      {/* Live position readout */}
      {selected && (() => {
        const pos = config.fieldPositions?.[selected] || DEFAULT_FIELD_POSITIONS[selected] || { x:0, y:0 }
        const pp = selected==='__photo__' ? { x:config.photoX??16, y:config.photoY??90 } : pos
        return (
          <div style={{ marginLeft:6, fontFamily:'JetBrains Mono,monospace', fontSize:10,
            color:'var(--ink3)', background:'var(--paper2)', borderRadius:6,
            padding:'3px 8px', border:'1px solid var(--border)', whiteSpace:'nowrap' }}>
            x:{pp.x} y:{pp.y}
          </div>
        )
      })()}

      {multiSelected && multiSelected.length > 0 && (
        <div style={{ marginLeft:4, fontSize:10, fontWeight:700, color:'#b45309',
          background:'#fef3c7', borderRadius:6, padding:'3px 8px',
          border:'1px solid #fcd34d', whiteSpace:'nowrap' }}>
          {multiSelected.length} selected
        </div>
      )}
    </div>
  )
}

/* ══════════════════════════════════════════════════════════
   MAIN BUILDER
══════════════════════════════════════════════════════════ */
export default function IDCardBuilder() {
  const navigate     = useNavigate()
  const [searchParams] = useSearchParams()
  const editId         = searchParams.get('edit')   // present when editing an existing template

  const { submissions, loading: subLoading } = useSubmissions()
  const { organizations }                    = useOrganizations()
  const { templates, saveTemplate, updateTemplate } = useCardTemplates()

  const [config,        setConfig]       = useState(DEFAULT_CONFIG)
  const [templateName,  setTemplateName] = useState('')
  const [selectedOrg,   setSelectedOrg]  = useState('')
  const [previewIdx,    setPreviewIdx]   = useState(0)
  const [saving,        setSaving]       = useState(false)
  const [bgUploading,   setBgUploading]  = useState(false)
  const [activeTab,     setActiveTab]    = useState('fields')
  const [selected,      setSelected]     = useState(null)
  const [multiSelected, setMultiSelected]= useState([])
  const [panelOpen,     setPanelOpen]    = useState(false)
  const [dragFieldIdx,  setDragFieldIdx] = useState(null)   // index of Active Field being dragged
  const [dragOverIdx,   setDragOverIdx]  = useState(null)   // index currently being hovered over while dragging
  const [photoSizeDraft, setPhotoSizeDraft] = useState(null)  // null = show config value; string = mid-typing
  const [fontSizeDraft,  setFontSizeDraft]  = useState(null)
  const [fsFontDraft,    setFsFontDraft]    = useState(null)

  useEffect(() => { setFsFontDraft(null) }, [selected])  // reset per-field draft when switching fields
  const bgInputRef    = useRef(null)
  const editLoaded    = useRef(false)   // prevents re-loading on every templates update

  /* ── Load existing template when ?edit=ID is present ── */
  useEffect(() => {
    if (!editId || !templates.length || editLoaded.current) return
    const tpl = templates.find(t => t.id === editId)
    if (!tpl) { toast.error('Template not found'); return }
    editLoaded.current = true
    setTemplateName(tpl.name || '')
    setSelectedOrg(tpl.org_id || '')
    setConfig({ ...DEFAULT_CONFIG, ...(tpl.config || {}) })
  }, [editId, templates])

  const approved   = submissions.filter(s => s.status==='approved')
  const previewSub = approved[previewIdx] || null
  const orgName    = organizations.find(o => o.id===selectedOrg)?.name || previewSub?.school_name || ''

  const upd = useCallback((key, val) => setConfig(p => ({ ...p, [key]:val })), [])

  const onMove = useCallback((key, x, y) => {
    if (key==='__photo__') setConfig(p => ({ ...p, photoX:x, photoY:y }))
    else if (key==='__qr__') setConfig(p => ({ ...p, qrX:x, qrY:y }))
    else setConfig(p => ({ ...p, fieldPositions:{ ...(p.fieldPositions||{}), [key]:{x,y} } }))
  }, [])

  const handleSelect = (key) => { setSelected(key); setMultiSelected([]) }

  const handleMultiSelect = (key) => {
    setMultiSelected(prev => {
      const next = prev.includes(key) ? prev.filter(k=>k!==key) : [...prev,key]
      if (next.length > 0) setSelected(null)
      return next
    })
  }

  const toggleField = (key) => {
    setConfig(p => {
      const on = p.visibleFields.includes(key)
      if (on) return { ...p, visibleFields: p.visibleFields.filter(k=>k!==key) }
      const nextVisible = [...p.visibleFields, key]
      return { ...p, visibleFields: nextVisible, fieldPositions: reflowFieldPositions(nextVisible, p) }
    })
    if (!config.visibleFields.includes(key)) setSelected(key)
  }

  // Reorder a field within visibleFields (drag-and-drop in the Active Fields list).
  // Card positions auto-recompute from this order via reflowFieldPositions().
  const reorderField = (fromIdx, toIdx) => {
    setConfig(p => {
      const arr = [...p.visibleFields]
      const [moved] = arr.splice(fromIdx, 1)
      arr.splice(toIdx, 0, moved)
      return { ...p, visibleFields: arr, fieldPositions: reflowFieldPositions(arr, p) }
    })
  }

  // Recompute stacked Y positions for all visible fields based on their order in the array.
  // Only applies to fields using simple top-to-bottom stacking (x stays as-is or default).
  const reflowFieldPositions = (orderedKeys, p) => {
    const FIELD_START_Y = 100, FIELD_STACK_GAP = 30, FIELD_START_X = 110
    const next = { ...(p.fieldPositions || {}) }
    orderedKeys.forEach((key, idx) => {
      const prevX = next[key]?.x ?? DEFAULT_FIELD_POSITIONS[key]?.x ?? FIELD_START_X
      next[key] = { x: prevX, y: FIELD_START_Y + idx * FIELD_STACK_GAP }
    })
    return next
  }

  const applyPreset = (k) => {
    const preset = SIZE_PRESETS[k]; if (!preset) return
    setConfig(p => ({ ...p, sizePreset:k, cardW:preset.w, cardH:preset.h, orientation:preset.h>preset.w?'portrait':'landscape', fieldPositions:{}, photoX:16, photoY:preset.h>preset.w?90:16, photoSize:72 }))
    toast(`Card size: ${preset.label}`)
  }

  const applyLayout = (key) => {
    const layout = LAYOUT_PRESETS[key]; if (!layout) return
    setConfig(p => ({
      ...p,
      cardW:          layout.cardW,
      cardH:          layout.cardH,
      sizePreset:     'custom',
      orientation:    layout.orientation,
      photoX:         layout.photoX,
      photoY:         layout.photoY,
      photoSize:      layout.photoSize,
      fieldPositions: layout.fieldPositions,
    }))
    setSelected(null); setMultiSelected([])
    toast.success(`Layout: ${layout.label}`)
  }

  const setCardW = (w) => setConfig(p => ({ ...p, cardW:w, sizePreset:'custom' }))
  const setCardH = (h) => setConfig(p => ({ ...p, cardH:h, sizePreset:'custom' }))

  const flipOrientation = () => {
    setConfig(p => ({ ...p, cardW:p.cardH, cardH:p.cardW, orientation:p.cardH>p.cardW?'portrait':'landscape', fieldPositions:{}, photoX:16, photoY:16, photoSize:p.photoSize }))
    toast('Orientation flipped')
  }

  const handleBgUpload = async (e) => {
    const file = e.target.files?.[0]; if (!file) return
    if (file.size > 3*1024*1024) { toast.error('Max 3MB'); return }
    setBgUploading(true)
    try { const url = await uploadBgImage(file); upd('bgImage', url); toast.success('Background uploaded') }
    catch { toast.error('Upload failed') }
    finally { setBgUploading(false); e.target.value='' }
  }

  const resetLayout = () => {
    setConfig(p => ({ ...p, fieldPositions:{}, photoX:16, photoY:90, photoSize:72, qrX:null, qrY:null }))
    setSelected(null); setMultiSelected([])
    toast.success('Layout reset')
  }

  const handleSave = async () => {
    if (!templateName.trim()) { toast.error('Enter template name'); return }
    if (config.visibleFields.length===0) { toast.error('Add at least one field'); return }
    setSaving(true)
    try {
      if (editId) {
        /* ── UPDATE existing template ── */
        await updateTemplate(editId, { name:templateName.trim(), org_id:selectedOrg||null, org_name:orgName||null, config })
        toast.success(`"${templateName.trim()}" updated!`)
      } else {
        /* ── CREATE new template ── */
        await saveTemplate({ name:templateName.trim(), org_id:selectedOrg||null, org_name:orgName||null, config })
        toast.success(`"${templateName.trim()}" saved!`)
      }
      navigate('/templates')
    } catch (err) { toast.error(err.message||'Failed') }
    finally { setSaving(false) }
  }

  /* alignment callbacks */
  const handleAlignOne   = useCallback((key,x,y) => onMove(key,x,y), [onMove])

  const handleAlignMulti = useCallback((updates) => {
    setConfig(p => {
      const fp = { ...(p.fieldPositions||{}) }
      let px = p.photoX, py2 = p.photoY
      for (const { key, x, y } of updates) {
        if (key==='__photo__') { px=x; py2=y } else fp[key]={x,y}
      }
      return { ...p, fieldPositions:fp, photoX:px, photoY:py2 }
    })
  }, [])

  const handleDistribute = useCallback((axis) => {
    if (!multiSelected || multiSelected.length < 3) return
    const getP = (k) => {
      const p = config.fieldPositions?.[k] || DEFAULT_FIELD_POSITIONS[k] || { x:20,y:200 }
      const pw = config.photoSize||72
      const isPhoto = k==='__photo__'
      return { x:p.x, y:p.y, w:isPhoto?pw:90, h:isPhoto?Math.round(pw*4/3):32 }
    }
    const items = multiSelected.map(k => ({ key:k, ...getP(k) }))
    if (axis==='h') {
      const sorted = [...items].sort((a,b)=>a.x-b.x)
      const totalW = sorted.reduce((s,i)=>s+i.w,0)
      const span   = (sorted[sorted.length-1].x+sorted[sorted.length-1].w) - sorted[0].x
      const gap    = (span-totalW)/(sorted.length-1)
      let cx = sorted[0].x
      handleAlignMulti(sorted.map(it => { const u={ key:it.key, x:snapTo(cx), y:it.y }; cx+=it.w+gap; return u }))
    } else {
      const sorted = [...items].sort((a,b)=>a.y-b.y)
      const totalH = sorted.reduce((s,i)=>s+i.h,0)
      const span   = (sorted[sorted.length-1].y+sorted[sorted.length-1].h) - sorted[0].y
      const gap    = (span-totalH)/(sorted.length-1)
      let cy = sorted[0].y
      handleAlignMulti(sorted.map(it => { const u={ key:it.key, x:it.x, y:snapTo(cy) }; cy+=it.h+gap; return u }))
    }
    toast.success('Fields distributed')
  }, [multiSelected, config, handleAlignMulti])

  const handleNudge = useCallback((key,dx,dy) => {
    if (!key) return
    const CW2 = config.cardW||340, CH2 = config.cardH||480
    if (key === '__qr__') {
      const qs = config.qrSize||56
      const barcodeH = config.showBarcode ? 30 : 0
      const autoX = CW2 - qs - 10, autoY = CH2 - qs - barcodeH - 10
      const cx = config.qrX ?? autoX, cy = config.qrY ?? autoY
      onMove('__qr__', snapTo(Math.max(0,Math.min(CW2-qs,cx+dx))), snapTo(Math.max(0,Math.min(CH2-qs,cy+dy))))
      return
    }
    const p   = key==='__photo__' ? { x:config.photoX??16, y:config.photoY??90 } : (config.fieldPositions?.[key] || DEFAULT_FIELD_POSITIONS[key] || { x:20,y:200 })
    const pw  = config.photoSize||72, ph = Math.round(pw*4/3)
    const isPhoto = key==='__photo__'
    const maxX = isPhoto ? CW2-pw : CW2-80
    const maxY = isPhoto ? CH2-ph-30 : CH2-20
    onMove(key, snapTo(Math.max(0,Math.min(maxX,p.x+dx))), snapTo(Math.max(0,Math.min(maxY,p.y+dy))))
  }, [config, onMove])

  if (subLoading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh' }}>
      <Spinner size={40}/>
    </div>
  )

  const CW = config.cardW||340, CH = config.cardH||480

  const PanelContent = () => {
    return (
    <>
      <div style={{ display:'flex', borderBottom:'1px solid var(--border)', flexShrink:0 }}>
        {[['fields','📋'],['style','🎨'],['canvas','📐'],['settings','⚙']].map(([id,icon]) => (
          <button key={id} onClick={() => setActiveTab(id)}
            style={{ flex:1, padding:'10px 2px', border:'none', fontSize:11, fontWeight:700, cursor:'pointer',
              background:'transparent', color:activeTab===id?'var(--blue)':'var(--ink3)',
              borderBottom:activeTab===id?'2px solid var(--blue)':'2px solid transparent',
              fontFamily:'inherit', transition:'color .15s' }}>
            {icon} {id.charAt(0).toUpperCase()+id.slice(1)}
          </button>
        ))}
      </div>

      <div style={{ padding:'14px 12px', flex:1, overflowY:'auto' }}>

        {activeTab==='fields' && (
          <div>
            <div style={{ padding:'8px 10px', background:'var(--blue-s)', borderRadius:8, border:'1px solid var(--blue-m)', marginBottom:12, fontSize:11, color:'var(--blue)', lineHeight:1.7 }}>
              Drag fields to position •{' '}
              <strong>Shift+click</strong> 2+ fields to align them as a group
            </div>
            {config.visibleFields.length > 0 && (
              <div style={{ marginBottom:12 }}>
                <div style={{ fontSize:10, fontWeight:700, color:'var(--ink3)', textTransform:'uppercase', letterSpacing:.6, marginBottom:4 }}>Active Fields</div>
                <div style={{ fontSize:10, color:'var(--ink3)', marginBottom:7 }}>🖐 Drag to reorder — order here = order on the card</div>
                {config.visibleFields.map((key, idx) => {
                  const f = ALL_FIELDS.find(ff => ff.key === key)
                  if (!f) return null
                  const isSel = selected===f.key
                  const isMul = multiSelected.includes(f.key)
                  const pos   = config.fieldPositions?.[f.key] || DEFAULT_FIELD_POSITIONS[f.key] || {x:20,y:200}
                  const isDragging = dragFieldIdx === idx
                  const isDragOver  = dragOverIdx === idx
                  return (
                    <div key={f.key}
                      draggable
                      onDragStart={() => setDragFieldIdx(idx)}
                      onDragOver={e => { e.preventDefault(); setDragOverIdx(idx) }}
                      onDragEnd={() => { setDragFieldIdx(null); setDragOverIdx(null) }}
                      onDrop={e => {
                        e.preventDefault()
                        if (dragFieldIdx !== null && dragFieldIdx !== idx) reorderField(dragFieldIdx, idx)
                        setDragFieldIdx(null); setDragOverIdx(null)
                      }}
                      onClick={e => e.shiftKey ? handleMultiSelect(f.key) : handleSelect(isSel?null:f.key)}
                      style={{ display:'flex', alignItems:'center', gap:8, padding:'7px 9px',
                        borderRadius:8,
                        border: isDragOver?'1.5px dashed var(--blue)':isSel?`1.5px solid var(--blue)`:isMul?'1.5px solid #f59e0b':'1.5px solid var(--border)',
                        background: isDragging?'var(--paper3)':isSel?'var(--blue-s)':isMul?'#fef3c722':'var(--paper2)',
                        opacity: isDragging ? 0.4 : 1,
                        cursor:'pointer', marginBottom:5, transition:'all .15s' }}>
                      <span style={{ fontSize:13, cursor:'grab', color:'var(--ink3)', flexShrink:0 }}>⠿</span>
                      <span style={{ fontSize:13 }}>{f.icon}</span>
                      <span style={{ flex:1, fontSize:12, fontWeight:600, color:isSel?'var(--blue)':isMul?'#b45309':'var(--ink2)' }}>{f.label}</span>
                      <span style={{ fontSize:10, color:'var(--ink3)', fontFamily:'JetBrains Mono,monospace' }}>{pos.x},{pos.y}</span>
                      <button onClick={e=>{e.stopPropagation();toggleField(f.key)}}
                        style={{ width:18, height:18, borderRadius:'50%', border:'none', background:'var(--red-s)', color:'var(--red)', cursor:'pointer', fontSize:10, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>✕</button>
                    </div>
                  )
                })}
              </div>
            )}
            {/* ── Per-field style panel — shown when a field is selected ── */}
            {selected && config.visibleFields.includes(selected) && (() => {
              const fs    = config.fieldStyles?.[selected] || {}
              const fInfo = ALL_FIELDS.find(f => f.key === selected)
              const updFS = (k, v) => setConfig(p => ({
                ...p,
                fieldStyles: { ...(p.fieldStyles||{}), [selected]: { ...(p.fieldStyles?.[selected]||{}), [k]: v } }
              }))
              const resetFS = () => setConfig(p => {
                const next = { ...(p.fieldStyles||{}) }; delete next[selected]
                return { ...p, fieldStyles: next }
              })
              return (
                <div style={{ marginBottom:14, padding:'12px', background:'var(--paper2)', borderRadius:10, border:`1.5px solid var(--blue-m)` }}>
                  <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
                    <div style={{ fontSize:11, fontWeight:800, color:'var(--blue)' }}>✦ Style: {fInfo?.icon} {fInfo?.label}</div>
                    <button onClick={resetFS} style={{ fontSize:10, padding:'2px 8px', borderRadius:5, border:'1px solid var(--border)', background:'var(--red-s)', color:'var(--red)', cursor:'pointer', fontFamily:'inherit', fontWeight:700 }}>↺ Reset</button>
                  </div>

                  {/* Highlight toggle */}
                  <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10, padding:'8px 10px', background:'var(--paper)', borderRadius:8, border:'1px solid var(--border)' }}>
                    <div>
                      <div style={{ fontSize:12, fontWeight:700, color:'var(--ink)' }}>Highlight Badge</div>
                      <div style={{ fontSize:10, color:'var(--ink3)', marginTop:1 }}>Coloured banner like "SEJAL BHAGAT"</div>
                    </div>
                    <div onClick={() => updFS('highlight', !fs.highlight)}
                      style={{ width:38, height:22, borderRadius:11, background:fs.highlight?'var(--blue)':'var(--border2)', transition:'background .2s', cursor:'pointer', position:'relative', flexShrink:0 }}>
                      <div style={{ width:18, height:18, borderRadius:'50%', background:'#fff', position:'absolute', top:2, left:fs.highlight?18:2, transition:'left .2s', boxShadow:'0 1px 3px rgba(0,0,0,.2)' }}/>
                    </div>
                  </div>

                  {/* Badge color */}
                  {fs.highlight && (
                    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'6px 0', borderBottom:'1px solid var(--border)', marginBottom:8 }}>
                      <span style={{ fontSize:11, color:'var(--ink2)' }}>Badge Color</span>
                      <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                        <input type="color" value={fs.bgColor||config.c1||'#2352ff'} onChange={e=>updFS('bgColor',e.target.value)}
                          style={{ width:26, height:26, borderRadius:6, border:'1.5px solid var(--border)', padding:2, cursor:'pointer' }}/>
                        <span style={{ fontSize:10, fontFamily:'JetBrains Mono,monospace', color:'var(--ink3)' }}>{fs.bgColor||config.c1||'#2352ff'}</span>
                      </div>
                    </div>
                  )}

                  {/* Text color */}
                  <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'6px 0', borderBottom:'1px solid var(--border)', marginBottom:8 }}>
                    <span style={{ fontSize:11, color:'var(--ink2)' }}>Text Color</span>
                    <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                      <input type="color" value={fs.textColor||(fs.highlight?'#ffffff':'#1a1a2e')} onChange={e=>updFS('textColor',e.target.value)}
                        style={{ width:26, height:26, borderRadius:6, border:'1.5px solid var(--border)', padding:2, cursor:'pointer' }}/>
                      <span style={{ fontSize:10, fontFamily:'JetBrains Mono,monospace', color:'var(--ink3)' }}>{fs.textColor||(fs.highlight?'#ffffff':'#1a1a2e')}</span>
                    </div>
                  </div>

{/* Font size */}
                  <div style={{ marginBottom:8 }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:4 }}>
                      <span style={{ fontSize:11, color:'var(--ink3)', fontWeight:600 }}>Font Size</span>
<input type="text" inputMode="numeric" pattern="[0-9]*"
                        value={fsFontDraft ?? String(fs.fontSize??(config.fontSize||11))}
                        onChange={e=>{
                          const raw = e.target.value.replace(/[^0-9]/g, '')
                          setFsFontDraft(raw)
                          if (raw !== '') updFS('fontSize', Number(raw))
                        }}
                        onBlur={e=>{
                          const clamped = Math.min(28, Math.max(8, Number(e.target.value)||11))
                          updFS('fontSize', clamped)
                          setFsFontDraft(null)
                        }}
                        onKeyDown={e=>{ if (e.key==='Enter') e.target.blur() }}
                        style={{ width:50, padding:'2px 6px', borderRadius:5, border:'1px solid var(--border)', fontSize:11, fontFamily:'JetBrains Mono,monospace', color:'var(--blue)', fontWeight:700, textAlign:'right', outline:'none' }}/>
                    </div>
                    <input type="range" min={8} max={28} step={1} value={fs.fontSize??(config.fontSize||11)}
                      onChange={e=>updFS('fontSize',Number(e.target.value))} style={{ width:'100%', accentColor:'#2352ff' }}/>
                  </div>

                  {/* Font weight */}
                  <div style={{ marginBottom:8 }}>
                    <div style={{ fontSize:10, fontWeight:700, color:'var(--ink3)', textTransform:'uppercase', letterSpacing:.5, marginBottom:6 }}>Font Weight</div>
                    <div style={{ display:'flex', gap:5 }}>
                      {[[400,'Regular'],[600,'Semi'],[700,'Bold'],[800,'Extra'],[900,'Black']].map(([w,lbl])=>(
                        <button key={w} onClick={()=>updFS('fontWeight',w)}
                          style={{ flex:1, padding:'5px 2px', borderRadius:7,
                            border:`1.5px solid ${(fs.fontWeight??600)===w?'var(--blue)':'var(--border)'}`,
                            background:(fs.fontWeight??600)===w?'var(--blue-s)':'transparent',
                            color:(fs.fontWeight??600)===w?'var(--blue)':'var(--ink3)',
                            fontSize:10, fontWeight:w, cursor:'pointer', fontFamily:'inherit' }}>{lbl}</button>
                      ))}
                    </div>
                  </div>

                  {/* Font Family */}
                  <div style={{ marginBottom:8 }}>
                    <div style={{ fontSize:10, fontWeight:700, color:'var(--ink3)', textTransform:'uppercase', letterSpacing:.5, marginBottom:6 }}>Font Style</div>
                    <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
                      {[
                        { val:'Instrument Sans,sans-serif', label:'Default (Instrument Sans)' },
                        { val:'Times New Roman,Times,serif', label:'Times New Roman' },
                        { val:'Calibri,Gill Sans,sans-serif', label:'Calibri' },
                        { val:'Georgia,serif', label:'Georgia' },
                        { val:'Arial,Helvetica,sans-serif', label:'Arial' },
                        { val:'Courier New,monospace', label:'Courier New' },
                      ].map(({ val, label }) => {
                        const active = (fs.fontFamily || 'Instrument Sans,sans-serif') === val
                        return (
                          <button key={val} onClick={() => updFS('fontFamily', val)}
                            style={{ padding:'6px 10px', borderRadius:7, textAlign:'left',
                              border:`1.5px solid ${active?'var(--blue)':'var(--border)'}`,
                              background: active ? 'var(--blue-s)' : 'transparent',
                              color: active ? 'var(--blue)' : 'var(--ink2)',
                              fontSize:12, cursor:'pointer', fontFamily:val, fontWeight: active ? 700 : 500 }}>
                            {label}
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  {/* Uppercase & Show Label */}
                  <div style={{ display:'flex', gap:8, marginBottom:8 }}>
                    {[['uppercase','UPPERCASE',fs.uppercase||false],['showLabel','Show Label',fs.showLabel!==false]].map(([k,lbl,on])=>(
                      <div key={k} onClick={()=>updFS(k, k==='showLabel'?!(fs.showLabel!==false):!fs[k])}
                        style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'space-between',
                          padding:'6px 8px', borderRadius:8, border:`1.5px solid ${on?'var(--blue)':'var(--border)'}`,
                          background:on?'var(--blue-s)':'var(--paper)', cursor:'pointer', gap:6 }}>
                        <span style={{ fontSize:10, fontWeight:700, color:on?'var(--blue)':'var(--ink3)' }}>{lbl}</span>
                        <div style={{ width:28, height:16, borderRadius:8, background:on?'var(--blue)':'var(--border2)', position:'relative', flexShrink:0 }}>
                          <div style={{ width:12, height:12, borderRadius:'50%', background:'#fff', position:'absolute', top:2, left:on?14:2, transition:'left .15s' }}/>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Border radius (highlight only) */}
                  {fs.highlight && (
                    <div style={{ marginBottom:8 }}>
                      <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
                        <span style={{ fontSize:11, color:'var(--ink3)', fontWeight:600 }}>Corner Radius</span>
                        <span style={{ fontSize:11, fontFamily:'JetBrains Mono,monospace', color:'var(--blue)', fontWeight:700, background:'var(--blue-s)', borderRadius:5, padding:'1px 6px' }}>{fs.borderRadius??4}px</span>
                      </div>
                      <input type="range" min={0} max={24} step={2} value={fs.borderRadius??4}
                        onChange={e=>updFS('borderRadius',Number(e.target.value))} style={{ width:'100%', accentColor:'#2352ff' }}/>
                    </div>
                  )}

                  {/* Live preview */}
                  <div style={{ marginTop:10, padding:'8px 10px', background:'var(--paper)', borderRadius:8, border:'1px solid var(--border)' }}>
                    <div style={{ fontSize:9, color:'var(--ink3)', marginBottom:6, fontWeight:700, textTransform:'uppercase', letterSpacing:.5 }}>Preview</div>
                    {fs.highlight
                      ? <div style={{ display:'inline-block', background:fs.bgColor||config.c1||'#2352ff', borderRadius:fs.borderRadius??4, padding:'3px 10px' }}>
                          <span style={{ fontSize:fs.fontSize??(config.fontSize||11), fontWeight:fs.fontWeight??700, color:fs.textColor||'#fff', letterSpacing:fs.uppercase?1.5:0.2, textTransform:fs.uppercase?'uppercase':'none', fontFamily:fs.fontFamily||'Instrument Sans,sans-serif' }}>
                            {fs.uppercase?(fInfo?.label||'Name').toUpperCase():fInfo?.label||'Name'}
                          </span>
                        </div>
                      : <span style={{ fontSize:fs.fontSize??(config.fontSize||11), fontWeight:fs.fontWeight??600, color:fs.textColor||'#1a1a2e', textTransform:fs.uppercase?'uppercase':'none', fontFamily:fs.fontFamily||'Instrument Sans,sans-serif' }}>
                          {fs.showLabel!==false&&<span style={{ fontSize:Math.max((fs.fontSize??(config.fontSize||11))-1,7), fontWeight:700, color:'#555' }}>{fInfo?.label||'Name'} : </span>}
                          {fs.uppercase?'SAMPLE VALUE':'Sample Value'}
                        </span>
                    }
                  </div>
                </div>
              )
            })()}

                        <div style={{ fontSize:10, fontWeight:700, color:'var(--ink3)', textTransform:'uppercase', letterSpacing:.6, marginBottom:7 }}>Add Fields</div>
            {ALL_FIELDS.filter(f => !config.visibleFields.includes(f.key)).map(f => (
              <div key={f.key} onClick={() => { toggleField(f.key); setPanelOpen(false) }}
                style={{ display:'flex', alignItems:'center', gap:8, padding:'7px 9px', borderRadius:8, border:'1.5px solid var(--border)', background:'var(--paper)', cursor:'pointer', marginBottom:5, transition:'all .15s' }}
                onMouseEnter={e=>{e.currentTarget.style.borderColor='var(--blue)';e.currentTarget.style.background='var(--blue-s)'}}
                onMouseLeave={e=>{e.currentTarget.style.borderColor='var(--border)';e.currentTarget.style.background='var(--paper)'}}>
                <span style={{ fontSize:13 }}>{f.icon}</span>
                <span style={{ flex:1, fontSize:12, color:'var(--ink2)' }}>{f.label}</span>
                <span style={{ fontSize:18, color:'var(--ink3)', lineHeight:1 }}>+</span>
              </div>
            ))}
          </div>
        )}

        {activeTab==='style' && (
          <div>
            <div style={{ marginBottom:14 }}>
              <div style={{ fontSize:10, fontWeight:700, color:'var(--ink3)', textTransform:'uppercase', letterSpacing:.6, marginBottom:7 }}>Organization</div>
              <select value={selectedOrg} onChange={e=>setSelectedOrg(e.target.value)}
                style={{ width:'100%', padding:'8px 10px', borderRadius:8, border:'1.5px solid var(--border)', background:'var(--paper)', color:'var(--ink)', fontSize:12, fontFamily:'inherit', cursor:'pointer', outline:'none' }}>
                <option value="">-- No specific org --</option>
                {organizations.map(o=><option key={o.id} value={o.id}>{o.name}</option>)}
              </select>
            </div>
            <div style={{ marginBottom:14 }}>
              <div style={{ fontSize:10, fontWeight:700, color:'var(--ink3)', textTransform:'uppercase', letterSpacing:.6, marginBottom:7 }}>Colors</div>
              {[['Primary',config.c1,v=>upd('c1',v)],['Secondary',config.c2,v=>upd('c2',v)],['Accent',config.accent,v=>upd('accent',v)]].map(([l,v,fn])=>(
                <div key={l} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'6px 0', borderBottom:'1px solid var(--border)' }}>
                  <span style={{ fontSize:12, color:'var(--ink2)' }}>{l}</span>
                  <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                    <input type="color" value={v} onChange={e=>fn(e.target.value)} style={{ width:26, height:26, borderRadius:6, border:'1.5px solid var(--border)', padding:2, cursor:'pointer' }}/>
                    <span style={{ fontSize:10, fontFamily:'JetBrains Mono,monospace', color:'var(--ink3)' }}>{v}</span>
                  </div>
                </div>
              ))}
            </div>
            <div style={{ marginBottom:14 }}>
              <div style={{ fontSize:10, fontWeight:700, color:'var(--ink3)', textTransform:'uppercase', letterSpacing:.6, marginBottom:7 }}>Header Style</div>
              <div style={{ display:'flex', gap:8 }}>
                {['gradient','solid'].map(v=>(
                  <button key={v} onClick={()=>upd('headerStyle',v)}
                    style={{ flex:1, padding:'8px', borderRadius:8, border:`1.5px solid ${config.headerStyle===v?'var(--blue)':'var(--border)'}`, background:config.headerStyle===v?'var(--blue-s)':'transparent', color:config.headerStyle===v?'var(--blue)':'var(--ink3)', fontSize:11, fontWeight:700, cursor:'pointer', fontFamily:'inherit', textTransform:'capitalize' }}>{v}</button>
                ))}
              </div>
            </div>
            <div style={{ marginBottom:14 }}>
              <div style={{ fontSize:10, fontWeight:700, color:'var(--ink3)', textTransform:'uppercase', letterSpacing:.6, marginBottom:7 }}>Photo</div>
              <div onClick={()=>setSelected(selected==='__photo__'?null:'__photo__')}
                style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 10px', borderRadius:8, border:`1.5px solid ${selected==='__photo__'?'var(--blue)':'var(--border)'}`, background:selected==='__photo__'?'var(--blue-s)':'var(--paper2)', cursor:'pointer', marginBottom:10, transition:'all .15s' }}>
                <span style={{ fontSize:16 }}>🖼</span>
                <span style={{ flex:1, fontSize:12, fontWeight:600, color:selected==='__photo__'?'var(--blue)':'var(--ink2)' }}>Photo</span>
                <span style={{ fontSize:10, color:'var(--ink3)' }}>{config.photoSize||72}×{Math.round((config.photoSize||72)*4/3)}px</span>
              </div>
<div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:4 }}>
                  <span style={{ fontSize:11, color:'var(--ink3)' }}>Size</span>
<input type="text" inputMode="numeric" pattern="[0-9]*"
                    value={photoSizeDraft ?? String(config.photoSize||72)}
                    onChange={e=>{
                      const raw = e.target.value.replace(/[^0-9]/g, '')  // digits only, no length limit
                      setPhotoSizeDraft(raw)
                      if (raw !== '') upd('photoSize', Number(raw))
                    }}
                    onBlur={e=>{
                      const clamped = Math.min(180, Math.max(40, Number(e.target.value)||72))
                      upd('photoSize', clamped)
                      setPhotoSizeDraft(null)
                    }}
                    onKeyDown={e=>{ if (e.key==='Enter') e.target.blur() }}
                    style={{ width:56, padding:'2px 6px', borderRadius:5, border:'1px solid var(--border)', fontSize:11, fontFamily:'JetBrains Mono,monospace', color:'var(--blue)', fontWeight:700, textAlign:'right', outline:'none' }}/>
                </div>
              <div style={{ fontSize:10, color:'var(--ink3)', marginBottom:5, fontWeight:600 }}>Shape</div>
              <div style={{ display:'flex', gap:6 }}>
                {['square','rounded','circle'].map(v=>(
                  <button key={v} onClick={()=>upd('photoShape',v)}
                    style={{ flex:1, padding:'7px 4px', borderRadius:8, border:`1.5px solid ${config.photoShape===v?'var(--blue)':'var(--border)'}`, background:config.photoShape===v?'var(--blue-s)':'transparent', color:config.photoShape===v?'var(--blue)':'var(--ink3)', fontSize:11, fontWeight:700, cursor:'pointer', fontFamily:'inherit', textTransform:'capitalize' }}>{v}</button>
                ))}
              </div>
            </div>
            <div>
              <div style={{ fontSize:10, fontWeight:700, color:'var(--ink3)', textTransform:'uppercase', letterSpacing:.6, marginBottom:7 }}>Border</div>
              <div style={{ display:'flex', gap:8 }}>
                {['none','thin','thick'].map(v=>(
                  <button key={v} onClick={()=>upd('borderStyle',v)}
                    style={{ flex:1, padding:'8px', borderRadius:8, border:`1.5px solid ${config.borderStyle===v?'var(--blue)':'var(--border)'}`, background:config.borderStyle===v?'var(--blue-s)':'transparent', color:config.borderStyle===v?'var(--blue)':'var(--ink3)', fontSize:11, fontWeight:700, cursor:'pointer', fontFamily:'inherit', textTransform:'capitalize' }}>{v}</button>
                ))}
              </div>
            </div>

            {/* ── Corners ── */}
            <div style={{ marginTop:14 }}>
              <div style={{ fontSize:10, fontWeight:700, color:'var(--ink3)', textTransform:'uppercase', letterSpacing:.6, marginBottom:7 }}>Corners</div>
              <div style={{ display:'flex', gap:8 }}>
                {[
                  { v:'rounded', label:'Rounded', icon:'⬭' },
                  { v:'sharp',   label:'Sharp',   icon:'▭' },
                ].map(({ v, label, icon }) => {
                  const active = (config.cornerStyle || 'rounded') === v
                  return (
                    <button key={v} onClick={() => upd('cornerStyle', v)}
                      style={{
                        flex:1, padding:'10px 8px', borderRadius:8,
                        border:`1.5px solid ${active ? 'var(--blue)' : 'var(--border)'}`,
                        background: active ? 'var(--blue-s)' : 'transparent',
                        color: active ? 'var(--blue)' : 'var(--ink3)',
                        fontSize:11, fontWeight:700, cursor:'pointer',
                        fontFamily:'inherit',
                        display:'flex', flexDirection:'column', alignItems:'center', gap:4,
                        transition:'all .15s',
                      }}>
                      <span style={{ fontSize:18, lineHeight:1 }}>{icon}</span>
                      <span>{label}</span>
                    </button>
                  )
                })}
              </div>
              <div style={{ fontSize:10, color:'var(--ink3)', marginTop:6, lineHeight:1.5 }}>
                {(config.cornerStyle || 'rounded') === 'sharp'
                  ? '▭ Sharp — straight 90° edges, no rounding'
                  : '⬭ Rounded — smooth curved corners (default)'}
              </div>
            </div>
          </div>
        )}

        {activeTab==='canvas' && (
          <div>
            <div style={{ marginBottom:16 }}>
              <div style={{ fontSize:10, fontWeight:700, color:'var(--ink3)', textTransform:'uppercase', letterSpacing:.6, marginBottom:8 }}>Orientation</div>
              <div style={{ display:'flex', gap:8 }}>
                <button onClick={() => { if(config.cardH<=config.cardW) return; flipOrientation() }}
                  style={{ flex:1, padding:'10px 8px', borderRadius:8, border:`1.5px solid ${(config.cardH||480)>(config.cardW||340)?'var(--blue)':'var(--border)'}`, background:(config.cardH||480)>(config.cardW||340)?'var(--blue-s)':'transparent', color:(config.cardH||480)>(config.cardW||340)?'var(--blue)':'var(--ink3)', fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>
                  <div style={{ fontSize:18, marginBottom:3 }}>🪪</div>Portrait
                </button>
                <button onClick={() => { if(config.cardW>config.cardH) return; flipOrientation() }}
                  style={{ flex:1, padding:'10px 8px', borderRadius:8, border:`1.5px solid ${(config.cardW||340)>(config.cardH||480)?'var(--blue)':'var(--border)'}`, background:(config.cardW||340)>(config.cardH||480)?'var(--blue-s)':'transparent', color:(config.cardW||340)>(config.cardH||480)?'var(--blue)':'var(--ink3)', fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>
                  <div style={{ fontSize:18, marginBottom:3 }}>💳</div>Landscape
                </button>
              </div>
            </div>
            {/* ── Layout Presets ── */}
            <div style={{ marginBottom:16 }}>
              <div style={{ fontSize:10, fontWeight:700, color:'var(--ink3)', textTransform:'uppercase', letterSpacing:.6, marginBottom:4 }}>Layout Presets</div>
              <div style={{ fontSize:11, color:'var(--ink3)', marginBottom:8, lineHeight:1.5 }}>
                One-click field arrangement for portrait &amp; landscape cards
              </div>

              {/* Portrait layouts */}
              <div style={{ fontSize:10, fontWeight:700, color:'var(--blue)', textTransform:'uppercase', letterSpacing:.5, marginBottom:6, display:'flex', alignItems:'center', gap:6 }}>
                <span>🪪</span> Portrait
              </div>
              <div style={{ display:'flex', flexDirection:'column', gap:6, marginBottom:12 }}>
                {Object.entries(LAYOUT_PRESETS).filter(([,l])=>l.orientation==='portrait').map(([key,layout]) => {
                  const isActive = config.cardW===layout.cardW && config.cardH===layout.cardH &&
                    config.photoX===layout.photoX && config.photoY===layout.photoY && config.photoSize===layout.photoSize
                  return (
                    <div key={key} onClick={() => applyLayout(key)}
                      style={{ padding:'9px 11px', borderRadius:9,
                        border:`1.5px solid ${isActive?'var(--blue)':'var(--border)'}`,
                        background:isActive?'var(--blue-s)':'var(--paper2)',
                        cursor:'pointer', transition:'all .15s', display:'flex', alignItems:'center', gap:10 }}
                      onMouseEnter={e=>{ if(!isActive){e.currentTarget.style.borderColor='var(--blue)';e.currentTarget.style.background='var(--blue-s)'}}}
                      onMouseLeave={e=>{ if(!isActive){e.currentTarget.style.borderColor='var(--border)';e.currentTarget.style.background='var(--paper2)'}}}>
                      <span style={{ fontSize:20, flexShrink:0 }}>{layout.icon}</span>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ fontSize:12, fontWeight:700, color:isActive?'var(--blue)':'var(--ink)', marginBottom:1 }}>{layout.label}</div>
                        <div style={{ fontSize:10, color:'var(--ink3)', lineHeight:1.4 }}>{layout.desc}</div>
                      </div>
                      <div style={{ fontSize:9, color:'var(--ink3)', fontFamily:'JetBrains Mono,monospace', flexShrink:0 }}>{layout.cardW}×{layout.cardH}</div>
                    </div>
                  )
                })}
              </div>

              {/* Landscape layouts */}
              <div style={{ fontSize:10, fontWeight:700, color:'#059669', textTransform:'uppercase', letterSpacing:.5, marginBottom:6, display:'flex', alignItems:'center', gap:6 }}>
                <span>💳</span> Landscape
              </div>
              <div style={{ display:'flex', flexDirection:'column', gap:6, marginBottom:8 }}>
                {Object.entries(LAYOUT_PRESETS).filter(([,l])=>l.orientation==='landscape').map(([key,layout]) => {
                  const isActive = config.cardW===layout.cardW && config.cardH===layout.cardH &&
                    config.photoX===layout.photoX && config.photoY===layout.photoY && config.photoSize===layout.photoSize
                  return (
                    <div key={key} onClick={() => applyLayout(key)}
                      style={{ padding:'9px 11px', borderRadius:9,
                        border:`1.5px solid ${isActive?'#059669':'var(--border)'}`,
                        background:isActive?'#d1fae5':'var(--paper2)',
                        cursor:'pointer', transition:'all .15s', display:'flex', alignItems:'center', gap:10 }}
                      onMouseEnter={e=>{ if(!isActive){e.currentTarget.style.borderColor='#059669';e.currentTarget.style.background='#d1fae5'}}}
                      onMouseLeave={e=>{ if(!isActive){e.currentTarget.style.borderColor='var(--border)';e.currentTarget.style.background='var(--paper2)'}}}>
                      <span style={{ fontSize:20, flexShrink:0 }}>{layout.icon}</span>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ fontSize:12, fontWeight:700, color:isActive?'#059669':'var(--ink)', marginBottom:1 }}>{layout.label}</div>
                        <div style={{ fontSize:10, color:'var(--ink3)', lineHeight:1.4 }}>{layout.desc}</div>
                      </div>
                      <div style={{ fontSize:9, color:'var(--ink3)', fontFamily:'JetBrains Mono,monospace', flexShrink:0 }}>{layout.cardW}×{layout.cardH}</div>
                    </div>
                  )
                })}
              </div>

              <div style={{ padding:'8px 10px', background:'var(--amber-s)', borderRadius:7, border:'1px solid #fcd34d', fontSize:11, color:'#92400e', lineHeight:1.5 }}>
                💡 Applying a layout resets all field positions. You can still drag fields after.
              </div>
            </div>

            <div style={{ marginBottom:16 }}>
              <div style={{ fontSize:10, fontWeight:700, color:'var(--ink3)', textTransform:'uppercase', letterSpacing:.6, marginBottom:8 }}>Size Presets</div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6 }}>
                {Object.entries(SIZE_PRESETS).map(([key,preset]) => {
                  const isSel = config.sizePreset===key
                  return (
                    <div key={key} onClick={() => applyPreset(key)}
                      style={{ padding:'8px 10px', borderRadius:8, border:`1.5px solid ${isSel?'var(--blue)':'var(--border)'}`, background:isSel?'var(--blue-s)':'var(--paper2)', cursor:'pointer', transition:'all .15s', textAlign:'center' }}>
                      <div style={{ fontSize:11, fontWeight:700, color:isSel?'var(--blue)':'var(--ink2)', marginBottom:2 }}>{preset.label}</div>
                      <div style={{ fontSize:10, color:'var(--ink3)', fontFamily:'JetBrains Mono,monospace' }}>{preset.w}×{preset.h}</div>
                    </div>
                  )
                })}
              </div>
            </div>
            <div style={{ marginBottom:16 }}>
              <div style={{ fontSize:10, fontWeight:700, color:'var(--ink3)', textTransform:'uppercase', letterSpacing:.6, marginBottom:8 }}>Custom Size</div>
              {[['Width',config.cardW||340,setCardW,200,600],['Height',config.cardH||480,setCardH,200,700]].map(([label,val,setter,min,max]) => (
                <div key={label} style={{ marginBottom:10 }}>
                  <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
                    <span style={{ fontSize:11, color:'var(--ink3)' }}>{label}</span>
                    <span style={{ fontSize:11, fontFamily:'JetBrains Mono,monospace', color:'var(--blue)', fontWeight:700 }}>{val}px</span>
                  </div>
                  <input type="range" min={min} max={max} step={10} value={val} onChange={e=>setter(Number(e.target.value))} style={{ width:'100%', accentColor:'#2352ff' }}/>
                </div>
              ))}
            </div>
            <div>
              <div style={{ fontSize:10, fontWeight:700, color:'var(--ink3)', textTransform:'uppercase', letterSpacing:.6, marginBottom:8 }}>Background Image</div>
              {config.bgImage ? (
                <div style={{ marginBottom:10 }}>
                  <div style={{ width:'100%', height:80, borderRadius:8, overflow:'hidden', marginBottom:8, border:'1px solid var(--border)', position:'relative' }}>
                    <img src={config.bgImage} style={{ width:'100%', height:'100%', objectFit:'cover' }} alt="bg preview"/>
                    <button onClick={() => upd('bgImage',null)}
                      style={{ position:'absolute', top:4, right:4, width:22, height:22, borderRadius:'50%', border:'none', background:'rgba(0,0,0,.6)', color:'#fff', cursor:'pointer', fontSize:12, display:'flex', alignItems:'center', justifyContent:'center' }}>✕</button>
                  </div>
                  <div style={{ marginBottom:8 }}>
                    <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
                      <span style={{ fontSize:11, color:'var(--ink3)' }}>Opacity</span>
                      <span style={{ fontSize:11, fontFamily:'JetBrains Mono,monospace', color:'var(--blue)', fontWeight:700 }}>{Math.round((config.bgOpacity||0.15)*100)}%</span>
                    </div>
                    <input type="range" min={5} max={100} step={5} value={Math.round((config.bgOpacity||0.15)*100)} onChange={e=>upd('bgOpacity',Number(e.target.value)/100)} style={{ width:'100%', accentColor:'#2352ff' }}/>
                  </div>
                  <div style={{ fontSize:10, color:'var(--ink3)', marginBottom:5, fontWeight:600 }}>Fit</div>
                  <div style={{ display:'flex', gap:6 }}>
                    {['cover','contain','repeat'].map(v=>(
                      <button key={v} onClick={()=>upd('bgFit',v)}
                        style={{ flex:1, padding:'6px 4px', borderRadius:7, border:`1.5px solid ${config.bgFit===v?'var(--blue)':'var(--border)'}`, background:config.bgFit===v?'var(--blue-s)':'transparent', color:config.bgFit===v?'var(--blue)':'var(--ink3)', fontSize:10, fontWeight:700, cursor:'pointer', fontFamily:'inherit', textTransform:'capitalize' }}>{v}</button>
                    ))}
                  </div>
                </div>
              ) : (
                <div onClick={() => !bgUploading && bgInputRef.current?.click()}
                  style={{ width:'100%', padding:'20px 12px', borderRadius:8, border:`2px dashed ${bgUploading?'var(--blue)':'var(--border)'}`, background:bgUploading?'var(--blue-s)':'var(--paper2)', cursor:bgUploading?'not-allowed':'pointer', textAlign:'center', transition:'all .15s' }}
                  onMouseEnter={e=>{ if(!bgUploading){e.currentTarget.style.borderColor='var(--blue)';e.currentTarget.style.background='var(--blue-s)'}}}
                  onMouseLeave={e=>{ if(!bgUploading){e.currentTarget.style.borderColor='var(--border)';e.currentTarget.style.background='var(--paper2)'}}}>
                  <div style={{ fontSize:24, marginBottom:6 }}>{bgUploading?'⏳':'🖼'}</div>
                  <div style={{ fontSize:12, fontWeight:700, color:'var(--ink2)', marginBottom:3 }}>{bgUploading?'Uploading...':'Upload Background'}</div>
                  <div style={{ fontSize:11, color:'var(--ink3)' }}>JPG, PNG · Max 3MB</div>
                </div>
              )}
              <input ref={bgInputRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={handleBgUpload} style={{ display:'none' }}/>
            </div>
          </div>
        )}

        {activeTab==='settings' && (
          <div>

            {/* ── Layout Mode ── */}
            <div style={{ marginBottom:16 }}>
              <div style={{ fontSize:10, fontWeight:700, color:'var(--ink3)', textTransform:'uppercase', letterSpacing:.6, marginBottom:7 }}>Field Layout Mode</div>
              <div style={{ display:'flex', gap:8, marginBottom:10 }}>
                {[
                  { val:'drag', icon:'✥', title:'Drag Mode',   desc:'Free drag & drop positioning' },
                  { val:'flow', icon:'☰', title:'Flow Mode',   desc:'Auto tabular list — like a real ID card' },
                ].map(({ val, icon, title, desc }) => (
                  <div key={val} onClick={() => upd('layoutMode', val)}
                    style={{ flex:1, padding:'10px 8px', borderRadius:9, textAlign:'center',
                      border:`1.5px solid ${config.layoutMode===val?'var(--blue)':'var(--border)'}`,
                      background:config.layoutMode===val?'var(--blue-s)':'var(--paper2)',
                      cursor:'pointer', transition:'all .15s' }}>
                    <div style={{ fontSize:20, marginBottom:4 }}>{icon}</div>
                    <div style={{ fontSize:11, fontWeight:700, color:config.layoutMode===val?'var(--blue)':'var(--ink)' }}>{title}</div>
                    <div style={{ fontSize:9, color:'var(--ink3)', marginTop:2, lineHeight:1.4 }}>{desc}</div>
                  </div>
                ))}
              </div>

              {/* Flow mode controls */}
              {config.layoutMode === 'flow' && (
                <div style={{ padding:'12px', background:'var(--paper2)', borderRadius:10, border:'1px solid var(--border)', display:'flex', flexDirection:'column', gap:12 }}>

                  {/* Field Alignment */}
                  <div>
                    <div style={{ fontSize:10, fontWeight:700, color:'var(--ink3)', textTransform:'uppercase', letterSpacing:.5, marginBottom:7 }}>Field Alignment</div>
                    <div style={{ display:'flex', gap:6 }}>
                      {[
                        { val:'left',   icon:'⬅', label:'Left'   },
                        { val:'center', icon:'↔', label:'Center' },
                        { val:'right',  icon:'➡', label:'Right'  },
                      ].map(({ val, icon, label }) => (
                        <button key={val} onClick={() => upd('fieldAlign', val)}
                          style={{ flex:1, padding:'8px 4px', borderRadius:8,
                            border:`1.5px solid ${config.fieldAlign===val?'var(--blue)':'var(--border)'}`,
                            background:config.fieldAlign===val?'var(--blue-s)':'transparent',
                            color:config.fieldAlign===val?'var(--blue)':'var(--ink3)',
                            fontSize:11, fontWeight:700, cursor:'pointer', fontFamily:'inherit', display:'flex', flexDirection:'column', alignItems:'center', gap:3 }}>
                          <span style={{ fontSize:14 }}>{icon}</span>
                          <span>{label}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Label Column Width */}
                  <div>
                    <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
                      <span style={{ fontSize:11, color:'var(--ink3)', fontWeight:600 }}>Label Column Width</span>
                      <span style={{ fontSize:11, fontFamily:'JetBrains Mono,monospace', color:'var(--blue)', fontWeight:700, background:'var(--blue-s)', borderRadius:5, padding:'1px 6px' }}>{config.labelWidth||72}px</span>
                    </div>
                    <input type="range" min={40} max={140} step={4}
                      value={config.labelWidth||72}
                      onChange={e => upd('labelWidth', Number(e.target.value))}
                      style={{ width:'100%', accentColor:'#2352ff' }}/>
                    <div style={{ display:'flex', justifyContent:'space-between', marginTop:2 }}>
                      <span style={{ fontSize:9, color:'var(--ink3)' }}>40px · Narrow</span>
                      <span style={{ fontSize:9, color:'var(--ink3)' }}>140px · Wide</span>
                    </div>
                  </div>

                  {/* Row Gap */}
                  <div>
                    <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
                      <span style={{ fontSize:11, color:'var(--ink3)', fontWeight:600 }}>Row Spacing</span>
                      <span style={{ fontSize:11, fontFamily:'JetBrains Mono,monospace', color:'var(--blue)', fontWeight:700, background:'var(--blue-s)', borderRadius:5, padding:'1px 6px' }}>{config.rowGap||22}px</span>
                    </div>
                    <input type="range" min={14} max={40} step={2}
                      value={config.rowGap||22}
                      onChange={e => upd('rowGap', Number(e.target.value))}
                      style={{ width:'100%', accentColor:'#2352ff' }}/>
                    <div style={{ display:'flex', justifyContent:'space-between', marginTop:2 }}>
                      <span style={{ fontSize:9, color:'var(--ink3)' }}>Compact</span>
                      <span style={{ fontSize:9, color:'var(--ink3)' }}>Spacious</span>
                    </div>
                  </div>

                  {/* Fields Start Y (manual override) */}
                  <div>
                    <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
                      <span style={{ fontSize:11, color:'var(--ink3)', fontWeight:600 }}>Fields Start Y</span>
                      <div style={{ display:'flex', gap:6, alignItems:'center' }}>
                        {config.flowStartY !== null && config.flowStartY !== undefined && (
                          <button onClick={() => upd('flowStartY', null)}
                            style={{ fontSize:9, padding:'1px 6px', borderRadius:5, border:'1px solid var(--border)', background:'var(--red-s)', color:'var(--red)', cursor:'pointer', fontFamily:'inherit', fontWeight:700 }}>Auto</button>
                        )}
                        <span style={{ fontSize:11, fontFamily:'JetBrains Mono,monospace', color:'var(--blue)', fontWeight:700, background:'var(--blue-s)', borderRadius:5, padding:'1px 6px' }}>
                          {config.flowStartY ?? 'auto'}px
                        </span>
                      </div>
                    </div>
                    <input type="range" min={60} max={config.cardH||480 - 80} step={4}
                      value={config.flowStartY ?? (() => {
                        const headerH = config.showHeader !== false ? (config.orientation==='landscape' ? 64 : 80) : 0
                        const ph = Math.round((config.photoSize||72)*4/3)
                        return Math.max(headerH + 8, (config.photoY??90) + ph + 10)
                      })()}
                      onChange={e => upd('flowStartY', Number(e.target.value))}
                      style={{ width:'100%', accentColor:'#2352ff' }}/>
                    <div style={{ fontSize:9, color:'var(--ink3)', marginTop:2 }}>
                      Push "Auto" to reset back to automatic position
                    </div>
                  </div>

                  {/* Fields Start X (manual override) */}
                  <div>
                    <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
                      <span style={{ fontSize:11, color:'var(--ink3)', fontWeight:600 }}>Fields Start X</span>
                      <div style={{ display:'flex', gap:6, alignItems:'center' }}>
                        {config.flowStartX !== null && config.flowStartX !== undefined && (
                          <button onClick={() => upd('flowStartX', null)}
                            style={{ fontSize:9, padding:'1px 6px', borderRadius:5, border:'1px solid var(--border)', background:'var(--red-s)', color:'var(--red)', cursor:'pointer', fontFamily:'inherit', fontWeight:700 }}>Auto</button>
                        )}
                        <span style={{ fontSize:11, fontFamily:'JetBrains Mono,monospace', color:'var(--blue)', fontWeight:700, background:'var(--blue-s)', borderRadius:5, padding:'1px 6px' }}>
                          {config.flowStartX ?? 'auto'}px
                        </span>
                      </div>
                    </div>
                    <input type="range" min={8} max={(config.cardW||340) - 100} step={4}
                      value={config.flowStartX ?? (() => {
                        const pw = config.photoSize||72
                        const photoRight = (config.photoX??16) + pw + 10
                        return photoRight < (config.cardW||340) * 0.55 ? photoRight : 12
                      })()}
                      onChange={e => upd('flowStartX', Number(e.target.value))}
                      style={{ width:'100%', accentColor:'#2352ff' }}/>
                    <div style={{ fontSize:9, color:'var(--ink3)', marginTop:2 }}>
                      Auto positions fields to the right of the photo
                    </div>
                  </div>

                </div>
              )}
            </div>

            <div style={{ marginBottom:14 }}>
              <div style={{ fontSize:10, fontWeight:700, color:'var(--ink3)', textTransform:'uppercase', letterSpacing:.6, marginBottom:7 }}>Logo Position</div>
              <div style={{ display:'flex', gap:8 }}>
                {['left','center'].map(v=>(
                  <button key={v} onClick={()=>upd('logoPosition',v)}
                    style={{ flex:1, padding:'8px', borderRadius:8, border:`1.5px solid ${config.logoPosition===v?'var(--blue)':'var(--border)'}`, background:config.logoPosition===v?'var(--blue-s)':'transparent', color:config.logoPosition===v?'var(--blue)':'var(--ink3)', fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:'inherit', textTransform:'capitalize' }}>{v}</button>
                ))}
              </div>
            </div>
            <div style={{ marginBottom:14 }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6 }}>
                <div style={{ fontSize:10, fontWeight:700, color:'var(--ink3)', textTransform:'uppercase', letterSpacing:.6 }}>Field Font Size</div>
<div style={{ display:'flex', alignItems:'center', gap:6 }}>
<input type="text" inputMode="numeric" pattern="[0-9]*"
                    value={fontSizeDraft ?? String(config.fontSize||11)}
                    onChange={e=>{
                      const raw = e.target.value.replace(/[^0-9]/g, '')
                      setFontSizeDraft(raw)
                      if (raw !== '') upd('fontSize', Number(raw))
                    }}
                    onBlur={e=>{
                      const clamped = Math.min(20, Math.max(8, Number(e.target.value)||11))
                      upd('fontSize', clamped)
                      setFontSizeDraft(null)
                    }}
                    onKeyDown={e=>{ if (e.key==='Enter') e.target.blur() }}
                    style={{ width:52, padding:'2px 6px', borderRadius:6, border:'1px solid var(--blue-m)', background:'var(--blue-s)', fontSize:11, fontFamily:'JetBrains Mono,monospace', color:'var(--blue)', fontWeight:700, textAlign:'right', outline:'none' }}/>
                </div>
              </div>
              <input type="range" min={8} max={20} step={1}
                value={config.fontSize||11}
                onChange={e=>upd('fontSize',Number(e.target.value))}
                style={{ width:'100%', accentColor:'#2352ff', cursor:'pointer' }}/>
              <div style={{ display:'flex', justifyContent:'space-between', marginTop:3 }}>
                <span style={{ fontSize:9, color:'var(--ink3)' }}>8px · Tiny</span>
                <span style={{ fontSize:9, color:'var(--ink3)' }}>20px · Large</span>
              </div>
            </div>
            {[['showHeader','Show Header','College name, logo & role'],['showBarcode','Show Barcode','Footer barcode strip']].map(([key,title,desc])=>(
              <div key={key} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'10px 0', borderBottom:'1px solid var(--border)' }}>
                <div>
                  <div style={{ fontSize:12, color:'var(--ink2)', fontWeight:600 }}>{title}</div>
                  <div style={{ fontSize:10, color:'var(--ink3)', marginTop:1 }}>{desc}</div>
                </div>
                <div onClick={()=>upd(key,!config[key])}
                  style={{ width:38, height:22, borderRadius:11, background:config[key]?'var(--blue)':'var(--border2)', transition:'background .2s', cursor:'pointer', position:'relative', flexShrink:0 }}>
                  <div style={{ width:18, height:18, borderRadius:'50%', background:'#fff', position:'absolute', top:2, left:config[key]?18:2, transition:'left .2s', boxShadow:'0 1px 3px rgba(0,0,0,.2)' }}/>
                </div>
              </div>
            ))}

            {/* ── QR Code ── */}
            <div style={{ marginTop:14 }}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'10px 0', borderBottom:'1px solid var(--border)' }}>
                <div>
                  <div style={{ fontSize:12, color:'var(--ink2)', fontWeight:600 }}>Show QR Code</div>
                  <div style={{ fontSize:10, color:'var(--ink3)', marginTop:1 }}>Real scannable QR — drag to reposition</div>
                </div>
                <div onClick={()=>upd('showQR',!config.showQR)}
                  style={{ width:38, height:22, borderRadius:11, background:config.showQR?'var(--blue)':'var(--border2)', transition:'background .2s', cursor:'pointer', position:'relative', flexShrink:0 }}>
                  <div style={{ width:18, height:18, borderRadius:'50%', background:'#fff', position:'absolute', top:2, left:config.showQR?18:2, transition:'left .2s', boxShadow:'0 1px 3px rgba(0,0,0,.2)' }}/>
                </div>
              </div>

              {config.showQR && (
                <div style={{ padding:'12px', background:'var(--paper2)', borderRadius:10, border:'1px solid var(--border)', marginTop:10, display:'flex', flexDirection:'column', gap:12 }}>

                  {/* QR Data Source */}
                  <div>
                    <div style={{ fontSize:10, fontWeight:700, color:'var(--ink3)', textTransform:'uppercase', letterSpacing:.5, marginBottom:7 }}>QR Encodes</div>
                    <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
                      {[
                        { val:'id',             label:'Submission ID',    desc:'Unique record ID' },
                        { val:'name',           label:'Full Name',        desc:'Student/staff name' },
                        { val:'roll_number',    label:'Roll Number',      desc:'Roll / admission no.' },
                        { val:'employee_id',    label:'Employee ID',      desc:'Employee ID number' },
                        { val:'contact_number', label:'Contact Number',   desc:'Phone number' },
                        { val:'custom',         label:'Custom Text',      desc:'URL or your own value' },
                      ].map(({ val, label, desc }) => (
                        <div key={val} onClick={() => upd('qrData', val)}
                          style={{ display:'flex', alignItems:'center', gap:10, padding:'7px 10px', borderRadius:8,
                            border:`1.5px solid ${config.qrData===val?'var(--blue)':'var(--border)'}`,
                            background: config.qrData===val ? 'var(--blue-s)' : 'var(--paper)',
                            cursor:'pointer', transition:'all .15s' }}>
                          <div style={{ width:14, height:14, borderRadius:'50%', border:`2px solid ${config.qrData===val?'var(--blue)':'var(--border2)'}`, background:config.qrData===val?'var(--blue)':'transparent', flexShrink:0, transition:'all .15s' }}/>
                          <div style={{ flex:1 }}>
                            <div style={{ fontSize:12, fontWeight:700, color:config.qrData===val?'var(--blue)':'var(--ink)' }}>{label}</div>
                            <div style={{ fontSize:10, color:'var(--ink3)' }}>{desc}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {config.qrData === 'custom' && (
                    <div>
                      <div style={{ fontSize:10, fontWeight:700, color:'var(--ink3)', textTransform:'uppercase', letterSpacing:.5, marginBottom:6 }}>Custom Text / URL</div>
                      <input
                        value={config.qrCustomText || ''}
                        onChange={e => upd('qrCustomText', e.target.value)}
                        placeholder="e.g. https://myschool.edu"
                        style={{ width:'100%', padding:'8px 10px', borderRadius:8, border:'1.5px solid var(--border)', background:'var(--paper)', color:'var(--ink)', fontSize:12, fontFamily:'inherit', outline:'none', boxSizing:'border-box' }}
                        onFocus={e => e.target.style.borderColor='var(--blue)'}
                        onBlur={e  => e.target.style.borderColor='var(--border)'}
                      />
                    </div>
                  )}

                  <div>
                    <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
                      <span style={{ fontSize:11, color:'var(--ink3)', fontWeight:600 }}>QR Size</span>
                      <span style={{ fontSize:11, fontFamily:'JetBrains Mono,monospace', color:'var(--blue)', fontWeight:700, background:'var(--blue-s)', borderRadius:5, padding:'1px 6px' }}>{config.qrSize||56}px</span>
                    </div>
                    <input type="range" min={32} max={120} step={8}
                      value={config.qrSize||56}
                      onChange={e => upd('qrSize', Number(e.target.value))}
                      style={{ width:'100%', accentColor:'#2352ff' }}/>
                    <div style={{ display:'flex', justifyContent:'space-between', marginTop:2 }}>
                      <span style={{ fontSize:9, color:'var(--ink3)' }}>32px · Small</span>
                      <span style={{ fontSize:9, color:'var(--ink3)' }}>120px · Large</span>
                    </div>
                  </div>

                  {((config.qrX !== null && config.qrX !== undefined) || (config.qrY !== null && config.qrY !== undefined)) && (
                    <button onClick={() => { upd('qrX', null); upd('qrY', null); toast('QR position reset') }}
                      style={{ padding:'7px 12px', borderRadius:8, border:'1.5px solid var(--border)', background:'var(--paper)', color:'var(--ink2)', fontSize:11, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>
                      ↺ Reset QR Position
                    </button>
                  )}

                  <div style={{ padding:'8px 10px', background:'#f0fdf4', borderRadius:7, border:'1px solid #bbf7d0', fontSize:11, color:'#166534', lineHeight:1.5 }}>
                    ✅ Real QR — black on white · drag it anywhere on the card · fully scannable
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  )}

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100vh', paddingTop:64, background:'var(--paper2)' }}>
      <style>{`
        .icb-layout { flex:1; display:grid; grid-template-columns:268px 1fr; overflow:hidden; }
        .icb-panel  { background:var(--paper); border-right:1px solid var(--border); overflow-y:auto; display:flex; flex-direction:column; }
        .icb-mob    { display:none !important; }
        .icb-chip   { display:inline-block; }
        @media(max-width:800px){
          .icb-layout { grid-template-columns:1fr !important; }
          .icb-panel  { display:none !important; }
          .icb-mob    { display:flex !important; }
          .icb-chip   { display:none !important; }
        }
        .icb-drawer { position:fixed; top:120px; left:0; right:0; bottom:0; background:var(--paper); z-index:500; display:none; flex-direction:column; border-top:2px solid var(--border); }
        .icb-drawer.open { display:flex !important; }
      `}</style>

      {/* Top bar */}
      <div style={{ height:56, background:'var(--paper)', borderBottom:'1px solid var(--border)', display:'flex', alignItems:'center', justifyContent:'space-between', padding:'0 14px', flexShrink:0, gap:10 }}>
        <div style={{ display:'flex', alignItems:'center', gap:10, flex:1, minWidth:0 }}>
          <button onClick={() => navigate(-1)}
            style={{ padding:'6px 10px', borderRadius:8, border:'1.5px solid var(--border)', background:'var(--paper2)', color:'var(--ink2)', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'inherit', flexShrink:0 }}>← Back</button>

          {/* Edit mode badge */}
          {editId && (
            <div style={{ flexShrink:0, padding:'4px 10px', borderRadius:20, background:'var(--amber-s)',
              border:'1px solid #fcd34d', fontSize:11, fontWeight:700, color:'#b45309', whiteSpace:'nowrap' }}>
              ✎ Editing template
            </div>
          )}

          <input value={templateName} onChange={e => setTemplateName(e.target.value)}
            placeholder="Template name..."
            style={{ flex:1, border:'1.5px solid var(--border)', borderRadius:8, fontSize:14, fontWeight:700, color:'var(--ink)', background:'var(--paper2)', outline:'none', fontFamily:'Outfit,sans-serif', padding:'7px 10px', transition:'border .15s', minWidth:0 }}
            onFocus={e => e.target.style.borderColor='#2352ff'}
            onBlur={e  => e.target.style.borderColor='var(--border)'}/>
        </div>
        <div style={{ display:'flex', gap:8, alignItems:'center', flexShrink:0 }}>
          <div className="icb-chip" style={{ fontSize:11, color:'var(--ink3)', fontFamily:'JetBrains Mono,monospace', background:'var(--paper2)', border:'1px solid var(--border)', borderRadius:6, padding:'4px 8px', whiteSpace:'nowrap' }}>
            {CW}×{CH}
          </div>
          {approved.length > 1 && (
            <select value={previewIdx} onChange={e => setPreviewIdx(Number(e.target.value))}
              style={{ padding:'5px 8px', borderRadius:7, border:'1.5px solid var(--border)', background:'var(--paper)', color:'var(--ink)', fontSize:12, cursor:'pointer', fontFamily:'inherit', maxWidth:120 }}>
              {approved.map((s,i) => <option key={s.id} value={i}>{s.name}</option>)}
            </select>
          )}
          <button className="icb-mob" onClick={() => setPanelOpen(o=>!o)}
            style={{ padding:'6px 12px', borderRadius:8, border:'1.5px solid var(--border)', background:panelOpen?'var(--blue-s)':'var(--paper2)', color:panelOpen?'var(--blue)':'var(--ink2)', fontSize:12, cursor:'pointer', fontFamily:'inherit', fontWeight:700, alignItems:'center', gap:4 }}>
            {panelOpen?'✕ Close':'⚙ Edit'}
          </button>
          <button onClick={resetLayout}
            style={{ padding:'6px 10px', borderRadius:8, border:'1.5px solid var(--border)', background:'transparent', color:'var(--ink2)', fontSize:12, cursor:'pointer', fontFamily:'inherit', fontWeight:600 }}>↺ Reset</button>
          <button onClick={handleSave} disabled={saving}
            style={{ padding:'7px 14px', borderRadius:8, border:'none',
              background: saving ? 'var(--border2)' : editId ? '#b45309' : '#2352ff',
              color:'#fff', fontSize:13, fontWeight:700,
              cursor:saving?'not-allowed':'pointer', fontFamily:'inherit', whiteSpace:'nowrap' }}>
            {saving ? '⏳' : editId ? '💾 Update' : '💾 Save'}
          </button>
        </div>
      </div>

      <div className="icb-layout">
        <div className="icb-panel">{PanelContent()}</div>

        <div style={{ overflowY:'auto', overflowX:'auto', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'flex-start', padding:'20px 16px', gap:14, background:'var(--paper2)' }}
          onClick={() => { setSelected(null); setMultiSelected([]) }}>

          {/* Alignment toolbar */}
          <div onClick={e => e.stopPropagation()}>
            <AlignToolbar
              selected={selected}
              multiSelected={multiSelected}
              config={config}
              onAlignOne={handleAlignOne}
              onAlignMulti={handleAlignMulti}
              onDistribute={handleDistribute}
              onNudge={handleNudge}
            />
          </div>

          {/* Hint bar */}
          <div style={{ display:'flex', alignItems:'center', gap:8, background:'var(--paper)', borderRadius:10, padding:'6px 14px', border:'1px solid var(--border)', fontSize:11, flexWrap:'wrap', justifyContent:'center' }}>
            <span style={{ color:'var(--blue)', fontWeight:700 }}>●</span>
            <span style={{ color:'var(--ink3)' }}>Drag to move · guides snap automatically</span>
            <span style={{ color:'var(--border)' }}>|</span>
            <span style={{ color:'#f59e0b', fontWeight:700 }}>Shift+click</span>
            <span style={{ color:'var(--ink3)' }}>to select multiple → group align</span>
          </div>

          {/* Canvas */}
          <div onClick={e => e.stopPropagation()}>
            <CardCanvas
              config={config}
              sub={previewSub}
              orgName={orgName}
              onMove={onMove}
              selected={selected}
              onSelect={handleSelect}
              multiSelected={multiSelected}
              onMultiSelect={handleMultiSelect}
            />
          </div>

          {/* Selection status */}
          {(selected || multiSelected.length > 0) && (
            <div style={{ padding:'8px 16px',
              background: multiSelected.length>0 ? '#fef3c7' : 'var(--blue-s)',
              borderRadius:8,
              border:`1px solid ${multiSelected.length>0?'#fcd34d':'var(--blue-m)'}`,
              fontSize:12, color:multiSelected.length>0?'#b45309':'var(--blue)', fontWeight:600 }}>
              {multiSelected.length > 0
                ? `${multiSelected.length} fields selected — use alignment toolbar above`
                : selected==='__photo__'
                  ? '🖼 Photo selected — drag to move · use toolbar to align'
                  : `✦ ${ALL_FIELDS.find(f=>f.key===selected)?.label||''} selected — drag or nudge · use toolbar to align`}
            </div>
          )}

          {approved.length===0 && (
            <div style={{ padding:'10px 16px', background:'var(--amber-s)', borderRadius:8, border:'1px solid #fcd34d', fontSize:12, color:'#92400e', fontWeight:600 }}>
              ⚠ No approved submissions — showing placeholder data
            </div>
          )}
        </div>
      </div>

      <div className={`icb-drawer${panelOpen?' open':''}`}>{panelOpen ? PanelContent() : null}</div>
    </div>
  )
}