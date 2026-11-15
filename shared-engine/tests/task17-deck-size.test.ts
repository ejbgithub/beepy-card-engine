/**
 * Task 17 - Deck-size tests (Req 7.1, 7.2; design D8; Decision 3).
 *
 *   competitive-math-deck-size-target            -> D8 (the Math-specific 24-card
 *                                                   target is in math-cards/tests)
 *   smaller-validated-deck-when-range-limited   -> D8, Req 6.4
 *
 * These are the subject-neutral rules. A reduced deck produced by the planner is
 * built with the fixtures and must pass the WHOLE validation pipeline, for all four
 * (app style, generation direction) combinations.
 */

import { describe, expect, it } from 'vitest';
import {
  COMPETITIVE_CHALLENGE_COUNT,
  COMPETITIVE_MIN_CARD_COUNT,
  DECK_MODES,
  DECK_VALIDATION_CODES as C,
  SOLITAIRE_CHALLENGE_COUNT,
  checkDualHandFeasibility,
  expectedChallengeCount,
  handCountForMode,
  isDeckMode,
  minimumDistractors,
  planDeckSize,
  validateChallengeMapping,
  validateDeckSize,
  validateDualStartingHands,
  validateStartingHand,
  validateUniqueness,
  type DeckMode,
} from '../src/index.js';
import { COMBOS, buildDeck, cloneDeck, fullMatrix, isNumericStyle } from './fixtures.js';

const issue = (code: string, path?: string) =>
  expect.objectContaining(path === undefined ? { code } : { code, path });

const MODES: readonly DeckMode[] = ['solitaire', 'tutor', 'vsBeepy'];
const plan = (mode: DeckMode, target: number, availableCorrect: number, availableDistractors: number) =>
  planDeckSize(mode, target, { availableCorrect, availableDistractors });

describe('modes and bounds (Decision 3)', () => {
  it('uses the stable mode ids from master spec 3 (vsPlayer has no approved deck rules)', () => {
    expect(DECK_MODES).toEqual({ solitaire: 'solitaire', tutor: 'tutor', vsBeepy: 'vsBeepy' });
    expect(isDeckMode('vsPlayer')).toBe(false);
  });

  it('Solitaire and Tutor show 5 challenges and deal 1 hand; vs Beepy shows 9 and deals 2', () => {
    expect([SOLITAIRE_CHALLENGE_COUNT, COMPETITIVE_CHALLENGE_COUNT]).toEqual([5, 9]);
    expect(MODES.map(expectedChallengeCount)).toEqual([5, 5, 9]);
    expect(MODES.map(handCountForMode)).toEqual([1, 1, 2]);
  });

  it('the competitive minimum of 14 is 9 correct cards plus the fewest distractors that two hands and a reserve need', () => {
    expect(COMPETITIVE_MIN_CARD_COUNT).toBe(14);
    expect(minimumDistractors(9, 2, 1)).toBe(5);
    expect(COMPETITIVE_MIN_CARD_COUNT).toBe(9 + (minimumDistractors(9, 2, 1) ?? Number.NaN));
  });

  it('Solitaire needs at least 3 distractors beyond its 5 correct cards', () => {
    expect(minimumDistractors(5, 1, 1)).toBe(3);
  });

  it('cannot be satisfied with fewer than two correct cards per hand', () => {
    expect(minimumDistractors(1, 1, 1)).toBeUndefined();
    expect(minimumDistractors(3, 2, 1)).toBeUndefined();
  });

  it.each([NaN, -1, 1.5, Infinity])('minimumDistractors rejects the invalid number %s', (bad) => {
    expect(minimumDistractors(bad, 1, 1)).toBeUndefined();
    expect(minimumDistractors(5, bad, 1)).toBeUndefined();
    expect(minimumDistractors(5, 1, bad)).toBeUndefined();
  });
});

describe('invalid modes are rejected explicitly, never treated as Solitaire', () => {
  it.each(['vsPlayer', 'Solitaire', '', 'solitaire ', undefined, null, 42, {}])('rejects %j', (bad) => {
    expect(isDeckMode(bad)).toBe(false);
    const deck = buildDeck({ style: 'math', correct: 5, distractors: 8 });
    const validated = validateDeckSize(deck, bad as DeckMode);
    expect(validated.ok).toBe(false);
    expect(validated.issues).toEqual([issue(C.invalidMode, 'mode')]);
    const planned = plan(bad as DeckMode, 24, 9, 15);
    expect(planned.ok).toBe(false);
    if (!planned.ok) expect(planned.issue).toEqual(issue(C.invalidMode, 'mode'));
  });

  it('the small helpers throw RangeError for an unknown mode instead of defaulting', () => {
    expect(() => expectedChallengeCount('bogus' as DeckMode)).toThrow(RangeError);
    expect(() => handCountForMode('bogus' as DeckMode)).toThrow(RangeError);
  });

  it('checks the mode before any number', () => {
    const planned = planDeckSize('bogus' as DeckMode, Number.NaN, { availableCorrect: Number.NaN, availableDistractors: Number.NaN });
    expect(planned.ok).toBe(false);
    if (!planned.ok) expect(planned.issue.code).toBe(C.invalidMode);
  });
});

