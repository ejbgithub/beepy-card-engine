/**
 * M3 E10 - match management with real games (requirements 6.2, 8.2, 8.3).
 *
 * Plays whole competitive games with scripted, progress-making policies so a chosen
 * player wins, then feeds the real outcomes into `seriesStatus` / `checkCanStartGame`.
 * The step limit below is a TEST-ONLY guard against nontermination; the engine has
 * no turn cap.
 */

import { describe, expect, it } from 'vitest';
import { createGameState } from '../src/game/game.js';
import { checkCanStartGame, seriesStatus } from '../src/game/series.js';
import { firstPlayerForGame } from '../src/game/competitive.js';
import type { EngineState, GameOutcome, PlayerId } from '../src/game/types.js';
import { act, decide, expectInvariants, invalidRequest, ok, sample, validRequest } from './m3-helpers.js';

const TEST_STEP_LIMIT = 2000;

/**
 * Play one real game. The intended winner always acts validly; the loser always
 * acts invalidly. The human challenges every Beepy action, which is correct when
 * Beepy errs and costs the human a draw when Beepy is right. That draw is never
 * applied if Beepy's move ended the game.
 */
function playGame(seed: number, gameIndex: number, intendedWinner: PlayerId): EngineState {
  const s = sample('vsBeepy');
  let state = ok(createGameState({ mode: 'vsBeepy', deck: s.deck, contextualValidity: s.matrix, seed, gameIndex, options: s.options })).state;
  expect(state.activePlayer).toBe(firstPlayerForGame(gameIndex));
  let steps = 0;
  while (state.phase !== 'ended') {
    steps += 1;
    if (steps > TEST_STEP_LIMIT) throw new Error('test-only step limit exceeded: suspected nontermination');
    if (state.phase === 'awaitingEvaluation') {
      state = decide(state, intendedWinner === 'human' ? 'challenge' : 'accept').state;
    } else {
      const player = state.activePlayer;
      state = act(state, player === intendedWinner ? validRequest(state, player) : invalidRequest(state, player)).state;
    }
    expectInvariants(state);
  }
  return state;
}

function playMatch(seed: number, winners: readonly PlayerId[]): GameOutcome[] {
  const outcomes: GameOutcome[] = [];
  for (const intended of winners) {
    expect(checkCanStartGame('vsBeepy', outcomes, false)).toBeUndefined();
    const status = seriesStatus('vsBeepy', outcomes);
    if (!status.ok) throw new Error(status.error.code);
    const game = playGame(seed, status.status.nextGameIndex, intended);
    expect(game.outcome).toMatchObject({ kind: 'vsBeepy', winner: intended });
    outcomes.push(game.outcome as GameOutcome);
  }
  return outcomes;
}

const H = 'human' as const;
const B = 'beepy' as const;

describe('E10 best-of-five with real games', () => {
  it.each([
    ['3-0 human', [H, H, H], H],
    ['3-0 Beepy', [B, B, B], B],
    ['3-1 human', [H, B, H, H], H],
    ['3-1 Beepy', [B, H, B, B], B],
    ['3-2 human', [B, H, B, H, H], H],
    ['3-2 Beepy', [H, B, H, B, B], B],
  ] as const)('%s', (_name, winners, matchWinner) => {
    const outcomes = playMatch(11, winners);
    const result = seriesStatus('vsBeepy', outcomes);
    expect(result).toMatchObject({
      ok: true,
      status: { kind: 'match', complete: true, winner: matchWinner, gamesCompleted: winners.length },
    });
    // Once decided, no further game may start.
    expect(checkCanStartGame('vsBeepy', outcomes, false)).toMatchObject({ ok: false, error: { code: 'SERIES_COMPLETE' } });
  });

  it('stops as soon as a player reaches three wins (no fourth game after 3-0)', () => {
    const outcomes = playMatch(5, [H, H, H]);
    expect(seriesStatus('vsBeepy', [...outcomes, outcomes[0]!])).toMatchObject({
      ok: false,
      error: { code: 'SERIES_OUTCOMES_EXCESSIVE' },
    });
  });

  it('refuses a new game while one is in progress', () => {
    expect(checkCanStartGame('vsBeepy', [], true)).toMatchObject({ ok: false, error: { code: 'GAME_IN_PROGRESS' } });
  });

  it('alternates the first player across the games of one match', () => {
    const firsts: PlayerId[] = [];
    const outcomes: GameOutcome[] = [];
    for (const intended of [H, B, H, B, H] as const) {
      const status = seriesStatus('vsBeepy', outcomes);
      if (!status.ok) throw new Error(status.error.code);
      const gameIndex = status.status.nextGameIndex;
      const game = playGame(21, gameIndex, intended);
      firsts.push(game.firstPlayer);
      outcomes.push(game.outcome as GameOutcome);
    }
    expect(firsts).toEqual([H, B, H, B, H]);
  });

  it('each game of a match is dealt from its own derived seed (different deals)', () => {
    const deals = [1, 2, 3, 4, 5].map((gameIndex) => {
      const s = sample('vsBeepy');
      const state = ok(createGameState({ mode: 'vsBeepy', deck: s.deck, contextualValidity: s.matrix, seed: 99, gameIndex, options: s.options })).state;
      return JSON.stringify(state.hands);
    });
    expect(new Set(deals).size).toBe(5);
  });

  it('a whole match replays identically from the same seed', () => {
    expect(playMatch(7, [H, B, B, H, H])).toEqual(playMatch(7, [H, B, B, H, H]));
  });
});
