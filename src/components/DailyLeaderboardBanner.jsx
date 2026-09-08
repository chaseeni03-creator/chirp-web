import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useGroup } from '../context/GroupContext'
import { GAME_LABELS, sanitizeNickname } from '../lib/groups'
import { getLeaderboardIdentity, setLeaderboardNickname } from '../lib/leaderboardIdentity'
import { submitDailyScore, fetchMyRank } from '../lib/dailyLeaderboard'
import { buildLeaderboardShareText, copyToClipboard, SITE_URL } from '../lib/share'
import { todayStr } from '../lib/supabase'

const MEDAL = { 1: '👑', 2: '🥈', 3: '🥉' }

/**
 * Submits today's score to the GLOBAL leaderboard on mount and shows a
 * "you ranked #N" banner — unlike GroupScoreBanner (which this is modeled
 * on), this is never gated on group membership; every player lands on the
 * board. Guests are prompted for a nickname once (saved to localStorage via
 * leaderboardIdentity.js) before their first submission ever goes through.
 */
export default function DailyLeaderboardBanner({ gameType, sport, era, difficulty, score }) {
  const { googleSession } = useGroup()
  const [identity, setIdentity] = useState(getLeaderboardIdentity)
  const [nicknameInput, setNicknameInput] = useState('')
  const [state, setState] = useState('idle') // idle | needs-nickname | submitting | done | error
  const [result, setResult] = useState(null) // { rank, totalPlayers }
  const [copied, setCopied] = useState(false)
  const ran = useRef(false)

  const userId = googleSession?.user?.id ?? null

  useEffect(() => {
    if (ran.current) return
    ran.current = true
    if (!identity.nickname) {
      setState('needs-nickname')
      return
    }
    submit(identity.nickname)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function submit(nickname) {
    setState('submitting')
    try {
      await submitDailyScore({ gameType, sport, nickname, score, userId, era, difficulty })
      const mine = await fetchMyRank({ gameType, sport, userId })
      setResult(mine)
      setState('done')
    } catch (err) {
      console.error('Daily leaderboard submit failed:', err)
      setState('error')
    }
  }

  function handleNicknameSubmit(e) {
    e.preventDefault()
    const clean = sanitizeNickname(nicknameInput)
    if (!clean) return
    const next = setLeaderboardNickname(clean)
    setIdentity(next)
    submit(clean)
  }

  async function handleShare() {
    if (!result) return
    const text = buildLeaderboardShareText({
      gameLabel: GAME_LABELS[gameType] || gameType,
      dateStr: todayStr(),
      rank: result.rank,
      totalPlayers: result.total_players,
      score,
    })
    const ok = await copyToClipboard(text)
    setCopied(ok)
    if (ok) setTimeout(() => setCopied(false), 2000)
  }

  if (state === 'idle' || state === 'error') return null

  if (state === 'needs-nickname') {
    return (
      <form
        onSubmit={handleNicknameSubmit}
        className="mt-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-elevated)] p-3"
      >
        <p className="mb-2 text-sm font-bold">What should we call you on the leaderboard?</p>
        <div className="flex gap-2">
          <input
            autoFocus
            value={nicknameInput}
            onChange={(e) => setNicknameInput(e.target.value)}
            maxLength={20}
            placeholder="Nickname"
            className="min-w-0 flex-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm"
          />
          <button
            type="submit"
            disabled={!nicknameInput.trim()}
            className="shrink-0 rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-bold text-white disabled:opacity-40"
          >
            Submit Score
          </button>
        </div>
      </form>
    )
  }

  if (state === 'submitting') {
    return (
      <div className="mt-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-elevated)] p-3 text-center text-sm text-[var(--color-text-secondary)]">
        Submitting to the leaderboard…
      </div>
    )
  }

  return (
    <div className="mt-4 rounded-xl border border-[var(--color-primary)]/40 bg-[var(--color-primary)]/10 p-3 text-sm">
      {result ? (
        <>
          <p className="font-bold">
            You ranked {MEDAL[result.rank] ? `${MEDAL[result.rank]} #${result.rank}` : `#${result.rank}`} today in{' '}
            {GAME_LABELS[gameType] || gameType}
            {result.total_players ? ` out of ${result.total_players.toLocaleString()} players!` : '!'}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              onClick={handleShare}
              className="rounded-lg bg-[var(--color-primary)] px-3 py-1.5 text-xs font-bold text-white"
            >
              {copied ? 'Copied!' : 'Share Your Rank'}
            </button>
            <Link
              to={`/leaderboard?game=${gameType}&sport=${sport}`}
              className="rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-xs font-bold text-[var(--color-text-secondary)] hover:text-[var(--color-text)]"
            >
              View full leaderboard →
            </Link>
          </div>
        </>
      ) : (
        <p className="font-semibold text-[var(--color-text-secondary)]">
          Score submitted to the {SITE_URL} leaderboard!
        </p>
      )}
    </div>
  )
}
