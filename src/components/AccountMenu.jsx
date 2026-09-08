import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useGroup } from '../context/GroupContext'
import {
  signInWithGoogle, signOutGoogle, deleteGoogleAccount, leaveGroup, sanitizeNickname,
} from '../lib/groups'
import { getLeaderboardIdentity, setLeaderboardNickname } from '../lib/leaderboardIdentity'
import { migrateGuestLeaderboardScores } from '../lib/dailyLeaderboard'

const PERSON_ICON_PATH =
  'M12 12.5c2.9 0 5.25-2.35 5.25-5.25S14.9 2 12 2 6.75 4.35 6.75 7.25 9.1 12.5 12 12.5zm0 2.25c-4.03 0-8.25 2.02-8.25 4.5V21h16.5v-1.75c0-2.48-4.22-4.5-8.25-4.5z'

/**
 * Global account icon + dropdown, rendered once in Header.jsx so it appears
 * on every page. Reuses the same sign-in/out/delete/leave functions
 * GroupPage.jsx already uses in production (src/lib/groups.js) rather than
 * reimplementing them — this is a new surface for existing capability, plus
 * a genuinely new "Change Nickname" action (see leaderboardIdentity.js).
 */
export default function AccountMenu() {
  const navigate = useNavigate()
  const { user, saveUser, leaveOneGroup, activeGroup, googleSession, sessionChecked } = useGroup()
  const [open, setOpen] = useState(false)
  const [view, setView] = useState('menu') // menu | nickname | guestEntry
  const [nicknameInput, setNicknameInput] = useState('')
  const [confirmAction, setConfirmAction] = useState(null) // null | 'delete-account' | 'leave-group' | 'clear-guest-data'
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [toast, setToast] = useState(null)
  const rootRef = useRef(null)
  const migratedRef = useRef(false)

  const identity = getLeaderboardIdentity()
  const isGoogle = Boolean(googleSession)
  const isGuest = !isGoogle && user?.type === 'guest'
  const signedIn = isGoogle || isGuest
  const displayName = isGoogle
    ? user?.nickname || googleSession.user?.user_metadata?.full_name || googleSession.user?.email || 'Signed in'
    : user?.nickname || identity.nickname

  // One-time, best-effort: reassign a guest's leaderboard rows to a Google
  // account right after they sign in. Idempotent on the server (a repeat
  // call is a no-op once nothing matches), so no persisted "already ran"
  // flag is needed — this mount-scoped ref just avoids firing twice from
  // one render.
  useEffect(() => {
    if (!googleSession || migratedRef.current || !identity.guestId) return
    migratedRef.current = true
    migrateGuestLeaderboardScores(identity.guestId).catch((err) =>
      console.error('Guest leaderboard migration failed:', err)
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [googleSession])

  useEffect(() => {
    if (!open) return
    function onDocClick(e) {
      if (rootRef.current && !rootRef.current.contains(e.target)) close()
    }
    function onKeyDown(e) {
      if (e.key === 'Escape') close()
    }
    document.addEventListener('mousedown', onDocClick)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onDocClick)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  function close() {
    setOpen(false)
    setView('menu')
    setError(null)
  }

  function toggle() {
    if (open) close()
    else {
      setNicknameInput(displayName || '')
      setOpen(true)
    }
  }

  function showToast(text) {
    setToast(text)
    setTimeout(() => setToast(null), 2500)
  }

  async function handleSignOut() {
    await signOutGoogle()
    saveUser(null)
    close()
    showToast('Signed out successfully')
    navigate('/')
  }

  async function handleDeleteAccount() {
    setBusy(true)
    setError(null)
    try {
      await deleteGoogleAccount()
      saveUser(null)
      close()
      navigate('/')
    } catch (err) {
      setError(err.message || 'Could not delete your account')
      setBusy(false)
    }
  }

  async function handleLeaveGroup() {
    if (!activeGroup || !user) return
    setBusy(true)
    setError(null)
    try {
      await leaveGroup({ groupId: activeGroup.id, nickname: user.nickname })
      leaveOneGroup(activeGroup.id)
      close()
      navigate('/groups')
    } catch (err) {
      setError(err.message || 'Could not leave the group')
      setBusy(false)
    }
  }

  function handleClearGuestData() {
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith('chirp-web:')) localStorage.removeItem(key)
    }
    close()
    navigate('/')
  }

  function handleNicknameSave(e) {
    e.preventDefault()
    const clean = sanitizeNickname(nicknameInput)
    if (!clean) return
    setLeaderboardNickname(clean)
    if (user) saveUser({ ...user, nickname: clean })
    close()
    showToast('Nickname updated!')
  }

  function handleGuestEntrySave(e) {
    e.preventDefault()
    const clean = sanitizeNickname(nicknameInput)
    if (!clean) return
    setLeaderboardNickname(clean)
    saveUser({ type: 'guest', nickname: clean, groups: [] })
    close()
  }

  if (!sessionChecked) return null

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={toggle}
        aria-label="Account"
        aria-expanded={open}
        className="flex h-8 w-8 items-center justify-center rounded-full transition-colors"
        style={{ color: signedIn ? '#FF2D2D' : '#888888' }}
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d={PERSON_ICON_PATH} />
        </svg>
      </button>

      {toast && (
        <div className="absolute right-0 top-10 z-50 whitespace-nowrap rounded-lg bg-[var(--color-elevated)] px-3 py-1.5 text-xs font-semibold shadow-lg">
          {toast}
        </div>
      )}

      {open && (
        <div className="absolute right-0 top-10 z-50 w-64 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-2 text-sm shadow-xl">
          {view === 'nickname' && (
            <form onSubmit={handleNicknameSave} className="p-2">
              <p className="mb-2 text-xs font-bold text-[var(--color-text-secondary)]">Change nickname</p>
              <input
                autoFocus
                value={nicknameInput}
                onChange={(e) => setNicknameInput(e.target.value)}
                maxLength={20}
                className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm"
              />
              <div className="mt-2 flex gap-2">
                <button type="button" onClick={() => setView('menu')} className="flex-1 rounded-lg border border-[var(--color-border)] py-1.5 text-xs font-bold text-[var(--color-text-secondary)]">
                  Cancel
                </button>
                <button type="submit" disabled={!nicknameInput.trim()} className="flex-1 rounded-lg bg-[var(--color-primary)] py-1.5 text-xs font-bold text-white disabled:opacity-40">
                  Save
                </button>
              </div>
            </form>
          )}

          {view === 'guestEntry' && (
            <form onSubmit={handleGuestEntrySave} className="p-2">
              <p className="mb-2 text-xs font-bold text-[var(--color-text-secondary)]">What should we call you?</p>
              <input
                autoFocus
                value={nicknameInput}
                onChange={(e) => setNicknameInput(e.target.value)}
                maxLength={20}
                placeholder="Nickname"
                className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm"
              />
              <div className="mt-2 flex gap-2">
                <button type="button" onClick={() => setView('menu')} className="flex-1 rounded-lg border border-[var(--color-border)] py-1.5 text-xs font-bold text-[var(--color-text-secondary)]">
                  Cancel
                </button>
                <button type="submit" disabled={!nicknameInput.trim()} className="flex-1 rounded-lg bg-[var(--color-primary)] py-1.5 text-xs font-bold text-white disabled:opacity-40">
                  Continue
                </button>
              </div>
            </form>
          )}

          {view === 'menu' && !signedIn && (
            <div className="p-1">
              <MenuButton onClick={() => { close(); signInWithGoogle() }}>Sign in with Google</MenuButton>
              <MenuButton onClick={() => setView('guestEntry')}>Continue as Guest</MenuButton>
            </div>
          )}

          {view === 'menu' && signedIn && (
            <div>
              <div className="px-3 py-2">
                <p className="font-bold">👤 {displayName} ({isGoogle ? 'Google' : 'Guest'})</p>
                {isGoogle && googleSession.user?.email && (
                  <p className="text-xs text-[var(--color-text-secondary)]">{googleSession.user.email}</p>
                )}
              </div>
              <Divider />
              <MenuButton as={Link} to="/groups" onClick={close}>My Groups</MenuButton>
              <MenuButton onClick={() => setView('nickname')}>Change Nickname</MenuButton>
              <Divider />
              {isGoogle ? (
                <>
                  <MenuButton onClick={handleSignOut}>Sign Out</MenuButton>
                  <MenuButton danger onClick={() => setConfirmAction('delete-account')}>Delete Account</MenuButton>
                </>
              ) : (
                <>
                  <div className="px-3 py-2">
                    <button
                      onClick={() => { close(); signInWithGoogle() }}
                      className="text-left text-xs font-bold text-[var(--color-primary)] hover:underline"
                    >
                      Sign in with Google
                      <span className="block font-normal text-[var(--color-text-secondary)]">to save progress across all devices</span>
                    </button>
                  </div>
                  <Divider />
                  {activeGroup && <MenuButton onClick={() => setConfirmAction('leave-group')}>Leave Group</MenuButton>}
                  <MenuButton danger onClick={() => setConfirmAction('clear-guest-data')}>Clear Guest Data</MenuButton>
                </>
              )}
            </div>
          )}
        </div>
      )}

      {confirmAction === 'delete-account' && (
        <ConfirmDialog
          title="Delete your Chirp Sports account?"
          body="This removes all your scores, groups, and data permanently. This cannot be undone."
          confirmLabel="Delete"
          busy={busy}
          error={error}
          onCancel={() => { setConfirmAction(null); setError(null) }}
          onConfirm={handleDeleteAccount}
        />
      )}
      {confirmAction === 'leave-group' && (
        <ConfirmDialog
          title="Leave this group?"
          body="Your scores will be removed."
          confirmLabel="Leave"
          busy={busy}
          error={error}
          onCancel={() => { setConfirmAction(null); setError(null) }}
          onConfirm={handleLeaveGroup}
        />
      )}
      {confirmAction === 'clear-guest-data' && (
        <ConfirmDialog
          title="Clear all guest data?"
          body="This removes your nickname, groups, and scores from this device."
          confirmLabel="Clear"
          onCancel={() => setConfirmAction(null)}
          onConfirm={handleClearGuestData}
        />
      )}
    </div>
  )
}

function MenuButton({ as: Component = 'button', danger, className = '', ...props }) {
  const Tag = Component
  return (
    <Tag
      type={Tag === 'button' ? 'button' : undefined}
      className={`block w-full rounded-lg px-3 py-2 text-left text-sm font-semibold hover:bg-[var(--color-elevated)] ${
        danger ? 'text-[var(--color-primary)]' : 'text-[var(--color-text)]'
      } ${className}`}
      {...props}
    />
  )
}

function Divider() {
  return <div className="my-1 border-t border-[var(--color-border)]" />
}

function ConfirmDialog({ title, body, confirmLabel, busy, error, onCancel, onConfirm }) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4" onClick={onCancel}>
      <div
        className="w-full max-w-sm rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="font-extrabold">{title}</p>
        <p className="mt-2 text-sm text-[var(--color-text-secondary)]">{body}</p>
        {error && <p className="mt-2 text-xs font-semibold text-[var(--color-primary)]">{error}</p>}
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
