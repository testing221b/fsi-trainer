import React from 'react'

// ─── Button ────────────────────────────────────────────────────────
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'success'
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  children,
  className = '',
  disabled,
  ...props
}: ButtonProps) {
  const base = 'inline-flex items-center justify-center font-semibold rounded-2xl transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed select-none'

  const variants = {
    primary: 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-500/20',
    secondary: 'bg-slate-700 hover:bg-slate-600 text-white',
    ghost: 'bg-transparent hover:bg-slate-800 text-slate-300 border border-slate-700',
    danger: 'bg-red-600 hover:bg-red-500 text-white',
    success: 'bg-emerald-600 hover:bg-emerald-500 text-white',
  }

  const sizes = {
    sm: 'text-sm px-3 py-2 gap-1.5',
    md: 'text-base px-5 py-3 gap-2',
    lg: 'text-lg px-6 py-4 gap-2.5',
  }

  return (
    <button
      className={`${base} ${variants[variant]} ${sizes[size]} ${className}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading && (
        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      )}
      {children}
    </button>
  )
}

// ─── Card ──────────────────────────────────────────────────────────
interface CardProps {
  children: React.ReactNode
  className?: string
  onClick?: () => void
}

export function Card({ children, className = '', onClick }: CardProps) {
  return (
    <div
      className={`bg-slate-800/60 backdrop-blur-sm border border-slate-700/50 rounded-3xl p-4 ${onClick ? 'cursor-pointer active:scale-98 transition-transform' : ''} ${className}`}
      onClick={onClick}
    >
      {children}
    </div>
  )
}

// ─── Badge ─────────────────────────────────────────────────────────
interface BadgeProps {
  children: React.ReactNode
  color?: 'blue' | 'gold' | 'green' | 'red' | 'slate' | 'purple'
  size?: 'sm' | 'md'
}

export function Badge({ children, color = 'blue', size = 'sm' }: BadgeProps) {
  const colors = {
    blue: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
    gold: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
    green: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
    red: 'bg-red-500/20 text-red-300 border-red-500/30',
    slate: 'bg-slate-500/20 text-slate-300 border-slate-500/30',
    purple: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
  }
  const sizes = { sm: 'text-xs px-2 py-0.5', md: 'text-sm px-3 py-1' }

  return (
    <span className={`inline-flex items-center rounded-full border font-medium ${colors[color]} ${sizes[size]}`}>
      {children}
    </span>
  )
}

// ─── ProgressBar ───────────────────────────────────────────────────
interface ProgressBarProps {
  value: number   // 0–100
  color?: string  // Tailwind gradient classes
  label?: string
  showPercent?: boolean
}

export function ProgressBar({ value, color = 'from-blue-500 to-blue-400', label, showPercent }: ProgressBarProps) {
  const clamped = Math.min(100, Math.max(0, value))
  return (
    <div className="space-y-1">
      {(label || showPercent) && (
        <div className="flex justify-between text-xs text-slate-400">
          {label && <span>{label}</span>}
          {showPercent && <span>{Math.round(clamped)}%</span>}
        </div>
      )}
      <div className="w-full h-2 bg-slate-700 rounded-full overflow-hidden">
        <div
          className={`h-full bg-gradient-to-r ${color} rounded-full transition-all duration-500`}
          style={{ width: `${clamped}%` }}
        />
      </div>
    </div>
  )
}

// ─── MicButton ─────────────────────────────────────────────────────
interface MicButtonProps {
  isListening: boolean
  isSupported: boolean
  onStart: () => void
  onStop: () => void
  size?: 'md' | 'lg'
}

export function MicButton({ isListening, isSupported, onStart, onStop, size = 'md' }: MicButtonProps) {
  const sizeClass = size === 'lg' ? 'w-20 h-20 text-3xl' : 'w-14 h-14 text-xl'

  if (!isSupported) {
    return (
      <div className="text-center text-slate-500 text-sm">
        🎙️ Voice not supported in this browser
      </div>
    )
  }

  return (
    <button
      onPointerDown={onStart}
      onPointerUp={onStop}
      onPointerLeave={onStop}
      className={`${sizeClass} rounded-full flex items-center justify-center transition-all select-none
        ${isListening
          ? 'bg-red-500 shadow-lg shadow-red-500/40 animate-pulse scale-110'
          : 'bg-slate-700 hover:bg-slate-600 active:scale-95'
        }`}
    >
      🎙️
    </button>
  )
}

// ─── ScoreGauge ────────────────────────────────────────────────────
interface ScoreGaugeProps {
  score: number   // 1–10
  label?: string
}

export function ScoreGauge({ score, label }: ScoreGaugeProps) {
  const color = score >= 8 ? 'text-emerald-400' : score >= 6 ? 'text-amber-400' : 'text-red-400'
  return (
    <div className="text-center">
      <div className={`text-4xl font-bold ${color}`}>{score}<span className="text-lg text-slate-400">/10</span></div>
      {label && <div className="text-xs text-slate-400 mt-1">{label}</div>}
    </div>
  )
}

// ─── LoadingSpinner ────────────────────────────────────────────────
export function LoadingSpinner({ text = 'Loading...' }: { text?: string }) {
  return (
    <div className="flex flex-col items-center gap-3 py-8">
      <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      <p className="text-slate-400 text-sm">{text}</p>
    </div>
  )
}

// ─── EmptyState ────────────────────────────────────────────────────
export function EmptyState({ icon, title, subtitle }: { icon: string; title: string; subtitle: string }) {
  return (
    <div className="flex flex-col items-center gap-3 py-12 text-center px-4">
      <div className="text-5xl">{icon}</div>
      <h3 className="text-lg font-semibold text-slate-200">{title}</h3>
      <p className="text-slate-400 text-sm max-w-xs">{subtitle}</p>
    </div>
  )
}

export { AiThinking } from './AiThinking'
export { NetworkBanner } from './NetworkBanner'
export { HoldToSpeakButton, type HoldToSpeakButtonProps } from './HoldToSpeakButton'
