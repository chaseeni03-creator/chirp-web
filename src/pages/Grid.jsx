import { useEffect, useState } from 'react'
import { supabase, todayStr } from '../lib/supabase'
import { getTodayResult, saveTodayResult, bumpStreak } from '../lib/storage'
import { buildShareText } from '../lib/share'
import { useSport } from '../context/SportContext'
import { TABLES, SPORT_META, MLB_TEAM_LEAGUE, NBA_TEAM_DIVISION } from '../lib/sports'
import GameShell, { Loading, ErrorMsg } from '../components/GameShell'
import PlayerSearchInput from '../components/PlayerSearchInput'
import ShareResult from '../components/ShareResult'

const NFL_POSITION_GROUPS = {
  qb: ['QB'], rb: ['RB', 'FB', 'HB'], wr: ['WR'], te: ['TE'],
  ol: ['OT', 'OG', 'C', 'G', 'T'], de: ['DE'], lb: ['LB', 'OLB', 'ILB', 'MLB'], cb: ['CB'], s: ['S', 'FS', 'SS'],
}

function decadeRange(value) {
  const start = Number(String(value).replace('s', ''))
  return [start, start + 9]
}

function parseThreshold(value) {
  const n = Number(String(value).replace(/[^0-9]/g, ''))
  return Number.isFinite(n) ? n : 0
}

/** Generic matcher covering every category key seen across NFL/MLB/NBA grids. */
async function matchesCategory(sport, tables, player, category, value) {
  switch (category) {
    case 'team':
      if (player.current_team === value) return true
      return Array.isArray(player.previous_teams) && player.previous_teams.includes(value)

    case 'position': {
      if (sport === 'nfl') {
        const group = NFL_POSITION_GROUPS[String(value).toLowerCase()]
        return group ? group.includes(player.position) : player.position === value
      }
      return player.position_group === value || player.position === value
    }

    case 'college':
      return (player.college || '').toLowerCase().includes(String(value).toLowerCase())

    case 'country':
      return (player.birth_country || '').toLowerCase().includes(String(value).toLowerCase())

    case 'draftRound':
    case 'draft':
      if (value === 'udfa') return player.draft_round == null
      if (value === 'top10') return player.draft_pick != null && player.draft_pick <= 10
      if (value === 'top32') return player.draft_pick != null && player.draft_pick <= 32
      return player.draft_round === Number(String(value).replace('round', ''))

    case 'allStar':
      return (player.all_star_selections ?? 0) >= parseThreshold(value)

    case 'division':
      if (player.division === value) return true
      if (sport === 'nba') {
        if (NBA_TEAM_DIVISION[player.current_team] === value) return true
        return (player.previous_teams || []).some((t) => NBA_TEAM_DIVISION[t] === value)
      }
      return false

    case 'league':
      if (sport === 'mlb') {
        if (MLB_TEAM_LEAGUE[player.current_team] === value) return true
        return (player.previous_teams || []).some((t) => MLB_TEAM_LEAGUE[t] === value)
      }
      return false

    case 'era':
      if (value === 'active') return player.is_active === true
      {
        const [start, end] = decadeRange(value)
        return player.season_first <= end && player.season_last >= start
      }

    case 'stat': {
      // Best-effort: exact preset thresholds live only in the Flutter admin
      // catalog per sport, so this checks career totals against a reasonable
      // guess at common presets rather than an exact match to the mobile app.
      const guessesBySport = {
        nfl: [['rush', 'rushing_yards', 1000], ['pass', 'passing_yards', 4000], ['rec', 'receiving_yards', 1000], ['sack', 'sacks', 10], ['int', 'interceptions_caught', 5], ['tackle', 'tackles', 100]],
        mlb: [['home', 'home_runs', 30], ['hr', 'home_runs', 30], ['hit', 'hits', 200], ['strikeout', 'strikeouts_pitched', 200], ['win', 'wins', 15], ['save', 'saves', 30]],
        nba: [['point', 'points', 20000], ['rebound', 'rebounds', 8000], ['assist', 'assists', 5000], ['steal', 'steals', 1500], ['block', 'blocks', 1500]],
      }
      const guess = (guessesBySport[sport] || []).find(([k]) => String(value).toLowerCase().includes(k))
      if (!guess) return true // unknown preset — don't block the guess
      const [, column, threshold] = guess
      const { data } = await supabase.from(tables.careerStats).select(column).eq('player_id', player.id).maybeSingle()
      return (data?.[column] ?? 0) >= threshold
    }

    default:
      return true // unknown category type — don't silently fail every pick
  }
}

const PLAYER_FIELDS = {
  nfl: 'id, full_name, position, current_team, previous_teams, college, draft_round, draft_pick, division, is_active, season_first, season_last, all_star_selections',
  mlb: 'id, full_name, position, position_group, current_team, previous_teams, college, birth_country, is_active, season_first, season_last, all_star_selections',
  nba: 'id, full_name, position, position_group, current_team, previous_teams, birth_country, draft_round, draft_pick, is_active, season_first, season_last, all_star_selections',
}

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
    const { data: full } = await supabase.from(tables.players).select(PLAYER_FIELDS[sport]).eq('id', player.id).single()
    const row = Math.floor(index / 3)
    const col = index % 3
    const [rowOk, colOk] = await Promise.all([
      matchesCategory(sport, tables, full, rowCat(row), rowVal(row)),
      matchesCategory(sport, tables, full, colCat(col), colVal(col)),
    ])
    const correct = rowOk && colOk

    const next = [...cells]
    next[index] = { name: full.full_name, correct }
    setCells(next)
    setChecking(null)

    if (next.every((c) => c !== null)) {
      const correctCount = next.filter((c) => c.correct).length
      const result = { grid: next.map((c) => c.correct), correctCount }
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
        <p className="mb-4 text-center font-semibold">{finished.correctCount}/9 correct!</p>
        <div className="mx-auto grid max-w-xs grid-cols-3 gap-1.5">
          {finished.grid.map((ok, i) => (
            <div key={i} className={`aspect-square text-center text-2xl leading-[3rem] ${ok ? 'bg-[var(--color-success)]/15' : 'bg-[var(--color-primary)]/15'}`}>
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
                <th key={j} className="w-32 bg-[var(--color-elevated)] px-2 py-2 text-xs font-bold">{colVal(j)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[0, 1, 2].map((i) => (
              <tr key={i}>
                <th className="w-24 bg-[var(--color-elevated)] px-2 py-2 text-xs font-bold">{rowVal(i)}</th>
                {[0, 1, 2].map((j) => {
                  const index = i * 3 + j
                  const cell = cells[index]
                  return (
                    <td key={j} className="w-32 border border-[var(--color-border)] bg-[var(--color-surface)] p-1 align-top">
                      {cell ? (
                        <div className={`flex h-16 flex-col items-center justify-center text-xs font-semibold ${cell.correct ? 'text-[var(--color-success)]' : 'text-[var(--color-primary)]'}`}>
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
