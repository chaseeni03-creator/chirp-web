import { ERAS } from '../lib/sports'

export default function EraSelector({ sport, value, onChange }) {
  const eras = ERAS[sport]
  return (
    <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
      {eras.map((e) => (
        <button
          key={e.key}
          onClick={() => onChange(e.key)}
          className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-bold transition-colors ${
            value === e.key
              ? 'bg-[var(--color-primary)] text-white'
              : 'border border-[var(--color-border)] bg-[var(--color-elevated)] text-[var(--color-text-secondary)]'
          }`}
        >
          {e.label}
        </button>
      ))}
    </div>
  )
}
