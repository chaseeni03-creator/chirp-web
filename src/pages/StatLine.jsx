import { useEffect, useState } from 'react'
import { supabase, todayStr } from '../lib/supabase'
import { getTodayResult, saveTodayResult, bumpStreak, getInProgress, saveInProgress } from '../lib/storage'
import { buildShareText } from '../lib/share'
import Seo from '../components/Seo'
import GameShell, { Loading, ErrorMsg } from '../components/GameShell'
import PlayerSearchInput from '../components/PlayerSearchInput'
import ShareResult from '../components/ShareResult'

const GAME_KEY = 'stat-line'

const CLUES_BY_GROUP = {
  QB: [
    ['team', 'Team'],
    ['games_played', 'Games'],
    ['passing_completions', 'Completions'],
    ['passing_attempts', 'Attempts'],
    ['passing_yards', 'Pass Yards'],
    ['passing_touchdowns', 'Pass TDs'],
    ['interceptions_thrown', 'INTs'],
    ['passer_rating', 'Rating'],
  ],
  RB: [
    ['team', 'Team'],
    ['games_played', 'Games'],
    ['rushing_attempts', 'Carries'],
    ['rushing_yards', 'Rush Yards'],
    ['rushing_touchdowns', 'Rush TDs'],
    ['receptions', 'Receptions'],
    ['receiving_yards', 'Rec Yards'],
  ],
  REC: [
    ['team', 'Team'],
    ['games_played', 'Games'],
    ['targets', 'Targets'],
    ['receptions', 'Receptions'],
    ['receiving_yards', 'Rec Yards'],
    ['receiving_touchdowns', 'Rec TDs'],
    ['yards_per_reception', 'Yds/Rec'],
  ],
  DEF: [
    ['team', 'Team'],
    ['games_played', 'Games'],
    ['tackles', 'Tackles'],
    ['sacks', 'Sacks'],
    ['interceptions_caught', 'INTs'],
    ['forced_fumbles', 'Forced Fum'],
    ['passes_defended', 'Pass Def'],
  ],
}

function groupFor(position) {
  if (position === 'QB') return 'QB'
  if (position === 'RB' || position === 'FB') return 'RB'
  if (['WR', 'TE'].includes(position)) return 'REC'
  return 'DEF'
}

export default function StatLine() {
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
    async function load() {
      const already = getTodayResult(GAME_KEY, today)
      if (already) {
        if (!cancelled) {
          setFinished(already)
          setLoading(false)
        }
        return
      }

      const { data: daily, error: dailyErr } = await supabase
        .from('stat_line_daily')
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
        supabase.from('nfl_players').select('id, full_name, position').eq('id', daily.player_id).single(),
        supabase
          .from('nfl_season_stats')
          .select('*')
          .eq('player_id', daily.player_id)
          .eq('season', daily.season)
          .maybeSingle(),
      ])

      if (!cancelled) {
        setPlayer(p)
        setStats(s)
        setSeason(daily.season)
        const saved = getInProgress(GAME_KEY, today)
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
  }, [today])

  const clues = player ? CLUES_BY_GROUP[groupFor(player.position)] : []
  const maxClues = clues.length

  function persist(nextRevealed, nextWrong) {
    saveInProgress(GAME_KEY, today, { revealed: nextRevealed, wrongGuesses: nextWrong })
  }

  function finish(won) {
    const result = { won, cluesUsed: revealed, maxClues }
    saveTodayResult(GAME_KEY, today, result)
    bumpStreak(GAME_KEY, today, won)
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

  if (loading) return <GameShell emoji="📊" title="Stat Line"><Loading /></GameShell>
  if (error) return <GameShell emoji="📊" title="Stat Line"><ErrorMsg message={error} /></GameShell>

  if (finished) {
    return (
      <GameShell emoji="📊" title="Stat Line">
        <p className="mb-4 text-center font-semibold">
          {finished.won ? `Solved in ${finished.cluesUsed}/${finished.maxClues} clues! 🎉` : `The answer was ${player?.full_name ?? 'unknown'}.`}
        </p>
        <ShareResult text={buildShareText(GAME_KEY, today, finished)} />
      </GameShell>
    )
  }

  return (
    <GameShell emoji="📊" title="Stat Line">
      <Seo title="Stat Line" description="Identify the NFL player from a progressively revealed season stat line." />

      <div className="mb-4 flex items-center justify-between rounded-2xl border border-[var(--color-border)] bg-[var(--color-elevated)] px-4 py-3">
        <span className="font-bold">{player.position}</span>
        <span className="text-sm text-[var(--color-text-secondary)]">{season} Season</span>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {clues.map(([key, label], i) => {
          const isRevealed = i < revealed
          return (
            <div
              key={key}
              className={`rounded-xl border p-3 ${
                isRevealed
                  ? 'border-[var(--color-border)] bg-[var(--color-surface)]'
                  : 'border-[var(--color-border)] bg-[var(--color-elevated)]'
              }`}
            >
              <p className="text-xs text-[var(--color-text-secondary)]">{label}</p>
              <p className="text-lg font-bold tabular-nums">
                {isRevealed ? (stats ? (stats[key] ?? '—') : '—') : '?'}
              </p>
            </div>
          )
        })}
      </div>

      <div className="mt-6">
        <PlayerSearchInput onSelect={handleGuess} placeholder="Guess the player…" />
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