// ---------------------------------------------------------------------------
describe.each(COMBOS)('validateDeckSize: %s / %s', (style, direction) => {
  const build = (correct: number, distractors: number, target?: number) =>
    buildDeck({ style, direction, correct, distractors, ...(target === undefined ? {} : { target }) });

  describe('Solitaire and Tutor (no 24-card target)', () => {
    it.each(['solitaire', 'tutor'] as const)('%s: 5 correct + 3 distractors is the smallest valid deck', (mode) => {
      expect(validateDeckSize(build(5, 3), mode).ok).toBe(true);
    });

    it.each(['solitaire', 'tutor'] as const)('%s: 5 correct + 2 distractors cannot supply a hand and a penalty card', (mode) => {
      const result = validateDeckSize(build(5, 2), mode);
      expect(result.issues).toContainEqual(issue(C.insufficientDeckData, 'answerCards'));
    });

    it('is not held to the competitive minimum or to 24 cards', () => {
      expect(validateDeckSize(build(5, 3), 'solitaire').issues.some((i) => i.code === C.deckBelowMinimum)).toBe(false);
      expect(validateDeckSize(build(5, 10), 'solitaire').ok).toBe(true);
      expect(validateDeckSize(build(5, 19), 'solitaire').ok).toBe(true);
    });

    it('requires exactly 5 challenges', () => {
      expect(validateDeckSize(build(9, 15), 'solitaire').issues).toContainEqual(issue(C.challengeCountMismatch, 'challenges'));
      expect(validateDeckSize(build(9, 15), 'tutor').issues).toContainEqual(issue(C.challengeCountMismatch, 'challenges'));
    });
  });

  describe('competitive (vs Beepy)', () => {
    it('accepts the 24-card deck and the 14-card minimum', () => {
      expect(validateDeckSize(build(9, 15), 'vsBeepy').ok).toBe(true);
      expect(validateDeckSize(build(9, 5), 'vsBeepy').ok).toBe(true);
    });

    it('accepts a smaller deck against a larger target', () => {
      expect(validateDeckSize(build(9, 5, 24), 'vsBeepy').ok).toBe(true);
    });

    it('rejects 13 cards as below the minimum and as unable to supply two hands plus a reserve', () => {
      const result = validateDeckSize(build(9, 4), 'vsBeepy');
      expect(result.issues).toContainEqual(issue(C.deckBelowMinimum, 'answerCards'));
      expect(result.issues).toContainEqual(issue(C.insufficientDeckData, 'answerCards'));
    });

    it('requires exactly 9 challenges', () => {
      expect(validateDeckSize(build(5, 15), 'vsBeepy').issues).toContainEqual(issue(C.challengeCountMismatch, 'challenges'));
    });
  });

  describe('the target is a maximum (owner-approved clarification)', () => {
    it('rejects a deck with more cards than its target', () => {
      const result = validateDeckSize(build(9, 15, 20), 'vsBeepy');
      expect(result.ok).toBe(false);
      expect(result.issues).toContainEqual(issue(C.deckExceedsTarget, 'answerCards'));
    });

    it('accepts a deck equal to, or smaller than, its target', () => {
      expect(validateDeckSize(build(9, 15, 24), 'vsBeepy').ok).toBe(true);
      expect(validateDeckSize(build(9, 7, 24), 'vsBeepy').ok).toBe(true);
    });

    it('applies to Solitaire too', () => {
      expect(validateDeckSize(build(5, 10, 12), 'solitaire').issues).toContainEqual(issue(C.deckExceedsTarget));
    });

    it('cannot be hidden by a wrong actualCardCount', () => {
      const deck = cloneDeck(build(9, 15, 20));
      deck.meta.actualCardCount = 20;
      const result = validateDeckSize(deck, 'vsBeepy');
      expect(result.issues).toContainEqual(issue(C.deckExceedsTarget));
      expect(result.issues).toContainEqual(issue(C.cardCountMismatch, 'meta.actualCardCount'));
    });
  });

  describe('count fields', () => {
    it.each([0, -3, 1.5, NaN, Infinity, 'x', null])('rejects meta.targetCardCount = %s', (bad) => {
      const deck = cloneDeck(build(9, 15));
      deck.meta.targetCardCount = bad as number;
      const result = validateDeckSize(deck, 'vsBeepy');
      expect(result.issues).toContainEqual(issue(C.invalidCount, 'meta.targetCardCount'));
      expect(result.issues.some((i) => i.code === C.deckExceedsTarget)).toBe(false);
    });

    it.each([NaN, -1, 2.5, Infinity, '24'])('rejects meta.actualCardCount = %s without also calling it a mismatch', (bad) => {
      const deck = cloneDeck(build(9, 15));
      deck.meta.actualCardCount = bad as number;
      const result = validateDeckSize(deck, 'vsBeepy');
      expect(result.issues).toContainEqual(issue(C.invalidCount, 'meta.actualCardCount'));
      expect(result.issues.some((i) => i.code === C.cardCountMismatch)).toBe(false);
    });

    it('reports a real mismatch between meta.actualCardCount and the cards present', () => {
      const deck = cloneDeck(build(9, 15));
      deck.meta.actualCardCount = 10;
      expect(validateDeckSize(deck, 'vsBeepy').issues).toContainEqual(issue(C.cardCountMismatch, 'meta.actualCardCount'));
    });
  });
});

