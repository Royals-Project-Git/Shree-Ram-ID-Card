import { useState, useCallback } from 'react'
import Cropper from 'react-easy-crop'

/* ══════════════════════════════════════════════════════════════════
   getCroppedImg — applies crop + rotation + flip + adjustments
══════════════════════════════════════════════════════════════════ */
async function getCroppedImg(imageSrc, pixelCrop, rotation = 0, flip = { h: false, v: false }, adjustments = {}) {
  const image = await new Promise((resolve, reject) => {
    const img = new Image()
    img.setAttribute('crossOrigin', 'anonymous')
    img.onload  = () => resolve(img)
    img.onerror = reject
    img.src     = imageSrc
  })

  const rotRad    = (rotation * Math.PI) / 180
  const bboxW     = Math.abs(Math.cos(rotRad) * image.width)  + Math.abs(Math.sin(rotRad) * image.height)
  const bboxH     = Math.abs(Math.sin(rotRad) * image.width)  + Math.abs(Math.cos(rotRad) * image.height)

  const rotCanvas = document.createElement('canvas')
  const rotCtx    = rotCanvas.getContext('2d')
  rotCanvas.width  = bboxW
  rotCanvas.height = bboxH
  rotCtx.translate(bboxW / 2, bboxH / 2)
  rotCtx.rotate(rotRad)
  rotCtx.scale(flip.h ? -1 : 1, flip.v ? -1 : 1)
  rotCtx.drawImage(image, -image.width / 2, -image.height / 2)

  const cropCanvas = document.createElement('canvas')
  const cropCtx    = cropCanvas.getContext('2d')
  cropCanvas.width  = pixelCrop.width
  cropCanvas.height = pixelCrop.height
  cropCtx.drawImage(rotCanvas, pixelCrop.x, pixelCrop.y, pixelCrop.width, pixelCrop.height, 0, 0, pixelCrop.width, pixelCrop.height)

  /* ── CSS filter adjustments via OffscreenCanvas or ImageData ── */
  const { brightness = 100, contrast = 100, saturation = 100, sharpness = 0, warmth = 0 } = adjustments

  const finalCanvas = document.createElement('canvas')
  finalCanvas.width  = cropCanvas.width
  finalCanvas.height = cropCanvas.height
  const finalCtx     = finalCanvas.getContext('2d')

  // Apply CSS-style filters
  finalCtx.filter = [
    `brightness(${brightness}%)`,
    `contrast(${contrast}%)`,
    `saturate(${saturation}%)`,
    sharpness > 0 ? `drop-shadow(0 0 ${sharpness * 0.3}px rgba(0,0,0,0.1))` : '',
  ].filter(Boolean).join(' ')

  finalCtx.drawImage(cropCanvas, 0, 0)

  // Warmth — tint via overlay
  if (warmth !== 0) {
    finalCtx.filter = 'none'
    finalCtx.globalCompositeOperation = warmth > 0 ? 'soft-light' : 'soft-light'
    finalCtx.fillStyle = warmth > 0
      ? `rgba(255, 140, 0, ${Math.abs(warmth) / 400})`
      : `rgba(100, 180, 255, ${Math.abs(warmth) / 400})`
    finalCtx.fillRect(0, 0, finalCanvas.width, finalCanvas.height)
    finalCtx.globalCompositeOperation = 'source-over'
  }

  return finalCanvas.toDataURL('image/jpeg', 0.93)
}

/* ── Aspect ratio presets ─────────────────────────────────────── */
const RATIOS = [
  { label: 'ID Card',   icon: '🪪', value: 3/4,       desc: '3:4' },
  { label: 'Square',    icon: '⬜', value: 1,          desc: '1:1' },
  { label: 'Portrait',  icon: '📱', value: 9/16,       desc: '9:16' },
  { label: 'Landscape', icon: '🖼', value: 16/9,       desc: '16:9' },
  { label: 'Passport',  icon: '📷', value: 35/45,      desc: '35:45' },
  { label: 'Free',      icon: '✂️', value: undefined,   desc: 'Free' },
]

