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
import GroupScoreBanner from '../components/GroupScoreBanner'

const MAX_GUESSES = 8

const tileColor = {
  green: 'bg-[var(--color-success)]/20 border-[var(--color-success)] text-[var(--color-success)]',
  orange: 'bg-[var(--color-warning)]/20 border-[var(--color-warning)] text-[var(--color-warning)]',
  grey: 'bg-[var(--color-elevated)] border-[var(--color-border)] text-[var(--color-text-secondary)]',
}

// supabase-js retries a failed network request internally with its own
// backoff, which can run far longer than feels responsive (observed well
// past 10s on a real network failure) before ever resolving or rejecting
// back to caller code — a plain `await` on a flaky connection can leave a
// button stuck disabled with nothing happening for a long time. Race it
// against a hard timeout so a slow/hanging attempt fails fast instead.
function withTimeout(promise, ms) {
  return Promise.race([promise, new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms))])
}

// Every team a player has ever recorded a stat line for — the real,
// complete career history, unlike the players table's own previous_teams
// column. Used only for the mystery player, to power the team/conference/
// division/league tiles' "played there before, not now" tier.
async function fetchCareerTeams(seasonStatsTable, playerId) {
  const { data } = await supabase.from(seasonStatsTable).select('team').eq('player_id', playerId)
  if (!data) return []
  return [...new Set(data.map((r) => r.team).filter(Boolean))]
}

async function fetchFullPlayer(tables, fields, id) {
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt > 0) await new Promise((r) => setTimeout(r, 400))
    try {
      const { data, error } = await withTimeout(supabase.from(tables.players).select(fields).eq('id', id).single(), 3000)
      if (!error && data) return data
    } catch {
      // network failure or timeout — fall through to the next attempt
    }
  }
  return null
}

// A row saved before this fetch had retries (or hit one badly enough to
// exhaust them) can have a guessed player object missing most fields, which
// shows as tiles permanently stuck on "?" — no amount of reloading fixes
// that on its own, since restoring saved progress just replays the same bad
// data. Detect that pattern and re-fetch+recompute those rows on load.
const CORRUPTION_THRESHOLD = 4
function looksCorrupted(row) {
  const questionMarks = row.tiles.filter((t) => t.value === '?').length
  return questionMarks >= CORRUPTION_THRESHOLD
}

async function healCorruptedRows(sport, tables, fields, rows, answer) {
  let changed = false
  const healed = await Promise.all(
    rows.map(async (row) => {
      if (!looksCorrupted(row)) return row
      const full = await fetchFullPlayer(tables, fields, row.player.id)
      if (!full) return row
      changed = true
      return { player: full, tiles: compareChirpGuess(sport, full, answer) }
    })
  )
  return { healed, changed }
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
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState(null)
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
      if (cancelled) return
      // The team/conference/division tiles need the mystery player's real,
      // complete career team history to tell "playing there now" from
      // "played there before" — tables.players.previous_teams is a
      // separately-maintained column that isn't guaranteed exhaustive, so
      // it's overridden here with every team the mystery player actually
      // has a row for in season stats (never fetched for the guessed
      // player — the tiles only ever check the guess's CURRENT team).
      const careerTeams = await fetchCareerTeams(tables.seasonStats, daily.player_id)
      if (cancelled) return
      setAnswer({ ...player, previous_teams: careerTeams })
      const saved = getInProgress(gameKey, today)
      if (saved?.rows?.length) {
        const { healed, changed } = await healCorruptedRows(sport, tables, fields, saved.rows, player)
        if (cancelled) return
        setRows(healed)
        if (changed) saveInProgress(gameKey, today, { rows: healed })
      }
      setLoading(false)
    }
    load()
    return () => {
      cancelled = true
    }
  }, [today, sport, gameKey, tables, fields])

  function finish(won, allRows) {
    // Chirp Guess has no built-in point system (it's pure guess-count, like
    // Wordle) — this score exists only so the game has something to compare
    // on a group leaderboard: fewer guesses scores higher, a loss scores 0.
    const groupScore = won ? Math.max(100, 1000 - (allRows.length - 1) * 100) : 0
    const result = {
      rows: allRows.map((r) => r.tiles),
      won,
      guessCount: allRows.length,
      maxGuesses: MAX_GUESSES,
      groupScore,
      answerName: answer.full_name,
    }
    saveTodayResult(gameKey, today, result)
    bumpStreak(gameKey, today, won)
    setFinished(result)
  }

  async function handleSelect(selected) {
    setSubmitting(true)
    setSubmitError(null)
    // The search dropdown only returns id/full_name/position/current_team —
    // every other tile (conference, division, jersey, height, weight, age,
    // draft round, college) needs the full row or it silently compares
    // against undefined and falls back to grey.
    const player = await fetchFullPlayer(tables, fields, selected.id)
    setSubmitting(false)

    if (!player) {
      setSubmitError("Couldn't load that player's data — check your connection and try again.")
      return
    }

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

  if (loading) return <GameShell emoji="🎯" title={title} howToPlay="chirp-guess"><Loading /></GameShell>
  if (error) return <GameShell emoji="🎯" title={title} howToPlay="chirp-guess"><ErrorMsg message={error} /></GameShell>

  if (finished) {
    return (
      <GameShell emoji="🎯" title={title} howToPlay="chirp-guess">
        <p className="mb-4 text-center font-semibold">
          {finished.won
            ? `Solved in ${finished.guessCount}/${MAX_GUESSES}! 🎉`
            : `Didn't get it today — the answer was ${finished.answerName ?? 'unknown'}.`}
        </p>
        <ShareResult text={buildShareText('chirp-guess', today, finished)} />
        <GroupScoreBanner
          gameType="chirp-guess"
          sport={sport}
          era="all_time"
          score={finished.groupScore}
          details={`${finished.guessCount}/${finished.maxGuesses} guesses`}
        />
      </GameShell>
    )
  }

  return (
    <GameShell emoji="🎯" title={title} howToPlay="chirp-guess">
      <p className="mb-4 text-sm text-[var(--color-text-secondary)]">
        Guess {"today's"} mystery {SPORT_META[sport].label} player. {MAX_GUESSES - rows.length} guesses left.
      </p>

      <PlayerSearchInput
        table={tables.players}
        onSelect={handleSelect}
        placeholder="Type a player name…"
        disabled={submitting}
        activeOnly={sport === 'nfl'}
      />
      {submitError && <p className="mt-2 text-xs text-[var(--color-primary)]">{submitError}</p>}

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
