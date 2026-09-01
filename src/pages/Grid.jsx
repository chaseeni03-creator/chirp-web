import { useEffect, useState } from 'react'
import { supabase, todayStr } from '../lib/supabase'
import { getTodayResult, saveTodayResult, bumpStreak } from '../lib/storage'
import { buildShareText } from '../lib/share'
import GameShell, { Loading, ErrorMsg } from '../components/GameShell'
import PlayerSearchInput from '../components/PlayerSearchInput'
import ShareResult from '../components/ShareResult'

const GAME_KEY = 'grid'

const POSITION_GROUPS = {
  qb: ['QB'],
  rb: ['RB', 'FB', 'HB'],
  wr: ['WR'],
  te: ['TE'],
  ol: ['OT', 'OG', 'C', 'G', 'T'],
  de: ['DE'],
  lb: ['LB', 'OLB', 'ILB', 'MLB'],
  cb: ['CB'],
  s: ['S', 'FS', 'SS'],
}

function decadeRange(value) {
  const start = Number(value.replace('s', ''))
  return [start, start + 9]
}

/** Checks whether `player` (a full nfl_players row) satisfies one grid category. */
async function matchesCategory(player, category, value) {
  switch (category) {
    case 'team': {
      if (player.current_team === value) return true
      return Array.isArray(player.previous_teams) && player.previous_teams.includes(value)
    }
    case 'position': {
      const group = POSITION_GROUPS[value.toLowerCase()]
      return group ? group.includes(player.position) : player.position === value
    }
    case 'college':
      return (player.college || '').toLowerCase().includes(value.toLowerCase())
    case 'draftRound':
      if (value === 'udfa') return player.draft_round == null
      if (value === 'top10') return player.draft_pick != null && player.draft_pick <= 10
      if (value === 'top32') return player.draft_pick != null && player.draft_pick <= 32
      return player.draft_round === Number(value.replace('round', ''))
    case 'division':
      return player.division === value
    case 'era':
      if (value === 'active') return player.is_active === true
      {
        const [start, end] = decadeRange(value)
        return player.season_first <= end && player.season_last >= start
      }
    case 'stat': {
      // Best-effort: exact preset thresholds live only in the Flutter admin
      // catalog, so this checks career totals against a reasonable guess at
      // common presets rather than an exact match to the mobile app.
      const guesses = [
        ['rush', 'rushing_yards', 1000],
        ['pass', 'passing_yards', 4000],
        ['rec', 'receiving_yards', 1000],
        ['sack', 'sacks', 10],
        ['int', 'interceptions_caught', 5],
        ['tackle', 'tackles', 100],
      ]
      const guess = guesses.find(([k]) => value.toLowerCase().includes(k))
      if (!guess) return true // unknown preset — don't block the guess
      const [, column, threshold] = guess
      const { data } = await supabase.from('nfl_career_stats').select(column).eq('player_id', player.id).maybeSingle()
      return (data?.[column] ?? 0) >= threshold
    }
    default:
      return false
  }
}

const PLAYER_FIELDS = 'id, full_name, position, current_team, previous_teams, college, draft_round, draft_pick, division, is_active, season_first, season_last'

export default function Grid() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [schedule, setSchedule] = useState(null)
  const [cells, setCells] = useState(Array(9).fill(null)) // { name, correct }
  const [checking, setChecking] = useState(null)
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
      const { data, error: err } = await supabase.from('grid_game_schedule').select('*').eq('game_date', today).maybeSingle()
      if (err || !data) {
        if (!cancelled) {
          setError('No Chirp Grid puzzle scheduled for today.')
          setLoading(false)
        }
        return
      }
      if (!cancelled) {
        setSchedule(data)
        setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [today])

  function rowCat(i) {
    return [schedule.row1_category, schedule.row2_category, schedule.row3_category][i]
  }
  function rowVal(i) {
    return [schedule.row1_value, schedule.row2_value, schedule.row3_value][i]
  }
  function colCat(j) {
    return [schedule.col1_category, schedule.col2_category, schedule.col3_category][j]
  }
  function colVal(j) {
    return [schedule.col1_value, schedule.col2_value, schedule.col3_value][j]
  }

  async function handlePick(index, player) {
    setChecking(index)
    const { data: full } = await supabase.from('nfl_players').select(PLAYER_FIELDS).eq('id', player.id).single()
    const row = Math.floor(index / 3)
    const col = index % 3
    const [rowOk, colOk] = await Promise.all([
      matchesCategory(full, rowCat(row), rowVal(row)),
      matchesCategory(full, colCat(col), colVal(col)),
    ])
    const correct = rowOk && colOk

    const next = [...cells]
    next[index] = { name: full.full_name, correct }
    setCells(next)
    setChecking(null)

    if (next.every((c) => c !== null)) {
      const correctCount = next.filter((c) => c.correct).length
      const result = { grid: next.map((c) => c.correct), correctCount }
      saveTodayResult(GAME_KEY, today, result)
      bumpStreak(GAME_KEY, today, correctCount === 9)
      setFinished(result)
    }
  }

  if (loading) return <GameShell emoji="🔢" title="Chirp Grid"><Loading /></GameShell>
  if (error) return <GameShell emoji="🔢" title="Chirp Grid"><ErrorMsg message={error} /></GameShell>

  if (finished) {
    return (
      <GameShell emoji="🔢" title="Chirp Grid">
        <p className="mb-4 text-center font-semibold">{finished.correctCount}/9 correct!</p>
        <div className="mx-auto grid max-w-xs grid-cols-3 gap-1.5">
          {finished.grid.map((ok, i) => (
            <div key={i} className={`aspect-square rounded-lg text-center text-2xl leading-[3rem] ${ok ? 'bg-[var(--color-success)]/15' : 'bg-[var(--color-primary)]/15'}`}>
              {ok ? '✅' : '❌'}
            </div>
          ))}
        </div>
        <div className="mt-6">
          <ShareResult text={buildShareText(GAME_KEY, today, finished)} />
        </div>
      </GameShell>
    )
  }

  return (
    <GameShell emoji="🔢" title="Chirp Grid">
      <div className="overflow-x-auto">
        <table className="mx-auto border-separate border-spacing-1.5">
          <thead>
            <tr>
              <th></th>
              {[0, 1, 2].map((j) => (
                <th key={j} className="w-32 rounded-lg bg-[var(--color-elevated)] px-2 py-2 text-xs font-bold">
                  {colVal(j)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[0, 1, 2].map((i) => (
              <tr key={i}>
                <th className="w-24 rounded-lg bg-[var(--color-elevated)] px-2 py-2 text-xs font-bold">{rowVal(i)}</th>
                {[0, 1, 2].map((j) => {
                  const index = i * 3 + j
                  const cell = cells[index]
                  return (
                    <td key={j} className="w-32 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-1 align-top">
                      {cell ? (
                        <div className={`flex h-16 flex-col items-center justify-center rounded text-xs font-semibold ${cell.correct ? 'text-[var(--color-success)]' : 'text-[var(--color-primary)]'}`}>
                          <span>{cell.correct ? '✅' : '❌'}</span>
                          <span className="mt-1 px-1 text-center">{cell.name}</span>
                        </div>
                      ) : (
                        <div className="flex h-16 items-center">
                          <PlayerSearchInput onSelect={(p) => handlePick(index, p)} placeholder="Player…" disabled={checking !== null} />
                        </div>
                      )}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </GameShell>
  )
}
