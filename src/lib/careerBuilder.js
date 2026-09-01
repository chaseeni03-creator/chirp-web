// Career Builder logic, ported from lib/models/career_builder_game.dart,
// mlb_career_builder_game.dart, and nba_career_builder_game.dart.
//
// Scramble note: mobile seeds its daily (same-for-everyone) scramble with
// `playerId.hashCode ^ dateStr.hashCode`, using Dart's internal String
// hashCode — an implementation detail with no public, stable, portable
// algorithm, so it can't be bit-matched here. This uses its own simple
// string hash + seeded PRNG instead, which gives the same guarantee mobile
// cares about (every web visitor sees the identical scramble for the same
// puzzle that day) without claiming to reproduce mobile's exact sequence.

function stringHash(str) {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 31 + str.charCodeAt(i)) | 0
  }
  return hash
}

/** Integer avalanche finalizer (murmur3-style) — without this, two inputs
 * differing only in their last character (e.g. consecutive dates '...01' vs
 * '...02') produce seeds one apart, and mulberry32 correlates strongly on
 * seeds that close together, especially over the ~4 draws a 5-element
 * shuffle needs. This spreads a 1-bit input difference across all 32 bits. */
function mix32(x) {
  x = Math.imul(x ^ (x >>> 16), 0x45d9f3b) | 0
  x = Math.imul(x ^ (x >>> 16), 0x45d9f3b) | 0
  return (x ^ (x >>> 16)) | 0
}

