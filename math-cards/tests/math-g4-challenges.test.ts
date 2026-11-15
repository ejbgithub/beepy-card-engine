/**
 * M4 G4 - challenges and correct cards, chosen first (requirements 1.3, 4.1-4.3,
 * 7.1-7.2, 11.3). Every expectation is read back from the deck's TEXT with the
 * independent oracle.
 */

import { describe, expect, it } from 'vitest';
import { isValidId, type GeneratedDeck } from '@beepy/shared-engine';
import { generateMathDeck } from '../src/math-generator.js';
import {
  DIRECTIONS,
  LEVELS,
  MODES,
  basesOfPair,
  cardNumber,
  challengeCountFor,
  parsePair,
  promptSum,
  type Direction,
  type Level,
  type Mode,
} from './math-oracle.js';

const SEEDS = Array.from({ length: 25 }, (_, i) => i * 7919 + 3);

function deckFor(mode: Mode, level: Level, direction: Direction, seed: number): GeneratedDeck {
  const result = generateMathDeck({ mode, level, generationDirection: direction, seed });
  if (!result.ok) throw new Error(`generation failed: ${result.issues.map((i) => i.code).join(', ')}`);
  return result.deck;
}

/** The operands of a challenge, from the prompt (factToSubject) or its correct card. */
function operandsOf(deck: GeneratedDeck, index: number): readonly [number, number] {
  const challenge = deck.challenges[index]!;
  if (deck.direction === 'factToSubject') {
    const m = /^(\d+) \+ (\d+) = \?$/.exec(challenge.promptText)!;
    return [Number(m[1]), Number(m[2])];
  }
  const card = deck.answerCards.find((c) => c.id === challenge.correctAnswerCardId)!;
  return parsePair(card.displayValue)!;
}

describe.each(MODES)('challenges: %s', (mode) => {
  describe.each(LEVELS)('%s', (level) => {
    describe.each(DIRECTIONS)('%s', (direction) => {
      it('has the mode challenge count, distinct sums, in-range operands, and one correct card each', () => {
        for (const seed of SEEDS) {
          const deck = deckFor(mode, level, direction, seed);
          expect(deck.direction).toBe(direction);
          expect(deck.challenges).toHaveLength(challengeCountFor(mode));
          const sums = deck.challenges.map((c) => promptSum(c.promptText, direction));
          expect(new Set(sums).size).toBe(sums.length);

          const designated = deck.challenges.map((c) => c.correctAnswerCardId);
          expect(new Set(designated).size).toBe(designated.length);

          deck.challenges.forEach((challenge, i) => {
            const [a, b] = operandsOf(deck, i);
            expect(a + b).toBe(sums[i]);
            expect(a).toBeLessThanOrEqual(b);
            const bases = basesOfPair(a, b);
            expect(bases.length, `${a} + ${b} must belong to a level`).toBeGreaterThan(0);
            if (level !== 'mixed') expect(bases).toContain(level);
            const card = deck.answerCards.find((c) => c.id === challenge.correctAnswerCardId);
            expect(card, 'the designated card exists').toBeDefined();
            expect(cardNumber(card!.displayValue, direction)).toBe(sums[i]);
          });
        }
      });

      it('uses the approved prompt and card formats', () => {
        const deck = deckFor(mode, level, direction, 11);
        for (const challenge of deck.challenges) {
          if (direction === 'factToSubject') {
            expect(challenge.promptText).toMatch(/^\d+ \+ \d+ = \?$/);
          } else {
            expect(challenge.promptText).toMatch(/^Which addition expression equals \d+\?$/);
          }
        }
        for (const card of deck.answerCards) {
          if (direction === 'factToSubject') {
            expect(card.displayValue).toMatch(/^[1-9]\d*$/);
          } else {
            const pair = parsePair(card.displayValue);
            expect(pair, card.displayValue).toBeDefined();
            expect(pair![0]).toBeLessThanOrEqual(pair![1]);
          }
          expect(card.explanationByChallengeId).toBeUndefined();
        }
      });

      it('uses neutral ids that encode no sum, operand, or correctness, and valid sourceRefs', () => {
        const deck = deckFor(mode, level, direction, 23);
        deck.challenges.forEach((challenge, i) => {
          expect(challenge.id).toBe(`c${i + 1}`);
          const sum = promptSum(challenge.promptText, direction);
          expect(challenge.sourceRef.subjectId).toBe(`math.subject.sum-${sum}`);
          expect(isValidId(challenge.sourceRef.subjectId)).toBe(true);
          expect(isValidId(challenge.sourceRef.topicId!)).toBe(true);
          const [a, b] = operandsOf(deck, i);
          expect(challenge.sourceRef.topicId).toBe(`math.topic.sum-${sum}.add-${a}-${b}`);
        });
        deck.answerCards.forEach((card, k) => {
          expect(card.id).toBe(`m${k + 1}`);
          expect(card.id.startsWith('penalty-')).toBe(false);
          expect(card.id.startsWith('expr-')).toBe(false);
        });
      });
    });
  });
});

describe('board and card order carry no information', () => {
  it('the sum shown by c1 varies across seeds (challenges are not sorted)', () => {
    const firstSums = new Set(SEEDS.map((seed) => promptSum(deckFor('vsBeepy', 'oneDigit', 'factToSubject', seed).challenges[0]!.promptText, 'factToSubject')));
    expect(firstSums.size).toBeGreaterThan(5);
  });

  it('correct cards appear at every card position across seeds (ids do not reveal correctness)', () => {
    const positions = new Set<number>();
    for (let seed = 1; seed <= 200; seed += 1) {
      const deck = deckFor('solitaire', 'oneDigit', 'factToSubject', seed);
      const designated = new Set(deck.challenges.map((c) => c.correctAnswerCardId));
      deck.answerCards.forEach((card, k) => {
        if (designated.has(card.id)) positions.add(k);
      });
    }
    expect(positions.size).toBe(15);
  });
});

describe('mixed level', () => {
  it('draws from more than one base level across seeds and within decks', () => {
    const seen = new Set<string>();
    let multiLevelDecks = 0;
    for (const seed of SEEDS) {
      const deck = deckFor('vsBeepy', 'mixed', 'factToSubject', seed);
      const inDeck = new Set<string>();
      deck.challenges.forEach((_, i) => {
        const [a, b] = operandsOf(deck, i);
        for (const base of basesOfPair(a, b)) {
          seen.add(base);
          inDeck.add(base);
        }
      });
      if (inDeck.size > 1) multiLevelDecks += 1;
    }
    expect(seen).toEqual(new Set(['oneDigit', 'oneAndTwoDigit', 'twoDigit']));
    expect(multiLevelDecks).toBeGreaterThan(SEEDS.length / 2);
  });
});
