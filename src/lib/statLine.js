// Stat Line clue/scoring logic, ported 1:1 from the Flutter app's
// lib/features/games/models/stat_line_models.dart (NFL),
// mlb_stat_line_models.dart, and nba_stat_line_models.dart.
//
// Clue orders alternate a real stat with a contextual clue (conference,
// division, season, team, and — for NFL QB and NBA only — a teammate hint)
// per an explicit request to make the game friendlier to casual fans. Two
// stats named in that request don't exist as tracked columns anywhere in
// this data (checked nfl_season_stats / mlb_season_stats directly): NFL's
// "Defensive TDs" and MLB relief pitchers' "Holds". Substituted with
// games_played and walks_allowed respectively — flagged at each site below.

import { mlbResolveTeam, nbaResolveTeam } from './chirpGuess.js'

// ── NFL team table (season-team's conference/division, NOT the player's
// stored current conference/division — a player who switched conferences
// mid-career gets the right clue for THAT season). ──────────────────────────

export const NFL_TEAMS = {
  BUF: { conference: 'AFC', division: 'AFC East', fullName: 'Buffalo Bills' }, MIA: { conference: 'AFC', division: 'AFC East', fullName: 'Miami Dolphins' },
  NE: { conference: 'AFC', division: 'AFC East', fullName: 'New England Patriots' }, NYJ: { conference: 'AFC', division: 'AFC East', fullName: 'New York Jets' },
  BAL: { conference: 'AFC', division: 'AFC North', fullName: 'Baltimore Ravens' }, CIN: { conference: 'AFC', division: 'AFC North', fullName: 'Cincinnati Bengals' },
  CLE: { conference: 'AFC', division: 'AFC North', fullName: 'Cleveland Browns' }, PIT: { conference: 'AFC', division: 'AFC North', fullName: 'Pittsburgh Steelers' },
  HOU: { conference: 'AFC', division: 'AFC South', fullName: 'Houston Texans' }, IND: { conference: 'AFC', division: 'AFC South', fullName: 'Indianapolis Colts' },
  JAX: { conference: 'AFC', division: 'AFC South', fullName: 'Jacksonville Jaguars' }, TEN: { conference: 'AFC', division: 'AFC South', fullName: 'Tennessee Titans' },
  DEN: { conference: 'AFC', division: 'AFC West', fullName: 'Denver Broncos' }, KC: { conference: 'AFC', division: 'AFC West', fullName: 'Kansas City Chiefs' },
  LV: { conference: 'AFC', division: 'AFC West', fullName: 'Las Vegas Raiders' }, LAC: { conference: 'AFC', division: 'AFC West', fullName: 'Los Angeles Chargers' },
  DAL: { conference: 'NFC', division: 'NFC East', fullName: 'Dallas Cowboys' }, NYG: { conference: 'NFC', division: 'NFC East', fullName: 'New York Giants' },
  PHI: { conference: 'NFC', division: 'NFC East', fullName: 'Philadelphia Eagles' }, WAS: { conference: 'NFC', division: 'NFC East', fullName: 'Washington Commanders' },
  CHI: { conference: 'NFC', division: 'NFC North', fullName: 'Chicago Bears' }, DET: { conference: 'NFC', division: 'NFC North', fullName: 'Detroit Lions' },
  GB: { conference: 'NFC', division: 'NFC North', fullName: 'Green Bay Packers' }, MIN: { conference: 'NFC', division: 'NFC North', fullName: 'Minnesota Vikings' },
  ATL: { conference: 'NFC', division: 'NFC South', fullName: 'Atlanta Falcons' }, CAR: { conference: 'NFC', division: 'NFC South', fullName: 'Carolina Panthers' },
  NO: { conference: 'NFC', division: 'NFC South', fullName: 'New Orleans Saints' }, TB: { conference: 'NFC', division: 'NFC South', fullName: 'Tampa Bay Buccaneers' },
  ARI: { conference: 'NFC', division: 'NFC West', fullName: 'Arizona Cardinals' }, LA: { conference: 'NFC', division: 'NFC West', fullName: 'Los Angeles Rams' },
  SF: { conference: 'NFC', division: 'NFC West', fullName: 'San Francisco 49ers' }, SEA: { conference: 'NFC', division: 'NFC West', fullName: 'Seattle Seahawks' },
}
const NFL_TEAM_ALIASES = {
  AZ: 'ARI', GNB: 'GB', KAN: 'KC', LVR: 'LV', LAR: 'LA', NOR: 'NO', NWE: 'NE', SFO: 'SF', TAM: 'TB', JAC: 'JAX', HTX: 'HOU', CLT: 'IND',
  OTI: 'TEN', OAK: 'LV', SD: 'LAC', SDG: 'LAC', WSH: 'WAS', RAM: 'LA',
}
function nflCanonicalCode(code) {
  if (!code) return null
  return NFL_TEAM_ALIASES[code.toUpperCase()] || code.toUpperCase()
}
export function nflResolveTeam(code) {
  const c = nflCanonicalCode(code)
  return c ? NFL_TEAMS[c] || null : null
}

