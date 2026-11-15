/**
 * M3 E11 - the replaceable Beepy strategy (decision D-2, requirement 6.5).
 */

import { describe, expect, it } from 'vitest';
import { advanceBeepy, submitAction } from '../src/game/game.js';
import { judgeAction } from '../src/game/judge.js';
import {
  beepyStrategyInput,
  createReferenceBeepyStrategy,
  type BeepyStrategy,
} from '../src/game/beepy-strategy.js';
import { deepFreeze } from './fixtures.js';
import { decide, expectInvariants, ok, start, validRequest, correctInHand } from './m3-helpers.js';
import type { EngineState } from '../src/game/types.js';

const TEST_STEP_LIMIT = 2000;

const strategy = (errorRate: number): BeepyStrategy => {
  const created = createReferenceBeepyStrategy({ errorRate });
  if (!created.ok) throw new Error(created.error.code);
  return created.strategy;
};

/** Beepy moves first in even games. */
const beepyTurn = (seed: number): EngineState => start('vsBeepy', { seed, gameIndex: 2 });

/** The authoritative ruling for the pending Beepy action. */
const pendingIsValid = (state: EngineState): boolean => {
  const pending = state.pending!;
  return judgeAction(state, pending.kind, pending.cardId, pending.challengeId);
};

/** Is the pending action a legal request (card in Beepy's hand, open challenge)? */
const pendingIsLegal = (before: EngineState, after: EngineState): boolean => {
  const p = after.pending!;
  if (!before.hands.beepy.includes(p.cardId)) return false;
  if (p.kind === 'discard') return p.challengeId === undefined;
  return p.challengeId !== undefined && !Object.hasOwn(before.solvedBy, p.challengeId);
};

/** Play a full competitive game with the human playing validly and judging correctly. */
function playWithStrategy(seed: number, s: BeepyStrategy): { state: EngineState; beepyActions: number } {
  let state = start('vsBeepy', { seed });
  let steps = 0;
  let beepyActions = 0;
  while (state.phase !== 'ended') {
    steps += 1;
    if (steps > TEST_STEP_LIMIT) throw new Error('test-only step limit exceeded');
    if (state.phase === 'awaitingEvaluation') {
      state = decide(state, pendingIsValid(state) ? 'accept' : 'challenge').state;
    } else if (state.activePlayer === 'beepy') {
      const before = state;
      state = ok(advanceBeepy(state, s)).state;
      expect(pendingIsLegal(before, state)).toBe(true);
      beepyActions += 1;
    } else {
      state = ok(submitAction(state, validRequest(state, 'human'))).state;
    }
    expectInvariants(state);
  }
  return { state, beepyActions };
}

describe('configuration', () => {
  it.each([-0.1, 1.01, Number.NaN, Infinity, '0.2', undefined])('rejects errorRate %s', (errorRate) => {
    expect(createReferenceBeepyStrategy({ errorRate: errorRate as number })).toMatchObject({
      ok: false,
      error: { code: 'INVALID_OPTION' },
    });
  });

  it.each([0, 0.25, 1])('accepts errorRate %s', (errorRate) => {
    expect(createReferenceBeepyStrategy({ errorRate }).ok).toBe(true);
  });
});

describe('what the strategy can see', () => {
  it('sees only its own hand, open challenge ids, and a judge', () => {
    const state = beepyTurn(3);
    const input = beepyStrategyInput(state);
    expect(Object.keys(input).sort()).toEqual(['hand', 'judge', 'openChallengeIds']);
    expect(input.hand.map((card) => card.handle).sort()).toEqual(
      state.hands.beepy.map((id) => state.handleByCard[id]).sort(),
    );
    const text = JSON.stringify(input);
    for (const id of [...state.hands.human, ...state.drawPile]) {
      expect(text).not.toContain(`"${state.cards[id]!.displayValue}"`);
    }
    expect(text).not.toMatch(/correct-|distractor-/);
  });

  it("the judge returns false for cards that are not Beepy's", () => {
    const state = beepyTurn(3);
    const input = beepyStrategyInput(state);
    const humanHandle = state.handleByCard[state.hands.human[0]!]!;
    expect(input.judge('discard', humanHandle)).toBe(false);
    for (const challengeId of input.openChallengeIds) {
      expect(input.judge('play', humanHandle, challengeId)).toBe(false);
    }
  });

  it('the judge agrees with the authoritative judge for its own cards', () => {
    const state = beepyTurn(4);
    const input = beepyStrategyInput(state);
    for (const cardId of state.hands.beepy) {
      const handle = state.handleByCard[cardId]!;
      expect(input.judge('discard', handle)).toBe(judgeAction(state, 'discard', cardId));
      for (const challengeId of input.openChallengeIds) {
        expect(input.judge('play', handle, challengeId)).toBe(judgeAction(state, 'play', cardId, challengeId));
      }
    }
  });
});

