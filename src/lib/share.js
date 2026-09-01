import { LINEUP_CATEGORIES } from './lineup'

export const SITE_URL = 'playchirpsports.com'

function friendlyDate(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

/** tiles: array of { color: 'green'|'orange'|'grey' } per guess, one row per guess. */
function tileRow(tiles) {
  return tiles.map((t) => (t.color === 'green' ? '🟩' : t.color === 'orange' ? '🟨' : '⬛')).join('')
}

export function buildShareText(gameKey, dateStr, payload) {
  const date = friendlyDate(dateStr)
  switch (gameKey) {
    case 'chirp-guess': {
      const { rows, won, guessCount, maxGuesses } = payload
      const grid = rows.map(tileRow).join('\n')
      return `🐦 Chirp Guess - ${date}\n${grid}\n${
        won ? `Solved in ${guessCount}/${maxGuesses}!` : `X/${maxGuesses}`
      }\nPlay free at ${SITE_URL}`
    }
    case 'stat-line': {
      const { won, cluesUsed, maxClues } = payload
      return `📊 Stat Line - ${date}\n${won ? `Solved in ${cluesUsed}/${maxClues} clues!` : `X/${maxClues}`}\nPlay free at ${SITE_URL}`
    }
    case 'career-builder': {
      const { grades, greenCount, bonusAttempted, bonusCorrect, totalScore } = payload
      const gradeEmoji = { green: '🟩', orange: '🟧', red: '🟥' }
      const order = grades.map((g) => gradeEmoji[g]).join('')
      const bonus = !bonusAttempted ? '⏭️ Skipped' : bonusCorrect ? '✅ Got it!' : '❌ Missed'
      return `📈 Career Builder - ${date}\nOrder: ${order} ${greenCount}/5 correct\nPlayer guess: ${bonus}\nScore: ${totalScore}/1000\nPlay free at ${SITE_URL}`
    }
    case 'progression': {
      const { sport, guessedCorrectly, seasonsRevealed, wrongGuesses, finalScore, difficultyLabel } = payload
      const result = guessedCorrectly
        ? `Guessed after Year ${seasonsRevealed}!`
        : `Didn't guess it — revealed all ${seasonsRevealed} years`
      const emoji = sport === 'mlb' ? '⚾' : sport === 'nba' ? '🏀' : '🐦🏈'
      const title = sport === 'mlb' ? 'MLB The Progression' : sport === 'nba' ? 'NBA The Progression' : 'The Progression'
      const modeLine = sport === 'nfl' ? `Mode: ${difficultyLabel} 📈\n` : ''
      return `${title} - ${date}\n${modeLine}${result}\nWrong guesses: ${wrongGuesses}\nScore: ${finalScore}/1000 ${emoji}\nCan you beat me?`
    }
    case 'more-or-less': {
      const { correctAnswers, bestStreak } = payload
      return `⚔️ More vs Less - ${date}\nScore: ${correctAnswers} · Best streak: 🔥${bestStreak}\nPlay free at ${SITE_URL}`
    }
    case 'lineup': {
      const { sport, scopeLabel, guessesByKey, totalScore, maxScore } = payload
      const lineupMedal = (rank) => (rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : '⬜')
      const categories = LINEUP_CATEGORIES[sport]
      const line = (c) => {
        const g = guessesByKey[c.key]
        const name = g?.rank != null ? g.playerName : 'Missed'
        return `${c.shareLabel}: ${lineupMedal(g?.rank)} ${name} (+${g?.points ?? 0})`
      }
      const scoreStr = totalScore.toLocaleString()
      if (sport === 'nba') {
        return `NBA The Lineup - ${date}\n${scopeLabel}\n\n${categories.map(line).join('\n')}\n\nScore: ${scoreStr}/${maxScore} 🏀`
      }
      const sectionAKey = sport === 'mlb' ? 'batting' : 'offense'
      const sectionBKey = sport === 'mlb' ? 'pitching' : 'defense'
      const sectionALabel = sport === 'mlb' ? 'BATTING' : 'OFFENSE'
      const sectionBLabel = sport === 'mlb' ? 'PITCHING' : 'DEFENSE'
      const a = categories.filter((c) => c.section === sectionAKey).map(line).join('\n')
      const b = categories.filter((c) => c.section === sectionBKey).map(line).join('\n')
      const title = sport === 'mlb' ? 'MLB The Lineup' : 'The Lineup'
      const emoji = sport === 'mlb' ? '⚾' : '🐦🏈'
      return `${title} - ${date}\n${scopeLabel}\n\n${sectionALabel}:\n${a}\n\n${sectionBLabel}:\n${b}\n\nScore: ${scoreStr}/${maxScore} ${emoji}`
    }
    case 'grid': {
      const { sport, grid: cells, totalScore } = payload
      const gridRows = [0, 1, 2].map((r) => [0, 1, 2].map((c) => (cells[r * 3 + c] ? '✅' : '❌')).join('')).join('\n')
      const emoji = sport === 'mlb' ? '⚾' : sport === 'nba' ? '🏀' : '🐦🏈'
      const title = sport === 'mlb' ? 'MLB Chirp Grid' : sport === 'nba' ? 'NBA Chirp Grid' : 'Chirp Grid'
      return `${title} - ${date}\n9/9 squares filled ${emoji}\n${gridRows}\nScore: ${totalScore} points`
    }
    default:
      return `Chirp Sports - ${date}\nPlay free at ${SITE_URL}`
  }
}

export async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}
