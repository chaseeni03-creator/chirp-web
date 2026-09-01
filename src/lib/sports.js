// Central per-sport configuration: table names, player-search fields, Chirp
// Guess comparison attributes, stat groupings, and Lineup categories. Every
// game page reads from here instead of hardcoding NFL-specific column names,
// so adding a sport is "add an entry here," not "rewrite every page."

export const SPORTS = ['nfl', 'mlb', 'nba']

export const SPORT_META = {
  nfl: { label: 'NFL', emoji: '🏈', gamesTitle: 'Daily NFL Games' },
  mlb: { label: 'MLB', emoji: '⚾', gamesTitle: 'Daily MLB Games' },
  nba: { label: 'NBA', emoji: '🏀', gamesTitle: 'Daily NBA Games' },
}

// Era keys/labels, mirrored exactly from the Flutter app's NflEra/MlbEra/NbaEra
// enums (lib/features/games/models/*_era.dart) — Stat Line, Career Builder, and
// Progression all schedule a full era × difficulty matrix per day now, so the
// web pages must let the player pick both, same as the admin schedules them.
export const ERAS = {
  nfl: [
    { key: 'seventies', label: '1970s' },
    { key: 'eighties', label: '1980s' },
    { key: 'nineties', label: '1990s' },
    { key: 'twoThousands', label: '2000s' },
    { key: 'twentyTens', label: '2010s' },
    { key: 'allTime', label: 'All Time' },
  ],
  mlb: [
    { key: 'sixties', label: '1960s' },
    { key: 'seventies', label: '1970s' },
    { key: 'eighties', label: '1980s' },
    { key: 'nineties', label: '1990s' },
    { key: 'twoThousands', label: '2000s' },
    { key: 'twentyTens', label: '2010s' },
    { key: 'allTime', label: 'All Time' },
  ],
  nba: [
    { key: 'eighties', label: '1980s' },
    { key: 'nineties', label: '1990s' },
    { key: 'twoThousands', label: '2000s' },
    { key: 'twentyTens', label: '2010s' },
    { key: 'twentyTwenties', label: '2020s' },
    { key: 'allTime', label: 'All Time' },
  ],
}

export const TABLES = {
  nfl: {
    chirpGuessDaily: 'chirp_guess_daily',
    statLineDaily: 'stat_line_daily',
    careerBuilderDaily: 'career_builder_daily',
    progressionDaily: 'progression_daily',
    lineupDaily: 'lineup_daily',
    gridSchedule: 'grid_game_schedule',
    players: 'nfl_players',
    seasonStats: 'nfl_season_stats',
    careerStats: 'nfl_career_stats',
  },
  mlb: {
    chirpGuessDaily: 'mlb_chirp_guess_daily',
    statLineDaily: 'mlb_stat_line_daily',
    careerBuilderDaily: 'mlb_career_builder_daily',
    progressionDaily: 'mlb_progression_daily',
    lineupDaily: 'mlb_lineup_daily',
    gridSchedule: 'mlb_grid_schedule',
    players: 'mlb_players',
    seasonStats: 'mlb_season_stats',
    careerStats: 'mlb_career_stats',
  },
  nba: {
    chirpGuessDaily: 'nba_chirp_guess_daily',
    statLineDaily: 'nba_stat_line_daily',
    careerBuilderDaily: 'nba_career_builder_daily',
    progressionDaily: 'nba_progression_daily',
    lineupDaily: 'nba_lineup_daily',
    gridSchedule: 'nba_grid_schedule',
    players: 'nba_players',
    seasonStats: 'nba_season_stats',
    careerStats: 'nba_career_stats',
  },
}

// ── Player search (autocomplete input used by every game) ──────────────────

export const PLAYER_SEARCH_FIELDS = {
  nfl: 'id, full_name, position, current_team',
  mlb: 'id, full_name, position, current_team',
  nba: 'id, full_name, position, current_team',
}

