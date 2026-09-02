import { useEffect, useState } from 'react'
import { supabase, todayStr } from '../lib/supabase'
import { getTodayResult, saveTodayResult, bumpStreak, getInProgress, saveInProgress } from '../lib/storage'
import { buildShareText } from '../lib/share'
import { useSport } from '../context/SportContext'
import { TABLES, SPORT_META, ERAS } from '../lib/sports'
import { progressionConfig, nflGroupFor, progressionScoreForYear, progressionPotentialScore, progressionStatKeysFor } from '../lib/progression'
import GameShell, { Loading, ErrorMsg } from '../components/GameShell'
import PlayerSearchInput from '../components/PlayerSearchInput'
import ShareResult from '../components/ShareResult'
import EraSelector from '../components/EraSelector'
import GroupScoreBanner from '../components/GroupScoreBanner'

const PLAYER_FIELDS = {
  nfl: 'id, full_name, position',
  mlb: 'id, full_name, position, position_group',
  nba: 'id, full_name, position',
}

const DIFFICULTY_META = {
  medium: { label: 'Medium', description: 'Recognizable starters — team shown each season' },
  hard: { label: 'Hard', description: 'Deeper cuts, backups & role players — no team shown' },
}

export default function Progression() {
  const { sport } = useSport()
  const tables = TABLES[sport]

  const [era, setEra] = useState(ERAS[sport][0].key)
  const [difficulty, setDifficulty] = useState('medium')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [player, setPlayer] = useState(null)
  const [config, setConfig] = useState(null)
  const [seasons, setSeasons] = useState([]) // all, ascending — season.yearNumber = index+1
  const [currentYear, setCurrentYear] = useState(1)
  const [wrongGuesses, setWrongGuesses] = useState(0)
  const [flashRed, setFlashRed] = useState(false)
  const [pendingGuess, setPendingGuess] = useState(null)
  const [finished, setFinished] = useState(null)
  const today = todayStr()
  const gameKey = `${sport}-progression-${era}-${difficulty}`

  useEffect(() => {
    if (!ERAS[sport].some((e) => e.key === era)) setEra(ERAS[sport][0].key)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sport])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    setFinished(null)
    setPendingGuess(null)

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
        .eq('era', era)
        .eq('difficulty', difficulty)
        .maybeSingle()
      if (dailyErr || !daily) {
        if (!cancelled) {
          setError(`No ${DIFFICULTY_META[difficulty].label} puzzle scheduled for this era today.`)
          setLoading(false)
        }
        return
      }

      const [{ data: p }, { data: s }] = await Promise.all([
        supabase.from(tables.players).select(PLAYER_FIELDS[sport]).eq('id', daily.player_id).single(),
        supabase.from(tables.seasonStats).select('*').eq('player_id', daily.player_id).order('season'),
      ])
      if (cancelled) return

      const group = sport === 'mlb' ? p.position_group : sport === 'nba' ? 'ALL' : nflGroupFor(p.position)
      const cfg = progressionConfig(sport, group)

      const saved = getInProgress(gameKey, today)

      setPlayer(p)
      setConfig(cfg)
      setSeasons(s || [])
      setCurrentYear(saved?.currentYear ?? 1)
      setWrongGuesses(saved?.wrongGuesses ?? 0)
      setLoading(false)
    }
    load()
    return () => {
      cancelled = true
    }
  }, [today, sport, era, difficulty, gameKey, tables.progressionDaily, tables.players, tables.seasonStats])

  const totalSeasons = seasons.length
  const isLastYear = currentYear >= totalSeasons
  const potentialScore = totalSeasons ? progressionPotentialScore({ totalSeasons, year: currentYear, wrongGuesses }) : 0

  function persist(next) {
    saveInProgress(gameKey, today, { currentYear, wrongGuesses, ...next })
  }

  function finishGame(guessedCorrectly, year) {
    const finalScore = guessedCorrectly ? progressionPotentialScore({ totalSeasons, year, wrongGuesses }) : 0
    const baseScore = guessedCorrectly ? progressionScoreForYear(totalSeasons, year) : 0
    const result = {
      sport,
      guessedCorrectly,
      seasonsRevealed: year,
      wrongGuesses,
      finalScore,
      baseScore,
      penalty: wrongGuesses * 50,
      difficulty,
      difficultyLabel: DIFFICULTY_META[difficulty].label,
      playerName: player.full_name,
      totalSeasons,
    }
    saveTodayResult(gameKey, today, result)
    bumpStreak(gameKey, today, guessedCorrectly)
    setFinished(result)
  }

  function handleGuess(guessed) {
    setPendingGuess(null)
    if (guessed.id === player.id) {
      finishGame(true, currentYear)
      return
    }
    const nextWrong = wrongGuesses + 1
    setWrongGuesses(nextWrong)
    setFlashRed(true)
    setTimeout(() => {
      setFlashRed(false)
      if (isLastYear) {
        finishGame(false, totalSeasons)
      } else {
        setCurrentYear(currentYear + 1)
        saveInProgress(gameKey, today, { currentYear: currentYear + 1, wrongGuesses: nextWrong })
      }
    }, 500)
  }

  function handleSkip() {
    if (isLastYear) {
      finishGame(false, totalSeasons)
    } else {
      setCurrentYear(currentYear + 1)
      persist({ currentYear: currentYear + 1 })
    }
  }

  const title = `The Progression — ${SPORT_META[sport].label}`

  const shell = (body) => (
    <GameShell emoji="⏩" title={title} howToPlay="progression">
      <EraSelector sport={sport} value={era} onChange={setEra} />
      <div className="mb-2 flex overflow-hidden rounded-lg border border-[var(--color-border)]">
        {['medium', 'hard'].map((d) => (
          <button
            key={d}
            onClick={() => setDifficulty(d)}
            className={`flex-1 py-2 text-sm font-bold ${
              difficulty === d ? 'bg-[var(--color-primary)] text-white' : 'bg-[var(--color-elevated)] text-[var(--color-text-tertiary)]'
            }`}
          >
            {DIFFICULTY_META[d].label.toUpperCase()}
          </button>
        ))}
      </div>
      <p className="mb-4 text-xs text-[var(--color-text-tertiary)]">{DIFFICULTY_META[difficulty].description}</p>
      {body}
    </GameShell>
  )

  if (loading) return shell(<Loading />)
  if (error) return shell(<ErrorMsg message={error} />)

  if (finished) {
    return shell(
      <>
        <p className="mb-1 text-center font-semibold">
          {finished.guessedCorrectly ? `Guessed after Year ${finished.seasonsRevealed}! 🎉` : `Didn't guess it — it was ${finished.playerName}`}
        </p>
        <div className="my-4 border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
          <div className="flex justify-between py-0.5 text-sm">
            <span className="text-[var(--color-text-secondary)]">Base score</span>
            <span className="font-bold">{finished.guessedCorrectly ? `+${finished.baseScore}` : '—'}</span>
          </div>
          {finished.penalty > 0 && (
            <div className="flex justify-between py-0.5 text-sm">
              <span className="text-[var(--color-text-secondary)]">Wrong guess penalty</span>
              <span className="font-bold">-{finished.penalty}</span>
            </div>
          )}
          <div className="my-2 border-t border-[var(--color-border)]" />
          <div className="flex justify-between py-0.5">
            <span className="font-bold">Final Score</span>
            <span className="font-bold text-[var(--color-primary)]">{finished.finalScore} / 1000</span>
          </div>
        </div>
        <div className="mb-4 flex gap-3">
          <div className="flex-1 bg-[var(--color-elevated)] p-3 text-center">
            <p className="font-bold">{finished.seasonsRevealed}</p>
            <p className="text-xs text-[var(--color-text-tertiary)]">Seasons revealed</p>
          </div>
          <div className="flex-1 bg-[var(--color-elevated)] p-3 text-center">
            <p className="font-bold">{finished.wrongGuesses}</p>
            <p className="text-xs text-[var(--color-text-tertiary)]">Wrong guesses</p>
          </div>
        </div>
        <ShareResult text={buildShareText('progression', today, finished)} />
        <GroupScoreBanner
          gameType="progression"
          sport={sport}
          era={era}
          score={finished.finalScore}
          details={`Year ${finished.seasonsRevealed}`}
        />
      </>
    )
  }

  const visible = seasons.slice(0, currentYear)

  return shell(
    <>
      <div
        className={`mb-4 flex items-center justify-between border p-3 transition-colors ${
          flashRed ? 'border-[var(--color-error)] bg-[var(--color-error)]/15' : 'border-[var(--color-border)] bg-[var(--color-elevated)]'
        }`}
      >
        <span className="text-sm font-bold">⭐ Guess now for {potentialScore} points</span>
        {wrongGuesses > 0 && <span className="text-xs font-bold text-[var(--color-error)]">Wrong: {wrongGuesses}</span>}
      </div>

      <div className="space-y-2">
        {visible.map((s, i) => {
          const showTeam = difficulty === 'medium'
          const keys = progressionStatKeysFor(config, s)
          return (
            <div key={s.id ?? i} className="border border-[var(--color-border)] bg-[var(--color-surface)] p-3">
              <div className="mb-3 flex items-center justify-between">
                <span className="rounded-full bg-[var(--color-primary)]/15 px-2.5 py-1 text-xs font-bold text-[var(--color-primary)]">
                  Year {i + 1}
                </span>
                {showTeam && s.team && <span className="text-sm font-semibold text-[var(--color-text-secondary)]">{s.team}</span>}
              </div>
              <div className="flex flex-wrap gap-2">
                {keys.map((k) => (
                  <div key={k} className="w-20 bg-[var(--color-elevated)] py-2 text-center">
                    <p className="font-bold tabular-nums">{config.formatValue(s, k)}</p>
                    <p className="text-[10px] text-[var(--color-text-tertiary)]">{config.labelFor(k)}</p>
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>

      <div className="mt-4">
        <p className="mb-1.5 text-xs font-semibold text-[var(--color-text-secondary)]">Who is this player?</p>
        {pendingGuess ? (
          <div className="flex items-center justify-between border border-[var(--color-primary)] bg-[var(--color-surface)] px-3.5 py-2.5">
            <span className="font-bold">{pendingGuess.full_name}</span>
            <button onClick={() => setPendingGuess(null)} className="text-[var(--color-text-tertiary)]">✕</button>
          </div>
        ) : (
          <PlayerSearchInput table={tables.players} onSelect={setPendingGuess} placeholder="Guess the player…" />
        )}
        <div className="mt-3 flex gap-2">
          <button
            onClick={() => pendingGuess && handleGuess(pendingGuess)}
            disabled={!pendingGuess}
            className="flex-1 rounded-lg bg-[var(--color-primary)] py-3 font-bold text-white disabled:opacity-40"
          >
            Submit Guess
          </button>
          <button
            onClick={handleSkip}
            className="flex-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-elevated)] py-3 text-sm font-semibold"
          >
            {isLastYear ? 'Reveal Answer' : `Skip to Year ${currentYear + 1}`}
          </button>
        </div>
      </div>
    </>
  )
}
