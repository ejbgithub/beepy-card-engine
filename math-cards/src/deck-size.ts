/**
 * Math Cards deck-size target (Milestone M2, Task 11; Decision 3; master spec
 * section 10).
 *
 * The competitive Math target of 24 unique answer cards (nine correct-answer
 * cards for the nine shared challenges plus fifteen distractors) is Math-specific,
 * so it lives here and not in the subject-neutral `shared-engine`. The shared
 * `planDeckSize` applies it: it returns a smaller validated deck when the
 * plausible answer range cannot support 24 values (never padding with implausible
 * distractors), down to the shared competitive minimum of 14 cards.
 *
 * Solitaire and Tutor have no 24-card target; their size is configurable.
 *
 * Scope (Task 11 only): constants and a thin wrapper. No expression or value
 * generation (a later task).
 */

import {
  DECK_MODES,
  planDeckSize,
  type DeckSizeAvailability,
  type DeckSizePlan,
} from '@beepy/shared-engine';

/** Competitive Math target: total unique answer cards, where feasible. */
export const MATH_COMPETITIVE_TARGET_CARD_COUNT = 24;
/** Of the 24: one correct-answer card per shared challenge. */
export const MATH_COMPETITIVE_CORRECT_CARDS = 9;
/** Of the 24: plausible distractors. */
export const MATH_COMPETITIVE_DISTRACTOR_CARDS = 15;

/**
 * Plan the competitive Math deck size from the counts of distinct plausible
 * values the Math generator can supply for the chosen difficulty.
 */
export function planMathCompetitiveDeckSize(
  availability: DeckSizeAvailability,
): DeckSizePlan {
  return planDeckSize(
    DECK_MODES.vsBeepy,
    MATH_COMPETITIVE_TARGET_CARD_COUNT,
    availability,
  );
}
