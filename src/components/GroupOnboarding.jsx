import { useEffect, useState } from 'react'
import { useGroup } from '../context/GroupContext'
import {
  signInWithGoogle, createGroup, joinGroup, displayCode, inviteLink, rememberGroup,
  sanitizeNickname, sanitizeGroupName, MAX_MEMBERS, MAX_GROUPS_PER_USER, NicknameTakenError,
} from '../lib/groups'
import { copyToClipboard } from '../lib/share'
import { todayStr } from '../lib/supabase'

/** The whole "who are you → create or join a group" flow, shared by the homepage modal, the invite-link page, and the group dashboard's empty state. */
export default function GroupOnboarding({ prefillCode, onDone }) {
  const { user, saveUser, googleSession } = useGroup()

  // A guest must still pick a nickname+PIN first (the 'identity' step), even
  // with a prefilled invite code — only an already-signed-in Google session
  // can skip straight past identity.
  const [step, setStep] = useState(googleSession ? 'groupChoice' : 'identity')
  const [nickname, setNickname] = useState(googleSession?.user?.user_metadata?.full_name || googleSession?.user?.email || '')
  const [pin, setPin] = useState('')
  const [guestIdentity, setGuestIdentity] = useState(null) // { type: 'guest', pin }
  const [code, setCode] = useState(prefillCode || '')
  const [groupName, setGroupName] = useState('')
  const [isPublic, setIsPublic] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [nicknameTaken, setNicknameTaken] = useState(null) // { nickname, canUsePin }
  const [retryPin, setRetryPin] = useState('')
  const [createdGroup, setCreatedGroup] = useState(null)
  const [copied, setCopied] = useState(null)

  // The Google session resolves asynchronously (a beat after this component
  // mounts, e.g. right after the OAuth redirect lands on /groups) — the
  // useState above only reads it once at mount, so this catches the session
  // arriving afterward and advances past the identity screen.
  useEffect(() => {
    if (googleSession && step === 'identity') {
      setNickname(googleSession.user?.user_metadata?.full_name || googleSession.user?.email || '')
      setStep('groupChoice')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [googleSession])

  const identity = googleSession
    ? { type: 'google', userId: googleSession.user.id }
    : guestIdentity

  const atGroupLimit = (user?.groups?.length || 0) >= MAX_GROUPS_PER_USER

  function finish(group) {
    // Stamp today as already-confirmed — they just proved who they are by
    // creating/joining in this same session, so the "welcome back" PIN gate
    // (which only exists for later, separate return visits) shouldn't fire
    // immediately afterward.
    const base = user
      ? { ...user, nickname, lastConfirmedDate: todayStr() }
      : { type: identity.type, nickname, pin: identity.type === 'guest' ? identity.pin : undefined, groups: [], lastConfirmedDate: todayStr() }
    saveUser(rememberGroup(base, { id: group.id, code: group.code, name: group.name }))
  }

  // Join has no separate success screen — persist and hand off immediately.
  function finishAndClose(group) {
    finish(group)
    onDone?.(group)
  }

  function handleGoogleClick() {
    signInWithGoogle()
  }

  function handleGuestContinue(e) {
    e.preventDefault()
    if (!nickname.trim()) {
      setError('Enter a nickname')
      return
    }
    if (!/^\d{4}$/.test(pin)) {
      setError('PIN must be exactly 4 digits')
      return
    }
    setError(null)
    setGuestIdentity({ type: 'guest', pin })
    setStep(prefillCode ? 'joinPrefilled' : 'groupChoice')
  }

  async function attemptJoin(joinCode, opts = {}) {
    if (atGroupLimit) {
      setError(`You're already in ${MAX_GROUPS_PER_USER} groups — leave one first`)
      return
    }
    setBusy(true)
    setError(null)
    try {
      const result = await joinGroup({
        code: joinCode,
        nickname,
        identity: opts.pinOverride ? { ...identity, pin: opts.pinOverride } : identity,
      })
      setNicknameTaken(null)
      finishAndClose(result)
    } catch (err) {
      if (err instanceof NicknameTakenError) {
        setNicknameTaken({ nickname: err.nickname, canUsePin: err.canUsePin })
      } else {
        setError(err.message || "Couldn't join that group")
      }
    } finally {
      setBusy(false)
    }
  }

  async function handleJoinSubmit(e) {
    e.preventDefault()
    if (!nickname.trim()) {
      setError('Enter a nickname')
      return
    }
    if (!code.trim()) {
      setError('Enter a group code or invite link')
      return
    }
    await attemptJoin(code)
  }

  async function handleNicknameTakenRetry(e) {
    e.preventDefault()
    if (!/^\d{4}$/.test(retryPin)) {
      setError('Enter the 4-digit PIN')
      return
    }
    await attemptJoin(code, { pinOverride: retryPin })
  }

  async function handleCreate(e) {
    e.preventDefault()
    if (!nickname.trim()) {
      setError('Enter a nickname')
      return
    }
    if (!groupName.trim()) {
      setError('Enter a group name')
      return
    }
    if (atGroupLimit) {
      setError(`You're already in ${MAX_GROUPS_PER_USER} groups — leave one first`)
      return
    }
    setBusy(true)
    setError(null)
    try {
      const result = await createGroup({ groupName, nickname, isPublic, identity })
      setCreatedGroup(result)
      finish(result)
      setStep('created')
    } catch (err) {
      setError(err.message || 'Something went wrong creating the group')
    } finally {
      setBusy(false)
    }
  }

  async function copy(text, which) {
    const ok = await copyToClipboard(text)
    if (ok) {
      setCopied(which)
      setTimeout(() => setCopied(null), 1500)
    }
  }

  // ── identity ────────────────────────────────────────────────────────────
  if (step === 'identity') {
    return (
      <div>
        <h2 className="pr-8 text-lg font-extrabold sm:text-xl">Play with Friends 🦜</h2>

        <button
          type="button"
          onClick={handleGoogleClick}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-[var(--color-border)] bg-white py-3 text-sm font-bold text-black"
        >
          <span className="font-black">G</span> Continue with Google
        </button>
        <p className="mt-1.5 text-center text-xs text-[var(--color-text-tertiary)]">Your scores save automatically. Rejoin groups instantly.</p>

        <div className="my-5 flex items-center gap-3 text-xs font-bold text-[var(--color-text-tertiary)]">
          <div className="h-px flex-1 bg-[var(--color-border)]" />
          OR
          <div className="h-px flex-1 bg-[var(--color-border)]" />
        </div>

        <form onSubmit={handleGuestContinue}>
          <p className="mb-2 text-sm font-bold">Continue as Guest</p>
          <label className="block text-xs font-bold text-[var(--color-text-tertiary)]">Nickname</label>
          <input
            type="text"
            value={nickname}
            onChange={(e) => setNickname(sanitizeNickname(e.target.value))}
            maxLength={20}
            placeholder="e.g. Greg Joseph"
            className="mt-1 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-elevated)] px-4 py-2.5 text-sm outline-none focus:border-[var(--color-primary)]"
          />
          <label className="mt-3 block text-xs font-bold text-[var(--color-text-tertiary)]">PIN (4 digits)</label>
          <input
            type="text"
            inputMode="numeric"
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
            maxLength={4}
            placeholder="1234"
            className="mt-1 w-24 rounded-xl border border-[var(--color-border)] bg-[var(--color-elevated)] px-4 py-2.5 text-center text-sm tracking-widest outline-none focus:border-[var(--color-primary)]"
          />
          <p className="mt-1.5 text-xs text-[var(--color-text-tertiary)]">Use the same PIN to rejoin your group tomorrow.</p>
          <p className="mt-2 text-xs text-[var(--color-text-tertiary)]">Note: guest scores only save on this device.</p>

          {error && <p className="mt-3 text-center text-xs text-[var(--color-primary)]">{error}</p>}

          <button type="submit" className="mt-4 w-full rounded-xl bg-[var(--color-primary)] py-3 text-sm font-bold text-white">
            Continue as Guest
          </button>
        </form>
      </div>
    )
  }

  // ── join via a prefilled invite-link code ──────────────────────────────
  if (step === 'joinPrefilled') {
    return (
      <div>
        <h2 className="text-lg font-extrabold sm:text-xl">Join Group 🦜</h2>
        <p className="mt-1 text-sm text-[var(--color-text-secondary)]">Code: {displayCode(code)}</p>
        <form onSubmit={handleJoinSubmit}>
          <label className="mt-4 block text-xs font-bold text-[var(--color-text-tertiary)]">Your nickname</label>
          <input
            type="text"
            value={nickname}
            onChange={(e) => setNickname(sanitizeNickname(e.target.value))}
            maxLength={20}
            placeholder="e.g. Greg Joseph"
            className="mt-1 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-elevated)] px-4 py-2.5 text-sm outline-none focus:border-[var(--color-primary)]"
          />
          {nicknameTaken ? (
            <div className="mt-3 rounded-xl border border-[var(--color-warning)]/40 bg-[var(--color-warning)]/10 p-3 text-xs">
              <p>
                {nicknameTaken.nickname} is already taken in this group.{' '}
                {nicknameTaken.canUsePin ? `Enter the PIN to continue as ${nicknameTaken.nickname}, or choose a different nickname above.` : 'Choose a different nickname above.'}
              </p>
              {nicknameTaken.canUsePin && (
                <form onSubmit={handleNicknameTakenRetry} className="mt-2 flex gap-2">
                  <input
                    type="text"
                    inputMode="numeric"
                    value={retryPin}
                    onChange={(e) => setRetryPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                    maxLength={4}
                    placeholder="PIN"
                    className="w-20 rounded-lg border border-[var(--color-border)] bg-[var(--color-elevated)] px-2 py-1.5 text-center text-sm tracking-widest outline-none focus:border-[var(--color-primary)]"
                  />
                  <button type="submit" disabled={busy} className="rounded-lg bg-[var(--color-primary)] px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50">
                    {busy ? '...' : 'Confirm PIN'}
                  </button>
                </form>
              )}
            </div>
          ) : (
            error && <p className="mt-3 text-center text-xs text-[var(--color-primary)]">{error}</p>
          )}
          <button type="submit" disabled={busy} className="mt-4 w-full rounded-xl bg-[var(--color-primary)] py-3 text-sm font-bold text-white disabled:opacity-50">
            {busy ? 'Joining…' : 'Join Group'}
          </button>
        </form>
      </div>
    )
  }

  // ── group choice: create or join by code ───────────────────────────────
  if (step === 'groupChoice') {
    return (
      <div>
        <h2 className="pr-8 text-lg font-extrabold sm:text-xl">Play with Friends 🦜</h2>
        <label className="mt-4 block text-xs font-bold text-[var(--color-text-tertiary)]">Your nickname</label>
        <input
          type="text"
          value={nickname}
          onChange={(e) => setNickname(sanitizeNickname(e.target.value))}
          maxLength={20}
          className="mt-1 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-elevated)] px-4 py-2.5 text-sm outline-none focus:border-[var(--color-primary)]"
        />

        <button
          type="button"
          onClick={() => setStep('createName')}
          className="mt-4 w-full rounded-xl bg-[var(--color-primary)] py-3 text-sm font-bold text-white"
        >
          Create a Group
        </button>

        <p className="mb-1.5 mt-5 text-xs font-bold text-[var(--color-text-tertiary)]">Have a code? Join one:</p>
        <form onSubmit={handleJoinSubmit} className="flex gap-2">
          <input
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="CHIRP-4829 or invite link"
            className="min-w-0 flex-1 rounded-xl border border-[var(--color-border)] bg-[var(--color-elevated)] px-3 py-2.5 text-sm outline-none focus:border-[var(--color-primary)]"
          />
          <button type="submit" disabled={busy} className="shrink-0 rounded-xl border border-[var(--color-border)] bg-[var(--color-elevated)] px-4 py-2.5 text-sm font-bold disabled:opacity-50">
            {busy ? '...' : 'Join'}
          </button>
        </form>

        {nicknameTaken && (
          <div className="mt-3 rounded-xl border border-[var(--color-warning)]/40 bg-[var(--color-warning)]/10 p-3 text-xs">
            <p>
              {nicknameTaken.nickname} is already taken in this group.{' '}
              {nicknameTaken.canUsePin ? 'Enter the PIN to continue, or choose a different nickname above.' : 'Choose a different nickname above.'}
            </p>
            {nicknameTaken.canUsePin && (
              <form onSubmit={handleNicknameTakenRetry} className="mt-2 flex gap-2">
                <input
                  type="text"
                  inputMode="numeric"
                  value={retryPin}
                  onChange={(e) => setRetryPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                  maxLength={4}
                  placeholder="PIN"
                  className="w-20 rounded-lg border border-[var(--color-border)] bg-[var(--color-elevated)] px-2 py-1.5 text-center text-sm tracking-widest outline-none focus:border-[var(--color-primary)]"
                />
                <button type="submit" disabled={busy} className="rounded-lg bg-[var(--color-primary)] px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50">
                  {busy ? '...' : 'Confirm PIN'}
                </button>
              </form>
            )}
          </div>
        )}
        {error && !nicknameTaken && <p className="mt-3 text-center text-xs text-[var(--color-primary)]">{error}</p>}
      </div>
    )
  }

  // ── create: name the group ──────────────────────────────────────────────
  if (step === 'createName') {
    return (
      <div>
        <h2 className="pr-8 text-lg font-extrabold sm:text-xl">Create a Group</h2>
        <form onSubmit={handleCreate}>
          <label className="mt-4 block text-xs font-bold text-[var(--color-text-tertiary)]">Group name</label>
          <input
            type="text"
            autoFocus
            value={groupName}
            onChange={(e) => setGroupName(sanitizeGroupName(e.target.value))}
            maxLength={30}
            placeholder="G's Crew"
            className="mt-1 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-elevated)] px-4 py-2.5 text-sm outline-none focus:border-[var(--color-primary)]"
          />
          <label className="mt-4 flex items-center gap-2 text-sm text-[var(--color-text-secondary)]">
            <input type="checkbox" checked={isPublic} onChange={(e) => setIsPublic(e.target.checked)} className="h-4 w-4" />
            Make this group public (anyone can find and join it)
          </label>
          {error && <p className="mt-3 text-center text-xs text-[var(--color-primary)]">{error}</p>}
          <div className="mt-5 flex gap-2">
            <button type="button" onClick={() => setStep('groupChoice')} className="flex-1 rounded-xl border border-[var(--color-border)] bg-[var(--color-elevated)] py-3 text-sm font-semibold">
              Back
            </button>
            <button type="submit" disabled={busy} className="flex-1 rounded-xl bg-[var(--color-primary)] py-3 text-sm font-bold text-white disabled:opacity-50">
              {busy ? 'Creating…' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    )
  }

  // ── created ──────────────────────────────────────────────────────────────
  if (step === 'created' && createdGroup) {
    return (
      <div>
        <h2 className="text-lg font-extrabold sm:text-xl">Group Created! 🎉</h2>
        <p className="mt-1 text-base font-bold text-[var(--color-primary)]">{createdGroup.name}</p>

        <div className="mt-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-elevated)] p-3">
          <p className="text-xs font-bold text-[var(--color-text-tertiary)]">CODE</p>
          <p className="text-lg font-black tracking-wide">{displayCode(createdGroup.code)}</p>
          <button type="button" onClick={() => copy(displayCode(createdGroup.code), 'code')} className="mt-2 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] py-2 text-xs font-bold">
            {copied === 'code' ? 'Copied!' : 'Copy Code'}
          </button>
        </div>

        <div className="mt-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-elevated)] p-3">
          <p className="text-xs font-bold text-[var(--color-text-tertiary)]">INVITE LINK</p>
          <p className="truncate text-sm font-semibold">{inviteLink(createdGroup.code)}</p>
          <div className="mt-2 flex gap-2">
            <button type="button" onClick={() => copy(inviteLink(createdGroup.code), 'link')} className="flex-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] py-2 text-xs font-bold">
              {copied === 'link' ? 'Copied!' : 'Copy Link'}
            </button>
            {typeof navigator !== 'undefined' && navigator.share && (
              <button
                type="button"
                onClick={() => navigator.share({ title: createdGroup.name, url: `https://${inviteLink(createdGroup.code)}` }).catch(() => {})}
                className="flex-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] py-2 text-xs font-bold"
              >
                Share
              </button>
            )}
          </div>
        </div>

        <p className="mt-3 text-center text-xs text-[var(--color-text-tertiary)]">Up to {MAX_MEMBERS} members</p>

        <button type="button" onClick={() => onDone?.(createdGroup)} className="mt-4 w-full rounded-xl bg-[var(--color-primary)] py-3 text-sm font-bold text-white">
          Start Playing
        </button>
      </div>
    )
  }

  return null
}
