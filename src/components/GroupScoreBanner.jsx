import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useGroup } from '../context/GroupContext'
import { GAME_LABELS, fetchBestScore, submitGroupScore, fetchGroupLeaderboard } from '../lib/groups'

const MEDAL = { 1: '🥇', 2: '🥈', 3: '🥉' }

/** Submits a group score on mount and shows the "submitted / rank / new best?" banner. No-op if the visitor isn't in a group. */
export default function GroupScoreBanner({ gameType, sport, era, score, details }) {
  const { group } = useGroup()
  const [state, setState] = useState('idle') // idle | submitting | done | error
  const [rank, setRank] = useState(null)
  const [isNewBest, setIsNewBest] = useState(false)
  const [priorBest, setPriorBest] = useState(0)
  const ran = useRef(false)

  useEffect(() => {
    if (!group || ran.current) return
    ran.current = true
    setState('submitting')

    async function run() {
      const before = await fetchBestScore({ groupId: group.id, nickname: group.nickname, gameType, sport })
      await submitGroupScore({ groupId: group.id, nickname: group.nickname, gameType, sport, era, score, details })
      const board = await fetchGroupLeaderboard({ groupId: group.id, sport })
      const mine = board[gameType]?.find((e) => e.nickname === group.nickname)
      setRank(mine?.rank ?? null)
      setPriorBest(before?.score ?? 0)
      setIsNewBest(score > (before?.score ?? 0))
      setState('done')
    }
    run().catch(() => setState('error'))
  }, [group, gameType, sport, era, score, details])

  if (!group || state === 'idle' || state === 'error') return null

  if (state === 'submitting') {
    return (
      <div className="mt-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-elevated)] p-3 text-center text-sm text-[var(--color-text-secondary)]">
        Submitting to {group.name}…
      </div>
    )
  }

  return (
    <div className="mt-4 rounded-xl border border-[var(--color-primary)]/40 bg-[var(--color-primary)]/10 p-3 text-sm">
      <p className="font-bold">Score submitted to {group.name}! 🎉</p>
      {rank != null && (
        <p className="mt-1 text-[var(--color-text-secondary)]">
          You're currently {MEDAL[rank] ?? `#${rank}`} in {GAME_LABELS[gameType]}
        </p>
      )}
      {isNewBest ? (
        <p className="mt-1 font-semibold text-[var(--color-success)]">🔥 New personal best! {score.toLocaleString()}pts on the group leaderboard.</p>
      ) : (
        <p className="mt-1 text-[var(--color-text-secondary)]">
          {score.toLocaleString()}pts — not your best yet. Try another era to beat your top score of {priorBest.toLocaleString()}pts.
        </p>
      )}
      <Link to="/groups" className="mt-2 inline-block font-bold text-[var(--color-primary)] hover:underline">
        View Group Leaderboard →
      </Link>
    </div>
  )
}
