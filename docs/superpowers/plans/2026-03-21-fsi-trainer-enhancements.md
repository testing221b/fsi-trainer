# FSI Trainer — UI & Performance Enhancements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add 4 production-quality enhancements to the FSI Trainer PWA — lazy-loaded routes, a shared Hold-to-Speak mic button, branded AI thinking animations, race-condition-safe page transitions, and offline/timeout resilience — with zero new dependencies.

**Architecture:** Eight self-contained tasks produce four new UI components (`AiThinking`, `NetworkBanner`, `HoldToSpeakButton`, `PageTransition`), one modification to `gemini.ts`, and integration work across `App.tsx` plus three page components. Each task ends with a TypeScript compile check and a browser smoke test before committing.

**Tech Stack:** React 19, TypeScript, Tailwind CSS 4, Vite 8, React Router v7, Web Speech API, Web Vibration API, AbortController, CSS `@keyframes`

**Spec:** `E:\FSI Trainer\docs\superpowers\specs\2026-03-21-fsi-trainer-enhancements-design.md`

---

## File Map

### New files
| File | Responsibility |
|---|---|
| `src/components/ui/AiThinking.tsx` | Animated AI-thinking indicator — `"dots"` (Drill) and `"wave"` (Conversation/Voice) variants |
| `src/components/ui/NetworkBanner.tsx` | Fixed top banner that appears when `navigator.onLine` is false |
| `src/components/ui/HoldToSpeakButton.tsx` | Hold-to-speak button: waveform animation, iOS visual haptics, 15s silence watchdog, `useToast` inline |
| `src/components/ui/PageTransition.tsx` | Wraps each route element; delays unmount 220ms so old+new screens animate simultaneously |

### Modified files
| File | Changes |
|---|---|
| `src/lib/gemini.ts` | Add 10s `AbortController` timeout + `navigator.onLine` pre-flight check to `generate()` |
| `src/App.tsx` | `React.lazy()` all 6 routes; add `<Suspense>`, `<NetworkBanner>`, `<PageTransition>` in correct nesting order |
| `src/components/DrillSession.tsx` | Replace `<MicButton>` with `<HoldToSpeakButton>`; replace `<LoadingSpinner>` feedback wait with `<AiThinking variant="dots">` |
| `src/components/ConversationPartner.tsx` | Same mic + spinner replacements with `variant="wave"` |
| `src/components/VoicePractice.tsx` | Same mic + spinner replacements with `variant="wave"` |

---

## Task 1 — `AiThinking` component

**Files:**
- Create: `src/components/ui/AiThinking.tsx`
- Modify: `src/components/ui/index.tsx` (add export)

- [ ] **Step 1.1 — Create `AiThinking.tsx`**

