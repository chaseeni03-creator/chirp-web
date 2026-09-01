// Chirp Guess tile logic, ported 1:1 from the Flutter app's
// lib/features/games/models/chirp_guess_models.dart (ChirpGuessPlayer.compare
// + per-tile builders). Field lists mirror exactly what the mobile factories
// (fromNflPlayers/fromMlbPlayers/fromNbaPlayers) read.

export const CHIRP_GUESS_FIELDS = {
  nfl: 'id, full_name, position, current_team, previous_teams, conference, division, jersey_number, height, weight, birth_date, draft_round, college',
  mlb: 'id, full_name, position, position_group, current_team, previous_teams, bats, height, weight, birth_country, is_hall_of_fame, all_star_selections, season_first, season_last',
  nba: 'id, full_name, position, current_team, previous_teams, draft_round, height, weight, birth_country, season_first, season_last',
}

export const CHIRP_GUESS_HEADERS = {
  nfl: ['TEAM', 'CONF', 'DIV', '#', 'POS', 'HT', 'WT', 'AGE', 'RND', 'SCH'],
  mlb: ['POS', 'LG', 'DIV', 'ERA', 'BATS', 'HT', 'WT', 'CTY', 'HOF', 'AS'],
  nba: ['POS', 'CONF', 'DIV', 'ERA', 'RND', 'HT', 'WT', 'CTY'],
}

// ── Team tables (league/division/conference), ported from
// lib/core/constants/mlb_teams.dart and nba_teams.dart, aliases included so
// historical/Retrosheet-style codes still resolve. ────────────────────────

export const MLB_TEAMS = {
  NYY: { league: 'AL', division: 'AL East', fullName: 'New York Yankees' }, BOS: { league: 'AL', division: 'AL East', fullName: 'Boston Red Sox' },
  TOR: { league: 'AL', division: 'AL East', fullName: 'Toronto Blue Jays' }, TB: { league: 'AL', division: 'AL East', fullName: 'Tampa Bay Rays' },
  BAL: { league: 'AL', division: 'AL East', fullName: 'Baltimore Orioles' },
  CWS: { league: 'AL', division: 'AL Central', fullName: 'Chicago White Sox' }, CLE: { league: 'AL', division: 'AL Central', fullName: 'Cleveland Guardians' },
  DET: { league: 'AL', division: 'AL Central', fullName: 'Detroit Tigers' }, KC: { league: 'AL', division: 'AL Central', fullName: 'Kansas City Royals' },
  MIN: { league: 'AL', division: 'AL Central', fullName: 'Minnesota Twins' },
  HOU: { league: 'AL', division: 'AL West', fullName: 'Houston Astros' }, LAA: { league: 'AL', division: 'AL West', fullName: 'Los Angeles Angels' },
  OAK: { league: 'AL', division: 'AL West', fullName: 'Oakland Athletics' }, SEA: { league: 'AL', division: 'AL West', fullName: 'Seattle Mariners' },
  TEX: { league: 'AL', division: 'AL West', fullName: 'Texas Rangers' },
  ATL: { league: 'NL', division: 'NL East', fullName: 'Atlanta Braves' }, MIA: { league: 'NL', division: 'NL East', fullName: 'Miami Marlins' },
  NYM: { league: 'NL', division: 'NL East', fullName: 'New York Mets' }, PHI: { league: 'NL', division: 'NL East', fullName: 'Philadelphia Phillies' },
  WSH: { league: 'NL', division: 'NL East', fullName: 'Washington Nationals' },
  CHC: { league: 'NL', division: 'NL Central', fullName: 'Chicago Cubs' }, CIN: { league: 'NL', division: 'NL Central', fullName: 'Cincinnati Reds' },
  MIL: { league: 'NL', division: 'NL Central', fullName: 'Milwaukee Brewers' }, PIT: { league: 'NL', division: 'NL Central', fullName: 'Pittsburgh Pirates' },
  STL: { league: 'NL', division: 'NL Central', fullName: 'St. Louis Cardinals' },
  ARI: { league: 'NL', division: 'NL West', fullName: 'Arizona Diamondbacks' }, COL: { league: 'NL', division: 'NL West', fullName: 'Colorado Rockies' },
  LAD: { league: 'NL', division: 'NL West', fullName: 'Los Angeles Dodgers' }, SD: { league: 'NL', division: 'NL West', fullName: 'San Diego Padres' },
  SF: { league: 'NL', division: 'NL West', fullName: 'San Francisco Giants' },
}

