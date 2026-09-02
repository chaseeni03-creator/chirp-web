import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import Seo from '../components/Seo'
import { useGroup } from '../context/GroupContext'
import { joinGroup, normalizeCode, displayCode } from '../lib/groups'
import { supabase } from '../lib/supabase'

export default function JoinGroupPage() {
  const { code: rawCode } = useParams()
  const navigate = useNavigate()
  const { group, setGroup } = useGroup()
  const code = normalizeCode(rawCode)

  const [groupInfo, setGroupInfo] = useState(null)
  const [notFound, setNotFound] = useState(false)
  const [nickname, setNickname] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (group && group.code === code) {
      navigate('/groups')
      return
    }
    let cancelled = false
    supabase
      .from('web_groups')
      .select('group_name, group_code')
      .eq('group_code', code)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return
        if (data) setGroupInfo(data)
        else setNotFound(true)
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code])

  async function handleJoin(e) {
    e.preventDefault()
    if (!nickname.trim()) {
      setError('Enter a nickname first')
      return
    }
    setBusy(true)
    setError(null)
    try {
      const result = await joinGroup({ code, nickname })
      setGroup({ ...result, nickname: nickname.trim() })
      navigate('/groups')
    } catch (err) {
      setError(err.message || "Couldn't join that group")
    } finally {
      setBusy(false)
    }
  }

  if (notFound) {
    return (
      <div className="text-center">
        <Seo title="Group not found" />
        <p className="text-lg font-bold">That group code doesn't exist.</p>
        <p className="mt-1 text-sm text-[var(--color-text-secondary)]">Double check the invite link, or create your own group instead.</p>
      </div>
    )
  }

  if (!groupInfo) {
    return <p className="text-center text-[var(--color-text-secondary)]">Loading group…</p>
  }

  return (
    <div className="mx-auto max-w-sm">
      <Seo title={`Join ${groupInfo.group_name}`} />
      <h1 className="text-center text-xl font-extrabold">Join {groupInfo.group_name} 🦜</h1>
      <p className="mt-1 text-center text-sm text-[var(--color-text-secondary)]">Code: {displayCode(groupInfo.group_code)}</p>

      <form onSubmit={handleJoin} className="mt-6">
        <label className="mb-1 block text-xs font-bold text-[var(--color-text-tertiary)]">Your nickname</label>
        <input
          type="text"
          autoFocus
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          maxLength={24}
          placeholder="e.g. Chase"
          className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-elevated)] px-4 py-3 text-sm outline-none focus:border-[var(--color-primary)]"
        />
        {error && <p className="mt-2 text-center text-xs text-[var(--color-primary)]">{error}</p>}
        <button type="submit" disabled={busy} className="mt-4 w-full rounded-xl bg-[var(--color-primary)] py-3 text-sm font-bold text-white disabled:opacity-50">
          {busy ? 'Joining…' : 'Join Group'}
        </button>
      </form>
    </div>
  )
}
