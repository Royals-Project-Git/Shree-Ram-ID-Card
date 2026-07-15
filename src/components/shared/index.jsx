import { useState } from 'react'

/* ── Avatar ─────────────────────────────────────── */
export const Avatar = ({ name = '', size = 36, bg = 'var(--blue)', color = '#fff', src = null, style = {} }) => {
  const initials = name.split(' ').slice(0, 2).map(w => w[0] || '').join('').toUpperCase()
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', background: src ? 'transparent' : bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.35, fontWeight: 700, color, fontFamily: 'Outfit,sans-serif', flexShrink: 0, overflow: 'hidden', ...style }}>
      {src ? <img src={src} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" /> : initials}
    </div>
  )
}

/* ── Badge ──────────────────────────────────────── */
export const Badge = ({ type = 'gray', children, dot = false }) => {
  const map = {
    blue:   { background: 'var(--blue-s)',   color: 'var(--blue)' },
    teal:   { background: 'var(--teal-s)',   color: '#00875f' },
    amber:  { background: 'var(--amber-s)',  color: '#b45309' },
    red:    { background: 'var(--red-s)',    color: '#b91c1c' },
    gray:   { background: 'var(--paper3)',   color: 'var(--ink2)' },
    purple: { background: 'var(--purple-s)', color: '#5b21b6' },
  }
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 9px', borderRadius: 20, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: .4, ...(map[type] || map.gray) }}>
      {dot && <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'currentColor' }} />}
      {children}
    </span>
  )
}

/* ── Button ─────────────────────────────────────── */
export const Btn = ({ children, variant = 'primary', size = 'md', full = false, onClick, disabled = false, style = {}, type = 'button', ...rest }) => {
  const v = {
    primary: { background: 'var(--blue)',   color: '#fff', border: 'none', hoverBg: 'var(--blue-d)' },
    teal:    { background: 'var(--teal)',   color: '#fff', border: 'none', hoverBg: '#00a876' },
    danger:  { background: 'var(--red)',    color: '#fff', border: 'none', hoverBg: '#dc2626' },
    ghost:   { background: 'transparent',  color: 'var(--ink2)', border: '1.5px solid var(--border2)', hoverBg: 'var(--paper3)' },
    soft:    { background: 'var(--blue-s)', color: 'var(--blue)', border: '1.5px solid var(--blue-m)', hoverBg: '#dde4ff' },
    success: { background: '#16a34a',       color: '#fff', border: 'none', hoverBg: '#15803d' },
  }
  const s = { sm: { padding: '7px 14px', fontSize: 12 }, md: { padding: '10px 20px', fontSize: 14 }, lg: { padding: '13px 28px', fontSize: 15 } }
  const cur = v[variant] || v.primary
  return (
    <button type={type} onClick={onClick} disabled={disabled} {...rest}
      style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7, borderRadius: 'var(--r)', fontFamily: 'inherit', fontWeight: 700, cursor: disabled ? 'not-allowed' : 'pointer', transition: 'all .18s', opacity: disabled ? .5 : 1, width: full ? '100%' : 'auto', border: cur.border, background: cur.background, color: cur.color, ...(s[size] || s.md), ...style }}
      onMouseEnter={e => { if (!disabled) { e.currentTarget.style.background = cur.hoverBg; e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 6px 20px rgba(0,0,0,.15)'; } }}
      onMouseLeave={e => { e.currentTarget.style.background = cur.background; e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = ''; }}>
      {children}
    </button>
  )
}

/* ── Input ──────────────────────────────────────── */
export const Input = ({ label, error, icon, suffix, type = 'text', value, onChange, placeholder, required = false, style = {}, ...props }) => (
  <div style={style}>
    {label && <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--ink3)', textTransform: 'uppercase', letterSpacing: .5, marginBottom: 6 }}>{label}{required && <span style={{ color: 'var(--red)', marginLeft: 3 }}>*</span>}</label>}
    <div style={{ position: 'relative' }}>
      {icon && <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 15, pointerEvents: 'none', zIndex: 1 }}>{icon}</span>}
      <input type={type} value={value} onChange={onChange} placeholder={placeholder} required={required} {...props}
        style={{ width: '100%', padding: icon ? '10px 14px 10px 38px' : '10px 14px', paddingRight: suffix ? '40px' : '14px', borderRadius: 'var(--r)', border: `1.5px solid ${error ? 'var(--red)' : 'var(--border)'}`, fontSize: 14, color: 'var(--ink)', background: 'var(--paper)', outline: 'none', transition: 'all .18s' }}
        onFocus={e => { e.target.style.borderColor = 'var(--blue)'; e.target.style.boxShadow = '0 0 0 3px rgba(35,82,255,.1)'; }}
        onBlur={e => { e.target.style.borderColor = error ? 'var(--red)' : 'var(--border)'; e.target.style.boxShadow = 'none'; }} />
      {suffix && <button type="button" onClick={suffix.onClick} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink3)', fontSize: 16 }}>{suffix.icon}</button>}
    </div>
    {error && <p style={{ fontSize: 11, color: 'var(--red)', marginTop: 4 }}>{error}</p>}
  </div>
)

