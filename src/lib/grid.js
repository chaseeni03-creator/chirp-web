// Chirp Grid logic, ported from lib/features/games/models/nfl_grid_models.dart,
// mlb_grid_models.dart, and nba_grid_models.dart — each sport validates
// categories dynamically against live player/stat data (not a hand-curated
// player<->category mapping table).

import { supabase } from './supabase'
import { NFL_TEAMS, nflCanonicalCode } from './statLine'
import { MLB_TEAMS, mlbCanonicalCode, NBA_TEAMS, nbaCanonicalCode } from './chirpGuess'

// ── Position groups ──────────────────────────────────────────────────────

const NFL_POSITION_GROUPS = {
  qb: ['QB'], rb: ['RB', 'FB', 'HB'], wr: ['WR'], te: ['TE'],
  ol: ['OT', 'OG', 'C', 'G', 'T'], de: ['DE'], lb: ['LB', 'OLB', 'ILB', 'MLB'], cb: ['CB'], s: ['S', 'FS', 'SS'],
}
const NFL_POSITION_LABELS = {
  qb: 'Quarterback', rb: 'Running Back', wr: 'Wide Receiver', te: 'Tight End',
  ol: 'Offensive Lineman', de: 'Defensive End', lb: 'Linebacker', cb: 'Cornerback', s: 'Safety',
}

const MLB_POSITION_GROUPS = {
  c: ['C'], '1b': ['1B'], '2b': ['2B'], '3b': ['3B'], ss: ['SS'], of: ['LF', 'CF', 'RF', 'OF'], dh: ['DH'], p: ['P'],
}
const MLB_POSITION_LABELS = {
  c: 'Catcher', '1b': 'First Base', '2b': 'Second Base', '3b': 'Third Base',
  ss: 'Shortstop', of: 'Outfield', dh: 'Designated Hitter', p: 'Pitcher',
}

const NBA_POSITION_GROUPS = { g: ['G', 'PG', 'SG', 'G-F'], f: ['F', 'SF', 'PF', 'F-G', 'F-C'], c: ['C', 'C-F'] }
const NBA_POSITION_LABELS = { g: 'Guard', f: 'Forward', c: 'Center' }

// ── Draft ────────────────────────────────────────────────────────────────

const NFL_DRAFT_LABELS = {
  round1: '1st Round Pick', round2: '2nd Round Pick', round3: '3rd Round Pick', round4: '4th Round Pick',
  round5: '5th Round Pick', round6: '6th Round Pick', round7: '7th Round Pick', udfa: 'Undrafted (UDFA)',
  top10: 'Top 10 Pick', top32: 'Top 32 Pick (1st Round)',
}
const NBA_DRAFT_LABELS = { round1: 'Drafted in Round 1', round2: 'Drafted in Round 2', undrafted: 'Undrafted' }

// ── All-Star / Hall of Fame ──────────────────────────────────────────────

const MLB_ALLSTAR_LABELS = { any: 'All-Star (1+ selections)', '5plus': '5+ All-Star selections', '10plus': '10+ All-Star selections' }
const NBA_ALLSTAR_LABELS = { any: 'NBA All Star', '5plus': '5+ All-Star selections', '10plus': '10+ All-Star selections' }
const MLB_HOF_LABELS = { yes: 'Hall of Famer' }

// ── Era ──────────────────────────────────────────────────────────────────

function eraLabel(value) {
  return value === 'active' ? 'Active Player' : `Played in the ${value}`
}
function eraDecadeRange(value) {
  const start = Number(String(value).replace('s', ''))
  return [start, start + 9]
}
function matchesEra(player, value) {
  if (value === 'active') return player.is_active === true
  const first = player.season_first
  const last = player.season_last
  if (first == null || last == null) return false
  const [start, end] = eraDecadeRange(value)
  return first <= end && last >= start
}

// ── Stat presets (ported exactly from each sport's Dart preset table) ────

