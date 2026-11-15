/**
 * Shared helpers for the M3 game-engine test suites.
 *
 * Decks come from the M2 fixture builders (validated sample decks). Clinical-style
 * decks use placeholder text only; no clinical content is invented.
 */

import {
  COMBOS,
  buildDeck,
  fullMatrix,
  isNumericStyle,
  type ContentStyle,
  type MutableDeck,
  type MutableMatrix,
} from './fixtures.js';
import { canonicalNumber, normalizeDisplayText } from '../src/index.js';
import type { GenerationDirection } from '../src/index.js';
import type { EngineMode, GameOptions } from '../src/game/types.js';

export { COMBOS };

export interface Sample {
  readonly deck: MutableDeck;
  readonly matrix: MutableMatrix;
  readonly options: GameOptions;
  readonly style: ContentStyle;
  readonly direction: GenerationDirection;
}

/** A valid sample deck and matrix for a mode and (style, direction) combination. */
export function sample(
  mode: EngineMode,
  style: ContentStyle = 'math',
  direction: GenerationDirection = style === 'math' ? 'factToSubject' : 'subjectToFact',
  extra: { distractors?: number } = {},
): Sample {
  const correct = mode === 'vsBeepy' ? 9 : 5;
  const distractors = extra.distractors ?? (mode === 'vsBeepy' ? 15 : 8);
  const deck = buildDeck({ style, direction, correct, distractors });
  return {
    deck,
    matrix: fullMatrix(deck),
    options: { numericAnswers: isNumericStyle(style, direction) },
    style,
    direction,
  };
}

// ---- Internal-state helpers (tests may use the pure core directly) ---------

import { expect } from 'vitest';
import { createGameState, evaluatePending, submitAction } from '../src/game/game.js';
import type {
  ActionRequest,
  Decision,
  EngineState,
  PlayerId,
  Step,
  StepResult,
} from '../src/game/types.js';
import { openChallengeIds } from '../src/game/judge.js';

/** Unwrap a successful step or fail the test. */
export function ok(result: StepResult): Step {
  if (!result.ok) {
    throw new Error(`expected success, got ${result.error.code}: ${result.error.message}`);
  }
  return result;
}

export interface StartOptions {
  readonly seed?: number;
  readonly style?: ContentStyle;
  readonly direction?: GenerationDirection;
  readonly gameIndex?: number;
  readonly distractors?: number;
  readonly fallback?: GameOptions['fallback'];
  readonly maxPenaltyCandidates?: number;
}

/** Start a game from a valid sample deck. */
export function start(mode: EngineMode, o: StartOptions = {}): EngineState {
  const s = sample(mode, o.style ?? 'math', o.direction, o.distractors === undefined ? {} : { distractors: o.distractors });
  const options: GameOptions = {
    ...s.options,
    ...(o.fallback === undefined ? {} : { fallback: o.fallback }),
    ...(o.maxPenaltyCandidates === undefined ? {} : { maxPenaltyCandidates: o.maxPenaltyCandidates }),
  };
  return ok(
    createGameState({
      mode,
      deck: s.deck,
      contextualValidity: s.matrix,
      seed: o.seed ?? 1,
      ...(o.gameIndex === undefined ? {} : { gameIndex: o.gameIndex }),
      options,
    }),
  ).state;
}

export const handleOf = (state: EngineState, cardId: string): string => {
  const handle = state.handleByCard[cardId];
  if (handle === undefined) throw new Error(`no handle for ${cardId}`);
  return handle;
};

/** The challenge a card is designated for (it may already be solved), if any. */
export const designatedChallenge = (state: EngineState, cardId: string): string | undefined =>
  state.deck.challenges.find((c) => c.correctAnswerCardId === cardId)?.id;

/** Cards in a hand that are correct for a still-open challenge. */
export function correctInHand(state: EngineState, player: PlayerId): Array<{ cardId: string; challengeId: string }> {
  const open = new Set(openChallengeIds(state));
  return state.hands[player].flatMap((cardId) => {
    const challengeId = designatedChallenge(state, cardId);
    return challengeId !== undefined && open.has(challengeId) ? [{ cardId, challengeId }] : [];
  });
}

/** Cards in a hand that are valid to discard. */
export function discardableInHand(state: EngineState, player: PlayerId): string[] {
  const open = new Set(openChallengeIds(state));
  return state.hands[player].filter((cardId) => {
    const challengeId = designatedChallenge(state, cardId);
    return challengeId === undefined || !open.has(challengeId);
  });
}

export const playReq = (state: EngineState, player: PlayerId, cardId: string, challengeId: string): ActionRequest => ({
  player,
  kind: 'play',
  handle: handleOf(state, cardId),
  challengeId,
});

export const discardReq = (state: EngineState, player: PlayerId, cardId: string): ActionRequest => ({
  player,
  kind: 'discard',
  handle: handleOf(state, cardId),
});

/** Submit, require success. */
export const act = (state: EngineState, request: ActionRequest): Step => ok(submitAction(state, request));
export const decide = (state: EngineState, decision: Decision): Step => ok(evaluatePending(state, decision));

/** A valid action for `player` using one of their cards, preferring plays. */
export function validRequest(state: EngineState, player: PlayerId): ActionRequest {
  const correct = correctInHand(state, player)[0];
  if (correct !== undefined) {
    return playReq(state, player, correct.cardId, correct.challengeId);
  }
  const discardable = discardableInHand(state, player)[0];
  if (discardable === undefined) throw new Error('no valid action exists');
  return discardReq(state, player, discardable);
}

