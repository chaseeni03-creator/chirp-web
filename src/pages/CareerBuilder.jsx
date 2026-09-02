import { useEffect, useState } from 'react'
import { supabase, todayStr } from '../lib/supabase'
import { getTodayResult, saveTodayResult, bumpStreak, getInProgress, saveInProgress } from '../lib/storage'
import { buildShareText } from '../lib/share'
import { useSport } from '../context/SportContext'
import { TABLES, SPORT_META, ERAS } from '../lib/sports'
import {
  scrambleOrder, gradeCareerBuilderOrder, gradeCareerBuilderOrderByTruePosition, scoreCareerBuilder, careerBuilderConfig,
  fallbackFiveSeasons, nflGroupFor, careerArcSummary, GRADE_EMOJI,
} from '../lib/careerBuilder'
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

const LEAGUE_PHRASE = { nfl: 'in the NFL', mlb: 'in MLB', nba: 'in the NBA' }

const gradeBorder = {
  green: 'border-[var(--color-success)]',
  orange: 'border-[var(--color-warning)]',
  red: 'border-[var(--color-primary)]',
}

export default function CareerBuilder() {
  const { sport } = useSport()
  const tables = TABLES[sport]

  const [era, setEra] = useState(ERAS[sport][0].key)
  const [difficulty, setDifficulty] = useState('normal')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [player, setPlayer] = useState(null)
  const [config, setConfig] = useState(null)
  const [seasons, setSeasons] = useState([]) // 5, ascending chronological
  const [totalSeasonsPlayed, setTotalSeasonsPlayed] = useState(0) // full career length, not just the 5 shown
  const [userOrder, setUserOrder] = useState([]) // userOrder[slot] = true chronological index
  const [step, setStep] = useState('ordering')
  const [grades, setGrades] = useState([])
  const [bonusAttempted, setBonusAttempted] = useState(false)
  const [bonusCorrect, setBonusCorrect] = useState(false)
  const [guessedName, setGuessedName] = useState(null)
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
    setStep('ordering')
    setGrades([])
    setBonusAttempted(false)
    setBonusCorrect(false)
    setGuessedName(null)

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

      const [{ data: p }, { data: allSeasons }] = await Promise.all([
        supabase.from(tables.players).select(PLAYER_FIELDS[sport]).eq('id', daily.player_id).single(),
        supabase.from(tables.seasonStats).select('*').eq('player_id', daily.player_id).order('season'),
      ])
      if (cancelled) return

      const group = sport === 'mlb' ? p.position_group : sport === 'nba' ? 'ALL' : nflGroupFor(p.position)
      const cfg = careerBuilderConfig(sport, group)

      let chosen
      if (Array.isArray(daily.selected_seasons) && daily.selected_seasons.length === 5) {
        chosen = (allSeasons || []).filter((s) => daily.selected_seasons.includes(s.season))
      }
      if (!chosen || chosen.length !== 5) {
        chosen = fallbackFiveSeasons(allSeasons || [])
      }
      chosen = [...chosen].sort((a, b) => a.season - b.season)

      const saved = getInProgress(gameKey, today)
      const order = saved?.userOrder || scrambleOrder(daily.player_id, today)

      setPlayer(p)
      setConfig(cfg)
      setSeasons(chosen)
      setTotalSeasonsPlayed((allSeasons || []).length)
      setUserOrder(order)
      if (saved) {
        setStep(saved.step || 'ordering')
        setBonusAttempted(saved.bonusAttempted || false)
        setBonusCorrect(saved.bonusCorrect || false)
        setGuessedName(saved.guessedName || null)
        if (saved.step === 'orderRevealed' || saved.step === 'bonusPrompt') {
          setGrades(gradeCareerBuilderOrder(order))
        }
      }
      setLoading(false)
    }
    load()
    return () => {
      cancelled = true
    }
  }, [today, sport, era, difficulty, gameKey, tables.careerBuilderDaily, tables.players, tables.seasonStats])

  function persist(next) {
    saveInProgress(gameKey, today, { userOrder, step, bonusAttempted, bonusCorrect, guessedName, ...next })
  }

  function move(slot, dir) {
    const next = [...userOrder]
    const target = slot + dir
    if (target < 0 || target >= next.length) return
    ;[next[slot], next[target]] = [next[target], next[slot]]
    setUserOrder(next)
    persist({ userOrder: next })
  }

  function confirmOrder() {
    const g = gradeCareerBuilderOrder(userOrder)
    setGrades(g)
    setStep('orderRevealed')
    persist({ step: 'orderRevealed' })
  }

  function goToBonus() {
    setStep('bonusPrompt')
    persist({ step: 'bonusPrompt' })
  }

  function finishGame(attempted, correct, name) {
    const s = scoreCareerBuilder(userOrder, correct)
    setStep('finalReveal')
    persist({ step: 'finalReveal', bonusAttempted: attempted, bonusCorrect: correct, guessedName: name })

    const result = {
      grades: gradeCareerBuilderOrderByTruePosition(userOrder),
      greenCount: s.greenCount,
      orderPoints: s.orderPoints,
      bonusAttempted: attempted,
      bonusCorrect: correct,
      bonusPoints: s.bonusPoints,
      totalScore: s.totalScore,
      playerName: player.full_name,
      position: player.position,
      group: config.group,
      seasons, // ascending chronological, for the true-order final reveal
      guessedName: name,
    }
    saveTodayResult(gameKey, today, result)
    bumpStreak(gameKey, today, s.greenCount === 5)
    setFinished(result)
  }

  function handleBonusGuess(guessed) {
    const correct = guessed.id === player.id
    setBonusAttempted(true)
    setBonusCorrect(correct)
    setGuessedName(guessed.full_name)
    finishGame(true, correct, guessed.full_name)
  }

  function handleSkipBonus() {
    finishGame(false, false, null)
  }

  const title = `Career Builder — ${SPORT_META[sport].label}`

  const shell = (body) => (
    <GameShell emoji="📈" title={title} howToPlay="career-builder">
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
    const finishedGroup = finished.group ?? config?.group
    const finishedConfig = finishedGroup ? careerBuilderConfig(sport, finishedGroup) : config
    const headline = finished.bonusCorrect ? '🎉 Bonus correct!' : finished.bonusAttempted ? '❌ Bonus missed' : "👀 Here's who it was"
    const headlineColor = finished.bonusCorrect
      ? 'text-[var(--color-success)]'
      : finished.bonusAttempted
        ? 'text-[var(--color-error)]'
        : 'text-[var(--color-text-secondary)]'
    return shell(
      <>
        <div className="mb-3 border border-[var(--color-border)] bg-[var(--color-elevated)] p-4">
          <p className={`text-sm font-bold ${headlineColor}`}>{headline}</p>
          <p className="mt-0.5 text-lg font-bold">{finished.playerName}</p>
          {finished.position && <p className="text-xs text-[var(--color-text-secondary)]">{finished.position}</p>}
          {finished.bonusAttempted && !finished.bonusCorrect && finished.guessedName && (
            <p className="mt-1 text-xs text-[var(--color-text-tertiary)]">You guessed: {finished.guessedName}</p>
          )}
        </div>

        {!finished.bonusCorrect && finishedConfig && finished.seasons?.length === 5 && (
          <div className="mb-3 flex items-start gap-2 border border-[var(--color-border)] bg-[var(--color-elevated)] p-3">
            <span className="text-[var(--color-warning)]">💡</span>
            <p className="text-xs text-[var(--color-text-secondary)]">{careerArcSummary(finishedConfig, finished.seasons)}</p>
          </div>
        )}

        {finishedConfig && finished.seasons?.length === 5 && (
          <div className="mb-4 space-y-2">
            {finished.seasons.map((s, i) => {
              const grade = finished.grades[i]
              return (
                <div key={s.season} className={`border bg-[var(--color-surface)] p-3 ${grade ? gradeBorder[grade] : 'border-[var(--color-border)]'}`}>
                  <div className="mb-1 flex items-center justify-between">
                    <span className="font-bold text-[var(--color-text-secondary)]">{s.season}</span>
                    {s.team && <span className="text-sm font-semibold">{s.team}</span>}
                  </div>
                  <div className="flex flex-wrap gap-3">
                    {finishedConfig.statKeys.map((key) => (
                      <div key={key}>
                        <p className="text-[10px] text-[var(--color-text-secondary)]">{finishedConfig.labelFor(key)}</p>
                        <p className="font-bold tabular-nums">{finishedConfig.formatValue(s, key)}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        <div className="mb-4 border border-[var(--color-border)] bg-[var(--color-elevated)] p-3 text-sm">
          <p className="mb-2 text-xs font-bold tracking-wide text-[var(--color-text-tertiary)]">SCORE BREAKDOWN</p>
          <div className="flex justify-between py-0.5">
            <span className="text-[var(--color-text-secondary)]">Order accuracy</span>
            <span className="font-bold">{finished.greenCount}/5 correct spots (+{finished.orderPoints})</span>
          </div>
          <div className="flex justify-between py-0.5">
            <span className="text-[var(--color-text-secondary)]">Bonus guess</span>
            <span className="font-bold">
              {!finished.bonusAttempted ? 'Skipped' : finished.bonusCorrect ? `Correct ✓ (+${finished.bonusPoints})` : 'Missed ✗ (+0)'}
            </span>
          </div>
          <div className="mt-2 flex justify-between border-t border-[var(--color-border)] pt-2 font-bold">
            <span>Total</span>
            <span className="text-[var(--color-warning)]">{finished.totalScore}/1000</span>
          </div>
        </div>

        <p className="mb-2 text-center text-sm text-[var(--color-text-secondary)]">
          Order: {finished.grades.map((g) => GRADE_EMOJI[g]).join('')} {finished.greenCount}/5 correct
        </p>
        <ShareResult text={buildShareText('career-builder', today, finished)} />
        <GroupScoreBanner
          gameType="career-builder"
          sport={sport}
          era={era}
          score={finished.totalScore}
          details={`${finished.greenCount}/5 order`}
        />
      </>
    )
  }

  const revealSeason = step !== 'ordering'

  return shell(
    <>
      {step === 'ordering' && (
        <>
          <div className="mb-3 flex items-center gap-2 border border-[var(--color-border)] bg-[var(--color-elevated)] px-3.5 py-2.5">
            <span className="text-[var(--color-primary)]">📈</span>
            <p className="text-sm font-semibold text-[var(--color-text-secondary)]">
              This player played {totalSeasonsPlayed} seasons {LEAGUE_PHRASE[sport]}
            </p>
          </div>
          <p className="mb-4 text-sm text-[var(--color-text-secondary)]">
            Put these 5 seasons in chronological order (earliest first). Use the arrows to reorder.
          </p>
        </>
      )}
      {step === 'orderRevealed' && (
        <p className="mb-4 text-sm text-[var(--color-text-secondary)]">
          🟩 exact slot · 🟧 one slot off · 🟥 wrong. Seasons revealed below.
        </p>
      )}
      {step === 'bonusPrompt' && (
        <p className="mb-4 text-sm text-[var(--color-text-secondary)]">Bonus: guess the player for +300 points (one try).</p>
      )}

      <div className="space-y-2">
        {userOrder.map((seasonIdx, slot) => {
          const s = seasons[seasonIdx]
          const grade = grades[slot]
          return (
            <div
              key={seasonIdx}
              className={`flex items-center gap-3 border bg-[var(--color-surface)] p-3 ${grade ? gradeBorder[grade] : 'border-[var(--color-border)]'}`}
            >
              <span className="w-12 shrink-0 text-center font-bold text-[var(--color-text-secondary)]">
                {revealSeason ? s.season : `Slot ${slot + 1}`}
              </span>
              <div className="flex flex-1 flex-wrap gap-3">
                {config.statKeys.map((key) => (
                  <div key={key}>
                    <p className="text-[10px] text-[var(--color-text-secondary)]">{config.labelFor(key)}</p>
                    <p className="font-bold tabular-nums">{config.formatValue(s, key)}</p>
                  </div>
                ))}
                {s.team && (
                  <div>
                    <p className="text-[10px] text-[var(--color-text-secondary)]">Team</p>
                    <p className="font-bold">{s.team}</p>
                  </div>
                )}
              </div>
              {step === 'ordering' && (
                <div className="flex flex-col gap-1">
                  <button onClick={() => move(slot, -1)} disabled={slot === 0} className="h-6 w-6 bg-[var(--color-elevated)] text-xs disabled:opacity-30">▲</button>
                  <button onClick={() => move(slot, 1)} disabled={slot === userOrder.length - 1} className="h-6 w-6 bg-[var(--color-elevated)] text-xs disabled:opacity-30">▼</button>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {step === 'ordering' && (
        <button onClick={confirmOrder} className="mt-6 w-full rounded-lg bg-[var(--color-primary)] py-3 font-bold text-white">
          Confirm Order
        </button>
      )}

      {step === 'orderRevealed' && (
        <button onClick={goToBonus} className="mt-6 w-full rounded-lg bg-[var(--color-primary)] py-3 font-bold text-white">
          Continue
        </button>
      )}

      {step === 'bonusPrompt' && (
        <div className="mt-6">
          <PlayerSearchInput table={tables.players} onSelect={handleBonusGuess} placeholder="Guess the player…" />
          <button onClick={handleSkipBonus} className="mt-3 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-elevated)] py-3 text-sm font-semibold text-[var(--color-text)]">
            Skip
          </button>
        </div>
      )}
    </>
  )
}
