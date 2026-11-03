import { useEffect, useState } from 'react'
import { games } from '../data/games'
import { getTodayResult } from '../lib/storage'
import { todayStr } from '../lib/supabase'

/**
 * Per-sport "did I already play this today" map, keyed by game.key — shared
 * by HeroGame (to show Done instead of Play Now) and MoreGames (the full
 * tiered list), so both stay in sync without duplicating this effect.
 */
export default function useCompletedGames(sport) {
  const [completed, setCompleted] = useState({})

  useEffect(() => {
    const today = todayStr()
    const map = {}
    for (const g of games) {
      map[g.key] = Boolean(getTodayResult(`${sport}-${g.key}`, today))
    }
    setCompleted(map)
  }, [sport])

  return completed
}
