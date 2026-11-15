/**
 * M3 E8 and E9 - Player vs. Beepy turns, the pending Beepy action, the master spec
 * section 7 table, competitive ending, tiebreaks, and win-before-penalty
 * (requirements 6 and 7).
 */

import { describe, expect, it } from 'vitest';
import { evaluatePending, submitAction } from '../src/game/game.js';
import { competitivePenalties, decideCompetitiveEnd, firstPlayerForGame } from '../src/game/competitive.js';
import { deepFreeze } from './fixtures.js';
import {
  act,
  correctInHand,
  craft,
  decide,
  discardReq,
  expectInvariants,
  invalidRequest,
  playReq,
  start,
  validRequest,
} from './m3-helpers.js';
import type { EngineState } from '../src/game/types.js';

const types = (events: readonly { type: string }[]): string[] => events.map((e) => e.type);

/** A game where it is Beepy's turn (Game 2: Beepy moves first). */
const beepyFirst = (seed = 1): EngineState => start('vsBeepy', { seed, gameIndex: 2 });

describe('E8 human turns: Beepy is an always-correct referee', () => {
  it('a valid human play succeeds immediately and passes the turn to Beepy', () => {
    const state = start('vsBeepy', { seed: 1 });
    const { cardId, challengeId } = correctInHand(state, 'human')[0]!;
    const step = act(state, playReq(state, 'human', cardId, challengeId));
    expect(step.state.solvedBy[challengeId]).toBe('human');
    expect(step.state.played[challengeId]).toBe(cardId);
    expect(step.state.hands.human).toHaveLength(4);
    expect(step.state.activePlayer).toBe('beepy');
    expect(step.state.phase).toBe('awaitingAction');
    expect(step.state.pending).toBeUndefined();
    expectInvariants(step.state);
  });

  it('an invalid human action is challenged at once: card returned, human draws one', () => {
    const state = start('vsBeepy', { seed: 1 });
    const top = state.drawPile[0]!;
    const step = act(state, invalidRequest(state, 'human'));
    expect(step.state.hands.human).toHaveLength(6);
    expect(step.state.hands.human).toContain(top);
    expect(step.state.hands.beepy).toEqual(state.hands.beepy);
    expect(step.state.activePlayer).toBe('beepy');
    expect(step.events.find((e) => e.type === 'PENALTY_DRAWN')).toMatchObject({ player: 'human', reason: 'INVALID_ACTION' });
    expectInvariants(step.state);
  });

  it('a human action never waits for evaluation', () => {
    const state = start('vsBeepy', { seed: 3 });
    expect(act(state, validRequest(state, 'human')).state.phase).toBe('awaitingAction');
    expect(act(state, invalidRequest(state, 'human')).state.phase).toBe('awaitingAction');
  });
});

describe('E8 pending Beepy action', () => {
  it('waits for the human decision without moving cards or counting a turn', () => {
    const state = beepyFirst();
    const step = act(state, validRequest(state, 'beepy'));
    expect(step.state.phase).toBe('awaitingEvaluation');
    expect(step.state.pending).toBeDefined();
    expect(step.state.hands).toEqual(state.hands);
    expect(step.state.turnCount).toBe(0);
    expect(step.state.solvedBy).toEqual({});
    expect(types(step.events)).toEqual(['ACTION_SUBMITTED']);
  });

  it('records no judgment until the human decides', () => {
    const state = beepyFirst();
    const valid = act(state, validRequest(state, 'beepy'));
    const invalid = act(state, invalidRequest(state, 'beepy'));
    for (const step of [valid, invalid]) {
      expect(step.events.some((e) => e.type === 'ACTION_RESOLVED')).toBe(false);
      expect(JSON.stringify(step.state.pending)).not.toMatch(/valid/i);
    }
  });

  it('rejects a decision when nothing is pending, and an unknown decision', () => {
    const state = start('vsBeepy', { seed: 1 });
    expect(evaluatePending(state, 'accept')).toMatchObject({ ok: false, error: { code: 'WRONG_PHASE' } });
    const pending = act(beepyFirst(), validRequest(beepyFirst(), 'beepy')).state;
    expect(evaluatePending(pending, 'maybe' as unknown as 'accept')).toMatchObject({
      ok: false,
      error: { code: 'INVALID_DECISION' },
    });
  });

  it('a failed decision leaves the pending state untouched', () => {
    const pending = deepFreeze(act(beepyFirst(), validRequest(beepyFirst(), 'beepy')).state);
    const before = JSON.stringify(pending);
    evaluatePending(pending, 'x' as unknown as 'accept');
    expect(JSON.stringify(pending)).toBe(before);
  });
});

