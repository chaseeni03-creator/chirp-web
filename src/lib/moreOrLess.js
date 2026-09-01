// "More vs Less" (mobile: "Who Had More?"), ported from
// lib/models/who_had_more_game.dart / matchup.dart / champion.dart and their
// mlb_/nba_ equivalents, plus who_had_more_service.dart's RPC-driven matchup
// generation and fairness-band logic.
//
// This is an endless session game (not a daily puzzle), so unlike every
// other game on the site there is no getTodayResult/saveTodayResult short-
// circuit — every visit starts a fresh run. Mobile's cross-user leaderboards
// (today's global high score, all-time best, friends leaderboard) need
// accounts, which this anonymous, localStorage-only web app doesn't have;
// only a personal best per mode is tracked (storage.js's getBest/
// setBestIfHigher, whose comment already anticipated this exact use case).
// Mid-run resume-on-refresh is also not ported — a real simplification,
// consistent with practice-mode state not persisting elsewhere on the site.

import { supabase } from './supabase'

export const MAX_LIVES = 5
export const STARTING_LIVES = 3

export function pointsForStreak(streak) {
  const multiplier = streak <= 4 ? 1 : streak <= 9 ? 2 : streak <= 14 ? 3 : streak <= 19 ? 4 : 5
  return 100 * multiplier
}

export function survivalBonusFor(roundsSurvived) {
  if (roundsSurvived === 5) return 200
  if (roundsSurvived === 10) return 500
  if (roundsSurvived === 15) return 1000
  return 0
}

// ── NFL: era (6, incl. All Time) x difficulty (Normal/Hard) ────────────────

export const NFL_ERAS = [
  { key: 'seventies', label: '1970s', range: [1970, 1979] },
  { key: 'eighties', label: '1980s', range: [1980, 1989] },
  { key: 'nineties', label: '1990s', range: [1989, 1999] },
  { key: 'twoThousands', label: '2000s', range: [2000, 2012] },
  { key: 'twentyTens', label: '2010s', range: [2010, 2025] },
  { key: 'allTime', label: 'All Time', range: null },
]

export const NFL_DIFFICULTIES = [
  { key: 'normal', label: 'Normal', description: 'Recognizable players who made an impact' },
  { key: 'hard', label: 'Hard', description: 'Every player from this era, including the obscure ones' },
]

// ── MLB: 8 single-axis era modes ────────────────────────────────────────────

export const MLB_MODES = [
  { key: 'dead_ball', label: 'Dead Ball Era', emoji: '⚾', tagline: '1871-1919 · Cobb, Wagner, Cy Young', dataLine: '📊 Curated players from 1871-1919' },
  { key: 'live_ball', label: 'Live Ball Era', emoji: '⚾', tagline: '1920-1941 · The Babe Ruth era', dataLine: '📊 Curated players from 1920-1941' },
  { key: 'post_war', label: 'Post-War Era', emoji: '⚾', tagline: '1942-1968 · Mays, Mantle, Williams', dataLine: '📊 Curated players from 1942-1968' },
  { key: 'expansion', label: 'Expansion Era', emoji: '⚾', tagline: '1969-1992 · Rose, Jackson, Ryan', dataLine: '📊 Curated players from 1969-1992' },
  { key: 'steroid', label: 'Steroid Era', emoji: '💪', tagline: '1993-2005 · Bonds, McGwire, Sosa', dataLine: '📊 Curated players from 1993-2005' },
  { key: 'modern', label: 'Modern Era', emoji: '⚾', tagline: '2006-2025 · Trout, Ohtani, Betts', dataLine: '📊 Curated players from 2006-2025' },
  { key: 'all_stars', label: 'All Stars', emoji: '⭐', tagline: 'Every era, All-Stars only', dataLine: '📊 Every player with 1+ All-Star selection' },
  { key: 'impossible', label: 'Impossible', emoji: '💀', tagline: 'Every MLB player ever, 1871-2025', dataLine: '📊 Full Lahman database, no filter' },
]

// ── NBA: 7 single-axis era modes ────────────────────────────────────────────