const MLB_TEAM_ALIASES = {
  NYA: 'NYY', CHA: 'CWS', CHW: 'CWS', KCA: 'KC', KCR: 'KC', TBA: 'TB', TBR: 'TB',
  ANA: 'LAA', CAL: 'LAA', ATH: 'OAK', NYN: 'NYM', WAS: 'WSH', MON: 'WSH', FLA: 'MIA',
  CHN: 'CHC', SLN: 'STL', LAN: 'LAD', BRO: 'LAD', SDN: 'SD', SFN: 'SF', NYG: 'SF',
}

export function mlbCanonicalCode(code) {
  if (!code) return null
  return MLB_TEAM_ALIASES[code.toUpperCase()] || code.toUpperCase()
}

export function mlbResolveTeam(code) {
  const canon = mlbCanonicalCode(code)
  return canon ? MLB_TEAMS[canon] || null : null
}

/** Every raw Lahman teamID belonging to the same franchise as `canonCode` — mlb_season_stats.team stores the raw code, never the modern one. */
function mlbRawCodesFor(canonCode) {
  const raws = Object.entries(MLB_TEAM_ALIASES).filter(([, v]) => v === canonCode).map(([k]) => k)
  return [...raws, canonCode]
}

/** Team/division/league -> the mlb_season_stats.team (raw) codes that scope covers (used by The Lineup). */
export function mlbTeamCodesForScope(type, value) {
  if (type === 'team') {
    const canon = MLB_TEAM_ALIASES[value.toUpperCase()] || value.toUpperCase()
    return mlbRawCodesFor(canon)
  }
  if (type === 'division') return Object.entries(MLB_TEAMS).filter(([, t]) => t.division === value).flatMap(([code]) => mlbRawCodesFor(code))
  if (type === 'league') return Object.entries(MLB_TEAMS).filter(([, t]) => t.league === value).flatMap(([code]) => mlbRawCodesFor(code))
  return []
}

export const NBA_TEAMS = {
  BOS: { conference: 'Eastern', division: 'Atlantic', fullName: 'Boston Celtics' }, BRK: { conference: 'Eastern', division: 'Atlantic', fullName: 'Brooklyn Nets' },
  NYK: { conference: 'Eastern', division: 'Atlantic', fullName: 'New York Knicks' }, PHI: { conference: 'Eastern', division: 'Atlantic', fullName: 'Philadelphia 76ers' },
  TOR: { conference: 'Eastern', division: 'Atlantic', fullName: 'Toronto Raptors' },
  CHI: { conference: 'Eastern', division: 'Central', fullName: 'Chicago Bulls' }, CLE: { conference: 'Eastern', division: 'Central', fullName: 'Cleveland Cavaliers' },
  DET: { conference: 'Eastern', division: 'Central', fullName: 'Detroit Pistons' }, IND: { conference: 'Eastern', division: 'Central', fullName: 'Indiana Pacers' },
  MIL: { conference: 'Eastern', division: 'Central', fullName: 'Milwaukee Bucks' },
  ATL: { conference: 'Eastern', division: 'Southeast', fullName: 'Atlanta Hawks' }, CHO: { conference: 'Eastern', division: 'Southeast', fullName: 'Charlotte Hornets' },
  MIA: { conference: 'Eastern', division: 'Southeast', fullName: 'Miami Heat' }, ORL: { conference: 'Eastern', division: 'Southeast', fullName: 'Orlando Magic' },
  WAS: { conference: 'Eastern', division: 'Southeast', fullName: 'Washington Wizards' },
  DEN: { conference: 'Western', division: 'Northwest', fullName: 'Denver Nuggets' }, MIN: { conference: 'Western', division: 'Northwest', fullName: 'Minnesota Timberwolves' },
  OKC: { conference: 'Western', division: 'Northwest', fullName: 'Oklahoma City Thunder' }, POR: { conference: 'Western', division: 'Northwest', fullName: 'Portland Trail Blazers' },
  UTA: { conference: 'Western', division: 'Northwest', fullName: 'Utah Jazz' },
  GSW: { conference: 'Western', division: 'Pacific', fullName: 'Golden State Warriors' }, LAC: { conference: 'Western', division: 'Pacific', fullName: 'Los Angeles Clippers' },
  LAL: { conference: 'Western', division: 'Pacific', fullName: 'Los Angeles Lakers' }, PHO: { conference: 'Western', division: 'Pacific', fullName: 'Phoenix Suns' },
  SAC: { conference: 'Western', division: 'Pacific', fullName: 'Sacramento Kings' },
  DAL: { conference: 'Western', division: 'Southwest', fullName: 'Dallas Mavericks' }, HOU: { conference: 'Western', division: 'Southwest', fullName: 'Houston Rockets' },
  MEM: { conference: 'Western', division: 'Southwest', fullName: 'Memphis Grizzlies' }, NOP: { conference: 'Western', division: 'Southwest', fullName: 'New Orleans Pelicans' },
  SAS: { conference: 'Western', division: 'Southwest', fullName: 'San Antonio Spurs' },
}

