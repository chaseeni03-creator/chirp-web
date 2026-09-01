// All game state on the web app is anonymous and local to this browser —
// there are no accounts/profiles here (see README), so nothing is written to
// Supabase for gameplay. This is the entire "backend" for streaks/completion.

const PREFIX = 'chirp-web:'

function read(key, fallback) {
  try {
    const raw = localStorage.getItem(PREFIX + key)
    return raw ? JSON.parse(raw) : fallback
  } catch {
    return fallback
  }
}

function write(key, value) {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value))
  } catch {
    // localStorage unavailable (private browsing, quota, etc.) — fail silently,
    // the game still works, it just won't remember completion/streaks.
  }
}

/** Has this game already been completed today, and with what result? */
export function getTodayResult(gameKey, dateStr) {
  const rec = read(`result:${gameKey}`, null)
  if (!rec || rec.date !== dateStr) return null
  return rec
}

export function saveTodayResult(gameKey, dateStr, result) {
  write(`result:${gameKey}`, { date: dateStr, ...result })
}

/** Simple day-over-day streak counter per game, kept client-side only. */
export function bumpStreak(gameKey, dateStr, won) {
  const streak = read(`streak:${gameKey}`, { current: 0, best: 0, lastDate: null })
  if (!won) {
    streak.current = 0
  } else if (streak.lastDate === dateStr) {
    // already counted today
  } else {
    streak.current += 1
    streak.lastDate = dateStr
  }
  streak.best = Math.max(streak.best, streak.current)
  write(`streak:${gameKey}`, streak)
  return streak
}

export function getStreak(gameKey) {
  return read(`streak:${gameKey}`, { current: 0, best: 0, lastDate: null })
}

/** Generic get/set for in-progress game state (resume mid-puzzle on refresh). */
export function getInProgress(gameKey, dateStr) {
  const rec = read(`progress:${gameKey}`, null)
  if (!rec || rec.date !== dateStr) return null
  return rec.state
}

export function saveInProgress(gameKey, dateStr, state) {
  write(`progress:${gameKey}`, { date: dateStr, state })
}

export function clearInProgress(gameKey) {
  try {
    localStorage.removeItem(PREFIX + `progress:${gameKey}`)
  } catch {
    /* ignore */
  }
}

/** Generic personal-best tracker for endless games (e.g. More vs Less). */
export function getBest(key, fallback = 0) {
  return read(`best:${key}`, fallback)
}

export function setBestIfHigher(key, value) {
  const current = getBest(key, 0)
  if (value > current) write(`best:${key}`, value)
  return Math.max(current, value)
}
