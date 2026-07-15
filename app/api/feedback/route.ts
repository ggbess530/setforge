// ▸ Place at: app/api/feedback/route.ts
// POST — feedback/idea/bug submission. No auth required (signed-out visitors
// can leave feedback too), but pulls real name/email from Clerk when signed
// in. Always persisted to feedback_submissions regardless of whether the
// Resend email actually sends.

import { auth, currentUser } from '@clerk/nextjs/server'
import { NextResponse }      from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { sendFeedbackEmail } from '@/lib/feedback-email'
import { logError }          from '@/lib/log-error'

const MAX_MESSAGE = 4000
// Anonymous feedback has no per-user identity to rate-limit by — cap by
// submission volume overall in a short window instead of trusting IP alone.
const MAX_SUBMISSIONS_PER_10_MIN = 20

export async function POST(req: Request) {
  try {
    const { userId } = await auth()
    const { message, email, pageUrl } = await req.json()

    const cleanMessage = String(message ?? '').trim()
    if (!cleanMessage) return NextResponse.json({ error: 'Enter some feedback first.' }, { status: 400 })
    if (cleanMessage.length > MAX_MESSAGE) return NextResponse.json({ error: `Keep it under ${MAX_MESSAGE} characters.` }, { status: 400 })

    const db = createAdminClient()

    const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString()
    const { count } = await db.from('feedback_submissions').select('*', { count: 'exact', head: true }).gte('created_at', tenMinAgo)
    if ((count ?? 0) >= MAX_SUBMISSIONS_PER_10_MIN) {
      return NextResponse.json({ error: 'Too much feedback coming in right now — try again in a few minutes.' }, { status: 429 })
    }

    let userName: string | null = null
    let userEmail: string | null = typeof email === 'string' && email.trim() ? email.trim().slice(0, 200) : null
    if (userId) {
      const user = await currentUser()
      userName = user?.fullName || user?.username || null
      userEmail = user?.primaryEmailAddress?.emailAddress || userEmail
    }

    const emailSent = await sendFeedbackEmail({ message: cleanMessage, userName, userEmail, pageUrl: typeof pageUrl === 'string' ? pageUrl.slice(0, 300) : null })

    const { error } = await db.from('feedback_submissions').insert({
      user_id: userId ?? null, user_name: userName, user_email: userEmail,
      message: cleanMessage, page_url: typeof pageUrl === 'string' ? pageUrl.slice(0, 300) : null,
      email_sent: emailSent,
    })
    if (error) throw error

    return NextResponse.json({ submitted: true }, { status: 201 })

  } catch (err) {
    logError('[POST /api/feedback]', err)
    return NextResponse.json({ error: 'Failed to submit feedback.' }, { status: 500 })
  }
}
