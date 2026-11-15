/**
 * Sessions and matches (Milestone M3, E7 and E10; requirement 8).
 *
 * Pure bookkeeping over the outcomes of finished games:
 *   - Solitaire SESSION: exactly five games; the session score is the sum of the
 *     game scores (lower is better).
 *   - Competitive MATCH: best of five, first to three wins, decided as soon as one
 *     player reaches three.
 *
 * The mode and outcomes are validated, never trusted or silently skipped:
 *   - the mode must be one the engine plays (`tutor`/`vsPlayer` give
 *     `MODE_NOT_IMPLEMENTED`, anything else `INVALID_MODE`); an unsupported mode is
 *     never treated as a competitive match. This applies to every function here,
 *     including `maxGamesFor`, and reports a structured failure, not an exception;
 *   - every outcome must be of the kind that mode produces, otherwise
 *     `SERIES_OUTCOME_MISMATCH` names the offending entry;
 *   - there must be no more outcomes than the series allows, and none recorded after
 *     the series was already decided, otherwise `SERIES_OUTCOMES_EXCESSIVE`.
 *
 * The caller supplies each game's validated deck and matrix; the engine never
 * generates decks. Starting a game outside the permitted sequence is a structured
 * illegal request. There is no gameplay turn cap.
 */

import { resolveMode } from './deck-gate.js';
import { MATCH_GAMES, MATCH_WINS_NEEDED } from './competitive.js';
import { SOLITAIRE_SESSION_GAMES } from './solitaire.js';
import {
  ENGINE_ERROR_CODES as E,
  ENGINE_MODES,
  failure,
  type Failure,
  type GameOutcome,
  type PlayerId,
} from './types.js';

/** Where a session or match stands. */
export interface SeriesStatus {
  readonly kind: 'session' | 'match';
  readonly gamesCompleted: number;
  /** 1-based number of the next game to start (or the game in progress). */
  readonly nextGameIndex: number;
  readonly complete: boolean;
  /** Solitaire: sum of finished game scores. */
  readonly sessionScore?: number;
  /** Solitaire: each finished game's score, in order. */
  readonly gameScores?: readonly number[];
  /** Competitive: games won so far. */
  readonly wins?: Readonly<Record<PlayerId, number>>;
  /** Competitive: the match winner once decided. */
  readonly winner?: PlayerId;
}

export type SeriesStatusResult =
  | { readonly ok: true; readonly status: SeriesStatus }
  | Failure;

export type MaxGamesResult = { readonly ok: true; readonly maxGames: number } | Failure;

/**
 * Games in a series for a mode, at most. An unsupported mode returns a structured
 * failure (never a guess, never an exception).
 */
export function maxGamesFor(mode: unknown): MaxGamesResult {
  const resolved = resolveMode(mode);
  if (typeof resolved !== 'string') {
    return resolved;
  }
  return {
    ok: true,
    maxGames: resolved === ENGINE_MODES.solitaire ? SOLITAIRE_SESSION_GAMES : MATCH_GAMES,
  };
}

const isPlayer = (value: unknown): value is PlayerId => value === 'human' || value === 'beepy';

/**
 * Compute the status from the outcomes of finished games, oldest first, or explain
 * why the mode or outcomes cannot form a valid series.
 */
export function seriesStatus(mode: unknown, outcomes: unknown): SeriesStatusResult {
  const resolved = resolveMode(mode);
  if (typeof resolved !== 'string') {
    return resolved;
  }
  if (!Array.isArray(outcomes)) {
    return failure(E.seriesOutcomeMismatch, 'The game outcomes must be an array.');
  }
  const list = outcomes as readonly unknown[];

  // Every outcome must be of this mode's kind.
  const kind = resolved === ENGINE_MODES.solitaire ? 'solitaire' : 'vsBeepy';
  for (let i = 0; i < list.length; i += 1) {
    const outcome = list[i] as { kind?: unknown; winner?: unknown; score?: unknown } | null;
    if (typeof outcome !== 'object' || outcome === null || outcome.kind !== kind) {
      return failure(
        E.seriesOutcomeMismatch,
        `Outcome ${i + 1} is not a "${kind}" game outcome, so it cannot belong to a ${resolved} series.`,
      );
    }
    if (kind === 'vsBeepy' && !isPlayer(outcome.winner)) {
      return failure(E.seriesOutcomeMismatch, `Outcome ${i + 1} has no valid winner.`);
    }
    if (kind === 'solitaire' && !(typeof outcome.score === 'number' && Number.isFinite(outcome.score))) {
      return failure(E.seriesOutcomeMismatch, `Outcome ${i + 1} has no valid score.`);
    }
  }
  const games = list as readonly GameOutcome[];

  if (resolved === ENGINE_MODES.solitaire) {
    if (games.length > SOLITAIRE_SESSION_GAMES) {
      return failure(
        E.seriesOutcomesExcessive,
        `A Solitaire session has ${SOLITAIRE_SESSION_GAMES} games; ${games.length} outcomes were given.`,
      );
    }
    const gameScores = games.flatMap((outcome) => (outcome.kind === 'solitaire' ? [outcome.score] : []));
    return {
      ok: true,
      status: {
        kind: 'session',
        gamesCompleted: gameScores.length,
        nextGameIndex: gameScores.length + 1,
        complete: gameScores.length === SOLITAIRE_SESSION_GAMES,
        sessionScore: gameScores.reduce((a, b) => a + b, 0),
        gameScores,
      },
    };
  }

  if (games.length > MATCH_GAMES) {
    return failure(
      E.seriesOutcomesExcessive,
      `A match has at most ${MATCH_GAMES} games; ${games.length} outcomes were given.`,
    );
  }
  const wins: Record<PlayerId, number> = { human: 0, beepy: 0 };
  let winner: PlayerId | undefined;
  for (let i = 0; i < games.length; i += 1) {
    if (winner !== undefined) {
      return failure(
        E.seriesOutcomesExcessive,
        `The match was already won by ${winner} before outcome ${i + 1}; no further games can be recorded.`,
      );
    }
    const game = games[i];
    if (game?.kind === 'vsBeepy') {
      wins[game.winner] += 1;
      if (wins[game.winner] >= MATCH_WINS_NEEDED) {
        winner = game.winner;
      }
    }
  }
  return {
    ok: true,
    status: {
      kind: 'match',
      gamesCompleted: games.length,
      nextGameIndex: games.length + 1,
      complete: winner !== undefined || games.length === MATCH_GAMES,
      wins,
      ...(winner === undefined ? {} : { winner }),
    },
  };
}

/** Is a new game allowed now? Returns a failure when it is not. */
export function checkCanStartGame(
  mode: unknown,
  outcomes: unknown,
  gameInProgress: boolean,
): Failure | undefined {
  const result = seriesStatus(mode, outcomes);
  if (!result.ok) {
    return result;
  }
  if (gameInProgress) {
    return failure(E.gameInProgress, 'The current game has not ended yet.');
  }
  if (result.status.complete) {
    return failure(
      E.seriesComplete,
      result.status.kind === 'session'
        ? `The ${SOLITAIRE_SESSION_GAMES}-game session is complete.`
        : 'The match is already decided.',
    );
  }
  return undefined;
}
