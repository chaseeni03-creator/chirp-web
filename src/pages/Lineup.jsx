import { useEffect, useState } from 'react'
import { supabase, todayStr } from '../lib/supabase'
import { getTodayResult, saveTodayResult, bumpStreak } from '../lib/storage'
import { buildShareText } from '../lib/share'
import { useSport } from '../context/SportContext'
import { TABLES, LINEUP_CATEGORIES, SPORT_META } from '../lib/sports'
import GameShell, { Loading, ErrorMsg } from '../components/GameShell'
import PlayerSearchInput from '../components/PlayerSearchInput'
import ShareResult from '../components/ShareResult'

async function computeLeaders(tables, daily, statKey) {
  let scoped
  if (daily.scope_type === 'team') {
    let q = supabase.from(tables.seasonStats).select(`player_id, team, ${statKey}`)
    if (daily.time_type === 'season') q = q.eq('season', Number(daily.time_value))
    const { data } = await q.eq('team', daily.scope_value).limit(5000)
    scoped = data || []
  } else {
    let q = supabase.from(tables.seasonStats).select(`player_id, ${statKey}`)
    if (daily.time_type === 'season') q = q.eq('season', Number(daily.time_value))
    const { data } = await q.limit(5000)
    scoped = data || []
  }

  const totals = new Map()
  for (const r of scoped) totals.set(r.player_id, (totals.get(r.player_id) || 0) + (r[statKey] ?? 0))
  const ranked = [...totals.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3)
  if (ranked.length === 0) return []

  const { data: players } = await supabase.from(tables.players).select('id, full_name').in('id', ranked.map(([id]) => id))
  const nameById = new Map((players || []).map((p) => [p.id, p.full_name]))
  return ranked.map(([playerId, value]) => ({ playerId, value, name: nameById.get(playerId) || 'Unknown' }))
}

export default function Lineup() {
  const { sport } = useSport()
  const gameKey = `${sport}-lineup`
  const tables = TABLES[sport]
  const categories = LINEUP_CATEGORIES[sport]

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
    setLoading(true)
    setError(null)
    setFinished(null)
    setPicks({})
    setLeaders({})

    async function load() {
      const already = getTodayResult(gameKey, today)
      if (already) {
        if (!cancelled) {
          setFinished(already)
          setLoading(false)
        }
        return
      }
      const { data, error: err } = await supabase
        .from(tables.lineupDaily)
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
  }, [today, sport, gameKey, tables.lineupDaily])

  function setPick(catKey, player) {
    setPicks((p) => ({ ...p, [catKey]: player }))
  }

  async function lockIn() {
    setRevealing(true)
    const results = {}
    for (const [key] of categories) {
      results[key] = await computeLeaders(tables, daily, key)
    }
    setLeaders(results)

    let correctCount = 0
    let totalScore = 0
    for (const [key] of categories) {
      const pick = picks[key]
      const rankIndex = pick ? results[key].findIndex((r) => r.playerId === pick.id) : -1
      if (rankIndex === 0) totalScore += 100
      else if (rankIndex === 1) totalScore += 60
      else if (rankIndex === 2) totalScore += 30
      if (rankIndex !== -1) correctCount++
    }

    const result = { correctCount, total: categories.length, totalScore }
    saveTodayResult(gameKey, today, result)
    bumpStreak(gameKey, today, correctCount > 0)
    setFinished(result)
    setRevealing(false)
  }

  const title = `The Lineup — ${SPORT_META[sport].label}`

  if (loading) return <GameShell emoji="📋" title={title}><Loading /></GameShell>
  if (error) return <GameShell emoji="📋" title={title}><ErrorMsg message={error} /></GameShell>

  if (finished) {
    return (
      <GameShell emoji="📋" title={title}>
        <p className="mb-4 text-center font-semibold">
          {finished.correctCount}/{finished.total} in the Top 3 · {finished.totalScore} pts
        </p>
        <ShareResult text={buildShareText('lineup', today, finished)} />

        {Object.keys(leaders).length > 0 && (
          <div className="mt-6 space-y-3">
            {categories.map(([key, label]) => (
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
    <GameShell emoji="📋" title={title}>
      <p className="mb-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-elevated)] px-4 py-2 text-center text-sm font-bold">
        {scopeLabel}
      </p>

      <div className="space-y-3">
        {categories.map(([key, label]) => (
          <div key={key}>
            <p className="mb-1 text-sm font-semibold text-[var(--color-text-secondary)]">{label}</p>
            <PlayerSearchInput table={tables.players} onSelect={(p) => setPick(key, p)} placeholder={`Pick a player for ${label}…`} disabled={revealing} />
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
