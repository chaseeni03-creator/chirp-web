import { useEffect } from 'react'
import { GAME_LABELS } from '../lib/groups'
import { SPORT_META } from '../lib/sports'

/** Floating "so-and-so just scored" toast, fed one row at a time by the realtime subscription. */
export default function ScoreToast({ row, onDismiss }) {
  useEffect(() => {
    if (!row) return undefined
    const t = setTimeout(onDismiss, 4000)
    return () => clearTimeout(t)
  }, [row, onDismiss])

  if (!row) return null

  return (
    <div className="fixed bottom-4 left-1/2 z-40 w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 rounded-xl border border-[var(--color-primary)]/40 bg-[var(--color-surface)] p-3 text-sm shadow-xl">
      <p>
        <span className="font-bold">{row.nickname}</span> just scored <span className="font-bold">{row.score.toLocaleString()}pts</span> on{' '}
        {GAME_LABELS[row.game_type]}! {SPORT_META[row.sport]?.emoji}
      </p>
    </div>
  )
}
