-- ── Groups feature (play-with-friends leaderboards) ─────────────────────────
-- Run this in the same Supabase project used by the Flutter app.
-- No accounts on the web app — group_code + nickname is the entire identity
-- model (same anonymous-by-design pattern as email_waitlist), so RLS is
-- deliberately wide open (public read/insert) exactly as requested. This is
-- a casual friend-group feature, not a security boundary: nicknames aren't
-- unique per group and anyone with a code can post scores under any name.

CREATE TABLE IF NOT EXISTS web_groups (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  group_code TEXT UNIQUE NOT NULL, -- short code, e.g. "4829" or "K2MN" (displayed as "CHIRP-4829")
  group_name TEXT NOT NULL,
  is_public BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  member_count INTEGER DEFAULT 1 -- informational only; actual counts/caps are computed live from web_group_members
);

CREATE TABLE IF NOT EXISTS web_group_members (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id UUID REFERENCES web_groups(id) ON DELETE CASCADE,
  nickname TEXT NOT NULL,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  last_active TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS web_group_scores (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id UUID REFERENCES web_groups(id) ON DELETE CASCADE,
  nickname TEXT NOT NULL,
  game_type TEXT NOT NULL,
  sport TEXT NOT NULL,
  era TEXT DEFAULT 'all_time',
  score INTEGER NOT NULL,
  details TEXT,
  game_date DATE DEFAULT CURRENT_DATE,
  submitted_at TIMESTAMPTZ DEFAULT NOW(),
  -- era is part of the uniqueness on purpose: "best era wins" requires
  -- storing one row per era a person plays that day, not just one row per
  -- game/sport/day, so their best score across eras can be MAX()'d.
  UNIQUE(group_id, nickname, game_type, sport, game_date, era)
);

CREATE INDEX IF NOT EXISTS web_group_scores_group_date_idx
  ON web_group_scores (group_id, game_date);

ALTER TABLE web_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE web_group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE web_group_scores ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read" ON web_groups;
CREATE POLICY "Allow public read" ON web_groups FOR SELECT USING (true);
DROP POLICY IF EXISTS "Allow public insert" ON web_groups;
CREATE POLICY "Allow public insert" ON web_groups FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public read" ON web_group_members;
CREATE POLICY "Allow public read" ON web_group_members FOR SELECT USING (true);
DROP POLICY IF EXISTS "Allow public insert" ON web_group_members;
CREATE POLICY "Allow public insert" ON web_group_members FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public read" ON web_group_scores;
CREATE POLICY "Allow public read" ON web_group_scores FOR SELECT USING (true);
DROP POLICY IF EXISTS "Allow public insert" ON web_group_scores;
CREATE POLICY "Allow public insert" ON web_group_scores FOR INSERT WITH CHECK (true);
-- Scores are upserted (onConflict = the UNIQUE above) when a member replays
-- an era, so anon also needs UPDATE here — insert-only would make the
-- upsert's update half fail once the row already exists.
DROP POLICY IF EXISTS "Allow public update" ON web_group_scores;
CREATE POLICY "Allow public update" ON web_group_scores FOR UPDATE USING (true) WITH CHECK (true);

-- Realtime: enable postgres_changes broadcasts for the leaderboard subscription.
-- Wrapped so re-running this script doesn't error once the table's already added.
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE web_group_scores;
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;
