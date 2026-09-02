import { useEffect, useState } from 'react'
import { supabase, todayStr } from '../lib/supabase'
import { getTodayResult, saveTodayResult, bumpStreak } from '../lib/storage'
import { buildShareText } from '../lib/share'
import { useSport } from '../context/SportContext'
import { TABLES, SPORT_META } from '../lib/sports'
import {
  LINEUP_CATEGORIES, lineupMaxTotalScore, computeLineupBonuses,
  lineupScopeTimeLabel, submitCategoryGuess, formatLineupTotal,
} from '../lib/lineup'
import GameShell, { Loading, ErrorMsg } from '../components/GameShell'
import PlayerSearchInput from '../components/PlayerSearchInput'
import ShareResult from '../components/ShareResult'
import GroupScoreBanner from '../components/GroupScoreBanner'

const SECTIONS = {
  nfl: [{ key: 'offense', label: 'OFFENSE' }, { key: 'defense', label: 'DEFENSE' }],
  mlb: [{ key: 'batting', label: 'BATTING' }, { key: 'pitching', label: 'PITCHING' }],
  nba: null,
}

const MEDAL = { 1: '🥇', 2: '🥈', 3: '🥉' }
function medal(rank) {
  return MEDAL[rank] || '⬜'
}

export default function Lineup() {
  const { sport } = useSport()
  const gameKey = `${sport}-lineup`
  const tables = TABLES[sport]
  const categories = LINEUP_CATEGORIES[sport]
  const sections = SECTIONS[sport]

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [scope, setScope] = useState(null)
  const [time, setTime] = useState(null)
  const [guesses, setGuesses] = useState({})
  const [top3ByKey, setTop3ByKey] = useState({})
  const [errors, setErrors] = useState({})
  const [submittingKey, setSubmittingKey] = useState(null)
  const [tab, setTab] = useState(0)
  const [finished, setFinished] = useState(null)
  const today = todayStr()

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    setFinished(null)
    setGuesses({})
    setTop3ByKey({})
    setErrors({})
    setTab(0)

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
        setScope({ type: data.scope_type, value: data.scope_value })
        setTime({ type: data.time_type, value: data.time_value })
        setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [today, sport, gameKey, tables.lineupDaily])

  async function finishGame(finalGuesses, finalTop3) {
    const bonuses = computeLineupBonuses(sport, finalGuesses)
    const baseScore = categories.reduce((sum, c) => sum + (finalGuesses[c.key]?.points ?? 0), 0)
    const totalScore = baseScore + bonuses.total
    const anyCorrect = Object.values(finalGuesses).some((g) => g && g.rank != null)
    const result = {
      sport,
      scopeLabel: lineupScopeTimeLabel(scope, time),
      guessesByKey: finalGuesses,
      top3ByKey: finalTop3,
      baseScore,
      bonuses,
      totalScore,
      maxScore: lineupMaxTotalScore(sport),
    }
    saveTodayResult(gameKey, today, result)
    bumpStreak(gameKey, today, anyCorrect)
    setFinished(result)
  }

  async function handleSelect(category, player) {
    setSubmittingKey(category.key)
    setErrors((e) => ({ ...e, [category.key]: null }))
    const { guess, top3 } = await submitCategoryGuess(sport, tables, {
      playerId: player.id,
      playerName: player.full_name,
      category,
      scope,
      time,
    })
    setSubmittingKey(null)
    if (!guess) {
      setErrors((e) => ({ ...e, [category.key]: `${player.full_name} did not play for the ${lineupScopeTimeLabel(scope, time)}` }))
      return
    }
    const nextGuesses = { ...guesses, [category.key]: guess }
    const nextTop3 = { ...top3ByKey, [category.key]: top3 }
    setGuesses(nextGuesses)
    setTop3ByKey(nextTop3)
    if (categories.every((c) => nextGuesses[c.key])) {
      await finishGame(nextGuesses, nextTop3)
    }
  }

  const title = `The Lineup — ${SPORT_META[sport].label}`

  if (loading) return <GameShell emoji="📋" title={title} howToPlay="lineup"><Loading /></GameShell>
  if (error) return <GameShell emoji="📋" title={title} howToPlay="lineup"><ErrorMsg message={error} /></GameShell>

  if (finished) {
    return (
      <GameShell emoji="📋" title={title} howToPlay="lineup">
        <p className="mb-1 text-center text-sm font-bold text-[var(--color-text-tertiary)]">{finished.scopeLabel}</p>
        <p className="mb-4 text-center text-2xl font-black">{finished.totalScore.toLocaleString()} pts</p>
        <div className="mb-4 border border-[var(--color-border)] bg-[var(--color-surface)] p-3 text-sm">
          <div className="flex justify-between py-0.5"><span className="text-[var(--color-text-secondary)]">Base score</span><span className="font-bold">{finished.baseScore}</span></div>
          {finished.bonuses.allTop3 > 0 && <div className="flex justify-between py-0.5"><span className="text-[var(--color-text-secondary)]">All Top 3</span><span className="font-bold">+{finished.bonuses.allTop3}</span></div>}
          {finished.bonuses.allFirst > 0 && <div className="flex justify-between py-0.5"><span className="text-[var(--color-text-secondary)]">All #1</span><span className="font-bold">+{finished.bonuses.allFirst}</span></div>}
          {finished.bonuses.perfectA > 0 && <div className="flex justify-between py-0.5"><span className="text-[var(--color-text-secondary)]">Perfect {sections ? sections[0].label : ''}</span><span className="font-bold">+{finished.bonuses.perfectA}</span></div>}
          {finished.bonuses.perfectB > 0 && <div className="flex justify-between py-0.5"><span className="text-[var(--color-text-secondary)]">Perfect {sections ? sections[1].label : ''}</span><span className="font-bold">+{finished.bonuses.perfectB}</span></div>}
        </div>
        <ShareResult text={buildShareText('lineup', today, finished)} />
        <GroupScoreBanner gameType="lineup" sport={sport} era="all_time" score={finished.totalScore} details={finished.scopeLabel} />

        <div className="mt-6 space-y-4">
          {(sections || [{ key: null, label: null }]).map((sec) => (
            <div key={sec.key ?? 'all'}>
              {sec.label && <p className="mb-2 text-xs font-bold tracking-wide text-[var(--color-text-tertiary)]">{sec.label}</p>}
              <div className="space-y-2">
                {categories.filter((c) => (sec.key ? c.section === sec.key : true)).map((c) => {
                  const g = finished.guessesByKey[c.key]
                  const top3 = finished.top3ByKey[c.key] || []
                  return (
                    <div key={c.key} className="border border-[var(--color-border)] bg-[var(--color-surface)] p-3">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-bold">{c.label}</span>
                        <span>{medal(g?.rank)} {g?.rank ? g.playerName : 'Missed'} <span className="text-[var(--color-text-tertiary)]">(+{g?.points ?? 0})</span></span>
                      </div>
                      {top3.length > 0 && (
                        <div className="mt-2 space-y-0.5 border-t border-[var(--color-border)] pt-2 text-xs text-[var(--color-text-secondary)]">
                          {top3.map((l, i) => (
                            <p key={l.playerId}>{i + 1}. {l.playerName} — {formatLineupTotal(c, l.total)}</p>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      </GameShell>
    )
  }

  const visibleCategories = sections ? categories.filter((c) => c.section === sections[tab].key) : categories

  return (
    <GameShell emoji="📋" title={title} howToPlay="lineup">
      <p className="mb-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-elevated)] px-4 py-2 text-center text-sm font-bold">
        {lineupScopeTimeLabel(scope, time)}
      </p>

      {sections && (
        <div className="mb-4 flex gap-2">
          {sections.map((sec, i) => {
            const locked = categories.filter((c) => c.section === sec.key && guesses[c.key]).length
            const total = categories.filter((c) => c.section === sec.key).length
            return (
              <button
                key={sec.key}
                onClick={() => setTab(i)}
                className={`flex-1 rounded-lg py-2 text-xs font-bold ${tab === i ? 'bg-[var(--color-primary)] text-white' : 'bg-[var(--color-elevated)] text-[var(--color-text-secondary)]'}`}
              >
                {sec.label} ({locked}/{total})
              </button>
            )
          })}
        </div>
      )}

      <div className="space-y-3">
        {visibleCategories.map((c) => {
          const g = guesses[c.key]
          const top3 = top3ByKey[c.key] || []
          return (
            <div key={c.key} className="border border-[var(--color-border)] bg-[var(--color-surface)] p-3">
              <p className="mb-1.5 text-sm font-semibold text-[var(--color-text-secondary)]">{c.label}</p>
              {g ? (
                <div>
                  <p className="text-sm font-bold">{medal(g.rank)} {g.rank ? g.playerName : 'Missed'} <span className="font-normal text-[var(--color-text-tertiary)]">(+{g.points})</span></p>
                  {top3.length > 0 && (
                    <div className="mt-2 space-y-0.5 border-t border-[var(--color-border)] pt-2 text-xs text-[var(--color-text-secondary)]">
                      {top3.map((l, i) => (
                        <p key={l.playerId}>{i + 1}. {l.playerName} — {formatLineupTotal(c, l.total)}</p>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <>
                  <PlayerSearchInput
                    table={tables.players}
                    onSelect={(p) => handleSelect(c, p)}
                    placeholder={`Pick a player for ${c.label}…`}
                    disabled={submittingKey === c.key}
                  />
                  {errors[c.key] && <p className="mt-1 text-xs text-[var(--color-error)]">{errors[c.key]}</p>}
                </>
              )}
            </div>
          )
        })}
      </div>
    </GameShell>
  )
}
