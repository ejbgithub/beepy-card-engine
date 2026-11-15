/**
 * Regression - the integrated validation pipeline (Tasks 7-11), all four
 * (app style, generation direction) combinations.
 *
 * A valid 9-challenge, 24-card competitive deck passes every stage. Each injected
 * defect must be caught by exactly the stages that should see it, and every other
 * stage must stay clean, so a change that makes a stage too strict or too lenient
 * shows up here.
 */

import { describe, expect, it } from 'vitest';
import {
  DECK_VALIDATION_CODES as C,
  validateChallengeMapping,
  validateDeckSize,
  validateDualStartingHands,
  validateUniqueness,
  type DeckValidationResult,
} from '../src/index.js';
import {
  COMBOS,
  buildDeck,
  fullMatrix,
  isNumericStyle,
  type MutableDeck,
  type MutableMatrix,
} from './fixtures.js';

type Hands = [string[], string[]];
interface Scenario {
  deck: MutableDeck;
  matrix: MutableMatrix;
  hands: Hands;
}
type Stage = 'mapping' | 'uniqueness' | 'size' | 'hands';

const baseHands = (): Hands => [
  ['correct-0', 'correct-1', 'correct-2', 'distractor-0', 'distractor-1'],
  ['correct-3', 'correct-4', 'correct-5', 'distractor-2', 'distractor-3'],
];

function run({ deck, matrix, hands }: Scenario, numericAnswers: boolean): Record<Stage, DeckValidationResult> {
  return {
    mapping: validateChallengeMapping(deck, matrix),
    uniqueness: validateUniqueness(deck, { numericAnswers }),
    size: validateDeckSize(deck, 'vsBeepy'),
    hands: validateDualStartingHands(deck, hands, { numericAnswers }),
  };
}

const DEFECTS: ReadonlyArray<readonly [string, (s: Scenario) => void, Partial<Record<Stage, string[]>>]> = [
  [
    'a challenge designates a card that is not in the deck',
    (s) => { s.deck.challenges[0]!.correctAnswerCardId = 'no-such-card'; },
    { mapping: [C.correctCardNotFound] },
  ],
  [
    'one card is a valid answer to two challenges',
    (s) => { s.matrix['challenge-4']!['correct-1'] = true; },
    { mapping: [C.cardValidForMultipleChallenges, C.multipleValidCardsForChallenge] },
  ],
  [
    'the designated card is evaluated as not valid',
    (s) => { s.matrix['challenge-2']!['correct-2'] = false; },
    { mapping: [C.designatedCardNotValid] },
  ],
  [
    'two cards show the same text',
    (s) => { s.deck.answerCards[20]!.displayValue = s.deck.answerCards[3]!.displayValue; },
    { mapping: [C.duplicateDisplayText], uniqueness: [C.duplicateDisplayValue], hands: [C.handValueCollidesWithDeck] },
  ],
  [
    'two cards share an id',
    (s) => {
      s.deck.answerCards[15]!.id = 'correct-0';
      s.matrix = fullMatrix(s.deck);
    },
    { uniqueness: [C.duplicateCardId] },
  ],
  [
    'the deck has more cards than its target',
    (s) => { s.deck.meta.targetCardCount = 20; },
    { size: [C.deckExceedsTarget] },
  ],
  [
    'meta.actualCardCount does not match the cards present',
    (s) => { s.deck.meta.actualCardCount = 23; },
    { size: [C.cardCountMismatch] },
  ],
  [
    'only 13 cards remain, leaving no penalty reserve',
    (s) => {
      s.deck.answerCards = s.deck.answerCards.filter((c) => !/^distractor-(4|5|6|7|8|9|10|11|12|13|14)$/.test(c.id));
      s.deck.meta.actualCardCount = s.deck.answerCards.length;
      s.matrix = fullMatrix(s.deck);
    },
    { size: [C.deckBelowMinimum, C.insufficientDeckData], hands: [C.noPenaltyReserve] },
  ],
  [
    'a card is dealt into both hands',
    (s) => { s.hands[1][0] = 'correct-0'; },
    { hands: [C.dualHandSharedCard] },
  ],
  [
    'a hand holds only one correct card',
    (s) => { s.hands[0] = ['correct-0', 'distractor-0', 'distractor-1', 'distractor-4', 'distractor-5']; },
    { hands: [C.handCorrectCountOutOfRange] },
  ],
  [
    'a hand has four cards',
    (s) => { s.hands[1] = s.hands[1].slice(0, 4); },
    { hands: [C.handWrongSize] },
  ],
];

describe.each(COMBOS)('integrated pipeline regression: %s / %s', (style, direction) => {
  const numeric = isNumericStyle(style, direction);
  const scenario = (): Scenario => {
    const deck = buildDeck({ style, direction, correct: 9, distractors: 15, target: 24 });
    return { deck, matrix: fullMatrix(deck), hands: baseHands() };
  };

  it('a valid competitive deck and deal pass every stage', () => {
    const results = run(scenario(), numeric);
    for (const stage of Object.keys(results) as Stage[]) {
      expect(results[stage].issues, stage).toEqual([]);
    }
  });

  it.each(DEFECTS)('%s', (_label, inject, expected) => {
    const s = scenario();
    inject(s);
    const results = run(s, numeric);
    for (const stage of ['mapping', 'uniqueness', 'size', 'hands'] as Stage[]) {
      const codes = results[stage].issues.map((i) => i.code);
      const wanted = expected[stage];
      if (wanted === undefined) {
        expect(codes, `${stage} should stay clean`).toEqual([]);
      } else {
        expect(results[stage].ok, stage).toBe(false);
        for (const code of wanted) expect(codes, stage).toContain(code);
      }
    }
  });
});