const NBA_TEAM_ALIASES = {
  MNL: 'LAL', FTW: 'DET', ROC: 'SAC', CIN: 'SAC', KCO: 'SAC', KCK: 'SAC', SYR: 'PHI',
  TRI: 'ATL', MLH: 'ATL', STL: 'ATL', CHP: 'WAS', CHZ: 'WAS', BAL: 'WAS', CAP: 'WAS',
  WSB: 'WAS', PHW: 'GSW', SFW: 'GSW', SDR: 'HOU', BUF: 'LAC', SDC: 'LAC', SEA: 'OKC',
  NJA: 'BRK', NYA: 'BRK', NYN: 'BRK', NJN: 'BRK', VAN: 'MEM', NOK: 'NOP', NOH: 'NOP',
  CHH: 'CHO', CHA: 'CHO', DNR: 'DEN', DLC: 'SAS', SAA: 'SAS',
}

export function nbaCanonicalCode(code) {
  if (!code) return null
  return NBA_TEAM_ALIASES[code.toUpperCase()] || code.toUpperCase()
}

export function nbaResolveTeam(code) {
  const canon = nbaCanonicalCode(code)
  return canon ? NBA_TEAMS[canon] || null : null
}

/** Every raw historical code belonging to the same franchise as `canonCode` — nba_season_stats.team stores the raw per-era code. */
function nbaRawCodesFor(canonCode) {
  const raws = Object.entries(NBA_TEAM_ALIASES).filter(([, v]) => v === canonCode).map(([k]) => k)
  return [...raws, canonCode]
}

/** Team/division/conference -> the nba_season_stats.team (raw) codes that scope covers (used by The Lineup). */
export function nbaTeamCodesForScope(type, value) {
  if (type === 'team') {
    const canon = NBA_TEAM_ALIASES[value.toUpperCase()] || value.toUpperCase()
    return nbaRawCodesFor(canon)
  }
  if (type === 'division') return Object.entries(NBA_TEAMS).filter(([, t]) => t.division === value).flatMap(([code]) => nbaRawCodesFor(code))
  if (type === 'conference') return Object.entries(NBA_TEAMS).filter(([, t]) => t.conference === value).flatMap(([code]) => nbaRawCodesFor(code))
  return []
}

// ── Generic tile helpers ─────────────────────────────────────────────────

function arrowFor(guess, mystery) {
  if (guess == null || mystery == null) return null
  if (mystery > guess) return 'up'
  if (mystery < guess) return 'down'
  return null
}

/** Mirrors Dart's _numericColor: exact match required for green. */
function numericColor(guess, mystery, threshold) {
  if (guess == null || mystery == null) return 'grey'
  if (guess === mystery) return 'green'
  if (Math.abs(guess - mystery) <= threshold) return 'orange'
  return 'grey'
}

/** Mirrors the height/weight/all-star pattern: a range counts as green, no exact-match requirement. */
function rangeColor(guess, mystery, greenMax, orangeMax) {
  if (guess == null || mystery == null) return 'grey'
  const diff = Math.abs(guess - mystery)
  if (diff <= greenMax) return 'green'
  if (diff <= orangeMax) return 'orange'
  return 'grey'
}

function exactTile(label, guessVal, mysteryVal) {
  const color = guessVal != null && guessVal === mysteryVal ? 'green' : 'grey'
  return { label, value: guessVal ?? '?', color, arrow: null }
}

function parseHeightInches(value) {
  if (value == null) return null
  if (typeof value === 'number') return value
  const n = parseInt(value, 10)
  return Number.isNaN(n) ? null : n
}

function formatHeightInches(inches) {
  if (inches == null) return '?'
  return `${Math.floor(inches / 12)}'${inches % 12}"`
}

