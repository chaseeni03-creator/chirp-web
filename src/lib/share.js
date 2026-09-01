export const SITE_URL = 'playchirpsports.com'

function friendlyDate(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

/** tiles: array of 'correct' | 'close' | 'wrong' per guess, one row per guess. */
function tileRow(tiles) {
  return tiles.map((t) => (t === 'correct' ? '🟩' : t === 'close' ? '🟨' : '⬛')).join('')
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
      const { orderScore, maxOrderScore, guessedPlayer } = payload
      return `📈 Career Builder - ${date}\nOrder: ${orderScore}/${maxOrderScore}${
        guessedPlayer ? ' + player bonus!' : ''
      }\nPlay free at ${SITE_URL}`
    }
    case 'progression': {
      const { won, seasonsRevealed, difficulty } = payload
      return `⏩ The Progression (${difficulty}) - ${date}\n${
        won ? `Solved after ${seasonsRevealed} season${seasonsRevealed === 1 ? '' : 's'}!` : 'Not solved'
      }\nPlay free at ${SITE_URL}`
    }
    case 'more-or-less': {
      const { correctAnswers, bestStreak } = payload
      return `⚔️ More vs Less - ${date}\nScore: ${correctAnswers} · Best streak: 🔥${bestStreak}\nPlay free at ${SITE_URL}`
    }
    case 'lineup': {
      const { correctCount, total, totalScore } = payload
      return `📋 The Lineup - ${date}\n${correctCount}/${total} in the Top 3 · ${totalScore} pts\nPlay free at ${SITE_URL}`
    }
    case 'grid': {
      const { grid: cells, correctCount } = payload
      const gridRows = [0, 1, 2]
        .map((r) => [0, 1, 2].map((c) => (cells[r * 3 + c] ? '✅' : '❌')).join(''))
        .join('\n')
      return `🔢 Chirp Grid - ${date}\n${gridRows}\n${correctCount}/9 correct\nPlay free at ${SITE_URL}`
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
