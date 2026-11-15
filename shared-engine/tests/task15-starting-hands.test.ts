/**
 * Task 15 - Starting-hand tests, single and dual-player (Req 7.1, 7.2).
 *
 *   valid-starting-hand-composition     -> Req 4.1-4.4
 *   competitive-dual-hand-feasibility   -> Req 4.4, 4.5 (pipeline stage 6)
 *
 * Run for all four (app style, generation direction) combinations.
 */

import { describe, expect, it } from 'vitest';
import {
  DECK_VALIDATION_CODES as C,
  COMPETITIVE_HAND_COUNT,
  MAX_CORRECT_IN_STARTING_HAND,
  MIN_CORRECT_IN_STARTING_HAND,
  MIN_PENALTY_RESERVE,
  STARTING_HAND_SIZE,
  canSupplyHands,
  checkDualHandFeasibility,
  checkStartingHandFeasibility,
  countCorrectAndDistractors,
  validateDualStartingHands,
  validateStartingHand,
} from '../src/index.js';
import {
  COMBOS,
  buildDeck,
  cloneDeck,
  combinations,
  isNumericStyle,
  permutations,
  seededRandom,
  shuffle,
  type MutableDeck,
} from './fixtures.js';

const issue = (code: string, path?: string) =>
  expect.objectContaining(path === undefined ? { code } : { code, path });

const correctIds = (n: number, from = 0): string[] => Array.from({ length: n }, (_, i) => `correct-${from + i}`);
const distractorIds = (n: number, from = 0): string[] => Array.from({ length: n }, (_, i) => `distractor-${from + i}`);

describe('starting-hand constants (master spec 4)', () => {
  it('a hand is five cards with two or three correct; a competitive deal is two hands plus one reserve card', () => {
    expect(STARTING_HAND_SIZE).toBe(5);
    expect(MIN_CORRECT_IN_STARTING_HAND).toBe(2);
    expect(MAX_CORRECT_IN_STARTING_HAND).toBe(3);
    expect(COMPETITIVE_HAND_COUNT).toBe(2);
    expect(MIN_PENALTY_RESERVE).toBe(1);
  });
});

// ---------------------------------------------------------------------------
describe.each(COMBOS)('valid-starting-hand-composition (Req 4.1-4.4): %s / %s', (style, direction) => {
  const deck = buildDeck({ style, direction, correct: 5, distractors: 6 });
  const numericAnswers = isNumericStyle(style, direction);
  const options = { numericAnswers };

  it('accepts two correct cards and three distractors', () => {
    expect(validateStartingHand(deck, [...correctIds(2), ...distractorIds(3)], options).ok).toBe(true);
  });

  it('accepts three correct cards and two distractors', () => {
    expect(validateStartingHand(deck, [...correctIds(3), ...distractorIds(2)], options).ok).toBe(true);
  });

  it('does not depend on the order of the cards in the hand (all 120 orderings)', () => {
    const orderings = permutations([...correctIds(2), ...distractorIds(3)]);
    expect(orderings).toHaveLength(120);
    for (const hand of orderings) {
      expect(validateStartingHand(deck, hand, options).ok).toBe(true);
    }
  });

  it.each([0, 1, 4, 5])('rejects a hand with %i correct cards', (k) => {
    const hand = [...correctIds(k), ...distractorIds(5 - k)];
    const result = validateStartingHand(deck, hand, options);
    expect(result.ok).toBe(false);
    expect(result.issues).toEqual([issue(C.handCorrectCountOutOfRange, 'hand')]);
  });

  it.each([0, 1, 2, 3, 4, 6, 7])('rejects a hand of %i cards', (size) => {
    const pool = [...correctIds(3), ...distractorIds(5)];
    const result = validateStartingHand(deck, pool.slice(0, size), options);
    expect(result.issues).toContainEqual(issue(C.handWrongSize, 'hand'));
  });

  it('rejects an unknown card at its exact position', () => {
    const hand = [...correctIds(2), ...distractorIds(2), 'no-such-card'];
    expect(validateStartingHand(deck, hand, options).issues).toContainEqual(issue(C.handUnknownCard, 'hand[4]'));
  });

  it('rejects a repeated card at the repeat only, and counts it once toward correctness', () => {
    const repeated = [...correctIds(2), 'distractor-0', 'distractor-0', 'distractor-1'];
    const result = validateStartingHand(deck, repeated, options);
    expect(result.issues).toContainEqual(issue(C.handDuplicateCard, 'hand[3]'));
    expect(result.issues).not.toContainEqual(issue(C.handDuplicateCard, 'hand[2]'));
    expect(result.issues.some((i) => i.code === C.handCorrectCountOutOfRange)).toBe(false);

    const sameCorrect = ['correct-0', 'correct-0', 'correct-0', 'distractor-0', 'distractor-1'];
    expect(validateStartingHand(deck, sameCorrect, options).issues).toContainEqual(
      issue(C.handCorrectCountOutOfRange, 'hand'),
    );
  });

  it('rejects two different cards that show the same value', () => {
    const clone = cloneDeck(deck);
    clone.answerCards.find((c) => c.id === 'distractor-1')!.displayValue =
      clone.answerCards.find((c) => c.id === 'distractor-0')!.displayValue;
    const hand = [...correctIds(2), 'distractor-0', 'distractor-1', 'distractor-2'];
    expect(validateStartingHand(clone, hand, options).issues).toContainEqual(
      issue(C.handDuplicateDisplayValue, 'hand[3]'),
    );
  });

  it('reports every problem at once', () => {
    const result = validateStartingHand(deck, ['correct-0', 'ghost', 'distractor-0', 'distractor-0'], options);
    const codes = result.issues.map((i) => i.code);
    expect(codes).toEqual(
      expect.arrayContaining([C.handWrongSize, C.handUnknownCard, C.handDuplicateCard, C.handCorrectCountOutOfRange]),
    );
  });

  it('exhaustive: of all 462 five-card hands, exactly those with 2 or 3 correct cards are valid', () => {
    const allIds = deck.answerCards.map((c) => c.id);
    const designated = new Set(deck.challenges.map((c) => c.correctAnswerCardId));
    const hands = combinations(allIds, 5);
    expect(hands).toHaveLength(462);
    let valid = 0;
    for (const hand of hands) {
      const correct = hand.filter((id) => designated.has(id)).length;
      const result = validateStartingHand(deck, hand, options);
      if (correct === 2 || correct === 3) {
        expect(result.ok).toBe(true);
        valid += 1;
      } else {
        expect(result.issues).toEqual([issue(C.handCorrectCountOutOfRange, 'hand')]);
      }
    }
    // C(5,2)*C(6,3) + C(5,3)*C(6,2) = 200 + 150
    expect(valid).toBe(350);
  });

  it('the card contract carries no correctness field (nothing on a card reveals whether it is correct)', () => {
    for (const cardEntry of deck.answerCards) {
      expect(Object.keys(cardEntry).every((key) => ['id', 'displayValue', 'explanationByChallengeId'].includes(key))).toBe(true);
    }
  });
});

