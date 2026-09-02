import { createContext, useContext, useState, useCallback } from 'react'
import { getStoredGroup, clearStoredGroup } from '../lib/groups'

const GroupContext = createContext(null)

export function GroupProvider({ children }) {
  const [group, setGroup] = useState(getStoredGroup) // { nickname, id, code, name } | null

  const refreshGroup = useCallback(() => setGroup(getStoredGroup()), [])

  const leaveGroup = useCallback(() => {
    clearStoredGroup()
    setGroup(null)
  }, [])

  return <GroupContext.Provider value={{ group, setGroup, refreshGroup, leaveGroup }}>{children}</GroupContext.Provider>
}

export function useGroup() {
  const ctx = useContext(GroupContext)
  if (!ctx) throw new Error('useGroup must be used within a GroupProvider')
  return ctx
}
