// ▸ Place at: instrumentation-client.ts (project root, next to next.config.ts)
// ▸ Next.js auto-loads this for browser-side Sentry init (App Router convention).

import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0.1,
  enabled: !!process.env.NEXT_PUBLIC_SENTRY_DSN,
})

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart
