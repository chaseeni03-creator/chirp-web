// Groups feature v2: Google Sign-In (via Supabase Auth, same provider the
// Flutter app uses) or guest mode (nickname + 4-digit PIN, localStorage only).
// A member is either a real Supabase Auth user (user_id set, is_guest=false,
// works on any device) or a guest (user_id null, is_guest=true, tied to this
// browser + whatever PIN they picked). See supabase/web_groups_auth.sql for
// why guest ownership/deletes are app-level trust, not RLS-enforced — there's
// no Supabase Auth session for a guest to check auth.uid() against.

import { supabase, todayStr } from './supabase'
import { SITE_URL } from './share'
import { ERAS } from './sports'

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // no O/0/I/1 — avoids misreads
const CODE_LENGTH = 4
const MAX_MEMBERS = 20
const MAX_GROUPS_PER_USER = 3
const MAX_GROUPS_CREATED = 3
const MAX_FAILED_JOINS_PER_HOUR = 5
const LS_KEY = 'chirp-web:user'
const LS_GUEST_CREATED_KEY = 'chirp-web:guest-groups-created' // soft, client-side only — guests have no server identity to enforce this against
const LS_FAILED_JOINS_KEY = 'chirp-web:failed-joins'

export const GAME_LABELS = {
  'chirp-guess': 'Chirp Guess',
  'stat-line': 'Stat Line',
  'career-builder': 'Career Builder',
  progression: 'The Progression',
  'more-or-less': 'More vs Less',
  lineup: 'The Lineup',
  grid: 'Chirp Grid',
}
export const GAME_ORDER = Object.keys(GAME_LABELS)
export const GAME_PATHS = {
  'chirp-guess': '/guess',
  'stat-line': '/statline',
  'career-builder': '/career',
  progression: '/progression',
  'more-or-less': '/moreorless',
  lineup: '/lineup',
  grid: '/grid',
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

// ── PIN hashing (Web Crypto — no dependency) ────────────────────────────────
// Note: RLS grants public SELECT on web_group_members, so this hash is
// readable by anyone in the group. Hashing stops a plaintext PIN showing up
// in a network tab, but a 4-digit space (10,000 combos) is not a real secret
// against someone willing to brute-force it offline — this is a nickname-
// squatting deterrent for friends, not a security boundary.
async function hashPin(pin) {
  const data = new TextEncoder().encode(`chirp-sports-guest-pin:${pin}`)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
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

function randomCode() {
  let out = ''
  for (let i = 0; i < CODE_LENGTH; i++) out += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]
  return out
}

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
  return `CHIRP-${code}`
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

async function generateUniqueCode() {
  for (let attempt = 0; attempt < 8; attempt++) {
    const code = randomCode()
    const { data } = await supabase.from('web_groups').select('id').eq('group_code', code).maybeSingle()
    if (!data) return code
  }
  throw new Error('Could not generate a unique group code — try again')
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
      .from('web_groups')
      .select('id', { count: 'exact', head: true })
      .eq('created_by', identity.userId)
    if ((count || 0) >= MAX_GROUPS_CREATED) throw new Error(`You've already created ${MAX_GROUPS_CREATED} groups — leave or delete one first`)
  } else if (guestGroupsCreatedCount() >= MAX_GROUPS_CREATED) {
    throw new Error(`You've already created ${MAX_GROUPS_CREATED} groups on this device — leave or delete one first`)
  }

  const code = await generateUniqueCode()
  const { data: group, error } = await supabase
    .from('web_groups')
    .insert({
      group_code: code,
      group_name: cleanName,
      is_public: isPublic,
      created_by: identity.type === 'google' ? identity.userId : null,
    })
    .select()
    .single()
  if (error) throw error

  const memberRow = {
    group_id: group.id,
    nickname: cleanNickname,
    is_guest: identity.type === 'guest',
    user_id: identity.type === 'google' ? identity.userId : null,
    pin_hash: identity.type === 'guest' ? await hashPin(identity.pin) : null,
  }
  const { error: memberErr } = await supabase.from('web_group_members').insert(memberRow)
  if (memberErr) throw memberErr

  if (identity.type === 'guest') bumpGuestGroupsCreated()

  return { id: group.id, code: group.group_code, name: group.group_name }
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
  const { data: group, error } = await supabase.from('web_groups').select('*').eq('group_code', clean).maybeSingle()
  if (error || !group) {
    recordFailedJoin()
    throw new Error("That group code doesn't exist")
  }

  const trimmedNickname = sanitizeNickname(nickname)
  if (!trimmedNickname) throw new Error('Enter a nickname')
  const { data: existing } = await supabase
    .from('web_group_members')
    .select('*')
    .eq('group_id', group.id)
    .eq('nickname', trimmedNickname)
    .maybeSingle()

  if (existing) {
    if (identity.type === 'google' && existing.user_id === identity.userId) {
      await supabase.from('web_group_members').update({ last_active: new Date().toISOString() }).eq('id', existing.id)
      return { id: group.id, code: group.group_code, name: group.group_name }
    }
    if (identity.type === 'guest' && existing.is_guest) {
      const givenHash = await hashPin(identity.pin)
      if (givenHash !== existing.pin_hash) {
        recordFailedJoin()
        throw new NicknameTakenError(trimmedNickname, true)
      }
      await supabase.from('web_group_members').update({ last_active: new Date().toISOString() }).eq('id', existing.id)
      return { id: group.id, code: group.group_code, name: group.group_name }
    }
    // Belongs to someone else entirely (different Google account, or a guest
    // and this join is Google, or vice versa) — no PIN can resolve that.
    recordFailedJoin()
    throw new NicknameTakenError(trimmedNickname, identity.type === 'guest' && existing.is_guest)
  }

  const { count } = await supabase
    .from('web_group_members')
    .select('id', { count: 'exact', head: true })
    .eq('group_id', group.id)
  if ((count || 0) >= (group.max_members || MAX_MEMBERS)) {
    throw new Error(`${group.group_name} is full (${group.max_members || MAX_MEMBERS} members max)`)
  }

  const memberRow = {
    group_id: group.id,
    nickname: trimmedNickname,
    is_guest: identity.type === 'guest',
    user_id: identity.type === 'google' ? identity.userId : null,
    pin_hash: identity.type === 'guest' ? await hashPin(identity.pin) : null,
  }
  const { error: insertErr } = await supabase.from('web_group_members').insert(memberRow)
  if (insertErr) throw insertErr

  return { id: group.id, code: group.group_code, name: group.group_name }
}

