// The Lineup logic, ported from lib/models/lineup_game.dart,
// mlb_lineup_game.dart, nba_lineup_game.dart and their matching services.

import { supabase } from './supabase'
import { nflTeamCodesForScope } from './statLine'
import { mlbTeamCodesForScope, nbaTeamCodesForScope } from './chirpGuess'

export const LINEUP_CATEGORIES = {
  nfl: [
    { key: 'passing_yards', label: 'Passing Yards', shareLabel: 'Pass Yds', column: 'passing_yards', section: 'offense' },
    { key: 'rushing_yards', label: 'Rushing Yards', shareLabel: 'Rush Yds', column: 'rushing_yards', section: 'offense' },
    { key: 'receiving_yards', label: 'Receiving Yards', shareLabel: 'Rec Yds', column: 'receiving_yards', section: 'offense' },
    { key: 'passing_tds', label: 'Passing TDs', shareLabel: 'Pass TDs', column: 'passing_touchdowns', section: 'offense' },
    { key: 'rushing_tds', label: 'Rushing TDs', shareLabel: 'Rush TDs', column: 'rushing_touchdowns', section: 'offense' },
    { key: 'receiving_tds', label: 'Receiving TDs', shareLabel: 'Rec TDs', column: 'receiving_touchdowns', section: 'offense' },
    { key: 'sacks', label: 'Sacks', shareLabel: 'Sacks', column: 'sacks', section: 'defense' },
    { key: 'interceptions', label: 'Interceptions', shareLabel: 'INTs', column: 'interceptions_caught', section: 'defense' },
    { key: 'tackles', label: 'Tackles', shareLabel: 'Tackles', column: 'tackles', section: 'defense' },
  ],
  mlb: [
    { key: 'home_runs', label: 'Home Runs', shareLabel: 'HR', column: 'home_runs', section: 'batting' },
    { key: 'hits', label: 'Hits', shareLabel: 'Hits', column: 'hits', section: 'batting' },
    { key: 'rbi', label: 'RBI', shareLabel: 'RBI', column: 'rbi', section: 'batting' },
    { key: 'runs', label: 'Runs', shareLabel: 'Runs', column: 'runs', section: 'batting' },
    { key: 'doubles', label: 'Doubles', shareLabel: '2B', column: 'doubles', section: 'batting' },
    { key: 'stolen_bases', label: 'Stolen Bases', shareLabel: 'SB', column: 'stolen_bases', section: 'batting' },
    { key: 'wins', label: 'Wins', shareLabel: 'W', column: 'wins', section: 'pitching' },
    { key: 'saves', label: 'Saves', shareLabel: 'SV', column: 'saves', section: 'pitching' },
    { key: 'strikeouts_pitched', label: 'Strikeouts', shareLabel: 'K', column: 'strikeouts_pitched', section: 'pitching' },
  ],
  nba: [
    { key: 'points', label: 'Points', shareLabel: 'PTS', column: 'total_points', agg: 'sum' },
    { key: 'rebounds', label: 'Rebounds', shareLabel: 'REB', column: 'total_rebounds', agg: 'sum' },
    { key: 'assists', label: 'Assists', shareLabel: 'AST', column: 'total_assists', agg: 'sum' },
    { key: 'steals', label: 'Steals', shareLabel: 'STL', column: 'total_steals', agg: 'sum' },
    { key: 'blocks', label: 'Blocks', shareLabel: 'BLK', column: 'total_blocks', agg: 'sum' },
    {
      key: 'field_goal_percentage', label: 'Field Goal %', shareLabel: 'FG%',
      column: 'field_goals_made', attemptColumn: 'field_goals_attempted', agg: 'weightedPercent', modernOnly: true,
    },
    // Web-only addition beyond mobile's 6-category NBA Lineup, added by
    // request — nba_season_stats/nba_career_stats both carry a real
    // three_pointers_made column (verified against Stephen Curry's actual
    // career total).
    { key: 'three_pointers_made', label: '3-Pointers Made', shareLabel: '3PM', column: 'three_pointers_made', agg: 'sum' },
  ],
}

const NBA_MIN_ATTEMPTS_FOR_PERCENT = 50

export function lineupCategoriesFor(sport, section) {
  return LINEUP_CATEGORIES[sport].filter((c) => (c.section ?? null) === section)
}

export function lineupMaxBaseScore(sport) {
  return LINEUP_CATEGORIES[sport].length * 300
}

