// ▸ Create folder: app/team/
// ▸ Place at:      app/team/page.tsx

'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import Link from 'next/link'
import { useAuth, UserButton } from '@clerk/nextjs'
import NotificationBell from '../components/NotificationBell'

const C = '#00f0ff'
const M = '#ff1e8a'

type Member = { userId: string; name: string; imageUrl: string; role: 'owner' | 'member'; joinedAt: string | null }
type Invite = { id: string; email: string; createdAt: string }
type TeamStatus = {
  role: 'owner' | 'member' | null
  team: { id: string; name: string; seatLimit: number } | null
  members: Member[]
  pendingInvites: Invite[]
  seatsUsed: number
  seatLimit: number
  pendingInviteForMe: { teamName: string; invitedBy: string } | null
  myTier: 'free' | 'pro' | 'team'
}

function Avatar({ url, size = 34 }: { url: string; size?: number }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={url} alt="" width={size} height={size} style={{ borderRadius: '50%', flexShrink: 0, objectFit: 'cover' }} />
}

export default function TeamPage() {
  const { isSignedIn } = useAuth()
  const [status, setStatus]   = useState<TeamStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [isMobile, setIsMobile] = useState(false)
  const [email, setEmail]     = useState('')
  const [inviting, setInviting] = useState(false)
  const [busyId, setBusyId]   = useState<string | null>(null)
  const [toasts, setToasts]   = useState<{ id: number; type: 'success' | 'error'; message: string }[]>([])
  const toastIdRef = useRef(0)

  function pushToast(type: 'success' | 'error', message: string) {
    const id = ++toastIdRef.current
    setToasts(prev => [...prev, { id, type, message }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3500)
  }

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 768px)')
    const update = () => setIsMobile(mq.matches)
    update()
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [])

  const load = useCallback(() => {
    fetch('/api/team').then(r => r.json()).then(d => { if (!d.error) setStatus(d) }).finally(() => setLoading(false))
  }, [])

  useEffect(() => { if (isSignedIn) load() }, [isSignedIn, load])

  async function sendInvite() {
    if (!email.trim()) return
    setInviting(true)
    try {
      const res = await fetch('/api/team/invite', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: email.trim() }) })
      const data = await res.json()
      if (!res.ok) { pushToast('error', data.error || 'Failed to invite.'); return }
      setEmail('')
      pushToast('success', `Invited ${data.invite.email}. They can accept from this page once signed in.`)
      load()
    } catch { pushToast('error', 'Network error.') }
    finally { setInviting(false) }
  }

  async function revokeInvite(id: string) {
    setBusyId(id)
    try {
      const res = await fetch(`/api/team/invite/item?id=${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
      pushToast('success', 'Invite revoked.')
      load()
    } catch { pushToast('error', 'Failed to revoke invite.') }
    finally { setBusyId(null) }
  }

  async function removeMember(userId: string, isSelf: boolean) {
    setBusyId(userId)
    try {
      const res = await fetch(`/api/team/member?userId=${userId}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
      pushToast('success', isSelf ? 'You left the team.' : 'Removed from team.')
      load()
    } catch { pushToast('error', 'Failed to update team.') }
    finally { setBusyId(null) }
  }

  async function respondInvite(accept: boolean) {
    setInviting(true)
    try {
      const res = await fetch('/api/team/claim', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ decline: !accept }) })
      const data = await res.json()
      if (!res.ok) { pushToast('error', data.error || 'Failed.'); return }
      pushToast('success', accept ? 'Joined the team!' : 'Invite declined.')
      load()
    } catch { pushToast('error', 'Network error.') }
    finally { setInviting(false) }
  }

  return (
    <div style={{ minHeight: '100vh', background: '#06060c', color: '#e8e8f0', fontFamily: "'Inter',system-ui,sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=JetBrains+Mono:wght@400;500;700&display=swap');
        .tm-input { background:#0d0d18; border:1px solid #1f1f33; color:#e8e8f0; font-family:'Inter',system-ui,sans-serif; font-size:13px; padding:9px 12px; border-radius:8px; width:100%; outline:none; transition:.2s; box-sizing:border-box; }
        .tm-input:focus { border-color:${C}; box-shadow:0 0 0 3px ${C}18; }
        .tm-btn-primary { background:linear-gradient(100deg,${M},${C}); color:#06060c; font-weight:700; border:none; cursor:pointer; font-family:'JetBrains Mono',monospace; transition:box-shadow .2s,transform .15s; }
        .tm-btn-primary:hover:enabled { box-shadow:0 0 0 3px ${C}44; transform:translateY(-1px); }
        .tm-btn-primary:disabled { opacity:.5; cursor:default; }
        .tm-btn-ghost { background:transparent; border:1px solid #23233a; color:#8a8aa8; cursor:pointer; font-family:'JetBrains Mono',monospace; transition:.18s; }
        .tm-btn-ghost:hover:enabled { border-color:${C}; color:${C}; }
        .tm-del-btn { background:transparent; border:1px solid #23233a; color:#5a5a78; cursor:pointer; font-family:'JetBrains Mono',monospace; font-size:10px; padding:4px 8px; border-radius:5px; transition:.18s; }
        .tm-del-btn:hover:enabled { border-color:${M}; color:${M}; }
        .tm-del-btn:disabled { opacity:.5; cursor:default; }
        @keyframes toast-in { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:none} }
        * { box-sizing:border-box; }
      `}</style>

      <div role="status" aria-live="polite" style={{ position: 'fixed', bottom: 20, right: 20, zIndex: 250, display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 320 }}>
        {toasts.map(t => (
          <div key={t.id} style={{ animation: 'toast-in .25s ease', background: '#0a0a14', border: `1px solid ${t.type === 'success' ? C : M}66`, borderRadius: 10, padding: '10px 14px', fontSize: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ color: t.type === 'success' ? C : M, fontWeight: 700 }}>{t.type === 'success' ? '✓' : '✕'}</span>{t.message}
          </div>
        ))}
      </div>

      <nav style={{ position: 'sticky', top: 0, zIndex: 50, borderBottom: '1px solid #1a1a2e', backdropFilter: 'blur(16px)', background: 'rgba(6,6,12,.88)', padding: isMobile ? '0 10px' : '0 24px' }}>
        <div style={{ maxWidth: 760, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 56 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 8 : 16 }}>
            <Link href="/" style={{ textDecoration: 'none' }}>
              <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: isMobile ? 20 : 24, letterSpacing: 2 }}>
                <span style={{ color: C }}>SET</span><span style={{ color: M }}>FORGE</span>
              </div>
            </Link>
            {!isMobile && <div style={{ fontSize: 12, color: '#4a4a66', fontFamily: 'JetBrains Mono,monospace' }}>/ TEAM</div>}
          </div>
          <div style={{ display: 'flex', gap: isMobile ? 6 : 10, alignItems: 'center' }}>
            <Link href="/app" style={{ textDecoration: 'none' }}><button className="tm-btn-ghost" style={{ padding: isMobile ? '7px 10px' : '7px 14px', borderRadius: 8, fontSize: 12 }}>⚡{!isMobile && ' Forge'}</button></Link>
            <Link href="/wiki" style={{ textDecoration: 'none' }}><button className="tm-btn-ghost" style={{ padding: isMobile ? '7px 10px' : '7px 14px', borderRadius: 8, fontSize: 12 }}>📖{!isMobile && ' Wiki'}</button></Link>
            {isSignedIn && <NotificationBell />}
            {isSignedIn ? <UserButton /> : <Link href="/sign-in"><button className="tm-btn-primary" style={{ padding: '7px 16px', borderRadius: 8, fontSize: 12 }}>Sign in</button></Link>}
          </div>
        </div>
      </nav>

      <div style={{ maxWidth: 760, margin: '0 auto', padding: isMobile ? '24px 14px 60px' : '40px 24px 80px' }}>

        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ fontSize: 11, color: M, fontFamily: 'JetBrains Mono,monospace', letterSpacing: 3, marginBottom: 10 }}>SHARE THE PLAN</div>
          <h1 style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 'clamp(36px,6vw,60px)', margin: '0 0 10px', letterSpacing: 1, lineHeight: 1 }}>
            <span style={{ color: C }}>YOUR</span> <span style={{ color: M }}>TEAM</span>
          </h1>
          <p style={{ fontSize: 13, color: '#6a6a8a', margin: 0 }}>Invite up to {status?.seatLimit ?? 5} people onto one Team plan.</p>
        </div>

        {!isSignedIn ? (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: '#4a4a66', fontSize: 13, border: '1px dashed #1a1a2e', borderRadius: 16 }}>
            <Link href="/sign-in" style={{ color: C }}>Sign in</Link> to manage your team.
          </div>
        ) : loading ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: '#4a4a66', fontSize: 13 }}>Loading team…</div>
        ) : !status ? (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: '#4a4a66', fontSize: 13 }}>Failed to load team status.</div>

        ) : status.pendingInviteForMe ? (
          <div style={{ background: '#0a0a14', border: `1px solid ${C}55`, borderRadius: 16, padding: 24, textAlign: 'center' }}>
            <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 6 }}>
              {status.pendingInviteForMe.invitedBy} invited you to join <span style={{ color: C }}>{status.pendingInviteForMe.teamName}</span>
            </div>
            <div style={{ fontSize: 12, color: '#8a8aa8', marginBottom: 18 }}>Accepting gives you access to their Team plan&apos;s 400 generations/month (shared across the team) — no separate billing.</div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
              <button onClick={() => respondInvite(true)} disabled={inviting} className="tm-btn-primary" style={{ padding: '10px 24px', borderRadius: 9, fontSize: 12 }}>ACCEPT</button>
              <button onClick={() => respondInvite(false)} disabled={inviting} className="tm-btn-ghost" style={{ padding: '10px 24px', borderRadius: 9, fontSize: 12 }}>DECLINE</button>
            </div>
          </div>

        ) : status.role === null ? (
          status.myTier === 'team' ? (
            <div style={{ background: '#0a0a14', border: '1px solid #1a1a2e', borderRadius: 16, padding: 24 }}>
              <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>Build your team</div>
              <div style={{ fontSize: 12, color: '#8a8aa8', marginBottom: 16 }}>Invite a teammate by email. They&apos;ll ride your Team subscription once they accept.</div>
              <div style={{ display: 'flex', gap: 8 }}>
                <input className="tm-input" placeholder="teammate@email.com" value={email} onChange={e => setEmail(e.target.value)} onKeyDown={e => e.key === 'Enter' && sendInvite()} />
                <button onClick={sendInvite} disabled={inviting || !email.trim()} className="tm-btn-primary" style={{ padding: '9px 20px', borderRadius: 8, fontSize: 12, whiteSpace: 'nowrap' }}>{inviting ? '…' : 'INVITE'}</button>
              </div>
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '60px 20px', color: '#8a8aa8', fontSize: 13, border: '1px dashed #1a1a2e', borderRadius: 16 }}>
              Team plan required to build a team.
              <div style={{ marginTop: 14 }}>
                <Link href="/#pricing" style={{ textDecoration: 'none' }}><button className="tm-btn-primary" style={{ padding: '10px 22px', borderRadius: 9, fontSize: 12 }}>VIEW TEAM PLAN →</button></Link>
              </div>
            </div>
          )

        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ background: '#0a0a14', border: '1px solid #1a1a2e', borderRadius: 16, padding: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <div style={{ fontSize: 14, fontWeight: 700 }}>{status.team?.name}</div>
                <div style={{ fontSize: 11, color: '#6a6a8a', fontFamily: 'JetBrains Mono,monospace' }}>{status.seatsUsed}/{status.seatLimit} seats</div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {status.members.map(m => (
                  <div key={m.userId} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <Avatar url={m.imageUrl} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.name}</div>
                      <div style={{ fontSize: 10, color: '#4a4a66' }}>{m.role === 'owner' ? 'Owner' : 'Member'}</div>
                    </div>
                    {status.role === 'owner' && m.role === 'member' && (
                      <button onClick={() => removeMember(m.userId, false)} disabled={busyId === m.userId} className="tm-del-btn">remove</button>
                    )}
                    {status.role === 'member' && m.role === 'member' && (
                      <button onClick={() => removeMember(m.userId, true)} disabled={busyId === m.userId} className="tm-del-btn">leave</button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {status.role === 'owner' && (
              <div style={{ background: '#0a0a14', border: '1px solid #1a1a2e', borderRadius: 16, padding: 20 }}>
                <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>Invite a teammate</div>
                {status.seatsUsed >= status.seatLimit ? (
                  <div style={{ fontSize: 12, color: M }}>Seat limit reached — remove someone to free up a spot.</div>
                ) : (
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input className="tm-input" placeholder="teammate@email.com" value={email} onChange={e => setEmail(e.target.value)} onKeyDown={e => e.key === 'Enter' && sendInvite()} />
                    <button onClick={sendInvite} disabled={inviting || !email.trim()} className="tm-btn-primary" style={{ padding: '9px 20px', borderRadius: 8, fontSize: 12, whiteSpace: 'nowrap' }}>{inviting ? '…' : 'INVITE'}</button>
                  </div>
                )}

                {status.pendingInvites.length > 0 && (
                  <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div style={{ fontSize: 10, color: '#4a4a66', letterSpacing: 1, fontFamily: 'JetBrains Mono,monospace' }}>PENDING</div>
                    {status.pendingInvites.map(inv => (
                      <div key={inv.id} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12, color: '#9a9ab8' }}>
                        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{inv.email}</span>
                        <button onClick={() => revokeInvite(inv.id)} disabled={busyId === inv.id} className="tm-del-btn">revoke</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
