// src/App.tsx
import { Component, lazy, Suspense, type ReactNode } from 'react'
import { Routes, Route, NavLink } from 'react-router-dom'
import { LoadingSpinner } from './components/ui'
import { NetworkBanner } from './components/ui/NetworkBanner'
import { PageTransition } from './components/ui/PageTransition'

// Lazy-loaded route components — Vite splits each into a separate JS chunk.
// Users only download the code for pages they actually visit.
const Dashboard           = lazy(() => import('./components/Dashboard'))
const DrillSession        = lazy(() => import('./components/DrillSession'))
const ConversationPartner = lazy(() => import('./components/ConversationPartner'))
const VoicePractice       = lazy(() => import('./components/VoicePractice'))
const UnitMap             = lazy(() => import('./components/UnitMap'))
const Settings            = lazy(() => import('./components/Settings'))

class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  state = { hasError: false }
  static getDerivedStateFromError() { return { hasError: true } }
  render() {
    if (this.state.hasError) return (
      <div className="flex flex-col items-center justify-center h-full text-white p-8 gap-4">
        <span className="text-5xl">⚠️</span>
        <p className="text-lg font-semibold text-center">Something went wrong.</p>
        <p className="text-sm text-slate-400 text-center">Try going back to the previous screen.</p>
        <button
          onClick={() => this.setState({ hasError: false })}
          className="px-5 py-2 bg-blue-600 hover:bg-blue-500 rounded-xl text-sm font-medium transition-colors"
        >
          Try Again
        </button>
      </div>
    )
    return this.props.children
  }
}

const NAV_ITEMS = [
  { path: '/',         label: 'Home',     icon: '🏠' },
  { path: '/drills',   label: 'Drills',   icon: '📚' },
  { path: '/chat',     label: 'Chat',     icon: '💬' },
  { path: '/voice',    label: 'Voice',    icon: '🎙️' },
  { path: '/map',      label: 'Units',    icon: '🗺️' },
  { path: '/settings', label: 'Settings', icon: '⚙️' },
]

export default function App() {
  return (
    <div className="h-full flex flex-col bg-slate-900">
      {/* Fixed offline/online status banner — sits above everything */}
      <NetworkBanner />

      {/* Nesting order is intentional:
          Suspense  → catches lazy-load chunk failures (must be outermost)
          ErrorBoundary → catches runtime component errors
          Routes + Wrap → PageTransition wraps each route element individually */}
      <main className="flex-1 flex flex-col overflow-hidden">
        <Suspense fallback={
          <div className="flex-1 flex items-center justify-center">
            <LoadingSpinner text="Loading..." />
          </div>
        }>
          <ErrorBoundary>
            <Routes>
              <Route path="/"         element={<Wrap><Dashboard /></Wrap>} />
              <Route path="/drills"   element={<Wrap><DrillSession /></Wrap>} />
              <Route path="/chat"     element={<Wrap><ConversationPartner /></Wrap>} />
              <Route path="/voice"    element={<Wrap><VoicePractice /></Wrap>} />
              <Route path="/map"      element={<Wrap><UnitMap /></Wrap>} />
              <Route path="/settings" element={<Wrap><Settings /></Wrap>} />
            </Routes>
          </ErrorBoundary>
        </Suspense>
      </main>

      {/* Bottom navigation */}
      <nav
        aria-label="Main navigation"
        className="shrink-0 border-t border-slate-700/60 bg-slate-900/95 backdrop-blur-md"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="flex">
          {NAV_ITEMS.map(item => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === '/'}
              className={({ isActive }) =>
                `flex-1 flex flex-col items-center justify-center py-2 gap-0.5 transition-colors ${
                  isActive ? 'text-blue-400' : 'text-slate-500 hover:text-slate-300'
                }`
              }
            >
              <span className="text-xl leading-none" aria-hidden="true">{item.icon}</span>
              <span className="text-[10px] font-medium">{item.label}</span>
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  )
}

/**
 * Wraps each route's element with PageTransition.
 * PageTransition calls useLocation() internally — mounting it inside <Routes>
 * ensures it receives the correct router context.
 */
function Wrap({ children }: { children: ReactNode }) {
  return <PageTransition>{children}</PageTransition>
}
