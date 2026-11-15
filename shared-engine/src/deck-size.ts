/**
 * Deck-size targets and bounds (Milestone M2, Task 11; Decision 3; design D8).
 *
 * Subject-neutral rules for how large a deck may be and when a smaller deck is
 * acceptable:
 *   - Solitaire and Tutor (which reuses Solitaire dealing): five challenges, one
 *     five-card hand with two or three correct cards, plus at least one
 *     additional valid distractor for a penalty draw. No competitive 24-card
 *     target applies.
 *   - Competitive (Player vs. Beepy): nine shared challenges, two non-overlapping
 *     hands plus a penalty reserve, and a minimum of 14 cards (9 correct + 5
 *     distractors) - allowed only because those hands can actually be built.
 *   - The target is a CEILING. A SMALLER validated deck is allowed when the
 *     plausible value range cannot support the target, but a deck larger than
 *     its target is rejected, and a deck is never padded with implausible
 *     distractors (design D8; master spec section 10; Req 6.4). The spec says a
 *     smaller deck is permitted and never mentions a larger one; reading the
 *     target as a ceiling is an interpretation recorded in the development log.
 *   - Numeric inputs are checked: targets must be positive whole numbers and
 *     availability counts non-negative whole numbers, so NaN, fractions,
 *     negatives, and Infinity can never produce a successful plan.
 *
 * Where the numbers live: the competitive MATH target of 24 cards (9 correct + 15
 * distractors) is Math-specific and is defined in `math-cards/`. This module
 * only holds the subject-neutral bounds and the planner/validator that use a
 * caller-supplied target, so the shared engine stays subject-neutral. No
 * clinical target is defined because none is approved.
 *
 * Modes use the stable ids from master spec section 3. `vsPlayer` is not
 * included: it is planned architecture only, and its deck rules are not approved.
 *
 * Scope (Task 11 only). No exhaustion fallback (Task 12), generation of values,
 * gameplay, Beepy AI, or UI. `planDeckSize` is pure arithmetic on counts the
 * caller reports; it does not choose or create any card.
 *
 * References:
 * - .kiro/specs/educational-data-schema/requirements.md (Req 4.5, 4.6, 6.1, 6.4)
 * - .kiro/specs/educational-data-schema/design.md (D8)
 * - docs/master-spec-v1.1.md sections 3, 7, 10
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
} from './starting-hand.js';
import {
  COMPETITIVE_HAND_COUNT,
  MIN_PENALTY_RESERVE,
  canSupplyHands,
  countCorrectAndDistractors,
} from './dual-hand.js';

/** Game modes with approved deck-size rules (master spec section 3 ids). */
export const DECK_MODES = {
  solitaire: 'solitaire',
  tutor: 'tutor',
  vsBeepy: 'vsBeepy',
} as const;

export type DeckMode = (typeof DECK_MODES)[keyof typeof DECK_MODES];

/** Displayed challenges for Solitaire and Tutor. */
export const SOLITAIRE_CHALLENGE_COUNT = 5;
/** Displayed challenges for Player vs. Beepy. */
export const COMPETITIVE_CHALLENGE_COUNT = 9;
/** Competitive minimum deck size (Decision 3): 9 correct + 5 distractors. */
export const COMPETITIVE_MIN_CARD_COUNT = 14;

/** True when `value` is a whole number (safe integer) that is at least `min`. */
function isWholeNumberAtLeast(value: unknown, min: number): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= min;
}

/** True when `value` is one of the supported deck modes. */
export function isDeckMode(value: unknown): value is DeckMode {
  return (
    value === DECK_MODES.solitaire ||
    value === DECK_MODES.tutor ||
    value === DECK_MODES.vsBeepy
  );
}

/** Build the structured error for an unsupported mode. */
function invalidModeIssue(mode: unknown): DeckValidationIssue {
  return deckIssue(
    CODES.invalidMode,
    `Unsupported deck mode ${JSON.stringify(mode) ?? String(mode)}. Supported modes: ${Object.values(DECK_MODES).join(', ')}.`,
    'mode',
  );
}

/**
 * Challenges displayed in a mode. Throws `RangeError` for an unsupported mode
 * instead of silently assuming Solitaire; `planDeckSize` and `validateDeckSize`
 * check the mode first and report `INVALID_MODE` as a structured issue.
 */
export function expectedChallengeCount(mode: DeckMode): number {
  switch (mode) {
    case DECK_MODES.solitaire:
    case DECK_MODES.tutor:
      return SOLITAIRE_CHALLENGE_COUNT;
    case DECK_MODES.vsBeepy:
      return COMPETITIVE_CHALLENGE_COUNT;
    default:
      throw new RangeError(`Unsupported deck mode: ${String(mode)}.`);
  }
}

