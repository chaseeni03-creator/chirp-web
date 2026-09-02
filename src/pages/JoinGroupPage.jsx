import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import Seo from '../components/Seo'
import GroupOnboarding from '../components/GroupOnboarding'
import { useGroup } from '../context/GroupContext'
import { normalizeCode, displayCode } from '../lib/groups'
import { supabase } from '../lib/supabase'

export default function JoinGroupPage() {
  const { code: rawCode } = useParams()
  const navigate = useNavigate()
  const { user } = useGroup()
  const code = normalizeCode(rawCode)

  const [groupInfo, setGroupInfo] = useState(null)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    if (user?.groups?.some((g) => g.code === code)) {
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
      <p className="mb-4 text-center text-sm text-[var(--color-text-secondary)]">
        Joining <span className="font-bold text-[var(--color-text)]">{groupInfo.group_name}</span> · {displayCode(groupInfo.group_code)}
      </p>
      <GroupOnboarding prefillCode={code} onDone={() => navigate('/groups')} />
    </div>
  )
}
