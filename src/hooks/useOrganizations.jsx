import { useState, useEffect, useCallback, useRef, createContext, useContext } from 'react'
import { onAuthStateChanged } from 'firebase/auth'
import { auth } from '../lib/firebase'
import { organizationsApi } from '../lib/firestore'
import toast from 'react-hot-toast'

const OrgsContext = createContext(null)

export function OrganizationsProvider({ children }) {
  const [organizations, setOrganizations] = useState([])
  const [loading,       setLoading]       = useState(true)
  const hasFetched = useRef(false)

  const fetchOrganizations = useCallback(async () => {
    setLoading(true)
    try {
      const data = await organizationsApi.list()
      setOrganizations(data)
    } catch (err) {
      console.error('fetchOrganizations error:', err)
    } finally { setLoading(false) }
  }, [])

  useEffect(() => {
    // Wait for Firebase Auth to confirm user before fetching
    const unsub = onAuthStateChanged(auth, (user) => {
      if (user && !hasFetched.current) {
        hasFetched.current = true
        fetchOrganizations()
      } else if (!user) {
        setOrganizations([])
        setLoading(false)
      }
    })
    return () => unsub()
  }, [fetchOrganizations])

  const createOrganization = async (formData, logoFile) => {
    const org = await organizationsApi.create(formData, logoFile)
    setOrganizations(prev => [org, ...prev])
    return org
  }

  const updateOrganization = async (id, updates, logoFile = null, removeLogo = false) => {
    const org = await organizationsApi.update(id, updates, logoFile, removeLogo)
    // Spread over existing org so created_at, logo_url etc are never wiped
    setOrganizations(prev => prev.map(o => o.id === id ? { ...o, ...org } : o))
    return org
  }

  const deleteOrganization = async (id) => {
    await organizationsApi.delete(id)
    setOrganizations(prev => prev.filter(o => o.id !== id))
    toast.success('Organization deleted')
  }

  return (
    <OrgsContext.Provider value={{
      organizations, loading, fetchOrganizations,
      createOrganization, updateOrganization, deleteOrganization,
    }}>
      {children}
    </OrgsContext.Provider>
  )
}

export function useOrganizations() {
  const ctx = useContext(OrgsContext)
  if (!ctx) throw new Error('useOrganizations must be inside OrganizationsProvider')
  return ctx
}