// Chirp Guess field lists + tile logic now live in src/lib/chirpGuess.js,
// ported directly from the Flutter app's chirp_guess_models.dart so the
// comparison logic matches mobile exactly (team/position/conference/division
// each have real, sport-specific partial-credit rules that don't reduce to a
// generic "exact or numeric-threshold" scheme).

// ── Stat Line: progressive clue order per sport/position group ─────────────

function nflGroupFor(position) {
  if (position === 'QB') return 'QB'
  if (position === 'RB' || position === 'FB') return 'RB'
  if (['WR', 'TE'].includes(position)) return 'REC'
  return 'DEF'
}

export const STAT_LINE_CONFIG = {
  nfl: {
    groupFor: nflGroupFor,
    clues: {
      QB: [['team', 'Team'], ['games_played', 'Games'], ['passing_completions', 'Completions'], ['passing_attempts', 'Attempts'], ['passing_yards', 'Pass Yards'], ['passing_touchdowns', 'Pass TDs'], ['interceptions_thrown', 'INTs'], ['passer_rating', 'Rating']],
      RB: [['team', 'Team'], ['games_played', 'Games'], ['rushing_attempts', 'Carries'], ['rushing_yards', 'Rush Yards'], ['rushing_touchdowns', 'Rush TDs'], ['receptions', 'Receptions'], ['receiving_yards', 'Rec Yards']],
      REC: [['team', 'Team'], ['games_played', 'Games'], ['targets', 'Targets'], ['receptions', 'Receptions'], ['receiving_yards', 'Rec Yards'], ['receiving_touchdowns', 'Rec TDs'], ['yards_per_reception', 'Yds/Rec']],
      DEF: [['team', 'Team'], ['games_played', 'Games'], ['tackles', 'Tackles'], ['sacks', 'Sacks'], ['interceptions_caught', 'INTs'], ['forced_fumbles', 'Forced Fum'], ['passes_defended', 'Pass Def']],
    },
  },
  mlb: {
    groupFor: (positionGroup) => (positionGroup === 'Pitcher' ? 'Pitcher' : 'Batter'),
    clues: {
      Batter: [['team', 'Team'], ['games_played', 'Games'], ['at_bats', 'At Bats'], ['hits', 'Hits'], ['home_runs', 'HR'], ['rbi', 'RBI'], ['stolen_bases', 'SB'], ['batting_average', 'AVG']],
      Pitcher: [['team', 'Team'], ['games_pitched', 'Games'], ['games_started', 'Starts'], ['wins', 'Wins'], ['losses', 'Losses'], ['era', 'ERA'], ['strikeouts_pitched', 'Ks'], ['whip', 'WHIP']],
    },
  },
  nba: {
    groupFor: () => 'ALL',
    clues: {
      ALL: [['team', 'Team'], ['games_played', 'Games'], ['points_per_game', 'PPG'], ['rebounds_per_game', 'RPG'], ['assists_per_game', 'APG'], ['steals_per_game', 'SPG'], ['blocks_per_game', 'BPG'], ['field_goal_percentage', 'FG%']],
    },
  },
}

// ── Career Builder / Progression: primary stat + display keys per group ────

export const CAREER_STAT_CONFIG = {
  nfl: {
    groupFor: nflGroupFor,
    primary: { QB: 'passing_yards', RB: 'rushing_yards', REC: 'receiving_yards', DEF: 'tackles' },
    primaryLabel: { QB: 'Pass Yds', RB: 'Rush Yds', REC: 'Rec Yds', DEF: 'Tackles' },
    display: {
      QB: [['passing_yards', 'Pass Yds'], ['passing_touchdowns', 'Pass TD'], ['games_played', 'Games']],
      RB: [['rushing_yards', 'Rush Yds'], ['rushing_touchdowns', 'Rush TD'], ['games_played', 'Games']],
      REC: [['receiving_yards', 'Rec Yds'], ['receiving_touchdowns', 'Rec TD'], ['games_played', 'Games']],
      DEF: [['tackles', 'Tackles'], ['sacks', 'Sacks'], ['games_played', 'Games']],
    },
  },
  mlb: {
    groupFor: (positionGroup) => (positionGroup === 'Pitcher' ? 'Pitcher' : 'Batter'),
    primary: { Batter: 'home_runs', Pitcher: 'strikeouts_pitched' },
    primaryLabel: { Batter: 'HR', Pitcher: 'Ks' },
    display: {
      Batter: [['hits', 'Hits'], ['home_runs', 'HR'], ['rbi', 'RBI']],
      Pitcher: [['wins', 'Wins'], ['era', 'ERA'], ['strikeouts_pitched', 'Ks']],
    },
  },
  nba: {
    groupFor: () => 'ALL',
    primary: { ALL: 'points_per_game' },
    primaryLabel: { ALL: 'PPG' },
    display: {
      ALL: [['points_per_game', 'PPG'], ['rebounds_per_game', 'RPG'], ['assists_per_game', 'APG']],
    },
  },
}

