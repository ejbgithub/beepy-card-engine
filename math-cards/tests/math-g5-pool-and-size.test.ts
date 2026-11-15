/**
 * M4 G5 - eligible pool, size planning, and distractors (requirements 3, 4.2, 4.4,
 * 5, 7.5). Expected sizes come from the INDEPENDENT oracle's pool count for the
 * deck's own challenges. No test assumes a 24-card deck.
 */

import { describe, expect, it } from 'vitest';
import { planDeckSize, type GeneratedDeck } from '@beepy/shared-engine';
import { assembleMathDeck, generateMathDeck, validateMathRequest } from '../src/math-generator.js';
import type { OperandPair } from '../src/levels.js';
import {
  DIRECTIONS,
  LEVELS,
  MODES,
  basesOfPair,
  cardNumber,
  challengeCountFor,
  defaultTargetFor,
  expectedSize,
  oraclePool,
  oracleTier,
  parsePair,
  plausibleOf,
  promptSum,
  type Direction,
  type Level,
  type Mode,
} from './math-oracle.js';

const SEEDS = Array.from({ length: 30 }, (_, i) => i * 104729 + 17);

type Success = Extract<ReturnType<typeof generateMathDeck>, { ok: true }>;

function generate(mode: Mode, level: Level, direction: Direction, seed: number, targetCardCount?: number): Success {
  const result = generateMathDeck({
    mode,
    level,
    generationDirection: direction,
    seed,
    ...(targetCardCount === undefined ? {} : { targetCardCount }),
  });
  if (!result.ok) throw new Error(`generation failed: ${result.issues.map((i) => i.code).join(', ')}`);
  return result;
}

const sumsOf = (deck: GeneratedDeck): number[] => deck.challenges.map((c) => promptSum(c.promptText, deck.direction));
const distractorsOf = (deck: GeneratedDeck) => {
  const designated = new Set(deck.challenges.map((c) => c.correctAnswerCardId));
  return deck.answerCards.filter((card) => !designated.has(card.id));
};

/** Build a deck from FIXED problems through the documented test seam. */
function fixed(mode: Mode, direction: Direction, pairs: ReadonlyArray<readonly [number, number]>, seed = 1): ReturnType<typeof assembleMathDeck> {
  const checked = validateMathRequest({ mode, level: 'oneDigit', generationDirection: direction, seed });
  if (!checked.ok) throw new Error('request');
  const problems: OperandPair[] = pairs.map(([a, b]) => ({ a, b, sum: a + b, level: 'oneDigit' }));
  return assembleMathDeck(checked.request, problems, checked.request.seed);
}

/** The smallest target the M2 planner accepts for a mode, found by asking it. */
function m2MinimumTarget(mode: Mode): number {
  for (let target = 1; target <= 60; target += 1) {
    if (planDeckSize(mode, target, { availableCorrect: challengeCountFor(mode), availableDistractors: 1000 }).ok) return target;
  }
  throw new Error('no minimum found');
}

