/**
 * Shared issue model for generated-deck validation (Milestone M2, Tasks 7-9+).
 *
 * Same structured shape as the source-data validation issues (design D7): a
 * stable `code`, an actionable `message`, and the JSON-style `path` of the
 * offending value. Kept in its own module so the verified Task 6
 * `validation.ts` is not modified.
 *
 * Subject-neutral; no DOM/UI/framework dependency.
 */

/** Stable codes for generated-deck validation issues (design D7). */
export const DECK_VALIDATION_CODES = {
  // --- Task 7: challenge mapping and ambiguity elimination ---
  /** A challenge's `correctAnswerCardId` does not reference a card in the deck (V1). */
  correctCardNotFound: 'CORRECT_CARD_NOT_FOUND',
  /** The same card is designated correct for more than one challenge (V2). */
  duplicateCorrectAssignment: 'DUPLICATE_CORRECT_ASSIGNMENT',
  /** Two cards share the same display text after normalization (Req 3.5). */
  duplicateDisplayText: 'DUPLICATE_DISPLAY_TEXT',
  /**
   * No contextual-validity evaluation was supplied, so ambiguity cannot be
   * validated. Never reported as success (Req 3.2, 3.3).
   */
  contextualValidityMissing: 'CONTEXTUAL_VALIDITY_MISSING',
  /** The contextual-validity input names a challenge that is not in the deck. */
  unknownChallenge: 'UNKNOWN_CHALLENGE',
  /** The contextual-validity input names a card that is not in the deck. */
  unknownCard: 'UNKNOWN_CARD',
  /** A challenge has no entry in the contextual-validity input. */
  missingValidityEntry: 'MISSING_VALIDITY_ENTRY',
  /** A (challenge, card) pair has no boolean evaluation: the card was not checked. */
  missingValidityEvaluation: 'MISSING_VALIDITY_EVALUATION',
  /** The designated correct card was evaluated as NOT valid for its own challenge. */
  designatedCardNotValid: 'DESIGNATED_CARD_NOT_VALID',
  /** More than one distinct deck card is a valid answer to the same challenge. */
  multipleValidCardsForChallenge: 'MULTIPLE_VALID_CARDS_FOR_CHALLENGE',
  /** One card is a valid answer to more than one challenge (ambiguous match). */
  cardValidForMultipleChallenges: 'CARD_VALID_FOR_MULTIPLE_CHALLENGES',

  // --- Task 8: global uniqueness ---
  /** Two answer cards share the same card id (V3). */
  duplicateCardId: 'DUPLICATE_CARD_ID',
  /** Two challenges share the same challenge id (V3). */
  duplicateChallengeId: 'DUPLICATE_CHALLENGE_ID',
  /** Two distinct cards show the same display value (V4); numeric-equal in numeric mode. */
  duplicateDisplayValue: 'DUPLICATE_DISPLAY_VALUE',
  /** Numeric mode: a card's display value is not a plain decimal number. */
  nonNumericDisplayValue: 'NON_NUMERIC_DISPLAY_VALUE',
  /** A zone lists a card id that is not in the deck. */
  unknownZoneCard: 'UNKNOWN_ZONE_CARD',
  /** The same card id appears more than once across (or within) game zones. */
  duplicateZoneCard: 'DUPLICATE_ZONE_CARD',

  // --- Task 9: starting hand (single hand) ---
  /** A starting hand does not contain exactly the required number of cards. */
  handWrongSize: 'HAND_WRONG_SIZE',
  /** A starting hand lists a card id that is not in the deck. */
  handUnknownCard: 'HAND_UNKNOWN_CARD',
  /** The same card appears more than once in a starting hand. */
  handDuplicateCard: 'HAND_DUPLICATE_CARD',
  /** Two distinct cards in a starting hand show the same display value. */
  handDuplicateDisplayValue: 'HAND_DUPLICATE_DISPLAY_VALUE',
  /** A starting hand does not contain two or three correct cards. */
  handCorrectCountOutOfRange: 'HAND_CORRECT_COUNT_OUT_OF_RANGE',
  /** The deck cannot supply a valid starting hand. */
  startingHandInfeasible: 'STARTING_HAND_INFEASIBLE',

  // --- Task 10: dual-player (competitive) starting hands ---
  /** The same card is dealt into both players' hands. */
  dualHandSharedCard: 'DUAL_HAND_SHARED_CARD',
  /** Two different cards, one in each hand, show the same display value. */
  dualHandSharedDisplayValue: 'DUAL_HAND_SHARED_DISPLAY_VALUE',
  /** A hand card shows the same display value as a card left in the remaining deck. */
  handValueCollidesWithDeck: 'HAND_VALUE_COLLIDES_WITH_DECK',
  /** No unused, valid distractor remains in the deck for a penalty draw. */
  noPenaltyReserve: 'NO_PENALTY_RESERVE',
  /** The deck cannot supply two valid hands plus a penalty reserve. */
  dualHandInfeasible: 'DUAL_HAND_INFEASIBLE',

  // --- Task 11: deck-size targets and bounds ---
  /** The game mode is not one of the supported deck modes. */
  invalidMode: 'INVALID_MODE',
  /** A count or target is not a valid whole number in its allowed range. */
  invalidCount: 'INVALID_COUNT',
  /** The number of challenges does not match the game mode (5 or 9). */
  challengeCountMismatch: 'CHALLENGE_COUNT_MISMATCH',
  /** `meta.actualCardCount` differs from the real number of answer cards (V5). */
  cardCountMismatch: 'CARD_COUNT_MISMATCH',
  /** The deck has more cards than `meta.targetCardCount` (the target is a ceiling). */
  deckExceedsTarget: 'DECK_EXCEEDS_TARGET',
  /** The deck (or requested target) is smaller than the mode's minimum. */
  deckBelowMinimum: 'DECK_BELOW_MINIMUM',
  /** Not enough plausible unique values exist to build a valid deck for the mode. */
  insufficientDeckData: 'INSUFFICIENT_DECK_DATA',

  // --- Task 12: penalty draws and deck exhaustion ---
  /**
   * A penalty event could not be supplied with all its required cards: the draw
   * pile and the bounded fallback are both out of eligible cards (design D6).
   */
  penaltyCardExhausted: 'PENALTY_CARD_EXHAUSTED',

  // --- Task 13: insufficient data ---
  /**
   * A value pool has too few UNIQUE usable values: the supplied count looks
   * sufficient but duplicates, invalid values, or overlap with the correct values
   * leave fewer than the mode needs (Req 6.1).
   */
  tooFewUniqueValues: 'TOO_FEW_UNIQUE_VALUES',
  /**
   * A challenge has no unambiguous correct-answer candidate: none is valid for it,
   * or every valid one is also valid for another challenge (Req 6.1, 6.2).
   */
  noUnambiguousCorrectCard: 'NO_UNAMBIGUOUS_CORRECT_CARD',
} as const;

export type DeckValidationCode =
  (typeof DECK_VALIDATION_CODES)[keyof typeof DECK_VALIDATION_CODES];

/** A single structured, actionable generated-deck validation issue. */
export interface DeckValidationIssue {
  readonly code: DeckValidationCode;
  readonly message: string;
  /** JSON-style location of the offending value, e.g. `challenges[2].correctAnswerCardId`. */
  readonly path: string;
}

/** The result of a deck validation pass. `ok` is true iff `issues` is empty. */
export interface DeckValidationResult {
  readonly ok: boolean;
  readonly issues: readonly DeckValidationIssue[];
}

/** Build an issue. */
export function deckIssue(
  code: DeckValidationCode,
  message: string,
  path: string,
): DeckValidationIssue {
  return { code, message, path };
}

/** Wrap a list of issues in a result (`ok` iff the list is empty). */
export function deckResult(
  issues: readonly DeckValidationIssue[],
): DeckValidationResult {
  return { ok: issues.length === 0, issues };
}
