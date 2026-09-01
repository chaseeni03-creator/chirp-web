// Stat Line clue/scoring logic, ported 1:1 from the Flutter app's
// lib/features/games/models/stat_line_models.dart (NFL),
// mlb_stat_line_models.dart, and nba_stat_line_models.dart.

import { mlbResolveTeam, nbaResolveTeam } from './chirpGuess.js'

// ── NFL team table (season-team's conference/division, NOT the player's
// stored current conference/division — a player who switched conferences
// mid-career gets the right clue for THAT season). ──────────────────────────

const NFL_TEAMS = {
  BUF: { conference: 'AFC', division: 'AFC East' }, MIA: { conference: 'AFC', division: 'AFC East' },
  NE: { conference: 'AFC', division: 'AFC East' }, NYJ: { conference: 'AFC', division: 'AFC East' },
  BAL: { conference: 'AFC', division: 'AFC North' }, CIN: { conference: 'AFC', division: 'AFC North' },
  CLE: { conference: 'AFC', division: 'AFC North' }, PIT: { conference: 'AFC', division: 'AFC North' },
  HOU: { conference: 'AFC', division: 'AFC South' }, IND: { conference: 'AFC', division: 'AFC South' },
  JAX: { conference: 'AFC', division: 'AFC South' }, TEN: { conference: 'AFC', division: 'AFC South' },
  DEN: { conference: 'AFC', division: 'AFC West' }, KC: { conference: 'AFC', division: 'AFC West' },
  LV: { conference: 'AFC', division: 'AFC West' }, LAC: { conference: 'AFC', division: 'AFC West' },
  DAL: { conference: 'NFC', division: 'NFC East' }, NYG: { conference: 'NFC', division: 'NFC East' },
  PHI: { conference: 'NFC', division: 'NFC East' }, WAS: { conference: 'NFC', division: 'NFC East' },
  CHI: { conference: 'NFC', division: 'NFC North' }, DET: { conference: 'NFC', division: 'NFC North' },
  GB: { conference: 'NFC', division: 'NFC North' }, MIN: { conference: 'NFC', division: 'NFC North' },
  ATL: { conference: 'NFC', division: 'NFC South' }, CAR: { conference: 'NFC', division: 'NFC South' },
  NO: { conference: 'NFC', division: 'NFC South' }, TB: { conference: 'NFC', division: 'NFC South' },
  ARI: { conference: 'NFC', division: 'NFC West' }, LA: { conference: 'NFC', division: 'NFC West' },
  SF: { conference: 'NFC', division: 'NFC West' }, SEA: { conference: 'NFC', division: 'NFC West' },
}
const NFL_TEAM_ALIASES = { AZ: 'ARI', GNB: 'GB', KAN: 'KC', LVR: 'LV', LAR: 'LA', NOR: 'NO', NWE: 'NE', SFO: 'SF', TAM: 'TB', JAC: 'JAX', HTX: 'HOU', CLT: 'IND' }
function nflCanonicalCode(code) {
  if (!code) return null
  return NFL_TEAM_ALIASES[code.toUpperCase()] || code.toUpperCase()
}
export function nflResolveTeam(code) {
  const c = nflCanonicalCode(code)
  return c ? NFL_TEAMS[c] || null : null
}

/** Team/division/conference -> the nfl_season_stats.team codes that scope covers (used by The Lineup). */
export function nflTeamCodesForScope(type, value) {
  if (type === 'team') return [nflCanonicalCode(value)]
  if (type === 'division') return Object.entries(NFL_TEAMS).filter(([, t]) => t.division === value).map(([code]) => code)
  if (type === 'conference') return Object.entries(NFL_TEAMS).filter(([, t]) => t.conference === value).map(([code]) => code)
  return []
}

// ── NFL position groups / labels ────────────────────────────────────────────

export function nflPositionGroupFor(rawPosition) {
  const p = (rawPosition || '').toUpperCase()
  if (p === 'QB') return 'QB'
  if (['RB', 'FB', 'HB'].includes(p)) return 'RB'
  if (p === 'WR' || p === 'TE') return 'WR_TE'
  if (['CB', 'S', 'FS', 'SS', 'DB'].includes(p)) return 'CB_S_DB'
  return 'DE_LB' // DE/DT/NT/DL/LB/OLB/ILB/MLB, and unmapped positions
}

