import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useGroup } from '../context/GroupContext'
import { GAME_LABELS, fetchBestScore, submitGroupScore, fetchGroupLeaderboard } from '../lib/groups'

const MEDAL = { 1: '🥇', 2: '🥈', 3: '🥉' }

/** Submits a group score on mount and shows the "submitted / rank / new best or leading?" banner. No-op if the visitor isn't in a group. */
export default function GroupScoreBanner({ gameType, sport, era, score, details }) {
  const { activeGroup, user } = useGroup()
  const [state, setState] = useState('idle') // idle | submitting | done | error
  const [message, setMessage] = useState(null)
  const ran = useRef(false)

  useEffect(() => {
    if (!activeGroup || ran.current) return
    ran.current = true
    setState('submitting')

    async function run() {
      const before = await fetchBestScore({ groupId: activeGroup.id, nickname: user.nickname, gameType, sport })
      const priorBest = before?.score ?? 0
      const isNewBest = score > priorBest

      await submitGroupScore({ groupId: activeGroup.id, nickname: user.nickname, gameType, sport, era, score, details })

      const board = await fetchGroupLeaderboard({ groupId: activeGroup.id, sport })
      const entries = (board[gameType] || []).filter((e) => e.played)
      const mine = entries.find((e) => e.nickname === user.nickname)
      const myRank = mine?.rank ?? null
      const leader = entries[0]
      const chaser = entries[1]

      let text
      if (myRank === 1) {
        if (isNewBest) {
          text = `🔥 New best! ${score.toLocaleString()}pts. Your score is now leading ${activeGroup.name}!`
        } else if (chaser) {
          text = `You are leading ${activeGroup.name}! 🏆 ${chaser.nickname} is ${(mine.score - chaser.score).toLocaleString()}pts behind you.`
        } else {
          text = `You are leading ${activeGroup.name}! 🏆`
        }
      } else if (isNewBest) {
        const gap = leader ? (leader.score - score).toLocaleString() : null
        text = leader
          ? `🔥 New best! ${score.toLocaleString()}pts. ${leader.nickname} leads by ${gap}pts — try another era!`
          : `🔥 New best! ${score.toLocaleString()}pts on the group leaderboard!`
      } else {
        text = `${score.toLocaleString()}pts — not your best yet. Try another era to beat your top score of ${priorBest.toLocaleString()}pts.`
      }

      setMessage({ text, rank: myRank })
      setState('done')
    }
    run().catch(() => setState('error'))
  }, [activeGroup, user, gameType, sport, era, score, details])

  if (!activeGroup || state === 'idle' || state === 'error') return null

  if (state === 'submitting') {
    return (
      <div className="mt-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-elevated)] p-3 text-center text-sm text-[var(--color-text-secondary)]">
        Submitting to {activeGroup.name}…
      </div>
    )
  }

  return (
    <div className="mt-4 rounded-xl border border-[var(--color-primary)]/40 bg-[var(--color-primary)]/10 p-3 text-sm">
      <p className="font-bold">Score submitted to {activeGroup.name}! 🎉</p>
      {message.rank != null && (
        <p className="mt-1 text-[var(--color-text-secondary)]">
          You're currently {MEDAL[message.rank] ?? `#${message.rank}`} in {GAME_LABELS[gameType]}
        </p>
      )}
      <p className="mt-1 font-semibold">{message.text}</p>
      <Link to="/groups" className="mt-2 inline-block font-bold text-[var(--color-primary)] hover:underline">
        View Group Leaderboard →
      </Link>
    </div>
  )
}
