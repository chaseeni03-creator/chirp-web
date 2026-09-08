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
