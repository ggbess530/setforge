// ▸ Place at: lib/secure-compare.ts
// Constant-time string comparison for secrets (webhook signatures, cron
// tokens) — guards against timing attacks and against timingSafeEqual's
// own throw-on-length-mismatch behavior.

import crypto from 'crypto'

export function timingSafeEqualStr(a: string, b: string): boolean {
  const bufA = Buffer.from(a)
  const bufB = Buffer.from(b)
  if (bufA.length !== bufB.length) return false
  return crypto.timingSafeEqual(bufA, bufB)
}
