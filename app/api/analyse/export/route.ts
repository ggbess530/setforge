// ▸ Place at: app/api/analyse/export/route.ts
// Exports the analysis report as a formatted text file

import { auth }         from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { report, tracks } = await req.json()
    if (!report) return NextResponse.json({ error: 'No report.' }, { status: 400 })

    const lines: string[] = [
      'SETFORGE SET ANALYSIS',
      '═'.repeat(50),
      `Generated: ${new Date().toLocaleDateString('en-US', { month:'long', day:'numeric', year:'numeric' })}`,
      `Tracks analysed: ${tracks?.length || '?'}`,
      '',
      `GRADE: ${report.grade} — ${report.gradeReason}`,
      '',
      '─'.repeat(50),
      'OVERVIEW',
      '─'.repeat(50),
      report.overview,
      '',
      '─'.repeat(50),
      'SCORES',
      '─'.repeat(50),
      ...Object.values(report.scores as Record<string, { label:string; score:number; comment:string }>).map(
        s => `${s.label}: ${s.score}/10\n  ${s.comment}`
      ),
      '',
      '─'.repeat(50),
      'PEAK MOMENT',
      '─'.repeat(50),
      `Track ${report.peakMoment.trackN}: ${report.peakMoment.artist} — ${report.peakMoment.title}`,
      report.peakMoment.reason,
      '',
      '─'.repeat(50),
      'HARDEST TRANSITION',
      '─'.repeat(50),
      `Track ${report.weakestTransition.fromN} → ${report.weakestTransition.toN}`,
      `${report.weakestTransition.fromTitle} into ${report.weakestTransition.toTitle}`,
      report.weakestTransition.reason,
      `Fix: ${report.weakestTransition.fix}`,
      '',
      '─'.repeat(50),
      'STRENGTHS',
      '─'.repeat(50),
      ...report.strengths.map((s: string) => `✓ ${s}`),
      '',
      '─'.repeat(50),
      'IMPROVEMENTS',
      '─'.repeat(50),
      ...report.improvements.map((imp: { title:string; detail:string }) => `↑ ${imp.title}\n  ${imp.detail}`),
      '',
      '─'.repeat(50),
      'TRACK NOTES',
      '─'.repeat(50),
      ...(report.trackNotes || []).map((tn: { n:number; note:string }) => {
        const t = tracks?.find((tr: { n:number }) => tr.n === tn.n)
        return `${String(tn.n).padStart(2,'0')}. ${t ? `${t.artist} — ${t.title}` : `Track ${tn.n}`}\n    ${tn.note}`
      }),
      '',
      '─'.repeat(50),
      'VERDICT',
      '─'.repeat(50),
      `"${report.verdict}"`,
      '',
      '═'.repeat(50),
      'Analysed with SetForge — setforge.online',
    ]

    const text = lines.join('\n')
    return new NextResponse(text, {
      headers: {
        'Content-Type':        'text/plain',
        'Content-Disposition': 'attachment; filename="setforge-analysis.txt"',
      },
    })

  } catch (err) {
    console.error('[POST /api/analyse/export]', err)
    return NextResponse.json({ error: 'Export failed.' }, { status: 500 })
  }
}
