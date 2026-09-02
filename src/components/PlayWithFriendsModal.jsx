import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useGroup } from '../context/GroupContext'
import { createGroup, joinGroup, displayCode, inviteLink, MAX_MEMBERS } from '../lib/groups'
import { copyToClipboard } from '../lib/share'

export default function PlayWithFriendsModal({ onClose }) {
  const navigate = useNavigate()
  const { setGroup } = useGroup()

  const [step, setStep] = useState('entry') // entry | createName | created
  const [nickname, setNickname] = useState('')
  const [code, setCode] = useState('')
  const [groupName, setGroupName] = useState('')
  const [isPublic, setIsPublic] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [createdGroup, setCreatedGroup] = useState(null)
  const [copied, setCopied] = useState(null) // 'code' | 'link' | null

  function requireNickname() {
    if (!nickname.trim()) {
      setError('Enter a nickname first')
      return false
    }
    return true
  }

  async function handleCreate(e) {
    e.preventDefault()
    if (!requireNickname()) return
    if (!groupName.trim()) {
      setError('Enter a group name')
      return
    }
    setBusy(true)
    setError(null)
    try {
      const result = await createGroup({ groupName, nickname, isPublic })
      setCreatedGroup(result)
      setGroup({ ...result, nickname: nickname.trim() })
      setStep('created')
    } catch (err) {
      setError(err.message || 'Something went wrong creating the group')
    } finally {
      setBusy(false)
    }
  }

  async function handleJoin(e) {
    e.preventDefault()
    if (!requireNickname()) return
    if (!code.trim()) {
      setError('Enter a group code or invite link')
      return
    }
    setBusy(true)
    setError(null)
    try {
      const result = await joinGroup({ code, nickname })
      setGroup({ ...result, nickname: nickname.trim() })
      onClose()
      navigate('/groups')
    } catch (err) {
      setError(err.message || "Couldn't join that group")
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div
        className="relative w-full max-w-sm rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 sm:p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full text-[var(--color-text-secondary)] hover:bg-[var(--color-elevated)] hover:text-[var(--color-text)]"
        >
          ✕
        </button>

        {step === 'entry' && (
          <>
            <h2 className="pr-8 text-lg font-extrabold sm:text-xl">Play with Friends 🦜</h2>

            <label className="mt-4 block text-xs font-bold text-[var(--color-text-tertiary)]">Your nickname</label>
            <input
              type="text"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              maxLength={24}
              placeholder="e.g. Greg Joseph"
              className="mt-1 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-elevated)] px-4 py-2.5 text-sm outline-none focus:border-[var(--color-primary)]"
            />

            <div className="my-5 flex items-center gap-3 text-xs font-bold text-[var(--color-text-tertiary)]">
              <div className="h-px flex-1 bg-[var(--color-border)]" />
              OR
              <div className="h-px flex-1 bg-[var(--color-border)]" />
            </div>

            <button
              type="button"
              onClick={() => (requireNickname() ? setStep('createName') : null)}
              className="w-full rounded-xl bg-[var(--color-primary)] py-3 text-sm font-bold text-white"
            >
              Create a Group
            </button>

            <p className="mb-1.5 mt-5 text-xs font-bold text-[var(--color-text-tertiary)]">Have a code? Join one:</p>
            <form onSubmit={handleJoin} className="flex gap-2">
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="CHIRP-4829 or invite link"
                className="min-w-0 flex-1 rounded-xl border border-[var(--color-border)] bg-[var(--color-elevated)] px-3 py-2.5 text-sm outline-none focus:border-[var(--color-primary)]"
              />
              <button
                type="submit"
                disabled={busy}
                className="shrink-0 rounded-xl border border-[var(--color-border)] bg-[var(--color-elevated)] px-4 py-2.5 text-sm font-bold disabled:opacity-50"
              >
                {busy ? '...' : 'Join'}
              </button>
            </form>
            <p className="mt-2 text-center text-xs text-[var(--color-text-tertiary)]">Or paste a full invite link above</p>

            {error && <p className="mt-3 text-center text-xs text-[var(--color-primary)]">{error}</p>}
          </>
        )}

        {step === 'createName' && (
          <>
            <h2 className="pr-8 text-lg font-extrabold sm:text-xl">Create a Group</h2>
            <form onSubmit={handleCreate}>
              <label className="mt-4 block text-xs font-bold text-[var(--color-text-tertiary)]">Group name</label>
              <input
                type="text"
                autoFocus
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                maxLength={40}
                placeholder="G's Crew"
                className="mt-1 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-elevated)] px-4 py-2.5 text-sm outline-none focus:border-[var(--color-primary)]"
              />

              <label className="mt-4 flex items-center gap-2 text-sm text-[var(--color-text-secondary)]">
                <input type="checkbox" checked={isPublic} onChange={(e) => setIsPublic(e.target.checked)} className="h-4 w-4" />
                Make this group public (anyone can find and join it)
              </label>

              {error && <p className="mt-3 text-center text-xs text-[var(--color-primary)]">{error}</p>}

              <div className="mt-5 flex gap-2">
                <button
                  type="button"
                  onClick={() => setStep('entry')}
                  className="flex-1 rounded-xl border border-[var(--color-border)] bg-[var(--color-elevated)] py-3 text-sm font-semibold"
                >
                  Back
                </button>
                <button type="submit" disabled={busy} className="flex-1 rounded-xl bg-[var(--color-primary)] py-3 text-sm font-bold text-white disabled:opacity-50">
                  {busy ? 'Creating…' : 'Create'}
                </button>
              </div>
            </form>
          </>
        )}

        {step === 'created' && createdGroup && (
          <>
            <h2 className="text-lg font-extrabold sm:text-xl">Group Created! 🎉</h2>
            <p className="mt-1 text-base font-bold text-[var(--color-primary)]">{createdGroup.name}</p>

            <div className="mt-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-elevated)] p-3">
              <p className="text-xs font-bold text-[var(--color-text-tertiary)]">CODE</p>
              <p className="text-lg font-black tracking-wide">{displayCode(createdGroup.code)}</p>
              <button
                type="button"
                onClick={() => copy(displayCode(createdGroup.code), 'code')}
                className="mt-2 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] py-2 text-xs font-bold"
              >
                {copied === 'code' ? 'Copied!' : 'Copy Code'}
              </button>
            </div>

            <div className="mt-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-elevated)] p-3">
              <p className="text-xs font-bold text-[var(--color-text-tertiary)]">INVITE LINK</p>
              <p className="truncate text-sm font-semibold">{inviteLink(createdGroup.code)}</p>
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => copy(inviteLink(createdGroup.code), 'link')}
                  className="flex-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] py-2 text-xs font-bold"
                >
                  {copied === 'link' ? 'Copied!' : 'Copy Link'}
                </button>
                {navigator.share && (
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

            <button
              type="button"
              onClick={() => {
                onClose()
                navigate('/groups')
              }}
              className="mt-4 w-full rounded-xl bg-[var(--color-primary)] py-3 text-sm font-bold text-white"
            >
              Start Playing
            </button>
          </>
        )}
      </div>
    </div>
  )
}
