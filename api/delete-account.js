import { createClient } from '@supabase/supabase-js'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '')
  if (!token) {
    res.status(401).json({ error: 'Not signed in' })
    return
  }

  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

  // Verifies the token server-side against Supabase Auth rather than trusting
  // a user id the client could send directly — this is the only way to
  // confirm "the caller really is this account" before deleting it.
  const { data: userData, error: userErr } = await supabase.auth.getUser(token)
  if (userErr || !userData?.user) {
    res.status(401).json({ error: 'Invalid session' })
    return
  }
  const userId = userData.user.id

  // web_group_scores rows cascade automatically via member_id's ON DELETE
  // CASCADE once the matching web_group_members rows are gone.
  const { error: memberErr } = await supabase.from('web_group_members').delete().eq('user_id', userId)
  if (memberErr) {
    res.status(500).json({ error: 'Could not delete your group data' })
    return
  }

  const { error: deleteErr } = await supabase.auth.admin.deleteUser(userId)
  if (deleteErr) {
    res.status(500).json({ error: 'Could not delete your account' })
    return
  }

  res.status(200).json({ ok: true })
}
