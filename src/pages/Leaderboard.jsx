import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import GameShell from '../components/GameShell'
import { useSport } from '../context/SportContext'
import { useGroup } from '../context/GroupContext'
import { GAME_LABELS, GAME_ORDER, CROSS_SPORT_GAME_LABELS, eraLabel } from '../lib/groups'
import { SPORTS, SPORT_META } from '../lib/sports'
import { fetchDailyLeaderboardTop, fetchMyRank, subscribeToDailyLeaderboard, yesterdayStr } from '../lib/dailyLeaderboard'
import { todayStr } from '../lib/supabase'
import { buildLeaderboardShareText, copyToClipboard, friendlyDate } from '../lib/share'

const MEDAL = { 1: '👑', 2: '🥈', 3: '🥉' }

// Every selectable game on this page — per-sport games plus the cross-sport
// ones (kept out of GAME_ORDER itself; see groups.js). Cross-sport games
// always query/display sport='all' regardless of the site's sport tab.
const ALL_GAME_TYPES = [...GAME_ORDER, ...Object.keys(CROSS_SPORT_GAME_LABELS)]
const ALL_GAME_LABELS = { ...GAME_LABELS, ...CROSS_SPORT_GAME_LABELS }

export default function Leaderboard() {
  const [searchParams] = useSearchParams()
  const { sport, setSport } = useSport()
  const { googleSession } = useGroup()
  const [gameType, setGameType] = useState(() => {
    const requested = searchParams.get('game')
    return requested && ALL_GAME_TYPES.includes(requested) ? requested : ALL_GAME_TYPES[0]
  })
  const isCrossSport = gameType in CROSS_SPORT_GAME_LABELS
  const effectiveSport = isCrossSport ? 'all' : sport
  const [period, setPeriod] = useState('today') // 'today' | 'yesterday'
  const [rows, setRows] = useState([])
  const [mine, setMine] = useState(null)
  const [loading, setLoading] = useState(true)
  const [live, setLive] = useState(false)
  const [copied, setCopied] = useState(false)

  // A link from a just-finished game (DailyLeaderboardBanner) can request a
  // specific sport too — only applied once, on arrival.
  useEffect(() => {
    const requestedSport = searchParams.get('sport')
    if (requestedSport && SPORTS.includes(requestedSport)) setSport(requestedSport)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const gameDate = period === 'today' ? todayStr() : yesterdayStr()
  const userId = googleSession?.user?.id ?? null

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [top, myRank] = await Promise.all([
        fetchDailyLeaderboardTop({ gameType, sport: effectiveSport, gameDate }),
        fetchMyRank({ gameType, sport: effectiveSport, gameDate, userId }),
      ])
      setRows(top)
      setMine(myRank)
    } catch (err) {
      console.error('Leaderboard load failed:', err)
      setRows([])
      setMine(null)
    } finally {
      setLoading(false)
    }
  }, [gameType, effectiveSport, gameDate, userId])

  useEffect(() => {
    load()
  }, [load])

  // Live updates only make sense for "Today" — yesterday's board is final.
  useEffect(() => {
    if (period !== 'today') {
      setLive(false)
      return
    }
    setLive(true)
    const unsubscribe = subscribeToDailyLeaderboard(
      gameDate,
      (payload) => {
        const row = payload.new || payload.old
        if (row && row.game_type === gameType && row.sport === effectiveSport) load()
      },
      () => setLive(false)
    )
    return unsubscribe
  }, [gameDate, gameType, effectiveSport, period, load])

  async function handleShare() {
    if (!mine) return
    const text = buildLeaderboardShareText({
      gameLabel: ALL_GAME_LABELS[gameType],
      dateStr: gameDate,
      rank: mine.rank,
      totalPlayers: mine.total_players,
      score: mine.score,
    })
    const ok = await copyToClipboard(text)
    setCopied(ok)
    if (ok) setTimeout(() => setCopied(false), 2000)
  }

  return (
    <GameShell emoji="🏆" title="Leaderboard">
      <div className="mb-3 flex gap-1.5 overflow-x-auto pb-1">
        {ALL_GAME_TYPES.map((g) => (
          <button
            key={g}
            onClick={() => setGameType(g)}
            className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-bold transition-colors ${
              gameType === g
                ? 'bg-[var(--color-primary)] text-white'
                : 'border border-[var(--color-border)] bg-[var(--color-elevated)] text-[var(--color-text-secondary)]'
            }`}
          >
            {ALL_GAME_LABELS[g]}
          </button>
        ))}
      </div>

      {/* Cross-sport games (like Before or After) have no sport to pick —
          they always show the one global board, so this row just doesn't
          apply and is hidden rather than shown-but-inert. */}
      {!isCrossSport && (
        <div className="mb-4 flex gap-1.5">
          {SPORTS.map((s) => {
            const meta = SPORT_META[s]
            return (
              <button
                key={s}
                onClick={() => setSport(s)}
                className={`rounded-full px-3 py-1.5 text-xs font-bold transition-colors ${
                  sport === s
                    ? 'bg-[var(--color-primary)] text-white'
                    : 'border border-[var(--color-border)] bg-[var(--color-elevated)] text-[var(--color-text-secondary)]'
                }`}
              >
                {meta.emoji} {meta.label}
              </button>
            )
          })}
        </div>
      )}

      <div className="mb-4 flex gap-4 text-sm">
        <button
          onClick={() => setPeriod('today')}
          className={`font-bold ${period === 'today' ? 'text-[var(--color-primary)]' : 'text-[var(--color-text-secondary)]'}`}
        >
          Today
        </button>
        <button
          onClick={() => setPeriod('yesterday')}
          className={`font-bold ${period === 'yesterday' ? 'text-[var(--color-primary)]' : 'text-[var(--color-text-secondary)]'}`}
        >
          Yesterday's Champions
        </button>
      </div>

      <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-elevated)] p-4">
        <div className="mb-1 flex items-start justify-between gap-2">
          <p className="font-extrabold">
            🏆 {period === 'today' ? "Today's" : "Yesterday's"} {ALL_GAME_LABELS[gameType]} Leaders
          </p>
          {live && <span className="shrink-0 text-xs font-bold text-red-500">🔴 Live</span>}
        </div>
        <p className="mb-3 text-xs text-[var(--color-text-secondary)]">
          {isCrossSport ? 'All Sports' : SPORT_META[sport].label} · {friendlyDate(gameDate)}
        </p>

        {loading ? (
          <p className="py-6 text-center text-sm text-[var(--color-text-secondary)]">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="py-6 text-center text-sm text-[var(--color-text-secondary)]">
            No scores yet {period === 'today' ? 'today' : 'yesterday'}.
          </p>
        ) : (
          <ol className="space-y-1.5">
            {rows.map((r) => {
              const label = eraLabel(effectiveSport, r.era)
              return (
                <li key={`${r.rank}-${r.nickname}`} className="flex items-center justify-between text-sm">
                  <span>
                    {MEDAL[r.rank] ? `${MEDAL[r.rank]} ` : ''}#{r.rank} {r.nickname}
                  </span>
                  <span className="font-bold">
                    {r.score.toLocaleString()} pts{label && <span className="font-normal text-[var(--color-text-secondary)]"> ({label})</span>}
                  </span>
                </li>
              )
            })}
          </ol>
        )}

        {mine && (
          <>
            <p className="mt-3 border-t border-[var(--color-border)] pt-3 text-sm font-bold">
              Your rank: #{mine.rank.toLocaleString()} of {mine.total_players.toLocaleString()} players
            </p>
            <button
              onClick={handleShare}
              className="mt-2 w-full rounded-xl bg-[var(--color-primary)] py-2.5 text-sm font-bold text-white"
            >
              {copied ? 'Copied!' : 'Share Your Rank'}
            </button>
          </>
        )}
      </div>
    </GameShell>
  )
}