```tsx
// src/components/ui/AiThinking.tsx
interface AiThinkingProps {
  variant: 'wave' | 'dots'
  label?: string
  className?: string
}

export function AiThinking({ variant, label, className = '' }: AiThinkingProps) {
  return (
    <div className={`flex flex-col items-center gap-2 ${className}`}>
      {variant === 'wave' ? <WaveAnimation /> : <DotsAnimation />}
      {label && <p className="text-xs text-slate-400">{label}</p>}
    </div>
  )
}

function WaveAnimation() {
  return (
    <>
      <style>{`
        @media (prefers-reduced-motion: no-preference) {
          .fsi-wave {
            background: linear-gradient(90deg, #3b82f6, #8b5cf6, #06b6d4, #3b82f6);
            background-size: 300% 100%;
            animation: fsiWave 2s linear infinite;
          }
          @keyframes fsiWave {
            0%   { background-position: 100% 0 }
            100% { background-position: -100% 0 }
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .fsi-wave { opacity: 0.6; animation: fsiPulse 1.5s ease-in-out infinite; }
          @keyframes fsiPulse { 0%,100%{opacity:0.4} 50%{opacity:0.8} }
        }
      `}</style>
      <div className="fsi-wave w-40 h-8 rounded-full" />
    </>
  )
}

function DotsAnimation() {
  return (
    <>
      <style>{`
        @media (prefers-reduced-motion: no-preference) {
          .fsi-dot { animation: fsiDot 1.2s infinite ease-in-out; }
          .fsi-dot:nth-child(2) { animation-delay: 0.2s; }
          .fsi-dot:nth-child(3) { animation-delay: 0.4s; }
          @keyframes fsiDot {
            0%,80%,100% { transform: scale(0.6); opacity: 0.4; }
            40%          { transform: scale(1);   opacity: 1; }
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .fsi-dot { opacity: 0.6; }
        }
      `}</style>
      <div className="flex items-center gap-1.5">
        {[0, 1, 2].map(i => (
          <div key={i} className="fsi-dot w-2.5 h-2.5 rounded-full bg-blue-400" />
        ))}
      </div>
    </>
  )
}
```

- [ ] **Step 1.2 — Export from `ui/index.tsx`**

Add at the end of `src/components/ui/index.tsx`:

```tsx
export { AiThinking } from './AiThinking'
```

- [ ] **Step 1.3 — TypeScript check**

```powershell
cd "E:\FSI Trainer"
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 1.4 — Browser smoke test**

Add temporarily to `Dashboard.tsx` top of JSX, view at `http://localhost:5173`:
```tsx
import { AiThinking } from './ui'
// inside return:
<AiThinking variant="wave" label="Analyzing..." />
<AiThinking variant="dots" label="Evaluating..." />
```
Confirm both animations run. Remove temp code afterwards.

- [ ] **Step 1.5 — Commit**
```powershell
git add src/components/ui/AiThinking.tsx src/components/ui/index.tsx
git commit -m "feat: add AiThinking component (wave + dots variants)"
```

---

## Task 2 — `NetworkBanner` + `gemini.ts` offline/timeout resilience

**Files:**
- Create: `src/components/ui/NetworkBanner.tsx`
- Modify: `src/components/ui/index.tsx`
- Modify: `src/lib/gemini.ts` (lines 86–101, the `generate()` fetch block)

- [ ] **Step 2.1 — Create `NetworkBanner.tsx`**

```tsx
// src/components/ui/NetworkBanner.tsx
import { useState, useEffect } from 'react'

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
```

- [ ] **Step 2.2 — Export from `ui/index.tsx`**

```tsx
export { NetworkBanner } from './NetworkBanner'
```

- [ ] **Step 2.3 — Add timeout + onLine check to `generate()` in `gemini.ts`**

Replace the fetch block in `generate()` (the section starting with `const res = await fetch`):

```typescript
// Before fetch: pre-flight offline check
if (!navigator.onLine) {
  throw new Error('OFFLINE')
}

// 10-second timeout via AbortController
const controller = new AbortController()
const timeoutId = setTimeout(() => controller.abort(), 10_000)

let res: Response
try {
  res = await fetch(`${endpoint}?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: controller.signal,
  })
} catch (e: any) {
  if (e.name === 'AbortError') throw new Error('TIMEOUT')
  throw e
} finally {
  clearTimeout(timeoutId)
}
```

- [ ] **Step 2.4 — TypeScript check**
```powershell
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 2.5 — Browser smoke test (offline banner)**

In Chrome DevTools → Network → set throttle to "Offline". Open `http://localhost:5173`.
Expected: amber banner appears at top within 1 second.
Switch back to "No throttling" — banner turns green "✅ Back online" for 2.5s then disappears.

- [ ] **Step 2.6 — Commit**
```powershell
git add src/components/ui/NetworkBanner.tsx src/components/ui/index.tsx src/lib/gemini.ts
git commit -m "feat: network resilience — offline banner + 10s API timeout"
```

---

## Task 3 — `HoldToSpeakButton` component

**Files:**
- Create: `src/components/ui/HoldToSpeakButton.tsx`
- Modify: `src/components/ui/index.tsx`

- [ ] **Step 3.1 — Create `HoldToSpeakButton.tsx`**

