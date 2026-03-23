import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useDrills } from '../hooks/useDrills'
import { useVoice } from '../hooks/useVoice'
import { evaluateDrill } from '../lib/gemini'
import { getUnit } from '../data/curriculum'
import { Button, Card, Badge, MicButton, ProgressBar, LoadingSpinner, EmptyState } from './ui'

type DrillPhase = 'prompt' | 'recording' | 'reviewing' | 'feedback' | 'rating' | 'complete'

export default function DrillSession() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const unitParam = searchParams.get('unit')

  const {
    currentDrill, currentCard, currentIndex, totalCards,
    isLoading, sessionComplete, sessionXP,
    loadQueue, submitRating,
  } = useDrills()

  const {
    transcript, interimText, isListening, isSupported,
    startListening, stopListening, clearTranscript, speakText,
    error: voiceError,
  } = useVoice()

  const [phase, setPhase] = useState<DrillPhase>('prompt')
  const [aiFeedback, setAiFeedback] = useState('')
  const [isLoadingFeedback, setIsLoadingFeedback] = useState(false)
  const [showAnswer, setShowAnswer] = useState(false)
  const [feedbackError, setFeedbackError] = useState('')

  useEffect(() => {
    const unitId = unitParam ? parseInt(unitParam) : undefined
    loadQueue(unitId)
  }, [])

  // Auto-progress when recording stops with transcript
  const handleStopRecording = useCallback(() => {
    stopListening()
    if (transcript) {
      setPhase('reviewing')
    }
  }, [stopListening, transcript])

  const handleGetFeedback = async () => {
    if (!currentDrill || !currentCard || !transcript) return
    setIsLoadingFeedback(true)
    setPhase('feedback')
    setFeedbackError('')

    try {
      const unit = getUnit(currentCard.unitId)
      const feedback = await evaluateDrill(
        transcript,
        currentDrill.answer,
        currentDrill.prompt,
        unit?.grammarFocus ?? ''
      )
      setAiFeedback(feedback)
    } catch (e: any) {
      if (e.message === 'NO_API_KEY') {
        setFeedbackError('Please add your Gemini API key in Settings to get AI feedback.')
      } else {
        setFeedbackError('Could not get AI feedback. Check your connection and try again.')
      }
    } finally {
      setIsLoadingFeedback(false)
      setPhase('rating')
    }
  }

  const handleRating = async (q: 0 | 1 | 2 | 3) => {
    await submitRating(q)
    // Reset for next card
    setPhase('prompt')
    setAiFeedback('')
    setShowAnswer(false)
    clearTranscript()
  }

  const handleSpeakAnswer = () => {
    if (currentDrill) speakText(currentDrill.answer)
  }

  if (isLoading) return <LoadingSpinner text="Loading drills..." />

  if (sessionComplete || totalCards === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center px-6 gap-6">
        {totalCards === 0 ? (
          <EmptyState
            icon="✅"
            title="All caught up!"
            subtitle="No drills due today. Come back tomorrow or practice a specific unit from the Unit Map."
          />
        ) : (
          <div className="text-center space-y-4">
            <div className="text-6xl">🎉</div>
            <h2 className="text-2xl font-bold text-white">Session Complete!</h2>
            <p className="text-slate-400">You earned <span className="text-amber-400 font-bold">{sessionXP} XP</span> this session.</p>
          </div>
        )}
        <div className="flex gap-3">
          <Button variant="secondary" onClick={() => navigate('/map')}>Unit Map</Button>
          <Button onClick={() => navigate('/')}>Home</Button>
        </div>
      </div>
    )
  }

  if (!currentDrill || !currentCard) return <LoadingSpinner />

  const unit = getUnit(currentCard.unitId)
  const progress = totalCards > 0 ? ((currentIndex) / totalCards) * 100 : 0

  return (
    <div className="flex-1 flex flex-col px-4 pt-4 pb-6 gap-4">

      {/* Header */}
      <div className="flex items-center justify-between">
        <button onClick={() => navigate('/')} className="text-slate-400 hover:text-white p-1">← Back</button>
        <div className="text-center flex-1">
          <p className="text-xs text-slate-400">Unit {currentCard.unitId} · {unit?.title}</p>
          <Badge color="blue" size="sm">{currentIndex + 1} / {totalCards}</Badge>
        </div>
        <div className="w-10" />
      </div>

      <ProgressBar value={progress} color="from-blue-500 to-cyan-400" />

      {/* Grammar Focus */}
      <div className="text-center">
        <Badge color="purple" size="md">{unit?.grammarFocus}</Badge>
        <p className="text-xs text-slate-500 mt-1">{currentDrill.scene}</p>
      </div>

      {/* Prompt Card */}
      <Card className="text-center py-6 flex-1 flex flex-col items-center justify-center gap-4">
        <div className="space-y-2">
          <p className="text-xs text-slate-400 uppercase tracking-wider">Your task</p>
          <p className="text-lg font-semibold text-white leading-relaxed px-2">
            {currentDrill.prompt}
          </p>
        </div>

        {/* Voice Error */}
        {voiceError && (
          <p className="text-red-400 text-sm">{voiceError}</p>
        )}

        {/* Transcript Display */}
        {(transcript || interimText) && (
          <div className="w-full bg-slate-900/60 rounded-2xl p-3 text-left">
            <p className="text-xs text-slate-400 mb-1">You said:</p>
            <p className="text-white">
              {transcript}
              {interimText && <span className="text-slate-400"> {interimText}</span>}
            </p>
          </div>
        )}

        {/* Model Answer */}
        {showAnswer && (
          <div className="w-full bg-blue-900/30 border border-blue-500/30 rounded-2xl p-3 text-left">
            <p className="text-xs text-blue-400 mb-1">Model answer:</p>
            <p className="text-blue-200 font-medium">{currentDrill.answer}</p>
            <button
              onClick={handleSpeakAnswer}
              className="mt-2 text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1"
            >
              🔊 Listen
            </button>
          </div>
        )}

        {/* AI Feedback */}
        {aiFeedback && !isLoadingFeedback && (
          <div className="w-full bg-emerald-900/20 border border-emerald-500/30 rounded-2xl p-3 text-left">
            <p className="text-xs text-emerald-400 mb-1">AI Coach Feedback:</p>
            <p className="text-slate-200 text-sm leading-relaxed whitespace-pre-wrap">{aiFeedback}</p>
          </div>
        )}

        {feedbackError && (
          <p className="text-amber-400 text-sm text-center">{feedbackError}</p>
        )}

        {isLoadingFeedback && <LoadingSpinner text="Getting AI feedback..." />}
      </Card>

      {/* Controls */}
      <div className="space-y-3">

        {phase === 'prompt' && (
          <div className="flex flex-col items-center gap-3">
            <p className="text-slate-400 text-sm">Hold mic to speak your answer</p>
            <div className="flex items-center gap-6">
              <MicButton
                isListening={isListening}
                isSupported={isSupported}
                onStart={() => { clearTranscript(); startListening() }}
                onStop={handleStopRecording}
                size="lg"
              />
              <button
                onClick={() => { setShowAnswer(true) }}
                className="text-slate-400 hover:text-white text-sm"
              >
                Show answer
              </button>
            </div>
          </div>
        )}

        {phase === 'reviewing' && transcript && (
          <div className="flex gap-3">
            <Button variant="secondary" className="flex-1" onClick={() => { clearTranscript(); setPhase('prompt') }}>
              Retry
            </Button>
            <Button className="flex-1" onClick={handleGetFeedback}>
              Get Feedback
            </Button>
            <Button variant="secondary" size="sm" onClick={() => { setShowAnswer(true); setPhase('rating') }}>
              Skip
            </Button>
          </div>
        )}

        {(phase === 'rating' || (phase === 'reviewing' && !transcript)) && (
          <div className="space-y-2">
            <p className="text-center text-sm text-slate-400">How well did you know this?</p>
            <div className="grid grid-cols-4 gap-2">
              {(['Again', 'Hard', 'Good', 'Easy'] as const).map((label, i) => (
                <button
                  key={label}
                  onClick={() => handleRating(i as 0|1|2|3)}
                  className={`py-3 rounded-2xl text-sm font-semibold transition-all active:scale-95 ${
                    i === 0 ? 'bg-red-600/80 text-white' :
                    i === 1 ? 'bg-amber-600/80 text-white' :
                    i === 2 ? 'bg-blue-600/80 text-white' :
                    'bg-emerald-600/80 text-white'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="flex gap-3 mt-1">
              {!showAnswer && (
                <Button variant="ghost" size="sm" className="flex-1" onClick={() => setShowAnswer(true)}>
                  Show Answer
                </Button>
              )}
              <Button variant="ghost" size="sm" className="flex-1" onClick={handleSpeakAnswer}>
                🔊 Listen
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
