import { useLocation } from 'react-router-dom'
import { Btn, Card } from '../components/shared/index'

export default function Success() {
  const { state }  = useLocation()
  const sub        = state?.submission || {}
  const school     = state?.school || sub.school_name || 'Your School'
  const role       = state?.role   || sub.role        || 'Student'
  const refId      = sub.id ? sub.id.slice(0, 8).toUpperCase() : 'REF' + Math.random().toString(36).substr(2, 5).toUpperCase()

  const fields = [
    ['Full Name',     sub.name],
    ['School',        sub.school_name || school],
    ['Role',          sub.role        || role],
    ['Class',         sub.class],
    ['Section',       sub.section],
    ['Roll Number',   sub.roll_number],
    ['Contact',       sub.contact_number],
    ['Blood Group',   sub.blood_group],
    ['Designation',   sub.designation],
    ['Department',    sub.department],
  ].filter(([, v]) => v)

  return (
    <div style={{ minHeight:'100vh', background:'linear-gradient(150deg,#f0f4ff 0%,#eef0f8 50%,#f5f6fc 100%)', display:'flex', alignItems:'center', justifyContent:'center', padding:'16px', paddingTop:80 }}>
      <style>{`
        .success-fields-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
        .success-confirm-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
        @media (max-width: 480px) {
          .success-fields-grid { grid-template-columns: 1fr !important; }
          .success-confirm-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
      <div style={{ width:'100%', maxWidth:560 }}>

        {/* ── Success card ── */}
        <Card style={{ padding:'36px 24px', textAlign:'center', overflow:'hidden', position:'relative' }}>
          <div style={{ position:'absolute', top:-40, right:-40, width:160, height:160, borderRadius:'50%', background:'var(--teal-s)', opacity:.6 }}/>
          <div style={{ position:'absolute', bottom:-30, left:-30, width:120, height:120, borderRadius:'50%', background:'var(--blue-s)', opacity:.5 }}/>

          <div className="anim-scale-in" style={{ width:80, height:80, borderRadius:'50%', background:'var(--teal-s)', border:'3px solid var(--teal)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:36, margin:'0 auto 20px', position:'relative', boxShadow:'0 8px 24px rgba(0,196,140,.2)' }}>
            ✓
          </div>

          <h1 style={{ fontFamily:'Outfit,sans-serif', fontSize:32, fontWeight:900, color:'var(--teal)', letterSpacing:-1.2, marginBottom:10, position:'relative' }}>
            Submitted!
          </h1>
          <p style={{ fontSize:14, color:'var(--ink2)', lineHeight:1.7, marginBottom:24, maxWidth:380, margin:'0 auto 24px', position:'relative' }}>
            Your details have been submitted successfully. The admin will review and generate your ID card shortly.
          </p>

          {/* Reference ID */}
          <div style={{ background:'var(--paper2)', borderRadius:'var(--r)', padding:'12px 16px', border:'1px solid var(--border)', display:'inline-flex', alignItems:'center', gap:12, marginBottom:24, position:'relative', flexWrap:'wrap', justifyContent:'center' }}>
            <span style={{ fontSize:11, fontWeight:700, color:'var(--ink3)', textTransform:'uppercase', letterSpacing:.5 }}>Reference ID</span>
            <span style={{ fontFamily:'JetBrains Mono,monospace', fontSize:15, fontWeight:800, color:'var(--blue)', letterSpacing:1 }}>{refId}</span>
          </div>

          {/* Submitted details preview */}
          {fields.length > 0 && (
            <div style={{ background:'var(--paper2)', borderRadius:'var(--rl)', padding:16, border:'1px solid var(--border)', textAlign:'left', marginBottom:20, position:'relative' }}>
              <div style={{ display:'flex', gap:14, alignItems:'flex-start', marginBottom:fields.length > 0 ? 14 : 0, flexWrap:'wrap' }}>
                {sub.photo_url && (
                  <img src={sub.photo_url} style={{ width:60, height:80, objectFit:'cover', borderRadius:10, border:'2px solid var(--blue)', flexShrink:0 }} alt=""/>
                )}
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:11, fontWeight:700, color:'var(--ink3)', textTransform:'uppercase', letterSpacing:.5, marginBottom:10 }}>Your Submitted Details</div>
                  <div className="success-fields-grid">
                    {fields.map(([k, v]) => (
                      <div key={k}>
                        <div style={{ fontSize:10, fontWeight:700, color:'var(--ink3)', textTransform:'uppercase', letterSpacing:.3 }}>{k}</div>
                        <div style={{ fontSize:13, fontWeight:600, color:'var(--ink)', marginTop:1 }}>{v}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Info note */}
          <div style={{ background:'var(--blue-s)', borderRadius:'var(--r)', padding:'12px 14px', marginBottom:24, fontSize:13, color:'var(--blue)', fontWeight:600, textAlign:'left', display:'flex', gap:10, alignItems:'flex-start', position:'relative' }}>
            <span style={{ fontSize:18, flexShrink:0 }}>📋</span>
            <span>Save your Reference ID: <strong>{refId}</strong>. You may need it to check your ID card status with the school admin.</span>
          </div>

          {/* Actions */}
          <div style={{ display:'flex', flexDirection:'column', gap:10, position:'relative' }}>
            <Btn variant="teal" full size="lg" onClick={() => window.print()}>🖨 Print Confirmation</Btn>
          </div>
        </Card>
      </div>
    </div>
  )
}