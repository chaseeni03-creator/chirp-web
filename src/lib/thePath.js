// "The Path" scoring — pure functions.
//
// This formula must be kept in sync by hand with its Dart twin at
// lib/models/path_game.dart in chirp_sports — no code sharing across the
// two repos/languages. If you change the hint math here, change it there
// too.
//
// Binary pass/fail per player (not a decaying-per-wrong-guess score like
// Progression's): a correct guess on attempt 1, 2, or 3 earns the same
// hint-adjusted cap; only the 3rd wrong guess zeroes a player. Deductions
// apply at the moment a hint is used, not retroactively.

export function maxScoreForHints({ statsRevealed, positionRevealed }) {
  let max = 1000
  if (statsRevealed) max *= 0.5
  if (positionRevealed) max *= 0.75
  return Math.round(max)
}

export function scoreForPlayer({ solved, statsRevealed, positionRevealed }) {
  if (!solved) return 0
  return maxScoreForHints({ statsRevealed, positionRevealed })
}

/** Aggregates 5 per-player results into the values submitted to the leaderboard/badges. */
export function summarizeSession(perPlayer) {
  const totalScore = perPlayer.reduce((sum, p) => sum + p.score, 0)
  const correctCount = perPlayer.filter((p) => p.solved).length
  const isPerfect = perPlayer.every((p) => p.solved && p.guessesUsed === 1 && !p.statsRevealed && !p.positionRevealed)
  return {
    totalScore,
    correctCount,
    isPerfect,
    accuracy: perPlayer.length ? correctCount / perPlayer.length : 0,
  }
}

// All values The Path stores per stat are per-game averages (see
// derive_path_players.js / derive_mlb_path_players.js /
// derive_nba_path_players.js), not career/stint totals — the "/G" suffix
// says so explicitly rather than relying on the decimal to imply it.
const STAT_LABELS = {
  passing_yards: 'Pass Yds/G',
  passing_touchdowns: 'Pass TD/G',
  passing_attempts: 'Att/G',
  passing_completions: 'Comp/G',
  interceptions_thrown: 'INT/G',
  rushing_yards: 'Rush Yds/G',
  rushing_touchdowns: 'Rush TD/G',
  rushing_attempts: 'Carries/G',
  receiving_yards: 'Rec Yds/G',
  receiving_touchdowns: 'Rec TD/G',
  receptions: 'Rec/G',
  targets: 'Tgt/G',
  tackles: 'Tackles/G',
  sacks: 'Sacks/G',
  interceptions_caught: 'INT/G',
  passes_defended: 'PD/G',
  // MLB (derive_mlb_path_players.js)
  at_bats: 'AB/G',
  home_runs: 'HR/G',
  rbi: 'RBI/G',
  games_started: 'GS/G',
  wins: 'W/G',
  losses: 'L/G',
  strikeouts_pitched: 'K/G',
  // NBA (derive_nba_path_players.js)
  total_points: 'PPG',
  total_rebounds: 'RPG',
  total_assists: 'APG',
}

export function statLabel(key) {
  return STAT_LABELS[key] ?? key
}
