import { useEffect, useState } from 'react'
import { supabase, todayStr } from '../lib/supabase'
import { getTodayResult, saveTodayResult, bumpStreak, getInProgress, saveInProgress } from '../lib/storage'
import { buildShareText } from '../lib/share'
import { useSport } from '../context/SportContext'
import { TABLES, SPORT_META } from '../lib/sports'
import { CHIRP_GUESS_FIELDS, CHIRP_GUESS_HEADERS, compareChirpGuess } from '../lib/chirpGuess'
import GameShell, { Loading, ErrorMsg } from '../components/GameShell'
import PlayerSearchInput from '../components/PlayerSearchInput'
import ShareResult from '../components/ShareResult'

const MAX_GUESSES = 8

const tileColor = {
  green: 'bg-[var(--color-success)]/20 border-[var(--color-success)] text-[var(--color-success)]',
  orange: 'bg-[var(--color-warning)]/20 border-[var(--color-warning)] text-[var(--color-warning)]',
  grey: 'bg-[var(--color-elevated)] border-[var(--color-border)] text-[var(--color-text-secondary)]',
}

export default function ChirpGuess() {
  const { sport } = useSport()
  const gameKey = `${sport}-chirp-guess`
  const tables = TABLES[sport]
  const fields = CHIRP_GUESS_FIELDS[sport]
  const headers = CHIRP_GUESS_HEADERS[sport]

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [answer, setAnswer] = useState(null)
  const [rows, setRows] = useState([])
  const [finished, setFinished] = useState(null)
  const today = todayStr()

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    setFinished(null)
    setRows([])

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
        .from(tables.chirpGuessDaily)
        .select('player_id')
        .eq('game_date', today)
        .maybeSingle()
      if (dailyErr || !daily) {
        if (!cancelled) {
          setError(`No Chirp Guess puzzle scheduled for today.`)
          setLoading(false)
        }
        return
      }

      const { data: player } = await supabase.from(tables.players).select(fields).eq('id', daily.player_id).single()
      if (!cancelled) {
        setAnswer(player)
        const saved = getInProgress(gameKey, today)
        if (saved) setRows(saved.rows || [])
        setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [today, sport, gameKey, tables.chirpGuessDaily, tables.players, fields])

  function finish(won, allRows) {
    const result = { rows: allRows.map((r) => r.tiles), won, guessCount: allRows.length, maxGuesses: MAX_GUESSES }
    saveTodayResult(gameKey, today, result)
    bumpStreak(gameKey, today, won)
    setFinished(result)
  }

  function handleSelect(player) {
    const tiles = compareChirpGuess(sport, player, answer)
    const row = { player, tiles }
    const nextRows = [...rows, row]
    setRows(nextRows)
    saveInProgress(gameKey, today, { rows: nextRows })

    const won = player.id === answer.id
    if (won || nextRows.length >= MAX_GUESSES) {
      finish(won, nextRows)
    }
  }

  const title = `Chirp Guess — ${SPORT_META[sport].label}`

  if (loading) return <GameShell emoji="🎯" title={title}><Loading /></GameShell>
  if (error) return <GameShell emoji="🎯" title={title}><ErrorMsg message={error} /></GameShell>

  if (finished) {
    return (
      <GameShell emoji="🎯" title={title}>
        <p className="mb-4 text-center font-semibold">
          {finished.won ? `Solved in ${finished.guessCount}/${MAX_GUESSES}! 🎉` : "Didn't get it today."}
        </p>
        <ShareResult text={buildShareText('chirp-guess', today, finished)} />
      </GameShell>
    )
  }

  return (
    <GameShell emoji="🎯" title={title}>
      <p className="mb-4 text-sm text-[var(--color-text-secondary)]">
        Guess {"today's"} mystery {SPORT_META[sport].label} player. {MAX_GUESSES - rows.length} guesses left.
      </p>

      <PlayerSearchInput table={tables.players} onSelect={handleSelect} placeholder="Type a player name…" />

      <div className="mt-6 space-y-2">
        {rows.map((row, i) => (
          <div key={i}>
            <p className="mb-1 text-xs font-semibold text-[var(--color-text-secondary)]">{row.player.full_name}</p>
            <div className={`grid gap-1.5 ${headers.length === 10 ? 'grid-cols-5' : 'grid-cols-4'}`}>
              {row.tiles.map((t, j) => (
                <div
                  key={j}
                  className={`flex flex-col items-center justify-center rounded-lg border py-2 text-[10px] font-bold ${tileColor[t.color]}`}
                  title={headers[j]}
                >
                  <span>{headers[j]}</span>
                  <span className="text-[9px] font-normal normal-case opacity-80">{String(t.value)}</span>
                  {t.arrow && <span className="text-sm">{t.arrow === 'up' ? '↑' : '↓'}</span>}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </GameShell>
  )
}