// ---------------------------------------------------------------------------
describe('planDeckSize (D8, Req 6.1, 6.4)', () => {
  it('reaches the target when enough plausible values exist, and never exceeds it', () => {
    const planned = plan('vsBeepy', 24, 9, 15);
    expect(planned).toEqual({ ok: true, cardCount: 24, correctCount: 9, distractorCount: 15, reduced: false });
    expect(plan('vsBeepy', 24, 9, 40)).toMatchObject({ ok: true, cardCount: 24, reduced: false });
    expect(plan('vsBeepy', 24, 20, 15)).toMatchObject({ correctCount: 9 });
  });

  it('returns a smaller reduced deck when the range is limited, down to the 14-card minimum', () => {
    expect(plan('vsBeepy', 24, 9, 10)).toMatchObject({ ok: true, cardCount: 19, reduced: true });
    expect(plan('vsBeepy', 24, 9, 5)).toMatchObject({ ok: true, cardCount: 14, reduced: true });
  });

  it('fails instead of padding when even the minimum cannot be met', () => {
    const planned = plan('vsBeepy', 24, 9, 4);
    expect(planned.ok).toBe(false);
    if (!planned.ok) expect(planned.issue).toEqual(issue(C.insufficientDeckData, 'availability.availableDistractors'));
    const noCorrect = plan('vsBeepy', 24, 8, 40);
    expect(noCorrect.ok).toBe(false);
    if (!noCorrect.ok) expect(noCorrect.issue).toEqual(issue(C.insufficientDeckData, 'availability.availableCorrect'));
  });

  it('rejects a target below the minimum', () => {
    const planned = plan('vsBeepy', 12, 9, 40);
    expect(planned.ok).toBe(false);
    if (!planned.ok) expect(planned.issue).toEqual(issue(C.deckBelowMinimum, 'targetCardCount'));
    expect(plan('vsBeepy', 14, 9, 40)).toMatchObject({ ok: true, cardCount: 14, reduced: false });
  });

  it.each(['solitaire', 'tutor'] as const)('%s: plans from 8 cards upward and is not bound to 24', (mode) => {
    expect(plan(mode, 8, 5, 9)).toMatchObject({ ok: true, cardCount: 8 });
    expect(plan(mode, 12, 5, 9)).toMatchObject({ ok: true, cardCount: 12, reduced: false });
    expect(plan(mode, 12, 5, 5)).toMatchObject({ ok: true, cardCount: 10, reduced: true });
    const below = plan(mode, 7, 5, 9);
    expect(below.ok).toBe(false);
    if (!below.ok) expect(below.issue.code).toBe(C.deckBelowMinimum);
    expect(plan(mode, 12, 5, 2).ok).toBe(false);
  });

  it.each([NaN, 0, -1, 1.5, Infinity, '24', null, undefined])('rejects target = %s', (bad) => {
    const planned = plan('vsBeepy', bad as number, 9, 15);
    expect(planned.ok).toBe(false);
    if (!planned.ok) expect(planned.issue).toEqual(issue(C.invalidCount, 'targetCardCount'));
  });

  it.each([NaN, -1, 1.5, Infinity, '9', null, undefined])('rejects availableCorrect = %s', (bad) => {
    const planned = plan('vsBeepy', 24, bad as number, 15);
    expect(planned.ok).toBe(false);
    if (!planned.ok) expect(planned.issue).toEqual(issue(C.invalidCount, 'availability.availableCorrect'));
  });

  it.each([NaN, -1, 1.5, Infinity, '15', null, undefined])('rejects availableDistractors = %s', (bad) => {
    const planned = plan('vsBeepy', 24, 9, bad as number);
    expect(planned.ok).toBe(false);
    if (!planned.ok) expect(planned.issue).toEqual(issue(C.invalidCount, 'availability.availableDistractors'));
  });
});

