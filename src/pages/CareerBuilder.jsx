import { useEffect, useState } from 'react'
import { supabase, todayStr } from '../lib/supabase'
import { getTodayResult, saveTodayResult, bumpStreak } from '../lib/storage'
import { buildShareText } from '../lib/share'
import { useSport } from '../context/SportContext'
import { TABLES, CAREER_STAT_CONFIG, SPORT_META, ERAS } from '../lib/sports'
import GameShell, { Loading, ErrorMsg } from '../components/GameShell'
import PlayerSearchInput from '../components/PlayerSearchInput'
import ShareResult from '../components/ShareResult'
import EraSelector from '../components/EraSelector'

const PLAYER_FIELDS = {
  nfl: 'id, full_name, position',
  mlb: 'id, full_name, position, position_group',
  nba: 'id, full_name, position',
}

function pickFiveSeasons(seasons, statKey, displayKeys) {
  const meaningful = seasons.filter((s) => displayKeys.some(([k]) => (s[k] ?? 0) !== 0))
  const rows = meaningful.length >= 5 ? meaningful : seasons
  if (rows.length <= 5) return rows

  const sorted = [...rows].sort((a, b) => a.season - b.season)
  const first = sorted[0]
  const last = sorted[sorted.length - 1]
  const peak = [...sorted].sort((a, b) => (b[statKey] ?? 0) - (a[statKey] ?? 0))[0]

  const chosen = new Set([first.id, last.id, peak.id])
  const remaining = sorted.filter((s) => !chosen.has(s.id))
  const step = Math.max(1, Math.floor(remaining.length / 2))
  for (let i = 0; chosen.size < 5 && i < remaining.length; i += step) chosen.add(remaining[i].id)
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
  const { sport } = useSport()
  const tables = TABLES[sport]
  const config = CAREER_STAT_CONFIG[sport]

  const [era, setEra] = useState(ERAS[sport][0].key)
  const [difficulty, setDifficulty] = useState('normal')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [player, setPlayer] = useState(null)
  const [cards, setCards] = useState([])
  const [guess, setGuess] = useState(null)
  const [finished, setFinished] = useState(null)
  const today = todayStr()
  const gameKey = `${sport}-career-builder-${era}-${difficulty}`

  useEffect(() => {
    if (!ERAS[sport].some((e) => e.key === era)) setEra(ERAS[sport][0].key)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sport])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    setFinished(null)
    setGuess(null)

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
        .from(tables.careerBuilderDaily)
        .select('player_id, selected_seasons')
        .eq('game_date', today)
        .eq('era', era)
        .eq('difficulty', difficulty)
        .maybeSingle()
      if (dailyErr || !daily) {
        if (!cancelled) {
          setError('No Career Builder puzzle scheduled for this era/difficulty today.')
          setLoading(false)
        }
        return
      }

      const [{ data: p }, { data: seasons }] = await Promise.all([
        supabase.from(tables.players).select(PLAYER_FIELDS[sport]).eq('id', daily.player_id).single(),
        supabase.from(tables.seasonStats).select('*').eq('player_id', daily.player_id).order('season'),
      ])

      if (!cancelled) {
        const group = config.groupFor(sport === 'mlb' ? p.position_group : p.position)
        const statKey = config.primary[group]
        const displayKeys = config.display[group]

        let chosen
        if (Array.isArray(daily.selected_seasons) && daily.selected_seasons.length > 0) {
          chosen = (seasons || []).filter((s) => daily.selected_seasons.includes(s.season))
        } else {
          chosen = pickFiveSeasons(seasons || [], statKey, displayKeys)
        }

        setPlayer({ ...p, group })
        setCards(shuffle(chosen))
        setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [today, sport, era, difficulty, gameKey, tables.careerBuilderDaily, tables.players, tables.seasonStats, config])

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
    saveTodayResult(gameKey, today, result)
    bumpStreak(gameKey, today, correctPositions === 5)
    setFinished(result)
  }

  const title = `Career Builder — ${SPORT_META[sport].label}`

  const shell = (body) => (
    <GameShell emoji="📈" title={title}>
      <EraSelector sport={sport} value={era} onChange={setEra} />
      <div className="mb-4 flex overflow-hidden rounded-lg border border-[var(--color-border)]">
        {['normal', 'hard'].map((d) => (
          <button
            key={d}
            onClick={() => setDifficulty(d)}
            className={`flex-1 py-2 text-sm font-bold ${
              difficulty === d ? 'bg-[var(--color-primary)] text-white' : 'bg-[var(--color-elevated)] text-[var(--color-text-tertiary)]'
            }`}
          >
            {d === 'hard' ? 'HARD' : 'NORMAL'}
          </button>
        ))}
      </div>
      {body}
    </GameShell>
  )

  if (loading) return shell(<Loading />)
  if (error) return shell(<ErrorMsg message={error} />)

  if (finished) {
    return shell(
      <>
        <p className="mb-4 text-center font-semibold">
          {finished.correctPositions}/5 seasons in the right order
          {finished.guessedPlayer ? ' — and you guessed the player! 🎉' : `. Player: ${finished.playerName}`}
        </p>
        <ShareResult text={buildShareText('career-builder', today, finished)} />
      </>
    )
  }

  const displayKeys = config.display[player.group]

  return shell(
    <>
      <p className="mb-4 text-sm text-[var(--color-text-secondary)]">
        Put these 5 seasons in chronological order (earliest first). Use the arrows to reorder.
      </p>

      <div className="space-y-2">
        {cards.map((c, i) => (
          <div key={c.id} className="flex items-center gap-3 border border-[var(--color-border)] bg-[var(--color-surface)] p-3">
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
              <button onClick={() => move(i, -1)} disabled={i === 0} className="h-6 w-6 bg-[var(--color-elevated)] text-xs disabled:opacity-30">▲</button>
              <button onClick={() => move(i, 1)} disabled={i === cards.length - 1} className="h-6 w-6 bg-[var(--color-elevated)] text-xs disabled:opacity-30">▼</button>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6">
        <p className="mb-2 text-sm text-[var(--color-text-secondary)]">Bonus: guess the player</p>
        <PlayerSearchInput table={tables.players} onSelect={setGuess} placeholder="Optional player guess…" />
        {guess && <p className="mt-2 text-sm">Guessed: <span className="font-semibold">{guess.full_name}</span></p>}
      </div>

      <button onClick={submit} className="mt-6 w-full rounded-lg bg-[var(--color-primary)] py-3 font-bold text-white">
        Submit Order
      </button>
    </>
  )
}
