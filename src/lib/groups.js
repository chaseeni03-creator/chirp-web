// Groups feature v3: membership now lives on the Flutter app's own schema
// (leaderboard_groups/leaderboard_group_members, see
// supabase/leaderboard_groups_guest.sql and leaderboard_groups_web.sql in
// chirp_sports) — Google Sign-In (via Supabase Auth, same provider/session
// the app uses) or guest mode (nickname + 4-digit PIN, localStorage only,
// same trust model as before: no server-side way to verify "this device
// owns nickname X", so PIN checks/deletes are app-level trust, not
// RLS-enforced).
//
// web_group_scores (this file's Score section, below) is DELIBERATELY
// UNCHANGED — same table, same columns, same submitGroupScore/
// fetchGroupLeaderboard shape as always. Only group/member IDENTITY moved;
// score storage stays fully separate from the app's own game_results-based
// leaderboard (see the migration's own header comment for why unifying
// that too isn't part of this).
//
// Two schema gaps the app's tables don't have, resolved here rather than
// with more SQL:
// - No per-membership nickname for a real account (only guests get a
//   stored nickname; leaderboard_group_members.nickname is NULL by
//   constraint for a user_id row) — a signed-in Google user's group
//   identity is their profile display_name/username instead, same
//   convention the app's own UI already uses everywhere else. This does
//   mean a Google user can no longer pick a distinct nickname per group
//   the way they used to; a deliberate simplification, not an oversight.
// - No last_active column at all — derived instead from that nickname's
//   most recent web_group_scores row, which is more accurate than a
//   manually-`.update()`-ed timestamp ever was anyway.

import { supabase, todayStr } from './supabase'
import { SITE_URL } from './share'
import { ERAS } from './sports'
import { hashPin } from './pin'

const MAX_MEMBERS = 20
const MAX_GROUPS_PER_USER = 3
const MAX_GROUPS_CREATED = 3
const MAX_FAILED_JOINS_PER_HOUR = 5
const LS_KEY = 'chirp-web:user'
const LS_GROUPS_GUEST_ID_KEY = 'chirp-web:groups-guest-id'
const LS_GUEST_CREATED_KEY = 'chirp-web:guest-groups-created' // soft, client-side only — guests have no server identity to enforce this against
const LS_FAILED_JOINS_KEY = 'chirp-web:failed-joins'

// Chirp Grid is temporarily hidden site-wide (all sports) — known scoring/
// gameplay issues under investigation. Removed from GAME_LABELS so it drops
// out of GAME_ORDER (and every page that iterates it: Leaderboard, Champions,
// Groups) along with games.js's matching removal. Restore by uncommenting.
export const GAME_LABELS = {
  'chirp-guess': 'Chirp Guess',
  'the-path': 'The Path',
  'stat-line': 'Stat Line',
  'career-builder': 'Career Builder',
  progression: 'The Progression',
  'more-or-less': 'More vs Less',
  lineup: 'The Lineup',
  // grid: 'Chirp Grid',
}
export const GAME_ORDER = Object.keys(GAME_LABELS)

// Cross-sport games — kept OUT of GAME_LABELS/GAME_ORDER on purpose:
// Champions.jsx and GroupPage.jsx both iterate GAME_ORDER once per real
// sport (nfl/mlb/nba) and look up `${game}:${sport}`, which would only ever
// find "no plays yet"/"not played" for a game that always submits under
// sport='all' — a permanently-broken-looking row, not a working feature.
// Leaderboard.jsx is the one place that handles these specially (its own
// sport-selector is per-page-instance, not a fixed per-sport loop), so it
// merges this in separately. Add a new cross-sport game here, not to
// GAME_LABELS, unless Champions/GroupPage get real support for one.
export const CROSS_SPORT_GAME_LABELS = {
  'before-or-after': 'Before or After',
}
export const GAME_PATHS = {
  'chirp-guess': '/guess',
  'the-path': '/path',
  'stat-line': '/statline',
  'career-builder': '/career',
  progression: '/progression',
  'more-or-less': '/moreorless',
  lineup: '/lineup',
  // grid: '/grid',
}

export class NicknameTakenError extends Error {
  constructor(nickname, canUsePin) {
    super(canUsePin
      ? `${nickname} is already taken in this group. Enter the PIN to continue as ${nickname} or choose a different nickname.`
      : `${nickname} is already taken in this group — choose a different nickname.`)
    this.nickname = nickname
    this.canUsePin = canUsePin
  }
}

