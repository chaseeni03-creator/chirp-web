import { ERAS } from '../lib/sports'

export default function EraSelector({ sport, value, onChange }) {
  const eras = ERAS[sport]
  return (
    <div className="mb-4 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
      {eras.map((e) => (
        <button
          key={e.key}
          onClick={() => onChange(e.key)}
          className={`flex min-h-[50px] flex-col items-center justify-center rounded-lg px-3 py-1.5 text-center text-xs font-bold transition-colors sm:min-h-0 sm:shrink-0 sm:rounded-full sm:px-4 sm:text-sm ${
            value === e.key
              ? 'bg-[var(--color-primary)] text-white'
              : 'border border-[var(--color-border)] bg-[var(--color-elevated)] text-[var(--color-text-secondary)]'
          }`}
        >
          <span className="block">{e.label}</span>
          {e.rangeLabel && (
            <span className={`block text-[10px] font-normal ${value === e.key ? 'text-white/80' : 'text-[var(--color-text-tertiary)]'}`}>
              {e.rangeLabel}
            </span>
          )}
        </button>
      ))}
    </div>
  )
}
