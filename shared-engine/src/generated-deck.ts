/**
 * Generated-deck contract (Milestone M2, Task 3).
 *
 * Subject-neutral TypeScript contracts describing a VALIDATED, playable deck
 * that the gameplay engine consumes. The engine reads this contract only; it
 * never parses raw subject source data (Decision 4; design D4/D5; master spec
 * section 14). These shapes serve both Math Cards and Clinical Cards with no
 * subject-specific logic.
 *
 * Scope (Task 3 only): TYPE CONTRACTS ONLY. This module deliberately does NOT
 * implement generators, validators, gameplay, Beepy AI, or UI. It introduces no
 * runtime logic beyond the type declarations themselves.
 *
 * -------------------------------------------------------------------------
 * Validator-enforced invariants (documented here for the LATER validator;
 * NOT enforced by this module — Tasks 6-13):
 *
 *   V1. Referential integrity: every `GeneratedChallenge.correctAnswerCardId`
 *       references an answer card that exists in `GeneratedDeck.answerCards`.
 *   V2. Unique correct assignment: correct-answer-card assignments are unique
 *       across challenges — no two challenges designate the same answer card as
 *       their correct card (and exactly one correct card per challenge).
 *   V3. Global id uniqueness: every `GeneratedAnswerCard.id` is unique within
 *       the active game (and challenge ids are likewise unique).
 *   V4. Global display-value uniqueness: every `GeneratedAnswerCard.displayValue`
 *       is unique across the entire active game — all hands, the draw deck,
 *       played cards, and the discard pile (master spec section 4; steering
 *       no-duplicate-card-invariant). For math, distinct numerical answers.
 *   V5. Count consistency: `GeneratedDeck.meta.actualCardCount` equals
 *       `GeneratedDeck.answerCards.length`.
 *
 * These invariants are the generator/validator's responsibility in later tasks.
 * The TYPES below are shaped to make them expressible and checkable.
 * -------------------------------------------------------------------------
 *
 * References:
 * - .kiro/specs/educational-data-schema/requirements.md (Req 2, 3, 4)
 * - .kiro/specs/educational-data-schema/design.md (Layer 2 D4, D5, D8)
 * - .kiro/steering/no-duplicate-card-invariant.md
 * - .kiro/steering/educational-data-independence.md
 *
 * Subject-neutral; no DOM/UI/framework dependency.
 */

/**
 * Generation direction (Req 2; master spec section 9). Configuration only —
 * NOT a separate schema. Both directions use this same generated-deck contract.
 *
 * - `factToSubject` (Math default): the challenge shows a fact/expression and
 *   the answer card shows the subject, e.g. `3 + 4 = ?` -> `7`.
 * - `subjectToFact` (Clinical default): the challenge shows a subject + topic
 *   and the answer card shows one selected correct fact,
 *   e.g. `Graves Disease — Work-up` -> `Positive TSI/TRAb`.
 */
export type GenerationDirection = 'factToSubject' | 'subjectToFact';

/**
 * A reference back to the source data a generated item was derived from.
 *
 * This preserves the strict separation between source data and generated deck:
 * the engine does not read source data, but the generated item can be traced to
 * its origin for authoring/debugging. `topicId` is optional because, depending
 * on direction, an item may be anchored at the subject level.
 */
export interface GeneratedSourceRef {
  /** Stable source subject id (see identifiers.ts conventions). */
  readonly subjectId: string;
  /** Stable source topic id, when the item derives from a specific topic. */
  readonly topicId?: string;
}

/**
 * A single displayed challenge on the board.
 *
 * Exactly ONE designated correct answer card is referenced by
 * `correctAnswerCardId` (Req 3.2; master spec section 4). "Correct" here is the
 * resolved, contextual designation produced by the generator/validator in later
 * tasks — this contract only records the resolved relationship. See validator
 * invariants V1 (the referenced card must exist) and V2 (assignments unique
 * across challenges).
 */
export interface GeneratedChallenge {
  /** Globally unique challenge id within the active game (see V3). */
  readonly id: string;

  /** Text shown on the board for this challenge. */
  readonly promptText: string;

  /**
   * The id of the one and only answer card that correctly solves this
   * challenge. Must reference a card present in `GeneratedDeck.answerCards`
   * (V1) and be unique across challenges (V2).
   */
  readonly correctAnswerCardId: string;

  /** Trace back to the source data this challenge was generated from. */
  readonly sourceRef: GeneratedSourceRef;
}

/**
 * A single answer card.
 *
 * `displayValue` must be unique across the ENTIRE active game — all hands, the
 * draw deck, played cards, and the discard pile (V4; master spec section 4;
 * steering no-duplicate-card-invariant). `id` is also globally unique within the
 * active game (V3).
 *
 * Explanations (Decision 5 / D5) are OPTIONAL and CONTEXTUAL to a specific
 * challenge: they are bound per `challengeId` via `explanationByChallengeId`,
 * never stored as a single free-floating label and never rendered on a card
 * face. When no explanation exists for a context, the entry is simply absent;
 * explanations are never invented or substituted.
 */
export interface GeneratedAnswerCard {
  /** Globally unique card id within the active game (see V3). */
  readonly id: string;

  /**
   * The value shown on the card face. Globally unique across all game zones
   * (the no-duplicate-card invariant, V4). For math this is the distinct
   * numerical answer; for clinical a concise fact or subject text.
   */
  readonly displayValue: string;

  /**
   * Optional, challenge-contextual explanations keyed by `challengeId`.
   * Absent when no explanation applies. Not shown on the card face; surfaced
   * only on request (e.g. an "Explain Why" action) in a later UI milestone.
   */
  readonly explanationByChallengeId?: Readonly<Record<string, string>>;
}

/**
 * A validated, playable deck consumed by the engine.
 *
 * `challenges` holds the displayed challenges (five for Solitaire/Tutor, nine
 * for Player vs. Beepy). `answerCards` holds every card in the active game
 * (dealt hands plus the draw pile). `meta` records the target vs. actual card
 * count so deck-size rules (D8) can be reported without re-deriving them.
 *
 * Invariants this contract supports (enforced by the validator in later tasks,
 * not here): V1-V5 above — notably exactly one correct card per challenge,
 * referential integrity, unique correct assignment, global id/display-value
 * uniqueness, and `meta.actualCardCount === answerCards.length`.
 */
export interface GeneratedDeck {
  /** The generation direction used to build this deck. */
  readonly direction: GenerationDirection;

  /** Displayed challenges (5 for solitaire/tutor, 9 for vs Beepy). */
  readonly challenges: readonly GeneratedChallenge[];

  /** All answer cards in the active game (dealt + draw pile). */
  readonly answerCards: readonly GeneratedAnswerCard[];

  /** Deck-size bookkeeping (see design D8). */
  readonly meta: GeneratedDeckMeta;
}

/**
 * Deck-size bookkeeping carried on a generated deck (design D8).
 *
 * `actualCardCount` must equal `GeneratedDeck.answerCards.length` (validator
 * invariant V5).
 */
export interface GeneratedDeckMeta {
  /** The target total card count for the mode/difficulty. */
  readonly targetCardCount: number;
  /** The actual total card count produced (may be smaller when valid). */
  readonly actualCardCount: number;
}
