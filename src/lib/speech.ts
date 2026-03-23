/**
 * Web Speech API wrapper — iOS Safari compatible
 * SpeechRecognition for input, SpeechSynthesis for output
 */

// iOS Safari uses webkit prefix
const SpeechRecognitionAPI =
  (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition

export const isSpeechRecognitionSupported = !!SpeechRecognitionAPI
export const isSpeechSynthesisSupported = !!window.speechSynthesis

export type RecognitionState = 'idle' | 'listening' | 'processing' | 'error'

export interface SpeechConfig {
  lang?: string          // default 'en-US'
  continuous?: boolean   // default false
  interimResults?: boolean
  onResult: (transcript: string, isFinal: boolean) => void
  onStateChange?: (state: RecognitionState) => void
  onError?: (error: string) => void
}

export class SpeechRecognizer {
  private recognition: any
  private config: SpeechConfig
  private state: RecognitionState = 'idle'

  constructor(config: SpeechConfig) {
    this.config = config

    if (!SpeechRecognitionAPI) return

    this.recognition = new SpeechRecognitionAPI()
    this.recognition.lang = config.lang ?? 'en-US'
    this.recognition.continuous = config.continuous ?? false
    this.recognition.interimResults = config.interimResults ?? true
    this.recognition.maxAlternatives = 1

    this.recognition.onstart = () => {
      this.setState('listening')
    }

    this.recognition.onresult = (event: any) => {
      let finalTranscript = ''
      let interimTranscript = ''

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i]
        if (result.isFinal) {
          finalTranscript += result[0].transcript
        } else {
          interimTranscript += result[0].transcript
        }
      }

      if (finalTranscript) {
        this.config.onResult(finalTranscript.trim(), true)
      } else if (interimTranscript) {
        this.config.onResult(interimTranscript.trim(), false)
      }
    }

    this.recognition.onerror = (event: any) => {
      const msg = event.error === 'no-speech'
        ? 'No speech detected. Please try again.'
        : event.error === 'not-allowed'
        ? 'Microphone access denied. Please allow microphone in Settings.'
        : `Recognition error: ${event.error}`
      this.setState('error')
      this.config.onError?.(msg)
    }

    this.recognition.onend = () => {
      if (this.state === 'listening') {
        this.setState('idle')
      }
    }
  }

  private setState(state: RecognitionState) {
    this.state = state
    this.config.onStateChange?.(state)
  }

  start() {
    if (!this.recognition) return
    try {
      this.recognition.start()
    } catch {
      // Already started — ignore
    }
  }

  stop() {
    if (!this.recognition) return
    try {
      this.recognition.stop()
      this.setState('idle')
    } catch {
      // Already stopped
    }
  }

  abort() {
    if (!this.recognition) return
    try {
      this.recognition.abort()
      this.setState('idle')
    } catch {}
  }

  get isListening() {
    return this.state === 'listening'
  }
}

// ─── Text-to-Speech ────────────────────────────────────────────────

export interface TTSConfig {
  lang?: string          // default 'en-US'
  rate?: number          // 0.5–2, default 1.0
  pitch?: number         // 0–2, default 1.0
  voiceName?: string     // e.g., "Samantha" (US), "Daniel" (UK)
}

let selectedVoice: SpeechSynthesisVoice | null = null

/** Load and cache the best available English voice */
export function loadVoices(): SpeechSynthesisVoice[] {
  if (!isSpeechSynthesisSupported) return []
  return window.speechSynthesis.getVoices().filter(v => v.lang.startsWith('en'))
}

export function setVoice(voiceName: string) {
  const voices = loadVoices()
  selectedVoice = voices.find(v => v.name === voiceName) ?? null
}

export function speak(text: string, config: TTSConfig = {}): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!isSpeechSynthesisSupported) {
      resolve()
      return
    }

    // Cancel any ongoing speech
    window.speechSynthesis.cancel()

    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = config.lang ?? 'en-US'
    utterance.rate = config.rate ?? 1.0
    utterance.pitch = config.pitch ?? 1.0

    if (selectedVoice) {
      utterance.voice = selectedVoice
    } else if (config.voiceName) {
      const voices = loadVoices()
      const match = voices.find(v => v.name === config.voiceName)
      if (match) utterance.voice = match
    }

    utterance.onend = () => resolve()
    utterance.onerror = (e) => reject(new Error(e.error))

    // iOS requires a user gesture before speaking — this is called in event handlers
    window.speechSynthesis.speak(utterance)
    resolve() // Resolve immediately for better UX; errors handled via onerror
  })
}

export function stopSpeaking() {
  if (isSpeechSynthesisSupported) {
    window.speechSynthesis.cancel()
  }
}

export function isSpeaking(): boolean {
  return isSpeechSynthesisSupported && window.speechSynthesis.speaking
}
