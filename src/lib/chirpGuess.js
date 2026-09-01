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

const MLB_TEAMS = {
  NYY: { league: 'AL', division: 'AL East' }, BOS: { league: 'AL', division: 'AL East' },
  TOR: { league: 'AL', division: 'AL East' }, TB: { league: 'AL', division: 'AL East' },
  BAL: { league: 'AL', division: 'AL East' },
  CWS: { league: 'AL', division: 'AL Central' }, CLE: { league: 'AL', division: 'AL Central' },
  DET: { league: 'AL', division: 'AL Central' }, KC: { league: 'AL', division: 'AL Central' },
  MIN: { league: 'AL', division: 'AL Central' },
  HOU: { league: 'AL', division: 'AL West' }, LAA: { league: 'AL', division: 'AL West' },
  OAK: { league: 'AL', division: 'AL West' }, SEA: { league: 'AL', division: 'AL West' },
  TEX: { league: 'AL', division: 'AL West' },
  ATL: { league: 'NL', division: 'NL East' }, MIA: { league: 'NL', division: 'NL East' },
  NYM: { league: 'NL', division: 'NL East' }, PHI: { league: 'NL', division: 'NL East' },
  WSH: { league: 'NL', division: 'NL East' },
  CHC: { league: 'NL', division: 'NL Central' }, CIN: { league: 'NL', division: 'NL Central' },
  MIL: { league: 'NL', division: 'NL Central' }, PIT: { league: 'NL', division: 'NL Central' },
  STL: { league: 'NL', division: 'NL Central' },
  ARI: { league: 'NL', division: 'NL West' }, COL: { league: 'NL', division: 'NL West' },
  LAD: { league: 'NL', division: 'NL West' }, SD: { league: 'NL', division: 'NL West' },
  SF: { league: 'NL', division: 'NL West' },
}

const MLB_TEAM_ALIASES = {
  NYA: 'NYY', CHA: 'CWS', CHW: 'CWS', KCA: 'KC', KCR: 'KC', TBA: 'TB', TBR: 'TB',
  ANA: 'LAA', CAL: 'LAA', ATH: 'OAK', NYN: 'NYM', WAS: 'WSH', MON: 'WSH', FLA: 'MIA',
  CHN: 'CHC', SLN: 'STL', LAN: 'LAD', BRO: 'LAD', SDN: 'SD', SFN: 'SF', NYG: 'SF',
}

export function mlbResolveTeam(code) {
  if (!code) return null
  const canon = MLB_TEAM_ALIASES[code.toUpperCase()] || code.toUpperCase()
  return MLB_TEAMS[canon] || null
}

const NBA_TEAMS = {
  BOS: { conference: 'Eastern', division: 'Atlantic' }, BRK: { conference: 'Eastern', division: 'Atlantic' },
  NYK: { conference: 'Eastern', division: 'Atlantic' }, PHI: { conference: 'Eastern', division: 'Atlantic' },
  TOR: { conference: 'Eastern', division: 'Atlantic' },
  CHI: { conference: 'Eastern', division: 'Central' }, CLE: { conference: 'Eastern', division: 'Central' },
  DET: { conference: 'Eastern', division: 'Central' }, IND: { conference: 'Eastern', division: 'Central' },
  MIL: { conference: 'Eastern', division: 'Central' },
  ATL: { conference: 'Eastern', division: 'Southeast' }, CHO: { conference: 'Eastern', division: 'Southeast' },
  MIA: { conference: 'Eastern', division: 'Southeast' }, ORL: { conference: 'Eastern', division: 'Southeast' },
  WAS: { conference: 'Eastern', division: 'Southeast' },
  DEN: { conference: 'Western', division: 'Northwest' }, MIN: { conference: 'Western', division: 'Northwest' },
  OKC: { conference: 'Western', division: 'Northwest' }, POR: { conference: 'Western', division: 'Northwest' },
  UTA: { conference: 'Western', division: 'Northwest' },
  GSW: { conference: 'Western', division: 'Pacific' }, LAC: { conference: 'Western', division: 'Pacific' },
  LAL: { conference: 'Western', division: 'Pacific' }, PHO: { conference: 'Western', division: 'Pacific' },
  SAC: { conference: 'Western', division: 'Pacific' },
  DAL: { conference: 'Western', division: 'Southwest' }, HOU: { conference: 'Western', division: 'Southwest' },
  MEM: { conference: 'Western', division: 'Southwest' }, NOP: { conference: 'Western', division: 'Southwest' },
  SAS: { conference: 'Western', division: 'Southwest' },
}

const NBA_TEAM_ALIASES = {
  MNL: 'LAL', FTW: 'DET', ROC: 'SAC', CIN: 'SAC', KCO: 'SAC', KCK: 'SAC', SYR: 'PHI',
  TRI: 'ATL', MLH: 'ATL', STL: 'ATL', CHP: 'WAS', CHZ: 'WAS', BAL: 'WAS', CAP: 'WAS',
  WSB: 'WAS', PHW: 'GSW', SFW: 'GSW', SDR: 'HOU', BUF: 'LAC', SDC: 'LAC', SEA: 'OKC',
  NJA: 'BRK', NYA: 'BRK', NYN: 'BRK', NJN: 'BRK', VAN: 'MEM', NOK: 'NOP', NOH: 'NOP',
  CHH: 'CHO', CHA: 'CHO', DNR: 'DEN', DLC: 'SAS', SAA: 'SAS',
}

export function nbaResolveTeam(code) {
  if (!code) return null
  const canon = NBA_TEAM_ALIASES[code.toUpperCase()] || code.toUpperCase()
  return NBA_TEAMS[canon] || null
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
