import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useGroup } from '../context/GroupContext'
import { GAME_LABELS, CROSS_SPORT_GAME_LABELS, sanitizeNickname } from '../lib/groups'
import { getLeaderboardIdentity, setLeaderboardNickname } from '../lib/leaderboardIdentity'
import { submitDailyScore, fetchMyRank } from '../lib/dailyLeaderboard'
import { buildLeaderboardShareText, copyToClipboard, SITE_URL } from '../lib/share'
import { todayStr } from '../lib/supabase'

const MEDAL = { 1: '👑', 2: '🥈', 3: '🥉' }
const ALL_GAME_LABELS = { ...GAME_LABELS, ...CROSS_SPORT_GAME_LABELS }

const NICKNAME_ADJECTIVES = [
  'Blazing', 'Clutch', 'Iron', 'Golden', 'Swift', 'Mighty', 'Rowdy', 'Fierce',
  'Sneaky', 'Turbo', 'Prime', 'Wild', 'Elite', 'Savage', 'Lucky', 'Rapid',
  'Bold', 'Silent', 'Electric', 'Cosmic',
]
const NICKNAME_NOUNS = [
  'Blitz', 'Slugger', 'Hustler', 'Baller', 'Striker', 'Ace', 'Cannon', 'Hawk',
  'Rocket', 'Titan', 'Maverick', 'Legend', 'Rebel', 'Comet', 'Tornado',
  'Falcon', 'Bandit', 'Champ', 'Sniper', 'Cleat',
]

function generateNickname() {
  const adjective = NICKNAME_ADJECTIVES[Math.floor(Math.random() * NICKNAME_ADJECTIVES.length)]
  const noun = NICKNAME_NOUNS[Math.floor(Math.random() * NICKNAME_NOUNS.length)]
  return `${adjective} ${noun}`
}

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
      gameLabel: ALL_GAME_LABELS[gameType] || gameType,
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

  // A one-time gate, not an inline form — this is the first (and only) time
  // anyone is asked, on any game, across the whole site (leaderboardIdentity.js
  // is shared, not per-game). Deliberately no skip/dismiss: submitting to the
  // leaderboard has always required a nickname (this only changes how it's
  // asked for), and until one's set this reappears after every game exactly
  // as the plain inline version it replaces did.
  if (state === 'needs-nickname') {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
        <form
          onSubmit={handleNicknameSubmit}
          className="w-full max-w-sm rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5"
        >
          <p className="text-lg font-extrabold">What should we call you on the leaderboard? 🏆</p>
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
            Pick a nickname — you'll only be asked once, and it's used on every leaderboard from here on.
          </p>

          <input
            autoFocus
            value={nicknameInput}
            onChange={(e) => setNicknameInput(e.target.value)}
            maxLength={20}
            placeholder="Nickname"
            className="mt-4 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-elevated)] px-4 py-2.5 text-sm outline-none focus:border-[var(--color-primary)]"
          />

          <button
            type="button"
            onClick={() => setNicknameInput(generateNickname())}
            className="mt-2 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-elevated)] py-2 text-xs font-bold text-[var(--color-text-secondary)] hover:text-[var(--color-text)]"
          >
            🎲 Suggest a name for me
          </button>

          <button
            type="submit"
            disabled={!nicknameInput.trim()}
            className="mt-4 w-full rounded-xl bg-[var(--color-primary)] py-3 text-sm font-bold text-white disabled:opacity-40"
          >
            Confirm
          </button>
        </form>
      </div>
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
            {ALL_GAME_LABELS[gameType] || gameType}
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
