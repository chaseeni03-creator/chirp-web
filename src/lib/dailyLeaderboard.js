// Global daily leaderboard — client side. Mirrors groups.js's score
// functions (submitGroupScore/fetchGroupLeaderboard/subscribeToGroupScores)
// but scoped globally instead of to one group, and backed by
// supabase/daily_leaderboard.sql's RPCs rather than a direct table
// upsert/fetch (a global table can be far larger than a <=20-member group,
// so "top N + my rank" is computed server-side, not fetched whole and
// sorted in JS).

import { supabase, todayStr } from './supabase'
import { getLeaderboardIdentity } from './leaderboardIdentity'

/** Yesterday's date as YYYY-MM-DD, same local-date convention as todayStr(). */
export function yesterdayStr() {
  const d = new Date()
  d.setDate(d.getDate() - 1)
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

/** Submits/updates today's score for the current identity — best score of the day wins (see the RPC). */
export async function submitDailyScore({ gameType, sport, nickname, score, userId, era, difficulty, details }) {
  const identity = getLeaderboardIdentity()
  const { error } = await supabase.rpc('submit_daily_leaderboard_score', {
    p_game_type: gameType,
    p_sport: sport,
    p_game_date: todayStr(),
    p_nickname: nickname,
    p_score: Math.round(score),
    p_user_id: userId ?? null,
    p_guest_id: userId ? null : identity.guestId,
    p_era: era || null,
    p_difficulty: difficulty || null,
    p_details: details ?? null,
  })
  if (error) throw error
}

/** Top N rows for one game/sport/day, each with `rank`. */
export async function fetchDailyLeaderboardTop({ gameType, sport, gameDate = todayStr(), limit = 10 }) {
  const { data, error } = await supabase.rpc('daily_leaderboard_top', {
    p_game_type: gameType,
    p_sport: sport,
    p_game_date: gameDate,
    p_limit: limit,
  })
  if (error) throw error
  return data || []
}

/** The current identity's own rank/score for one game/sport/day — null if they haven't played it. */
export async function fetchMyRank({ gameType, sport, gameDate = todayStr(), userId }) {
  const identity = getLeaderboardIdentity()
  const { data, error } = await supabase.rpc('daily_leaderboard_my_rank', {
    p_game_type: gameType,
    p_sport: sport,
    p_game_date: gameDate,
    p_user_id: userId ?? null,
    p_guest_id: userId ? null : identity.guestId,
  })
  if (error) throw error
  return (data && data[0]) || null
}

/** Today's #1 across every (game_type, sport) combo — one query, powers /champions. */
export async function fetchChampionsToday(gameDate = todayStr()) {
  const { data, error } = await supabase.rpc('daily_leaderboard_champions_today', { p_game_date: gameDate })
  if (error) throw error
  return data || []
}

/** One-time, called right after a guest's first successful Google sign-in — reassigns their leaderboard rows to the new account. */
export async function migrateGuestLeaderboardScores(guestId) {
  const { error } = await supabase.rpc('migrate_guest_leaderboard_scores', { p_guest_id: guestId })
  if (error) throw error
}

// ── Weekly aggregation — TEMPORARY, additive only ───────────────────────────
// Added to give the leaderboard enough entries to look alive while there
// are still too few daily players (see Leaderboard.jsx's WEEKLY_MODE flag).
// Nothing above this point is touched: submitDailyScore still writes one
// row per day exactly as before, and the per-day RPCs/realtime subscription
// stay intact so flipping WEEKLY_MODE back off fully restores today's
// behavior with zero data-path changes. These query daily_leaderboard
// directly (its SELECT RLS is open, confirmed live) rather than via RPC,
// since "sum across a date range" isn't something the existing per-day RPCs
// do and isn't worth a new server-side function for a temporary measure.

/** Monday of the current week (weeksAgo=0) or N weeks back, as YYYY-MM-DD —
 * same calendar-week convention as combinedLeaderboard.js's mondayStr(),
 * duplicated rather than imported to keep these two unrelated leaderboard
 * systems decoupled (see combinedLeaderboard.js's vocabulary note). Exported
 * so Leaderboard.jsx can show the visible week's date range in its subtitle. */
export function mondayStr(weeksAgo = 0) {
  const now = new Date()
  const daysSinceMonday = (now.getDay() + 6) % 7
  const monday = new Date(now)
  monday.setDate(now.getDate() - daysSinceMonday - weeksAgo * 7)
  const yyyy = monday.getFullYear()
  const mm = String(monday.getMonth() + 1).padStart(2, '0')
  const dd = String(monday.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

/** Sunday of that same week — the display-only end of the range shown in
 * Leaderboard.jsx's subtitle (the actual query uses weekRangeFor's exclusive
 * next-Monday bound, not this). Built from local "now" the same way
 * mondayStr is, rather than parsing mondayStr's own string output — an ISO
 * date-only string parses as UTC midnight in JS, which can land on the
 * wrong local day depending on timezone offset. */
export function sundayStr(weeksAgo = 0) {
  const now = new Date()
  const daysSinceMonday = (now.getDay() + 6) % 7
  const sunday = new Date(now)
  sunday.setDate(now.getDate() - daysSinceMonday - weeksAgo * 7 + 6)
  const yyyy = sunday.getFullYear()
  const mm = String(sunday.getMonth() + 1).padStart(2, '0')
  const dd = String(sunday.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

function weekRangeFor(weeksAgo) {
  const start = mondayStr(weeksAgo)
  const end = mondayStr(weeksAgo - 1) // exclusive upper bound — next Monday
  return { start, end }
}

/** Groups a week's raw daily_leaderboard rows by identity, summing each
 * identity's per-day best score (every row already IS "that day's best",
 * per submitDailyScore's upsert semantics, so summing rows = summing days). */
function aggregateByIdentity(rows) {
  const byIdentity = new Map()
  for (const r of rows) {
    const key = r.user_id ? `u:${r.user_id}` : `g:${r.guest_id}`
    const entry = byIdentity.get(key) ?? { score: 0, nickname: r.nickname, latestAt: r.submitted_at }
    entry.score += r.score
    if (r.submitted_at > entry.latestAt) {
      entry.latestAt = r.submitted_at
      entry.nickname = r.nickname // latest submission's nickname wins, same "most recent row's attribute" convention used elsewhere
    }
    byIdentity.set(key, entry)
  }
  return [...byIdentity.entries()]
    .map(([key, v]) => ({ key, nickname: v.nickname, score: v.score }))
    .sort((a, b) => b.score - a.score)
    .map((row, i) => ({ rank: i + 1, nickname: row.nickname, score: row.score }))
}

async function fetchWeekRows({ gameType, sport, weeksAgo }) {
  const { start, end } = weekRangeFor(weeksAgo)
  const { data, error } = await supabase
    .from('daily_leaderboard')
    .select('nickname, score, user_id, guest_id, submitted_at')
    .eq('game_type', gameType)
    .eq('sport', sport)
    .gte('game_date', start)
    .lt('game_date', end)
  if (error) throw error
  return data || []
}

/** Top N for one game/sport/week — same { rank, nickname, score } shape as
 * fetchDailyLeaderboardTop (no `era`, since a week's rows can span several). */
export async function fetchWeeklyLeaderboardTop({ gameType, sport, weeksAgo = 0, limit = 10 }) {
  const rows = await fetchWeekRows({ gameType, sport, weeksAgo })
  return aggregateByIdentity(rows).slice(0, limit)
}

/** The current identity's rank/score/total_players for one game/sport/week — null if they haven't played that week. */
export async function fetchMyWeeklyRank({ gameType, sport, weeksAgo = 0, userId }) {
  const identity = getLeaderboardIdentity()
  const key = userId ? `u:${userId}` : `g:${identity.guestId}`
  const rows = await fetchWeekRows({ gameType, sport, weeksAgo })
  const myRows = rows.filter((r) => (r.user_id ? `u:${r.user_id}` : `g:${r.guest_id}`) === key)
  if (myRows.length === 0) return null

  const myScore = myRows.reduce((sum, r) => sum + r.score, 0)
  const ranked = aggregateByIdentity(rows)
  const rank = 1 + ranked.filter((r) => r.score > myScore).length
  return { rank, total_players: ranked.length, score: myScore }
}

/**
 * Live updates for one day — Supabase Realtime's postgres_changes only
 * supports a single `column=eq.value` filter, not a compound AND, so this
 * scopes by game_date (catches all 21 game/sport combos for that day) and
 * leaves game_type/sport filtering to the caller. Never throws — a broken
 * subscription just means no live updates, same tolerance as
 * subscribeToGroupScores in groups.js.
 */
export function subscribeToDailyLeaderboard(gameDate, onChange, onError) {
  try {
    const channel = supabase
      .channel(`daily_leaderboard:${gameDate}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'daily_leaderboard', filter: `game_date=eq.${gameDate}` },
        onChange
      )
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') onError?.()
      })
    return () => supabase.removeChannel(channel)
  } catch (err) {
    console.error('Daily leaderboard realtime subscription failed:', err)
    onError?.()
    return () => {}
  }
}
