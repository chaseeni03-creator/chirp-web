// Combined, cross-game "All-Time Rankings" leaderboard — ported from the
// Flutter app's lib/services/leaderboard_service.dart +
// lib/models/leaderboard_group.dart. Deliberately a SEPARATE system from
// dailyLeaderboard.js's per-game, per-day live board (own `daily_leaderboard`
// table): this one aggregates client-side over the shared `game_results`
// table, exactly like the Dart service does, and is reused as-is on every
// platform (RLS on game_results/game_streaks/profiles is `FOR SELECT USING
// (true)` — open to the anon key, no session required, confirmed live).
//
// Vocabulary note: the constants below use the real underscore-cased
// `game_results.game_type` values (e.g. 'chirp_guess', 'progression_medium')
// — this is NOT the same vocabulary as groups.js's dash-cased GAME_LABELS/
// GAME_ORDER ('chirp-guess', 'progression'), which belongs to the unrelated
// daily-board system and has no 'progression_medium'/'progression_hard'
// split. Don't cross the two.

import { supabase, todayStr } from './supabase'

export const PERIODS = ['daily', 'weekly', 'monthly', 'yearly', 'allTime']
export const PERIOD_LABELS = {
  daily: 'Today',
  weekly: 'This Week',
  monthly: 'This Month',
  yearly: 'This Year',
  allTime: 'All Time',
}

export const SORT_MODES = ['total', 'average']
export const SORT_MODE_LABELS = { total: 'Highest Score', average: 'Best Average' }

// Batting-title-style qualification for Best Average — same constant/value
// as kMinGamesForAverageRanking in leaderboard_group.dart.
export const MIN_GAMES_FOR_AVERAGE = 5

// Mirrors LeaderboardGames.included in leaderboard_group.dart exactly.
export const INCLUDED_GAME_TYPES = [
  'stat_line', 'chirp_guess', 'career_builder', 'lineup',
  'progression_medium', 'progression_hard', 'who_had_more', 'before_or_after', 'the_path',
]

// Mirrors LeaderboardGames.displayGames exactly — the "By Game" chip list.
export const DISPLAY_GAMES = [
  ['chirp_guess', 'Chirp Guess'],
  ['the_path', 'The Path'],
  ['stat_line', 'Stat Line'],
  ['career_builder', 'Career Builder'],
  ['progression', 'The Progression'],
  ['who_had_more', 'Who Had More'],
  ['lineup', 'The Lineup'],
  ['before_or_after', 'Before or After'],
]

export function combinedGameTypesFor(displayKey) {
  return displayKey === 'progression' ? ['progression_medium', 'progression_hard'] : [displayKey]
}

// ── Date helpers — calendar-aligned (not rolling), matching
// leaderboard_service.dart's _mondayStr/_monthStartStr/_yearStartStr exactly.

