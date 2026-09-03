-- ── Groups fixes: creator tracking + empty-group cleanup ─────────────────────
-- Run this after web_groups.sql and web_groups_auth.sql.

-- Tracks who created a group, for the "max 3 groups created per Google
-- account" rate limit. Null for groups created by a guest (guests have no
-- stable server-side identity to enforce this against — see groups.js for
-- the client-side soft limit used instead).
ALTER TABLE web_groups ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- Lets the app delete a group once its last member leaves (Leave Group).
-- Scoped to empty groups only — this can never be used to delete a group
-- that still has members, regardless of who calls it.
DROP POLICY IF EXISTS "Anyone can delete an empty group" ON web_groups;
CREATE POLICY "Anyone can delete an empty group" ON web_groups
  FOR DELETE USING (
    NOT EXISTS (SELECT 1 FROM web_group_members WHERE group_id = web_groups.id)
  );