// ── More vs Less: one comparable career stat per sport ──────────────────────

export const MORE_OR_LESS_CONFIG = {
  nfl: {
    groups: {
      QB: { positions: ['QB'], statKey: 'passing_yards', label: 'Career Passing Yards' },
      RB: { positions: ['RB', 'FB'], statKey: 'rushing_yards', label: 'Career Rushing Yards' },
      REC: { positions: ['WR', 'TE'], statKey: 'receiving_yards', label: 'Career Receiving Yards' },
      DEF: { positions: ['LB', 'DB', 'CB', 'S', 'DE', 'DT', 'DL'], statKey: 'tackles', label: 'Career Tackles' },
    },
  },
  mlb: {
    groups: {
      Batter: { positionGroup: 'Batter', statKey: 'home_runs', label: 'Career Home Runs' },
      Pitcher: { positionGroup: 'Pitcher', statKey: 'strikeouts_pitched', label: 'Career Strikeouts' },
    },
  },
  nba: {
    groups: {
      ALL: { positions: null, statKey: 'points', label: 'Career Points' },
    },
  },
}

// The Lineup's category lists now live in src/lib/lineup.js (ported directly
// from lineup_game.dart / mlb_lineup_game.dart / nba_lineup_game.dart), not
// here — the old hardcoded lists above had a wrong MLB column (walks instead
// of runs) and fabricated NBA categories that don't exist on mobile.

// ── Chirp Grid: team -> league/division lookups for the 'league'/'division' ─
// category types (these are real-world facts, not derived from any column).

export const MLB_TEAM_LEAGUE = {
  BAL: 'AL', BOS: 'AL', NYY: 'AL', TBR: 'AL', TOR: 'AL',
  CHW: 'AL', CLE: 'AL', DET: 'AL', KCR: 'AL', MIN: 'AL',
  HOU: 'AL', LAA: 'AL', OAK: 'AL', SEA: 'AL', TEX: 'AL',
  ATL: 'NL', MIA: 'NL', NYM: 'NL', PHI: 'NL', WSN: 'NL',
  CHC: 'NL', CIN: 'NL', MIL: 'NL', PIT: 'NL', STL: 'NL',
  ARI: 'NL', COL: 'NL', LAD: 'NL', SDP: 'NL', SFG: 'NL',
}

export const NBA_TEAM_DIVISION = {
  BOS: 'Atlantic', BRK: 'Atlantic', NYK: 'Atlantic', PHI: 'Atlantic', TOR: 'Atlantic',
  CHI: 'Central', CLE: 'Central', DET: 'Central', IND: 'Central', MIL: 'Central',
  ATL: 'Southeast', CHA: 'Southeast', MIA: 'Southeast', ORL: 'Southeast', WAS: 'Southeast',
  DEN: 'Northwest', MIN: 'Northwest', OKC: 'Northwest', POR: 'Northwest', UTA: 'Northwest',
  GSW: 'Pacific', LAC: 'Pacific', LAL: 'Pacific', PHX: 'Pacific', SAC: 'Pacific',
  DAL: 'Southwest', HOU: 'Southwest', MEM: 'Southwest', NOP: 'Southwest', SAS: 'Southwest',
}