export { nflCanonicalCode }

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

// Alternating stat/contextual-clue order per position group. Teammate is a
// clue only for QB — matches the explicit per-sport spec (RB/WR/TE/DE/CB
// groups don't get one).
const NFL_CLUE_ORDERS = {
  QB: ['passing_yards', '@conference', 'passing_touchdowns', '@division', 'passing_completions', '@season', 'passing_attempts', '@team', 'interceptions_thrown', 'passer_rating', '@teammate'],
  RB: ['rushing_yards', '@conference', 'rushing_touchdowns', '@division', 'rushing_attempts', '@season', 'receptions', '@team', 'yards_per_carry'],
  WR_TE: ['receiving_yards', '@conference', 'receptions', '@division', 'receiving_touchdowns', '@season', 'targets', '@team', 'yards_per_reception'],
  // "Defensive TDs" isn't a tracked column in nfl_season_stats — substituted
  // games_played (the position group's own pre-existing filler stat).
  DE_LB: ['sacks', '@conference', 'tackles', '@division', 'forced_fumbles', '@season', 'passes_defended', '@team', 'games_played'],
  CB_S_DB: ['interceptions_caught', '@conference', 'tackles', '@division', 'passes_defended', '@season', 'forced_fumbles', '@team', 'sacks'],
}

const NFL_GRID_HEADERS = {
  passing_yards: 'YDS', passing_touchdowns: 'TD', passing_completions: 'CMP', passing_attempts: 'ATT', interceptions_thrown: 'INT', passer_rating: 'RTG',
  rushing_yards: 'YDS', rushing_touchdowns: 'TD', rushing_attempts: 'CAR', receptions: 'REC', receiving_yards: 'RYDS', yards_per_carry: 'YPC',
  receiving_touchdowns: 'TD', targets: 'TGT', yards_per_reception: 'YPR',
  sacks: 'SCK', tackles: 'TKL', forced_fumbles: 'FF', passes_defended: 'PD', games_played: 'GP', interceptions_caught: 'INT',
}

const NFL_DECIMAL_STATS = new Set(['passer_rating', 'yards_per_reception', 'yards_per_carry'])
// QB keeps its own 11-clue table; every other NFL group shares the 9-clue one.
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
    gridHeaders: NFL_GRID_HEADERS,
    scoreTable: group === 'QB' ? NFL_SCORE_TABLE_11 : NFL_SCORE_TABLE_9,
    stats,
    season: seasonRow.season,
    team,
    teamFullName: seasonTeam?.fullName ?? team,
    seasonConference: seasonTeam?.conference ?? player.conference ?? null,
    seasonDivision: seasonTeam?.division ?? null,
    hasTeammateClue: clueSteps.includes('@teammate'),
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

