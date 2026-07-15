import { Card } from '../components/shared/index'

export default function About() {
  return (
    <div className="anim-fade-up" style={{ padding:'24px 16px', paddingTop:88, maxWidth:860, margin:'0 auto' }}>
      <style>{`
        .about-wrap { padding: 40px 48px; padding-top: 104px; }
        .about-features-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 36px; }
        .about-contact-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
        @media (max-width: 700px) {
          .about-wrap { padding: 24px 16px !important; padding-top: 84px !important; }
          .about-features-grid { grid-template-columns: 1fr !important; gap: 12px !important; }
          .about-contact-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>

      <div className="about-wrap">
        <div style={{ marginBottom:32 }}>
          <div style={{ fontSize:12, color:'var(--blue)', fontWeight:700, textTransform:'uppercase', letterSpacing:.6, marginBottom:6 }}>Royalswebtech Pvt. Ltd.</div>
          <h1 style={{ fontFamily:'Outfit,sans-serif', fontSize:32, fontWeight:900, color:'var(--ink)', letterSpacing:-.8, marginBottom:12 }}>About Shriram ID Cards</h1>
          <p style={{ fontSize:15, color:'var(--ink2)', lineHeight:1.8, maxWidth:640 }}>
            Shriram ID Cards is a professional ID card management platform built for schools, colleges and organizations across Nagpur and beyond. We help institutions generate, distribute and manage identity cards efficiently.
          </p>
        </div>

        <div className="about-features-grid">
          {[['⚡','Fast & Reliable','Generate hundreds of ID cards in minutes with our automated system.'],['🔒','Secure','Enterprise-grade security with Supabase PostgreSQL and Row Level Security.'],['🎨','Beautiful Designs','Professional templates designed to represent your institution.'],['📱','Photo Editor','Built-in crop and edit tool for perfect profile pictures.'],['🔴','Real-time Updates','Admin panel updates live as students and staff submit forms.'],['📦','Bulk Export','Download all ID cards as a ZIP file with one click.']].map(([icon,title,desc])=>(
            <Card key={title} style={{ padding:20 }}>
              <div style={{ fontSize:26, marginBottom:10 }}>{icon}</div>
              <div style={{ fontFamily:'Outfit,sans-serif', fontSize:15, fontWeight:700, color:'var(--ink)', marginBottom:6 }}>{title}</div>
              <div style={{ fontSize:13, color:'var(--ink3)', lineHeight:1.6 }}>{desc}</div>
            </Card>
          ))}
        </div>

        <Card style={{ padding:24, marginBottom:24 }}>
          <h2 style={{ fontFamily:'Outfit,sans-serif', fontSize:20, fontWeight:800, color:'var(--ink)', marginBottom:16 }}>Contact Us</h2>
          <div className="about-contact-grid">
            {[['✉ Email','paragg10@yahoo.com'],['📞 Phone','9850360869, 9326037364'],['📍 Address','Saraipeth, Ashok Chowk, Near Durga Mata Mandir, Nagpur'],['🌐 Website','shriram-card.onrender.com']].map(([k,v])=>(
              <div key={k} style={{ padding:'12px 14px', background:'var(--paper2)', borderRadius:'var(--r)', border:'1px solid var(--border)' }}>
                <div style={{ fontSize:12, fontWeight:700, color:'var(--ink2)', marginBottom:4 }}>{k}</div>
                <div style={{ fontSize:13, color:'var(--ink)', fontWeight:500, wordBreak:'break-word' }}>{v}</div>
              </div>
            ))}
          </div>
        </Card>

        <div style={{ textAlign:'center', fontSize:13, color:'var(--ink3)', paddingTop:20, borderTop:'1px solid var(--border)' }}>
          Royalswebtech Pvt. Ltd. © {new Date().getFullYear()} · All rights reserved
        </div>
      </div>
    </div>
  )
}