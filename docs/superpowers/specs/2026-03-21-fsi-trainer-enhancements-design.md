# FSI Trainer — Enhancement Design Spec
**Date:** 2026-03-21
**Status:** Approved by user

---

## Overview

Four targeted enhancements to the FSI Trainer PWA to improve performance, iOS speech UX, visual quality, and offline resilience. All changes use zero new dependencies — pure CSS, React built-ins, and Web APIs only.

---

## 1. Performance — React Lazy Loading (Code Splitting)

**Problem:** `App.tsx` synchronously imports all 6 page components, forcing the browser to download the full bundle before rendering anything. On 3G/4G this causes a ~3 second blank screen.

**Solution:** Convert all route components to `React.lazy()` with a shared `<Suspense>` boundary.

**Scope:**
- `src/App.tsx` — wrap all 6 route imports with `React.lazy(() => import(...))`
- `<Suspense fallback={<LoadingSpinner />}>` wraps the `<Routes>` block (reuses existing `LoadingSpinner` from `ui/index.tsx`)
- Vite automatically splits each lazy import into a separate chunk

**Expected outcome:** First paint under 0.8s on mobile networks. Subsequent tab switches are instant (chunks already cached).

**Constraints:** No new dependencies. Does not affect PWA service worker behaviour.

---

## 2. iOS Speech UX — Shared `<HoldToSpeakButton />` Component

**Problem:** Three pages (DrillSession, ConversationPartner, VoicePractice) each have their own ad-hoc mic button implementations. iOS Safari restricts microphone access without an explicit user gesture and silently stops `SpeechRecognition` after ~15 seconds of inactivity.

**Solution:** A single shared component that handles all iOS edge cases correctly.

**New file:** `src/components/ui/HoldToSpeakButton.tsx`

**Visual design (user-selected: Option C):**
- **Idle state:** Dark square with rounded corners (20px radius), static waveform bars (5 bars, varying heights, muted slate colour), label "按住錄音" below
- **Listening state:** Same square, waveform bars animate independently (each bar bounces at a different frequency via CSS keyframes), accent blue border glow, label changes to "說話中 🔵"
- **Processing state:** Square replaced by `<AiThinking variant="dots" />`, label "Processing..."

**Interaction model:**
- `onPointerDown` → start recording (works on iOS touch and desktop mouse)
- `onPointerUp` / `onPointerCancel` → stop recording
- `touch-action: none` on the button to prevent scroll interference

**Haptic feedback (cross-platform strategy):**

iOS Safari does **not** support `navigator.vibrate()` (Apple has permanently declined to implement the Web Vibration API). Solution is two-layer:

1. **Android / Chrome PWA:** `navigator.vibrate(10)` on press, `navigator.vibrate([5, 50, 5])` on release — wrapped in `if (navigator.vibrate)` guard, silently skipped on iOS
2. **Visual haptics for iOS (always-on):** On `pointerdown`, apply a 120ms CSS micro-animation: `transform: scale(0.92)` + `filter: brightness(1.3)` → snaps back to normal. This gives the eye/brain a physical "click" sensation that substitutes for vibration on all Apple devices.

