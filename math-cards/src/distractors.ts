/**
 * Eligible distractor pool and near-miss ordering (Milestone M4, G5).
 *
 * The pool is built AFTER the challenges are chosen (owner correction 1), for this
 * exact set of challenges, and is fully enumerated so its size is exact:
 *
 *   factToSubject  every whole number in the level's plausible range, minus every
 *                  active sum.
 *   subjectToFact  every canonical operand pair of the level within its sum cap,
 *                  minus every pair whose sum equals ANY active target. That
 *                  removes the correct expressions and all their equivalent forms;
 *                  commuted forms never exist because pairs are canonical.
 *
 * In both directions a candidate that would be valid for any active challenge is
 * excluded, so every distractor is incorrect for every active challenge. Zero never
 * appears: numeric ranges start at 1 or higher, and operands start at 1.
 *
 * Ordering only ranks the pool, so near-misses come first; it never adds values.
 * Within a tier the order comes from the seed.
 */

import { shuffle, type GenerationDirection, type RngState } from '@beepy/shared-engine';
import { formatExpression, pairsOfLevel, plausibleRangeOf, type MathLevel } from './levels.js';

/** One eligible distractor. */
export interface DistractorCandidate {
  /** Card face. */
  readonly display: string;
  /** The number the card shows (factToSubject) or its sum (subjectToFact). */
  readonly value: number;
  /** Near-miss tier: 1 is most believable. */
  readonly tier: 1 | 2 | 3;
}

/** Tier of a numeric candidate relative to the active sums. */
function numericTier(value: number, sums: readonly number[]): 1 | 2 | 3 {
  const distance = Math.min(...sums.map((sum) => Math.abs(sum - value)));
  if (distance === 1) {
    return 1;
  }
  // +/- 2, or a carrying slip of +/- 10 against a two-digit sum.
  if (distance === 2 || sums.some((sum) => sum >= 10 && Math.abs(sum - value) === 10)) {
    return 2;
  }
  return 3;
}

/** Tier of an expression candidate by how close its sum is to a target. */
function expressionTier(sum: number, targets: readonly number[]): 1 | 2 | 3 {
  const distance = Math.min(...targets.map((target) => Math.abs(target - sum)));
  return distance === 1 ? 1 : distance === 2 ? 2 : 3;
}

/**
 * Build the eligible pool for a set of active sums. The result is in ascending
 * order (numbers by value; expressions by smaller then larger operand).
 */
export function buildEligiblePool(
  level: MathLevel,
  direction: GenerationDirection,
  activeSums: readonly number[],
): DistractorCandidate[] {
  const active = new Set(activeSums);
  if (direction === 'factToSubject') {
    const range = plausibleRangeOf(level);
    const pool: DistractorCandidate[] = [];
    for (let value = range.min; value <= range.max; value += 1) {
      if (!active.has(value)) {
        pool.push({ display: String(value), value, tier: numericTier(value, activeSums) });
      }
    }
    return pool;
  }
  return pairsOfLevel(level)
    .filter((pair) => !active.has(pair.sum))
    .map((pair) => ({
      display: formatExpression(pair.a, pair.b),
      value: pair.sum,
      tier: expressionTier(pair.sum, activeSums),
    }));
}

/**
 * Take `count` distractors from the pool: tier 1 first, then tier 2, then tier 3,
 * each tier in a seeded order.
 */
export function selectDistractors(
  pool: readonly DistractorCandidate[],
  count: number,
  rng: RngState,
): readonly [DistractorCandidate[], RngState] {
  let state = rng;
  const ordered: DistractorCandidate[] = [];
  for (const tier of [1, 2, 3] as const) {
    const [inTier, next] = shuffle(
      pool.filter((candidate) => candidate.tier === tier),
      state,
    );
    state = next;
    ordered.push(...inTier);
  }
  return [ordered.slice(0, count), state];
}
