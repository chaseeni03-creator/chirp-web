import { useEffect, useRef, useState } from 'react'
import { todayStr } from '../lib/supabase'
import { getTodayResult, saveTodayResult, bumpStreak, getInProgress, saveInProgress } from '../lib/storage'
import { buildShareText } from '../lib/share'
import { getTodaysQuestions, scoreFor, TOTAL_QUESTIONS, SECONDS_PER_QUESTION } from '../lib/beforeOrAfter'
import GameShell, { Loading, ErrorMsg } from '../components/GameShell'
import ShareResult from '../components/ShareResult'
import DailyLeaderboardBanner from '../components/DailyLeaderboardBanner'

const GAME_KEY = 'before-or-after'
const REVEAL_PAUSE_MS = 1200

const SPORT_EMOJI = { nfl: '🏈', nba: '🏀', mlb: '⚾' }

function timerColor(secondsLeft) {
  const frac = secondsLeft / SECONDS_PER_QUESTION
  if (frac <= 0.34) return 'text-[var(--color-primary)] bg-[var(--color-primary)]/15'
  if (frac <= 0.67) return 'text-[var(--color-warning)] bg-[var(--color-warning)]/15'
  return 'text-[var(--color-success)] bg-[var(--color-success)]/15'
}

function EventCard({ event, onTap, flashGreen, flashRed, disabled }) {
  const bg = flashGreen
    ? 'border-[var(--color-success)] bg-[var(--color-success)]/18'
    : flashRed
      ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/18'
      : 'border-[var(--color-border)] bg-[var(--color-surface)]'
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onTap}
      className={`flex min-h-[160px] flex-col items-center justify-center gap-3 rounded-2xl border p-4 text-center transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] ${bg} disabled:cursor-default`}
    >
      <span className="rounded-full bg-[var(--color-elevated)] px-2.5 py-1 text-[11px] font-extrabold tracking-wide">
        {SPORT_EMOJI[event.sport] || ''} {event.sport.toUpperCase()}
      </span>
      <p className="text-sm font-bold leading-snug">{event.description}</p>
    </button>
  )
}