const NFL_STAT_PRESETS = {
  pass_yds_3500_szn: { label: '3,500+ Passing Yards (Season)', column: 'passing_yards', threshold: 3500, season: true },
  pass_yds_4000_szn: { label: '4,000+ Passing Yards (Season)', column: 'passing_yards', threshold: 4000, season: true },
  pass_yds_4500_szn: { label: '4,500+ Passing Yards (Season)', column: 'passing_yards', threshold: 4500, season: true },
  pass_yds_5000_szn: { label: '5,000+ Passing Yards (Season)', column: 'passing_yards', threshold: 5000, season: true },
  pass_td_30_szn: { label: '30+ Passing TDs (Season)', column: 'passing_touchdowns', threshold: 30, season: true },
  pass_td_40_szn: { label: '40+ Passing TDs (Season)', column: 'passing_touchdowns', threshold: 40, season: true },
  pass_td_50_szn: { label: '50+ Passing TDs (Season)', column: 'passing_touchdowns', threshold: 50, season: true },
  pass_yds_20000_car: { label: '20,000+ Passing Yards (Career)', column: 'passing_yards', threshold: 20000, season: false },
  pass_yds_30000_car: { label: '30,000+ Passing Yards (Career)', column: 'passing_yards', threshold: 30000, season: false },
  pass_yds_40000_car: { label: '40,000+ Passing Yards (Career)', column: 'passing_yards', threshold: 40000, season: false },
  pass_yds_50000_car: { label: '50,000+ Passing Yards (Career)', column: 'passing_yards', threshold: 50000, season: false },
  pass_td_150_car: { label: '150+ Passing TDs (Career)', column: 'passing_touchdowns', threshold: 150, season: false },
  pass_td_200_car: { label: '200+ Passing TDs (Career)', column: 'passing_touchdowns', threshold: 200, season: false },
  pass_td_300_car: { label: '300+ Passing TDs (Career)', column: 'passing_touchdowns', threshold: 300, season: false },
  rush_yds_1000_szn: { label: '1,000+ Rushing Yards (Season)', column: 'rushing_yards', threshold: 1000, season: true },
  rush_yds_1200_szn: { label: '1,200+ Rushing Yards (Season)', column: 'rushing_yards', threshold: 1200, season: true },
  rush_yds_1500_szn: { label: '1,500+ Rushing Yards (Season)', column: 'rushing_yards', threshold: 1500, season: true },
  rush_yds_1800_szn: { label: '1,800+ Rushing Yards (Season)', column: 'rushing_yards', threshold: 1800, season: true },
  rush_td_10_szn: { label: '10+ Rushing TDs (Season)', column: 'rushing_touchdowns', threshold: 10, season: true },
  rush_td_15_szn: { label: '15+ Rushing TDs (Season)', column: 'rushing_touchdowns', threshold: 15, season: true },
  rush_td_20_szn: { label: '20+ Rushing TDs (Season)', column: 'rushing_touchdowns', threshold: 20, season: true },
  rush_yds_5000_car: { label: '5,000+ Rushing Yards (Career)', column: 'rushing_yards', threshold: 5000, season: false },
  rush_yds_8000_car: { label: '8,000+ Rushing Yards (Career)', column: 'rushing_yards', threshold: 8000, season: false },
  rush_yds_10000_car: { label: '10,000+ Rushing Yards (Career)', column: 'rushing_yards', threshold: 10000, season: false },
  rush_yds_12000_car: { label: '12,000+ Rushing Yards (Career)', column: 'rushing_yards', threshold: 12000, season: false },
  rush_td_50_car: { label: '50+ Rushing TDs (Career)', column: 'rushing_touchdowns', threshold: 50, season: false },
  rush_td_75_car: { label: '75+ Rushing TDs (Career)', column: 'rushing_touchdowns', threshold: 75, season: false },
  rush_td_100_car: { label: '100+ Rushing TDs (Career)', column: 'rushing_touchdowns', threshold: 100, season: false },
  rec_yds_800_szn: { label: '800+ Receiving Yards (Season)', column: 'receiving_yards', threshold: 800, season: true },
  rec_yds_1000_szn: { label: '1,000+ Receiving Yards (Season)', column: 'receiving_yards', threshold: 1000, season: true },
  rec_yds_1200_szn: { label: '1,200+ Receiving Yards (Season)', column: 'receiving_yards', threshold: 1200, season: true },
  rec_yds_1500_szn: { label: '1,500+ Receiving Yards (Season)', column: 'receiving_yards', threshold: 1500, season: true },
  rec_70_szn: { label: '70+ Receptions (Season)', column: 'receptions', threshold: 70, season: true },
  rec_90_szn: { label: '90+ Receptions (Season)', column: 'receptions', threshold: 90, season: true },
  rec_100_szn: { label: '100+ Receptions (Season)', column: 'receptions', threshold: 100, season: true },
  rec_120_szn: { label: '120+ Receptions (Season)', column: 'receptions', threshold: 120, season: true },
  rec_td_8_szn: { label: '8+ Receiving TDs (Season)', column: 'receiving_touchdowns', threshold: 8, season: true },
  rec_td_10_szn: { label: '10+ Receiving TDs (Season)', column: 'receiving_touchdowns', threshold: 10, season: true },
  rec_td_15_szn: { label: '15+ Receiving TDs (Season)', column: 'receiving_touchdowns', threshold: 15, season: true },
  rec_yds_5000_car: { label: '5,000+ Receiving Yards (Career)', column: 'receiving_yards', threshold: 5000, season: false },
  rec_yds_8000_car: { label: '8,000+ Receiving Yards (Career)', column: 'receiving_yards', threshold: 8000, season: false },
  rec_yds_10000_car: { label: '10,000+ Receiving Yards (Career)', column: 'receiving_yards', threshold: 10000, season: false },
  rec_yds_12000_car: { label: '12,000+ Receiving Yards (Career)', column: 'receiving_yards', threshold: 12000, season: false },
  rec_500_car: { label: '500+ Receptions (Career)', column: 'receptions', threshold: 500, season: false },
  rec_700_car: { label: '700+ Receptions (Career)', column: 'receptions', threshold: 700, season: false },
  rec_900_car: { label: '900+ Receptions (Career)', column: 'receptions', threshold: 900, season: false },
  rec_td_50_car: { label: '50+ Receiving TDs (Career)', column: 'receiving_touchdowns', threshold: 50, season: false },
  rec_td_75_car: { label: '75+ Receiving TDs (Career)', column: 'receiving_touchdowns', threshold: 75, season: false },
  rec_td_100_car: { label: '100+ Receiving TDs (Career)', column: 'receiving_touchdowns', threshold: 100, season: false },
  int_3_szn: { label: '3+ Interceptions (Season)', column: 'interceptions_caught', threshold: 3, season: true },
  int_5_szn: { label: '5+ Interceptions (Season)', column: 'interceptions_caught', threshold: 5, season: true },
  int_8_szn: { label: '8+ Interceptions (Season)', column: 'interceptions_caught', threshold: 8, season: true },
  int_10_szn: { label: '10+ Interceptions (Season)', column: 'interceptions_caught', threshold: 10, season: true },
  sacks_8_szn: { label: '8+ Sacks (Season)', column: 'sacks', threshold: 8, season: true },
  sacks_10_szn: { label: '10+ Sacks (Season)', column: 'sacks', threshold: 10, season: true },
  sacks_12_szn: { label: '12+ Sacks (Season)', column: 'sacks', threshold: 12, season: true },
  sacks_15_szn: { label: '15+ Sacks (Season)', column: 'sacks', threshold: 15, season: true },
  sacks_20_szn: { label: '20+ Sacks (Season)', column: 'sacks', threshold: 20, season: true },
  tackles_100_szn: { label: '100+ Tackles (Season)', column: 'tackles', threshold: 100, season: true },
  tackles_120_szn: { label: '120+ Tackles (Season)', column: 'tackles', threshold: 120, season: true },
  tackles_150_szn: { label: '150+ Tackles (Season)', column: 'tackles', threshold: 150, season: true },
  int_20_car: { label: '20+ Interceptions (Career)', column: 'interceptions_caught', threshold: 20, season: false },
  int_30_car: { label: '30+ Interceptions (Career)', column: 'interceptions_caught', threshold: 30, season: false },
  int_40_car: { label: '40+ Interceptions (Career)', column: 'interceptions_caught', threshold: 40, season: false },
  int_50_car: { label: '50+ Interceptions (Career)', column: 'interceptions_caught', threshold: 50, season: false },
  sacks_50_car: { label: '50+ Sacks (Career)', column: 'sacks', threshold: 50, season: false },
  sacks_75_car: { label: '75+ Sacks (Career)', column: 'sacks', threshold: 75, season: false },
  sacks_100_car: { label: '100+ Sacks (Career)', column: 'sacks', threshold: 100, season: false },
  sacks_130_car: { label: '130+ Sacks (Career)', column: 'sacks', threshold: 130, season: false },
  sacks_150_car: { label: '150+ Sacks (Career)', column: 'sacks', threshold: 150, season: false },
  sacks_200_car: { label: '200+ Sacks (Career)', column: 'sacks', threshold: 200, season: false },
  tackles_500_car: { label: '500+ Tackles (Career)', column: 'tackles', threshold: 500, season: false },
  tackles_750_car: { label: '750+ Tackles (Career)', column: 'tackles', threshold: 750, season: false },
  tackles_1000_car: { label: '1,000+ Tackles (Career)', column: 'tackles', threshold: 1000, season: false },
}

