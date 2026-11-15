/**
 * Penalty-draw contract and bounded fallback (Milestone M2, Task 12; Decision 3;
 * design D6; master spec section 4).
 *
 * When a player must draw penalty cards, `drawPenaltyCards` supplies them from
 * the draw pile first and then, if the pile is short, from an app-supplied
 * `PenaltyFallbackProvider`. It never reuses a card, never emits a duplicate, and
 * never fabricates a card: every card it returns came from the draw pile or was
 * offered by the provider and passed every check below.
 *
 * Atomic events. A penalty event may owe one draw or several (for example the
 * master spec section 7 table has both players draw after an accepted invalid
 * Beepy move). The event is all-or-nothing: if ALL owed cards cannot be supplied,
 * NO card is drawn, the function returns `PENALTY_CARD_EXHAUSTED`, and the input
 * state is untouched (the function is pure, so provisionally taken pile cards are
 * simply never committed). The owner-approved consequence is that the event's draw
 * penalty is waived, the exhaustion is recorded, and the game continues with its
 * win conditions unchanged. Applying that consequence, deciding WHICH events owe
 * draws, and the timing of challenge adjudication and win detection belong to the
 * later engine milestone; this module is event-agnostic.
 *
 * Fallback candidates are untrusted. Each one is rejected unless its id and
 * display value are valid, it is not a duplicate of ANY card already in the game
 * (hands, draw pile, played, discard, or already accepted in this call), it is
 * plausible, and it is NOT a valid answer to any active challenge (the provider
 * must evaluate it against every active challenge, like the Task 7 matrix).
 * Attempts are bounded by `maxCandidates` (default 50, configurable).
 *
 * Clinical content is never generated at runtime. A fallback card delivered here
 * carries only an id and display value: contextual explanations are dropped, never
 * invented or substituted. Clinical apps supply a provider only from pre-authored,
 * reviewed content; with no provider the status is `NOT_AVAILABLE` and no card is
 * created.
 *
 * The exhaustion payload holds counts and request metadata only - no card faces or
 * hand contents - so it is safe to show or log while a hand is hidden.
 *
 * Scope (Task 12 only). No turn lifecycle, event-to-draw rules, turn limits, Beepy
 * AI, or UI. Subject-neutral; no DOM/UI/framework dependency.
 *
 * References:
 * - .kiro/specs/educational-data-schema/requirements.md (Req 6.3)
 * - .kiro/specs/educational-data-schema/design.md (D6, D6a, D7)
 * - docs/master-spec-v1.1.md sections 4 and 7
 * - .kiro/steering/no-duplicate-card-invariant.md
 */

import type {
  GeneratedAnswerCard,
  GeneratedChallenge,
} from './generated-deck.js';
import {
  DECK_VALIDATION_CODES as CODES,
  deckIssue,
  type DeckValidationIssue,
} from './deck-issues.js';
import { canonicalNumber } from './uniqueness.js';
import { normalizeDisplayText } from './challenge-mapping.js';

/** Default bound on fallback candidates examined per penalty event. */
export const DEFAULT_MAX_PENALTY_CANDIDATES = 50;

/** Why a penalty card is owed. Set by the engine; not decided here. */
export const PENALTY_REASONS = {
  invalidAction: 'INVALID_ACTION',
  wrongChallenge: 'WRONG_CHALLENGE',
  missedChallenge: 'MISSED_CHALLENGE',
} as const;

export type PenaltyReason = (typeof PENALTY_REASONS)[keyof typeof PENALTY_REASONS];

/** One owed penalty draw. */
export interface PenaltyDrawRequest {
  /** Opaque player id chosen by the engine (for example student, human, beepy). */
  readonly playerId: string;
  readonly reason: PenaltyReason;
}