// Split into starting/relief pitcher per an explicit request — there's no
// role column anywhere in this schema, so a season is classified as
// "started at least one game that year" vs not, which is the same real-world
// distinction (a pure reliever season has zero starts).
const MLB_CLUE_ORDERS = {
  batter: ['batting_average', '@league', 'home_runs', '@division', 'rbi', '@season', 'hits', '@team', 'on_base_percentage', 'stolen_bases'],
  starting_pitcher: ['era', '@league', 'wins', '@division', 'strikeouts_pitched', '@season', 'whip', '@team', 'innings_pitched', 'losses'],
  // "Holds" isn't a tracked column in mlb_season_stats — substituted
  // walks_allowed (a real, distinct-from-Starting-Pitcher's-clue-10 control stat).
  relief_pitcher: ['era', '@league', 'saves', '@division', 'strikeouts_pitched', '@season', 'whip', '@team', 'games_pitched', 'walks_allowed'],
}
const MLB_GRID_HEADERS = {
  batting_average: 'AVG', home_runs: 'HR', rbi: 'RBI', hits: 'H', on_base_percentage: 'OBP', stolen_bases: 'SB',
  era: 'ERA', wins: 'W', strikeouts_pitched: 'K', whip: 'WHIP', innings_pitched: 'IP', losses: 'L', saves: 'SV', games_pitched: 'APP', walks_allowed: 'BB',
}
const MLB_DECIMALS_3 = new Set(['batting_average', 'ops', 'on_base_percentage'])
const MLB_DECIMALS_2 = new Set(['era', 'whip'])
const MLB_DECIMALS_1 = new Set(['innings_pitched'])
const MLB_SCORE_TABLE = { 1: 1000, 2: 890, 3: 780, 4: 670, 5: 560, 6: 450, 7: 340, 8: 230, 9: 130, 10: 50 }

function mlbFormatValue(stats, key) {
  const v = stats[key] ?? 0
  if (MLB_DECIMALS_3.has(key)) return v.toFixed(3)
  if (MLB_DECIMALS_2.has(key)) return v.toFixed(2)
  if (MLB_DECIMALS_1.has(key)) return v.toFixed(1)
  return String(Math.round(v))
}

function mlbPositionLabel(group) {
  if (group === 'starting_pitcher') return 'STARTING PITCHER'
  if (group === 'relief_pitcher') return 'RELIEF PITCHER'
  return group.toUpperCase()
}

export function buildMlbMystery(seasonRow, player) {
  const isPitcher = player.position_group === 'Pitcher'
  const group = isPitcher ? ((seasonRow.games_started ?? 0) > 0 ? 'starting_pitcher' : 'relief_pitcher') : 'batter'
  const clueSteps = MLB_CLUE_ORDERS[group]
  const team = seasonRow.team
  const teamInfo = mlbResolveTeamForStatLine(team)
  return {
    group,
    positionLabel: isPitcher ? mlbPositionLabel(group) : (player.position_group || player.position || '').toUpperCase(),
    clueSteps,
    gridHeaders: MLB_GRID_HEADERS,
    scoreTable: MLB_SCORE_TABLE,
    stats: seasonRow,
    season: seasonRow.season,
    team,
    teamFullName: teamInfo?.fullName ?? team,
    seasonConference: teamInfo?.league ?? null,
    seasonDivision: teamInfo?.division ?? null,
    hasTeammateClue: false,
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

const NBA_CLUE_ORDER = ['points_per_game', '@conference', 'rebounds_per_game', '@division', 'assists_per_game', '@season', 'steals_per_game', '@team', 'blocks_per_game', 'field_goal_percentage', 'three_point_percentage', '@teammate']
const NBA_GRID_HEADERS = { points_per_game: 'PPG', rebounds_per_game: 'RPG', assists_per_game: 'APG', steals_per_game: 'SPG', blocks_per_game: 'BPG', field_goal_percentage: 'FG%', three_point_percentage: '3P%' }
const NBA_PERCENT_STATS = new Set(['field_goal_percentage', 'three_point_percentage', 'free_throw_percentage'])
const NBA_SCORE_TABLE = { 1: 1000, 2: 920, 3: 840, 4: 760, 5: 680, 6: 600, 7: 520, 8: 440, 9: 360, 10: 280, 11: 200, 12: 100 }

function nbaFormatValue(stats, key) {
  const v = stats[key] ?? 0
  if (NBA_PERCENT_STATS.has(key)) return `${(v * 100).toFixed(1)}%`
  if (key === 'games_played') return String(Math.round(v))
  // Every per-game counting stat always shows one decimal place, even when
  // it happens to be a whole number (8.0, not 8) — matches the explicit
  // "toStringAsFixed(1) always" requirement.
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
    teamFullName: teamInfo?.fullName ?? team,
    seasonConference: teamInfo?.conference ?? null,
    seasonDivision: teamInfo?.division ?? null,
    hasTeammateClue: true,
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