export function nflPositionLabel(rawPosition) {
  const p = (rawPosition || '').toUpperCase()
  if (p === 'QB') return 'QUARTERBACK'
  if (['RB', 'HB', 'FB'].includes(p)) return 'RUNNING BACK'
  if (p === 'WR') return 'WIDE RECEIVER'
  if (p === 'TE') return 'TIGHT END'
  if (['DE', 'DT', 'NT', 'DL'].includes(p)) return 'DEFENSIVE END'
  if (['LB', 'OLB', 'MLB', 'ILB'].includes(p)) return 'LINEBACKER'
  if (p === 'CB') return 'CORNERBACK'
  if (['S', 'FS', 'SS'].includes(p)) return 'SAFETY'
  if (p === 'DB') return 'DEFENSIVE BACK'
  if (p === 'K') return 'KICKER'
  if (p === 'P') return 'PUNTER'
  if (['OT', 'OG', 'C', 'G', 'T'].includes(p)) return 'OFFENSIVE LINEMAN'
  return p
}

const NFL_CLUE_ORDERS = {
  QB: ['passing_yards', 'passing_touchdowns', 'passing_completions', 'passing_attempts', 'interceptions_thrown', 'passer_rating', 'rushing_yards', '@conference', '@division', '@season', '@team'],
  RB: ['rushing_yards', 'rushing_touchdowns', 'rushing_attempts', 'receptions', 'receiving_yards', 'yards_per_carry', '@conference', '@season', '@team'],
  WR_TE: ['receiving_yards', 'receptions', 'receiving_touchdowns', 'targets', 'yards_per_reception', '@conference', '@division', '@season', '@team'],
  DE_LB: ['sacks', 'tackles', 'forced_fumbles', 'passes_defended', 'games_played', '@conference', '@division', '@season', '@team'],
  CB_S_DB: ['interceptions_caught', 'tackles', 'passes_defended', 'forced_fumbles', 'sacks', '@conference', '@division', '@season', '@team'],
}

const NFL_GRID_HEADERS = {
  QB: { passing_yards: 'YDS', passing_touchdowns: 'TD', passing_completions: 'CMP', passing_attempts: 'ATT', interceptions_thrown: 'INT', passer_rating: 'RTG', rushing_yards: 'RUSH' },
  RB: { rushing_yards: 'YDS', rushing_touchdowns: 'TD', rushing_attempts: 'CAR', receptions: 'REC', receiving_yards: 'RYDS', yards_per_carry: 'YPC' },
  WR_TE: { receiving_yards: 'YDS', receptions: 'REC', receiving_touchdowns: 'TD', targets: 'TGT', yards_per_reception: 'YPR' },
  DE_LB: { sacks: 'SCK', tackles: 'TKL', forced_fumbles: 'FF', passes_defended: 'PD', games_played: 'GP' },
  CB_S_DB: { interceptions_caught: 'INT', tackles: 'TKL', passes_defended: 'PD', forced_fumbles: 'FF', sacks: 'SCK' },
}

const NFL_DECIMAL_STATS = new Set(['passer_rating', 'sacks', 'yards_per_reception', 'yards_per_carry'])
const NFL_SCORE_TABLE_11 = { 1: 1000, 2: 910, 3: 820, 4: 730, 5: 640, 6: 550, 7: 460, 8: 370, 9: 280, 10: 190, 11: 100 }
const NFL_SCORE_TABLE_9 = { 1: 1000, 2: 890, 3: 780, 4: 670, 5: 560, 6: 450, 7: 340, 8: 230, 9: 100 }

function nflFormatValue(stats, key) {
  const v = stats[key] ?? 0
  return NFL_DECIMAL_STATS.has(key) ? v.toFixed(1) : String(Math.round(v))
}

