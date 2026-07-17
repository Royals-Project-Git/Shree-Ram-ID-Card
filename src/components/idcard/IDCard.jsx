import { forwardRef, useEffect, useRef } from 'react'
import QRCode from 'qrcode'

/* ── fontSize is now stored as a raw number (e.g. 11) in config ── */

/* ── Format date from YYYY-MM-DD → DD/MM/YYYY ── */
function formatDOB(val) {
  if (!val) return val
  // Already in DD/MM/YYYY or non-ISO format — return as-is
  if (!/^\d{4}-\d{2}-\d{2}$/.test(val)) return val
  const [y, m, d] = val.split('-')
  return `${d}/${m}/${y}`
}

/* ── Helper to calculate shifted Y coordinates for absolute/drag fields to prevent overlaps ── */
function getShiftedFields(fields, config, sub, CW) {
  // Map fields with their positions and values, filter empty, sort by Y
  const mapped = [...fields]
    .map(f => {
      const pos = config.fieldPositions?.[f.key] || DEFAULT_POSITIONS[f.key] || { x: 20, y: 200 }
      const rawVal = sub[f.key]
      const val = f.key === 'date_of_birth' ? formatDOB(rawVal) : rawVal
      return { f, pos, val }
    })
    .filter(item => item.val)
    .sort((a, b) => a.pos.y - b.pos.y)

  // Group fields sharing the same visual row (within 4px Y tolerance)
  const rows = []
  mapped.forEach(item => {
    let placed = false
    for (const row of rows) {
      if (Math.abs(row.baseY - item.pos.y) <= 4) {
        row.items.push(item)
        placed = true
        break
      }
    }
    if (!placed) {
      rows.push({ baseY: item.pos.y, items: [item] })
    }
  })

  // Estimate the pixel height a row will actually render to
  function estimateRowHeight(rowItems) {
    let maxLines = 1
    rowItems.forEach(item => {
      const fs         = config.fieldStyles?.[item.f.key] || {}
      const highlight  = fs.highlight || false
      const fSize      = fs.fontSize ?? (config.fontSize || 11)
      const showLabel  = fs.showLabel !== false
      const labelW     = config.labelWidth || 72
      const isUppercase = fs.uppercase || false
      const fontWeight  = fs.fontWeight ?? (highlight ? 700 : 600)
      // Uppercase & bold text renders wider per character
      // Use 0.78 factor for uppercase/bold, 0.62 for normal text
      const charFactor   = (isUppercase || fontWeight >= 700) ? 0.78 : 0.62
      const fieldMaxW    = CW - item.pos.x - 8
      const textW        = fieldMaxW - (showLabel && !highlight ? labelW + 8 : 0)
      const charsPerLine = Math.max(1, Math.floor(textW / (fSize * charFactor)))
      const lines = Math.ceil(String(item.val).length / charsPerLine)
      if (lines > maxLines) maxLines = lines
    })
    const fSize = config.fieldStyles?.[rowItems[0].f.key]?.fontSize ?? (config.fontSize || 11)
    return maxLines * fSize * 1.5 + 4
  }

  // Propagate cumulative shifts: if a row is taller than the natural gap to the
  // next row, push every subsequent row down by the overflow amount.
  let cumulativeShift = 0
  const result = []

  rows.forEach((row, idx) => {
    row.items.forEach(item => {
      result.push({ ...item, shiftedY: item.pos.y + cumulativeShift })
    })

    if (idx < rows.length - 1) {
      const naturalGap  = rows[idx + 1].baseY - row.baseY
      const rowHeight   = estimateRowHeight(row.items)
      const overflow    = Math.max(0, rowHeight - naturalGap)
      cumulativeShift  += overflow
    }
  })

  return result
}


/* ── Built-in templates (used when no customConfig) ── */
const TEMPLATES = {
  T1: { name: 'Royal Blue',  c1: '#2352ff', c2: '#1538d4', accent: '#e8ecff' },
  T2: { name: 'Emerald',     c1: '#059669', c2: '#047857', accent: '#d1fae5' },
  T3: { name: 'Deep Maroon', c1: '#9f1239', c2: '#881337', accent: '#ffe4e6' },
}