const MLB_STAT_PRESETS = {
  hr_30_szn: { label: '30+ Home Runs (Season)', column: 'home_runs', threshold: 30, season: true },
  hr_40_szn: { label: '40+ Home Runs (Season)', column: 'home_runs', threshold: 40, season: true },
  hr_50_szn: { label: '50+ Home Runs (Season)', column: 'home_runs', threshold: 50, season: true },
  rbi_100_szn: { label: '100+ RBI (Season)', column: 'rbi', threshold: 100, season: true },
  rbi_130_szn: { label: '130+ RBI (Season)', column: 'rbi', threshold: 130, season: true },
  hits_200_szn: { label: '200+ Hits (Season)', column: 'hits', threshold: 200, season: true },
  sb_30_szn: { label: '30+ Stolen Bases (Season)', column: 'stolen_bases', threshold: 30, season: true },
  sb_50_szn: { label: '50+ Stolen Bases (Season)', column: 'stolen_bases', threshold: 50, season: true },
  hr_300_car: { label: '300+ Home Runs (Career)', column: 'home_runs', threshold: 300, season: false },
  hr_400_car: { label: '400+ Home Runs (Career)', column: 'home_runs', threshold: 400, season: false },
  hr_500_car: { label: '500+ Home Runs (Career)', column: 'home_runs', threshold: 500, season: false },
  hr_600_car: { label: '600+ Home Runs (Career)', column: 'home_runs', threshold: 600, season: false },
  rbi_1000_car: { label: '1,000+ RBI (Career)', column: 'rbi', threshold: 1000, season: false },
  rbi_1500_car: { label: '1,500+ RBI (Career)', column: 'rbi', threshold: 1500, season: false },
  hits_2000_car: { label: '2,000+ Hits (Career)', column: 'hits', threshold: 2000, season: false },
  hits_3000_car: { label: '3,000+ Hits (Career)', column: 'hits', threshold: 3000, season: false },
  sb_300_car: { label: '300+ Stolen Bases (Career)', column: 'stolen_bases', threshold: 300, season: false },
  sb_500_car: { label: '500+ Stolen Bases (Career)', column: 'stolen_bases', threshold: 500, season: false },
  wins_15_szn: { label: '15+ Wins (Season)', column: 'wins', threshold: 15, season: true },
  wins_20_szn: { label: '20+ Wins (Season)', column: 'wins', threshold: 20, season: true },
  k_200_szn: { label: '200+ Strikeouts (Season)', column: 'strikeouts_pitched', threshold: 200, season: true },
  k_250_szn: { label: '250+ Strikeouts (Season)', column: 'strikeouts_pitched', threshold: 250, season: true },
  k_300_szn: { label: '300+ Strikeouts (Season)', column: 'strikeouts_pitched', threshold: 300, season: true },
  sv_30_szn: { label: '30+ Saves (Season)', column: 'saves', threshold: 30, season: true },
  sv_40_szn: { label: '40+ Saves (Season)', column: 'saves', threshold: 40, season: true },
  wins_150_car: { label: '150+ Wins (Career)', column: 'wins', threshold: 150, season: false },
  wins_200_car: { label: '200+ Wins (Career)', column: 'wins', threshold: 200, season: false },
  wins_300_car: { label: '300+ Wins (Career)', column: 'wins', threshold: 300, season: false },
  k_2000_car: { label: '2,000+ Strikeouts (Career)', column: 'strikeouts_pitched', threshold: 2000, season: false },
  k_3000_car: { label: '3,000+ Strikeouts (Career)', column: 'strikeouts_pitched', threshold: 3000, season: false },
  sv_200_car: { label: '200+ Saves (Career)', column: 'saves', threshold: 200, season: false },
  sv_300_car: { label: '300+ Saves (Career)', column: 'saves', threshold: 300, season: false },
}

