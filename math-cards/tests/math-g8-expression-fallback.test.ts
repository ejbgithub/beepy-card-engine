/**
 * M4 G8 - expression penalty fallback for subjectToFact (decision M4-4 A).
 * Expectations use the independent oracle.
 */

import { describe, expect, it } from 'vitest';
import {
  drawPenaltyCards,
  type GeneratedAnswerCard,
  type GeneratedDeck,
  type PenaltyCandidate,
} from '@beepy/shared-engine';
import { createMathExpressionFallbackProvider } from '../src/expression-fallback.js';
import { generateMathDeck } from '../src/math-generator.js';
import { LEVELS, basesOfPair, oraclePool, parsePair, promptSum, type Level } from './math-oracle.js';

function deckFor(level: Level, seed: number, mode: 'solitaire' | 'vsBeepy' = 'vsBeepy'): GeneratedDeck {
  const result = generateMathDeck({ mode, level, generationDirection: 'subjectToFact', seed });
  if (!result.ok) throw new Error(result.issues.map((i) => i.code).join(', '));
  return result.deck;
}

const contextOf = (deck: GeneratedDeck, used: readonly GeneratedAnswerCard[] = deck.answerCards) => ({
  activeChallenges: deck.challenges,
  usedCards: used,
  numericAnswers: false,
});

const take = (iterable: Iterable<PenaltyCandidate>, n: number): PenaltyCandidate[] => {
  const out: PenaltyCandidate[] = [];
  for (const candidate of iterable) {
    out.push(candidate);
    if (out.length >= n) break;
  }
  return out;
};

describe.each(LEVELS)('expression fallback: %s', (level) => {
  it('offers exactly the unused canonical pairs whose sum is no active target (oracle), finitely', () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      const deck = deckFor(level, seed);
      const targets = deck.challenges.map((c) => promptSum(c.promptText, 'subjectToFact'));
      const usedKeys = new Set(deck.answerCards.map((c) => parsePair(c.displayValue)!.join('+')));
      const expected = oraclePool(level, 'subjectToFact', targets)
        .filter((c) => !usedKeys.has(parsePair(c.display)!.join('+')))
        .map((c) => c.display)
        .sort();
      const offered = [...createMathExpressionFallbackProvider({ level }).candidates(contextOf(deck))];
      expect(offered.map((c) => c.card.displayValue).sort()).toEqual(expected);
      for (const candidate of offered) {
        const [a, b] = parsePair(candidate.card.displayValue)!;
        expect(a).toBeGreaterThanOrEqual(1);
        expect(a).toBeLessThanOrEqual(b);
        expect(a + b).toBeLessThanOrEqual(99);
        expect(targets).not.toContain(a + b);
        expect(basesOfPair(a, b).length).toBeGreaterThan(0);
        expect(candidate.card.id).toBe(`expr-${a}-${b}`);
        expect(candidate.card.explanationByChallengeId).toBeUndefined();
        expect(candidate.plausible).toBe(true);
        expect(Object.keys(candidate.validForChallenges).sort()).toEqual(deck.challenges.map((c) => c.id).sort());
        expect(Object.values(candidate.validForChallenges).every((v) => v === false)).toBe(true);
      }
    }
  });

  it('is accepted by the shared drawPenaltyCards, and several draws stay unique', () => {
    const deck = deckFor(level, 9);
    const result = drawPenaltyCards(
      { drawPile: [], cardsOutsideDrawPile: deck.answerCards },
      [0, 1, 2, 3].map(() => ({ playerId: 'human', reason: 'INVALID_ACTION' as const })),
      { activeChallenges: deck.challenges, fallback: createMathExpressionFallbackProvider({ level }), numericAnswers: false },
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.sources).toEqual(['fallback', 'fallback', 'fallback', 'fallback']);
    const keys = [...deck.answerCards, ...result.cards].map((c) => {
      const [a, b] = parsePair(c.displayValue)!;
      return `${Math.min(a, b)}+${Math.max(a, b)}`;
    });
    expect(new Set(keys).size).toBe(keys.length);
    for (const card of result.cards) expect(card.explanationByChallengeId).toBeUndefined();
  });
});

describe('ordering, determinism, and safety', () => {
  it('orders nearest-first to the targets', () => {
    const deck = deckFor('twoDigit', 4);
    const targets = deck.challenges.map((c) => promptSum(c.promptText, 'subjectToFact'));
    const offered = [...createMathExpressionFallbackProvider({ level: 'twoDigit' }).candidates(contextOf(deck))];
    const distances = offered.map((c) => {
      const [a, b] = parsePair(c.card.displayValue)!;
      return Math.min(...targets.map((t) => Math.abs(t - (a + b))));
    });
    expect(distances).toEqual([...distances].sort((x, y) => x - y));
    expect(distances[0]).toBe(1);
  });

  it('is deterministic for the same context', () => {
    const deck = deckFor('mixed', 6);
    const provider = createMathExpressionFallbackProvider({ level: 'mixed' });
    expect(take(provider.candidates(contextOf(deck)), 30)).toEqual(take(provider.candidates(contextOf(deck)), 30));
  });

  it('never offers the other ordering of a pair already in the game', () => {
    const deck = deckFor('oneDigit', 3, 'solitaire');
    // A crafted non-canonical card "9 + 2" in the game blocks "2 + 9".
    const used = [...deck.answerCards, { id: 'x-crafted', displayValue: '9 + 2' }];
    const offered = [...createMathExpressionFallbackProvider({ level: 'oneDigit' }).candidates(contextOf(deck, used))];
    expect(offered.map((c) => c.card.displayValue)).not.toContain('2 + 9');
  });

  it('leaves a challenge unevaluated when its target cannot be read, so the shared check rejects', () => {
    const deck = deckFor('oneDigit', 3, 'solitaire');
    const designated = deck.challenges[0]!.correctAnswerCardId;
    const used = deck.answerCards.filter((c) => c.id !== designated);
    const offered = take(createMathExpressionFallbackProvider({ level: 'oneDigit' }).candidates(contextOf(deck, used)), 5);
    for (const candidate of offered) expect(Object.hasOwn(candidate.validForChallenges, deck.challenges[0]!.id)).toBe(false);
    const result = drawPenaltyCards(
      { drawPile: [], cardsOutsideDrawPile: used },
      [{ playerId: 'human', reason: 'INVALID_ACTION' }],
      { activeChallenges: deck.challenges, fallback: createMathExpressionFallbackProvider({ level: 'oneDigit' }), numericAnswers: false, maxCandidates: 5 },
    );
    expect(result.ok).toBe(false);
    if (!result.ok && 'exhausted' in result) {
      expect(result.exhausted.details.fallback.rejections.INVALID_VALUE).toBe(5);
    }
  });

  it.each([undefined, 'threeDigit', null])('rejects an unknown level (%j) with RangeError', (level) => {
    expect(() => createMathExpressionFallbackProvider({ level: level as never })).toThrow(RangeError);
  });
});