/* ── Adjustment slider ────────────────────────────────────────── */
function AdjSlider({ icon, label, value, min, max, step = 1, onChange, color = '#2352ff' }) {
  const pct = ((value - min) / (max - min)) * 100
  const isDefault = value === Math.round((min + max) / 2) || (min === 0 && value === 100)
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: '#aab0d0', display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 14 }}>{icon}</span>{label}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 11, fontFamily: 'JetBrains Mono,monospace', color: isDefault ? '#555' : color, fontWeight: 700, minWidth: 32, textAlign: 'right' }}>
            {value > 0 && min < 0 ? `+${value}` : value}
          </span>
          {!isDefault && (
            <button onClick={() => onChange(min < 0 ? 0 : 100)}
              style={{ fontSize: 10, color: '#666', background: 'none', border: 'none', cursor: 'pointer', padding: '1px 4px', borderRadius: 3 }}>↺</button>
          )}
        </div>
      </div>
      <div style={{ position: 'relative', height: 4, borderRadius: 4, background: '#2a2d40', cursor: 'pointer' }}>
        {/* Center tick for bi-directional sliders */}
        {min < 0 && <div style={{ position: 'absolute', left: '50%', top: -2, width: 1, height: 8, background: '#444', transform: 'translateX(-50%)' }}/>}
        <div style={{ position: 'absolute', left: 0, width: `${pct}%`, height: '100%', borderRadius: 4, background: `linear-gradient(90deg, ${color}88, ${color})`, transition: 'width .1s' }}/>
        <input type="range" min={min} max={max} step={step} value={value}
          onChange={e => onChange(Number(e.target.value))}
          style={{ position: 'absolute', inset: 0, width: '100%', opacity: 0, cursor: 'pointer', margin: 0, height: '100%' }}/>
        <div style={{ position: 'absolute', top: '50%', left: `${pct}%`, transform: 'translate(-50%,-50%)', width: 14, height: 14, borderRadius: '50%', background: '#fff', border: `2px solid ${color}`, boxShadow: '0 2px 8px rgba(0,0,0,.5)', pointerEvents: 'none', transition: 'left .1s' }}/>
      </div>
    </div>
  )
}

