/**
 * M3 E14 - seeded invariant simulation (requirement 11.2).
 *
 * Full games are played for `solitaire` and `vsBeepy` over all four (style,
 * direction) combinations. After EVERY step the harness asserts the card invariants
 * (uniqueness across all zones, conservation, one answer per challenge, solved
 * challenges hold only their own card) and that the human's view leaks nothing.
 *
 * Termination (design "Simulation"):
 *   - TEST_STEP_LIMIT is a property of this harness only. Exceeding it fails the test
 *     as suspected nontermination. It is not an engine rule; the engine has no cap.
 *   - Agents make progress: they pick an invalid action with probability below 0.5,
 *     and a STALL GUARD forces a valid action after three consecutive turns by that
 *     agent with no change in its hand size or the solved count (exactly what
 *     invalid actions look like once penalties are waived). A valid action always
 *     exists for a non-empty hand, so the guard can always comply.
 *   - A separate test shows that WITHOUT the guard an always-invalid agent never
 *     finishes once penalties are exhausted, which is why the guard exists.
 */

import { describe, expect, it } from 'vitest';
import { advanceBeepy, createGameState, evaluatePending, submitAction } from '../src/game/game.js';
import { judgeAction, openChallengeIds } from '../src/game/judge.js';
import { buildPlayerView } from '../src/game/view.js';
import { createReferenceBeepyStrategy } from '../src/game/beepy-strategy.js';
import type { PenaltyCandidate, PenaltyFallbackProvider } from '../src/penalty-draw.js';
import type { ActionRequest, EngineMode, EngineState, PlayerId, StepResult } from '../src/game/types.js';
import { buildDeck, fullMatrix, isNumericStyle, seededRandom, type ContentStyle } from './fixtures.js';
import { COMBOS, expectInvariants, ok } from './m3-helpers.js';
import type { GenerationDirection } from '../src/index.js';

const TEST_STEP_LIMIT = 2000;
const STALL_GUARD_TURNS = 3;

// ---- Legal options for a player, split by the authoritative ruling ----------

function options(state: EngineState, player: PlayerId): { valid: ActionRequest[]; invalid: ActionRequest[] } {
  const valid: ActionRequest[] = [];
  const invalid: ActionRequest[] = [];
  const open = openChallengeIds(state);
  for (const cardId of state.hands[player]) {
    const handle = state.handleByCard[cardId]!;
    for (const challengeId of open) {
      (judgeAction(state, 'play', cardId, challengeId) ? valid : invalid).push({ player, kind: 'play', handle, challengeId });
    }
    (judgeAction(state, 'discard', cardId) ? valid : invalid).push({ player, kind: 'discard', handle });
  }
  return { valid, invalid };
}

/** A fallback that offers `count` fresh distractors, then runs out. */
function limitedFallback(count: number, numeric: boolean): PenaltyFallbackProvider {
  return {
    candidates(context) {
      const none = Object.fromEntries(context.activeChallenges.map((c) => [c.id, false]));
      return (function* (): Generator<PenaltyCandidate> {
        for (let n = 0; n < count; n += 1) {
          yield {
            card: { id: `fallback-${n}`, displayValue: numeric ? String(500 + n) : `Test fallback distractor ${n}` },
            plausible: true,
            validForChallenges: none,
          };
        }
      })();
    },
  };
}

interface SimConfig {
  readonly mode: EngineMode;
  readonly style: ContentStyle;
  readonly direction: GenerationDirection;
  readonly seed: number;
  readonly pInvalid: number;
  readonly beepyErrorRate?: number;
  readonly distractors?: number;
  readonly fallback?: number;
  readonly stallGuard?: boolean;
  readonly maxSteps?: number;
}

interface SimResult {
  readonly state: EngineState;
  readonly steps: number;
  readonly guardForced: number;
  readonly exhaustedEvents: number;
  readonly fallbackDraws: number;
}