describe('reference strategy at error rates 0 and 1', () => {
  it('errorRate 0 never proposes an invalid action and prefers a valid play', () => {
    for (let seed = 1; seed <= 60; seed += 1) {
      const state = beepyTurn(seed);
      const pending = ok(advanceBeepy(state, strategy(0))).state;
      expect(pendingIsLegal(state, pending)).toBe(true);
      expect(pendingIsValid(pending)).toBe(true);
      if (correctInHand(state, 'beepy').length > 0) {
        expect(pending.pending!.kind).toBe('play');
      }
    }
  });

  it('errorRate 0 is never wrong across whole games', () => {
    for (let seed = 1; seed <= 15; seed += 1) {
      let state = start('vsBeepy', { seed });
      while (state.phase !== 'ended') {
        if (state.phase === 'awaitingEvaluation') {
          expect(pendingIsValid(state)).toBe(true);
          state = decide(state, 'accept').state;
        } else if (state.activePlayer === 'beepy') {
          state = ok(advanceBeepy(state, strategy(0))).state;
        } else {
          state = ok(submitAction(state, validRequest(state, 'human'))).state;
        }
      }
      expect(state.stats.beepy.incorrectPlays + state.stats.beepy.incorrectDiscards).toBe(0);
    }
  });

  it('errorRate 1 always proposes a legal but invalid action (single steps only)', () => {
    for (let seed = 1; seed <= 60; seed += 1) {
      const state = beepyTurn(seed);
      const pending = ok(advanceBeepy(state, strategy(1))).state;
      expect(pending.phase).toBe('awaitingEvaluation');
      expect(pendingIsLegal(state, pending)).toBe(true);
      expect(pendingIsValid(pending)).toBe(false);
    }
  });

  it('an intermediate rate produces both kinds of action over many seeds', () => {
    let mistakes = 0;
    for (let seed = 1; seed <= 400; seed += 1) {
      if (!pendingIsValid(ok(advanceBeepy(beepyTurn(seed), strategy(0.25))).state)) mistakes += 1;
    }
    // Expected about 100 of 400.
    expect(mistakes).toBeGreaterThan(60);
    expect(mistakes).toBeLessThan(140);
  });

  it('only proposes legal requests across whole games at a mixed error rate', () => {
    for (let seed = 1; seed <= 10; seed += 1) {
      const { state, beepyActions } = playWithStrategy(seed, strategy(0.3));
      expect(state.phase).toBe('ended');
      expect(beepyActions).toBeGreaterThan(0);
    }
  });
});

describe('deterministic replay', () => {
  it('the same state gives the same choice, and only the Beepy stream advances', () => {
    const state = beepyTurn(9);
    const a = ok(advanceBeepy(state, strategy(0.3)));
    const b = ok(advanceBeepy(state, strategy(0.3)));
    expect(a.state).toEqual(b.state);
    expect(a.events).toEqual(b.events);
    expect(a.state.beepyRng).not.toBe(state.beepyRng);
    expect(a.state.rng).toBe(state.rng);
    expect(a.state.drawPile).toEqual(state.drawPile);
  });

  it('a whole game replays identically from the same seed', () => {
    expect(playWithStrategy(17, strategy(0.3))).toEqual(playWithStrategy(17, strategy(0.3)));
  });

  it('different seeds give different games', () => {
    const a = JSON.stringify(playWithStrategy(17, strategy(0.3)).state.history);
    const b = JSON.stringify(playWithStrategy(18, strategy(0.3)).state.history);
    expect(a).not.toBe(b);
  });
});

describe('the authoritative judge is independent of Beepy', () => {
  it('a ruling depends only on the action, not on the strategy that chose it', () => {
    const state = beepyTurn(5);
    for (const rate of [0, 1]) {
      const pending = ok(advanceBeepy(state, strategy(rate))).state;
      const p = pending.pending!;
      expect(pendingIsValid(pending)).toBe(judgeAction(state, p.kind, p.cardId, p.challengeId));
    }
  });

  it('a strategy cannot make a wrong play succeed', () => {
    const wrongPlayer: BeepyStrategy = {
      chooseAction(input, rng) {
        for (const card of input.hand) {
          const challengeId = input.openChallengeIds.find((ch) => !input.judge('play', card.handle, ch));
          if (challengeId !== undefined) {
            return { action: { player: 'beepy', kind: 'play', handle: card.handle, challengeId }, rng };
          }
        }
        throw new Error('no wrong play available');
      },
    };
    const state = beepyTurn(6);
    const pending = ok(advanceBeepy(state, wrongPlayer)).state;
    const resolved = decide(pending, 'accept').state;
    expect(Object.keys(resolved.solvedBy)).toEqual([]);
    expect(resolved.hands.beepy).toHaveLength(6);
    expect(resolved.hands.human).toHaveLength(6);
    expectInvariants(resolved);
  });

  it('judging the same position gives the same result before and after strategy calls', () => {
    const state = deepFreeze(beepyTurn(8));
    const card = state.hands.beepy[0]!;
    const before = state.deck.challenges.map((c) => judgeAction(state, 'play', card, c.id));
    for (const rate of [0, 0.5, 1]) advanceBeepy(state, strategy(rate));
    expect(state.deck.challenges.map((c) => judgeAction(state, 'play', card, c.id))).toEqual(before);
  });
});

