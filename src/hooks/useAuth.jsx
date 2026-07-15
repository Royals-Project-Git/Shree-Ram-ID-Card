import { useState, useEffect, createContext, useContext } from 'react'
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
} from 'firebase/auth'
import { auth } from '../lib/firebase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user,    setUser]    = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Firebase listener — fires immediately with current user, then on every change
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser ?? null)
      setLoading(false)
    })
    return () => unsubscribe()
  }, [])

  const signIn = async (email, password) => {
    const result = await signInWithEmailAndPassword(auth, email, password)
    return result
  }

  const signUp = async (email, password) => {
    const result = await createUserWithEmailAndPassword(auth, email, password)
    return result
  }

  const signOut = async () => {
    await firebaseSignOut(auth)
  }

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signOut, signUp }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be inside AuthProvider')
  return ctx
}
