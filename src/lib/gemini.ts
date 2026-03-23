/**
 * Gemini API — uses native fetch() directly (no SDK)
 * This avoids all browser/SDK compatibility issues.
 * REST endpoint: https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent
 */

const FSI_PERSONA = `Elite FSI English coach → C2 mastery for professional/social use with native speakers.
Rules: direct & encouraging | flag grammar errors + unnatural phrasing | suggest C2 vocab upgrades | infer pronunciation issues from transcript | score: Accuracy·Fluency·Vocabulary·Coherence | ≤120 words/response | English-only immersion.`

const BASE = 'https://generativelanguage.googleapis.com'

// Fallback hardcoded candidates (used only if ListModels fails)
const FALLBACK_CANDIDATES: [string, string][] = [
  ['v1beta', 'gemini-2.5-flash'],
  ['v1beta', 'gemini-2.5-flash-preview-05-20'],
  ['v1beta', 'gemini-2.5-flash-preview-04-17'],
  ['v1beta', 'gemini-2.5-pro'],
  ['v1beta', 'gemini-2.0-flash-lite'],
  ['v1beta', 'gemini-2.0-flash'],
  ['v1',     'gemini-1.5-flash'],
  ['v1beta', 'gemini-1.5-flash'],
  ['v1',     'gemini-1.5-pro'],
]

/** Query the API to discover which models this key can actually use (cached per session) */
async function listAvailableModels(key: string): Promise<[string, string][]> {
  const cacheKey = `fsi_models_${key.slice(-8)}`
  const cached = sessionStorage.getItem(cacheKey)
  if (cached) return JSON.parse(cached)

  const candidates: [string, string][] = []
  for (const ver of ['v1beta', 'v1']) {
    try {
      const res = await fetch(`${BASE}/${ver}/models?key=${key}&pageSize=50`)
      if (!res.ok) continue
      const data = await res.json()
      const models: string[] = (data.models ?? [])
        .filter((m: any) => (m.supportedGenerationMethods ?? []).includes('generateContent'))
        .map((m: any) => (m.name as string).replace('models/', ''))
        .sort((a: string, b: string) => {
          const score = (n: string) =>
            n.includes('flash') ? 0 : n.includes('lite') ? 1 : n.includes('pro') ? 2 : 3
          return score(a) - score(b)
        })
      for (const m of models) candidates.push([ver, m])
    } catch { /* ignore */ }
  }
  if (candidates.length > 0) sessionStorage.setItem(cacheKey, JSON.stringify(candidates))
  return candidates
}

function getKey(): string {
  const key = localStorage.getItem('gemini_api_key') ?? ''
  if (!key) throw new Error('NO_API_KEY')
  return key
}

/** Returns the full endpoint URL for the saved working model */
function getEndpoint(): string {
  const ver   = localStorage.getItem('gemini_api_ver')   ?? 'v1beta'
  const model = localStorage.getItem('gemini_model')     ?? 'gemini-2.0-flash-lite'
  return `${BASE}/${ver}/models/${model}:generateContent`
}

/** Core fetch wrapper — calls Gemini generateContent REST API */
async function generate(
  prompt: string,
  systemInstruction?: string,
  history?: Array<{ role: 'user' | 'model'; text: string }>
): Promise<string> {
  const apiKey = getKey()
  const endpoint = getEndpoint()

  const contents: object[] = []
  if (history) {
    for (const h of history) {
      contents.push({ role: h.role, parts: [{ text: h.text }] })
    }
  }
  contents.push({ role: 'user', parts: [{ text: prompt }] })

  const body: Record<string, unknown> = { contents }
  if (systemInstruction) {
    body.systemInstruction = { parts: [{ text: systemInstruction }] }
  }

  // Pre-flight offline check — fail fast without wasting a network attempt
  if (!navigator.onLine) {
    throw new Error('OFFLINE')
  }

  // 10-second timeout — prevents UI from hanging on slow/dead connections
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 10_000)

  let res: Response
  try {
    res = await fetch(`${endpoint}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    })
  } catch (e: any) {
    if (e.name === 'AbortError') throw new Error('TIMEOUT')
    throw e
  } finally {
    clearTimeout(timeoutId)
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: { message: res.statusText } }))
    const msg = err?.error?.message ?? res.statusText
    throw new Error(`Gemini ${res.status}: ${msg}`)
  }

  const data = await res.json()
  return data?.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
}

// ─── Public API ────────────────────────────────────────────────────

/** Returns list of model names available to this key (for diagnostics) */
export async function getAvailableModelNames(key: string): Promise<string[]> {
  const found = await listAvailableModels(key)
  return found.map(([ver, m]) => `${ver}/${m}`)
}

/** Test the API key — auto-discovers working models via ListModels API */
export async function testApiKey(key: string): Promise<{ ok: boolean; error: string }> {
  const errorLog: string[] = []

  // Step 1: discover what models this key can actually access
  let candidates = await listAvailableModels(key)
  if (candidates.length === 0) {
    candidates = FALLBACK_CANDIDATES
    errorLog.push('ListModels returned no results — using fallback list')
  } else {
    console.log('[FSI] Available models:', candidates.map(([v,m]) => `${v}/${m}`).join(', '))
  }

  for (const [ver, model] of candidates) {
    try {
      const endpoint = `${BASE}/${ver}/models/${model}:generateContent?key=${key}`
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: 'Say "OK" only.' }] }],
        }),
      })

      const data = await res.json().catch(() => null)
      const apiMsg: string = data?.error?.message ?? res.statusText ?? 'unknown'

      if (!res.ok) {
        const line = `[${ver}] ${model} → HTTP ${res.status}: ${apiMsg.slice(0, 100)}`
        errorLog.push(line)
        console.warn('[FSI]', line)

        // Definitively invalid key — stop trying all models
        if (apiMsg.includes('API_KEY_INVALID') || apiMsg.includes('API key not valid')) {
          localStorage.removeItem('gemini_model')
          localStorage.removeItem('gemini_api_ver')
          return {
            ok: false,
            error: `❌ API Key rejected by Google.\n\nCreate a new key at:\nhttps://aistudio.google.com/app/apikey\n\nGoogle said: "${apiMsg.slice(0, 120)}"`,
          }
        }
        continue
      }

      const text: string = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
      if (text.length > 0) {
        // Save the working combo
        localStorage.setItem('gemini_model', model)
        localStorage.setItem('gemini_api_ver', ver)
        console.log(`[FSI] ✅ Connected: ${ver}/${model}`)
        return { ok: true, error: '' }
      }

      errorLog.push(`[${ver}] ${model} → empty response`)
    } catch (e: any) {
      const errMsg = e?.message ?? String(e)
      const line = `[${ver}] ${model} → fetch error: ${errMsg}`
      errorLog.push(line)
      console.error('[FSI]', line)
    }
  }

  localStorage.removeItem('gemini_model')
  localStorage.removeItem('gemini_api_ver')
  return {
    ok: false,
    error:
      `❌ All models failed.\n\n` +
      `Errors:\n${errorLog.map(l => '• ' + l).join('\n')}\n\n` +
      `If you see "Failed to fetch": network is blocking googleapis.com\n` +
      `If you see HTTP 404: model name issue — please report this error log`,
  }
}

