/**
 * Feedback messages (Milestone M5, U3; decision U-3). Pure: no DOM, no engine calls.
 *
 * `toFeedback(events)` turns the public events of ONE step into a few short
 * messages for a second grader. Every message follows from an event that the
 * engine actually produced:
 *   - the verdict comes from `ACTION_RESOLVED.valid` (and `decision` for Beepy);
 *   - a penalty card is announced ONLY for a `PENALTY_DRAWN` event, one line per
 *     player with the real count;
 *   - a waived penalty (`PENALTY_WAIVED`) and a penalty not applied because the game
 *     ended (`PENALTY_NOT_APPLIED`) have their own messages, so they are never
 *     confused with a drawn card;
 *   - the ending comes from `GAME_ENDED.outcome`.
 * It never states the correct answer, an explanation, or any arithmetic. The text
 * is a fixed table written for this app.
 */

import type { PlayerId, PublicEvent } from '@beepy/shared-engine';

export type FeedbackTone = 'good' | 'oops' | 'info';

export interface FeedbackItem {
  readonly tone: FeedbackTone;
  readonly text: string;
}

export interface Feedback {
  readonly items: readonly FeedbackItem[];
  /** Handles of cards the human just drew as penalties (for a brief highlight). */
  readonly newCardHandles: readonly string[];
}

/** The fixed message table (owner-editable wording). */
export const FEEDBACK_TEXT = {
  gameStarted: 'New game! Pick a card from your hand.',
  humanPlayGood: 'Great! That card solves the problem.',
  humanDiscardGood: 'Good discard.',
  humanWrong: "Oops, that wasn't right. The card stays in your hand.",
  beepyPending: 'Beepy made a move. Do you Accept it or Challenge it?',
  beepyValidAccepted: "You're right, Beepy's move was correct.",
  beepyValidChallenged: "Beepy's move was correct.",
  beepyInvalidChallenged: "Good catch! Beepy's move was wrong.",
  beepyInvalidAccepted: "Beepy's move was wrong.",
  waived: 'No cards were left to draw, so no penalty card this time.',
  notApplied: 'The game ended, so no penalty card was drawn.',
} as const;

const drewText = (player: PlayerId, count: number): string => {
  const cards = `${count} card${count === 1 ? '' : 's'}`;
  return player === 'human' ? `You drew ${cards}.` : `Beepy drew ${cards}.`;
};

/** Messages for the events of one step. */
export function toFeedback(events: readonly PublicEvent[]): Feedback {
  const items: FeedbackItem[] = [];
  const newCardHandles: string[] = [];
  const drawn: Record<PlayerId, number> = { human: 0, beepy: 0 };
  let ending: FeedbackItem | undefined;

  for (const event of events) {
    switch (event.type) {
      case 'GAME_STARTED':
        items.push({ tone: 'info', text: FEEDBACK_TEXT.gameStarted });
        break;
      case 'ACTION_PENDING':
        if (event.pending.player === 'beepy') items.push({ tone: 'info', text: FEEDBACK_TEXT.beepyPending });
        break;
      case 'ACTION_RESOLVED':
        if (event.player === 'human') {
          if (event.valid) {
            items.push({ tone: 'good', text: event.kind === 'play' ? FEEDBACK_TEXT.humanPlayGood : FEEDBACK_TEXT.humanDiscardGood });
          } else {
            items.push({ tone: 'oops', text: FEEDBACK_TEXT.humanWrong });
          }
        } else if (event.decision === 'accept') {
          items.push(
            event.valid
              ? { tone: 'good', text: FEEDBACK_TEXT.beepyValidAccepted }
              : { tone: 'oops', text: FEEDBACK_TEXT.beepyInvalidAccepted },
          );
        } else if (event.decision === 'challenge') {
          items.push(
            event.valid
              ? { tone: 'oops', text: FEEDBACK_TEXT.beepyValidChallenged }
              : { tone: 'good', text: FEEDBACK_TEXT.beepyInvalidChallenged },
          );
        }
        break;
      case 'PENALTY_DRAWN':
        drawn[event.player] += 1;
        if (event.player === 'human' && event.card !== undefined) newCardHandles.push(event.card.handle);
        break;
      case 'PENALTY_WAIVED':
        items.push({ tone: 'info', text: FEEDBACK_TEXT.waived });
        break;
      case 'PENALTY_NOT_APPLIED':
        items.push({ tone: 'info', text: FEEDBACK_TEXT.notApplied });
        break;
      case 'GAME_ENDED': {
        const outcome = event.outcome;
        ending =
          outcome.kind === 'solitaire'
            ? { tone: 'info', text: `Game over! Your score is ${outcome.score}.` }
            : outcome.winner === 'human'
              ? { tone: 'good', text: 'You win this game!' }
              : { tone: 'info', text: 'Beepy wins this game.' };
        break;
      }
      case 'CHALLENGE_SOLVED':
        // Shown by the board (solved state, solver).
        break;
    }
  }

  // One line per player, with the real count of cards the engine dealt.
  if (drawn.human > 0) items.push({ tone: 'oops', text: drewText('human', drawn.human) });
  if (drawn.beepy > 0) items.push({ tone: 'info', text: drewText('beepy', drawn.beepy) });
  if (ending !== undefined) items.push(ending);

  return { items, newCardHandles };
}