describe('advanceBeepy guards and untrusted strategy results', () => {
  it("rejects when it is not Beepy's turn, in Solitaire, or while an action is pending", () => {
    expect(advanceBeepy(start('vsBeepy', { gameIndex: 1 }), strategy(0))).toMatchObject({ error: { code: 'NOT_PLAYERS_TURN' } });
    expect(advanceBeepy(start('solitaire'), strategy(0))).toMatchObject({ error: { code: 'PLAYER_NOT_IN_MODE' } });
    const pending = ok(advanceBeepy(beepyTurn(1), strategy(0))).state;
    expect(advanceBeepy(pending, strategy(0))).toMatchObject({ error: { code: 'WRONG_PHASE' } });
  });

  const legalAction = (state: EngineState) => ({
    player: 'beepy' as const,
    kind: 'discard' as const,
    handle: state.handleByCard[state.hands.beepy[0]!]!,
  });

  it.each([
    ['a negative number', -1],
    ['a fraction', 1.5],
    ['NaN', Number.NaN],
    ['Infinity', Infinity],
    ['above 2^32 - 1', 2 ** 32],
    ['a string', '42'],
    ['undefined', undefined],
    ['an object', {}],
    ['a bigint', 5n],
  ])('an invalid RNG state (%s) is STRATEGY_RESULT_INVALID and changes nothing', (_name, rng) => {
    const state = deepFreeze(beepyTurn(2));
    const before = JSON.stringify(state, (_k, v) => (typeof v === 'bigint' ? String(v) : v));
    const bad: BeepyStrategy = {
      chooseAction: () => ({ action: legalAction(state), rng: rng as number }),
    };
    expect(() => advanceBeepy(state, bad)).not.toThrow();
    expect(advanceBeepy(state, bad)).toMatchObject({ ok: false, error: { code: 'STRATEGY_RESULT_INVALID' } });
    expect(JSON.stringify(state, (_k, v) => (typeof v === 'bigint' ? String(v) : v))).toBe(before);
    expect(state.beepyRng).toBe(beepyTurn(2).beepyRng);
    expect(state.rng).toBe(beepyTurn(2).rng);
  });

  it('accepts the boundary RNG values 0 and 2^32 - 1', () => {
    for (const rng of [0, 2 ** 32 - 1]) {
      const state = beepyTurn(2);
      const step = ok(advanceBeepy(state, { chooseAction: () => ({ action: legalAction(state), rng }) }));
      expect(step.state.beepyRng).toBe(rng);
    }
  });

  it.each([
    ['null', null],
    ['a number', 7],
    ['no action', { rng: 1 }],
    ['an action that is not an object', { action: 'discard', rng: 1 }],
    ['a non-string handle', { action: { player: 'beepy', kind: 'discard', handle: 3 }, rng: 1 }],
    ['a non-string challenge id', { action: { player: 'beepy', kind: 'play', handle: 'h', challengeId: 4 }, rng: 1 }],
  ])('a malformed result (%s) is STRATEGY_RESULT_INVALID', (_name, result) => {
    const state = deepFreeze(beepyTurn(2));
    const before = JSON.stringify(state);
    const bad = { chooseAction: () => result } as unknown as BeepyStrategy;
    expect(advanceBeepy(state, bad)).toMatchObject({ ok: false, error: { code: 'STRATEGY_RESULT_INVALID' } });
    expect(JSON.stringify(state)).toBe(before);
  });

  it('a result whose getters throw is ENGINE_FAULT, not a crash', () => {
    const state = beepyTurn(2);
    const hostile = {
      chooseAction: () => ({
        get action(): never {
          throw new Error('trap');
        },
        rng: 1,
      }),
    } as unknown as BeepyStrategy;
    expect(advanceBeepy(state, hostile)).toMatchObject({ ok: false, error: { code: 'ENGINE_FAULT' } });
  });

  it('an illegal proposal changes nothing, including the Beepy random stream', () => {
    const state = deepFreeze(beepyTurn(2));
    const before = JSON.stringify(state);
    const cheater: BeepyStrategy = {
      chooseAction: (_input, rng) => ({ action: { player: 'beepy', kind: 'discard', handle: 'not-a-handle' }, rng: (rng + 1) >>> 0 }),
    };
    expect(advanceBeepy(state, cheater)).toMatchObject({ ok: false, error: { code: 'UNKNOWN_HANDLE' } });
    const impersonator: BeepyStrategy = {
      chooseAction: (input, rng) => ({ action: { player: 'human', kind: 'discard', handle: input.hand[0]!.handle }, rng }),
    };
    expect(advanceBeepy(state, impersonator)).toMatchObject({ ok: false, error: { code: 'PLAYER_NOT_IN_MODE' } });
    expect(JSON.stringify(state)).toBe(before);
  });

  it('a strategy that throws is ENGINE_FAULT, not a crash', () => {
    const broken: BeepyStrategy = {
      chooseAction: () => {
        throw new Error('boom');
      },
    };
    expect(advanceBeepy(beepyTurn(2), broken)).toMatchObject({ ok: false, error: { code: 'ENGINE_FAULT' } });
  });
});