describe('valid-starting-hand-composition: numeric answers (Math)', () => {
  const deck = buildDeck({ style: 'math', direction: 'factToSubject', correct: 5, distractors: 6 });
  const clone = cloneDeck(deck);
  clone.answerCards.find((c) => c.id === 'distractor-1')!.displayValue = '040'; // equals distractor-0 ("40") numerically
  const hand = [...correctIds(2), 'distractor-0', 'distractor-1', 'distractor-2'];

  it('rejects "040" next to "40" in numeric mode', () => {
    expect(validateStartingHand(clone, hand, { numericAnswers: true }).issues).toContainEqual(
      issue(C.handDuplicateDisplayValue, 'hand[3]'),
    );
  });

  it('allows them in text mode', () => {
    expect(validateStartingHand(clone, hand).ok).toBe(true);
  });
});

describe('valid-starting-hand-composition: feasibility', () => {
  it('matches a brute-force oracle for every deck of 0-8 correct and 0-8 distractor cards', () => {
    for (let c = 0; c <= 8; c += 1) {
      for (let d = 0; d <= 8; d += 1) {
        const expected = [2, 3].some((k) => c >= k && d >= 5 - k);
        const deck = buildDeck({ style: 'math', correct: c, distractors: d });
        expect(checkStartingHandFeasibility(deck).ok).toBe(expected);
      }
    }
  });

  it('reports the counts when infeasible', () => {
    const result = checkStartingHandFeasibility(buildDeck({ style: 'clinical', correct: 2, distractors: 2 }));
    expect(result.issues).toEqual([issue(C.startingHandInfeasible, 'answerCards')]);
    expect(result.issues[0]?.message).toContain('2 correct card(s) and 2 distractor(s)');
  });

  it('does not count a designation that points outside the deck as a correct card', () => {
    const enough = cloneDeck(buildDeck({ style: 'math', correct: 2, distractors: 3 }));
    expect(checkStartingHandFeasibility(enough).ok).toBe(true);
    enough.challenges[0]!.correctAnswerCardId = 'not-in-the-deck';
    expect(checkStartingHandFeasibility(enough).ok).toBe(false);
  });
});