/** Re-verifies a guest's cached PIN against the server — used for the "welcome back" confirm screen. */
export async function verifyGuestPin({ groupId, nickname, pin }) {
  const { data: member } = await supabase
    .from('web_group_members')
    .select('id, pin_hash')
    .eq('group_id', groupId)
    .eq('nickname', nickname)
    .maybeSingle()
  if (!member) return false
  const givenHash = await hashPin(pin)
  return givenHash === member.pin_hash
}

export async function leaveGroup({ groupId, nickname }) {
  const { data: member } = await supabase
    .from('web_group_members')
    .select('id')
    .eq('group_id', groupId)
    .eq('nickname', nickname)
    .maybeSingle()
  if (member) {
    await supabase.from('web_group_members').delete().eq('id', member.id)
  }

  // If that was the last member, clean up the now-empty group instead of
  // leaving a ghost row behind — no "ownership" concept exists anywhere else
  // in this app, so there's nothing to transfer regardless of who left.
  const { count } = await supabase.from('web_group_members').select('id', { count: 'exact', head: true }).eq('group_id', groupId)
  if ((count || 0) === 0) {
    await supabase.from('web_groups').delete().eq('id', groupId)
  }
}

export async function fetchPublicGroups(limit = 20) {
  const { data } = await supabase
    .from('web_groups')
    .select('id, group_code, group_name, created_at')
    .eq('is_public', true)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (!data) return []
  const withCounts = await Promise.all(
    data.map(async (g) => {
      const { count } = await supabase.from('web_group_members').select('id', { count: 'exact', head: true }).eq('group_id', g.id)
      return { ...g, memberCount: count || 0 }
    })
  )
  return withCounts
}

export async function fetchGroupsByIds(ids) {
  if (!ids || ids.length === 0) return []
  const { data } = await supabase.from('web_groups').select('id, group_code, group_name').in('id', ids)
  return (data || []).map((g) => ({ id: g.id, code: g.group_code, name: g.group_name }))
}

// ── Members / streaks ────────────────────────────────────────────────────────

function daysAgo(dateStr) {
  const then = new Date(dateStr)
  const now = new Date()
  const diffMs = now.setHours(0, 0, 0, 0) - then.setHours(0, 0, 0, 0)
  return Math.round(diffMs / 86400000)
}

/** 🟢 active today, 🟡 active yesterday, ⚫ older. */
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

export async function fetchGroupMembers(groupId) {
  const { data, error } = await supabase
    .from('web_group_members')
    .select('id, nickname, is_guest, user_id, last_active, joined_at')
    .eq('group_id', groupId)
    .order('joined_at')
  if (error) throw error
  if (!data) return []
  return Promise.all(
    data.map(async (m) => ({
      ...m,
      status: memberStatus(m.last_active),
      streak: await computeStreak(groupId, m.nickname),
    }))
  )
}

// ── Scores ───────────────────────────────────────────────────────────────────

export async function submitGroupScore({ groupId, nickname, gameType, sport, era, score, details }) {
  const { data: member } = await supabase
    .from('web_group_members')
    .select('id')
    .eq('group_id', groupId)
    .eq('nickname', nickname)
    .maybeSingle()

  const row = {
    group_id: groupId,
    member_id: member?.id ?? null,
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

  if (member) await supabase.from('web_group_members').update({ last_active: new Date().toISOString() }).eq('id', member.id)
  return row
}

function eraLabel(sport, eraKey) {
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
  const [{ data: scores, error: scoresErr }, { data: members, error: membersErr }] = await Promise.all([
    supabase.from('web_group_scores').select('*').eq('group_id', groupId).eq('sport', sport).eq('game_date', gameDate),
    supabase.from('web_group_members').select('nickname').eq('group_id', groupId),
  ])
  if (scoresErr || membersErr) throw scoresErr || membersErr

  const allNicknames = [...new Set((members || []).map((m) => m.nickname))]
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