// ── Input sanitization ───────────────────────────────────────────────────────

export function sanitizeNickname(input) {
  return (input || '')
    .replace(/<[^>]*>/g, '') // strip HTML/script tags
    .replace(/[^a-zA-Z0-9 ]/g, '') // alphanumeric + spaces only
    .trim()
    .slice(0, 20)
}

export function sanitizeGroupName(input) {
  return (input || '')
    .replace(/<[^>]*>/g, '')
    .trim()
    .slice(0, 30)
}

// ── Soft, client-side rate limits ────────────────────────────────────────────
// Guests have no stable server-side identity (no auth.uid()), so these can
// only ever be per-browser deterrents, not real enforcement — same trust
// level already established for guest PINs. Google users additionally get a
// real, server-verified check (created_by count) in createGroup below.

function guestGroupsCreatedCount() {
  try {
    return parseInt(localStorage.getItem(LS_GUEST_CREATED_KEY) || '0', 10)
  } catch {
    return 0
  }
}

function bumpGuestGroupsCreated() {
  try {
    localStorage.setItem(LS_GUEST_CREATED_KEY, String(guestGroupsCreatedCount() + 1))
  } catch {
    /* ignore */
  }
}

function recentFailedJoinCount() {
  try {
    const raw = JSON.parse(localStorage.getItem(LS_FAILED_JOINS_KEY) || '[]')
    const hourAgo = Date.now() - 60 * 60 * 1000
    return raw.filter((t) => t > hourAgo).length
  } catch {
    return 0
  }
}

function recordFailedJoin() {
  try {
    const hourAgo = Date.now() - 60 * 60 * 1000
    const raw = JSON.parse(localStorage.getItem(LS_FAILED_JOINS_KEY) || '[]')
    const kept = raw.filter((t) => t > hourAgo)
    kept.push(Date.now())
    localStorage.setItem(LS_FAILED_JOINS_KEY, JSON.stringify(kept))
  } catch {
    /* ignore */
  }
}

// ── Groups guest identity (per-browser, stable) ─────────────────────────────
// Deliberately separate from leaderboardIdentity.js's guestId — that file's
// own header explains why (asked for once, unrelated to whether someone
// ever touches Groups). Generated once, reused for every create/join call
// so the app's guest RPCs recognize a returning guest across visits.
function getGroupsGuestId() {
  try {
    const existing = localStorage.getItem(LS_GROUPS_GUEST_ID_KEY)
    if (existing) return existing
  } catch {
    /* fall through to generating a fresh one */
  }
  const fresh = crypto.randomUUID()
  try {
    localStorage.setItem(LS_GROUPS_GUEST_ID_KEY, fresh)
  } catch {
    /* localStorage unavailable — identity just won't persist across visits */
  }
  return fresh
}

// ── Local storage (per-browser identity) ────────────────────────────────────

export function getStoredUser() {
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (!raw) return null
    const user = JSON.parse(raw)
    if (!user || !user.nickname || !Array.isArray(user.groups)) return null
    return user
  } catch {
    return null
  }
}

export function storeUser(user) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(user))
  } catch {
    /* ignore */
  }
}

export function clearStoredUser() {
  try {
    localStorage.removeItem(LS_KEY)
  } catch {
    /* ignore */
  }
}

/** Add/replace one group's membership record on the stored user, capped at MAX_GROUPS_PER_USER. */
export function rememberGroup(user, membership) {
  const groups = (user?.groups || []).filter((g) => g.id !== membership.id)
  groups.unshift(membership)
  return { ...user, groups: groups.slice(0, MAX_GROUPS_PER_USER), activeGroupId: membership.id }
}

export function forgetGroup(user, groupId) {
  const groups = (user.groups || []).filter((g) => g.id !== groupId)
  const activeGroupId = user.activeGroupId === groupId ? groups[0]?.id ?? null : user.activeGroupId
  return { ...user, groups, activeGroupId }
}

export { MAX_MEMBERS, MAX_GROUPS_PER_USER }

// ── Google auth ──────────────────────────────────────────────────────────────

export async function signInWithGoogle() {
  // Hardcoded on purpose — using window.location.origin here redirected to
  // localhost in production (Supabase falls back to the dashboard's Site URL
  // when a requested redirect isn't recognized, and that was left pointed at
  // a local dev URL), so this is pinned to the real production URL instead.
  return supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: 'https://playchirpsports.com/groups' },
  })
}

