/**
 * Authoritative judging and request checking (Milestone M3, E4; requirement 2).
 *
 * `judgeAction` is the ONLY place that decides whether a play or discard is valid.
 * It is a pure function of the engine state and the designated correct cards in the
 * generated deck. Beepy's behavior, the human's judgment, and any AI never reach it.
 *
 *   - play: valid only when the challenge is unsolved and the card is its
 *     `correctAnswerCardId`.
 *   - discard: valid only when the card is the designated correct card of NO
 *     remaining unsolved challenge.
 *
 * `checkRequest` rejects requests that are not legal moves at all (wrong player,
 * phase, card, or challenge, including an already-solved challenge). Those are
 * illegal requests: no state change, no turn, no penalty.
 */

import {
  ENGINE_ERROR_CODES as E,
  ENGINE_MODES,
  failure,
  type ActionKind,
  type ActionRequest,
  type EngineState,
  type Failure,
} from './types.js';

/** Challenge ids not yet solved. */
export function openChallengeIds(state: EngineState): string[] {
  return state.deck.challenges
    .filter((challenge) => !Object.hasOwn(state.solvedBy, challenge.id))
    .map((challenge) => challenge.id);
}

/** Is this play or discard valid? Assumes the request already passed `checkRequest`. */
export function judgeAction(
  state: EngineState,
  kind: ActionKind,
  cardId: string,
  challengeId?: string,
): boolean {
  if (kind === 'play') {
    const challenge = state.deck.challenges.find((candidate) => candidate.id === challengeId);
    return (
      challenge !== undefined &&
      !Object.hasOwn(state.solvedBy, challenge.id) &&
      challenge.correctAnswerCardId === cardId
    );
  }
  return !state.deck.challenges.some(
    (challenge) =>
      !Object.hasOwn(state.solvedBy, challenge.id) && challenge.correctAnswerCardId === cardId,
  );
}

/** A request that passed every legality check. */
export interface CheckedRequest {
  readonly ok: true;
  readonly cardId: string;
}

/** Check that a request is a legal move now. */
export function checkRequest(
  state: EngineState,
  request: ActionRequest,
): CheckedRequest | Failure {
  if (state.phase === 'ended') {
    return failure(E.gameEnded, 'The game has ended.');
  }
  if (state.phase !== 'awaitingAction') {
    return failure(E.wrongPhase, 'An action is already waiting to be evaluated.');
  }
  if (request.player !== 'human' && request.player !== 'beepy') {
    return failure(E.playerNotInMode, 'Unknown player.');
  }
  if (state.mode === ENGINE_MODES.solitaire && request.player !== 'human') {
    return failure(E.playerNotInMode, 'Solitaire has only the human player.');
  }
  if (request.player !== state.activePlayer) {
    return failure(E.notPlayersTurn, `It is not ${request.player}'s turn.`);
  }
  if (request.kind !== 'play' && request.kind !== 'discard') {
    return failure(E.invalidActionKind, 'An action must be a play or a discard.');
  }
  const cardId = Object.hasOwn(state.cardByHandle, request.handle)
    ? state.cardByHandle[request.handle]
    : undefined;
  if (cardId === undefined) {
    return failure(E.unknownHandle, 'No card has that handle.');
  }
  if (!state.hands[request.player].includes(cardId)) {
    return failure(E.cardNotInHand, 'That card is not in the acting player\'s hand.');
  }
  if (request.kind === 'discard') {
    if (request.challengeId !== undefined) {
      return failure(E.unexpectedChallenge, 'A discard cannot name a challenge.');
    }
    return { ok: true, cardId };
  }
  if (request.challengeId === undefined) {
    return failure(E.missingChallenge, 'A play must name a challenge.');
  }
  if (!state.deck.challenges.some((challenge) => challenge.id === request.challengeId)) {
    return failure(E.unknownChallenge, 'That challenge does not exist.');
  }
  if (Object.hasOwn(state.solvedBy, request.challengeId)) {
    return failure(E.challengeAlreadySolved, 'That challenge is already solved and cannot receive plays.');
  }
  return { ok: true, cardId };
}
