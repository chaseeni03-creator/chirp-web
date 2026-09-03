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

/** Autocomplete text input searching the given players table by name. Calls onSelect(player) on pick. */
export default function PlayerSearchInput({ table, onSelect, placeholder = 'Search player…', disabled }) {
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
      const { data } = await supabase
        .from(table)
        .select('id, full_name, position, current_team')
        .ilike('full_name', `%${pattern}%`)
        .order('full_name')
        .limit(8)
      if (!cancelled) setResults(data || [])
    }, 200)
    return () => {
      cancelled = true
      clearTimeout(t)
    }
  }, [query, table])

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
              className="flex w-full items-center justify-between px-4 py-2.5 text-left text-sm hover:bg-[var(--color-elevated)]"
            >
              <span className="font-medium">{p.full_name}</span>
              <span className="text-xs text-[var(--color-text-secondary)]">
                {p.position} {p.current_team ? `· ${p.current_team}` : ''}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
