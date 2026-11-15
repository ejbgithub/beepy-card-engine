/**
 * Sanitized player views and public events (Milestone M3, E12; requirement 9).
 *
 * Everything returned here is FRESH, plain, serializable data built field by field
 * from engine state. It holds no reference to the state and never contains:
 *   - which cards are correct, `correctAnswerCardId`, or the contextual matrix,
 *   - the draw pile's order or contents (only its size),
 *   - the opponent's hand faces (only a count),
 *   - deck card ids (cards are named by opaque handles only),
 *   - the validity of a pending action, or
 *   - `sourceRef` of an OPEN challenge (a source id could encode its answer; it is
 *     shown only once the challenge is solved).
 *
 * Public events reveal a judgment only after resolution. A penalty card's face goes
 * only to the player who drew it; everyone else sees a count.
 */

import type { GeneratedSourceRef } from '../generated-deck.js';
import { seriesStatus, type SeriesStatus } from './series.js';
import type {
  ActionKind,
  Decision,
  EngineEvent,
  EngineMode,
  EngineState,
  GameOutcome,
  GamePhase,
  PlayerId,
  PlayerStats,
} from './types.js';

/** A face-up card as a player may see it. */
export interface CardFace {
  readonly handle: string;
  readonly displayValue: string;
}

export interface ChallengeView {
  readonly id: string;
  readonly promptText: string;
  readonly status: 'open' | 'solved';
  readonly solvedBy?: PlayerId;
  /** The card attached to a solved challenge. */
  readonly playedCard?: CardFace;
  /** Shown only after the challenge is solved. */
  readonly sourceRef?: GeneratedSourceRef;
}

export interface PendingView {
  readonly player: PlayerId;
  readonly kind: ActionKind;
  readonly card: CardFace;
  /** A challenge id for a play, or `'discard'`. */
  readonly destination: string;
}

/** Everything one player may see. */
export interface PlayerView {
  readonly mode: EngineMode;
  readonly viewer: PlayerId;
  readonly gameIndex: number;
  readonly phase: GamePhase;
  readonly activePlayer: PlayerId;
  readonly turnCount: number;
  readonly hand: readonly CardFace[];
  /** Competitive only: the opponent's hand size. */
  readonly opponentHandCount?: number;
  readonly challenges: readonly ChallengeView[];
  readonly discard: readonly CardFace[];
  readonly drawPileCount: number;
  readonly pending?: PendingView;
  /** The viewer's own learning counts (kept apart from the score). */
  readonly stats: PlayerStats;
  readonly outcome?: GameOutcome;
  readonly series?: SeriesStatus;
}

/** Events a player may see. */
export type PublicEvent =
  | {
      readonly type: 'GAME_STARTED';
      readonly gameIndex: number;
      readonly mode: EngineMode;
      readonly firstPlayer: PlayerId;
      readonly handCounts: Readonly<Record<PlayerId, number>>;
      readonly drawPileCount: number;
    }
  | { readonly type: 'ACTION_PENDING'; readonly pending: PendingView }
  | {
      readonly type: 'ACTION_RESOLVED';
      readonly turn: number;
      readonly player: PlayerId;
      readonly kind: ActionKind;
      readonly card: CardFace;
      readonly destination: string;
      readonly valid: boolean;
      readonly decision?: Decision;
    }
  | {
      readonly type: 'CHALLENGE_SOLVED';
      readonly challengeId: string;
      readonly card: CardFace;
      readonly solvedBy: PlayerId;
      readonly sourceRef: GeneratedSourceRef;
    }
  | {
      readonly type: 'PENALTY_DRAWN';
      readonly player: PlayerId;
      readonly reason: string;
      /** Present only when the viewer is the player who drew the card. */
      readonly card?: CardFace;
    }
  | {
      readonly type: 'PENALTY_WAIVED';
      readonly owed: readonly { readonly player: PlayerId; readonly reason: string }[];
      readonly fallbackStatus: string;
    }
  | {
      readonly type: 'PENALTY_NOT_APPLIED';
      readonly owed: readonly { readonly player: PlayerId; readonly reason: string }[];
    }
  | { readonly type: 'GAME_ENDED'; readonly outcome: GameOutcome };

const face = (state: EngineState, cardId: string): CardFace => ({
  handle: String(state.handleByCard[cardId]),
  displayValue: String(state.cards[cardId]?.displayValue),
});

const copySourceRef = (ref: GeneratedSourceRef): GeneratedSourceRef => ({
  subjectId: ref.subjectId,
  ...(ref.topicId === undefined ? {} : { topicId: ref.topicId }),
});

/** A deep, plain copy of an outcome. */
export const copyOutcome = (outcome: GameOutcome): GameOutcome =>
  outcome.kind === 'solitaire'
    ? { kind: 'solitaire', turns: outcome.turns, cardsRemaining: outcome.cardsRemaining, score: outcome.score, endedBy: [...outcome.endedBy] }
    : {
        kind: 'vsBeepy',
        winner: outcome.winner,
        reason: outcome.reason,
        handCounts: { human: outcome.handCounts.human, beepy: outcome.handCounts.beepy },
        credits: { human: outcome.credits.human, beepy: outcome.credits.beepy },
      };

