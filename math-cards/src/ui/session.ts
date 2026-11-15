/**
 * Game session orchestrator (Milestone M5, U4). DOM-free.
 *
 * Owns ONE `MathSeries` (the trusted M4 wrapper) and the transient UI state the
 * engine does not hold: the selected card, whether Beepy is "thinking", the latest
 * sanitized view, the feedback for the last step, and a friendly error message.
 *
 * It is the ONLY UI module that calls `createMathSeries`. Every rule (dealing,
 * judging, penalties, scoring, winning) stays in the engine: the session forwards
 * the player's choices and stores what comes back. It never pre-judges a move.
 *
 * Beepy's turn: after any step that leaves Beepy to act, the session marks Beepy as
 * thinking and asks the injected scheduler to call `advanceBeepy()` after
 * `BEEPY_THINK_MS` (decision U-4). The browser passes a `setTimeout` scheduler;
 * tests pass a manual one. `leave()` cancels a scheduled Beepy step and makes the
 * session inert.
 *
 * Repeat clicks cannot send duplicate requests: intents are ignored while busy
 * (Beepy thinking, or the session left), a selection is cleared after every
 * successful action, and a play or discard needs a current selection.
 */

import type { ControllerResult, GameOutcome, PlayerView } from '@beepy/shared-engine';
import {
  createMathSeries,
  type MathSeries,
  type MathSeriesDiagnostic,
  type MathSeriesResult,
} from '../math-series.js';
import type { GameSettings } from './app-state.js';
import { toBoardModel, type BoardModel } from './board-model.js';
import { toFeedback, type Feedback } from './feedback.js';
import { friendlyError } from './labels.js';

/** How long Beepy "thinks" before acting (decision U-4). */
export const BEEPY_THINK_MS = 1000;

/** Runs a callback later; returns a function that cancels it. */
export interface Scheduler {
  after(ms: number, run: () => void): () => void;
}

/** The browser scheduler. */
export const browserScheduler: Scheduler = {
  after(ms, run) {
    const id = globalThis.setTimeout(run, ms);
    return () => globalThis.clearTimeout(id);
  },
};

export interface SessionSnapshot {
  readonly settings: GameSettings;
  /** The latest sanitized view (absent only if no game could start). */
  readonly view?: PlayerView;
  readonly board?: BoardModel;
  readonly feedback: Feedback;
  readonly selectedHandle?: string;
  readonly beepyThinking: boolean;
  /** Friendly text for the last failed request, if any. */
  readonly error?: string;
  readonly gameOver: boolean;
  readonly seriesComplete: boolean;
  /** Outcomes of the finished games of this series, oldest first (as the engine gave them). */
  readonly completedOutcomes: readonly GameOutcome[];
}

export interface GameSession {
  snapshot(): SessionSnapshot;
  select(handle: string): void;
  cancel(): void;
  playOn(challengeId: string): void;
  discard(): void;
  accept(): void;
  challenge(): void;
  /** Deal the next game of this series (after a game ends, if the series continues). */
  nextGame(): void;
  /** Stop: cancel Beepy's timer and ignore every later call. */
  leave(): void;
}

export interface SessionConfig {
  readonly settings: GameSettings;
  readonly seed: number;
  readonly scheduler: Scheduler;
  /** Called after every visible change. */
  readonly onChange?: (snapshot: SessionSnapshot) => void;
  /** Trusted developer diagnostics; never wired to the UI (decision U-5). */
  readonly diagnostics?: (diagnostic: MathSeriesDiagnostic) => void;
}

type Outcome = MathSeriesResult | ControllerResult;