const NBA_STAT_PRESETS = {
  pts_5000_car: { label: '5,000+ Career Points', column: 'points', threshold: 5000, season: false },
  pts_10000_car: { label: '10,000+ Career Points', column: 'points', threshold: 10000, season: false },
  pts_15000_car: { label: '15,000+ Career Points', column: 'points', threshold: 15000, season: false },
  pts_20000_car: { label: '20,000+ Career Points', column: 'points', threshold: 20000, season: false },
  reb_5000_car: { label: '5,000+ Career Rebounds', column: 'rebounds', threshold: 5000, season: false },
  reb_7500_car: { label: '7,500+ Career Rebounds', column: 'rebounds', threshold: 7500, season: false },
  reb_10000_car: { label: '10,000+ Career Rebounds', column: 'rebounds', threshold: 10000, season: false },
  ast_3000_car: { label: '3,000+ Career Assists', column: 'assists', threshold: 3000, season: false },
  ast_5000_car: { label: '5,000+ Career Assists', column: 'assists', threshold: 5000, season: false },
  stl_1000_car: { label: '1,000+ Career Steals', column: 'steals', threshold: 1000, season: false },
  blk_1000_car: { label: '1,000+ Career Blocks', column: 'blocks', threshold: 1000, season: false },
  ppg_20_car: { label: '20+ Career PPG', column: 'points_per_game', threshold: 20, season: false },
  ppg_25_car: { label: '25+ Career PPG', column: 'points_per_game', threshold: 25, season: false },
  ppg_25_szn: { label: '25+ PPG in a Season', column: 'points_per_game', threshold: 25, season: true },
  ppg_30_szn: { label: '30+ PPG in a Season', column: 'points_per_game', threshold: 30, season: true },
  rpg_10_szn: { label: '10+ RPG in a Season', column: 'rebounds_per_game', threshold: 10, season: true },
  apg_10_szn: { label: '10+ APG in a Season', column: 'assists_per_game', threshold: 10, season: true },
}

