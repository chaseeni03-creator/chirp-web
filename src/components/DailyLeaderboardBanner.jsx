import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useGroup } from '../context/GroupContext'
import { GAME_LABELS, CROSS_SPORT_GAME_LABELS, sanitizeNickname } from '../lib/groups'
import {
  getLeaderboardIdentity, claimNickname, loginWithNickname, checkNicknameAvailable, NicknameTakenError,
} from '../lib/leaderboardIdentity'
import { submitDailyScore, fetchMyRank, fetchDailyLeaderboardTop } from '../lib/dailyLeaderboard'
import { checkAndAwardBadges, fetchMyStreak } from '../lib/badges'
import BadgePopup from './BadgePopup'
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

function randomCombo() {
  const adjective = NICKNAME_ADJECTIVES[Math.floor(Math.random() * NICKNAME_ADJECTIVES.length)]
  const noun = NICKNAME_NOUNS[Math.floor(Math.random() * NICKNAME_NOUNS.length)]
  return `${adjective} ${noun}`
}

/** Skips a suggestion someone's already claimed — tries a handful of fresh combos first (400 possible, collisions should be rare), then falls back to a numbered variant so the button never just fails. */
async function generateNickname() {
  for (let attempt = 0; attempt < 10; attempt++) {
    const candidate = randomCombo()
    if (await checkNicknameAvailable(candidate)) return candidate
  }
  return `${randomCombo()} ${Math.floor(10 + Math.random() * 90)}`
}

/**
 * Submits today's score to the GLOBAL leaderboard on mount and shows a
 * "you ranked #N" banner — unlike GroupScoreBanner (which this is modeled
 * on), this is never gated on group membership; every player lands on the
 * board. Guests are prompted for a nickname once (saved to localStorage via
 * leaderboardIdentity.js) before their first submission ever goes through.
 */
