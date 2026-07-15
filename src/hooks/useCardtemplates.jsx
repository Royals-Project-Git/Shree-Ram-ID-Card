import { useState, useEffect, useCallback, useRef, createContext, useContext } from 'react'
import { onAuthStateChanged } from 'firebase/auth'
import { auth } from '../lib/firebase'
import { cardTemplatesApi } from '../lib/firestore'
import toast from 'react-hot-toast'

const CardTemplatesContext = createContext(null)

export function CardTemplatesProvider({ children }) {
  const [templates, setTemplates] = useState([])
  const [loading,   setLoading]   = useState(true)
  const hasFetched = useRef(false)

  const fetchTemplates = useCallback(async () => {
    setLoading(true)
    try {
      const data = await cardTemplatesApi.list()
      setTemplates(data)
    } catch (err) { console.error(err) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => {
    // Wait for Firebase Auth to confirm user before fetching
    const unsub = onAuthStateChanged(auth, (user) => {
      if (user && !hasFetched.current) {
        hasFetched.current = true
        fetchTemplates()
      } else if (!user) {
        setTemplates([])
        setLoading(false)
      }
    })
    return () => unsub()
  }, [fetchTemplates])

  const saveTemplate = async (templateData) => {
    const data = await cardTemplatesApi.save(templateData)
    setTemplates(prev => [data, ...prev])
    toast.success('Template saved!')
    return data
  }

  const updateTemplate = async (id, templateData) => {
    const data = await cardTemplatesApi.update(id, templateData)
    setTemplates(prev => prev.map(t => t.id === id ? data : t))
    toast.success('Template updated!')
    return data
  }

  const deleteTemplate = async (id) => {
    await cardTemplatesApi.delete(id)
    setTemplates(prev => prev.filter(t => t.id !== id))
    toast.success('Template deleted')
  }

  return (
    <CardTemplatesContext.Provider value={{
      templates, loading, fetchTemplates,
      saveTemplate, updateTemplate, deleteTemplate,
    }}>
      {children}
    </CardTemplatesContext.Provider>
  )
}

export function useCardTemplates() {
  const ctx = useContext(CardTemplatesContext)
  if (!ctx) throw new Error('useCardTemplates must be inside CardTemplatesProvider')
  return ctx
}