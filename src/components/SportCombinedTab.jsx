import { useState } from 'react'
import CombinedLeaderboardList from './CombinedLeaderboardList'
import { ERAS } from '../lib/sports'
import {
  DISPLAY_GAMES,
  getSportLeaderboard,
  getSportMyRank,
  getSportGamesNeededForAverage,
  getEraLeaderboard,
  getEraMyRank,
  getEraGamesNeededForAverage,
} from '../lib/combinedLeaderboard'

const SUB_TABS = ['all', 'era', 'game']
const SUB_TAB_LABELS = { all: 'All Games', era: 'By Era', game: 'By Game' }

/** One sport's All Games / By Era / By Game inner tabs — port of
 * sport_leaderboard_tab.dart + era_leaderboard_tab.dart +
 * game_leaderboard_tab.dart combined into one component (React's JSX
 * composition makes the 3-file Flutter split unnecessary here). */
export default function SportCombinedTab({ sport, period, sortMode, userId }) {
  const [subTab, setSubTab] = useState('all')
  const [era, setEra] = useState(() => {
    const values = ERAS[sport] || []
    return values.length > 0 ? values[values.length - 1].key : 'allTime' // "All Time" is always last
  })
  const [game, setGame] = useState(DISPLAY_GAMES[0][0])

  return (
    <div>
      <div className="mb-3 flex gap-1.5">
        {SUB_TABS.map((t) => (
          <button
            key={t}
            onClick={() => setSubTab(t)}
            className={`flex-1 rounded-lg py-2 text-xs font-bold transition-colors ${
              subTab === t ? 'bg-[var(--color-primary)] text-white' : 'bg-[var(--color-elevated)] text-[var(--color-text-secondary)]'
            }`}
          >
            {SUB_TAB_LABELS[t]}
          </button>
        ))}
      </div>

      {subTab === 'era' && (
        <div className="mb-3 flex gap-1.5 overflow-x-auto pb-1">
          {(ERAS[sport] || []).map((e) => (
            <button
              key={e.key}
              onClick={() => setEra(e.key)}
              className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-bold transition-colors ${
                era === e.key
                  ? 'bg-[var(--color-primary)] text-white'
                  : 'border border-[var(--color-border)] bg-[var(--color-elevated)] text-[var(--color-text-secondary)]'
              }`}
            >
              {e.label}
            </button>
          ))}
        </div>
      )}

      {subTab === 'game' && (
        <div className="mb-3 flex gap-1.5 overflow-x-auto pb-1">
          {DISPLAY_GAMES.map(([key, label]) => (
            <button
              key={key}
              onClick={() => setGame(key)}
              className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-bold transition-colors ${
                game === key
                  ? 'bg-[var(--color-primary)] text-white'
                  : 'border border-[var(--color-border)] bg-[var(--color-elevated)] text-[var(--color-text-secondary)]'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {subTab === 'all' && (
        <CombinedLeaderboardList
          key={`${sport}_all_${period}_${sortMode}`}
          period={period}
          sortMode={sortMode}
          userId={userId}
          emptyMessage="No scores yet for this period."
          fetchEntries={() => getSportLeaderboard({ sport, period, sortMode })}
          fetchMyRank={(uid) => getSportMyRank({ userId: uid, sport, period, sortMode })}
          fetchGamesNeeded={(uid) => getSportGamesNeededForAverage({ userId: uid, sport, period })}
        />
      )}
      {subTab === 'era' && (
        <CombinedLeaderboardList
          key={`${sport}_era_${era}_${period}_${sortMode}`}
          period={period}
          sortMode={sortMode}
          userId={userId}
          emptyMessage="No scores yet for this era."
          fetchEntries={() => getEraLeaderboard({ sport, era, period, sortMode })}
          fetchMyRank={(uid) => getEraMyRank({ userId: uid, sport, era, period, sortMode })}
          fetchGamesNeeded={(uid) => getEraGamesNeededForAverage({ userId: uid, sport, era, period })}
        />
      )}
      {subTab === 'game' && (
        <CombinedLeaderboardList
          key={`${sport}_game_${game}_${period}_${sortMode}`}
          period={period}
          sortMode={sortMode}
          userId={userId}
          emptyMessage="No scores yet for this game."
          fetchEntries={() => getSportLeaderboard({ sport, period, gameType: game, sortMode })}
          fetchMyRank={(uid) => getSportMyRank({ userId: uid, sport, period, gameType: game, sortMode })}
          fetchGamesNeeded={(uid) => getSportGamesNeededForAverage({ userId: uid, sport, period, gameType: game })}
        />
      )}
    </div>
  )
}
