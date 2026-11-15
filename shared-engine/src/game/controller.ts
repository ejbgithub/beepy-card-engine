/**
 * The trusted application controller (Milestone M3, E12; requirement 9;
 * clarification 2a-A).
 *
 * This is the RUNTIME privacy boundary. The authoritative `EngineState` and its
 * private history live only in this closure. The returned controller object is
 * frozen and has methods only: no state property, no getter, and no method that
 * returns the state, the deck's correct-card mapping, the matrix, or the private
 * history. TypeScript types are not relied on for privacy.
 *
 * Everything returned is fresh, plain data meant for the human-facing UI:
 *   - a sanitized `PlayerView` and `PublicEvent`s (see view.ts);
 *   - `PublicError`s built from a FIXED message per code. Engine messages, M2 issue
 *     messages, and issue paths are never copied, because they can name card ids,
 *     challenge ids, or which card answers which challenge. A setup failure is
 *     summarised as counts per check and the stable M2 code constants only.
 *
 * Detailed diagnostics stay in the trusted layer: the host app may pass a
 * `diagnostics` callback when it creates the controller. It receives the full,
 * unsanitized engine error (including every M2 issue message and path) for
 * developer logging. It must not be wired to the UI. If it throws, the throw is
 * ignored and the public result is unchanged.
 *
 * Untyped input is validated, never coerced: a request that is not an object, or
 * whose `kind`, `handle`, or `challengeId` has the wrong runtime type, is a
 * structured `MALFORMED_REQUEST`. Reading hostile input (for example a throwing
 * getter) cannot crash a call; any unexpected exception becomes `ENGINE_FAULT`.
 * A failed call leaves the game unchanged.
 *
 * Determinism: the state carries its random streams (clarification 2a-B). Each game
 * derives its streams from the series seed and the game index, so the same seed,
 * decks, options, strategy, and request sequence replay identically.
 *
 * The UI acts only for the human. Beepy acts only through `advanceBeepy`, using the
 * strategy configured when the controller was created.
 */

import type { BeepyStrategy } from './beepy-strategy.js';
import { resolveMode } from './deck-gate.js';
import {
  advanceBeepy as advanceBeepyCore,
  createGameState,
  evaluatePending,
  submitAction,
} from './game.js';
import { checkCanStartGame, seriesStatus, type SeriesStatus } from './series.js';
import { buildPlayerView, toPublicEvents, type PlayerView, type PublicEvent } from './view.js';
import {
  ENGINE_ERROR_CODES as E,
  ENGINE_MODES,
  type ActionRequest,
  type EngineError,
  type EngineErrorCode,
  type EngineMode,
  type EngineState,
  type GameOptions,
  type GameOutcome,
  type SetupIssue,
  type StepResult,
} from './types.js';

/** The full engine error, for trusted developer diagnostics only. */
export interface TrustedDiagnostic {
  readonly operation: string;
  readonly error: EngineError;
}

/** Configuration for one session (Solitaire) or match (vsBeepy). */
export interface SeriesConfig {
  readonly mode: unknown;
  /** Series seed. Each game's random streams derive from it and the game index. */
  readonly seed: number;
  readonly options?: GameOptions;
  /** Required for vsBeepy: the source of Beepy's actions. */
  readonly beepyStrategy?: BeepyStrategy;
  /** Trusted sink for unsanitized errors. Never connect this to the UI. */
  readonly diagnostics?: (diagnostic: TrustedDiagnostic) => void;
}

/** A game's validated input, supplied by the app (the engine never generates decks). */
export interface GameSetup {
  readonly deck: unknown;
  readonly contextualValidity: unknown;
}

/** A human action, as received from untrusted UI input. */
export interface HumanActionRequest {
  readonly kind: unknown;
  readonly handle: unknown;
  readonly challengeId?: unknown;
}

/** Summary of a setup failure that names no card, challenge, or mapping. */
export interface SetupSummary {
  readonly issueCount: number;
  readonly byStage: Readonly<Record<string, number>>;
  /** Distinct stable issue codes (M2 code constants), sorted. */
  readonly codes: readonly string[];
}

/** An error safe to show in the UI. */
export interface PublicError {
  readonly code: EngineErrorCode;
  readonly message: string;
  /** Present for GAME_SETUP_INVALID only. */
  readonly setup?: SetupSummary;
}

export type ControllerResult =
  | { readonly ok: true; readonly view: PlayerView; readonly events: readonly PublicEvent[] }
  | { readonly ok: false; readonly error: PublicError };

export type SeriesStatusPublicResult =
  | { readonly ok: true; readonly status: SeriesStatus }
  | { readonly ok: false; readonly error: PublicError };

/** The controller's methods. There is deliberately no way to read engine state. */
export interface SeriesController {
  startNextGame(setup: GameSetup): ControllerResult;
  getView(): ControllerResult;
  submitHumanAction(request: HumanActionRequest): ControllerResult;
  decide(decision: unknown): ControllerResult;
  advanceBeepy(): ControllerResult;
  getSeriesStatus(): SeriesStatusPublicResult;
  /** The public events of the current game so far, oldest first. */
  getPublicEvents(): readonly PublicEvent[];
}