/**
 * Starting hands dealt in a mode (one for Solitaire/Tutor, two for vs Beepy).
 * Throws `RangeError` for an unsupported mode.
 */
export function handCountForMode(mode: DeckMode): number {
  switch (mode) {
    case DECK_MODES.solitaire:
    case DECK_MODES.tutor:
      return 1;
    case DECK_MODES.vsBeepy:
      return COMPETITIVE_HAND_COUNT;
    default:
      throw new RangeError(`Unsupported deck mode: ${String(mode)}.`);
  }
}

/**
 * The fewest distractors that let `correct` correct cards supply `handCount`
 * valid hands plus `penaltyReserve` unused distractors, or `undefined` when even
 * unlimited distractors could not (fewer than two correct cards per hand) or any
 * input is not a non-negative whole number.
 */
export function minimumDistractors(
  correct: number,
  handCount: number,
  penaltyReserve: number,
): number | undefined {
  if (
    !isWholeNumberAtLeast(correct, 0) ||
    !isWholeNumberAtLeast(handCount, 0) ||
    !isWholeNumberAtLeast(penaltyReserve, 0)
  ) {
    return undefined;
  }
  const usableCorrect = Math.min(correct, MAX_CORRECT_IN_STARTING_HAND * handCount);
  if (usableCorrect < MIN_CORRECT_IN_STARTING_HAND * handCount) {
    return undefined;
  }
  return Math.max(0, STARTING_HAND_SIZE * handCount + penaltyReserve - usableCorrect);
}

/** Counts of plausible, unique values the caller can supply for a deck. */
export interface DeckSizeAvailability {
  /** Distinct values usable as correct answers (one per challenge is needed). */
  readonly availableCorrect: number;
  /** Distinct plausible values usable as distractors. */
  readonly availableDistractors: number;
}

/** The outcome of `planDeckSize`. */
export type DeckSizePlan =
  | {
      readonly ok: true;
      /** Total cards to build: correct cards plus planned distractors. */
      readonly cardCount: number;
      readonly correctCount: number;
      readonly distractorCount: number;
      /** True when the deck is smaller than the requested target. */
      readonly reduced: boolean;
    }
  | { readonly ok: false; readonly issue: DeckValidationIssue };

function invalidCountPlan(path: string, requirement: string, value: unknown): DeckSizePlan {
  return {
    ok: false,
    issue: deckIssue(
      CODES.invalidCount,
      `${path} must be ${requirement}; got ${String(value)}.`,
      path,
    ),
  };
}

/**
 * Plan the largest valid deck size up to `targetCardCount` that the available
 * plausible values can support. Never exceeds the target and never counts values
 * the caller did not report as plausible, so it cannot pad. A smaller deck is
 * returned (with `reduced: true`) when the range cannot reach the target, and a
 * failure is returned when even the minimum cannot be met (Req 6.1).
 *
 * Invalid numeric inputs (a target that is not a positive whole number, or
 * availability counts that are not non-negative whole numbers) fail with
 * `INVALID_COUNT` and never yield a successful plan.
 */
export function planDeckSize(
  mode: DeckMode,
  targetCardCount: number,
  availability: DeckSizeAvailability,
): DeckSizePlan {
  if (!isDeckMode(mode)) {
    return { ok: false, issue: invalidModeIssue(mode) };
  }
  if (!isWholeNumberAtLeast(targetCardCount, 1)) {
    return invalidCountPlan('targetCardCount', 'a positive whole number', targetCardCount);
  }
  const { availableCorrect, availableDistractors } = availability;
  if (!isWholeNumberAtLeast(availableCorrect, 0)) {
    return invalidCountPlan(
      'availability.availableCorrect',
      'a non-negative whole number',
      availableCorrect,
    );
  }
  if (!isWholeNumberAtLeast(availableDistractors, 0)) {
    return invalidCountPlan(
      'availability.availableDistractors',
      'a non-negative whole number',
      availableDistractors,
    );
  }

  const challengeCount = expectedChallengeCount(mode);
  const handCount = handCountForMode(mode);

  if (availableCorrect < challengeCount) {
    return {
      ok: false,
      issue: deckIssue(
        CODES.insufficientDeckData,
        `Mode "${mode}" needs ${challengeCount} distinct correct values (one per challenge); only ${availableCorrect} are available.`,
        'availability.availableCorrect',
      ),
    };
  }

  const minDistractors = minimumDistractors(challengeCount, handCount, MIN_PENALTY_RESERVE) ?? 0;
  const minimumCards = Math.max(
    challengeCount + minDistractors,
    mode === DECK_MODES.vsBeepy ? COMPETITIVE_MIN_CARD_COUNT : 0,
  );

  if (targetCardCount < minimumCards) {
    return {
      ok: false,
      issue: deckIssue(
        CODES.deckBelowMinimum,
        `Target of ${targetCardCount} cards is below the minimum of ${minimumCards} for mode "${mode}".`,
        'targetCardCount',
      ),
    };
  }

  const wantedDistractors = targetCardCount - challengeCount;
  const distractorCount = Math.min(wantedDistractors, availableDistractors);
  const cardCount = challengeCount + distractorCount;

  if (cardCount < minimumCards) {
    return {
      ok: false,
      issue: deckIssue(
        CODES.insufficientDeckData,
        `Only ${availableDistractors} plausible distractor(s) are available, but mode "${mode}" needs at least ${minimumCards - challengeCount} (minimum deck ${minimumCards} cards). The deck will not be padded with implausible values.`,
        'availability.availableDistractors',
      ),
    };
  }

  return {
    ok: true,
    cardCount,
    correctCount: challengeCount,
    distractorCount,
    reduced: distractorCount < wantedDistractors,
  };
}