/* ── All field definitions — matches IDCardBuilder exactly ── */
const ALL_FIELDS = [
  { key:'name',             label:'Full Name'         },
  { key:'fathers_name',     label:"Father's Name"     },
  { key:'class',            label:'Class'             },
  { key:'section',          label:'Section'           },
  { key:'roll_number',      label:'Roll No.'          },
  { key:'admission_number', label:'Admission No.'     },
  { key:'date_of_birth',    label:'Date of Birth'     },
  { key:'blood_group',      label:'Blood Group'       },
  { key:'contact_number',   label:'Contact'           },
  { key:'emergency_contact',label:'Emergency Contact' },
  { key:'address',          label:'Address'           },
  { key:'designation',      label:'Designation'       },
  { key:'department',       label:'Department'        },
  { key:'mode_of_transport',label:'Transport'         },
  { key:'employee_id',      label:'Employee ID'       },
]

/* ── Default positions — matches IDCardBuilder exactly ── */
const DEFAULT_POSITIONS = {
  name:              { x: 110, y: 100 },
  fathers_name:      { x: 110, y: 118 },
  class:             { x: 110, y: 130 },
  section:           { x: 200, y: 130 },
  roll_number:       { x: 110, y: 155 },
  admission_number:  { x: 110, y: 178 },
  date_of_birth:     { x: 16,  y: 220 },
  blood_group:       { x: 175, y: 220 },
  contact_number:    { x: 16,  y: 255 },
  emergency_contact: { x: 16,  y: 288 },
  address:           { x: 16,  y: 320 },
  designation:       { x: 110, y: 118 },
  department:        { x: 110, y: 140 },
  mode_of_transport: { x: 16,  y: 355 },
  employee_id:       { x: 110, y: 162 },
}

/* ══════════════════════════════════════════════════════════════
   QR Canvas helper — renders a real QR code into a <canvas>
══════════════════════════════════════════════════════════════ */
function QRCanvas({ text, size }) {
  const canvasRef = useRef(null)
  useEffect(() => {
    if (!canvasRef.current || !text) return
    QRCode.toCanvas(canvasRef.current, text, {
      width: size,
      margin: 1,
      color: { dark: '#000000', light: '#ffffff' },
      errorCorrectionLevel: 'M',
    }).catch(() => {})
  }, [text, size])
  return (
    <canvas
      ref={canvasRef}
      style={{ width: size, height: size, display: 'block', borderRadius: 3 }}
    />
  )
}

