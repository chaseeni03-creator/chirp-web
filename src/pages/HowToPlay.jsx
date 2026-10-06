import { Link } from 'react-router-dom'
import Seo from '../components/Seo'

const NUMBER_WORDS = ['Zero', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten']

const GAMES = [
  {
    id: 'chirp-guess',
    emoji: '🎯',
    name: 'Chirp Guess',
    path: '/guess',
    tagline: 'A Wordle-style guessing game built around real player attributes.',
    how: [
      "Every day, each sport gets its own mystery player. You get 8 guesses to find them. Type a real player's name and submit — you'll see a row of color-coded tiles comparing your guess to the mystery player across several attributes: Team, Conference, Division (League for MLB), Position, Height, Weight, Jersey Number, Draft Round, and College.",
      "Each tile has its own rules. Team, Conference, Division, and College are green when they match exactly and grey when they don't, except Team, Conference, and Division also turn orange if the mystery player has played there at some point in their career, even if it isn't their current team. Height, Weight, and Jersey Number turn green on an exact match, orange when you're close, and show an up or down arrow telling you which direction to move. Draft Round is green for an exact match, orange when you're one round off. Position is green for an exact match and orange when you guessed the right position group (for example, a guess of Cornerback against a mystery Safety still lights up orange, since both are defensive backs).",
    ],
    scoring: {
      summary: 'Score is based purely on how many guesses it takes you, using the formula 1000 − 100 × (guesses − 1), so:',
      table: [
        ['1st guess', '1,000 pts'],
        ['2nd guess', '900 pts'],
        ['3rd guess', '800 pts'],
        ['4th guess', '700 pts'],
        ['5th guess', '600 pts'],
        ['6th guess', '500 pts'],
        ['7th guess', '400 pts'],
        ['8th guess', '300 pts'],
      ],
      note: "There's no partial credit for a loss — if you use all 8 guesses without finding the mystery player, you score 0 for the day.",
    },
    tips: [
      "Open with a well-known player at the position you suspect — the Team/Conference/Division tiles alone usually cut the field dramatically, even on a wrong guess.",
      "Watch the arrows on Height, Weight, and Jersey closely. They tell you exactly which direction to move, so use your second and third guesses to zero in rather than guessing blind.",
      "An orange Division tile is a real clue, not a dead end — it means the mystery player has played there before, so think about who's changed teams recently within that division.",
      "Save a guess purely to test College only if you're already down to a short list — it's a hard green-or-grey tile with no partial credit to work with.",
    ],
  },
  {
    id: 'the-path',
    emoji: '🛤️',
    name: 'The Path',
    path: '/path',
    tagline: "Guess 5 real players from their career timeline alone — team stints and years, no name or position.",
    how: [
      "Every day brings 5 mystery players. For each one, you see their career laid out as a timeline of team stints and the years they played there — nothing else. No name, no position. You get 3 guesses per player via search.",
      "Two optional hints are available for each player: Show Stats reveals key career stats per team stint, and Show Position reveals their position. Using a hint locks in its score deduction immediately, whether or not you go on to guess correctly.",
      "A wrong guess costs you an attempt but no points. Only running out of all 3 guesses scores 0 for that player — guessing correctly on your 2nd or 3rd try scores the same as your 1st, as long as you haven't used any hints.",
    ],
    scoring: {
      summary: 'Each player starts at a 1,000-point ceiling. Hints cut into that ceiling the moment you use them:',
      table: [
        ['No hints', '1,000 pts'],
        ['Show Stats only', '500 pts'],
        ['Show Position only', '750 pts'],
        ['Both hints', '375 pts'],
      ],
      note: 'Max possible score is 5,000 pts/day (5 players × 1,000). Show Position always costs a quarter of whatever your score currently is, so using it after Show Stats costs less in raw points than using it first — but the final score (375) is the same either way.',
    },
    tips: [
      "The timeline alone is often enough for a well-traveled player — a distinctive sequence of teams and years can be more identifying than a single stat line.",
      "Save Show Position for when you're genuinely stuck between a few candidates — it's the cheaper of the two hints relative to what's left, but still a real chunk of your score.",
      "If the timeline doesn't ring a bell at all, Show Stats early is usually worth it — a strong season total narrows things fast, and half credit beats a wasted guess.",
    ],
  },
  {
    id: 'stat-line',
    emoji: '📊',
    name: 'Stat Line',
    path: '/statline',
    tagline: 'Identify a real player from their actual season stats, one clue at a time.',
    how: [
      "A mystery player's real single-season stat line is revealed to you one number at a time. Their position is shown immediately and never counts as a clue — everything else in the grid stays hidden until you either guess wrong or hit Skip, both of which reveal the next stat.",
      'How many clues you get, and which stats they are, depends on the position and sport. NFL quarterbacks get 11 clues; running backs, receivers, and defensive players get 9. MLB players get 10 clues. NBA players get 12. The earlier stats tend to be broad (team, games played), while later ones are usually the defining number for that player-season — a big touchdown total, a huge home run count, an efficient shooting line.',
    ],
    scoring: {
      summary: 'Every clue you skip or miss lowers your ceiling — the score table drops steadily from 1,000 points on the first clue down to a floor near 50–100 points on the last one, depending on the sport and position:',
      table: [
        ['NFL QB (11 clues)', '1,000 → 100'],
        ['NFL RB/WR/TE/DEF (9 clues)', '1,000 → 100'],
        ['MLB (10 clues)', '1,000 → 50'],
        ['NBA (12 clues)', '1,000 → 100'],
      ],
      note: 'Guess correctly the instant the first clue appears and you bank the full 1,000. Use every clue and guess right on the very last one, and you still get a small score rather than nothing.',
    },
    tips: [
      "Position alone narrows a huge amount — a mystery quarterback already rules out roughly 90% of the league's players before a single stat is shown.",
      "Team and Games Played are usually early, low-information clues. Don't guess off those alone unless you already have a strong hunch.",
      "For NFL and MLB, a standout counting stat (rushing yards, home runs, strikeouts) usually shows up mid-list and is often enough to guess correctly with several clues still unrevealed.",
      "Skipping is identical to guessing wrong for scoring purposes — there's no penalty for skipping specifically, so don't hesitate to skip a clue you have no read on instead of burning a guess.",
    ],
  },
  {
    id: 'career-builder',
    emoji: '🏗️',
    name: 'Career Builder',
    path: '/career',
    tagline: 'Reorder five scrambled seasons from a real career, then guess whose career it is.',
    how: [
      "Five real seasons from one player's career are shown to you scrambled out of order. Your job is to drag them back into chronological order, earliest season first. Once you're happy with the order, submit it — each card is graded green if it's in its exact correct slot, orange if it's one slot off from correct, or red if it's further off than that.",
      "After grading, you get one bonus shot at naming the player whose career you just reordered. It's optional, but skipping it means leaving real points on the table.",
    ],
    scoring: {
      summary: 'Order accuracy is scored by how many cards landed in their exact correct slot:',
      table: [
        ['5 exact', '700 pts'],
        ['3 exact', '500 pts'],
        ['2 exact', '300 pts'],
        ['1 exact', '150 pts'],
        ['0 exact', '50 pts'],
      ],
      note: 'A score of exactly 4 exact matches is mathematically impossible with 5 cards — if four are in the right slot, the fifth has nowhere else to go but its own correct slot too, making it 5. The optional bonus guess is worth a flat 300 points on top, for a possible 1,000 total.',
    },
    tips: [
      "Look for the shape of a career arc, not just raw stat size — a rookie season usually has lower counting stats than a peak season, even if the per-game rate looks similar.",
      "A team change is a strong ordering signal — trace which season likely came before or after a jump in team, since most players don't bounce back and forth.",
      "If you're unsure about the exact order but confident about which end is early and which is late, sort by those extremes first, then work the middle three — it's a far easier subproblem.",
      "Don't skip the bonus name guess even as a low-confidence stab — 300 points for one guess is one of the best point-to-effort ratios in any Chirp Sports game.",
    ],
  },
  {
    id: 'progression',
    emoji: '📈',
    name: 'The Progression',
    path: '/progression',
    tagline: "Watch a real career unfold season by season, and guess the player as early as you can.",
    how: [
      "A player's career is revealed one season at a time, starting with their rookie year. Every season you've already seen stays visible on screen as new ones get added below it, so you're building up a running picture of a real career in front of you.",
      'You can guess at any point. A wrong guess doesn\'t end the round — it just costs points and reveals the next season. Two modes change what you see each season: Normal mode shows the team name alongside the stats; Hard mode shows stats only, with no team to lean on.',
    ],
    scoring: {
      summary: 'The score ceiling starts at 1,000 points and drops evenly across the total number of seasons in that career as more get revealed, then loses another 50 points for every wrong guess along the way:',
      table: [
        ['Guess right after season 1', 'up to 1,000 pts'],
        ['Each additional season revealed', 'lower ceiling, split evenly across the career length'],
        ['Each wrong guess', '−50 pts'],
        ['Floor', '100 pts (never scores below this on a correct guess)'],
      ],
      note: "A short career (say, 4 seasons on file) drops in bigger jumps per season than a long one (say, 15 seasons) — so a career with fewer seasons on record punishes hesitation more per guess.",
    },
    tips: [
      "Rookie-season stats plus the team is often enough for a recognizable star — don't wait for a signature season if you already have a strong read.",
      "In Hard mode, pay attention to the statistical role (a pass-heavy line vs. a rushing-heavy line, for instance) since you can't lean on the team name at all.",
      "Resist guessing just to see if you're right — each wrong guess is a real 50-point penalty, so only guess when you're actually confident.",
      "A sudden change in stat production between two consecutive revealed seasons (an injury year, a role change, a late-career decline) is often the single most identifying clue in the whole career.",
    ],
  },
  {
    id: 'more-or-less',
    emoji: '⚡',
    name: 'More vs Less',
    path: '/moreorless',
    tagline: 'An endless head-to-head — pick who had more of a stat, and keep your streak alive as long as you can.',
    how: [
      "Two real players are shown side by side with one stat category between them — pick who you think had more. Whoever's right becomes (or stays) the champion and immediately faces a brand-new challenger on a freshly rolled stat category. This repeats endlessly; there's no daily puzzle here, no finish line, just how long you can keep your run going.",
      "You start with 3 lives. A wrong pick costs a life, and running out of lives ends your run. Get your streak to a multiple of 10 correct picks in a row and you earn a life back, up to a maximum of 5.",
    ],
    scoring: {
      summary: 'Every correct pick is worth points based on your current streak length, and a champion who keeps winning earns extra bonuses for surviving multiple challengers in a row:',
      table: [
        ['Streak of 1–4', '100 pts per correct pick'],
        ['Streak of 5–9', '200 pts per correct pick'],
        ['Streak of 10–14', '300 pts per correct pick'],
        ['Streak of 15–19', '400 pts per correct pick'],
        ['Streak of 20+', '500 pts per correct pick'],
        ['Champion survives 5 challengers', '+200 pts bonus'],
        ['Champion survives 10 challengers', '+500 pts bonus'],
        ['Champion survives 15 challengers', '+1,000 pts bonus'],
      ],
      note: 'The per-pick value scales with your whole run\'s streak, not just how long the current champion has survived — so a long personal streak makes every single pick worth more, on top of whatever bonus the champion themselves racks up.',
    },
    tips: [
      "Once your streak crosses a multiplier threshold (5, 10, 15, 20), every pick from then on is worth meaningfully more — protect a long streak like it's worth more than it looks, because it is.",
      "A champion who's already survived several challengers is close to a bonus payout at 5/10/15 wins — it's often correct to play a closer call more conservatively once you're near one of those thresholds.",
      "Career totals are usually a safer bet than single-season stats when you're unsure, since career numbers are less sensitive to one outlier year.",
      "If you don't recognize either player, lean toward whichever plays a position or era more associated with that specific stat category rather than guessing at random.",
    ],
  },
  {
    id: 'lineup',
    emoji: '📋',
    name: 'The Lineup',
    path: '/lineup',
    tagline: 'Fill in the real statistical leaders for a scope you pick — a team, a season, a decade, or an era.',
    how: [
      "Pick a scope — a specific team, a single season, a decade, or a broader era — and you'll get a set of statistical categories to fill in. NFL and MLB give you 9 categories each (split into two sections); NBA gives you 7. For each category, search for and select the player you think actually led that scope in that stat.",
      "Once you lock in a guess for a category, that's final — you can't change it. Locking in reveals the real top 3 leaders for that category immediately, so you'll know right away how close you were even before finishing the rest of the board.",
    ],
    scoring: {
      summary: 'Each category is scored independently based on where your pick actually ranked, with extra bonuses for a clean sweep:',
      table: [
        ['Your pick ranked #1', '300 pts'],
        ['Your pick ranked #2', '200 pts'],
        ['Your pick ranked #3', '100 pts'],
        ['NFL/MLB max base score', '2,700 pts (9 categories)'],
        ['NBA max base score', '2,100 pts (7 categories)'],
        ['Perfect sweep of a whole section (top 3 in every category)', 'bonus'],
        ['Every single category\'s #1 pick correct', '+1,000 pts bonus'],
      ],
      note: 'A wrong guess outside the top 3 for that category scores 0 for that square specifically — the rest of the board is unaffected, so one miss doesn\'t sink your run.',
    },
    tips: [
      "Lock in the categories you're most confident about first — since a locked guess can't be changed, there's no benefit to saving your surest picks for last.",
      "Narrower scopes (a single season, one team) reward specific knowledge of that exact window, not just who's generally famous at that stat — think about who was actually peaking in that particular year.",
      "Broader scopes (a full decade, an entire era) tend to reward era-defining players who sustained a category lead over a long stretch, rather than someone who had one huge outlier season.",
      "If you're torn between two plausible names for a category, remember the reveal shows the real top 3 — a runner-up guess (2nd or 3rd) still scores real points, so it's rarely worth leaving a category blank.",
    ],
  },
  // Chirp Grid is temporarily hidden site-wide (all sports) — known scoring/
  // gameplay issues under investigation (see games.js/groups.js/App.jsx for
  // the matching removal from Home, Leaderboard, Champions, Groups, and the
  // /grid route itself). Restore this section once the game is back.
  // {
  //   id: 'grid',
  //   emoji: '⬛',
  //   name: 'Chirp Grid',
  //   path: '/grid',
  //   tagline: 'A 3×3 grid where every square needs a real player who satisfies both its row and column.',
  //   how: [
  //     "You get a 3×3 grid with a category assigned to each row and each column — things like a team, a stat threshold, an award, or a career milestone. Every square is the intersection of one row category and one column category, and you need to name a real player who satisfies both at once.",
  //     "Type a name and pick from the search dropdown to fill a square. Each player can only be used once across the whole grid, so a name that fits two different squares still only gets to fill one of them.",
  //   ],
  //   scoring: {
  //     summary: 'Scoring is straightforward — every correct square is worth the same, with one bonus for clearing the whole board:',
  //     table: [
  //       ['Each correct square', '100 pts'],
  //       ['Perfect grid (9/9 correct)', '+500 pts bonus'],
  //       ['Maximum possible score', '1,400 pts'],
  //     ],
  //     note: 'There is no rarity bonus for an obscure pick over an obvious one here — a square filled with a household name scores exactly the same as one filled with a deep-cut role player, so accuracy is all that matters, not cleverness.',
  //   },
  //   tips: [
  //     "Solve your most confident square first, especially if the player you have in mind could plausibly fit a second square too — locking them in early avoids a conflict later where you need that name in two places at once.",
  //     "Work out the hardest-looking intersection early rather than last — if you can't find anyone for it, you'll want to know that before you've already used up your best candidates elsewhere on the grid.",
  //     "Career-spanning categories (a stat threshold, a milestone) usually have far more valid answers than single-season or single-team categories — save your most flexible squares for last, since you have the most options there.",
  //     "When two categories seem to point toward the same obvious star player, double check they actually satisfy BOTH conditions — it's an easy trap to assume a fit that doesn't quite hold up.",
  //   ],
  // },
]

export default function HowToPlay() {
  return (
    <div>
      <Seo
        title="How to Play"
        description="A complete guide to every Chirp Sports game — Chirp Guess, Stat Line, Career Builder, The Progression, More vs Less, and The Lineup. How each game works, exactly how scoring is calculated, and real tips for playing better."
      />

      <div className="mb-8 text-center">
        <h1 className="text-2xl font-black tracking-tight sm:text-3xl">
          How to Play <span className="text-[var(--color-primary)]">Chirp Sports</span>
        </h1>
        <p className="mx-auto mt-3 max-w-xl text-sm text-[var(--color-text-secondary)] sm:text-base">
          {NUMBER_WORDS[GAMES.length] ?? GAMES.length} daily sports games, built entirely on real stats — no trivia,
          no made-up questions. Here's exactly how each one works, exactly how scoring is calculated, and real tips
          for getting better at each.
        </p>
      </div>

      <nav
        aria-label="Jump to a game"
        className="mb-10 flex flex-wrap justify-center gap-2 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3"
      >
        {GAMES.map((g) => (
          <a
            key={g.id}
            href={`#${g.id}`}
            className="rounded-full border border-[var(--color-border)] bg-[var(--color-elevated)] px-3 py-1.5 text-xs font-bold text-[var(--color-text-secondary)] transition-colors hover:border-[var(--color-primary)]/50 hover:text-[var(--color-text)]"
          >
            {g.emoji} {g.name}
          </a>
        ))}
      </nav>

      <div className="space-y-10">
        {GAMES.map((g) => (
          <section
            key={g.id}
            id={g.id}
            className="scroll-mt-6 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 sm:p-7"
          >
            <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-xl font-extrabold sm:text-2xl">
                {g.emoji} {g.name}
              </h2>
              <Link
                to={g.path}
                className="rounded-full bg-[var(--color-primary)] px-4 py-1.5 text-xs font-bold text-white"
              >
                Play {g.name} →
              </Link>
            </div>
            <p className="mb-4 text-sm font-semibold text-[var(--color-text-secondary)]">{g.tagline}</p>

            <h3 className="mb-2 text-xs font-extrabold uppercase tracking-wide text-[var(--color-text-tertiary)]">
              How It Works
            </h3>
            <div className="space-y-3 text-sm leading-relaxed text-[var(--color-text-secondary)]">
              {g.how.map((p, i) => (
                <p key={i}>{p}</p>
              ))}
            </div>

            <h3 className="mb-2 mt-5 text-xs font-extrabold uppercase tracking-wide text-[var(--color-text-tertiary)]">
              Scoring
            </h3>
            <p className="mb-3 text-sm leading-relaxed text-[var(--color-text-secondary)]">{g.scoring.summary}</p>
            <div className="overflow-x-auto rounded-xl border border-[var(--color-border)]">
              <table className="w-full text-left text-sm">
                <tbody>
                  {g.scoring.table.map(([label, value], i) => (
                    <tr key={i} className={i % 2 === 0 ? 'bg-[var(--color-elevated)]' : ''}>
                      <td className="px-3 py-2 text-[var(--color-text-secondary)]">{label}</td>
                      <td className="px-3 py-2 text-right font-bold tabular-nums">{value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-xs leading-relaxed text-[var(--color-text-tertiary)]">{g.scoring.note}</p>

            <h3 className="mb-2 mt-5 text-xs font-extrabold uppercase tracking-wide text-[var(--color-text-tertiary)]">
              Tips
            </h3>
            <ul className="space-y-2 text-sm leading-relaxed text-[var(--color-text-secondary)]">
              {g.tips.map((t, i) => (
                <li key={i} className="flex gap-2">
                  <span className="mt-0.5 shrink-0 text-[var(--color-primary)]">•</span>
                  <span>{t}</span>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      <div className="mt-10 text-center">
        <Link
          to="/"
          className="inline-block rounded-full bg-[var(--color-primary)] px-6 py-3 text-sm font-bold text-white"
        >
          Play Today's Games →
        </Link>
      </div>
    </div>
  )
}
