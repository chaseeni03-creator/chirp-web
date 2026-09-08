import { useEffect, useState } from 'react'
import Seo from '../components/Seo'
import { GAME_LABELS, GAME_ORDER, eraLabel } from '../lib/groups'
import { SPORTS, SPORT_META } from '../lib/sports'
import { fetchChampionsToday } from '../lib/dailyLeaderboard'
import { todayStr } from '../lib/supabase'
import { friendlyDate } from '../lib/share'

/**
 * Unlisted daily-content page — not in Header, no login, direct URL only
 * (playchirpsports.com/champions). One screen showing every game/sport's #1
 * for today, for a single screenshot to post to Instagram. Deliberately no
 * tabs/pills — everything visible at once is the entire point.
 */
export default function Champions() {
  const [byKey, setByKey] = useState({}) // `${game}:${sport}` -> { nickname, score }
  const [loading, setLoading] = useState(true)
  const today = todayStr()

  useEffect(() => {
    let cancelled = false
    fetchChampionsToday(today)
      .then((rows) => {
        if (cancelled) return
        const map = {}
        for (const r of rows) map[`${r.game_type}:${r.sport}`] = { nickname: r.nickname, score: r.score, era: r.era }
        setByKey(map)
      })
      .catch((err) => console.error('Champions load failed:', err))
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [today])

  return (
    <div className="mx-auto max-w-md px-4 py-8">
      <Seo title="Today's Champions" />
      <h1 className="text-center text-2xl font-extrabold">🏆 Today's Champions</h1>
      <p className="mb-6 text-center text-sm text-[var(--color-text-secondary)]">{friendlyDate(today)}</p>

      {loading ? (
        <p className="text-center text-sm text-[var(--color-text-secondary)]">Loading…</p>
      ) : (
        <div className="space-y-6">
          {SPORTS.map((sport) => (
            <div key={sport}>
              <h2 className="mb-2 text-sm font-extrabold">
                {SPORT_META[sport].emoji} {SPORT_META[sport].label}
              </h2>
              <div className="divide-y divide-[var(--color-border)] rounded-2xl border border-[var(--color-border)] bg-[var(--color-elevated)]">
                {GAME_ORDER.map((game) => {
                  const champ = byKey[`${game}:${sport}`]
                  const label = champ && eraLabel(sport, champ.era)
                  return (
                    <div key={game} className="flex items-center justify-between px-4 py-2.5 text-sm">
                      <span className="font-semibold text-[var(--color-text-secondary)]">{GAME_LABELS[game]}</span>
                      {champ ? (
                        <span className="font-bold">
                          👑 {champ.nickname}{' '}
                          <span className="text-[var(--color-text-secondary)]">
                            {champ.score.toLocaleString()}
                            {label && ` (${label})`}
                          </span>
                        </span>
                      ) : (
                        <span className="text-[var(--color-text-secondary)]">No plays yet</span>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
