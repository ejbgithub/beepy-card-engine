/**
 * Game session orchestrator (M6 C6-C7; adapted from Math Cards M5 U4). DOM-free.
 *
 * Owns ONE `ClinicalSeries` (the trusted C4 wrapper, using the shipped,
 * owner-reviewed data by default) and the transient UI state the engine does not
 * hold: the selected card, whether Beepy is "thinking", the latest sanitized view,
 * the feedback for the last step, the Explain Why state, and a friendly error. It
 * is the ONLY UI module that calls `createClinicalSeries`. Every rule (dealing,
 * judging, penalties, scoring, winning) stays in the engine. It never pre-judges.
 *
 * Beepy's turn (C7, as in Math U-4): after any step that leaves Beepy to act, the
 * session marks Beepy as thinking and asks the injected scheduler to call
 * `advanceBeepy()` after `BEEPY_THINK_MS`. `leave()` cancels it.
 *
 * Explain Why (C7; decisions C-5, C-11): after each step, the session asks the
 * series about the plays that step RESOLVED (`explainResolved(turn)`), newest first,
 * and keeps the first authored explanation found. A pending action is never asked
 * about, so nothing about Beepy's move can be learned before Accept/Challenge.
 * Discards never have one. The text is revealed only when the player asks
 * (`openExplanation`), and is cleared by the next step.
 *
 * Repeat clicks cannot send duplicate requests: intents are ignored while Beepy is
 * thinking or after leave, a selection is cleared after every successful action,
 * and a play or discard needs a current selection.
 *
 * `dataset` and `review` exist for tests only (explicit injection, validated the
 * same way). The browser never passes them.
 */

import type { ControllerResult, GameOutcome, PlayerView, PublicEvent } from '@beepy/shared-engine';
import { createClinicalSeries, type ClinicalSeries, type ClinicalSeriesDiagnostic, type ClinicalSeriesResult } from '../clinical-series.js';
import type { GameSettings } from './app-state.js';
import { toBoardModel, type BoardModel } from './board-model.js';
import { toFeedback, type Feedback } from './feedback.js';
import { friendlyError } from './labels.js';

/** How long Beepy "thinks" before acting (decision U-4, as in Math). */
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

/** Explain Why for the last step: whether one exists, and its text once opened. */
export interface ExplainState {
  readonly available: boolean;
  /** Present only after the player asked for it. Verbatim authored text. */
  readonly text?: string;
}

export interface SessionSnapshot {
  readonly settings: GameSettings;
  readonly view: PlayerView;
  readonly board: BoardModel;
  readonly feedback: Feedback;
  readonly selectedHandle?: string;
  readonly beepyThinking: boolean;
  readonly error?: string;
  readonly gameOver: boolean;
  readonly seriesComplete: boolean;
  readonly completedOutcomes: readonly GameOutcome[];
  readonly explain: ExplainState;
}

export interface GameSession {
  snapshot(): SessionSnapshot;
  select(handle: string): void;
  cancel(): void;
  playOn(challengeId: string): void;
  discard(): void;
  accept(): void;
  challenge(): void;
  /** Reveal the explanation for the last resolved play, if one exists. */
  openExplanation(): void;
  closeExplanation(): void;
  /** Deal the next game of this series (after a game ends, if the series continues). */
  nextGame(): void;
  /** Stop: cancel Beepy's timer and ignore every later call. */
  leave(): void;
}

export interface SessionConfig {
  readonly settings: GameSettings;
  readonly seed: number;
  readonly scheduler: Scheduler;
  readonly onChange?: (snapshot: SessionSnapshot) => void;
  /** Trusted developer diagnostics; never wired to the UI (decision U-5). */
  readonly diagnostics?: (diagnostic: ClinicalSeriesDiagnostic) => void;
  /** Tests only: explicit content injection. */
  readonly dataset?: unknown;
  readonly review?: unknown;
}

