import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import Seo from './Seo'
import HowToPlayModal from './HowToPlayModal'
import { HOW_TO_PLAY } from '../data/howToPlay'

const DISMISSED_KEY_PREFIX = 'chirp-web:how-to-play-dismissed:'

function isDismissed(gameKey) {
  try {
    return localStorage.getItem(DISMISSED_KEY_PREFIX + gameKey) === '1'
  } catch {
    return false
  }
}

export default function GameShell({ emoji, title, howToPlay, children }) {
  const [showHelp, setShowHelp] = useState(false)

  // Auto-opens once per game, the first time it's ever visited — same modal
  // the ℹ️ button opens manually, just triggered automatically this one
  // time. Checked on mount only (not on every howToPlay change) since a
  // single GameShell instance is always for one specific game.
  useEffect(() => {
    if (howToPlay && HOW_TO_PLAY[howToPlay] && !isDismissed(howToPlay)) {
      setShowHelp(true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div>
      <Seo title={title} />
      <div className="mb-4 flex items-center gap-2 sm:mb-6 sm:gap-3">
        <Link
          to="/"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:text-[var(--color-text)] sm:h-9 sm:w-9"
        >
          ←
        </Link>
        <h1 className="min-w-0 flex-1 truncate text-base font-extrabold sm:text-xl">
          {emoji} {title}
        </h1>
        {howToPlay && HOW_TO_PLAY[howToPlay] && (
          <button
            type="button"
            onClick={() => setShowHelp(true)}
            aria-label="How to play"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[var(--color-border)] text-base text-[var(--color-text-secondary)] hover:text-[var(--color-text)] sm:h-9 sm:w-9"
          >
            ℹ️
          </button>
        )}
      </div>
      {children}
      {showHelp && (
        <HowToPlayModal
          gameKey={howToPlay}
          onClose={(dontShowAgain) => {
            if (dontShowAgain) {
              try {
                localStorage.setItem(DISMISSED_KEY_PREFIX + howToPlay, '1')
              } catch {
                /* ignore */
              }
            }
            setShowHelp(false)
          }}
        />
      )}
    </div>
  )
}

export function Loading() {
  return <p className="text-center text-[var(--color-text-secondary)]">Loading today's puzzle…</p>
}

export function ErrorMsg({ message }) {
  return (
    <p className="text-center text-[var(--color-text-secondary)]">
      {message || "No puzzle scheduled for today — check back soon."}
    </p>
  )
}
