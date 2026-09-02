/** Full-page branded loading state — shown while auth is still resolving (e.g. right after the Google OAuth redirect lands). */
export default function LoadingScreen() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-[var(--color-text)]">
      <span className="text-4xl">🦜</span>
      <p className="text-sm font-semibold text-[var(--color-text-secondary)]">Loading Chirp Sports…</p>
    </div>
  )
}
