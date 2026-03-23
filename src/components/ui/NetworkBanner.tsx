// src/components/ui/NetworkBanner.tsx
import React, { useState, useEffect } from 'react'

export function NetworkBanner() {
  const [offline, setOffline] = useState(!navigator.onLine)
  const [showBack, setShowBack] = useState(false)

  useEffect(() => {
    const goOffline = () => { setOffline(true); setShowBack(false) }
    const goOnline  = () => {
      setOffline(false)
      setShowBack(true)
      setTimeout(() => setShowBack(false), 2500)
    }
    window.addEventListener('offline', goOffline)
    window.addEventListener('online',  goOnline)
    return () => {
      window.removeEventListener('offline', goOffline)
      window.removeEventListener('online',  goOnline)
    }
  }, [])

  if (!offline && !showBack) return null

  return (
    <div
      className={`fixed top-0 inset-x-0 z-50 text-center text-sm font-medium py-2 transition-all ${
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