export const NBA_MODES = [
  { key: 'modern', label: 'Modern Era', emoji: '🏀', tagline: 'Active since 2016', dataLine: '📊 Curated modern-era players' },
  { key: '2000s', label: '2000s Era', emoji: '🏀', tagline: '2000-2015 · Kobe, Duncan, Nash', dataLine: '📊 Curated players from the 2000s' },
  { key: '1990s', label: '1990s Era', emoji: '🏀', tagline: '1990-1999 · Jordan, Barkley, Malone', dataLine: '📊 Curated players from the 1990s' },
  { key: '1980s', label: '1980s Era', emoji: '🏀', tagline: '1980-1989 · Magic, Bird, Kareem', dataLine: '📊 Curated players from the 1980s' },
  { key: 'all_stars', label: 'All Stars', emoji: '⭐', tagline: 'Every era, All-Stars only', dataLine: '📊 Every player with 1+ All-Star selection' },
  { key: 'all', label: 'All Time', emoji: '🏆', tagline: 'Every era, every eligible player', dataLine: '📊 Every career-stats-eligible player' },
  { key: 'impossible', label: 'Impossible', emoji: '💀', tagline: 'Every NBA/ABA/BAA player ever, 1947-2026', dataLine: '📊 Full database, no filter' },
]

export function modesFor(sport) {
  return sport === 'mlb' ? MLB_MODES : NBA_MODES
}

// ── Categories ───────────────────────────────────────────────────────────

export const NFL_CATEGORIES = [
  { key: 'rushing_yards', label: 'Rushing Yards' },
  { key: 'passing_yards', label: 'Passing Yards' },
  { key: 'receiving_yards', label: 'Receiving Yards' },
  { key: 'rushing_touchdowns', label: 'Rushing TDs' },
  { key: 'passing_touchdowns', label: 'Passing TDs' },
  { key: 'receiving_touchdowns', label: 'Receiving TDs' },
  { key: 'receptions', label: 'Receptions' },
  { key: 'sacks', label: 'Sacks' },
  { key: 'interceptions_caught', label: 'Interceptions' },
  { key: 'tackles', label: 'Tackles' },
]

export const MLB_CATEGORIES = [
  { key: 'home_runs', label: 'Home Runs' },
  { key: 'hits', label: 'Hits' },
  { key: 'rbi', label: 'RBI' },
  { key: 'stolen_bases', label: 'Stolen Bases' },
  { key: 'runs', label: 'Runs' },
  { key: 'doubles', label: 'Doubles' },
  { key: 'triples', label: 'Triples' },
  { key: 'wins', label: 'Wins' },
  { key: 'saves', label: 'Saves' },
  { key: 'strikeouts_pitched', label: 'Strikeouts' },
  { key: 'innings_pitched', label: 'Innings Pitched' },
]

// NBA career/season columns differ in name, and steals/blocks have no
// season-total column at all (nba_season_stats only has their per-game
// rate) — those two categories are career-scope only.
export const NBA_CATEGORIES = [
  { careerKey: 'points', seasonKey: 'total_points', label: 'Points' },
  { careerKey: 'rebounds', seasonKey: 'total_rebounds', label: 'Rebounds' },
  { careerKey: 'assists', seasonKey: 'total_assists', label: 'Assists' },
  { careerKey: 'steals', seasonKey: null, label: 'Steals' },
  { careerKey: 'blocks', seasonKey: null, label: 'Blocks' },
  { careerKey: 'games_played', seasonKey: 'games_played', label: 'Games Played' },
  { careerKey: 'points_per_game', seasonKey: 'points_per_game', label: 'Points Per Game' },
  { careerKey: 'rebounds_per_game', seasonKey: 'rebounds_per_game', label: 'Rebounds Per Game' },
  { careerKey: 'assists_per_game', seasonKey: 'assists_per_game', label: 'Assists Per Game' },
]

function categoriesFor(sport) {
  if (sport === 'nfl') return NFL_CATEGORIES
  if (sport === 'mlb') return MLB_CATEGORIES
  return NBA_CATEGORIES
}

export function statColumn(sport, stat) {
  if (sport !== 'nba') return stat.category.key
  return stat.scope === 'career' ? stat.category.careerKey : stat.category.seasonKey
}

export function questionText(stat) {
  const label = (stat.category.label || '').toUpperCase()
  return stat.scope === 'career' ? `Who had more CAREER ${label}?` : `Who had more ${label} in ${stat.season}?`
}

export function shortLabel(stat) {
  return stat.scope === 'career' ? `Career ${stat.category.label}` : `${stat.category.label} (${stat.season})`
}

// ── Random stat picker (mirrors _randomStat) ───────────────────────────────