Both layers run simultaneously — Android users get vibration + visual, iOS users get visual only.
- 15-second silence watchdog: if `SpeechRecognition.onresult` has not fired within 15s of starting, auto-stop and emit a toast: "⚠️ No speech detected — tap to try again"
- `SpeechRecognition.onend` always resets `isListening` state (guards against Safari's silent termination)

**Props interface:**
```typescript
interface HoldToSpeakButtonProps {
  onResult: (transcript: string) => void
  onStart?: () => void
  onStop?: () => void
  disabled?: boolean
  size?: 'sm' | 'md' | 'lg'        // sm=64px, md=80px (default), lg=96px
  className?: string
}
```

**Integration:** Replace existing mic button implementations in:
- `src/components/DrillSession.tsx`
- `src/components/ConversationPartner.tsx`
- `src/components/VoicePractice.tsx`

---

## 3. Visual — Shared `<AiThinking />` Component

**Problem:** Loading states across the app use either a generic `<LoadingSpinner />` or plain text, breaking the "premium AI coach" feel during the most critical moment (waiting for feedback).

**Solution:** A single `<AiThinking />` component with two context-appropriate variants.

**New file:** `src/components/ui/AiThinking.tsx`

**Variants (user-selected: B + A combination):**

| Variant | Animation | Use case |
|---|---|---|
| `"wave"` | Flowing gradient bar (blue → purple → cyan, 2s loop) | ConversationPartner AI reply, VoicePractice analysis |
| `"dots"` | 3 bouncing dots, staggered 0.2s delay each | DrillSession evaluation feedback |

**Props interface:**
```typescript
interface AiThinkingProps {
  variant: 'wave' | 'dots'
  label?: string          // optional text below animation
  className?: string
}
```

**Implementation:** Pure CSS `@keyframes` — no JavaScript animation libraries. Respects `prefers-reduced-motion` (falls back to a static opacity pulse).

**Integration:** Replace all `{isLoading && <LoadingSpinner />}` patterns in DrillSession, ConversationPartner, and VoicePractice with the appropriate `<AiThinking />` variant.

---

## 4A. Visual — Page Transition (`<PageTransition />`)

**Problem:** Switching tabs feels like a webpage (instant jump), not a native iOS app (smooth slide).

**Solution:** A thin wrapper component that applies a CSS slide animation on route change.

**New file:** `src/components/ui/PageTransition.tsx`

**Animation (user-selected: Option B — True dual-screen horizontal slide):**
- Old page slides **out to the left** while new page slides **in from the right** simultaneously
- Duration: 220ms ease-out per direction
- Accessibility: `@media (prefers-reduced-motion: reduce)` degrades to a 150ms opacity fade

**Implementation — delayed unmount pattern (solves React's instant-unmount problem):**

React Router unmounts the old route component immediately on URL change, causing a single-screen slide-in rather than a true dual-panel transition. Solution: `PageTransition` manages its own `displayLocation` state to hold the previous screen alive during the exit animation:

```typescript
const [displayLocation, setDisplayLocation] = useState(location)
const [stage, setStage] = useState<'enter' | 'exit'>('enter')

useEffect(() => {
  if (location.key !== displayLocation.key) {
    setStage('exit')                      // old screen starts sliding left
    const timerId = setTimeout(() => {
      setDisplayLocation(location)        // swap content after 220ms
      setStage('enter')                   // new screen slides in from right
    }, 220)
    // ⚠️ CRITICAL — cleanup function cancels the in-flight timer if the user
    // navigates again before 220ms elapses (rapid tapping between tabs).
    // Without this, multiple overlapping timers write state in the wrong order,
    // causing flicker, freeze, or a blank screen (race condition).
    return () => clearTimeout(timerId)
  }
}, [location, displayLocation.key])
```

**Race condition defence:** The `return () => clearTimeout(timerId)` cleanup is mandatory. React calls the cleanup function before re-running the effect — so if the user taps a second nav item within 220ms, the first timer is cancelled before it can corrupt state. The second navigation starts a clean new exit animation. Always assume users will tap at maximum speed.

**CSS keyframes required:**
- `.page-enter` → `slideInFromRight`: `translateX(6%) → translateX(0)` + `opacity: 0 → 1`
- `.page-exit`  → `slideOutToLeft`:  `translateX(0) → translateX(-6%)` + `opacity: 1 → 0`

A subtle 6% translate (not 100%) keeps the motion tight and fast — full 100% slide feels sluggish on a phone screen at 220ms.

**Integration:** `<PageTransition>` wraps the rendered element inside each `<Route>` in `src/App.tsx` (not the whole `<Routes>` block), receiving `location` from `useLocation()`.

---

## 4B. Offline — Network Resilience

**Problem:** If the device loses connectivity mid-session, the Gemini API call hangs indefinitely, the UI freezes, and the user has no indication of what's wrong.

**Three-layer solution:**

### Layer 1 — AbortController Timeout (in `src/lib/gemini.ts`)
- Add a 10-second `AbortController` to every `fetch()` call in `generate()`
- On `AbortError`: throw a user-friendly error `"Network timeout — please check your connection and try again"`
- Existing error handling in each component surfaces this as a toast/banner

### Layer 2 — Pre-flight `navigator.onLine` Check (in `src/lib/gemini.ts`)
- At the top of `generate()`, check `navigator.onLine`
- If `false`: immediately throw `"You're offline — connect to the internet to get AI feedback"`
- Prevents wasted time waiting for a doomed request

### Layer 3 — `<NetworkBanner />` Component (new file)
**New file:** `src/components/ui/NetworkBanner.tsx`
- Listens to `window` `online` / `offline` events via `useEffect`
- When offline: shows a fixed top banner — amber background, "⚡ Offline — AI features unavailable" text
- When back online: banner slides up and disappears after 2 seconds
- Mounted once in `src/App.tsx` above `<main>`
- Zero API calls; pure browser event listening

---

## Toast Notification System

The spec references "toast" messages in two places (15s watchdog, network timeout). The existing codebase has no toast component. Rather than adding a library, implement a minimal inline toast:

- A `useToast()` hook with `{ message, show }` state
- A fixed-position `<div>` at the bottom of the screen (above the nav bar), fades in/out via CSS
- Used inside `HoldToSpeakButton` for the 15s watchdog
- Used inside DrillSession / ConversationPartner / VoicePractice for API timeout errors
- Not a new shared component — each consumer manages its own local toast state via `useToast()`

---

## App.tsx Nesting Order

The correct component nesting order in `App.tsx` after all enhancements are applied:

```tsx
<NetworkBanner />                          // fixed overlay, outside flow
<Suspense fallback={<LoadingSpinner />}>   // catches lazy-load chunks
  <ErrorBoundary>                          // catches runtime component errors
    <Routes>
      <Route path="/" element={
        <PageTransition>                   // keyed on location.key
          <Dashboard />
        </PageTransition>
      } />
      {/* ... other routes ... */}
    </Routes>
  </ErrorBoundary>
</Suspense>
```

`<Suspense>` must be **outside** `<ErrorBoundary>` so that lazy-load failures are caught by the boundary rather than propagating uncaught. `<PageTransition>` wraps each route's element individually (not the whole `<Routes>`) so the animation triggers per-page.

---

## Files Changed

### New files (4)
```
src/components/ui/HoldToSpeakButton.tsx
src/components/ui/AiThinking.tsx
src/components/ui/PageTransition.tsx
src/components/ui/NetworkBanner.tsx
```

### Modified files (5)
```
src/App.tsx                          — lazy imports, NetworkBanner, PageTransition
src/lib/gemini.ts                    — AbortController timeout, onLine check
src/components/DrillSession.tsx      — HoldToSpeakButton, AiThinking("dots")
src/components/ConversationPartner.tsx — HoldToSpeakButton, AiThinking("wave")
src/components/VoicePractice.tsx     — HoldToSpeakButton, AiThinking("wave")
```

### No changes needed
```
src/lib/sm2.ts, src/lib/db.ts, src/lib/speech.ts
src/hooks/*, src/store/*, src/data/curriculum.ts
```

---

## Dependencies

**Zero new packages.** All features use:
- React built-ins (`lazy`, `Suspense`, `useEffect`, `useState`, `useLocation`)
- CSS `@keyframes` animations
- Web APIs (`navigator.vibrate`, `navigator.onLine`, `AbortController`, `window.online/offline`)

---

## Verification Checklist

1. **Lazy loading:** DevTools → Network → reload → confirm 6 separate JS chunks load on demand
2. **Hold-to-Speak:** On iPhone Safari — tap button → mic activates → speak → transcript appears → haptic felt
3. **15s watchdog:** Hold button in silence for 15s → toast "No speech detected" appears
4. **AiThinking wave:** ConversationPartner → send message → gradient wave appears during wait
5. **AiThinking dots:** DrillSession → submit answer → 3 bouncing dots appear during evaluation
6. **Page transition:** Tap any nav tab → page slides in from right smoothly
7. **Offline banner:** Disable WiFi → amber banner appears at top within 1 second
8. **10s timeout:** Throttle network in DevTools → after 10s → toast "Network timeout" appears
9. **prefers-reduced-motion:** Enable in iOS Settings → transitions degrade to fade