export async function signOutGoogle() {
  await supabase.auth.signOut()
}

/** Permanently deletes the signed-in Google account and all its group data (server-side — see api/delete-account.js). */
export async function deleteGoogleAccount() {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  if (!token) throw new Error('Not signed in')

  const res = await fetch('/api/delete-account', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error || 'Could not delete your account')
  }
  await supabase.auth.signOut()
}

export async function getGoogleSession() {
  // Right after the OAuth redirect lands with tokens in the URL hash, mobile
  // browsers can be slow to finish processing them — retry briefly in that
  // specific case instead of giving up on the first empty check. On a normal
  // page load (no hash), this is a single check with no added delay.
  const cameFromOAuthRedirect = window.location.hash.includes('access_token')
  const attempts = cameFromOAuthRedirect ? 3 : 1
  for (let i = 0; i < attempts; i++) {
    const { data } = await supabase.auth.getSession()
    if (data.session) return data.session
    if (i < attempts - 1) await new Promise((r) => setTimeout(r, 1000))
  }
  return null
}

export function onAuthChange(callback) {
  const { data } = supabase.auth.onAuthStateChange((_event, session) => callback(session))
  return () => data.subscription.unsubscribe()
}

// ── Codes / links ────────────────────────────────────────────────────────────
// generateUniqueCode() is gone — create_leaderboard_group generates a
// unique invite_code server-side now, no client-side collision check needed.

/** Accepts "4829", "CHIRP-4829", "chirp-4829", or a pasted full invite link. */
export function normalizeCode(input) {
  if (!input) return ''
  let v = input.trim()
  const linkMatch = v.match(/\/g\/([A-Za-z0-9-]+)\s*$/)
  if (linkMatch) v = linkMatch[1]
  v = v.replace(/^chirp-/i, '')
  return v.toUpperCase()
}

export function displayCode(code) {
  return `CHIRP-${code?.toUpperCase?.() ?? code}`
}

export function inviteLink(code) {
  return `${SITE_URL}/g/${code}`
}

export function buildInviteMessage(group) {
  return `Join ${group.name} on Chirp Sports! Daily NFL sports games.\nCode: ${displayCode(group.code)}\n${inviteLink(group.code)}`
}

export function smsShareUrl(text) {
  return `sms:&body=${encodeURIComponent(text)}`
}
export function whatsappShareUrl(text) {
  return `https://wa.me/?text=${encodeURIComponent(text)}`
}
export function twitterShareUrl(text) {
  return `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`
}

// ── Create / join ────────────────────────────────────────────────────────────

/** Public preview by invite code, no membership required — same RPC the Flutter app uses for its own "you're about to join X" screen. Returns { id, name, photo_url, member_count } or null. */
export async function previewGroupByCode(code) {
  const { data } = await supabase.rpc('preview_leaderboard_group_by_code', { p_invite_code: code })
  return Array.isArray(data) && data.length ? data[0] : null
}

/**
 * identity: { type: 'google', userId } | { type: 'guest', pin }
 * Returns { id, code, name } — call rememberGroup + storeUser with the result yourself.
 */
export async function createGroup({ groupName, nickname, isPublic = false, identity }) {
  const cleanName = sanitizeGroupName(groupName)
  const cleanNickname = sanitizeNickname(nickname)
  if (!cleanName) throw new Error('Enter a group name')
  if (!cleanNickname) throw new Error('Enter a nickname')

  if (identity.type === 'google') {
    const { count } = await supabase
      .from('leaderboard_groups')
      .select('id', { count: 'exact', head: true })
      .eq('created_by', identity.userId)
    if ((count || 0) >= MAX_GROUPS_CREATED) {
      throw new Error(`You've already created ${MAX_GROUPS_CREATED} groups — leave or delete one first`)
    }
  } else if (guestGroupsCreatedCount() >= MAX_GROUPS_CREATED) {
    throw new Error(`You've already created ${MAX_GROUPS_CREATED} groups on this device — leave or delete one first`)
  }

  const params = { p_name: cleanName, p_photo_url: null, p_is_public: isPublic }
  if (identity.type === 'guest') {
    params.p_guest_id = getGroupsGuestId()
    params.p_guest_nickname = cleanNickname
    params.p_guest_pin_hash = await hashPin(identity.pin)
  }
  const { data: group, error } = await supabase.rpc('create_leaderboard_group', params)
  if (error) throw error

  if (identity.type === 'guest') bumpGuestGroupsCreated()

  return { id: group.id, code: group.invite_code, name: group.name }
}

