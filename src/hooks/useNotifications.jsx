import { db, auth } from '../lib/firebase'
import { useState, useEffect, useCallback, useRef, createContext, useContext } from 'react'
import { onSnapshot, collection, query, where, limit } from 'firebase/firestore'
import { onAuthStateChanged } from 'firebase/auth'

import { notificationsApi } from '../lib/firestore'

const NotificationsContext = createContext(null)

export function NotificationsProvider({ children }) {
  const [notifications, setNotifications] = useState([])
  const [loading,       setLoading]       = useState(true)
  const snapshotUnsub = useRef(null)
  const isFirstLoad   = useRef(true)   // skip toast on initial data load

  useEffect(() => {
    const authUnsub = onAuthStateChanged(auth, (user) => {
      if (user) {
        if (snapshotUnsub.current) return   // already listening

        // No orderBy here — avoids composite index requirement.
        // We sort client-side since limit is only 50 docs.
        const q = query(
          collection(db, 'notifications'),
          where('userId', '==', user.uid),
          limit(50)
        )

        snapshotUnsub.current = onSnapshot(q, (snap) => {
          const docs = snap.docs
            .map(d => ({ id: d.id, ...d.data() }))
            .sort((a, b) => {
              const ta = a.created_at?.toDate?.() ?? new Date(a.created_at ?? 0)
              const tb = b.created_at?.toDate?.() ?? new Date(b.created_at ?? 0)
              return tb - ta
            })

          // Play a soft chime / show toast only for truly NEW docs arriving after page load
          if (!isFirstLoad.current) {
            snap.docChanges().forEach(change => {
              if (change.type === 'added') {
                const n = { id: change.doc.id, ...change.doc.data() }
                // Browser notification if permission granted
                if (Notification.permission === 'granted') {
                  new Notification(n.title, { body: n.body, icon: '/logos.png' })
                }
              }
            })
          }
          isFirstLoad.current = false

          setNotifications(docs)
          setLoading(false)
        }, (err) => {
          console.error('Notifications listener error:', err)
          setLoading(false)
        })
      } else {
        if (snapshotUnsub.current) { snapshotUnsub.current(); snapshotUnsub.current = null }
        setNotifications([])
        setLoading(false)
        isFirstLoad.current = true
      }
    })

    return () => {
      authUnsub()
      if (snapshotUnsub.current) snapshotUnsub.current()
    }
  }, [])

  /* ── Derived counts ─────────────────────────────────────────── */
  const unreadCount = notifications.filter(n => !n.read).length

  /* ── Actions ────────────────────────────────────────────────── */
  const markRead = useCallback(async (id) => {
    try { await notificationsApi.markRead(id) }
    catch (err) { console.error('markRead error:', err) }
  }, [])

  const markAllRead = useCallback(async () => {
    try { await notificationsApi.markAllRead() }
    catch (err) { console.error('markAllRead error:', err) }
  }, [])

  const deleteNotification = useCallback(async (id) => {
    try { await notificationsApi.delete(id) }
    catch (err) { console.error('delete notification error:', err) }
  }, [])

  const clearAll = useCallback(async () => {
    try { await notificationsApi.deleteAll() }
    catch (err) { console.error('clearAll error:', err) }
  }, [])

  /* ── Request browser notification permission on mount ───────── */
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission()
    }
  }, [])

  return (
    <NotificationsContext.Provider value={{
      notifications, loading, unreadCount,
      markRead, markAllRead, deleteNotification, clearAll,
    }}>
      {children}
    </NotificationsContext.Provider>
  )
}

export function useNotifications() {
  const ctx = useContext(NotificationsContext)
  if (!ctx) throw new Error('useNotifications must be inside NotificationsProvider')
  return ctx
}