/**
 * M3 E2 (createGame level) and E3 - game creation, dealing, handles, determinism.
 */

import { describe, expect, it } from 'vitest';
import { createGameState } from '../src/game/game.js';
import { dealHands } from '../src/game/deal.js';
import { validateDualStartingHands } from '../src/dual-hand.js';
import { validateStartingHand } from '../src/starting-hand.js';
import type { GeneratedDeck } from '../src/generated-deck.js';
import { cloneDeck, cloneMatrix, deepFreeze } from './fixtures.js';
import { COMBOS, expectInvariants, sample, start } from './m3-helpers.js';
import type { EngineMode, EngineState } from '../src/game/types.js';

const MODES: EngineMode[] = ['solitaire', 'vsBeepy'];

const designated = (state: EngineState): Set<string> =>
  new Set(state.deck.challenges.map((c) => c.correctAnswerCardId));

describe('createGameState: refusal and structured errors', () => {
  const s = sample('solitaire');

  it.each(['tutor', 'vsPlayer'])('rejects %s with MODE_NOT_IMPLEMENTED (it does not run as Solitaire)', (mode) => {
    const result = createGameState({ mode, deck: s.deck, contextualValidity: s.matrix, seed: 1, options: s.options });
    expect(result).toMatchObject({ ok: false, error: { code: 'MODE_NOT_IMPLEMENTED' } });
  });

  it('rejects an unknown mode with INVALID_MODE', () => {
    expect(createGameState({ mode: 'speed', deck: s.deck, contextualValidity: s.matrix, seed: 1 })).toMatchObject({
      ok: false,
      error: { code: 'INVALID_MODE' },
    });
  });

  it('returns GAME_SETUP_INVALID with every issue, and creates nothing', () => {
    const deck = cloneDeck(s.deck);
    deck.answerCards[deck.answerCards.length - 1]!.id = 'correct-0';
    deck.meta.targetCardCount = 3;
    const matrix = cloneMatrix(s.matrix);
    matrix['challenge-0']!['correct-1'] = true;
    const result = createGameState({ mode: 'solitaire', deck, contextualValidity: matrix, seed: 1, options: s.options });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('GAME_SETUP_INVALID');
    const stages = new Set(result.error.issues?.map((issue) => issue.stage));
    expect(stages).toContain('mapping');
    expect(stages).toContain('uniqueness');
    expect(stages).toContain('deckSize');
    expect('state' in result).toBe(false);
  });

  it('refuses a missing matrix', () => {
    const result = createGameState({ mode: 'solitaire', deck: s.deck, contextualValidity: undefined, seed: 1 });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.issues?.map((i) => i.code)).toContain('CONTEXTUAL_VALIDITY_MISSING');
    }
  });

  it('does not throw for garbage input', () => {
    for (const deck of [null, 7, 'x', {}, []]) {
      expect(() => createGameState({ mode: 'vsBeepy', deck, contextualValidity: {}, seed: 1 })).not.toThrow();
    }
  });

  it.each([
    [{ numericAnswers: 'yes' as unknown as boolean }],
    [{ maxPenaltyCandidates: 0 }],
    [{ maxPenaltyCandidates: 1.5 }],
  ])('rejects bad options %j', (options) => {
    expect(createGameState({ mode: 'solitaire', deck: s.deck, contextualValidity: s.matrix, seed: 1, options })).toMatchObject({
      ok: false,
      error: { code: 'INVALID_OPTION' },
    });
  });

  it.each([0, -1, 1.5])('rejects gameIndex %s', (gameIndex) => {
    expect(createGameState({ mode: 'solitaire', deck: s.deck, contextualValidity: s.matrix, seed: 1, gameIndex })).toMatchObject({
      ok: false,
      error: { code: 'INVALID_OPTION' },
    });
  });

  it('does not modify frozen inputs', () => {
    const deck = deepFreeze(cloneDeck(s.deck));
    const matrix = deepFreeze(cloneMatrix(s.matrix));
    expect(createGameState({ mode: 'solitaire', deck, contextualValidity: matrix, seed: 3, options: s.options }).ok).toBe(true);
  });
});

