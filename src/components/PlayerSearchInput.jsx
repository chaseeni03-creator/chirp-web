import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'

// Strip HTML/script tags before the query reaches Supabase.
function sanitizeQuery(raw) {
  return raw.replace(/<[^>]*>/g, '').trim()
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
      const { data } = await supabase
        .from(table)
        .select('id, full_name, position, current_team')
        .ilike('full_name', `%${cleaned}%`)
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
