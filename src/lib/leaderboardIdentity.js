// Lightweight per-browser identity for the global daily leaderboard —
// deliberately NOT the same as Groups' stored `user` (src/lib/groups.js),
// which is null for anyone who's never joined/created a group (most
// visitors). This is asked for once, the first time anyone submits a score
// to the leaderboard, regardless of whether they ever touch Groups.
//
// A nickname here can optionally be PIN-protected (leaderboard_identities
// table, chirp_sports/supabase/leaderboard_identities.sql) — claiming a
// nickname reserves it (the generator won't suggest an already-claimed
// one), and logging in with nickname + PIN on a different browser adopts
// that identity's guest_id, which is all that's needed to see the same
// score history there too (daily_leaderboard is already keyed by
// guest_id). Existing pre-PIN identities keep working unprotected —
// nothing here retroactively requires a PIN.

import { supabase } from './supabase'
import { hashPin } from './pin'

const LS_KEY = 'chirp-web:leaderboard-identity'

/** { nickname: string|null, guestId: string } — guestId is generated once and
 * never shown to the user; it's purely the DB-side uniqueness key for guests
 * (see supabase/daily_leaderboard.sql) so two different people who happen to
 * pick the same nickname don't overwrite each other's scores. */
export function getLeaderboardIdentity() {
  try {
    const raw = localStorage.getItem(LS_KEY)
    const parsed = raw ? JSON.parse(raw) : null
    if (parsed && typeof parsed.guestId === 'string') return parsed
  } catch {
    /* fall through to a fresh identity */
  }
  const fresh = { nickname: null, guestId: crypto.randomUUID() }
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(fresh))
  } catch {
    /* localStorage unavailable — identity just won't persist across visits */
  }
  return fresh
}

export function setLeaderboardNickname(nickname) {
  const identity = getLeaderboardIdentity()
  const next = { ...identity, nickname }
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(next))
  } catch {
    /* ignore */
  }
  return next
}

function storeIdentity(identity) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(identity))
  } catch {
    /* ignore */
  }
  return identity
}

export class NicknameTakenError extends Error {
  constructor(nickname) {
    super(`${nickname} is already taken. Log in with its PIN, or choose a different nickname.`)
    this.nickname = nickname
  }
}

/** Claims `nickname` for this browser's current guest_id. Throws NicknameTakenError if someone else already has it. */
export async function claimNickname(nickname, pin) {
  const identity = getLeaderboardIdentity()
  const { error } = await supabase.rpc('claim_leaderboard_nickname', {
    p_guest_id: identity.guestId,
    p_nickname: nickname,
    p_pin_hash: await hashPin(pin),
  })
  if (error) {
    if (error.message?.includes('NICKNAME_TAKEN')) throw new NicknameTakenError(nickname)
    throw error
  }
  return storeIdentity({ ...identity, nickname })
}

/** Logs in as an existing claimed nickname — adopts its guest_id, so daily_leaderboard's existing rows for it (already keyed by guest_id) show up immediately on this browser too. */
export async function loginWithNickname(nickname, pin) {
  const { data: guestId, error } = await supabase.rpc('login_leaderboard_nickname', {
    p_nickname: nickname,
    p_pin_hash: await hashPin(pin),
  })
  if (error) {
    if (error.message?.includes('NOT_FOUND')) throw new Error("That nickname hasn't been claimed yet")
    if (error.message?.includes('WRONG_PIN')) throw new Error('Wrong PIN for that nickname')
    throw error
  }
  return storeIdentity({ nickname, guestId })
}

/** True if nobody has claimed `nickname` yet — used by the "suggest a name for me" generator to skip a taken suggestion. */
export async function checkNicknameAvailable(nickname) {
  const { data, error } = await supabase.rpc('check_nickname_available', { p_nickname: nickname })
  if (error) return true // fail open — a generator suggestion isn't worth blocking on a network hiccup
  return data !== false
}
