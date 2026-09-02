import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import Seo from '../components/Seo'
import PlayWithFriendsModal from '../components/PlayWithFriendsModal'
import { useGroup } from '../context/GroupContext'
import { useSport } from '../context/SportContext'
import { SPORT_META } from '../lib/sports'
import { copyToClipboard } from '../lib/share'
import {
  GAME_LABELS, GAME_ORDER, GAME_PATHS,
  displayCode, inviteLink, fetchGroupLeaderboard, fetchPublicGroups,
  subscribeToGroupScores, joinGroup, MAX_MEMBERS,
} from '../lib/groups'

const MEDAL = { 1: '🥇', 2: '🥈', 3: '🥉' }

export default function GroupPage() {
  const { group, leaveGroup } = useGroup()
  const { sport } = useSport()
  const [board, setBoard] = useState(null)
  const [copied, setCopied] = useState(false)
  const [showModal, setShowModal] = useState(false)

  const load = useCallback(() => {
    if (!group) return
    fetchGroupLeaderboard({ groupId: group.id, sport }).then(setBoard)
  }, [group, sport])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    if (!group) return undefined
    const unsubscribe = subscribeToGroupScores(group.id, load)
    return unsubscribe
  }, [group, load])

  if (!group) return <NoGroupView onShowModal={() => setShowModal(true)} showModal={showModal} closeModal={() => setShowModal(false)} />

  async function copyInvite() {
    const ok = await copyToClipboard(inviteLink(group.code))
    if (ok) {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    }
  }

  return (
    <div>
      <Seo title={`${group.name} — Group Leaderboard`} />
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-extrabold">{group.name} 🏆</h1>
          <p className="text-xs text-[var(--color-text-secondary)]">
            Code: {displayCode(group.code)} · Playing as <span className="font-bold text-[var(--color-text)]">{group.nickname}</span>
          </p>
        </div>
        <button onClick={copyInvite} className="shrink-0 rounded-full bg-[var(--color-primary)] px-3 py-1.5 text-xs font-bold text-white">
          {copied ? 'Copied!' : 'Invite'}
        </button>
      </div>

      <p className="mb-4 text-xs text-[var(--color-text-tertiary)]">
        Filtering by {SPORT_META[sport].emoji} {SPORT_META[sport].label} — use the pills up top to switch sport.{' '}
        <button onClick={leaveGroup} className="underline hover:text-[var(--color-text)]">Leave group</button>
      </p>

      <h2 className="mb-2 text-sm font-bold text-[var(--color-text-tertiary)]">TODAY'S SCORES</h2>

      {!board ? (
        <p className="text-center text-[var(--color-text-secondary)]">Loading leaderboard…</p>
      ) : (
        <div className="space-y-4">
          {GAME_ORDER.map((gameType) => (
            <div key={gameType} className="border border-[var(--color-border)] bg-[var(--color-surface)] p-3">
              <p className="mb-2 text-xs font-bold tracking-wide text-[var(--color-text-tertiary)]">{GAME_LABELS[gameType].toUpperCase()}</p>
              <div className="space-y-1">
                {board[gameType].map((entry) => (
                  <div key={entry.nickname} className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-1.5">
                      <span className="w-5 shrink-0 text-center">{entry.played ? (MEDAL[entry.rank] ?? '') : ''}</span>
                      <span className={entry.played ? 'font-semibold' : 'text-[var(--color-text-tertiary)]'}>{entry.nickname}</span>
                      {entry.played && entry.eraLabel && (
                        <span className="rounded-full bg-[var(--color-elevated)] px-2 py-0.5 text-[10px] font-bold text-[var(--color-text-secondary)]">
                          {entry.eraLabel}
                        </span>
                      )}
                    </span>
                    <span className={entry.played ? 'font-bold tabular-nums' : 'text-xs text-[var(--color-text-tertiary)]'}>
                      {entry.played ? `${entry.score.toLocaleString()}pts${entry.details ? ` · ${entry.details}` : ''}` : '--- Not played'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-6 space-y-2">
        {GAME_ORDER.map((gameType) => (
          <Link
            key={gameType}
            to={GAME_PATHS[gameType]}
            className="block w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-elevated)] py-2.5 text-center text-sm font-bold hover:border-[var(--color-primary)]/50"
          >
            Play {GAME_LABELS[gameType]} Today
          </Link>
        ))}
      </div>
    </div>
  )
}

function NoGroupView({ onShowModal, showModal, closeModal }) {
  const { setGroup } = useGroup()
  const [publicGroups, setPublicGroups] = useState([])
  const [nickname, setNickname] = useState('')
  const [joiningId, setJoiningId] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    fetchPublicGroups().then(setPublicGroups)
  }, [])

  async function joinPublic(g) {
    if (!nickname.trim()) {
      setError('Enter a nickname first')
      return
    }
    setJoiningId(g.id)
    setError(null)
    try {
      const result = await joinGroup({ code: g.group_code, nickname })
      setGroup({ ...result, nickname: nickname.trim() })
    } catch (err) {
      setError(err.message || "Couldn't join that group")
    } finally {
      setJoiningId(null)
    }
  }

  return (
    <div>
      <Seo title="Groups" />
      <h1 className="mb-2 text-xl font-extrabold">Groups 👥</h1>
      <p className="mb-4 text-sm text-[var(--color-text-secondary)]">
        Play with friends — everyone plays the same daily games independently, and a shared leaderboard shows today's scores.
      </p>
      <button onClick={onShowModal} className="w-full rounded-xl bg-[var(--color-primary)] py-3 text-sm font-bold text-white">
        Create or Join a Group
      </button>

      {publicGroups.length > 0 && (
        <div className="mt-6">
          <h2 className="mb-2 text-sm font-bold text-[var(--color-text-tertiary)]">PUBLIC GROUPS</h2>
          <input
            type="text"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            placeholder="Your nickname (needed to join)"
            className="mb-2 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-elevated)] px-4 py-2.5 text-sm outline-none focus:border-[var(--color-primary)]"
          />
          {error && <p className="mb-2 text-xs text-[var(--color-primary)]">{error}</p>}
          <div className="space-y-2">
            {publicGroups.map((g) => (
              <div key={g.id} className="flex items-center justify-between border border-[var(--color-border)] bg-[var(--color-surface)] p-3">
                <div>
                  <p className="font-bold">{g.group_name}</p>
                  <p className="text-xs text-[var(--color-text-tertiary)]">{g.memberCount}/{MAX_MEMBERS} members</p>
                </div>
                <button
                  onClick={() => joinPublic(g)}
                  disabled={joiningId === g.id}
                  className="shrink-0 rounded-full border border-[var(--color-border)] bg-[var(--color-elevated)] px-3 py-1.5 text-xs font-bold disabled:opacity-50"
                >
                  {joiningId === g.id ? '...' : 'Join'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {showModal && <PlayWithFriendsModal onClose={closeModal} />}
    </div>
  )
}