/** Assert the human's view leaks nothing hidden at this moment. */
function expectNoLeak(state: EngineState): void {
  const view = buildPlayerView(state, 'human');
  const text = JSON.stringify(view);
  expect(text).not.toContain('correctAnswerCardId');
  for (const id of Object.keys(state.cards)) expect(text).not.toContain(`"${id}"`);
  const pendingCard = state.pending?.cardId;
  for (const id of [...state.hands.beepy, ...state.drawPile]) {
    if (id === pendingCard) continue;
    expect(text).not.toContain(`"displayValue":${JSON.stringify(state.cards[id]!.displayValue)}`);
  }
  expect(view.drawPileCount).toBe(state.drawPile.length);
}

function simulate(config: SimConfig): SimResult {
  const numeric = isNumericStyle(config.style, config.direction);
  const correct = config.mode === 'vsBeepy' ? 9 : 5;
  const deck = buildDeck({
    style: config.style,
    direction: config.direction,
    correct,
    distractors: config.distractors ?? (config.mode === 'vsBeepy' ? 15 : 8),
  });
  const created = createGameState({
    mode: config.mode,
    deck,
    contextualValidity: fullMatrix(deck),
    seed: config.seed,
    options: {
      numericAnswers: numeric,
      ...(config.fallback === undefined ? {} : { fallback: limitedFallback(config.fallback, numeric) }),
    },
  });
  let state = ok(created).state;
  const random = seededRandom(config.seed * 7919 + 13);
  const pick = <T>(items: readonly T[]): T => items[Math.floor(random() * items.length)] as T;
  const beepy = (() => {
    const s = createReferenceBeepyStrategy({ errorRate: config.beepyErrorRate ?? 0.3 });
    if (!s.ok) throw new Error('strategy');
    return s.strategy;
  })();
  const stall: Record<PlayerId, number> = { human: 0, beepy: 0 };
  const limit = config.maxSteps ?? TEST_STEP_LIMIT;
  let steps = 0;
  let guardForced = 0;
  let exhaustedEvents = 0;
  let fallbackDraws = 0;

  expectInvariants(state);
  expectNoLeak(state);
  while (state.phase !== 'ended') {
    steps += 1;
    if (steps > limit) {
      throw new Error(`test-only step limit (${limit}) exceeded: suspected nontermination`);
    }
    let result: StepResult;
    let actor: PlayerId | undefined;
    const before = { hand: 0, solved: Object.keys(state.solvedBy).length };
    if (state.phase === 'awaitingEvaluation') {
      result = evaluatePending(state, random() < 0.5 ? 'accept' : 'challenge');
      actor = 'beepy';
      before.hand = state.hands.beepy.length;
    } else {
      actor = state.activePlayer;
      before.hand = state.hands[actor].length;
      const forced = config.stallGuard !== false && stall[actor] >= STALL_GUARD_TURNS;
      if (actor === 'beepy' && !forced) {
        result = advanceBeepy(state, beepy);
        // The resolution happens on the decision; progress is measured then.
        actor = undefined;
      } else {
        const { valid, invalid } = options(state, actor);
        expect(valid.length, 'a non-empty hand always has a valid action').toBeGreaterThan(0);
        const wantInvalid = !forced && invalid.length > 0 && random() < config.pInvalid;
        if (forced) guardForced += 1;
        const request = wantInvalid ? pick(invalid) : pick(valid);
        result = submitAction(state, request);
        if (actor === 'beepy') actor = undefined; // forced Beepy move resolves on the decision
      }
    }
    const step = ok(result);
    for (const event of step.events) {
      if (event.type === 'PENALTY_EXHAUSTED') exhaustedEvents += 1;
      if (event.type === 'PENALTY_DRAWN' && event.source === 'fallback') fallbackDraws += 1;
    }
    state = step.state;
    if (actor !== undefined && step.events.some((e) => e.type === 'TURN_COUNTED')) {
      const progressed = state.hands[actor].length !== before.hand || Object.keys(state.solvedBy).length !== before.solved;
      stall[actor] = progressed ? 0 : stall[actor] + 1;
    }
    expectInvariants(state);
    expectNoLeak(state);
  }
  return { state, steps, guardForced, exhaustedEvents, fallbackDraws };
}

// ---------------------------------------------------------------------------