function ageFromBirthDate(birthDate) {
  if (!birthDate) return null
  const dob = new Date(birthDate)
  if (Number.isNaN(dob.getTime())) return null
  const now = new Date()
  let age = now.getFullYear() - dob.getFullYear()
  if (now.getMonth() < dob.getMonth() || (now.getMonth() === dob.getMonth() && now.getDate() < dob.getDate())) age--
  return age
}

function heightTile(label, guessRaw, mysteryRaw) {
  const gh = parseHeightInches(guessRaw)
  const mh = parseHeightInches(mysteryRaw)
  return { label, value: formatHeightInches(gh), color: rangeColor(gh, mh, 1, 3), arrow: arrowFor(gh, mh) }
}

function weightTile(label, guessVal, mysteryVal, greenMax, orangeMax) {
  return {
    label,
    value: guessVal != null ? `${guessVal} lbs` : '?',
    color: rangeColor(guessVal, mysteryVal, greenMax, orangeMax),
    arrow: arrowFor(guessVal, mysteryVal),
  }
}

/** Draft round: UDFA (null) counts as the "highest" possible round. */
function draftRoundTile(guessVal, mysteryVal) {
  if (guessVal == null || mysteryVal == null) {
    const color = guessVal == null && mysteryVal == null ? 'green' : 'grey'
    let arrow = null
    if (guessVal == null && mysteryVal != null) arrow = 'down'
    if (guessVal != null && mysteryVal == null) arrow = 'up'
    return { label: 'RND', value: guessVal ?? 'UDFA', color, arrow }
  }
  return { label: 'RND', value: String(guessVal), color: numericColor(guessVal, mysteryVal, 1), arrow: arrowFor(guessVal, mysteryVal) }
}

/** "Era"/career-span tile: green if [seasonFirst, seasonLast] ranges overlap, orange if the gap is <=5 years. */
function careerSpanTile(gf, gl, mf, ml) {
  if (gf == null || gl == null || mf == null || ml == null) return { label: 'ERA', value: '?', color: 'grey', arrow: null }
  const overlaps = gf <= ml && gl >= mf
  const gap = gf > ml ? gf - ml : mf > gl ? mf - gl : 0
  const color = overlaps ? 'green' : gap <= 5 ? 'orange' : 'grey'
  let arrow = null
  if (mf > gl) arrow = 'up'
  if (ml < gf) arrow = 'down'
  return { label: 'ERA', value: `${gf}-${gl}`, color, arrow }
}

function hofTile(guessHof, mysteryHof) {
  const gh = guessHof ?? false
  const mh = mysteryHof ?? false
  return { label: 'HOF', value: gh ? 'Yes' : 'No', color: gh === mh ? 'green' : 'orange', arrow: null }
}

// ── NFL ──────────────────────────────────────────────────────────────────

const NFL_POSITION_GROUPS = {
  'Pass catchers': ['WR', 'TE', 'FB'],
  Backfield: ['RB', 'FB', 'HB'],
  'Offensive line': ['OT', 'OG', 'C', 'G', 'T'],
  'Edge rushers': ['DE', 'OLB', 'LB'],
  'Interior DL': ['DT', 'NT', 'DL'],
  Secondary: ['CB', 'S', 'DB', 'FS', 'SS'],
  Specialists: ['K', 'P', 'LS'],
}

function nflGroupsFor(position) {
  const p = (position || '').toUpperCase()
  return Object.entries(NFL_POSITION_GROUPS).filter(([, list]) => list.includes(p)).map(([name]) => name)
}

function nflTeamTile(g, m) {
  const gPrev = g.previous_teams || []
  const mPrev = m.previous_teams || []
  let color
  if (g.current_team != null && g.current_team === m.current_team) color = 'green'
  else if (m.current_team != null && gPrev.includes(m.current_team)) color = 'orange'
  else if (g.current_team != null && mPrev.includes(g.current_team)) color = 'orange'
  else color = 'grey'
  return { label: 'TEAM', value: g.current_team ?? '?', color, arrow: null }
}

function nflPositionTile(g, m) {
  let color
  if (g.position && m.position && g.position.toUpperCase() === m.position.toUpperCase()) color = 'green'
  else if (g.position && m.position && nflGroupsFor(g.position).some((grp) => nflGroupsFor(m.position).includes(grp))) color = 'orange'
  else color = 'grey'
  return { label: 'POS', value: g.position ?? '?', color, arrow: null }
}