/** Why the fallback could not finish the job. */
export const FALLBACK_STATUSES = {
  /** No fallback provider is configured (for example Clinical with no reserve). */
  notAvailable: 'NOT_AVAILABLE',
  /** The provider ran out of candidates. */
  exhausted: 'EXHAUSTED',
  /** The bound on candidates examined was reached. */
  limitReached: 'LIMIT_REACHED',
} as const;

export type FallbackStatus = (typeof FALLBACK_STATUSES)[keyof typeof FALLBACK_STATUSES];

/** Why a fallback candidate was rejected. */
export const FALLBACK_REJECTIONS = {
  /** Its display value matches a card already in the game (or accepted this call). */
  duplicateDisplayValue: 'DUPLICATE_DISPLAY_VALUE',
  /** Its id matches a card already in the game (or accepted this call). */
  duplicateId: 'DUPLICATE_ID',
  /** The provider did not mark it plausible. */
  notPlausible: 'NOT_PLAUSIBLE',
  /**
   * Malformed: blank id or value, non-numeric in numeric mode, or not evaluated
   * (true/false) against every active challenge.
   */
  invalidValue: 'INVALID_VALUE',
  /** It is a valid answer to an active challenge, so it is not a distractor. */
  validForChallenge: 'VALID_FOR_A_CHALLENGE',
} as const;

export type FallbackRejection =
  (typeof FALLBACK_REJECTIONS)[keyof typeof FALLBACK_REJECTIONS];

/**
 * The structured `PENALTY_CARD_EXHAUSTED` condition (design D6/D7 shape plus
 * `details`). Contains counts and request metadata only, never card faces.
 */
export interface PenaltyCardExhausted {
  readonly code: typeof CODES.penaltyCardExhausted;
  readonly message: string;
  readonly path: 'drawPile';
  readonly details: {
    /** Every draw the event owed (1 or more). */
    readonly requests: readonly PenaltyDrawRequest[];
    /** Cards in the draw pile when the event began (may be less than owed). */
    readonly drawPileRemaining: number;
    readonly fallback: {
      readonly status: FallbackStatus;
      readonly candidatesTried: number;
      readonly maxCandidates: number;
      readonly rejections: Readonly<Partial<Record<FallbackRejection, number>>>;
    };
    /** Cards currently outside the draw pile: hands, played, and discard. */
    readonly cardsInPlay: number;
  };
}

/**
 * A fallback card offered by a provider, with the provider's own evaluation.
 * Untrusted: every field is re-checked by `drawPenaltyCards`.
 */
export interface PenaltyCandidate {
  readonly card: GeneratedAnswerCard;
  /** The provider's plausibility judgment (for example inside the difficulty range). */
  readonly plausible: boolean;
  /**
   * `challengeId -> isValidAnswer` for EVERY active challenge. All must be false:
   * a penalty card is a distractor and must not become a second valid answer.
   */
  readonly validForChallenges: Readonly<Record<string, boolean>>;
}

/** What a provider is told about the game when asked for candidates. */
export interface PenaltyFallbackContext {
  readonly activeChallenges: readonly GeneratedChallenge[];
  /** Every card currently in the game, in every zone including the draw pile. */
  readonly usedCards: readonly GeneratedAnswerCard[];
  readonly numericAnswers: boolean;
}

/**
 * App-supplied source of fallback candidates. Math generates plausible unused
 * numbers; Clinical may only offer pre-authored, reviewed content. The sequence
 * may be long or unbounded: it is read lazily and at most `maxCandidates` items
 * are examined.
 */
export interface PenaltyFallbackProvider {
  candidates(context: PenaltyFallbackContext): Iterable<PenaltyCandidate>;
}

/** The cards in the game when a penalty event begins. */
export interface PenaltyDrawState {
  /** Remaining draw pile, next card to draw first. */
  readonly drawPile: readonly GeneratedAnswerCard[];
  /** Every card in hands, played, and discard. */
  readonly cardsOutsideDrawPile: readonly GeneratedAnswerCard[];
}

