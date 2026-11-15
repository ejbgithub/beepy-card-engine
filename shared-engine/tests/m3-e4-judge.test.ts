/**
 * M3 E4 - authoritative judging and illegal requests (requirement 2).
 */

import { describe, expect, it } from 'vitest';
import { submitAction } from '../src/game/game.js';
import { judgeAction } from '../src/game/judge.js';
import { deepFreeze } from './fixtures.js';
import {
  COMBOS,
  act,
  allCardIds,
  correctInHand,
  designatedChallenge,
  discardReq,
  discardableInHand,
  expectInvariants,
  handleOf,
  invalidRequest,
  playReq,
  start,
  validRequest,
} from './m3-helpers.js';
import type { EngineState } from '../src/game/types.js';

describe.each(COMBOS)('judging (%s / %s)', (style, direction) => {
  const begin = (seed = 1): EngineState => start('solitaire', { seed, style, direction });

  it('a play is valid only for the designated card on its own open challenge', () => {
    const state = begin();
    const { cardId, challengeId } = correctInHand(state, 'human')[0]!;
    expect(judgeAction(state, 'play', cardId, challengeId)).toBe(true);
    for (const challenge of state.deck.challenges) {
      if (challenge.id !== challengeId) {
        expect(judgeAction(state, 'play', cardId, challenge.id)).toBe(false);
      }
    }
    for (const wrongId of state.hands.human.filter((id) => id !== cardId)) {
      expect(judgeAction(state, 'play', wrongId, challengeId)).toBe(false);
    }
  });

  it('the same card played onto a different open challenge is an invalid action with a penalty', () => {
    const state = begin();
    const { cardId, challengeId } = correctInHand(state, 'human')[0]!;
    const other = state.deck.challenges.find((c) => c.id !== challengeId)!;
    const step = act(state, playReq(state, 'human', cardId, other.id));
    expect(step.state.turnCount).toBe(1);
    expect(step.state.hands.human).toContain(cardId);
    expect(Object.keys(step.state.solvedBy)).toEqual([]);
    expect(step.state.hands.human).toHaveLength(6);
    expect(step.events.find((e) => e.type === 'ACTION_RESOLVED')).toMatchObject({ valid: false });
  });

  it('a discard is valid only for a card that is the designated card of no open challenge', () => {
    const state = begin();
    for (const id of state.hands.human) {
      const isCorrect = designatedChallenge(state, id) !== undefined;
      expect(judgeAction(state, 'discard', id)).toBe(!isCorrect);
    }
    const wrong = act(state, discardReq(state, 'human', correctInHand(state, 'human')[0]!.cardId));
    expect(wrong.events.find((e) => e.type === 'ACTION_RESOLVED')).toMatchObject({ valid: false });
    const right = act(state, discardReq(state, 'human', discardableInHand(state, 'human')[0]!));
    expect(right.events.find((e) => e.type === 'ACTION_RESOLVED')).toMatchObject({ valid: true });
    expect(right.state.discard).toHaveLength(1);
  });

  it('a successfully played correct card stays attached to the challenge it solved, in no other zone', () => {
    let state = begin();
    const solved: Array<{ cardId: string; challengeId: string }> = [];
    for (let step = 0; step < 4 && state.phase !== 'ended'; step += 1) {
      const target = correctInHand(state, 'human')[0];
      if (target === undefined) break;
      state = act(state, playReq(state, 'human', target.cardId, target.challengeId)).state;
      solved.push(target);
      for (const { cardId, challengeId } of solved) {
        expect(state.played[challengeId]).toBe(cardId);
        expect(state.hands.human).not.toContain(cardId);
        expect(state.drawPile).not.toContain(cardId);
        expect(state.discard).not.toContain(cardId);
        expect(allCardIds(state).filter((id) => id === cardId)).toHaveLength(1);
      }
      expectInvariants(state);
    }
    expect(solved.length).toBeGreaterThan(0);
  });

  it('judging is pure: the same state and question always give the same answer', () => {
    const state = deepFreeze(begin());
    const id = state.hands.human[0]!;
    const challengeId = state.deck.challenges[0]!.id;
    expect(judgeAction(state, 'play', id, challengeId)).toBe(judgeAction(state, 'play', id, challengeId));
  });
});

