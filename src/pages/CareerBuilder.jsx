import { useEffect, useState } from 'react'
import { supabase, todayStr } from '../lib/supabase'
import { getTodayResult, saveTodayResult, bumpStreak } from '../lib/storage'
import { buildShareText } from '../lib/share'
import GameShell, { Loading, ErrorMsg } from '../components/GameShell'
import PlayerSearchInput from '../components/PlayerSearchInput'
import ShareResult from '../components/ShareResult'

const GAME_KEY = 'career-builder'

const PRIMARY_STAT_BY_GROUP = {
  QB: 'passing_yards',
  RB: 'rushing_yards',
  REC: 'receiving_yards',
  DEF: 'tackles',
}

function groupFor(position) {
  if (position === 'QB') return 'QB'
  if (position === 'RB' || position === 'FB') return 'RB'
  if (['WR', 'TE'].includes(position)) return 'REC'
  return 'DEF'
}

const DISPLAY_KEYS_BY_GROUP = {
  QB: [['passing_yards', 'Pass Yds'], ['passing_touchdowns', 'Pass TD'], ['games_played', 'Games']],
  RB: [['rushing_yards', 'Rush Yds'], ['rushing_touchdowns', 'Rush TD'], ['games_played', 'Games']],
  REC: [['receiving_yards', 'Rec Yds'], ['receiving_touchdowns', 'Rec TD'], ['games_played', 'Games']],
  DEF: [['tackles', 'Tackles'], ['sacks', 'Sacks'], ['games_played', 'Games']],
}

function pickFiveSeasons(seasons, group) {
  const statKey = PRIMARY_STAT_BY_GROUP[group]
  const meaningful = seasons.filter((s) => Object.values(DISPLAY_KEYS_BY_GROUP[group]).some(([k]) => (s[k] ?? 0) !== 0))
  const rows = meaningful.length >= 5 ? meaningful : seasons
  if (rows.length <= 5) return rows

  const sorted = [...rows].sort((a, b) => a.season - b.season)
  const first = sorted[0]
  const last = sorted[sorted.length - 1]
  const peak = [...sorted].sort((a, b) => (b[statKey] ?? 0) - (a[statKey] ?? 0))[0]

  const chosen = new Set([first.id, last.id, peak.id])
  const remaining = sorted.filter((s) => !chosen.has(s.id))
  const step = Math.max(1, Math.floor(remaining.length / 2))
  for (let i = 0; chosen.size < 5 && i < remaining.length; i += step) {
    chosen.add(remaining[i].id)
  }
  // fill any leftover slots if the stepping didn't reach 5
  for (const r of remaining) {
    if (chosen.size >= 5) break
    chosen.add(r.id)
  }
  return sorted.filter((s) => chosen.has(s.id))
}

function shuffle(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export default function CareerBuilder() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [player, setPlayer] = useState(null)
  const [cards, setCards] = useState([])
  const [guess, setGuess] = useState(null)
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
        .from('career_builder_daily')
        .select('player_id, difficulty')
        .eq('game_date', today)
        .maybeSingle()
      if (dailyErr || !daily) {
        if (!cancelled) {
          setError('No Career Builder puzzle scheduled for today.')
          setLoading(false)
        }
        return
      }

      const [{ data: p }, { data: seasons }] = await Promise.all([
        supabase.from('nfl_players').select('id, full_name, position').eq('id', daily.player_id).single(),
        supabase.from('nfl_season_stats').select('*').eq('player_id', daily.player_id).order('season'),
      ])

      if (!cancelled) {
        const group = groupFor(p.position)
        const chosen = pickFiveSeasons(seasons || [], group)
        setPlayer({ ...p, group })
        setCards(shuffle(chosen))
        setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [today])

  function move(index, dir) {
    const next = [...cards]
    const target = index + dir
    if (target < 0 || target >= next.length) return
    ;[next[index], next[target]] = [next[target], next[index]]
    setCards(next)
  }

  function submit() {
    const correctOrder = [...cards].sort((a, b) => a.season - b.season)
    let correctPositions = 0
    cards.forEach((c, i) => {
      if (c.id === correctOrder[i].id) correctPositions++
    })
    const orderScore = correctPositions * 20
    const guessedPlayer = guess?.id === player.id

    const result = { orderScore, maxOrderScore: 100, guessedPlayer, correctPositions, playerName: player.full_name }
    saveTodayResult(GAME_KEY, today, result)
    bumpStreak(GAME_KEY, today, correctPositions === 5)
    setFinished(result)
  }

  if (loading) return <GameShell emoji="📈" title="Career Builder"><Loading /></GameShell>
  if (error) return <GameShell emoji="📈" title="Career Builder"><ErrorMsg message={error} /></GameShell>

  if (finished) {
    return (
      <GameShell emoji="📈" title="Career Builder">
        <p className="mb-4 text-center font-semibold">
          {finished.correctPositions}/5 seasons in the right order
          {finished.guessedPlayer ? ' — and you guessed the player! 🎉' : `. Player: ${finished.playerName}`}
        </p>
        <ShareResult text={buildShareText(GAME_KEY, today, finished)} />
      </GameShell>
    )
  }

  const displayKeys = DISPLAY_KEYS_BY_GROUP[player.group]

  return (
    <GameShell emoji="📈" title="Career Builder">
      <p className="mb-4 text-sm text-[var(--color-text-secondary)]">
        Put these 5 seasons in chronological order (earliest first). Use the arrows to reorder.
      </p>

      <div className="space-y-2">
        {cards.map((c, i) => (
          <div key={c.id} className="flex items-center gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3">
            <span className="w-5 shrink-0 text-center font-bold text-[var(--color-text-secondary)]">{i + 1}</span>
            <div className="flex flex-1 gap-4">
              {displayKeys.map(([key, label]) => (
                <div key={key}>
                  <p className="text-[10px] text-[var(--color-text-secondary)]">{label}</p>
                  <p className="font-bold tabular-nums">{c[key] ?? 0}</p>
                </div>
              ))}
            </div>
            <div className="flex flex-col gap-1">
              <button onClick={() => move(i, -1)} disabled={i === 0} className="h-6 w-6 rounded bg-[var(--color-elevated)] text-xs disabled:opacity-30">▲</button>
              <button onClick={() => move(i, 1)} disabled={i === cards.length - 1} className="h-6 w-6 rounded bg-[var(--color-elevated)] text-xs disabled:opacity-30">▼</button>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6">
        <p className="mb-2 text-sm text-[var(--color-text-secondary)]">Bonus: guess the player</p>
        <PlayerSearchInput onSelect={setGuess} placeholder="Optional player guess…" />
        {guess && <p className="mt-2 text-sm">Guessed: <span className="font-semibold">{guess.full_name}</span></p>}
      </div>

      <button onClick={submit} className="mt-6 w-full rounded-xl bg-[var(--color-primary)] py-3 font-bold text-white">
        Submit Order
      </button>
    </GameShell>
  )
}