/** Options for `drawPenaltyCards`. */
export interface PenaltyDrawOptions {
  /** Unsolved challenges the fallback candidates are checked against. */
  readonly activeChallenges: readonly GeneratedChallenge[];
  /** Fallback source; when absent the status is `NOT_AVAILABLE`. */
  readonly fallback?: PenaltyFallbackProvider;
  /** Bound on candidates examined; a positive whole number. Default 50. */
  readonly maxCandidates?: number;
  /** Compare display values as numbers (Math). */
  readonly numericAnswers?: boolean;
}

export type PenaltySource = 'drawPile' | 'fallback';

/** The outcome of a penalty event. */
export type PenaltyDrawResult =
  | {
      readonly ok: true;
      /** One card per request, in request order. */
      readonly cards: readonly GeneratedAnswerCard[];
      readonly sources: readonly PenaltySource[];
      /** The draw pile after the event. */
      readonly drawPile: readonly GeneratedAnswerCard[];
    }
  | { readonly ok: false; readonly exhausted: PenaltyCardExhausted }
  | { readonly ok: false; readonly invalid: DeckValidationIssue };

function isPositiveWhole(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 1;
}

/**
 * Supply the penalty cards a single event owes, atomically.
 *
 * Returns `{ ok: true, cards, sources, drawPile }` when every request is
 * supplied, `{ ok: false, exhausted }` with the `PENALTY_CARD_EXHAUSTED` payload
 * when not (no card drawn, state unchanged), or `{ ok: false, invalid }` when
 * `maxCandidates` is not a positive whole number.
 */
export function drawPenaltyCards(
  state: PenaltyDrawState,
  requests: readonly PenaltyDrawRequest[],
  options: PenaltyDrawOptions,
): PenaltyDrawResult {
  const maxCandidates = options.maxCandidates ?? DEFAULT_MAX_PENALTY_CANDIDATES;
  if (!isPositiveWhole(maxCandidates)) {
    return {
      ok: false,
      invalid: deckIssue(
        CODES.invalidCount,
        `maxCandidates must be a positive whole number; got ${String(maxCandidates)}.`,
        'maxCandidates',
      ),
    };
  }

  const numeric = options.numericAnswers === true;
  const owed = requests.length;
  if (owed === 0) {
    return { ok: true, cards: [], sources: [], drawPile: state.drawPile };
  }

  const cards: GeneratedAnswerCard[] = [];
  const sources: PenaltySource[] = [];

  // 1. Draw pile first. Nothing is committed until the whole event succeeds.
  const fromPile = Math.min(owed, state.drawPile.length);
  for (let i = 0; i < fromPile; i += 1) {
    cards.push(state.drawPile[i] as GeneratedAnswerCard);
    sources.push('drawPile');
  }

  // 2. Bounded fallback for whatever the pile could not supply.
  let candidatesTried = 0;
  const rejections: Partial<Record<FallbackRejection, number>> = {};
  let status: FallbackStatus | undefined;

  if (cards.length < owed) {
    if (options.fallback === undefined) {
      status = FALLBACK_STATUSES.notAvailable;
    } else {
      const keyOf = (value: string): string | undefined =>
        numeric ? canonicalNumber(value) : normalizeDisplayText(value);
      const everyCard = [...state.drawPile, ...state.cardsOutsideDrawPile];
      const usedIds = new Set<string>();
      const usedKeys = new Set<string>();
      for (const card of everyCard) {
        usedIds.add(card.id);
        const key = keyOf(card.displayValue);
        if (key !== undefined) {
          usedKeys.add(key);
        }
      }

      const iterator = options.fallback
        .candidates({
          activeChallenges: options.activeChallenges,
          usedCards: everyCard,
          numericAnswers: numeric,
        })
        [Symbol.iterator]();
      try {
        while (cards.length < owed) {
          if (candidatesTried >= maxCandidates) {
            status = FALLBACK_STATUSES.limitReached;
            break;
          }
          const step = iterator.next();
          if (step.done === true) {
            status = FALLBACK_STATUSES.exhausted;
            break;
          }
          candidatesTried += 1;
          const rejection = rejectionFor(
            step.value,
            options.activeChallenges,
            usedIds,
            usedKeys,
            keyOf,
          );
          if (rejection !== undefined) {
            rejections[rejection] = (rejections[rejection] ?? 0) + 1;
            continue;
          }
          // Deliver only id and display value: explanations are never carried over.
          const accepted: GeneratedAnswerCard = {
            id: step.value.card.id,
            displayValue: step.value.card.displayValue,
          };
          cards.push(accepted);
          sources.push('fallback');
          usedIds.add(accepted.id);
          const key = keyOf(accepted.displayValue);
          if (key !== undefined) {
            usedKeys.add(key);
          }
        }
      } finally {
        iterator.return?.();
      }
    }
  }

  if (cards.length < owed) {
    const finalStatus = status ?? FALLBACK_STATUSES.notAvailable;
    return {
      ok: false,
      exhausted: {
        code: CODES.penaltyCardExhausted,
        message: `No eligible penalty card is available: ${owed} draw(s) owed, ${state.drawPile.length} card(s) left in the draw pile, fallback ${finalStatus} after ${candidatesTried} candidate(s) (limit ${maxCandidates}). No card was drawn, created, or reused.`,
        path: 'drawPile',
        details: {
          requests: [...requests],
          drawPileRemaining: state.drawPile.length,
          fallback: {
            status: finalStatus,
            candidatesTried,
            maxCandidates,
            rejections: { ...rejections },
          },
          cardsInPlay: state.cardsOutsideDrawPile.length,
        },
      },
    };
  }

  return { ok: true, cards, sources, drawPile: state.drawPile.slice(fromPile) };
}