/**
 * PostgREST caps a `.select()` at 1,000 rows by default with no guaranteed
 * order — nfl_/mlb_/nba_season_stats all have far more rows than that
 * (nfl_season_stats alone is ~90,000), so an unpaginated fetch here would
 * silently sample only an arbitrary ~1,000-row slice of season history
 * instead of the real range, biasing which years ever get picked for a
 * season-scope matchup (the same failure mode found and fixed in The
 * Lineup's leaderboards — mobile's who_had_more_service.dart /
 * mlb_who_had_more_service.dart / nba_who_had_more_service.dart have this
 * identical unpaginated query, so it's a real bug there too). Paginated in
 * 1,000-row pages via .range() until a short page ends it.
 */
const availableSeasonsCache = {}

async function fetchAllSeasonValues(table) {
  const years = new Set()
  const pageSize = 1000
  let from = 0
  while (true) {
    const { data, error } = await supabase.from(table).select('season').range(from, from + pageSize - 1)
    if (error || !data) break
    for (const r of data) years.add(r.season)
    if (data.length < pageSize) break
    from += pageSize
  }
  return years
}

async function availableSeasons(sport, tables) {
  if (availableSeasonsCache[sport]) return availableSeasonsCache[sport]
  const years = [...(await fetchAllSeasonValues(tables.seasonStats))].sort((a, b) => a - b)
  availableSeasonsCache[sport] = years
  return years
}

async function randomStat(sport, tables) {
  const categories = categoriesFor(sport)
  const category = categories[Math.floor(Math.random() * categories.length)]
  const canSeason = sport !== 'nba' || category.seasonKey != null
  if (canSeason && Math.random() < 0.5) {
    const seasons = await availableSeasons(sport, tables)
    if (seasons.length > 0) {
      const season = seasons[Math.floor(Math.random() * seasons.length)]
      return { category, scope: 'season', season }
    }
  }
  return { category, scope: 'career', season: null }
}

// ── Fairness bands ───────────────────────────────────────────────────────
// NFL's relax path still enforces the upper bound (only the floor is
// dropped, per an explicit anti-blowout fix in who_had_more_service.dart);
// MLB/NBA's relax path accepts any gap at all. This is a real, disclosed
// inconsistency already present between sports on mobile itself, not a web
// bug — ported faithfully rather than "fixed" here.

function fairnessRange(sport, modeKey, round) {
  const isEasyTier = sport === 'nfl' ? modeKey === 'normal' : modeKey !== 'impossible'
  if (isEasyTier) {
    if (round <= 5) return [20, 40]
    if (round <= 15) return [10, 20]
    if (round <= 25) return [5, 10]
    return [0, 5]
  }
  if (round <= 10) return [15, 50]
  if (round <= 20) return [10, 30]
  return [0, Infinity]
}

function fairnessOk(sport, a, b, { relax, minPct, maxPct }) {
  const hi = Math.max(a, b)
  const lo = Math.min(a, b)
  if (lo <= 0 || hi === lo) return false
  const pct = ((hi - lo) / lo) * 100
  if (relax) return sport === 'nfl' ? pct <= maxPct : true
  return pct >= minPct && pct <= maxPct
}

function pairKey(a, b) {
  return [a, b].sort().join('_')
}

// ── Player profile cache ───────────────────────────────────────────────────

const profileCache = {}

async function toPlayer(sport, tables, id, value) {
  profileCache[sport] ??= {}
  let profile = profileCache[sport][id]
  if (profile === undefined) {
    const { data } = await supabase.from(tables.players).select('id, full_name, position').eq('id', id).maybeSingle()
    profile = data || null
    profileCache[sport][id] = profile
  }
  if (!profile) return null
  return { id, name: profile.full_name || 'Unknown Player', position: (profile.position || '').toUpperCase(), value }
}

export function resetSessionCaches(sport) {
  profileCache[sport] = {}
}

// ── RPC names per sport ─────────────────────────────────────────────────

function rpcNames(sport) {
  if (sport === 'nfl') return { pair: 'who_had_more_random_pair', value: 'who_had_more_value_for_player', opponent: 'who_had_more_random_opponent' }
  if (sport === 'mlb') return { pair: 'mlb_who_had_more_random_pair', value: 'mlb_who_had_more_value_for_player', opponent: 'mlb_who_had_more_random_opponent' }
  return { pair: 'nba_who_had_more_random_pair', value: 'nba_who_had_more_value_for_player', opponent: 'nba_who_had_more_random_opponent' }
}

