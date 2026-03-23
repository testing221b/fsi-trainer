// src/components/ui/HoldToSpeakButton.tsx
import { useState, useRef, useEffect, useCallback } from 'react'

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
const BAR_HEIGHTS_IDLE    = [8, 14, 20, 12, 8]
const BAR_DELAYS          = [0, 0.15, 0.3, 0.2, 0.1]

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
  }, [onStop])

  const handlePointerDown = () => {
    if (disabled || state !== 'idle') return

    // Android haptic (silently ignored on iOS)
    navigator.vibrate?.(10)

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

    const resetSilenceTimer = () => {
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current)
      silenceTimerRef.current = setTimeout(() => {
        stopRecognition()
        showToast('⚠️ No speech detected — tap to try again')
      }, 15_000)
    }
    resetSilenceTimer()

    rec.onresult = (event: any) => {
      resetSilenceTimer()
      let final = ''
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) final += event.results[i][0].transcript
      }
      if (final) transcriptRef.current += final
    }

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
        .fsi-hts-btn:active, .fsi-hts-btn[data-listening="true"] {
          transform: scale(0.92);
          filter: brightness(1.3);
          transition: transform 0.08s ease, filter 0.08s ease;
        }
        .fsi-hts-btn {
          transition: transform 0.12s ease, filter 0.12s ease;
        }
      `}</style>

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
        <span style={{ fontSize: 10, color: isListening ? '#93c5fd' : '#64748b' }}>
          {isListening ? '說話中 🔵' : '按住錄音'}
        </span>
      </button>

      {toast && (
        <div className="text-amber-400 text-xs text-center max-w-48 leading-relaxed">
          {toast}
        </div>
      )}
    </div>
  )
}