// ---------------------------------------------------------------------------
describe.each(COMBOS)('competitive-dual-hand-feasibility (Req 4.4, 4.5): %s / %s', (style, direction) => {
  const deck = buildDeck({ style, direction, correct: 9, distractors: 15 });
  const options = { numericAnswers: isNumericStyle(style, direction) };
  const handA = [...correctIds(3, 0), ...distractorIds(2, 0)];
  const handB = [...correctIds(3, 3), ...distractorIds(2, 2)];

  it.each([
    ['3 + 3 correct', [handA, handB]],
    ['2 + 3 correct', [[...correctIds(2, 0), ...distractorIds(3, 0)], [...correctIds(3, 3), ...distractorIds(2, 3)]]],
    ['3 + 2 correct', [handA, [...correctIds(2, 3), ...distractorIds(3, 2)]]],
    ['2 + 2 correct', [[...correctIds(2, 0), ...distractorIds(3, 0)], [...correctIds(2, 3), ...distractorIds(3, 3)]]],
  ] as const)('accepts two simultaneous valid hands (%s)', (_label, hands) => {
    expect(validateDualStartingHands(deck, [hands[0], hands[1]], options).ok).toBe(true);
  });

  it('validates each hand and names the hand in the path and message', () => {
    const shortHand = validateDualStartingHands(deck, [correctIds(3), handB], options);
    expect(shortHand.issues).toContainEqual(issue(C.handWrongSize, 'hands[0]'));
    expect(shortHand.issues.find((i) => i.code === C.handWrongSize)?.message.startsWith('Hand 1:')).toBe(true);

    const unknown = validateDualStartingHands(deck, [handA, [...correctIds(3, 3), 'distractor-2', 'ghost']], options);
    expect(unknown.issues).toContainEqual(issue(C.handUnknownCard, 'hands[1][4]'));

    const weak = validateDualStartingHands(deck, [handA, ['correct-3', ...distractorIds(4, 2)]], options);
    expect(weak.issues).toContainEqual(issue(C.handCorrectCountOutOfRange, 'hands[1]'));
  });

  it('rejects a card dealt into both hands, at the repeat, without also calling it a shared value', () => {
    const result = validateDualStartingHands(deck, [handA, ['correct-0', 'correct-4', 'correct-5', 'distractor-2', 'distractor-3']], options);
    expect(result.issues).toContainEqual(issue(C.dualHandSharedCard, 'hands[1][0]'));
    expect(result.issues.find((i) => i.code === C.dualHandSharedCard)?.message).toContain('hands[0][0]');
    expect(result.issues.some((i) => i.code === C.dualHandSharedDisplayValue)).toBe(false);
  });

  it('rejects two different cards, one per hand, that show the same value', () => {
    const clone = cloneDeck(deck);
    clone.answerCards.find((c) => c.id === 'distractor-2')!.displayValue =
      clone.answerCards.find((c) => c.id === 'distractor-0')!.displayValue;
    expect(validateDualStartingHands(clone, [handA, handB], options).issues).toContainEqual(
      issue(C.dualHandSharedDisplayValue, 'hands[1][3]'),
    );
  });

  it('rejects a hand value that is also shown by a card left in the remaining deck', () => {
    const clone = cloneDeck(deck);
    clone.answerCards.find((c) => c.id === 'distractor-10')!.displayValue =
      clone.answerCards.find((c) => c.id === 'distractor-0')!.displayValue;
    const result = validateDualStartingHands(clone, [handA, handB], options);
    expect(result.issues).toContainEqual(issue(C.handValueCollidesWithDeck, 'hands[0][3]'));
  });

  describe('penalty reserve', () => {
    const tight = (distractors: number): MutableDeck => buildDeck({ style, direction, correct: 9, distractors });

    it('accepts a 14-card deck: exactly one unused distractor remains', () => {
      expect(validateDualStartingHands(tight(5), [handA, handB], options).ok).toBe(true);
    });

    it('rejects a 13-card deck: every distractor is dealt, so no reserve remains', () => {
      const result = validateDualStartingHands(tight(4), [handA, handB], options);
      expect(result.issues).toContainEqual(issue(C.noPenaltyReserve, 'answerCards'));
    });

    it('does not count unused correct cards as a reserve', () => {
      const result = validateDualStartingHands(tight(4), [handA, handB], options);
      expect(result.issues.some((i) => i.code === C.noPenaltyReserve)).toBe(true);
      expect(countCorrectAndDistractors(tight(4))).toEqual({ correct: 9, distractors: 4 });
    });

    it('does not count a reserve card whose value clashes with a hand card', () => {
      const clone = cloneDeck(tight(5));
      clone.answerCards.find((c) => c.id === 'distractor-4')!.displayValue =
        clone.answerCards.find((c) => c.id === 'distractor-0')!.displayValue;
      const result = validateDualStartingHands(clone, [handA, handB], options);
      expect(result.issues.some((i) => i.code === C.noPenaltyReserve)).toBe(true);
    });
  });

  describe('feasibility of the deck', () => {
    it.each([
      [9, 15, true],
      [9, 5, true], // the 14-card minimum
      [9, 4, false], // 13 cards
      [4, 7, true], // two hands of 2 correct cards each
      [4, 6, false],
      [3, 20, false], // not enough correct cards for two hands
      [0, 0, false],
    ])('%i correct + %i distractors -> feasible: %s', (correct, distractors, expected) => {
      const candidate = buildDeck({ style, direction, correct, distractors });
      const result = checkDualHandFeasibility(candidate);
      expect(result.ok).toBe(expected);
      if (!expected) {
        expect(result.issues).toEqual([issue(C.dualHandInfeasible, 'answerCards')]);
        expect(result.issues[0]?.message).toContain(`${correct} correct card(s) and ${distractors} distractor(s)`);
      }
    });
  });
});