describe.each(MODES)('dealing: %s', (mode) => {
  describe.each(COMBOS)('%s / %s', (style, direction) => {
    it('deals valid hands over many seeds, re-validated with the M2 validators', () => {
      for (let seed = 1; seed <= 60; seed += 1) {
        const state = start(mode, { seed, style, direction });
        const numericAnswers = state.options.numericAnswers === true;
        const deck = state.deck as GeneratedDeck;
        if (mode === 'vsBeepy') {
          expect(validateDualStartingHands(deck, [state.hands.human, state.hands.beepy], { numericAnswers }).ok).toBe(true);
        } else {
          expect(validateStartingHand(deck, state.hands.human, { numericAnswers }).ok).toBe(true);
          expect(state.hands.beepy).toEqual([]);
        }
        expectInvariants(state);
      }
    });
  });

  it('gives each hand five distinct cards with two or three correct cards', () => {
    const counts = new Set<number>();
    for (let seed = 1; seed <= 100; seed += 1) {
      const state = start(mode, { seed });
      const players = mode === 'vsBeepy' ? (['human', 'beepy'] as const) : (['human'] as const);
      for (const player of players) {
        const hand = state.hands[player];
        expect(hand).toHaveLength(5);
        expect(new Set(hand).size).toBe(5);
        const correct = hand.filter((id) => designated(state).has(id)).length;
        expect([2, 3]).toContain(correct);
        counts.add(correct);
      }
    }
    expect(counts).toEqual(new Set([2, 3]));
  });

  it('conserves cards: hands + pile equal the deck at the start, discard and played empty', () => {
    const state = start(mode, { seed: 5 });
    expect(state.discard).toEqual([]);
    expect(state.played).toEqual({});
    const all = [...state.hands.human, ...state.hands.beepy, ...state.drawPile];
    expect(all.slice().sort()).toEqual(state.deck.answerCards.map((c) => c.id).sort());
  });

  it('is deterministic for a seed and varies across seeds', () => {
    expect(start(mode, { seed: 77 })).toEqual(start(mode, { seed: 77 }));
    const signatures = new Set<string>();
    for (let seed = 1; seed <= 30; seed += 1) {
      const state = start(mode, { seed });
      signatures.add(JSON.stringify([state.hands, state.drawPile]));
    }
    expect(signatures.size).toBeGreaterThan(25);
  });

  it('deals differently for different game indexes of the same series seed', () => {
    const a = start(mode, { seed: 9, gameIndex: 1 });
    const b = start(mode, { seed: 9, gameIndex: 2 });
    expect(JSON.stringify(a.hands)).not.toBe(JSON.stringify(b.hands));
  });

  it('does not let hand order reveal correctness (position is uniform over seeds)', () => {
    const atPosition = [0, 0, 0, 0, 0];
    const trials = 400;
    for (let seed = 1; seed <= trials; seed += 1) {
      const state = start(mode, { seed });
      state.hands.human.forEach((id, index) => {
        if (designated(state).has(id)) atPosition[index] = (atPosition[index] ?? 0) + 1;
      });
    }
    // Expected about 0.5 * trials = 200 per position.
    for (const count of atPosition) {
      expect(count).toBeGreaterThan(150);
      expect(count).toBeLessThan(250);
    }
  });

  it('shuffles the draw pile (a correct card reaches the top of the pile sometimes)', () => {
    let correctOnTop = 0;
    for (let seed = 1; seed <= 200; seed += 1) {
      const state = start(mode, { seed });
      const top = state.drawPile[0];
      if (top !== undefined && designated(state).has(top)) correctOnTop += 1;
    }
    expect(correctOnTop).toBeGreaterThan(0);
    expect(correctOnTop).toBeLessThan(200);
  });

  it('records the deal in the private history', () => {
    const state = start(mode, { seed: 2 });
    expect(state.history).toHaveLength(1);
    expect(state.history[0]).toMatchObject({ type: 'GAME_DEALT', gameIndex: 1, mode });
  });
});

