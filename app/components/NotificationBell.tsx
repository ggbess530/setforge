// ▸ Place at: app/components/NotificationBell.tsx
// Reusable bell dropdown — dropped into each page's own nav bar (this project
// has no shared layout/header, each page defines its nav inline). Polls
// /api/notifications every 45s for the badge; full list + mark-all-read fires
// when the dropdown opens.

'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@clerk/nextjs'

const C = '#00f0ff'
const M = '#ff1e8a'

type Notification = { id: string; type: string; actor_name: string | null; actor_image: string | null; message: string; link: string; read: boolean; created_at: string }

function timeAgo(iso: string): string {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  return `${Math.floor(s / 86400)}d ago`
}

export default function NotificationBell() {
  const { isSignedIn } = useAuth()
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loaded, setLoaded] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  const load = useCallback(() => {
    fetch('/api/notifications').then(r => r.json()).then(d => {
      if (d.error) return
      setNotifications(d.notifications ?? [])
      setUnreadCount(d.unreadCount ?? 0)
    }).finally(() => setLoaded(true))
  }, [])

  useEffect(() => {
    if (!isSignedIn) return
    load()
    const interval = setInterval(load, 45_000)
    return () => clearInterval(interval)
  }, [isSignedIn, load])

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  function toggleOpen() {
    const next = !open
    setOpen(next)
    if (next && unreadCount > 0) {
      setUnreadCount(0)
      setNotifications(prev => prev.map(n => ({ ...n, read: true })))
      fetch('/api/notifications/read', { method: 'POST' }).catch(() => {})
    }
  }

  function goTo(link: string) {
    setOpen(false)
    router.push(link)
  }

  if (!isSignedIn) return null

  return (
    <div ref={rootRef} style={{ position: 'relative' }}>
      <button onClick={toggleOpen} aria-label="Notifications" style={{ position: 'relative', background: 'transparent', border: '1px solid #23233a', color: '#8a8aa8', width: 32, height: 32, borderRadius: 8, cursor: 'pointer', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        🔔
        {unreadCount > 0 && (
          <span style={{ position: 'absolute', top: -4, right: -4, background: M, color: '#06060c', fontSize: 9, fontWeight: 700, borderRadius: 999, minWidth: 15, height: 15, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 3px', fontFamily: 'JetBrains Mono,monospace' }}>
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div style={{ position: 'absolute', top: 40, right: 0, width: 320, maxHeight: 420, overflowY: 'auto', background: '#0a0a14', border: '1px solid #1f1f33', borderRadius: 12, boxShadow: '0 12px 32px rgba(0,0,0,.5)', zIndex: 300 }}>
          <div style={{ padding: '10px 14px', borderBottom: '1px solid #16162a', fontSize: 11, fontWeight: 700, color: '#8a8aa8', letterSpacing: 1, fontFamily: 'JetBrains Mono,monospace' }}>NOTIFICATIONS</div>
          {!loaded ? (
            <div style={{ padding: 20, textAlign: 'center', fontSize: 12, color: '#4a4a66' }}>Loading…</div>
          ) : notifications.length === 0 ? (
            <div style={{ padding: 20, textAlign: 'center', fontSize: 12, color: '#4a4a66' }}>Nothing yet.</div>
          ) : (
            notifications.map(n => (
              <button key={n.id} onClick={() => goTo(n.link)} style={{ display: 'flex', gap: 10, width: '100%', textAlign: 'left', padding: '10px 14px', background: n.read ? 'transparent' : `${C}0c`, border: 'none', borderBottom: '1px solid #14142a', cursor: 'pointer' }}>
                {n.actor_image
                  // eslint-disable-next-line @next/next/no-img-element
                  ? <img src={n.actor_image} alt="" width={26} height={26} style={{ borderRadius: '50%', flexShrink: 0, marginTop: 1 }} />
                  : <div style={{ width: 26, height: 26, borderRadius: '50%', background: `linear-gradient(135deg,${M},${C})`, flexShrink: 0 }} />}
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 12, color: '#e8e8f0', lineHeight: 1.4 }}>{n.message}</div>
                  <div style={{ fontSize: 10, color: '#4a4a66', marginTop: 2 }}>{timeAgo(n.created_at)}</div>
                </div>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}
