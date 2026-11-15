/**
 * Math Cards expression penalty fallback for `subjectToFact` (Milestone M4, G8;
 * decision M4-4 A).
 *
 * In `subjectToFact` the answer cards are addition expressions ("3 + 4"), so the
 * existing numeric provider (penalty-fallback.ts, unchanged) cannot help: it cannot
 * read a numeric answer from an expression card, so the shared check rejects every
 * candidate. This provider offers unused canonical expressions from the level's
 * operand ranges instead.
 *
 * For each active challenge it reads the target from the expression on that
 * challenge's designated card among the cards in the game. A candidate is offered
 * only if:
 *   - no card in the game already shows the same operand pair, in either order;
 *   - its sum matches no active target (so it is a distractor for every open
 *     challenge, and no equivalent form of a correct answer is offered).
 * Candidates are ordered nearest-first to the targets (ties by sum, then smaller
 * operand), so they look like believable near-misses. The order is deterministic,
 * the sequence is finite, and the shared `drawPenaltyCards` re-checks every
 * candidate. If a challenge's target cannot be read, that challenge is left
 * unevaluated and the shared function rejects the candidate rather than guess.
 *
 * Ids are `expr-<a>-<b>`. Fallback cards carry no explanation. No zero operand
 * ever appears, because level operands start at 1.
 */

import {
  normalizeDisplayText,
  type PenaltyCandidate,
  type PenaltyFallbackContext,
  type PenaltyFallbackProvider,
} from '@beepy/shared-engine';
import {
  formatExpression,
  isMathLevel,
  pairKey,
  pairsOfLevel,
  parseExpression,
  type MathLevel,
  type OperandPair,
} from './levels.js';

export interface MathExpressionFallbackOptions {
  readonly level: MathLevel;
}

/**
 * Create a provider of unused expressions for a level. Throws `RangeError` for an
 * unknown level, like the numeric provider does for an invalid range.
 */
export function createMathExpressionFallbackProvider(
  options: MathExpressionFallbackOptions,
): PenaltyFallbackProvider {
  const level = options?.level;
  if (!isMathLevel(level)) {
    throw new RangeError(`Unknown Math level for the expression fallback: ${String(level)}.`);
  }
  const pairs = pairsOfLevel(level);
  return {
    candidates(context: PenaltyFallbackContext): Iterable<PenaltyCandidate> {
      return enumerateCandidates(context, pairs);
    },
  };
}

function* enumerateCandidates(
  context: PenaltyFallbackContext,
  pairs: readonly OperandPair[],
): Generator<PenaltyCandidate> {
  const displayById = new Map<string, string>();
  const usedPairs = new Set<string>();
  const usedText = new Set<string>();
  for (const card of context.usedCards) {
    displayById.set(card.id, card.displayValue);
    usedText.add(normalizeDisplayText(card.displayValue));
    const parsed = parseExpression(card.displayValue);
    if (parsed !== undefined) {
      usedPairs.add(pairKey(parsed.a, parsed.b));
    }
  }

  // The target of each active challenge, when its designated card can be read.
  const targetByChallenge = new Map<string, number>();
  for (const challenge of context.activeChallenges) {
    const shown = displayById.get(challenge.correctAnswerCardId);
    const parsed = shown === undefined ? undefined : parseExpression(shown);
    if (parsed !== undefined) {
      targetByChallenge.set(challenge.id, parsed.a + parsed.b);
    }
  }
  const targets = [...targetByChallenge.values()];
  const distance = (sum: number): number =>
    targets.length === 0 ? 0 : Math.min(...targets.map((target) => Math.abs(target - sum)));

  // Distance is computed once per candidate, then used for a stable sort.
  const eligible = pairs
    .filter(
      (pair) =>
        !usedPairs.has(pairKey(pair.a, pair.b)) &&
        !usedText.has(normalizeDisplayText(formatExpression(pair.a, pair.b))) &&
        !targets.includes(pair.sum),
    )
    .map((pair) => ({ pair, distance: distance(pair.sum) }))
    .sort((x, y) => x.distance - y.distance || x.pair.sum - y.pair.sum || x.pair.a - y.pair.a)
    .map((entry) => entry.pair);

  for (const pair of eligible) {
    const validForChallenges: Record<string, boolean> = {};
    for (const [challengeId, target] of targetByChallenge) {
      validForChallenges[challengeId] = target === pair.sum;
    }
    yield {
      card: { id: `expr-${pair.a}-${pair.b}`, displayValue: formatExpression(pair.a, pair.b) },
      plausible: true,
      validForChallenges,
    };
  }
}
