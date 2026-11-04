import { useState } from 'react'

const STEPS = [
  {
    emoji: '🦜',
    title: 'Welcome to Chirp Sports!',
    body: "Free daily sports trivia across NFL, MLB, and NBA. Let's take a quick look around before you dive in.",
  },
  {
    emoji: '🏠',
    title: 'One game, front and center',
    body: 'Every time you open the app, one featured game is waiting for you on Today. Pick your sport up top, and the hero changes with it.',
  },
  {
    emoji: '🎮',
    title: 'Every game, sorted by skill',
    body: 'Tap Games to browse everything — grouped from Casual Fan up to Hall of Famer, so you can find one that actually fits how deep you want to go.',
  },
  {
    emoji: '🏆',
    title: 'Climb the leaderboard',
    body: 'Every game feeds a daily leaderboard, plus badges for perfect scores, streaks, and milestones. Check Ranks and Badges anytime from the tab bar.',
  },
  {
    emoji: '👤',
    title: 'Make it yours',
    body: 'Play instantly as a guest, or sign in to save your progress across devices. Create a group from Profile to compete with friends.',
  },
  {
    emoji: '🎉',
    title: "You're all set!",
    body: "That's the whole site. Jump into today's featured game and start your streak.",
  },
]

/** One-time, skippable site tour — shown once on first visit (see Layout.jsx), never again after dismissed or finished. */
export default function WelcomeTour({ onClose }) {
  const [step, setStep] = useState(0)
  const info = STEPS[step]
  const isLast = step === STEPS.length - 1

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div
        className="relative w-full max-w-sm overflow-hidden rounded-2xl border border-[var(--color-border)] bg-gradient-to-br from-[var(--color-surface)] to-[var(--color-elevated)] p-6 text-center shadow-[var(--shadow-elevation-3)] sm:max-w-md sm:p-8"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 text-xs font-bold text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)]"
        >
          Skip tutorial
        </button>

        <p className="mt-4 text-5xl">{info.emoji}</p>
        <h2 className="mt-4 text-xl font-black tracking-tight sm:text-2xl">{info.title}</h2>
        <p className="mx-auto mt-3 max-w-xs text-sm text-[var(--color-text-secondary)] sm:text-base">{info.body}</p>

        <div className="mt-6 flex items-center justify-center gap-1.5">
          {STEPS.map((_, i) => (
            <span
              key={i}
              className="h-1.5 rounded-full transition-all"
              style={{
                width: i === step ? '18px' : '6px',
                backgroundColor: i === step ? 'var(--color-primary)' : 'var(--color-border)',
              }}
            />
          ))}
        </div>

        <div className="mt-6 flex gap-2">
          {step > 0 && (
            <button
              type="button"
              onClick={() => setStep((s) => s - 1)}
              className="flex-1 rounded-xl border border-[var(--color-border)] bg-[var(--color-elevated)] py-3 text-sm font-bold text-[var(--color-text-secondary)]"
            >
              Back
            </button>
          )}
          <button
            type="button"
            onClick={() => (isLast ? onClose() : setStep((s) => s + 1))}
            className="flex-1 rounded-xl py-3 text-sm font-black text-white shadow-[var(--shadow-scoreboard-btn)]"
            style={{ backgroundImage: 'var(--gradient-scoreboard-btn)' }}
          >
            {isLast ? "Let's Go" : 'Next'}
          </button>
        </div>
      </div>
    </div>
  )
}
