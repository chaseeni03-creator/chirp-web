import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'

// Strip HTML/script tags before the query reaches Supabase.
function sanitizeQuery(raw) {
  return raw.replace(/<[^>]*>/g, '').trim()
}

// "T.J. Watt" / "D.J. Moore" / "C.J. Stroud" typed as "tj watt" / "dj moore"
// / "cj stroud" should still find the real player. Postgres ilike can't
// strip punctuation from the stored column, so a bare 2-letter word that
// looks like initials (tj, dj, cj, oj, aj — every real example is exactly
// 2 letters) gets a wildcard inserted between its letters: "tj" becomes
// "t%j%", which still matches a plain "tj" (the wildcard can match zero
// characters) but now also matches "t.j." via backtracking. This is
// deliberately scoped to short 2-letter tokens only — doing this to every
// word (tried first) also loosened normal surnames like "Watt" into
// matching unrelated look-alikes ("Wyatt", "Swancutt") that then crowded
// the real result out of the top 8 once sorted alphabetically.
function looksLikeInitials(word) {
  return /^[a-zA-Z]{2}$/.test(word)
}

function toIlikeToken(word) {
  // A trailing % too, not just between the two letters — "T.J." has a
  // period after BOTH letters, so "tj" must become "t%j%" (wildcard after
  // each), not "t%j" (wildcard only between them, missing the one that
  // needs to absorb the period right before the following space).
  return looksLikeInitials(word) ? `${word.split('').join('%')}%` : word
}

function buildSearchPattern(cleaned) {
  return cleaned
    .split(/\s+/)
    .filter(Boolean)
    .map(toIlikeToken)
    .join(' ')
}

// Sport-specific ranking-signal columns — NFL tracks Pro Bowl selections,
// MLB/NBA track All-Star selections instead, and only NFL/NBA have a
// normal_mode_eligible flag (MLB's closest equivalent is who_had_more_normal,
// computed for a different game but the same "recognizable player" idea).
const RANK_COLUMNS = {
  nfl_players: { fame: 'pro_bowl_selections', eligible: 'normal_mode_eligible' },
  mlb_players: { fame: 'all_star_selections', eligible: 'who_had_more_normal' },
  nba_players: { fame: 'all_star_selections', eligible: 'normal_mode_eligible' },
}

function rankColumnsFor(table) {
  return RANK_COLUMNS[table] ?? { fame: null, eligible: null }
}

/**
 * Ordered exactly per spec: name-starts-with first, then active players,
 * then normal-mode-eligible/recognizable players, then a combined fame
 * score (Hall of Fame + Pro Bowl/All-Star selections), then most recently
 * active. Only the ordering changes here — the underlying ilike filter
 * (buildSearchPattern) still decides which players match at all.
 */
function rankPlayers(players, cleanedQuery, rankCols) {
  const q = cleanedQuery.toLowerCase()
  const nameMatchRank = (p) => (p.full_name?.toLowerCase().startsWith(q) ? 0 : 1)
  const fameScore = (p) => (p.is_hall_of_fame ? 1000 : 0) + (rankCols.fame ? (p[rankCols.fame] ?? 0) : 0) * 10
  return [...players].sort((a, b) => {
    const nameDiff = nameMatchRank(a) - nameMatchRank(b)
    if (nameDiff !== 0) return nameDiff
    const activeDiff = (b.is_active ? 1 : 0) - (a.is_active ? 1 : 0)
    if (activeDiff !== 0) return activeDiff
    if (rankCols.eligible) {
      const eligibleDiff = (b[rankCols.eligible] ? 1 : 0) - (a[rankCols.eligible] ? 1 : 0)
      if (eligibleDiff !== 0) return eligibleDiff
    }
    const fameDiff = fameScore(b) - fameScore(a)
    if (fameDiff !== 0) return fameDiff
    return (b.season_last ?? 0) - (a.season_last ?? 0)
  })
}

function yearsActiveLabel(p) {
  if (p.season_first == null) return null
  return `${p.season_first}-${p.is_active ? 'Present' : p.season_last ?? p.season_first}`
}

/**
 * Autocomplete text input searching the given players table by name. Calls
 * onSelect(player) on pick. Pass activeOnly for a game whose mystery player
 * is always a current player (NFL Chirp Guess) so the guess box can't
 * suggest a retired one — every other game/sport leaves this off since they
 * intentionally draw from a player's whole career.
 */
export default function PlayerSearchInput({ table, onSelect, placeholder = 'Search player…', disabled, activeOnly = false }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [open, setOpen] = useState(false)
  const boxRef = useRef(null)

  useEffect(() => {
    const cleaned = sanitizeQuery(query)
    if (cleaned.length < 2) {
      setResults([])
      return
    }
    let cancelled = false
    const t = setTimeout(async () => {
      const pattern = buildSearchPattern(cleaned)
      const rankCols = rankColumnsFor(table)
      const rankSelectCols = [rankCols.fame, rankCols.eligible].filter(Boolean)
      const selectCols = [
        'id', 'full_name', 'position', 'current_team', 'is_active', 'season_first', 'season_last', 'is_hall_of_fame',
        ...rankSelectCols,
      ].join(', ')
      let q = supabase
        .from(table)
        .select(selectCols)
        .ilike('full_name', `%${pattern}%`)
      if (activeOnly) q = q.eq('is_active', true)
      // Order server-side by fame BEFORE truncating — a common first/last
      // name (e.g. "Brady") can easily have 50+ matches, and without this,
      // an arbitrary/unordered LIMIT could cut the pool off before a truly
      // famous player (Tom Brady) is ever fetched at all, leaving the
      // client-side ranking below nothing to promote. This is a coarse
      // pre-filter, not the final order — rankPlayers still does the real,
      // precise sort (name-match-rank first, etc.) on whatever survives.
      q = q.order('is_hall_of_fame', { ascending: false, nullsFirst: false })
      if (rankCols.fame) q = q.order(rankCols.fame, { ascending: false, nullsFirst: false })
      const { data } = await q.limit(50)
      if (!cancelled) setResults(rankPlayers(data || [], cleaned, rankCols).slice(0, 8))
    }, 300)
    return () => {
      cancelled = true
      clearTimeout(t)
    }
  }, [query, table, activeOnly])

  useEffect(() => {
    function onClickOutside(e) {
      if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  function pick(player) {
    onSelect(player)
    setQuery('')
    setResults([])
    setOpen(false)
  }

  return (
    <div ref={boxRef} className="relative">
      <input
        type="text"
        value={query}
        disabled={disabled}
        onChange={(e) => {
          setQuery(e.target.value)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        placeholder={placeholder}
        className="w-full min-w-0 rounded-xl border border-[var(--color-border)] bg-[var(--color-elevated)] px-2.5 py-2.5 text-xs text-[var(--color-text)] placeholder-[var(--color-text-tertiary)] outline-none focus:border-[var(--color-primary)] disabled:opacity-50 sm:px-4 sm:py-3 sm:text-sm"
      />
      {open && results.length > 0 && (
        <div className="absolute z-10 mt-1 w-full overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-xl">
          {results.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => pick(p)}
              className="flex w-full flex-col items-start gap-0.5 px-4 py-2.5 text-left text-sm hover:bg-[var(--color-elevated)]"
            >
              <span className="font-medium">{p.full_name}</span>
              <span className="text-xs text-[var(--color-text-secondary)]">
                {[p.position, p.current_team, yearsActiveLabel(p)].filter(Boolean).join(' · ')}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
