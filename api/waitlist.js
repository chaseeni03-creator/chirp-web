import { createClient } from '@supabase/supabase-js'

const MAX_ATTEMPTS_PER_HOUR = 3
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function getClientIp(req) {
  const fwd = req.headers['x-forwarded-for']
  if (typeof fwd === 'string' && fwd.length > 0) return fwd.split(',')[0].trim()
  return req.socket?.remoteAddress || 'unknown'
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const email = String(req.body?.email || '').trim().toLowerCase()
  if (!EMAIL_RE.test(email)) {
    res.status(400).json({ error: 'Invalid email address' })
    return
  }

  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
  const ip = getClientIp(req)
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()

  const { count, error: countErr } = await supabase
    .from('waitlist_rate_limits')
    .select('id', { count: 'exact', head: true })
    .eq('ip_address', ip)
    .gte('created_at', oneHourAgo)

  if (countErr) {
    res.status(500).json({ error: 'Something went wrong' })
    return
  }

  if ((count || 0) >= MAX_ATTEMPTS_PER_HOUR) {
    res.status(429).json({ error: 'Too many attempts. Try again later.' })
    return
  }

  await supabase.from('waitlist_rate_limits').insert({ ip_address: ip })

  // Existence check + insert happen server-side with the service role key
  // (bypassing RLS) specifically so the client never learns whether an
  // email was already on the list — the response is identical either way.
  const { data: existing } = await supabase
    .from('email_waitlist')
    .select('id')
    .eq('email', email)
    .maybeSingle()

  if (!existing) {
    await supabase.from('email_waitlist').insert({ email, source: 'web' })
  }

  res.status(200).json({ ok: true })
}
