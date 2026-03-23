import { useEffect, useState, useCallback } from 'react'
import { db, getProgress, getWeeklyXP, type UserProgress } from '../lib/db'
import { cefrFromProgress } from '../lib/sm2'

interface ProgressData {
  progress: UserProgress | null
  dueCount: number
  weeklyXP: { date: string; xp: number }[]
  cefrLevel: string
  avgEaseFactor: number
  isLoading: boolean
  refresh: () => void
}

export function useProgress(): ProgressData {
  const [progress, setProgress] = useState<UserProgress | null>(null)
  const [dueCount, setDueCount] = useState(0)
  const [weeklyXP, setWeeklyXP] = useState<{ date: string; xp: number }[]>([])
  const [avgEase, setAvgEase] = useState(2.5)
  const [isLoading, setIsLoading] = useState(true)

  const load = useCallback(async () => {
    setIsLoading(true)
    try {
      const today = new Date().toISOString().slice(0, 10)
      const [p, due, weekly, cards] = await Promise.all([
        getProgress(),
        db.cards.where('nextReview').belowOrEqual(today).count(),
        getWeeklyXP(7),
        db.cards.toArray(),
      ])

      const avg = cards.length > 0
        ? cards.reduce((sum, c) => sum + c.easeFactor, 0) / cards.length
        : 2.5

      setProgress(p)
      setDueCount(due)
      setWeeklyXP(weekly)
      setAvgEase(avg)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const completedDrills = progress ? Math.max(0, (progress.totalXP / 10)) : 0

  return {
    progress,
    dueCount,
    weeklyXP,
    cefrLevel: cefrFromProgress(completedDrills, avgEase),
    avgEaseFactor: avgEase,
    isLoading,
    refresh: load,
  }
}
