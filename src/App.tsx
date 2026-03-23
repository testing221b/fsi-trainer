import { Component, type ReactNode } from 'react'
import { Routes, Route, NavLink, useLocation } from 'react-router-dom'
import Dashboard from './components/Dashboard'
import DrillSession from './components/DrillSession'
import ConversationPartner from './components/ConversationPartner'
import VoicePractice from './components/VoicePractice'
import UnitMap from './components/UnitMap'
import Settings from './components/Settings'

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
  { path: '/', label: 'Home', icon: '🏠' },
  { path: '/drills', label: 'Drills', icon: '📚' },
  { path: '/chat', label: 'Chat', icon: '💬' },
  { path: '/voice', label: 'Voice', icon: '🎙️' },
  { path: '/map', label: 'Units', icon: '🗺️' },
  { path: '/settings', label: 'Settings', icon: '⚙️' },
]

export default function App() {
  const location = useLocation()

  return (
    <div className="h-full flex flex-col bg-slate-900">
      {/* Main content area */}
      <main className="flex-1 flex flex-col overflow-hidden">
        <ErrorBoundary>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/drills" element={<DrillSession />} />
            <Route path="/chat" element={<ConversationPartner />} />
            <Route path="/voice" element={<VoicePractice />} />
            <Route path="/map" element={<UnitMap />} />
            <Route path="/settings" element={<Settings />} />
          </Routes>
        </ErrorBoundary>
      </main>

      {/* Bottom navigation bar — iOS style */}
      <nav
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
              <span className="text-xl leading-none">{item.icon}</span>
              <span className="text-[10px] font-medium">{item.label}</span>
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  )
}