/** Classify why an untrusted candidate must be rejected, or `undefined` to accept it. */
function rejectionFor(
  candidate: unknown,
  activeChallenges: readonly GeneratedChallenge[],
  usedIds: ReadonlySet<string>,
  usedKeys: ReadonlySet<string>,
  keyOf: (value: string) => string | undefined,
): FallbackRejection | undefined {
  if (typeof candidate !== 'object' || candidate === null) {
    return FALLBACK_REJECTIONS.invalidValue;
  }
  const raw = candidate as {
    card?: unknown;
    plausible?: unknown;
    validForChallenges?: unknown;
  };
  const card = raw.card as { id?: unknown; displayValue?: unknown } | null | undefined;
  if (typeof card !== 'object' || card === null) {
    return FALLBACK_REJECTIONS.invalidValue;
  }
  const { id, displayValue } = card;
  if (
    typeof id !== 'string' ||
    id.trim() === '' ||
    typeof displayValue !== 'string' ||
    displayValue.trim() === ''
  ) {
    return FALLBACK_REJECTIONS.invalidValue;
  }
  const key = keyOf(displayValue);
  if (key === undefined) {
    return FALLBACK_REJECTIONS.invalidValue;
  }
  const row = raw.validForChallenges as Record<string, unknown> | null | undefined;
  if (typeof row !== 'object' || row === null) {
    return FALLBACK_REJECTIONS.invalidValue;
  }
  for (const challenge of activeChallenges) {
    if (!Object.hasOwn(row, challenge.id) || typeof row[challenge.id] !== 'boolean') {
      return FALLBACK_REJECTIONS.invalidValue;
    }
  }
  if (usedIds.has(id)) {
    return FALLBACK_REJECTIONS.duplicateId;
  }
  if (usedKeys.has(key)) {
    return FALLBACK_REJECTIONS.duplicateDisplayValue;
  }
  if (raw.plausible !== true) {
    return FALLBACK_REJECTIONS.notPlausible;
  }
  if (activeChallenges.some((challenge) => row[challenge.id] === true)) {
    return FALLBACK_REJECTIONS.validForChallenge;
  }
  return undefined;
}