/**
 * Validate a generated deck against the size rules of a mode: valid count
 * fields, challenge count, count consistency (V5), the target ceiling, the
 * competitive minimum, and that the deck can supply the mode's starting hand(s)
 * plus a penalty reserve. Reports ALL issues found.
 *
 * The target is a ceiling: a deck with MORE cards than `meta.targetCardCount` is
 * rejected, while a smaller validated deck is allowed.
 */
export function validateDeckSize(
  deck: GeneratedDeck,
  mode: DeckMode,
): DeckValidationResult {
  if (!isDeckMode(mode)) {
    return deckResult([invalidModeIssue(mode)]);
  }
  const issues: DeckValidationIssue[] = [];
  const expectedChallenges = expectedChallengeCount(mode);
  const cardTotal = deck.answerCards.length;

  if (deck.challenges.length !== expectedChallenges) {
    issues.push(
      deckIssue(
        CODES.challengeCountMismatch,
        `Mode "${mode}" needs ${expectedChallenges} challenges; the deck has ${deck.challenges.length}.`,
        'challenges',
      ),
    );
  }

  // Count fields must be sensible whole numbers before they are compared.
  const targetValid = isWholeNumberAtLeast(deck.meta.targetCardCount, 1);
  if (!targetValid) {
    issues.push(
      deckIssue(
        CODES.invalidCount,
        `meta.targetCardCount must be a positive whole number; got ${String(deck.meta.targetCardCount)}.`,
        'meta.targetCardCount',
      ),
    );
  }
  if (!isWholeNumberAtLeast(deck.meta.actualCardCount, 0)) {
    issues.push(
      deckIssue(
        CODES.invalidCount,
        `meta.actualCardCount must be a non-negative whole number; got ${String(deck.meta.actualCardCount)}.`,
        'meta.actualCardCount',
      ),
    );
  } else if (deck.meta.actualCardCount !== cardTotal) {
    issues.push(
      deckIssue(
        CODES.cardCountMismatch,
        `meta.actualCardCount is ${deck.meta.actualCardCount} but the deck has ${cardTotal} answer cards.`,
        'meta.actualCardCount',
      ),
    );
  }

  if (targetValid && cardTotal > deck.meta.targetCardCount) {
    issues.push(
      deckIssue(
        CODES.deckExceedsTarget,
        `The deck has ${cardTotal} cards, more than its target of ${deck.meta.targetCardCount}. A smaller validated deck is allowed; a larger one is not.`,
        'answerCards',
      ),
    );
  }

  if (mode === DECK_MODES.vsBeepy && cardTotal < COMPETITIVE_MIN_CARD_COUNT) {
    issues.push(
      deckIssue(
        CODES.deckBelowMinimum,
        `A competitive deck needs at least ${COMPETITIVE_MIN_CARD_COUNT} cards; the deck has ${cardTotal}.`,
        'answerCards',
      ),
    );
  }

  const handCount = handCountForMode(mode);
  const { correct, distractors } = countCorrectAndDistractors(deck);
  if (!canSupplyHands(correct, distractors, handCount, MIN_PENALTY_RESERVE)) {
    issues.push(
      deckIssue(
        CODES.insufficientDeckData,
        `Mode "${mode}" needs ${handCount} valid ${STARTING_HAND_SIZE}-card starting hand(s) (${MIN_CORRECT_IN_STARTING_HAND}-${MAX_CORRECT_IN_STARTING_HAND} correct cards each) plus ${MIN_PENALTY_RESERVE} unused penalty distractor; the deck has ${correct} correct card(s) and ${distractors} distractor(s).`,
        'answerCards',
      ),
    );
  }

  return deckResult(issues);
}
