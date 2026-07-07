// ▸ Place at: sentry.edge.config.ts (project root, next to next.config.ts)
// ▸ Loaded by instrumentation.ts for the Edge runtime (e.g. proxy.ts / Clerk middleware).

import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  tracesSampleRate: 0.1,
  enabled: !!process.env.SENTRY_DSN,
})