/** Create a session and deal its first game, or return friendly error text. */
export function createGameSession(
  config: SessionConfig,
): { readonly ok: true; readonly session: GameSession } | { readonly ok: false; readonly error: string; readonly code: string } {
  const created = createClinicalSeries({
    mode: config.settings.mode,
    generationDirection: config.settings.direction,
    seed: config.seed,
    ...(config.dataset === undefined ? {} : { dataset: config.dataset }),
    ...(config.review === undefined ? {} : { review: config.review }),
    ...(config.diagnostics === undefined ? {} : { diagnostics: config.diagnostics }),
  });
  if (!created.ok) return { ok: false, error: friendlyError(created.error.code), code: created.error.code };
  const series: ClinicalSeries = created.series;
  const first = series.startNextGame();
  if (!first.ok) return { ok: false, error: friendlyError(first.error.code), code: first.error.code };

  let view: PlayerView = first.view;
  let feedback: Feedback = toFeedback(first.events);
  let selectedHandle: string | undefined;
  let beepyThinking = false;
  let error: string | undefined;
  let cancelBeepy: (() => void) | undefined;
  let left = false;
  let explanation: string | undefined;
  let explanationOpen = false;
  const completedOutcomes: GameOutcome[] = [];

  /** The authored explanation for the newest play resolved in these events, if any. */
  const explanationFor = (events: readonly PublicEvent[]): string | undefined => {
    const plays = events.filter((e): e is Extract<PublicEvent, { type: 'ACTION_RESOLVED' }> => e.type === 'ACTION_RESOLVED' && e.kind === 'play');
    for (const event of [...plays].reverse()) {
      const result = series.explainResolved(event.turn);
      if (result.ok && result.available) return result.explanation;
    }
    return undefined;
  };

  const snapshot = (): SessionSnapshot => {
    const explain: ExplainState = explanation === undefined ? { available: false } : explanationOpen ? { available: true, text: explanation } : { available: true };
    return {
      settings: config.settings,
      view,
      board: toBoardModel(view, {
        ...(selectedHandle === undefined ? {} : { selectedHandle }),
        busy: beepyThinking || left,
        beepyThinking,
        newCardHandles: feedback.newCardHandles,
        completedOutcomes: [...completedOutcomes],
        explain,
      }),
      feedback,
      ...(selectedHandle === undefined ? {} : { selectedHandle }),
      beepyThinking,
      ...(error === undefined ? {} : { error }),
      gameOver: view.phase === 'ended',
      seriesComplete: view.series?.complete === true,
      completedOutcomes: [...completedOutcomes],
      explain,
    };
  };

  const notify = (): void => {
    if (!left) config.onChange?.(snapshot());
  };
  const canHumanAct = (): boolean => !left && !beepyThinking && view.phase === 'awaitingAction' && view.activePlayer === 'human';

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
  const apply = (result: ClinicalSeriesResult | ControllerResult): void => {
    if (!result.ok) {
      error = friendlyError(result.error.code);
      notify();
      return;
    }
    const wasEnded = view.phase === 'ended';
    view = result.view;
    if (!wasEnded && view.phase === 'ended' && view.outcome !== undefined) completedOutcomes.push(view.outcome);
    feedback = toFeedback(result.events);
    explanation = explanationFor(result.events);
    explanationOpen = false;
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
      apply(series.submitHumanAction({ kind: 'play', handle: selectedHandle, challengeId }));
    },
    discard() {
      if (!canHumanAct() || selectedHandle === undefined) return;
      apply(series.submitHumanAction({ kind: 'discard', handle: selectedHandle }));
    },
    accept() {
      if (left || view.phase !== 'awaitingEvaluation') return;
      apply(series.decide('accept'));
    },
    challenge() {
      if (left || view.phase !== 'awaitingEvaluation') return;
      apply(series.decide('challenge'));
    },
    openExplanation() {
      if (left || explanation === undefined || explanationOpen) return;
      explanationOpen = true;
      notify();
    },
    closeExplanation() {
      if (left || !explanationOpen) return;
      explanationOpen = false;
      notify();
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