describe('E8 the master spec section 7 table', () => {
  const pendingValid = (seed = 1) => {
    const state = beepyFirst(seed);
    return act(state, validRequest(state, 'beepy')).state;
  };
  const pendingInvalid = (seed = 1) => {
    const state = beepyFirst(seed);
    return act(state, invalidRequest(state, 'beepy')).state;
  };

  it('Valid + Accept: Beepy removes the card; nobody draws', () => {
    const before = pendingValid();
    const card = before.pending!.cardId;
    const step = decide(before, 'accept');
    expect(step.state.hands.beepy).not.toContain(card);
    expect(step.state.hands.beepy).toHaveLength(4);
    expect(step.state.hands.human).toEqual(before.hands.human);
    expect(step.state.drawPile).toEqual(before.drawPile);
    expect(step.events.find((e) => e.type === 'ACTION_RESOLVED')).toMatchObject({ valid: true, decision: 'accept' });
    expect(step.state.turnCount).toBe(1);
    expect(step.state.activePlayer).toBe('human');
    expectInvariants(step.state);
  });

  it('Valid + Challenge: Beepy removes the card; the HUMAN draws one', () => {
    const before = pendingValid();
    const card = before.pending!.cardId;
    const top = before.drawPile[0]!;
    const step = decide(before, 'challenge');
    expect(step.state.hands.beepy).not.toContain(card);
    expect(step.state.hands.beepy).toHaveLength(4);
    expect(step.state.hands.human).toEqual([...before.hands.human, top]);
    expect(step.events.filter((e) => e.type === 'PENALTY_DRAWN')).toEqual([
      { type: 'PENALTY_DRAWN', player: 'human', cardId: top, reason: 'WRONG_CHALLENGE', source: 'drawPile' },
    ]);
    expectInvariants(step.state);
  });

  it('Invalid + Challenge: Beepy keeps the card and draws one', () => {
    const before = pendingInvalid();
    const card = before.pending!.cardId;
    const top = before.drawPile[0]!;
    const step = decide(before, 'challenge');
    expect(step.state.hands.beepy).toContain(card);
    expect(step.state.hands.beepy).toEqual([...before.hands.beepy, top]);
    expect(step.state.hands.human).toEqual(before.hands.human);
    expect(step.events.filter((e) => e.type === 'PENALTY_DRAWN')).toEqual([
      { type: 'PENALTY_DRAWN', player: 'beepy', cardId: top, reason: 'INVALID_ACTION', source: 'drawPile' },
    ]);
    expect(step.state.solvedBy).toEqual({});
    expectInvariants(step.state);
  });

  it('Invalid + Accept: Beepy keeps the card; BOTH human and Beepy draw one, atomically', () => {
    const before = pendingInvalid();
    const card = before.pending!.cardId;
    const [first, second] = [before.drawPile[0]!, before.drawPile[1]!];
    const step = decide(before, 'accept');
    expect(step.state.hands.beepy).toContain(card);
    expect(step.state.hands.human).toEqual([...before.hands.human, first]);
    expect(step.state.hands.beepy).toEqual([...before.hands.beepy, second]);
    expect(step.events.filter((e) => e.type === 'PENALTY_DRAWN').map((e) => e.type === 'PENALTY_DRAWN' && [e.player, e.reason])).toEqual([
      ['human', 'MISSED_CHALLENGE'],
      ['beepy', 'INVALID_ACTION'],
    ]);
    expectInvariants(step.state);
  });

  it('Invalid + Accept with only one card left: neither draws (atomic), penalty waived and recorded', () => {
    const before = pendingInvalid();
    const keep = before.drawPile.slice(0, 1);
    const rest = before.drawPile.slice(1);
    const short: EngineState = { ...before, drawPile: keep, discard: [...before.discard, ...rest] };
    const step = decide(short, 'accept');
    expect(step.state.hands.human).toEqual(short.hands.human);
    expect(step.state.hands.beepy).toEqual(short.hands.beepy);
    expect(step.state.drawPile).toEqual(keep);
    expect(types(step.events)).toContain('PENALTY_EXHAUSTED');
    expect(step.state.phase).toBe('awaitingAction');
    expectInvariants(step.state);
  });

  it('a valid Beepy play credits Beepy for the challenge', () => {
    const state = beepyFirst(4);
    const target = correctInHand(state, 'beepy')[0]!;
    const pending = act(state, playReq(state, 'beepy', target.cardId, target.challengeId)).state;
    for (const decision of ['accept', 'challenge'] as const) {
      const step = decide(pending, decision);
      expect(step.state.solvedBy[target.challengeId]).toBe('beepy');
      expect(step.state.played[target.challengeId]).toBe(target.cardId);
    }
  });

  it('competitivePenalties matches the table exactly', () => {
    expect(competitivePenalties('human', true, undefined)).toEqual([]);
    expect(competitivePenalties('human', false, undefined)).toEqual([{ playerId: 'human', reason: 'INVALID_ACTION' }]);
    expect(competitivePenalties('beepy', true, 'accept')).toEqual([]);
    expect(competitivePenalties('beepy', true, 'challenge')).toEqual([{ playerId: 'human', reason: 'WRONG_CHALLENGE' }]);
    expect(competitivePenalties('beepy', false, 'challenge')).toEqual([{ playerId: 'beepy', reason: 'INVALID_ACTION' }]);
    expect(competitivePenalties('beepy', false, 'accept')).toEqual([
      { playerId: 'human', reason: 'MISSED_CHALLENGE' },
      { playerId: 'beepy', reason: 'INVALID_ACTION' },
    ]);
  });

  it('solved challenges are unavailable to both players', () => {
    const state = start('vsBeepy', { seed: 6 });
    const { cardId, challengeId } = correctInHand(state, 'human')[0]!;
    const afterHuman = act(state, playReq(state, 'human', cardId, challengeId)).state;
    const beepyCard = afterHuman.hands.beepy[0]!;
    expect(submitAction(afterHuman, playReq(afterHuman, 'beepy', beepyCard, challengeId))).toMatchObject({
      ok: false,
      error: { code: 'CHALLENGE_ALREADY_SOLVED' },
    });
  });
});