function mulberry32(seed) {
  let s = seed | 0
  return function () {
    s = (s + 0x6d2b79f5) | 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function isSorted(arr) {
  return arr.every((v, i) => v === i)
}

/** Deterministic per (playerId, dateStr) — same scramble for every web visitor that day. */
export function scrambleOrder(playerId, dateStr) {
  const seed = mix32(stringHash(playerId) ^ stringHash(dateStr))
  const rand = mulberry32(seed)
  const indices = [0, 1, 2, 3, 4]
  for (let i = indices.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[indices[i], indices[j]] = [indices[j], indices[i]]
  }
  if (isSorted(indices)) {
    ;[indices[0], indices[1]] = [indices[1], indices[0]]
  }
  return indices
}

// ── Scoring (universal across all 3 sports) ─────────────────────────────────

export const CAREER_BUILDER_BONUS_POINTS = 300
export const CAREER_BUILDER_MAX_SCORE = 1000

export function careerBuilderOrderPoints(greenCount) {
  switch (greenCount) {
    case 5: return 700
    case 3: return 500
    case 2: return 300
    case 1: return 150
    default: return 50 // 0 exact matches (4/5 is impossible for a 5-permutation)
  }
}

/** userOrder[i] = the true chronological index of the card placed in slot i. */
export function gradeCareerBuilderOrder(userOrder) {
  return userOrder.map((actual, i) => {
    if (actual === i) return 'green'
    if (Math.abs(actual - i) === 1) return 'orange'
    return 'red'
  })
}

export function scoreCareerBuilder(userOrder, bonusGuessCorrect) {
  const greenCount = userOrder.filter((actual, i) => actual === i).length
  const orderPoints = careerBuilderOrderPoints(greenCount)
  const bonusPoints = bonusGuessCorrect ? CAREER_BUILDER_BONUS_POINTS : 0
  return { greenCount, orderPoints, bonusCorrect: bonusGuessCorrect, bonusPoints, totalScore: orderPoints + bonusPoints }
}

export const GRADE_EMOJI = { green: '🟩', orange: '🟧', red: '🟥' }

// ── Per-sport stat keys / formatting / reveal rules ─────────────────────────

const NFL_GROUP_STAT_KEYS = {
  qb: ['passing_attempts', 'passing_completions', 'passing_yards', 'passing_touchdowns', 'interceptions_thrown', 'passer_rating'],
  rb: ['rushing_attempts', 'rushing_yards', 'rushing_touchdowns', 'receptions', 'receiving_yards'],
  wrTe: ['targets', 'receptions', 'receiving_yards', 'receiving_touchdowns', 'yards_per_reception'],
  defense: ['tackles', 'interceptions_caught', 'passes_defended', 'sacks'],
}
const NFL_LABELS = {
  passing_attempts: 'Attempts', passing_completions: 'Completions', passing_yards: 'Passing Yards', passing_touchdowns: 'Passing TDs',
  interceptions_thrown: 'Interceptions', passer_rating: 'Passer Rating', rushing_attempts: 'Carries', rushing_yards: 'Rushing Yards',
  rushing_touchdowns: 'Rushing TDs', receptions: 'Receptions', receiving_yards: 'Receiving Yards', targets: 'Targets',
  receiving_touchdowns: 'Receiving TDs', yards_per_reception: 'Yards/Rec', tackles: 'Tackles', interceptions_caught: 'Interceptions',
  passes_defended: 'Pass Deflections', sacks: 'Sacks',
}
const NFL_DECIMALS = new Set(['passer_rating', 'yards_per_reception'])
const NFL_PRIMARY = { qb: 'passing_yards', rb: 'rushing_yards', wrTe: 'receiving_yards', defense: 'tackles' }

export function nflGroupFor(position) {
  const p = (position || '').toUpperCase()
  if (p === 'QB') return 'qb'
  if (['RB', 'FB', 'HB'].includes(p)) return 'rb'
  if (['WR', 'TE'].includes(p)) return 'wrTe'
  return 'defense'
}

const MLB_GROUP_STAT_KEYS = {
  batter: ['games_played', 'at_bats', 'home_runs', 'rbi', 'batting_average', 'ops'],
  pitcher: ['games_started', 'wins', 'losses', 'era', 'strikeouts_pitched', 'whip'],
}
const MLB_LABELS = {
  games_played: 'Games', at_bats: 'At Bats', home_runs: 'Home Runs', rbi: 'RBI', batting_average: 'AVG', ops: 'OPS',
  games_started: 'Starts', wins: 'Wins', losses: 'Losses', era: 'ERA', strikeouts_pitched: 'Strikeouts', whip: 'WHIP',
}
const MLB_DECIMALS_3 = new Set(['batting_average', 'ops'])
const MLB_DECIMALS_2 = new Set(['era', 'whip'])
const MLB_PRIMARY = { batter: 'home_runs', pitcher: 'strikeouts_pitched' }

const NBA_STAT_KEYS = ['points_per_game', 'rebounds_per_game', 'assists_per_game', 'field_goal_percentage']
const NBA_LABELS = { points_per_game: 'PPG', rebounds_per_game: 'RPG', assists_per_game: 'APG', field_goal_percentage: 'FG%' }
const NBA_PERCENT = new Set(['field_goal_percentage'])

/**
 * Everything a Career Builder page needs for one sport's mystery: stat keys,
 * labels, formatter. Team is always shown (whenever the season has one) at
 * every step, for every difficulty — confirmed directly from the season
 * card widgets (season_card.dart / mlb_season_card.dart / nba_season_card.dart),
 * whose own doc comment says so explicitly: "Team name + colors always
 * show (one mode, no hiding)." There is no per-step or per-difficulty team
 * gating in Career Builder on mobile at all (unlike Progression, which
 * genuinely does hide team in Hard mode).
 */
export function careerBuilderConfig(sport, groupOrPositionGroup) {
  if (sport === 'mlb') {
    const group = groupOrPositionGroup === 'Pitcher' ? 'pitcher' : 'batter'
    const keys = MLB_GROUP_STAT_KEYS[group]
    return {
      group,
      statKeys: keys,
      primaryKey: MLB_PRIMARY[group],
      labelFor: (k) => MLB_LABELS[k] || k,
      formatValue: (stats, k) => {
        const v = stats[k] ?? 0
        if (MLB_DECIMALS_3.has(k)) return v.toFixed(3)
        if (MLB_DECIMALS_2.has(k)) return v.toFixed(2)
        return String(Math.round(v))
      },
    }
  }
  if (sport === 'nba') {
    return {
      group: 'ALL',
      statKeys: NBA_STAT_KEYS,
      primaryKey: 'points_per_game',
      labelFor: (k) => NBA_LABELS[k] || k,
      formatValue: (stats, k) => {
        const v = stats[k] ?? 0
        if (NBA_PERCENT.has(k)) return `${(v * 100).toFixed(1)}%`
        return v.toFixed(1)
      },
    }
  }
  const group = groupOrPositionGroup // nflGroupFor(position) result
  const keys = NFL_GROUP_STAT_KEYS[group]
  return {
    group,
    statKeys: keys,
    primaryKey: NFL_PRIMARY[group],
    labelFor: (k) => NFL_LABELS[k] || k,
    formatValue: (stats, k) => {
      const v = stats[k] ?? 0
      return NFL_DECIMALS.has(k) ? v.toFixed(1) : String(Math.round(v))
    },
  }
}

/** Mobile's real fallback when selected_seasons is missing/invalid: the 5 most recent seasons — not a first/last/peak heuristic. */
export function fallbackFiveSeasons(seasonsAscending) {
  if (seasonsAscending.length <= 5) return seasonsAscending
  return seasonsAscending.slice(seasonsAscending.length - 5)
}