describe('competitive-dual-hand-feasibility: counting rule', () => {
  /** Independent brute force over every per-hand correct count. */
  function brute(correct: number, distractors: number, hands: number, reserve: number): boolean {
    const walk = (remaining: number, usedCorrect: number): boolean => {
      if (remaining === 0) {
        return correct >= usedCorrect && distractors >= 5 * hands - usedCorrect + reserve;
      }
      return [2, 3].some((k) => walk(remaining - 1, usedCorrect + k));
    };
    return walk(hands, 0);
  }

  it('canSupplyHands matches brute force for 1-3 hands, reserves 0-2, 0-14 correct, 0-20 distractors', () => {
    let cases = 0;
    for (const hands of [1, 2, 3]) {
      for (const reserve of [0, 1, 2]) {
        for (let c = 0; c <= 14; c += 1) {
          for (let d = 0; d <= 20; d += 1) {
            expect(canSupplyHands(c, d, hands, reserve)).toBe(brute(c, d, hands, reserve));
            cases += 1;
          }
        }
      }
    }
    expect(cases).toBe(3 * 3 * 15 * 21);
  });

  it('agrees with the single-hand feasibility check when there is one hand and no reserve', () => {
    for (let c = 0; c <= 8; c += 1) {
      for (let d = 0; d <= 8; d += 1) {
        const deck = buildDeck({ style: 'math', correct: c, distractors: d });
        expect(canSupplyHands(c, d, 1, 0)).toBe(checkStartingHandFeasibility(deck).ok);
      }
    }
  });

  it('counts distinct deck cards only', () => {
    const deck = cloneDeck(buildDeck({ style: 'math', correct: 3, distractors: 3 }));
    deck.answerCards.push({ id: 'correct-0', displayValue: '999' }); // repeated id
    expect(countCorrectAndDistractors(deck)).toEqual({ correct: 3, distractors: 3 });
  });
});

describe('competitive-dual-hand-feasibility: randomized deals against an independent oracle', () => {
  function oracle(deck: MutableDeck, a: readonly string[], b: readonly string[]): boolean {
    const designated = new Set(deck.challenges.map((c) => c.correctAnswerCardId));
    const known = new Set(deck.answerCards.map((c) => c.id));
    const valid = (hand: readonly string[]): boolean =>
      hand.length === 5 &&
      hand.every((id) => known.has(id)) &&
      new Set(hand).size === 5 &&
      [2, 3].includes(hand.filter((id) => designated.has(id)).length);
    if (!valid(a) || !valid(b) || a.some((id) => b.includes(id))) return false;
    const dealt = new Set([...a, ...b]);
    return deck.answerCards.some((c) => !dealt.has(c.id) && !designated.has(c.id));
  }

  it('agrees on 2400 random deals, covering valid and invalid outcomes', () => {
    const random = seededRandom(15);
    let valid = 0;
    let invalid = 0;
    for (const [style, direction] of COMBOS) {
      const deck = buildDeck({ style, direction, correct: 9, distractors: 15 });
      const options = { numericAnswers: isNumericStyle(style, direction) };
      const correctPool = correctIds(9);
      const distractorPool = distractorIds(15);
      const dealHand = (): string[] => {
        const k = Math.floor(random() * 6);
        const hand = [
          ...shuffle(correctPool, random).slice(0, k),
          ...shuffle(distractorPool, random).slice(0, 5 - k),
        ];
        const roll = random();
        if (roll < 0.08) hand[Math.floor(random() * 5)] = hand[Math.floor(random() * 5)] as string; // repeat a card
        else if (roll < 0.12) hand[Math.floor(random() * 5)] = 'ghost-card'; // unknown card
        else if (roll < 0.17) hand.pop(); // wrong size
        return shuffle(hand, random);
      };
      for (let run = 0; run < 600; run += 1) {
        const a = dealHand();
        const b = dealHand();
        const expected = oracle(deck, a, b);
        expect(validateDualStartingHands(deck, [a, b], options).ok).toBe(expected);
        if (expected) valid += 1;
        else invalid += 1;
      }
    }
    expect(valid).toBeGreaterThan(50);
    expect(invalid).toBeGreaterThan(500);
  });
});