/** Builds the full clue config for an NFL season row (raw *_season_stats columns + joined player). */
export function buildNflMystery(seasonRow, player) {
  const group = nflPositionGroupFor(player.position)
  const stats = { ...seasonRow }
  stats.yards_per_carry = stats.rushing_attempts > 0 ? stats.rushing_yards / stats.rushing_attempts : 0
  const clueSteps = NFL_CLUE_ORDORS_SAFE(group)
  const team = seasonRow.team
  const seasonTeam = nflResolveTeam(team)
  return {
    group,
    positionLabel: nflPositionLabel(player.position),
    clueSteps,
    gridHeaders: NFL_GRID_HEADERS[group],
    scoreTable: group === 'QB' ? NFL_SCORE_TABLE_11 : NFL_SCORE_TABLE_9,
    stats,
    season: seasonRow.season,
    team,
    seasonConference: seasonTeam?.conference ?? player.conference ?? null,
    seasonDivision: seasonTeam?.division ?? null,
    formatValue: (key) => nflFormatValue(stats, key),
  }
}
function NFL_CLUE_ORDORS_SAFE(group) {
  return NFL_CLUE_ORDERS[group] || NFL_CLUE_ORDERS.DE_LB
}

/** Hot/cold hints on a wrong guess — NFL only (mobile has no hint system for MLB/NBA). */
export function nflHintsAgainst(mystery, mysteryPlayer, guessedPlayer) {
  const hits = new Set()
  const guessedPos = guessedPlayer.position?.toUpperCase()
  if (guessedPos && nflPositionGroupFor(guessedPos) === mystery.group) hits.add('position')

  const gFirst = guessedPlayer.season_first
  const gLast = guessedPlayer.season_last
  if (gFirst != null && gLast != null) {
    const decade = Math.floor(mystery.season / 10) * 10
    if (gFirst <= decade + 9 && gLast >= decade) hits.add('era')
  }

  const myTeams = new Set([
    ...(mysteryPlayer.current_team ? [nflCanonicalCode(mysteryPlayer.current_team)] : []),
    ...(mysteryPlayer.previous_teams || []).map(nflCanonicalCode),
  ])
  const guessedTeams = new Set([
    ...(guessedPlayer.current_team ? [nflCanonicalCode(guessedPlayer.current_team)] : []),
    ...(guessedPlayer.previous_teams || []).map(nflCanonicalCode),
  ])
  if (myTeams.size > 0 && [...guessedTeams].some((t) => myTeams.has(t))) hits.add('team')

  if (guessedPlayer.conference != null && mysteryPlayer.conference != null && guessedPlayer.conference === mysteryPlayer.conference) {
    hits.add('conference')
  }
  return hits
}

export const HINT_LABELS = {
  position: 'Right position!',
  era: 'Right era!',
  team: 'Played for the same team at some point!',
  conference: 'Right conference!',
}

export function nflTeammateImpact(r) {
  return (r.passing_yards ?? 0) + (r.rushing_yards ?? 0) + (r.receiving_yards ?? 0) + (r.tackles ?? 0) * 5 + (r.sacks ?? 0) * 50
}

// ── MLB ──────────────────────────────────────────────────────────────────

const MLB_CLUE_ORDERS = {
  batter: ['home_runs', 'rbi', 'batting_average', 'hits', 'at_bats', 'ops', '@league', '@division', '@season', '@team'],
  pitcher: ['era', 'strikeouts_pitched', 'whip', 'wins', 'losses', 'innings_pitched', '@league', '@division', '@season', '@team'],
}
const MLB_GRID_HEADERS = { home_runs: 'HR', rbi: 'RBI', batting_average: 'AVG', hits: 'H', at_bats: 'AB', ops: 'OPS', era: 'ERA', strikeouts_pitched: 'K', whip: 'WHIP', wins: 'W', losses: 'L', innings_pitched: 'IP' }
const MLB_DECIMALS_3 = new Set(['batting_average', 'ops'])
const MLB_DECIMALS_2 = new Set(['era', 'whip'])
const MLB_DECIMALS_1 = new Set(['innings_pitched'])
const MLB_SCORE_TABLE = { 1: 1000, 2: 900, 3: 800, 4: 700, 5: 600, 6: 500, 7: 400, 8: 300, 9: 200, 10: 100 }

function mlbFormatValue(stats, key) {
  const v = stats[key] ?? 0
  if (MLB_DECIMALS_3.has(key)) return v.toFixed(3)
  if (MLB_DECIMALS_2.has(key)) return v.toFixed(2)
  if (MLB_DECIMALS_1.has(key)) return v.toFixed(1)
  return String(Math.round(v))
}

