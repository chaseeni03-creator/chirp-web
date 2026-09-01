export const games = [
  {
    key: 'chirp-guess',
    path: '/guess',
    name: 'Chirp Guess',
    emoji: '🎯',
    description: (sportLabel) => `Guess today's mystery ${sportLabel} player in 8 tries or fewer.`,
  },
  {
    key: 'stat-line',
    path: '/statline',
    name: 'Stat Line',
    emoji: '📊',
    description: () => 'Identify the player from a single revealed season stat line.',
  },
  {
    key: 'career-builder',
    path: '/career',
    name: 'Career Builder',
    emoji: '📈',
    description: () => 'Put 5 scrambled seasons back in the right order.',
  },
  {
    key: 'progression',
    path: '/progression',
    name: 'The Progression',
    emoji: '⏩',
    description: () => 'Guess the player from their career, season by season.',
  },
  {
    key: 'more-or-less',
    path: '/moreorless',
    name: 'More vs Less',
    emoji: '⚔️',
    description: () => 'Endless head-to-head stat showdowns. How long can you last?',
  },
  {
    key: 'lineup',
    path: '/lineup',
    name: 'The Lineup',
    emoji: '📋',
    description: (sportLabel) => `Fill 9 ${sportLabel} stat-leader categories for today's scope.`,
  },
  {
    key: 'grid',
    path: '/grid',
    name: 'Chirp Grid',
    emoji: '🔢',
    description: () => 'Find a player for each square of the 3×3 grid.',
  },
]

export function gameByKey(key) {
  return games.find((g) => g.key === key)
}
