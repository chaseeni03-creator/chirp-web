import { useEffect, useState } from 'react'
import { supabase, todayStr } from '../lib/supabase'
import { getTodayResult, saveTodayResult, bumpStreak, getInProgress, saveInProgress } from '../lib/storage'
import { buildShareText } from '../lib/share'
import { useSport } from '../context/SportContext'
import { TABLES, SPORT_META, ERAS } from '../lib/sports'
import {
  buildNflMystery, buildMlbMystery, buildNbaMystery,
  nflHintsAgainst, HINT_LABELS, nflTeammateImpact, mlbTeammateImpact, nbaTeammateImpact,
  isRevealed, gridStatKeys,
} from '../lib/statLine'
import GameShell, { Loading, ErrorMsg } from '../components/GameShell'
import PlayerSearchInput from '../components/PlayerSearchInput'
import ShareResult from '../components/ShareResult'
import EraSelector from '../components/EraSelector'

const NFL_HINT_PLAYER_FIELDS = 'id, full_name, position, current_team, previous_teams, conference, season_first, season_last'
const PLAYER_FIELDS = {
  nfl: 'id, full_name, position, conference',
  mlb: 'id, full_name, position, position_group',
  nba: 'id, full_name, position',
}

const META_LABELS = {
  '@conference': (m) => ({ label: 'Conference', value: m.seasonConference ?? 'Unknown' }),
  '@division': (m) => ({ label: 'Division', value: m.seasonDivision ?? 'Unknown' }),
  '@season': (m) => ({ label: 'Season', value: String(m.season) }),
  '@team': (m) => ({ label: 'Team', value: m.team ?? 'Unknown' }),
}

async function fetchTeammates(sport, tables, team, season, excludeId) {
  if (!team) return []
  const configs = {
    nfl: { table: tables.seasonStats, select: 'player_id, passing_yards, rushing_yards, receiving_yards, tackles, sacks, nfl_players(full_name)', playerKey: 'nfl_players', impact: nflTeammateImpact },
    mlb: { table: tables.seasonStats, select: 'player_id, hits, home_runs, rbi, wins, strikeouts_pitched, saves, mlb_players(full_name)', playerKey: 'mlb_players', impact: mlbTeammateImpact },
    nba: { table: tables.seasonStats, select: 'player_id, total_points, total_rebounds, total_assists, nba_players(full_name)', playerKey: 'nba_players', impact: nbaTeammateImpact },
  }
  const cfg = configs[sport]
  const { data } = await supabase.from(cfg.table).select(cfg.select).eq('team', team).eq('season', season).neq('player_id', excludeId)
  if (!data) return []
  const sorted = [...data].sort((a, b) => cfg.impact(b) - cfg.impact(a))
  const names = []
  for (const r of sorted) {
    const name = r[cfg.playerKey]?.full_name
    if (name && !names.includes(name)) names.push(name)
    if (names.length >= 2) break
  }
  return names
}

