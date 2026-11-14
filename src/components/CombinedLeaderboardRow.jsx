import { scoreFor, averageFor } from '../lib/combinedLeaderboard'
import { SPORT_META } from '../lib/sports'

const MEDAL = { 1: '🥇', 2: '🥈', 3: '🥉' }
const RANK_COLOR = { 1: '#FFD700', 2: '#C0C0C0', 3: '#CD7F32' }

// No avatar component exists in chirp-web yet — falls back to a colored
// initial-letter circle when avatarUrl is unset, same idea as ChirpAvatar
// on mobile.
function RowAvatar({ avatarUrl, displayName }) {
  if (avatarUrl) {
    return <img src={avatarUrl} alt="" className="h-9 w-9 shrink-0 rounded-full object-cover" />
  }
  return (
    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--color-primary)] text-sm font-bold text-white">
      {(displayName || '?').charAt(0).toUpperCase()}
    </div>
  )
}

/** One row of the combined leaderboard — direct port of leaderboard_row.dart. */
export default function CombinedLeaderboardRow({ rank, entry, period, sortMode, isMe, showSportIcons }) {
  const medal = MEDAL[rank]
  const rankColor = RANK_COLOR[rank] ?? 'var(--color-text-secondary)'
  const isAverage = sortMode === 'average'
  const scoreText = isAverage ? `${averageFor(entry, period).toFixed(1)} avg` : scoreFor(entry, period).toLocaleString()

  return (
    <div
      className="flex items-center gap-2.5 rounded-xl px-3.5 py-2.5"
      style={isMe ? { backgroundColor: 'color-mix(in srgb, var(--color-primary) 10%, transparent)', border: '1px solid color-mix(in srgb, var(--color-primary) 30%, transparent)' } : undefined}
    >
      <div className="w-8 shrink-0 text-center">
        {medal ? (
          <span className="text-lg">{medal}</span>
        ) : (
          <span className="text-sm font-extrabold" style={{ color: rankColor }}>#{rank}</span>
        )}
      </div>
      <RowAvatar avatarUrl={entry.avatarUrl} displayName={entry.displayName} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1">
          <span className="truncate text-sm font-bold">{entry.displayName}</span>
          {entry.isVerified && <span className="text-[var(--color-primary)]">✓</span>}
        </div>
        <div className="flex items-center gap-2.5 text-[11px] text-[var(--color-text-secondary)]">
          <span>🎮 {entry.periodGamesPlayed} played</span>
          <span>🔥 {entry.bestStreak} day streak</span>
        </div>
        {showSportIcons && entry.sportsPlayed?.size > 0 && (
          <div className="mt-0.5 flex gap-1.5">
            {[...entry.sportsPlayed].map((s) => (
              <span key={s} className="text-[10px] font-extrabold tracking-wide text-[var(--color-text-secondary)]">
                {SPORT_META[s]?.emoji ?? ''} {SPORT_META[s]?.label ?? s.toUpperCase()}
              </span>
            ))}
          </div>
        )}
      </div>
      <span className="shrink-0 text-base font-extrabold">{scoreText}</span>
    </div>
  )
}
