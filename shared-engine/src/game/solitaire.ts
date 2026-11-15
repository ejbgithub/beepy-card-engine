/**
 * Solitaire rules (Milestone M3, E6-E7; requirement 5; master spec section 5).
 *
 * Five challenges, one human hand. A game ends immediately when the hand is empty
 * or all challenges are solved, whichever occurs first (both at once is one
 * ending). Game score = turns taken + cards remaining in hand (lower is better).
 * A session is the sum of five game scores. Turns are scored, not rounds: in
 * Solitaire a round and a turn are the same single event and no round is stored.
 */

import { PENALTY_REASONS } from '../penalty-draw.js';
import type { EndReason, GameOutcome, OwedPenalty } from './types.js';

/** Games in a Solitaire session. */
export const SOLITAIRE_SESSION_GAMES = 5;

/** The penalty owed after a Solitaire action: one draw for an invalid action. */
export function solitairePenalties(valid: boolean): OwedPenalty[] {
  return valid ? [] : [{ playerId: 'human', reason: PENALTY_REASONS.invalidAction }];
}

/** The outcome if the game has ended after this action, otherwise `undefined`. */
export function solitaireOutcome(input: {
  readonly handCount: number;
  readonly solvedCount: number;
  readonly challengeCount: number;
  readonly turns: number;
}): GameOutcome | undefined {
  const endedBy: EndReason[] = [];
  if (input.handCount === 0) {
    endedBy.push('handEmpty');
  }
  if (input.solvedCount === input.challengeCount) {
    endedBy.push('allSolved');
  }
  if (endedBy.length === 0) {
    return undefined;
  }
  return {
    kind: 'solitaire',
    turns: input.turns,
    cardsRemaining: input.handCount,
    score: input.turns + input.handCount,
    endedBy,
  };
}
