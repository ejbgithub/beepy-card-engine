/**
 * Penalty application (Milestone M3, E5; requirement 4).
 *
 * Wraps the M2 `drawPenaltyCards` for one resolution. The engine decides WHICH
 * events owe draws (see solitaire.ts and competitive.ts); this module supplies them
 * atomically:
 *   - all owed cards are supplied (draw pile first, then the bounded fallback) and
 *     join the hands of the players who owe them, in request order; or
 *   - none can be supplied: nothing is drawn, the structured
 *     `PENALTY_CARD_EXHAUSTED` condition is recorded, the draw penalty is WAIVED,
 *     and the game continues.
 *
 * A fallback card enters the game with an engine-minted handle and no explanation
 * (M2 drops explanations; Clinical never gets invented content). Cards are never
 * reused or fabricated.
 */

import type { GeneratedAnswerCard } from '../generated-deck.js';
import {
  drawPenaltyCards,
  type PenaltyDrawOptions,
} from '../penalty-draw.js';
import { mintHandle } from './deal.js';
import {
  ENGINE_ERROR_CODES as E,
  failure,
  type EngineEvent,
  type EngineState,
  type OwedPenalty,
  type PlayerId,
  type StepResult,
} from './types.js';

/** All cards currently outside the draw pile (hands, played, discard). */
function cardsOutsideDrawPile(state: EngineState): GeneratedAnswerCard[] {
  const ids = [
    ...state.hands.human,
    ...state.hands.beepy,
    ...state.discard,
    ...Object.values(state.played),
  ];
  return ids.map((id) => state.cards[id] as GeneratedAnswerCard);
}

/** Apply one atomic penalty event. An empty list changes nothing. */
export function applyPenaltyEvent(
  state: EngineState,
  owed: readonly OwedPenalty[],
): StepResult {
  if (owed.length === 0) {
    return { ok: true, state, events: [] };
  }

  const options: PenaltyDrawOptions = {
    activeChallenges: state.deck.challenges.filter(
      (challenge) => !Object.hasOwn(state.solvedBy, challenge.id),
    ),
    numericAnswers: state.options.numericAnswers === true,
    ...(state.options.fallback === undefined ? {} : { fallback: state.options.fallback }),
    ...(state.options.maxPenaltyCandidates === undefined
      ? {}
      : { maxCandidates: state.options.maxPenaltyCandidates }),
  };

  const result = drawPenaltyCards(
    {
      drawPile: state.drawPile.map((id) => state.cards[id] as GeneratedAnswerCard),
      cardsOutsideDrawPile: cardsOutsideDrawPile(state),
    },
    owed.map((penalty) => ({ playerId: penalty.playerId, reason: penalty.reason })),
    options,
  );

  if (!result.ok) {
    if ('exhausted' in result) {
      const event: EngineEvent = {
        type: 'PENALTY_EXHAUSTED',
        owed,
        exhausted: result.exhausted,
      };
      return {
        ok: true,
        state: { ...state, history: [...state.history, event] },
        events: [event],
      };
    }
    return failure(E.invalidOption, result.invalid.message);
  }

  const cards: Record<string, GeneratedAnswerCard> = { ...state.cards };
  const handleByCard: Record<string, string> = { ...state.handleByCard };
  const cardByHandle: Record<string, string> = { ...state.cardByHandle };
  const hands: Record<PlayerId, string[]> = {
    human: [...state.hands.human],
    beepy: [...state.hands.beepy],
  };
  let rng = state.rng;
  const events: EngineEvent[] = [];

  owed.forEach((penalty, index) => {
    const card = result.cards[index] as GeneratedAnswerCard;
    const source = result.sources[index] as 'drawPile' | 'fallback';
    if (source === 'fallback') {
      cards[card.id] = card;
      let handle: string;
      [handle, rng] = mintHandle(cardByHandle, rng);
      handleByCard[card.id] = handle;
      cardByHandle[handle] = card.id;
    }
    hands[penalty.playerId].push(card.id);
    events.push({
      type: 'PENALTY_DRAWN',
      player: penalty.playerId,
      cardId: card.id,
      reason: penalty.reason,
      source,
    });
  });

  return {
    ok: true,
    state: {
      ...state,
      cards,
      handleByCard,
      cardByHandle,
      hands,
      drawPile: result.drawPile.map((card) => card.id),
      rng,
      history: [...state.history, ...events],
    },
    events,
  };
}