describe('E9 competitive ending', () => {
  const base = () => start('vsBeepy', { seed: 2 });

  it('the human empties their hand and wins at once', () => {
    const state = craft(base(), { human: ['distractor-0'], beepy: ['distractor-1', 'distractor-2'], activePlayer: 'human' });
    const step = act(state, discardReq(state, 'human', 'distractor-0'));
    expect(step.state.phase).toBe('ended');
    expect(step.state.outcome).toMatchObject({ kind: 'vsBeepy', winner: 'human', reason: 'handEmpty' });
  });

  it('Beepy empties its hand with an accepted valid move and wins', () => {
    const state = craft(base(), { human: ['distractor-0'], beepy: ['distractor-1'], activePlayer: 'beepy' });
    const pending = act(state, discardReq(state, 'beepy', 'distractor-1')).state;
    const step = decide(pending, 'accept');
    expect(step.state.outcome).toMatchObject({ winner: 'beepy', reason: 'handEmpty' });
  });

  it('WIN BEFORE PENALTY: Beepy empties its hand while the human wrongly challenges; no human penalty is applied', () => {
    const state = craft(base(), {
      human: ['distractor-0', 'distractor-2'],
      beepy: ['distractor-1'],
      activePlayer: 'beepy',
    });
    const pileBefore = state.drawPile;
    const pending = act(state, discardReq(state, 'beepy', 'distractor-1')).state;
    const step = decide(pending, 'challenge');
    expect(step.state.phase).toBe('ended');
    expect(step.state.outcome).toMatchObject({ kind: 'vsBeepy', winner: 'beepy', reason: 'handEmpty' });
    // The human's WRONG_CHALLENGE draw is NOT applied.
    expect(step.state.hands.human).toEqual(['distractor-0', 'distractor-2']);
    expect(step.state.drawPile).toEqual(pileBefore);
    expect(step.events.some((e) => e.type === 'PENALTY_DRAWN')).toBe(false);
    expect(step.events.find((e) => e.type === 'PENALTY_NOT_APPLIED')).toEqual({
      type: 'PENALTY_NOT_APPLIED',
      owed: [{ playerId: 'human', reason: 'WRONG_CHALLENGE' }],
    });
    expect(types(step.events).slice(-2)).toEqual(['PENALTY_NOT_APPLIED', 'GAME_ENDED']);
    expect(step.state.outcome).toMatchObject({ handCounts: { human: 2, beepy: 0 } });
    expectInvariants(step.state);
  });

  it('the same win-before-penalty order holds when Beepy solves its last card onto a challenge', () => {
    const state = craft(base(), { human: ['distractor-0'], beepy: ['correct-0'], activePlayer: 'beepy' });
    const pending = act(state, playReq(state, 'beepy', 'correct-0', 'challenge-0')).state;
    const step = decide(pending, 'challenge');
    expect(step.state.outcome).toMatchObject({ winner: 'beepy', reason: 'handEmpty' });
    expect(step.state.hands.human).toEqual(['distractor-0']);
    expect(step.state.solvedBy['challenge-0']).toBe('beepy');
  });

  const eightSolved = (beepyCredit: number) => {
    const solved: Record<string, 'human' | 'beepy'> = {};
    for (let i = 0; i < 8; i += 1) solved[`challenge-${i}`] = i < beepyCredit ? 'beepy' : 'human';
    return solved;
  };

  it('nine solved, neither hand empty: fewer remaining cards wins', () => {
    const state = craft(base(), {
      human: ['correct-8', 'distractor-0', 'distractor-1'],
      beepy: ['distractor-2', 'distractor-3', 'distractor-4', 'distractor-5'],
      solved: eightSolved(6),
      activePlayer: 'human',
    });
    const step = act(state, playReq(state, 'human', 'correct-8', 'challenge-8'));
    expect(step.state.outcome).toMatchObject({
      winner: 'human',
      reason: 'fewerCards',
      handCounts: { human: 2, beepy: 4 },
      credits: { human: 3, beepy: 6 },
    });
  });

  it('nine solved with equal hands: more credited challenges wins', () => {
    const state = craft(base(), {
      human: ['correct-8', 'distractor-0', 'distractor-1'],
      beepy: ['distractor-2', 'distractor-3'],
      solved: eightSolved(5),
      activePlayer: 'human',
    });
    const step = act(state, playReq(state, 'human', 'correct-8', 'challenge-8'));
    expect(step.state.outcome).toMatchObject({
      winner: 'beepy',
      reason: 'moreCredit',
      handCounts: { human: 2, beepy: 2 },
      credits: { human: 4, beepy: 5 },
    });
  });

  it('an ended competitive game accepts no further action', () => {
    const state = craft(base(), { human: ['distractor-0'], beepy: ['distractor-1'], activePlayer: 'human' });
    const ended = act(state, discardReq(state, 'human', 'distractor-0')).state;
    expect(submitAction(ended, discardReq(ended, 'beepy', 'distractor-1'))).toMatchObject({ ok: false, error: { code: 'GAME_ENDED' } });
    expect(evaluatePending(ended, 'accept')).toMatchObject({ ok: false, error: { code: 'GAME_ENDED' } });
  });
});

