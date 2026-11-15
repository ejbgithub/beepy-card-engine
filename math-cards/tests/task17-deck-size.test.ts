/**
 * Task 17 - Math Cards deck-size tests (Req 7.1, 7.2; design D8; Decision 3).
 *
 *   competitive-math-deck-size-target            -> D8, master spec 10
 *   smaller-validated-deck-when-range-limited   -> D8, Req 6.4 (Math side)
 *
 * The 24-card competitive target (9 correct + 15 distractors) is Math-specific and
 * lives in math-cards. It is a MAXIMUM: a smaller validated deck is allowed.
 */

import { describe, expect, it } from 'vitest';
import {
  DECK_MODES,
  DECK_VALIDATION_CODES as C,
  checkDualHandFeasibility,
  planDeckSize,
  validateChallengeMapping,
  validateDeckSize,
  validateDualStartingHands,
  validateUniqueness,
} from '@beepy/shared-engine';
import {
  MATH_COMPETITIVE_CORRECT_CARDS,
  MATH_COMPETITIVE_DISTRACTOR_CARDS,
  MATH_COMPETITIVE_TARGET_CARD_COUNT,
  planMathCompetitiveDeckSize,
} from '../src/deck-size.js';
import { mathDeck, mathMatrix } from './helpers.js';

const availability = (availableCorrect: number, availableDistractors: number) => ({
  availableCorrect,
  availableDistractors,
});

describe('competitive-math-deck-size-target (D8)', () => {
  it('is 24 unique answer cards: nine correct plus fifteen distractors', () => {
    expect(MATH_COMPETITIVE_TARGET_CARD_COUNT).toBe(24);
    expect(MATH_COMPETITIVE_CORRECT_CARDS).toBe(9);
    expect(MATH_COMPETITIVE_DISTRACTOR_CARDS).toBe(15);
    expect(MATH_COMPETITIVE_CORRECT_CARDS + MATH_COMPETITIVE_DISTRACTOR_CARDS).toBe(MATH_COMPETITIVE_TARGET_CARD_COUNT);
  });

  it('plans exactly 24 cards when the plausible range allows it', () => {
    expect(planMathCompetitiveDeckSize(availability(9, 15))).toEqual({
      ok: true,
      cardCount: 24,
      correctCount: 9,
      distractorCount: 15,
      reduced: false,
    });
  });

  it('treats 24 as a maximum: a wider range still yields 24, never more', () => {
    for (const distractors of [16, 30, 100, 1000]) {
      expect(planMathCompetitiveDeckSize(availability(30, distractors))).toMatchObject({ ok: true, cardCount: 24, reduced: false });
    }
  });

  it('builds a 24-card deck that passes the whole competitive pipeline', () => {
    const deck = mathDeck(9, 15, MATH_COMPETITIVE_TARGET_CARD_COUNT);
    expect(deck.answerCards).toHaveLength(24);
    expect(validateDeckSize(deck, DECK_MODES.vsBeepy).ok).toBe(true);
    expect(validateChallengeMapping(deck, mathMatrix(deck)).ok).toBe(true);
    expect(validateUniqueness(deck, { numericAnswers: true }).ok).toBe(true);
    expect(checkDualHandFeasibility(deck).ok).toBe(true);
    const hands = [
      ['correct-0', 'correct-1', 'correct-2', 'distractor-0', 'distractor-1'],
      ['correct-3', 'correct-4', 'correct-5', 'distractor-2', 'distractor-3'],
    ] as const;
    expect(validateDualStartingHands(deck, [hands[0], hands[1]], { numericAnswers: true }).ok).toBe(true);
  });

  it('rejects an oversized competitive deck against the 24-card target', () => {
    const deck = mathDeck(9, 20, MATH_COMPETITIVE_TARGET_CARD_COUNT); // 29 cards
    expect(validateDeckSize(deck, DECK_MODES.vsBeepy).issues).toContainEqual(expect.objectContaining({ code: C.deckExceedsTarget }));
  });

  it('is the shared planner with the Math target, in competitive mode', () => {
    for (let distractors = 0; distractors <= 30; distractors += 1) {
      expect(planMathCompetitiveDeckSize(availability(9, distractors))).toEqual(
        planDeckSize(DECK_MODES.vsBeepy, 24, availability(9, distractors)),
      );
    }
  });

  it('does not bind Solitaire or Tutor to 24 cards', () => {
    expect(planDeckSize(DECK_MODES.solitaire, 12, availability(5, 9))).toMatchObject({ ok: true, cardCount: 12 });
    expect(planDeckSize(DECK_MODES.tutor, 8, availability(5, 9))).toMatchObject({ ok: true, cardCount: 8 });
  });
});

describe('smaller-validated-deck-when-range-limited, Math (D8, Req 6.4)', () => {
  // Distinct plausible values at each difficulty are illustrative counts, not spec facts.
  it.each([
    [10, 19],
    [8, 17],
    [7, 16],
    [5, 14],
  ])('with %i plausible distractors the deck is %i cards: smaller than 24 and not padded', (distractors, expected) => {
    const planned = planMathCompetitiveDeckSize(availability(9, distractors));
    if (!planned.ok) throw new Error('the plan should succeed');
    expect(planned).toMatchObject({ cardCount: expected, reduced: true, distractorCount: distractors });
    const deck = mathDeck(planned.correctCount, planned.distractorCount, 24);
    expect(validateDeckSize(deck, DECK_MODES.vsBeepy).ok).toBe(true);
    expect(validateChallengeMapping(deck, mathMatrix(deck)).ok).toBe(true);
    expect(validateUniqueness(deck, { numericAnswers: true }).ok).toBe(true);
    expect(checkDualHandFeasibility(deck).ok).toBe(true);
  });

  it('fails cleanly rather than padding when fewer than five distractors are plausible', () => {
    for (const distractors of [0, 1, 2, 3, 4]) {
      const planned = planMathCompetitiveDeckSize(availability(9, distractors));
      expect(planned.ok).toBe(false);
      if (!planned.ok) expect(planned.issue).toEqual(expect.objectContaining({ code: C.insufficientDeckData }));
    }
  });

  it('fails when fewer than nine distinct correct answers exist', () => {
    const planned = planMathCompetitiveDeckSize(availability(8, 40));
    expect(planned.ok).toBe(false);
    if (!planned.ok) expect(planned.issue).toEqual(expect.objectContaining({ code: C.insufficientDeckData, path: 'availability.availableCorrect' }));
  });

  it.each([NaN, -1, 1.5, Infinity])('rejects an invalid availability of %s', (bad) => {
    expect(planMathCompetitiveDeckSize(availability(bad, 15))).toMatchObject({ ok: false });
    expect(planMathCompetitiveDeckSize(availability(9, bad))).toMatchObject({ ok: false });
  });

  it('never plans more than 24 cards and never shrinks as more values become available', () => {
    let previous = -1;
    for (let distractors = 0; distractors <= 60; distractors += 1) {
      const planned = planMathCompetitiveDeckSize(availability(9, distractors));
      if (!planned.ok) continue;
      expect(planned.cardCount).toBeLessThanOrEqual(24);
      expect(planned.cardCount).toBeGreaterThanOrEqual(previous);
      previous = planned.cardCount;
    }
    expect(previous).toBe(24);
  });
});
