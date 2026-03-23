import { useState, useCallback } from 'react'
import { db, addXP, type DrillCard } from '../lib/db'
import { sm2, xpForQuality } from '../lib/sm2'
import { getDrill } from '../data/curriculum'

export function useDrills() {
  const [queue, setQueue] = useState<DrillCard[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isLoading, setIsLoading] = useState(false)
  const [sessionComplete, setSessionComplete] = useState(false)
  const [sessionXP, setSessionXP] = useState(0)

  const loadQueue = useCallback(async (unitId?: number) => {
    setIsLoading(true)
    setSessionComplete(false)
    setCurrentIndex(0)
    setSessionXP(0)

    const today = new Date().toISOString().slice(0, 10)
    let cards: DrillCard[]

    if (unitId) {
      // Practice specific unit (all 10 drills)
      cards = await db.cards.where('unitId').equals(unitId).toArray()
    } else {
      // Today's due cards across all units (max 20 per session)
      cards = await db.cards
        .where('nextReview')
        .belowOrEqual(today)
        .limit(20)
        .toArray()
    }

    // Shuffle for variety
    cards.sort(() => Math.random() - 0.5)
    setQueue(cards)
    setIsLoading(false)
  }, [])

  const currentCard = queue[currentIndex]
  const currentDrill = currentCard
    ? getDrill(currentCard.unitId, currentCard.drillIndex)
    : null

  const submitRating = useCallback(async (quality: 0 | 1 | 2 | 3) => {
    if (!currentCard || !currentCard.id) return

    const updated = sm2(currentCard, quality)
    const xp = xpForQuality(quality)

    await db.cards.update(currentCard.id, updated)
    await addXP(xp)
    setSessionXP(prev => prev + xp)

    if (currentIndex + 1 >= queue.length) {
      // Log session
      const today = new Date().toISOString().slice(0, 10)
      await db.sessions.add({
        date: today,
        unitId: currentCard.unitId,
        drillsCompleted: queue.length,
        xpEarned: sessionXP + xp,
      })
      setSessionComplete(true)
    } else {
      setCurrentIndex(i => i + 1)
    }
  }, [currentCard, currentIndex, queue.length, sessionXP])

  return {
    queue,
    currentCard,
    currentDrill,
    currentIndex,
    totalCards: queue.length,
    isLoading,
    sessionComplete,
    sessionXP,
    loadQueue,
    submitRating,
  }
}
