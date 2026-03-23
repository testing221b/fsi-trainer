export interface CardState {
  interval: number        // days until next review
  repetitions: number     // consecutive successful reviews
  easeFactor: number      // 1.3–2.5, default 2.5
  nextReview: string      // YYYY-MM-DD
  lastReview: string      // YYYY-MM-DD
}

export const DEFAULT_CARD_STATE: CardState = {
  interval: 0,
  repetitions: 0,
  easeFactor: 2.5,
  nextReview: new Date().toISOString().slice(0, 10),
  lastReview: new Date().toISOString().slice(0, 10),
}

/**
 * SM-2 spaced repetition algorithm
 * quality: 0=Again, 1=Hard, 2=Good, 3=Easy
 * Maps to SM-2 q: 0, 3, 4, 5
 */
export function sm2(card: CardState, quality: 0 | 1 | 2 | 3): CardState {
  const qMap = [0, 3, 4, 5]
  const q = qMap[quality]

  let { interval, repetitions, easeFactor } = card

  if (q < 3) {
    // Failed — reset
    repetitions = 0
    interval = 1
  } else {
    // Passed
    if (repetitions === 0) {
      interval = 1
    } else if (repetitions === 1) {
      interval = 6
    } else {
      interval = Math.round(interval * easeFactor)
    }
    repetitions += 1
  }

  // Update ease factor (never below 1.3)
  easeFactor = Math.max(
    1.3,
    easeFactor + 0.1 - (5 - q) * (0.08 + (5 - q) * 0.02)
  )

  const next = new Date()
  next.setDate(next.getDate() + interval)

  return {
    interval,
    repetitions,
    easeFactor: Math.round(easeFactor * 100) / 100,
    nextReview: next.toISOString().slice(0, 10),
    lastReview: new Date().toISOString().slice(0, 10),
  }
}

export function isDue(card: CardState): boolean {
  const today = new Date().toISOString().slice(0, 10)
  return card.nextReview <= today
}

export function xpForQuality(quality: 0 | 1 | 2 | 3): number {
  return [0, 5, 10, 15][quality]
}

export function cefrFromProgress(totalDrills: number, avgEase: number): string {
  // 300 total drills; ease factor 1.3 (struggling) → 2.5 (mastered)
  const drillScore = Math.min(totalDrills / 300, 1) // 0–1
  const easeScore = Math.min((avgEase - 1.3) / 1.2, 1) // 0–1
  const combined = drillScore * 0.6 + easeScore * 0.4

  if (combined < 0.10) return 'A1'
  if (combined < 0.22) return 'A2'
  if (combined < 0.38) return 'B1'
  if (combined < 0.56) return 'B2'
  if (combined < 0.78) return 'C1'
  return 'C2'
}
