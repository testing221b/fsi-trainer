// src/components/ui/PageTransition.tsx
import React, { useState, useEffect, type ReactNode } from 'react'
import { useLocation } from 'react-router-dom'

interface PageTransitionProps {
  children: ReactNode
}

export function PageTransition({ children }: PageTransitionProps) {
  const location = useLocation()
  const [displayLocation, setDisplayLocation] = useState(location)
  const [stage, setStage] = useState<'enter' | 'exit'>('enter')

  useEffect(() => {
    if (location.key !== displayLocation.key) {
      setStage('exit')
      const timerId = setTimeout(() => {
        setDisplayLocation(location)
        setStage('enter')
      }, 220)
      // CRITICAL: cancel in-flight timer if user navigates again within 220ms.
      // Prevents race condition where overlapping timers corrupt state order,
      // causing blank screen or flicker on rapid tab switching.
      return () => clearTimeout(timerId)
    }
  }, [location, displayLocation.key])

  return (
    <>
      <style>{`
        @media (prefers-reduced-motion: no-preference) {
          .fsi-page-enter {
            animation: fsiSlideIn 220ms ease-out both;
          }
          .fsi-page-exit {
            animation: fsiSlideOut 220ms ease-out both;
          }
          @keyframes fsiSlideIn {
            from { opacity: 0; transform: translateX(6%); }
            to   { opacity: 1; transform: translateX(0); }
          }
          @keyframes fsiSlideOut {
            from { opacity: 1; transform: translateX(0); }
            to   { opacity: 0; transform: translateX(-6%); }
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .fsi-page-enter {
            animation: fsiPageFade 150ms ease-out both;
          }
          .fsi-page-exit { opacity: 0; }
          @keyframes fsiPageFade {
            from { opacity: 0; }
            to   { opacity: 1; }
          }
        }
        .fsi-page-wrap { flex: 1; display: flex; flex-direction: column; overflow: hidden; }
      `}</style>
      <div
        key={displayLocation.key}
        className={`fsi-page-wrap fsi-page-${stage}`}
      >
        {children}
      </div>
    </>
  )
}