/* ══════════════════════════════════════════════════════════════
   IDCard — renders in two modes:

   MODE 1 — customConfig provided (from IDCardBuilder / DB):
     Renders card at 340×480 with exact positions, photo size/pos,
     visible fields, border style, header style, photo shape, barcode
     — exactly matching what was designed in the builder.

   MODE 2 — templateId provided (built-in T1/T2/T3):
     Renders the classic fixed-layout 280px card.
══════════════════════════════════════════════════════════════ */
const IDCard = forwardRef(function IDCard(
  { submission, templateId = 'T1', customConfig = null, orgLogo = null,
    showActions = true, onDelete, onDownload, onEdit },
  ref
) {
  const sub = submission || {}

  /* ── MODE 1: Custom template from builder ── */
  if (customConfig) {
    const c            = customConfig
    const c1           = c.c1     || '#2352ff'
    const c2           = c.c2     || '#1538d4'
    const accent       = c.accent || '#e8ecff'

    /* Card dimensions from saved config */
    const CW = c.cardW || 340
    const CH = c.cardH || 480

    const headerBg     = c.headerStyle === 'gradient'
      ? `linear-gradient(135deg,${c1},${c2})` : c1

    const cardBorder   = c.borderStyle === 'none'  ? 'none'
      : c.borderStyle === 'thick' ? `3px solid ${c1}` : `1.5px solid ${c1}55`

    const photoRadius  = c.photoShape === 'circle'  ? '50%'
      : c.photoShape === 'square' ? 4 : 10

    const pw = c.photoSize || 72
    const ph = Math.round(pw * 4 / 3)
    const px = c.photoX ?? 16
    const py = c.photoY ?? 90

    // IMPORTANT: preserve the saved order from c.visibleFields (set by drag-and-drop
    // reordering in the builder), instead of always falling back to ALL_FIELDS' fixed
    // master order. Using .filter() on ALL_FIELDS (old code) ignored any reordering the
    // user did, which is why "All Templates" showed the old field arrangement even
    // though the builder's own live preview (which already preserved order) looked correct.
    const visibleFields = (c.visibleFields || [])
      .map(key => ALL_FIELDS.find(f => f.key === key))
      .filter(Boolean)

    const getPos = (key) =>
      c.fieldPositions?.[key] || DEFAULT_POSITIONS[key] || { x: 20, y: 200 }

    return (
      <div style={{ display:'flex', flexDirection:'column', gap:0 }}>
        {/* Card — 340×480 matches builder exactly */}
        <div
          ref={ref}
          id={`card-${sub.id}`}
          style={{
            position:     'relative',
            width:        CW,
            height:       CH,
            background:   '#fff',
            borderRadius: c.cornerStyle === 'sharp' ? 0 : 16,
            overflow:     'hidden',
            border:       cardBorder,
            boxShadow:    '0 4px 20px rgba(0,0,0,.12)',
            fontFamily:   'Instrument Sans,sans-serif',
          }}>

          {/* Background image — using img not CSS backgroundImage so html2canvas captures it sharply */}
          {c.bgImage && (
            <img src={c.bgImage} alt="" style={{
              position:'absolute', inset:0, zIndex:0,
              width:'100%', height:'100%',
              objectFit: c.bgFit === 'repeat' ? 'fill' : (c.bgFit || 'cover'),
              objectPosition:'center',
              opacity: c.bgOpacity ?? 0.15,
              pointerEvents:'none',
              display:'block',
            }}/>
          )}

          {/* Header — hidden if showHeader is false */}
          {c.showHeader !== false && (
          <div style={{ position:'relative', zIndex:1,
            background:     headerBg,
            height:         CW > CH ? 64 : 80,
            display:        'flex',
            alignItems:     'center',
            gap:            12,
            padding:        '0 16px',
            justifyContent: c.logoPosition === 'center' ? 'center' : 'flex-start',
            flexDirection:  c.logoPosition === 'center' ? 'column' : 'row',
          }}>
            <div style={{
              width:46, height:46, borderRadius:10,
              background:'rgba(255,255,255,.22)',
              display:'flex', alignItems:'center', justifyContent:'center',
              fontFamily:'Outfit,sans-serif', fontWeight:900, fontSize:15,
              color:'#fff', flexShrink:0, overflow:'hidden',
              border:'1.5px solid rgba(255,255,255,.3)',
            }}>
              {orgLogo
                ? <img src={orgLogo} style={{ width:'100%', height:'100%', objectFit:'cover' }} alt="" crossOrigin="anonymous"/>
                : (sub.school_name || 'SC').slice(0,2).toUpperCase()
              }
            </div>
            <div style={{ textAlign: c.logoPosition === 'center' ? 'center' : 'left' }}>
              <div style={{ fontFamily:'Outfit,sans-serif', fontSize:13, fontWeight:800, color:'#fff', lineHeight:1.3 }}>
                {sub.school_name || 'Organization'}
              </div>
              <div style={{ fontSize:10, color:'rgba(255,255,255,.75)', marginTop:2 }}>
                {sub.role || 'Student'} Identity Card
              </div>
            </div>
          </div>

          )}
          {/* Photo — exact position + size from builder */}
          <div style={{
            position:     'absolute',
            left:         px,
            top:          py,
            zIndex:       10,
            width:        pw,
            height:       ph,
            borderRadius: photoRadius,
            border:       `2.5px solid ${c1}`,
            background:   accent,
            overflow:     'hidden',
            display:      'flex',
            alignItems:   'center',
            justifyContent:'center',
          }}>
            {sub.photo_url
              ? <img src={sub.photo_url} style={{ width:'100%', height:'100%', objectFit:'cover' }} alt=""/>
              : <span style={{ fontSize: Math.round(pw * 0.38) }}>👤</span>
            }
          </div>

          {/* Fields — DRAG mode: absolute positions with dynamic shift */}
          {c.layoutMode !== 'flow' && (() => {
            const shiftedFields = getShiftedFields(visibleFields, c, sub, CW)
            return shiftedFields.map(({ f, pos, val, shiftedY }) => {
              const fs        = c.fieldStyles?.[f.key] || {}
              const highlight = fs.highlight || false
              const fSize     = fs.fontSize  ?? (c.fontSize || 11)
              const lSize     = Math.max(fSize - 1, 7)
              const fWeight   = fs.fontWeight ?? (highlight ? 700 : 600)
              const textColor = fs.textColor  || (highlight ? '#fff' : '#1a1a2e')
              const bgColor   = fs.bgColor    || c1
              const uppercase = fs.uppercase  || false
              const showLabel = fs.showLabel  !== false
              const brad      = fs.borderRadius ?? 4
              const fontFam   = fs.fontFamily  || c.globalFontFamily || 'Instrument Sans,sans-serif'
              const displayVal = uppercase ? (val||'').toUpperCase() : val
              const fieldMaxW  = CW - pos.x - 8

              if (highlight) {
                return (
                  <div key={f.key} style={{
                    position:'absolute', left:pos.x, top:shiftedY, zIndex:8,
                    maxWidth: fieldMaxW,
                    background: bgColor, borderRadius: brad,
                    padding:'3px 8px', display:'inline-block',
                  }}>
                    <span style={{ fontSize:fSize, fontWeight:fWeight, color:textColor,
                      letterSpacing:uppercase?1.5:0.2,
                      textTransform:uppercase?'uppercase':'none', display:'block', fontFamily:fontFam,
                      wordBreak:'break-word', overflowWrap:'break-word',
                    }}>
                      {displayVal}
                    </span>
                  </div>
                )
              }

              const labelW = c.labelWidth || 72

              return (
                <div key={f.key} style={{
                  position:'absolute', left:pos.x, top:shiftedY,
                  maxWidth: fieldMaxW,
                  padding:'2px 6px', zIndex:8,
                  display:'flex', alignItems:'flex-start', gap:0,
                }}>
                  {showLabel && <span style={{ fontSize:lSize, fontWeight:700, color:'#555', whiteSpace:'nowrap', display:'inline-block', minWidth:labelW, lineHeight:1.3 }}>{f.label}</span>}
                  {showLabel && <span style={{ fontSize:lSize, fontWeight:700, color:'#555', margin:'0 3px', flexShrink:0, lineHeight:1.3 }}>:</span>}
                  <span style={{ fontSize:fSize, fontWeight:fWeight, color:textColor,
                    textTransform:uppercase?'uppercase':'none', fontFamily:fontFam,
                    wordBreak:'break-word', overflowWrap:'break-word', minWidth:0, lineHeight:1.3,
                  }}>{displayVal}</span>
                </div>
              )
            })
          })()}

          {/* Fields — FLOW mode: 2-column layout */}
          {c.layoutMode === 'flow' && (() => {
            const fSize   = c.fontSize || 11
            const lSize   = Math.max(fSize - 1, 7)
            const lw      = c.labelWidth || 72
            const rowGap  = c.rowGap || 22
            const align   = c.fieldAlign || 'left'
            const headerH = c.showHeader !== false ? (CW > CH ? 64 : 80) : 0
            const pw      = c.photoSize || 72
            const ph      = Math.round(pw * 4 / 3)
            const pxPos   = c.photoX ?? 16
            const pyPos   = c.photoY ?? 90
            const autoStartY = Math.max(headerH + 8, pyPos + ph + 10)
            const startY  = c.flowStartY ?? autoStartY
            const photoRight = pxPos + pw + 10
            const autoStartX = photoRight < CW * 0.55 ? photoRight : 12
            const startX  = c.flowStartX ?? autoStartX
            const availW  = CW - startX - 12

            const present = visibleFields.filter(f => sub[f.key])

            // Build layout rows: each row = { fields: [...], isFullWidth: bool }
            const rows = []
            const processed = new Set()

            present.forEach((f) => {
              if (processed.has(f.key)) return

              if (f.key === 'class') {
                const sectionField = present.find(pf => pf.key === 'section')
                if (sectionField) {
                  rows.push({ fields: [f, sectionField], isFullWidth: false })
                  processed.add('class')
                  processed.add('section')
                } else {
                  rows.push({ fields: [f], isFullWidth: true })
                  processed.add('class')
                }
              } else if (f.key === 'section') {
                const classField = present.find(pf => pf.key === 'class')
                if (classField) {
                  rows.push({ fields: [classField, f], isFullWidth: false })
                  processed.add('class')
                  processed.add('section')
                } else {
                  rows.push({ fields: [f], isFullWidth: true })
                  processed.add('section')
                }
              } else if (f.key === 'blood_group') {
                const admField = present.find(pf => pf.key === 'admission_number')
                if (admField) {
                  rows.push({ fields: [f, admField], isFullWidth: false })
                  processed.add('blood_group')
                  processed.add('admission_number')
                } else {
                  rows.push({ fields: [f], isFullWidth: true })
                  processed.add('blood_group')
                }
              } else if (f.key === 'admission_number') {
                const bgField = present.find(pf => pf.key === 'blood_group')
                if (bgField) {
                  rows.push({ fields: [bgField, f], isFullWidth: false })
                  processed.add('blood_group')
                  processed.add('admission_number')
                } else {
                  rows.push({ fields: [f], isFullWidth: true })
                  processed.add('admission_number')
                }
              } else {
                rows.push({ fields: [f], isFullWidth: true })
                processed.add(f.key)
              }
            })

            return (
              <div style={{
                position: 'absolute',
                left: startX,
                top: startY,
                width: availW,
                display: 'flex',
                flexDirection: 'column',
                gap: rowGap,
                zIndex: 8,
              }}>
                {rows.map((row, rowIdx) => (
                  <div key={rowIdx} style={{
                    display: 'flex',
                    gap: 4,
                    width: '100%',
                  }}>
                    {row.fields.map((f) => {
                      const rawVal    = sub[f.key]
                      const val       = f.key === 'date_of_birth' ? formatDOB(rawVal) : rawVal
                      const fs        = c.fieldStyles?.[f.key] || {}
                      const highlight = fs.highlight || false
                      const ffSize    = fs.fontSize  ?? fSize
                      const ffWeight  = fs.fontWeight ?? (highlight ? 700 : 600)
                      const textColor = fs.textColor  || (highlight ? '#fff' : '#1a1a2e')
                      const bgColor   = fs.bgColor    || c1
                      const uppercase = fs.uppercase  || false
                      const showLabel = fs.showLabel  !== false
                      const brad      = fs.borderRadius ?? 4
                      const fontFam   = fs.fontFamily  || c.globalFontFamily || 'Instrument Sans,sans-serif'
                      const displayVal = uppercase ? (val||'').toUpperCase() : val
                      const fieldLW    = row.isFullWidth ? lw : Math.min(lw, Math.floor(availW * 0.5 * 0.45))

                      if (highlight) {
                        return (
                          <div key={f.key} style={{
                            flex: row.isFullWidth ? '1 1 100%' : '1 1 50%',
                            minWidth: 0,
                            background: bgColor, borderRadius: brad,
                            padding:'3px 8px', display:'flex',
                            alignItems:'center',
                            justifyContent: align === 'center' ? 'center' : align === 'right' ? 'flex-end' : 'flex-start',
                          }}>
                            <span style={{ fontSize:ffSize, fontWeight:ffWeight, color:textColor,
                              letterSpacing:uppercase?1.5:0.2,
                              textTransform:uppercase?'uppercase':'none', display:'block', fontFamily:fontFam,
                              wordBreak:'break-word', overflowWrap:'break-word',
                              textAlign: align === 'center' ? 'center' : align === 'right' ? 'right' : 'left',
                            }}>
                              {displayVal}
                            </span>
                          </div>
                        )
                      }

                      return (
                        <div key={f.key} style={{
                          flex: row.isFullWidth ? '1 1 100%' : '1 1 50%',
                          minWidth: 0,
                          padding:'2px 6px',
                          display:'flex', alignItems:'flex-start', gap:0,
                          justifyContent: align === 'center' ? 'center' : align === 'right' ? 'flex-end' : 'flex-start',
                        }}>
                          {showLabel && <span style={{
                            fontSize:lSize, fontWeight:700, color:'#333',
                            width:fieldLW, minWidth:fieldLW, flexShrink: 0, whiteSpace:'nowrap',
                            textAlign: align === 'right' ? 'right' : 'left',
                            lineHeight:1.3,
                          }}>{f.label}</span>}
                          {showLabel && <span style={{ fontSize:lSize, fontWeight:700, color:'#555', margin:'0 4px 0 0', flexShrink:0, lineHeight:1.3 }}>:</span>}
                          <span style={{ fontSize:ffSize, fontWeight:ffWeight, color:textColor,
                            textTransform:uppercase?'uppercase':'none', fontFamily:fontFam,
                            wordBreak:'break-word', overflowWrap:'break-word', minWidth:0, lineHeight:1.3,
                            textAlign: align === 'right' ? 'right' : 'left',
                          }}>{displayVal}</span>
                        </div>
                      )
                    })}
                  </div>
                ))}
              </div>
            )
          })()}


          {/* QR Code */}
          {c.showQR && (() => {
            const qrText = (() => {
              if (c.qrData === 'custom')         return c.qrCustomText || 'VIRA-ID'
              if (c.qrData === 'name')           return sub.name           || 'VIRA-ID'
              if (c.qrData === 'roll_number')    return sub.roll_number    || sub.id || 'VIRA-ID'
              if (c.qrData === 'contact_number') return sub.contact_number || 'VIRA-ID'
              if (c.qrData === 'employee_id')    return sub.employee_id    || sub.id || 'VIRA-ID'
              return sub.id || sub.admission_number || sub.roll_number || 'VIRA-ID'
            })()
            const size       = c.qrSize || 56
            const barcodeH   = c.showBarcode !== false ? 30 : 0
            const autoX      = CW - size - 10
            const autoY      = CH - size - barcodeH - 10
            const qrX        = c.qrX ?? autoX
            const qrY        = c.qrY ?? autoY
            return (
              <div style={{
                position: 'absolute', left: qrX, top: qrY,
                width: size, height: size, zIndex: 12,
                background: '#fff', borderRadius: 4,
              }}>
                <QRCanvas text={qrText} size={size} />
              </div>
            )
          })()}

          {/* Barcode */}
          {c.showBarcode !== false && (
            <div style={{
              position:'absolute', bottom:0, left:0, right:0, zIndex:5,
              background:`${c1}12`, padding:'8px 16px',
              display:'flex', justifyContent:'space-between', alignItems:'center',
              borderTop:`1px solid ${c1}22`,
            }}>
              <div style={{ display:'flex', gap:1.5, alignItems:'flex-end' }}>
                {Array.from({length:28},(_,i) => (
                  <div key={i} style={{ width:1.5, height:10+Math.abs(Math.sin(i*2.3))*12,
                    background:c1, opacity:.6, borderRadius:1 }}/>
                ))}
              </div>
              <div style={{ fontSize:9, fontFamily:'JetBrains Mono,monospace',
                color:c1, fontWeight:600, opacity:.8 }}>
                {(sub.id||'ID000000').slice(0,8).toUpperCase()}
              </div>
            </div>
          )}
        </div>

        {/* Action buttons */}
        {showActions && (
          <div style={{ display:'flex', gap:8, marginTop:10 }}>
            {onEdit && (
              <button onClick={onEdit}
                style={{ flex:1, padding:'8px', borderRadius:8, background:'#e8ecff',
                  color:'#2352ff', border:'none', fontSize:12, fontWeight:700, cursor:'pointer',
                  transition: 'background .15s, color .15s' }}
                onMouseEnter={e=>e.target.style.background='#2352ff1a'}
                onMouseLeave={e=>e.target.style.background='#e8ecff'}>
                ✏️ Edit
              </button>
            )}
            <button onClick={onDownload}
              style={{ flex:1, padding:'8px', borderRadius:8, background:'#e0faf2',
                color:'#00875f', border:'none', fontSize:12, fontWeight:700, cursor:'pointer' }}
              onMouseEnter={e=>e.target.style.background='#00c48c'}
              onMouseLeave={e=>e.target.style.background='#e0faf2'}>
              ↓ Download
            </button>
            <button onClick={onDelete}
              style={{ flex:1, padding:'8px', borderRadius:8, background:'#fee2e2',
                color:'#b91c1c', border:'none', fontSize:12, fontWeight:700, cursor:'pointer' }}
              onMouseEnter={e=>e.target.style.background='#ef4444'}
              onMouseLeave={e=>e.target.style.background='#fee2e2'}>
              🗑 Delete
            </button>
          </div>
        )}
      </div>
    )
  }

  /* ── MODE 2: Built-in template (T1 / T2 / T3) ── */
  const t = TEMPLATES[templateId] || TEMPLATES.T1

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:0 }}>
      <div ref={ref} id={`card-${sub.id}`}
        style={{ width:280, background:'#fff', borderRadius:14, overflow:'hidden',
          boxShadow:'0 4px 20px rgba(0,0,0,.12)', border:'1px solid #e8eaf0',
          fontFamily:'Instrument Sans,sans-serif' }}>

        {/* Header */}
        <div style={{ background:`linear-gradient(135deg,${t.c1},${t.c2})`,
          padding:'14px 16px', display:'flex', alignItems:'center', gap:10 }}>
          <div style={{ width:38, height:38, borderRadius:8, background:'rgba(255,255,255,.22)',
            display:'flex', alignItems:'center', justifyContent:'center',
            fontFamily:'Outfit,sans-serif', fontWeight:900, fontSize:13, color:'#fff',
            flexShrink:0, overflow:'hidden', border:'1.5px solid rgba(255,255,255,.25)' }}>
            {orgLogo
              ? <img src={orgLogo} style={{ width:'100%', height:'100%', objectFit:'cover' }} alt="" crossOrigin="anonymous"/>
              : (sub.school_name || 'SC').slice(0,2).toUpperCase()
            }
          </div>
          <div>
            <div style={{ fontFamily:'Outfit,sans-serif', fontSize:12, fontWeight:800, color:'#fff', lineHeight:1.3 }}>
              {sub.school_name || 'School Name'}
            </div>
            <div style={{ fontSize:10, color:'rgba(255,255,255,.75)', marginTop:1 }}>
              {sub.role || 'Student'} Identity Card
            </div>
          </div>
        </div>

        {/* Body */}
        <div style={{ padding:'14px 16px' }}>
          <div style={{ display:'flex', gap:12, marginBottom:12 }}>
            <div style={{ width:64, height:80, borderRadius:8, border:`2px solid ${t.c1}`,
              overflow:'hidden', flexShrink:0, background:t.accent,
              display:'flex', alignItems:'center', justifyContent:'center' }}>
              {sub.photo_url
                ? <img src={sub.photo_url} style={{ width:'100%', height:'100%', objectFit:'cover' }} alt=""/>
                : <span style={{ fontSize:28 }}>👤</span>
              }
            </div>
            <div style={{ flex:1 }}>
              <div style={{ fontFamily:'Outfit,sans-serif', fontSize:14, fontWeight:800,
                color:'#0b0f1e', lineHeight:1.2, marginBottom:4 }}>
                {sub.name || 'Full Name'}
              </div>
              {sub.designation    && <div style={{ fontSize:11, color:t.c1, fontWeight:700, marginBottom:3 }}>{sub.designation}</div>}
              {sub.class          && <div style={{ fontSize:11, color:'#666' }}>Class {sub.class}{sub.section?`-${sub.section}`:''}</div>}
              {sub.roll_number    && <div style={{ fontSize:11, color:'#666' }}>Roll No: {sub.roll_number}</div>}
              {sub.admission_number && <div style={{ fontSize:11, color:'#666' }}>Adm: {sub.admission_number}</div>}
              {sub.employee_id   && <div style={{ fontSize:11, color:'#666' }}>Emp ID: {sub.employee_id}</div>}
            </div>
          </div>

          <div style={{ display:'flex', flexDirection:'column', gap:5,
            paddingTop:10, borderTop:'1px solid #f0f0f0' }}>
            {[
              ['Date of Birth', formatDOB(sub.date_of_birth)],
              ['Blood Group',   sub.blood_group],
              ['Contact',       sub.contact_number],
              ['Emergency',     sub.emergency_contact],
              ['Department',    sub.department],
              ['Transport',     sub.mode_of_transport],
              ['Employee ID',   sub.employee_id],
              ['Address',       sub.address],
            ].map(([label, value]) => value ? (
              <div key={label} style={{ display:'flex', alignItems:'flex-start', gap:0 }}>
                <span style={{ fontSize:10, fontWeight:700, color:'#555', whiteSpace:'nowrap', minWidth:72, flexShrink:0, lineHeight:1.3 }}>{label}</span>
                <span style={{ fontSize:10, fontWeight:700, color:'#555', margin:'0 3px', flexShrink:0, lineHeight:1.3 }}>{' : '}</span>
                <span style={{ fontSize:11, fontWeight:600, color:'#1a1a2e', minWidth:0, wordBreak:'break-word', overflowWrap:'break-word', lineHeight:1.3 }}>{value}</span>
              </div>
            ) : null)}
          </div>
        </div>

        {/* Footer */}
        <div style={{ background:`linear-gradient(135deg,${t.c1}18,${t.c2}10)`,
          padding:'10px 16px', display:'flex', justifyContent:'space-between',
          alignItems:'center', borderTop:`1px solid ${t.c1}22` }}>
          <div style={{ display:'flex', gap:1.5, alignItems:'flex-end' }}>
            {Array.from({length:22},(_,i) => (
              <div key={i} style={{ width:1.5+Math.abs(Math.sin(i*2.3))*1,
                height:16+Math.abs(Math.cos(i*1.7))*10, background:t.c1,
                opacity:.7, borderRadius:1 }}/>
            ))}
          </div>
          <div style={{ fontSize:9, fontFamily:'JetBrains Mono,monospace',
            color:t.c1, fontWeight:600, opacity:.8 }}>
            {(sub.id||'ID000000').slice(0,8).toUpperCase()}
          </div>
        </div>
      </div>

      {/* Action buttons */}
      {showActions && (
        <div style={{ display:'flex', gap:8, marginTop:10 }}>
          {onEdit && (
            <button onClick={onEdit}
              style={{ flex:1, padding:'8px', borderRadius:8, background:'#e8ecff',
                color:'#2352ff', border:'none', fontSize:12, fontWeight:700, cursor:'pointer',
                transition: 'background .15s, color .15s' }}
              onMouseEnter={e=>e.target.style.background='#2352ff1a'}
              onMouseLeave={e=>e.target.style.background='#e8ecff'}>
              ✏️ Edit
            </button>
          )}
          <button onClick={onDownload}
            style={{ flex:1, padding:'8px', borderRadius:8, background:'#e0faf2',
              color:'#00875f', border:'none', fontSize:12, fontWeight:700, cursor:'pointer' }}
            onMouseEnter={e=>e.target.style.background='#00c48c'}
            onMouseLeave={e=>e.target.style.background='#e0faf2'}>
            ↓ Download
          </button>
          <button onClick={onDelete}
            style={{ flex:1, padding:'8px', borderRadius:8, background:'#fee2e2',
              color:'#b91c1c', border:'none', fontSize:12, fontWeight:700, cursor:'pointer' }}
            onMouseEnter={e=>e.target.style.background='#ef4444'}
            onMouseLeave={e=>e.target.style.background='#fee2e2'}>
            🗑 Delete
          </button>
        </div>
      )}
    </div>
  )
})

export default IDCard
export { TEMPLATES }