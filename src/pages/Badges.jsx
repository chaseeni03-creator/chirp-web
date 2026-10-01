import { useEffect, useState } from 'react'
import Seo from '../components/Seo'
import { useGroup } from '../context/GroupContext'
import { fetchAllBadges, fetchEarnedBadges, fetchMyStreak, RARITY_COLORS } from '../lib/badges'

const CATEGORY_LABELS = {
  perfect: 'Perfect Scores',
  prestige: 'Prestige',
  streak: 'Streaks',
  milestone: 'Milestones',
}
const CATEGORY_ORDER = ['perfect', 'prestige', 'streak', 'milestone']
const RARITY_LABELS = { common: 'Common', rare: 'Rare', epic: 'Epic', legendary: 'Legendary' }

export default function Badges() {
  const { googleSession } = useGroup()
  const userId = googleSession?.user?.id ?? null
  const [badges, setBadges] = useState(null)
  const [earnedIds, setEarnedIds] = useState(new Set())
  const [streak, setStreak] = useState(null)

  useEffect(() => {
    let cancelled = false
    Promise.all([fetchAllBadges(), fetchEarnedBadges(userId), fetchMyStreak(userId)])
      .then(([all, earned, myStreak]) => {
        if (cancelled) return
        setBadges(all)
        setEarnedIds(new Set(earned.map((e) => e.badge_id)))
        setStreak(myStreak)
      })
      .catch((err) => console.error('Failed to load badges:', err))
    return () => {
      cancelled = true
    }
  }, [userId])

  const earnedCount = badges ? badges.filter((b) => earnedIds.has(b.id)).length : 0

  return (
    <div>
      <Seo title="Badges" description="Every badge you can earn playing Chirp Sports' daily games — perfect scores, streaks, and prestige achievements." />
      <h1 className="mb-1 text-xl font-extrabold">Badges 🏅</h1>
      <p className="mb-4 text-sm text-[var(--color-text-secondary)]">
        {badges ? `${earnedCount} of ${badges.length} earned` : 'Loading…'}
      </p>

      {streak && (streak.current_streak > 0 || streak.longest_streak > 0) && (
        <div className="mb-6 flex items-center justify-center gap-6 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
          <div className="text-center">
            <p className="text-2xl font-black">🔥 {streak.current_streak}</p>
            <p className="text-xs text-[var(--color-text-secondary)]">Current streak</p>
          </div>
          <div className="h-10 w-px bg-[var(--color-border)]" />
          <div className="text-center">
            <p className="text-2xl font-black">{streak.longest_streak}</p>
            <p className="text-xs text-[var(--color-text-secondary)]">Longest streak</p>
          </div>
        </div>
      )}

      {!badges ? (
        <p className="text-center text-[var(--color-text-secondary)]">Loading badges…</p>
      ) : (
        CATEGORY_ORDER.map((category) => {
          const inCategory = badges.filter((b) => b.category === category)
          if (inCategory.length === 0) return null
          return (
            <div key={category} className="mb-6">
              <h2 className="mb-2 text-sm font-bold tracking-wide text-[var(--color-text-tertiary)]">
                {CATEGORY_LABELS[category].toUpperCase()}
              </h2>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {inCategory.map((badge) => {
                  const earned = earnedIds.has(badge.id)
                  const color = RARITY_COLORS[badge.rarity] || RARITY_COLORS.common
                  return (
                    <div
                      key={badge.id}
                      title={earned ? badge.description : `🔒 ${badge.description}`}
                      className="rounded-xl border p-3 text-center transition-opacity"
                      style={{
                        borderColor: earned ? color : 'var(--color-border)',
                        backgroundColor: 'var(--color-surface)',
                        opacity: earned ? 1 : 0.45,
                      }}
                    >
                      <p className="text-3xl">{earned ? badge.emoji : '🔒'}</p>
                      <p className="mt-1 text-xs font-bold leading-tight">{badge.title}</p>
                      {earned && (
                        <p className="mt-0.5 text-[10px] font-bold uppercase tracking-wide" style={{ color }}>
                          {RARITY_LABELS[badge.rarity]}
                        </p>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })
      )}
    </div>
  )
}