```tsx
// src/components/ui/HoldToSpeakButton.tsx
import { useState, useRef, useEffect, useCallback } from 'react'
import { AiThinking } from './AiThinking'

export interface HoldToSpeakButtonProps {
  onResult: (transcript: string) => void
  onStart?: () => void
  onStop?: () => void
  disabled?: boolean
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

type ButtonState = 'idle' | 'listening' | 'processing'

const SIZE_MAP = { sm: 64, md: 80, lg: 96 }
const BAR_HEIGHTS_IDLE    = [8, 14, 20, 12, 8]      // static bars (idle)
const BAR_DELAYS          = [0, 0.15, 0.3, 0.2, 0.1] // staggered animation delays

export function HoldToSpeakButton({
  onResult, onStart, onStop,
  disabled = false, size = 'md', className = '',
}: HoldToSpeakButtonProps) {
  const [state, setState] = useState<ButtonState>('idle')
  const [toast, setToast]  = useState('')
  const recognitionRef     = useRef<any>(null)
  const transcriptRef      = useRef('')
  const silenceTimerRef    = useRef<ReturnType<typeof setTimeout> | null>(null)
  const px = SIZE_MAP[size]
  const radius = Math.round(px * 0.25)

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(''), 3000)
  }

  const stopRecognition = useCallback(() => {
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current)
    recognitionRef.current?.stop()
    recognitionRef.current = null
    setState('idle')
    onStop?.()
    // Visual haptic: snap-back is handled by CSS (scale returns to 1)
  }, [onStop])

  const handlePointerDown = () => {
    if (disabled || state !== 'idle') return

    // Android haptic (silently ignored on iOS)
    navigator.vibrate?.(10)

    // iOS visual haptic is handled by CSS :active or the pressed class below
    setState('listening')
    transcriptRef.current = ''

    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SpeechRecognition) {
      showToast('⚠️ Speech recognition not supported on this browser')
      setState('idle')
      return
    }

    const rec = new SpeechRecognition()
    rec.continuous      = true
    rec.interimResults  = true
    rec.lang            = 'en-US'

    // 15-second silence watchdog
    const resetSilenceTimer = () => {
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current)
      silenceTimerRef.current = setTimeout(() => {
        stopRecognition()
        showToast('⚠️ No speech detected — tap to try again')
      }, 15_000)
    }
    resetSilenceTimer()

    rec.onresult = (event: any) => {
      resetSilenceTimer() // voice detected — reset watchdog
      let interim = ''
      let final   = ''
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const t = event.results[i][0].transcript
        if (event.results[i].isFinal) final += t
        else interim += t
      }
      if (final) transcriptRef.current += final
    }

    // Safari silently calls onend after ~15s of nothing; guard against it
    rec.onend = () => {
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current)
      setState('idle')
    }

    rec.onerror = (event: any) => {
      if (event.error !== 'no-speech' && event.error !== 'aborted') {
        showToast(`⚠️ Mic error: ${event.error}`)
      }
      setState('idle')
    }

    rec.start()
    recognitionRef.current = rec
    onStart?.()
  }

  const handlePointerUp = () => {
    if (state !== 'listening') return
    // Android release haptic
    navigator.vibrate?.([5, 50, 5])
    stopRecognition()
    const result = transcriptRef.current.trim()
    if (result) onResult(result)
  }

  // Cleanup on unmount
  useEffect(() => () => {
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current)
    recognitionRef.current?.abort()
  }, [])

  const isListening = state === 'listening'

  return (
    <div className={`flex flex-col items-center gap-2 select-none ${className}`}>
      <style>{`
        @media (prefers-reduced-motion: no-preference) {
          .fsi-bar-live { animation: fsiBarBounce var(--dur, 0.6s) infinite alternate ease-in-out; }
          @keyframes fsiBarBounce { from { height: 4px } to { height: 22px } }
        }
        /* iOS visual haptic — instant scale + brightness on press */
        .fsi-hts-btn:active, .fsi-hts-btn[data-listening="true"] {
          transform: scale(0.92);
          filter: brightness(1.3);
          transition: transform 0.08s ease, filter 0.08s ease;
        }
        .fsi-hts-btn {
          transition: transform 0.12s ease, filter 0.12s ease;
        }
      `}</style>

      {/* Main button */}
      <button
        className="fsi-hts-btn flex flex-col items-center justify-center gap-1.5 touch-none"
        style={{
          width: px, height: px, borderRadius: radius,
          background: isListening ? '#0f3460' : '#1e293b',
          border: `2px solid ${isListening ? '#3b82f6' : '#334155'}`,
          boxShadow: isListening ? '0 0 0 4px rgba(59,130,246,0.2)' : 'none',
          cursor: disabled ? 'not-allowed' : 'pointer',
          opacity: disabled ? 0.4 : 1,
        }}
        data-listening={isListening}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        aria-label={isListening ? 'Release to stop recording' : 'Hold to speak'}
        disabled={disabled}
      >
        {/* Waveform bars */}
        <div className="flex items-center gap-0.5" style={{ height: 24 }}>
          {BAR_HEIGHTS_IDLE.map((h, i) => (
            <div
              key={i}
              className={isListening ? 'fsi-bar-live' : ''}
              style={{
                width: 4, borderRadius: 2,
                background: isListening ? '#60a5fa' : '#475569',
                height: isListening ? 4 : h,
                ['--dur' as any]: `${0.5 + BAR_DELAYS[i]}s`,
              }}
            />
          ))}
        </div>
        {/* State label */}
        <span style={{ fontSize: 10, color: isListening ? '#93c5fd' : '#64748b' }}>
          {isListening ? '說話中 🔵' : '按住錄音'}
        </span>
      </button>

      {/* Toast */}
      {toast && (
        <div className="text-amber-400 text-xs text-center max-w-48 leading-relaxed">
          {toast}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 3.2 — Export from `ui/index.tsx`**

```tsx
export { HoldToSpeakButton, type HoldToSpeakButtonProps } from './HoldToSpeakButton'
```

- [ ] **Step 3.3 — TypeScript check**
```powershell
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 3.4 — Browser smoke test**

