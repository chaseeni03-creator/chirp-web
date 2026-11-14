import { PERIODS, PERIOD_LABELS, SORT_MODES, SORT_MODE_LABELS } from '../lib/combinedLeaderboard'

/** Period chips + Highest Score/Best Average toggle — port of
 * leaderboard_filter_bar.dart, minus the Friends/Groups scope toggle
 * (chirp-web has its own separate Groups leaderboard system already;
 * this section is "Everyone" only). */
export default function CombinedLeaderboardFilterBar({ period, onPeriodChange, sortMode, onSortModeChange }) {
  return (
    <div className="mb-3">
      <div className="mb-2 flex gap-1.5 overflow-x-auto pb-1">
        {PERIODS.map((p) => (
          <button
            key={p}
            onClick={() => onPeriodChange(p)}
            className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-bold transition-colors ${
              period === p
                ? 'bg-[var(--color-primary)] text-white'
                : 'border border-[var(--color-border)] bg-[var(--color-elevated)] text-[var(--color-text-secondary)]'
            }`}
          >
            {PERIOD_LABELS[p]}
          </button>
        ))}
      </div>
      <div className="flex gap-1.5">
        {SORT_MODES.map((m) => (
          <button
            key={m}
            onClick={() => onSortModeChange(m)}
            className={`flex-1 rounded-lg py-2 text-xs font-bold transition-colors ${
              sortMode === m
                ? 'bg-[var(--color-primary)] text-white'
                : 'bg-[var(--color-elevated)] text-[var(--color-text-secondary)]'
            }`}
          >
            {SORT_MODE_LABELS[m]}
          </button>
        ))}
      </div>
    </div>
  )
}