export function compareNfl(g, m) {
  return [
    nflTeamTile(g, m),
    { label: 'CONF', value: g.conference ?? '?', color: g.conference != null && g.conference === m.conference ? 'green' : 'grey', arrow: null },
    (() => {
      let color
      if (g.division != null && g.division === m.division) color = 'green'
      else if (g.conference != null && g.conference === m.conference) color = 'orange'
      else color = 'grey'
      return { label: 'DIV', value: g.division ?? '?', color, arrow: null }
    })(),
    { label: '#', value: g.jersey_number ?? '?', color: numericColor(g.jersey_number, m.jersey_number, 5), arrow: arrowFor(g.jersey_number, m.jersey_number) },
    nflPositionTile(g, m),
    heightTile('HT', g.height, m.height),
    weightTile('WT', g.weight, m.weight, 10, 25),
    (() => {
      const ga = ageFromBirthDate(g.birth_date)
      const ma = ageFromBirthDate(m.birth_date)
      return { label: 'AGE', value: ga ?? '?', color: numericColor(ga, ma, 2), arrow: arrowFor(ga, ma) }
    })(),
    draftRoundTile(g.draft_round, m.draft_round),
    exactTile('SCH', g.college, m.college),
  ]
}

// ── MLB ──────────────────────────────────────────────────────────────────

function mlbPositionTile(g, m) {
  let color
  if (g.position != null && g.position === m.position) color = 'green'
  else if (g.position_group != null && g.position_group === m.position_group) color = 'orange'
  else color = 'grey'
  return { label: 'POS', value: g.position ?? '?', color, arrow: null }
}

export function compareMlb(g, m) {
  const gTeam = mlbResolveTeam(g.current_team)
  const mTeam = mlbResolveTeam(m.current_team)
  return [
    mlbPositionTile(g, m),
    { label: 'LG', value: gTeam?.league ?? '?', color: gTeam?.league != null && gTeam.league === mTeam?.league ? 'green' : 'grey', arrow: null },
    (() => {
      let color
      if (gTeam?.division != null && gTeam.division === mTeam?.division) color = 'green'
      else if (gTeam?.league != null && gTeam.league === mTeam?.league) color = 'orange'
      else color = 'grey'
      return { label: 'DIV', value: gTeam?.division ?? '?', color, arrow: null }
    })(),
    careerSpanTile(g.season_first, g.season_last, m.season_first, m.season_last),
    exactTile('BATS', g.bats, m.bats),
    heightTile('HT', g.height, m.height),
    weightTile('WT', g.weight, m.weight, 10, 25),
    exactTile('CTY', g.birth_country, m.birth_country),
    hofTile(g.is_hall_of_fame, m.is_hall_of_fame),
    { label: 'AS', value: g.all_star_selections ?? '0', color: rangeColor(g.all_star_selections, m.all_star_selections, 2, 5), arrow: arrowFor(g.all_star_selections, m.all_star_selections) },
  ]
}

// ── NBA ──────────────────────────────────────────────────────────────────

function nbaPositionTile(g, m) {
  let color
  if (g.position && m.position && g.position === m.position) color = 'green'
  else if (g.position && m.position) {
    const gSet = new Set(g.position.split('-'))
    const mSet = new Set(m.position.split('-'))
    color = [...gSet].some((x) => mSet.has(x)) ? 'orange' : 'grey'
  } else color = 'grey'
  return { label: 'POS', value: g.position ?? '?', color, arrow: null }
}

export function compareNba(g, m) {
  const gTeam = nbaResolveTeam(g.current_team)
  const mTeam = nbaResolveTeam(m.current_team)
  return [
    nbaPositionTile(g, m),
    { label: 'CONF', value: gTeam?.conference ?? '?', color: gTeam?.conference != null && gTeam.conference === mTeam?.conference ? 'green' : 'grey', arrow: null },
    (() => {
      let color
      if (gTeam?.division != null && gTeam.division === mTeam?.division) color = 'green'
      else if (gTeam?.conference != null && gTeam.conference === mTeam?.conference) color = 'orange'
      else color = 'grey'
      return { label: 'DIV', value: gTeam?.division ?? '?', color, arrow: null }
    })(),
    careerSpanTile(g.season_first, g.season_last, m.season_first, m.season_last),
    draftRoundTile(g.draft_round, m.draft_round),
    heightTile('HT', g.height, m.height),
    weightTile('WT', g.weight, m.weight, 15, 30),
    exactTile('CTY', g.birth_country, m.birth_country),
  ]
}

export function compareChirpGuess(sport, guess, mystery) {
  if (sport === 'mlb') return compareMlb(guess, mystery)
  if (sport === 'nba') return compareNba(guess, mystery)
  return compareNfl(guess, mystery)
}