export default function DailyLeaderboardBanner({ gameType, sport, era, difficulty, score, isPerfect = false, accuracy = null }) {
  const { googleSession } = useGroup()
  const [identity, setIdentity] = useState(getLeaderboardIdentity)
  const [nicknameInput, setNicknameInput] = useState('')
  const [pinInput, setPinInput] = useState('')
  const [mode, setMode] = useState('claim') // claim | login — which form the needs-nickname modal shows
  const [nicknameTaken, setNicknameTaken] = useState(false)
  const [identityBusy, setIdentityBusy] = useState(false)
  const [identityError, setIdentityError] = useState(null)
  const [generating, setGenerating] = useState(false)
  const [state, setState] = useState('idle') // idle | needs-nickname | submitting | done | error
  const [result, setResult] = useState(null) // { rank, totalPlayers }
  const [top10, setTop10] = useState(null)
  const [copied, setCopied] = useState(false)
  const [newBadges, setNewBadges] = useState([])
  const [streak, setStreak] = useState(null)
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
      const [mine, top] = await Promise.all([
        fetchMyRank({ gameType, sport, userId }),
        fetchDailyLeaderboardTop({ gameType, sport, limit: 10 }),
      ])
      setResult(mine)
      setTop10(top)
      setState('done')
      // Badge/streak checks run after the score is already safely submitted
      // and shown — a hiccup here (both fail open, see badges.js) should
      // never block or delay the player seeing their actual rank.
      const [badges, myStreak] = await Promise.all([
        checkAndAwardBadges({ gameType, sport, isPerfect, accuracy, score, rank: mine?.rank ?? null, userId }),
        fetchMyStreak(userId).catch(() => null),
      ])
      setNewBadges(badges)
      setStreak(myStreak)
    } catch (err) {
      console.error('Daily leaderboard submit failed:', err)
      setState('error')
    }
  }

  async function handleGenerateClick() {
    setGenerating(true)
    try {
      setNicknameInput(await generateNickname())
    } finally {
      setGenerating(false)
    }
  }

  async function handleClaimSubmit(e) {
    e.preventDefault()
    const clean = sanitizeNickname(nicknameInput)
    if (!clean || !/^\d{4}$/.test(pinInput)) return
    setIdentityBusy(true)
    setIdentityError(null)
    setNicknameTaken(false)
    try {
      const next = await claimNickname(clean, pinInput)
      setIdentity(next)
      submit(clean)
    } catch (err) {
      if (err instanceof NicknameTakenError) setNicknameTaken(true)
      else setIdentityError(err.message || "Couldn't save that nickname")
    } finally {
      setIdentityBusy(false)
    }
  }

  async function handleLoginSubmit(e) {
    e.preventDefault()
    const clean = sanitizeNickname(nicknameInput)
    if (!clean || !/^\d{4}$/.test(pinInput)) return
    setIdentityBusy(true)
    setIdentityError(null)
    try {
      const next = await loginWithNickname(clean, pinInput)
      setIdentity(next)
      submit(next.nickname)
    } catch (err) {
      setIdentityError(err.message || "Couldn't log in")
    } finally {
      setIdentityBusy(false)
    }
  }

  async function handleShare() {
    if (!result) return
    const text = buildLeaderboardShareText({
      gameLabel: ALL_GAME_LABELS[gameType] || gameType,
      sport,
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
    const isLogin = mode === 'login'
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
        <form
          onSubmit={isLogin ? handleLoginSubmit : handleClaimSubmit}
          className="w-full max-w-sm rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5"
        >
          {isLogin ? (
            <>
              <p className="text-lg font-extrabold">Log in with your nickname 🏆</p>
              <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                Pick up your existing identity and score history on this browser.
              </p>
            </>
          ) : (
            <>
              <p className="text-lg font-extrabold">What should we call you on the leaderboard? 🏆</p>
              <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                Pick a nickname and a 4-digit PIN — the PIN lets you log back in as the same identity on another
                device, and it's used on every leaderboard from here on.
              </p>
            </>
          )}

          <input
            autoFocus
            value={nicknameInput}
            onChange={(e) => {
              setNicknameInput(e.target.value)
              setNicknameTaken(false)
            }}
            maxLength={20}
            placeholder="Nickname"
            className="mt-4 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-elevated)] px-4 py-2.5 text-sm outline-none focus:border-[var(--color-primary)]"
          />

          {!isLogin && (
            <button
              type="button"
              onClick={handleGenerateClick}
              disabled={generating}
              className="mt-2 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-elevated)] py-2 text-xs font-bold text-[var(--color-text-secondary)] hover:text-[var(--color-text)] disabled:opacity-60"
            >
              {generating ? 'Thinking…' : '🎲 Suggest a name for me'}
            </button>
          )}

          <input
            type="text"
            inputMode="numeric"
            value={pinInput}
            onChange={(e) => setPinInput(e.target.value.replace(/\D/g, '').slice(0, 4))}
            maxLength={4}
            placeholder="PIN (4 digits)"
            className="mt-2 w-28 rounded-xl border border-[var(--color-border)] bg-[var(--color-elevated)] px-4 py-2.5 text-center text-sm tracking-widest outline-none focus:border-[var(--color-primary)]"
          />

          {nicknameTaken && (
            <div className="mt-3 rounded-xl border border-[var(--color-warning)]/40 bg-[var(--color-warning)]/10 p-3 text-xs">
              <p>{nicknameInput} is already taken.</p>
              <button
                type="button"
                onClick={() => {
                  setMode('login')
                  setNicknameTaken(false)
                }}
                className="mt-1 font-bold text-[var(--color-primary)] underline"
              >
                Is it yours? Log in with its PIN instead →
              </button>
            </div>
          )}
          {identityError && <p className="mt-3 text-xs text-[var(--color-primary)]">{identityError}</p>}

          <button
            type="submit"
            disabled={!nicknameInput.trim() || pinInput.length !== 4 || identityBusy}
            className="mt-4 w-full rounded-xl bg-[var(--color-primary)] py-3 text-sm font-bold text-white disabled:opacity-40"
          >
            {identityBusy ? '…' : isLogin ? 'Log In' : 'Confirm'}
          </button>

          <button
            type="button"
            onClick={() => {
              setMode(isLogin ? 'claim' : 'login')
              setNicknameTaken(false)
              setIdentityError(null)
            }}
            className="mt-3 w-full text-center text-xs text-[var(--color-text-tertiary)] underline"
          >
            {isLogin ? "Don't have a nickname yet? Pick one" : 'Already have a nickname? Log in instead'}
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
      <BadgePopup badges={newBadges} />
      {streak && streak.current_streak > 0 && (
        <div className="mb-2 flex items-center justify-center gap-4 rounded-lg bg-[var(--color-elevated)] py-2 text-xs font-bold">
          <span>🔥 {streak.current_streak}-day streak</span>
          {streak.longest_streak > streak.current_streak && (
            <span className="text-[var(--color-text-tertiary)]">Best: {streak.longest_streak}</span>
          )}
        </div>
      )}
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

          {top10 && top10.length > 0 && (
            <div className="mt-4 border-t border-[var(--color-primary)]/20 pt-3">
              <p className="mb-2 text-xs font-bold tracking-wide text-[var(--color-text-secondary)]">
                TODAY'S TOP {top10.length}
              </p>
              <div className="space-y-1">
                {top10.map((row, i) => {
                  const isMe = row.nickname === identity.nickname
                  return (
                    <div
                      key={`${row.nickname}-${i}`}
                      className={`flex items-center justify-between rounded-lg px-2 py-1 text-sm ${
                        isMe ? 'bg-[var(--color-primary)]/15 font-bold' : ''
                      }`}
                    >
                      <span className="flex min-w-0 items-center gap-1.5">
                        <span className="w-6 shrink-0 text-center text-xs text-[var(--color-text-secondary)]">
                          {MEDAL[row.rank] ?? row.rank}
                        </span>
                        <span className="truncate">
                          {row.nickname}
                          {isMe && <span className="ml-1 text-[var(--color-primary)]">(you)</span>}
                        </span>
                      </span>
                      <span className="shrink-0 tabular-nums">{row.score.toLocaleString()}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </>
      ) : (
        <p className="font-semibold text-[var(--color-text-secondary)]">
          Score submitted to the {SITE_URL} leaderboard!
        </p>
      )}
    </div>
  )
}
