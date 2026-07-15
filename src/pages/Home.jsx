import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { Input, Btn, Card } from '../components/shared/index'
import toast from 'react-hot-toast'

export default function PageHome() {
  const { signIn }     = useAuth()
  const navigate       = useNavigate()
  const [email, setEmail]   = useState('admin@shriram.com')
  const [pwd,   setPwd]     = useState('')
  const [showP, setShowP]   = useState(false)
  const [loading, setLoading] = useState(false)
  const [errors,  setErrors]  = useState({})

  const handleLogin = async () => {
    const e = {}
    if (!email) e.email = 'Email is required'
    if (!pwd)   e.pwd   = 'Password is required'
    if (Object.keys(e).length) { setErrors(e); return }
    setLoading(true)
    try {
      await signIn(email, pwd)
      toast.success('Welcome back! 👋')
      navigate('/dashboard')
    } catch (err) {
      toast.error(err.message || 'Login failed')
    } finally { setLoading(false) }
  }

  const FloatCard = () => (
    <div className="anim-float" style={{ background: '#fff', borderRadius: 20, padding: 22, width: '100%', maxWidth: 290, boxShadow: '0 20px 60px rgba(35,82,255,.2)', border: '1px solid var(--border)' }}>
      <div style={{ background: 'linear-gradient(135deg,#2352ff,#1538d4)', borderRadius: 12, padding: '14px 16px', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ width: 42, height: 42, borderRadius: '50%', background: 'rgba(255,255,255,.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Outfit,sans-serif', fontWeight: 900, fontSize: 16, color: '#fff' }}>SN</div>
        <div>
          <div style={{ fontFamily: 'Outfit,sans-serif', fontSize: 13, fontWeight: 800, color: '#fff' }}>Netaji School</div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,.75)', marginTop: 1 }}>Student ID Card</div>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        {[['Name','Sneha Rao'],['Class','10-A'],['Roll No','42'],['Blood','B+'],['Contact','98765XXXXX'],['Section','B']].map(([k,v]) => (
          <div key={k} style={{ background: 'var(--paper2)', borderRadius: 8, padding: '8px 10px' }}>
            <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--ink3)', textTransform: 'uppercase', letterSpacing: .5 }}>{k}</div>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink)', marginTop: 1 }}>{v}</div>
          </div>
        ))}
      </div>
      <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: 1.5, alignItems: 'flex-end' }}>
          {Array.from({length:22},(_,i)=>(
            <div key={i} style={{ width: 1.5, height: 12 + Math.abs(Math.sin(i*2.1))*10, background: '#2352ff', opacity:.6, borderRadius:1 }}/>
          ))}
        </div>
        <span style={{ fontSize:10, fontFamily:'JetBrains Mono,monospace', color:'#2352ff', fontWeight:600 }}>SHRIRAM-2024</span>
      </div>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', paddingTop: 64 }}>
      <style>{`
        .home-hero { display: grid; grid-template-columns: 1fr 1fr; gap: 48px; padding: 68px 48px; align-items: center; min-height: calc(100vh - 64px); }
        .home-hero-title { font-size: 52px; }
        .home-hero-desc { font-size: 17px; }
        .home-hero-btns { display: flex; gap: 12px; flex-wrap: wrap; margin-bottom: 40px; }
        .home-stats { display: flex; gap: 36px; }
        .home-login-section { padding: 64px 48px; }
        .home-login-grid { max-width: 960px; margin: 0 auto; display: grid; grid-template-columns: 1fr 1fr; gap: 64px; align-items: center; }
        .home-float-card { display: flex; justify-content: center; }

        @media (max-width: 900px) {
          .home-hero { grid-template-columns: 1fr !important; padding: 48px 24px !important; min-height: auto !important; gap: 36px !important; }
          .home-hero-title { font-size: 38px !important; letter-spacing: -1px !important; }
          .home-float-card { justify-content: center !important; }
          .home-login-grid { grid-template-columns: 1fr !important; gap: 36px !important; }
          .home-login-section { padding: 48px 24px !important; }
        }
        @media (max-width: 600px) {
          .home-hero { padding: 36px 16px !important; }
          .home-hero-title { font-size: 30px !important; }
          .home-hero-desc { font-size: 15px !important; }
          .home-hero-btns { flex-direction: column !important; }
          .home-stats { gap: 20px !important; flex-wrap: wrap !important; }
          .home-login-section { padding: 36px 16px !important; }
        }
      `}</style>

      {/* Hero */}
      <section className="home-hero" style={{ background: 'linear-gradient(135deg,#f0f4ff 0%,#e8eeff 45%,#f5f6fc 100%)', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: -100, right: -100, width: 500, height: 500, borderRadius: '50%', background: 'radial-gradient(circle,rgba(35,82,255,.06),transparent 70%)' }} />
        <div className="anim-fade-up">
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 14px', background: 'var(--blue-s)', borderRadius: 20, fontSize: 12, fontWeight: 700, color: 'var(--blue)', letterSpacing: .5, textTransform: 'uppercase', marginBottom: 22 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--blue)', animation: 'pulseDot 2s infinite' }} />
            v2.0 — Enhanced Platform
          </div>
          <h1 className="home-hero-title" style={{ fontFamily: 'Outfit,sans-serif', fontWeight: 900, lineHeight: 1.08, letterSpacing: -2, color: 'var(--ink)', marginBottom: 18 }}>
            The Fastest Way<br/>to Create <span style={{ color: 'var(--blue)' }}>ID Cards</span>
          </h1>
          <p className="home-hero-desc" style={{ color: 'var(--ink2)', lineHeight: 1.7, marginBottom: 32, maxWidth: 440 }}>
            Generate, manage and distribute professional ID cards for schools, colleges and organizations — in minutes, not days.
          </p>
          <div className="home-hero-btns">
            <Btn size="lg" onClick={() => document.getElementById('login-box').scrollIntoView({ behavior: 'smooth' })}>Get Started →</Btn>
            <Btn size="lg" variant="ghost">Watch Demo ▶</Btn>
          </div>
          <div className="home-stats">
            {[['500+','ID Cards Generated'],['20+','Schools Served'],['99%','Satisfaction']].map(([n,l]) => (
              <div key={l}>
                <div style={{ fontFamily: 'Outfit,sans-serif', fontSize: 28, fontWeight: 900, color: 'var(--ink)', letterSpacing: -1 }}>{n}</div>
                <div style={{ fontSize: 11, color: 'var(--ink3)', fontWeight: 600, marginTop: 2, textTransform: 'uppercase', letterSpacing: .5 }}>{l}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="home-float-card"><FloatCard /></div>
      </section>

      {/* Login */}
      <section id="login-box" className="home-login-section" style={{ background: 'var(--paper)' }}>
        <div className="home-login-grid">
          <div>
            <h2 style={{ fontFamily: 'Outfit,sans-serif', fontSize: 30, fontWeight: 900, color: 'var(--ink)', letterSpacing: -.5, marginBottom: 8 }}>Why Shriram ID Cards?</h2>
            <p style={{ fontSize: 14, color: 'var(--ink2)', marginBottom: 24, lineHeight: 1.6 }}>Trusted by schools and colleges across Nagpur for reliable, professional ID card generation.</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {[['⚡','Instant Generation','Create ID cards in minutes with automated workflows'],['🎨','Custom Templates','Multiple designs with school branding and custom fields'],['🔒','Secure Backend','Supabase PostgreSQL with Row Level Security'],['📱','Photo Crop & Edit','Built-in photo cropper for perfect profile pictures'],['📦','Bulk Download','Download all ID cards as a ZIP file instantly'],['🔴','Real-time Admin','Admin panel updates live as students submit forms']].map(([icon,title,desc]) => (
                <div key={title} style={{ display: 'flex', gap: 12, padding: '12px 14px', borderRadius: 'var(--r)', border: '1px solid var(--border)', background: 'var(--paper2)' }}>
                  <div style={{ width: 36, height: 36, borderRadius: 9, background: 'var(--blue-s)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>{icon}</div>
                  <div><div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>{title}</div><div style={{ fontSize: 11, color: 'var(--ink3)', marginTop: 1 }}>{desc}</div></div>
                </div>
              ))}
            </div>
          </div>
          <Card style={{ padding: 36 }}>
            <h3 style={{ fontFamily: 'Outfit,sans-serif', fontSize: 24, fontWeight: 900, color: 'var(--ink)', marginBottom: 4 }}>Welcome Back</h3>
            <p style={{ fontSize: 14, color: 'var(--ink2)', marginBottom: 28 }}>Sign in to your admin account to continue.</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <Input label="Email / User ID" value={email} onChange={e => setEmail(e.target.value)} placeholder="admin@school.com" icon="✉" error={errors.email} required />
              <Input label="Password" type={showP ? 'text' : 'password'} value={pwd} onChange={e => setPwd(e.target.value)} placeholder="Enter password" icon="🔒" error={errors.pwd} required
                suffix={{ icon: showP ? '🙈' : '👁', onClick: () => setShowP(!showP) }} />
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <span style={{ fontSize: 12, color: 'var(--blue)', cursor: 'pointer', fontWeight: 700 }}>Forgot Password?</span>
              </div>
              <Btn full onClick={handleLogin} disabled={loading}>{loading ? '⏳ Signing in...' : 'Sign In →'}</Btn>
              <div style={{ textAlign: 'center', fontSize: 12, color: 'var(--ink3)', background: 'var(--paper2)', borderRadius: 8, padding: '10px 12px' }}>
                🔑 Demo: admin@shriram.com / password123
              </div>
            </div>
          </Card>
        </div>
      </section>
    </div>
  )
}