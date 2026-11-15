/**
 * Beepy's Clinical Cards app wiring (M6 C6; adapted from Math Cards M5 U5-U6).
 *
 * Holds the screen state (`app-state.ts`), the current game session (`session.ts`)
 * and the setup choice, and redraws after every change. It contains no game logic.
 *
 * Startup (C5 design, owner-approved): the shipped, owner-reviewed content is
 * validated BEFORE the menu appears. If it is missing or invalid, the data error
 * screen is shown instead, and no game can start. There is no fallback content.
 *
 * Accessibility (as in Math): one persistent, visually hidden live region announces
 * the feedback of each step; focus is kept on the same control across redraws using
 * `data-focus` keys; Escape cancels a selected card.
 *
 * Both Solitaire (C6) and Player vs. Beepy (C7) are playable. When Beepy's move is
 * waiting for a decision, focus moves to the decision panel's heading, never to
 * Accept or Challenge, so focus cannot steer the decision (as in Math U7).
 * Drag-and-drop (C7) gives the same commands as tapping.
 */

import type { GenerationDirection } from '@beepy/shared-engine';
import type { ClinicalMode } from '../clinical-generator.js';
import type { ClinicalSeriesDiagnostic } from '../clinical-series.js';
import { loadShippedClinicalContent } from '../shipped-data.js';
import { DEFAULT_STYLE, INITIAL_STATE, transition, type AppState, type GameSettings, type Intent } from './app-state.js';
import { friendlyError } from './labels.js';
import { createGameSession, type GameSession, type Scheduler, type SessionSnapshot } from './session.js';
import { renderBoard } from './render/board.js';
import { installDragAndDrop } from './render/drag.js';
import { focusedKey, h, replaceChildren, restoreFocus } from './render/dom.js';
import { renderDataError, renderMenu, renderSetup } from './render/menu.js';

/** Modes playable in this build (Player vs. Beepy enabled in C7). */
export const AVAILABLE_MODES: readonly ClinicalMode[] = ['solitaire', 'vsBeepy'];

export interface AppOptions {
  readonly scheduler: Scheduler;
  readonly newSeed: () => number;
  /** Ask before leaving a game in progress (decision U-11). */
  readonly confirm: (message: string) => boolean;
  /** Developer diagnostics only (decision U-5). */
  readonly diagnostics?: (diagnostic: ClinicalSeriesDiagnostic) => void;
}

const LEAVE_MESSAGE = 'Leave this game? The games you played in this session will not be saved.';

/** The friendly message to show instead of the menu, or undefined when the content is usable. */
export function contentProblem(): string | undefined {
  const loaded = loadShippedClinicalContent();
  return loaded.ok ? undefined : friendlyError(loaded.code);
}

