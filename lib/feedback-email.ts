// ▸ Place at: lib/feedback-email.ts
// Sends a feedback notification via Resend — the only email-sending
// dependency in this stack (no other feature sends real email; team invites
// deliberately don't, see CLAUDE.md). Requires RESEND_API_KEY and a verified
// sending domain in the Resend dashboard for FEEDBACK_FROM_EMAIL to actually
// deliver to an arbitrary inbox — see the Environment Variables gotcha.
//
// Same no-op-if-unset philosophy as lib/log-error.ts's Sentry integration:
// missing config degrades gracefully rather than breaking the submit flow —
// the submission is still persisted in feedback_submissions regardless.

import { Resend } from 'resend'

export async function sendFeedbackEmail(params: {
  message: string; userName: string | null; userEmail: string | null; pageUrl: string | null
}): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY
  const toEmail = process.env.FEEDBACK_TO_EMAIL
  if (!apiKey || !toEmail) return false

  const resend = new Resend(apiKey)
  const from = process.env.FEEDBACK_FROM_EMAIL || 'SetForge Feedback <feedback@setforge.online>'
  const who = params.userName || params.userEmail || 'Anonymous visitor'

  const { error } = await resend.emails.send({
    from,
    to: toEmail,
    replyTo: params.userEmail || undefined,
    subject: `SetForge feedback from ${who}`,
    text: [
      `From: ${who}${params.userEmail ? ` <${params.userEmail}>` : ''}`,
      params.pageUrl ? `Page: ${params.pageUrl}` : null,
      '',
      params.message,
    ].filter(Boolean).join('\n'),
  })

  if (error) { console.error('[sendFeedbackEmail]', error); return false }
  return true
}
