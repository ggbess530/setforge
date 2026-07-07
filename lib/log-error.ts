// ▸ Place at: lib/log-error.ts
// Drop-in replacement for console.error(context, err) that also reports to
// Sentry (no-ops if SENTRY_DSN isn't configured) — so failures in background
// jobs (cron, webhooks) aren't only visible to someone tailing Vercel logs.

import * as Sentry from '@sentry/nextjs'

export function logError(context: string, err?: unknown): void {
  console.error(context, err)
  if (err instanceof Error) {
    Sentry.captureException(err, { tags: { context } })
  } else {
    Sentry.captureMessage(err !== undefined ? `${context}: ${JSON.stringify(err)}` : context, 'error')
  }
}
