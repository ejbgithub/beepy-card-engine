/**
 * Task 18 - Math penalty fallback (Req 7.1, 7.2; Req 6.3; design D6, D6a; Decision 3).
 *
 * The Math provider may GENERATE candidates (plausible unused whole numbers); the
 * shared drawPenaltyCards re-checks every one, so the provider cannot break the
 * no-duplicate-card invariant. These tests run the provider through the shared
 * function end to end.
 */

import { describe, expect, it } from 'vitest';
import {
  DECK_VALIDATION_CODES as C,
  drawPenaltyCards,
  validateUniqueness,
  type GeneratedAnswerCard,
  type GeneratedDeck,
  type PenaltyDrawResult,
} from '@beepy/shared-engine';
import { MathDeckGenerator } from '../src/math-generator.js';
import { MAX_RANGE_SIZE, createMathPenaltyFallbackProvider } from '../src/penalty-fallback.js';
import { card, challengeFor } from './helpers.js';

const active = [challengeFor('c1', 'k1'), challengeFor('c2', 'k2'), challengeFor('c3', 'k3')];
const outside = (): GeneratedAnswerCard[] => [card('k1', 7), card('k2', 8), card('k3', 9), card('h1', 12)];
const req = (playerId: string) => ({ playerId, reason: 'INVALID_ACTION' as const });
const provider018 = createMathPenaltyFallbackProvider({ minValue: 0, maxValue: 18 });

function draw(
  count: number,
  provider = provider018,
  cardsOutside: GeneratedAnswerCard[] = outside(),
  extra: { maxCandidates?: number } = {},
): PenaltyDrawResult {
  return drawPenaltyCards(
    { drawPile: [], cardsOutsideDrawPile: cardsOutside },
    Array.from({ length: count }, (_, i) => req(`p${i}`)),
    { activeChallenges: active, fallback: provider, numericAnswers: true, ...extra },
  );
}
const values = (result: PenaltyDrawResult): string[] => (result.ok ? result.cards.map((c) => c.displayValue) : []);

describe('createMathPenaltyFallbackProvider: range', () => {
  it.each([
    ['a negative minimum', { minValue: -1, maxValue: 5 }],
    ['a maximum below the minimum', { minValue: 5, maxValue: 4 }],
    ['a fractional minimum', { minValue: 1.5, maxValue: 5 }],
    ['a NaN maximum', { minValue: 0, maxValue: Number.NaN }],
    ['an infinite maximum', { minValue: 0, maxValue: Infinity }],
    [`a range of ${MAX_RANGE_SIZE + 1} values`, { minValue: 0, maxValue: MAX_RANGE_SIZE }],
  ])('rejects %s with a RangeError', (_label, range) => {
    expect(() => createMathPenaltyFallbackProvider(range)).toThrow(RangeError);
  });

  it('allows a range of exactly the largest size', () => {
    expect(MAX_RANGE_SIZE).toBe(10_000);
    expect(() => createMathPenaltyFallbackProvider({ minValue: 0, maxValue: MAX_RANGE_SIZE - 1 })).not.toThrow();
  });
});

describe('Math fallback candidates: plausible, unique, nearest first', () => {
  it('offers the nearest unused value to the active answers first (7, 8, 9 are in play: 6 is nearest)', () => {
    const result = draw(1);
    expect(values(result)).toEqual(['6']);
    expect(result.ok && result.cards[0]?.id).toBe('penalty-6');
    expect(result.ok && result.sources).toEqual(['fallback']);
  });

  it('breaks distance ties by ascending value: 6, 10, then 5', () => {
    expect(values(draw(2))).toEqual(['6', '10']);
    expect(values(draw(3))).toEqual(['6', '10', '5']);
  });

  it('is deterministic', () => {
    expect(JSON.stringify(draw(3))).toBe(JSON.stringify(draw(3)));
  });

  it('delivers only an id and a display value', () => {
    const result = draw(1);
    expect(result.ok && Object.keys(result.cards[0] ?? {}).sort()).toEqual(['displayValue', 'id']);
  });

  it('never offers a value already in play, nor a card minted earlier', () => {
    const first = draw(1);
    if (!first.ok) throw new Error('expected a card');
    const second = draw(1, provider018, [...outside(), ...first.cards]);
    expect(values(second)).toEqual(['10']);
  });

  it('never offers a value that is a valid answer to an active challenge', () => {
    const result = draw(12);
    if (!result.ok) throw new Error('expected cards');
    for (const delivered of result.cards) {
      expect(['7', '8', '9']).not.toContain(delivered.displayValue);
    }
  });

  it('stays inside the configured range', () => {
    const narrow = createMathPenaltyFallbackProvider({ minValue: 5, maxValue: 12 }); // unused in range: 5, 6, 10, 11
    const result = draw(4, narrow);
    if (!result.ok) throw new Error('expected four cards');
    expect(result.cards.map((c) => Number(c.displayValue)).sort((a, b) => a - b)).toEqual([5, 6, 10, 11]);
  });

  it('rejects an id collision and moves on to the next candidate', () => {
    const collide = [...outside(), { id: 'penalty-6', displayValue: 'text that is not a number' }];
    expect(values(draw(1, provider018, collide))).toEqual(['10']);
  });
});

