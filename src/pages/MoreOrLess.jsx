import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { getBest, setBestIfHigher } from '../lib/storage'
import { buildShareText } from '../lib/share'
import { todayStr } from '../lib/supabase'
import GameShell, { Loading } from '../components/GameShell'
import ShareResult from '../components/ShareResult'

const ERAS = [
  { key: '1970s', label: '1970s', from: 1970, to: 1979 },
  { key: '1980s', label: '1980s', from: 1980, to: 1989 },
  { key: '1990s', label: '1990s', from: 1990, to: 1999 },
  { key: '2000s', label: '2000s', from: 2000, to: 2009 },
  { key: '2010s', label: '2010s', from: 2010, to: 2019 },
  { key: 'all', label: 'All Time', from: null, to: null },
]

const STAT_BY_GROUP = {
  QB: ['passing_yards', 'Career Passing Yards'],
  RB: ['rushing_yards', 'Career Rushing Yards'],
  REC: ['receiving_yards', 'Career Receiving Yards'],
  DEF: ['tackles', 'Career Tackles'],
}

const START_LIVES = 3
const STORAGE_KEY = 'more-or-less'

async function fetchPair(era) {
  const group = ['QB', 'RB', 'REC', 'DEF'][Math.floor(Math.random() * 4)]
  const [statKey] = STAT_BY_GROUP[group]
  const positions = group === 'QB' ? ['QB'] : group === 'RB' ? ['RB', 'FB'] : group === 'REC' ? ['WR', 'TE'] : ['LB', 'DB', 'CB', 'S', 'DE', 'DT', 'DL']

  let query = supabase.from('nfl_players').select('id, full_name, position, current_team, season_first').in('position', positions).limit(300)
  if (era.from) query = query.gte('season_first', era.from).lte('season_first', era.to)
  const { data: players } = await query
  if (!players || players.length < 2) return null

  const ids = players.map((p) => p.id)
  const { data: careerRows } = await supabase.from('nfl_career_stats').select(`player_id, ${statKey}`).in('player_id', ids)
  const statById = new Map((careerRows || []).map((r) => [r.player_id, r[statKey]]))

  const candidates = players.filter((p) => (statById.get(p.id) ?? 0) > 0)
  if (candidates.length < 2) return null

  const shuffled = [...candidates].sort(() => Math.random() - 0.5)
  const [a, b] = shuffled.slice(0, 2)
  return {
    group,
    statKey,
    statLabel: STAT_BY_GROUP[group][1],
    a: { ...a, value: statById.get(a.id) ?? 0 },
    b: { ...b, value: statById.get(b.id) ?? 0 },
  }
}

export default function MoreOrLess() {
  const [era, setEra] = useState(null)
  const [round, setRound] = useState(null)
  const [loading, setLoading] = useState(false)
  const [revealed, setRevealed] = useState(false)
  const [picked, setPicked] = useState(null)
  const [lives, setLives] = useState(START_LIVES)
  const [streak, setStreak] = useState(0)
  const [correctAnswers, setCorrectAnswers] = useState(0)
  const [bestStreak, setBestStreak] = useState(() => getBest(STORAGE_KEY))
  const [gameOver, setGameOver] = useState(false)

  async function startEra(e) {
    setEra(e)
    setLives(START_LIVES)
    setStreak(0)
    setCorrectAnswers(0)
    setGameOver(false)
    await nextRound(e)
  }

  async function nextRound(e) {
    setLoading(true)
    setRevealed(false)
    setPicked(null)
    let pair = null
    for (let i = 0; i < 5 && !pair; i++) pair = await fetchPair(e)
    setRound(pair)
    setLoading(false)
  }

  function handlePick(side) {
    if (revealed || !round) return
    setPicked(side)
    setRevealed(true)
    const correct = (side === 'a' ? round.a.value : round.b.value) >= (side === 'a' ? round.b.value : round.a.value)
    if (correct) {
      const nextStreak = streak + 1
      setStreak(nextStreak)
      setCorrectAnswers((c) => c + 1)
      setBestStreak(setBestIfHigher(STORAGE_KEY, nextStreak))
    } else {
      setStreak(0)
      const remaining = lives - 1
      setLives(remaining)
      if (remaining <= 0) {
        setGameOver(true)
      }
    }
  }

  if (!era) {
    return (
      <GameShell emoji="⚔️" title="More vs Less">
        <p className="mb-4 text-sm text-[var(--color-text-secondary)]">Pick an era to start an endless run.</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {ERAS.map((e) => (
            <button
              key={e.key}
              onClick={() => startEra(e)}
              className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] py-3 font-bold hover:border-[var(--color-primary)]/50"
            >
              {e.label}
            </button>
          ))}
        </div>
      </GameShell>
    )
  }

  if (gameOver) {
    const payload = { correctAnswers, bestStreak }
    return (
      <GameShell emoji="⚔️" title="More vs Less">
        <p className="mb-4 text-center font-semibold">Out of lives! Final score: {correctAnswers} · Best streak 🔥{bestStreak}</p>
        <ShareResult text={buildShareText('more-or-less', todayStr(), payload)} />
        <button onClick={() => setEra(null)} className="mt-4 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-elevated)] py-3 font-semibold">
          Pick a different era
        </button>
      </GameShell>
    )
  }

  return (
    <GameShell emoji="⚔️" title="More vs Less">
      <div className="mb-4 flex items-center justify-between text-sm">
        <span className="font-bold">{era.label}</span>
        <span>{'❤️'.repeat(lives)}</span>
        <span className="text-[var(--color-text-secondary)]">Streak: 🔥{streak}</span>
      </div>

      {loading || !round ? (
        <Loading />
      ) : (
        <>
          <p className="mb-3 text-center text-sm text-[var(--color-text-secondary)]">Who had more {round.statLabel}?</p>
          <div className="grid grid-cols-2 gap-3">
            {['a', 'b'].map((side) => {
              const p = round[side]
              const isPicked = picked === side
              return (
                <button
                  key={side}
                  onClick={() => handlePick(side)}
                  disabled={revealed}
                  className={`rounded-2xl border p-4 text-center transition-colors ${
                    revealed
                      ? isPicked
                        ? p.value >= round[side === 'a' ? 'b' : 'a'].value
                          ? 'border-[var(--color-success)] bg-[var(--color-success)]/10'
                          : 'border-[var(--color-primary)] bg-[var(--color-primary)]/10'
                        : 'border-[var(--color-border)] bg-[var(--color-surface)]'
                      : 'border-[var(--color-border)] bg-[var(--color-surface)] hover:border-[var(--color-primary)]/50'
                  }`}
                >
                  <p className="font-extrabold">{p.full_name}</p>
                  <p className="text-xs text-[var(--color-text-secondary)]">{p.position} · {p.current_team}</p>
                  {revealed && <p className="mt-2 text-lg font-bold tabular-nums">{p.value.toLocaleString()}</p>}
                </button>
              )
            })}
          </div>

          {revealed && (
            <button onClick={() => nextRound(era)} className="mt-4 w-full rounded-xl bg-[var(--color-primary)] py-3 font-bold text-white">
              Next Matchup
            </button>
          )}
        </>
      )}
    </GameShell>
  )
}
