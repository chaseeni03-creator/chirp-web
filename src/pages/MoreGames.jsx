import Seo from '../components/Seo'
import GameCard from '../components/GameCard'
import SportSelector from '../components/SportSelector'
import { games } from '../data/games'
import { TIERS } from '../data/gameTiers'
import { SPORT_META } from '../lib/sports'
import { useSport } from '../context/SportContext'
import useCompletedGames from '../hooks/useCompletedGames'
import { getTodayResult } from '../lib/storage'
import { todayStr } from '../lib/supabase'

const BEFORE_OR_AFTER = {
  key: 'before-or-after',
  path: '/before-or-after',
  name: 'Before or After',
  emoji: '📅',
  description: () => 'Two sports events. Tap the one that happened first — 10/day, all sports.',
}

export default function MoreGames() {
  const { sport } = useSport()
  const meta = SPORT_META[sport]
  const completed = useCompletedGames(sport)
  const beforeOrAfterDone = Boolean(getTodayResult('before-or-after', todayStr()))

  return (
    <div>
      <Seo title="More Games" description={`Every daily ${meta.label} game Chirp Sports offers, grouped by difficulty.`} />

      <SportSelector />

      <h1 className="mb-1 mt-5 text-xl font-extrabold">More Games 🎮</h1>
      <p className="mb-6 text-sm text-[var(--color-text-secondary)]">Pick your level — every game is free.</p>

      {TIERS.map((tier) => {
        const inTier = games.filter((g) => g.tier === tier.id)
        if (inTier.length === 0) return null
        const color = `var(${tier.colorVar})`
        return (
          <div key={tier.id} className="mb-6">
            <h2 className="mb-2 flex items-center gap-2 text-xs font-bold tracking-wide" style={{ color }}>
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} aria-hidden="true" />
              {tier.label.toUpperCase()}
            </h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {inTier.map((g) => (
                <GameCard key={g.key} game={g} sportLabel={meta.label} completed={completed[g.key]} accentColor={color} />
              ))}
            </div>
          </div>
        )
      })}

      <div className="mb-6">
        <h2 className="mb-2 text-xs font-bold tracking-wide text-[var(--color-text-tertiary)]">BONUS</h2>
        <GameCard game={BEFORE_OR_AFTER} sportLabel={meta.label} completed={beforeOrAfterDone} />
      </div>
    </div>
  )
}
