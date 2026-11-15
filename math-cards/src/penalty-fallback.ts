/**
 * Math Cards penalty-fallback provider (Milestone M2, Task 12; Decision 3).
 *
 * When the draw pile runs out, the shared `drawPenaltyCards` asks this provider
 * for candidate penalty cards. Math can safely generate them: a candidate is a
 * whole number inside the difficulty's plausible range that no card in the game
 * already shows. Candidates are offered nearest-first to the active challenges'
 * answers (ties by ascending value), so penalty cards look like believable
 * near-misses rather than random numbers. Order is deterministic.
 *
 * The provider only PROPOSES candidates. The shared function re-checks every one
 * (valid, unique, plausible, previously used, and not a valid answer to any
 * active challenge), so a mistake here cannot break the uniqueness invariant. For
 * each candidate it states whether it equals each active challenge's answer; if a
 * challenge's correct answer cannot be found among the cards in the game, that
 * challenge is left unevaluated and the shared function rejects the candidate
 * rather than guess.
 *
 * Scope (Task 12 only). The enumerated range is capped at `MAX_RANGE_SIZE` values
 * (generation is bounded). No expression generation, gameplay, or UI. Clinical
 * has no counterpart: clinical facts and explanations are never generated at
 * runtime.
 */

import {
  canonicalNumber,
  type PenaltyCandidate,
  type PenaltyFallbackContext,
  type PenaltyFallbackProvider,
} from '@beepy/shared-engine';

/** Largest number of values a provider will enumerate. Math ranges are far smaller. */
export const MAX_RANGE_SIZE = 10_000;

/** Plausible answer range for the current difficulty, inclusive. */
export interface MathPenaltyFallbackOptions {
  readonly minValue: number;
  readonly maxValue: number;
}

/**
 * Create a provider that offers unused whole numbers in
 * `[minValue, maxValue]`. Throws `RangeError` for an invalid range.
 */
export function createMathPenaltyFallbackProvider(
  options: MathPenaltyFallbackOptions,
): PenaltyFallbackProvider {
  const { minValue, maxValue } = options;
  if (
    !Number.isSafeInteger(minValue) ||
    !Number.isSafeInteger(maxValue) ||
    minValue < 0 ||
    maxValue < minValue ||
    maxValue - minValue + 1 > MAX_RANGE_SIZE
  ) {
    throw new RangeError(
      `Invalid Math penalty range [${String(minValue)}, ${String(maxValue)}]: use whole numbers with 0 <= min <= max and at most ${MAX_RANGE_SIZE} values.`,
    );
  }
  return {
    candidates(context: PenaltyFallbackContext): Iterable<PenaltyCandidate> {
      return enumerateCandidates(context, minValue, maxValue);
    },
  };
}

function* enumerateCandidates(
  context: PenaltyFallbackContext,
  minValue: number,
  maxValue: number,
): Generator<PenaltyCandidate> {
  const displayById = new Map<string, string>();
  const usedValues = new Set<string>();
  for (const card of context.usedCards) {
    displayById.set(card.id, card.displayValue);
    const canonical = canonicalNumber(card.displayValue);
    if (canonical !== undefined) {
      usedValues.add(canonical);
    }
  }

  // The numeric answer of each active challenge, when it can be determined.
  const answerByChallenge = new Map<string, number>();
  for (const challenge of context.activeChallenges) {
    const shown = displayById.get(challenge.correctAnswerCardId);
    const canonical = shown === undefined ? undefined : canonicalNumber(shown);
    if (canonical !== undefined) {
      answerByChallenge.set(challenge.id, Number(canonical));
    }
  }
  const answers = [...answerByChallenge.values()];

  const values: number[] = [];
  for (let value = minValue; value <= maxValue; value += 1) {
    if (!usedValues.has(String(value))) {
      values.push(value);
    }
  }
  const distance = (value: number): number =>
    answers.length === 0 ? 0 : Math.min(...answers.map((answer) => Math.abs(answer - value)));
  values.sort((a, b) => distance(a) - distance(b) || a - b);

  for (const value of values) {
    const validForChallenges: Record<string, boolean> = {};
    for (const [challengeId, answer] of answerByChallenge) {
      validForChallenges[challengeId] = answer === value;
    }
    yield {
      card: { id: `penalty-${value}`, displayValue: String(value) },
      plausible: true,
      validForChallenges,
    };
  }
}
