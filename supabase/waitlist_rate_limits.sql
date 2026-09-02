-- ── Per-IP rate limiting for the email waitlist signup ──────────────────────
-- Run this in the same Supabase project used by the Flutter app.
-- Written to only by the /api/waitlist serverless function using the
-- service role key, which bypasses RLS — no policies are needed (and none
-- are granted), so anon/authenticated clients have zero access to this table.

CREATE TABLE IF NOT EXISTS waitlist_rate_limits (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  ip_address TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS waitlist_rate_limits_ip_created_idx
  ON waitlist_rate_limits (ip_address, created_at);

ALTER TABLE waitlist_rate_limits ENABLE ROW LEVEL SECURITY;
-- No policies — only the service role (used server-side) can read/write.