export function buildMlbMystery(seasonRow, player) {
  const isPitcher = player.position_group === 'Pitcher'
  const clueSteps = MLB_CLUE_ORDERS[isPitcher ? 'pitcher' : 'batter']
  const team = seasonRow.team
  const teamInfo = mlbResolveTeamForStatLine(team)
  return {
    group: isPitcher ? 'pitcher' : 'batter',
    positionLabel: (player.position_group || player.position || '').toUpperCase(),
    clueSteps,
    gridHeaders: MLB_GRID_HEADERS,
    scoreTable: MLB_SCORE_TABLE,
    stats: seasonRow,
    season: seasonRow.season,
    team,
    seasonConference: teamInfo?.league ?? null,
    seasonDivision: teamInfo?.division ?? null,
    formatValue: (key) => mlbFormatValue(seasonRow, key),
  }
}

// Reuses the same MLB team table built for Chirp Guess.
function mlbResolveTeamForStatLine(team) {
  return mlbResolveTeam(team)
}

export function mlbTeammateImpact(r) {
  return (r.hits ?? 0) + (r.home_runs ?? 0) * 4 + (r.rbi ?? 0) + (r.wins ?? 0) * 10 + (r.strikeouts_pitched ?? 0) * 2 + (r.saves ?? 0) * 8
}

// ── NBA ──────────────────────────────────────────────────────────────────

const NBA_CLUE_ORDER = ['points_per_game', 'rebounds_per_game', 'assists_per_game', 'field_goal_percentage', 'three_point_percentage', 'free_throw_percentage', 'games_played', '@conference', '@division', '@season', '@team']
const NBA_GRID_HEADERS = { points_per_game: 'PPG', rebounds_per_game: 'RPG', assists_per_game: 'APG', field_goal_percentage: 'FG%', three_point_percentage: '3P%', free_throw_percentage: 'FT%', games_played: 'GP' }
const NBA_PERCENT_STATS = new Set(['field_goal_percentage', 'three_point_percentage', 'free_throw_percentage'])
const NBA_SCORE_TABLE = { 1: 1000, 2: 910, 3: 820, 4: 730, 5: 640, 6: 550, 7: 460, 8: 370, 9: 280, 10: 190, 11: 100 }

function nbaFormatValue(stats, key) {
  const v = stats[key] ?? 0
  if (NBA_PERCENT_STATS.has(key)) return `${(v * 100).toFixed(1)}%`
  if (key === 'games_played') return String(Math.round(v))
  return v.toFixed(1)
}

export function nbaPositionLabel(rawPosition) {
  const p = (rawPosition || '').toUpperCase()
  if (p === 'G') return 'GUARD'
  if (p === 'F') return 'FORWARD'
  if (p === 'C') return 'CENTER'
  if (p === 'G-F' || p === 'F-G') return 'GUARD-FORWARD'
  if (p === 'F-C' || p === 'C-F') return 'FORWARD-CENTER'
  return p || 'UNKNOWN'
}

export function buildNbaMystery(seasonRow, player) {
  const team = seasonRow.team
  const teamInfo = nbaResolveTeamForStatLine(team)
  return {
    group: 'ALL',
    positionLabel: nbaPositionLabel(player.position),
    clueSteps: NBA_CLUE_ORDER,
    gridHeaders: NBA_GRID_HEADERS,
    scoreTable: NBA_SCORE_TABLE,
    stats: seasonRow,
    season: seasonRow.season,
    team,
    seasonConference: teamInfo?.conference ?? null,
    seasonDivision: teamInfo?.division ?? null,
    formatValue: (key) => nbaFormatValue(seasonRow, key),
  }
}

function nbaResolveTeamForStatLine(team) {
  return nbaResolveTeam(team)
}

export function nbaTeammateImpact(r) {
  return (r.total_points ?? 0) + (r.total_rebounds ?? 0) * 1.2 + (r.total_assists ?? 0) * 1.5
}

// ── Shared helpers used by the page ─────────────────────────────────────────

/** Which clue index (0-based within clueSteps) a stat/tag is at, or -1. */
export function stepIndex(clueSteps, tagOrKey) {
  return clueSteps.indexOf(tagOrKey)
}

export function isRevealed(clueSteps, tag, currentClue) {
  const idx = stepIndex(clueSteps, tag)
  return idx !== -1 && currentClue > idx
}

export function gridStatKeys(clueSteps) {
  return clueSteps.filter((s) => !s.startsWith('@'))
}
