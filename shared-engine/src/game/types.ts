/**
 * Game-engine types (Milestone M3, E1).
 *
 * `EngineState` is ENGINE-PRIVATE. It contains the designated correct card of
 * every challenge, the contextual-validity matrix, hidden hands, the draw-pile
 * order, and the unredacted history. It is held only by the trusted controller
 * (controller.ts) and is never returned to the UI. Everything here is plain,
 * immutable data.
 *
 * Subject-neutral; no DOM/UI/framework dependency.
 */

import type { GeneratedAnswerCard, GeneratedDeck, GeneratedSourceRef } from '../generated-deck.js';
import type { ContextualValidityMap } from '../challenge-mapping.js';
import type {
  PenaltyCardExhausted,
  PenaltyFallbackProvider,
  PenaltyReason,
} from '../penalty-draw.js';
import type { RngState } from './random.js';

/** Modes the M3 engine can play. `tutor` and `vsPlayer` are deferred. */
export const ENGINE_MODES = {
  solitaire: 'solitaire',
  vsBeepy: 'vsBeepy',
} as const;

export type EngineMode = (typeof ENGINE_MODES)[keyof typeof ENGINE_MODES];

/** The two possible players. Solitaire uses only `human`. */
export type PlayerId = 'human' | 'beepy';

export type ActionKind = 'play' | 'discard';

/** The human's judgment of a pending Beepy action. */
export type Decision = 'accept' | 'challenge';

/** Stable engine error codes. */
export const ENGINE_ERROR_CODES = {
  // Setup
  invalidMode: 'INVALID_MODE',
  modeNotImplemented: 'MODE_NOT_IMPLEMENTED',
  gameSetupInvalid: 'GAME_SETUP_INVALID',
  invalidOption: 'INVALID_OPTION',
  // Illegal requests (never change state, never a turn, never a penalty)
  gameEnded: 'GAME_ENDED',
  wrongPhase: 'WRONG_PHASE',
  playerNotInMode: 'PLAYER_NOT_IN_MODE',
  notPlayersTurn: 'NOT_PLAYERS_TURN',
  unknownHandle: 'UNKNOWN_HANDLE',
  cardNotInHand: 'CARD_NOT_IN_HAND',
  invalidActionKind: 'INVALID_ACTION_KIND',
  missingChallenge: 'MISSING_CHALLENGE',
  unexpectedChallenge: 'UNEXPECTED_CHALLENGE',
  unknownChallenge: 'UNKNOWN_CHALLENGE',
  challengeAlreadySolved: 'CHALLENGE_ALREADY_SOLVED',
  invalidDecision: 'INVALID_DECISION',
  /** An untyped request was not a well-formed object of the expected field types. */
  malformedRequest: 'MALFORMED_REQUEST',
  // Series
  seriesOutcomeMismatch: 'SERIES_OUTCOME_MISMATCH',
  seriesOutcomesExcessive: 'SERIES_OUTCOMES_EXCESSIVE',
  gameInProgress: 'GAME_IN_PROGRESS',
  seriesComplete: 'SERIES_COMPLETE',
  noGameStarted: 'NO_GAME_STARTED',
  // Beepy strategy
  strategyResultInvalid: 'STRATEGY_RESULT_INVALID',
  // Faults
  engineFault: 'ENGINE_FAULT',
} as const;

export type EngineErrorCode = (typeof ENGINE_ERROR_CODES)[keyof typeof ENGINE_ERROR_CODES];

/** One problem found while validating a deck for play. */
export interface SetupIssue {
  /** Which check found it. */
  readonly stage: 'shape' | 'mapping' | 'uniqueness' | 'deckSize' | 'feasibility' | 'deal';
  /** An M2 deck-validation code, or a shape code. */
  readonly code: string;
  readonly message: string;
  readonly path: string;
}

/** A structured engine error. */
export interface EngineError {
  readonly code: EngineErrorCode;
  readonly message: string;
  /** Present for `GAME_SETUP_INVALID`: every issue found. */
  readonly issues?: readonly SetupIssue[];
}

/** Options for a game. */
export interface GameOptions {
  /** Compare display values as numbers (Math). */
  readonly numericAnswers?: boolean;
  /** Bounded fallback source for penalty cards. Absent: none (for example Clinical). */
  readonly fallback?: PenaltyFallbackProvider;
  /** Bound on fallback candidates per penalty event (positive whole number). */
  readonly maxPenaltyCandidates?: number;
}

/** A request to play or discard. Cards and challenges are named by handle / id. */
export interface ActionRequest {
  readonly player: PlayerId;
  readonly kind: ActionKind;
  /** The opaque handle of the card in the acting player's hand. */
  readonly handle: string;
  /** Required for a play; must be absent for a discard. */
  readonly challengeId?: string;
}

/** Per-player counts, kept apart from the score. */
export interface PlayerStats {
  readonly turns: number;
  readonly correctPlays: number;
  readonly incorrectPlays: number;
  readonly correctDiscards: number;
  readonly incorrectDiscards: number;
}

export const EMPTY_STATS: PlayerStats = {
  turns: 0,
  correctPlays: 0,
  incorrectPlays: 0,
  correctDiscards: 0,
  incorrectDiscards: 0,
};