/**
 * identity: { type: 'google', userId } | { type: 'guest', pin }
 * Throws NicknameTakenError if the nickname belongs to someone else (and, for
 * guests, the given PIN doesn't match the existing guest row).
 */
export async function joinGroup({ code, nickname, identity }) {
  if (recentFailedJoinCount() >= MAX_FAILED_JOINS_PER_HOUR) {
    throw new Error('Too many failed join attempts — try again in an hour')
  }

  const clean = normalizeCode(code)
  const trimmedNickname = sanitizeNickname(nickname)
  if (!trimmedNickname) throw new Error('Enter a nickname')

  const params = { p_invite_code: clean }
  if (identity.type === 'guest') {
    params.p_guest_id = getGroupsGuestId()
    params.p_guest_nickname = trimmedNickname
    params.p_guest_pin_hash = await hashPin(identity.pin)
  }

  const { data: groupId, error } = await supabase.rpc('join_leaderboard_group_by_code', params)
  if (error) {
    if (error.message?.includes('NICKNAME_TAKEN')) {
      recordFailedJoin()
      throw new NicknameTakenError(trimmedNickname, true)
    }
    if (error.message?.includes('Invalid invite code')) {
      recordFailedJoin()
      throw new Error("That group code doesn't exist")
    }
    throw error
  }

  // Read the group back via the public preview RPC rather than a direct
  // table SELECT — leaderboard_groups' own SELECT policy is gated on
  // auth.uid() membership, which a guest session (no auth.uid() at all)
  // can never satisfy, so a direct read here would silently come back
  // empty for every guest join.
  const group = await previewGroupByCode(clean)
  return { id: groupId, code: clean, name: group?.name ?? '' }
}

/** Re-verifies a guest's cached PIN against the server — used for the "welcome back" confirm screen. */
export async function verifyGuestPin({ groupId, nickname, pin }) {
  // Reads the guest RPC directly (not fetchGroupMembers' normalized shape,
  // below) since pin_hash isn't part of that shape and doesn't need to be —
  // this is the one place it's actually checked.
  const { data } = await supabase.rpc('get_leaderboard_group_members_for_guest', { p_group_id: groupId })
  const member = (data || []).find((m) => m.is_guest && m.nickname === nickname)
  if (!member) return false
  const givenHash = await hashPin(pin)
  return givenHash === member.pin_hash
}

export async function leaveGroup({ groupId, nickname }) {
  const { data: sessionData } = await supabase.auth.getSession()
  const userId = sessionData.session?.user?.id

  // The DELETE policy's guest branch is deliberately open (`is_guest = true`,
  // app-level trust only — see leaderboard_groups_guest.sql), but the authed
  // branch is real (`user_id = auth.uid()`) — a Google member has no
  // `nickname` column to match on at all, so this has to branch on identity
  // rather than filtering by nickname for both.
  if (userId) {
    await supabase.from('leaderboard_group_members').delete().eq('group_id', groupId).eq('user_id', userId)
  } else {
    await supabase
      .from('leaderboard_group_members')
      .delete()
      .eq('group_id', groupId)
      .eq('nickname', nickname)
      .eq('is_guest', true)
  }

  // If that was the last member, clean up the now-empty group instead of
  // leaving a ghost row behind. Counted via the guest RPC (SECURITY DEFINER,
  // bypasses the membership-gated SELECT policy) so this works regardless of
  // who's leaving.
  const { data: remaining } = await supabase.rpc('get_leaderboard_group_members_for_guest', { p_group_id: groupId })
  if ((remaining || []).length === 0) {
    await supabase.from('leaderboard_groups').delete().eq('id', groupId)
  }
}

export async function fetchPublicGroups(limit = 20) {
  const { data, error } = await supabase.rpc('fetch_public_leaderboard_groups', { p_limit: limit })
  if (error) throw error
  return (data || []).map((g) => ({
    id: g.id,
    group_code: g.invite_code,
    group_name: g.name,
    created_at: g.created_at,
    memberCount: Number(g.member_count) || 0,
  }))
}

// ── Members / streaks ────────────────────────────────────────────────────────

function daysAgo(dateStr) {
  const then = new Date(dateStr)
  const now = new Date()
  const diffMs = now.setHours(0, 0, 0, 0) - then.setHours(0, 0, 0, 0)
  return Math.round(diffMs / 86400000)
}