export default function StatLine() {
  const { sport } = useSport()
  const tables = TABLES[sport]

  const [era, setEra] = useState(ERAS[sport][0].key)
  const [difficulty, setDifficulty] = useState('normal')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [mystery, setMystery] = useState(null)
  const [mysteryPlayer, setMysteryPlayer] = useState(null)
  const [revealed, setRevealed] = useState(1)
  const [wrongGuesses, setWrongGuesses] = useState([])
  const [hints, setHints] = useState(new Set())
  const [teammates, setTeammates] = useState([])
  const [finished, setFinished] = useState(null)
  const today = todayStr()
  const gameKey = `${sport}-stat-line-${era}-${difficulty}`

  useEffect(() => {
    if (!ERAS[sport].some((e) => e.key === era)) setEra(ERAS[sport][0].key)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sport])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    setFinished(null)
    setRevealed(1)
    setWrongGuesses([])
    setHints(new Set())
    setTeammates([])

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
        .from(tables.statLineDaily)
        .select('player_id, season')
        .eq('game_date', today)
        .eq('era', era)
        .eq('pool_difficulty', difficulty)
        .maybeSingle()
      if (dailyErr || !daily) {
        if (!cancelled) {
          setError('No Stat Line puzzle scheduled for this era/difficulty today.')
          setLoading(false)
        }
        return
      }

      const playerFields = sport === 'nfl' ? NFL_HINT_PLAYER_FIELDS : PLAYER_FIELDS[sport]
      const [{ data: p }, { data: s }] = await Promise.all([
        supabase.from(tables.players).select(playerFields).eq('id', daily.player_id).single(),
        supabase.from(tables.seasonStats).select('*').eq('player_id', daily.player_id).eq('season', daily.season).maybeSingle(),
      ])

      if (!cancelled) {
        const m = sport === 'mlb' ? buildMlbMystery(s, p) : sport === 'nba' ? buildNbaMystery(s, p) : buildNflMystery(s, p)
        setMystery(m)
        setMysteryPlayer(p)
        const saved = getInProgress(gameKey, today)
        if (saved) {
          setRevealed(saved.revealed)
          setWrongGuesses(saved.wrongGuesses || [])
          setTeammates(saved.teammates || [])
        }
        setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [today, sport, era, difficulty, gameKey, tables.statLineDaily, tables.players, tables.seasonStats])

  function persist(nextRevealed, nextWrong, nextTeammates) {
    saveInProgress(gameKey, today, { revealed: nextRevealed, wrongGuesses: nextWrong, teammates: nextTeammates })
  }

  async function maybeLoadTeammates(nextRevealed, nextWrong) {
    if (nextRevealed < mystery.clueSteps.length) return teammates
    if (teammates.length > 0) return teammates
    const names = await fetchTeammates(sport, tables, mystery.team, mystery.season, mysteryPlayer.id)
    setTeammates(names)
    persist(nextRevealed, nextWrong, names)
    return names
  }

  function finish(won, finalRevealed, finalTeammates) {
    const score = won ? mystery.scoreTable[finalRevealed] || 0 : 0
    const result = { won, cluesUsed: finalRevealed, maxClues: mystery.clueSteps.length, score, playerName: mysteryPlayer.full_name, teammate: finalTeammates?.[0] ?? null }
    saveTodayResult(gameKey, today, result)
    bumpStreak(gameKey, today, won)
    setFinished(result)
  }

  async function handleSkip() {
    const next = Math.min(revealed + 1, mystery.clueSteps.length)
    const nextWrong = [...wrongGuesses, 'Skipped']
    setWrongGuesses(nextWrong)
    setRevealed(next)
    setHints(new Set())
    const nextTeammates = await maybeLoadTeammates(next, nextWrong)
    persist(next, nextWrong, nextTeammates)
    if (next >= mystery.clueSteps.length) finish(false, next, nextTeammates)
  }

  async function handleGuess(guessedPlayer) {
    if (guessedPlayer.id === mysteryPlayer.id) {
      const nextTeammates = await maybeLoadTeammates(revealed, wrongGuesses)
      finish(true, revealed, nextTeammates)
      return
    }
    if (sport === 'nfl') {
      const { data: full } = await supabase.from(tables.players).select(NFL_HINT_PLAYER_FIELDS).eq('id', guessedPlayer.id).single()
      setHints(nflHintsAgainst(mystery, mysteryPlayer, full || guessedPlayer))
    }
    const next = Math.min(revealed + 1, mystery.clueSteps.length)
    const nextWrong = [...wrongGuesses, guessedPlayer.full_name]
    setWrongGuesses(nextWrong)
    setRevealed(next)
    const nextTeammates = await maybeLoadTeammates(next, nextWrong)
    persist(next, nextWrong, nextTeammates)
    if (next >= mystery.clueSteps.length) finish(false, next, nextTeammates)
  }

  const title = `Stat Line — ${SPORT_META[sport].label}`

  const shell = (body) => (
    <GameShell emoji="📊" title={title}>
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
        <p className="mb-2 text-center font-semibold">
          {finished.won ? `Solved in ${finished.cluesUsed}/${finished.maxClues} clues! 🎉 (+${finished.score} pts)` : `The answer was ${finished.playerName}.`}
        </p>
        {!finished.won && finished.teammate && (
          <p className="mb-4 text-center text-sm text-[var(--color-text-secondary)]">Teammate that season: {finished.teammate}</p>
        )}
        <ShareResult text={buildShareText('stat-line', today, finished)} />
      </>
    )
  }

  const statKeys = gridStatKeys(mystery.clueSteps)
  const metaSteps = mystery.clueSteps.filter((s) => s.startsWith('@'))

  return shell(
    <>
      <div className="mb-4 flex items-center justify-between border border-[var(--color-border)] bg-[var(--color-elevated)] px-4 py-3">
        <span className="font-bold">{mystery.positionLabel}</span>
        <span className="text-sm text-[var(--color-text-secondary)]">{revealed}/{mystery.clueSteps.length} clues</span>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {statKeys.map((key) => {
          const idx = mystery.clueSteps.indexOf(key)
          const shown = revealed > idx
          return (
            <div key={key} className={`border p-3 ${shown ? 'border-[var(--color-border)] bg-[var(--color-surface)]' : 'border-[var(--color-border)] bg-[var(--color-elevated)]'}`}>
              <p className="text-xs text-[var(--color-text-secondary)]">{mystery.gridHeaders[key]}</p>
              <p className="text-lg font-bold tabular-nums">{shown ? mystery.formatValue(key) : '?'}</p>
            </div>
          )
        })}
      </div>

      {metaSteps.some((tag) => isRevealed(mystery.clueSteps, tag, revealed)) && (
        <div className="mt-3 flex flex-wrap gap-2">
          {metaSteps.filter((tag) => isRevealed(mystery.clueSteps, tag, revealed)).map((tag) => {
            const { label, value } = META_LABELS[tag](mystery)
            return (
              <span key={tag} className="rounded-full border border-[var(--color-border)] bg-[var(--color-elevated)] px-3 py-1 text-xs font-semibold text-[var(--color-text-secondary)]">
                {label}: <span className="text-[var(--color-text)]">{value}</span>
              </span>
            )
          })}
        </div>
      )}

      {hints.size > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {[...hints].map((h) => (
            <span key={h} className="rounded-full border border-[var(--color-success)] bg-[var(--color-success)]/12 px-3 py-1 text-xs font-bold text-[var(--color-success)]">
              {HINT_LABELS[h]} ✓
            </span>
          ))}
        </div>
      )}

      {wrongGuesses.length > 0 && (
        <p className="mt-3 text-xs text-[var(--color-text-secondary)]">Guessed: {wrongGuesses.join(', ')}</p>
      )}

      <div className="mt-6">
        <PlayerSearchInput table={tables.players} onSelect={handleGuess} placeholder="Guess the player…" />
        <button
          onClick={handleSkip}
          className="mt-3 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-elevated)] py-3 text-sm font-semibold text-[var(--color-text)]"
        >
          Skip (reveal next clue)
        </button>
      </div>
    </>
  )
}