/** Build the sanitized view of one game for one player. */
export function buildPlayerView(
  state: EngineState,
  viewer: PlayerId,
  outcomes: readonly GameOutcome[] = [],
): PlayerView {
  const opponent: PlayerId = viewer === 'human' ? 'beepy' : 'human';
  const challenges: ChallengeView[] = state.deck.challenges.map((challenge) => {
    const solver = state.solvedBy[challenge.id];
    const playedId = state.played[challenge.id];
    if (solver === undefined || playedId === undefined) {
      return { id: challenge.id, promptText: challenge.promptText, status: 'open' };
    }
    return {
      id: challenge.id,
      promptText: challenge.promptText,
      status: 'solved',
      solvedBy: solver,
      playedCard: face(state, playedId),
      sourceRef: copySourceRef(challenge.sourceRef),
    };
  });
  const pending = state.pending;
  const status = seriesStatus(state.mode, outcomes);
  const stats = state.stats[viewer];
  return {
    mode: state.mode,
    viewer,
    gameIndex: state.gameIndex,
    phase: state.phase,
    activePlayer: state.activePlayer,
    turnCount: state.turnCount,
    hand: state.hands[viewer].map((id) => face(state, id)),
    ...(state.mode === 'vsBeepy' ? { opponentHandCount: state.hands[opponent].length } : {}),
    challenges,
    discard: state.discard.map((id) => face(state, id)),
    drawPileCount: state.drawPile.length,
    ...(pending === undefined
      ? {}
      : {
          pending: {
            player: pending.player,
            kind: pending.kind,
            card: face(state, pending.cardId),
            destination: pending.challengeId ?? 'discard',
          },
        }),
    stats: { ...stats },
    ...(state.outcome === undefined ? {} : { outcome: copyOutcome(state.outcome) }),
    ...(status.ok ? { series: structuredClone(status.status) } : {}),
  };
}

/**
 * Project private events (produced by one step) into the events a viewer may see.
 * `after` is the state after the step; card faces are looked up there.
 */
export function toPublicEvents(
  events: readonly EngineEvent[],
  after: EngineState,
  viewer: PlayerId,
): PublicEvent[] {
  const out: PublicEvent[] = [];
  for (const event of events) {
    switch (event.type) {
      case 'GAME_DEALT':
        out.push({
          type: 'GAME_STARTED',
          gameIndex: event.gameIndex,
          mode: event.mode,
          firstPlayer: event.firstPlayer,
          handCounts: { human: event.hands.human.length, beepy: event.hands.beepy.length },
          drawPileCount: event.drawPile.length,
        });
        break;
      case 'ACTION_SUBMITTED':
        // Only an action that waits for evaluation is announced before resolution.
        if (after.pending !== undefined && after.phase === 'awaitingEvaluation') {
          out.push({
            type: 'ACTION_PENDING',
            pending: {
              player: event.player,
              kind: event.kind,
              card: face(after, event.cardId),
              destination: event.challengeId ?? 'discard',
            },
          });
        }
        break;
      case 'ACTION_RESOLVED':
        out.push({
          type: 'ACTION_RESOLVED',
          turn: event.turn,
          player: event.player,
          kind: event.kind,
          card: face(after, event.cardId),
          destination: event.challengeId ?? 'discard',
          valid: event.valid,
          ...(event.decision === undefined ? {} : { decision: event.decision }),
        });
        break;
      case 'CHALLENGE_SOLVED':
        out.push({
          type: 'CHALLENGE_SOLVED',
          challengeId: event.challengeId,
          card: face(after, event.cardId),
          solvedBy: event.solvedBy,
          sourceRef: copySourceRef(event.sourceRef),
        });
        break;
      case 'PENALTY_DRAWN':
        out.push({
          type: 'PENALTY_DRAWN',
          player: event.player,
          reason: event.reason,
          ...(event.player === viewer ? { card: face(after, event.cardId) } : {}),
        });
        break;
      case 'PENALTY_EXHAUSTED':
        out.push({
          type: 'PENALTY_WAIVED',
          owed: event.owed.map((o) => ({ player: o.playerId, reason: o.reason })),
          fallbackStatus: event.exhausted.details.fallback.status,
        });
        break;
      case 'PENALTY_NOT_APPLIED':
        out.push({
          type: 'PENALTY_NOT_APPLIED',
          owed: event.owed.map((o) => ({ player: o.playerId, reason: o.reason })),
        });
        break;
      case 'GAME_ENDED':
        out.push({ type: 'GAME_ENDED', outcome: copyOutcome(event.outcome) });
        break;
      case 'CARD_DISCARDED':
      case 'TURN_COUNTED':
        // Already conveyed by ACTION_RESOLVED.
        break;
    }
  }
  return out;
}