/* ── Select ─────────────────────────────────────── */
export const Select = ({ label, value, onChange, options, required = false, style = {} }) => (
  <div style={style}>
    {label && <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--ink3)', textTransform: 'uppercase', letterSpacing: .5, marginBottom: 6 }}>{label}{required && <span style={{ color: 'var(--red)', marginLeft: 3 }}>*</span>}</label>}
    <select value={value} onChange={onChange} style={{ width: '100%', padding: '10px 14px', borderRadius: 'var(--r)', border: '1.5px solid var(--border)', fontSize: 14, color: 'var(--ink)', background: 'var(--paper)', outline: 'none', cursor: 'pointer' }}>
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  </div>
)

/* ── Card ───────────────────────────────────────── */
export const Card = ({ children, style = {}, onClick }) => (
  <div onClick={onClick} style={{ background: 'var(--paper)', borderRadius: 'var(--rl)', border: '1px solid var(--border)', boxShadow: 'var(--shadow)', ...style }}>
    {children}
  </div>
)

/* ── Modal ──────────────────────────────────────── */
export const Modal = ({ open, onClose, children, title, width = 520 }) => {
  if (!open) return null
  return (
    <div className="anim-fade-in" style={{ position: 'fixed', inset: 0, background: 'rgba(11,15,30,.55)', backdropFilter: 'blur(8px)', zIndex: 3000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="anim-scale-in" style={{ background: 'var(--paper)', borderRadius: 'var(--rxl)', padding: 32, width: '100%', maxWidth: width, maxHeight: '90vh', overflowY: 'auto', boxShadow: 'var(--shadow-xl)' }}>
        {title && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
            <h2 style={{ fontFamily: 'Outfit,sans-serif', fontSize: 22, fontWeight: 800, color: 'var(--ink)' }}>{title}</h2>
            <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: 8, border: '1.5px solid var(--border)', background: 'transparent', cursor: 'pointer', fontSize: 16, color: 'var(--ink2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
          </div>
        )}
        {children}
      </div>
    </div>
  )
}

/* ── Spinner ─────────────────────────────────────── */
export const Spinner = ({ size = 20 }) => (
  <div style={{ width: size, height: size, border: `2px solid var(--border)`, borderTopColor: 'var(--blue)', borderRadius: '50%', animation: 'spin 0.7s linear infinite', flexShrink: 0 }} />
)

/* ── Empty State ─────────────────────────────────── */
export const EmptyState = ({ icon = '📭', title, desc, action }) => (
  <div style={{ textAlign: 'center', padding: '48px 24px' }}>
    <div style={{ fontSize: 48, marginBottom: 12 }}>{icon}</div>
    <h3 style={{ fontFamily: 'Outfit,sans-serif', fontSize: 18, fontWeight: 700, color: 'var(--ink)', marginBottom: 6 }}>{title}</h3>
    <p style={{ fontSize: 14, color: 'var(--ink3)', marginBottom: action ? 20 : 0 }}>{desc}</p>
    {action}
  </div>
)

/* ── Confirm Dialog ──────────────────────────────── */
export const ConfirmDialog = ({ open, onClose, onConfirm, title, message, confirmLabel = 'Confirm', danger = false }) => (
  <Modal open={open} onClose={onClose} title={title} width={400}>
    <p style={{ fontSize: 14, color: 'var(--ink2)', lineHeight: 1.6, marginBottom: 24 }}>{message}</p>
    <div style={{ display: 'flex', gap: 10 }}>
      <Btn variant="ghost" full onClick={onClose}>Cancel</Btn>
      <Btn variant={danger ? 'danger' : 'primary'} full onClick={() => { onConfirm(); onClose(); }}>{confirmLabel}</Btn>
    </div>
  </Modal>
)