describe.each(['solitaire', 'vsBeepy'] as const)('simulation: %s', (mode) => {
  describe.each(COMBOS)('%s / %s', (style, direction) => {
    it('40 seeded games terminate with every invariant holding after every step', () => {
      let totalSteps = 0;
      for (let seed = 1; seed <= 40; seed += 1) {
        const run = simulate({ mode, style, direction, seed, pInvalid: 0.35, beepyErrorRate: 0.3 });
        expect(run.state.phase).toBe('ended');
        expect(run.state.outcome?.kind).toBe(mode);
        if (run.state.outcome?.kind === 'solitaire') {
          expect(run.state.outcome.score).toBe(run.state.turnCount + run.state.hands.human.length);
        }
        totalSteps += run.steps;
      }
      expect(totalSteps).toBeGreaterThan(40 * 5);
    });
  });

  it('the same seed reproduces the same game exactly', () => {
    const a = simulate({ mode, style: 'math', direction: 'factToSubject', seed: 99, pInvalid: 0.35 });
    const b = simulate({ mode, style: 'math', direction: 'factToSubject', seed: 99, pInvalid: 0.35 });
    expect(a.state).toEqual(b.state);
    expect(a.steps).toBe(b.steps);
  });
});

describe('exhaustion scenarios run to completion', () => {
  it.each(COMBOS)('tiny pile, no fallback (%s / %s): penalties are waived and the game still ends', (style, direction) => {
    let waived = 0;
    for (let seed = 1; seed <= 15; seed += 1) {
      for (const mode of ['solitaire', 'vsBeepy'] as const) {
        const run = simulate({
          mode,
          style,
          direction,
          seed,
          pInvalid: 0.45,
          beepyErrorRate: 0.45,
          distractors: mode === 'vsBeepy' ? 5 : 3,
        });
        expect(run.state.phase).toBe('ended');
        waived += run.exhaustedEvents;
      }
    }
    expect(waived).toBeGreaterThan(0);
  });

  it.each(COMBOS)('a fallback that gives out (%s / %s): fallback cards enter, then penalties are waived', (style, direction) => {
    let fromFallback = 0;
    let waived = 0;
    for (let seed = 1; seed <= 15; seed += 1) {
      const run = simulate({ mode: 'solitaire', style, direction, seed, pInvalid: 0.45, distractors: 3, fallback: 2 });
      expect(run.state.phase).toBe('ended');
      fromFallback += run.fallbackDraws;
      waived += run.exhaustedEvents;
      // Fallback cards never repeat and never carry an explanation.
      const fallbackCards = Object.values(run.state.cards).filter((c) => c.id.startsWith('fallback-'));
      expect(fallbackCards.length).toBe(run.fallbackDraws);
      for (const card of fallbackCards) expect(card.explanationByChallengeId).toBeUndefined();
    }
    expect(fromFallback).toBeGreaterThan(0);
    expect(waived).toBeGreaterThan(0);
  });

  it('the stall guard is actually exercised in exhaustion scenarios', () => {
    let forced = 0;
    for (let seed = 1; seed <= 20; seed += 1) {
      forced += simulate({ mode: 'solitaire', style: 'math', direction: 'factToSubject', seed, pInvalid: 0.49, distractors: 3 }).guardForced;
    }
    expect(forced).toBeGreaterThan(0);
  });
});

describe('why the stall guard exists (no engine turn cap)', () => {
  it('an always-invalid agent with exhausted penalties never finishes: only the test limit stops it', () => {
    expect(() =>
      simulate({
        mode: 'solitaire',
        style: 'math',
        direction: 'factToSubject',
        seed: 3,
        pInvalid: 1,
        distractors: 3,
        stallGuard: false,
        maxSteps: 300,
      }),
    ).toThrow(/test-only step limit \(300\) exceeded/);
  });

  it('with the guard, the same agent finishes', () => {
    const run = simulate({ mode: 'solitaire', style: 'math', direction: 'factToSubject', seed: 3, pInvalid: 1, distractors: 3 });
    expect(run.state.phase).toBe('ended');
    expect(run.guardForced).toBeGreaterThan(0);
  });
});
