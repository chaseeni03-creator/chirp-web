-- ── Email waitlist for the "mobile app coming soon" banner ──────────────────
-- Run this in the same Supabase project used by the Flutter app.
-- The web app has no accounts, so this table is written to anonymously via
-- the anon key — RLS allows public INSERT only, never SELECT (don't expose
-- collected emails to the client).

CREATE TABLE IF NOT EXISTS email_waitlist (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  source TEXT DEFAULT 'web',
  created_at TIMESTAMP DEFAULT NOW()
);

ALTER TABLE email_waitlist ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon can join waitlist" ON email_waitlist;
CREATE POLICY "anon can join waitlist" ON email_waitlist
  FOR INSERT WITH CHECK (true);

-- No SELECT policy on purpose — only admins reading via the Supabase
-- dashboard (or the service role key) can see collected emails.
