import { createContext, useContext, useState, useCallback, useEffect } from 'react'
import { getStoredUser, storeUser, clearStoredUser, forgetGroup, getGoogleSession, onAuthChange } from '../lib/groups'

const GroupContext = createContext(null)

export function GroupProvider({ children }) {
  const [user, setUser] = useState(getStoredUser) // { type, nickname, pin?, groups: [{id,code,name}], activeGroupId } | null
  const [googleSession, setGoogleSession] = useState(null)

  useEffect(() => {
    getGoogleSession().then(setGoogleSession)
    const unsubscribe = onAuthChange(setGoogleSession)
    return unsubscribe
  }, [])

  const saveUser = useCallback((next) => {
    setUser(next)
    if (next) storeUser(next)
    else clearStoredUser()
  }, [])

  const leaveOneGroup = useCallback(
    (groupId) => {
      if (!user) return
      const next = forgetGroup(user, groupId)
      saveUser(next.groups.length > 0 ? next : null)
    },
    [user, saveUser]
  )

  const setActiveGroup = useCallback(
    (groupId) => {
      if (!user) return
      saveUser({ ...user, activeGroupId: groupId })
    },
    [user, saveUser]
  )

  const activeGroup = user?.groups?.find((g) => g.id === user.activeGroupId) ?? user?.groups?.[0] ?? null

  return (
    <GroupContext.Provider value={{ user, saveUser, leaveOneGroup, setActiveGroup, activeGroup, googleSession }}>
      {children}
    </GroupContext.Provider>
  )
}

export function useGroup() {
  const ctx = useContext(GroupContext)
  if (!ctx) throw new Error('useGroup must be used within a GroupProvider')
  return ctx
}
