import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type Accent = 'en-US' | 'en-GB' | 'en-AU'
export type VoiceSpeed = 0.8 | 1.0 | 1.2

interface AppState {
  // Settings
  geminiApiKey: string
  accent: Accent
  voiceSpeed: VoiceSpeed
  dailyGoalMinutes: number
  feedbackMode: boolean

  // Actions
  setApiKey: (key: string) => void
  setAccent: (accent: Accent) => void
  setVoiceSpeed: (speed: VoiceSpeed) => void
  setDailyGoal: (minutes: number) => void
  toggleFeedbackMode: () => void
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      geminiApiKey: '',
      accent: 'en-US',
      voiceSpeed: 1.0,
      dailyGoalMinutes: 20,
      feedbackMode: true,

      setApiKey: (key) => {
        set({ geminiApiKey: key })
        localStorage.setItem('gemini_api_key', key)
      },
      setAccent: (accent) => set({ accent }),
      setVoiceSpeed: (voiceSpeed) => set({ voiceSpeed }),
      setDailyGoal: (dailyGoalMinutes) => set({ dailyGoalMinutes }),
      toggleFeedbackMode: () => set((s) => ({ feedbackMode: !s.feedbackMode })),
    }),
    { name: 'fsi-trainer-settings' }
  )
)
