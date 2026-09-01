# Chirp Sports — Web

The games-only website for Chirp Sports, at [playchirpsports.com](https://playchirpsports.com).

This is a **separate project** from the Flutter mobile app (`chirp_sports`), but reads from the
**same Supabase database** — daily puzzles are scheduled from the Flutter admin panel and this
site just plays them. There is no social feed, no DMs, no profiles, and no accounts here: every
game is anonymous and playable by anyone, with progress/streaks kept in the browser's
`localStorage` only.

## Stack

- React + Vite
- Tailwind CSS v4
- `@supabase/supabase-js` (anon key, read-only against the shared schema + one write: the email waitlist)
- Deployed on Vercel

## Setup

```bash
npm install
cp .env.example .env.local   # then fill in the two values below
npm run dev
```

`.env.local` needs:

```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-public-key
```

Use the **same** project URL/anon key as the Flutter app (Supabase dashboard → Settings → API).
The anon key is safe to ship in a client bundle — it's what Row Level Security exists to gate.

## Database

Run `supabase/email_waitlist.sql` once in the Supabase SQL editor — it's the only table this app
needs that doesn't already exist for the Flutter app. Everything else (`nfl_players`,
`nfl_career_stats`, `nfl_season_stats`, `*_daily` schedule tables, `grid_game_schedule`,
`who_had_more_scores`) is read-only here and already has public SELECT policies from the mobile
app's migrations.

## Why no server-side scores

Every results/score table in this schema (`career_builder_results`, `progression_results`,
`who_had_more_scores`, `grid_game_guesses`, etc.) has an RLS policy requiring
`auth.uid() = user_id` — i.e. a logged-in user. Since this site deliberately has no accounts,
it can't write to any of them. Streaks, "completed today," and share text are all computed and
stored client-side (`src/lib/storage.js`, `localStorage`) instead. This also means Chirp Grid's
"rarity" numbers reflect real picks from mobile app users but web plays don't add to that counter.

## Known simplifications vs. the mobile app

- **Career Builder**'s "5 interesting seasons" selection and **The Progression**'s season set are
  reasonable approximations of the Flutter admin's curation logic, not a byte-for-byte port —
  both filter out all-zero-stat seasons and pick first/last/peak/spread seasons.
- **More vs Less** generates matchups by randomly sampling same-position-group players within the
  chosen era and comparing one career stat, rather than reusing the Flutter app's exact matchup
  generator.
- **Chirp Grid**'s category validator covers `team`, `position`, `college`, `draftRound`,
  `division`, and `era` categories exactly as the Flutter admin defines them. The `stat` category
  (e.g. "1,000+ rushing yards in a season") is matched with a best-effort keyword guess rather
  than the admin's exact preset table, since that table lives only in the Flutter codebase. If you
  schedule `stat`-type grid squares, double check them on web before relying on the result.
- Drag-and-drop in Career Builder uses ▲/▼ buttons instead of native HTML5 drag events, so
  reordering works reliably on mobile touchscreens too.

## Deployment (Vercel)

1. Push this repo to GitHub.
2. Import it in Vercel.
3. Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` as Environment Variables in the Vercel
   project settings (same values as `.env.local`).
4. Point `playchirpsports.com` at the Vercel project (Domains tab).

`vercel.json` already configures the SPA rewrite so client-side routes like `/statline` work on
refresh/direct link.

## Project structure

```
src/
  lib/          Supabase client, localStorage helpers, share-text builder
  data/         Static game catalog (name/emoji/route per game)
  components/   Shared UI: header, waitlist footer, game card, player search, share box
  pages/        Home + one page per game
```
