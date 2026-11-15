/**
 * Player vs. Beepy rules (Milestone M3, E8-E10; requirements 6-7; master spec 7).
 *
 * Event to penalty mapping (the engine decides who draws; `drawPenaltyCards` is
 * event-agnostic):
 *
 *   human invalid action ................ human draws one
 *   Beepy valid, human Accepts .......... nobody draws
 *   Beepy valid, human Challenges ....... human draws one (wrong challenge)
 *   Beepy invalid, human Challenges ..... Beepy draws one
 *   Beepy invalid, human Accepts ........ BOTH draw one (one atomic event)
 *
 * Ending: either hand empty ends the game immediately and that player wins; with
 * all challenges solved and no empty hand, fewer remaining cards wins, then more
 * credited challenges. The empty-hand check runs BEFORE any penalty draw (game.ts).
 */

import { PENALTY_REASONS } from '../penalty-draw.js';
import type { Decision, GameOutcome, OwedPenalty, PlayerId } from './types.js';

/** Games in a competitive match, and wins needed. */
export const MATCH_GAMES = 5;
export const MATCH_WINS_NEEDED = 3;

/** The other player. */
export const otherPlayer = (player: PlayerId): PlayerId => (player === 'human' ? 'beepy' : 'human');

/**
 * Who takes the first turn of game `gameIndex` (1-based): the human in Game 1 and
 * every odd game, Beepy in every even game (owner decision D-3).
 */
export function firstPlayerForGame(gameIndex: number): PlayerId {
  return gameIndex % 2 === 1 ? 'human' : 'beepy';
}

/** Penalties owed after a competitive resolution. */
export function competitivePenalties(
  player: PlayerId,
  valid: boolean,
  decision: Decision | undefined,
): OwedPenalty[] {
  if (player === 'human') {
    return valid ? [] : [{ playerId: 'human', reason: PENALTY_REASONS.invalidAction }];
  }
  if (valid) {
    return decision === 'challenge'
      ? [{ playerId: 'human', reason: PENALTY_REASONS.wrongChallenge }]
      : [];
  }
  return decision === 'challenge'
    ? [{ playerId: 'beepy', reason: PENALTY_REASONS.invalidAction }]
    : [
        { playerId: 'human', reason: PENALTY_REASONS.missedChallenge },
        { playerId: 'beepy', reason: PENALTY_REASONS.invalidAction },
      ];
}

export type CompetitiveEnd =
  | { readonly kind: 'continue' }
  | { readonly kind: 'ended'; readonly outcome: GameOutcome }
  | { readonly kind: 'fault'; readonly message: string };

/** Decide whether a competitive game has ended, and who won. Pure. */
export function decideCompetitiveEnd(input: {
  readonly handCounts: Readonly<Record<PlayerId, number>>;
  readonly credits: Readonly<Record<PlayerId, number>>;
  readonly allSolved: boolean;
}): CompetitiveEnd {
  const { handCounts, credits, allSolved } = input;
  const done = (
    winner: PlayerId,
    reason: 'handEmpty' | 'fewerCards' | 'moreCredit',
  ): CompetitiveEnd => ({
    kind: 'ended',
    outcome: { kind: 'vsBeepy', winner, reason, handCounts: { ...handCounts }, credits: { ...credits } },
  });

  if (handCounts.human === 0 && handCounts.beepy === 0) {
    return { kind: 'fault', message: 'Both hands are empty at once.' };
  }
  if (handCounts.human === 0) {
    return done('human', 'handEmpty');
  }
  if (handCounts.beepy === 0) {
    return done('beepy', 'handEmpty');
  }
  if (!allSolved) {
    return { kind: 'continue' };
  }
  if (handCounts.human !== handCounts.beepy) {
    return done(handCounts.human < handCounts.beepy ? 'human' : 'beepy', 'fewerCards');
  }
  if (credits.human !== credits.beepy) {
    return done(credits.human > credits.beepy ? 'human' : 'beepy', 'moreCredit');
  }
  return { kind: 'fault', message: 'Remaining cards and credited challenges are both tied.' };
}
