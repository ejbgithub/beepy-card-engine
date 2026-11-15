/**
 * Screen flow for Beepy Math Cards (Milestone M5, U2). Pure: no DOM, no engine.
 *
 *   menu --chooseMode--> setup --start--> playing --gameEnded--> gameOver | seriesOver
 *     ^                    |                 |                       |
 *     +------ back --------+---- quit -------+     nextGame: gameOver -> playing
 *     +------------------------------ mainMenu ----------------------+
 *                                  playAgain: gameOver | seriesOver -> playing (new series)
 *
 * `seriesNumber` increases each time a NEW series starts (start, playAgain), so the
 * app knows to create a fresh `createMathSeries`. `nextGame` keeps the same series.
 * Any intent that does not apply to the current screen leaves the state unchanged
 * (the same object is returned).
 */

import type { GenerationDirection } from '@beepy/shared-engine';
import type { MathLevel } from '../levels.js';
import type { MathMode } from '../math-generator.js';

/** Modes offered on the main menu (Tutor and Player vs. Player are not offered). */
export const MENU_MODES: readonly MathMode[] = ['solitaire', 'vsBeepy'];

/** Approved level ids, in menu order. */
export const MENU_LEVELS: readonly MathLevel[] = ['oneDigit', 'oneAndTwoDigit', 'twoDigit', 'mixed'];

/** Approved question styles, in menu order. */
export const MENU_STYLES: readonly GenerationDirection[] = ['factToSubject', 'subjectToFact'];

/** What the player picked on the setup screen. */
export interface GameSettings {
  readonly mode: MathMode;
  readonly level: MathLevel;
  readonly direction: GenerationDirection;
}

/** Defaults on the setup screen (decision U-8). */
export const DEFAULT_LEVEL: MathLevel = 'oneDigit';
export const DEFAULT_STYLE: GenerationDirection = 'factToSubject';

export type Screen =
  | { readonly name: 'menu' }
  | { readonly name: 'setup'; readonly mode: MathMode }
  | { readonly name: 'playing'; readonly settings: GameSettings }
  | { readonly name: 'gameOver'; readonly settings: GameSettings }
  | { readonly name: 'seriesOver'; readonly settings: GameSettings };

export interface AppState {
  readonly screen: Screen;
  /** Incremented whenever a new series begins. */
  readonly seriesNumber: number;
}

export type Intent =
  | { readonly type: 'chooseMode'; readonly mode: unknown }
  | { readonly type: 'back' }
  | { readonly type: 'start'; readonly settings: unknown }
  | { readonly type: 'gameEnded'; readonly seriesComplete: boolean }
  | { readonly type: 'nextGame' }
  | { readonly type: 'playAgain' }
  | { readonly type: 'quit' }
  | { readonly type: 'mainMenu' };

export const INITIAL_STATE: AppState = { screen: { name: 'menu' }, seriesNumber: 0 };

const isMenuMode = (value: unknown): value is MathMode => MENU_MODES.includes(value as MathMode);

/** Accept only well-formed settings for the given mode. */
export function readSettings(value: unknown, mode: MathMode): GameSettings | undefined {
  if (typeof value !== 'object' || value === null) return undefined;
  const raw = value as Record<string, unknown>;
  const level = raw['level'];
  const direction = raw['direction'];
  if (raw['mode'] !== mode) return undefined;
  if (!MENU_LEVELS.includes(level as MathLevel)) return undefined;
  if (!MENU_STYLES.includes(direction as GenerationDirection)) return undefined;
  return { mode, level: level as MathLevel, direction: direction as GenerationDirection };
}

/** The next state for an intent. Unknown or inapplicable intents change nothing. */
export function transition(state: AppState, intent: Intent): AppState {
  const screen = state.screen;
  switch (intent.type) {
    case 'chooseMode':
      if (screen.name !== 'menu' || !isMenuMode(intent.mode)) return state;
      return { ...state, screen: { name: 'setup', mode: intent.mode } };
    case 'back':
      if (screen.name !== 'setup') return state;
      return { ...state, screen: { name: 'menu' } };
    case 'start': {
      if (screen.name !== 'setup') return state;
      const settings = readSettings(intent.settings, screen.mode);
      if (settings === undefined) return state;
      return { screen: { name: 'playing', settings }, seriesNumber: state.seriesNumber + 1 };
    }
    case 'gameEnded':
      if (screen.name !== 'playing') return state;
      return {
        ...state,
        screen: { name: intent.seriesComplete ? 'seriesOver' : 'gameOver', settings: screen.settings },
      };
    case 'nextGame':
      if (screen.name !== 'gameOver') return state;
      return { ...state, screen: { name: 'playing', settings: screen.settings } };
    case 'playAgain':
      if (screen.name !== 'gameOver' && screen.name !== 'seriesOver') return state;
      return { screen: { name: 'playing', settings: screen.settings }, seriesNumber: state.seriesNumber + 1 };
    case 'quit':
      if (screen.name !== 'playing') return state;
      return { ...state, screen: { name: 'menu' } };
    case 'mainMenu':
      if (screen.name !== 'gameOver' && screen.name !== 'seriesOver' && screen.name !== 'setup') return state;
      return { ...state, screen: { name: 'menu' } };
    default:
      return state;
  }
}
