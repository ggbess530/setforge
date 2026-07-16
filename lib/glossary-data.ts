// DJ Wiki / Glossary — hand-authored reference content for beginner DJs.
// Consumed by app/wiki/page.tsx. Static data, no DB/API cost — edit freely.

export type GlossaryCategory =
  | 'Mixing Fundamentals'
  | 'Harmony & Key'
  | 'Track Anatomy'
  | 'Gear & Software'
  | 'Genres & Styles'
  | 'Gigging & Business'
  | 'SetForge Terms'

export interface GlossaryTerm {
  slug: string
  term: string
  category: GlossaryCategory
  definition: string
  tip?: string
}

export const CATEGORIES: GlossaryCategory[] = [
  'Mixing Fundamentals',
  'Harmony & Key',
  'Track Anatomy',
  'Gear & Software',
  'Genres & Styles',
  'Gigging & Business',
  'SetForge Terms',
]

export const GLOSSARY: GlossaryTerm[] = [
  // ── Mixing Fundamentals ──
  {
    slug: 'beatmatching',
    term: 'Beatmatching',
    category: 'Mixing Fundamentals',
    definition: 'Manually adjusting the tempo (and often the phase) of an incoming track so its beats line up perfectly with the track already playing, so the two can be blended without a clash.',
    tip: 'Modern gear can do this for you with SYNC, but most DJs still learn it by ear first — it trains you to actually hear tempo and phrasing, which SYNC can\'t do for you.',
  },
  {
    slug: 'phrasing',
    term: 'Phrasing',
    category: 'Mixing Fundamentals',
    definition: 'The musical structure of a track broken into repeating blocks, almost always in multiples of 8 or 16 bars (intro, build, drop, breakdown, etc). Mixing "on the phrase" means starting your transition at the start of one of these blocks, not mid-sentence.',
    tip: 'A drop landing on the wrong beat of a phrase is one of the most common "something feels off" mixing mistakes, even when the BPM is matched exactly.',
  },
  {
    slug: 'eq-mixing',
    term: 'EQ Mixing (EQing)',
    category: 'Mixing Fundamentals',
    definition: 'Using a mixer\'s low/mid/high EQ knobs to cut frequencies from one track while another plays, most commonly killing the incoming track\'s bass until the outgoing track\'s bass is faded, so two basslines never clash.',
    tip: 'The single biggest jump from "amateur mix" to "clean mix" is usually just cutting bass early and often — never let two basslines play together for more than a beat or two.',
  },
  {
    slug: 'crossfader',
    term: 'Crossfader',
    category: 'Mixing Fundamentals',
    definition: 'The horizontal slider on a mixer that blends between the left (Channel 1) and right (Channel 2) audio sources. Many club and house DJs mix entirely on the channel faders instead and leave the crossfader centered.',
  },
  {
    slug: 'cue-point',
    term: 'Cue Point',
    category: 'Mixing Fundamentals',
    definition: 'A saved marker in a track (usually right at the first beat after the intro) that lets you instantly jump back to that exact spot instead of scrubbing to find it live.',
  },
  {
    slug: 'gain-staging',
    term: 'Gain Staging',
    category: 'Mixing Fundamentals',
    definition: 'Setting each channel\'s trim/gain so every track hits the mixer at roughly the same volume level before you touch the faders — prevents one track from suddenly blasting louder or quieter than the last.',
    tip: 'Watch the channel meter, not your ears — aim for it to peak around 0dB (the point just before it turns red/orange) on the loudest part of the track.',
  },
  {
    slug: 'headphone-cue',
    term: 'Headphone Cue (Cueing)',
    category: 'Mixing Fundamentals',
    definition: 'Listening to the next track in your headphones, isolated from what the crowd hears through the speakers, so you can beatmatch and prep the transition before it goes live.',
  },
  {
    slug: 'quantize',
    term: 'Quantize',
    category: 'Mixing Fundamentals',
    definition: 'A setting on modern DJ software/hardware that automatically snaps hot cues, loops, and effects to the nearest beat, so your timing is corrected even if your finger is slightly early or late.',
  },
  {
    slug: 'beat-grid',
    term: 'Beat Grid',
    category: 'Mixing Fundamentals',
    definition: 'An analysis grid laid over a track\'s waveform marking exactly where every beat falls. Software (Rekordbox, Serato, Traktor) uses it to power sync, quantize, and BPM detection — a wrong or drifting grid is the usual cause of "sync isn\'t working right" on a track.',
  },
  {
    slug: 'sync',
    term: 'Sync',
    category: 'Mixing Fundamentals',
    definition: 'A button on modern CDJs/controllers that automatically matches tempo and beat phase between two tracks using their beat grids, doing electronically what beatmatching does by ear.',
    tip: 'Sync is completely normal in professional sets today — the DJs who look down on it are a shrinking, loud minority. What actually matters is the track selection and transitions you build around it.',
  },
  {
    slug: 'looping',
    term: 'Looping',
    category: 'Mixing Fundamentals',
    definition: 'Repeating a set section of a track (e.g. 4 or 8 bars) indefinitely — used to extend an intro/outro for a longer mix window, or to build tension before a drop.',
  },
  {
    slug: 'hot-cue',
    term: 'Hot Cue',
    category: 'Mixing Fundamentals',
    definition: 'A saved trigger point (usually one of 8 colored pads) that jumps instantly to a specific spot in a track — intro, drop, breakdown — with one tap, no scrubbing required.',
  },
  {
    slug: 'filter-sweep',
    term: 'Filter Sweep',
    category: 'Mixing Fundamentals',
    definition: 'Turning a high-pass or low-pass filter knob to gradually strip frequencies out of (or back into) a track — a common transition tool to build energy or smooth a blend without a hard EQ cut.',
  },
  {
    slug: 'backspin',
    term: 'Backspin',
    category: 'Mixing Fundamentals',
    definition: 'Spinning a record (or the jog wheel on a CDJ/controller) rapidly backward to create a sudden, dramatic stop — an old turntablist trick still used today as a transition effect.',
  },
  {
    slug: 'slip-mode',
    term: 'Slip Mode',
    category: 'Mixing Fundamentals',
    definition: 'A CDJ/controller mode where scratching, looping, or triggering a hot cue temporarily interrupts playback for effect, but the track keeps playing silently underneath — so when you let go, it\'s exactly where it "should" be instead of where you left it.',
  },

  // ── Harmony & Key ──
  {
    slug: 'camelot-wheel',
    term: 'Camelot Wheel',
    category: 'Harmony & Key',
    definition: 'A color-coded wheel (numbers 1–12, letters A/B) that relabels musical keys so DJs can spot compatible keys visually instead of needing music theory. Adjacent numbers, or the same number with a different letter, are harmonically compatible.',
    tip: 'This is exactly the wheel SetForge visualizes for every generated set — hover any track in the results to see where it sits and what it\'s compatible with.',
  },
  {
    slug: 'harmonic-mixing',
    term: 'Harmonic Mixing',
    category: 'Harmony & Key',
    definition: 'Sequencing tracks so their musical keys are compatible (per the Camelot wheel) rather than random, so basslines and melodies from overlapping tracks don\'t clash during a transition.',
  },
  {
    slug: 'musical-key',
    term: 'Key (Musical Key)',
    category: 'Harmony & Key',
    definition: 'The set of notes a track is built around (e.g. A minor, C major) — the harmonic "home base" that determines which other tracks will sound pleasant layered against it versus dissonant.',
  },
  {
    slug: 'relative-major-minor',
    term: 'Relative Major/Minor',
    category: 'Harmony & Key',
    definition: 'A major key and a minor key that share the exact same notes (e.g. C major and A minor) and are therefore fully harmonically compatible — on the Camelot wheel this is the same number, A vs B letter.',
  },
  {
    slug: 'energy-level',
    term: 'Energy Level (Camelot)',
    category: 'Harmony & Key',
    definition: 'Moving clockwise around the Camelot wheel to an adjacent key generally lifts a set\'s perceived energy; moving counter-clockwise pulls it down — a tool for shaping the emotional arc of a set, not just avoiding clashes.',
  },
  {
    slug: 'bpm',
    term: 'BPM (Beats Per Minute)',
    category: 'Harmony & Key',
    definition: 'A track\'s tempo. Matching BPM (or keeping it within a few BPM and nudging the pitch fader) is the first requirement for a clean transition, before key or phrasing even come into play.',
  },
  {
    slug: 'pitch-fader',
    term: 'Pitch Fader / Tempo Slider',
    category: 'Harmony & Key',
    definition: 'A slider on a turntable, CDJ, or controller that speeds up or slows down a track\'s playback (usually within a ±8% or ±16% range), used to bring two tracks\' BPMs together for beatmatching.',
  },
  {
    slug: 'key-lock',
    term: 'Key Lock / Master Tempo',
    category: 'Harmony & Key',
    definition: 'A setting that keeps a track\'s pitch (key) unchanged even as you speed it up or slow it down with the tempo fader — without it, pushing tempo up also raises the pitch, chipmunk-style.',
  },

  // ── Track Anatomy ──
  {
    slug: 'intro',
    term: 'Intro',
    category: 'Track Anatomy',
    definition: 'The opening section of a track, usually beats/percussion only with minimal melody, built specifically to give DJs room to beatmatch and blend in cleanly before the main elements arrive.',
  },
  {
    slug: 'outro',
    term: 'Outro',
    category: 'Track Anatomy',
    definition: 'The closing section of a track, mirroring the intro — elements strip away, leaving mostly beats — giving the DJ a window to mix into the next track without an abrupt stop.',
  },
  {
    slug: 'breakdown',
    term: 'Breakdown',
    category: 'Track Anatomy',
    definition: 'A section (usually mid-track) where the drums drop out and melodic/atmospheric elements take over, lowering the energy before building back up into the next drop — a natural spot to layer in another track\'s intro.',
  },
  {
    slug: 'build-up',
    term: 'Build-up',
    category: 'Track Anatomy',
    definition: 'The rising-tension section right before a drop — risers, snare rolls, filtered percussion climbing in intensity — signaling to the crowd (and the DJ) that a peak moment is coming.',
  },
  {
    slug: 'drop',
    term: 'Drop',
    category: 'Track Anatomy',
    definition: 'The high-energy peak of a track, right after the build-up, where the full beat and bassline hit at once. The moment most dancefloor reactions are built around — and generally not where you want to be mixing in a whole new track.',
  },
  {
    slug: 'acapella',
    term: 'Acapella',
    category: 'Track Anatomy',
    definition: 'A version of a track with only the vocal, no instrumental — used to layer a vocal from one song over the instrumental of another (a "mashup") when the key and BPM line up.',
  },
  {
    slug: 'dj-edit',
    term: 'DJ Edit',
    category: 'Track Anatomy',
    definition: 'A reworked version of a track — extended intro/outro, re-arranged structure, or a cleaned-up acapella/instrumental split — made specifically to be easier or more interesting to mix, rather than for standalone listening.',
  },
  {
    slug: 'transition',
    term: 'Transition',
    category: 'Track Anatomy',
    definition: 'The blend between two tracks — everything from a quick EQ swap to a long, layered 32-bar mix. The core skill DJing is built around: BPM, key, phrasing, and EQ all exist in service of making transitions feel seamless.',
  },

  // ── Gear & Software ──
  {
    slug: 'cdj',
    term: 'CDJ',
    category: 'Gear & Software',
    definition: 'Pioneer DJ\'s standard club-grade digital deck — plays tracks off USB (rarely CD anymore) and is the industry-standard piece of gear you\'ll find booth-side at most clubs and festivals worldwide.',
  },
  {
    slug: 'dj-controller',
    term: 'DJ Controller',
    category: 'Gear & Software',
    definition: 'An all-in-one USB device with jog wheels, faders, and pads that connects to a laptop running DJ software (Serato, rekordbox, Traktor, VirtualDJ) — the most common way beginners start, since it bundles decks + mixer into one affordable box.',
  },
  {
    slug: 'dj-mixer',
    term: 'DJ Mixer',
    category: 'Gear & Software',
    definition: 'The hardware unit that combines multiple audio channels (from CDJs, turntables, or a controller) into one output — crossfader, channel faders, EQ, and effects all live here in a club setup.',
  },
  {
    slug: 'daw',
    term: 'DAW (Digital Audio Workstation)',
    category: 'Gear & Software',
    definition: 'Production software (Ableton Live, FL Studio, Logic) used to make and edit tracks — distinct from DJ software, which is for playing tracks live. Many DJs use both: a DAW to produce/edit, DJ software to perform.',
  },
  {
    slug: 'rekordbox',
    term: 'Rekordbox',
    category: 'Gear & Software',
    definition: 'Pioneer DJ\'s official library-management and performance software — preps tracks (analyzing BPM, key, cue points), organizes crates, and exports to USB for CDJs. SetForge exports sets directly to a Rekordbox XML you can import.',
  },
  {
    slug: 'serato',
    term: 'Serato DJ',
    category: 'Gear & Software',
    definition: 'One of the most widely used DJ performance software platforms, popular with controller and scratch DJs — SetForge exports sets as a Serato-compatible M3U playlist.',
  },
  {
    slug: 'traktor',
    term: 'Traktor',
    category: 'Gear & Software',
    definition: "Native Instruments' DJ performance software, known for deep effects and remix-deck features — SetForge exports sets as a Traktor NML file you can import straight into your collection.",
  },
  {
    slug: 'stems',
    term: 'Stems',
    category: 'Gear & Software',
    definition: 'A track split into isolated components — typically vocals, drums, bass, and melody/other — that can be muted or soloed live. Modern hardware (CDJ Stem players) and software increasingly do this in real time from a normal track file, no separate stem file needed.',
  },
  {
    slug: 'bitrate',
    term: 'Bitrate / Lossless',
    category: 'Gear & Software',
    definition: 'How much audio data a file retains. MP3s are compressed (lossy) at a given bitrate (commonly 320kbps for DJ use); WAV/AIFF/FLAC are lossless, keeping full studio quality — preferred for club systems where compression artifacts become audible on big speakers.',
  },
  {
    slug: 'id3-tags',
    term: 'ID3 Tags / Metadata',
    category: 'Gear & Software',
    definition: 'The embedded info inside an audio file — artist, title, BPM, key, genre, artwork. Clean, accurate tags are what let DJ software (and SetForge\'s library import) sort, search, and analyze your collection correctly.',
  },
  {
    slug: 'usb-export',
    term: 'USB Export',
    category: 'Gear & Software',
    definition: 'Exporting your prepped library/playlist from DJ software onto a USB drive in the format club CDJs read directly — the standard way touring and club DJs carry their music without a laptop.',
  },

  // ── Genres & Styles ──
  {
    slug: 'house',
    term: 'House',
    category: 'Genres & Styles',
    definition: 'A four-on-the-floor electronic genre built around a steady kick drum, usually 120–128 BPM, with roots in Chicago\'s late-1970s/80s club scene — the broad foundation many other subgenres (deep, tech, progressive) branch from.',
  },
  {
    slug: 'techno',
    term: 'Techno',
    category: 'Genres & Styles',
    definition: 'A driving, often darker and more minimal four-on-the-floor genre, typically 125–150 BPM, originating in 1980s Detroit — generally more repetitive and hypnotic than house, built for sustained peak-time energy.',
  },
  {
    slug: 'tech-house',
    term: 'Tech House',
    category: 'Genres & Styles',
    definition: "A hybrid genre blending house's groove with techno's stripped-back, percussive edge — usually 122–128 BPM. Currently one of the most commercially dominant club sounds.",
  },
  {
    slug: 'afro-house',
    term: 'Afro House',
    category: 'Genres & Styles',
    definition: 'A house subgenre built on polyrhythmic African percussion, tribal vocal chants, and organic instrumentation layered over a four-on-the-floor groove, typically 118–124 BPM — one of the fastest-growing sounds in club culture recently.',
  },
  {
    slug: 'progressive-house',
    term: 'Progressive House',
    category: 'Genres & Styles',
    definition: 'A melodic, slow-building house subgenre (typically 122–128 BPM) focused on long, gradual arrangement arcs and emotional builds rather than quick drops.',
  },
  {
    slug: 'deep-house',
    term: 'Deep House',
    category: 'Genres & Styles',
    definition: 'A mellower, jazz- and soul-influenced house subgenre (typically 118–124 BPM) with warm chords, filtered basslines, and a more laid-back groove than mainstream house — common for warm-up sets and lounge settings.',
  },
  {
    slug: 'trance',
    term: 'Trance',
    category: 'Genres & Styles',
    definition: 'A melodic, euphoric electronic genre (typically 128–140 BPM) built around soaring synth lines and long emotional builds toward a big, uplifting drop.',
  },
  {
    slug: 'drum-and-bass',
    term: 'Drum & Bass (DnB)',
    category: 'Genres & Styles',
    definition: 'A UK-originated genre defined by fast breakbeats (typically 160–180 BPM) and heavy sub-bass — much faster tempo than house/techno, so it\'s rarely blended directly with them in a single continuous set.',
  },

  // ── Gigging & Business ──
  {
    slug: 'b2b',
    term: 'B2B (Back to Back)',
    category: 'Gigging & Business',
    definition: 'Two (or more) DJs trading off, typically one track each, sharing a single set — a common format for showcasing chemistry between artists or filling a longer slot collaboratively.',
  },
  {
    slug: 'warm-up-set',
    term: 'Warm-up Set',
    category: 'Gigging & Business',
    definition: 'The opening slot of a night, meant to gradually build energy and fill the room as it arrives — generally lower-tempo, groovier, and less intense than the headliner\'s set, not the place to play your biggest tracks.',
  },
  {
    slug: 'headliner',
    term: 'Headliner',
    category: 'Gigging & Business',
    definition: 'The top-billed act of a lineup, playing the peak-time slot with the biggest crowd and highest energy expectations — usually the artist people specifically bought tickets to see.',
  },
  {
    slug: 'rider',
    term: 'Rider',
    category: 'Gigging & Business',
    definition: "A DJ's written list of technical and hospitality requirements sent to a venue/promoter ahead of a gig — booth setup (CDJ models, mixer, monitor placement), and sometimes green-room requests like food or drink.",
  },
  {
    slug: 'door-deal',
    term: 'Door Deal',
    category: 'Gigging & Business',
    definition: 'A payment structure where the DJ\'s fee is a percentage of ticket/door revenue rather than a flat guarantee — higher upside if the night sells well, but riskier and harder to predict than a guarantee.',
  },
  {
    slug: 'guarantee',
    term: 'Guarantee',
    category: 'Gigging & Business',
    definition: 'A fixed, agreed-upon fee for a gig, paid regardless of how many tickets sell or how the night performs — the opposite of a door deal, and the standard for most professional bookings.',
  },
  {
    slug: 'promoter',
    term: 'Promoter',
    category: 'Gigging & Business',
    definition: 'The person or company that organizes an event — books the DJs, handles the venue, marketing, and ticketing, and is who a DJ typically negotiates fee and rider with directly.',
  },
  {
    slug: 'epk',
    term: 'EPK (Electronic Press Kit)',
    category: 'Gigging & Business',
    definition: "A one-page digital package DJs/artists send to promoters and press — bio, press photos, mix links, streaming stats, and past gig highlights — used to pitch for bookings.",
  },
  {
    slug: 'residency',
    term: 'Residency',
    category: 'Gigging & Business',
    definition: 'A recurring booking at the same venue or event series (weekly, monthly) — a stable income source and a way to build a consistent local following, as opposed to one-off gigs.',
  },
  {
    slug: 'support-slot',
    term: 'Support Slot',
    category: 'Gigging & Business',
    definition: "A DJ set played before the headliner, distinct from a warm-up in that it's often a named booking of its own rather than just the opening timeslot — a common way newer DJs get billed alongside bigger names.",
  },

  // ── SetForge Terms ──
  {
    slug: 'energy-arc',
    term: 'Energy Arc',
    category: 'SetForge Terms',
    definition: "SetForge's draggable curve that shapes how your set's intensity rises and falls over its runtime — drag the 5 points to sketch a slow warm-up, a mid-set peak, a steady climb, or any shape you want, and generation follows it.",
  },
  {
    slug: 'harmonic-key-matching',
    term: 'Harmonic Key Matching (toggle)',
    category: 'SetForge Terms',
    definition: "SetForge's generation option that sequences every track using Camelot-wheel-compatible keys, so transitions are harmonically clean by default without you needing to know any music theory.",
  },
  {
    slug: 'mix-notes',
    term: 'Mix Notes',
    category: 'SetForge Terms',
    definition: 'SetForge\'s optional per-transition guidance (ON) explaining how to blend each pair of tracks — where to bring it in, what to EQ, roughly how long to overlap. Turning it OFF skips this for a faster, tracklist-only generation.',
  },
  {
    slug: 'crate',
    term: 'Crate',
    category: 'SetForge Terms',
    definition: 'A named folder of tracks inside your DJ library (Rekordbox/Serato/Traktor terminology, carried into SetForge\'s Import tab) — used to scope a "Build Set From Crate" generation to a specific pool of tracks instead of your whole collection.',
  },
  {
    slug: 'seen-before-badge',
    term: '"Seen Before" Badge',
    category: 'SetForge Terms',
    definition: "A tag SetForge shows on a track that's appeared in one of your recent generated sets — a visual flag from the history-aware generation system that's trying to keep your sets fresh across sessions.",
  },
  {
    slug: 'set-grade',
    term: 'Set Grade',
    category: 'SetForge Terms',
    definition: "The letter grade SetForge's Analyser (/analyse) gives a pasted tracklist, based on scored categories — Energy Flow, Harmonic Mixing, BPM Progression, Track Selection, Set Structure — plus a written verdict and specific fixes.",
  },
]
