import { useState, useEffect, useCallback, useRef, createContext, useContext } from 'react'
import { onAuthStateChanged } from 'firebase/auth'
import { auth } from '../lib/firebase'
import { formConfigsApi } from '../lib/firestore'
import toast from 'react-hot-toast'

const FormConfigsContext = createContext(null)

export function FormConfigsProvider({ children }) {
  const [configs,  setConfigs]  = useState([])
  const [loading,  setLoading]  = useState(true)
  const hasFetched = useRef(false)

  const fetchConfigs = useCallback(async () => {
    setLoading(true)
    try {
      const data = await formConfigsApi.list()
      setConfigs(data)
    } catch (err) {
      console.error('fetchConfigs error:', err)
    } finally { setLoading(false) }
  }, [])

  useEffect(() => {
    // Wait for Firebase Auth to confirm user before fetching
    const unsub = onAuthStateChanged(auth, (user) => {
      if (user && !hasFetched.current) {
        hasFetched.current = true
        fetchConfigs()
      } else if (!user) {
        setConfigs([])
        setLoading(false)
      }
    })
    return () => unsub()
  }, [fetchConfigs])

  const createConfig = async ({ schoolName, role, fields, expiresAt }) => {
    const url_id = Math.random().toString(36).slice(2, 10)
    const res = await formConfigsApi.create({
      school_name: schoolName,
      role,
      fields,
      url_id,
      expires_at: expiresAt || null,
    })
    setConfigs(prev => [res.data, ...prev])
    return { ...res.data, url: res.url }
  }

  const toggleActive = async (id, isActive) => {
    try {
      await formConfigsApi.update(id, { is_active: isActive })
      setConfigs(prev => prev.map(c => c.id === id ? { ...c, is_active: isActive } : c))
      toast.success(isActive ? 'Link activated' : 'Link deactivated')
    } catch (err) { toast.error(err.message) }
  }

  const fetchConfigByUrlId = async (urlId) => {
    try {
      return await formConfigsApi.getByUrlId(urlId)
    } catch { return null }
  }

  const deleteConfig = async (id) => {
    try {
      await formConfigsApi.delete(id)
      setConfigs(prev => prev.filter(c => c.id !== id))
      toast.success('Link deleted')
    } catch (err) { toast.error(err.message) }
  }

  return (
    <FormConfigsContext.Provider value={{
      configs, loading, fetchConfigs,
      createConfig, toggleActive, fetchConfigByUrlId, deleteConfig,
    }}>
      {children}
    </FormConfigsContext.Provider>
  )
}

export function useFormConfigs() {
  const ctx = useContext(FormConfigsContext)
  if (!ctx) throw new Error('useFormConfigs must be inside FormConfigsProvider')
  return ctx
}