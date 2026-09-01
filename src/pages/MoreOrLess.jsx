import { useState } from 'react'
import { todayStr } from '../lib/supabase'
import { getBest, setBestIfHigher } from '../lib/storage'
import { buildShareText } from '../lib/share'
import { useSport } from '../context/SportContext'
import { TABLES, SPORT_META } from '../lib/sports'
import {
  NFL_ERAS, NFL_DIFFICULTIES, modesFor, MAX_LIVES, STARTING_LIVES,
  pointsForStreak, survivalBonusFor, questionText, shortLabel,
  generateInitialMatchup, generateNextMatchup, resetSessionCaches, pairKey,
} from '../lib/moreOrLess'
import GameShell from '../components/GameShell'
import ShareResult from '../components/ShareResult'

export default function MoreOrLess() {
  const { sport } = useSport()
  const tables = TABLES[sport]

  const [phase, setPhase] = useState('start')
  const [era, setEra] = useState('allTime') // NFL only
  const [difficulty, setDifficulty] = useState('normal') // NFL only
  const [mode, setMode] = useState(modesFor(sport)[0].key) // MLB/NBA only

  const [matchup, setMatchup] = useState(null)
  const [lives, setLives] = useState(STARTING_LIVES)
  const [streak, setStreak] = useState(0)
  const [bestStreak, setBestStreak] = useState(0)
  const [score, setScore] = useState(0)
  const [roundsPlayed, setRoundsPlayed] = useState(0)
  const [correctAnswers, setCorrectAnswers] = useState(0)
  const [championRounds, setChampionRounds] = useState(0)
  const [championHistory, setChampionHistory] = useState([])
  const [usedPairKeys, setUsedPairKeys] = useState(() => new Set())

  const [revealing, setRevealing] = useState(false)
  const [lastPickedChampion, setLastPickedChampion] = useState(true)
  const [lastCorrect, setLastCorrect] = useState(false)
  const [lastChallengerWon, setLastChallengerWon] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [result, setResult] = useState(null)
  const [notice, setNotice] = useState(null)

  const modeKeyForRpc = sport === 'nfl' ? difficulty : mode
  const eraObj = sport === 'nfl' ? NFL_ERAS.find((e) => e.key === era) : null
  const bestKey = sport === 'nfl' ? `${sport}-more-or-less-${era}_${difficulty}` : `${sport}-more-or-less-${mode}`

  async function startGame() {
    resetSessionCaches(sport)
    const pairKeys = new Set()
    setPhase('playing')
    setLives(STARTING_LIVES)
    setStreak(0)
    setBestStreak(0)
    setScore(0)
    setRoundsPlayed(0)
    setCorrectAnswers(0)
    setChampionRounds(0)
    setChampionHistory([])
    setUsedPairKeys(pairKeys)
    setRevealing(false)
    setGenerating(true)
    setMatchup(null)
    setNotice(null)
    const m = await generateInitialMatchup(sport, tables, { modeKey: modeKeyForRpc, era: eraObj, round: 1, usedPairKeys: pairKeys })
    if (!m) {
      setGenerating(false)
      setPhase('start')
      setNotice("Couldn't find a matchup — try again")
      return
    }
    setMatchup(m)
    setGenerating(false)
  }

  async function loadNextRound(champion, round, pairKeys) {
    let next = await generateNextMatchup(sport, tables, { champion, modeKey: modeKeyForRpc, era: eraObj, round, usedPairKeys: pairKeys })
    if (!next) next = await generateNextMatchup(sport, tables, { champion, modeKey: modeKeyForRpc, era: eraObj, round, usedPairKeys: pairKeys })
    if (!next) next = await generateInitialMatchup(sport, tables, { modeKey: modeKeyForRpc, era: eraObj, round, usedPairKeys: pairKeys })
    if (!next) {
      setGenerating(false)
      setNotice("Couldn't find a new matchup — try again")
      return
    }
    setMatchup(next)
    setGenerating(false)
  }

  async function pick(pickedChampion) {
    if (!matchup || revealing || generating) return
    const challengerWins = matchup.challenger.value > matchup.champion.value
    const correct = pickedChampion !== challengerWins
    const nextRoundsPlayed = roundsPlayed + 1

    let nextChampionRounds = championRounds
    let nextScore = score
    let nextHistory = championHistory
    if (challengerWins) {
      nextHistory = [...championHistory, { name: matchup.champion.name, roundsSurvived: championRounds, lostToName: matchup.challenger.name, lostToStat: shortLabel(matchup.stat) }]
      nextChampionRounds = 1
    } else {
      nextChampionRounds = championRounds + 1
      nextScore += survivalBonusFor(nextChampionRounds)
    }

    let nextStreak = streak
    let nextLives = lives
    let nextBestStreak = bestStreak
    let nextCorrect = correctAnswers
    if (correct) {
      nextStreak = streak + 1
      nextBestStreak = Math.max(bestStreak, nextStreak)
      nextCorrect = correctAnswers + 1
      nextScore += pointsForStreak(nextStreak)
      if (nextStreak % 10 === 0) nextLives = Math.min(MAX_LIVES, lives + 1)
    } else {
      nextLives = lives - 1
      nextStreak = 0
    }
    const nextPairKeys = new Set(usedPairKeys)
    nextPairKeys.add(pairKey(matchup.champion.id, matchup.challenger.id))

    setRevealing(true)
    setLastPickedChampion(pickedChampion)
    setLastCorrect(correct)
    setLastChallengerWon(challengerWins)
    setRoundsPlayed(nextRoundsPlayed)
    setChampionRounds(nextChampionRounds)
    setChampionHistory(nextHistory)
    setScore(nextScore)
    setStreak(nextStreak)
    setBestStreak(nextBestStreak)
    setCorrectAnswers(nextCorrect)
    setLives(nextLives)
    setUsedPairKeys(nextPairKeys)

    await new Promise((r) => setTimeout(r, 1600))

    if (nextLives <= 0) {
      endGame({
        score: nextScore, roundsPlayed: nextRoundsPlayed, bestStreak: nextBestStreak, correctAnswers: nextCorrect,
        championHistory: nextHistory,
        currentChampionName: challengerWins ? matchup.challenger.name : matchup.champion.name,
        currentChampionRounds: nextChampionRounds,
      })
      return
    }

    setRevealing(false)
    setGenerating(true)
    const champion = challengerWins ? matchup.challenger : { ...matchup.champion, value: matchup.champion.value }
    await loadNextRound(champion, nextRoundsPlayed + 1, nextPairKeys)
  }

  function endGame(runResult) {
    setBestIfHigher(bestKey, runResult.score)
    setResult(runResult)
    setPhase('gameover')
  }

  const title = `More vs Less — ${SPORT_META[sport].label}`
  const personalBest = getBest(bestKey, 0)

  if (phase === 'start') {
    return (
      <GameShell emoji="⚔️" title={title} howToPlay="more-or-less">
        <p className="mb-4 text-sm text-[var(--color-text-secondary)]">
          Two players. One stat. Who had more? The winner keeps going until they lose. Build your streak before you run out of lives.
        </p>

        {sport === 'nfl' ? (
          <>
            <p className="mb-1.5 text-xs font-bold text-[var(--color-text-tertiary)]">DIFFICULTY</p>
            <div className="mb-4 flex overflow-hidden rounded-lg border border-[var(--color-border)]">
              {NFL_DIFFICULTIES.map((d) => (
                <button
                  key={d.key}
                  onClick={() => setDifficulty(d.key)}
                  className={`flex-1 py-2 text-sm font-bold ${difficulty === d.key ? 'bg-[var(--color-primary)] text-white' : 'bg-[var(--color-elevated)] text-[var(--color-text-tertiary)]'}`}
                >
                  {d.label.toUpperCase()}
                </button>
              ))}
            </div>
            <p className="mb-1.5 text-xs font-bold text-[var(--color-text-tertiary)]">ERA</p>
            <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
              {NFL_ERAS.map((e) => (
                <button
                  key={e.key}
                  onClick={() => setEra(e.key)}
                  className={`rounded-xl border py-3 text-center font-bold ${era === e.key ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/10' : 'border-[var(--color-border)] bg-[var(--color-surface)]'}`}
                >
                  <span className="block">{e.label}</span>
                  <span className="block text-[10px] font-normal text-[var(--color-text-tertiary)]">
                    {e.range ? `${e.range[0]}-${e.range[1]}` : '∞'}
                  </span>
                </button>
              ))}
            </div>
          </>
        ) : (
          <div className="mb-4 space-y-2">
            {modesFor(sport).map((m) => (
              <button
                key={m.key}
                onClick={() => setMode(m.key)}
                className={`w-full rounded-xl border p-3 text-left ${mode === m.key ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/10' : 'border-[var(--color-border)] bg-[var(--color-surface)]'}`}
              >
                <p className="font-bold">{m.emoji} {m.label}</p>
                <p className="text-xs text-[var(--color-text-secondary)]">{m.tagline}</p>
              </button>
            ))}
          </div>
        )}

        {notice && <p className="mb-3 text-center text-sm text-[var(--color-error)]">{notice}</p>}
        <p className="mb-3 text-center text-xs text-[var(--color-text-tertiary)]">Personal best: {personalBest}</p>
        <button onClick={startGame} className="w-full rounded-xl bg-[var(--color-primary)] py-3 font-bold text-white">
          Play
        </button>
      </GameShell>
    )
  }

  if (phase === 'gameover' && result) {
    const payload = {
      sport,
      score: result.score,
      bestStreak: result.bestStreak,
      roundsPlayed: result.roundsPlayed,
      difficultyKey: difficulty,
      difficultyLabel: NFL_DIFFICULTIES.find((d) => d.key === difficulty)?.label,
      eraLabel: eraObj?.label,
      mode: modesFor(sport).find((m) => m.key === mode),
    }
    const longest = result.championHistory.reduce(
      (best, c) => (c.roundsSurvived > best.rounds ? { name: c.name, rounds: c.roundsSurvived } : best),
      { name: result.currentChampionName, rounds: result.currentChampionRounds }
    )
    return (
      <GameShell emoji="⚔️" title={title} howToPlay="more-or-less">
        <p className="mb-1 text-center text-2xl font-black">{result.score} pts</p>
        <p className="mb-4 text-center text-sm text-[var(--color-text-secondary)]">Out of lives!</p>
        <div className="mb-4 grid grid-cols-2 gap-3">
          <div className="bg-[var(--color-elevated)] p-3 text-center">
            <p className="font-bold">{result.roundsPlayed}</p>
            <p className="text-xs text-[var(--color-text-tertiary)]">Rounds played</p>
          </div>
          <div className="bg-[var(--color-elevated)] p-3 text-center">
            <p className="font-bold">🔥 {result.bestStreak}</p>
            <p className="text-xs text-[var(--color-text-tertiary)]">Best streak</p>
          </div>
          <div className="bg-[var(--color-elevated)] p-3 text-center">
            <p className="font-bold">{result.correctAnswers}/{result.roundsPlayed}</p>
            <p className="text-xs text-[var(--color-text-tertiary)]">Correct</p>
          </div>
          <div className="bg-[var(--color-elevated)] p-3 text-center">
            <p className="font-bold">{longest.name}</p>
            <p className="text-xs text-[var(--color-text-tertiary)]">Longest reign ({longest.rounds})</p>
          </div>
        </div>
        <ShareResult text={buildShareText('more-or-less', todayStr(), payload)} />
        <button onClick={() => setPhase('start')} className="mt-4 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-elevated)] py-3 font-semibold">
          Play Again
        </button>
      </GameShell>
    )
  }

  // playing
  return (
    <GameShell emoji="⚔️" title={title} howToPlay="more-or-less">
      <div className="mb-4 flex items-center justify-between text-sm">
        <span>{'❤️'.repeat(lives)}{'🖤'.repeat(MAX_LIVES - lives)}</span>
        <span className="text-[var(--color-warning)]">🔥 {streak}</span>
        <span className="font-bold">{score} pts</span>
      </div>

      {generating || !matchup ? (
        <p className="text-center text-[var(--color-text-secondary)]">Finding a fair matchup…</p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3">
            {[{ side: 'champion', p: matchup.champion, isChampion: true }, { side: 'challenger', p: matchup.challenger, isChampion: false }].map(({ side, p, isChampion }) => {
              const flashGreen = revealing && (isChampion ? !lastChallengerWon : lastChallengerWon)
              const flashRed = revealing && ((isChampion && lastPickedChampion) || (!isChampion && !lastPickedChampion)) && !lastCorrect
              return (
                <button
                  key={side}
                  onClick={() => pick(isChampion)}
                  disabled={revealing || generating}
                  className={`rounded-2xl border p-4 text-center transition-colors ${
                    flashGreen ? 'border-[var(--color-success)] bg-[var(--color-success)]/10' :
                    flashRed ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/10' :
                    'border-[var(--color-border)] bg-[var(--color-surface)] hover:border-[var(--color-primary)]/50'
                  }`}
                >
                  <p className="font-extrabold">{p.name}</p>
                  <p className="text-xs text-[var(--color-text-secondary)]">{p.position}{isChampion && championRounds > 0 ? ` · ${championRounds} won` : ''}</p>
                  {revealing && <p className="mt-2 text-lg font-bold tabular-nums">{p.value.toLocaleString()}</p>}
                </button>
              )
            })}
          </div>
          <p className="mt-4 text-center text-sm font-semibold text-[var(--color-text-secondary)]">{questionText(matchup.stat)}</p>
        </>
      )}
    </GameShell>
  )
}