/** One fixed, identifier-free message per code. */
const PUBLIC_MESSAGES: Readonly<Record<EngineErrorCode, string>> = {
  INVALID_MODE: 'That game mode is not supported.',
  MODE_NOT_IMPLEMENTED: 'That game mode is not available yet.',
  GAME_SETUP_INVALID: 'The game content could not be validated, so no game was dealt.',
  INVALID_OPTION: 'A game setting is invalid.',
  GAME_ENDED: 'The game has ended.',
  WRONG_PHASE: 'That action is not possible right now.',
  PLAYER_NOT_IN_MODE: 'That player does not take part in this mode.',
  NOT_PLAYERS_TURN: 'It is not your turn.',
  UNKNOWN_HANDLE: "That card is not in the acting player's hand.",
  CARD_NOT_IN_HAND: "That card is not in the acting player's hand.",
  INVALID_ACTION_KIND: 'An action must be a play or a discard.',
  MISSING_CHALLENGE: 'Choose a challenge to play the card on.',
  UNEXPECTED_CHALLENGE: 'A discard cannot name a challenge.',
  UNKNOWN_CHALLENGE: 'That challenge is not on the board.',
  CHALLENGE_ALREADY_SOLVED: 'That challenge is already solved.',
  INVALID_DECISION: 'Choose Accept or Challenge.',
  MALFORMED_REQUEST: 'The request was not understood.',
  SERIES_OUTCOME_MISMATCH: 'The game record does not match this mode.',
  SERIES_OUTCOMES_EXCESSIVE: 'The game record has more games than allowed.',
  GAME_IN_PROGRESS: 'Finish the current game first.',
  SERIES_COMPLETE: 'All games in this series have been played.',
  NO_GAME_STARTED: 'No game has been started.',
  STRATEGY_RESULT_INVALID: 'Beepy could not choose a move.',
  ENGINE_FAULT: 'Something went wrong in the game engine.',
};

function summarizeSetup(issues: readonly SetupIssue[]): SetupSummary {
  const byStage: Record<string, number> = {};
  const codes = new Set<string>();
  for (const issue of issues) {
    byStage[issue.stage] = (byStage[issue.stage] ?? 0) + 1;
    codes.add(issue.code);
  }
  return { issueCount: issues.length, byStage, codes: [...codes].sort() };
}

/**
 * Build the public form of an engine error. Only the code, a fixed message, and
 * (for setup) a count summary survive. A missing handle and a handle held
 * elsewhere look the same, so handles cannot be probed.
 */
export function toPublicError(error: EngineError): PublicError {
  const code: EngineErrorCode = error.code === E.unknownHandle ? E.cardNotInHand : error.code;
  const message = PUBLIC_MESSAGES[code] ?? PUBLIC_MESSAGES.ENGINE_FAULT;
  if (code === E.gameSetupInvalid) {
    return { code, message, setup: summarizeSetup(error.issues ?? []) };
  }
  return { code, message };
}

const engineError = (code: EngineErrorCode, message: string): EngineError => ({ code, message });

const isPlainKind = (value: unknown): value is 'play' | 'discard' => value === 'play' || value === 'discard';

/**
 * Read an untrusted human request into a typed one, or explain why it is malformed.
 * Never coerces; any exception while reading is reported, not thrown.
 */
function readHumanRequest(raw: unknown): ActionRequest | EngineError {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return engineError(E.malformedRequest, 'The action must be an object.');
  }
  let kind: unknown;
  let handle: unknown;
  let challengeId: unknown;
  let hasChallenge: boolean;
  try {
    const record = raw as Record<string, unknown>;
    kind = record['kind'];
    handle = record['handle'];
    hasChallenge = Object.hasOwn(record, 'challengeId');
    challengeId = record['challengeId'];
  } catch {
    return engineError(E.malformedRequest, 'The action could not be read.');
  }
  if (typeof kind !== 'string') {
    return engineError(E.malformedRequest, 'action.kind must be a string.');
  }
  if (!isPlainKind(kind)) {
    return engineError(E.invalidActionKind, 'action.kind must be "play" or "discard".');
  }
  if (typeof handle !== 'string' || handle === '') {
    return engineError(E.malformedRequest, 'action.handle must be a non-empty string.');
  }
  if (hasChallenge && challengeId !== undefined && (typeof challengeId !== 'string' || challengeId === '')) {
    return engineError(E.malformedRequest, 'action.challengeId must be a non-empty string when present.');
  }
  return {
    player: 'human',
    kind,
    handle,
    ...(typeof challengeId === 'string' ? { challengeId } : {}),
  };
}

type PublicFailure = { readonly ok: false; readonly error: PublicError };

