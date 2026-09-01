import { useEffect, useState } from 'react'
import { supabase, todayStr } from '../lib/supabase'
import { getTodayResult, saveTodayResult, bumpStreak, getInProgress, saveInProgress } from '../lib/storage'
import { buildShareText } from '../lib/share'
import { useSport } from '../context/SportContext'
import { TABLES, STAT_LINE_CONFIG, SPORT_META } from '../lib/sports'
import GameShell, { Loading, ErrorMsg } from '../components/GameShell'
import PlayerSearchInput from '../components/PlayerSearchInput'
import ShareResult from '../components/ShareResult'

const PLAYER_FIELDS = {
  nfl: 'id, full_name, position',
  mlb: 'id, full_name, position, position_group',
  nba: 'id, full_name, position',
}

export default function StatLine() {
  const { sport } = useSport()
  const gameKey = `${sport}-stat-line`
  const tables = TABLES[sport]
  const config = STAT_LINE_CONFIG[sport]

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [player, setPlayer] = useState(null)
  const [stats, setStats] = useState(null)
  const [season, setSeason] = useState(null)
  const [revealed, setRevealed] = useState(1)
  const [wrongGuesses, setWrongGuesses] = useState(0)
  const [finished, setFinished] = useState(null)
  const today = todayStr()

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    setFinished(null)
    setRevealed(1)
    setWrongGuesses(0)

    async function load() {
      const already = getTodayResult(gameKey, today)
      if (already) {
        if (!cancelled) {
          setFinished(already)
          setLoading(false)
        }
        return
      }

      const { data: daily, error: dailyErr } = await supabase
        .from(tables.statLineDaily)
        .select('player_id, season')
        .eq('game_date', today)
        .maybeSingle()
      if (dailyErr || !daily) {
        if (!cancelled) {
          setError('No Stat Line puzzle scheduled for today.')
          setLoading(false)
        }
        return
      }

      const [{ data: p }, { data: s }] = await Promise.all([
        supabase.from(tables.players).select(PLAYER_FIELDS[sport]).eq('id', daily.player_id).single(),
        supabase.from(tables.seasonStats).select('*').eq('player_id', daily.player_id).eq('season', daily.season).maybeSingle(),
      ])

      if (!cancelled) {
        setPlayer(p)
        setStats(s)
        setSeason(daily.season)
        const saved = getInProgress(gameKey, today)
        if (saved) {
          setRevealed(saved.revealed)
          setWrongGuesses(saved.wrongGuesses)
        }
        setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [today, sport, gameKey, tables.statLineDaily, tables.players, tables.seasonStats])

  const group = player ? config.groupFor(sport === 'mlb' ? player.position_group : player.position) : null
  const clues = group ? config.clues[group] : []
  const maxClues = clues.length

  function persist(nextRevealed, nextWrong) {
    saveInProgress(gameKey, today, { revealed: nextRevealed, wrongGuesses: nextWrong })
  }

  function finish(won) {
    const result = { won, cluesUsed: revealed, maxClues }
    saveTodayResult(gameKey, today, result)
    bumpStreak(gameKey, today, won)
    setFinished(result)
  }

  function handleSkip() {
    const next = Math.min(revealed + 1, maxClues)
    setRevealed(next)
    persist(next, wrongGuesses)
    if (next >= maxClues) finish(false)
  }

  function handleGuess(guessedPlayer) {
    if (guessedPlayer.id === player.id) {
      finish(true)
      return
    }
    const nextWrong = wrongGuesses + 1
    const next = Math.min(revealed + 1, maxClues)
    setWrongGuesses(nextWrong)
    setRevealed(next)
    persist(next, nextWrong)
    if (next >= maxClues) finish(false)
  }

  const title = `Stat Line — ${SPORT_META[sport].label}`

  if (loading) return <GameShell emoji="📊" title={title}><Loading /></GameShell>
  if (error) return <GameShell emoji="📊" title={title}><ErrorMsg message={error} /></GameShell>

  if (finished) {
    return (
      <GameShell emoji="📊" title={title}>
        <p className="mb-4 text-center font-semibold">
          {finished.won ? `Solved in ${finished.cluesUsed}/${finished.maxClues} clues! 🎉` : `The answer was ${player?.full_name ?? 'unknown'}.`}
        </p>
        <ShareResult text={buildShareText('stat-line', today, finished)} />
      </GameShell>
    )
  }

  return (
    <GameShell emoji="📊" title={title}>
      <div className="mb-4 flex items-center justify-between rounded-2xl border border-[var(--color-border)] bg-[var(--color-elevated)] px-4 py-3">
        <span className="font-bold">{sport === 'mlb' ? player.position_group : player.position}</span>
        <span className="text-sm text-[var(--color-text-secondary)]">{season} Season</span>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {clues.map(([key, label], i) => {
          const isRevealed = i < revealed
          return (
            <div
              key={key}
              className={`rounded-xl border p-3 ${
                isRevealed ? 'border-[var(--color-border)] bg-[var(--color-surface)]' : 'border-[var(--color-border)] bg-[var(--color-elevated)]'
              }`}
            >
              <p className="text-xs text-[var(--color-text-secondary)]">{label}</p>
              <p className="text-lg font-bold tabular-nums">{isRevealed ? (stats ? (stats[key] ?? '—') : '—') : '?'}</p>
            </div>
          )
        })}
      </div>

      <div className="mt-6">
        <PlayerSearchInput table={tables.players} onSelect={handleGuess} placeholder="Guess the player…" />
        <button
          onClick={handleSkip}
          className="mt-3 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-elevated)] py-3 text-sm font-semibold text-[var(--color-text)]"
        >
          Skip (reveal next clue)
        </button>
      </div>
    </GameShell>
  )
}
