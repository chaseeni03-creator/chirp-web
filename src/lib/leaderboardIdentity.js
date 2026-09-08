// Lightweight per-browser identity for the global daily leaderboard —
// deliberately NOT the same as Groups' stored `user` (src/lib/groups.js),
// which is null for anyone who's never joined/created a group (most
// visitors). This is asked for once, the first time anyone submits a score
// to the leaderboard, regardless of whether they ever touch Groups.

const LS_KEY = 'chirp-web:leaderboard-identity'

/** { nickname: string|null, guestId: string } — guestId is generated once and
 * never shown to the user; it's purely the DB-side uniqueness key for guests
 * (see supabase/daily_leaderboard.sql) so two different people who happen to
 * pick the same nickname don't overwrite each other's scores. */
export function getLeaderboardIdentity() {
  try {
    const raw = localStorage.getItem(LS_KEY)
    const parsed = raw ? JSON.parse(raw) : null
    if (parsed && typeof parsed.guestId === 'string') return parsed
  } catch {
    /* fall through to a fresh identity */
  }
  const fresh = { nickname: null, guestId: crypto.randomUUID() }
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(fresh))
  } catch {
    /* localStorage unavailable — identity just won't persist across visits */
  }
  return fresh
}

export function setLeaderboardNickname(nickname) {
  const identity = getLeaderboardIdentity()
  const next = { ...identity, nickname }
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(next))
  } catch {
    /* ignore */
  }
  return next
}