/** Create a controller, or a failure if the configuration is invalid. */
export function createSeriesController(
  config: SeriesConfig,
): { readonly ok: true; readonly controller: SeriesController } | PublicFailure {
  const sink = typeof config?.diagnostics === 'function' ? config.diagnostics : undefined;

  /** Report the full error to the trusted sink, and return its public form. */
  const fail = (operation: string, error: EngineError): PublicFailure => {
    if (sink !== undefined) {
      try {
        sink({ operation, error: structuredClone(error) });
      } catch {
        // A failing diagnostics sink must not change the game or its result.
      }
    }
    return { ok: false, error: toPublicError(error) };
  };

  if (typeof config !== 'object' || config === null) {
    return fail('createSeriesController', engineError(E.invalidOption, 'config must be an object.'));
  }
  const mode = resolveMode(config.mode);
  if (typeof mode !== 'string') {
    return fail('createSeriesController', mode.error);
  }
  if (typeof config.seed !== 'number' || !Number.isFinite(config.seed)) {
    return fail('createSeriesController', engineError(E.invalidOption, 'seed must be a finite number.'));
  }
  const strategy = config.beepyStrategy;
  if (
    mode === ENGINE_MODES.vsBeepy &&
    (typeof strategy !== 'object' || strategy === null || typeof strategy.chooseAction !== 'function')
  ) {
    return fail('createSeriesController', engineError(E.invalidOption, 'vsBeepy needs a Beepy strategy.'));
  }
  const seriesMode: EngineMode = mode;
  const seed = config.seed;
  const options: GameOptions = { ...(config.options ?? {}) };

  // ---- Private, authoritative data: never returned. ----
  let state: EngineState | undefined;
  const outcomes: GameOutcome[] = [];
  let publicEvents: PublicEvent[] = [];

  const view = (current: EngineState): PlayerView => buildPlayerView(current, 'human', outcomes);

  /** Commit a successful step and return its public result. */
  const commit = (operation: string, result: StepResult): ControllerResult => {
    if (!result.ok) {
      return fail(operation, result.error);
    }
    state = result.state;
    if (state.phase === 'ended' && state.outcome !== undefined && !outcomes.includes(state.outcome)) {
      outcomes.push(state.outcome);
    }
    const events = toPublicEvents(result.events, state, 'human');
    publicEvents = [...publicEvents, ...events];
    return { ok: true, view: view(state), events: structuredClone(events) };
  };

  /** Run a method body; an unexpected exception becomes a structured ENGINE_FAULT. */
  const guarded = (operation: string, body: () => ControllerResult): ControllerResult => {
    try {
      return body();
    } catch (error) {
      return fail(operation, engineError(E.engineFault, `Unexpected exception: ${String(error)}`));
    }
  };

  const needGame = (operation: string): PublicFailure | undefined =>
    state === undefined ? fail(operation, engineError(E.noGameStarted, 'No game has been started.')) : undefined;

  const controller: SeriesController = {
    startNextGame(setup) {
      return guarded('startNextGame', () => {
        const blocked = checkCanStartGame(seriesMode, outcomes, state !== undefined && state.phase !== 'ended');
        if (blocked !== undefined) {
          return fail('startNextGame', blocked.error);
        }
        const status = seriesStatus(seriesMode, outcomes);
        if (!status.ok) {
          return fail('startNextGame', status.error);
        }
        if (typeof setup !== 'object' || setup === null) {
          return fail('startNextGame', engineError(E.malformedRequest, 'setup must be an object.'));
        }
        const created = createGameState({
          mode: seriesMode,
          deck: setup.deck,
          contextualValidity: setup.contextualValidity,
          seed,
          gameIndex: status.status.nextGameIndex,
          options,
        });
        if (!created.ok) {
          return fail('startNextGame', created.error);
        }
        publicEvents = [];
        return commit('startNextGame', created);
      });
    },

    getView() {
      return guarded('getView', () => needGame('getView') ?? { ok: true, view: view(state as EngineState), events: [] });
    },

    submitHumanAction(request) {
      return guarded('submitHumanAction', () => {
        const missing = needGame('submitHumanAction');
        if (missing !== undefined) return missing;
        const parsed = readHumanRequest(request);
        if (!('player' in parsed)) {
          return fail('submitHumanAction', parsed);
        }
        return commit('submitHumanAction', submitAction(state as EngineState, parsed));
      });
    },

    decide(decision) {
      return guarded('decide', () => {
        const missing = needGame('decide');
        if (missing !== undefined) return missing;
        if (decision !== 'accept' && decision !== 'challenge') {
          return fail('decide', engineError(E.invalidDecision, 'The decision must be "accept" or "challenge".'));
        }
        return commit('decide', evaluatePending(state as EngineState, decision));
      });
    },

    advanceBeepy() {
      return guarded('advanceBeepy', () => {
        const missing = needGame('advanceBeepy');
        if (missing !== undefined) return missing;
        if (strategy === undefined || seriesMode !== ENGINE_MODES.vsBeepy) {
          return fail('advanceBeepy', engineError(E.playerNotInMode, 'Beepy only plays in vsBeepy.'));
        }
        return commit('advanceBeepy', advanceBeepyCore(state as EngineState, strategy));
      });
    },

    getSeriesStatus() {
      const status = seriesStatus(seriesMode, outcomes);
      return status.ok ? { ok: true, status: structuredClone(status.status) } : fail('getSeriesStatus', status.error);
    },

    getPublicEvents() {
      return structuredClone(publicEvents);
    },
  };

  return { ok: true, controller: Object.freeze(controller) };
}
