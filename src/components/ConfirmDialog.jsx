export default function ConfirmDialog({ title, body, confirmLabel, busy, error, onCancel, onConfirm }) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4" onClick={onCancel}>
      <div
        className="w-full max-w-sm rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="font-extrabold">{title}</p>
        <p className="mt-2 text-sm text-[var(--color-text-secondary)]">{body}</p>
        {error && <p className="mt-2 text-xs font-semibold text-[var(--color-error)]">{error}</p>}
        <div className="mt-4 flex gap-2">
          <button
            onClick={onCancel}
            disabled={busy}
            className="flex-1 rounded-xl border border-[var(--color-border)] py-2.5 text-sm font-bold text-[var(--color-text-secondary)]"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={busy}
            className="flex-1 rounded-xl bg-[var(--color-primary)] py-2.5 text-sm font-bold text-white disabled:opacity-60"
          >
            {busy ? '…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