describe('competitive dealing specifics', () => {
  it('never overlaps the two hands and leaves a distractor in the pile', () => {
    for (let seed = 1; seed <= 100; seed += 1) {
      const state = start('vsBeepy', { seed });
      const overlap = state.hands.human.filter((id) => state.hands.beepy.includes(id));
      expect(overlap).toEqual([]);
      expect(state.drawPile.some((id) => !designated(state).has(id))).toBe(true);
    }
  });

  it('uses both (2,2)-(3,3) correct-count splits over many seeds', () => {
    const splits = new Set<string>();
    for (let seed = 1; seed <= 200; seed += 1) {
      const state = start('vsBeepy', { seed });
      const d = designated(state);
      splits.add(
        `${state.hands.human.filter((id) => d.has(id)).length}-${state.hands.beepy.filter((id) => d.has(id)).length}`,
      );
    }
    expect(splits.size).toBeGreaterThanOrEqual(3);
  });

  it('with minimum distractors, still deals a valid game and leaves the penalty reserve', () => {
    const state = start('vsBeepy', { seed: 4, distractors: 5 });
    expect(state.drawPile.length).toBeGreaterThanOrEqual(1);
    expectInvariants(state);
  });

  it('human takes Game 1 first; Beepy takes even games first', () => {
    expect(start('vsBeepy', { gameIndex: 1 }).activePlayer).toBe('human');
    expect(start('vsBeepy', { gameIndex: 2 }).activePlayer).toBe('beepy');
    expect(start('vsBeepy', { gameIndex: 3 }).activePlayer).toBe('human');
    expect(start('vsBeepy', { gameIndex: 4 }).firstPlayer).toBe('beepy');
    expect(start('solitaire', { gameIndex: 2 }).activePlayer).toBe('human');
  });
});

describe('dealing never repairs a bad deal', () => {
  it('reports DEAL_INFEASIBLE if given a deck that cannot supply hands (gate bypassed)', () => {
    const s = sample('solitaire', 'math', 'factToSubject', { distractors: 1 });
    const result = dealHands(s.deck as GeneratedDeck, 'solitaire', 1, true);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues[0]?.code).toBe('DEAL_INFEASIBLE');
    }
  });

  it('reports M2 validator issues if the deck breaks uniqueness (gate bypassed)', () => {
    const s = sample('solitaire', 'clinical', 'subjectToFact');
    const deck = cloneDeck(s.deck);
    // Two cards share a value; the dealer must not hide or fix that.
    for (const card of deck.answerCards) card.displayValue = 'same';
    const result = dealHands(deck as GeneratedDeck, 'solitaire', 1, false);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues.every((issue) => issue.stage === 'deal')).toBe(true);
      expect(result.issues.length).toBeGreaterThan(0);
    }
  });
});

describe('handles', () => {
  it('are unique opaque tokens unrelated to card ids', () => {
    const state = start('vsBeepy', { seed: 6, style: 'clinical' });
    const handles = Object.keys(state.cardByHandle);
    expect(new Set(handles).size).toBe(handles.length);
    for (const handle of handles) {
      expect(handle).toMatch(/^h[0-9a-z]{7}$/);
      const id = state.cardByHandle[handle] as string;
      expect(handle).not.toContain(id);
    }
  });

  it('do not order cards by deck position or correctness', () => {
    let correctFirst = 0;
    const trials = 200;
    for (let seed = 1; seed <= trials; seed += 1) {
      const state = start('solitaire', { seed });
      const sorted = Object.keys(state.cardByHandle).sort();
      const firstId = state.cardByHandle[sorted[0] as string] as string;
      if (designated(state).has(firstId)) correctFirst += 1;
    }
    // 5 of 13 cards are correct: expect about 38%, not 0% or 100%.
    expect(correctFirst).toBeGreaterThan(40);
    expect(correctFirst).toBeLessThan(120);
  });
});