/* ── Tab button ───────────────────────────────────────────────── */
function Tab({ active, onClick, children }) {
  return (
    <button onClick={onClick}
      style={{ padding: '8px 16px', background: active ? '#2352ff' : 'transparent', color: active ? '#fff' : '#666', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer', transition: 'all .18s', fontFamily: 'inherit' }}>
      {children}
    </button>
  )
}

/* ══════════════════════════════════════════════════════════════════
   Main PhotoCrop component — Adobe Lightroom-style editor
══════════════════════════════════════════════════════════════════ */
export default function PhotoCrop({ open, imageUrl, onDone, onClose }) {
  /* Crop state */
  const [crop,        setCrop]        = useState({ x: 0, y: 0 })
  const [zoom,        setZoom]        = useState(1)
  const [rotation,    setRotation]    = useState(0)
  const [croppedArea, setCroppedArea] = useState(null)
  const [flip,        setFlip]        = useState({ h: false, v: false })
  const [ratio,       setRatio]       = useState(RATIOS[0])

  /* Adjustments */
  const [brightness,  setBrightness]  = useState(100)
  const [contrast,    setContrast]    = useState(100)
  const [saturation,  setSaturation]  = useState(100)
  const [warmth,      setWarmth]      = useState(0)
  const [sharpness,   setSharpness]   = useState(0)
  const [vignette,    setVignette]    = useState(0)

  /* UI state */
  const [tab,         setTab]         = useState('crop')    // crop | adjust | filter
  const [applying,    setApplying]    = useState(false)
  const [showGrid,    setShowGrid]    = useState(true)
  const [filter,      setFilter]      = useState('none')

  const onCropComplete = useCallback((_, pixels) => setCroppedArea(pixels), [])

  const resetAll = () => {
    setCrop({ x: 0, y: 0 }); setZoom(1); setRotation(0); setFlip({ h: false, v: false })
    setBrightness(100); setContrast(100); setSaturation(100); setWarmth(0); setSharpness(0); setVignette(0)
    setFilter('none')
  }

  const handleDone = async () => {
    if (!croppedArea) return
    setApplying(true)
    try {
      const result = await getCroppedImg(imageUrl, croppedArea, rotation, flip, { brightness, contrast, saturation, sharpness, warmth })
      onDone(result)
      onClose()
    } catch (err) {
      console.error('Crop failed:', err)
    } finally { setApplying(false) }
  }

  /* Preview filter string for cropper overlay */
  const previewFilter = [
    filter !== 'none' ? FILTERS.find(f => f.id === filter)?.css || '' : '',
    `brightness(${brightness}%)`,
    `contrast(${contrast}%)`,
    `saturate(${saturation}%)`,
  ].filter(Boolean).join(' ')

  if (!open) return null

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 4000, display: 'flex', flexDirection: 'column', background: '#0a0b12' }}>

      {/* ── Top bar ─────────────────────────────────────────── */}
      <div style={{ height: 52, background: '#111320', borderBottom: '1px solid #1e2235', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 20px', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#888', fontSize: 20, cursor: 'pointer', padding: '4px 8px', borderRadius: 6 }}>✕</button>
          <span style={{ fontFamily: 'Outfit,sans-serif', fontSize: 15, fontWeight: 700, color: '#e0e4f0' }}>✂ Photo Editor</span>
          <span style={{ fontSize: 11, color: '#444', fontWeight: 500 }}>|</span>
          <span style={{ fontSize: 11, color: '#555', fontWeight: 500 }}>Drag · Pinch to zoom · Rotate</span>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 4, background: '#0d0f1c', borderRadius: 10, padding: 4 }}>
          <Tab active={tab === 'crop'}   onClick={() => setTab('crop')}>✂ Crop</Tab>
          <Tab active={tab === 'adjust'} onClick={() => setTab('adjust')}>🎨 Adjust</Tab>
          <Tab active={tab === 'filter'} onClick={() => setTab('filter')}>✨ Filters</Tab>
        </div>

        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <button onClick={resetAll}
            style={{ padding: '7px 14px', borderRadius: 8, border: '1px solid #2a2d40', background: 'transparent', color: '#888', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
            ↺ Reset All
          </button>
          <button onClick={handleDone} disabled={applying || !croppedArea}
            style={{ padding: '7px 20px', borderRadius: 8, border: 'none', background: applying ? '#1a2566' : '#2352ff', color: '#fff', fontSize: 13, fontWeight: 700, cursor: applying ? 'not-allowed' : 'pointer', fontFamily: 'inherit', opacity: !croppedArea ? .5 : 1 }}>
            {applying ? '⏳ Applying...' : '✓ Apply & Use'}
          </button>
        </div>
      </div>

      {/* ── Main area ────────────────────────────────────────── */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

        {/* ── Left sidebar ── */}
        <div style={{ width: 220, background: '#111320', borderRight: '1px solid #1e2235', overflowY: 'auto', flexShrink: 0, padding: '16px 14px' }}>

          {/* ── CROP TAB ── */}
          {tab === 'crop' && (
            <>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#444', textTransform: 'uppercase', letterSpacing: .8, marginBottom: 12 }}>Aspect Ratio</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 20 }}>
                {RATIOS.map(r => (
                  <button key={r.label} onClick={() => setRatio(r)}
                    style={{ padding: '8px 6px', borderRadius: 8, border: `1.5px solid ${ratio.label === r.label ? '#2352ff' : '#1e2235'}`, background: ratio.label === r.label ? '#172050' : '#0d0f1c', color: ratio.label === r.label ? '#7099ff' : '#666', fontSize: 11, fontWeight: 700, cursor: 'pointer', textAlign: 'center', fontFamily: 'inherit', transition: 'all .15s' }}>
                    <div style={{ fontSize: 16, marginBottom: 3 }}>{r.icon}</div>
                    <div>{r.label}</div>
                    <div style={{ fontSize: 9, color: '#555', marginTop: 1 }}>{r.desc}</div>
                  </button>
                ))}
              </div>

              <div style={{ fontSize: 10, fontWeight: 700, color: '#444', textTransform: 'uppercase', letterSpacing: .8, marginBottom: 12 }}>Rotation</div>
              <AdjSlider icon="🔄" label="Rotate" value={rotation} min={-180} max={180} onChange={setRotation} color="#7c5cfc"/>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 6, marginBottom: 20 }}>
                {[['↶ -90°', -90], ['↺ 0°', 0], ['↷ +90°', 90]].map(([label, val]) => (
                  <button key={label} onClick={() => setRotation(r => val === 0 ? 0 : r + val)}
                    style={{ padding: '7px 4px', borderRadius: 7, border: '1px solid #1e2235', background: '#0d0f1c', color: '#888', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                    {label}
                  </button>
                ))}
              </div>

              <div style={{ fontSize: 10, fontWeight: 700, color: '#444', textTransform: 'uppercase', letterSpacing: .8, marginBottom: 12 }}>Zoom</div>
              <AdjSlider icon="🔍" label="Zoom" value={Math.round(zoom * 100)} min={100} max={300} onChange={v => setZoom(v / 100)} color="#2352ff"/>

              <div style={{ fontSize: 10, fontWeight: 700, color: '#444', textTransform: 'uppercase', letterSpacing: .8, marginBottom: 12 }}>Flip</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 20 }}>
                <button onClick={() => setFlip(f => ({ ...f, h: !f.h }))}
                  style={{ padding: '9px', borderRadius: 8, border: `1.5px solid ${flip.h ? '#2352ff' : '#1e2235'}`, background: flip.h ? '#172050' : '#0d0f1c', color: flip.h ? '#7099ff' : '#666', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                  ↔ Horizontal
                </button>
                <button onClick={() => setFlip(f => ({ ...f, v: !f.v }))}
                  style={{ padding: '9px', borderRadius: 8, border: `1.5px solid ${flip.v ? '#2352ff' : '#1e2235'}`, background: flip.v ? '#172050' : '#0d0f1c', color: flip.v ? '#7099ff' : '#666', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                  ↕ Vertical
                </button>
              </div>

              <div style={{ fontSize: 10, fontWeight: 700, color: '#444', textTransform: 'uppercase', letterSpacing: .8, marginBottom: 12 }}>Grid</div>
              <button onClick={() => setShowGrid(g => !g)}
                style={{ width: '100%', padding: '9px', borderRadius: 8, border: `1.5px solid ${showGrid ? '#2352ff' : '#1e2235'}`, background: showGrid ? '#172050' : '#0d0f1c', color: showGrid ? '#7099ff' : '#666', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                {showGrid ? '⊞ Grid On' : '⊟ Grid Off'}
              </button>
            </>
          )}

          {/* ── ADJUST TAB ── */}
          {tab === 'adjust' && (
            <>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#444', textTransform: 'uppercase', letterSpacing: .8, marginBottom: 14 }}>Light</div>
              <AdjSlider icon="☀️" label="Brightness" value={brightness} min={50}  max={150} onChange={setBrightness} color="#f59e0b"/>
              <AdjSlider icon="◑"  label="Contrast"   value={contrast}   min={50}  max={150} onChange={setContrast}   color="#6366f1"/>
              <AdjSlider icon="🌡" label="Warmth"      value={warmth}     min={-100} max={100} onChange={setWarmth}   color="#ef4444"/>

              <div style={{ height: 1, background: '#1e2235', margin: '16px 0' }}/>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#444', textTransform: 'uppercase', letterSpacing: .8, marginBottom: 14 }}>Color</div>
              <AdjSlider icon="🎨" label="Saturation" value={saturation} min={0}   max={200} onChange={setSaturation} color="#10b981"/>

              <div style={{ height: 1, background: '#1e2235', margin: '16px 0' }}/>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#444', textTransform: 'uppercase', letterSpacing: .8, marginBottom: 14 }}>Detail</div>
              <AdjSlider icon="🔬" label="Sharpness"  value={sharpness}  min={0}   max={100} onChange={setSharpness}  color="#06b6d4"/>
              <AdjSlider icon="🌑" label="Vignette"   value={vignette}   min={0}   max={100} onChange={setVignette}   color="#8b5cf6"/>

              <button onClick={() => { setBrightness(100); setContrast(100); setSaturation(100); setWarmth(0); setSharpness(0); setVignette(0) }}
                style={{ width: '100%', marginTop: 16, padding: '9px', borderRadius: 8, border: '1px solid #1e2235', background: '#0d0f1c', color: '#666', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                ↺ Reset Adjustments
              </button>
            </>
          )}

          {/* ── FILTER TAB ── */}
          {tab === 'filter' && (
            <>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#444', textTransform: 'uppercase', letterSpacing: .8, marginBottom: 12 }}>Presets</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {FILTERS.map(f => (
                  <button key={f.id} onClick={() => setFilter(f.id)}
                    style={{ padding: '10px 12px', borderRadius: 8, border: `1.5px solid ${filter === f.id ? '#2352ff' : '#1e2235'}`, background: filter === f.id ? '#172050' : '#0d0f1c', color: filter === f.id ? '#7099ff' : '#888', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 10, transition: 'all .15s', textAlign: 'left' }}>
                    <span style={{ fontSize: 18 }}>{f.icon}</span>
                    <div>
                      <div style={{ color: filter === f.id ? '#7099ff' : '#ccc' }}>{f.name}</div>
                      <div style={{ fontSize: 10, color: '#555', fontWeight: 400, marginTop: 1 }}>{f.desc}</div>
                    </div>
                    {filter === f.id && <span style={{ marginLeft: 'auto', fontSize: 14, color: '#2352ff' }}>✓</span>}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        {/* ── Center: Cropper canvas ── */}
        <div style={{ flex: 1, position: 'relative', background: '#0a0b12' }}>
          <Cropper
            image={imageUrl}
            crop={crop}
            zoom={zoom}
            rotation={rotation}
            aspect={ratio.value}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={onCropComplete}
            cropShape="rect"
            showGrid={showGrid}
            style={{
              containerStyle: { background: '#0a0b12' },
              mediaStyle: { filter: previewFilter },
              cropAreaStyle: {
                border: '2px solid rgba(99,140,255,.9)',
                boxShadow: '0 0 0 9999px rgba(0,0,0,.65)',
              },
            }}
          />

          {/* Vignette overlay */}
          {vignette > 0 && (
            <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', borderRadius: 0, background: `radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,${vignette / 200}) 100%)` }}/>
          )}

          {/* Bottom info bar */}
          <div style={{ position: 'absolute', bottom: 16, left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: 12, alignItems: 'center', background: 'rgba(0,0,0,.75)', backdropFilter: 'blur(8px)', padding: '8px 18px', borderRadius: 24, border: '1px solid #2a2d40' }}>
            <span style={{ fontSize: 11, color: '#aaa', fontWeight: 600 }}>
              {ratio.icon} {ratio.label} ({ratio.desc})
            </span>
            <span style={{ color: '#2a2d40' }}>|</span>
            <span style={{ fontSize: 11, color: '#aaa', fontWeight: 600 }}>
              🔍 {Math.round(zoom * 100)}%
            </span>
            <span style={{ color: '#2a2d40' }}>|</span>
            <span style={{ fontSize: 11, color: '#aaa', fontWeight: 600 }}>
              🔄 {rotation}°
            </span>
            {(flip.h || flip.v) && (
              <>
                <span style={{ color: '#2a2d40' }}>|</span>
                <span style={{ fontSize: 11, color: '#7099ff', fontWeight: 600 }}>
                  {flip.h ? '↔ Flipped H' : ''}{flip.h && flip.v ? ' · ' : ''}{flip.v ? '↕ Flipped V' : ''}
                </span>
              </>
            )}
          </div>
        </div>

        {/* ── Right sidebar: info + histogram placeholder ── */}
        <div style={{ width: 180, background: '#111320', borderLeft: '1px solid #1e2235', padding: '16px 14px', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Mini histogram (decorative) */}
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#444', textTransform: 'uppercase', letterSpacing: .8, marginBottom: 10 }}>Histogram</div>
            <div style={{ height: 60, background: '#0d0f1c', borderRadius: 8, border: '1px solid #1e2235', overflow: 'hidden', display: 'flex', alignItems: 'flex-end', padding: '0 4px 4px', gap: 1 }}>
              {Array.from({ length: 32 }, (_, i) => {
                const h = 10 + Math.abs(Math.sin(i * 0.4) * 35) + Math.abs(Math.cos(i * 0.7) * 20)
                const bright = i / 32
                return (
                  <div key={i} style={{ flex: 1, height: `${h}%`, borderRadius: '2px 2px 0 0', background: `rgba(${Math.round(bright*200+55)},${Math.round(bright*120+60)},${Math.round(255-bright*100)},0.7)` }}/>
                )
              })}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
              <span style={{ fontSize: 9, color: '#333' }}>Shadows</span>
              <span style={{ fontSize: 9, color: '#555' }}>Highlights</span>
            </div>
          </div>

          {/* Current adjustments summary */}
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#444', textTransform: 'uppercase', letterSpacing: .8, marginBottom: 10 }}>Adjustments</div>
            {[
              ['☀', 'Brightness', brightness, 100],
              ['◑', 'Contrast',   contrast,   100],
              ['🎨', 'Saturation', saturation, 100],
              ['🌡', 'Warmth',     warmth,      0 ],
              ['🔬', 'Sharpness',  sharpness,   0 ],
              ['🌑', 'Vignette',   vignette,    0 ],
            ].map(([icon, label, value, def]) => (
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <span style={{ fontSize: 11, color: '#555' }}>{icon} {label}</span>
                <span style={{ fontSize: 11, fontFamily: 'JetBrains Mono,monospace', color: value === def ? '#333' : '#7099ff', fontWeight: 600 }}>
                  {value === def ? '—' : value > def ? `+${value - def}` : value}
                </span>
              </div>
            ))}
          </div>

          {/* Aspect ratio info */}
          <div style={{ marginTop: 'auto', padding: '10px 12px', background: '#0d0f1c', borderRadius: 8, border: '1px solid #1e2235' }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#444', textTransform: 'uppercase', letterSpacing: .6, marginBottom: 6 }}>Output</div>
            <div style={{ fontSize: 12, color: '#7099ff', fontWeight: 700 }}>{ratio.icon} {ratio.label}</div>
            <div style={{ fontSize: 11, color: '#555', marginTop: 3 }}>JPEG · 93% quality</div>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ── Filter presets ───────────────────────────────────────────── */
const FILTERS = [
  { id: 'none',      icon: '🔲', name: 'Original',   desc: 'No filter',             css: '' },
  { id: 'vivid',     icon: '🌈', name: 'Vivid',       desc: 'Boosted colors',        css: 'saturate(140%) contrast(110%)' },
  { id: 'cool',      icon: '❄️', name: 'Cool',         desc: 'Blue-toned',            css: 'saturate(90%) hue-rotate(15deg) brightness(105%)' },
  { id: 'warm',      icon: '🌅', name: 'Warm',         desc: 'Golden tones',          css: 'sepia(30%) saturate(120%) brightness(105%)' },
  { id: 'bw',        icon: '⬛', name: 'B&W',           desc: 'Black & white',         css: 'grayscale(100%)' },
  { id: 'fade',      icon: '🌫', name: 'Fade',          desc: 'Soft & muted',          css: 'brightness(110%) saturate(80%) contrast(90%)' },
  { id: 'chrome',    icon: '🔮', name: 'Chrome',        desc: 'High contrast',         css: 'contrast(130%) saturate(110%)' },
  { id: 'sepia',     icon: '📜', name: 'Sepia',         desc: 'Vintage warm',          css: 'sepia(60%) contrast(105%)' },
  { id: 'dramatic',  icon: '⚡', name: 'Dramatic',      desc: 'Bold & dark',           css: 'contrast(140%) brightness(90%) saturate(120%)' },
  { id: 'pastel',    icon: '🌸', name: 'Pastel',        desc: 'Soft & light',          css: 'saturate(70%) brightness(115%) contrast(85%)' },
]