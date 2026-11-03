import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Seo from '../components/Seo'
import ConfirmDialog from '../components/ConfirmDialog'
import { useGroup } from '../context/GroupContext'
import {
  signInWithGoogle, signOutGoogle, deleteGoogleAccount, leaveGroup, sanitizeNickname,
} from '../lib/groups'
import { getLeaderboardIdentity, setLeaderboardNickname } from '../lib/leaderboardIdentity'
import { migrateGuestLeaderboardScores } from '../lib/dailyLeaderboard'
import { migrateGuestBadgeData } from '../lib/badges'

/**
 * Full-page replacement for the old Header dropdown (AccountMenu.jsx) — same
 * handlers/state logic, reused unchanged, just laid out as a page instead of
 * a popover now that account access lives behind the "Profile" nav item
 * instead of a persistent header icon.
 */
export default function Profile() {
  const navigate = useNavigate()
  const { user, saveUser, leaveOneGroup, activeGroup, googleSession, sessionChecked } = useGroup()
  const [view, setView] = useState('menu') // menu | nickname | guestEntry
  const [nicknameInput, setNicknameInput] = useState('')
  const [confirmAction, setConfirmAction] = useState(null) // null | 'delete-account' | 'leave-group' | 'clear-guest-data'
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [toast, setToast] = useState(null)
  const migratedRef = useRef(false)

  const identity = getLeaderboardIdentity()
  const isGoogle = Boolean(googleSession)
  const isGuest = !isGoogle && user?.type === 'guest'
  const signedIn = isGoogle || isGuest
  const displayName = isGoogle
    ? user?.nickname || googleSession.user?.user_metadata?.full_name || googleSession.user?.email || 'Signed in'
    : user?.nickname || identity.nickname

  useEffect(() => {
    if (!googleSession || migratedRef.current || !identity.guestId) return
    migratedRef.current = true
    migrateGuestLeaderboardScores(identity.guestId).catch((err) =>
      console.error('Guest leaderboard migration failed:', err)
    )
    migrateGuestBadgeData(identity.guestId).catch((err) =>
      console.error('Guest badge data migration failed:', err)
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [googleSession])

  function reset() {
    setView('menu')
    setError(null)
  }

  function showToast(text) {
    setToast(text)
    setTimeout(() => setToast(null), 2500)
  }

  async function handleSignOut() {
    await signOutGoogle()
    saveUser(null)
    showToast('Signed out successfully')
    navigate('/')
  }

  async function handleDeleteAccount() {
    setBusy(true)
    setError(null)
    try {
      await deleteGoogleAccount()
      saveUser(null)
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
    navigate('/')
  }

  function handleNicknameSave(e) {
    e.preventDefault()
    const clean = sanitizeNickname(nicknameInput)
    if (!clean) return
    setLeaderboardNickname(clean)
    if (user) saveUser({ ...user, nickname: clean })
    reset()
    showToast('Nickname updated!')
  }

  function handleGuestEntrySave(e) {
    e.preventDefault()
    const clean = sanitizeNickname(nicknameInput)
    if (!clean) return
    setLeaderboardNickname(clean)
    saveUser({ type: 'guest', nickname: clean, groups: [] })
    reset()
  }

  if (!sessionChecked) return <p className="text-center text-[var(--color-text-secondary)]">Loading…</p>

  return (
    <div className="mx-auto max-w-sm">
      <Seo title="Profile" description="Manage your Chirp Sports account, nickname, and groups." />
      <h1 className="mb-4 text-xl font-extrabold">Profile 👤</h1>

      {toast && (
        <div className="mb-4 rounded-lg bg-[var(--color-elevated)] px-3 py-2 text-center text-xs font-semibold">
          {toast}
        </div>
      )}

      {view === 'nickname' && (
        <form onSubmit={handleNicknameSave} className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-[var(--shadow-elevation-1)]">
          <p className="mb-2 text-xs font-bold text-[var(--color-text-secondary)]">Change nickname</p>
          <input
            autoFocus
            value={nicknameInput}
            onChange={(e) => setNicknameInput(e.target.value)}
            maxLength={20}
            className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm"
          />
          <div className="mt-3 flex gap-2">
            <button type="button" onClick={reset} className="flex-1 rounded-lg border border-[var(--color-border)] py-2 text-xs font-bold text-[var(--color-text-secondary)]">
              Cancel
            </button>
            <button type="submit" disabled={!nicknameInput.trim()} className="flex-1 rounded-lg bg-[var(--color-primary)] py-2 text-xs font-bold text-white disabled:opacity-40">
              Save
            </button>
          </div>
        </form>
      )}

      {view === 'guestEntry' && (
        <form onSubmit={handleGuestEntrySave} className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-[var(--shadow-elevation-1)]">
          <p className="mb-2 text-xs font-bold text-[var(--color-text-secondary)]">What should we call you?</p>
          <input
            autoFocus
            value={nicknameInput}
            onChange={(e) => setNicknameInput(e.target.value)}
            maxLength={20}
            placeholder="Nickname"
            className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm"
          />
          <div className="mt-3 flex gap-2">
            <button type="button" onClick={reset} className="flex-1 rounded-lg border border-[var(--color-border)] py-2 text-xs font-bold text-[var(--color-text-secondary)]">
              Cancel
            </button>
            <button type="submit" disabled={!nicknameInput.trim()} className="flex-1 rounded-lg bg-[var(--color-primary)] py-2 text-xs font-bold text-white disabled:opacity-40">
              Continue
            </button>
          </div>
        </form>
      )}

      {view === 'menu' && !signedIn && (
        <div className="space-y-2 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-2 shadow-[var(--shadow-elevation-1)]">
          <MenuButton onClick={() => signInWithGoogle()}>Sign in with Google</MenuButton>
          <MenuButton onClick={() => setView('guestEntry')}>Continue as Guest</MenuButton>
        </div>
      )}

      {view === 'menu' && signedIn && (
        <div className="space-y-4">
          <div className="flex flex-col items-center rounded-2xl border border-[var(--color-border)] bg-gradient-to-br from-[var(--color-surface)] to-[var(--color-elevated)] p-5 text-center shadow-[var(--shadow-elevation-2)]">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--color-elevated)] text-2xl shadow-[var(--shadow-glow-primary)]">
              👤
            </div>
            <p className="mt-3 font-bold">{displayName}</p>
            <p className="mt-0.5 rounded-full bg-[var(--color-elevated)] px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[var(--color-text-secondary)]">
              {isGoogle ? 'Google' : 'Guest'}
            </p>
            {isGoogle && googleSession.user?.email && (
              <p className="mt-1.5 text-xs text-[var(--color-text-secondary)]">{googleSession.user.email}</p>
            )}
          </div>

          <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow-elevation-1)]">
            <MenuButton as={Link} to="/groups">My Groups</MenuButton>
            <Divider />
            <MenuButton as={Link} to="/how-to-play">How to Play</MenuButton>
            <Divider />
            <MenuButton onClick={() => setView('nickname')}>Change Nickname</MenuButton>
          </div>

          {isGoogle ? (
            <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow-elevation-1)]">
              <MenuButton onClick={handleSignOut}>Sign Out</MenuButton>
              <Divider />
              <MenuButton danger onClick={() => setConfirmAction('delete-account')}>Delete Account</MenuButton>
            </div>
          ) : (
            <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow-elevation-1)]">
              <div className="px-4 py-3">
                <button
                  onClick={() => signInWithGoogle()}
                  className="text-left text-xs font-bold text-[var(--color-primary)] hover:underline"
                >
                  Sign in with Google
                  <span className="block font-normal text-[var(--color-text-secondary)]">to save progress across all devices</span>
                </button>
              </div>
              <Divider />
              {activeGroup && (
                <>
                  <MenuButton onClick={() => setConfirmAction('leave-group')}>Leave Group</MenuButton>
                  <Divider />
                </>
              )}
              <MenuButton danger onClick={() => setConfirmAction('clear-guest-data')}>Clear Guest Data</MenuButton>
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
      className={`block w-full rounded-lg px-4 py-3 text-left text-sm font-semibold hover:bg-[var(--color-elevated)] ${
        danger ? 'text-[var(--color-primary)]' : 'text-[var(--color-text)]'
      } ${className}`}
      {...props}
    />
  )
}

function Divider() {
  return <div className="border-t border-[var(--color-border)]" />
}
