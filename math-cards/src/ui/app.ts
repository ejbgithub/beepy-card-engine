/**
 * Beepy Math Cards app wiring (Milestone M5, U5-U6).
 *
 * Holds the screen state (`app-state.ts`), the current game session
 * (`session.ts`), and the setup choices, and redraws the screen after every change.
 * It contains no game logic: the session forwards choices to the engine, and the
 * renderers draw the board model.
 *
 * Accessibility: one persistent, visually hidden live region announces the feedback
 * for each step (a live region that is re-created on every render is often not
 * announced). Focus is kept on the same control across redraws using `data-focus`
 * keys, with sensible fallbacks. Escape cancels a selected card.
 *
 * Both Solitaire and Player vs. Beepy are playable (vs Beepy since U7). When Beepy's
 * move is waiting for a decision, focus moves to the decision panel's heading, never
 * to Accept or Challenge, so focus cannot steer the decision.
 */

import type { GenerationDirection } from '@beepy/shared-engine';
import type { MathLevel } from '../levels.js';
import type { MathMode } from '../math-generator.js';
import type { MathSeriesDiagnostic } from '../math-series.js';
import { DEFAULT_LEVEL, DEFAULT_STYLE, INITIAL_STATE, transition, type AppState, type GameSettings, type Intent } from './app-state.js';
import { createGameSession, type GameSession, type Scheduler, type SessionSnapshot } from './session.js';
import { renderBoard } from './render/board.js';
import { installDragAndDrop } from './render/drag.js';
import { focusedKey, h, replaceChildren, restoreFocus } from './render/dom.js';
import { renderMenu, renderSetup } from './render/menu.js';

/** Modes playable in this build (vs Beepy enabled in U7). */
export const AVAILABLE_MODES: readonly MathMode[] = ['solitaire', 'vsBeepy'];

export interface AppOptions {
  readonly scheduler: Scheduler;
  readonly newSeed: () => number;
  /** Ask before leaving a game in progress (decision U-11). */
  readonly confirm: (message: string) => boolean;
  /** Developer diagnostics only (decision U-5). */
  readonly diagnostics?: (diagnostic: MathSeriesDiagnostic) => void;
}

const LEAVE_MESSAGE = 'Leave this game? The games you played in this set will not be saved.';

export function mountApp(root: HTMLElement, options: AppOptions): void {
  let state: AppState = INITIAL_STATE;
  let session: GameSession | undefined;
  let snapshot: SessionSnapshot | undefined;
  let level: MathLevel = DEFAULT_LEVEL;
  let direction: GenerationDirection = DEFAULT_STYLE;
  let setupError: string | undefined;
  let lastAnnounced: unknown;

  const screenHost = h('div', { class: 'app' });
  const announcer = h('div', { class: 'sr-only', attrs: { role: 'status', 'aria-live': 'polite', 'aria-atomic': 'true' } });
  replaceChildren(root, screenHost, announcer);

  const announce = (text: string): void => {
    // Clear first so the same message is announced again when it repeats.
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
    menu: () => {
      const inProgress = snapshot !== undefined && !snapshot.gameOver;
      if (inProgress && !options.confirm(LEAVE_MESSAGE)) return;
      endSession();
      state = { ...state, screen: { name: 'menu' } };
      render();
    },
    nextGame: () => {
      if (session === undefined) return;
      // Deal first; move to the playing screen only if the new game started.
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
            level,
            direction,
            ...(setupError === undefined ? {} : { error: setupError }),
            onLevel: (value) => {
              level = value;
            },
            onDirection: (value) => {
              direction = value;
            },
            onStart: () => {
              const settings: GameSettings = { mode: screen.mode, level, direction };
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
          fallback: [`level:${level}`],
        };
      case 'playing':
      case 'gameOver':
      case 'seriesOver': {
        if (snapshot?.board === undefined) {
          return { node: h('p', {}, 'Loading…'), fallback: [] };
        }
        return {
          node: renderBoard({
            board: snapshot.board,
            feedback: snapshot.feedback.items,
            ...(snapshot.error === undefined ? {} : { error: snapshot.error }),
            handlers,
          }),
          fallback: snapshot.board.phase === 'ended' ? ['next', 'again'] : [],
        };
      }
    }
  }

  function render(): void {
    const previous = focusedKey(screenHost);
    const previousScreen = screenHost.dataset['screen'];
    const { node, fallback } = renderScreen();
    replaceChildren(screenHost, node);
    screenHost.dataset['screen'] = state.screen.name;
    const firstCard = screenHost.querySelector<HTMLElement>('[data-focus^="card:"]:not([disabled])')?.dataset['focus'];
    const changedScreen = previousScreen !== state.screen.name;
    const wasOnBoardControl =
      previous !== undefined && /^(card|challenge|discard|cancel|accept|pending|menu)(:|$)/.test(previous);
    // A newly shown Beepy decision: focus its heading (not Accept or Challenge).
    const pendingShown = snapshot?.board?.pending !== undefined && state.screen.name === 'playing';
    const enteringDecision = pendingShown && previous !== 'pending' && previous !== 'accept' && previous !== 'challenge';
    if (enteringDecision) {
      restoreFocus(screenHost, ['pending']);
      return;
    }
    restoreFocus(screenHost, changedScreen ? [...fallback, firstCard] : [previous, ...fallback, ...(wasOnBoardControl ? [firstCard] : [])]);
  }

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') session?.cancel();
  });

  // U10: drag-and-drop gives the same commands as tapping; tapping and keyboard
  // play keep working unchanged.
  installDragAndDrop(screenHost, {
    select: (handle) => session?.select(handle),
    cancel: () => session?.cancel(),
    playOn: (id) => session?.playOn(id),
    discard: () => session?.discard(),
    isSelected: (handle) => snapshot?.selectedHandle === handle,
    canDrag: () => snapshot?.board?.canAct === true && state.screen.name === 'playing',
  });

  render();
}
