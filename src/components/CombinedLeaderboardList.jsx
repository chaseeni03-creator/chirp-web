import { useEffect, useState } from 'react'
import CombinedLeaderboardRow from './CombinedLeaderboardRow'

/** Shared list body — port of leaderboard_list.dart. Fetches its own entries
 * + the viewer's rank (which may be off-page, or absent entirely when
 * average-sorted and unqualified), and pins a "Your rank"/"play N more"
 * card at the bottom in that case. */
export default function CombinedLeaderboardList({
  fetchEntries,
  fetchMyRank,
  fetchGamesNeeded,
  period,
  sortMode,
  userId,
  showSportIcons = false,
  emptyMessage = 'No scores yet for this period.',
}) {
  const [entries, setEntries] = useState([])
  const [myRank, setMyRank] = useState(null)
  const [gamesNeeded, setGamesNeeded] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      const [fetchedEntries, rank] = await Promise.all([fetchEntries(), userId ? fetchMyRank(userId) : null])
      let needed = null
      if (rank == null && userId && sortMode === 'average' && fetchGamesNeeded) {
        needed = await fetchGamesNeeded(userId)
      }
      if (!cancelled) {
        setEntries(fetchedEntries)
        setMyRank(rank)
        setGamesNeeded(needed)
        setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchEntries, fetchMyRank, fetchGamesNeeded, userId, sortMode])

  if (loading) {
    return <p className="py-6 text-center text-sm text-[var(--color-text-secondary)]">Loading…</p>
  }
  if (entries.length === 0) {
    return <p className="py-6 text-center text-sm text-[var(--color-text-secondary)]">{emptyMessage}</p>
  }

  const myIndex = userId ? entries.findIndex((e) => e.userId === userId) : -1
  const myVisible = myIndex !== -1 && myIndex < 100

  return (
    <div className="space-y-1">
      {entries.map((entry, i) => (
        <CombinedLeaderboardRow
          key={entry.userId}
          rank={i + 1}
          entry={entry}
          period={period}
          sortMode={sortMode}
          isMe={entry.userId === userId}
          showSportIcons={showSportIcons}
        />
      ))}
      {userId && !myVisible && (myRank != null || gamesNeeded > 0) && (
        <>
          <div className="my-2 border-t border-[var(--color-border)]" />
          <div className="flex items-center gap-2 rounded-xl border border-[var(--color-primary)]/40 bg-[var(--color-primary)]/10 px-3 py-2.5">
            <span>📍</span>
            <span className="text-sm font-bold text-[var(--color-primary)]">
              {myRank != null
                ? `Your rank: #${myRank}`
                : `Play ${gamesNeeded} more game${gamesNeeded === 1 ? '' : 's'} this period to qualify for Best Average`}
            </span>
          </div>
        </>
      )}
    </div>
  )
}
