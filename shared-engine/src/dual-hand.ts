/**
 * Dual-player starting-hand validation, competitive (Milestone M2, Task 10).
 *
 * Implements validation pipeline stage 6 for the Player vs. Beepy case (Req 4.4,
 * 4.5; master spec section 7; Decision 3). Two hands are dealt SIMULTANEOUSLY:
 *   - each hand is a valid single starting hand (Task 9: five distinct known
 *     cards, two or three designated-correct, no repeated display value);
 *   - the hands are NON-OVERLAPPING: no card is in both hands, and no two cards
 *     (one per hand) show the same display value;
 *   - no hand card shares a display value with a card left in the REMAINING
 *     deck (cards in neither hand);
 *   - at least one unused, valid distractor remains for a penalty draw: a
 *     remaining card that is not any challenge's designated correct card, has a
 *     usable display value, and does not collide with a hand card's value.
 *
 * `checkDualHandFeasibility` checks that the deck CAN supply such a deal, using
 * the shared `canSupplyHands` counting rule (also used by Task 11 for a single
 * hand plus reserve). Nothing here deals cards; dealing and Beepy behavior are
 * later milestones.
 *
 * Scope (Task 10 only). No deck-size targets/minimums (Task 11), exhaustion
 * (Task 12), generation, gameplay, Beepy AI, or UI. Subject-neutral.
 *
 * References:
 * - .kiro/specs/educational-data-schema/requirements.md (Req 4.4, 4.5)
 * - .kiro/specs/educational-data-schema/design.md (pipeline stage 6, D8)
 * - docs/master-spec-v1.1.md section 7
 * - .kiro/steering/no-duplicate-card-invariant.md
 */

import type { GeneratedDeck } from './generated-deck.js';
import {
  DECK_VALIDATION_CODES as CODES,
  deckIssue,
  deckResult,
  type DeckValidationIssue,
  type DeckValidationResult,
} from './deck-issues.js';
import {
  STARTING_HAND_SIZE,
  MIN_CORRECT_IN_STARTING_HAND,
  MAX_CORRECT_IN_STARTING_HAND,
  validateStartingHand,
  type StartingHandOptions,
} from './starting-hand.js';
import { canonicalNumber } from './uniqueness.js';

/** Hands dealt at the start of a competitive game. */
export const COMPETITIVE_HAND_COUNT = 2;
/** Unused valid distractors a competitive deal must leave for penalty draws. */
export const MIN_PENALTY_RESERVE = 1;

/** The two starting hands as ordered lists of card ids. */
export type DualHands = readonly [readonly string[], readonly string[]];

/**
 * Count the distinct deck cards that are designated correct for some challenge
 * (`correct`) and the distinct deck cards that are not (`distractors`).
 */
export function countCorrectAndDistractors(deck: GeneratedDeck): {
  readonly correct: number;
  readonly distractors: number;
} {
  const deckIds = new Set(deck.answerCards.map((card) => card.id));
  const designated = new Set(
    deck.challenges.map((challenge) => challenge.correctAnswerCardId),
  );
  let correct = 0;
  for (const id of deckIds) {
    if (designated.has(id)) {
      correct += 1;
    }
  }
  return { correct, distractors: deckIds.size - correct };
}

/**
 * Can a pool of `correct` correct cards and `distractors` distractors supply
 * `handCount` starting hands (each of five cards with two or three correct
 * cards) while leaving at least `penaltyReserve` distractors unused?
 *
 * With S total correct cards across all hands, S must lie in
 * [2 * handCount, 3 * handCount], S <= correct, and the hands plus reserve need
 * (5 * handCount - S) + penaltyReserve <= distractors. A valid S exists exactly
 * when max(2n, 5n + reserve - distractors) <= min(correct, 3n).
 */
export function canSupplyHands(
  correct: number,
  distractors: number,
  handCount: number,
  penaltyReserve: number,
): boolean {
  const lowest = Math.max(
    MIN_CORRECT_IN_STARTING_HAND * handCount,
    STARTING_HAND_SIZE * handCount + penaltyReserve - distractors,
  );
  const highest = Math.min(correct, MAX_CORRECT_IN_STARTING_HAND * handCount);
  return lowest <= highest;
}

/**
 * Check that a deck can supply two valid, non-overlapping starting hands plus at
 * least one unused distractor for a penalty draw. Counting only; does not deal
 * and does not check uniqueness (see `validateUniqueness`).
 */
export function checkDualHandFeasibility(
  deck: GeneratedDeck,
): DeckValidationResult {
  const { correct, distractors } = countCorrectAndDistractors(deck);
  if (canSupplyHands(correct, distractors, COMPETITIVE_HAND_COUNT, MIN_PENALTY_RESERVE)) {
    return deckResult([]);
  }
  return deckResult([
    deckIssue(
      CODES.dualHandInfeasible,
      `The deck cannot supply ${COMPETITIVE_HAND_COUNT} valid ${STARTING_HAND_SIZE}-card starting hands (${MIN_CORRECT_IN_STARTING_HAND}-${MAX_CORRECT_IN_STARTING_HAND} correct cards each) plus ${MIN_PENALTY_RESERVE} unused penalty distractor: it has ${correct} correct card(s) and ${distractors} distractor(s).`,
      'answerCards',
    ),
  ]);
}

