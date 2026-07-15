// ▸ Place at: app/app/page.tsx (full replacement)

'use client'

import { useState, useEffect, useRef } from 'react'
import { UserButton } from '@clerk/nextjs'
import Link from 'next/link'
import NotificationBell from '../components/NotificationBell'
import EnergyEditor, { ENERGY_PRESETS, resampleEnergyPoints } from '../components/EnergyEditor'
import TagScanner from '../components/TagScanner'
import { toRekordboxXML, toSeratoM3U, toTraktorNML, downloadFile } from '@/lib/export-utils'
import MixSimulator from '../components/MixSimulator'
import SetlistImporter, { ImportedTrack } from '../components/SetlistImporter'
import OnboardingWizard, { WizardResult } from '../components/OnboardingWizard'

// ── Constants ─────────────────────────────────────────────────
const GENRE_GROUPS: Record<string, string[]> = {
  'House':          ['House','Tech House','Deep House','Progressive House','Afro House','Melodic House','Soulful House','Tribal House','Bass House','Future House'],
  'Techno':         ['Techno','Melodic Techno','Peak Time Techno','Minimal / Deep Tech','Hard Techno','Industrial Techno','Dub Techno'],
  'Bass & Breaks':  ['Drum & Bass','Dubstep','UK Garage / UKG','Breakbeat','Jungle','Bassline','Future Bass'],
  'Trance':         ['Trance','Progressive Trance','Psytrance','Uplifting Trance','Hard Trance'],
  'Urban / Hip Hop':['Hip Hop','Trap','R&B','Afrobeats','Amapiano','Reggaeton','Dancehall'],
  'Classic / Groove':['Disco / Funk','Nu-Disco','Funky House','Acid House','Old School / 90s','Italo Disco'],
  'Open Format':    ['Open Format / Multi-Genre','Top 40 / Pop','Latin','Reggae / Dub'],
}
const CROWDS  = ['Club Peak Hour','Warm-Up Set','Festival Main Stage','Wedding','House Party','Rooftop / Lounge']
const FAMILIARITY_OPTIONS = ['Popular Hits','Balanced Mix','Deep Cuts / Underground']
const CAM_HUES = [0,30,60,90,120,150,180,210,240,270,300,330]
const MIN_CURVE_POINTS = 3
const GENERATE_STAGES = [
  'Picking real tracks…',
  'Matching BPM and energy…',
  'Checking harmonic keys…',
  'Verifying releases exist…',
  'Writing transition notes…',
]
const C = '#00f0ff'
const M = '#ff1e8a'

// ── Types ─────────────────────────────────────────────────────
type Track      = { n:number; artist:string; title:string; bpm:number; key:string; energy:number; transition:string; verified?:boolean; spotifyId?:string; path?:string }
type SetData    = { title:string; summary:string; tracks:Track[]; _meta?:Record<string,string> }
type LibItem    = { id:string; title:string; meta:Record<string,string|number>; created_at:string; shared_to_team_id?:string|null; is_public?:boolean; share_id?:string|null }
type TeamSetItem = { id:string; title:string; meta:Record<string,string|number>; sharedBy:string; isOwn:boolean; updatedAt:string }
type Suggestion = Track & { label:string }
type LikedTrack = { id:string; artist:string; title:string; bpm?:number; key?:string; energy?:number; genre?:string }

function trackKey(artist: string, title: string): string {
  return `${artist.toLowerCase().trim()}::${title.toLowerCase().trim()}`
}

// ── Draft persistence ─────────────────────────────────────────
// Recovers an in-progress, unsaved session (form inputs + generated set) after
// an accidental refresh/tab close — the only durable copy otherwise is the
// explicit "Save to library" action.
type Draft = {
  genre?: string; customGenre?: string; crowd?: string; familiarity?: string
  vibe?: string; refArtist?: string; mode?: 'time'|'count'; minutes?: number; count?: number
  bpmLow?: number; bpmHigh?: number; keyMatch?: boolean; includeMixingNotes?: boolean
  energyPoints?: number[]; set?: SetData | null; locked?: number[]; useLikedPool?: boolean
}
function readDraft(): Draft {
  try {
    const raw = localStorage.getItem('sf_draft')
    return raw ? JSON.parse(raw) : {}
  } catch { return {} }
}

// If a Clerk session expires, the middleware silently redirects protected API
// calls to the sign-in page instead of returning 401 — fetch follows that
// redirect and hands back a 200 response, so `res.ok` alone can't tell it
// apart from a real success. The redirected response is HTML, not JSON, so
// checking content-type first is what actually catches it.
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- matches the untyped res.json() this replaces everywhere it's used
async function parseJsonResponse(res: Response): Promise<any> {
  const contentType = res.headers.get('content-type') || ''
  if (!contentType.includes('application/json')) throw new Error('SESSION_EXPIRED')
  return res.json()
}

