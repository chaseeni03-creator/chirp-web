import { createContext, useContext, useEffect, useState } from 'react'
import { SPORTS } from '../lib/sports'

const STORAGE_KEY = 'chirp-web:sport'
const SportContext = createContext(null)

function readStoredSport() {
  try {
    const v = localStorage.getItem(STORAGE_KEY)
    return SPORTS.includes(v) ? v : 'nfl'
  } catch {
    return 'nfl'
  }
}

export function SportProvider({ children }) {
  const [sport, setSportState] = useState(readStoredSport)

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, sport)
    } catch {
      /* ignore */
    }
  }, [sport])

  function setSport(next) {
    if (SPORTS.includes(next)) setSportState(next)
  }

  return <SportContext.Provider value={{ sport, setSport }}>{children}</SportContext.Provider>
}

export function useSport() {
  const ctx = useContext(SportContext)
  if (!ctx) throw new Error('useSport must be used within a SportProvider')
  return ctx
}
