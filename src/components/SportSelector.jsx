import { SPORTS, SPORT_META } from '../lib/sports'
import { useSport } from '../context/SportContext'

export default function SportSelector() {
  const { sport, setSport } = useSport()

  return (
    <div className="flex justify-center gap-1.5 border-t border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-2 sm:gap-2 sm:px-4">
      {SPORTS.map((key) => {
        const meta = SPORT_META[key]
        const active = key === sport
        return (
          <button
            key={key}
            onClick={() => setSport(key)}
            className={`rounded-full px-3 py-1.5 text-xs font-bold transition-colors sm:px-4 sm:text-sm ${
              active
                ? 'bg-[var(--color-primary)] text-white'
                : 'border border-[var(--color-border)] bg-[var(--color-elevated)] text-[var(--color-text-secondary)]'
            }`}
          >
            {meta.emoji} {meta.label}
          </button>
        )
      })}
    </div>
  )
}