describe('E9 decideCompetitiveEnd (pure)', () => {
  it('continues while challenges remain and no hand is empty', () => {
    expect(decideCompetitiveEnd({ handCounts: { human: 3, beepy: 2 }, credits: { human: 1, beepy: 1 }, allSolved: false })).toEqual({ kind: 'continue' });
  });

  it('an empty hand wins even if all challenges are solved too', () => {
    const result = decideCompetitiveEnd({ handCounts: { human: 0, beepy: 5 }, credits: { human: 2, beepy: 7 }, allSolved: true });
    expect(result).toMatchObject({ kind: 'ended', outcome: { winner: 'human', reason: 'handEmpty' } });
  });

  it('reports ENGINE_FAULT-level ties instead of resolving them', () => {
    expect(decideCompetitiveEnd({ handCounts: { human: 2, beepy: 2 }, credits: { human: 4, beepy: 4 }, allSolved: true }).kind).toBe('fault');
    expect(decideCompetitiveEnd({ handCounts: { human: 0, beepy: 0 }, credits: { human: 4, beepy: 5 }, allSolved: true }).kind).toBe('fault');
  });

});

describe('E9 credit tiebreak through real resolutions', () => {
  // On a valid nine-challenge board with one solver per challenge, credits can never
  // tie (nine is odd), so a real resolution never reaches the ENGINE_FAULT branch.
  // That branch is covered by the pure decideCompetitiveEnd tests above; no impossible
  // board is fabricated here to force it.
  it.each([0, 1, 2, 3, 4, 5, 6, 7, 8])(
    'equal hands after all nine are solved: the credit tiebreak is decisive, never a fault (Beepy holds %i of the first eight)',
    (beepyCredit) => {
      const solved: Record<string, 'human' | 'beepy'> = {};
      for (let i = 0; i < 8; i += 1) solved[`challenge-${i}`] = i < beepyCredit ? 'beepy' : 'human';
      const state = craft(start('vsBeepy', { seed: 2 }), {
        human: ['correct-8', 'distractor-0', 'distractor-1'],
        beepy: ['distractor-2', 'distractor-3'],
        solved,
        activePlayer: 'human',
      });
      // The human solves the ninth: hands 2 vs 2, credits (9 - b) vs b.
      const result = submitAction(state, playReq(state, 'human', 'correct-8', 'challenge-8'));
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      const humanCredit = 9 - beepyCredit;
      expect(result.state.outcome).toEqual({
        kind: 'vsBeepy',
        winner: humanCredit > beepyCredit ? 'human' : 'beepy',
        reason: 'moreCredit',
        handCounts: { human: 2, beepy: 2 },
        credits: { human: humanCredit, beepy: beepyCredit },
      });
      expectInvariants(result.state);
    },
  );
});

describe('E10 alternating first player (D-3)', () => {
  it('human starts odd games and Beepy starts even games', () => {
    expect([1, 2, 3, 4, 5].map(firstPlayerForGame)).toEqual(['human', 'beepy', 'human', 'beepy', 'human']);
  });

  it('createGameState applies it, and Solitaire is always the human', () => {
    for (const gameIndex of [1, 2, 3, 4, 5]) {
      expect(start('vsBeepy', { gameIndex }).activePlayer).toBe(firstPlayerForGame(gameIndex));
      expect(start('solitaire', { gameIndex }).activePlayer).toBe('human');
    }
  });

  it('turns alternate within a competitive game after each resolution', () => {
    let state = start('vsBeepy', { seed: 8 });
    const order: string[] = [];
    for (let i = 0; i < 6 && state.phase !== 'ended'; i += 1) {
      order.push(state.activePlayer);
      state = act(state, validRequest(state, state.activePlayer)).state;
      if (state.phase === 'awaitingEvaluation') state = decide(state, 'accept').state;
    }
    expect(order).toEqual(['human', 'beepy', 'human', 'beepy', 'human', 'beepy'].slice(0, order.length));
  });
});