// ── Main component ────────────────────────────────────────────
export default function AppPage() {
  const [draft] = useState<Draft>(() => readDraft())

  // form — restored from the last unsaved session where available
  const [genre,        setGenre]        = useState(() => draft.genre ?? 'House')
  const [crowd,        setCrowd]        = useState(() => draft.crowd ?? 'House Party')
  const [familiarity,  setFamiliarity]  = useState(() => draft.familiarity ?? 'Balanced Mix')
  const [vibe,         setVibe]         = useState(() => draft.vibe ?? '')
  const [refArtist,    setRefArtist]    = useState(() => draft.refArtist ?? '')
  const [mode,         setMode]         = useState<'time'|'count'>(() => draft.mode ?? 'time')
  const [minutes,      setMinutes]      = useState(() => draft.minutes ?? 60)
  const [count,        setCount]        = useState(() => draft.count ?? 12)
  const [bpmLow,       setBpmLow]       = useState(() => draft.bpmLow ?? 118)
  const [bpmHigh,      setBpmHigh]      = useState(() => draft.bpmHigh ?? 125)
  const [keyMatch,           setKeyMatch]           = useState(() => draft.keyMatch ?? true)
  const [includeMixingNotes, setIncludeMixingNotes] = useState(() => draft.includeMixingNotes ?? true)
  const [useLikedPool,       setUseLikedPool]       = useState(() => draft.useLikedPool ?? false)
  const [energyPoints, setEnergyPoints] = useState<number[]>(() =>
    Array.isArray(draft.energyPoints) && draft.energyPoints.length >= MIN_CURVE_POINTS
      ? draft.energyPoints
      : resampleEnergyPoints(ENERGY_PRESETS['Wave'], Math.round((draft.minutes ?? 60) / 4.5)))
  const [customGenre,  setCustomGenre]  = useState(() => draft.customGenre ?? '')
  const effectiveGenre = genre === '__custom__' ? customGenre.trim() : genre

  // generator
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState<string|null>(null)
  const [loadingStage, setLoadingStage] = useState(0)
  const [wasLoading,   setWasLoading]   = useState(false)
  if (loading !== wasLoading) {
    setWasLoading(loading)
    if (loading) setLoadingStage(0)
  }
  useEffect(() => {
    if (!loading) return
    const t = setInterval(() => setLoadingStage(s => (s + 1) % GENERATE_STAGES.length), 2200)
    return () => clearInterval(t)
  }, [loading])
  const [set,      setSet]      = useState<SetData|null>(() => draft.set ?? null)
  const [swapping,      setSwapping]      = useState<number|null>(null)
  const [swapModal,     setSwapModal]     = useState<{ index:number; suggestions:Suggestion[] }|null>(null)
  const [locked,       setLocked]       = useState<Set<number>>(() => new Set(draft.locked ?? []))
  const [copied,       setCopied]       = useState(false)
  const [dragIndex,    setDragIndex]    = useState<number|null>(null)
  const [dragOverIndex,setDragOverIndex]= useState<number|null>(null)
  const [draggedLiked, setDraggedLiked] = useState<LikedTrack|null>(null)
  const [pendingTransitionKeys, setPendingTransitionKeys] = useState<Set<string>>(new Set())
  const [quota,    setQuota]    = useState<{ tier:string; remaining:string|number; trial?:{ active:boolean; daysLeft:number }|null; isFree?:boolean }|null>(null)
  const [trackHistory, setTrackHistory] = useState<string[]>([])
  const [whyData,   setWhyData]   = useState<Record<number, {why:string;inbound:string;outbound:string;tip:string;keyNote:string}>>({})
  const [loadingWhy, setLoadingWhy] = useState<Set<number>>(new Set())
  const [openWhy,   setOpenWhy]   = useState<Set<number>>(new Set())
  const [editingIndex, setEditingIndex] = useState<number|null>(null)
  const [editDraft,    setEditDraft]    = useState<{artist:string;title:string;bpm:string;key:string;energy:number;transition:string}|null>(null)
  const [previewOpen,  setPreviewOpen]  = useState<Set<number>>(new Set())
  const [expandedNotes, setExpandedNotes] = useState<Set<number>>(new Set())

  // toasts — surfaces feedback for actions taken from the results panel (swap,
  // save, share, edit…), which the old single `error` banner couldn't reach on
  // mobile once the left form panel is hidden behind the results view.
  const [toasts, setToasts] = useState<{id:number;type:'success'|'error';message:string}[]>([])
  const toastIdRef = useRef(0)
  function pushToast(type: 'success'|'error', message: string) {
    const id = ++toastIdRef.current
    setToasts(prev => [...prev, { id, type, message }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3500)
  }

  // Let the user know their unsaved set came back after a refresh — otherwise
  // a restored draft looks like a stale bug, not the recovery it actually is.
  useEffect(() => {
    if (draft.set) pushToast('success', 'Restored your last session.')
  }, [draft.set])

  // library
  const [view,        setView]        = useState<'forge'|'library'|'import'>(() => { try { return new URLSearchParams(window.location.search).get('tab') === 'library' ? 'library' : 'forge' } catch { return 'forge' } })
  const [library,     setLibrary]     = useState<LibItem[]>([])
  const [libLoaded,   setLibLoaded]   = useState(false)
  const [libSubTab,   setLibSubTab]   = useState<'sets'|'liked'|'team'>('sets')
  const [likedTracks, setLikedTracks] = useState<LikedTrack[]>([])
  const [likedLoaded, setLikedLoaded] = useState(false)
  const likedKeys = new Set(likedTracks.map(t => trackKey(t.artist, t.title)))
  const [saving,      setSaving]      = useState(false)
  const [savedFlash,  setSavedFlash]  = useState(false)
  const [libLoading,  setLibLoading]  = useState(false)
  const [myTeamId,    setMyTeamId]    = useState<string|null>(null)
  const [shareToTeamOnSave, setShareToTeamOnSave] = useState(false)
  const [teamSets,    setTeamSets]    = useState<TeamSetItem[]>([])
  const [teamSetsLoaded, setTeamSetsLoaded] = useState(false)
  const [sharingTeamId, setSharingTeamId] = useState<string|null>(null)
  const [activeSetId, setActiveSetId] = useState<string|null>(null)
  const [feedback,    setFeedback]    = useState<Record<number,'hit'|'miss'>>({})
  const [importLoading,  setImportLoading]  = useState(false)
  const [importSubTab,   setImportSubTab]   = useState<'library'|'scanner'>('library')
  const [deleteConf,  setDeleteConf]  = useState<string|null>(null)
  const [sharingId,   setSharingId]   = useState<string|null>(null)
  const [copiedId,    setCopiedId]    = useState<string|null>(null)
  const [unshareConf, setUnshareConf] = useState<string|null>(null)
  const [renamingId,  setRenamingId]  = useState<string|null>(null)
  const [renameVal,   setRenameVal]   = useState('')

  // onboarding
  const [showWizard,          setShowWizard]          = useState(() => { try { return !localStorage.getItem('sf_onboarded') } catch { return false } })
  const [firstSetCelebration, setFirstSetCelebration] = useState(false)

  // mobile layout
  const [isMobile,         setIsMobile]         = useState(false)
  const [mobileShowResults,setMobileShowResults] = useState(false)

  const renameRef = useRef<HTMLInputElement>(null)

  // Auto-scroll the results panel while touch-dragging a track near its top/
  // bottom edge — plain touchmove events stop firing once the finger holds
  // still, so a running interval is what keeps the scroll going continuously.
  const resultsPanelRef = useRef<HTMLDivElement>(null)
  const touchYRef = useRef<number | null>(null)
  const autoScrollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  function startAutoScroll() {
    if (autoScrollIntervalRef.current) return
    autoScrollIntervalRef.current = setInterval(() => {
      const container = resultsPanelRef.current
      const y = touchYRef.current
      if (!container || y === null) return
      const rect = container.getBoundingClientRect()
      const EDGE = 60, SPEED = 12
      if (y < rect.top + EDGE) container.scrollTop -= SPEED
      else if (y > rect.bottom - EDGE) container.scrollTop += SPEED
    }, 16)
  }
  function stopAutoScroll() {
    if (autoScrollIntervalRef.current) { clearInterval(autoScrollIntervalRef.current); autoScrollIntervalRef.current = null }
    touchYRef.current = null
  }

  // Mirror the current session to localStorage so a refresh/tab-close doesn't
  // lose an unsaved generated set. Plain sync-to-external-storage effect, not
  // a derived-state one — no setState calls here.
  useEffect(() => {
    try {
      localStorage.setItem('sf_draft', JSON.stringify({
        genre, customGenre, crowd, familiarity, vibe, refArtist, mode, minutes, count,
        bpmLow, bpmHigh, keyMatch, includeMixingNotes, energyPoints, useLikedPool,
        set, locked: [...locked],
      } satisfies Draft))
    } catch {}
  }, [genre, customGenre, crowd, familiarity, vibe, refArtist, mode, minutes, count, bpmLow, bpmHigh, keyMatch, includeMixingNotes, energyPoints, useLikedPool, set, locked])

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 768px)')
    const update = () => setIsMobile(mq.matches)
    update()
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [])
  useEffect(() => { loadLibrary() }, [])
  useEffect(() => { loadLikedTracks() }, [])
  useEffect(() => {
    fetch('/api/quota').then(r => r.json()).then(d => { if (!d.error) setQuota(d) }).catch(() => {})
  }, [])
  useEffect(() => {
    fetch('/api/team').then(r => r.json()).then(d => { if (!d.error) setMyTeamId(d.team?.id ?? null) }).catch(() => {})
  }, [])
  // Curve point count should reflect how many tracks the set will actually have —
  // resample (not reset) so the drawn shape survives a length change instead of
  // reverting to a preset. Adjusted during render (React's sanctioned pattern for
  // "derive state from a changed value"), not in an effect, so it can't lag a frame.
  const maxTracks = quota?.tier === 'free' ? 15 : 50
  const targetTrackCount = Math.max(MIN_CURVE_POINTS, Math.min(maxTracks, mode === 'count' ? count : Math.round(minutes / 4.5)))
  const [resampledForCount, setResampledForCount] = useState(targetTrackCount)
  if (targetTrackCount !== resampledForCount) {
    setResampledForCount(targetTrackCount)
    setEnergyPoints(prev => resampleEnergyPoints(prev, targetTrackCount))
  }
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('tab') === 'library') {
      window.history.replaceState({}, '', '/app')
    }
  }, [])
  useEffect(() => { if (renamingId && renameRef.current) renameRef.current.focus() }, [renamingId])
  useEffect(() => {
    fetch('/api/track-history')
      .then(r => r.json())
      .then(d => { if (d.tracks) setTrackHistory(d.tracks.map((t:{artist:string;title:string}) => `"${t.artist} — ${t.title}"`)) })
      .catch(() => {})
  }, [])

  // ── Generate ──────────────────────────────────────────────
  async function generate(keepLocks = false) {
    setLoading(true); setError(null)
    // Switch mobile to the results view immediately so the loading skeleton is
    // visible during the wait — previously this only flipped on success, so
    // mobile just sat on the form with "FORGING…" the whole time.
    if (isMobile) setMobileShowResults(true)
    const lockedTracks = keepLocks && set ? [...locked].map(i => set.tracks[i]).filter(Boolean) : []
    if (!keepLocks) setLocked(new Set())
    setSet(null); setWhyData({}); setOpenWhy(new Set())
    setActiveSetId(null); setFeedback({})
    try {
      const res  = await fetch('/api/generate', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({
          genre: effectiveGenre, crowd, familiarity, vibe, refArtist,
          mode, minutes, count, bpmLow, bpmHigh, keyMatch,
          lockedTracks, energyPoints, includeMixingNotes,
          recentTracks: trackHistory,
          libraryTracks: useLikedPool ? likedTracks.map(t => ({ artist:t.artist, title:t.title, bpm:t.bpm, key:t.key })) : [],
        }) })
      const data = await parseJsonResponse(res)
      if (!res.ok) { setError(data.error || 'Generation failed.'); if (isMobile) setMobileShowResults(false); return }
      setSet({ ...data.set, _meta:{ genre:effectiveGenre, crowd, familiarity, vibe, refArtist } })
      if (data.quota) setQuota(data.quota)
      if (keepLocks && lockedTracks.length > 0) {
        const newLocked = new Set<number>()
        lockedTracks.forEach(lt => { const idx = data.set.tracks.findIndex((t: Track) => t.artist===lt.artist && t.title===lt.title); if (idx >= 0) newLocked.add(idx) })
        setLocked(newLocked)
      }
      const newEntries = (data.set.tracks as Track[]).map((t: Track) => `"${t.artist} — ${t.title}"`)
      setTrackHistory(prev => [...new Set([...newEntries, ...prev])].slice(0, 200))
      fetch('/api/track-history', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ tracks: data.set.tracks, context: `${effectiveGenre} / ${crowd}` }) }).catch(() => {})
    } catch (err) {
      setError(err instanceof Error && err.message === 'SESSION_EXPIRED' ? 'Your session expired — please sign in again.' : 'Network error. Please try again.')
      if (isMobile) setMobileShowResults(false)
    }
    finally   { setLoading(false) }
  }

  function tryExample() {
    setGenre('Tech House'); setCrowd('Club Peak Hour'); setFamiliarity('Balanced Mix')
    setVibe('dark and hypnotic, late night warehouse'); setRefArtist('Fisher, Chris Lake')
    setMode('time'); setMinutes(60); setBpmLow(122); setBpmHigh(128); setKeyMatch(true)
    setEnergyPoints(resampleEnergyPoints(ENERGY_PRESETS['Slow build'], Math.round(60 / 4.5)))
    setTimeout(() => generate(false), 80)
  }

  // ── Swap ──────────────────────────────────────────────────
  async function swapTrack(index: number) {
    if (!set) return
    setSwapping(index)
    const target = set.tracks[index]
    try {
      const res  = await fetch('/api/swap', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ target, prev:set.tracks[index-1]??null, next:set.tracks[index+1]??null, existing:set.tracks, genre:effectiveGenre, crowd, familiarity, vibe, refArtist, bpmLow, bpmHigh, keyMatch }) })
      const data = await parseJsonResponse(res)
      if (!res.ok) { pushToast('error', data.error || 'Swap failed.'); return }
      setSwapModal({ index, suggestions: (data.suggestions||[]).map((s: Suggestion) => ({ ...s, n: target.n })) })
    } catch (err) { pushToast('error', err instanceof Error && err.message === 'SESSION_EXPIRED' ? 'Your session expired — please sign in again.' : 'Network error.') }
    finally   { setSwapping(null) }
  }

  function applySwapSuggestion(suggestion: Suggestion) {
    if (!swapModal) return
    const { label: _label, ...track } = suggestion
    void _label
    setSet(s => { if (!s) return s; const tracks=[...s.tracks]; tracks[swapModal.index]=track; return {...s,tracks} })
    setSwapModal(null)
  }

  // ── Save ──────────────────────────────────────────────────
  async function saveSet() {
    if (!set||saving) return; setSaving(true)
    try {
      const res  = await fetch('/api/library', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ title:set.title, setData:set, meta:{ genre:set._meta?.genre||genre, crowd:set._meta?.crowd||crowd, familiarity:set._meta?.familiarity||familiarity, vibe:set._meta?.vibe||vibe, refArtist:set._meta?.refArtist||refArtist, trackCount:set.tracks.length, savedAt:Date.now() }, shareToTeam: myTeamId ? shareToTeamOnSave : false }) })
      const data = await parseJsonResponse(res)
      if (!res.ok) { pushToast('error', data.error||'Save failed.'); return }
      setLibrary(prev => [data.set,...prev]); setSavedFlash(true); setTimeout(()=>setSavedFlash(false),2000)
      setActiveSetId(data.set.id); setFeedback({})
      if (shareToTeamOnSave && teamSetsLoaded) loadTeamSets()
    } catch (err) { pushToast('error', err instanceof Error && err.message === 'SESSION_EXPIRED' ? 'Your session expired — please sign in again.' : 'Network error.') }
    finally   { setSaving(false) }
  }


  // ── Library ───────────────────────────────────────────────
  async function loadLibrary() {
    try { const res=await fetch('/api/library'); const data=await res.json(); if (res.ok) setLibrary(data.sets||[]) } catch {}
    finally { setLibLoaded(true) }
  }

  async function loadTeamSets() {
    try { const res=await fetch('/api/team/sets'); const data=await res.json(); if (res.ok) setTeamSets(data.sets||[]) } catch {}
    finally { setTeamSetsLoaded(true) }
  }

  async function toggleShareSet(id: string, currentlyShared: boolean) {
    setSharingTeamId(id)
    try {
      const res = await fetch(`/api/library/item?id=${id}`, { method:'PATCH', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ shareToTeam: !currentlyShared }) })
      const data = await parseJsonResponse(res)
      if (!res.ok) { pushToast('error', data.error||'Failed to update sharing.'); return }
      setLibrary(prev => prev.map(s => s.id===id ? { ...s, shared_to_team_id: data.set.shared_to_team_id } : s))
      pushToast('success', currentlyShared ? 'Unshared from team.' : 'Shared with team.')
      if (teamSetsLoaded) loadTeamSets()
    } catch (err) { pushToast('error', err instanceof Error && err.message === 'SESSION_EXPIRED' ? 'Your session expired — please sign in again.' : 'Network error.') }
    finally { setSharingTeamId(null) }
  }

  async function loadLikedTracks() {
    try { const res=await fetch('/api/liked-tracks'); const data=await res.json(); if (res.ok) setLikedTracks(data.tracks||[]) } catch {}
    finally { setLikedLoaded(true) }
  }

  async function toggleLike(t: Track) {
    const key      = trackKey(t.artist, t.title)
    const existing = likedTracks.find(lt => trackKey(lt.artist, lt.title) === key)

    if (existing) {
      setLikedTracks(prev => prev.filter(lt => lt.id !== existing.id))
      try {
        const res = await fetch(`/api/liked-tracks?id=${existing.id}`, { method:'DELETE' })
        if (!res.ok) throw new Error()
      } catch {
        setLikedTracks(prev => [existing, ...prev])
        pushToast('error', 'Failed to unlike track.')
      }
      return
    }

    const temp: LikedTrack = { id:`temp-${Date.now()}`, artist:t.artist, title:t.title, bpm:t.bpm, key:t.key, energy:t.energy }
    setLikedTracks(prev => [temp, ...prev])
    try {
      const res  = await fetch('/api/liked-tracks', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ artist:t.artist, title:t.title, bpm:t.bpm, key:t.key, energy:t.energy }) })
      const data = await res.json()
      if (!res.ok) throw new Error()
      setLikedTracks(prev => prev.map(lt => lt.id===temp.id ? data.track : lt))
    } catch {
      setLikedTracks(prev => prev.filter(lt => lt.id !== temp.id))
      pushToast('error', 'Failed to like track.')
    }
  }

  async function unlikeById(id: string) {
    const existing = likedTracks.find(lt => lt.id === id)
    setLikedTracks(prev => prev.filter(lt => lt.id !== id))
    try {
      const res = await fetch(`/api/liked-tracks?id=${id}`, { method:'DELETE' })
      if (!res.ok) throw new Error()
    } catch {
      if (existing) setLikedTracks(prev => [existing, ...prev])
      pushToast('error', 'Failed to unlike track.')
    }
  }

  async function loadSet(id: string) {
    setLibLoading(true)
    try {
      const res=await fetch(`/api/library/item?id=${id}`); const data=await parseJsonResponse(res)
      if (!res.ok) { pushToast('error', data.error||'Load failed.'); return }
      const saved: SetData = data.set.set_data; setSet(saved)
      if (saved._meta) { setGenre(saved._meta.genre||genre); setCrowd(saved._meta.crowd||crowd); setFamiliarity(saved._meta.familiarity||'Balanced Mix'); setVibe(saved._meta.vibe||''); setRefArtist(saved._meta.refArtist||'') }
      setActiveSetId(id)
      fetch(`/api/library/feedback?setId=${id}`).then(r => r.json()).then(d => {
        if (d.error) return
        const map: Record<number,'hit'|'miss'> = {}
        for (const f of d.feedback ?? []) map[f.track_n] = f.rating
        setFeedback(map)
      }).catch(() => {})
      if (isMobile) { setView('forge'); setMobileShowResults(true) }
    } catch (err) { pushToast('error', err instanceof Error && err.message === 'SESSION_EXPIRED' ? 'Your session expired — please sign in again.' : 'Network error.') }
    finally   { setLibLoading(false) }
  }

  // Cycles a track's crowd rating: unrated → hit → miss → unrated. Feeds
  // future generations via lib/track-feedback.ts's proven/avoid signal.
  async function rateTrack(t: Track) {
    if (!activeSetId) { pushToast('error', 'Save this set first to rate tracks.'); return }
    const current = feedback[t.n]
    const next: 'hit' | 'miss' | undefined = current === 'hit' ? 'miss' : current === 'miss' ? undefined : 'hit'

    if (next === undefined) {
      setFeedback(prev => { const n = { ...prev }; delete n[t.n]; return n })
      try {
        const res = await fetch(`/api/library/feedback/item?setId=${activeSetId}&trackN=${t.n}`, { method: 'DELETE' })
        if (!res.ok) throw new Error()
      } catch { pushToast('error', 'Failed to clear rating.') }
    } else {
      setFeedback(prev => ({ ...prev, [t.n]: next }))
      try {
        const res = await fetch('/api/library/feedback', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({
          setId: activeSetId, trackN: t.n, artist: t.artist, title: t.title, genre: set?._meta?.genre || genre, rating: next,
        }) })
        const data = await res.json()
        if (!res.ok) { pushToast('error', data.error || 'Failed to save rating.'); setFeedback(prev => { const n = { ...prev }; delete n[t.n]; return n }) }
      } catch { pushToast('error', 'Network error.') }
    }
  }

  async function deleteSet(id: string) {
    try {
      const res = await fetch(`/api/library/item?id=${id}`, { method:'DELETE' })
      const contentType = res.headers.get('content-type') || ''
      if (!contentType.includes('application/json')) { pushToast('error', 'Your session expired — please sign in again.'); return }
      if (!res.ok) { pushToast('error', 'Delete failed.'); return }
      setLibrary(prev=>prev.filter(s=>s.id!==id))
      pushToast('success', 'Set deleted.')
    } catch { pushToast('error', 'Network error.') }
    finally { setDeleteConf(null) }
  }

  async function shareSet(setId: string) {
    setSharingId(setId)
    try {
      const res=await fetch('/api/share',{ method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({setId}) }); const data=await parseJsonResponse(res)
      if (!res.ok) { pushToast('error', data.error||'Share failed.'); return }
      await navigator.clipboard.writeText(`${window.location.origin}/s?id=${data.shareId}`)
      setCopiedId(setId); setTimeout(()=>setCopiedId(null),2500)
      setLibrary(prev => prev.map(s => s.id===setId ? { ...s, is_public:true, share_id:data.shareId } : s))
    } catch (err) { pushToast('error', err instanceof Error && err.message === 'SESSION_EXPIRED' ? 'Your session expired — please sign in again.' : 'Share failed.') }
    finally   { setSharingId(null) }
  }

  async function unshareSet(setId: string) {
    setSharingId(setId)
    try {
      const res = await fetch(`/api/share?setId=${setId}`, { method:'DELETE' })
      if (!res.ok) throw new Error()
      setLibrary(prev => prev.map(s => s.id===setId ? { ...s, is_public:false, share_id:null } : s))
      pushToast('success', 'Set made private.')
    } catch { pushToast('error', 'Failed to make set private.') }
    finally { setSharingId(null); setUnshareConf(null) }
  }

  async function commitRename(id: string) {
    const trimmed = renameVal.trim(); if (!trimmed) { setRenamingId(null); setRenameVal(''); return }
    try {
      const res=await fetch(`/api/library/item?id=${id}`,{ method:'PATCH', headers:{'Content-Type':'application/json'}, body:JSON.stringify({title:trimmed}) })
      const contentType = res.headers.get('content-type') || ''
      if (!contentType.includes('application/json')) { pushToast('error', 'Your session expired — please sign in again.') }
      else if (res.ok) { setLibrary(prev=>prev.map(s=>s.id===id?{...s,title:trimmed}:s)); if (set?.title&&renamingId===id) setSet(s=>s?{...s,title:trimmed}:s) }
      else { pushToast('error', 'Rename failed.') }
    } catch { pushToast('error', 'Network error.') }
    finally { setRenamingId(null); setRenameVal('') }
  }

  // ── Import ────────────────────────────────────────────────
  async function handleImport(tracks: ImportedTrack[]) {
    setImportLoading(true); setError(null); setSet(null)
    if (isMobile) setMobileShowResults(true)
    try {
      const res=await fetch('/api/import',{ method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({tracks,bpmLow,bpmHigh,keyMatch}) }); const data=await parseJsonResponse(res)
      if (!res.ok) { setError(data.error||'Import failed.'); if (isMobile) setMobileShowResults(false); return }
      setSet({...data.set,_meta:{genre:'Imported',crowd:'',familiarity:'',vibe:'',refArtist:''}})
      if (data.quota) setQuota(data.quota)
    } catch (err) {
      setError(err instanceof Error && err.message === 'SESSION_EXPIRED' ? 'Your session expired — please sign in again.' : 'Network error.')
      if (isMobile) setMobileShowResults(false)
    }
    finally   { setImportLoading(false) }
  }

  // ── Utils ─────────────────────────────────────────────────
  function toggleLock(i: number) { setLocked(prev=>{ const n=new Set(prev); if (n.has(i)) n.delete(i); else n.add(i); return n }) }

  // ── Manual track edit ────────────────────────────────────────
  function startEdit(i: number) {
    if (!set) return
    const t = set.tracks[i]
    setEditDraft({ artist:t.artist, title:t.title, bpm:String(t.bpm), key:t.key, energy:t.energy, transition:t.transition||'' })
    setEditingIndex(i)
    setOpenWhy(prev => { if (!prev.has(i)) return prev; const n = new Set(prev); n.delete(i); return n })
    setPreviewOpen(prev => { if (!prev.has(i)) return prev; const n = new Set(prev); n.delete(i); return n })
  }
  function cancelEdit() { setEditingIndex(null); setEditDraft(null) }
  function commitEdit() {
    if (editingIndex === null || !editDraft) return
    const bpmNum = parseFloat(editDraft.bpm)
    setSet(s => {
      if (!s) return s
      const tracks = [...s.tracks]
      const prevTrack = tracks[editingIndex]
      const newArtist = editDraft.artist.trim() || prevTrack.artist
      const newTitle  = editDraft.title.trim()  || prevTrack.title
      const identityChanged = newArtist !== prevTrack.artist || newTitle !== prevTrack.title
      tracks[editingIndex] = {
        ...prevTrack,
        artist:     newArtist,
        title:      newTitle,
        bpm:        Number.isFinite(bpmNum) && bpmNum > 0 ? bpmNum : prevTrack.bpm,
        key:        editDraft.key.trim().toUpperCase() || prevTrack.key,
        energy:     editDraft.energy,
        transition: editDraft.transition,
        // A changed artist/title makes the old Spotify match / file path
        // untrustworthy — clear both rather than pointing at the wrong track.
        spotifyId:  identityChanged ? undefined : prevTrack.spotifyId,
        path:       identityChanged ? undefined : prevTrack.path,
      }
      return { ...s, tracks }
    })
    setEditingIndex(null); setEditDraft(null)
    pushToast('success', 'Track updated.')
  }

  function fetchWhy(i: number) {
    if (whyData[i] || loadingWhy.has(i) || !set) return
    setLoadingWhy(prev => { const n = new Set(prev); n.add(i); return n })
    const t = set.tracks[i]
    fetch('/api/why', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({
      track: t, prevTrack: set.tracks[i-1]||null, nextTrack: set.tracks[i+1]||null,
      genre: effectiveGenre, crowd, familiarity, setLength: set.tracks.length,
    }) })
      .then(r => r.json())
      .then(d => { if (d.why) setWhyData(prev => ({ ...prev, [i]: d })) })
      .catch(() => {})
      .finally(() => setLoadingWhy(prev => { const n = new Set(prev); n.delete(i); return n }))
  }

  function toggleWhy(i: number) {
    setOpenWhy(prev => {
      const n = new Set(prev); if (n.has(i)) { n.delete(i); return n }
      n.add(i); if (quota?.tier !== 'free') fetchWhy(i); return n
    })
    setPreviewOpen(prev => { if (!prev.has(i)) return prev; const n = new Set(prev); n.delete(i); return n })
    if (editingIndex === i) cancelEdit()
  }

  function togglePreview(i: number) {
    setPreviewOpen(prev => {
      const n = new Set(prev); if (n.has(i)) { n.delete(i); return n }
      n.add(i); return n
    })
    setOpenWhy(prev => { if (!prev.has(i)) return prev; const n = new Set(prev); n.delete(i); return n })
    if (editingIndex === i) cancelEdit()
  }

  function reorderTracks(from: number, to: number) {
    if (!set || from === to) return
    setSet(s => {
      if (!s) return s
      const tracks = [...s.tracks]
      const [moved] = tracks.splice(from, 1)
      tracks.splice(to, 0, moved)
      return { ...s, tracks: tracks.map((t, i) => ({ ...t, n: i + 1 })) }
    })
    setLocked(prev => {
      const next = new Set<number>()
      prev.forEach(idx => {
        if (idx === from)                              next.add(to)
        else if (from < to && idx > from && idx <= to) next.add(idx - 1)
        else if (from > to && idx < from && idx >= to) next.add(idx + 1)
        else                                            next.add(idx)
      })
      return next
    })
  }

  // Drag-and-drop insert from the Liked Songs panel — atIndex is where the
  // new track lands; everything at/after it shifts down one, same as reorderTracks.
  function insertLikedTrack(liked: LikedTrack, atIndex: number) {
    if (!set) return
    const neighbor  = set.tracks[atIndex] ?? set.tracks[atIndex - 1]
    const prevTrack = set.tracks[atIndex - 1]
    const nextTrack = set.tracks[atIndex]   // shifts to atIndex+1 once inserted, but is still "the next track" for context
    const newTrack: Track = {
      n:          0,
      artist:     liked.artist,
      title:      liked.title,
      bpm:        liked.bpm    ?? neighbor?.bpm    ?? bpmLow,
      key:        liked.key    ?? neighbor?.key    ?? '8A',
      energy:     liked.energy ?? neighbor?.energy ?? 5,
      transition: '',
    }
    setSet(s => {
      if (!s) return s
      const tracks = [...s.tracks]
      tracks.splice(atIndex, 0, newTrack)
      return { ...s, tracks: tracks.map((t, i) => ({ ...t, n: i + 1 })) }
    })
    setLocked(prev => new Set([...prev].map(idx => idx >= atIndex ? idx + 1 : idx)))
    pushToast('success', `Added "${liked.title}" to your set.`)
    fetchTransitionNote(newTrack, prevTrack, nextTrack)
  }

  // Manually-inserted tracks (drag from Liked Songs) skip the normal generation
  // prompt entirely, so they'd otherwise sit with an empty mix note forever.
  async function fetchTransitionNote(track: Track, prevTrack?: Track, nextTrack?: Track) {
    const key = trackKey(track.artist, track.title)
    setPendingTransitionKeys(prev => new Set(prev).add(key))
    try {
      const res  = await fetch('/api/transition-note', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({
        track:     { artist:track.artist, title:track.title, bpm:track.bpm, key:track.key, energy:track.energy },
        prevTrack: prevTrack ? { artist:prevTrack.artist, title:prevTrack.title, bpm:prevTrack.bpm, key:prevTrack.key } : null,
        nextTrack: nextTrack ? { artist:nextTrack.artist, title:nextTrack.title, bpm:nextTrack.bpm, key:nextTrack.key } : null,
        genre: effectiveGenre, crowd,
      }) })
      const data = await res.json()
      if (!res.ok || !data.transition) return
      setSet(s => {
        if (!s) return s
        const idx = s.tracks.findIndex(t => !t.transition && trackKey(t.artist, t.title) === key)
        if (idx === -1) return s
        const tracks = [...s.tracks]
        tracks[idx] = { ...tracks[idx], transition: data.transition }
        return { ...s, tracks }
      })
    } catch {}
    finally {
      setPendingTransitionKeys(prev => { const next = new Set(prev); next.delete(key); return next })
    }
  }

  function deleteTrack(i: number) {
    if (!set) return
    const removed = set.tracks[i]
    setSet(s => {
      if (!s) return s
      const tracks = s.tracks.filter((_, idx) => idx !== i)
      return { ...s, tracks: tracks.map((t, idx) => ({ ...t, n: idx + 1 })) }
    })
    setLocked(prev => {
      const next = new Set<number>()
      prev.forEach(idx => { if (idx !== i) next.add(idx > i ? idx - 1 : idx) })
      return next
    })
    if (removed) pushToast('success', `Removed "${removed.title}" from your set.`)
  }

  async function copyTracklist() {
    if (!set) return
    const text = set.tracks.map(t=>`${String(t.n).padStart(2,'0')}. ${t.artist} — ${t.title} [${t.bpm} BPM · ${t.key}]`).join('\n')
    try { await navigator.clipboard.writeText(`${set.title.toUpperCase()}\n\n${text}\n\nForged with SetForge — setforge.online`); setCopied(true); setTimeout(()=>setCopied(false),2000) }
    catch { pushToast('error', 'Copy failed.') }
  }

  function exportRekordbox() {
    if (!set) return
    const xml = toRekordboxXML(set.tracks, set.title)
    downloadFile(xml, `${set.title.replace(/\s+/g,'_')}.xml`, 'application/xml')
  }
  function exportSerato() {
    if (!set) return
    const m3u = toSeratoM3U(set.tracks, set.title)
    downloadFile(m3u, `${set.title.replace(/\s+/g,'_')}.m3u`, 'audio/x-mpegurl')
  }
  function exportTraktor() {
    if (!set) return
    const nml = toTraktorNML(set.tracks, set.title)
    downloadFile(nml, `${set.title.replace(/\s+/g,'_')}.nml`, 'application/xml')
  }
  function exportText() {
    if (!set) return
    const lines=[set.title.toUpperCase(),set.summary,'',...set.tracks.map(t=>`${String(t.n).padStart(2,'0')}. ${t.artist} — ${t.title}  [${t.bpm} BPM · ${t.key} · E${t.energy}]\n     ↳ ${t.transition}`),'','Generated with SetForge']
    const a=Object.assign(document.createElement('a'),{ href:URL.createObjectURL(new Blob([lines.join('\n')],{type:'text/plain'})), download:`${set.title.replace(/\s+/g,'_')}.txt` }); a.click()
  }

  function trackSearchUrl(t: Track, platform: 'beatport'|'spotify'|'youtube'|'soundcloud'|'tunebat') {
    const q = encodeURIComponent(`${t.artist} ${t.title}`)
    if (platform === 'beatport')   return `https://www.beatport.com/search?q=${q}`
    if (platform === 'spotify')    return `https://open.spotify.com/search/${q}`
    if (platform === 'youtube')    return `https://www.youtube.com/results?search_query=${q}`
    if (platform === 'soundcloud') return `https://soundcloud.com/search?q=${q}`
    if (platform === 'tunebat')    return `https://tunebat.com/Search?q=${q}`
    return ''
  }

  // ── Wizard ────────────────────────────────────────────────
  function handleWizardComplete(result: WizardResult) {
    setGenre(result.genre); setCrowd(result.crowd); setFamiliarity(result.familiarity); setVibe(result.vibe); setRefArtist(result.refArtist); setMinutes(result.minutes); setMode('time')
    setEnergyPoints(resampleEnergyPoints(ENERGY_PRESETS['Wave'], Math.round(result.minutes / 4.5)))
    setShowWizard(false); setFirstSetCelebration(true); setTimeout(()=>generate(false),80)
  }
  function handleWizardSkip() { try { localStorage.setItem('sf_onboarded','true') } catch {}; setShowWizard(false) }

  // ─────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────
  return (
    <div style={{ height: isMobile ? '100dvh' : '100vh', display:'flex', flexDirection:'column', background:'#06060c', color:'#e8e8f0', fontFamily:"'JetBrains Mono',monospace", overflow:'hidden' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=JetBrains+Mono:wght@400;500;700&display=swap');
        .sf-glow-c { text-shadow:0 0 8px ${C},0 0 24px ${C}80; }
        .sf-glow-m { text-shadow:0 0 8px ${M},0 0 24px ${M}80; }
        .sf-input  { background:#0d0d18; border:1px solid #1f1f33; color:#e8e8f0; font-family:'JetBrains Mono',monospace; font-size:12px; padding:8px 11px; border-radius:8px; width:100%; outline:none; transition:.2s; box-sizing:border-box; }
        .sf-input:focus { border-color:${C}; box-shadow:0 0 0 3px ${C}18; }
        .sf-select { -webkit-appearance:none; appearance:none; cursor:pointer; background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath d='M2 4l4 4 4-4' stroke='%2300f0ff' stroke-width='1.5' fill='none'/%3E%3C/svg%3E"); background-repeat:no-repeat; background-position:right 10px center; padding-right:30px; }
        .sf-select optgroup { background:#06060c; color:${M}; font-style:normal; font-weight:700; }
        .sf-select option   { background:#0d0d18; color:#e8e8f0; }
        .sf-chip { cursor:pointer; padding:5px 12px; border-radius:999px; border:1px solid #23233a; background:#0d0d18; font-size:11px; transition:.18s; user-select:none; white-space:nowrap; }
        .sf-chip:hover { border-color:#39395c; }
        .sf-chip.on { border-color:${C}; color:${C}; box-shadow:0 0 10px ${C}33; }
        .sf-btn-primary { background:linear-gradient(100deg,${M},${C}); color:#06060c; font-weight:700; border:none; cursor:pointer; font-family:'JetBrains Mono',monospace; transition:box-shadow .2s,transform .15s; }
        .sf-btn-primary:hover:enabled { box-shadow:0 0 0 3px ${C}44,0 6px 28px ${C}44,0 6px 28px ${M}28; transform:translateY(-1px); }
        .sf-btn-primary:disabled { opacity:.5; cursor:default; }
        .sf-btn-ghost { background:transparent; border:1px solid #23233a; color:#8a8aa8; cursor:pointer; font-family:'JetBrains Mono',monospace; transition:.18s; }
        .sf-btn-ghost:hover:enabled { border-color:${C}; color:${C}; }
        .sf-btn-ghost:disabled { opacity:.4; cursor:default; }
        .sf-tab { cursor:pointer; padding:10px 0; font-size:10px; letter-spacing:2px; border-bottom:2px solid transparent; transition:.2s; user-select:none; flex:1; text-align:center; }
        .sf-tab.on { border-color:${C}; color:${C}; }
        .sf-tab:hover:not(.on) { color:#9a9ab8; }
        .sf-track:hover { border-color:#23233a!important; }
        .sf-swap:hover:enabled { border-color:${C}!important; color:${C}!important; }
        .sf-delete-track:hover { border-color:${M}!important; color:${M}!important; }
        .sf-del-btn { background:transparent; border:1px solid #23233a; color:#5a5a78; cursor:pointer; font-family:'JetBrains Mono',monospace; font-size:10px; padding:4px 8px; border-radius:5px; transition:.18s; }
        .sf-del-btn:hover { border-color:${M}; color:${M}; }
        .sf-rename-btn { background:transparent; border:none; color:#4a4a66; cursor:pointer; font-size:12px; padding:2px 5px; border-radius:4px; transition:.15s; }
        .sf-rename-btn:hover { color:${C}; }
        .lib-card:hover { border-color:#23233a!important; }
        .sf-slider { -webkit-appearance:none; appearance:none; width:100%; height:8px; border-radius:999px; background:linear-gradient(90deg,${M}33,${C}33); border:1px solid #23233a; outline:none; cursor:pointer; }
        .sf-slider::-webkit-slider-thumb { -webkit-appearance:none; width:22px; height:22px; border-radius:50%; background:linear-gradient(135deg,${M},${C}); border:2px solid #06060c; box-shadow:0 0 10px ${C}66; cursor:grab; }
        .sf-slider::-webkit-slider-thumb:active { cursor:grabbing; }
        @keyframes blob1 { 0%,100%{transform:translate(0,0) scale(1)} 33%{transform:translate(40px,-50px) scale(1.08)} 66%{transform:translate(-30px,40px) scale(.94)} }
        @keyframes blob2 { 0%,100%{transform:translate(0,0) scale(1)} 33%{transform:translate(-40px,30px) scale(.96)} 66%{transform:translate(30px,-40px) scale(1.06)} }
        .empty-blob1 { animation:blob1 18s ease-in-out infinite; }
        .empty-blob2 { animation:blob2 22s ease-in-out infinite; }
        @keyframes rise  { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:none} }
        @keyframes spin  { from{transform:rotate(0)} to{transform:rotate(360deg)} }
        @keyframes pulse { 0%,100%{opacity:.4} 50%{opacity:1} }
        @keyframes flash { 0%,100%{box-shadow:none} 50%{box-shadow:0 0 20px ${C}88} }
        @keyframes scan  { 0%{transform:translateX(-100%)} 100%{transform:translateX(400%)} }
        @keyframes toast-in { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:none} }
        .sf-row { animation:rise .4s ease backwards; }
        * { box-sizing:border-box; }
        ::-webkit-scrollbar { width:4px; } ::-webkit-scrollbar-track { background:transparent; } ::-webkit-scrollbar-thumb { background:#1f1f33; border-radius:2px; }
      `}</style>

      {/* Wizard overlay */}
      {showWizard && <OnboardingWizard onComplete={handleWizardComplete} onSkip={handleWizardSkip} />}

      {/* Toasts — fixed, always visible regardless of view/mobile panel state */}
      <div role="status" aria-live="polite" style={{ position:'fixed', bottom:'calc(20px + env(safe-area-inset-bottom, 0px))', right:20, zIndex:250, display:'flex', flexDirection:'column', gap:8, maxWidth:320, pointerEvents: toasts.length ? 'auto' : 'none' }}>
        {toasts.map(t => (
          <div key={t.id} style={{ animation:'toast-in .25s ease', background:'#0a0a14', border:`1px solid ${t.type==='success'?C:M}66`, borderRadius:10, padding:'10px 14px', fontSize:12, color:'#e8e8f0', boxShadow:'0 8px 24px rgba(0,0,0,.4)', display:'flex', alignItems:'center', gap:8 }}>
            <span style={{ color: t.type==='success'?C:M, fontWeight:700 }}>{t.type==='success'?'✓':'✕'}</span>
            {t.message}
          </div>
        ))}
      </div>

      {/* Swap picker modal */}
      {swapModal && (
        <div onClick={()=>setSwapModal(null)} style={{ position:'fixed', inset:0, zIndex:100, background:'#06060ccc', backdropFilter:'blur(6px)', display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}>
          <div onClick={e=>e.stopPropagation()} style={{ background:'#0a0a14', border:'1px solid #1f1f33', borderRadius:16, padding:24, width:'100%', maxWidth:640, maxHeight:'85vh', overflowY:'auto' }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:18 }}>
              <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:24, letterSpacing:1, color:C }} className="sf-glow-c">CHOOSE A REPLACEMENT</div>
              <button onClick={()=>setSwapModal(null)} style={{ background:'none', border:'none', color:'#4a4a66', cursor:'pointer', fontSize:20 }}>✕</button>
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
              {swapModal.suggestions.map((s,i)=>(
                <div key={i} style={{ background:'#06060c', border:'1px solid #16162a', borderRadius:12, padding:'14px 16px' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:6 }}>
                    <span style={{ fontSize:9, letterSpacing:1.5, color:M, border:'1px solid #ff1e8a44', borderRadius:999, padding:'2px 9px', fontWeight:700 }}>{s.label.toUpperCase()}</span>
                    {s.verified===false && (
                      <span title="Couldn't confirm this track exists on Spotify" style={{ fontSize:9, color:'#f59e0b', border:'1px solid #f59e0b55', borderRadius:999, padding:'2px 8px', fontWeight:700 }}>⚠ UNVERIFIED</span>
                    )}
                  </div>
                  <div style={{ fontSize:14, fontWeight:700, marginBottom:2 }}>{s.title}</div>
                  <div style={{ fontSize:12, color:'#8a8aa8', marginBottom:8 }}>{s.artist}</div>
                  <div style={{ display:'flex', gap:14, fontSize:11, color:'#6a6a8a', marginBottom:8 }}>
                    <span style={{ color:C }}>{s.bpm} BPM</span>
                    <span>{s.key}</span>
                    <span>E{s.energy}</span>
                  </div>
                  {s.transition && <div style={{ fontSize:11, color:'#5a5a78', marginBottom:10 }}>↳ {s.transition}</div>}
                  <button onClick={()=>applySwapSuggestion(s)} className="sf-btn-primary" style={{ padding:'8px 0', borderRadius:8, fontSize:11, letterSpacing:1, width:'100%' }}>USE THIS</button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── NAV ── */}
      <nav style={{ height:52, flexShrink:0, borderBottom:'1px solid #1a1a2e', display:'flex', alignItems:'center', justifyContent:'space-between', padding: isMobile ? '0 10px' : '0 20px', backdropFilter:'blur(12px)', background:'#06060cee', zIndex:40, overflowX:'auto' }}>
        <Link href="/" style={{ textDecoration:'none', flexShrink:0, display:'flex', alignItems:'center', gap:8 }}>
          <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize: isMobile ? 20 : 24, letterSpacing:2 }}>
            <span style={{ color:C }} className="sf-glow-c">SET</span><span style={{ color:M }} className="sf-glow-m">FORGE</span>
          </div>
          {quota?.tier && (
            <span className="sf-mono" style={{
              fontSize:9, letterSpacing:1, fontWeight:700, padding:'2px 7px', borderRadius:999,
              color: quota.tier==='team' ? C : quota.tier==='pro' ? M : '#9a9ab8',
              border: `1px solid ${(quota.tier==='team' ? C : quota.tier==='pro' ? M : '#9a9ab8')}55`,
              background: `${quota.tier==='team' ? C : quota.tier==='pro' ? M : '#9a9ab8'}14`,
            }}>
              {quota.tier.toUpperCase()}
            </span>
          )}
        </Link>
        <div style={{ display:'flex', alignItems:'center', gap: isMobile ? 6 : 14, flexShrink:0 }}>
          {quota?.trial?.active && !isMobile && (
            <div style={{ fontSize:10, fontFamily:"'JetBrains Mono',monospace", padding:'4px 10px', borderRadius:999, border:`1px solid ${quota.trial.daysLeft<=2?M:quota.trial.daysLeft<=4?'#f59e0b':C}`, color:quota.trial.daysLeft<=2?M:quota.trial.daysLeft<=4?'#f59e0b':C }}>
              {quota.trial.daysLeft}d left in trial
            </div>
          )}
          {quota?.isFree && !quota?.trial?.active && (
            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
              {!isMobile && (
                <div style={{ fontSize:10, fontFamily:"'JetBrains Mono',monospace", padding:'4px 10px', borderRadius:999, border:'1px solid #2a2a42', color:'#9a9ab8' }}>
                  {quota.remaining===0 ? '0 sets left' : `${quota.remaining} free sets left`}
                </div>
              )}
              <Link href="/#pricing" style={{ textDecoration:'none' }}>
                <div style={{ fontSize:10, fontFamily:"'JetBrains Mono',monospace", padding:'4px 10px', borderRadius:999, background:`linear-gradient(100deg,${M},${C})`, color:'#06060c', fontWeight:700, cursor:'pointer' }}>Upgrade</div>
              </Link>
            </div>
          )}
          <Link href="/analyse" style={{ textDecoration:'none' }}>
            <button className="sf-btn-ghost" style={{ padding: isMobile ? '5px 8px' : '5px 12px', borderRadius:8, fontSize:10, letterSpacing:1, fontFamily:"'JetBrains Mono',monospace", whiteSpace:'nowrap' }}>🔍{!isMobile && ' ANALYSE'}</button>
          </Link>
          <Link href="/mix" style={{ textDecoration:'none' }}>
            <button className="sf-btn-ghost" style={{ padding: isMobile ? '5px 8px' : '5px 12px', borderRadius:8, fontSize:10, letterSpacing:1, fontFamily:"'JetBrains Mono',monospace", whiteSpace:'nowrap' }}>🎛️{!isMobile && ' MIX'}</button>
          </Link>
          <Link href="/planner" style={{ textDecoration:'none' }}>
            <button className="sf-btn-ghost" style={{ padding: isMobile ? '5px 8px' : '5px 12px', borderRadius:8, fontSize:10, letterSpacing:1, fontFamily:"'JetBrains Mono',monospace", whiteSpace:'nowrap' }}>🌙{!isMobile && ' PLANNER'}</button>
          </Link>
          <Link href="/community" style={{ textDecoration:'none' }}>
            <button className="sf-btn-ghost" style={{ padding: isMobile ? '5px 8px' : '5px 12px', borderRadius:8, fontSize:10, letterSpacing:1, fontFamily:"'JetBrains Mono',monospace", whiteSpace:'nowrap' }}>👥{!isMobile && ' COMMUNITY'}</button>
          </Link>
          <Link href="/team" style={{ textDecoration:'none' }}>
            <button className="sf-btn-ghost" style={{ padding: isMobile ? '5px 8px' : '5px 12px', borderRadius:8, fontSize:10, letterSpacing:1, fontFamily:"'JetBrains Mono',monospace", whiteSpace:'nowrap' }}>🤝{!isMobile && ' TEAM'}</button>
          </Link>
          <Link href="/u?me=1" style={{ textDecoration:'none' }}>
            <button className="sf-btn-ghost" style={{ padding: isMobile ? '5px 8px' : '5px 12px', borderRadius:8, fontSize:10, letterSpacing:1, fontFamily:"'JetBrains Mono',monospace", whiteSpace:'nowrap' }}>👤{!isMobile && ' PROFILE'}</button>
          </Link>
          <NotificationBell />
          <UserButton />
        </div>
      </nav>

      {/* ── SPLIT LAYOUT ── */}
      <div style={{ flex:1, display:'flex', overflow:'hidden' }}>

        {/* ════ LEFT PANEL ════ */}
        <div style={{ width: isMobile ? '100%' : 370, flexShrink:0, borderRight: isMobile ? 'none' : '1px solid #1a1a2e', display: isMobile && mobileShowResults ? 'none' : 'flex', flexDirection:'column', overflow:'hidden', background:'#06060c' }}>

          {/* Tab nav */}
          <div style={{ display:'flex', borderBottom:'1px solid #1a1a2e', flexShrink:0 }}>
            <div className={`sf-tab ${view==='forge'?'on':''}`} onClick={()=>setView('forge')}>⚡ FORGE</div>
            <div className={`sf-tab ${view==='library'?'on':''}`} onClick={()=>{ setView('library'); if(!libLoaded) loadLibrary() }}>
              ◈ LIBRARY{library.length>0&&<span style={{ marginLeft:5, background:M, color:'#06060c', borderRadius:999, fontSize:8, padding:'1px 5px', fontWeight:700 }}>{library.length}</span>}
            </div>
            <div className={`sf-tab ${view==='import'?'on':''}`} onClick={()=>setView('import')}>↑ IMPORT</div>
          </div>

          {/* Scrollable panel content */}
          <div style={{ flex:1, overflowY:'auto', padding:16 }}>

            {/* ══ FORGE FORM ══ */}
            {view==='forge' && (
              <div style={{ display:'flex', flexDirection:'column', gap:14 }}>

                <SFLabel>GENRE</SFLabel>
                <div>
                  <select className="sf-input sf-select" value={genre} onChange={e=>setGenre(e.target.value)} style={{ marginBottom: genre==='__custom__'?8:0 }}>
                    <option value="__custom__">✦ Custom — describe your own…</option>
                    {Object.entries(GENRE_GROUPS).map(([grp,items])=>(
                      <optgroup key={grp} label={grp}>{items.map(g=><option key={g} value={g}>{g}</option>)}</optgroup>
                    ))}
                  </select>
                  {genre==='__custom__' && <input className="sf-input" value={customGenre} onChange={e=>setCustomGenre(e.target.value.slice(0,120))} placeholder="e.g. 90s french house with disco edits…" autoFocus />}
                </div>

                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                  <div>
                    <SFLabel>CROWD</SFLabel>
                    <select className="sf-input sf-select" value={crowd} onChange={e=>setCrowd(e.target.value)}>
                      {CROWDS.map(c=><option key={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <SFLabel>FAMILIARITY</SFLabel>
                    <select className="sf-input sf-select" value={familiarity} onChange={e=>setFamiliarity(e.target.value)}>
                      {FAMILIARITY_OPTIONS.map(f=><option key={f}>{f}</option>)}
                    </select>
                  </div>
                </div>

                <div>
                  <SFLabel>VIBE <span style={{ color:'#4a4a66' }}>— optional</span></SFLabel>
                  <input className="sf-input" value={vibe} onChange={e=>setVibe(e.target.value)} placeholder="dark & hypnotic, summery rooftop…" />
                </div>

                <div>
                  <SFLabel>REFERENCE ARTISTS <span style={{ color:'#4a4a66' }}>— optional</span></SFLabel>
                  <input className="sf-input" value={refArtist} onChange={e=>setRefArtist(e.target.value)} placeholder="Boris Brejcha, Tale Of Us…" />
                </div>

                <div>
                  <SFLabel>ENERGY CURVE</SFLabel>
                  <EnergyEditor points={energyPoints} onChange={setEnergyPoints} />
                </div>

                <div>
                  <SFLabel>SET LENGTH</SFLabel>
                  <div style={{ display:'flex', gap:6, marginBottom:8 }}>
                    <div className={`sf-chip ${mode==='time'?'on':''}`} onClick={()=>setMode('time')}>By Time</div>
                    <div className={`sf-chip ${mode==='count'?'on':''}`} onClick={()=>setMode('count')}>By Count</div>
                  </div>
                  <div style={{ background:'#06060c', border:'1px solid #1a1a2e', borderRadius:10, padding:'12px 14px' }}>
                    {mode==='time' ? (
                      <>
                        <input type="range" min={15} max={240} step={15} value={minutes} onChange={e=>setMinutes(+e.target.value)} className="sf-slider" style={{ marginBottom:8 }} />
                        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline' }}>
                          <span style={{ fontSize:24, fontFamily:"'Bebas Neue',sans-serif", color:C }} className="sf-glow-c">{minutes} MIN</span>
                          <span style={{ fontSize:11, color:'#6a6a8a' }}>~{Math.round(minutes/4.5)} tracks</span>
                        </div>
                      </>
                    ) : (
                      <>
                        <input type="range" min={4} max={50} value={count} onChange={e=>setCount(+e.target.value)} className="sf-slider" style={{ marginBottom:8 }} />
                        <span style={{ fontSize:24, fontFamily:"'Bebas Neue',sans-serif", color:C }} className="sf-glow-c">{count} TRACKS</span>
                      </>
                    )}
                  </div>
                </div>

                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                  <div>
                    <SFLabel>BPM LOW</SFLabel>
                    <input className="sf-input" type="number" value={bpmLow} onChange={e=>setBpmLow(+e.target.value)} />
                  </div>
                  <div>
                    <SFLabel>BPM HIGH</SFLabel>
                    <input className="sf-input" type="number" value={bpmHigh} onChange={e=>setBpmHigh(+e.target.value)} />
                  </div>
                </div>

                <div className={`sf-chip ${keyMatch?'on':''}`} onClick={()=>setKeyMatch(!keyMatch)} style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:6 }}>
                  ♪ Harmonic mixing {keyMatch?'ON':'OFF'}
                </div>
                <div className={`sf-chip ${includeMixingNotes?'on':''}`} onClick={()=>setIncludeMixingNotes(!includeMixingNotes)} style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:6 }} title="Off = faster, tracklist only">
                  ↳ Mix notes {includeMixingNotes?'ON':'OFF'}
                </div>
                {likedTracks.length > 0 && (
                  <div className={`sf-chip ${useLikedPool?'on':''}`} onClick={()=>setUseLikedPool(!useLikedPool)} style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:6 }} title="Prioritize tracks you've liked where they fit — still fills remaining slots with other real tracks">
                    ♥ Liked songs pool ({likedTracks.length}) {useLikedPool?'ON':'OFF'}
                  </div>
                )}

                <button className="sf-btn-primary" onClick={()=>generate(false)} disabled={loading||(genre==='__custom__'&&!customGenre.trim())} style={{ padding:'13px 0', borderRadius:10, fontSize:14, letterSpacing:2, width:'100%', marginTop:4 }}>
                  {loading?'FORGING…':'⚡ FORGE SET'}
                </button>

                <button onClick={tryExample} disabled={loading} className="sf-btn-ghost" style={{ padding:'9px 0', borderRadius:8, fontSize:11, letterSpacing:1, width:'100%' }}>
                  ✦ TRY AN EXAMPLE SET
                </button>

                {locked.size>0 && (
                  <button onClick={()=>generate(true)} disabled={loading} className="sf-btn-ghost" style={{ padding:'9px 0', borderRadius:8, fontSize:11, color:'#f59e0b', borderColor:'#f59e0b44', width:'100%' }}>
                    ↻ REFORGE ({locked.size} locked)
                  </button>
                )}

                {error && (
                  <div style={{ padding:12, border:`1px solid ${M}`, borderRadius:10, color:M, fontSize:12, lineHeight:1.5 }}>
                    {error}
                    {(error.includes('free sets')||error.includes('trial')||error.includes('subscription')) && (
                      <Link href="/#pricing" style={{ display:'block', marginTop:8, color:C, textDecoration:'underline', fontSize:11 }}>View upgrade options →</Link>
                    )}
                  </div>
                )}

              </div>
            )}

            {/* ══ LIBRARY ══ */}
            {view==='library' && (
              <div>
                <div style={{ display:'flex', border:'1px solid #1f1f33', borderRadius:8, overflow:'hidden', marginBottom:14 }}>
                  {(myTeamId ? ['sets','liked','team'] as const : ['sets','liked'] as const).map(t => (
                    <button key={t} onClick={()=>{ setLibSubTab(t); if (t==='team' && !teamSetsLoaded) loadTeamSets() }}
                      style={{ flex:1, padding:'7px 0', border:'none', cursor:'pointer', fontSize:9.5,
                        fontFamily:"'JetBrains Mono',monospace", letterSpacing:.5, fontWeight:700, transition:'.15s',
                        background: libSubTab===t ? `linear-gradient(100deg,${M}22,${C}22)` : '#0d0d18',
                        color:      libSubTab===t ? C : '#6a6a8a',
                        borderBottom: `2px solid ${libSubTab===t?C:'transparent'}` }}>
                      {t==='sets' ? '◈ SAVED SETS' : t==='liked' ? `♥ LIKED SONGS${likedTracks.length>0?` (${likedTracks.length})`:''}` : `🤝 TEAM SETS${teamSets.length>0?` (${teamSets.length})`:''}`}
                    </button>
                  ))}
                </div>

                {libSubTab==='liked' ? (
                  !likedLoaded ? (
                    <div style={{ textAlign:'center', padding:40, color:'#6a6a8a', fontSize:11, animation:'pulse 1.2s infinite' }}>LOADING LIKED SONGS…</div>
                  ) : likedTracks.length===0 ? (
                    <div style={{ textAlign:'center', padding:40 }}>
                      <div style={{ fontSize:28, opacity:.3, marginBottom:8 }}>♡</div>
                      <div style={{ fontSize:12, color:'#6a6a8a' }}>No liked songs yet.</div>
                      <div style={{ fontSize:11, color:'#4a4a66', marginTop:4 }}>Hit ♡ on any track in a generated set.</div>
                    </div>
                  ) : (
                    <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                      {set && !isMobile && (
                        <div style={{ background:`${C}0a`, border:`1px solid ${C}28`, borderRadius:7, padding:'6px 10px', fontSize:10, color:C, display:'flex', alignItems:'center', gap:6 }}>
                          <span style={{ fontSize:12 }}>⠿</span> Drag any liked song into your set →
                        </div>
                      )}
                      {likedTracks.map((t,i)=>(
                        <div key={t.id} className="sf-row lib-card"
                          draggable={!!set}
                          onDragStart={()=>setDraggedLiked(t)}
                          onDragEnd={()=>setDraggedLiked(null)}
                          style={{ animationDelay:`${i*0.04}s`, background:'#0a0a14', border:'1px solid #16162a', borderRadius:10, padding:12, display:'flex', alignItems:'center', gap:10, cursor: set ? 'grab' : 'default' }}>
                          {set && <div style={{ fontSize:12, color:'#2a2a48', flexShrink:0 }}>⠿</div>}
                          <div style={{ flex:1, minWidth:0 }}>
                            <div style={{ fontSize:13, fontWeight:700, color:'#e8e8f0', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{t.title}</div>
                            <div style={{ fontSize:11, color:'#8a8aa8', display:'flex', gap:8, alignItems:'center', flexWrap:'wrap' }}>
                              <span style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{t.artist}</span>
                              {t.bpm && <span style={{ color:C, flexShrink:0 }}>{t.bpm} BPM</span>}
                              {t.key && <span style={{ flexShrink:0 }}>{t.key}</span>}
                            </div>
                          </div>
                          <button onClick={()=>unlikeById(t.id)} className="sf-del-btn" title="Unlike" aria-label={`Unlike ${t.artist} — ${t.title}`}>✕</button>
                        </div>
                      ))}
                    </div>
                  )
                ) : libSubTab==='team' ? (
                  !teamSetsLoaded ? (
                    <div style={{ textAlign:'center', padding:40, color:'#6a6a8a', fontSize:11, animation:'pulse 1.2s infinite' }}>LOADING TEAM SETS…</div>
                  ) : teamSets.length===0 ? (
                    <div style={{ textAlign:'center', padding:40 }}>
                      <div style={{ fontSize:28, opacity:.3, marginBottom:8 }}>🤝</div>
                      <div style={{ fontSize:12, color:'#6a6a8a' }}>No team sets yet.</div>
                      <div style={{ fontSize:11, color:'#4a4a66', marginTop:4 }}>Share a saved set with your team — or wait for a teammate to.</div>
                    </div>
                  ) : (
                    <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                      {teamSets.map((item,i)=>(
                        <div key={item.id} className="sf-row lib-card" style={{ animationDelay:`${i*0.04}s`, background:'#0a0a14', border:'1px solid #16162a', borderRadius:10, padding:12 }}>
                          <div style={{ display:'flex', alignItems:'center', gap:4, marginBottom:4 }}>
                            <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:16, letterSpacing:.5, color:C, flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }} className="sf-glow-c">{item.title}</div>
                          </div>
                          <div style={{ display:'flex', gap:4, flexWrap:'wrap', marginBottom:6, alignItems:'center' }}>
                            <span style={{ fontSize:9, color:'#8a8aa8', border:`1px solid ${C}33`, borderRadius:999, padding:'1px 7px' }}>{item.isOwn ? 'you' : item.sharedBy}</span>
                            {[item.meta?.genre, item.meta?.crowd].map(tag=>tag&&(
                              <span key={String(tag)} style={{ fontSize:9, color:'#6a6a8a', border:'1px solid #1f1f33', borderRadius:999, padding:'1px 7px' }}>{String(tag)}</span>
                            ))}
                            {item.meta?.trackCount && <span style={{ fontSize:9, color:'#4a4a66', border:'1px solid #1f1f33', borderRadius:999, padding:'1px 7px' }}>{item.meta.trackCount} tracks</span>}
                          </div>
                          <button onClick={()=>loadSet(item.id)} disabled={libLoading} className="sf-btn-ghost" style={{ padding:'4px 8px', borderRadius:6, fontSize:9, width:'100%' }}>
                            {libLoading?'…':'▶ LOAD'}
                          </button>
                        </div>
                      ))}
                    </div>
                  )
                ) : !libLoaded ? (
                  <div style={{ textAlign:'center', padding:40, color:'#6a6a8a', fontSize:11, animation:'pulse 1.2s infinite' }}>LOADING LIBRARY…</div>
                ) : library.length===0 ? (
                  <div style={{ textAlign:'center', padding:40 }}>
                    <div style={{ fontSize:28, opacity:.3, marginBottom:8 }}>◈</div>
                    <div style={{ fontSize:12, color:'#6a6a8a' }}>No saved sets yet.</div>
                    <div style={{ fontSize:11, color:'#4a4a66', marginTop:4 }}>Forge a set and hit Save.</div>
                  </div>
                ) : (
                  <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                    {library.map((item,i)=>(
                      <div key={item.id} className="sf-row lib-card" style={{ animationDelay:`${i*0.04}s`, background:'#0a0a14', border:'1px solid #16162a', borderRadius:10, padding:12 }}>
                        {renamingId===item.id ? (
                          <div style={{ display:'flex', flexDirection:'column', gap:8, marginBottom:8 }}>
                            <div style={{ display:'flex', gap:6 }}>
                              <input ref={renameRef} className="sf-input" value={renameVal} onChange={e=>setRenameVal(e.target.value)} onKeyDown={e=>{ if(e.key==='Enter') commitRename(item.id); if(e.key==='Escape'){ setRenamingId(null); setRenameVal(''); setUnshareConf(null) } }} style={{ fontSize:12 }} />
                              <button onClick={()=>commitRename(item.id)} style={{ background:C, color:'#06060c', border:'none', padding:'0 10px', borderRadius:6, fontSize:10, cursor:'pointer', fontFamily:'inherit', fontWeight:700, flexShrink:0 }}>SAVE</button>
                            </div>
                            <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
                              <span style={{ fontSize:9, color:'#6a6a8a', letterSpacing:.5 }}>VISIBILITY:</span>
                              {item.is_public ? (
                                <>
                                  <button onClick={()=>{ navigator.clipboard.writeText(`${window.location.origin}/s?id=${item.share_id}`); setCopiedId(item.id); setTimeout(()=>setCopiedId(null),2500) }} className="sf-btn-ghost" style={{ padding:'4px 8px', borderRadius:6, fontSize:9, color:C, borderColor:C }} title="Copy public link">
                                    {copiedId===item.id ? '✓ COPIED' : '🌐 PUBLIC · copy link'}
                                  </button>
                                  {unshareConf===item.id ? (
                                    <>
                                      <button onClick={()=>unshareSet(item.id)} disabled={sharingId===item.id} style={{ background:M, color:'#06060c', border:'none', padding:'4px 8px', borderRadius:6, fontSize:9, cursor:'pointer', fontFamily:'inherit', fontWeight:700 }}>{sharingId===item.id?'…':'CONFIRM'}</button>
                                      <button className="sf-del-btn" onClick={()=>setUnshareConf(null)}>CANCEL</button>
                                    </>
                                  ) : (
                                    <button className="sf-del-btn" onClick={()=>setUnshareConf(item.id)}>Make private</button>
                                  )}
                                </>
                              ) : (
                                <button onClick={()=>shareSet(item.id)} disabled={sharingId!==null} className="sf-btn-ghost" style={{ padding:'4px 8px', borderRadius:6, fontSize:9 }}>
                                  {sharingId===item.id?'…':'🔒 PRIVATE · make public'}
                                </button>
                              )}
                            </div>
                            <button className="sf-del-btn" onClick={()=>{ setRenamingId(null); setRenameVal(''); setUnshareConf(null) }} style={{ alignSelf:'flex-start' }}>Close</button>
                          </div>
                        ) : (
                          <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:4 }}>
                            <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:16, letterSpacing:.5, color:C, flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }} className="sf-glow-c">{item.title}</div>
                            {item.is_public && <span title="Public — anyone with the link can view" style={{ fontSize:10, color:C }}>🌐</span>}
                            <button className="sf-rename-btn" onClick={()=>{ setRenamingId(item.id); setRenameVal(item.title) }} title="Edit" aria-label={`Edit "${item.title}"`}>✎</button>
                          </div>
                        )}
                        <div style={{ display:'flex', gap:4, flexWrap:'wrap', marginBottom:6 }}>
                          {[item.meta?.genre, item.meta?.crowd].map(tag=>tag&&(
                            <span key={String(tag)} style={{ fontSize:9, color:'#6a6a8a', border:'1px solid #1f1f33', borderRadius:999, padding:'1px 7px' }}>{String(tag)}</span>
                          ))}
                          {item.meta?.trackCount && <span style={{ fontSize:9, color:'#4a4a66', border:'1px solid #1f1f33', borderRadius:999, padding:'1px 7px' }}>{item.meta.trackCount} tracks</span>}
                        </div>
                        <div style={{ display:'flex', gap:5, alignItems:'center' }}>
                          {myTeamId && (
                            <button onClick={()=>toggleShareSet(item.id, !!item.shared_to_team_id)} disabled={sharingTeamId===item.id} className="sf-btn-ghost" title={item.shared_to_team_id?'Unshare from team':'Share with team'} style={{ padding:'4px 8px', borderRadius:6, fontSize:9, flex:1, color:item.shared_to_team_id?C:undefined, borderColor:item.shared_to_team_id?C:undefined }}>
                              {sharingTeamId===item.id?'…':item.shared_to_team_id?'🤝 SHARED':'🤝 TEAM'}
                            </button>
                          )}
                          <button onClick={()=>loadSet(item.id)} disabled={libLoading} className="sf-btn-ghost" style={{ padding:'4px 8px', borderRadius:6, fontSize:9, flex:1 }}>
                            {libLoading?'…':'▶ LOAD'}
                          </button>
                          <a href={`/live?id=${item.id}`} target="_blank" rel="noopener noreferrer" className="sf-btn-ghost"
                            style={{ padding:'4px 8px', borderRadius:6, fontSize:9, flex:1, textDecoration:'none', textAlign:'center', display:'inline-block' }}>
                            🔴 LIVE
                          </a>
                          {deleteConf===item.id ? (
                            <>
                              <button onClick={()=>deleteSet(item.id)} style={{ background:M, color:'#06060c', border:'none', padding:'4px 8px', borderRadius:6, fontSize:9, cursor:'pointer', fontFamily:'inherit', fontWeight:700 }}>YES</button>
                              <button className="sf-del-btn" onClick={()=>setDeleteConf(null)}>NO</button>
                            </>
                          ) : (
                            <button className="sf-del-btn" onClick={()=>{ setDeleteConf(item.id); setRenamingId(null); setUnshareConf(null) }} title="Delete" aria-label={`Delete "${item.title}"`}>✕</button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ══ IMPORT ══ */}
            {view==='import' && (
              <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
                <div style={{ display:'flex', border:'1px solid #1f1f33', borderRadius:8, overflow:'hidden' }}>
                  {(['library','scanner'] as const).map(t => (
                    <button key={t} onClick={() => setImportSubTab(t)}
                      style={{ flex:1, padding:'7px 0', border:'none', cursor:'pointer', fontSize:10,
                        fontFamily:"'JetBrains Mono',monospace", letterSpacing:.5, fontWeight:600,
                        background: importSubTab===t ? `linear-gradient(100deg,${M}22,${C}22)` : '#0d0d18',
                        color: importSubTab===t ? C : '#6a6a8a',
                        borderBottom: `2px solid ${importSubTab===t ? C : 'transparent'}` }}>
                      {t === 'library' ? '◈ DJ LIBRARY' : '🎵 TAG SCANNER'}
                    </button>
                  ))}
                </div>
                {importSubTab === 'library' && (
                  <SetlistImporter onImport={handleImport} loading={importLoading} />
                )}
                {importSubTab === 'scanner' && (
                  <TagScanner onAddToSet={tracks => {
                    handleImport(tracks.map(t => ({
                      id: t.filename, title: t.title || t.filename,
                      artist: t.artist || 'Unknown', bpm: t.bpm, key: t.camelot,
                    })) as Parameters<typeof handleImport>[0])
                  }} />
                )}
                {error && <div style={{ padding:10, border:`1px solid ${M}`, borderRadius:8, color:M, fontSize:11 }}>{error}</div>}
              </div>
            )}

          </div>
        </div>

        {/* ════ RIGHT PANEL ════ */}
        <div ref={resultsPanelRef} style={{ flex: isMobile ? undefined : 1, width: isMobile ? '100%' : undefined, display: isMobile && !mobileShowResults ? 'none' : 'block', overflowY:'auto', background:'#07070e', position:'relative' }}>

          {/* ── Mobile back bar ── */}
          {isMobile && (
            <div style={{ position:'sticky', top:0, zIndex:20, display:'flex', alignItems:'center', height:44, padding:'0 14px', background:'#06060cee', backdropFilter:'blur(12px)', borderBottom:'1px solid #1a1a2e' }}>
              <button onClick={()=>setMobileShowResults(false)} className="sf-btn-ghost" style={{ padding:'6px 12px', borderRadius:8, fontSize:11, letterSpacing:1 }}>
                ← EDIT SET
              </button>
            </div>
          )}

          {/* ── Loading beam ── */}
          {(loading||importLoading) && (
            <div style={{ position:'sticky', top:0, zIndex:10, height:3, background:'#0d0d1a', overflow:'hidden' }}>
              <div style={{ position:'absolute', top:0, left:0, height:'100%', width:'30%', background:`linear-gradient(90deg,transparent,${C},${M},transparent)`, animation:'scan 1.4s linear infinite' }} />
            </div>
          )}

          {/* ── Generating/importing skeleton ── */}
          {!set && (loading || importLoading) && (
            <div style={{ padding:'40px 24px', display:'flex', flexDirection:'column', alignItems:'center' }}>
              <div style={{ fontSize:13, color:C, fontWeight:700, letterSpacing:.5, marginBottom:24, animation:'pulse 1.6s ease-in-out infinite' }}>
                {loading ? GENERATE_STAGES[loadingStage] : 'Ordering your tracks…'}
              </div>
              <div style={{ width:'100%', maxWidth:520, display:'flex', flexDirection:'column', gap:8 }}>
                {Array.from({ length:7 }, (_, i) => (
                  <div key={i} style={{ height:52, borderRadius:10, background:'#0a0a14', border:'1px solid #16162a', opacity:1 - i*0.09, animation:'pulse 1.6s ease-in-out infinite', animationDelay:`${i*0.08}s` }} />
                ))}
              </div>
            </div>
          )}

          {/* ── Empty state ── */}
          {!set && !loading && !importLoading && (
            <div style={{ height:'100%', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:40, textAlign:'center' }}>
              <div style={{ position:'absolute', inset:0, overflow:'hidden', pointerEvents:'none' }}>
                <div className="empty-blob1" style={{ position:'absolute', top:'10%', left:'20%', width:420, height:420, background:`radial-gradient(circle,${M}12,transparent 65%)`, filter:'blur(70px)' }} />
                <div className="empty-blob2" style={{ position:'absolute', bottom:'5%', right:'15%', width:380, height:380, background:`radial-gradient(circle,${C}10,transparent 65%)`, filter:'blur(70px)' }} />
              </div>
              <div style={{ position:'absolute', inset:0, backgroundImage:`linear-gradient(${C}04 1px,transparent 1px),linear-gradient(90deg,${C}04 1px,transparent 1px)`, backgroundSize:'44px 44px', maskImage:'radial-gradient(ellipse at 50% 50%,black,transparent 70%)', pointerEvents:'none' }} />
              <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:120, color:`${C}06`, letterSpacing:4, lineHeight:1, userSelect:'none', marginBottom:-20 }}>SET</div>
              <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:120, color:`${M}06`, letterSpacing:4, lineHeight:1, userSelect:'none', marginBottom:32 }}>FORGE</div>
              <div style={{ position:'relative' }}>
                <div style={{ fontSize:32, marginBottom:14 }}>🎧</div>
                <div style={{ fontSize:16, fontWeight:600, color:'#4a4a66', marginBottom:8 }}>Your set will appear here</div>
                <div style={{ fontSize:13, color:'#3a3a58', lineHeight:1.6, maxWidth:320 }}>
                  Use the controls on the left to configure your set, then hit Forge.
                </div>
                <button onClick={tryExample} disabled={loading} style={{ marginTop:24, background:`linear-gradient(100deg,${M},${C})`, color:'#06060c', border:'none', padding:'11px 28px', borderRadius:10, fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:'inherit', letterSpacing:1 }}>
                  ✦ TRY AN EXAMPLE SET
                </button>
              </div>
            </div>
          )}

          {/* ── Set results ── */}
          {set && (
            <div style={{ padding:24 }}>

              {/* First set celebration */}
              {firstSetCelebration && (
                <div style={{ background:`linear-gradient(135deg,${M}14,${C}14)`, border:`1px solid ${C}44`, borderRadius:12, padding:'16px 20px', marginBottom:20, display:'flex', gap:14, alignItems:'flex-start' }}>
                  <div style={{ fontSize:28, flexShrink:0 }}>🎉</div>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:14, fontWeight:700, color:'#e8e8f0', marginBottom:4 }}>Your first set is ready!</div>
                    <div style={{ fontSize:12, color:'#9a9ab8', lineHeight:1.6 }}>Swap any track, drag to reorder, lock your favourites — then save or share.</div>
                  </div>
                  <button onClick={()=>setFirstSetCelebration(false)} style={{ background:'none', border:'none', color:'#4a4a66', cursor:'pointer', fontSize:16, flexShrink:0 }}>✕</button>
                </div>
              )}

              {/* Header */}
              <div style={{ marginBottom:18 }}>
                <h2 style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:36, margin:'0 0 4px', letterSpacing:1, color:C }} className="sf-glow-c">{set.title}</h2>
                <div style={{ fontSize:13, color:'#9a9ab8', lineHeight:1.5, marginBottom:10 }}>{set.summary}</div>
                <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginBottom:14 }}>
                  {[set._meta?.genre||genre, set._meta?.crowd||crowd, set._meta?.familiarity||set._meta?.arc||familiarity].map(tag=>tag&&(
                    <span key={tag} style={{ fontSize:10, color:'#6a6a8a', border:'1px solid #1f1f33', borderRadius:999, padding:'2px 8px' }}>{tag}</span>
                  ))}
                </div>
                {/* Action buttons */}
                <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                  <button onClick={saveSet} disabled={saving} className="sf-btn-ghost" style={{ padding:'8px 14px', borderRadius:8, fontSize:11, animation:savedFlash?'flash .6s ease':'none', color:savedFlash?C:undefined, borderColor:savedFlash?C:undefined }}>
                    {saving?'SAVING…':savedFlash?'✓ SAVED':'◈ SAVE'}
                  </button>
                  {myTeamId && (
                    <label style={{ display:'flex', alignItems:'center', gap:5, fontSize:10, color:'#8a8aa8', fontFamily:"'JetBrains Mono',monospace", cursor:'pointer', padding:'0 4px' }}>
                      <input type="checkbox" checked={shareToTeamOnSave} onChange={e=>setShareToTeamOnSave(e.target.checked)} style={{ accentColor:C }} />
                      🤝 SHARE WITH TEAM
                    </label>
                  )}
                  <button onClick={copyTracklist} className="sf-btn-ghost" style={{ padding:'8px 14px', borderRadius:8, fontSize:11, color:copied?C:undefined, borderColor:copied?C:undefined }}>
                    {copied?'✓ COPIED':'⧉ COPY LIST'}
                  </button>
                  <div style={{ display:'flex', gap:0 }}>
                    <button onClick={exportText}      className="sf-btn-ghost" style={{ padding:'6px 9px', borderRadius:'8px 0 0 8px', fontSize:10, borderRight:'none' }} title="Plain text">TXT</button>
                    <button onClick={exportRekordbox} className="sf-btn-ghost" style={{ padding:'6px 9px', borderRadius:0, fontSize:10, borderRight:'none' }} title="Rekordbox XML">RB</button>
                    <button onClick={exportSerato}    className="sf-btn-ghost" style={{ padding:'6px 9px', borderRadius:0, fontSize:10, borderRight:'none' }} title="Serato M3U">SRT</button>
                    <button onClick={exportTraktor}   className="sf-btn-ghost" style={{ padding:'6px 9px', borderRadius:'0 8px 8px 0', fontSize:10 }} title="Traktor NML">NML</button>
                  </div>
                </div>
              </div>

              {/* Energy bar */}
              <EnergyBar tracks={set.tracks} />

              {/* Camelot + key sequence */}
              <div style={{ marginTop:16, display:'grid', gridTemplateColumns:'auto 1fr', gap:16, alignItems:'start' }}>
                <CamelotWheel tracks={set.tracks} />
                <div style={{ display:'flex', flexDirection:'column', gap:5, paddingTop:26 }}>
                  <div style={{ fontSize:9, letterSpacing:2, color:'#6a6a8a', marginBottom:4 }}>KEY SEQUENCE</div>
                  {set.tracks.map((t,i)=>{
                    const m=(t.key||'').toUpperCase().match(/^(\d+)([AB])$/); const hue=m?CAM_HUES[parseInt(m[1])-1]:null
                    return (
                      <div key={i} style={{ display:'flex', alignItems:'center', gap:7, fontSize:10 }}>
                        <span style={{ color:M, fontFamily:"'Bebas Neue',sans-serif", fontSize:12, minWidth:20 }}>{String(t.n).padStart(2,'0')}</span>
                        {hue!==null && <span style={{ width:7, height:7, borderRadius:'50%', background:`hsl(${hue},85%,58%)`, flexShrink:0, boxShadow:`0 0 5px hsl(${hue},85%,58%)` }} />}
                        <span style={{ color:'#e8e8f0', fontWeight:700, minWidth:28 }}>{t.key}</span>
                        <span style={{ color:'#6a6a8a', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', flex:1 }}>{t.artist} — {t.title}</span>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Track list */}
              <div style={{ marginTop:18, display:'flex', flexDirection:'column', gap:7 }}>
                {set.tracks.map((t,i)=>(
                  <div key={`${t.n}-${t.title}`} className="sf-row" style={{ animationDelay:`${i*0.025}s`, display:'flex', flexDirection:'column' }}>
                    <div
                      className="sf-track"
                      data-track-index={i}
                      onDragOver={e => { e.preventDefault(); setDragOverIndex(i) }}
                      onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOverIndex(null) }}
                      onDrop={() => {
                        if (draggedLiked) { insertLikedTrack(draggedLiked, i); setDraggedLiked(null) }
                        else if (dragIndex !== null && dragIndex !== i) reorderTracks(dragIndex, i)
                        setDragIndex(null); setDragOverIndex(null)
                      }}
                      style={isMobile ? { display:'flex', flexDirection:'column', gap:8, background:'#0a0a14',
                        border: dragOverIndex===i && dragIndex!==i ? `1px solid ${C}` : locked.has(i) ? '1px solid #f59e0b44' : '1px solid #16162a',
                        borderRadius: (openWhy.has(i) || editingIndex===i || previewOpen.has(i)) ? '10px 10px 0 0' : 10, padding:'12px 14px', opacity: dragIndex===i ? 0.35 : swapping===i ? 0.45 : 1, transition:'.15s' }
                        : { display:'grid', gridTemplateColumns:'18px 28px 1fr auto auto auto auto auto auto', gap:10, alignItems:'center', background:'#0a0a14',
                        border: dragOverIndex===i && dragIndex!==i ? `1px solid ${C}` : locked.has(i) ? '1px solid #f59e0b44' : '1px solid #16162a',
                        borderRadius: (openWhy.has(i) || editingIndex===i || previewOpen.has(i)) ? '10px 10px 0 0' : 10, padding:'10px 14px', opacity: dragIndex===i ? 0.35 : swapping===i ? 0.45 : 1, transition:'.15s' }}>
                      {/* ── Header: drag handle + number + title (+ BPM/key/energy on mobile) ── */}
                      <div style={isMobile ? { display:'flex', alignItems:'center', gap:10, minWidth:0 } : { display:'contents' }}>
                        {/* drag handle — HTML5 DnD for desktop, manual touch tracking for mobile
                            (touch events never fire the HTML5 drag API at all) */}
                        <div
                          draggable
                          role="button"
                          aria-label={`Drag to reorder track ${i + 1}`}
                          onDragStart={e => { e.stopPropagation(); setDragIndex(i) }}
                          onDragEnd={() => { setDragIndex(null); setDragOverIndex(null) }}
                          onTouchStart={e => { setDragIndex(i); touchYRef.current = e.touches[0].clientY; startAutoScroll() }}
                          onTouchMove={e => {
                            if (dragIndex === null) return
                            e.preventDefault()
                            const touch = e.touches[0]
                            touchYRef.current = touch.clientY
                            const el = document.elementFromPoint(touch.clientX, touch.clientY)
                            const rowEl = el?.closest('[data-track-index]')
                            const idx = rowEl ? parseInt(rowEl.getAttribute('data-track-index') || '', 10) : NaN
                            if (!Number.isNaN(idx)) setDragOverIndex(idx)
                          }}
                          onTouchEnd={() => {
                            stopAutoScroll()
                            if (dragIndex !== null && dragOverIndex !== null && dragOverIndex !== dragIndex) reorderTracks(dragIndex, dragOverIndex)
                            setDragIndex(null); setDragOverIndex(null)
                          }}
                          title="Drag to reorder"
                          style={{ cursor:'grab', color: dragIndex===i ? C : '#2a2a48', fontSize:14, textAlign:'center', userSelect:'none', padding:'2px', touchAction:'none', flexShrink:0 }}
                        >⠿</div>
                        <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:20, color:M, flexShrink:0 }} className="sf-glow-m">{String(t.n).padStart(2,'0')}</div>
                        {isMobile ? (
                          <>
                            <div style={{ fontSize:13, fontWeight:700, display:'flex', alignItems:'center', gap:6, minWidth:0, flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                              {t.title}
                            </div>
                            <div className="sf-mono" style={{ fontSize:10, color:'#8a8aa8', flexShrink:0, whiteSpace:'nowrap' }}>
                              <span style={{ color:C }}>{t.bpm}</span> · {t.key} · E{t.energy}
                            </div>
                          </>
                        ) : (
                          <div style={{ minWidth:0 }}>
                            <div style={{ fontSize:13, fontWeight:700, display:'flex', alignItems:'center', gap:6 }}>
                              {t.title}
                              {t.verified===false && (
                                <span title="Couldn't confirm this track exists on Spotify — double-check it, or hit swap." style={{ fontSize:9, color:'#f59e0b', border:'1px solid #f59e0b55', borderRadius:999, padding:'1px 6px', fontWeight:700, letterSpacing:.5 }}>⚠ UNVERIFIED</span>
                              )}
                            </div>
                            <div style={{ fontSize:11, color:'#8a8aa8', display:'flex', alignItems:'center', gap:7 }}>
                              <span>{t.artist}</span>
                              <a href={trackSearchUrl(t,'beatport')}   target="_blank" rel="noopener noreferrer" style={{ fontSize:8, color:'#01FF95', textDecoration:'none', border:'1px solid #01FF9533', borderRadius:3, padding:'1px 5px' }}>BP</a>
                              <a href={trackSearchUrl(t,'spotify')}    target="_blank" rel="noopener noreferrer" style={{ fontSize:8, color:'#1DB954', textDecoration:'none', border:'1px solid #1DB95433', borderRadius:3, padding:'1px 5px' }}>SP</a>
                              <a href={trackSearchUrl(t,'youtube')}    target="_blank" rel="noopener noreferrer" style={{ fontSize:8, color:'#FF0000', textDecoration:'none', border:'1px solid #FF000033', borderRadius:3, padding:'1px 5px' }}>YT</a>
                              <a href={trackSearchUrl(t,'soundcloud')} target="_blank" rel="noopener noreferrer" style={{ fontSize:8, color:'#FF5500', textDecoration:'none', border:'1px solid #FF550033', borderRadius:3, padding:'1px 5px' }}>SC</a>
                              <a href={trackSearchUrl(t,'tunebat')} target="_blank" rel="noopener noreferrer" title="Verify BPM & key on Tunebat" style={{ fontSize:8, color:C, textDecoration:'none', border:`1px solid ${C}33`, borderRadius:3, padding:'1px 5px' }}>TB</a>
                              <button onClick={()=>togglePreview(i)} title={t.spotifyId?'Preview on Spotify':'No verified Spotify match to preview'} aria-expanded={previewOpen.has(i)}
                                style={{ fontSize:8, color:previewOpen.has(i)?'#1DB954':'#5a5a78', background:'transparent', textDecoration:'none', border:`1px solid ${previewOpen.has(i)?'#1DB95466':'#23233a'}`, borderRadius:3, padding:'1px 5px', cursor:'pointer', fontFamily:'inherit' }}>
                                ▶ PREVIEW
                              </button>
                            </div>
                            {t.transition ? (
                              <div style={{ fontSize:10, color:'#5a5a78', marginTop:2 }}>↳ {t.transition}</div>
                            ) : pendingTransitionKeys.has(trackKey(t.artist,t.title)) && (
                              <div style={{ fontSize:10, color:C, marginTop:2, animation:'pulse 1.2s infinite' }}>↳ Generating mix note…</div>
                            )}
                          </div>
                        )}
                      </div>

                      {/* ── Mobile-only: artist + verified badge, own row ── */}
                      {isMobile && (
                        <div style={{ fontSize:11, color:'#8a8aa8', display:'flex', alignItems:'center', gap:6, minWidth:0 }}>
                          <span style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{t.artist}</span>
                          {t.verified===false && (
                            <span title="Couldn't confirm this track exists on Spotify — double-check it, or hit swap." style={{ fontSize:9, color:'#f59e0b', border:'1px solid #f59e0b55', borderRadius:999, padding:'1px 6px', fontWeight:700, letterSpacing:.5, flexShrink:0 }}>⚠ UNVERIFIED</span>
                          )}
                        </div>
                      )}

                      {/* ── Mobile-only: link chips, own row ── */}
                      {isMobile && (
                        <div style={{ display:'flex', alignItems:'center', gap:7, flexWrap:'wrap' }}>
                          <a href={trackSearchUrl(t,'beatport')}   target="_blank" rel="noopener noreferrer" style={{ fontSize:9, color:'#01FF95', textDecoration:'none', border:'1px solid #01FF9533', borderRadius:4, padding:'3px 7px' }}>BP</a>
                          <a href={trackSearchUrl(t,'spotify')}    target="_blank" rel="noopener noreferrer" style={{ fontSize:9, color:'#1DB954', textDecoration:'none', border:'1px solid #1DB95433', borderRadius:4, padding:'3px 7px' }}>SP</a>
                          <a href={trackSearchUrl(t,'youtube')}    target="_blank" rel="noopener noreferrer" style={{ fontSize:9, color:'#FF0000', textDecoration:'none', border:'1px solid #FF000033', borderRadius:4, padding:'3px 7px' }}>YT</a>
                          <a href={trackSearchUrl(t,'soundcloud')} target="_blank" rel="noopener noreferrer" style={{ fontSize:9, color:'#FF5500', textDecoration:'none', border:'1px solid #FF550033', borderRadius:4, padding:'3px 7px' }}>SC</a>
                          <a href={trackSearchUrl(t,'tunebat')} target="_blank" rel="noopener noreferrer" title="Verify BPM & key on Tunebat" style={{ fontSize:9, color:C, textDecoration:'none', border:`1px solid ${C}33`, borderRadius:4, padding:'3px 7px' }}>TB</a>
                          <button onClick={()=>togglePreview(i)} title={t.spotifyId?'Preview on Spotify':'No verified Spotify match to preview'} aria-expanded={previewOpen.has(i)}
                            style={{ fontSize:9, color:previewOpen.has(i)?'#1DB954':'#5a5a78', background:'transparent', textDecoration:'none', border:`1px solid ${previewOpen.has(i)?'#1DB95466':'#23233a'}`, borderRadius:4, padding:'3px 7px', cursor:'pointer', fontFamily:'inherit' }}>
                            ▶ PREVIEW
                          </button>
                        </div>
                      )}

                      {/* ── Mobile-only: mix note, own row (desktop's version rendered inline above) ── */}
                      {isMobile && (t.transition ? (
                        <div
                          onClick={() => setExpandedNotes(prev => { const n = new Set(prev); if (n.has(i)) n.delete(i); else n.add(i); return n })}
                          style={{
                            fontSize:11, color:'#5a5a78', cursor:'pointer',
                            ...(!expandedNotes.has(i) ? { whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' } : {}),
                          }}
                        >↳ {t.transition}</div>
                      ) : pendingTransitionKeys.has(trackKey(t.artist,t.title)) && (
                        <div style={{ fontSize:11, color:C, animation:'pulse 1.2s infinite' }}>↳ Generating mix note…</div>
                      ))}

                      {/* ── Desktop-only: BPM/key/energy column ── */}
                      {!isMobile && (
                        <div style={{ textAlign:'right', fontSize:11, lineHeight:1.7 }}>
                          <div style={{ color:C }}>{t.bpm}<span style={{ color:'#4a4a66' }}> BPM</span></div>
                          <div>{t.key}</div>
                          <div style={{ color:'#5a5a78' }}>E{t.energy}</div>
                        </div>
                      )}

                      {/* ── Action buttons — own full-width row on mobile, inline columns on desktop ── */}
                      <div style={isMobile ? { display:'flex', gap:8 } : { display:'contents' }}>
                        <button onClick={()=>toggleLike(t)} title={likedKeys.has(trackKey(t.artist,t.title))?'Unlike':'Like'} aria-label={likedKeys.has(trackKey(t.artist,t.title))?`Unlike track ${i+1}`:`Like track ${i+1}`} aria-pressed={likedKeys.has(trackKey(t.artist,t.title))} style={{ background:'transparent', border:`1px solid ${likedKeys.has(trackKey(t.artist,t.title))?M:'#23233a'}`, color:likedKeys.has(trackKey(t.artist,t.title))?M:'#5a5a78', width:32, height:32, borderRadius:8, cursor:'pointer', fontSize:13, display:'flex', alignItems:'center', justifyContent:'center', transition:'.18s', flexShrink:0, boxShadow:likedKeys.has(trackKey(t.artist,t.title))?`0 0 8px ${M}44`:'none', ...(isMobile?{flex:1}:{}) }}>
                          {likedKeys.has(trackKey(t.artist,t.title))?'♥':'♡'}
                        </button>
                        <button onClick={()=>rateTrack(t)} title={activeSetId ? (feedback[t.n]==='hit'?'Hit with the crowd — tap to mark as missed':feedback[t.n]==='miss'?'Missed with the crowd — tap to clear':'Rate how this track landed with the crowd') : 'Save this set first to rate tracks'} aria-label={`Rate crowd reaction for track ${i+1}`} aria-pressed={!!feedback[t.n]} style={{ background:'transparent', border:`1px solid ${feedback[t.n]==='hit'?C:feedback[t.n]==='miss'?M:'#23233a'}`, color:feedback[t.n]==='hit'?C:feedback[t.n]==='miss'?M:'#5a5a78', width:32, height:32, borderRadius:8, cursor:'pointer', fontSize:13, display:'flex', alignItems:'center', justifyContent:'center', transition:'.18s', flexShrink:0, boxShadow:feedback[t.n]==='hit'?`0 0 8px ${C}44`:feedback[t.n]==='miss'?`0 0 8px ${M}44`:'none', ...(isMobile?{flex:1}:{}) }}>
                          {feedback[t.n]==='hit'?'👍':feedback[t.n]==='miss'?'👎':'📊'}
                        </button>
                        <button onClick={()=>toggleLock(i)} title={locked.has(i)?'Unlock':'Lock'} aria-label={locked.has(i)?`Unlock track ${i+1}`:`Lock track ${i+1}`} aria-pressed={locked.has(i)} style={{ background:'transparent', border:`1px solid ${locked.has(i)?'#f59e0b':'#23233a'}`, color:locked.has(i)?'#f59e0b':'#5a5a78', width:32, height:32, borderRadius:8, cursor:'pointer', fontSize:13, display:'flex', alignItems:'center', justifyContent:'center', transition:'.18s', flexShrink:0, boxShadow:locked.has(i)?'0 0 8px #f59e0b44':'none', ...(isMobile?{flex:1}:{}) }}>
                          {locked.has(i)?'🔒':'🔓'}
                        </button>
                        <button className="sf-swap" onClick={()=>swapTrack(i)} disabled={swapping!==null} title="Swap track" aria-label={`Swap track ${i+1}`} style={{ background:'transparent', border:'1px solid #23233a', color:swapping===i?M:'#8a8aa8', width:32, height:32, borderRadius:8, cursor:swapping!==null?'default':'pointer', fontSize:16, display:'flex', alignItems:'center', justifyContent:'center', transition:'.18s', flexShrink:0, ...(isMobile?{flex:1}:{}) }}>
                          <span style={swapping===i?{animation:'spin .8s linear infinite',display:'inline-block'}:{}}>⟳</span>
                        </button>
                        <button onClick={()=>toggleWhy(i)} title={quota?.tier==='free'?'Why this track? (Pro feature)':'Why this track?'} aria-label={`Why track ${i+1} was chosen`} aria-expanded={openWhy.has(i)} style={{ background:'transparent', border:`1px solid ${openWhy.has(i)?C:'#23233a'}`, color:openWhy.has(i)?C:'#5a5a78', width:32, height:32, borderRadius:8, cursor:'pointer', fontSize:12, fontWeight:700, display:'flex', alignItems:'center', justifyContent:'center', transition:'.18s', flexShrink:0, fontFamily:"'JetBrains Mono',monospace", ...(isMobile?{flex:1}:{}) }}>
                          {quota?.tier==='free' ? '🔒' : '?'}
                        </button>
                        <button onClick={()=>editingIndex===i ? cancelEdit() : startEdit(i)} title="Edit track details" aria-label={`Edit track ${i+1} details`} aria-expanded={editingIndex===i} style={{ background:'transparent', border:`1px solid ${editingIndex===i?C:'#23233a'}`, color:editingIndex===i?C:'#5a5a78', width:32, height:32, borderRadius:8, cursor:'pointer', fontSize:13, display:'flex', alignItems:'center', justifyContent:'center', transition:'.18s', flexShrink:0, ...(isMobile?{flex:1}:{}) }}>
                          ✎
                        </button>
                        <button className="sf-delete-track" onClick={()=>deleteTrack(i)} title="Remove track" aria-label={`Remove track ${i+1} from set`} style={{ background:'transparent', border:'1px solid #23233a', color:'#5a5a78', width:32, height:32, borderRadius:8, cursor:'pointer', fontSize:13, display:'flex', alignItems:'center', justifyContent:'center', transition:'.18s', flexShrink:0, marginLeft:8, ...(isMobile?{flex:1}:{}) }}>
                          🗑
                        </button>
                      </div>
                    </div>
                    {editingIndex===i && editDraft && (
                      <div style={{ background:'#08080f', border:'1px solid #16162a', borderTop:'none', borderRadius:'0 0 10px 10px', padding:'14px' }}>
                        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:8 }}>
                          <div>
                            <SFLabel>ARTIST</SFLabel>
                            <input className="sf-input" value={editDraft.artist} onChange={e=>setEditDraft(d=>d&&({...d,artist:e.target.value}))} />
                          </div>
                          <div>
                            <SFLabel>TITLE</SFLabel>
                            <input className="sf-input" value={editDraft.title} onChange={e=>setEditDraft(d=>d&&({...d,title:e.target.value}))} />
                          </div>
                        </div>
                        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:8 }}>
                          <div>
                            <SFLabel>BPM</SFLabel>
                            <input className="sf-input" type="number" value={editDraft.bpm} onChange={e=>setEditDraft(d=>d&&({...d,bpm:e.target.value}))} />
                          </div>
                          <div>
                            <SFLabel>CAMELOT KEY</SFLabel>
                            <input className="sf-input" style={{ fontFamily:"'JetBrains Mono',monospace" }} value={editDraft.key} onChange={e=>setEditDraft(d=>d&&({...d,key:e.target.value.toUpperCase()}))} />
                          </div>
                        </div>
                        <div style={{ marginBottom:8 }}>
                          <SFLabel>ENERGY: <span style={{ color:C }}>{editDraft.energy}/10</span></SFLabel>
                          <input type="range" min={1} max={10} value={editDraft.energy} onChange={e=>setEditDraft(d=>d&&({...d,energy:+e.target.value}))} style={{ width:'100%', accentColor:C }} />
                        </div>
                        <div style={{ marginBottom:10 }}>
                          <SFLabel>MIX NOTE <span style={{ color:'#4a4a66' }}>— optional</span></SFLabel>
                          <input className="sf-input" value={editDraft.transition} onChange={e=>setEditDraft(d=>d&&({...d,transition:e.target.value}))} placeholder="how to mix this track in…" />
                        </div>
                        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                          <a href={`https://tunebat.com/Search?q=${encodeURIComponent(`${editDraft.artist} ${editDraft.title}`)}`} target="_blank" rel="noopener noreferrer"
                            style={{ fontSize:11, color:C, textDecoration:'underline' }}>🔍 Verify on Tunebat</a>
                          <div style={{ flex:1 }} />
                          <button onClick={cancelEdit} className="sf-btn-ghost" style={{ padding:'6px 14px', borderRadius:8, fontSize:11 }}>Cancel</button>
                          <button onClick={commitEdit} className="sf-btn-primary" style={{ padding:'6px 16px', borderRadius:8, fontSize:11 }}>Save</button>
                        </div>
                      </div>
                    )}
                    {openWhy.has(i) && (
                      <div style={{ background:'#08080f', border:'1px solid #16162a', borderTop:'none', borderRadius:'0 0 10px 10px', padding:'12px 14px' }}>
                        {quota?.tier==='free' ? (
                          <div style={{ fontSize:12, color:'#8a8aa8', lineHeight:1.6 }}>
                            🔒 &quot;Why this track?&quot; explanations are a <span style={{ color:C, fontWeight:700 }}>Pro</span> feature.
                            <Link href="/#pricing" style={{ display:'inline', marginLeft:6, color:C, textDecoration:'underline' }}>Upgrade →</Link>
                          </div>
                        ) : loadingWhy.has(i) ? (
                          <div style={{ fontSize:11, color:'#4a4a66', fontFamily:"'JetBrains Mono',monospace", animation:'pulse 1.2s infinite' }}>Analysing track choice…</div>
                        ) : whyData[i] ? (
                          <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                            <div style={{ fontSize:12, color:'#c8c8e0', lineHeight:1.6 }}>{whyData[i].why}</div>
                            <div style={{ fontSize:11, color:'#8a8aa8', lineHeight:1.5 }}><span style={{ color:C, fontWeight:700 }}>In: </span>{whyData[i].inbound}</div>
                            <div style={{ fontSize:11, color:'#8a8aa8', lineHeight:1.5 }}><span style={{ color:M, fontWeight:700 }}>Tip: </span>{whyData[i].tip}</div>
                          </div>
                        ) : (
                          <div style={{ fontSize:11, color:'#4a4a66' }}>Couldn&apos;t load — try again.</div>
                        )}
                      </div>
                    )}
                    {previewOpen.has(i) && (
                      <div style={{ background:'#08080f', border:'1px solid #16162a', borderTop:'none', borderRadius:'0 0 10px 10px', padding: t.spotifyId ? '10px' : '12px 14px' }}>
                        {t.spotifyId ? (
                          <iframe
                            title={`Spotify preview — ${t.artist} — ${t.title}`}
                            src={`https://open.spotify.com/embed/track/${t.spotifyId}?utm_source=generator`}
                            width="100%" height="80" style={{ border:'none', borderRadius:8, display:'block' }}
                            allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                            loading="lazy"
                          />
                        ) : (
                          <div style={{ fontSize:11, color:'#4a4a66', lineHeight:1.6 }}>
                            No verified Spotify match to embed a preview for — try the search links above instead.
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
                {draggedLiked && (
                  <div
                    onDragOver={e => e.preventDefault()}
                    onDrop={() => { insertLikedTrack(draggedLiked, set.tracks.length); setDraggedLiked(null) }}
                    style={{ border:`1px dashed ${C}`, borderRadius:10, padding:'10px 14px', textAlign:'center', fontSize:11, color:C, background:`${C}08` }}
                  >
                    ⠿ Drop here to add to the end
                  </div>
                )}
              </div>

              <div style={{ marginTop:14, fontSize:10, color:'#3a3a58', textAlign:'center' }}>
                AI-curated blueprints — verify BPM & key in your library before performing.
              </div>

              {/* Mix Simulator */}
              <MixSimulator tracks={set.tracks} />
            </div>
          )}
        </div>

      </div>
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────
function SFLabel({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize:9, letterSpacing:2, color:'#6a6a8a', marginBottom:6 }}>{children}</div>
}

function EnergyBar({ tracks }: { tracks: Track[] }) {
  return (
    <div style={{ display:'flex', alignItems:'flex-end', gap:2, height:44, background:'#0a0a14', border:'1px solid #16162a', borderRadius:10, padding:'5px 10px' }}>
      {tracks.map((t,i)=>(
        <div key={i} title={`${t.artist} — ${t.title} · E${t.energy}`} style={{ flex:1, height:`${(t.energy/10)*100}%`, minHeight:2, background:`linear-gradient(180deg,${M},${C})`, borderRadius:2, opacity:.85 }} />
      ))}
    </div>
  )
}

function CamelotWheel({ tracks }: { tracks: Track[] }) {
  const [hovered, setHovered] = useState<string|null>(null)
  const SZ=220, CX=110, CY=110, RO=104, RM=72, RI=44

  const keyMap: Record<string,Track[]> = {}
  tracks.forEach(t=>{ const k=(t.key||'').toUpperCase().trim(); if(!k) return; if(!keyMap[k]) keyMap[k]=[]; keyMap[k].push(t) })
  const usedKeys=new Set(Object.keys(keyMap))

  function polar(r:number,deg:number){ const rad=((deg-90)*Math.PI)/180; return{x:CX+r*Math.cos(rad),y:CY+r*Math.sin(rad)} }
  function segPath(num:number,type:'A'|'B'){ const s=(num-1)*30,e=num*30,r1=type==='B'?RM+1:RI,r2=type==='B'?RO:RM-1,p1=polar(r2,s),p2=polar(r2,e),p3=polar(r1,e),p4=polar(r1,s); return `M${p1.x.toFixed(1)} ${p1.y.toFixed(1)} A${r2} ${r2} 0 0 1 ${p2.x.toFixed(1)} ${p2.y.toFixed(1)} L${p3.x.toFixed(1)} ${p3.y.toFixed(1)} A${r1} ${r1} 0 0 0 ${p4.x.toFixed(1)} ${p4.y.toFixed(1)}Z` }
  function segCenter(num:number,type:'A'|'B'){ return polar(type==='B'?(RO+RM)/2:(RM+RI)/2,(num-0.5)*30) }

  const seqPoints=tracks.map(t=>{ const m=(t.key||'').toUpperCase().trim().match(/^(\d+)([AB])$/); if(!m) return null; const c=segCenter(parseInt(m[1]),m[2] as 'A'|'B'); return `${c.x.toFixed(1)},${c.y.toFixed(1)}` }).filter(Boolean).join(' ')
  const hovTracks=hovered?(keyMap[hovered]||[]):[]

  return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:6 }}>
      <div style={{ fontSize:9, letterSpacing:2, color:'#6a6a8a' }}>CAMELOT WHEEL</div>
      <svg width={SZ} height={SZ} viewBox={`0 0 ${SZ} ${SZ}`} style={{ overflow:'visible' }}>
        {Array.from({length:12},(_,i)=>i+1).map(num=>{
          const hue=CAM_HUES[num-1]
          return (['B','A'] as const).map(type=>{
            const key=`${num}${type}`,used=usedKeys.has(key),isHov=hovered===key,c=segCenter(num,type)
            return (
              <g key={key} onMouseEnter={()=>setHovered(key)} onMouseLeave={()=>setHovered(null)} style={{cursor:'pointer'}}>
                <path d={segPath(num,type)} fill={used?`hsl(${hue},88%,${type==='B'?60:50}%)`:`hsl(${hue},28%,14%)`} stroke="#07070e" strokeWidth={1.5} opacity={isHov?1:used?0.88:0.45} />
                <text x={c.x} y={c.y-(used&&keyMap[key].length>0?4:0)} textAnchor="middle" dominantBaseline="middle" fontSize={type==='B'?8:7} fontWeight={used?'700':'400'} fill={used?'#fff':'#2a2a48'} fontFamily="'JetBrains Mono',monospace" pointerEvents="none">{key}</text>
                {used&&<text x={c.x} y={c.y+5} textAnchor="middle" dominantBaseline="middle" fontSize={5} fill={type==='B'?'rgba(0,0,0,.7)':'rgba(255,255,255,.7)'} fontFamily="'JetBrains Mono',monospace" pointerEvents="none">{keyMap[key].map(t=>t.n).join('·')}</text>}
              </g>
            )
          })
        })}
        {seqPoints&&<polyline points={seqPoints} fill="none" stroke={C} strokeWidth={1.5} strokeDasharray="4 3" opacity={0.55} strokeLinejoin="round" />}
        {tracks.map((t,i)=>{ const m=(t.key||'').toUpperCase().trim().match(/^(\d+)([AB])$/); if(!m) return null; const c=segCenter(parseInt(m[1]),m[2] as 'A'|'B'); return <circle key={i} cx={c.x} cy={c.y} r={2.5} fill={`hsl(${CAM_HUES[parseInt(m[1])-1]},90%,70%)`} stroke="#07070e" strokeWidth={1} opacity={0.9} /> })}
        <circle cx={CX} cy={CY} r={RI-2} fill="#06060c" stroke="#1a1a2e" strokeWidth={1} />
        <text x={CX} y={CY-5} textAnchor="middle" fontSize={12} fontFamily="'Bebas Neue',sans-serif" fill="#3a3a58">{usedKeys.size}</text>
        <text x={CX} y={CY+6} textAnchor="middle" fontSize={6} fontFamily="'JetBrains Mono',monospace" fill="#2a2a48">KEYS</text>
      </svg>
      <div style={{ minHeight:28, fontSize:10, textAlign:'center', color:'#9a9ab8', lineHeight:1.5, maxWidth:220 }}>
        {hovered
          ? hovTracks.length>0
            ? <><span style={{color:C,fontWeight:700}}>{hovered}</span>{' — '}{hovTracks.map(t=>`${t.n}. ${t.title}`).join(' · ')}</>
            : <span style={{color:'#4a4a66'}}>Not used in this set</span>
          : <span style={{color:'#3a3a58',fontSize:9,letterSpacing:1}}>HOVER A KEY TO INSPECT</span>}
      </div>
    </div>
  )
}
