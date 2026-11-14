import { useState } from 'react'
import { useGroup } from '../context/GroupContext'
import { signInWithGoogle } from '../lib/groups'
import { SPORTS, SPORT_META } from '../lib/sports'
import CombinedLeaderboardFilterBar from './CombinedLeaderboardFilterBar'
import CombinedLeaderboardList from './CombinedLeaderboardList'
import SportCombinedTab from './SportCombinedTab'
import { getOverallLeaderboard, getOverallMyRank, getOverallGamesNeededForAverage } from '../lib/combinedLeaderboard'

const TABS = ['overall', ...SPORTS]
const TAB_LABEL = { overall: 'Overall', nfl: 'NFL', mlb: 'MLB', nba: 'NBA' }

/** Top-level Overall/NFL/MLB/NBA combined leaderboard — port of
 * leaderboard_screen.dart. Mounted by Leaderboard.jsx's "All-Time Rankings"
 * mode, alongside (not replacing) the existing live Today/Yesterday board.
 *
 * Gated behind a real (Google) account — guest identity has no durable,
 * server-verifiable identity (see groups.js's header comment), so letting
 * guests appear on a cross-sport/cross-time ranking risked duplicate or
 * impersonated entries. The existing daily board stays guest-accessible;
 * only this section requires signing in. */
export default function AllTimeLeaderboard() {
  const { googleSession } = useGroup()
  const userId = googleSession?.user?.id ?? null
  const [tab, setTab] = useState('overall')
  const [period, setPeriod] = useState('allTime')
  const [sortMode, setSortMode] = useState('total')

  if (!userId) {
    return (
      <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-elevated)] p-6 text-center">
        <p className="text-3xl">🏆</p>
        <p className="mt-2 text-base font-extrabold">Create an account to see the All-Time Rankings</p>
        <p className="mt-1.5 text-sm text-[var(--color-text-secondary)]">
          These rankings are for signed-in players only, so every name on the board is a real account.
        </p>
        <button
          type="button"
          onClick={() => signInWithGoogle()}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-[var(--color-border)] bg-white py-3 text-sm font-bold text-black"
        >
          <span className="font-black">G</span> Continue with Google
        </button>
      </div>
    )
  }

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