export default function BeforeOrAfter() {
  const today = todayStr()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [questions, setQuestions] = useState([])
  const [finished, setFinished] = useState(null)

  const [index, setIndex] = useState(0)
  const [correctCount, setCorrectCount] = useState(0)
  const [timeLeft, setTimeLeft] = useState(SECONDS_PER_QUESTION)
  const [revealing, setRevealing] = useState(false)
  const [lastPicked, setLastPicked] = useState(null) // 'a' | 'b' | null (timeout)
  const [lastCorrect, setLastCorrect] = useState(false)

  const timerRef = useRef(null)
  const correctCountRef = useRef(0) // avoids a stale closure inside the setInterval callback

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)

    const already = getTodayResult(GAME_KEY, today)
    if (already) {
      setFinished(already)
      setLoading(false)
      return
    }

    getTodaysQuestions()
      .then((rows) => {
        if (cancelled) return
        if (!rows.length) {
          setError('No Before or After puzzle scheduled for today.')
        } else {
          setQuestions(rows)
          // Mid-session resume — picks up at the saved question/score with a
          // fresh timer (leftover seconds on whichever question they left on
          // aren't preserved; the timer's point is per-question tension, not
          // a strict overall countdown, so restarting that one question's
          // clock is simpler and safer than persisting sub-second state).
          const saved = getInProgress(GAME_KEY, today)
          if (saved && saved.index > 0 && saved.index < TOTAL_QUESTIONS) {
            correctCountRef.current = saved.correctCount ?? 0
            setCorrectCount(correctCountRef.current)
            setIndex(saved.index)
          }
        }
        setLoading(false)
      })
      .catch(() => {
        if (!cancelled) {
          setError('Something went wrong loading today’s puzzle.')
          setLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [today])

  // Starts (or restarts, on question change) the 30s countdown. Cleaned up
  // on unmount and whenever a new question starts.
  useEffect(() => {
    if (loading || error || finished || !questions.length) return
    setTimeLeft(SECONDS_PER_QUESTION)
    clearInterval(timerRef.current)
    timerRef.current = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          clearInterval(timerRef.current)
          answer(null) // timeout — counts as wrong
          return 0
        }
        return t - 1
      })
    }, 1000)
    return () => clearInterval(timerRef.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, loading, error, finished, questions.length])

  function answer(picked) {
    if (revealing) return
    clearInterval(timerRef.current)
    const question = questions[index]
    const correct = picked === question.correct_answer
    if (correct) {
      correctCountRef.current += 1
      setCorrectCount(correctCountRef.current) // updates the pts badge immediately, not after the pause
    }

    setRevealing(true)
    setLastPicked(picked)
    setLastCorrect(correct)

    setTimeout(() => {
      if (index + 1 >= TOTAL_QUESTIONS) {
        finish()
      } else {
        const nextIndex = index + 1
        setIndex(nextIndex)
        setRevealing(false)
        setLastPicked(null)
        saveInProgress(GAME_KEY, today, { index: nextIndex, correctCount: correctCountRef.current })
      }
    }, REVEAL_PAUSE_MS)
  }

  function finish() {
    const finalCorrect = correctCountRef.current
    const score = scoreFor(finalCorrect)
    // "won" here just means "completed today's puzzle" — every other game's
    // streak is win/loss, but this one has no pass/fail, just a score, so
    // finishing all 10 questions (regardless of score) is what counts,
    // matching how the Flutter version's streak always bumps on completion.
    const streak = bumpStreak(GAME_KEY, today, true)
    const result = { correctCount: finalCorrect, score, streak: streak.current }
    saveTodayResult(GAME_KEY, today, result)
    setCorrectCount(finalCorrect)
    setFinished(result)
  }

  const title = 'Before or After'

  if (loading) return <GameShell emoji="📅" title={title}><Loading /></GameShell>
  if (error) return <GameShell emoji="📅" title={title}><ErrorMsg message={error} /></GameShell>

  if (finished) {
    const streak = finished.streak ?? 0
    return (
      <GameShell emoji="📅" title={title}>
        <div className="text-center">
          <p className="text-4xl">{finished.correctCount >= 8 ? '🎉' : finished.correctCount >= 5 ? '👍' : '📅'}</p>
          <p className="mt-3 font-bold">{finished.correctCount}/{TOTAL_QUESTIONS} correct today</p>
          <p className="mt-1 text-2xl font-extrabold tabular-nums">{finished.score.toLocaleString()} / 10,000 pts</p>
          {streak > 0 && <p className="mt-2 text-sm font-bold text-[var(--color-warning)]">🔥 {streak} day streak</p>}
        </div>
        <ShareResult text={buildShareText('before-or-after', today, finished)} />
        <DailyLeaderboardBanner gameType="before-or-after" sport="all" score={finished.score} />
        <p className="mt-4 text-center text-xs text-[var(--color-text-secondary)]">
          Come back tomorrow for 10 new questions!
        </p>
      </GameShell>
    )
  }

  const question = questions[index]

  return (
    <GameShell emoji="📅" title={title}>
      <div className="mb-4 flex items-center justify-between text-sm font-bold">
        <span className="text-[var(--color-text-secondary)]">Q {index + 1}/{TOTAL_QUESTIONS}</span>
        <span className={`rounded-full px-2.5 py-1 text-xs font-extrabold tabular-nums ${timerColor(timeLeft)}`}>
          {timeLeft}s
        </span>
        <span>{(correctCount * 1000).toLocaleString()} pts</span>
      </div>

      <p className="mb-3 text-center text-sm font-extrabold">Which happened first?</p>

      <div className="grid grid-cols-2 gap-3">
        <EventCard
          event={question.event_a}
          onTap={() => answer('a')}
          flashGreen={revealing && question.correct_answer === 'a'}
          flashRed={revealing && lastPicked === 'a' && !lastCorrect}
          disabled={revealing}
        />
        <EventCard
          event={question.event_b}
          onTap={() => answer('b')}
          flashGreen={revealing && question.correct_answer === 'b'}
          flashRed={revealing && lastPicked === 'b' && !lastCorrect}
          disabled={revealing}
        />
      </div>

      <p className="mt-4 h-5 text-center text-sm font-bold">
        {revealing && (lastPicked === null ? "Time's up!" : lastCorrect ? 'Correct!' : 'Wrong!')}
      </p>
    </GameShell>
  )
}