async function matchesStat(tables, playerId, preset) {
  if (!preset) return false
  const table = preset.season ? tables.seasonStats : tables.careerStats
  const { data } = await supabase
    .from(table)
    .select('id')
    .eq('player_id', playerId)
    .gte(preset.column, preset.threshold)
    .limit(1)
  return (data || []).length > 0
}

// ── Team-code helpers per sport ─────────────────────────────────────────

function playerTeamCodes(player) {
  const current = player.current_team
  const prev = Array.isArray(player.previous_teams) ? player.previous_teams : []
  return [...(current ? [current] : []), ...prev]
}

// ── Per-sport label + validate ──────────────────────────────────────────

export function gridCategoryLabel(sport, type, value) {
  if (sport === 'nfl') {
    switch (type) {
      case 'team': return `Played for the ${NFL_TEAMS[nflCanonicalCode(value)]?.fullName ?? value}`
      case 'position': return NFL_POSITION_LABELS[value] ?? value
      case 'college': return `Went to ${value}`
      case 'draftRound': return NFL_DRAFT_LABELS[value] ?? value
      case 'division': return `Played in ${value}`
      case 'era': return eraLabel(value)
      case 'stat': return NFL_STAT_PRESETS[value]?.label ?? value
      default: return value
    }
  }
  if (sport === 'mlb') {
    switch (type) {
      case 'team': return `Played for the ${MLB_TEAMS[mlbCanonicalCode(value)]?.fullName ?? value}`
      case 'position': return MLB_POSITION_LABELS[value] ?? value
      case 'college': return `Went to ${value}`
      case 'division': return `Played in ${value}`
      case 'league': return `Played in the ${value}`
      case 'era': return eraLabel(value)
      case 'country': return `Born in ${value}`
      case 'hallOfFame': return MLB_HOF_LABELS[value] ?? value
      case 'allStar': return MLB_ALLSTAR_LABELS[value] ?? value
      case 'stat': return MLB_STAT_PRESETS[value]?.label ?? value
      default: return value
    }
  }
  // nba
  switch (type) {
    case 'team': return `Played for the ${NBA_TEAMS[nbaCanonicalCode(value)]?.fullName ?? value}`
    case 'position': return NBA_POSITION_LABELS[value] ?? value
    case 'conference': return `Played in the ${value}`
    case 'division': return `Played in ${value}`
    case 'country': return `Born in ${value}`
    case 'allStar': return NBA_ALLSTAR_LABELS[value] ?? value
    case 'era': return eraLabel(value)
    case 'draft': return NBA_DRAFT_LABELS[value] ?? value
    case 'stat': return NBA_STAT_PRESETS[value]?.label ?? value
    default: return value
  }
}