/** Create a session and deal its first game, or return friendly error text. */
export function createGameSession(
  config: SessionConfig,
): { readonly ok: true; readonly session: GameSession } | { readonly ok: false; readonly error: string } {
  const created = createMathSeries({
    mode: config.settings.mode,
    level: config.settings.level,
    generationDirection: config.settings.direction,
    seed: config.seed,
    ...(config.diagnostics === undefined ? {} : { diagnostics: config.diagnostics }),
  });
  if (!created.ok) {
    return { ok: false, error: friendlyError(created.error.code) };
  }
  const series: MathSeries = created.series;
  const first = series.startNextGame();
  if (!first.ok) {
    return { ok: false, error: friendlyError(first.error.code) };
  }

  let view: PlayerView = first.view;
  let feedback: Feedback = toFeedback(first.events);
  let selectedHandle: string | undefined;
  let beepyThinking = false;
  let error: string | undefined;
  let cancelBeepy: (() => void) | undefined;
  let left = false;
  const completedOutcomes: GameOutcome[] = [];

  const snapshot = (): SessionSnapshot => {
    const ui = {
      ...(selectedHandle === undefined ? {} : { selectedHandle }),
      busy: beepyThinking || left,
      beepyThinking,
      newCardHandles: feedback.newCardHandles,
      completedOutcomes: [...completedOutcomes],
    };
    return {
      settings: config.settings,
      view,
      board: toBoardModel(view, ui),
      feedback,
      ...(selectedHandle === undefined ? {} : { selectedHandle }),
      beepyThinking,
      ...(error === undefined ? {} : { error }),
      gameOver: view.phase === 'ended',
      seriesComplete: view.series?.complete === true,
      completedOutcomes: [...completedOutcomes],
    };
  };

  const notify = (): void => {
    if (!left) config.onChange?.(snapshot());
  };

  const canHumanAct = (): boolean =>
    !left && !beepyThinking && view.phase === 'awaitingAction' && view.activePlayer === 'human';

  /** Schedule Beepy's turn if Beepy is to act now. */
  const maybeBeepy = (): void => {
    if (left || beepyThinking) return;
    if (view.phase !== 'awaitingAction' || view.activePlayer !== 'beepy') return;
    beepyThinking = true;
    cancelBeepy = config.scheduler.after(BEEPY_THINK_MS, () => {
      cancelBeepy = undefined;
      if (left) return;
      beepyThinking = false;
      apply(series.advanceBeepy());
    });
  };

  /** Store the result of a request, then notify. A failure keeps the game as it was. */
  const apply = (result: Outcome): void => {
    if (!result.ok) {
      error = friendlyError(result.error.code);
      notify();
      return;
    }
    const wasEnded = view.phase === 'ended';
    view = result.view;
    // Record each game's outcome once, when it ends (engine data, not recomputed).
    if (!wasEnded && view.phase === 'ended' && view.outcome !== undefined) {
      completedOutcomes.push(view.outcome);
    }
    feedback = toFeedback(result.events);
    error = undefined;
    selectedHandle = undefined;
    maybeBeepy();
    notify();
  };

  const session: GameSession = {
    snapshot,
    select(handle) {
      if (!canHumanAct() || !view.hand.some((card) => card.handle === handle)) return;
      selectedHandle = selectedHandle === handle ? undefined : handle;
      error = undefined;
      notify();
    },
    cancel() {
      if (left || selectedHandle === undefined) return;
      selectedHandle = undefined;
      notify();
    },
    playOn(challengeId) {
      if (!canHumanAct() || selectedHandle === undefined) return;
      const handle = selectedHandle;
      apply(series.submitHumanAction({ kind: 'play', handle, challengeId }));
    },
    discard() {
      if (!canHumanAct() || selectedHandle === undefined) return;
      const handle = selectedHandle;
      apply(series.submitHumanAction({ kind: 'discard', handle }));
    },
    accept() {
      if (left || view.phase !== 'awaitingEvaluation') return;
      apply(series.decide('accept'));
    },
    challenge() {
      if (left || view.phase !== 'awaitingEvaluation') return;
      apply(series.decide('challenge'));
    },
    nextGame() {
      if (left || view.phase !== 'ended' || view.series?.complete === true) return;
      apply(series.startNextGame());
    },
    leave() {
      if (left) return;
      left = true;
      cancelBeepy?.();
      cancelBeepy = undefined;
      beepyThinking = false;
    },
  };

  // Beepy may move first (even games of a match).
  maybeBeepy();
  return { ok: true, session: Object.freeze(session) };
}
