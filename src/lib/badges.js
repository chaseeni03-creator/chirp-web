// Cross-platform badges/streak/stats — client side. Mirrors
// dailyLeaderboard.js's wrapper style exactly, backed by
// supabase/badges_system.sql's tables/RPCs (chirp_sports repo). Same
// user_id/guest_id identity pattern as the rest of the leaderboard system —
// a web guest's badge data carries over to the app once they sign into the
// same Google account, via migrateGuestBadgeData() (see AccountMenu.jsx).

import { supabase } from './supabase'
import { getLeaderboardIdentity } from './leaderboardIdentity'

/**
 * Called right after a game's score submits — evaluates every badge
 * computable from the player's own already-persisted history and returns
 * only the ones newly earned by THIS call. Deliberately fails open (logs,
 * returns []) rather than throwing — a badge-check hiccup shouldn't block
 * the results screen or the score submission that already succeeded.
 */
export async function checkAndAwardBadges({ gameType, sport, isPerfect = false, accuracy = null, score = null, rank = null, userId }) {
  const identity = getLeaderboardIdentity()
  try {
    const { data, error } = await supabase.rpc('check_and_award_badges', {
      p_game_type: gameType,
      p_sport: sport,
      p_is_perfect: isPerfect,
      p_accuracy: accuracy,
      p_score: score != null ? Math.round(score) : null,
      p_rank: rank,
      p_user_id: userId ?? null,
      p_guest_id: userId ? null : identity.guestId,
    })
    if (error) throw error
    return data || []
  } catch (err) {
    console.error('Badge check failed:', err)
    return []
  }
}

/** Full active badge catalog, ordered for display. */
export async function fetchAllBadges() {
  const { data, error } = await supabase.from('badges').select('*').eq('active', true).order('sort_order')
  if (error) throw error
  return data || []
}

/** { badge_id, earned_at } rows for one identity. */
export async function fetchEarnedBadges(userId) {
  const identity = getLeaderboardIdentity()
  const column = userId ? 'user_id' : 'guest_id'
  const value = userId ?? identity.guestId
  const { data, error } = await supabase.from('user_badges').select('badge_id, earned_at').eq(column, value)
  if (error) throw error
  return data || []
}

/** { current_streak, longest_streak } for one identity — zeros if they've never played. */
export async function fetchMyStreak(userId) {
  const identity = getLeaderboardIdentity()
  const column = userId ? 'user_id' : 'guest_id'
  const value = userId ?? identity.guestId
  const { data, error } = await supabase.from('user_streaks').select('current_streak, longest_streak').eq(column, value).maybeSingle()
  if (error) throw error
  return data || { current_streak: 0, longest_streak: 0 }
}

/** One-time, called right after a guest's first successful Google sign-in — reassigns their badge/streak/stats rows to the new account. */
export async function migrateGuestBadgeData(guestId) {
  const { error } = await supabase.rpc('migrate_guest_badge_data', { p_guest_id: guestId })
  if (error) throw error
}

export const RARITY_COLORS = {
  common: 'var(--color-rarity-common)',
  rare: 'var(--color-rarity-rare)',
  epic: 'var(--color-rarity-epic)',
  legendary: 'var(--color-rarity-legendary)',
}