describe.each(MODES)('pool and size: %s', (mode) => {
  describe.each(LEVELS)('%s', (level) => {
    describe.each(DIRECTIONS)('%s', (direction) => {
      it('plans from the actual eligible pool of the chosen challenges (oracle-checked)', () => {
        for (const seed of SEEDS) {
          const result = generate(mode, level, direction, seed);
          const sums = sumsOf(result.deck);
          const pool = oraclePool(level, direction, sums);
          // The generator's pool is exactly the oracle's pool for these challenges.
          expect(result.sizing.eligibleDistractors).toBe(pool.length);
          // No correct-answer value was counted as a distractor.
          expect(pool.some((c) => sums.includes(c.value))).toBe(false);
          const target = defaultTargetFor(mode);
          const size = expectedSize(mode, target, pool.length);
          expect(result.deck.answerCards).toHaveLength(size);
          expect(result.sizing).toEqual({
            targetCardCount: target,
            actualCardCount: size,
            eligibleDistractors: pool.length,
            reduced: size < target,
          });
          expect(result.deck.meta).toEqual({ targetCardCount: target, actualCardCount: size });
          expect(size).toBeLessThanOrEqual(target);
        }
      });

      it('every distractor is incorrect for every challenge, in range, unique, and never zero', () => {
        for (const seed of SEEDS.slice(0, 10)) {
          const { deck } = generate(mode, level, direction, seed);
          const sums = sumsOf(deck);
          const faces = deck.answerCards.map((c) => c.displayValue);
          expect(new Set(faces).size).toBe(faces.length);
          for (const card of distractorsOf(deck)) {
            const value = cardNumber(card.displayValue, direction);
            expect(value).toBeDefined();
            expect(sums).not.toContain(value);
            expect(value).not.toBe(0);
            if (direction === 'factToSubject') {
              const [lo, hi] = plausibleOf(level);
              expect(value!).toBeGreaterThanOrEqual(lo);
              expect(value!).toBeLessThanOrEqual(hi);
            } else {
              const [a, b] = parsePair(card.displayValue)!;
              expect(a).toBeGreaterThanOrEqual(1);
              expect(a).toBeLessThanOrEqual(b);
              const bases = basesOfPair(a, b);
              if (level === 'mixed') expect(bases.length).toBeGreaterThan(0);
              else expect(bases).toContain(level);
            }
          }
          if (direction === 'subjectToFact') {
            // No commuted duplicates anywhere in the deck (correct cards included).
            const keys = deck.answerCards.map((c) => {
              const [a, b] = parsePair(c.displayValue)!;
              return `${Math.min(a, b)}+${Math.max(a, b)}`;
            });
            expect(new Set(keys).size).toBe(keys.length);
          }
        }
      });

      it('takes near-miss tiers in order: a lower tier is exhausted before a higher one is used', () => {
        for (const seed of SEEDS.slice(0, 10)) {
          const { deck } = generate(mode, level, direction, seed);
          const sums = sumsOf(deck);
          const chosen = new Set(distractorsOf(deck).map((c) => c.displayValue));
          const pool = oraclePool(level, direction, sums).map((c) => ({ ...c, tier: oracleTier(c.value, sums, direction) }));
          const highestUsed = Math.max(...pool.filter((c) => chosen.has(c.display)).map((c) => c.tier));
          for (const candidate of pool) {
            if (candidate.tier < highestUsed) expect(chosen.has(candidate.display), candidate.display).toBe(true);
          }
        }
      });
    });
  });
});

describe('one-digit sizes per direction', () => {
  it('factToSubject: the pool is exactly 11, so competitive is 20 (reduced) and Solitaire is 15', () => {
    for (const seed of SEEDS) {
      const vs = generate('vsBeepy', 'oneDigit', 'factToSubject', seed);
      expect(vs.sizing.eligibleDistractors).toBe(11);
      expect(vs.deck.answerCards).toHaveLength(20);
      expect(vs.sizing.reduced).toBe(true);
      const solo = generate('solitaire', 'oneDigit', 'factToSubject', seed);
      expect(solo.deck.answerCards).toHaveLength(15);
      expect(solo.sizing.reduced).toBe(false);
    }
  });

  it('subjectToFact: competitive size is 9 + min(15, pool) over many seeds, with pools from 12 to 30', () => {
    const sizes = new Set<number>();
    for (let seed = 1; seed <= 300; seed += 1) {
      const result = generate('vsBeepy', 'oneDigit', 'subjectToFact', seed);
      const pool = oraclePool('oneDigit', 'subjectToFact', sumsOf(result.deck)).length;
      expect(pool).toBeGreaterThanOrEqual(12);
      expect(pool).toBeLessThanOrEqual(30);
      expect(result.deck.answerCards).toHaveLength(9 + Math.min(15, pool));
      sizes.add(result.deck.answerCards.length);
    }
    // Observed sizes are recorded, not assumed: 24 is a target, not a guarantee.
    expect([...sizes].every((s) => s >= 21 && s <= 24)).toBe(true);
  });

  it('subjectToFact fixed case, targets 6-14: the pool is exactly 12 and the deck is 21 cards', () => {
    const result = fixed('vsBeepy', 'subjectToFact', [
      [1, 5], [1, 6], [1, 7], [1, 8], [1, 9], [2, 9], [3, 9], [4, 9], [5, 9],
    ]);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(sumsOf(result.deck).sort((a, b) => a - b)).toEqual([6, 7, 8, 9, 10, 11, 12, 13, 14]);
    expect(oraclePool('oneDigit', 'subjectToFact', [6, 7, 8, 9, 10, 11, 12, 13, 14])).toHaveLength(12);
    expect(result.sizing.eligibleDistractors).toBe(12);
    expect(result.deck.answerCards).toHaveLength(21);
    expect(result.sizing.reduced).toBe(true);
  });

  it('subjectToFact fixed case, targets {2,3,4,5,6,15,16,17,18}: the pool is 30 and the deck is 24 cards', () => {
    const result = fixed('vsBeepy', 'subjectToFact', [
      [1, 1], [1, 2], [1, 3], [1, 4], [1, 5], [6, 9], [7, 9], [8, 9], [9, 9],
    ]);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.sizing.eligibleDistractors).toBe(30);
    expect(result.deck.answerCards).toHaveLength(24);
    expect(result.sizing.reduced).toBe(false);
  });

  it('subjectToFact Solitaire is always 15 (five targets leave at least 24 pairs)', () => {
    for (const seed of SEEDS) {
      const result = generate('solitaire', 'oneDigit', 'subjectToFact', seed);
      expect(result.sizing.eligibleDistractors).toBeGreaterThanOrEqual(24);
      expect(result.deck.answerCards).toHaveLength(15);
    }
  });

  it('the worst five Solitaire targets (sums 8-12) leave exactly 24 pairs (oracle)', () => {
    expect(oraclePool('oneDigit', 'subjectToFact', [8, 9, 10, 11, 12])).toHaveLength(24);
  });
});

