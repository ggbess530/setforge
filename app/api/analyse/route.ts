// ▸ Create folder: app/api/analyse/
// ▸ Place at:      app/api/analyse/route.ts

import { auth }         from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import anthropic, { CLAUDE_MODEL } from '@/lib/anthropic'
import { createAdminClient as db } from '@/lib/supabase'
import { checkSubscription, recordUsage } from '@/lib/subscription'
import { logError } from '@/lib/log-error'

// ── Parse freeform tracklist text ─────────────────────────────
function parseTracklist(raw: string): { n: number; artist: string; title: string; bpm?: number; key?: string }[] {
  const lines = raw
    .split('\n')
    .map(l => l.trim())
    .filter(l => l && !l.startsWith('#') && l.length > 2)

  return lines.map((line, i) => {
    // Strip leading number: "01." "1." "1)" "1 -"
    const stripped = line.replace(/^\d+[\.\)\-]\s*/, '').replace(/^\d+\s*[\.\)\-]\s*/, '')

    // Try to extract BPM: "124 BPM" or "[124]" or "@ 124"
    const bpmMatch = stripped.match(/\b(\d{2,3}(?:\.\d)?)\s*(?:bpm|BPM)?\b/)
    const bpm = bpmMatch ? parseFloat(bpmMatch[1]) : undefined

    // Try to extract Camelot key: "8A" "3B" "11A"
    const keyMatch = stripped.match(/\b(\d{1,2}[AB])\b/i)
    const key = keyMatch ? keyMatch[1].toUpperCase() : undefined

    // Try "Artist - Title" or "Artist — Title"
    const dashIdx = stripped.search(/\s[–—-]\s/)
    let artist = 'Unknown', title = stripped

    if (dashIdx > 0) {
      artist = stripped.slice(0, dashIdx).trim()
      title  = stripped.slice(dashIdx).replace(/^[\s–—-]+/, '').trim()
      // Remove BPM/key from title if they leaked in
      title  = title.replace(/\[?\b\d{2,3}\s*BPM\b\]?/gi, '').replace(/\b\d{1,2}[AB]\b/gi, '').trim()
    }

    return { n: i + 1, artist, title, bpm, key }
  }).filter(t => t.title.length > 1)
}