function dateStr(d) {
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

export function mondayStr() {
  const now = new Date()
  const daysSinceMonday = (now.getDay() + 6) % 7 // getDay(): Sun=0..Sat=6 -> Mon=0..Sun=6
  const monday = new Date(now)
  monday.setDate(now.getDate() - daysSinceMonday)
  return dateStr(monday)
}

export function monthStartStr() {
  const now = new Date()
  return dateStr(new Date(now.getFullYear(), now.getMonth(), 1))
}

export function yearStartStr() {
  const now = new Date()
  return dateStr(new Date(now.getFullYear(), 0, 1))
}

// ── Entry helpers — JS functions standing in for CombinedLeaderboardEntry's
// scoreFor/averageFor methods (no classes needed; entries are plain objects).

export function scoreFor(entry, period) {
  switch (period) {
    case 'daily': return entry.todayScore ?? entry.totalScore
    case 'weekly': return entry.weekScore ?? entry.totalScore
    case 'monthly': return entry.monthScore ?? entry.totalScore
    case 'yearly': return entry.yearScore ?? entry.totalScore
    default: return entry.totalScore
  }
}

export function averageFor(entry, period) {
  if (!entry.periodGamesPlayed) return 0
  return scoreFor(entry, period) / entry.periodGamesPlayed
}

// ── Shared helpers ───────────────────────────────────────────────────────

async function fetchProfilesByIds(uids) {
  if (uids.length === 0) return {}
  const { data, error } = await supabase
    .from('profiles')
    .select('id, username, display_name, avatar_url, is_verified')
    .in('id', uids)
  if (error) throw error
  return Object.fromEntries((data || []).map((p) => [p.id, p]))
}

/** Best (longest) streak per user across the given game types — scoped to
 * `sport` when provided, or across every sport when omitted (Overall). */
async function fetchBestStreak(uids, gameTypes, sport) {
  if (uids.length === 0) return {}
  let q = supabase.from('game_streaks').select('user_id, longest_streak').in('user_id', uids).in('game_type', gameTypes)
  if (sport) q = q.eq('sport', sport)
  const { data, error } = await q
  if (error) throw error
  const best = {}
  for (const row of data || []) {
    const prev = best[row.user_id] ?? 0
    if ((row.longest_streak ?? 0) > prev) best[row.user_id] = row.longest_streak
  }
  return best
}

function rankOf(entries, userId) {
  const i = entries.findIndex((e) => e.userId === userId)
  return i === -1 ? null : i + 1
}

// ── Overall (cross-sport) ────────────────────────────────────────────────

async function overallEntries({ period, sortMode = 'total' }) {
  const { data: rows, error } = await supabase
    .from('game_results')
    .select('user_id, score, sport, game_type, date_played')
    .in('game_type', INCLUDED_GAME_TYPES)
    .eq('completed', true)
    .limit(20000)
  if (error) throw error
  if (!rows || rows.length === 0) return []

  const today = todayStr()
  const monday = mondayStr()
  const monthStart = monthStartStr()
  const yearStart = yearStartStr()
  const total = {}, week = {}, month = {}, year = {}, day = {}
  const gamesPlayed = {}, weekGames = {}, monthGames = {}, yearGames = {}, dayGames = {}
  const sportsPlayed = {}

  for (const r of rows) {
    const uid = r.user_id
    const score = r.score ?? 0
    const date = r.date_played
    total[uid] = (total[uid] ?? 0) + score
    gamesPlayed[uid] = (gamesPlayed[uid] ?? 0) + 1
    ;(sportsPlayed[uid] ??= new Set()).add(r.sport)
    if (date >= yearStart) { year[uid] = (year[uid] ?? 0) + score; yearGames[uid] = (yearGames[uid] ?? 0) + 1 }
    if (date >= monthStart) { month[uid] = (month[uid] ?? 0) + score; monthGames[uid] = (monthGames[uid] ?? 0) + 1 }
    if (date >= monday) { week[uid] = (week[uid] ?? 0) + score; weekGames[uid] = (weekGames[uid] ?? 0) + 1 }
    if (date === today) { day[uid] = (day[uid] ?? 0) + score; dayGames[uid] = (dayGames[uid] ?? 0) + 1 }
  }

  function periodGamesFor(uid) {
    switch (period) {
      case 'daily': return dayGames[uid] ?? 0
      case 'weekly': return weekGames[uid] ?? 0
      case 'monthly': return monthGames[uid] ?? 0
      case 'yearly': return yearGames[uid] ?? 0
      default: return gamesPlayed[uid] ?? 0
    }
  }

  const uids = Object.keys(total)
  const [profiles, bestStreak] = await Promise.all([
    fetchProfilesByIds(uids),
    fetchBestStreak(uids, INCLUDED_GAME_TYPES),
  ])

  let entries = uids.map((uid) => {
    const p = profiles[uid]
    return {
      userId: uid,
      username: p?.username ?? uid.slice(0, 8),
      displayName: p?.display_name ?? p?.username ?? uid.slice(0, 8),
      avatarUrl: p?.avatar_url ?? null,
      isVerified: p?.is_verified ?? false,
      totalScore: total[uid],
      gamesPlayed: gamesPlayed[uid],
      periodGamesPlayed: periodGamesFor(uid),
      bestStreak: bestStreak[uid] ?? 0,
      sportsPlayed: sportsPlayed[uid] ?? new Set(),
      monthScore: month[uid] ?? 0,
      weekScore: week[uid] ?? 0,
      todayScore: day[uid] ?? 0,
      yearScore: year[uid] ?? 0,
    }
  })

  function rankValue(e) {
    switch (period) {
      case 'daily': return e.todayScore ?? 0
      case 'weekly': return e.weekScore ?? 0
      case 'monthly': return month[e.userId] ?? 0
      case 'yearly': return e.yearScore ?? 0
      default: return e.totalScore
    }
  }

  if (sortMode === 'average') {
    entries = entries.filter((e) => e.periodGamesPlayed >= MIN_GAMES_FOR_AVERAGE)
    entries.sort((a, b) => averageFor(b, period) - averageFor(a, period))
  } else {
    entries.sort((a, b) => rankValue(b) - rankValue(a))
    if (period !== 'allTime') entries = entries.filter((e) => rankValue(e) > 0)
  }
  return entries
}

export async function getOverallLeaderboard({ period, sortMode = 'total', limit = 100 }) {
  const entries = await overallEntries({ period, sortMode })
  return entries.slice(0, limit)
}

export async function getOverallMyRank({ userId, period, sortMode = 'total' }) {
  const entries = await overallEntries({ period, sortMode })
  return rankOf(entries, userId)
}

export async function getOverallGamesNeededForAverage({ userId, period }) {
  const entries = await overallEntries({ period, sortMode: 'total' })
  const mine = entries.find((e) => e.userId === userId)
  if (!mine) return MIN_GAMES_FOR_AVERAGE
  return Math.max(0, Math.min(MIN_GAMES_FOR_AVERAGE, MIN_GAMES_FOR_AVERAGE - mine.periodGamesPlayed))
}

// ── Sport-scoped: All Games / By Game ────────────────────────────────────

function applyPeriodFilter(q, period) {
  switch (period) {
    case 'daily': return q.eq('date_played', todayStr())
    case 'weekly': return q.gte('date_played', mondayStr())
    case 'monthly': return q.gte('date_played', monthStartStr())
    case 'yearly': return q.gte('date_played', yearStartStr())
    default: return q
  }
}

async function sportEntries({ sport, period, gameType = null, sortMode = 'total' }) {
  const gameTypes = gameType == null ? INCLUDED_GAME_TYPES : combinedGameTypesFor(gameType)

  let q = supabase
    .from('game_results')
    .select('user_id, score, game_type, date_played')
    .eq('sport', sport)
    .eq('completed', true)
    .in('game_type', gameTypes)
  q = applyPeriodFilter(q, period)

  const { data: rows, error } = await q.limit(20000)
  if (error) throw error
  if (!rows || rows.length === 0) return []

  const total = {}, gamesPlayed = {}
  for (const r of rows) {
    total[r.user_id] = (total[r.user_id] ?? 0) + (r.score ?? 0)
    gamesPlayed[r.user_id] = (gamesPlayed[r.user_id] ?? 0) + 1
  }

  const uids = Object.keys(total)
  const [profiles, bestStreak] = await Promise.all([
    fetchProfilesByIds(uids),
    fetchBestStreak(uids, gameTypes, sport),
  ])

  let entries = uids.map((uid) => {
    const p = profiles[uid]
    return {
      userId: uid,
      username: p?.username ?? uid.slice(0, 8),
      displayName: p?.display_name ?? p?.username ?? uid.slice(0, 8),
      avatarUrl: p?.avatar_url ?? null,
      isVerified: p?.is_verified ?? false,
      totalScore: total[uid],
      gamesPlayed: gamesPlayed[uid],
      periodGamesPlayed: gamesPlayed[uid],
      bestStreak: bestStreak[uid] ?? 0,
      sportsPlayed: new Set(),
      monthScore: null,
      weekScore: null,
      todayScore: null,
      yearScore: null,
    }
  })

  if (sortMode === 'average') {
    entries = entries.filter((e) => e.periodGamesPlayed >= MIN_GAMES_FOR_AVERAGE)
    entries.sort((a, b) => averageFor(b, period) - averageFor(a, period))
  } else {
    entries.sort((a, b) => b.totalScore - a.totalScore)
  }
  return entries
}

export async function getSportLeaderboard({ sport, period, gameType, sortMode = 'total', limit = 100 }) {
  const entries = await sportEntries({ sport, period, gameType, sortMode })
  return entries.slice(0, limit)
}

export async function getSportMyRank({ userId, sport, period, gameType, sortMode = 'total' }) {
  const entries = await sportEntries({ sport, period, gameType, sortMode })
  return rankOf(entries, userId)
}

export async function getSportGamesNeededForAverage({ userId, sport, period, gameType }) {
  const entries = await sportEntries({ sport, period, gameType, sortMode: 'total' })
  const mine = entries.find((e) => e.userId === userId)
  if (!mine) return MIN_GAMES_FOR_AVERAGE
  return Math.max(0, Math.min(MIN_GAMES_FOR_AVERAGE, MIN_GAMES_FOR_AVERAGE - mine.periodGamesPlayed))
}

// ── By Era ────────────────────────────────────────────────────────────────

// Era-scoped streaks aren't tracked separately — falls back to the sport's
// overall streak across era-aware games, same as the Dart service.
const ERA_STREAK_GAME_TYPES = ['stat_line', 'career_builder', 'progression_medium', 'progression_hard', 'who_had_more']

async function eraEntries({ sport, era, period, sortMode = 'total' }) {
  let q = supabase
    .from('game_results')
    .select('user_id, score, game_type, date_played')
    .eq('sport', sport)
    .eq('era', era)
    .eq('completed', true)
  q = applyPeriodFilter(q, period)

  const { data: rows, error } = await q.limit(20000)
  if (error) throw error
  if (!rows || rows.length === 0) return []

  const total = {}, gamesPlayed = {}
  for (const r of rows) {
    total[r.user_id] = (total[r.user_id] ?? 0) + (r.score ?? 0)
    gamesPlayed[r.user_id] = (gamesPlayed[r.user_id] ?? 0) + 1
  }

  const uids = Object.keys(total)
  const [profiles, bestStreak] = await Promise.all([
    fetchProfilesByIds(uids),
    fetchBestStreak(uids, ERA_STREAK_GAME_TYPES, sport),
  ])

  let entries = uids.map((uid) => {
    const p = profiles[uid]
    return {
      userId: uid,
      username: p?.username ?? uid.slice(0, 8),
      displayName: p?.display_name ?? p?.username ?? uid.slice(0, 8),
      avatarUrl: p?.avatar_url ?? null,
      isVerified: p?.is_verified ?? false,
      totalScore: total[uid],
      gamesPlayed: gamesPlayed[uid],
      periodGamesPlayed: gamesPlayed[uid],
      bestStreak: bestStreak[uid] ?? 0,
      sportsPlayed: new Set(),
      monthScore: null,
      weekScore: null,
      todayScore: null,
      yearScore: null,
    }
  })

  if (sortMode === 'average') {
    entries = entries.filter((e) => e.periodGamesPlayed >= MIN_GAMES_FOR_AVERAGE)
    entries.sort((a, b) => averageFor(b, period) - averageFor(a, period))
  } else {
    entries.sort((a, b) => b.totalScore - a.totalScore)
  }
  return entries
}

export async function getEraLeaderboard({ sport, era, period, sortMode = 'total', limit = 100 }) {
  const entries = await eraEntries({ sport, era, period, sortMode })
  return entries.slice(0, limit)
}

export async function getEraMyRank({ userId, sport, era, period, sortMode = 'total' }) {
  const entries = await eraEntries({ sport, era, period, sortMode })
  return rankOf(entries, userId)
}

export async function getEraGamesNeededForAverage({ userId, sport, era, period }) {
  const entries = await eraEntries({ sport, era, period, sortMode: 'total' })
  const mine = entries.find((e) => e.userId === userId)
  if (!mine) return MIN_GAMES_FOR_AVERAGE
  return Math.max(0, Math.min(MIN_GAMES_FOR_AVERAGE, MIN_GAMES_FOR_AVERAGE - mine.periodGamesPlayed))
}
