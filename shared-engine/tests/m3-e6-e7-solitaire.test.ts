/**
 * M3 E6 and E7 - Solitaire turns, ending, and scoring (requirement 5). Session
 * bookkeeping is tested in m3-series.test.ts.
 */

import { describe, expect, it } from 'vitest';
import { submitAction } from '../src/game/game.js';
import { solitaireOutcome } from '../src/game/solitaire.js';
import {
  COMBOS,
  act,
  craft,
  correctInHand,
  discardReq,
  discardableInHand,
  expectInvariants,
  invalidRequest,
  playReq,
  start,
  validRequest,
} from './m3-helpers.js';

const types = (events: readonly { type: string }[]): string[] => events.map((e) => e.type);

describe.each(COMBOS)('E6 Solitaire turns (%s / %s)', (style, direction) => {
  const begin = (seed = 1) => start('solitaire', { seed, style, direction });

  it('valid play: card leaves the hand, challenge solved, one turn, no penalty', () => {
    const state = begin();
    const { cardId, challengeId } = correctInHand(state, 'human')[0]!;
    const step = act(state, playReq(state, 'human', cardId, challengeId));
    const next = step.state;
    expect(next.hands.human).toHaveLength(4);
    expect(next.hands.human).not.toContain(cardId);
    expect(next.played[challengeId]).toBe(cardId);
    expect(next.solvedBy[challengeId]).toBe('human');
    expect(next.turnCount).toBe(1);
    expect(next.drawPile).toEqual(state.drawPile);
    expect(next.discard).toEqual([]);
    expect(next.stats.human).toMatchObject({ turns: 1, correctPlays: 1, incorrectPlays: 0 });
    expect(types(step.events)).toEqual(['ACTION_SUBMITTED', 'ACTION_RESOLVED', 'CHALLENGE_SOLVED', 'TURN_COUNTED']);
    expectInvariants(next);
  });

  it('invalid play: the card stays, one penalty card is drawn, one turn', () => {
    const state = begin();
    const wrong = discardableInHand(state, 'human')[0]!;
    const challengeId = state.deck.challenges[0]!.id;
    const step = act(state, playReq(state, 'human', wrong, challengeId));
    const next = step.state;
    expect(next.hands.human).toContain(wrong);
    expect(next.hands.human).toHaveLength(6);
    expect(next.hands.human.at(-1)).toBe(state.drawPile[0]);
    expect(next.drawPile).toEqual(state.drawPile.slice(1));
    expect(next.turnCount).toBe(1);
    expect(Object.keys(next.solvedBy)).toEqual([]);
    expect(next.stats.human).toMatchObject({ turns: 1, correctPlays: 0, incorrectPlays: 1 });
    expect(types(step.events)).toEqual(['ACTION_SUBMITTED', 'ACTION_RESOLVED', 'TURN_COUNTED', 'PENALTY_DRAWN']);
    expectInvariants(next);
  });

  it('valid discard: the card goes to the discard pile, one turn, no penalty', () => {
    const state = begin();
    const card = discardableInHand(state, 'human')[0]!;
    const step = act(state, discardReq(state, 'human', card));
    expect(step.state.discard).toEqual([card]);
    expect(step.state.hands.human).toHaveLength(4);
    expect(step.state.turnCount).toBe(1);
    expect(step.state.stats.human).toMatchObject({ correctDiscards: 1, incorrectDiscards: 0 });
    expect(types(step.events)).toEqual(['ACTION_SUBMITTED', 'ACTION_RESOLVED', 'CARD_DISCARDED', 'TURN_COUNTED']);
    expectInvariants(step.state);
  });

  it('invalid discard: the card stays, one penalty card is drawn, one turn', () => {
    const state = begin();
    const correct = correctInHand(state, 'human')[0]!.cardId;
    const step = act(state, discardReq(state, 'human', correct));
    expect(step.state.hands.human).toContain(correct);
    expect(step.state.hands.human).toHaveLength(6);
    expect(step.state.discard).toEqual([]);
    expect(step.state.turnCount).toBe(1);
    expect(step.state.stats.human).toMatchObject({ correctDiscards: 0, incorrectDiscards: 1 });
    expectInvariants(step.state);
  });

  it('counts every judged action as one turn and keeps stats separate from the score', () => {
    let state = begin(9);
    for (let i = 1; i <= 6 && state.phase !== 'ended'; i += 1) {
      state = act(state, i % 2 === 0 ? invalidRequest(state, 'human') : validRequest(state, 'human')).state;
      expect(state.turnCount).toBe(i);
      expect(state.stats.human.turns).toBe(i);
      expectInvariants(state);
    }
    const s = state.stats.human;
    expect(s.correctPlays + s.incorrectPlays + s.correctDiscards + s.incorrectDiscards).toBe(state.turnCount);
  });

  it('a rejected request is not a turn', () => {
    const state = begin();
    expect(submitAction(state, { player: 'human', kind: 'discard', handle: 'bad' }).ok).toBe(false);
    expect(state.turnCount).toBe(0);
  });
});

