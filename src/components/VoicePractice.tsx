import { useState } from 'react'
import { giveSpeakingFeedback, type SpeakingFeedback } from '../lib/gemini'
import { useAppStore } from '../store/appStore'
import { CURRICULUM } from '../data/curriculum'
import { Button, Card, Badge, ProgressBar, ScoreGauge, AiThinking, HoldToSpeakButton } from './ui'

type PracticePhase = 'select' | 'record' | 'feedback'

export default function VoicePractice() {
  const { geminiApiKey } = useAppStore()
  const [phase, setPhase] = useState<PracticePhase>('select')
  const [selectedUnitId, setSelectedUnitId] = useState<number>(1)
  const [feedback, setFeedback] = useState<SpeakingFeedback | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  const [transcript, setTranscript] = useState('')
  const [isRecording, setIsRecording] = useState(false)

  const speakText = (text: string) => {
    const utt = new SpeechSynthesisUtterance(text)
    speechSynthesis.speak(utt)
  }

  const selectedUnit = CURRICULUM.find(u => u.id === selectedUnitId)

  const handleGetFeedback = async () => {
    if (!transcript || !selectedUnit) return
    setIsLoading(true)
    setError('')

    try {
      const result = await giveSpeakingFeedback(transcript, selectedUnit.title, selectedUnit.grammarFocus)
      setFeedback(result)
      setPhase('feedback')
    } catch (e: any) {
      if (e.message === 'NO_API_KEY') {
        setError('Add your Gemini API key in Settings to get AI feedback.')
      } else if (e.message === 'OFFLINE') {
        setError("You're offline — connect to the internet to get AI feedback.")
      } else if (e.message === 'TIMEOUT') {
        setError('Request timed out — check your connection and try again.')
      } else {
        setError('Could not get feedback. Check your internet connection.')
      }
    } finally {
      setIsLoading(false)
    }
  }

  const handleReset = () => {
    setPhase('select')
    setFeedback(null)
    setError('')
    setTranscript('')
  }

  const ScoreRow = ({ label, score, comment }: { label: string; score: number; comment: string }) => {
    const color = score >= 8 ? 'from-emerald-500 to-emerald-400'
      : score >= 6 ? 'from-amber-500 to-amber-400'
      : 'from-red-500 to-red-400'
    return (
      <div className="space-y-1">
        <div className="flex justify-between items-center text-sm">
          <span className="text-slate-300 font-medium">{label}</span>
          <span className={`font-bold ${score >= 8 ? 'text-emerald-400' : score >= 6 ? 'text-amber-400' : 'text-red-400'}`}>
            {score}/10
          </span>
        </div>
        <ProgressBar value={score * 10} color={color} />
        <p className="text-xs text-slate-400">{comment}</p>
      </div>
    )
  }

  // ── FEEDBACK PHASE ──────────────────────────────────────────────
  if (phase === 'feedback' && feedback) {
    return (
      <div className="flex-1 scrollable px-4 pt-4 pb-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-white">Speaking Feedback</h2>
          <Badge color="blue">{selectedUnit?.title}</Badge>
        </div>

        {/* Overall Score */}
        <Card className="text-center py-6">
          <ScoreGauge score={feedback.overallScore} label="Overall Score" />
          <p className="text-slate-300 text-sm mt-3 italic">{feedback.encouragement}</p>
        </Card>

        {/* Dimension Scores */}
        <Card className="space-y-4">
          <ScoreRow label="Accuracy" score={feedback.accuracy.score} comment={feedback.accuracy.comment} />
          <ScoreRow label="Fluency" score={feedback.fluency.score} comment={feedback.fluency.comment} />
          <ScoreRow label="Vocabulary" score={feedback.vocabulary.score} comment={feedback.vocabulary.comment} />
          <ScoreRow label="Coherence" score={feedback.coherence.score} comment={feedback.coherence.comment} />
        </Card>

        {/* Your Transcript */}
        <Card>
          <p className="text-xs text-slate-400 mb-2">You said:</p>
          <p className="text-slate-200 text-sm leading-relaxed">{transcript}</p>
        </Card>

        {/* Top Correction */}
        <Card className="border-amber-500/30 bg-amber-900/10">
          <p className="text-xs text-amber-400 mb-2">Top correction:</p>
          <p className="text-amber-200 text-sm font-medium">{feedback.topCorrection}</p>
        </Card>

        {/* Native Speaker Version */}
        <Card className="border-blue-500/30 bg-blue-900/10">
          <p className="text-xs text-blue-400 mb-2">How a native C2 speaker would say it:</p>
          <p className="text-blue-200 text-sm font-medium">{feedback.nativeSpeakerVersion}</p>
          <button
            onClick={() => speakText(feedback.nativeSpeakerVersion)}
            className="mt-2 text-xs text-blue-400 hover:text-blue-300"
          >
            🔊 Listen to model
          </button>
        </Card>

        <div className="flex gap-3">
          <Button variant="secondary" className="flex-1" onClick={handleReset}>
            New Practice
          </Button>
          <Button className="flex-1" onClick={() => { setTranscript(''); setPhase('record') }}>
            Try Again
          </Button>
        </div>
      </div>
    )
  }

  // ── SELECT UNIT PHASE ─────────────────────────────────────────
  if (phase === 'select') {
    return (
      <div className="flex-1 scrollable px-4 pt-4 pb-6 space-y-4">
        <div>
          <h2 className="text-xl font-bold text-white">Voice Practice</h2>
          <p className="text-slate-400 text-sm">Speak freely — get C2-level AI coaching</p>
        </div>

        {!geminiApiKey && (
          <div className="bg-amber-900/20 border border-amber-500/30 rounded-2xl p-3 text-sm text-amber-300">
            ⚠️ Add your Gemini API key in Settings to unlock AI feedback.
          </div>
        )}

        <div className="space-y-2">
          <p className="text-sm text-slate-400 font-medium">Select grammar focus:</p>
          {CURRICULUM.map(unit => (
            <button
              key={unit.id}
              onClick={() => {
                setSelectedUnitId(unit.id)
                setPhase('record')
                setTranscript('')
              }}
              className={`w-full text-left p-3 rounded-2xl border transition-all ${
                selectedUnitId === unit.id
                  ? 'bg-blue-900/40 border-blue-500/50 text-white'
                  : 'bg-slate-800/40 border-slate-700/40 text-slate-300 hover:border-slate-500/60'
              }`}
            >
              <div className="flex items-center gap-3">
                <span className={`text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center ${
                  unit.cycle === 1 ? 'bg-red-500/20 text-red-400' :
                  unit.cycle === 2 ? 'bg-blue-500/20 text-blue-400' :
                  'bg-gold-500/20 text-amber-400'
                }`}>{unit.id}</span>
                <div>
                  <p className="font-medium text-sm">{unit.title}</p>
                  <p className="text-slate-500 text-xs">{unit.grammarFocus}</p>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
    )
  }

  // ── RECORD PHASE ──────────────────────────────────────────────
  return (
    <div className="flex-1 flex flex-col px-4 pt-4 pb-6 gap-4">

      <div className="flex items-center gap-2">
        <button onClick={() => setPhase('select')} className="text-slate-400">← Back</button>
        <Badge color="blue">{selectedUnit?.title}</Badge>
      </div>

      <Card className="flex-1 flex flex-col items-center justify-center gap-4 py-8">
        <div className="text-center space-y-1">
          <p className="text-slate-400 text-sm">Grammar focus</p>
          <p className="font-semibold text-white">{selectedUnit?.grammarFocus}</p>
        </div>

        {/* Suggested prompt */}
        <div className="bg-slate-900/60 rounded-2xl p-3 text-sm text-slate-300 text-center">
          <p className="text-xs text-slate-500 mb-1">Try talking about:</p>
          <p className="italic">"{selectedUnit?.drills[Math.floor(Math.random() * 5)].prompt}"</p>
        </div>

        {/* Transcript live display */}
        {transcript && (
          <div className="w-full bg-slate-900/60 rounded-2xl p-3">
            <p className="text-xs text-slate-400 mb-1">Your speech:</p>
            <p className="text-white text-sm leading-relaxed">{transcript}</p>
          </div>
        )}

        <HoldToSpeakButton
          size="lg"
          onStart={() => { setTranscript(''); setIsRecording(true) }}
          onResult={(t) => setTranscript(prev => prev ? prev + ' ' + t : t)}
          onStop={() => setIsRecording(false)}
        />

        <p className="text-slate-500 text-sm">
          {isRecording ? '🔴 Recording... release to stop' : 'Hold to record your speech'}
        </p>
      </Card>

      {error && <p className="text-amber-400 text-sm text-center">{error}</p>}

      {isLoading && <AiThinking variant="wave" label="Analyzing your speech..." />}

      {transcript && !isLoading && (
        <div className="flex gap-3">
          <Button variant="secondary" className="flex-1" onClick={() => setTranscript('')}>Clear</Button>
          <Button className="flex-1" onClick={handleGetFeedback}>Get Feedback</Button>
        </div>
      )}
    </div>
  )
}
