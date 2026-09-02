import { createContext, useContext, useState, useCallback, useEffect } from 'react'
import { getStoredUser, storeUser, clearStoredUser, forgetGroup, getGoogleSession, onAuthChange } from '../lib/groups'

const GroupContext = createContext(null)

export function GroupProvider({ children }) {
  const [user, setUser] = useState(getStoredUser) // { type, nickname, pin?, groups: [{id,code,name}], activeGroupId } | null
  const [googleSession, setGoogleSession] = useState(null)
  // False until the initial getSession() resolves — lets pages tell "still
  // checking, e.g. right after the OAuth redirect" apart from "checked, no
  // session", instead of racing ahead and rendering the signed-out UI first.
  const [sessionChecked, setSessionChecked] = useState(false)

  useEffect(() => {
    getGoogleSession().then((session) => {
      setGoogleSession(session)
      setSessionChecked(true)
    })
    const unsubscribe = onAuthChange((session) => {
      setGoogleSession(session)
      setSessionChecked(true)
    })
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
    <GroupContext.Provider value={{ user, saveUser, leaveOneGroup, setActiveGroup, activeGroup, googleSession, sessionChecked }}>
      {children}
    </GroupContext.Provider>
  )
}

export function useGroup() {
  const ctx = useContext(GroupContext)
  if (!ctx) throw new Error('useGroup must be used within a GroupProvider')
  return ctx
}
