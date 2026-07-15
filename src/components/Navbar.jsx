import { useState, useEffect, useRef, useCallback } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useNotifications } from '../hooks/useNotifications'
import { Avatar } from './shared/index'
import toast from 'react-hot-toast'

const NAV_LINKS = [
  { to: '/dashboard',     label: 'Dashboard',        icon: '📊' },
  { to: '/organizations', label: 'Organizations',    icon: '🏢' },
  { to: '/add-template',  label: 'Customize Format', icon: '🎨' },
  { to: '/admin',         label: 'Admin',             icon: '⚙' },
  { to: '/templates',     label: 'All Templates',    icon: '🪪' },
  { to: '/about',         label: 'About Us',          icon: 'ℹ' },
]

/* ── Relative time formatter ────────────────────────────────── */
function timeAgo(ts) {
  if (!ts) return ''
  const date = ts.toDate ? ts.toDate() : new Date(ts)
  const diff  = Math.floor((Date.now() - date.getTime()) / 1000)
  if (diff < 60)    return 'just now'
  if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

/* ── Color map per notification type ───────────────────────── */
const TYPE_COLORS = {
  new_submission: { bg:'#eff6ff', border:'#bfdbfe', dot:'#2352ff'  },
  status_change:  { bg:'#f0fdf4', border:'#bbf7d0', dot:'#00c48c'  },
  new_org:        { bg:'#fef3c7', border:'#fde68a', dot:'#f59e0b'  },
  new_template:   { bg:'#faf5ff', border:'#e9d5ff', dot:'#8b5cf6'  },
  info:           { bg:'#f9fafb', border:'#e5e7eb', dot:'#6b7280'  },
}

/* ── Notification dropdown panel ───────────────────────────── */
function NotificationPanel({ panelRef, onClose }) {
  const { notifications, unreadCount, markRead, markAllRead, deleteNotification, clearAll } = useNotifications()
  const navigate = useNavigate()
  const [clearing, setClearing] = useState(false)
  const [tab, setTab] = useState('all')   // 'all' | 'unread'

  const displayed = tab === 'unread' ? notifications.filter(n => !n.read) : notifications

  const handleItemClick = async (n) => {
    if (!n.read) await markRead(n.id)
    if (n.link) { onClose(); navigate(n.link) }
  }

  const handleMarkAllRead = (e) => {
    // stop the click from bubbling to the document outside-click handler
    e.stopPropagation()
    markAllRead()
  }

  const handleClearAll = async (e) => {
    e.stopPropagation()
    setClearing(true)
    await clearAll()
    setClearing(false)
    toast.success('All notifications cleared')
  }

  const handleDelete = (e, id) => {
    e.stopPropagation()
    deleteNotification(id)
  }

  return (
    <div
      ref={panelRef}
      // stop mousedown from reaching the document listener so the panel stays open
      onMouseDown={e => e.stopPropagation()}
      style={{
        position:'absolute', top:'calc(100% + 10px)', right:0,
        width:360, maxHeight:'80vh',
        background:'var(--paper)', borderRadius:16,
        border:'1px solid var(--border)',
        boxShadow:'0 20px 60px rgba(0,0,0,.15)',
        display:'flex', flexDirection:'column',
        overflow:'hidden', zIndex:2000,
        animation:'notif-drop .18s ease',
      }}>
      <style>{`
        @keyframes notif-drop {
          from { opacity:0; transform:translateY(-8px) }
          to   { opacity:1; transform:translateY(0) }
        }
        .notif-item:hover  { background: var(--paper2) !important; }
        .notif-del-btn:hover { color: var(--red) !important; background: var(--red-s) !important; }
        @media (max-width:420px) {
          .notif-panel { right:-50px !important; width:calc(100vw - 24px) !important; }
        }
      `}</style>

      {/* ── Panel header ── */}
      <div style={{ padding:'14px 16px 0', flexShrink:0 }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <span style={{ fontFamily:'Outfit,sans-serif', fontSize:15, fontWeight:800, color:'var(--ink)' }}>
              Notifications
            </span>
            {unreadCount > 0 && (
              <span style={{ fontSize:11, fontWeight:700, color:'#fff', background:'var(--blue)', borderRadius:20, padding:'2px 7px' }}>
                {unreadCount}
              </span>
            )}
          </div>
          <div style={{ display:'flex', gap:6 }}>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                style={{ fontSize:11, fontWeight:700, color:'var(--blue)', background:'var(--blue-s)', border:'none', borderRadius:6, padding:'4px 8px', cursor:'pointer', fontFamily:'inherit' }}>
                Mark all read
              </button>
            )}
            {notifications.length > 0 && (
              <button
                onClick={handleClearAll}
                disabled={clearing}
                style={{ fontSize:11, fontWeight:700, color:'var(--red)', background:'var(--red-s)', border:'none', borderRadius:6, padding:'4px 8px', cursor:'pointer', fontFamily:'inherit', opacity:clearing ? .5 : 1 }}>
                {clearing ? '…' : 'Clear all'}
              </button>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display:'flex', borderBottom:'1px solid var(--border)' }}>
          {[['all','All'], ['unread', `Unread${unreadCount > 0 ? ` (${unreadCount})` : ''}`]].map(([id, label]) => (
            <button key={id} onClick={() => setTab(id)}
              style={{ padding:'6px 14px', fontSize:12, fontWeight:700, border:'none', background:'transparent', cursor:'pointer', fontFamily:'inherit',
                color: tab===id ? 'var(--blue)' : 'var(--ink3)',
                borderBottom: tab===id ? '2px solid var(--blue)' : '2px solid transparent',
                marginBottom:-1, transition:'all .15s' }}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Notification list ── */}
      <div style={{ overflowY:'auto', flex:1 }}>
        {displayed.length === 0 ? (
          <div style={{ padding:'40px 16px', textAlign:'center' }}>
            <div style={{ fontSize:36, marginBottom:8 }}>🔔</div>
            <div style={{ fontSize:13, fontWeight:700, color:'var(--ink2)', marginBottom:4 }}>
              {tab === 'unread' ? 'All caught up!' : 'No notifications yet'}
            </div>
            <div style={{ fontSize:12, color:'var(--ink3)' }}>
              {tab === 'unread' ? 'No unread notifications.' : 'New submissions and status changes appear here.'}
            </div>
          </div>
        ) : (
          displayed.map(n => {
            const colors = TYPE_COLORS[n.type] || TYPE_COLORS.info
            return (
              <div key={n.id} className="notif-item"
                onClick={() => handleItemClick(n)}
                style={{
                  display:'flex', alignItems:'flex-start', gap:10,
                  padding:'11px 14px',
                  background: n.read ? 'transparent' : colors.bg,
                  borderBottom:'1px solid var(--border)',
                  cursor: n.link ? 'pointer' : 'default',
                  transition:'background .15s', position:'relative',
                }}>

                {/* Unread dot */}
                {!n.read && (
                  <div style={{ position:'absolute', left:5, top:'50%', transform:'translateY(-50%)', width:6, height:6, borderRadius:'50%', background:colors.dot }}/>
                )}

                {/* Icon bubble */}
                <div style={{ width:36, height:36, borderRadius:10, background:colors.bg, border:`1px solid ${colors.border}`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:18, flexShrink:0, marginLeft:8 }}>
                  {n.icon || '🔔'}
                </div>

                {/* Text */}
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:13, fontWeight: n.read ? 600 : 700, color:'var(--ink)', lineHeight:1.3, marginBottom:2 }}>
                    {n.title}
                  </div>
                  {n.body && (
                    <div style={{ fontSize:11, color:'var(--ink3)', lineHeight:1.4, marginBottom:3, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                      {n.body}
                    </div>
                  )}
                  <div style={{ fontSize:10, color:'var(--ink3)', fontWeight:600 }}>
                    {timeAgo(n.created_at)}
                    {n.link && <span style={{ marginLeft:6, color:'var(--blue)' }}>→ View</span>}
                  </div>
                </div>

                {/* Delete ✕ */}
                <button className="notif-del-btn"
                  onClick={e => handleDelete(e, n.id)}
                  style={{ width:22, height:22, borderRadius:6, border:'none', background:'transparent', color:'var(--ink3)', cursor:'pointer', fontSize:13, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, transition:'all .15s' }}>
                  ✕
                </button>
              </div>
            )
          })
        )}
      </div>

      {/* ── Footer count ── */}
      {notifications.length > 0 && (
        <div style={{ padding:'8px 14px', borderTop:'1px solid var(--border)', background:'var(--paper2)', flexShrink:0, textAlign:'center' }}>
          <span style={{ fontSize:11, color:'var(--ink3)' }}>
            {notifications.length} total · {unreadCount} unread
          </span>
        </div>
      )}
    </div>
  )
}

/* ── Bell icon button ───────────────────────────────────────── */
function BellButton({ bellRef, onClick, notifOpen }) {
  const { unreadCount } = useNotifications()
  return (
    <div ref={bellRef} style={{ position:'relative' }}>
      <button
        onClick={onClick}
        aria-label="Notifications"
        style={{ position:'relative', width:38, height:38, borderRadius:10, border:`1.5px solid ${notifOpen?'var(--blue)':'var(--border)'}`, background:notifOpen?'var(--blue-s)':'transparent', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', fontSize:18, transition:'all .15s', flexShrink:0 }}>
        🔔
        {unreadCount > 0 && (
          <span style={{ position:'absolute', top:-5, right:-5, minWidth:18, height:18, borderRadius:9, background:'var(--red)', border:'2px solid var(--paper)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:10, fontWeight:800, color:'#fff', padding:'0 3px', lineHeight:1 }}>
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════
   MAIN NAVBAR
═══════════════════════════════════════════════════════════ */
export default function Navbar() {
  const { user, signOut }           = useAuth()
  const { pathname }                = useLocation()
  const navigate                    = useNavigate()
  const [menuOpen,  setMenuOpen]    = useState(false)
  const [notifOpen, setNotifOpen]   = useState(false)

  const menuRef      = useRef(null)
  // One ref per element so outside-click detection is always accurate
  const bellDesktopRef = useRef(null)
  const bellMobileRef  = useRef(null)
  const panelRef       = useRef(null)

  const handleLogout = async () => {
    await signOut()
    setMenuOpen(false); setNotifOpen(false)
    toast.success('Logged out successfully')
  }

  const toggleNotif = useCallback(() => setNotifOpen(o => !o), [])
  const closeNotif  = useCallback(() => setNotifOpen(false), [])

  // Close mobile menu on outside click
  useEffect(() => {
    const h = (e) => { if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false) }
    if (menuOpen) document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [menuOpen])

  // Close notif panel on outside click
  // Checks both bell buttons AND the panel itself — click inside any of them keeps panel open
  useEffect(() => {
    if (!notifOpen) return
    const h = (e) => {
      const insideBellDesktop = bellDesktopRef.current?.contains(e.target)
      const insideBellMobile  = bellMobileRef.current?.contains(e.target)
      const insidePanel       = panelRef.current?.contains(e.target)
      if (!insideBellDesktop && !insideBellMobile && !insidePanel) {
        setNotifOpen(false)
      }
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [notifOpen])

  // Close everything on route change
  useEffect(() => { setMenuOpen(false); setNotifOpen(false) }, [pathname])

  return (
    <>
      <style>{`
        .nb-links      { display: flex; align-items: center; gap: 2px; }
        .nb-right      { display: flex; align-items: center; gap: 10px; }
        .nb-burger     { display: none !important; }
        .nb-brand-text { display: inline !important; }
        .nb-mob-row    { display: none !important; }

        @media (max-width: 960px) {
          .nb-links   { display: none !important; }
          .nb-right   { display: none !important; }
          .nb-mob-row { display: flex !important; align-items: center; gap: 8px; }
          .nb-burger  { display: flex !important; }
        }
        @media (max-width: 400px) {
          .nb-brand-text { display: none !important; }
        }

        .nb-mobile-drawer {
          position: fixed; top: 64px; left: 0; right: 0;
          background: rgba(255,255,255,.98);
          backdrop-filter: blur(20px);
          border-bottom: 1px solid var(--border);
          z-index: 998;
          padding: 12px 16px 20px;
          box-shadow: 0 8px 32px rgba(0,0,0,.12);
          flex-direction: column; gap: 4px;
          max-height: calc(100vh - 64px);
          overflow-y: auto;
          display: none;
        }
        .nb-mobile-drawer.open { display: flex !important; }
      `}</style>

      <nav style={{ position:'fixed', top:0, left:0, right:0, height:64, background:'rgba(255,255,255,.95)', backdropFilter:'blur(20px)', borderBottom:'1px solid var(--border)', zIndex:1000, display:'flex', alignItems:'center', justifyContent:'space-between', padding:'0 20px', gap:12 }}>

        {/* Brand */}
        <Link to="/" style={{ display:'flex', alignItems:'center', gap:10, textDecoration:'none', flexShrink:0 }}>
          <div style={{ width:38, height:38, background:'var(--blue)', borderRadius:11, display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'Outfit,sans-serif', fontWeight:900, fontSize:14, color:'#fff', letterSpacing:-1, flexShrink:0 }}>SI</div>
          <span className="nb-brand-text" style={{ fontFamily:'Outfit,sans-serif', fontWeight:800, fontSize:17, color:'var(--ink)', letterSpacing:-.4 }}>Shriram ID Cards</span>
        </Link>

        {/* Desktop nav links */}
        {user && (
          <div className="nb-links" style={{ flex:1, justifyContent:'center' }}>
            {NAV_LINKS.map(n => {
              const active = pathname.startsWith(n.to)
              return (
                <Link key={n.to} to={n.to}
                  style={{ padding:'8px 11px', borderRadius:8, fontSize:13, fontWeight:600, color:active?'var(--blue)':'var(--ink2)', background:active?'var(--blue-s)':'transparent', textDecoration:'none', transition:'all .18s', whiteSpace:'nowrap' }}>
                  {n.label}
                </Link>
              )
            })}
          </div>
        )}

        {/* Desktop right — bell + avatar + logout */}
        <div className="nb-right" style={{ position:'relative' }}>
          {user ? (
            <>
              {/* Desktop bell — has its own ref */}
              <BellButton
                bellRef={bellDesktopRef}
                onClick={toggleNotif}
                notifOpen={notifOpen}
              />
              <Avatar name={user.email} size={34} style={{ cursor:'pointer' }}/>
              <button onClick={handleLogout}
                style={{ padding:'8px 16px', borderRadius:8, border:'1.5px solid var(--border2)', background:'transparent', fontSize:13, fontWeight:700, color:'var(--ink2)', cursor:'pointer', transition:'all .18s', whiteSpace:'nowrap' }}
                onMouseEnter={e=>{ e.target.style.color='var(--red)'; e.target.style.borderColor='var(--red)'; e.target.style.background='var(--red-s)' }}
                onMouseLeave={e=>{ e.target.style.color='var(--ink2)'; e.target.style.borderColor='var(--border2)'; e.target.style.background='transparent' }}>
                Log Out
              </button>
            </>
          ) : (
            <button
              onClick={() => {
                if (pathname === '/') document.getElementById('login-box')?.scrollIntoView({ behavior:'smooth' })
                else { navigate('/'); setTimeout(() => document.getElementById('login-box')?.scrollIntoView({ behavior:'smooth' }), 100) }
              }}
              style={{ padding:'8px 18px', borderRadius:8, background:'var(--blue)', color:'#fff', fontSize:13, fontWeight:700, border:'none', cursor:'pointer', fontFamily:'inherit', transition:'all .18s' }}
              onMouseEnter={e => e.currentTarget.style.background='#1538d4'}
              onMouseLeave={e => e.currentTarget.style.background='var(--blue)'}>
              Login
            </button>
          )}
        </div>

        {/* Mobile: bell + hamburger row */}
        {user && (
          <div className="nb-mob-row">
            {/* Mobile bell — separate ref from desktop */}
            <BellButton
              bellRef={bellMobileRef}
              onClick={toggleNotif}
              notifOpen={notifOpen}
            />
            <button className="nb-burger"
              onClick={() => setMenuOpen(o => !o)}
              aria-label="Toggle menu"
              style={{ flexDirection:'column', gap:5, padding:8, borderRadius:8, border:'1.5px solid var(--border)', background:'transparent', cursor:'pointer', alignItems:'center', justifyContent:'center', width:40, height:40, flexShrink:0 }}>
              <span style={{ display:'block', width:18, height:2, background:menuOpen?'var(--blue)':'var(--ink2)', borderRadius:2, transition:'all .2s', transform:menuOpen?'rotate(45deg) translate(5px,5px)':'none' }}/>
              <span style={{ display:'block', width:18, height:2, background:menuOpen?'transparent':'var(--ink2)', borderRadius:2, transition:'opacity .2s' }}/>
              <span style={{ display:'block', width:18, height:2, background:menuOpen?'var(--blue)':'var(--ink2)', borderRadius:2, transition:'all .2s', transform:menuOpen?'rotate(-45deg) translate(5px,-5px)':'none' }}/>
            </button>
          </div>
        )}
        {!user && (
          <button className="nb-burger"
            onClick={() => setMenuOpen(o => !o)}
            aria-label="Toggle menu"
            style={{ flexDirection:'column', gap:5, padding:8, borderRadius:8, border:'1.5px solid var(--border)', background:'transparent', cursor:'pointer', alignItems:'center', justifyContent:'center', width:40, height:40, flexShrink:0 }}>
            <span style={{ display:'block', width:18, height:2, background:'var(--ink2)', borderRadius:2 }}/>
            <span style={{ display:'block', width:18, height:2, background:'var(--ink2)', borderRadius:2 }}/>
            <span style={{ display:'block', width:18, height:2, background:'var(--ink2)', borderRadius:2 }}/>
          </button>
        )}
      </nav>

      {/* Notification panel — rendered ONCE at Navbar level, outside both BellButtons */}
      {user && notifOpen && (
        <div style={{ position:'fixed', top:64, right:20, zIndex:2000 }}>
          <NotificationPanel panelRef={panelRef} onClose={closeNotif} />
        </div>
      )}

      {/* Mobile drawer */}
      <div ref={menuRef} className={`nb-mobile-drawer${menuOpen?' open':''}`}>
        {user ? (
          <>
            <div style={{ display:'flex', alignItems:'center', gap:12, padding:'10px 12px', background:'var(--paper2)', borderRadius:10, marginBottom:8, border:'1px solid var(--border)' }}>
              <Avatar name={user.email} size={36}/>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:13, fontWeight:700, color:'var(--ink)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{user.email}</div>
                <div style={{ fontSize:11, color:'var(--ink3)', marginTop:1 }}>Admin Account</div>
              </div>
            </div>

            {NAV_LINKS.map(n => {
              const active = pathname.startsWith(n.to)
              return (
                <Link key={n.to} to={n.to}
                  style={{ display:'flex', alignItems:'center', gap:12, padding:'12px 14px', borderRadius:10, fontSize:14, fontWeight:600, color:active?'var(--blue)':'var(--ink)', background:active?'var(--blue-s)':'transparent', textDecoration:'none', transition:'all .15s', border:`1px solid ${active?'rgba(35,82,255,.2)':'transparent'}` }}>
                  <span style={{ fontSize:18, width:24, textAlign:'center' }}>{n.icon}</span>
                  <span style={{ flex:1 }}>{n.label}</span>
                  {active && <span style={{ fontSize:8, color:'var(--blue)' }}>●</span>}
                </Link>
              )
            })}

            <div style={{ height:1, background:'var(--border)', margin:'8px 0' }}/>
            <button onClick={handleLogout}
              style={{ display:'flex', alignItems:'center', gap:12, padding:'12px 14px', borderRadius:10, fontSize:14, fontWeight:700, color:'var(--red)', background:'var(--red-s)', border:'1px solid rgba(239,68,68,.2)', cursor:'pointer', fontFamily:'inherit', width:'100%', textAlign:'left' }}>
              <span style={{ fontSize:18, width:24, textAlign:'center' }}>🚪</span>
              Log Out
            </button>
          </>
        ) : (
          <button
            onClick={() => {
              setMenuOpen(false)
              if (pathname === '/') document.getElementById('login-box')?.scrollIntoView({ behavior:'smooth' })
              else { navigate('/'); setTimeout(() => document.getElementById('login-box')?.scrollIntoView({ behavior:'smooth' }), 100) }
            }}
            style={{ padding:'13px', borderRadius:10, background:'var(--blue)', color:'#fff', fontSize:14, fontWeight:700, border:'none', cursor:'pointer', fontFamily:'inherit', width:'100%' }}>
            Login →
          </button>
        )}
      </div>
    </>
  )
}