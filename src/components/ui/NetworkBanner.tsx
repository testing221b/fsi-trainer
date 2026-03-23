import React, { useState, useEffect, useRef } from 'react'

export function NetworkBanner() {
  const [offline, setOffline]   = useState(!navigator.onLine)
  const [showBack, setShowBack] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const goOffline = () => {
      // Cancel any pending "back online" timer to prevent stale state
      if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null }
      setOffline(true)
      setShowBack(false)
    }
    const goOnline = () => {
      setOffline(false)
      setShowBack(true)
      timerRef.current = setTimeout(() => { setShowBack(false); timerRef.current = null }, 2500)
    }
    window.addEventListener('offline', goOffline)
    window.addEventListener('online',  goOnline)
    return () => {
      window.removeEventListener('offline', goOffline)
      window.removeEventListener('online',  goOnline)
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  if (!offline && !showBack) return null

  return (
    <div
      className={`fixed top-0 inset-x-0 z-50 text-center text-sm font-medium py-2 transition-colors ${
        offline
          ? 'bg-amber-500 text-amber-950'
          : 'bg-emerald-600 text-white'
      }`}
      style={{ paddingTop: 'max(env(safe-area-inset-top), 8px)' }}
    >
      {offline ? '⚡ Offline — AI features unavailable' : '✅ Back online'}
    </div>
  )
}
