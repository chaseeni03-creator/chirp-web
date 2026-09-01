import { useEffect, useState } from 'react'
import { supabase, todayStr } from '../lib/supabase'
import { getTodayResult, saveTodayResult, bumpStreak } from '../lib/storage'
import { buildShareText } from '../lib/share'
import GameShell, { Loading, ErrorMsg } from '../components/GameShell'
import PlayerSearchInput from '../components/PlayerSearchInput'
import ShareResult from '../components/ShareResult'

const GAME_KEY = 'lineup'

const CATEGORIES = [
  ['passing_yards', 'Passing Yards'],
  ['rushing_yards', 'Rushing Yards'],
  ['receiving_yards', 'Receiving Yards'],
  ['passing_touchdowns', 'Passing TDs'],
  ['rushing_touchdowns', 'Rushing TDs'],
  ['receiving_touchdowns', 'Receiving TDs'],
  ['sacks', 'Sacks'],
  ['interceptions_caught', 'Interceptions'],
  ['tackles', 'Tackles'],
]

async function computeLeaders(daily, statKey) {
  let query = supabase.from('nfl_season_stats').select(`player_id, ${statKey}`)
  if (daily.time_type === 'season') query = query.eq('season', Number(daily.time_value))
  const { data: rows } = await query.limit(5000)
  if (!rows) return []

  let scoped = rows
  if (daily.scope_type === 'team') {
    // team scoping needs the team column too — refetch with it included
    let q2 = supabase.from('nfl_season_stats').select(`player_id, team, ${statKey}`)
    if (daily.time_type === 'season') q2 = q2.eq('season', Number(daily.time_value))
    const { data: rows2 } = await q2.eq('team', daily.scope_value).limit(5000)
    scoped = rows2 || []
  }

  const totals = new Map()
  for (const r of scoped) {
    totals.set(r.player_id, (totals.get(r.player_id) || 0) + (r[statKey] ?? 0))
  }
  const ranked = [...totals.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3)
  if (ranked.length === 0) return []

  const { data: players } = await supabase.from('nfl_players').select('id, full_name').in('id', ranked.map(([id]) => id))
  const nameById = new Map((players || []).map((p) => [p.id, p.full_name]))
  return ranked.map(([playerId, value]) => ({ playerId, value, name: nameById.get(playerId) || 'Unknown' }))
}

export default function Lineup() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [daily, setDaily] = useState(null)
  const [picks, setPicks] = useState({})
  const [finished, setFinished] = useState(null)
  const [revealing, setRevealing] = useState(false)
  const [leaders, setLeaders] = useState({})
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
      const { data, error: err } = await supabase
        .from('lineup_daily')
        .select('scope_type, scope_value, time_type, time_value')
        .eq('game_date', today)
        .maybeSingle()
      if (err || !data) {
        if (!cancelled) {
          setError('No Lineup puzzle scheduled for today.')
          setLoading(false)
        }
        return
      }
      if (!cancelled) {
        setDaily(data)
        setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [today])

  function setPick(catKey, player) {
    setPicks((p) => ({ ...p, [catKey]: player }))
  }

  async function lockIn() {
    setRevealing(true)
    const results = {}
    for (const [key] of CATEGORIES) {
      results[key] = await computeLeaders(daily, key)
    }
    setLeaders(results)

    let correctCount = 0
    let totalScore = 0
    for (const [key] of CATEGORIES) {
      const pick = picks[key]
      const rankIndex = pick ? results[key].findIndex((r) => r.playerId === pick.id) : -1
      if (rankIndex === 0) totalScore += 100
      else if (rankIndex === 1) totalScore += 60
      else if (rankIndex === 2) totalScore += 30
      if (rankIndex !== -1) correctCount++
    }

    const result = { correctCount, total: CATEGORIES.length, totalScore }
    saveTodayResult(GAME_KEY, today, result)
    bumpStreak(GAME_KEY, today, correctCount > 0)
    setFinished(result)
    setRevealing(false)
  }

  if (loading) return <GameShell emoji="📋" title="The Lineup"><Loading /></GameShell>
  if (error) return <GameShell emoji="📋" title="The Lineup"><ErrorMsg message={error} /></GameShell>

  if (finished) {
    return (
      <GameShell emoji="📋" title="The Lineup">
        <p className="mb-4 text-center font-semibold">
          {finished.correctCount}/{finished.total} in the Top 3 · {finished.totalScore} pts
        </p>
        <ShareResult text={buildShareText(GAME_KEY, today, finished)} />

        {Object.keys(leaders).length > 0 && (
          <div className="mt-6 space-y-3">
            {CATEGORIES.map(([key, label]) => (
              <div key={key} className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3">
                <p className="mb-1 text-xs font-bold text-[var(--color-text-secondary)]">{label}</p>
                {(leaders[key] || []).map((l, i) => (
                  <p key={l.playerId} className="text-sm">
                    {i + 1}. {l.name} — {l.value.toLocaleString()}
                  </p>
                ))}
              </div>
            ))}
          </div>
        )}
      </GameShell>
    )
  }

  const scopeLabel = `${daily.time_type === 'season' ? daily.time_value + ' Season' : 'Career'}${
    daily.scope_type === 'team' ? ' · ' + daily.scope_value : ''
  }`

  return (
    <GameShell emoji="📋" title="The Lineup">
      <p className="mb-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-elevated)] px-4 py-2 text-center text-sm font-bold">
        {scopeLabel}
      </p>

      <div className="space-y-3">
        {CATEGORIES.map(([key, label]) => (
          <div key={key}>
            <p className="mb-1 text-sm font-semibold text-[var(--color-text-secondary)]">{label}</p>
            <PlayerSearchInput onSelect={(p) => setPick(key, p)} placeholder={`Pick a player for ${label}…`} disabled={revealing} />
            {picks[key] && <p className="mt-1 text-xs text-[var(--color-text)]">Picked: {picks[key].full_name}</p>}
          </div>
        ))}
      </div>

      <button
        onClick={lockIn}
        disabled={revealing}
        className="mt-6 w-full rounded-xl bg-[var(--color-primary)] py-3 font-bold text-white disabled:opacity-60"
      >
        {revealing ? 'Revealing…' : 'Lock In Lineup'}
      </button>
    </GameShell>
  )
}
