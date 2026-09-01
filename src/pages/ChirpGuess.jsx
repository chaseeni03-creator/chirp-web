import { useEffect, useState } from 'react'
import { supabase, todayStr } from '../lib/supabase'
import { getTodayResult, saveTodayResult, bumpStreak, getInProgress, saveInProgress } from '../lib/storage'
import { buildShareText } from '../lib/share'
import GameShell, { Loading, ErrorMsg } from '../components/GameShell'
import PlayerSearchInput from '../components/PlayerSearchInput'
import ShareResult from '../components/ShareResult'

const MAX_GUESSES = 8
const GAME_KEY = 'chirp-guess'

const FIELDS = 'id, full_name, position, current_team, college, draft_year, draft_round, draft_pick, jersey_number, season_first'

const ATTRS = [
  { key: 'position', label: 'Position', type: 'exact' },
  { key: 'current_team', label: 'Team', type: 'exact' },
  { key: 'college', label: 'College', type: 'exact' },
  { key: 'draft_round', label: 'Draft Rd', type: 'number', closeRange: 1 },
  { key: 'draft_pick', label: 'Draft Pick', type: 'number', closeRange: 15 },
  { key: 'draft_year', label: 'Draft Yr', type: 'number', closeRange: 3 },
  { key: 'jersey_number', label: 'Jersey #', type: 'number', closeRange: 5 },
  { key: 'season_first', label: 'Rookie Yr', type: 'number', closeRange: 2 },
]

function compareAttr(attr, guessVal, answerVal) {
  if (guessVal == null || answerVal == null) return { state: 'wrong', arrow: null }
  if (attr.type === 'exact') {
    return { state: guessVal === answerVal ? 'correct' : 'wrong', arrow: null }
  }
  const diff = answerVal - guessVal
  if (diff === 0) return { state: 'correct', arrow: null }
  const state = Math.abs(diff) <= attr.closeRange ? 'close' : 'wrong'
  return { state, arrow: diff > 0 ? 'up' : 'down' }
}

const tileColor = {
  correct: 'bg-[var(--color-success)]/20 border-[var(--color-success)] text-[var(--color-success)]',
  close: 'bg-[var(--color-warning)]/20 border-[var(--color-warning)] text-[var(--color-warning)]',
  wrong: 'bg-[var(--color-elevated)] border-[var(--color-border)] text-[var(--color-text-secondary)]',
}

export default function ChirpGuess() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [answer, setAnswer] = useState(null)
  const [rows, setRows] = useState([])
  const [finished, setFinished] = useState(null) // { won, rows }
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
        .from('chirp_guess_daily')
        .select('player_id')
        .eq('game_date', today)
        .maybeSingle()
      if (dailyErr || !daily) {
        if (!cancelled) {
          setError('No Chirp Guess puzzle scheduled for today.')
          setLoading(false)
        }
        return
      }

      const { data: player } = await supabase.from('nfl_players').select(FIELDS).eq('id', daily.player_id).single()
      if (!cancelled) {
        setAnswer(player)
        const saved = getInProgress(GAME_KEY, today)
        if (saved) setRows(saved.rows || [])
        setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [today])

  function finish(won, allRows) {
    const result = { rows: allRows.map((r) => r.tiles), won, guessCount: allRows.length, maxGuesses: MAX_GUESSES }
    saveTodayResult(GAME_KEY, today, result)
    bumpStreak(GAME_KEY, today, won)
    setFinished(result)
  }

  function handleSelect(player) {
    const tiles = ATTRS.map((attr) => compareAttr(attr, player[attr.key], answer[attr.key]))
    const row = { player, tiles }
    const nextRows = [...rows, row]
    setRows(nextRows)
    saveInProgress(GAME_KEY, today, { rows: nextRows })

    const won = player.id === answer.id
    if (won || nextRows.length >= MAX_GUESSES) {
      finish(won, nextRows)
    }
  }

  if (loading) return <GameShell emoji="🎯" title="Chirp Guess"><Loading /></GameShell>
  if (error) return <GameShell emoji="🎯" title="Chirp Guess"><ErrorMsg message={error} /></GameShell>

  if (finished) {
    return (
      <GameShell emoji="🎯" title="Chirp Guess">
        <p className="mb-4 text-center font-semibold">
          {finished.won ? `Solved in ${finished.guessCount}/${MAX_GUESSES}! 🎉` : "Didn't get it today."}
        </p>
        <ShareResult text={buildShareText(GAME_KEY, today, finished)} />
      </GameShell>
    )
  }

  return (
    <GameShell emoji="🎯" title="Chirp Guess">
      <p className="mb-4 text-sm text-[var(--color-text-secondary)]">
        Guess {"today's"} mystery NFL player. {MAX_GUESSES - rows.length} guesses left.
      </p>

      <PlayerSearchInput onSelect={handleSelect} placeholder="Type a player name…" />

      <div className="mt-6 space-y-2">
        {rows.map((row, i) => (
          <div key={i}>
            <p className="mb-1 text-xs font-semibold text-[var(--color-text-secondary)]">{row.player.full_name}</p>
            <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-8">
              {row.tiles.map((t, j) => (
                <div
                  key={j}
                  className={`flex flex-col items-center justify-center rounded-lg border py-2 text-[10px] font-bold ${tileColor[t.state]}`}
                  title={ATTRS[j].label}
                >
                  <span>{ATTRS[j].label}</span>
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