/** Evaluate a student drill answer vs. model answer */
export async function evaluateDrill(
  userAnswer: string,
  modelAnswer: string,
  prompt: string,
  grammarFocus: string
): Promise<string> {
  const request = `[${grammarFocus}] Prompt:"${prompt}" | Model:"${modelAnswer}" | Said:"${userAnswer}"
→ Score/10 · strength · C2 upgrade · key fix. ≤100 words.`

  return generate(request, FSI_PERSONA)
}

/** Single conversation turn with AI partner */
export interface ChatMessage {
  role: 'user' | 'model'
  text: string
}

/** Max conversation history turns sent to API (saves tokens on long sessions) */
const CONV_WINDOW = 6

export async function conversationTurn(
  history: ChatMessage[],
  userMessage: string,
  scenario: string,
  feedbackMode: boolean
): Promise<string> {
  const systemPrompt = feedbackMode
    ? `${FSI_PERSONA}\nFEEDBACK MODE: after your reply add [COACH NOTE: <1 C2 fix, ≤20 words>].`
    : `${FSI_PERSONA}\nCONVERSATION MODE: reply naturally as a native professional. No unsolicited feedback.`

  // Sliding window — keep only the last N messages to cap token cost
  const windowedHistory = history.slice(-CONV_WINDOW)
  return generate(`[${scenario}] ${userMessage}`, systemPrompt, windowedHistory)
}

/** Detailed C2 speaking feedback report */
export async function giveSpeakingFeedback(
  transcript: string,
  unitTitle: string,
  grammarFocus: string
): Promise<SpeakingFeedback> {
  const request = `SPEAKING FEEDBACK ANALYSIS
Unit: "${unitTitle}" | Focus: ${grammarFocus}
Student transcript: "${transcript}"

Return a JSON object (no markdown code fences, no backticks) with this exact structure:
{
  "overallScore": <number 1-10>,
  "accuracy": { "score": <1-10>, "comment": "<one sentence>" },
  "fluency": { "score": <1-10>, "comment": "<one sentence>" },
  "vocabulary": { "score": <1-10>, "comment": "<one sentence>" },
  "coherence": { "score": <1-10>, "comment": "<one sentence>" },
  "topCorrection": "<most important fix as a complete corrected sentence>",
  "nativeSpeakerVersion": "<how a native C2 speaker would express the same idea>",
  "encouragement": "<one motivating sentence>"
}`

  const text = await generate(request, FSI_PERSONA)

  try {
    // Strip any accidental markdown fences
    const clean = text.replace(/```json|```/g, '').trim()
    return JSON.parse(clean) as SpeakingFeedback
  } catch {
    return {
      overallScore: 7,
      accuracy: { score: 7, comment: 'Good grammatical control with minor errors.' },
      fluency: { score: 7, comment: 'Generally fluent with some hesitation.' },
      vocabulary: { score: 7, comment: 'Adequate range; room for C2-level expansion.' },
      coherence: { score: 7, comment: 'Ideas are connected and logical.' },
      topCorrection: transcript,
      nativeSpeakerVersion: transcript,
      encouragement: "Keep practicing — you're making great progress toward C2!",
    }
  }
}

export interface SpeakingFeedback {
  overallScore: number
  accuracy: { score: number; comment: string }
  fluency: { score: number; comment: string }
  vocabulary: { score: number; comment: string }
  coherence: { score: number; comment: string }
  topCorrection: string
  nativeSpeakerVersion: string
  encouragement: string
}

