import { useState, useEffect } from 'react'
import { RARITY_COLORS } from '../lib/badges'

const RARITY_LABELS = { common: 'Common', rare: 'Rare', epic: 'Epic', legendary: 'Legendary' }

/**
 * "You earned a new badge!" celebratory pop, fed the array of newly-earned
 * badges returned by checkAndAwardBadges. Shows one at a time (most games
 * only earn one, but Perfect Day / streak milestones / meta-badges can stack
 * several in one call) with a manual "Nice!" to advance — this is a bigger
 * moment than ScoreToast's auto-dismissing toast, so it doesn't self-clear.
 */
export default function BadgePopup({ badges }) {
  const [queue, setQueue] = useState([])

  useEffect(() => {
    if (badges && badges.length > 0) setQueue(badges)
  }, [badges])

  if (queue.length === 0) return null
  const current = queue[0]
  const color = RARITY_COLORS[current.rarity] || RARITY_COLORS.common

  function next() {
    setQueue((q) => q.slice(1))
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 p-4" onClick={next}>
      <div
        className="badge-pop w-full max-w-xs rounded-2xl border-2 bg-[var(--color-surface)] p-6 text-center"
        style={{ borderColor: color, boxShadow: `0 0 32px -8px ${color}` }}
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-xs font-bold tracking-widest text-[var(--color-text-secondary)]">NEW BADGE EARNED!</p>
        <p className="mt-3 text-6xl">{current.emoji}</p>
        <p className="mt-3 text-lg font-extrabold">{current.title}</p>
        <p className="mt-1 text-sm text-[var(--color-text-secondary)]">{current.description}</p>
        <p className="mt-2 text-xs font-bold uppercase tracking-wide" style={{ color }}>
          {RARITY_LABELS[current.rarity] || current.rarity}
        </p>
        <button
          onClick={next}
          className="mt-5 w-full rounded-xl py-3 text-sm font-bold text-white"
          style={{ backgroundColor: color }}
        >
          {queue.length > 1 ? `Nice! (${queue.length - 1} more)` : 'Nice!'}
        </button>
      </div>
    </div>
  )
}
