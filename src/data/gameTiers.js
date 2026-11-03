// Reuses the exact badge-rarity tokens (index.css) as the "More Games" tier
// accent colors, rather than inventing a second competing color language —
// gold/purple/blue/gray already mean "how impressive is this" everywhere
// else in the app (Badges.jsx), so it means the same thing here too.
export const TIERS = [
  { id: 'hall-of-famer', label: 'Hall of Famer', colorVar: '--color-rarity-legendary' },
  { id: 'elite', label: 'Elite Ball Knower', colorVar: '--color-rarity-epic' },
  { id: 'serious', label: 'Serious Fan', colorVar: '--color-rarity-rare' },
  { id: 'casual', label: 'Casual Fan', colorVar: '--color-rarity-common' },
]
