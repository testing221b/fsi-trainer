import Dexie, { type Table } from 'dexie'
import type { CardState } from './sm2'

export interface DrillCard extends CardState {
  id?: number
  unitId: number       // 1–30
  drillIndex: number   // 0–9
}

export interface SessionLog {
  id?: number
  date: string         // YYYY-MM-DD
  unitId: number
  drillsCompleted: number
  xpEarned: number
}

export interface ConversationLog {
  id?: number
  date: string
  scenario: string
  messages: Array<{ role: 'user' | 'assistant'; content: string }>
  durationMinutes: number
}

export interface UserProgress {
  id: number           // always 1 (singleton row)
  totalXP: number
  streakDays: number
  lastStudyDate: string
}

class FSIDatabase extends Dexie {
  cards!: Table<DrillCard>
  sessions!: Table<SessionLog>
  conversations!: Table<ConversationLog>
  progress!: Table<UserProgress>

  constructor() {
    super('FSITrainer')
    this.version(1).stores({
      cards: '++id, unitId, drillIndex, nextReview',
      sessions: '++id, date, unitId',
      conversations: '++id, date, scenario',
      progress: 'id',
    })
  }
}

export const db = new FSIDatabase()

/** Seed all 300 drill cards on first launch */
export async function seedCardsIfNeeded(totalUnits: number, drillsPerUnit: number) {
  const count = await db.cards.count()
  if (count > 0) return

  const today = new Date().toISOString().slice(0, 10)
  const cards: Omit<DrillCard, 'id'>[] = []

  for (let unitId = 1; unitId <= totalUnits; unitId++) {
    for (let drillIndex = 0; drillIndex < drillsPerUnit; drillIndex++) {
      cards.push({
        unitId,
        drillIndex,
        interval: 0,
        repetitions: 0,
        easeFactor: 2.5,
        nextReview: today,   // all due on day 1
        lastReview: today,
      })
    }
  }

  await db.cards.bulkAdd(cards)
}

/** Get or create the singleton progress row */
export async function getProgress(): Promise<UserProgress> {
  let p = await db.progress.get(1)
  if (!p) {
    p = { id: 1, totalXP: 0, streakDays: 0, lastStudyDate: '' }
    await db.progress.put(p)
  }
  return p
}

/** Add XP and update streak */
export async function addXP(amount: number) {
  const today = new Date().toISOString().slice(0, 10)
  const p = await getProgress()
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  const yesterdayStr = yesterday.toISOString().slice(0, 10)

  const newStreak =
    p.lastStudyDate === today ? p.streakDays
    : p.lastStudyDate === yesterdayStr ? p.streakDays + 1
    : 1

  await db.progress.put({
    id: 1,
    totalXP: p.totalXP + amount,
    streakDays: newStreak,
    lastStudyDate: today,
  })
}

/** Get XP earned per day for the last N days — single DB query */
export async function getWeeklyXP(days = 7): Promise<{ date: string; xp: number }[]> {
  const dayList = Array.from({ length: days }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - (days - 1 - i))
    return d.toISOString().slice(0, 10)
  })
  const sessions = await db.sessions.where('date').anyOf(dayList).toArray()
  return dayList.map(date => ({
    date,
    xp: sessions.filter(s => s.date === date).reduce((sum, s) => sum + s.xpEarned, 0),
  }))
}