/** 🟢 active today, 🟡 active yesterday, ⚫ older/never. */
export function memberStatus(lastActive) {
  if (!lastActive) return { dot: '⚫', label: 'Not active yet' }
  const diff = daysAgo(lastActive)
  if (diff <= 0) return { dot: '🟢', label: 'Active today' }
  if (diff === 1) return { dot: '🟡', label: 'Last active: yesterday' }
  return { dot: '⚫', label: `Last active: ${diff} days ago` }
}

/** Consecutive-day streak (any game counts), computed from real submitted scores rather than a trusted client counter. */
export async function computeStreak(groupId, nickname) {
  const { data } = await supabase
    .from('web_group_scores')
    .select('game_date')
    .eq('group_id', groupId)
    .eq('nickname', nickname)
    .order('game_date', { ascending: false })
  if (!data || data.length === 0) return 0
  const dates = [...new Set(data.map((r) => r.game_date))].sort().reverse()
  const today = todayStr()
  let cursor = new Date(today)
  // A streak still counts if today hasn't been played yet but yesterday was.
  if (dates[0] !== today) cursor.setDate(cursor.getDate() - 1)
  let streak = 0
  for (const d of dates) {
    const expected = cursor.toISOString().slice(0, 10)
    if (d !== expected) break
    streak++
    cursor.setDate(cursor.getDate() - 1)
  }
  return streak
}

/** Most recent game_date this nickname submitted a score in this group — stands in for the old last_active column, which leaderboard_group_members doesn't have. */
async function lastActiveFor(groupId, nickname) {
  const { data } = await supabase
    .from('web_group_scores')
    .select('game_date')
    .eq('group_id', groupId)
    .eq('nickname', nickname)
    .order('game_date', { ascending: false })
    .limit(1)
    .maybeSingle()
  return data?.game_date ?? null
}

/** A member row's display identity: a guest's own stored nickname, or a Google member's profile name (see the header note on why authed rows carry no per-group nickname). */
function memberNickname(m) {
  return m.is_guest ? m.nickname : m.display_name || m.username || 'Player'
}

export async function fetchGroupMembers(groupId, { asGuest = false } = {}) {
  let rows
  if (asGuest) {
    const { data, error } = await supabase.rpc('get_leaderboard_group_members_for_guest', { p_group_id: groupId })
    if (error) throw error
    rows = data || []
  } else {
    const { data, error } = await supabase
      .from('leaderboard_group_members')
      .select('id, user_id, guest_id, nickname, is_guest, joined_at')
      .eq('group_id', groupId)
      .order('joined_at')
    if (error) throw error
    rows = data || []

    // leaderboard_group_members.user_id references auth.users, not profiles
    // directly — PostgREST can't auto-embed profiles(...) across that gap
    // (no FK between the two tables it's actually joining), so this is a
    // separate batch fetch rather than a nested select.
    const userIds = rows.filter((m) => m.user_id).map((m) => m.user_id)
    let profileById = {}
    if (userIds.length > 0) {
      const { data: profiles } = await supabase.from('profiles').select('id, username, display_name').in('id', userIds)
      profileById = Object.fromEntries((profiles || []).map((p) => [p.id, p]))
    }
    rows = rows.map((m) => ({
      member_id: m.id,
      user_id: m.user_id,
      guest_id: m.guest_id,
      nickname: m.nickname,
      is_guest: m.is_guest,
      joined_at: m.joined_at,
      username: profileById[m.user_id]?.username ?? null,
      display_name: profileById[m.user_id]?.display_name ?? null,
    }))
  }

  return Promise.all(
    rows.map(async (m) => {
      const nickname = memberNickname(m)
      const [status, streak] = await Promise.all([
        lastActiveFor(groupId, nickname).then(memberStatus),
        computeStreak(groupId, nickname),
      ])
      return {
        id: m.member_id,
        nickname,
        is_guest: m.is_guest,
        user_id: m.user_id,
        joined_at: m.joined_at,
        status,
        streak,
      }
    })
  )
}

// ── Scores ───────────────────────────────────────────────────────────────────
// web_group_scores itself — table, columns, submit/fetch shape — is
// completely unchanged from before this migration.