export async function validateGridCategory(sport, tables, player, type, value) {
  if (sport === 'nfl') {
    switch (type) {
      case 'team': {
        const target = nflCanonicalCode(value)
        return playerTeamCodes(player).some((raw) => nflCanonicalCode(raw) === target)
      }
      case 'position': {
        const pos = (player.position || '').toUpperCase()
        const group = NFL_POSITION_GROUPS[value]
        return !!group && group.includes(pos)
      }
      case 'college':
        return (player.college || '').toLowerCase().includes(String(value).toLowerCase())
      case 'draftRound': {
        const round = player.draft_round
        const pick = player.draft_pick
        if (value === 'udfa') return round == null
        if (value === 'top10') return pick != null && pick <= 10
        if (value === 'top32') return pick != null && pick <= 32
        return round === Number(String(value).replace('round', ''))
      }
      case 'division':
        return player.division === value
      case 'era':
        return matchesEra(player, value)
      case 'stat':
        return matchesStat(tables, player.id, NFL_STAT_PRESETS[value])
      default:
        return false
    }
  }

  if (sport === 'mlb') {
    switch (type) {
      case 'team': {
        const target = mlbCanonicalCode(value)
        return playerTeamCodes(player).some((raw) => mlbCanonicalCode(raw) === target)
      }
      case 'position': {
        const pos = (player.position || '').toUpperCase()
        const group = MLB_POSITION_GROUPS[value]
        return !!group && group.includes(pos)
      }
      case 'college':
        return (player.college || '').toLowerCase().includes(String(value).toLowerCase())
      case 'division':
        return playerTeamCodes(player).some((raw) => MLB_TEAMS[mlbCanonicalCode(raw)]?.division === value)
      case 'league':
        return playerTeamCodes(player).some((raw) => MLB_TEAMS[mlbCanonicalCode(raw)]?.league === value)
      case 'era':
        return matchesEra(player, value)
      case 'country':
        return (player.birth_country || '').toLowerCase() === String(value).toLowerCase()
      case 'hallOfFame':
        return player.is_hall_of_fame === true
      case 'allStar': {
        const selections = player.all_star_selections ?? 0
        if (value === '5plus') return selections >= 5
        if (value === '10plus') return selections >= 10
        return selections >= 1
      }
      case 'stat':
        return matchesStat(tables, player.id, MLB_STAT_PRESETS[value])
      default:
        return false
    }
  }

  // nba
  switch (type) {
    case 'team': {
      const target = nbaCanonicalCode(value)
      return playerTeamCodes(player).some((raw) => nbaCanonicalCode(raw) === target)
    }
    case 'position': {
      const pos = (player.position || '').toUpperCase()
      const group = NBA_POSITION_GROUPS[value]
      return !!group && group.includes(pos)
    }
    case 'conference':
      return playerTeamCodes(player).some((raw) => NBA_TEAMS[nbaCanonicalCode(raw)]?.conference === value)
    case 'division':
      return playerTeamCodes(player).some((raw) => NBA_TEAMS[nbaCanonicalCode(raw)]?.division === value)
    case 'era':
      return matchesEra(player, value)
    case 'country':
      return (player.birth_country || '').toLowerCase() === String(value).toLowerCase()
    case 'allStar': {
      const selections = player.all_star_selections ?? 0
      if (value === '5plus') return selections >= 5
      if (value === '10plus') return selections >= 10
      return selections >= 1
    }
    case 'draft': {
      const round = player.draft_round
      if (value === 'round1') return round === 1
      if (value === 'round2') return round === 2
      if (value === 'undrafted') return round == null
      return false
    }
    case 'stat':
      return matchesStat(tables, player.id, NBA_STAT_PRESETS[value])
    default:
      return false
  }
}

export const GRID_PLAYER_FIELDS = {
  nfl: 'id, full_name, position, current_team, previous_teams, college, draft_round, draft_pick, division, is_active, season_first, season_last',
  mlb: 'id, full_name, position, current_team, previous_teams, college, birth_country, is_hall_of_fame, all_star_selections, is_active, season_first, season_last',
  nba: 'id, full_name, position, current_team, previous_teams, birth_country, draft_round, all_star_selections, is_active, season_first, season_last',
}

export const GRID_SCORING = { perSquare: 100, perfectBonus: 500 }
