import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from 'recharts'
import { useProgress } from '../hooks/useProgress'
import { useDrills } from '../hooks/useDrills'
import { seedCardsIfNeeded } from '../lib/db'
import { Card, Badge, ProgressBar, LoadingSpinner } from './ui'

const CEFR_COLORS: Record<string, string> = {
  A1: 'slate', A2: 'slate', B1: 'blue', B2: 'blue', C1: 'gold', C2: 'green',
} as const

const CEFR_PROGRESS: Record<string, number> = {
  A1: 5, A2: 15, B1: 30, B2: 50, C1: 72, C2: 100,
}

export default function Dashboard() {
  const navigate = useNavigate()
  const { progress, dueCount, weeklyXP, cefrLevel, isLoading, refresh } = useProgress()
  const { loadQueue } = useDrills()

  useEffect(() => {
    seedCardsIfNeeded(30, 10).then(refresh)
  }, [refresh])

  const handleStartDrills = async () => {
    await loadQueue()
    navigate('/drills')
  }

  if (isLoading) return <LoadingSpinner text="Loading your progress..." />

  const totalXP = progress?.totalXP ?? 0
  const streak = progress?.streakDays ?? 0
  const weeklyGoalXP = 500
  const weeklyTotal = weeklyXP.reduce((s, d) => s + d.xp, 0)
  const weeklyPercent = Math.min(100, (weeklyTotal / weeklyGoalXP) * 100)

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr)
    return d.toLocaleDateString('en', { weekday: 'short' }).slice(0, 3)
  }

  return (
    <div className="scrollable flex-1 px-4 pt-4 pb-6 space-y-4">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">FSI Trainer</h1>
          <p className="text-slate-400 text-sm">Your path to C2 mastery</p>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold text-amber-400">🔥 {streak}</div>
          <div className="text-xs text-slate-400">day streak</div>
        </div>
      </div>

      {/* CEFR Level Card */}
      <Card className="bg-gradient-to-br from-blue-900/60 to-slate-800/60">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-xs text-slate-400 uppercase tracking-wider">Current Level</p>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-4xl font-black text-white">{cefrLevel}</span>
              <Badge color={CEFR_COLORS[cefrLevel] as any} size="md">
                {cefrLevel === 'C2' ? '🏆 Mastery' : `→ ${getNextCefr(cefrLevel)}`}
              </Badge>
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs text-slate-400">Total XP</p>
            <p className="text-2xl font-bold text-blue-400">{totalXP.toLocaleString()}</p>
          </div>
        </div>
        <ProgressBar
          value={CEFR_PROGRESS[cefrLevel] ?? 0}
          color="from-blue-600 to-cyan-400"
          label="CEFR Progress"
          showPercent
        />
      </Card>

      {/* Today's Queue CTA */}
      <Card className={dueCount > 0 ? 'border-blue-500/40 bg-blue-900/20' : ''}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-slate-300 font-semibold">
              {dueCount > 0 ? `${dueCount} drills due today` : '✅ All caught up!'}
            </p>
            <p className="text-slate-400 text-sm mt-0.5">
              {dueCount > 0 ? 'Keep your streak alive — practice now' : 'Come back tomorrow for new cards'}
            </p>
          </div>
          {dueCount > 0 && (
            <button
              onClick={handleStartDrills}
              className="bg-blue-600 hover:bg-blue-500 active:scale-95 text-white font-bold px-4 py-2 rounded-2xl transition-all shadow-lg shadow-blue-500/20"
            >
              Start →
            </button>
          )}
        </div>
      </Card>

      {/* Weekly XP Chart */}
      <Card>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-slate-200">Weekly XP</h3>
          <Badge color="gold">{weeklyTotal} / {weeklyGoalXP} XP</Badge>
        </div>
        <ProgressBar value={weeklyPercent} color="from-amber-500 to-yellow-400" showPercent />
        <div className="mt-4 h-28">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={weeklyXP} barSize={24}>
              <XAxis dataKey="date" tickFormatter={formatDate} tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis hide />
              <Tooltip
                contentStyle={{ background: '#1e293b', border: 'none', borderRadius: 12, color: '#f1f5f9' }}
                formatter={(v) => [`${v} XP`, 'XP Earned']}
                labelFormatter={(label) => formatDate(String(label))}
              />
              <Bar dataKey="xp" radius={[6, 6, 0, 0]}>
                {weeklyXP.map((entry, i) => (
                  <Cell
                    key={i}
                    fill={entry.xp > 0 ? '#3b82f6' : '#334155'}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 gap-3">
        <Card onClick={() => navigate('/chat')} className="text-center py-5 cursor-pointer hover:border-slate-500/70 transition-colors">
          <div className="text-3xl mb-1">💬</div>
          <p className="text-sm font-semibold text-slate-200">AI Partner</p>
          <p className="text-xs text-slate-400">Free conversation</p>
        </Card>
        <Card onClick={() => navigate('/voice')} className="text-center py-5 cursor-pointer hover:border-slate-500/70 transition-colors">
          <div className="text-3xl mb-1">🎙️</div>
          <p className="text-sm font-semibold text-slate-200">Voice Practice</p>
          <p className="text-xs text-slate-400">Get AI feedback</p>
        </Card>
        <Card onClick={() => navigate('/map')} className="text-center py-5 cursor-pointer hover:border-slate-500/70 transition-colors">
          <div className="text-3xl mb-1">🗺️</div>
          <p className="text-sm font-semibold text-slate-200">Unit Map</p>
          <p className="text-xs text-slate-400">30 units, 3 cycles</p>
        </Card>
        <Card onClick={() => navigate('/settings')} className="text-center py-5 cursor-pointer hover:border-slate-500/70 transition-colors">
          <div className="text-3xl mb-1">⚙️</div>
          <p className="text-sm font-semibold text-slate-200">Settings</p>
          <p className="text-xs text-slate-400">API key & more</p>
        </Card>
      </div>
    </div>
  )
}

function getNextCefr(level: string): string {
  const order = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']
  const i = order.indexOf(level)
  return i < order.length - 1 ? order[i + 1] : 'C2'
}
