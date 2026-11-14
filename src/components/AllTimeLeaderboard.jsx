import { useState } from 'react'
import { useGroup } from '../context/GroupContext'
import { SPORTS, SPORT_META } from '../lib/sports'
import CombinedLeaderboardFilterBar from './CombinedLeaderboardFilterBar'
import CombinedLeaderboardList from './CombinedLeaderboardList'
import SportCombinedTab from './SportCombinedTab'
import { getOverallLeaderboard, getOverallMyRank, getOverallGamesNeededForAverage } from '../lib/combinedLeaderboard'

const TABS = ['overall', ...SPORTS]
const TAB_LABEL = { overall: 'Overall', nfl: 'NFL', mlb: 'MLB', nba: 'NBA' }

/** Top-level Overall/NFL/MLB/NBA combined leaderboard — port of
 * leaderboard_screen.dart. Mounted by Leaderboard.jsx's "All-Time Rankings"
 * mode, alongside (not replacing) the existing live Today/Yesterday board. */
export default function AllTimeLeaderboard() {
  const { googleSession } = useGroup()
  const userId = googleSession?.user?.id ?? null
  const [tab, setTab] = useState('overall')
  const [period, setPeriod] = useState('allTime')
  const [sortMode, setSortMode] = useState('total')

  return (
    <div>
      <div className="mb-3 flex gap-1.5">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 rounded-lg py-2 text-xs font-bold transition-colors ${
              tab === t ? 'bg-[var(--color-primary)] text-white' : 'bg-[var(--color-elevated)] text-[var(--color-text-secondary)]'
            }`}
          >
            {t === 'overall' ? TAB_LABEL.overall : `${SPORT_META[t].emoji} ${TAB_LABEL[t]}`}
          </button>
        ))}
      </div>

      <CombinedLeaderboardFilterBar
        period={period}
        onPeriodChange={setPeriod}
        sortMode={sortMode}
        onSortModeChange={setSortMode}
      />

      <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-elevated)] p-4">
        {tab === 'overall' ? (
          <CombinedLeaderboardList
            key={`overall_${period}_${sortMode}`}
            period={period}
            sortMode={sortMode}
            userId={userId}
            showSportIcons
            fetchEntries={() => getOverallLeaderboard({ period, sortMode })}
            fetchMyRank={(uid) => getOverallMyRank({ userId: uid, period, sortMode })}
            fetchGamesNeeded={(uid) => getOverallGamesNeededForAverage({ userId: uid, period })}
          />
        ) : (
          <SportCombinedTab sport={tab} period={period} sortMode={sortMode} userId={userId} />
        )}
      </div>
    </div>
  )
}
