// Groups feature: create/join a code-based group, submit scores, and read a
// realtime leaderboard. No accounts — nickname + group_code is the entire
// identity model, matching the rest of this app's anonymous, local-storage-
// only design (see README / src/lib/storage.js).

import { supabase, todayStr } from './supabase'
import { SITE_URL } from './share'
import { ERAS } from './sports'

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // no O/0/I/1 — avoids misreads
const CODE_LENGTH = 4
const MAX_MEMBERS = 20
const LS_PREFIX = 'chirp-web:group:'

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

// ── Local storage (per-browser "session") ───────────────────────────────────

export function getStoredGroup() {
  try {
    const nickname = localStorage.getItem(LS_PREFIX + 'nickname')
    const id = localStorage.getItem(LS_PREFIX + 'group_id')
    const code = localStorage.getItem(LS_PREFIX + 'group_code')
    const name = localStorage.getItem(LS_PREFIX + 'group_name')
    if (!nickname || !id || !code) return null
    return { nickname, id, code, name: name || 'Group' }
  } catch {
    return null
  }
}

export function storeGroup({ nickname, id, code, name }) {
  try {
    localStorage.setItem(LS_PREFIX + 'nickname', nickname)
    localStorage.setItem(LS_PREFIX + 'group_id', id)
    localStorage.setItem(LS_PREFIX + 'group_code', code)
    localStorage.setItem(LS_PREFIX + 'group_name', name)
  } catch {
    /* ignore */
  }
}

export function clearStoredGroup() {
  try {
    ;['nickname', 'group_id', 'group_code', 'group_name'].forEach((k) => localStorage.removeItem(LS_PREFIX + k))
  } catch {
    /* ignore */
  }
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

// ── Create / join ────────────────────────────────────────────────────────────

async function generateUniqueCode() {
  for (let attempt = 0; attempt < 8; attempt++) {
    const code = randomCode()
    const { data } = await supabase.from('web_groups').select('id').eq('group_code', code).maybeSingle()
    if (!data) return code
  }
  throw new Error('Could not generate a unique group code — try again')
}

export async function createGroup({ groupName, nickname, isPublic = false }) {
  const code = await generateUniqueCode()
  const { data: group, error } = await supabase
    .from('web_groups')
    .insert({ group_code: code, group_name: groupName.trim(), is_public: isPublic })
    .select()
    .single()
  if (error) throw error

  await supabase.from('web_group_members').insert({ group_id: group.id, nickname: nickname.trim() })
  const result = { id: group.id, code: group.group_code, name: group.group_name }
  storeGroup({ nickname: nickname.trim(), ...result })
  return result
}

export async function joinGroup({ code, nickname }) {
  const clean = normalizeCode(code)
  const { data: group, error } = await supabase.from('web_groups').select('*').eq('group_code', clean).maybeSingle()
  if (error || !group) throw new Error("That group code doesn't exist")

  const { count } = await supabase
    .from('web_group_members')
    .select('id', { count: 'exact', head: true })
    .eq('group_id', group.id)
  if ((count || 0) >= MAX_MEMBERS) throw new Error(`${group.group_name} is full (${MAX_MEMBERS} members max)`)

  const trimmedNickname = nickname.trim()
  const { data: existing } = await supabase
    .from('web_group_members')
    .select('id')
    .eq('group_id', group.id)
    .eq('nickname', trimmedNickname)
    .maybeSingle()
  if (existing) {
    await supabase.from('web_group_members').update({ last_active: new Date().toISOString() }).eq('id', existing.id)
  } else {
    await supabase.from('web_group_members').insert({ group_id: group.id, nickname: trimmedNickname })
  }

  const result = { id: group.id, code: group.group_code, name: group.group_name }
  storeGroup({ nickname: trimmedNickname, ...result })
  return result
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

export async function fetchMemberCount(groupId) {
  const { count } = await supabase.from('web_group_members').select('id', { count: 'exact', head: true }).eq('group_id', groupId)
  return count || 0
}

// ── Scores ───────────────────────────────────────────────────────────────────

/**
 * Submit (upsert) a member's score for one game/sport/era/day. Safe to call
 * repeatedly for the same era — later calls overwrite that era's row, they
 * never stack duplicates, since era is part of the unique key.
 */
export async function submitGroupScore({ groupId, nickname, gameType, sport, era, score, details }) {
  const row = {
    group_id: groupId,
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
  const [{ data: scores }, { data: members }] = await Promise.all([
    supabase.from('web_group_scores').select('*').eq('group_id', groupId).eq('sport', sport).eq('game_date', gameDate),
    supabase.from('web_group_members').select('nickname').eq('group_id', groupId),
  ])

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

export function subscribeToGroupScores(groupId, onChange) {
  const channel = supabase
    .channel(`web_group_scores:${groupId}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'web_group_scores', filter: `group_id=eq.${groupId}` }, onChange)
    .subscribe()
  return () => supabase.removeChannel(channel)
}

// ── Share text ───────────────────────────────────────────────────────────────

export function buildGroupShareText(baseShareText, group) {
  const lines = baseShareText.split('\n')
  // Insert the group line right after the game title (first line), and swap
  // the generic "Play free at..." CTA for the group's own invite link.
  const withGroup = [lines[0], `${group.name} | ${displayCode(group.code)}`, ...lines.slice(1)]
  return withGroup
    .join('\n')
    .replace(new RegExp(`Play free at ${SITE_URL}`), `Can you beat me?\n${inviteLink(group.code)}`)
}

export { MAX_MEMBERS }
