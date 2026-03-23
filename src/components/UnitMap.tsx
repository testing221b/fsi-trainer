import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { db } from '../lib/db'
import { CURRICULUM, getCycleUnits } from '../data/curriculum'
import { Card, Badge } from './ui'

interface UnitStatus {
  unitId: number
  completed: number   // drills with repetitions > 0
  mastered: number    // drills with easeFactor >= 2.3 and repetitions >= 3
}

const CYCLE_INFO = {
  1: { label: 'Cycle 1 — Foundation', color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/20' },
  2: { label: 'Cycle 2 — Fluency', color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/20' },
  3: { label: 'Cycle 3 — Mastery', color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/20' },
}

export default function UnitMap() {
  const navigate = useNavigate()
  const [unitStats, setUnitStats] = useState<Record<number, UnitStatus>>({})
  const [selectedCycle, setSelectedCycle] = useState<1 | 2 | 3>(1)

  useEffect(() => {
    loadStats()
  }, [])

  const loadStats = async () => {
    const cards = await db.cards.toArray()
    const stats: Record<number, UnitStatus> = {}

    for (const unit of CURRICULUM) {
      const unitCards = cards.filter(c => c.unitId === unit.id)
      stats[unit.id] = {
        unitId: unit.id,
        completed: unitCards.filter(c => c.repetitions > 0).length,
        mastered: unitCards.filter(c => c.easeFactor >= 2.3 && c.repetitions >= 3).length,
      }
    }

    setUnitStats(stats)
  }

  const getStatusColor = (status: UnitStatus | undefined) => {
    if (!status) return 'bg-slate-700/40 border-slate-600/30'
    if (status.mastered >= 8) return 'bg-emerald-900/30 border-emerald-500/40'
    if (status.completed >= 5) return 'bg-blue-900/30 border-blue-500/40'
    if (status.completed > 0) return 'bg-slate-700/60 border-slate-500/40'
    return 'bg-slate-800/40 border-slate-700/30'
  }

  const getStatusLabel = (status: UnitStatus | undefined) => {
    if (!status || status.completed === 0) return null
    if (status.mastered >= 8) return { text: '🏆 Mastered', color: 'green' as const }
    if (status.completed >= 8) return { text: '⭐ Nearly done', color: 'blue' as const }
    if (status.completed >= 5) return { text: '📈 In progress', color: 'blue' as const }
    return { text: '🌱 Started', color: 'slate' as const }
  }

  const cycleUnits = getCycleUnits(selectedCycle)

  // Overall stats
  const totalCompleted = Object.values(unitStats).reduce((s, u) => s + u.completed, 0)
  const totalMastered = Object.values(unitStats).reduce((s, u) => s + u.mastered, 0)

  return (
    <div className="flex-1 scrollable px-4 pt-4 pb-6 space-y-4">

      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-white">Unit Map</h2>
        <p className="text-slate-400 text-sm">30 units · 300 drills · 3 cycles</p>
      </div>

      {/* Overall Stats */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="text-center py-4">
          <p className="text-2xl font-bold text-blue-400">{totalCompleted}</p>
          <p className="text-xs text-slate-400">Drills practiced</p>
        </Card>
        <Card className="text-center py-4">
          <p className="text-2xl font-bold text-emerald-400">{totalMastered}</p>
          <p className="text-xs text-slate-400">Drills mastered</p>
        </Card>
      </div>

      {/* Cycle Tabs */}
      <div className="flex gap-2">
        {([1, 2, 3] as const).map(cycle => (
          <button
            key={cycle}
            onClick={() => setSelectedCycle(cycle)}
            className={`flex-1 py-2 rounded-2xl text-sm font-semibold transition-all ${
              selectedCycle === cycle
                ? 'bg-blue-600 text-white'
                : 'bg-slate-700/50 text-slate-400 hover:bg-slate-700'
            }`}
          >
            Cycle {cycle}
          </button>
        ))}
      </div>

      {/* Cycle Label */}
      <div className={`border rounded-2xl px-3 py-2 ${CYCLE_INFO[selectedCycle].bg}`}>
        <p className={`font-semibold text-sm ${CYCLE_INFO[selectedCycle].color}`}>
          {CYCLE_INFO[selectedCycle].label}
        </p>
      </div>

      {/* Units Grid */}
      <div className="space-y-3">
        {cycleUnits.map(unit => {
          const status = unitStats[unit.id]
          const statusLabel = getStatusLabel(status)
          const progressPct = status ? (status.completed / 10) * 100 : 0

          return (
            <div
              key={unit.id}
              className={`rounded-3xl border p-4 cursor-pointer transition-all active:scale-98 ${getStatusColor(status)}`}
              onClick={() => navigate(`/drills?unit=${unit.id}`)}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-bold text-slate-500">Unit {unit.id}</span>
                    {statusLabel && (
                      <Badge color={statusLabel.color} size="sm">{statusLabel.text}</Badge>
                    )}
                  </div>
                  <h3 className="font-semibold text-white text-sm">{unit.title}</h3>
                  <p className="text-slate-400 text-xs mt-0.5">{unit.grammarFocus}</p>
                </div>
                <div className="text-right text-xs text-slate-500 shrink-0">
                  {status?.completed ?? 0}/10
                </div>
              </div>

              {/* Progress bar */}
              <div className="mt-3 w-full h-1.5 bg-slate-700 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    (status?.mastered ?? 0) >= 8 ? 'bg-emerald-500' :
                    progressPct > 0 ? 'bg-blue-500' : 'bg-slate-600'
                  }`}
                  style={{ width: `${progressPct}%` }}
                />
              </div>

              <div className="mt-2 flex items-center justify-between">
                <p className="text-xs text-slate-500 italic">{unit.scene}</p>
                <span className="text-xs text-blue-400">Practice →</span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