/** An invalid action for `player`: discard a correct card, or play a wrong card. */
export function invalidRequest(state: EngineState, player: PlayerId): ActionRequest {
  const correct = correctInHand(state, player)[0];
  if (correct !== undefined) {
    return discardReq(state, player, correct.cardId);
  }
  const wrong = discardableInHand(state, player)[0];
  const challengeId = openChallengeIds(state)[0];
  if (wrong === undefined || challengeId === undefined) throw new Error('no invalid action exists');
  return playReq(state, player, wrong, challengeId);
}

/** All card ids across every zone. */
export function allCardIds(state: EngineState): string[] {
  return [
    ...state.hands.human,
    ...state.hands.beepy,
    ...state.drawPile,
    ...state.discard,
    ...Object.values(state.played),
  ];
}

/** Assert the structural invariants that must hold after every step. */
export function expectInvariants(state: EngineState): void {
  const ids = allCardIds(state);
  // Conservation and uniqueness of card ids across zones.
  expect(new Set(ids).size).toBe(ids.length);
  expect(ids.slice().sort()).toEqual(Object.keys(state.cards).sort());
  // No display value appears twice.
  // Uses the M2 normalizers. In numeric mode a non-numeric value is a failure, never
  // silently accepted.
  const numeric = state.options.numericAnswers === true;
  const key = (id: string): string => {
    const value = (state.cards[id] as { displayValue: string }).displayValue;
    if (numeric) {
      const canonical = canonicalNumber(value);
      expect(canonical, `card "${id}" has a non-numeric value "${value}" in numeric mode`).toBeDefined();
      return canonical as string;
    }
    return normalizeDisplayText(value);
  };
  const values = ids.map(key);
  expect(new Set(values).size).toBe(values.length);
  // A solved challenge holds exactly its designated card; open challenges hold nothing.
  for (const challenge of state.deck.challenges) {
    if (Object.hasOwn(state.solvedBy, challenge.id)) {
      expect(state.played[challenge.id]).toBe(challenge.correctAnswerCardId);
    } else {
      expect(Object.hasOwn(state.played, challenge.id)).toBe(false);
    }
  }
  // Exactly one designated card per challenge, all distinct.
  const designated = state.deck.challenges.map((c) => c.correctAnswerCardId);
  expect(new Set(designated).size).toBe(designated.length);
  // Handles are unique and cover every card.
  expect(Object.keys(state.cardByHandle).length).toBe(Object.keys(state.cards).length);
  for (const id of Object.keys(state.cards)) {
    expect(state.cardByHandle[state.handleByCard[id] as string]).toBe(id);
  }
}

/**
 * Build a consistent state by placing every card exactly once. Cards not placed in a
 * hand, the discard pile, as a solved card, or in the explicit `pile` go to the end
 * of the draw pile in deck order.
 *
 * FOR FOCUSED TESTS ONLY. A crafted state is a snapshot: its private history is the
 * history of the base state and does NOT describe how the cards got where they are
 * (there is no matching sequence of game events, and turn counts and stats are not
 * recomputed). Use it to set up a position and then exercise one transition; use real
 * play (`act`, `decide`) when the history itself is under test.
 *
 * It throws on: an unknown card id, an unknown challenge id, or a card assigned to
 * more than one place (including a solved challenge's own card also being placed).
 */
export function craft(
  base: EngineState,
  layout: {
    readonly human?: readonly string[];
    readonly beepy?: readonly string[];
    /** Challenge ids to mark solved, with who solved them. */
    readonly solved?: Readonly<Record<string, PlayerId>>;
    readonly discard?: readonly string[];
    readonly pile?: readonly string[];
    readonly turnCount?: number;
    readonly activePlayer?: PlayerId;
  },
): EngineState {
  const played: Record<string, string> = {};
  const solvedBy: Record<string, PlayerId> = {};
  for (const [challengeId, who] of Object.entries(layout.solved ?? {})) {
    const challenge = base.deck.challenges.find((c) => c.id === challengeId);
    if (challenge === undefined) throw new Error(`craft: unknown challenge "${challengeId}"`);
    played[challengeId] = challenge.correctAnswerCardId;
    solvedBy[challengeId] = who;
  }
  const human = layout.human ?? [];
  const beepy = layout.beepy ?? [];
  const discard = layout.discard ?? [];
  const pile = layout.pile ?? [];

  const placedAt = new Map<string, string>();
  const place = (ids: readonly string[], zone: string): void => {
    for (const id of ids) {
      if (!Object.hasOwn(base.cards, id)) throw new Error(`craft: unknown card id "${id}" in ${zone}`);
      const earlier = placedAt.get(id);
      if (earlier !== undefined) {
        throw new Error(`craft: card "${id}" is assigned to both ${earlier} and ${zone}`);
      }
      placedAt.set(id, zone);
    }
  };
  place(human, 'human hand');
  place(beepy, 'beepy hand');
  place(discard, 'discard');
  place(Object.values(played), 'a solved challenge');
  place(pile, 'pile');

  const rest = Object.keys(base.cards).filter((id) => !placedAt.has(id));
  return {
    ...base,
    hands: { human, beepy },
    discard,
    played,
    solvedBy,
    drawPile: [...pile, ...rest],
    turnCount: layout.turnCount ?? base.turnCount,
    activePlayer: layout.activePlayer ?? base.activePlayer,
    phase: 'awaitingAction',
  };
}