export function lineupMaxTotalScore(sport) {
  // NBA: 7 categories x 300 (2,100) + allTop3 (500) + allFirst (1,000) = 3,600.
  return sport === 'nba' ? 3600 : 4600
}

export function lineupPointsForRank(rank) {
  if (rank === 1) return 300
  if (rank === 2) return 200
  if (rank === 3) return 100
  return 0
}

/** { allTop3, allFirst, perfect<Section1>, perfect<Section2> } — sport-shaped like mobile's *LineupBonuses classes. */
export function computeLineupBonuses(sport, guessesByKey) {
  const categories = LINEUP_CATEGORIES[sport]
  const top3 = (key) => {
    const r = guessesByKey[key]?.rank
    return r != null && r <= 3
  }
  const first = (key) => guessesByKey[key]?.rank === 1

  const allTop3 = categories.every((c) => top3(c.key)) ? 500 : 0
  const allFirst = categories.every((c) => first(c.key)) ? 1000 : 0
  if (sport === 'nba') {
    const total = allTop3 + allFirst
    return { allTop3, allFirst, total }
  }
  const sectionA = sport === 'mlb' ? 'batting' : 'offense'
  const sectionB = sport === 'mlb' ? 'pitching' : 'defense'
  const perfectA = categories.filter((c) => c.section === sectionA).every((c) => top3(c.key)) ? 200 : 0
  const perfectB = categories.filter((c) => c.section === sectionB).every((c) => top3(c.key)) ? 200 : 0
  return { allTop3, allFirst, perfectA, perfectB, total: allTop3 + allFirst + perfectA + perfectB }
}

// ── Time period ──────────────────────────────────────────────────────────

export function lineupTimeRange(time) {
  if (time.type === 'season') {
    const y = Number(time.value)
    return [y, y]
  }
  const start = Number(time.value.replace('s', ''))
  return [start, start + 9]
}

export function lineupScopeTimeLabel(scope, time) {
  return time.type === 'season' ? `${time.value} ${scope.value}` : `${scope.value} ${time.value}`
}

// ── Scope -> team codes ──────────────────────────────────────────────────

export function lineupTeamCodes(sport, scope) {
  if (sport === 'nfl') return nflTeamCodesForScope(scope.type, scope.value)
  if (sport === 'mlb') return mlbTeamCodesForScope(scope.type, scope.value)
  return nbaTeamCodesForScope(scope.type, scope.value)
}

/**
 * PostgREST's default response cap silently truncates a `.select()` to
 * 1,000 rows with no guaranteed order — a real, confirmed bug for MLB/NBA
 * Lineup: a single division over a decade routinely exceeds it (e.g. NL
 * East 2020s is 1,647 mlb_season_stats rows), so real players were
 * silently dropped from leaderboards depending on arbitrary row order
 * (caught live: Kyle Schwarber's 187 home runs across 2022-2025 missing
 * entirely from "2020s NL East" because his rows fell outside whatever
 * first-1,000 slice came back). Mobile's mlb_lineup_service.dart /
 * nba_lineup_service.dart have this exact same unpaginated fetch — this
 * is a real bug there too, not something introduced by this port — but
 * it's unambiguously wrong (mangles real leaderboards) rather than a
 * design choice, so it's fixed here rather than replicated. Pages through
 * in batches of 1,000 until a short page ends it, the same pattern the
 * NFL/MLB/NBA era-pool services already use for their own base queries.
 */
async function fetchAllRows(table, select, applyFilters) {
  const all = []
  const pageSize = 1000
  let from = 0
  while (true) {
    let q = supabase.from(table).select(select)
    if (applyFilters) q = applyFilters(q)
    const { data, error } = await q.range(from, from + pageSize - 1)
    if (error || !data) break
    all.push(...data)
    if (data.length < pageSize) break
    from += pageSize
  }
  return all
}

// ── Leaderboards ─────────────────────────────────────────────────────────

/**
 * NFL is aggregated server-side via the `lineup_top_leaders` RPC (SUM/GROUP BY
 * in Postgres), not fetched raw and summed client-side. MLB/NBA fetch raw
 * rows and sum client-side (matching mobile's architecture for those two
 * sports) but paginate through fetchAllRows above rather than trusting a
 * single `.select()` — see that function's comment for why.
 */