describe('Math fallback: exhaustion, bound, and refusing to guess', () => {
  it('reports EXHAUSTED, atomically, when the range cannot supply every owed card', () => {
    const narrow = createMathPenaltyFallbackProvider({ minValue: 5, maxValue: 12 });
    const result = draw(5, narrow); // only four unused values exist
    expect(result.ok).toBe(false);
    if (result.ok || !('exhausted' in result)) throw new Error('expected exhaustion');
    expect(result.exhausted.code).toBe('PENALTY_CARD_EXHAUSTED');
    expect(result.exhausted.details.fallback).toMatchObject({ status: 'EXHAUSTED', candidatesTried: 4 });
    expect('cards' in result).toBe(false);
  });

  it('reports EXHAUSTED with nothing tried when every value in the range is used', () => {
    const everyValue = Array.from({ length: 19 }, (_, i) =>
      card(i === 7 ? 'k1' : i === 8 ? 'k2' : i === 9 ? 'k3' : `used-${i}`, i),
    );
    const result = draw(1, provider018, everyValue);
    if (result.ok || !('exhausted' in result)) throw new Error('expected exhaustion');
    expect(result.exhausted.details.fallback).toMatchObject({ status: 'EXHAUSTED', candidatesTried: 0 });
  });

  it('honours the candidate bound', () => {
    const result = draw(2, provider018, outside(), { maxCandidates: 1 });
    if (result.ok || !('exhausted' in result)) throw new Error('expected exhaustion');
    expect(result.exhausted.details.fallback).toMatchObject({ status: 'LIMIT_REACHED', candidatesTried: 1, maxCandidates: 1 });
  });

  it('never guesses: a challenge whose answer cannot be found leaves every candidate invalid', () => {
    const withGhost = [...active, challengeFor('c4', 'ghost-card')];
    const attempt = (provider: typeof provider018) =>
      drawPenaltyCards(
        { drawPile: [], cardsOutsideDrawPile: outside() },
        [req('a')],
        { activeChallenges: withGhost, fallback: provider, numericAnswers: true },
      );
    const small = attempt(provider018); // 15 unused values: runs out before the bound
    if (small.ok || !('exhausted' in small)) throw new Error('expected exhaustion');
    expect(small.exhausted.details.fallback).toMatchObject({ status: 'EXHAUSTED', candidatesTried: 15 });
    expect(small.exhausted.details.fallback.rejections).toEqual({ INVALID_VALUE: 15 });

    const wide = attempt(createMathPenaltyFallbackProvider({ minValue: 0, maxValue: 200 }));
    if (wide.ok || !('exhausted' in wide)) throw new Error('expected exhaustion');
    expect(wide.exhausted.details.fallback).toMatchObject({ status: 'LIMIT_REACHED', candidatesTried: 50 });
    expect(wide.exhausted.details.fallback.rejections).toEqual({ INVALID_VALUE: 50 });
  });
});

describe('Math fallback: end to end, one penalty at a time until the range is used up', () => {
  it('delivers 15 unique cards from a 19-value range with 4 values in play, then reports exhaustion', () => {
    let inPlay = outside();
    const delivered: string[] = [];
    let outcome: PenaltyDrawResult | undefined;
    for (let attempt = 0; attempt < 40; attempt += 1) {
      outcome = draw(1, provider018, inPlay);
      if (!outcome.ok) break;
      delivered.push(...outcome.cards.map((c) => c.displayValue));
      inPlay = [...inPlay, ...outcome.cards];
    }
    expect(delivered).toHaveLength(15);
    expect(new Set(delivered).size).toBe(15);
    expect(delivered.every((v) => Number(v) >= 0 && Number(v) <= 18)).toBe(true);
    expect(outcome?.ok).toBe(false);
    expect(outcome && !outcome.ok && 'exhausted' in outcome && outcome.exhausted.details.cardsInPlay).toBe(19);

    // The whole game is still globally unique.
    const deck: GeneratedDeck = {
      direction: 'factToSubject',
      challenges: active,
      answerCards: inPlay,
      meta: { targetCardCount: inPlay.length, actualCardCount: inPlay.length },
    };
    expect(validateUniqueness(deck, { numericAnswers: true }).ok).toBe(true);
  });

  it('serves a two-draw event (a missed challenge: human and Beepy) with two distinct cards', () => {
    const result = drawPenaltyCards(
      { drawPile: [], cardsOutsideDrawPile: outside() },
      [{ playerId: 'human', reason: 'MISSED_CHALLENGE' }, { playerId: 'beepy', reason: 'INVALID_ACTION' }],
      { activeChallenges: active, fallback: provider018, numericAnswers: true },
    );
    if (!result.ok) throw new Error('expected two cards');
    expect(result.cards).toHaveLength(2);
    expect(new Set(result.cards.map((c) => c.displayValue)).size).toBe(2);
  });

  it('reports a structured invalid-count result for a bad bound, not exhaustion', () => {
    const result = draw(1, provider018, outside(), { maxCandidates: 0 });
    expect(result.ok).toBe(false);
    expect('invalid' in result && result.invalid.code).toBe(C.invalidCount);
  });
});

describe('Math generator boundary (Task 5; result type since M4 G1)', () => {
  // M4 decision M4-1: generate() returns a structured result and never throws for a
  // bad request. An empty request is not a valid Math request, so no deck results.
  it('returns a structured failure with no deck for an empty request, without throwing', () => {
    const generator = new MathDeckGenerator();
    expect(generator.app).toBe('math');
    let result: ReturnType<MathDeckGenerator['generate']> | undefined;
    expect(() => {
      result = generator.generate({} as never);
    }).not.toThrow();
    expect(result?.ok).toBe(false);
    expect(result && 'deck' in result).toBe(false);
    if (result && !result.ok) {
      expect(result.issues.length).toBeGreaterThan(0);
    }
  });
});
