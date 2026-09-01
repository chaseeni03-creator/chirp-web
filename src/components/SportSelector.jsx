import { SPORTS, SPORT_META } from '../lib/sports'
import { useSport } from '../context/SportContext'

export default function SportSelector() {
  const { sport, setSport } = useSport()

  return (
    <div className="flex justify-center gap-2 border-t border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-2">
      {SPORTS.map((key) => {
        const meta = SPORT_META[key]
        const active = key === sport
        return (
          <button
            key={key}
            onClick={() => setSport(key)}
            className={`rounded-full px-4 py-1.5 text-sm font-bold transition-colors ${
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
