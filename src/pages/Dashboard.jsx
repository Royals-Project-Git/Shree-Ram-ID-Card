import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useSubmissions } from '../hooks/useSubmissions'
import { useFormConfigs } from '../hooks/useFormConfigs'
import { Card, Badge, Btn, Avatar, Spinner, EmptyState } from '../components/shared/index'

const fmtDate = d => {
  if (!d) return '—'
  // Firestore Timestamp objects have a .toDate() method
  const date = d?.toDate ? d.toDate() : new Date(d)
  return isNaN(date) ? '—' : date.toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' })
}

export default function Dashboard() {
  const { user }                                                           = useAuth()
  const { submissions, totalCount, approvedCount, pendingCount, rejectedCount, loading: subLoading } = useSubmissions()
  const { configs, loading: cfgLoading }                                   = useFormConfigs()
  const navigate                                                           = useNavigate()

  const schools   = [...new Set(submissions.map(s => s.school_name))].length
  const recent    = [...submissions].slice(0, 6)

  const stats = [
    { label:'Total Submissions', val: totalCount,    icon:'📋', color:'var(--blue)',  bg:'var(--blue-s)',   sub:'All time' },
    { label:'Approved',          val: approvedCount, icon:'✅', color:'#00875f',      bg:'var(--teal-s)',   sub:'Approved cards' },
    { label:'Pending Review',    val: pendingCount,  icon:'⏳', color:'#b45309',      bg:'var(--amber-s)',  sub:'Needs attention' },
    { label:'Rejected',          val: rejectedCount, icon:'❌', color:'var(--red)',   bg:'var(--red-s)',    sub:'Declined submissions' },
  ]

  if (subLoading || cfgLoading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'80vh' }}>
      <Spinner size={36}/>
    </div>
  )

  return (
    <div className="anim-fade-up" style={{ padding:'20px', paddingTop:84 }}>
      <style>{`
        .dash-padding { padding: 40px; padding-top: 104px; }
        .dash-stats-grid { display: grid; grid-template-columns: repeat(4,1fr); gap: 16px; margin-bottom: 28px; }
        .dash-mid-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-bottom: 24px; }
        .dash-title { font-size: 32px; }
        .dash-table-wrap { overflow-x: auto; }
        .dash-table-col-contact, .dash-table-col-date { display: table-cell; }

        @media (max-width: 900px) {
          .dash-padding { padding: 20px !important; padding-top: 80px !important; }
          .dash-stats-grid { grid-template-columns: repeat(2,1fr) !important; gap: 12px !important; }
          .dash-mid-grid { grid-template-columns: 1fr !important; gap: 16px !important; }
          .dash-title { font-size: 24px !important; }
        }
        @media (max-width: 600px) {
          .dash-padding { padding: 14px !important; padding-top: 74px !important; }
          .dash-stats-grid { grid-template-columns: repeat(2,1fr) !important; gap: 10px !important; }
          .dash-table-col-contact, .dash-table-col-date { display: none !important; }
        }
      `}</style>

      <div className="dash-padding" style={{ padding:'40px', paddingTop:104 }}>
        {/* Header */}
        <div style={{ marginBottom:28 }}>
          <div style={{ fontSize:13, color:'var(--ink3)', fontWeight:600, marginBottom:4 }}>
            📅 {new Date().toLocaleDateString('en-IN',{weekday:'long',year:'numeric',month:'long',day:'numeric'})}
          </div>
          <h1 className="dash-title" style={{ fontFamily:'Outfit,sans-serif', fontWeight:900, color:'var(--ink)', letterSpacing:-.5 }}>
            Good morning, Admin
          </h1>
          <p style={{ fontSize:15, color:'var(--ink2)', marginTop:4 }}>Here's your platform overview.</p>
        </div>

        {/* Stats */}
        <div className="dash-stats-grid">
          {stats.map(s => (
            <Card key={s.label} style={{ padding:18 }}>
              <div style={{ width:36, height:36, borderRadius:10, background:s.bg, display:'flex', alignItems:'center', justifyContent:'center', fontSize:16, marginBottom:10 }}>{s.icon}</div>
              <div style={{ fontFamily:'Outfit,sans-serif', fontSize:28, fontWeight:900, color:s.color, letterSpacing:-1 }}>{s.val}</div>
              <div style={{ fontSize:12, fontWeight:700, color:'var(--ink)', marginTop:2 }}>{s.label}</div>
              <div style={{ fontSize:11, color:'var(--ink3)', marginTop:3 }}>{s.sub}</div>
            </Card>
          ))}
        </div>

        <div className="dash-mid-grid">
          {/* Quick Actions */}
          <Card style={{ padding:26 }}>
            <h3 style={{ fontFamily:'Outfit,sans-serif', fontSize:17, fontWeight:800, color:'var(--ink)', marginBottom:18 }}>Quick Actions</h3>
            <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
              {[
                { icon:'🔗', title:'Generate New Link',   desc:'Create form link for a school',       page:'/add-template', color:'var(--blue)',  bg:'var(--blue-s)' },
                { icon:'✅', title:'Review Submissions',  desc:`${pendingCount} pending approvals`,         page:'/admin',        color:'#b45309',     bg:'var(--amber-s)' },
                { icon:'🪪', title:'View ID Cards',       desc:'Preview & download all cards',         page:'/templates',    color:'#00875f',     bg:'var(--teal-s)' },
                { icon:'📋', title:'Customize Format',    desc:'Configure new card template',          page:'/add-template', color:'var(--blue)',  bg:'var(--blue-s)' },
              ].map(a => (
                <div key={a.title} onClick={() => navigate(a.page)}
                  style={{ display:'flex', alignItems:'center', gap:14, padding:14, borderRadius:'var(--r)', border:'1px solid var(--border)', cursor:'pointer', transition:'all .18s' }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor=a.color; e.currentTarget.style.background=a.bg }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor='var(--border)'; e.currentTarget.style.background='transparent' }}>
                  <div style={{ width:38, height:38, borderRadius:10, background:a.bg, display:'flex', alignItems:'center', justifyContent:'center', fontSize:18, flexShrink:0 }}>{a.icon}</div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:14, fontWeight:700, color:'var(--ink)' }}>{a.title}</div>
                    <div style={{ fontSize:12, color:'var(--ink3)', marginTop:1 }}>{a.desc}</div>
                  </div>
                  <span style={{ fontSize:16, color:'var(--ink3)', flexShrink:0 }}>→</span>
                </div>
              ))}
            </div>
          </Card>

          {/* Status breakdown */}
          <Card style={{ padding:26 }}>
            <h3 style={{ fontFamily:'Outfit,sans-serif', fontSize:17, fontWeight:800, color:'var(--ink)', marginBottom:18 }}>Submission Status</h3>
            {[
              { label:'Approved', val:approvedCount, color:'var(--teal)' },
              { label:'Pending',  val:pendingCount,  color:'var(--amber)' },
              { label:'Rejected', val:rejectedCount, color:'var(--red)' },
            ].map(s => (
              <div key={s.label} style={{ marginBottom:16 }}>
                <div style={{ display:'flex', justifyContent:'space-between', marginBottom:5, fontSize:13, fontWeight:600, color:'var(--ink2)' }}>
                  <span>{s.label}</span>
                  <span style={{ fontFamily:'JetBrains Mono,monospace', color:s.color }}>{s.val}/{totalCount}</span>
                </div>
                <div style={{ height:8, background:'var(--paper3)', borderRadius:4, overflow:'hidden' }}>
                  <div style={{ width:`${totalCount ? Math.round(s.val / totalCount * 100) : 0}%`, height:'100%', background:s.color, borderRadius:4, transition:'width .6s ease' }}/>
                </div>
              </div>
            ))}
            {pendingCount > 0 && (
              <div style={{ marginTop:16, padding:14, background:'var(--amber-s)', borderRadius:'var(--r)', display:'flex', alignItems:'center', gap:10 }}>
                <span style={{ fontSize:18 }}>💡</span>
                <span style={{ fontSize:12, color:'#92400e', fontWeight:600 }}>{pendingCount} submissions need your review in the Admin panel.</span>
              </div>
            )}
          </Card>
        </div>

        {/* Recent */}
        <Card style={{ padding:26 }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:18 }}>
            <h3 style={{ fontFamily:'Outfit,sans-serif', fontSize:17, fontWeight:800, color:'var(--ink)' }}>Recent Submissions</h3>
            <Btn size="sm" variant="ghost" onClick={() => navigate('/admin')}>View All →</Btn>
          </div>
          {recent.length === 0
            ? <EmptyState icon="📭" title="No submissions yet" desc="Share form links with schools to start collecting data." action={<Btn onClick={() => navigate('/add-template')}>Generate First Link →</Btn>} />
            : (
            <div className="dash-table-wrap">
              <table style={{ width:'100%', borderCollapse:'collapse', minWidth:400 }}>
                <thead>
                  <tr>
                    {['Name','School','Role','Status','Date'].map(h => (
                      <th key={h} className={h==='Date'?'dash-table-col-date':''} style={{ padding:'10px 14px', textAlign:'left', fontSize:11, fontWeight:700, color:'var(--ink3)', textTransform:'uppercase', letterSpacing:.5, borderBottom:'2px solid var(--border)', background:'var(--paper2)', whiteSpace:'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {recent.map(s => (
                    <tr key={s.id} style={{ borderBottom:'1px solid var(--border)', cursor:'pointer' }}
                      onMouseEnter={e => e.currentTarget.style.background='var(--paper2)'}
                      onMouseLeave={e => e.currentTarget.style.background='transparent'}>
                      <td style={{ padding:'12px 14px' }}>
                        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                          <Avatar name={s.name} size={32} src={s.photo_url}/>
                          <span style={{ fontSize:14, fontWeight:600, color:'var(--ink)' }}>{s.name}</span>
                        </div>
                      </td>
                      <td style={{ padding:'12px 14px', fontSize:13, color:'var(--ink2)', maxWidth:120, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{s.school_name}</td>
                      <td style={{ padding:'12px 14px' }}><Badge type={s.role==='Student'?'blue':s.role==='Staff'?'teal':'amber'}>{s.role}</Badge></td>
                      <td style={{ padding:'12px 14px' }}><Badge type={s.status==='approved'?'teal':s.status==='pending'?'amber':'red'} dot>{s.status}</Badge></td>
                      <td className="dash-table-col-date" style={{ padding:'12px 14px', fontSize:12, color:'var(--ink3)', fontFamily:'JetBrains Mono,monospace', whiteSpace:'nowrap' }}>{fmtDate(s.submitted_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}