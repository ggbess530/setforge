// ▸ Place at: lib/fetch-timeout.ts
// Bounds outbound calls to third-party APIs (Spotify, ReccoBeats) so a hung
// external request can't stall a route past its own maxDuration budget.

export function fetchWithTimeout(input: string, init: RequestInit = {}, timeoutMs = 8000): Promise<Response> {
  return fetch(input, { ...init, signal: AbortSignal.timeout(timeoutMs) })
}