describe('illegal requests change nothing', () => {
  const state = deepFreeze(start('solitaire', { seed: 3 }));
  const before = JSON.stringify(state);
  const target = correctInHand(state, 'human')[0]!;
  const drawPileCard = state.drawPile[0]!;

  const expectIllegal = (request: Parameters<typeof submitAction>[1], code: string): void => {
    const result = submitAction(state, request);
    expect(result).toMatchObject({ ok: false, error: { code } });
    expect(JSON.stringify(state)).toBe(before); // frozen input also proves no mutation
    expect(state.turnCount).toBe(0);
    expect(state.hands.human).toHaveLength(5);
  };

  it('unknown handle', () => {
    expectIllegal({ player: 'human', kind: 'discard', handle: 'nope' }, 'UNKNOWN_HANDLE');
  });

  it('a card that is not in the acting hand (still in the draw pile)', () => {
    expectIllegal({ player: 'human', kind: 'discard', handle: handleOf(state, drawPileCard) }, 'CARD_NOT_IN_HAND');
  });

  it('a play with no challenge', () => {
    expectIllegal({ player: 'human', kind: 'play', handle: handleOf(state, target.cardId) }, 'MISSING_CHALLENGE');
  });

  it('a play naming an unknown challenge', () => {
    expectIllegal(playReq(state, 'human', target.cardId, 'no-such-challenge'), 'UNKNOWN_CHALLENGE');
  });

  it('a discard that names a challenge', () => {
    expectIllegal(
      { player: 'human', kind: 'discard', handle: handleOf(state, target.cardId), challengeId: target.challengeId },
      'UNEXPECTED_CHALLENGE',
    );
  });

  it('an unknown action kind', () => {
    expectIllegal(
      { player: 'human', kind: 'throw' as unknown as 'play', handle: handleOf(state, target.cardId) },
      'INVALID_ACTION_KIND',
    );
  });

  it('Beepy acting in Solitaire', () => {
    expectIllegal({ player: 'beepy', kind: 'discard', handle: handleOf(state, target.cardId) }, 'PLAYER_NOT_IN_MODE');
  });

  it('an unknown player', () => {
    expectIllegal(
      { player: 'robot' as unknown as 'human', kind: 'discard', handle: handleOf(state, target.cardId) },
      'PLAYER_NOT_IN_MODE',
    );
  });
});

describe('playing onto an already-solved challenge is illegal', () => {
  it('is rejected with no state change, no turn, and no penalty', () => {
    let state = start('solitaire', { seed: 4 });
    const first = correctInHand(state, 'human')[0]!;
    state = act(state, playReq(state, 'human', first.cardId, first.challengeId)).state;
    const frozen = deepFreeze(state);
    const before = JSON.stringify(frozen);
    // Any card, including the one that solved it, cannot go onto the solved challenge.
    for (const cardId of frozen.hands.human) {
      const result = submitAction(frozen, playReq(frozen, 'human', cardId, first.challengeId));
      expect(result).toMatchObject({ ok: false, error: { code: 'CHALLENGE_ALREADY_SOLVED' } });
    }
    expect(JSON.stringify(frozen)).toBe(before);
    expect(frozen.turnCount).toBe(1);
    expect(frozen.played[first.challengeId]).toBe(first.cardId);
  });

  it('the solved card itself can no longer be named (it is not in any hand)', () => {
    let state = start('solitaire', { seed: 4 });
    const first = correctInHand(state, 'human')[0]!;
    state = act(state, playReq(state, 'human', first.cardId, first.challengeId)).state;
    expect(submitAction(state, discardReq(state, 'human', first.cardId))).toMatchObject({
      ok: false,
      error: { code: 'CARD_NOT_IN_HAND' },
    });
  });
});

describe('phase and turn checks', () => {
  it('rejects any action after the game has ended', () => {
    let state = start('solitaire', { seed: 5 });
    for (let i = 0; i < 200 && state.phase !== 'ended'; i += 1) {
      state = act(state, validRequest(state, 'human')).state;
    }
    expect(state.phase).toBe('ended');
    const frozen = deepFreeze(state);
    expect(submitAction(frozen, { player: 'human', kind: 'discard', handle: 'x' })).toMatchObject({
      ok: false,
      error: { code: 'GAME_ENDED' },
    });
  });

  it('rejects a second action while a Beepy action waits for evaluation', () => {
    const state = start('vsBeepy', { seed: 2, gameIndex: 2 }); // Beepy first
    const pending = act(state, validRequest(state, 'beepy')).state;
    expect(pending.phase).toBe('awaitingEvaluation');
    expect(submitAction(pending, invalidRequest(pending, 'human'))).toMatchObject({
      ok: false,
      error: { code: 'WRONG_PHASE' },
    });
  });

  it('rejects acting out of turn in a competitive game', () => {
    const state = start('vsBeepy', { seed: 2 }); // human first
    expect(submitAction(state, validRequest(state, 'beepy'))).toMatchObject({
      ok: false,
      error: { code: 'NOT_PLAYERS_TURN' },
    });
  });

  it('rejects a card from the opponent\'s hand', () => {
    const state = start('vsBeepy', { seed: 2 });
    const beepyCard = state.hands.beepy[0]!;
    expect(submitAction(state, { player: 'human', kind: 'discard', handle: handleOf(state, beepyCard) })).toMatchObject({
      ok: false,
      error: { code: 'CARD_NOT_IN_HAND' },
    });
  });
});