Temporarily add to `Dashboard.tsx`:
```tsx
import { HoldToSpeakButton } from './ui'
// inside return:
<HoldToSpeakButton onResult={(t) => console.log('transcript:', t)} />
```
At `http://localhost:5173`: hold the button → waveform bars animate → speak → release → `transcript:` logged in DevTools console. Remove temp code.

- [ ] **Step 3.5 — Commit**
```powershell
git add src/components/ui/HoldToSpeakButton.tsx src/components/ui/index.tsx
git commit -m "feat: add HoldToSpeakButton with iOS visual haptics and 15s silence watchdog"
```

---

## Task 4 — `PageTransition` component

**Files:**
- Create: `src/components/ui/PageTransition.tsx`
- Modify: `src/components/ui/index.tsx`

- [ ] **Step 4.1 — Create `PageTransition.tsx`**

```tsx
// src/components/ui/PageTransition.tsx
import { useState, useEffect, type ReactNode } from 'react'
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
      // Prevents race condition where overlapping timers corrupt state order.
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
```

- [ ] **Step 4.2 — Export from `ui/index.tsx`**

```tsx
export { PageTransition } from './PageTransition'
```

- [ ] **Step 4.3 — TypeScript check**
```powershell
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 4.4 — Commit**
```powershell
git add src/components/ui/PageTransition.tsx src/components/ui/index.tsx
git commit -m "feat: add PageTransition — 220ms slide with race-condition-safe cleanup"
```

---

## Task 5 — `App.tsx` — lazy loading + wire all new components

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 5.1 — Replace App.tsx content**

```tsx
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

/**
 * Wraps each route's element with PageTransition.
 * PageTransition calls useLocation() internally — mounting it inside <Routes>
 * ensures it receives the correct router context.
 */
function Wrap({ children }: { children: ReactNode }) {
  return <PageTransition>{children}</PageTransition>
}
```

- [ ] **Step 5.2 — TypeScript check**
```powershell
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 5.3 — Browser smoke test — lazy loading**

Open DevTools → Network tab → reload `http://localhost:5173`.
Click each nav tab. Confirm separate `.js` chunk files load on demand (names like `DrillSession-[hash].js`).

- [ ] **Step 5.4 — Browser smoke test — transitions**

Click between nav tabs. Confirm each page slides in from the right. Rapidly click 3 tabs in quick succession — no freeze or blank screen.

- [ ] **Step 5.5 — Commit**
```powershell
git add src/App.tsx
git commit -m "feat: lazy-load all routes + wire NetworkBanner and PageTransition into App"
```

---

## Task 6 — `DrillSession.tsx` integration

**Files:**
- Modify: `src/components/DrillSession.tsx`

- [ ] **Step 6.1 — Replace import line for UI components**

