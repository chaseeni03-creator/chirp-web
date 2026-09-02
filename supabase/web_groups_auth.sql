-- ── Groups v2: Google Sign-In + guest PIN ────────────────────────────────────
-- Run this AFTER supabase/web_groups.sql (this ALTERs those tables in place,
-- it doesn't recreate them — any groups/scores already in production are
-- preserved).
--
-- Identity model: a member is EITHER a Google-authenticated user (user_id set,
-- is_guest = false, ownership enforced by real Supabase Auth via auth.uid())
-- OR a guest (user_id null, is_guest = true, "ownership" is only a 4-digit
-- PIN). Guests are not Supabase Auth users at all — there is no server-side
-- way to verify "this browser owns nickname X", so guest PIN checks and
-- guest-row deletes are enforced by the app, not by RLS, same trust level as
-- the rest of this anonymous-by-design feature (see web_groups.sql's header).

ALTER TABLE web_groups ADD COLUMN IF NOT EXISTS max_members INTEGER DEFAULT 20;

ALTER TABLE web_group_members ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE web_group_members ADD COLUMN IF NOT EXISTS pin_hash TEXT;
ALTER TABLE web_group_members ADD COLUMN IF NOT EXISTS is_guest BOOLEAN DEFAULT true;
-- Streak is computed live from web_group_scores (see src/lib/groups.js
-- computeStreak) rather than trusted as a client-maintained counter, so this
-- column is informational/unused by the app — kept only for schema parity
-- with the spec.
ALTER TABLE web_group_members ADD COLUMN IF NOT EXISTS streak INTEGER DEFAULT 0;

-- One nickname per group, whoever holds it — enforced by a real constraint
-- now instead of only the app checking-then-inserting.
ALTER TABLE web_group_members DROP CONSTRAINT IF EXISTS web_group_members_group_id_nickname_key;
ALTER TABLE web_group_members ADD CONSTRAINT web_group_members_group_id_nickname_key UNIQUE (group_id, nickname);

ALTER TABLE web_group_scores ADD COLUMN IF NOT EXISTS member_id UUID REFERENCES web_group_members(id) ON DELETE CASCADE;
-- Backfill member_id on any scores that predate this column, matching the
-- same (group_id, nickname) pairing the app already used to submit them.
UPDATE web_group_scores s
SET member_id = m.id
FROM web_group_members m
WHERE s.member_id IS NULL AND s.group_id = m.group_id AND s.nickname = m.nickname;

-- ── RLS: add auth-aware delete policies ──────────────────────────────────────
-- (SELECT/INSERT/UPDATE policies from web_groups.sql are unchanged and still
-- apply — this only adds DELETE, which didn't exist before.)

DROP POLICY IF EXISTS "Google users delete own membership" ON web_group_members;
CREATE POLICY "Google users delete own membership" ON web_group_members
  FOR DELETE USING (auth.uid() IS NOT NULL AND auth.uid() = user_id);

-- Guests have no verified server-side identity to check ownership against —
-- this is the same open-trust model as the rest of the table's policies.
DROP POLICY IF EXISTS "Guests can delete guest memberships" ON web_group_members;
CREATE POLICY "Guests can delete guest memberships" ON web_group_members
  FOR DELETE USING (is_guest = true);

DROP POLICY IF EXISTS "Google users delete own scores" ON web_group_scores;
CREATE POLICY "Google users delete own scores" ON web_group_scores
  FOR DELETE USING (
    auth.uid() IS NOT NULL
    AND EXISTS (SELECT 1 FROM web_group_members m WHERE m.id = web_group_scores.member_id AND m.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Guests can delete guest scores" ON web_group_scores;
CREATE POLICY "Guests can delete guest scores" ON web_group_scores
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM web_group_members m WHERE m.id = web_group_scores.member_id AND m.is_guest = true)
  );
