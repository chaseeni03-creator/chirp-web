import { useEffect, useState } from 'react'
import { supabase, todayStr } from '../lib/supabase'
import { getTodayResult, saveTodayResult, bumpStreak, getInProgress, saveInProgress } from '../lib/storage'
import { buildShareText } from '../lib/share'
import { useSport } from '../context/SportContext'
import { TABLES, SPORT_META } from '../lib/sports'
import { maxScoreForHints, scoreForPlayer, summarizeSession, statLabel } from '../lib/thePath'
import GameShell, { Loading, ErrorMsg } from '../components/GameShell'
import PlayerSearchInput from '../components/PlayerSearchInput'
import ShareResult from '../components/ShareResult'
import GroupScoreBanner from '../components/GroupScoreBanner'
import DailyLeaderboardBanner from '../components/DailyLeaderboardBanner'

const MAX_GUESSES = 3

export default function ThePath() {
  const { sport } = useSport()
  const tables = TABLES[sport]

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [players, setPlayers] = useState([]) // [{ player, teams, stats, position }], ordered by slot
  const [currentIndex, setCurrentIndex] = useState(0)
  const [results, setResults] = useState([]) // accumulated PathPlayerResult-shaped objects
  const [wrongNames, setWrongNames] = useState([])
  const [statsRevealed, setStatsRevealed] = useState(false)
  const [positionRevealed, setPositionRevealed] = useState(false)
  const [solved, setSolved] = useState(false)
  const [failed, setFailed] = useState(false)
  const [finished, setFinished] = useState(null)
  const today = todayStr()
  const gameKey = `${sport}-the-path`

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    setFinished(null)

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
        .from(tables.pathDaily)
        .select('slot, player_id')
        .eq('game_date', today)
        .order('slot')
      if (dailyErr || !daily || daily.length < 5) {
        if (!cancelled) {
          setError('No Path puzzle scheduled today.')
          setLoading(false)
        }
        return
      }

      const loaded = []
      for (const row of daily) {
        const [{ data: p }, { data: path }] = await Promise.all([
          supabase.from(tables.players).select('id, full_name, position').eq('id', row.player_id).single(),
          supabase.from(tables.pathPlayers).select('position, teams, stats').eq('id', row.player_id).single(),
        ])
        if (!p || !path) continue
        loaded.push({ player: p, teams: path.teams, stats: path.stats, position: path.position || p.position })
      }
      if (cancelled) return
      if (loaded.length < 5) {
        setError('No Path puzzle scheduled today.')
        setLoading(false)
        return
      }

      const saved = getInProgress(gameKey, today)
      setPlayers(loaded)
      setCurrentIndex(saved?.currentIndex ?? 0)
      setResults(saved?.results ?? [])
      setLoading(false)
    }
    load()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [today, sport, gameKey, tables.pathDaily, tables.players, tables.pathPlayers])

  const current = players[currentIndex]
  const liveMax = maxScoreForHints({ statsRevealed, positionRevealed })

  function persist(nextResults, nextIndex) {
    saveInProgress(gameKey, today, { currentIndex: nextIndex, results: nextResults })
  }

  function handleGuess(guessed) {
    if (!current || solved || failed) return
    if (guessed.id === current.player.id) {
      setSolved(true)
      finishCurrentPlayer(true, wrongNames.length + 1)
      return
    }
    const nextWrong = [...wrongNames, guessed.full_name]
    setWrongNames(nextWrong)
    if (nextWrong.length >= MAX_GUESSES) {
      setFailed(true)
      finishCurrentPlayer(false, MAX_GUESSES)
    }
  }

  function finishCurrentPlayer(didSolve, guessesUsed) {
    const result = {
      playerId: current.player.id,
      playerName: current.player.full_name,
      solved: didSolve,
      guessesUsed,
      statsRevealed,
      positionRevealed,
      score: scoreForPlayer({ solved: didSolve, statsRevealed, positionRevealed }),
    }
    const nextResults = [...results, result]
    setResults(nextResults)
    persist(nextResults, currentIndex)
  }

  function nextPlayer() {
    if (currentIndex >= players.length - 1) {
      finishSession(results)
      return
    }
    const nextIndex = currentIndex + 1
    setCurrentIndex(nextIndex)
    setWrongNames([])
    setStatsRevealed(false)
    setPositionRevealed(false)
    setSolved(false)
    setFailed(false)
    persist(results, nextIndex)
  }

  function finishSession(finalResults) {
    const summary = summarizeSession(finalResults)
    const result = { sport, perPlayer: finalResults, ...summary }
    saveTodayResult(gameKey, today, result)
    bumpStreak(gameKey, today, summary.correctCount === 5)
    setFinished(result)
  }

  const title = `The Path — ${SPORT_META[sport].label}`
  const shell = (body) => (
    <GameShell emoji="🛤️" title={title} howToPlay="the-path">
      {body}
    </GameShell>
  )

  if (loading) return shell(<Loading />)
  if (error) return shell(<ErrorMsg message={error} />)

  if (finished) {
    return shell(
      <>
        <p className="mb-1 text-center text-2xl font-extrabold">{finished.totalScore} / 5000</p>
        <p className="mb-4 text-center text-sm text-[var(--color-text-secondary)]">{finished.correctCount}/5 solved</p>
        <div className="mb-4 space-y-2">
          {finished.perPlayer.map((p, i) => (
            <div
              key={i}
              className="flex items-center justify-between border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2.5"
            >
              <span className="flex items-center gap-2 font-semibold">
                <span>{p.solved ? '🟩' : '⬛'}</span>
                {p.playerName}
              </span>
              <span className="text-sm font-bold text-[var(--color-text-secondary)]">{p.score} pts</span>
            </div>
          ))}
        </div>
        <ShareResult text={buildShareText('the-path', today, finished)} />
        <GroupScoreBanner gameType="the-path" sport={sport} score={finished.totalScore} details={`${finished.correctCount}/5`} />
        <DailyLeaderboardBanner
          gameType="the-path"
          sport={sport}
          era={null}
          difficulty={null}
          score={finished.totalScore}
          isPerfect={finished.isPerfect}
          accuracy={finished.accuracy}
        />
      </>,
    )
  }

  if (!current) return shell(<Loading />)

  const remaining = MAX_GUESSES - wrongNames.length
  const perStintStats = (i) => current.stats?.[String(i)] ?? {}

  return shell(
    <>
      <div className="mb-4 flex items-center justify-between text-xs font-bold text-[var(--color-text-secondary)]">
        <span>
          Player {currentIndex + 1} of {players.length}
        </span>
        <div className="h-1.5 flex-1 mx-3 overflow-hidden rounded-full bg-[var(--color-elevated)]">
          <div
            className="h-full bg-[var(--color-primary)] transition-all"
            style={{ width: `${(currentIndex / players.length) * 100}%` }}
          />
        </div>
      </div>

      <div className="mb-3 flex flex-wrap gap-2">
        {current.teams.map((stint, i) => (
          <span
            key={i}
            className="rounded-full border border-[var(--color-border)] bg-[var(--color-elevated)] px-3 py-1 text-xs font-semibold"
          >
            {stint.team} {stint.year_start === stint.year_end ? stint.year_start : `${stint.year_start}–${stint.year_end}`}
          </span>
        ))}
      </div>

      {positionRevealed && <p className="mb-2 text-sm font-bold">Position: {current.position}</p>}

      {statsRevealed && (
        <div className="mb-3 space-y-1">
          {current.teams.map((stint, i) => {
            const stats = perStintStats(i)
            const parts = Object.entries(stats)
              .filter(([k, v]) => k !== 'games_played' && v != null)
              .map(([k, v]) => `${statLabel(k)}: ${v}`)
              .join(' · ')
            return (
              <p key={i} className="text-xs text-[var(--color-text-secondary)]">
                {stint.team} — {parts}
              </p>
            )
          })}
        </div>
      )}

      {!solved && !failed && (
        <div className="mb-4 flex gap-2">
          <button
            onClick={() => setStatsRevealed(true)}
            disabled={statsRevealed}
            className="flex-1 rounded-lg border border-[var(--color-primary)]/50 py-2.5 text-xs font-bold disabled:opacity-40"
          >
            {statsRevealed ? 'Stats shown ✓' : 'Show Stats'}
            {!statsRevealed && <span className="block font-normal text-[var(--color-text-tertiary)]">−50% score</span>}
          </button>
          <button
            onClick={() => setPositionRevealed(true)}
            disabled={positionRevealed}
            className="flex-1 rounded-lg border border-[var(--color-primary)]/50 py-2.5 text-xs font-bold disabled:opacity-40"
          >
            {positionRevealed ? 'Position shown ✓' : 'Show Position'}
            {!positionRevealed && <span className="block font-normal text-[var(--color-text-tertiary)]">−25% of remaining</span>}
          </button>
        </div>
      )}

      {wrongNames.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-2">
          {wrongNames.map((n, i) => (
            <span key={i} className="rounded-full bg-[var(--color-elevated)] px-3 py-1 text-xs text-[var(--color-text-tertiary)]">
              {n}
            </span>
          ))}
        </div>
      )}

      {(solved || failed) && (
        <div
          className={`mb-4 border p-4 ${
            solved ? 'border-[var(--color-success)] bg-[var(--color-success)]/10' : 'border-[var(--color-error)] bg-[var(--color-error)]/10'
          }`}
        >
          <p className="mb-1 font-bold">
            {solved ? `🎉 Correct! +${results[results.length - 1]?.score ?? 0} pts` : '😔 Out of guesses'}
          </p>
          <p className="mb-3 text-sm">The player was {current.player.full_name}</p>
          <button onClick={nextPlayer} className="w-full rounded-lg bg-[var(--color-primary)] py-3 font-bold text-white">
            {currentIndex >= players.length - 1 ? 'See Results' : 'Next Player'}
          </button>
        </div>
      )}

      {!solved && !failed && (
        <>
          <p className="mb-1.5 text-xs font-semibold text-[var(--color-text-secondary)]">
            {remaining} guess{remaining === 1 ? '' : 'es'} left · guess now for up to {liveMax} pts
          </p>
          <PlayerSearchInput table={tables.players} onSelect={handleGuess} placeholder="Guess the player…" />
        </>
      )}
    </>,
  )
}
