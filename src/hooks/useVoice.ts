import { useState, useEffect, useRef, useCallback } from 'react'
import {
  SpeechRecognizer,
  isSpeechRecognitionSupported,
  speak,
  stopSpeaking,
  type RecognitionState,
} from '../lib/speech'
import { useAppStore } from '../store/appStore'

export function useVoice() {
  const { accent, voiceSpeed } = useAppStore()
  const [transcript, setTranscript] = useState('')
  const [interimText, setInterimText] = useState('')
  const [recognitionState, setRecognitionState] = useState<RecognitionState>('idle')
  const [error, setError] = useState<string | null>(null)
  const recognizerRef = useRef<SpeechRecognizer | null>(null)

  useEffect(() => {
    recognizerRef.current = new SpeechRecognizer({
      lang: accent,
      interimResults: true,
      onResult: (text, isFinal) => {
        if (isFinal) {
          setTranscript(prev => prev ? prev + ' ' + text : text)
          setInterimText('')
        } else {
          setInterimText(text)
        }
      },
      onStateChange: setRecognitionState,
      onError: (msg) => {
        setError(msg)
        setRecognitionState('idle')
      },
    })

    return () => {
      recognizerRef.current?.abort()
    }
  }, [accent])

  const startListening = useCallback(() => {
    setError(null)
    setInterimText('')
    recognizerRef.current?.start()
  }, [])

  const stopListening = useCallback(() => {
    recognizerRef.current?.stop()
  }, [])

  const clearTranscript = useCallback(() => {
    setTranscript('')
    setInterimText('')
  }, [])

  const speakText = useCallback(async (text: string) => {
    await speak(text, { lang: accent, rate: voiceSpeed })
  }, [accent, voiceSpeed])

  return {
    transcript,
    interimText,
    recognitionState,
    isListening: recognitionState === 'listening',
    isSupported: isSpeechRecognitionSupported,
    error,
    startListening,
    stopListening,
    clearTranscript,
    speakText,
    stopSpeaking,
  }
}