export function mountApp(root: HTMLElement, options: AppOptions): void {
  let state: AppState = INITIAL_STATE;
  let session: GameSession | undefined;
  let snapshot: SessionSnapshot | undefined;
  let direction: GenerationDirection = DEFAULT_STYLE;
  let setupError: string | undefined;
  let lastAnnounced: unknown;
  const dataProblem = contentProblem();

  const screenHost = h('div', { class: 'app app--clinical' });
  const announcer = h('div', { class: 'sr-only', attrs: { role: 'status', 'aria-live': 'polite', 'aria-atomic': 'true' } });
  replaceChildren(root, screenHost, announcer);

  const announce = (text: string): void => {
    announcer.textContent = '';
    globalThis.setTimeout(() => {
      announcer.textContent = text;
    }, 30);
  };

  const endSession = (): void => {
    session?.leave();
    session = undefined;
    snapshot = undefined;
  };

  const startSession = (settings: GameSettings): string | undefined => {
    endSession();
    const created = createGameSession({
      settings,
      seed: options.newSeed(),
      scheduler: options.scheduler,
      onChange: onSessionChange,
      ...(options.diagnostics === undefined ? {} : { diagnostics: options.diagnostics }),
    });
    if (!created.ok) return created.error;
    session = created.session;
    snapshot = session.snapshot();
    lastAnnounced = snapshot.feedback;
    announce(snapshot.feedback.items.map((item) => item.text).join(' '));
    return undefined;
  };

  function dispatch(intent: Intent): void {
    state = transition(state, intent);
    render();
  }

  function onSessionChange(next: SessionSnapshot): void {
    snapshot = next;
    if (next.feedback !== lastAnnounced) {
      lastAnnounced = next.feedback;
      const text = [...next.feedback.items.map((item) => item.text), ...(next.error === undefined ? [] : [next.error])].join(' ');
      if (text !== '') announce(text);
    } else if (next.error !== undefined) {
      announce(next.error);
    }
    if (next.gameOver && state.screen.name === 'playing') {
      state = transition(state, { type: 'gameEnded', seriesComplete: next.seriesComplete });
    }
    render();
  }

  const handlers = {
    select: (handle: string) => session?.select(handle),
    cancel: () => session?.cancel(),
    playOn: (id: string) => session?.playOn(id),
    discard: () => session?.discard(),
    accept: () => session?.accept(),
    challenge: () => session?.challenge(),
    openExplanation: () => {
      session?.openExplanation();
      restoreFocus(screenHost, ['explain-panel']);
    },
    closeExplanation: () => {
      session?.closeExplanation();
      restoreFocus(screenHost, ['explain']);
    },
    menu: () => {
      const inProgress = snapshot !== undefined && !snapshot.gameOver;
      if (inProgress && !options.confirm(LEAVE_MESSAGE)) return;
      endSession();
      state = { ...state, screen: { name: 'menu' } };
      render();
    },
    nextGame: () => {
      if (session === undefined) return;
      session.nextGame();
      if (snapshot !== undefined && !snapshot.gameOver) dispatch({ type: 'nextGame' });
    },
    playAgain: () => {
      const screen = state.screen;
      if (screen.name !== 'gameOver' && screen.name !== 'seriesOver') return;
      const error = startSession(screen.settings);
      if (error !== undefined) {
        endSession();
        state = { ...state, screen: { name: 'menu' } };
        announce(error);
        render();
        return;
      }
      dispatch({ type: 'playAgain' });
    },
    mainMenu: () => {
      endSession();
      dispatch({ type: 'mainMenu' });
    },
  };

  function renderScreen(): { node: HTMLElement; fallback: string[] } {
    if (dataProblem !== undefined) return { node: renderDataError(dataProblem), fallback: [] };
    const screen = state.screen;
    switch (screen.name) {
      case 'menu':
        return {
          node: renderMenu({
            availableModes: AVAILABLE_MODES,
            onChoose: (mode) => {
              if (!AVAILABLE_MODES.includes(mode)) return;
              setupError = undefined;
              dispatch({ type: 'chooseMode', mode });
            },
          }),
          fallback: ['mode:solitaire'],
        };
      case 'setup':
        return {
          node: renderSetup({
            mode: screen.mode,
            direction,
            ...(setupError === undefined ? {} : { error: setupError }),
            onDirection: (value) => {
              direction = value;
            },
            onStart: () => {
              const settings: GameSettings = { mode: screen.mode, direction };
              const error = startSession(settings);
              if (error !== undefined) {
                setupError = error;
                render();
                return;
              }
              setupError = undefined;
              dispatch({ type: 'start', settings });
            },
            onBack: () => dispatch({ type: 'back' }),
          }),
          fallback: [`style:${direction}`],
        };
      case 'playing':
      case 'gameOver':
      case 'seriesOver':
        if (snapshot === undefined) return { node: h('p', {}, 'Loading…'), fallback: [] };
        return {
          node: renderBoard({ board: snapshot.board, feedback: snapshot.feedback.items, ...(snapshot.error === undefined ? {} : { error: snapshot.error }), handlers }),
          fallback: snapshot.board.phase === 'ended' ? ['next', 'again'] : [],
        };
    }
  }

  function render(): void {
    const previous = focusedKey(screenHost);
    const previousScreen = screenHost.dataset['screen'];
    const { node, fallback } = renderScreen();
    replaceChildren(screenHost, node);
    screenHost.dataset['screen'] = dataProblem === undefined ? state.screen.name : 'dataError';
    const firstCard = screenHost.querySelector<HTMLElement>('[data-focus^="card:"]:not([disabled])')?.dataset['focus'];
    const changedScreen = previousScreen !== screenHost.dataset['screen'];
    const wasOnBoardControl = previous !== undefined && /^(card|challenge|discard|cancel|accept|pending|explain|explain-close|menu)(:|$)/.test(previous);
    // A newly shown Beepy decision: focus its heading (not Accept or Challenge).
    const pendingShown = snapshot?.board.pending !== undefined && state.screen.name === 'playing';
    if (pendingShown && previous !== 'pending' && previous !== 'accept' && previous !== 'challenge') {
      restoreFocus(screenHost, ['pending']);
      return;
    }
    restoreFocus(screenHost, changedScreen ? [...fallback, firstCard] : [previous, ...fallback, ...(wasOnBoardControl ? [firstCard] : [])]);
  }

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') session?.cancel();
  });

  // C7: drag-and-drop gives the same commands as tapping; tapping and keyboard play
  // keep working unchanged.
  installDragAndDrop(screenHost, {
    select: (handle) => session?.select(handle),
    cancel: () => session?.cancel(),
    playOn: (id) => session?.playOn(id),
    discard: () => session?.discard(),
    isSelected: (handle) => snapshot?.selectedHandle === handle,
    canDrag: () => snapshot?.board.canAct === true && state.screen.name === 'playing',
  });

  render();
}
