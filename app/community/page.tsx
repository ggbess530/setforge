// ▸ Create folder: app/community/
// ▸ Place at:      app/community/page.tsx

'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'
import { useAuth, useUser, UserButton } from '@clerk/nextjs'
import { calcBridge } from '@/lib/mix-utils'
import NotificationBell from '../components/NotificationBell'

const C = '#00f0ff'
const M = '#ff1e8a'

// ── Types ─────────────────────────────────────────────────────
type TrackInfo = { artist: string; title: string; bpm: number | null; key: string | null }
type Post = {
  id: string; user_id: string; author_name: string | null; author_image: string | null; author_handle: string | null
  type: 'blog' | 'mix'; title: string; body: string | null
  track1_artist: string | null; track1_title: string | null; track1_bpm: number | null; track1_key: string | null
  track2_artist: string | null; track2_title: string | null; track2_bpm: number | null; track2_key: string | null
  audioUrl: string | null; audio_duration_sec: number | null
  like_count: number; comment_count: number; created_at: string
}
type MixQuota = { allowed: boolean; remaining: number; maxFileBytes: number; maxDurationSec: number }
type CommentItem = {
  id: string; post_id: string; parent_id: string | null
  user_id: string; author_name: string | null; author_image: string | null
  body: string; created_at: string; replies?: CommentItem[]
}

