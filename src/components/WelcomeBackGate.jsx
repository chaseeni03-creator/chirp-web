import { useState } from 'react'
import { verifyGuestPin } from '../lib/groups'

/** Shown once per day for returning guests before the group dashboard renders. */
export default function WelcomeBackGate({ nickname, group, onConfirmed, onStartFresh }) {
  const [pin, setPin] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  async function handleSubmit(e) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const ok = await verifyGuestPin({ groupId: group.id, nickname, pin })
    setBusy(false)
    if (ok) onConfirmed()
    else setError('Wrong PIN. Try again or continue as new guest.')
  }

  return (
    <div className="mx-auto max-w-sm text-center">
      <p className="text-lg font-extrabold">Welcome back {nickname}! 👋</p>
      <p className="mt-1 text-sm text-[var(--color-text-secondary)]">Rejoining {group.name}…</p>
      <form onSubmit={handleSubmit} className="mt-4">
        <label className="mb-1 block text-left text-xs font-bold text-[var(--color-text-tertiary)]">Enter your PIN to confirm</label>
        <input
          type="text"
          autoFocus
          inputMode="numeric"
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
          maxLength={4}
          placeholder="1234"
          className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-elevated)] px-4 py-3 text-center text-lg tracking-widest outline-none focus:border-[var(--color-primary)]"
        />
        {error && (
          <div className="mt-2 text-xs text-[var(--color-primary)]">
            <p>{error}</p>
            <button type="button" onClick={onStartFresh} className="mt-1 underline">
              Continue as new guest
            </button>
          </div>
        )}
        <button type="submit" disabled={busy || pin.length !== 4} className="mt-4 w-full rounded-xl bg-[var(--color-primary)] py-3 text-sm font-bold text-white disabled:opacity-50">
          {busy ? 'Checking…' : 'Confirm'}
        </button>
      </form>
    </div>
  )
}
