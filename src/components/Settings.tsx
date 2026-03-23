import { useState } from 'react'
import { useAppStore, type Accent, type VoiceSpeed } from '../store/appStore'
import { testApiKey, getAvailableModelNames } from '../lib/gemini'
import { loadVoices, setVoice } from '../lib/speech'
import { db } from '../lib/db'
import { Button, Card, Badge } from './ui'

export default function Settings() {
  const {
    geminiApiKey, setApiKey,
    accent, setAccent,
    voiceSpeed, setVoiceSpeed,
    dailyGoalMinutes, setDailyGoal,
  } = useAppStore()

  const [keyInput, setKeyInput] = useState(geminiApiKey)
  const [keyStatus, setKeyStatus] = useState<'idle' | 'testing' | 'ok' | 'fail'>('idle')
  const [keyError, setKeyError] = useState('')
  const [showKey, setShowKey] = useState(false)
  const [resetConfirm, setResetConfirm] = useState(false)
  const [voices, setVoices] = useState(loadVoices)
  const [netStatus, setNetStatus] = useState<'idle' | 'checking' | 'ok' | 'fail'>('idle')
  const [availableModels, setAvailableModels] = useState<string[]>([])

  const handleTestKey = async () => {
    if (!keyInput.trim()) return
    setKeyStatus('testing')
    setKeyError('')
    const result = await testApiKey(keyInput.trim())
    setKeyStatus(result.ok ? 'ok' : 'fail')
    if (result.ok) {
      setApiKey(keyInput.trim())
    } else {
      setKeyError(result.error)
    }
  }

  const handleNetworkTest = async () => {
    setNetStatus('checking')
    try {
      const res = await fetch(
        'https://generativelanguage.googleapis.com/v1beta/models?key=test',
        { method: 'GET' }
      )
      setNetStatus('ok')
    } catch (e: any) {
      console.error('Network test failed:', e)
      setNetStatus('fail')
    }
  }

  const handleScanModels = async () => {
    if (!keyInput.trim()) return
    setAvailableModels(['scanning...'])
    const models = await getAvailableModelNames(keyInput.trim())
    setAvailableModels(models.length > 0 ? models : ['No models found for this key'])
  }

  const handleResetProgress = async () => {
    await Promise.all([
      db.cards.clear(),
      db.sessions.clear(),
      db.conversations.clear(),
      db.progress.clear(),
    ])
    setResetConfirm(false)
    window.location.reload()
  }

  const ACCENTS: { value: Accent; label: string; flag: string }[] = [
    { value: 'en-US', label: 'American English', flag: '🇺🇸' },
    { value: 'en-GB', label: 'British English', flag: '🇬🇧' },
    { value: 'en-AU', label: 'Australian English', flag: '🇦🇺' },
  ]

  const SPEEDS: { value: VoiceSpeed; label: string }[] = [
    { value: 0.8, label: '0.8× Slow' },
    { value: 1.0, label: '1.0× Normal' },
    { value: 1.2, label: '1.2× Fast' },
  ]

  const GOALS = [10, 20, 30, 45, 60]

  return (
    <div className="flex-1 scrollable px-4 pt-4 pb-6 space-y-4">
      <div>
        <h2 className="text-xl font-bold text-white">Settings</h2>
        <p className="text-slate-400 text-sm">Configure your learning environment</p>
      </div>

      {/* Gemini API Key */}
      <Card className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-white">Gemini API Key</h3>
          {geminiApiKey && <Badge color="green" size="sm">✓ Connected</Badge>}
        </div>

        <p className="text-slate-400 text-xs">
          Get your free key at{' '}
          <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" className="text-blue-400 underline">
            aistudio.google.com
          </a>
          {' '}(15 req/min, 1M tokens/day — free)
        </p>

        {/* Step 1: Network connectivity test */}
        <div className="bg-slate-900/60 rounded-xl p-3 space-y-2">
          <p className="text-xs text-slate-400 font-semibold">Step 1 — Check network connectivity first:</p>
          <button
            onClick={handleNetworkTest}
            disabled={netStatus === 'checking'}
            className="w-full py-2 rounded-xl text-sm font-medium bg-slate-700 hover:bg-slate-600 text-white disabled:opacity-50 transition-all"
          >
            {netStatus === 'checking' ? '⏳ Testing connection...' :
             netStatus === 'ok' ? '✅ Network OK — Google API is reachable' :
             netStatus === 'fail' ? '❌ BLOCKED — Cannot reach googleapis.com' :
             '🌐 Test Network Connection'}
          </button>
          {netStatus === 'fail' && (
            <p className="text-red-300 text-xs">
              Your network is blocking Google AI APIs. Try:<br/>
              • Turn off VPN / proxy<br/>
              • Switch to mobile data (4G/5G hotspot)<br/>
              • Check Windows Firewall settings
            </p>
          )}
          {netStatus === 'ok' && (
            <p className="text-emerald-300 text-xs">Network is fine — proceed to Step 2 below.</p>
          )}
        </div>

        <div className="flex gap-2">
          <input
            type={showKey ? 'text' : 'password'}
            value={keyInput}
            onChange={e => { setKeyInput(e.target.value); setKeyStatus('idle') }}
            placeholder="AIza..."
            className="flex-1 bg-slate-700/50 border border-slate-600/50 rounded-xl px-3 py-2 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-blue-500/50"
          />
          <button
            onClick={() => setShowKey(s => !s)}
            className="text-slate-400 hover:text-white px-2"
          >
            {showKey ? '🙈' : '👁️'}
          </button>
        </div>

        <div className="flex gap-2">
          <Button
            onClick={handleTestKey}
            loading={keyStatus === 'testing'}
            disabled={!keyInput.trim()}
            size="sm"
            variant={keyStatus === 'ok' ? 'success' : keyStatus === 'fail' ? 'danger' : 'primary'}
            className="flex-1"
          >
            {keyStatus === 'testing' ? '⏳ Auto-detecting model...' :
             keyStatus === 'ok' ? '✓ Connected!' :
             keyStatus === 'fail' ? '✗ Failed' :
             'Test & Save'}
          </Button>
          <button
            onClick={handleScanModels}
            disabled={!keyInput.trim()}
            className="px-3 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs rounded-xl disabled:opacity-40 transition-all shrink-0"
          >
            🔍 Scan Models
          </button>
        </div>

        {/* Available models list */}
        {availableModels.length > 0 && (
          <div className="bg-slate-900/60 rounded-xl p-3 space-y-1">
            <p className="text-xs text-slate-400 font-semibold">Models available for your key:</p>
            {availableModels.map((m, i) => (
              <p key={i} className={`text-xs font-mono ${m === 'scanning...' ? 'text-slate-400 animate-pulse' : m.startsWith('No models') ? 'text-red-400' : 'text-emerald-300'}`}>
                {m === 'scanning...' ? '⏳ scanning...' : m.startsWith('No models') ? '❌ ' + m : '✅ ' + m}
              </p>
            ))}
            <p className="text-xs text-slate-500 mt-2">Copy any model name above and report it if "Test & Save" still fails.</p>
          </div>
        )}

        {/* Real error message */}
        {keyError && (
          <div className="bg-red-900/20 border border-red-500/30 rounded-xl p-3 text-xs text-red-300 space-y-1">
            <p className="font-semibold">Error details:</p>
            <p className="font-mono break-all">{keyError}</p>
            <p className="text-red-400 mt-2">💡 Tips:</p>
            <ul className="list-disc list-inside space-y-0.5 text-red-300">
              <li>Make sure you copied the <strong>full key</strong> (starts with AIza...)</li>
              <li>Key must be from <strong>Google AI Studio</strong>, not Google Cloud Console</li>
              <li>Check your internet connection</li>
              <li>Try opening Chrome DevTools → Console for more details</li>
            </ul>
          </div>
        )}
      </Card>

      {/* Accent */}
      <Card className="space-y-3">
        <h3 className="font-semibold text-white">Target Accent</h3>
        <div className="space-y-2">
          {ACCENTS.map(a => (
            <button
              key={a.value}
              onClick={() => setAccent(a.value)}
              className={`w-full flex items-center gap-3 p-3 rounded-2xl border transition-all ${
                accent === a.value
                  ? 'bg-blue-900/40 border-blue-500/50 text-white'
                  : 'bg-slate-700/30 border-slate-600/30 text-slate-300'
              }`}
            >
              <span className="text-xl">{a.flag}</span>
              <span className="font-medium text-sm">{a.label}</span>
              {accent === a.value && <span className="ml-auto text-blue-400 text-xs">✓ Active</span>}
            </button>
          ))}
        </div>
      </Card>

      {/* Voice Speed */}
      <Card className="space-y-3">
        <h3 className="font-semibold text-white">Playback Speed</h3>
        <div className="flex gap-2">
          {SPEEDS.map(s => (
            <button
              key={s.value}
              onClick={() => setVoiceSpeed(s.value)}
              className={`flex-1 py-2 rounded-2xl text-sm font-medium transition-all ${
                voiceSpeed === s.value
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-700/50 text-slate-400 hover:bg-slate-700'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </Card>

      {/* Daily Goal */}
      <Card className="space-y-3">
        <h3 className="font-semibold text-white">Daily Goal</h3>
        <div className="flex gap-2 flex-wrap">
          {GOALS.map(g => (
            <button
              key={g}
              onClick={() => setDailyGoal(g)}
              className={`px-4 py-2 rounded-2xl text-sm font-medium transition-all ${
                dailyGoalMinutes === g
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-700/50 text-slate-400 hover:bg-slate-700'
              }`}
            >
              {g} min
            </button>
          ))}
        </div>
      </Card>

      {/* Voice Selection */}
      {voices.length > 0 && (
        <Card className="space-y-3">
          <h3 className="font-semibold text-white">TTS Voice</h3>
          <select
            onChange={e => setVoice(e.target.value)}
            className="w-full bg-slate-700/50 border border-slate-600/50 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500/50"
          >
            <option value="">System default</option>
            {voices.filter(v => v.lang.startsWith(accent.slice(0, 2))).map(v => (
              <option key={v.name} value={v.name}>{v.name}</option>
            ))}
          </select>
        </Card>
      )}

      {/* About */}
      <Card className="space-y-1">
        <h3 className="font-semibold text-white">About FSI Trainer</h3>
        <p className="text-slate-400 text-xs">Version 1.0.0</p>
        <p className="text-slate-400 text-xs">300 drills · 30 units · 3 cycles</p>
        <p className="text-slate-400 text-xs">Powered by Gemini 1.5 Flash · SM-2 spaced repetition</p>
        <p className="text-slate-400 text-xs">Target: CEFR C2 mastery</p>
      </Card>

      {/* Reset Progress */}
      <Card className="border-red-900/40">
        <h3 className="font-semibold text-red-400 mb-2">Danger Zone</h3>
        {!resetConfirm ? (
          <Button variant="danger" size="sm" onClick={() => setResetConfirm(true)} className="w-full">
            Reset All Progress
          </Button>
        ) : (
          <div className="space-y-2">
            <p className="text-red-300 text-sm">This will delete all XP, streaks, and drill progress. Are you sure?</p>
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" className="flex-1" onClick={() => setResetConfirm(false)}>
                Cancel
              </Button>
              <Button variant="danger" size="sm" className="flex-1" onClick={handleResetProgress}>
                Yes, Reset
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  )
}