export async function getTopLeaders(sport, tables, category, scope, time, limit = 3) {
  const [start, end] = lineupTimeRange(time)
  const teamCodes = lineupTeamCodes(sport, scope)
  if (teamCodes.length === 0) return []

  if (sport === 'nfl') {
    const { data, error } = await supabase.rpc('lineup_top_leaders', {
      p_column: category.column,
      p_team_codes: teamCodes,
      p_season_start: start,
      p_season_end: end,
      p_limit: limit,
    })
    if (error || !data) return []
    return data.map((r) => ({ playerId: r.player_id, playerName: r.full_name || 'Unknown', total: r.total ?? 0 }))
  }

  const isPercent = category.agg === 'weightedPercent'
  const columns = isPercent ? `${category.column}, ${category.attemptColumn}` : category.column
  const playerRelation = tables.players === 'mlb_players' || tables.players === 'nba_players' ? tables.players : null
  const nameCols = category.modernOnly ? 'full_name, era_modern' : 'full_name'
  const data = await fetchAllRows(tables.seasonStats, `player_id, ${columns}, ${playerRelation}(${nameCols})`, (q) =>
    q.in('team', teamCodes).gte('season', start).lte('season', end)
  )

  const totals = new Map()
  const attempted = new Map()
  const names = new Map()
  for (const r of data) {
    const player = r[playerRelation]
    if (category.modernOnly && player?.era_modern !== true) continue
    const pid = r.player_id
    totals.set(pid, (totals.get(pid) || 0) + (r[category.column] ?? 0))
    if (isPercent) attempted.set(pid, (attempted.get(pid) || 0) + (r[category.attemptColumn] ?? 0))
    if (!names.has(pid)) names.set(pid, player?.full_name || 'Unknown')
  }

  let entries
  if (isPercent) {
    entries = [...totals.entries()]
      .filter(([pid]) => (attempted.get(pid) || 0) >= NBA_MIN_ATTEMPTS_FOR_PERCENT)
      .map(([pid, made]) => [pid, made / attempted.get(pid)])
  } else {
    entries = [...totals.entries()]
  }
  entries.sort((a, b) => b[1] - a[1])
  return entries.slice(0, limit).map(([playerId, total]) => ({ playerId, playerName: names.get(playerId) || 'Unknown', total }))
}

export async function playerWasInScope(sport, tables, playerId, scope, time) {
  const [start, end] = lineupTimeRange(time)
  const teamCodes = lineupTeamCodes(sport, scope)
  if (teamCodes.length === 0) return false
  const { data } = await supabase
    .from(tables.seasonStats)
    .select('id')
    .eq('player_id', playerId)
    .in('team', teamCodes)
    .gte('season', start)
    .lte('season', end)
    .limit(1)
  return (data || []).length > 0
}

export async function getPlayerTotal(sport, tables, category, scope, time, playerId) {
  const [start, end] = lineupTimeRange(time)
  const teamCodes = lineupTeamCodes(sport, scope)
  const isPercent = category.agg === 'weightedPercent'
  const columns = isPercent ? `${category.column}, ${category.attemptColumn}` : category.column
  const { data } = await supabase
    .from(tables.seasonStats)
    .select(columns)
    .eq('player_id', playerId)
    .in('team', teamCodes)
    .gte('season', start)
    .lte('season', end)
  let total = 0
  let attempted = 0
  for (const r of data || []) {
    total += r[category.column] ?? 0
    if (isPercent) attempted += r[category.attemptColumn] ?? 0
  }
  if (isPercent) return attempted > 0 ? total / attempted : 0
  return total
}

/** Full guess flow for one category: validate scope membership, then lock in a rank against the top 3. */
export async function submitCategoryGuess(sport, tables, { playerId, playerName, category, scope, time }) {
  const inScope = await playerWasInScope(sport, tables, playerId, scope, time)
  if (!inScope) return { guess: null, top3: [] }

  const top3 = await getTopLeaders(sport, tables, category, scope, time, 3)
  let rank = null
  let total = 0
  for (let i = 0; i < top3.length; i++) {
    if (top3[i].playerId === playerId) {
      rank = i + 1
      total = top3[i].total
      break
    }
  }
  if (rank === null) total = await getPlayerTotal(sport, tables, category, scope, time, playerId)
  return { guess: { playerId, playerName, rank, total, points: lineupPointsForRank(rank) }, top3 }
}

export function formatLineupTotal(category, total) {
  if (category.agg === 'weightedPercent') return `${(total * 100).toFixed(1)}%`
  return Math.round(total).toLocaleString()
}