export async function submitGroupScore({ groupId, nickname, gameType, sport, era, score, details }) {
  const row = {
    group_id: groupId,
    member_id: null,
    nickname,
    game_type: gameType,
    sport,
    era: era || 'all_time',
    score: Math.round(score),
    details: details ?? null,
    game_date: todayStr(),
  }
  const { error } = await supabase
    .from('web_group_scores')
    .upsert(row, { onConflict: 'group_id,nickname,game_type,sport,game_date,era' })
  if (error) throw error
  return row
}

export function eraLabel(sport, eraKey) {
  if (!eraKey || eraKey === 'all_time') return null
  const found = (ERAS[sport] || []).find((e) => e.key === eraKey)
  return found ? found.label : eraKey
}

/**
 * Best score per (nickname, game_type) for a group/sport/day — "best era
 * wins": a member may have one row per era they tried; only their MAX(score)
 * row counts, with that row's era shown as the badge.
 */
export async function fetchGroupLeaderboard({ groupId, sport, gameDate = todayStr() }) {
  const [{ data: scores, error: scoresErr }, { data: rosterRows, error: rosterErr }] = await Promise.all([
    supabase.from('web_group_scores').select('*').eq('group_id', groupId).eq('sport', sport).eq('game_date', gameDate),
    // Roster read through the guest RPC (SECURITY DEFINER, open on group_id
    // alone) rather than a direct table read or a required `members` param —
    // it works the same whether the caller is a guest or Google session, and
    // callers (GroupScoreBanner especially) shouldn't need to have already
    // loaded the full member list just to show a leaderboard.
    supabase.rpc('get_leaderboard_group_members_for_guest', { p_group_id: groupId }),
  ])
  if (scoresErr) throw scoresErr
  if (rosterErr) throw rosterErr

  const allNicknames = [...new Set((rosterRows || []).map(memberNickname))]
  const byGame = {}
  for (const gameType of GAME_ORDER) {
    const rowsForGame = (scores || []).filter((s) => s.game_type === gameType)
    const bestByNickname = new Map()
    for (const row of rowsForGame) {
      const current = bestByNickname.get(row.nickname)
      if (!current || row.score > current.score) bestByNickname.set(row.nickname, row)
    }
    const played = allNicknames
      .filter((n) => bestByNickname.has(n))
      .map((n) => {
        const row = bestByNickname.get(n)
        return { nickname: n, score: row.score, era: row.era, eraLabel: eraLabel(sport, row.era), details: row.details }
      })
      .sort((a, b) => b.score - a.score)
      .map((entry, i) => ({ ...entry, rank: i + 1, played: true }))
    const notPlayed = allNicknames.filter((n) => !bestByNickname.has(n)).map((n) => ({ nickname: n, played: false }))
    byGame[gameType] = [...played, ...notPlayed]
  }
  return byGame
}

/** A member's single best score today for one game/sport, across all eras — used for the post-game "new best?" banner. */
export async function fetchBestScore({ groupId, nickname, gameType, sport, gameDate = todayStr() }) {
  const { data } = await supabase
    .from('web_group_scores')
    .select('score, era')
    .eq('group_id', groupId)
    .eq('nickname', nickname)
    .eq('game_type', gameType)
    .eq('sport', sport)
    .eq('game_date', gameDate)
    .order('score', { ascending: false })
    .limit(1)
    .maybeSingle()
  return data || null
}

/**
 * `onError` fires if the realtime channel can't connect at all (some mobile
 * browsers restrict WebSockets, e.g. in private-browsing modes) — callers
 * should fall back to polling when that happens. Never throws: a broken
 * subscription degrades to "no live updates," it doesn't crash the page.
 */
export function subscribeToGroupScores(groupId, onChange, onError) {
  try {
    const channel = supabase
      .channel(`web_group_scores:${groupId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'web_group_scores', filter: `group_id=eq.${groupId}` }, onChange)
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') onError?.()
      })
    return () => supabase.removeChannel(channel)
  } catch (err) {
    console.error('Realtime subscription failed:', err)
    onError?.()
    return () => {}
  }
}

// ── Share text ───────────────────────────────────────────────────────────────

export function buildGroupShareText(baseShareText, group) {
  const lines = baseShareText.split('\n')
  const withGroup = [lines[0], `${group.name} | ${displayCode(group.code)}`, ...lines.slice(1)]
  return withGroup
    .join('\n')
    .replace(new RegExp(`Play free at ${SITE_URL}`), `Can you beat me?\n${inviteLink(group.code)}`)
}