describe('ceiling and minimums come from the M2 planner (no hard-coded minimum)', () => {
  it.each(MODES)('%s: a target below the M2 minimum fails with the planner issue; the minimum itself succeeds', (mode) => {
    const minimum = m2MinimumTarget(mode);
    const below = generateMathDeck({ mode, level: 'twoDigit', seed: 3, targetCardCount: minimum - 1 });
    expect(below.ok).toBe(false);
    expect('deck' in below).toBe(false);
    if (!below.ok) expect(below.issues.map((i) => i.code)).toContain('DECK_BELOW_MINIMUM');
    const at = generate(mode, 'twoDigit', 'factToSubject', 3, minimum);
    expect(at.deck.answerCards).toHaveLength(minimum);
  });

  it.each(MODES)('%s: a configured target is a ceiling, never exceeded', (mode) => {
    const minimum = m2MinimumTarget(mode);
    for (const target of [minimum, minimum + 1, 18, 30]) {
      for (const direction of DIRECTIONS) {
        const result = generate(mode, 'twoDigit', direction, 9, target);
        const pool = oraclePool('twoDigit', direction, sumsOf(result.deck)).length;
        expect(result.deck.answerCards.length).toBe(expectedSize(mode, target, pool));
        expect(result.deck.answerCards.length).toBeLessThanOrEqual(target);
      }
    }
  });

  it('every v1 level pool can support a competitive deck: the smallest possible pool clears the M2 minimum', () => {
    // A pool too small for the mode cannot arise with the approved levels; this
    // checks that claim with the oracle instead of assuming it. The smallest pools
    // are one-digit: 11 (factToSubject, fixed) and 12 (subjectToFact, targets 6-14).
    const smallest = Math.min(
      oraclePool('oneDigit', 'factToSubject', [2, 3, 4, 5, 6, 7, 8, 9, 10]).length,
      oraclePool('oneDigit', 'subjectToFact', [6, 7, 8, 9, 10, 11, 12, 13, 14]).length,
    );
    expect(smallest).toBe(11);
    const plan = planDeckSize('vsBeepy', 24, { availableCorrect: 9, availableDistractors: smallest });
    expect(plan.ok).toBe(true);
    // And a pool below the planner's minimum is refused by the planner (the generator
    // returns that issue unchanged, as the below-minimum target test shows).
    const tooSmall = planDeckSize('vsBeepy', 24, { availableCorrect: 9, availableDistractors: 0 });
    expect(tooSmall.ok).toBe(false);
  });
});
