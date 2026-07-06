// ▸ Place at: lib/trend-sources.ts
//
// Static config mapping SetForge's built-in genres (see GENRE_GROUPS in
// app/app/page.tsx) to Spotify's own editorial playlists for that sound.
// These are Spotify-curated (not user playlists), refreshed by Spotify's
// editorial team on their own schedule — exactly the "what's actually being
// played right now" signal we want. Genres not listed here (including any
// custom free-text genre a user types in) simply get no trend injection.
//
// Playlist IDs found via https://open.spotify.com/playlist/<id> — verify
// periodically, Spotify occasionally retires/renames editorial playlists.

export const GENRE_TREND_SOURCES: Record<string, { spotifyPlaylistIds: string[] }> = {
  'Tech House':    { spotifyPlaylistIds: ['37i9dQZF1DX4dyzvuaRJ0n'] },  // mint
  'House':         { spotifyPlaylistIds: ['37i9dQZF1DXa8NOEUWPn9W'] },  // Housewerk
  'Deep House':    { spotifyPlaylistIds: ['37i9dQZF1DX2TRYkJECvfC'] },  // Deep House Relax
  'Afro House':    { spotifyPlaylistIds: ['37i9dQZF1DX5wO3czN5dc1'] },  // Afro House Pulse
  'Techno':        { spotifyPlaylistIds: ['37i9dQZF1DX6J5NfMJS675'] },  // Techno Bunker
  'Drum & Bass':   { spotifyPlaylistIds: ['37i9dQZF1DX5wDmLW735Yd'] },  // Massive Drum & Bass
  'Trance':        { spotifyPlaylistIds: ['37i9dQZF1DX91oIci4su1D'] },  // Trance Mission
  'Dubstep':       { spotifyPlaylistIds: ['37i9dQZF1DX0hvSv9Rf41p'] },  // Bass Arcade
  'Disco / Funk':  { spotifyPlaylistIds: ['37i9dQZF1DX1MUPbVKMgJE'] },  // Disco Forever
  'Hip Hop':       { spotifyPlaylistIds: ['37i9dQZF1DX0XUsuxWHRQd'] },  // RapCaviar
}