describe('E7 Solitaire ending and scoring', () => {
  const base = () => start('solitaire', { seed: 2 });
  const four = { 'challenge-0': 'human', 'challenge-1': 'human', 'challenge-2': 'human', 'challenge-3': 'human' } as const;

  it('ends when the hand becomes empty, before all challenges are solved', () => {
    const state = craft(base(), { human: ['distractor-0'], turnCount: 3 });
    const step = act(state, discardReq(state, 'human', 'distractor-0'));
    expect(step.state.phase).toBe('ended');
    expect(step.state.outcome).toEqual({ kind: 'solitaire', turns: 4, cardsRemaining: 0, score: 4, endedBy: ['handEmpty'] });
    expect(types(step.events).slice(-2)).toEqual(['TURN_COUNTED', 'GAME_ENDED']);
  });

  it('ends when all five challenges are solved, scoring turns plus cards left in hand', () => {
    const state = craft(base(), { human: ['correct-4', 'distractor-0', 'distractor-1'], solved: four, turnCount: 6 });
    const step = act(state, playReq(state, 'human', 'correct-4', 'challenge-4'));
    expect(step.state.phase).toBe('ended');
    expect(step.state.outcome).toEqual({ kind: 'solitaire', turns: 7, cardsRemaining: 2, score: 9, endedBy: ['allSolved'] });
  });

  it('a final play that both solves the last challenge and empties the hand is one ending', () => {
    const state = craft(base(), { human: ['correct-4'], solved: four, turnCount: 9 });
    const step = act(state, playReq(state, 'human', 'correct-4', 'challenge-4'));
    expect(step.state.outcome).toEqual({
      kind: 'solitaire',
      turns: 10,
      cardsRemaining: 0,
      score: 10,
      endedBy: ['handEmpty', 'allSolved'],
    });
    expect(types(step.events).filter((t) => t === 'GAME_ENDED')).toHaveLength(1);
  });

  it('an invalid action never ends the game (the hand cannot empty)', () => {
    const state = craft(base(), { human: ['correct-0'] });
    const step = act(state, discardReq(state, 'human', 'correct-0'));
    expect(step.state.phase).toBe('awaitingAction');
    expect(step.state.hands.human).toHaveLength(2);
  });

  it('nothing more can be done after the game ends', () => {
    const state = craft(base(), { human: ['distractor-0'] });
    const ended = act(state, discardReq(state, 'human', 'distractor-0')).state;
    expect(submitAction(ended, discardReq(ended, 'human', 'distractor-0'))).toMatchObject({
      ok: false,
      error: { code: 'GAME_ENDED' },
    });
  });

  it('real games always end with score = turns + cards in hand', () => {
    for (let seed = 1; seed <= 40; seed += 1) {
      let state = start('solitaire', { seed });
      let steps = 0;
      while (state.phase !== 'ended' && steps < 500) {
        const invalid = seed % 3 === 0 && steps % 4 === 1;
        state = act(state, invalid ? invalidRequest(state, 'human') : validRequest(state, 'human')).state;
        steps += 1;
      }
      expect(state.phase).toBe('ended');
      const outcome = state.outcome!;
      expect(outcome.kind).toBe('solitaire');
      if (outcome.kind === 'solitaire') {
        expect(outcome.score).toBe(state.turnCount + state.hands.human.length);
        expect(outcome.cardsRemaining).toBe(state.hands.human.length);
      }
      expectInvariants(state);
    }
  });

  it('solitaireOutcome is undefined while play continues', () => {
    expect(solitaireOutcome({ handCount: 3, solvedCount: 2, challengeCount: 5, turns: 4 })).toBeUndefined();
  });

  it('stores no round: turns are scored (terminology)', () => {
    const keys = Object.keys(start('solitaire'));
    expect(keys).not.toContain('round');
    expect(keys).not.toContain('roundNumber');
  });
});