/** era: { range: [start,end] | null } — NFL only; ignored for MLB/NBA (mode alone selects the pool). */
export async function generateInitialMatchup(sport, tables, { modeKey, era, round, usedPairKeys }) {
  const rpc = rpcNames(sport)
  const [minPct, maxPct] = fairnessRange(sport, modeKey, round)
  for (let attempt = 0; attempt < 20; attempt++) {
    const stat = await randomStat(sport, tables)
    const relax = attempt >= 14
    const params = { p_stat: statColumn(sport, stat), p_is_career: stat.scope === 'career', p_season: stat.season, p_mode: modeKey }
    if (sport === 'nfl') {
      params.p_era_start = era?.range?.[0] ?? null
      params.p_era_end = era?.range?.[1] ?? null
    }
    const { data, error } = await supabase.rpc(rpc.pair, params)
    if (error || !data || data.length < 2) continue
    const [a, b] = data
    if (a.player_id === b.player_id) continue
    if (usedPairKeys.has(pairKey(a.player_id, b.player_id))) continue
    if (!fairnessOk(sport, a.value, b.value, { relax, minPct, maxPct })) continue
    const p1 = await toPlayer(sport, tables, a.player_id, a.value)
    const p2 = await toPlayer(sport, tables, b.player_id, b.value)
    if (!p1 || !p2) continue
    return { champion: p1, challenger: p2, stat }
  }
  return null
}

export async function generateNextMatchup(sport, tables, { champion, modeKey, era, round, usedPairKeys }) {
  const rpc = rpcNames(sport)
  const [minPct, maxPct] = fairnessRange(sport, modeKey, round)
  for (let attempt = 0; attempt < 20; attempt++) {
    const stat = await randomStat(sport, tables)
    const relax = attempt >= 14
    const valueParams = { p_stat: statColumn(sport, stat), p_is_career: stat.scope === 'career', p_player_id: champion.id, p_season: stat.season }
    const { data: valueRows, error: valueErr } = await supabase.rpc(rpc.value, valueParams)
    if (valueErr || !valueRows || valueRows.length === 0) continue
    const championValue = valueRows[0].value

    const oppParams = { p_stat: statColumn(sport, stat), p_is_career: stat.scope === 'career', p_exclude_player_id: champion.id, p_season: stat.season, p_limit: 8, p_mode: modeKey }
    if (sport === 'nfl') {
      oppParams.p_era_start = era?.range?.[0] ?? null
      oppParams.p_era_end = era?.range?.[1] ?? null
    }
    const { data: oppRows, error: oppErr } = await supabase.rpc(rpc.opponent, oppParams)
    if (oppErr || !oppRows) continue
    for (const o of oppRows) {
      if (usedPairKeys.has(pairKey(champion.id, o.player_id))) continue
      if (!fairnessOk(sport, championValue, o.value, { relax, minPct, maxPct })) continue
      const challenger = await toPlayer(sport, tables, o.player_id, o.value)
      if (!challenger) continue
      return { champion: { ...champion, value: championValue }, challenger, stat }
    }
  }
  return null
}

export { pairKey }

// ── Share text ───────────────────────────────────────────────────────────

export function buildMoreOrLessShareText(sport, dateStr, result) {
  if (sport === 'nfl') {
    const { difficultyLabel, difficultyKey, eraLabel, score, bestStreak, roundsPlayed } = result
    if (difficultyKey === 'hard') {
      return `More vs Less - ${dateStr} 💀\nEra: ${eraLabel} · HARD\nScore: ${score} points\nStreak: 🔥 ${bestStreak}\nRounds: ${roundsPlayed}\nThink you can handle it? 🐦🏈`
    }
    return `More vs Less - ${dateStr} 🏈\nEra: ${eraLabel} · ${difficultyLabel}\nScore: ${score} points\nStreak: 🔥 ${bestStreak}\nRounds: ${roundsPlayed}\nCan you beat me? 🐦🏈`
  }
  const title = sport === 'mlb' ? 'MLB More vs Less' : 'NBA More vs Less'
  const { mode, score, bestStreak, roundsPlayed } = result
  if (mode.key === 'impossible') {
    return `${title} - ${dateStr} 💀\nMode: IMPOSSIBLE\nScore: ${score} points\nBest streak: 🔥 ${bestStreak}\nRounds: ${roundsPlayed}\nThink you can handle it?`
  }
  return `${title} - ${dateStr} ${mode.emoji}\nMode: ${mode.label}\nScore: ${score} points\nBest streak: 🔥 ${bestStreak}\nRounds: ${roundsPlayed}\nCan you beat me?`
}