// ── Helpers ───────────────────────────────────────────────────
function timeAgo(iso: string): string {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (s < 60)    return 'just now'
  if (s < 3600)  return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  if (s < 2592000) return `${Math.floor(s / 86400)}d ago`
  return new Date(iso).toLocaleDateString()
}
function fmtDuration(sec: number | null): string {
  if (!sec) return ''
  const m = Math.floor(sec / 60), s = Math.round(sec % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}
function fmtBytes(b: number): string { return `${(b / 1024 / 1024).toFixed(1)}MB` }

function readAudioMeta(file: File): Promise<number> {
  return new Promise(resolve => {
    const el = new Audio()
    const url = URL.createObjectURL(file)
    el.preload = 'metadata'
    el.onloadedmetadata = () => { resolve(el.duration || 0); URL.revokeObjectURL(url) }
    el.onerror = () => { resolve(0); URL.revokeObjectURL(url) }
    el.src = url
  })
}

function CompatBadge({ track1, track2 }: { track1: TrackInfo; track2: TrackInfo }) {
  if (!track1.bpm || !track2.bpm || !track1.key || !track2.key) return null
  const bridge = calcBridge(
    { artist: track1.artist, title: track1.title, bpm: track1.bpm, key: track1.key },
    { artist: track2.artist, title: track2.title, bpm: track2.bpm, key: track2.key },
  )
  const label = { perfect: 'PERFECT MIX', smooth: 'SMOOTH MIX', risky: 'RISKY MIX', clash: 'KEY CLASH' }[bridge.compatibility]
  return (
    <span style={{ fontSize: 9, fontWeight: 700, color: bridge.color, border: `1px solid ${bridge.color}55`, borderRadius: 999, padding: '3px 9px', fontFamily: 'JetBrains Mono,monospace', letterSpacing: 1, whiteSpace: 'nowrap' }}>
      {label} · {bridge.score}/100
    </span>
  )
}

function TrackFields({ label, value, onChange }: { label: string; value: TrackInfo; onChange: (v: TrackInfo) => void }) {
  return (
    <div style={{ background: '#06060c', border: '1px solid #1a1a2e', borderRadius: 12, padding: 14, flex: 1, minWidth: 0 }}>
      <div style={{ fontSize: 9, color: '#6a6a8a', letterSpacing: 2, marginBottom: 10, fontFamily: 'JetBrains Mono,monospace' }}>{label}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <input className="sf-input" placeholder="Artist" value={value.artist} onChange={e => onChange({ ...value, artist: e.target.value })} />
        <input className="sf-input" placeholder="Track title" value={value.title} onChange={e => onChange({ ...value, title: e.target.value })} />
        <div style={{ display: 'flex', gap: 8 }}>
          <input className="sf-input" placeholder="BPM" type="number" value={value.bpm ?? ''} onChange={e => onChange({ ...value, bpm: e.target.value ? +e.target.value : null })} />
          <input className="sf-input" placeholder="Key (8A)" value={value.key ?? ''} onChange={e => onChange({ ...value, key: e.target.value.toUpperCase() })} style={{ fontFamily: 'JetBrains Mono,monospace' }} />
        </div>
      </div>
    </div>
  )
}

// ── Post composer ────────────────────────────────────────────
function Composer({ mixQuota, onPosted, onClose, pushToast }: {
  mixQuota: MixQuota | null
  onPosted: (p: Post) => void
  onClose: () => void
  pushToast: (type: 'success' | 'error', msg: string) => void
}) {
  const [mode, setMode]     = useState<'blog' | 'mix'>('blog')
  const [title, setTitle]   = useState('')
  const [body, setBody]     = useState('')
  const [track1, setTrack1] = useState<TrackInfo>({ artist: '', title: '', bpm: null, key: null })
  const [track2, setTrack2] = useState<TrackInfo>({ artist: '', title: '', bpm: null, key: null })
  const [file, setFile]     = useState<File | null>(null)
  const [fileUrl, setFileUrl] = useState<string | null>(null)
  const [duration, setDuration] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const [progress, setProgress] = useState(0)
  const fileInputRef = useRef<HTMLInputElement>(null)

  async function pickFile(f: File | null) {
    if (fileUrl) URL.revokeObjectURL(fileUrl)
    if (!f) { setFile(null); setFileUrl(null); setDuration(0); return }
    setFile(f)
    setFileUrl(URL.createObjectURL(f))
    setDuration(await readAudioMeta(f))
  }

  function xhrPut(url: string, blob: File, contentType: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest()
      xhr.open('PUT', url)
      xhr.setRequestHeader('Content-Type', contentType)
      xhr.upload.onprogress = e => { if (e.lengthComputable) setProgress(Math.round((e.loaded / e.total) * 100)) }
      xhr.onload  = () => (xhr.status >= 200 && xhr.status < 300) ? resolve() : reject(new Error('Upload failed'))
      xhr.onerror = () => reject(new Error('Upload failed'))
      xhr.send(blob)
    })
  }

  async function submitBlog() {
    if (!title.trim() || !body.trim()) { pushToast('error', 'Title and post text are required.'); return }
    setSubmitting(true)
    try {
      const res = await fetch('/api/community/posts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title, body }) })
      const data = await res.json()
      if (!res.ok) { pushToast('error', data.error || 'Failed to post.'); return }
      onPosted({ ...data.post, audioUrl: null })
      pushToast('success', 'Posted to Community.')
      onClose()
    } catch { pushToast('error', 'Network error.') }
    finally { setSubmitting(false) }
  }

  async function submitMix() {
    if (!title.trim())                             { pushToast('error', 'Give your mix a title.'); return }
    if (!track1.artist.trim() || !track1.title.trim() || !track2.artist.trim() || !track2.title.trim()) {
      pushToast('error', 'Both tracks need an artist and title.'); return
    }
    if (!file) { pushToast('error', 'Choose an audio file of the two tracks blending together.'); return }
    if (mixQuota && !mixQuota.allowed) { pushToast('error', 'You’ve used all your mix uploads. Upgrade to Pro for more.'); return }
    if (mixQuota && file.size > mixQuota.maxFileBytes) { pushToast('error', `File too large — max ${fmtBytes(mixQuota.maxFileBytes)} on your plan.`); return }

    setSubmitting(true); setProgress(0)
    try {
      const signRes = await fetch('/api/community/mixes/upload-url', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contentType: file.type, fileSizeBytes: file.size, durationSec: Math.round(duration) }),
      })
      const signData = await signRes.json()
      if (!signRes.ok) { pushToast('error', signData.error || 'Upload rejected.'); return }

      const uploadUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/upload/sign/community-audio/${signData.path}?token=${signData.token}`
      await xhrPut(uploadUrl, file, file.type)

      const finalRes = await fetch('/api/community/mixes', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: signData.path, title, body, track1, track2, durationSec: duration, sizeBytes: file.size }),
      })
      const finalData = await finalRes.json()
      if (!finalRes.ok) { pushToast('error', finalData.error || 'Failed to publish mix.'); return }

      const audioBase = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/community-audio/`
      onPosted({ ...finalData.post, audioUrl: audioBase + signData.path })
      pushToast('success', 'Mix published to Community.')
      onClose()
    } catch { pushToast('error', 'Network error during upload.') }
    finally { setSubmitting(false) }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(6,6,12,.9)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, backdropFilter: 'blur(8px)' }} onClick={onClose}>
      <div style={{ background: '#0a0a14', border: '1px solid #1f1f38', borderRadius: 20, padding: 28, maxWidth: 640, width: '100%', maxHeight: '90vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
          <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 26, letterSpacing: 1 }}>NEW POST</div>
          <button onClick={onClose} className="sf-btn-ghost" style={{ padding: '6px 10px', borderRadius: 8, fontSize: 12 }}>✕</button>
        </div>

        <div style={{ display: 'inline-flex', border: '1px solid #1f1f33', borderRadius: 10, overflow: 'hidden', marginBottom: 18 }}>
          {(['blog', 'mix'] as const).map(m => (
            <button key={m} onClick={() => setMode(m)} style={{ padding: '8px 20px', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700, letterSpacing: 1, fontFamily: 'JetBrains Mono,monospace', background: mode === m ? `linear-gradient(100deg,${M},${C})` : 'transparent', color: mode === m ? '#06060c' : '#8a8aa8' }}>
              {m === 'blog' ? '✎ BLOG POST' : '🎧 MIX UPLOAD'}
            </button>
          ))}
        </div>

        <input className="sf-input" placeholder="Title" value={title} onChange={e => setTitle(e.target.value)} maxLength={120} style={{ marginBottom: 12, fontSize: 14, padding: '10px 12px' }} />

        {mode === 'blog' ? (
          <textarea className="sf-input" placeholder="Share a tip, a story, a question for the community…" value={body} onChange={e => setBody(e.target.value)} maxLength={8000} rows={8} style={{ resize: 'vertical', lineHeight: 1.6, marginBottom: 6 }} />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <textarea className="sf-input" placeholder="Caption (optional) — what technique did you use for this blend?" value={body} onChange={e => setBody(e.target.value)} maxLength={2000} rows={2} style={{ resize: 'vertical', lineHeight: 1.5 }} />
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <TrackFields label="TRACK 1" value={track1} onChange={setTrack1} />
              <TrackFields label="TRACK 2" value={track2} onChange={setTrack2} />
            </div>
            <CompatBadge track1={track1} track2={track2} />

            <div>
              <input ref={fileInputRef} type="file" accept="audio/*" style={{ display: 'none' }} onChange={e => pickFile(e.target.files?.[0] ?? null)} />
              {!file ? (
                <button onClick={() => fileInputRef.current?.click()} className="sf-btn-ghost" style={{ padding: '12px 16px', borderRadius: 10, fontSize: 12, width: '100%', letterSpacing: 1 }}>
                  ↑ CHOOSE AUDIO FILE OF THE BLEND
                </button>
              ) : (
                <div style={{ background: '#06060c', border: '1px solid #1a1a2e', borderRadius: 10, padding: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, fontSize: 11, color: '#9a9ab8' }}>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file.name} · {fmtBytes(file.size)}{duration ? ` · ${fmtDuration(duration)}` : ''}</span>
                    <button onClick={() => pickFile(null)} className="sf-del-btn">remove</button>
                  </div>
                  {fileUrl && <audio controls src={fileUrl} style={{ width: '100%', height: 32 }} />}
                </div>
              )}
              {mixQuota && (
                <div style={{ fontSize: 10, color: mixQuota.remaining === 0 ? M : '#4a4a66', marginTop: 6 }}>
                  {mixQuota.remaining === 0 ? 'No mix uploads left on your plan — ' : `${mixQuota.remaining} mix upload${mixQuota.remaining === 1 ? '' : 's'} left · `}
                  max {fmtBytes(mixQuota.maxFileBytes)} / {Math.round(mixQuota.maxDurationSec / 60)} min
                  {mixQuota.remaining === 0 && <Link href="/#pricing" style={{ color: C }}> upgrade →</Link>}
                </div>
              )}
            </div>
          </div>
        )}

        {submitting && mode === 'mix' && file && (
          <div style={{ marginTop: 12, height: 4, background: '#1a1a2e', borderRadius: 999, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${progress}%`, background: `linear-gradient(90deg,${M},${C})`, transition: 'width .15s' }} />
          </div>
        )}

        <button onClick={mode === 'blog' ? submitBlog : submitMix} disabled={submitting} className="sf-btn-primary" style={{ width: '100%', padding: '13px 0', borderRadius: 10, fontSize: 14, marginTop: 16 }}>
          {submitting ? (mode === 'mix' && progress > 0 && progress < 100 ? `UPLOADING ${progress}%…` : 'PUBLISHING…') : mode === 'blog' ? 'PUBLISH POST' : 'PUBLISH MIX'}
        </button>
      </div>
    </div>
  )
}

// ── Comment row (top-level or reply) ────────────────────────────
function CommentRow({ comment, isOwn, isReply, onReply, onDelete }: {
  comment: CommentItem; isOwn: boolean; isReply: boolean
  onReply?: () => void; onDelete: () => void
}) {
  const [confirmDelete, setConfirmDelete] = useState(false)
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
      {comment.author_image
        ? <img src={comment.author_image} alt="" width={22} height={22} style={{ borderRadius: '50%', flexShrink: 0, marginTop: 1 }} />
        : <div style={{ width: 22, height: 22, borderRadius: '50%', background: `linear-gradient(135deg,${M},${C})`, flexShrink: 0 }} />}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 11 }}>
          <span style={{ fontWeight: 700, color: '#e8e8f0' }}>{comment.author_name || 'DJ'}</span>
          <span style={{ color: '#4a4a66', marginLeft: 6 }}>{timeAgo(comment.created_at)}</span>
        </div>
        <div style={{ fontSize: 12, color: '#c8c8e0', lineHeight: 1.5, whiteSpace: 'pre-wrap', marginTop: 2 }}>{comment.body}</div>
        <div style={{ display: 'flex', gap: 10, marginTop: 3 }}>
          {!isReply && onReply && <button onClick={onReply} style={{ background: 'none', border: 'none', color: '#5a5a78', fontSize: 10, cursor: 'pointer', padding: 0, fontFamily: 'JetBrains Mono,monospace' }}>reply</button>}
          {isOwn && (
            confirmDelete ? (
              <span style={{ display: 'flex', gap: 8 }}>
                <button onClick={onDelete} style={{ background: 'none', border: 'none', color: M, fontSize: 10, cursor: 'pointer', padding: 0, fontFamily: 'JetBrains Mono,monospace' }}>confirm</button>
                <button onClick={() => setConfirmDelete(false)} style={{ background: 'none', border: 'none', color: '#5a5a78', fontSize: 10, cursor: 'pointer', padding: 0, fontFamily: 'JetBrains Mono,monospace' }}>cancel</button>
              </span>
            ) : (
              <button onClick={() => setConfirmDelete(true)} style={{ background: 'none', border: 'none', color: '#5a5a78', fontSize: 10, cursor: 'pointer', padding: 0, fontFamily: 'JetBrains Mono,monospace' }}>delete</button>
            )
          )}
        </div>
      </div>
    </div>
  )
}

// ── Comments section (lazy-loaded, one level of replies) ────────
function CommentsSection({ postId, currentUserId, isSignedIn, pushToast, onCountChange }: {
  postId: string; currentUserId: string | null; isSignedIn: boolean | undefined
  pushToast: (type: 'success' | 'error', msg: string) => void
  onCountChange: (delta: number) => void
}) {
  const [comments, setComments] = useState<CommentItem[]>([])
  const [loaded, setLoaded] = useState(false)
  const [newComment, setNewComment] = useState('')
  const [posting, setPosting] = useState(false)
  const [replyingTo, setReplyingTo] = useState<string | null>(null)
  const [replyText, setReplyText] = useState('')
  const [replyPosting, setReplyPosting] = useState(false)

  useEffect(() => {
    fetch(`/api/community/comments?postId=${postId}`).then(r => r.json()).then(d => { if (!d.error) setComments(d.comments ?? []) }).finally(() => setLoaded(true))
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load once per mount (section is unmounted/remounted on collapse/expand, not re-fetched on prop churn)
  }, [])

  async function submitComment() {
    if (!isSignedIn) { pushToast('error', 'Sign in to comment.'); return }
    if (!newComment.trim()) return
    setPosting(true)
    try {
      const res = await fetch('/api/community/comments', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ postId, body: newComment.trim() }) })
      const data = await res.json()
      if (!res.ok) { pushToast('error', data.error || 'Failed to comment.'); return }
      setComments(prev => [...prev, { ...data.comment, replies: [] }])
      setNewComment('')
      onCountChange(1)
    } catch { pushToast('error', 'Network error.') }
    finally { setPosting(false) }
  }

  async function submitReply(parentId: string) {
    if (!isSignedIn) { pushToast('error', 'Sign in to reply.'); return }
    if (!replyText.trim()) return
    setReplyPosting(true)
    try {
      const res = await fetch('/api/community/comments', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ postId, body: replyText.trim(), parentId }) })
      const data = await res.json()
      if (!res.ok) { pushToast('error', data.error || 'Failed to reply.'); return }
      setComments(prev => prev.map(c => c.id === parentId ? { ...c, replies: [...(c.replies ?? []), data.comment] } : c))
      setReplyText(''); setReplyingTo(null)
      onCountChange(1)
    } catch { pushToast('error', 'Network error.') }
    finally { setReplyPosting(false) }
  }

  async function deleteComment(id: string, parentId: string | null) {
    try {
      const res = await fetch(`/api/community/comments/item?id=${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
      if (parentId) {
        setComments(prev => prev.map(c => c.id === parentId ? { ...c, replies: (c.replies ?? []).filter(r => r.id !== id) } : c))
        onCountChange(-1)
      } else {
        const removed = comments.find(c => c.id === id)
        setComments(prev => prev.filter(c => c.id !== id))
        onCountChange(-(1 + (removed?.replies?.length ?? 0)))
      }
    } catch { pushToast('error', 'Failed to delete comment.') }
  }

  return (
    <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid #16162a', display: 'flex', flexDirection: 'column', gap: 12 }}>
      {!loaded ? (
        <div style={{ fontSize: 11, color: '#4a4a66' }}>Loading comments…</div>
      ) : comments.length === 0 ? (
        <div style={{ fontSize: 11, color: '#4a4a66' }}>No comments yet — be the first to say something.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {comments.map(c => (
            <div key={c.id} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <CommentRow comment={c} isOwn={c.user_id === currentUserId} isReply={false}
                onReply={() => setReplyingTo(replyingTo === c.id ? null : c.id)}
                onDelete={() => deleteComment(c.id, null)} />
              {(c.replies ?? []).map(r => (
                <div key={r.id} style={{ marginLeft: 30 }}>
                  <CommentRow comment={r} isOwn={r.user_id === currentUserId} isReply
                    onDelete={() => deleteComment(r.id, c.id)} />
                </div>
              ))}
              {replyingTo === c.id && (
                <div style={{ marginLeft: 30, display: 'flex', gap: 6 }}>
                  <input className="sf-input" placeholder={`Reply to ${c.author_name || 'DJ'}…`} value={replyText} onChange={e => setReplyText(e.target.value)} onKeyDown={e => e.key === 'Enter' && submitReply(c.id)} maxLength={2000} style={{ fontSize: 12, padding: '6px 10px' }} autoFocus />
                  <button onClick={() => submitReply(c.id)} disabled={replyPosting || !replyText.trim()} className="sf-btn-ghost" style={{ padding: '6px 12px', borderRadius: 7, fontSize: 10, whiteSpace: 'nowrap' }}>{replyPosting ? '…' : 'REPLY'}</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', gap: 6 }}>
        <input className="sf-input" placeholder={isSignedIn ? 'Add a comment…' : 'Sign in to comment'} value={newComment} onChange={e => setNewComment(e.target.value)} onKeyDown={e => e.key === 'Enter' && submitComment()} maxLength={2000} disabled={!isSignedIn} style={{ fontSize: 12, padding: '7px 10px' }} />
        <button onClick={submitComment} disabled={posting || !newComment.trim() || !isSignedIn} className="sf-btn-ghost" style={{ padding: '7px 14px', borderRadius: 7, fontSize: 10, whiteSpace: 'nowrap' }}>{posting ? '…' : 'POST'}</button>
      </div>
    </div>
  )
}

// ── Post card ─────────────────────────────────────────────────
function PostCard({ post, liked, isOwn, currentUserId, isSignedIn, pushToast, onLike, onDelete }: {
  post: Post; liked: boolean; isOwn: boolean; currentUserId: string | null; isSignedIn: boolean | undefined
  pushToast: (type: 'success' | 'error', msg: string) => void
  onLike: (id: string) => void; onDelete: (id: string) => void
}) {
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [commentsOpen, setCommentsOpen] = useState(false)
  const [commentCount, setCommentCount] = useState(post.comment_count)
  const track1: TrackInfo = { artist: post.track1_artist ?? '', title: post.track1_title ?? '', bpm: post.track1_bpm, key: post.track1_key }
  const track2: TrackInfo = { artist: post.track2_artist ?? '', title: post.track2_title ?? '', bpm: post.track2_bpm, key: post.track2_key }

  return (
    <div className="lib-card" style={{ background: '#0a0a14', border: '1px solid #1a1a2e', borderRadius: 16, padding: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        {post.author_image
          ? <img src={post.author_image} alt="" width={30} height={30} style={{ borderRadius: '50%', flexShrink: 0 }} />
          : <div style={{ width: 30, height: 30, borderRadius: '50%', background: `linear-gradient(135deg,${M},${C})`, flexShrink: 0 }} />}
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#e8e8f0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {post.author_handle ? <Link href={`/u?handle=${post.author_handle}`} style={{ color: 'inherit', textDecoration: 'none' }}>{post.author_name || 'DJ'}</Link> : (post.author_name || 'DJ')}
          </div>
          <div style={{ fontSize: 10, color: '#4a4a66' }}>{timeAgo(post.created_at)} · {post.type === 'mix' ? '🎧 mix' : '✎ post'}</div>
        </div>
        {isOwn && (
          <div style={{ marginLeft: 'auto', flexShrink: 0 }}>
            {confirmDelete ? (
              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={() => onDelete(post.id)} className="sf-del-btn" style={{ borderColor: M, color: M }}>confirm</button>
                <button onClick={() => setConfirmDelete(false)} className="sf-del-btn">cancel</button>
              </div>
            ) : (
              <button onClick={() => setConfirmDelete(true)} className="sf-del-btn">delete</button>
            )}
          </div>
        )}
      </div>

      <div style={{ fontSize: 15, fontWeight: 700, color: '#e8e8f0', marginBottom: post.type === 'mix' ? 10 : 6 }}>{post.title}</div>

      {post.type === 'mix' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <div style={{ fontSize: 11, color: '#9a9ab8', background: '#06060c', border: '1px solid #1a1a2e', borderRadius: 8, padding: '5px 10px' }}>
              {track1.artist} — {track1.title}{track1.bpm ? ` · ${track1.bpm} BPM` : ''}{track1.key ? ` · ${track1.key}` : ''}
            </div>
            <span style={{ color: '#4a4a66', fontSize: 14 }}>→</span>
            <div style={{ fontSize: 11, color: '#9a9ab8', background: '#06060c', border: '1px solid #1a1a2e', borderRadius: 8, padding: '5px 10px' }}>
              {track2.artist} — {track2.title}{track2.bpm ? ` · ${track2.bpm} BPM` : ''}{track2.key ? ` · ${track2.key}` : ''}
            </div>
            <CompatBadge track1={track1} track2={track2} />
          </div>
          {post.body && <div style={{ fontSize: 12, color: '#9a9ab8', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{post.body}</div>}
          {post.audioUrl && <audio controls src={post.audioUrl} style={{ width: '100%', height: 36 }} />}
          {post.audio_duration_sec ? <div style={{ fontSize: 10, color: '#4a4a66' }}>{fmtDuration(post.audio_duration_sec)}</div> : null}
        </div>
      ) : (
        <div style={{ fontSize: 13, color: '#c8c8e0', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{post.body}</div>
      )}

      <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid #16162a', display: 'flex', gap: 8 }}>
        <button onClick={() => onLike(post.id)} className="sf-btn-ghost" style={{ padding: '5px 12px', borderRadius: 999, fontSize: 12, borderColor: liked ? M : undefined, color: liked ? M : undefined }}>
          {liked ? '♥' : '♡'} {post.like_count}
        </button>
        <button onClick={() => setCommentsOpen(o => !o)} className="sf-btn-ghost" style={{ padding: '5px 12px', borderRadius: 999, fontSize: 12, borderColor: commentsOpen ? C : undefined, color: commentsOpen ? C : undefined }}>
          💬 {commentCount}
        </button>
      </div>

      {commentsOpen && (
        <CommentsSection postId={post.id} currentUserId={currentUserId} isSignedIn={isSignedIn} pushToast={pushToast}
          onCountChange={delta => setCommentCount(n => Math.max(0, n + delta))} />
      )}
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────
export default function CommunityPage() {
  const { isSignedIn } = useAuth()
  const { user }       = useUser()
  const currentUserId  = user?.id ?? null
  const [posts, setPosts]         = useState<Post[]>([])
  const [likedIds, setLikedIds]   = useState<Set<string>>(new Set())
  const [nextCursor, setCursor]   = useState<{ createdAt: string; id: string } | null>(null)
  const [tab, setTab]             = useState<'all' | 'blog' | 'mix'>('all')
  const [followingOnly, setFollowingOnly] = useState(false)
  const [loading, setLoading]     = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [composerOpen, setComposerOpen] = useState(false)
  const [mixQuota, setMixQuota]   = useState<MixQuota | null>(null)
  const [isMobile, setIsMobile]   = useState(false)
  const [toasts, setToasts]       = useState<{ id: number; type: 'success' | 'error'; message: string }[]>([])
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

  const loadFeed = useCallback(() => {
    const params = new URLSearchParams()
    if (tab !== 'all') params.set('type', tab)
    if (followingOnly) params.set('scope', 'following')
    fetch(`/api/community/posts?${params}`)
      .then(r => r.json())
      .then(d => {
        if (d.error) return
        setPosts(d.posts ?? [])
        setLikedIds(new Set(d.likedIds ?? []))
        setCursor(d.nextCursor && d.nextCursorId ? { createdAt: d.nextCursor, id: d.nextCursorId } : null)
      })
      .finally(() => setLoading(false))
  }, [tab, followingOnly])

  useEffect(() => { loadFeed() }, [loadFeed])

  function selectTab(t: 'all' | 'blog' | 'mix') {
    setLoading(true)
    setTab(t)
  }

  function toggleFollowingOnly() {
    setLoading(true)
    setFollowingOnly(f => !f)
  }

  function loadMore() {
    if (!nextCursor) return
    setLoadingMore(true)
    const params = new URLSearchParams()
    if (tab !== 'all') params.set('type', tab)
    if (followingOnly) params.set('scope', 'following')
    params.set('before', nextCursor.createdAt)
    params.set('beforeId', nextCursor.id)
    fetch(`/api/community/posts?${params}`)
      .then(r => r.json())
      .then(d => {
        if (d.error) return
        setPosts(prev => [...prev, ...(d.posts ?? [])])
        setLikedIds(prev => new Set([...prev, ...(d.likedIds ?? [])]))
        setCursor(d.nextCursor && d.nextCursorId ? { createdAt: d.nextCursor, id: d.nextCursorId } : null)
      })
      .finally(() => setLoadingMore(false))
  }

  function openComposer() {
    if (!isSignedIn) { pushToast('error', 'Sign in to post to the community.'); return }
    fetch('/api/community/mixes/quota').then(r => r.json()).then(d => { if (!d.error) setMixQuota(d) }).catch(() => {})
    setComposerOpen(true)
  }

  async function toggleLike(id: string) {
    if (!isSignedIn) { pushToast('error', 'Sign in to like posts.'); return }
    const wasLiked = likedIds.has(id)
    setLikedIds(prev => { const n = new Set(prev); if (wasLiked) n.delete(id); else n.add(id); return n })
    setPosts(prev => prev.map(p => p.id === id ? { ...p, like_count: p.like_count + (wasLiked ? -1 : 1) } : p))
    try {
      const res = await fetch(`/api/community/likes?postId=${id}`, { method: 'POST' })
      if (!res.ok) throw new Error()
    } catch {
      setLikedIds(prev => { const n = new Set(prev); if (wasLiked) n.add(id); else n.delete(id); return n })
      setPosts(prev => prev.map(p => p.id === id ? { ...p, like_count: p.like_count + (wasLiked ? 1 : -1) } : p))
      pushToast('error', 'Failed to update like.')
    }
  }

  async function deletePost(id: string) {
    try {
      const res = await fetch(`/api/community/posts/item?id=${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
      setPosts(prev => prev.filter(p => p.id !== id))
      pushToast('success', 'Post deleted.')
    } catch { pushToast('error', 'Failed to delete post.') }
  }

  return (
    <div style={{ minHeight: '100vh', background: '#06060c', color: '#e8e8f0', fontFamily: "'Inter',system-ui,sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=JetBrains+Mono:wght@400;500;700&display=swap');
        .sf-input { background:#0d0d18; border:1px solid #1f1f33; color:#e8e8f0; font-family:'Inter',system-ui,sans-serif; font-size:13px; padding:9px 12px; border-radius:8px; width:100%; outline:none; transition:.2s; box-sizing:border-box; }
        .sf-input:focus { border-color:${C}; box-shadow:0 0 0 3px ${C}18; }
        .sf-btn-primary { background:linear-gradient(100deg,${M},${C}); color:#06060c; font-weight:700; border:none; cursor:pointer; font-family:'JetBrains Mono',monospace; transition:box-shadow .2s,transform .15s; }
        .sf-btn-primary:hover:enabled { box-shadow:0 0 0 3px ${C}44; transform:translateY(-1px); }
        .sf-btn-primary:disabled { opacity:.5; cursor:default; }
        .sf-btn-ghost { background:transparent; border:1px solid #23233a; color:#8a8aa8; cursor:pointer; font-family:'JetBrains Mono',monospace; transition:.18s; }
        .sf-btn-ghost:hover { border-color:${C}; color:${C}; }
        .sf-del-btn { background:transparent; border:1px solid #23233a; color:#5a5a78; cursor:pointer; font-family:'JetBrains Mono',monospace; font-size:10px; padding:4px 8px; border-radius:5px; transition:.18s; }
        .sf-del-btn:hover { border-color:${M}; color:${M}; }
        .lib-card:hover { border-color:#23233a!important; }
        @keyframes toast-in { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:none} }
        * { box-sizing:border-box; }
      `}</style>

      {/* Toasts */}
      <div role="status" aria-live="polite" style={{ position: 'fixed', bottom: 20, right: 20, zIndex: 250, display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 320 }}>
        {toasts.map(t => (
          <div key={t.id} style={{ animation: 'toast-in .25s ease', background: '#0a0a14', border: `1px solid ${t.type === 'success' ? C : M}66`, borderRadius: 10, padding: '10px 14px', fontSize: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ color: t.type === 'success' ? C : M, fontWeight: 700 }}>{t.type === 'success' ? '✓' : '✕'}</span>{t.message}
          </div>
        ))}
      </div>

      {composerOpen && <Composer mixQuota={mixQuota} onPosted={p => setPosts(prev => [p, ...prev])} onClose={() => setComposerOpen(false)} pushToast={pushToast} />}

      {/* NAV */}
      <nav style={{ position: 'sticky', top: 0, zIndex: 50, borderBottom: '1px solid #1a1a2e', backdropFilter: 'blur(16px)', background: 'rgba(6,6,12,.88)', padding: isMobile ? '0 10px' : '0 24px', overflowX: 'auto' }}>
        <div style={{ maxWidth: 900, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 56 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 8 : 16 }}>
            <Link href="/" style={{ textDecoration: 'none' }}>
              <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: isMobile ? 20 : 24, letterSpacing: 2 }}>
                <span style={{ color: C }}>SET</span><span style={{ color: M }}>FORGE</span>
              </div>
            </Link>
            {!isMobile && <div style={{ fontSize: 12, color: '#4a4a66', fontFamily: 'JetBrains Mono,monospace' }}>/ COMMUNITY</div>}
          </div>
          <div style={{ display: 'flex', gap: isMobile ? 6 : 10, alignItems: 'center' }}>
            <Link href="/app" style={{ textDecoration: 'none' }}><button className="sf-btn-ghost" style={{ padding: isMobile ? '7px 10px' : '7px 14px', borderRadius: 8, fontSize: 12, whiteSpace: 'nowrap' }}>⚡{!isMobile && ' Forge'}</button></Link>
            <Link href="/mix" style={{ textDecoration: 'none' }}><button className="sf-btn-ghost" style={{ padding: isMobile ? '7px 10px' : '7px 14px', borderRadius: 8, fontSize: 12, whiteSpace: 'nowrap' }}>🎛️{!isMobile && ' Mix'}</button></Link>
            <Link href="/wiki" style={{ textDecoration: 'none' }}><button className="sf-btn-ghost" style={{ padding: isMobile ? '7px 10px' : '7px 14px', borderRadius: 8, fontSize: 12, whiteSpace: 'nowrap' }}>📖{!isMobile && ' Wiki'}</button></Link>
            {isSignedIn && <Link href="/u?me=1" style={{ textDecoration: 'none' }}><button className="sf-btn-ghost" style={{ padding: isMobile ? '7px 10px' : '7px 14px', borderRadius: 8, fontSize: 12, whiteSpace: 'nowrap' }}>👤{!isMobile && ' Profile'}</button></Link>}
            {isSignedIn && <NotificationBell />}
            {isSignedIn ? <UserButton /> : <Link href="/sign-in"><button className="sf-btn-primary" style={{ padding: '7px 16px', borderRadius: 8, fontSize: 12 }}>Sign in</button></Link>}
          </div>
        </div>
      </nav>

      <div style={{ maxWidth: 900, margin: '0 auto', padding: isMobile ? '24px 14px 60px' : '40px 24px 80px' }}>

        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ fontSize: 11, color: M, fontFamily: 'JetBrains Mono,monospace', letterSpacing: 3, marginBottom: 10 }}>THE CROWD</div>
          <h1 style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 'clamp(36px,6vw,60px)', margin: '0 0 10px', letterSpacing: 1, lineHeight: 1 }}>
            <span style={{ color: C }}>COMM</span><span style={{ color: M }}>UNITY</span>
          </h1>
          <p style={{ fontSize: 13, color: '#6a6a8a', margin: 0 }}>Share tips, ask questions, and post real blends of two tracks mixing together.</p>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, gap: 10, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ display: 'inline-flex', border: '1px solid #1f1f33', borderRadius: 10, overflow: 'hidden' }}>
              {([['all', 'All'], ['blog', '✎ Posts'], ['mix', '🎧 Mixes']] as const).map(([v, label]) => (
                <button key={v} onClick={() => selectTab(v)} style={{ padding: '8px 16px', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600, fontFamily: 'JetBrains Mono,monospace', background: tab === v ? `linear-gradient(100deg,${M},${C})` : 'transparent', color: tab === v ? '#06060c' : '#8a8aa8' }}>
                  {label}
                </button>
              ))}
            </div>
            {isSignedIn && (
              <button onClick={toggleFollowingOnly} className="sf-btn-ghost" style={{ padding: '8px 16px', borderRadius: 10, fontSize: 12, borderColor: followingOnly ? C : undefined, color: followingOnly ? C : undefined }}>
                {followingOnly ? '★ Following' : '☆ Following only'}
              </button>
            )}
          </div>
          <button onClick={openComposer} className="sf-btn-primary" style={{ padding: '9px 18px', borderRadius: 9, fontSize: 12, letterSpacing: 1 }}>+ NEW POST</button>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: '#4a4a66', fontSize: 13 }}>Loading community…</div>
        ) : posts.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: '#4a4a66', fontSize: 13, border: '1px dashed #1a1a2e', borderRadius: 16 }}>
            Nothing here yet — be the first to share a mix or a tip.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {posts.map(p => (
              <PostCard key={p.id} post={p} liked={likedIds.has(p.id)} isOwn={p.user_id === currentUserId}
                currentUserId={currentUserId} isSignedIn={isSignedIn} pushToast={pushToast}
                onLike={toggleLike} onDelete={deletePost} />
            ))}
          </div>
        )}

        {nextCursor && !loading && (
          <div style={{ textAlign: 'center', marginTop: 24 }}>
            <button onClick={loadMore} disabled={loadingMore} className="sf-btn-ghost" style={{ padding: '9px 24px', borderRadius: 9, fontSize: 12 }}>
              {loadingMore ? 'Loading…' : 'Load more'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
