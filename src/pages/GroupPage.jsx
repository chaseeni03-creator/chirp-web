import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import Seo from '../components/Seo'
import PlayWithFriendsModal from '../components/PlayWithFriendsModal'
import GroupOnboarding from '../components/GroupOnboarding'
import WelcomeBackGate from '../components/WelcomeBackGate'
import ScoreToast from '../components/ScoreToast'
import { useGroup } from '../context/GroupContext'
import { useSport } from '../context/SportContext'
import { SPORT_META } from '../lib/sports'
import { copyToClipboard } from '../lib/share'
import { todayStr } from '../lib/supabase'
import {
  GAME_LABELS, GAME_ORDER, GAME_PATHS,
  displayCode, inviteLink, buildInviteMessage, smsShareUrl, whatsappShareUrl, twitterShareUrl,
  fetchGroupLeaderboard, fetchGroupMembers, fetchPublicGroups,
  subscribeToGroupScores, leaveGroup, joinGroup, rememberGroup, MAX_MEMBERS, MAX_GROUPS_PER_USER,
} from '../lib/groups'

const MEDAL = { 1: '🥇', 2: '🥈', 3: '🥉' }

export default function GroupPage() {
  const { user, saveUser, leaveOneGroup, setActiveGroup, activeGroup } = useGroup()
  const { sport } = useSport()
  const [tab, setTab] = useState('scores')
  const [board, setBoard] = useState(null)
  const [members, setMembers] = useState(null)
  const [showAddGroup, setShowAddGroup] = useState(false)
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false)
  const [toastRow, setToastRow] = useState(null)

  const needsWelcomeBack = user?.type === 'guest' && activeGroup && user.lastConfirmedDate !== todayStr()

  const loadBoard = useCallback(() => {
    if (!activeGroup) return
    fetchGroupLeaderboard({ groupId: activeGroup.id, sport }).then(setBoard)
  }, [activeGroup, sport])

  const loadMembers = useCallback(() => {
    if (!activeGroup) return
    fetchGroupMembers(activeGroup.id).then(setMembers)
  }, [activeGroup])

  useEffect(() => {
    loadBoard()
  }, [loadBoard])

  useEffect(() => {
    if (tab === 'members') loadMembers()
  }, [tab, loadMembers])

  useEffect(() => {
    if (!activeGroup || needsWelcomeBack) return undefined
    const unsubscribe = subscribeToGroupScores(activeGroup.id, (payload) => {
      loadBoard()
      if (tab === 'members') loadMembers()
      if (payload.eventType === 'INSERT' && payload.new.nickname !== user?.nickname) {
        setToastRow(payload.new)
      }
    })
    return unsubscribe
  }, [activeGroup, needsWelcomeBack, loadBoard, loadMembers, tab, user])

  if (!user || !activeGroup) return <NoGroupView />

  if (needsWelcomeBack) {
    return (
      <WelcomeBackGate
        nickname={user.nickname}
        group={activeGroup}
        onConfirmed={() => saveUser({ ...user, lastConfirmedDate: todayStr() })}
        onStartFresh={() => saveUser(null)}
      />
    )
  }

  async function handleLeave() {
    await leaveGroup({ groupId: activeGroup.id, nickname: user.nickname })
    leaveOneGroup(activeGroup.id)
    setShowLeaveConfirm(false)
  }

  return (
    <div>
      <Seo title={`${activeGroup.name} — Group Leaderboard`} />

      {user.groups.length > 1 && (
        <div className="mb-3 flex flex-wrap gap-2">
          {user.groups.map((g) => (
            <button
              key={g.id}
              onClick={() => setActiveGroup(g.id)}
              className={`rounded-full px-3 py-1 text-xs font-bold ${g.id === activeGroup.id ? 'bg-[var(--color-primary)] text-white' : 'border border-[var(--color-border)] bg-[var(--color-elevated)] text-[var(--color-text-secondary)]'}`}
            >
              {g.name}
            </button>
          ))}
          {user.groups.length < MAX_GROUPS_PER_USER && (
            <button onClick={() => setShowAddGroup(true)} className="rounded-full border border-dashed border-[var(--color-border)] px-3 py-1 text-xs font-bold text-[var(--color-text-tertiary)]">
              + Join another
            </button>
          )}
        </div>
      )}

      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-extrabold">{activeGroup.name} 🏆</h1>
          <p className="text-xs text-[var(--color-text-secondary)]">
            Code: {displayCode(activeGroup.code)} · Playing as <span className="font-bold text-[var(--color-text)]">{user.nickname}</span>
          </p>
        </div>
        {user.groups.length === 1 && user.groups.length < MAX_GROUPS_PER_USER && (
          <button onClick={() => setShowAddGroup(true)} className="shrink-0 rounded-full border border-[var(--color-border)] bg-[var(--color-elevated)] px-3 py-1.5 text-xs font-bold">
            + Join another
          </button>
        )}
      </div>

      <div className="mb-4 flex overflow-hidden rounded-lg border border-[var(--color-border)]">
        {[
          ['scores', 'Scores'],
          ['members', 'Members'],
          ['invite', 'Invite'],
        ].map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex-1 py-2 text-sm font-bold ${tab === key ? 'bg-[var(--color-primary)] text-white' : 'bg-[var(--color-elevated)] text-[var(--color-text-tertiary)]'}`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'scores' && (
        <ScoresTab board={board} sport={sport} />
      )}

      {tab === 'members' && (
        <MembersTab members={members} onLeaveClick={() => setShowLeaveConfirm(true)} />
      )}

      {tab === 'invite' && <InviteTab group={activeGroup} />}

      {showAddGroup && <PlayWithFriendsModal onClose={() => setShowAddGroup(false)} />}

      {showLeaveConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={() => setShowLeaveConfirm(false)}>
          <div className="w-full max-w-xs rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 text-center" onClick={(e) => e.stopPropagation()}>
            <p className="font-bold">Leave {activeGroup.name}?</p>
            <p className="mt-1 text-sm text-[var(--color-text-secondary)]">Your scores will be removed.</p>
            <div className="mt-4 flex gap-2">
              <button onClick={() => setShowLeaveConfirm(false)} className="flex-1 rounded-xl border border-[var(--color-border)] bg-[var(--color-elevated)] py-2.5 text-sm font-semibold">
                Cancel
              </button>
              <button onClick={handleLeave} className="flex-1 rounded-xl bg-[var(--color-primary)] py-2.5 text-sm font-bold text-white">
                Leave
              </button>
            </div>
          </div>
        </div>
      )}

      <ScoreToast row={toastRow} onDismiss={() => setToastRow(null)} />
    </div>
  )
}

function ScoresTab({ board, sport }) {
  return (
    <>
      <p className="mb-3 text-xs text-[var(--color-text-tertiary)]">
        Filtering by {SPORT_META[sport].emoji} {SPORT_META[sport].label} — use the pills up top to switch sport.
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
                        <span className="rounded-full bg-[var(--color-elevated)] px-2 py-0.5 text-[10px] font-bold text-[var(--color-text-secondary)]">{entry.eraLabel}</span>
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
    </>
  )
}

function MembersTab({ members, onLeaveClick }) {
  if (!members) return <p className="text-center text-[var(--color-text-secondary)]">Loading members…</p>
  return (
    <>
      <p className="mb-3 text-sm font-bold text-[var(--color-text-tertiary)]">MEMBERS ({members.length}/{MAX_MEMBERS})</p>
      <div className="space-y-2">
        {members.map((m) => (
          <div key={m.id} className="border border-[var(--color-border)] bg-[var(--color-surface)] p-3">
            <p className="font-bold">
              {m.status.dot} {m.nickname} <span className="font-normal text-[var(--color-text-tertiary)]">({m.is_guest ? 'Guest' : 'Google'})</span>
            </p>
            <p className="text-xs text-[var(--color-text-secondary)]">{m.status.label}</p>
            <p className="text-xs text-[var(--color-text-secondary)]">Best streak: 🔥 {m.streak} {m.streak === 1 ? 'day' : 'days'}</p>
          </div>
        ))}
      </div>
      <p className="mt-4 text-center text-sm text-[var(--color-text-tertiary)]">+ Invite more friends — see the Invite tab</p>
      <button onClick={onLeaveClick} className="mt-6 w-full rounded-xl border border-[var(--color-primary)]/40 bg-[var(--color-primary)]/10 py-3 text-sm font-bold text-[var(--color-primary)]">
        Leave Group
      </button>
    </>
  )
}

function InviteTab({ group }) {
  const [copiedWhich, setCopiedWhich] = useState(null)
  const message = buildInviteMessage(group)

  async function copy(text, which) {
    const ok = await copyToClipboard(text)
    if (ok) {
      setCopiedWhich(which)
      setTimeout(() => setCopiedWhich(null), 1500)
    }
  }

  return (
    <div>
      <p className="mb-3 text-lg font-extrabold">Invite Friends</p>

      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-elevated)] p-3">
        <p className="text-xs font-bold text-[var(--color-text-tertiary)]">GROUP CODE</p>
        <div className="mt-1 flex items-center justify-between">
          <p className="text-lg font-black tracking-wide">{displayCode(group.code)}</p>
          <button onClick={() => copy(displayCode(group.code), 'code')} className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-xs font-bold">
            {copiedWhich === 'code' ? 'Copied!' : 'Copy'}
          </button>
        </div>
      </div>

      <div className="mt-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-elevated)] p-3">
        <p className="text-xs font-bold text-[var(--color-text-tertiary)]">INVITE LINK</p>
        <p className="mt-1 truncate text-sm">{inviteLink(group.code)}</p>
        <button onClick={() => copy(inviteLink(group.code), 'link')} className="mt-2 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] py-2 text-xs font-bold">
          {copiedWhich === 'link' ? 'Copied!' : 'Copy Link'}
        </button>
      </div>

      <div className="mt-4 space-y-2">
        <a href={smsShareUrl(message)} className="block w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-elevated)] py-2.5 text-center text-sm font-bold">
          Share via iMessage
        </a>
        <a href={whatsappShareUrl(message)} target="_blank" rel="noreferrer" className="block w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-elevated)] py-2.5 text-center text-sm font-bold">
          Share via WhatsApp
        </a>
        <a href={twitterShareUrl(message)} target="_blank" rel="noreferrer" className="block w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-elevated)] py-2.5 text-center text-sm font-bold">
          Share via Twitter
        </a>
      </div>

      <div className="mt-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-elevated)] p-3">
        <p className="mb-1 text-xs font-bold text-[var(--color-text-tertiary)]">SHARE MESSAGE</p>
        <pre className="whitespace-pre-wrap font-mono text-xs text-[var(--color-text-secondary)]">{message}</pre>
        <button onClick={() => copy(message, 'message')} className="mt-2 w-full rounded-lg bg-[var(--color-primary)] py-2 text-xs font-bold text-white">
          {copiedWhich === 'message' ? 'Copied!' : 'Copy Message'}
        </button>
      </div>
    </div>
  )
}

function NoGroupView() {
  const { user, saveUser, googleSession } = useGroup()
  const [publicGroups, setPublicGroups] = useState([])
  const [error, setError] = useState(null)
  const [joiningId, setJoiningId] = useState(null)

  useEffect(() => {
    fetchPublicGroups().then(setPublicGroups)
  }, [])

  async function joinPublic(g) {
    if (!user?.nickname) {
      setError('Sign in or continue as a guest above first')
      return
    }
    setJoiningId(g.id)
    setError(null)
    try {
      const identity = user.type === 'guest' ? { type: 'guest', pin: user.pin } : { type: 'google', userId: googleSession.user.id }
      const result = await joinGroup({ code: g.group_code, nickname: user.nickname, identity })
      saveUser(rememberGroup(user, { id: result.id, code: result.code, name: result.name }))
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

      <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
        <GroupOnboarding onDone={() => {}} />
      </div>

      {publicGroups.length > 0 && (
        <div className="mt-6">
          <h2 className="mb-2 text-sm font-bold text-[var(--color-text-tertiary)]">PUBLIC GROUPS</h2>
          {error && <p className="mb-2 text-xs text-[var(--color-primary)]">{error}</p>}
          <div className="space-y-2">
            {publicGroups.map((g) => (
              <div key={g.id} className="flex items-center justify-between border border-[var(--color-border)] bg-[var(--color-surface)] p-3">
                <div>
                  <p className="font-bold">{g.group_name}</p>
                  <p className="text-xs text-[var(--color-text-tertiary)]">{g.memberCount}/{MAX_MEMBERS} members</p>
                </div>
                <button onClick={() => joinPublic(g)} disabled={joiningId === g.id} className="shrink-0 rounded-full border border-[var(--color-border)] bg-[var(--color-elevated)] px-3 py-1.5 text-xs font-bold disabled:opacity-50">
                  {joiningId === g.id ? '...' : 'Join'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
