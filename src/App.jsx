import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { AuthProvider, useAuth }               from './hooks/useAuth.jsx'
import { SubmissionsProvider }                 from './hooks/useSubmissions.jsx'
import { FormConfigsProvider }                 from './hooks/useFormConfigs.jsx'
import { OrganizationsProvider }               from './hooks/useOrganizations.jsx'
import { CardTemplatesProvider }               from './hooks/useCardtemplates.jsx'
import { NotificationsProvider }               from './hooks/useNotifications.jsx'
import Navbar         from './components/Navbar.jsx'
import Home           from './pages/Home.jsx'
import Dashboard      from './pages/Dashboard.jsx'
import AddTemplate    from './pages/AddTemplate.jsx'
import DetailsForm    from './pages/DetailsForm.jsx'
import Admin          from './pages/Admin.jsx'
import AllTemplates   from './pages/AllTemplates.jsx'
import Organizations  from './pages/Organizations.jsx'
import IDCardBuilder  from './pages/Idcardbuilder.jsx'
import Success        from './pages/Success.jsx'
import About          from './pages/About.jsx'

/* ── Full-screen spinner ─────────────────────────────────────── */
function Spinner() {
  return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh' }}>
      <div style={{ width:40, height:40, border:'3px solid var(--border)', borderTopColor:'var(--blue)', borderRadius:'50%', animation:'spin .7s linear infinite' }}/>
    </div>
  )
}

/* ── Protected route ─────────────────────────────────────────── */
function Protected({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <Spinner />
  return user ? children : <Navigate to="/" replace />
}

/* ── All data providers — only mounted AFTER user is confirmed ── */
function AuthenticatedProviders({ children }) {
  return (
    <SubmissionsProvider>
      <FormConfigsProvider>
        <OrganizationsProvider>
          <CardTemplatesProvider>
            {children}
          </CardTemplatesProvider>
        </OrganizationsProvider>
      </FormConfigsProvider>
    </SubmissionsProvider>
  )
}

function AppRoutes() {
  const { user, loading } = useAuth()
  const { pathname } = useLocation()
  const hideNavbar = pathname.startsWith('/form/') || pathname === '/success'

  if (loading) return <Spinner />

  return (
    <AuthenticatedProviders> {/* ✅ MOVE HERE */}
      {!hideNavbar && <Navbar />}

      <Routes>
        <Route path="/" element={user ? <Navigate to="/dashboard" replace /> : <Home />} />

        <Route path="/form/:urlId" element={<DetailsForm />} />
        <Route path="/success" element={<Success />} />
        <Route path="/about" element={<About />} />

        <Route path="/dashboard" element={<Protected><Dashboard /></Protected>} />
        <Route path="/add-template" element={<Protected><AddTemplate /></Protected>} />
        <Route path="/admin" element={<Protected><Admin /></Protected>} />
        <Route path="/templates" element={<Protected><AllTemplates /></Protected>} />
        <Route path="/organizations" element={<Protected><Organizations /></Protected>} />
        <Route path="/card-builder" element={<Protected><IDCardBuilder /></Protected>} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthenticatedProviders>
  )
}


 
/* ── Root ────────────────────────────────────────────────────── */
export default function App() {
  return (
    <AuthProvider>
      <NotificationsProvider>
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <AppRoutes />
        <Toaster
          position="bottom-right"
          toastOptions={{
            style: { fontFamily:'Instrument Sans,sans-serif', fontSize:13, fontWeight:600 },
            success: { iconTheme: { primary:'#00c48c', secondary:'#fff' } },
            error:   { iconTheme: { primary:'#ef4444', secondary:'#fff' } },
          }}
        />
      </BrowserRouter>
      </NotificationsProvider>
    </AuthProvider>
  )
}