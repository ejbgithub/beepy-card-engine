/**
 * M4 G9 (part 1) - generated decks in the real M3 engine.
 *
 * Generated decks start M3 games for both modes, every level, and both directions,
 * and whole games are played with the M3 pure core so the full M3 invariant set
 * (uniqueness across all zones, conservation, one answer per challenge, handles)
 * can be checked after every step. The Math penalty fallback for each direction is
 * configured exactly as the series wrapper does it, so fallback cards are exercised
 * under the invariants. The step limit is a TEST-ONLY nontermination guard; the
 * engine has no turn cap.
 */

import { describe, expect, it } from 'vitest';
import { createGameState } from '../../shared-engine/src/game/game.js';
import { seededRandom } from '../../shared-engine/tests/fixtures.js';
import { act, decide, expectInvariants, invalidRequest, ok, validRequest } from '../../shared-engine/tests/m3-helpers.js';
import type { EngineState } from '../../shared-engine/src/game/types.js';
import type { PenaltyFallbackProvider } from '@beepy/shared-engine';
import { createMathExpressionFallbackProvider } from '../src/expression-fallback.js';
import { plausibleRangeOf } from '../src/levels.js';
import { generateMathDeck } from '../src/math-generator.js';
import { createMathPenaltyFallbackProvider } from '../src/penalty-fallback.js';
import { DIRECTIONS, LEVELS, MODES, type Direction, type Level, type Mode } from './math-oracle.js';

const TEST_STEP_LIMIT = 3000;

function fallbackFor(level: Level, direction: Direction): PenaltyFallbackProvider {
  const range = plausibleRangeOf(level);
  return direction === 'factToSubject'
    ? createMathPenaltyFallbackProvider({ minValue: range.min, maxValue: range.max })
    : createMathExpressionFallbackProvider({ level });
}

function startGame(mode: Mode, level: Level, direction: Direction, seed: number): EngineState {
  const generated = generateMathDeck({ mode, level, generationDirection: direction, seed });
  if (!generated.ok) throw new Error(generated.issues.map((i) => i.code).join(', '));
  return ok(
    createGameState({
      mode,
      deck: generated.deck,
      contextualValidity: generated.contextualValidity,
      seed,
      options: { numericAnswers: generated.numericAnswers, fallback: fallbackFor(level, direction) },
    }),
  ).state;
}

/** Play one game to the end with progress-making agents; return fallback draws. */
function playToEnd(state0: EngineState, seed: number, pInvalid: number): { state: EngineState; fallbackDraws: number; steps: number } {
  const random = seededRandom(seed * 13 + 1);
  let state = state0;
  let fallbackDraws = 0;
  let steps = 0;
  expectInvariants(state);
  while (state.phase !== 'ended') {
    steps += 1;
    if (steps > TEST_STEP_LIMIT) throw new Error('test-only step limit exceeded: suspected nontermination');
    const step =
      state.phase === 'awaitingEvaluation'
        ? decide(state, random() < 0.5 ? 'accept' : 'challenge')
        : act(state, random() < pInvalid ? invalidRequest(state, state.activePlayer) : validRequest(state, state.activePlayer));
    fallbackDraws += step.events.filter((e) => e.type === 'PENALTY_DRAWN' && e.source === 'fallback').length;
    state = step.state;
    expectInvariants(state);
  }
  return { state, fallbackDraws, steps };
}

describe.each(MODES)('generated decks start M3 games: %s', (mode) => {
  it.each(LEVELS.flatMap((level) => DIRECTIONS.map((direction) => [level, direction] as const)))(
    '%s / %s over 30 seeds, with valid dealt hands',
    (level, direction) => {
      for (let seed = 1; seed <= 30; seed += 1) {
        const state = startGame(mode, level, direction, seed);
        expect(state.mode).toBe(mode);
        expect(state.hands.human).toHaveLength(5);
        expect(state.hands.beepy).toHaveLength(mode === 'vsBeepy' ? 5 : 0);
        expect(state.deck.challenges).toHaveLength(mode === 'vsBeepy' ? 9 : 5);
        expectInvariants(state);
      }
    },
  );
});

describe.each(MODES)('whole games with the M3 invariant checks after every step: %s', (mode) => {
  it.each(LEVELS.flatMap((level) => DIRECTIONS.map((direction) => [level, direction] as const)))(
    '%s / %s: 6 games end, every invariant holds',
    (level, direction) => {
      for (let seed = 1; seed <= 6; seed += 1) {
        const { state } = playToEnd(startGame(mode, level, direction, seed), seed, 0.35);
        expect(state.phase).toBe('ended');
        expect(state.outcome?.kind).toBe(mode);
      }
    },
  );
});

describe('the Math penalty fallback is exercised in both directions', () => {
  it.each(DIRECTIONS)('%s: fallback cards are drawn once the pile is empty, and invariants still hold', (direction) => {
    let fallbackDraws = 0;
    for (let seed = 1; seed <= 20; seed += 1) {
      for (const level of LEVELS) {
        fallbackDraws += playToEnd(startGame('solitaire', level, direction, seed), seed, 0.45).fallbackDraws;
      }
    }
    expect(fallbackDraws).toBeGreaterThan(0);
  });
});
