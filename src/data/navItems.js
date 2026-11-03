import { GAME_PATHS } from '../lib/groups'

// Shared between BottomTabBar (mobile) and TopNav's merged desktop row
// (sm:+) so the two surfaces never drift out of sync.
export const NAV_ITEMS = [
  { id: 'today', label: 'Today', emoji: '🏠', to: '/', match: (p) => p === '/' },
  { id: 'games', label: 'Games', emoji: '🎮', to: '/games', match: (p) => p === '/games' },
  { id: 'ranks', label: 'Ranks', emoji: '🏆', to: '/leaderboard', match: (p) => p === '/leaderboard' },
  { id: 'badges', label: 'Badges', emoji: '🏅', to: '/badges', match: (p) => p === '/badges' },
  { id: 'profile', label: 'Profile', emoji: '👤', to: '/profile', match: (p) => p === '/profile' },
]

// Gameplay routes hide nav chrome (both the mobile floating bar and the
// desktop merged row) so a session in progress gets GameShell's minimal
// back-arrow/info-button-only focus instead of a second nav affordance.
export const GAMEPLAY_PATHS = new Set([...Object.values(GAME_PATHS), '/before-or-after'])
