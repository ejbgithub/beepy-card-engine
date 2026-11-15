/**
 * Starting-hand validation and feasibility, single hand (Milestone M2, Task 9).
 *
 * Implements validation pipeline stage 6 (design) for ONE hand (Req 4.1-4.4;
 * master spec section 4). A starting hand must:
 *   - contain exactly five cards (`STARTING_HAND_SIZE`),
 *   - contain five DISTINCT cards that exist in the deck,
 *   - contain two or three cards that are the designated correct answer to a
 *     currently displayed challenge (the remainder are distractors), and
 *   - not violate display-value uniqueness (no two cards show the same value).
 *
 * `validateStartingHand` checks a given hand. `checkStartingHandFeasibility`
 * checks that the deck CAN supply such a hand (enough correct cards and enough
 * distractors) without dealing one - dealing is not part of Task 9.
 *
 * "Currently displayed challenges": at the start of a game every challenge in
 * the deck is displayed, so a card is "correct" when it is some challenge's
 * `correctAnswerCardId`.
 *
 * Not machine-checkable at this layer (documented, not faked):
 *   - Non-leak (Req 4.3): `GeneratedAnswerCard` carries no correctness field, so
 *     the data does not reveal correctness. Whether a dealer or UI reveals which
 *     cards are correct (ordering, styling) is a dealing/presentation rule for
 *     later milestones.
 *   - Plausible distractors: plausibility is a generator concern (design D8, no
 *     padding with absurd values), not verifiable from card text here.
 *
 * Out of scope (later tasks): two-player hands and the penalty-draw reserve
 * (Tasks 10-11), exhaustion (Task 12), generation, gameplay, Beepy AI, UI.
 * Subject-neutral; no DOM/UI/framework dependency.
 *
 * References:
 * - .kiro/specs/educational-data-schema/requirements.md (Req 4.1-4.4)
 * - .kiro/specs/educational-data-schema/design.md (pipeline stage 6, D7)
 * - docs/master-spec-v1.1.md section 4
 */

import type { GeneratedDeck } from './generated-deck.js';
import {
  DECK_VALIDATION_CODES as CODES,
  deckIssue,
  deckResult,
  type DeckValidationIssue,
  type DeckValidationResult,
} from './deck-issues.js';
import { canonicalNumber } from './uniqueness.js';

/** Cards in every starting hand (master spec section 4). */
export const STARTING_HAND_SIZE = 5;
/** Minimum correct-answer cards in a starting hand. */
export const MIN_CORRECT_IN_STARTING_HAND = 2;
/** Maximum correct-answer cards in a starting hand. */
export const MAX_CORRECT_IN_STARTING_HAND = 3;

/** Options for starting-hand validation. */
export interface StartingHandOptions {
  /** Compare display values as numbers (Math), as in `validateUniqueness`. */
  readonly numericAnswers?: boolean;
}

/** The set of card ids designated correct for some challenge in the deck. */
function designatedCorrectIds(deck: GeneratedDeck): Set<string> {
  return new Set(deck.challenges.map((challenge) => challenge.correctAnswerCardId));
}

/**
 * Validate one starting hand (an ordered list of card ids) against a deck.
 * Reports ALL issues found, each with a JSON-style path.
 */
export function validateStartingHand(
  deck: GeneratedDeck,
  handCardIds: readonly string[],
  options: StartingHandOptions = {},
): DeckValidationResult {
  const issues: DeckValidationIssue[] = [];
  const numeric = options.numericAnswers === true;
  const keyOf = (value: string): string | undefined =>
    numeric ? canonicalNumber(value) : value;

  if (handCardIds.length !== STARTING_HAND_SIZE) {
    issues.push(
      deckIssue(
        CODES.handWrongSize,
        `A starting hand must contain exactly ${STARTING_HAND_SIZE} cards; got ${handCardIds.length}.`,
        'hand',
      ),
    );
  }

  const displayById = new Map<string, string>();
  for (const card of deck.answerCards) {
    if (!displayById.has(card.id)) {
      displayById.set(card.id, card.displayValue);
    }
  }
  const correctIds = designatedCorrectIds(deck);

  const firstIndexOfCard = new Map<string, number>();
  const firstIndexOfDisplay = new Map<string, number>();
  let correctCount = 0;

  handCardIds.forEach((cardId, i) => {
    const path = `hand[${i}]`;
    const displayValue = displayById.get(cardId);
    if (displayValue === undefined) {
      issues.push(
        deckIssue(
          CODES.handUnknownCard,
          `Hand card "${cardId}" is not in the deck.`,
          path,
        ),
      );
      return;
    }

    const firstCard = firstIndexOfCard.get(cardId);
    if (firstCard !== undefined) {
      issues.push(
        deckIssue(
          CODES.handDuplicateCard,
          `Card "${cardId}" is already in hand[${firstCard}]; a hand needs distinct cards.`,
          path,
        ),
      );
      return;
    }
    firstIndexOfCard.set(cardId, i);

    if (correctIds.has(cardId)) {
      correctCount += 1;
    }

    const key = keyOf(displayValue);
    if (key === undefined) {
      return; // Non-numeric value is reported by validateUniqueness.
    }
    const firstDisplay = firstIndexOfDisplay.get(key);
    if (firstDisplay === undefined) {
      firstIndexOfDisplay.set(key, i);
    } else {
      issues.push(
        deckIssue(
          CODES.handDuplicateDisplayValue,
          `Display value "${displayValue}" repeats hand[${firstDisplay}]; a hand cannot hold two cards showing the same value.`,
          path,
        ),
      );
    }
  });

  if (
    correctCount < MIN_CORRECT_IN_STARTING_HAND ||
    correctCount > MAX_CORRECT_IN_STARTING_HAND
  ) {
    issues.push(
      deckIssue(
        CODES.handCorrectCountOutOfRange,
        `A starting hand must contain ${MIN_CORRECT_IN_STARTING_HAND} or ${MAX_CORRECT_IN_STARTING_HAND} correct cards; got ${correctCount}.`,
        'hand',
      ),
    );
  }

  return deckResult(issues);
}

/**
 * Check that a deck can supply a valid starting hand: there is a correct-card
 * count `k` in [2, 3] such that the deck has at least `k` correct cards and at
 * least `STARTING_HAND_SIZE - k` distractors (cards that are not any challenge's
 * designated correct card). Does not deal a hand and does not check uniqueness
 * (see `validateUniqueness`).
 */
export function checkStartingHandFeasibility(
  deck: GeneratedDeck,
): DeckValidationResult {
  const deckCardIds = new Set(deck.answerCards.map((card) => card.id));
  const correctInDeck = [...designatedCorrectIds(deck)].filter((id) =>
    deckCardIds.has(id),
  ).length;
  const distractorsInDeck = deckCardIds.size - correctInDeck;

  for (
    let k = MIN_CORRECT_IN_STARTING_HAND;
    k <= MAX_CORRECT_IN_STARTING_HAND;
    k += 1
  ) {
    if (correctInDeck >= k && distractorsInDeck >= STARTING_HAND_SIZE - k) {
      return deckResult([]);
    }
  }

  return deckResult([
    deckIssue(
      CODES.startingHandInfeasible,
      `The deck cannot supply a valid ${STARTING_HAND_SIZE}-card starting hand with ${MIN_CORRECT_IN_STARTING_HAND}-${MAX_CORRECT_IN_STARTING_HAND} correct cards: it has ${correctInDeck} correct card(s) and ${distractorsInDeck} distractor(s).`,
      'answerCards',
    ),
  ]);
}