```tsx
// Old:
import { Button, Card, Badge, MicButton, ProgressBar, LoadingSpinner, EmptyState } from './ui'
// New:
import { Button, Card, Badge, ProgressBar, LoadingSpinner, EmptyState, AiThinking, HoldToSpeakButton } from './ui'
```

- [ ] **Step 6.2 — Remove `useVoice` hook and its destructuring**

The `HoldToSpeakButton` manages its own `SpeechRecognition` internally. Remove:
```tsx
// DELETE these lines:
import { useVoice } from '../hooks/useVoice'
// ...
const {
  transcript, interimText, isListening, isSupported,
  startListening, stopListening, clearTranscript, speakText,
  error: voiceError,
} = useVoice()
```

Add local state for transcript instead:
```tsx
const [transcript, setTranscript] = useState('')
```

> **`interimText` clarification:** The existing `DrillSession.tsx` renders `interimText` as greyed-out partial text while the user is still speaking (lines 154–161 of the original file: `{interimText && <span className="text-slate-400"> {interimText}</span>}`). With `HoldToSpeakButton`, interim text is not surfaced — only the final transcript from `onResult` is available. Delete both the `interimText` render block and any reference to `interimText` in JSX. The final transcript still appears in the transcript display — only the real-time "ghost text" preview is removed. This is an acceptable UX trade-off for the simpler component boundary.

Keep `speakText` — but source it from a direct TTS call since `useVoice` is removed:
```tsx
const speakText = (text: string) => {
  const utt = new SpeechSynthesisUtterance(text)
  speechSynthesis.speak(utt)
}
```

- [ ] **Step 6.3 — Replace `<MicButton>` with `<HoldToSpeakButton>`**

Find the `phase === 'prompt'` block. Replace:
```tsx
// OLD:
<MicButton
  isListening={isListening}
  isSupported={isSupported}
  onStart={() => { clearTranscript(); startListening() }}
  onStop={handleStopRecording}
  size="lg"
/>

// NEW:
<HoldToSpeakButton
  size="lg"
  onStart={() => setTranscript('')}
  onResult={(t) => {
    setTranscript(t)
    setPhase('reviewing')
  }}
/>
```

Remove the `handleStopRecording` callback (no longer needed).

- [ ] **Step 6.4 — Replace `<LoadingSpinner>` feedback wait with `<AiThinking>`**

```tsx
// OLD:
{isLoadingFeedback && <LoadingSpinner text="Getting AI feedback..." />}

// NEW:
{isLoadingFeedback && <AiThinking variant="dots" label="Evaluating your answer..." />}
```

- [ ] **Step 6.5 — Remove `voiceError` display** (handled inside `HoldToSpeakButton` toast now)

Delete:
```tsx
{voiceError && (
  <p className="text-red-400 text-sm">{voiceError}</p>
)}
```

- [ ] **Step 6.6 — TypeScript check**
```powershell
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 6.7 — Browser smoke test**

At `http://localhost:5173/drills`:
1. Hold the square button → waveform bars animate
2. Speak a sentence → release → transcript appears in the card
3. Tap "Get Feedback" → 3 bouncing dots appear while waiting
4. AI feedback text replaces dots

- [ ] **Step 6.8 — Commit**
```powershell
git add src/components/DrillSession.tsx
git commit -m "feat: DrillSession — HoldToSpeakButton + AiThinking dots for feedback wait"
```

---

## Task 7 — `ConversationPartner.tsx` integration

**Files:**
- Modify: `src/components/ConversationPartner.tsx`

- [ ] **Step 7.1 — Update imports**

```tsx
// OLD:
import { Button, Card, Badge, MicButton, LoadingSpinner } from './ui'
// NEW:
import { Button, Card, Badge, AiThinking, HoldToSpeakButton } from './ui'
```

- [ ] **Step 7.2 — Replace voice input with `HoldToSpeakButton`**

Find the `<MicButton>` usage (in the input row at the bottom of the chat UI). Replace:
```tsx
// OLD:
<MicButton
  isListening={isListening}
  isSupported={isSupported}
  onStart={() => { clearTranscript(); startListening() }}
  onStop={() => stopListening()}
  size="md"
/>

// NEW:
<HoldToSpeakButton
  size="md"
  onResult={(t) => setInputText(t)}
  disabled={isLoading}
/>
```

