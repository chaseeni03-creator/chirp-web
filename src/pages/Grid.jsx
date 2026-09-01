import { useEffect, useState } from 'react'
import { supabase, todayStr } from '../lib/supabase'
import { getTodayResult, saveTodayResult, bumpStreak } from '../lib/storage'
import { buildShareText } from '../lib/share'
import { useSport } from '../context/SportContext'
import { TABLES, SPORT_META } from '../lib/sports'
import { gridCategoryLabel, validateGridCategory, GRID_PLAYER_FIELDS, GRID_SCORING } from '../lib/grid'
import GameShell, { Loading, ErrorMsg } from '../components/GameShell'
import PlayerSearchInput from '../components/PlayerSearchInput'
import ShareResult from '../components/ShareResult'

export default function Grid() {
  const { sport } = useSport()
  const gameKey = `${sport}-grid`
  const tables = TABLES[sport]

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [schedule, setSchedule] = useState(null)
  const [cells, setCells] = useState(Array(9).fill(null))
  const [checking, setChecking] = useState(null)
  const [finished, setFinished] = useState(null)
  const today = todayStr()

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    setFinished(null)
    setCells(Array(9).fill(null))

    async function load() {
      const already = getTodayResult(gameKey, today)
      if (already) {
        if (!cancelled) {
          setFinished(already)
          setLoading(false)
        }
        return
      }
      const { data, error: err } = await supabase.from(tables.gridSchedule).select('*').eq('game_date', today).maybeSingle()
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
  }, [today, sport, gameKey, tables.gridSchedule])

  function rowCat(i) { return [schedule.row1_category, schedule.row2_category, schedule.row3_category][i] }
  function rowVal(i) { return [schedule.row1_value, schedule.row2_value, schedule.row3_value][i] }
  function colCat(j) { return [schedule.col1_category, schedule.col2_category, schedule.col3_category][j] }
  function colVal(j) { return [schedule.col1_value, schedule.col2_value, schedule.col3_value][j] }

  async function handlePick(index, player) {
    setChecking(index)
    const { data: full } = await supabase.from(tables.players).select(GRID_PLAYER_FIELDS[sport]).eq('id', player.id).single()
    const row = Math.floor(index / 3)
    const col = index % 3
    const [rowOk, colOk] = await Promise.all([
      validateGridCategory(sport, tables, full, rowCat(row), rowVal(row)),
      validateGridCategory(sport, tables, full, colCat(col), colVal(col)),
    ])
    const correct = rowOk && colOk

    const next = [...cells]
    next[index] = { name: full.full_name, correct }
    setCells(next)
    setChecking(null)

    if (next.every((c) => c !== null)) {
      const correctCount = next.filter((c) => c.correct).length
      const totalScore = correctCount * GRID_SCORING.perSquare + (correctCount === 9 ? GRID_SCORING.perfectBonus : 0)
      const result = { sport, grid: next.map((c) => c.correct), correctCount, totalScore }
      saveTodayResult(gameKey, today, result)
      bumpStreak(gameKey, today, correctCount === 9)
      setFinished(result)
    }
  }

  const title = `Chirp Grid — ${SPORT_META[sport].label}`

  if (loading) return <GameShell emoji="🔢" title={title}><Loading /></GameShell>
  if (error) return <GameShell emoji="🔢" title={title}><ErrorMsg message={error} /></GameShell>

  if (finished) {
    return (
      <GameShell emoji="🔢" title={title}>
        <p className="mb-4 text-center font-semibold">
          {finished.correctCount === 9 ? '🏆 Perfect Grid!' : '✅ Complete!'} {finished.correctCount}/9 · {finished.totalScore} pts
        </p>
        <div className="mx-auto grid max-w-xs grid-cols-3 gap-1.5">
          {finished.grid.map((ok, i) => (
            <div key={i} className={`aspect-square rounded-lg text-center text-2xl leading-[3rem] ${ok ? 'bg-[var(--color-success)]/15' : 'bg-[var(--color-primary)]/15'}`}>
              {ok ? '✅' : '❌'}
            </div>
          ))}
        </div>
        <div className="mt-6">
          <ShareResult text={buildShareText('grid', today, finished)} />
        </div>
      </GameShell>
    )
  }

  return (
    <GameShell emoji="🔢" title={title}>
      <div className="overflow-x-auto">
        <table className="mx-auto border-separate border-spacing-1.5">
          <thead>
            <tr>
              <th></th>
              {[0, 1, 2].map((j) => (
                <th key={j} className="w-32 rounded-lg bg-[var(--color-elevated)] px-2 py-2 text-xs font-bold">
                  {gridCategoryLabel(sport, colCat(j), colVal(j))}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[0, 1, 2].map((i) => (
              <tr key={i}>
                <th className="w-24 rounded-lg bg-[var(--color-elevated)] px-2 py-2 text-xs font-bold">
                  {gridCategoryLabel(sport, rowCat(i), rowVal(i))}
                </th>
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
                          <PlayerSearchInput table={tables.players} onSelect={(p) => handlePick(index, p)} placeholder="Player…" disabled={checking !== null} />
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
