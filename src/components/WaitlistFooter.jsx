import { useState } from 'react'
import { Link } from 'react-router-dom'

export default function WaitlistFooter() {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState('idle') // idle | loading | done | error | rateLimited

  async function submit(e) {
    e.preventDefault()
    if (!email.trim()) return
    setStatus('loading')
    try {
      const res = await fetch('/api/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      })
      if (res.status === 429) {
        setStatus('rateLimited')
        return
      }
      if (!res.ok) {
        setStatus('error')
        return
      }
      // The endpoint always reports success, whether the email was new or
      // already on the list, so this UI can't be used to tell them apart.
      setStatus('done')
    } catch (err) {
      console.error(err)
      setStatus('error')
    }
  }

  return (
    <footer className="border-t border-[var(--color-border)] bg-[var(--color-surface)]">
      <div className="mx-auto max-w-5xl px-4 py-8">
        <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-elevated)] p-6 text-center">
          <p className="flex items-center justify-center gap-1.5 text-lg font-bold">
            <img src="/bird-logo.png" alt="" className="h-5 w-5" />
            Chirp Sports Mobile App
          </p>
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
            Coming soon to iOS and Android
          </p>

          {status === 'done' ? (
            <p className="mt-4 font-semibold text-[var(--color-success)]">
              🎉 You're on the list — we'll email you when it's live.
            </p>
          ) : (
            <form onSubmit={submit} className="mx-auto mt-4 flex max-w-sm gap-2">
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@email.com"
                className="min-w-0 flex-1 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-2.5 text-sm text-[var(--color-text)] placeholder-[var(--color-text-tertiary)] outline-none focus:border-[var(--color-primary)]"
              />
              <button
                type="submit"
                disabled={status === 'loading'}
                className="shrink-0 rounded-xl bg-[var(--color-primary)] px-5 py-2.5 text-sm font-bold text-white disabled:opacity-60"
              >
                {status === 'loading' ? '...' : 'Notify Me'}
              </button>
            </form>
          )}
          {status === 'error' && (
            <p className="mt-2 text-xs text-[var(--color-primary)]">
              Something went wrong — try again in a moment.
            </p>
          )}
          {status === 'rateLimited' && (
            <p className="mt-2 text-xs text-[var(--color-primary)]">
              Too many attempts — try again in an hour.
            </p>
          )}
        </div>

        <div className="mt-6 flex justify-center gap-4 text-xs text-[var(--color-text-secondary)]">
          <Link to="/privacy" className="hover:text-[var(--color-text)]">Privacy Policy</Link>
          <Link to="/terms" className="hover:text-[var(--color-text)]">Terms of Service</Link>
        </div>
        <div className="mt-4 flex items-center justify-center gap-1.5 text-sm font-extrabold">
          <span className="text-[var(--color-primary)]">Chirp</span>
          <img src="/bird-logo.png" alt="" className="h-4 w-4" />
          <span className="text-[var(--color-text)]">Sports</span>
        </div>
        <p className="mt-3 text-center text-xs text-[var(--color-text-tertiary)]">
          © {new Date().getFullYear()} Chirp Sports. Not affiliated with the NFL, MLB, or NBA.
        </p>
      </div>
    </footer>
  )
}
