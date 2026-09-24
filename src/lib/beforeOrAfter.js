// "Before or After" — cross-sport daily game, same puzzle for every player
// regardless of the site's sport tab (unlike every other game here, this one
// isn't scoped by sport at all — see the pages/BeforeOrAfter.jsx comment for
// why it isn't wired into the global/group leaderboards yet).

import { supabase, todayStr } from './supabase'

export const TOTAL_QUESTIONS = 10
export const SECONDS_PER_QUESTION = 30

/** Today's 10 question pairs, same shape as chirp_sports' BeforeOrAfterService.getTodaysQuestions(). */
export async function getTodaysQuestions() {
  const { data, error } = await supabase
    .from('before_or_after_daily')
    .select(
      `
      question_number,
      correct_answer,
      event_a:event_a_id(id, description, year, sport, exact_date),
      event_b:event_b_id(id, description, year, sport, exact_date)
    `
    )
    .eq('game_date', todayStr())
    .order('question_number')
  if (error) throw error
  return data || []
}

/** Flat 1000 pts/correct, 0 wrong — max 10,000/day. */
export function scoreFor(correctCount) {
  return correctCount * 1000
}