Remove the `useVoice` destructuring for `isListening`, `isSupported`, `startListening`, `stopListening`, `clearTranscript`. Keep `speakText` for TTS of AI responses — replace with inline call if needed:
```tsx
const speakAiResponse = (text: string) => {
  const utt = new SpeechSynthesisUtterance(text)
  speechSynthesis.speak(utt)
}
```

Remove the `useEffect` that syncs `transcript` → `inputText` (no longer needed). It is the one at lines 41–45 of the original file with this signature:
```tsx
useEffect(() => {
  if (transcript && !isListening) {
    setInputText(transcript)
  }
}, [transcript, isListening])
```

- [ ] **Step 7.3 — Replace `<LoadingSpinner>` with `<AiThinking variant="wave">`**

Find where `isLoading` renders a spinner in the chat bubble area. Replace:
```tsx
// OLD:
{isLoading && <LoadingSpinner text="AI is thinking..." />}

// NEW:
{isLoading && (
  <div className="flex justify-start px-2">
    <AiThinking variant="wave" label="Coach is thinking..." />
  </div>
)}
```

- [ ] **Step 7.4 — TypeScript check**
```powershell
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 7.5 — Browser smoke test**

At `http://localhost:5173/chat`:
1. Select a scenario
2. Hold the square button → speak → release → text appears in input
3. Send → gradient wave animation appears while AI responds
4. AI response appears with TTS option

- [ ] **Step 7.6 — Commit**
```powershell
git add src/components/ConversationPartner.tsx
git commit -m "feat: ConversationPartner — HoldToSpeakButton + AiThinking wave"
```

---

## Task 8 — `VoicePractice.tsx` integration

**Files:**
- Modify: `src/components/VoicePractice.tsx`

- [ ] **Step 8.1 — Update imports**

```tsx
// OLD: (includes MicButton, LoadingSpinner)
import { ..., MicButton, LoadingSpinner, ... } from './ui'
// NEW:
import { ..., AiThinking, HoldToSpeakButton, ... } from './ui'
```

- [ ] **Step 8.2 — Replace recording button**

VoicePractice uses a `lg` or full-width mic button for extended free-speech recording. Replace with:
```tsx
<HoldToSpeakButton
  size="lg"
  onResult={(t) => {
    setTranscript(prev => prev ? prev + ' ' + t : t)
  }}
  onStart={() => setIsRecording(true)}
  onStop={() => setIsRecording(false)}
/>
```

The `onResult` appends to existing transcript (supports multi-hold recording sessions).

- [ ] **Step 8.3 — Replace analysis loading spinner**

```tsx
// OLD:
{isAnalyzing && <LoadingSpinner text="Analyzing your speech..." />}

// NEW:
{isAnalyzing && <AiThinking variant="wave" label="Analyzing your speech..." />}
```

- [ ] **Step 8.4 — TypeScript check**
```powershell
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 8.5 — Full end-to-end browser test**

Run through the complete verification checklist from the spec:

```
✅ 1. DevTools → Network → reload → confirm 6 separate JS chunks
✅ 2. iPhone Safari — hold button → mic activates → speak → transcript appears → haptic felt (visual on iOS)
✅ 3. Hold in silence 15s → toast "No speech detected" appears
✅ 4. ConversationPartner → send message → gradient wave appears during wait
✅ 5. DrillSession → submit → 3 bouncing dots appear during evaluation
✅ 6. Tap nav tabs → page slides right-to-left smoothly
✅ 7. DevTools → Network → Offline → amber banner appears within 1s
✅ 8. DevTools → Network → throttle to Slow 3G → after 10s → error shown
✅ 9. iOS Settings → Accessibility → Reduce Motion ON → transitions become fade
```

- [ ] **Step 8.6 — Final commit**
```powershell
git add src/components/VoicePractice.tsx
git commit -m "feat: VoicePractice — HoldToSpeakButton + AiThinking wave analysis"
```

- [ ] **Step 8.7 — Production build check**
```powershell
npm run build
```
Expected: build completes with no errors. Check `dist/` contains multiple JS chunks (lazy split).
