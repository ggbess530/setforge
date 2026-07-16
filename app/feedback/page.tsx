// ▸ Create folder: app/feedback/
// ▸ Place at:      app/feedback/page.tsx

'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useAuth, UserButton } from '@clerk/nextjs'
import NotificationBell from '../components/NotificationBell'

const C = '#00f0ff'
const M = '#ff1e8a'
const MAX_MESSAGE = 4000

export default function FeedbackPage() {
  const { isSignedIn } = useAuth()
  const [message, setMessage] = useState('')
  const [email, setEmail]     = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone]       = useState(false)
  const [error, setError]     = useState<string | null>(null)

  async function submit() {
    if (!message.trim() || submitting) return
    setSubmitting(true); setError(null)
    try {
      const res = await fetch('/api/feedback', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: message.trim(), email: email.trim() || undefined, pageUrl: window.location.href }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Failed to send.'); return }
      setDone(true)
    } catch { setError('Network error.') }
    finally { setSubmitting(false) }
  }

  return (
    <div style={{ minHeight: '100vh', background: '#06060c', color: '#e8e8f0', fontFamily: "'Inter',system-ui,sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=JetBrains+Mono:wght@400;500;700&display=swap');
        .fb-input { background:#0d0d18; border:1px solid #1f1f33; color:#e8e8f0; font-family:'Inter',system-ui,sans-serif; font-size:13px; padding:10px 12px; border-radius:8px; width:100%; outline:none; transition:.2s; box-sizing:border-box; }
        .fb-input:focus { border-color:${C}; box-shadow:0 0 0 3px ${C}18; }
        .fb-btn-primary { background:linear-gradient(100deg,${M},${C}); color:#06060c; font-weight:700; border:none; cursor:pointer; font-family:'JetBrains Mono',monospace; transition:box-shadow .2s,transform .15s; }
        .fb-btn-primary:hover:enabled { box-shadow:0 0 0 3px ${C}44; transform:translateY(-1px); }
        .fb-btn-primary:disabled { opacity:.5; cursor:default; }
        .fb-btn-ghost { background:transparent; border:1px solid #23233a; color:#8a8aa8; cursor:pointer; font-family:'JetBrains Mono',monospace; transition:.18s; text-decoration:none; }
        .fb-btn-ghost:hover { border-color:${C}; color:${C}; }
        * { box-sizing:border-box; }
      `}</style>

      <nav style={{ position: 'sticky', top: 0, zIndex: 50, borderBottom: '1px solid #1a1a2e', backdropFilter: 'blur(16px)', background: 'rgba(6,6,12,.88)', padding: '0 24px' }}>
        <div style={{ maxWidth: 600, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 56 }}>
          <Link href="/" style={{ textDecoration: 'none' }}>
            <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 24, letterSpacing: 2 }}>
              <span style={{ color: C }}>SET</span><span style={{ color: M }}>FORGE</span>
            </div>
          </Link>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <Link href="/app" className="fb-btn-ghost" style={{ padding: '7px 14px', borderRadius: 8, fontSize: 12 }}>⚡ Forge</Link>
            <Link href="/wiki" className="fb-btn-ghost" style={{ padding: '7px 14px', borderRadius: 8, fontSize: 12 }}>📖 Wiki</Link>
            {isSignedIn && <NotificationBell />}
            {isSignedIn ? <UserButton /> : <Link href="/sign-in"><button className="fb-btn-primary" style={{ padding: '7px 16px', borderRadius: 8, fontSize: 12 }}>Sign in</button></Link>}
          </div>
        </div>
      </nav>

      <div style={{ maxWidth: 600, margin: '0 auto', padding: '48px 24px 80px' }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ fontSize: 11, color: M, fontFamily: 'JetBrains Mono,monospace', letterSpacing: 3, marginBottom: 10 }}>WE&apos;RE LISTENING</div>
          <h1 style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 'clamp(36px,6vw,56px)', margin: '0 0 10px', letterSpacing: 1, lineHeight: 1 }}>
            <span style={{ color: C }}>SHARE</span> <span style={{ color: M }}>FEEDBACK</span>
          </h1>
          <p style={{ fontSize: 13, color: '#6a6a8a', margin: 0 }}>Ideas, feature requests, bugs, anything you noticed while using SetForge — it goes straight to the founder.</p>
        </div>

        {done ? (
          <div style={{ textAlign: 'center', padding: '48px 20px', border: '1px dashed #1a1a2e', borderRadius: 16 }}>
            <div style={{ fontSize: 28, marginBottom: 10 }}>✓</div>
            <div style={{ fontSize: 14, color: '#e8e8f0', marginBottom: 4 }}>Thanks — got it.</div>
            <div style={{ fontSize: 12, color: '#6a6a8a', marginBottom: 20 }}>Every submission gets read.</div>
            <button onClick={() => { setDone(false); setMessage('') }} className="fb-btn-ghost" style={{ padding: '9px 20px', borderRadius: 9, fontSize: 12 }}>Send another</button>
          </div>
        ) : (
          <div style={{ background: '#0a0a14', border: '1px solid #1a1a2e', borderRadius: 16, padding: 24 }}>
            <textarea
              className="fb-input" rows={7} maxLength={MAX_MESSAGE}
              placeholder="What's on your mind — a feature you wish existed, something that felt clunky, a bug you hit…"
              value={message} onChange={e => setMessage(e.target.value)}
              style={{ resize: 'vertical', lineHeight: 1.6, marginBottom: 12 }}
            />
            {!isSignedIn && (
              <input
                className="fb-input" type="email" placeholder="Your email (optional, so we can follow up)"
                value={email} onChange={e => setEmail(e.target.value)}
                style={{ marginBottom: 12 }}
              />
            )}
            {error && <div style={{ color: M, fontSize: 12, marginBottom: 12 }}>{error}</div>}
            <button onClick={submit} disabled={submitting || !message.trim()} className="fb-btn-primary" style={{ width: '100%', padding: '13px 0', borderRadius: 10, fontSize: 14 }}>
              {submitting ? 'SENDING…' : 'SEND FEEDBACK'}
            </button>
            <div style={{ fontSize: 10, color: '#4a4a66', marginTop: 8, textAlign: 'right' }}>{message.length}/{MAX_MESSAGE}</div>
          </div>
        )}
      </div>
    </div>
  )
}
