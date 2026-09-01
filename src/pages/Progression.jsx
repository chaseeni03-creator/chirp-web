import { useEffect, useState } from 'react'
import { supabase, todayStr } from '../lib/supabase'
import { getTodayResult, saveTodayResult, bumpStreak, getInProgress, saveInProgress } from '../lib/storage'
import { buildShareText } from '../lib/share'
import { useSport } from '../context/SportContext'
import { TABLES, CAREER_STAT_CONFIG, SPORT_META } from '../lib/sports'
import GameShell, { Loading, ErrorMsg } from '../components/GameShell'
import PlayerSearchInput from '../components/PlayerSearchInput'
import ShareResult from '../components/ShareResult'

const PLAYER_FIELDS = {
  nfl: 'id, full_name, position',
  mlb: 'id, full_name, position, position_group',
  nba: 'id, full_name, position',
}

export default function Progression() {
  const { sport } = useSport()
  const tables = TABLES[sport]
  const config = CAREER_STAT_CONFIG[sport]

  const [difficulty, setDifficulty] = useState('medium')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [player, setPlayer] = useState(null)
  const [seasons, setSeasons] = useState([])
  const [revealed, setRevealed] = useState(1)
  const [finished, setFinished] = useState(null)
  const today = todayStr()
  const gameKey = `${sport}-progression-${difficulty}`

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    setFinished(null)

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
        .from(tables.progressionDaily)
        .select('player_id')
        .eq('game_date', today)
        .eq('difficulty', difficulty)
        .maybeSingle()
      if (dailyErr || !daily) {
        if (!cancelled) {
          setError(`No ${difficulty === 'hard' ? 'Hard' : 'Normal'} mode puzzle scheduled for today.`)
          setLoading(false)
        }
        return
      }

      const [{ data: p }, { data: s }] = await Promise.all([
        supabase.from(tables.players).select(PLAYER_FIELDS[sport]).eq('id', daily.player_id).single(),
        supabase.from(tables.seasonStats).select('*').eq('player_id', daily.player_id).order('season'),
      ])

      if (!cancelled) {
        setPlayer(p)
        setSeasons(s || [])
        const saved = getInProgress(gameKey, today)
        setRevealed(saved?.revealed ?? 1)
        setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [today, sport, difficulty, gameKey, tables.progressionDaily, tables.players, tables.seasonStats])

  function finish(won) {
    const result = { won, seasonsRevealed: revealed, difficulty: difficulty === 'hard' ? 'Hard' : 'Normal', playerName: player.full_name }
    saveTodayResult(gameKey, today, result)
    bumpStreak(gameKey, today, won)
    setFinished(result)
  }

  function handleGuess(guessed) {
    if (guessed.id === player.id) {
      finish(true)
      return
    }
    const next = Math.min(revealed + 1, seasons.length)
    setRevealed(next)
    saveInProgress(gameKey, today, { revealed: next })
    if (next >= seasons.length) finish(false)
  }

  const title = `The Progression — ${SPORT_META[sport].label}`

  const shell = (body) => (
    <GameShell emoji="⏩" title={title}>
      <div className="mb-4 flex overflow-hidden rounded-xl border border-[var(--color-border)]">
        {['medium', 'hard'].map((d) => (
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
          {finished.won
            ? `Solved after ${finished.seasonsRevealed} season${finished.seasonsRevealed === 1 ? '' : 's'}! 🎉`
            : `The answer was ${finished.playerName}.`}
        </p>
        <ShareResult text={buildShareText('progression', today, finished)} />
      </>
    )
  }

  const group = config.groupFor(sport === 'mlb' ? player.position_group : player.position)
  const statKey = config.primary[group]
  const statLabel = config.primaryLabel[group]
  const visible = seasons.slice(0, revealed)

  return shell(
    <>
      <p className="mb-4 text-sm text-[var(--color-text-secondary)]">
        Guess the player from their career, one season at a time.
      </p>
      <PlayerSearchInput table={tables.players} onSelect={handleGuess} placeholder="Guess the player…" />

      <div className="mt-6 space-y-2">
        {visible.map((s, i) => (
          <div key={s.id} className="flex items-center justify-between rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3">
            <span className="font-bold">Year {i + 1}</span>
            <span className="text-sm text-[var(--color-text-secondary)]">{s.team}</span>
            <span className="font-bold tabular-nums">
              {s[statKey] ?? 0} {statLabel}
            </span>
          </div>
        ))}
      </div>
    </>
  )
}
