import { useState, useRef, useEffect } from 'react'
import { conversationTurn, type ChatMessage } from '../lib/gemini'
import { useAppStore } from '../store/appStore'
import { db } from '../lib/db'
import { Button, Card, Badge, AiThinking, HoldToSpeakButton } from './ui'

interface Message {
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

const SCENARIOS = [
  { id: 'job_interview', label: '💼 Job Interview', description: 'Practice for professional interviews' },
  { id: 'business_meeting', label: '📊 Business Meeting', description: 'Workplace discussions and presentations' },
  { id: 'campus_life', label: '🎓 Campus Life', description: 'Academic conversations and study groups' },
  { id: 'social_networking', label: '🤝 Networking', description: 'Professional social events and small talk' },
  { id: 'diplomatic_briefing', label: '🌐 Diplomatic Briefing', description: 'Formal diplomatic communication' },
]

export default function ConversationPartner() {
  const { feedbackMode, toggleFeedbackMode, geminiApiKey } = useAppStore()
  const [selectedScenario, setSelectedScenario] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [inputText, setInputText] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [history, setHistory] = useState<ChatMessage[]>([])
  const [error, setError] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const speakText = (text: string) => {
    const utt = new SpeechSynthesisUtterance(text)
    speechSynthesis.speak(utt)
  }

  // Auto-scroll to bottom
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isLoading])

  const handleSelectScenario = (scenarioId: string) => {
    setSelectedScenario(scenarioId)
    setMessages([])
    setHistory([])
    setInputText('')

    // Add welcome message
    const scenario = SCENARIOS.find(s => s.id === scenarioId)
    setMessages([{
      role: 'assistant',
      content: `Hello! I'm your English conversation partner for this ${scenario?.label} session. ${
        feedbackMode
          ? 'I\'ll speak naturally and add brief coaching notes to help you reach C2 level.'
          : 'Let\'s have a natural conversation. Feel free to speak freely!'
      } How can I help you today?`,
      timestamp: new Date(),
    }])
  }

  const sendMessage = async (text: string) => {
    if (!text.trim() || !selectedScenario || isLoading) return

    const userMsg: Message = { role: 'user', content: text.trim(), timestamp: new Date() }
    setMessages(prev => [...prev, userMsg])
    setInputText('')
    setIsLoading(true)
    setError('')

    const newHistory: ChatMessage[] = [
      ...history,
      { role: 'user', text: text.trim() },
    ]

    try {
      const scenario = SCENARIOS.find(s => s.id === selectedScenario)
      const reply = await conversationTurn(history, text.trim(), scenario?.label ?? selectedScenario, feedbackMode)

      const assistantMsg: Message = { role: 'assistant', content: reply, timestamp: new Date() }
      setMessages(prev => [...prev, assistantMsg])
      setHistory([
        ...newHistory,
        { role: 'model', text: reply },
      ])

      // Auto-speak reply (local speakText is synchronous, no await needed)
      speakText(reply)
    } catch (e: any) {
      if (e.message === 'NO_API_KEY') {
        setError('Add your Gemini API key in Settings to use AI conversation.')
      } else if (e.message === 'OFFLINE') {
        setError("You're offline — connect to the internet to chat with AI.")
      } else if (e.message === 'TIMEOUT') {
        setError('Request timed out — check your connection and try again.')
      } else {
        setError('Connection error. Check your internet and try again.')
      }
    } finally {
      setIsLoading(false)
    }
  }

  const handleEndConversation = async () => {
    if (messages.length < 2) {
      setSelectedScenario(null)
      return
    }
    await db.conversations.add({
      date: new Date().toISOString().slice(0, 10),
      scenario: selectedScenario ?? '',
      messages: messages.map(m => ({ role: m.role, content: m.content })),
      durationMinutes: Math.round(
        (messages[messages.length - 1].timestamp.getTime() - messages[0].timestamp.getTime()) / 60000
      ),
    })
    setSelectedScenario(null)
    setMessages([])
    setHistory([])
  }

  // Scenario Selection Screen
  if (!selectedScenario) {
    return (
      <div className="flex-1 scrollable px-4 pt-4 pb-6 space-y-4">
        <div>
          <h2 className="text-xl font-bold text-white">AI Conversation Partner</h2>
          <p className="text-slate-400 text-sm mt-1">Choose a scenario to practice</p>
        </div>

        {!geminiApiKey && (
          <div className="bg-amber-900/20 border border-amber-500/30 rounded-2xl p-3 text-sm text-amber-300">
            ⚠️ Add your Gemini API key in Settings to enable AI responses.
          </div>
        )}

        <div className="space-y-3">
          {SCENARIOS.map(s => (
            <Card
              key={s.id}
              onClick={() => handleSelectScenario(s.id)}
              className="cursor-pointer hover:border-blue-500/50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <span className="text-2xl">{s.label.split(' ')[0]}</span>
                <div>
                  <p className="font-semibold text-white">{s.label.slice(2)}</p>
                  <p className="text-slate-400 text-sm">{s.description}</p>
                </div>
              </div>
            </Card>
          ))}
        </div>

        <Card>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-semibold text-slate-200">Coach Feedback Mode</p>
              <p className="text-slate-400 text-xs">AI corrects your language after each turn</p>
            </div>
            <button
              onClick={toggleFeedbackMode}
              className={`relative w-12 h-6 rounded-full transition-colors ${feedbackMode ? 'bg-blue-600' : 'bg-slate-600'}`}
            >
              <span className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${feedbackMode ? 'left-7' : 'left-1'}`} />
            </button>
          </div>
        </Card>
      </div>
    )
  }

  const scenario = SCENARIOS.find(s => s.id === selectedScenario)

  // Conversation Screen
  return (
    <div className="flex-1 flex flex-col">

      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-700/50 flex items-center justify-between">
        <div>
          <p className="font-semibold text-white">{scenario?.label}</p>
          <div className="flex gap-1.5 mt-0.5">
            <Badge color="blue" size="sm">AI Partner</Badge>
            {feedbackMode && <Badge color="gold" size="sm">Coach Mode</Badge>}
          </div>
        </div>
        <button onClick={handleEndConversation} className="text-slate-400 hover:text-red-400 text-sm">
          End
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 scrollable px-4 py-3 space-y-3">
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[85%] rounded-3xl px-4 py-3 ${
                msg.role === 'user'
                  ? 'bg-blue-600 text-white rounded-tr-sm'
                  : 'bg-slate-700/80 text-slate-100 rounded-tl-sm'
              }`}
            >
              <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
              {msg.role === 'assistant' && (
                <button
                  onClick={() => speakText(msg.content)}
                  className="text-xs text-slate-400 hover:text-white mt-1"
                >
                  🔊
                </button>
              )}
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex justify-start px-2">
            <AiThinking variant="wave" label="Coach is thinking..." />
          </div>
        )}

        {error && (
          <div className="text-center text-amber-400 text-sm py-2">{error}</div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input Area */}
      <div className="px-4 py-3 border-t border-slate-700/50 space-y-2">
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={inputText}
            onChange={e => setInputText(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                sendMessage(inputText)
              }
            }}
            placeholder="Type or hold mic to speak..."
            rows={1}
            className="flex-1 bg-slate-700/50 border border-slate-600/50 rounded-2xl px-4 py-3 text-white placeholder-slate-500 text-sm resize-none focus:outline-none focus:border-blue-500/50 transition-colors"
            style={{ minHeight: 48, maxHeight: 120 }}
          />

          <HoldToSpeakButton
            size="md"
            onResult={(t) => setInputText(t)}
            disabled={isLoading}
          />

          <button
            onClick={() => sendMessage(inputText)}
            disabled={!inputText.trim() || isLoading}
            className="w-12 h-12 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 rounded-2xl flex items-center justify-center text-white transition-all active:scale-95"
          >
            →
          </button>
        </div>
      </div>
    </div>
  )
}