export type EndReason = 'handEmpty' | 'allSolved';

/** How a game ended. */
export type GameOutcome =
  | {
      readonly kind: 'solitaire';
      readonly turns: number;
      readonly cardsRemaining: number;
      /** turns + cards remaining (lower is better). */
      readonly score: number;
      readonly endedBy: readonly EndReason[];
    }
  | {
      readonly kind: 'vsBeepy';
      readonly winner: PlayerId;
      readonly reason: 'handEmpty' | 'fewerCards' | 'moreCredit';
      readonly handCounts: Readonly<Record<PlayerId, number>>;
      readonly credits: Readonly<Record<PlayerId, number>>;
    };

export type GamePhase = 'awaitingAction' | 'awaitingEvaluation' | 'ended';

/** An action held until the human decides (Beepy actions only in M3). */
export interface PendingAction {
  readonly player: PlayerId;
  readonly kind: ActionKind;
  readonly cardId: string;
  readonly challengeId?: string;
}

/** One owed penalty draw, with the engine-chosen reason. */
export interface OwedPenalty {
  readonly playerId: PlayerId;
  readonly reason: PenaltyReason;
}

/** Engine-private, full-fidelity history. Never given to the UI. */
export type EngineEvent =
  | {
      readonly type: 'GAME_DEALT';
      readonly gameIndex: number;
      readonly mode: EngineMode;
      readonly firstPlayer: PlayerId;
      readonly hands: Readonly<Record<PlayerId, readonly string[]>>;
      readonly drawPile: readonly string[];
    }
  | {
      readonly type: 'ACTION_SUBMITTED';
      readonly turn: number;
      readonly player: PlayerId;
      readonly kind: ActionKind;
      readonly cardId: string;
      readonly challengeId?: string;
    }
  | {
      readonly type: 'ACTION_RESOLVED';
      readonly turn: number;
      readonly player: PlayerId;
      readonly kind: ActionKind;
      readonly cardId: string;
      readonly challengeId?: string;
      readonly valid: boolean;
      readonly decision?: Decision;
    }
  | {
      readonly type: 'CHALLENGE_SOLVED';
      readonly challengeId: string;
      readonly cardId: string;
      readonly solvedBy: PlayerId;
      readonly sourceRef: GeneratedSourceRef;
    }
  | {
      readonly type: 'CARD_DISCARDED';
      readonly cardId: string;
      readonly by: PlayerId;
    }
  | {
      readonly type: 'PENALTY_DRAWN';
      readonly player: PlayerId;
      readonly cardId: string;
      readonly reason: PenaltyReason;
      readonly source: 'drawPile' | 'fallback';
    }
  | {
      readonly type: 'PENALTY_EXHAUSTED';
      readonly owed: readonly OwedPenalty[];
      readonly exhausted: PenaltyCardExhausted;
    }
  | {
      /** The game ended before the owed draws, so none were applied (Req 7.2). */
      readonly type: 'PENALTY_NOT_APPLIED';
      readonly owed: readonly OwedPenalty[];
    }
  | { readonly type: 'TURN_COUNTED'; readonly turn: number }
  | { readonly type: 'GAME_ENDED'; readonly outcome: GameOutcome };

/** The authoritative, engine-private state of one game. */
export interface EngineState {
  readonly mode: EngineMode;
  readonly gameIndex: number;
  readonly firstPlayer: PlayerId;
  readonly phase: GamePhase;
  readonly activePlayer: PlayerId;
  readonly turnCount: number;

  readonly deck: GeneratedDeck;
  readonly contextualValidity: ContextualValidityMap;
  readonly options: GameOptions;

  /** Every card in the game, including accepted fallback cards. */
  readonly cards: Readonly<Record<string, GeneratedAnswerCard>>;
  readonly handleByCard: Readonly<Record<string, string>>;
  readonly cardByHandle: Readonly<Record<string, string>>;

  readonly hands: Readonly<Record<PlayerId, readonly string[]>>;
  /** Next card to draw first. */
  readonly drawPile: readonly string[];
  readonly discard: readonly string[];
  /** challengeId -> card id attached to the solved challenge. */
  readonly played: Readonly<Record<string, string>>;
  /** challengeId -> who solved it. */
  readonly solvedBy: Readonly<Record<string, PlayerId>>;

  readonly pending?: PendingAction;
  readonly stats: Readonly<Record<PlayerId, PlayerStats>>;
  readonly history: readonly EngineEvent[];
  readonly outcome?: GameOutcome;

  /** Engine random stream (handle tokens). */
  readonly rng: RngState;
  /** Beepy strategy random stream. */
  readonly beepyRng: RngState;
}

/** A failed engine call. */
export interface Failure {
  readonly ok: false;
  readonly error: EngineError;
}

/** A successful state transition with the private events it produced. */
export interface Step {
  readonly ok: true;
  readonly state: EngineState;
  readonly events: readonly EngineEvent[];
}

export type StepResult = Step | Failure;

export function failure(
  code: EngineErrorCode,
  message: string,
  issues?: readonly SetupIssue[],
): Failure {
  return {
    ok: false,
    error: issues === undefined ? { code, message } : { code, message, issues },
  };
}
