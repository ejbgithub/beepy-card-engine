/**
 * M3 E7 / E10 - session and match bookkeeping (requirement 8), using the
 * `SeriesStatusResult` and `MaxGamesResult` result types.
 */

import { describe, expect, it } from 'vitest';
import { checkCanStartGame, maxGamesFor, seriesStatus, type SeriesStatus } from '../src/game/series.js';
import type { GameOutcome, PlayerId } from '../src/game/types.js';

const solo = (score: number): GameOutcome => ({ kind: 'solitaire', turns: score, cardsRemaining: 0, score, endedBy: ['handEmpty'] });
const won = (winner: PlayerId): GameOutcome => ({
  kind: 'vsBeepy',
  winner,
  reason: 'handEmpty',
  handCounts: { human: winner === 'human' ? 0 : 3, beepy: winner === 'beepy' ? 0 : 3 },
  credits: { human: 1, beepy: 1 },
});

/** Unwrap a successful status or fail the test. */
function status(mode: unknown, outcomes: unknown): SeriesStatus {
  const result = seriesStatus(mode, outcomes);
  if (!result.ok) throw new Error(`expected a status, got ${result.error.code}`);
  return result.status;
}

const H = 'human' as const;
const B = 'beepy' as const;

describe('valid five-game Solitaire session', () => {
  it('starts at game 1 with a zero score', () => {
    expect(status('solitaire', [])).toEqual({
      kind: 'session',
      gamesCompleted: 0,
      nextGameIndex: 1,
      complete: false,
      sessionScore: 0,
      gameScores: [],
    });
  });

  it('sums the five game scores and completes after the fifth', () => {
    const scores = [8, 12, 7, 15, 9];
    for (let n = 1; n <= 4; n += 1) {
      const s = status('solitaire', scores.slice(0, n).map(solo));
      expect(s.complete).toBe(false);
      expect(s.sessionScore).toBe(scores.slice(0, n).reduce((a, b) => a + b, 0));
      expect(s.nextGameIndex).toBe(n + 1);
    }
    expect(status('solitaire', scores.map(solo))).toMatchObject({ complete: true, sessionScore: 51, gamesCompleted: 5, gameScores: scores });
  });

  it('allows the next game in sequence, and rejects a sixth game', () => {
    expect(checkCanStartGame('solitaire', [solo(3), solo(4)], false)).toBeUndefined();
    expect(checkCanStartGame('solitaire', [1, 2, 3, 4, 5].map(solo), false)).toMatchObject({
      ok: false,
      error: { code: 'SERIES_COMPLETE' },
    });
  });

  it('rejects starting a game before the current one ended', () => {
    expect(checkCanStartGame('solitaire', [solo(3)], true)).toMatchObject({ ok: false, error: { code: 'GAME_IN_PROGRESS' } });
  });
});

describe('valid best-of-five match', () => {
  it.each([
    [[H, H, H], H, 3],
    [[B, B, B], B, 3],
    [[H, B, H, H], H, 4],
    [[B, H, B, H, B], B, 5],
    [[H, B, B, H, H], H, 5],
  ] as const)('%j is won by %s after %i games', (winners, winner, games) => {
    const s = status('vsBeepy', winners.map(won));
    expect(s).toMatchObject({ kind: 'match', complete: true, winner, gamesCompleted: games });
    expect(checkCanStartGame('vsBeepy', winners.map(won), false)).toMatchObject({ error: { code: 'SERIES_COMPLETE' } });
  });

  it('is undecided at 2-2 and allows game 5', () => {
    const s = status('vsBeepy', [H, B, H, B].map(won));
    expect(s).toMatchObject({ complete: false, wins: { human: 2, beepy: 2 }, nextGameIndex: 5 });
    expect(s.winner).toBeUndefined();
    expect(checkCanStartGame('vsBeepy', [H, B, H, B].map(won), false)).toBeUndefined();
  });
});