// ---------------------------------------------------------------------------
describe.each(COMBOS)('smaller-validated-deck-when-range-limited (D8, Req 6.4): %s / %s', (style, direction) => {
  const options = { numericAnswers: isNumericStyle(style, direction) };

  it.each([5, 6, 8, 10, 12, 14])('with %i plausible distractors, the competitive deck is smaller than 24 yet fully valid', (available) => {
    const planned = plan('vsBeepy', 24, 9, available);
    if (!planned.ok) throw new Error('the plan should succeed');
    expect(planned.reduced).toBe(true);
    expect(planned.cardCount).toBe(9 + available);
    expect(planned.cardCount).toBeLessThan(24);
    expect(planned.distractorCount).toBe(available); // exactly what exists: never padded

    const deck = buildDeck({ style, direction, correct: planned.correctCount, distractors: planned.distractorCount, target: 24 });
    expect(validateDeckSize(deck, 'vsBeepy').ok).toBe(true);
    expect(validateChallengeMapping(deck, fullMatrix(deck)).ok).toBe(true);
    expect(validateUniqueness(deck, options).ok).toBe(true);
    expect(checkDualHandFeasibility(deck).ok).toBe(true);
    const hands = [
      ['correct-0', 'correct-1', 'correct-2', 'distractor-0', 'distractor-1'],
      ['correct-3', 'correct-4', 'correct-5', 'distractor-2', 'distractor-3'],
    ] as const;
    expect(validateDualStartingHands(deck, [hands[0], hands[1]], options).ok).toBe(true);
  });

  it('with fewer than 5 plausible distractors there is no valid competitive deck and nothing is padded', () => {
    for (const available of [0, 1, 2, 3, 4]) {
      const planned = plan('vsBeepy', 24, 9, available);
      expect(planned.ok).toBe(false);
      const padded = buildDeck({ style, direction, correct: 9, distractors: available, target: 24 });
      expect(validateDeckSize(padded, 'vsBeepy').ok).toBe(false);
    }
  });

  it('a reduced Solitaire deck is also fully valid', () => {
    const planned = plan('solitaire', 12, 5, 5);
    if (!planned.ok) throw new Error('the plan should succeed');
    expect(planned).toMatchObject({ cardCount: 10, reduced: true });
    const deck = buildDeck({ style, direction, correct: planned.correctCount, distractors: planned.distractorCount, target: 12 });
    expect(validateDeckSize(deck, 'solitaire').ok).toBe(true);
    expect(validateChallengeMapping(deck, fullMatrix(deck)).ok).toBe(true);
    expect(validateStartingHand(deck, ['correct-0', 'correct-1', 'distractor-0', 'distractor-1', 'distractor-2'], options).ok).toBe(true);
  });
});

describe('planDeckSize: properties over a grid (3 modes x targets 1-30 x 0-30 distractors)', () => {
  it('never exceeds its target, never uses more distractors than exist, and always builds a deck the validator accepts', () => {
    let successful = 0;
    for (const mode of MODES) {
      for (let target = 1; target <= 30; target += 1) {
        for (let available = 0; available <= 30; available += 1) {
          const planned = plan(mode, target, 12, available);
          if (!planned.ok) continue;
          successful += 1;
          expect(planned.cardCount).toBeLessThanOrEqual(target);
          expect(planned.distractorCount).toBeLessThanOrEqual(available);
          expect(planned.cardCount).toBe(planned.correctCount + planned.distractorCount);
          const deck = buildDeck({ style: 'math', correct: planned.correctCount, distractors: planned.distractorCount, target });
          expect(validateDeckSize(deck, mode).ok).toBe(true);
        }
      }
    }
    expect(successful).toBeGreaterThan(500);
  });

  it('more plausible values never produce a smaller deck (monotonic)', () => {
    for (const mode of MODES) {
      for (const target of [8, 14, 18, 24, 30]) {
        let previous = -1;
        for (let available = 0; available <= 40; available += 1) {
          const planned = plan(mode, target, 12, available);
          if (!planned.ok) continue;
          expect(planned.cardCount).toBeGreaterThanOrEqual(previous);
          previous = planned.cardCount;
        }
      }
    }
  });
});
