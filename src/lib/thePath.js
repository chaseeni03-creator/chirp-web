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

const STAT_LABELS = {
  passing_yards: 'Pass Yds',
  passing_touchdowns: 'Pass TD',
  passing_attempts: 'Att',
  passing_completions: 'Comp',
  interceptions_thrown: 'INT',
  rushing_yards: 'Rush Yds',
  rushing_touchdowns: 'Rush TD',
  rushing_attempts: 'Carries',
  receiving_yards: 'Rec Yds',
  receiving_touchdowns: 'Rec TD',
  receptions: 'Rec',
  targets: 'Tgt',
  tackles: 'Tackles',
  sacks: 'Sacks',
  interceptions_caught: 'INT',
  passes_defended: 'PD',
  // MLB (derive_mlb_path_players.js)
  at_bats: 'AB',
  home_runs: 'HR',
  rbi: 'RBI',
  games_started: 'GS',
  wins: 'W',
  losses: 'L',
  strikeouts_pitched: 'K',
  // NBA (derive_nba_path_players.js)
  total_points: 'PTS',
  total_rebounds: 'REB',
  total_assists: 'AST',
}

export function statLabel(key) {
  return STAT_LABELS[key] ?? key
}
