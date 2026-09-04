// Exact copy for each game's "How to Play" modal.
export const HOW_TO_PLAY = {
  'chirp-guess': {
    title: 'How to Play Chirp Guess 🎯',
    intro: 'Guess the mystery player in 8 guesses or fewer!',
    bullets: [
      'TEAM · CONFERENCE · DIVISION (or LEAGUE for MLB):\n🟩 Green = playing there RIGHT NOW\n🟨 Orange = played there previously in their career\n⬜ Grey = never played there',
      "HEIGHT · WEIGHT · JERSEY:\n🟩 Green = exact match\n🟨 Orange = very close\n⬜ Grey = not close\n↑ = mystery player is higher/taller\n↓ = mystery player is lower/shorter",
      'DRAFT ROUND:\n🟩 Green = same round\n🟨 Orange = one round off\n⬜ Grey = far apart\n↑ = drafted later\n↓ = drafted earlier',
      'POSITION:\n🟩 Green = same position\n🟨 Orange = same position group\n⬜ Grey = different position',
      'COLLEGE:\n🟩 Green = same college\n⬜ Grey = different college',
      'Fewer guesses = higher score!',
    ],
    scoring: 'Maximum score: 1000 pts',
  },
  'stat-line': {
    title: 'How to Play Stat Line 📊',
    intro: 'Identify the mystery player from their stats!',
    bullets: [
      "A mystery player's stats are revealed one at a time",
      'After each wrong guess a new stat clue is revealed',
      'Stats are shown in a grid. Position is shown at the top',
      'Skip to reveal the next clue — counts the same as a wrong guess',
      'Earlier correct guess = more points!',
    ],
    scoring: 'Clue 1 = 1000 pts\nClue 2 = 900 pts\n...and so on',
  },
  'career-builder': {
    title: 'How to Play Career Builder 🏗️',
    intro: 'Put the seasons in order!',
    bullets: [
      "5 seasons from a player's career are shown scrambled",
      'Drag and drop the cards to put them in chronological order from earliest to latest',
      'Submit your order to see how many you got right',
      "Bonus points for guessing the player's name!",
    ],
    scoring: '5 correct = 700 pts\n3 correct = 500 pts\nPlayer guess = +300 pts',
  },
  progression: {
    title: 'How to Play The Progression 📈',
    intro: "Watch the career unfold!",
    bullets: [
      "A player's career is revealed one season at a time starting from their rookie year",
      'Guess the player after seeing as few seasons as possible',
      'All previous seasons stay visible as new ones are revealed',
      'Earlier correct guess = more points!',
      'Normal mode: Shows team name\nHard mode: Stats only, no team',
    ],
    scoring: null,
  },
  'more-or-less': {
    title: 'How to Play More vs Less ⚡',
    intro: 'Who had more?',
    bullets: [
      'Two players are shown with a specific stat category',
      'Pick which player had MORE of that stat',
      'The winner carries forward to face a new challenger',
      'You have 3 lives. Wrong answer = lose a life',
      'Build your streak before running out of lives!',
    ],
    scoring: null,
  },
  lineup: {
    title: 'How to Play The Lineup 📋',
    intro: 'Fill in the stat leaders!',
    bullets: [
      'Find the top players for a team, division, or conference in a specific season or decade',
      'Search for a player for each statistical category',
      'Lock in your guess when ready — you cannot change it after!',
      'Top 3 leaders revealed after each locked guess',
    ],
    scoring: '1st place = 300 pts\n2nd place = 200 pts\n3rd place = 100 pts\n\nBonus points for getting all categories correct!',
  },
  grid: {
    title: 'How to Play Chirp Grid ⬛',
    intro: 'Fill the 3x3 grid!',
    bullets: [
      'Each square needs a player that fits BOTH the row AND column category',
      'Type a player name and select from the dropdown',
      'Each player can only be used once!',
      'Rarer picks score more points. Common picks score fewer points',
      'Try to find the most obscure players for maximum points!',
    ],
    scoring: null,
  },
}
