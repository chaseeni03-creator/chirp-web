import { useEffect, useState } from 'react'
import { HOW_TO_PLAY } from '../data/howToPlay'

/** onClose(dontShowAgain: boolean) — the caller decides what "don't show again" means (GameShell persists it per-game). */
export default function HowToPlayModal({ gameKey, onClose }) {
  const info = HOW_TO_PLAY[gameKey]
  const [dontShowAgain, setDontShowAgain] = useState(false)

  useEffect(() => {
    function onKeyDown(e) {
      if (e.key === 'Escape') onClose(dontShowAgain)
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onClose, dontShowAgain])

  if (!info) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onClick={() => onClose(dontShowAgain)}
    >
      <div
        className="relative max-h-[85vh] w-full max-w-sm overflow-y-auto rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 sm:max-w-md sm:p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={() => onClose(dontShowAgain)}
          aria-label="Close"
          className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full text-[var(--color-text-secondary)] hover:bg-[var(--color-elevated)] hover:text-[var(--color-text)]"
        >
          ✕
        </button>

        <h2 className="pr-8 text-lg font-extrabold text-[var(--color-primary)] sm:text-xl">
          {info.title}
        </h2>
        <p className="mt-3 text-sm font-semibold text-[var(--color-text)] sm:text-base">{info.intro}</p>

        <ul className="mt-3 space-y-2.5">
          {info.bullets.map((b, i) => (
            <li key={i} className="whitespace-pre-line text-sm leading-snug text-[var(--color-text)] sm:text-base">
              • {b}
            </li>
          ))}
        </ul>

        {info.scoring && (
          <div className="mt-4 rounded-xl bg-[var(--color-elevated)] p-3 text-sm text-[var(--color-text-secondary)] sm:p-4">
            <p className="mb-1 whitespace-pre-line font-mono text-xs sm:text-sm">{info.scoring}</p>
          </div>
        )}

        <p className="mt-4 text-center text-sm font-semibold text-[var(--color-text)]">Good luck! 🦜</p>

        <label className="mt-4 flex items-center justify-center gap-2 text-xs text-[var(--color-text-secondary)]">
          <input
            type="checkbox"
            checked={dontShowAgain}
            onChange={(e) => setDontShowAgain(e.target.checked)}
            className="h-4 w-4 accent-[var(--color-primary)]"
          />
          Don't show this automatically again
        </label>

        <button
          type="button"
          onClick={() => onClose(dontShowAgain)}
          className="mt-3 w-full rounded-xl bg-[var(--color-primary)] py-2.5 text-sm font-bold text-white"
        >
          Got it
        </button>

        <div className="mt-5 flex items-center justify-center gap-1.5 border-t border-[var(--color-border)] pt-4 text-sm font-extrabold">
          <span className="text-[var(--color-primary)]">Chirp</span>
          <img src="/bird-logo.png" alt="" className="h-4 w-4" />
          <span className="text-[var(--color-text)]">Sports</span>
        </div>
      </div>
    </div>
  )
}
