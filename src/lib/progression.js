// "The Progression" scoring, ported from lib/models/progression_game.dart.
// Stat key/label sets and formatting are identical to Career Builder's per
// mobile's own code (progression_game.dart's NFL keys literally match
// career_builder_game.dart's; MLB/NBA progression models import their stat
// sets directly from the career builder models) — reused from careerBuilder.js
// rather than duplicated a third time.

export { careerBuilderConfig as progressionConfig, nflGroupFor } from './careerBuilder'

export function pointsPerYear(totalSeasons) {
  return 1000 / totalSeasons
}

/** Base score for guessing correctly right after `year` is revealed, before wrong-guess penalties. */
export function progressionScoreForYear(totalSeasons, year) {
  const raw = 1000 - pointsPerYear(totalSeasons) * (year - 1)
  return Math.min(1000, Math.max(100, Math.round(raw)))
}

/** What a correct guess is worth right now — base score minus 50 per wrong guess so far, floored at 100. */
export function progressionPotentialScore({ totalSeasons, year, wrongGuesses }) {
  const base = progressionScoreForYear(totalSeasons, year) - 50 * wrongGuesses
  return Math.min(1000, Math.max(100, base))
}

/** DB spec: sacks only shown when non-zero (every other stat always shows, even at 0). */
export function progressionStatKeysFor(config, season) {
  return config.statKeys.filter((k) => k !== 'sacks' || (season[k] ?? 0) !== 0)
}