describe('mismatched outcome kinds are rejected, never skipped', () => {
  it('a competitive outcome in a Solitaire session', () => {
    const result = seriesStatus('solitaire', [solo(4), won(H), solo(5)]);
    expect(result).toMatchObject({ ok: false, error: { code: 'SERIES_OUTCOME_MISMATCH' } });
    if (!result.ok) expect(result.error.message).toContain('Outcome 2');
  });

  it('a Solitaire outcome in a match', () => {
    expect(seriesStatus('vsBeepy', [won(H), solo(4)])).toMatchObject({ ok: false, error: { code: 'SERIES_OUTCOME_MISMATCH' } });
  });

  it('malformed outcomes: not an object, missing winner, invalid score, not an array', () => {
    expect(seriesStatus('solitaire', [null])).toMatchObject({ error: { code: 'SERIES_OUTCOME_MISMATCH' } });
    expect(seriesStatus('solitaire', ['solitaire'])).toMatchObject({ error: { code: 'SERIES_OUTCOME_MISMATCH' } });
    expect(seriesStatus('vsBeepy', [{ kind: 'vsBeepy', winner: 'nobody' }])).toMatchObject({ error: { code: 'SERIES_OUTCOME_MISMATCH' } });
    expect(seriesStatus('solitaire', [{ kind: 'solitaire', score: Number.NaN }])).toMatchObject({ error: { code: 'SERIES_OUTCOME_MISMATCH' } });
    expect(seriesStatus('solitaire', 'games')).toMatchObject({ error: { code: 'SERIES_OUTCOME_MISMATCH' } });
  });

  it('a mismatch also blocks starting another game', () => {
    expect(checkCanStartGame('solitaire', [won(H)], false)).toMatchObject({ error: { code: 'SERIES_OUTCOME_MISMATCH' } });
  });
});

describe('excessive outcomes are rejected', () => {
  it('more than five Solitaire games', () => {
    expect(seriesStatus('solitaire', [1, 2, 3, 4, 5, 6].map(solo))).toMatchObject({ ok: false, error: { code: 'SERIES_OUTCOMES_EXCESSIVE' } });
  });

  it('more than five match games', () => {
    expect(seriesStatus('vsBeepy', [H, B, H, B, H, B].map(won))).toMatchObject({ ok: false, error: { code: 'SERIES_OUTCOMES_EXCESSIVE' } });
  });

  it('a game recorded after the match was decided', () => {
    const result = seriesStatus('vsBeepy', [H, H, H, B].map(won));
    expect(result).toMatchObject({ ok: false, error: { code: 'SERIES_OUTCOMES_EXCESSIVE' } });
    if (!result.ok) expect(result.error.message).toContain('already won by human');
    expect(seriesStatus('vsBeepy', [B, H, B, B, H].map(won))).toMatchObject({ error: { code: 'SERIES_OUTCOMES_EXCESSIVE' } });
    expect(checkCanStartGame('vsBeepy', [H, H, H, B].map(won), false)).toMatchObject({ error: { code: 'SERIES_OUTCOMES_EXCESSIVE' } });
  });
});

describe('unsupported modes are never treated as a match or a session', () => {
  it.each(['tutor', 'vsPlayer'])('%s gives MODE_NOT_IMPLEMENTED everywhere', (mode) => {
    expect(seriesStatus(mode, [])).toMatchObject({ ok: false, error: { code: 'MODE_NOT_IMPLEMENTED' } });
    expect(maxGamesFor(mode)).toMatchObject({ ok: false, error: { code: 'MODE_NOT_IMPLEMENTED' } });
    expect(checkCanStartGame(mode, [], false)).toMatchObject({ ok: false, error: { code: 'MODE_NOT_IMPLEMENTED' } });
  });

  it.each([undefined, null, '', 'match', 'competitive', 2, {}])('%j gives INVALID_MODE everywhere', (mode) => {
    expect(seriesStatus(mode, [won(H)])).toMatchObject({ ok: false, error: { code: 'INVALID_MODE' } });
    expect(maxGamesFor(mode)).toMatchObject({ ok: false, error: { code: 'INVALID_MODE' } });
    expect(checkCanStartGame(mode, [], false)).toMatchObject({ ok: false, error: { code: 'INVALID_MODE' } });
  });

  it('does not throw', () => {
    expect(() => maxGamesFor(Symbol('x'))).not.toThrow();
    expect(() => seriesStatus(Symbol('x'), [])).not.toThrow();
  });
});

describe('maxGamesFor', () => {
  it('returns the approved counts for supported modes', () => {
    expect(maxGamesFor('solitaire')).toEqual({ ok: true, maxGames: 5 });
    expect(maxGamesFor('vsBeepy')).toEqual({ ok: true, maxGames: 5 });
  });
});