/**
 * Validate two simultaneously dealt starting hands against a deck. Reports ALL
 * issues found, each with a JSON-style path (`hands[0][i]`, `hands[1][i]`).
 */
export function validateDualStartingHands(
  deck: GeneratedDeck,
  hands: DualHands,
  options: StartingHandOptions = {},
): DeckValidationResult {
  const issues: DeckValidationIssue[] = [];
  const numeric = options.numericAnswers === true;
  const keyOf = (value: string): string | undefined =>
    numeric ? canonicalNumber(value) : value;

  // 1. Each hand must be a valid single starting hand (Task 9).
  hands.forEach((hand, h) => {
    for (const found of validateStartingHand(deck, hand, options).issues) {
      issues.push(
        deckIssue(
          found.code,
          `Hand ${h + 1}: ${found.message}`,
          found.path.replace(/^hand/, `hands[${h}]`),
        ),
      );
    }
  });

  const cardById = new Map<string, { readonly displayValue: string; readonly index: number }>();
  deck.answerCards.forEach((card, index) => {
    if (!cardById.has(card.id)) {
      cardById.set(card.id, { displayValue: card.displayValue, index });
    }
  });

  // 2. Non-overlapping: no shared card and no shared display value across hands.
  const firstHand0IndexOfCard = new Map<string, number>();
  const firstHand0IndexOfKey = new Map<string, number>();
  hands[0].forEach((cardId, i) => {
    const card = cardById.get(cardId);
    if (card === undefined) {
      return;
    }
    if (!firstHand0IndexOfCard.has(cardId)) {
      firstHand0IndexOfCard.set(cardId, i);
    }
    const key = keyOf(card.displayValue);
    if (key !== undefined && !firstHand0IndexOfKey.has(key)) {
      firstHand0IndexOfKey.set(key, i);
    }
  });
  hands[1].forEach((cardId, j) => {
    const card = cardById.get(cardId);
    if (card === undefined) {
      return;
    }
    const path = `hands[1][${j}]`;
    const sharedCard = firstHand0IndexOfCard.get(cardId);
    if (sharedCard !== undefined) {
      issues.push(
        deckIssue(
          CODES.dualHandSharedCard,
          `Card "${cardId}" is already dealt at hands[0][${sharedCard}]; the two hands must not overlap.`,
          path,
        ),
      );
      return;
    }
    const key = keyOf(card.displayValue);
    const sharedValue = key === undefined ? undefined : firstHand0IndexOfKey.get(key);
    if (sharedValue !== undefined) {
      issues.push(
        deckIssue(
          CODES.dualHandSharedDisplayValue,
          `Display value "${card.displayValue}" is also shown by hands[0][${sharedValue}]; the two hands cannot share a value.`,
          path,
        ),
      );
    }
  });

  // 3. Remaining deck: cards in neither hand.
  const dealt = new Set<string>([...hands[0], ...hands[1]]);
  const remaining = deck.answerCards
    .map((card, index) => ({ card, index }))
    .filter(({ card }) => !dealt.has(card.id));
  const firstRemainingIndexOfKey = new Map<string, number>();
  for (const { card, index } of remaining) {
    const key = keyOf(card.displayValue);
    if (key !== undefined && !firstRemainingIndexOfKey.has(key)) {
      firstRemainingIndexOfKey.set(key, index);
    }
  }
  hands.forEach((hand, h) => {
    hand.forEach((cardId, i) => {
      const card = cardById.get(cardId);
      if (card === undefined) {
        return;
      }
      const key = keyOf(card.displayValue);
      const clash = key === undefined ? undefined : firstRemainingIndexOfKey.get(key);
      if (clash !== undefined) {
        issues.push(
          deckIssue(
            CODES.handValueCollidesWithDeck,
            `Display value "${card.displayValue}" is also shown by answerCards[${clash}] in the remaining deck.`,
            `hands[${h}][${i}]`,
          ),
        );
      }
    });
  });

  // 4. Penalty reserve: an unused, valid distractor must remain.
  const designated = new Set(deck.challenges.map((challenge) => challenge.correctAnswerCardId));
  const handKeys = new Set<string>();
  for (const cardId of dealt) {
    const card = cardById.get(cardId);
    const key = card === undefined ? undefined : keyOf(card.displayValue);
    if (key !== undefined) {
      handKeys.add(key);
    }
  }
  const reserveAvailable = remaining.some(({ card }) => {
    const key = keyOf(card.displayValue);
    return !designated.has(card.id) && key !== undefined && !handKeys.has(key);
  });
  if (!reserveAvailable) {
    issues.push(
      deckIssue(
        CODES.noPenaltyReserve,
        `After dealing both hands no unused, valid distractor remains for a penalty draw (at least ${MIN_PENALTY_RESERVE} required).`,
        'answerCards',
      ),
    );
  }

  return deckResult(issues);
}