export async function POST(req: Request) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const sub = await checkSubscription(userId)
    if (!sub.active) return NextResponse.json({ error: 'No active subscription.' }, { status: 403 })
    if (sub.remainingGenerations !== null && sub.remainingGenerations <= 0) {
      return NextResponse.json({ error: 'Generation limit reached.', code: 'LIMIT_REACHED' }, { status: 429 })
    }

    const { rawText, context } = await req.json()

    if (!rawText?.trim()) {
      return NextResponse.json({ error: 'No tracklist provided.' }, { status: 400 })
    }

    // Parse the freeform tracklist
    const tracks = parseTracklist(rawText)

    if (tracks.length < 3) {
      return NextResponse.json({
        error: 'Need at least 3 tracks to analyse a set. Paste your full tracklist.',
      }, { status: 400 })
    }

    const trackList = tracks
      .map(t => `${t.n}. ${t.artist} — ${t.title}${t.bpm ? ` [${t.bpm} BPM]` : ''}${t.key ? ` [${t.key}]` : ''}`)
      .join('\n')

    const prompt = `You are an expert DJ educator and set analyst. Analyse this DJ set and return a detailed, honest, constructive report.

SET TRACKLIST (${tracks.length} tracks):
${trackList}

${context ? `Additional context: ${context}` : ''}

Analyse this set across these dimensions and return ONLY valid JSON:

{
  "overview": "2-3 sentence summary of the set's overall character and journey",
  "grade": "A+|A|A-|B+|B|B-|C+|C|C-|D",
  "gradeReason": "1 sentence explaining the grade honestly",
  "scores": {
    "energy":    { "score": 0-10, "label": "Energy Flow",          "comment": "2 sentence assessment" },
    "harmonic":  { "score": 0-10, "label": "Harmonic Mixing",      "comment": "2 sentence assessment" },
    "bpm":       { "score": 0-10, "label": "BPM Progression",      "comment": "2 sentence assessment" },
    "selection": { "score": 0-10, "label": "Track Selection",      "comment": "2 sentence assessment" },
    "structure": { "score": 0-10, "label": "Set Structure",        "comment": "2 sentence assessment" }
  },
  "peakMoment": {
    "trackN": 0,
    "artist": "",
    "title": "",
    "reason": "Why this was the peak — what made it land"
  },
  "weakestTransition": {
    "fromN": 0,
    "toN": 0,
    "fromTitle": "",
    "toTitle": "",
    "reason": "What makes this the hardest mix and why it risks losing the crowd",
    "fix": "Specific technique to make this transition work"
  },
  "strengths": ["strength 1", "strength 2", "strength 3"],
  "improvements": [
    { "title": "short title", "detail": "specific actionable advice" },
    { "title": "short title", "detail": "specific actionable advice" },
    { "title": "short title", "detail": "specific actionable advice" }
  ],
  "trackNotes": [
    { "n": 1, "note": "brief note about this track's role or placement" }
  ],
  "energyCurve": [1,2,3,4,5,6,7,8,9,8,7],
  "verdict": "One punchy closing sentence — the thing this DJ should work on most"
}

IMPORTANT: Keep ALL text fields SHORT (1-2 sentences max). For trackNotes, only include notes for the most notable tracks — maximum 8 entries, skip unremarkable tracks entirely. energyCurve must have exactly one number per track.`

    const msg = await anthropic.messages.create({
      model:      CLAUDE_MODEL,
      max_tokens: 4000,
      messages:   [{ role: 'user', content: prompt }],
    })

    const raw = msg.content.filter(b => b.type === 'text').map(b => b.text).join('')

    // Robust JSON extraction — handles truncation and markdown fences
    let report: Record<string, unknown>
    try {
      const cleaned = raw.replace(/```json|```/g, '').trim()
      report = JSON.parse(cleaned)
    } catch {
      // Try to extract JSON object even if response was truncated
      const start = raw.indexOf('{')
      let candidate = start >= 0 ? raw.slice(start) : raw

      // If truncated mid-JSON, try to close it
      if (candidate.lastIndexOf('}') < candidate.length - 20) {
        // Response likely cut off — try adding closing braces
        const opens  = (candidate.match(/\{/g) || []).length
        const closes = (candidate.match(/\}/g) || []).length
        const missing = opens - closes
        if (missing > 0 && missing < 5) {
          candidate = candidate.trimEnd().replace(/,\s*$/, '') + '}'.repeat(missing)
        }
      }

      try {
        report = JSON.parse(candidate)
      } catch {
        logError('[analyse] Raw response that failed to parse:', raw.slice(0, 500))
        throw new SyntaxError('AI response could not be parsed')
      }
    }

    // Ensure required fields exist with safe defaults
    if (!report.grade)              report.grade              = 'B'
    if (!report.gradeReason)        report.gradeReason        = 'Analysis completed'
    if (!report.overview)           report.overview           = 'Set analysed successfully.'
    if (!report.scores)             report.scores             = {}
    if (!report.strengths)          report.strengths          = []
    if (!report.improvements)       report.improvements       = []
    if (!report.trackNotes)         report.trackNotes         = []
    if (!report.energyCurve)        report.energyCurve        = []
    if (!report.verdict)            report.verdict            = 'Keep practising!'
    if (!report.peakMoment)         report.peakMoment         = { trackN:1, artist:'', title:'', reason:'' }
    if (!report.weakestTransition)  report.weakestTransition  = { fromN:1, toN:2, fromTitle:'', toTitle:'', reason:'', fix:'' }

    await recordUsage(userId, 'generate')

    // Save to track_history so it ties into the history feature
    if (tracks.length > 0) {
      try {
        await db().from('track_history').insert(
          tracks.map(t => ({
            user_id:     userId,
            artist:      t.artist,
            title:       t.title,
            bpm:         t.bpm || null,
            key:         t.key || null,
            set_context: `analysed${context ? ` / ${context}` : ''}`,
          }))
        )
      } catch { /* non-fatal */ }
    }

    // Save the analysis result to a new table (created below)
    try {
      await db().from('set_analyses').insert({
        user_id:     userId,
        track_count: tracks.length,
        grade:       report.grade,
        scores:      report.scores,
        raw_input:   rawText.slice(0, 2000),
        report:      report,
        context:     context || null,
      })
    } catch { /* non-fatal — table might not exist yet */ }

    return NextResponse.json({ report, tracks })

  } catch (err) {
    logError('[POST /api/analyse]', err)
    if (err instanceof SyntaxError) {
      return NextResponse.json({ error: 'AI returned malformed data. Try again.' }, { status: 502 })
    }
    return NextResponse.json({ error: 'Analysis failed. Please try again.' }, { status: 500 })
  }
}
