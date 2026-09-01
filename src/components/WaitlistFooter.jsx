import { useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function WaitlistFooter() {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState('idle') // idle | loading | done | error

  async function submit(e) {
    e.preventDefault()
    if (!email.trim()) return
    setStatus('loading')
    const { error } = await supabase
      .from('email_waitlist')
      .insert({ email: email.trim().toLowerCase(), source: 'web' })

    // A unique-violation just means they already signed up — treat as success.
    if (error && error.code !== '23505') {
      console.error(error)
      setStatus('error')
      return
    }
    setStatus('done')
  }

  return (
    <footer className="border-t border-[var(--color-border)] bg-[var(--color-surface)]">
      <div className="mx-auto max-w-5xl px-4 py-8">
        <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-elevated)] p-6 text-center">
          <p className="text-lg font-bold">📱 Chirp Sports Mobile App</p>
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
        </div>

        <div className="mt-6 flex justify-center gap-4 text-xs text-[var(--color-text-secondary)]">
          <Link to="/privacy" className="hover:text-[var(--color-text)]">Privacy Policy</Link>
          <Link to="/terms" className="hover:text-[var(--color-text)]">Terms of Service</Link>
        </div>
        <p className="mt-3 text-center text-xs text-[var(--color-text-tertiary)]">
          © {new Date().getFullYear()} Chirp Sports. Not affiliated with the NFL, MLB, or NBA.
        </p>
      </div>
    </footer>
  )
}
