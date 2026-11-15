/**
 * M5 U2 - screen flow and labels (requirements 2, 7.3).
 */

import { describe, expect, it } from 'vitest';
import { ENGINE_ERROR_CODES, GENERATION_DIRECTIONS } from '@beepy/shared-engine';
import {
  INITIAL_STATE,
  MENU_LEVELS,
  MENU_MODES,
  MENU_STYLES,
  readSettings,
  transition,
  type AppState,
  type Intent,
  type Screen,
} from '../src/ui/app-state.js';
import {
  COMPETITIVE_END_LABELS,
  ERROR_TABLES,
  LEVEL_LABELS,
  MODE_LABELS,
  PLAYER_NAMES,
  SOLITAIRE_END_LABELS,
  STYLE_LABELS,
  friendlyError,
} from '../src/ui/labels.js';
import { MATH_LEVELS } from '../src/levels.js';
import { MATH_SERIES_CODES } from '../src/math-series.js';

const settings = { mode: 'solitaire', level: 'twoDigit', direction: 'subjectToFact' } as const;
const at = (screen: Screen, seriesNumber = 1): AppState => ({ screen, seriesNumber });

const ALL_INTENTS: Intent[] = [
  { type: 'chooseMode', mode: 'solitaire' },
  { type: 'back' },
  { type: 'start', settings },
  { type: 'gameEnded', seriesComplete: false },
  { type: 'nextGame' },
  { type: 'playAgain' },
  { type: 'quit' },
  { type: 'mainMenu' },
];

describe('menu contents', () => {
  it('offers Solitaire and vs Beepy only (no Tutor, no Player vs Player)', () => {
    expect(MENU_MODES).toEqual(['solitaire', 'vsBeepy']);
    expect(MENU_MODES).not.toContain('tutor');
    expect(MENU_MODES).not.toContain('vsPlayer');
  });

  it('offers every approved level and both question styles', () => {
    expect([...MENU_LEVELS].sort()).toEqual(Object.values(MATH_LEVELS).sort());
    expect([...MENU_STYLES].sort()).toEqual(Object.values(GENERATION_DIRECTIONS).sort());
  });
});

describe('transitions', () => {
  it('starts on the menu with no series', () => {
    expect(INITIAL_STATE).toEqual({ screen: { name: 'menu' }, seriesNumber: 0 });
  });

  it('menu -> setup for each menu mode', () => {
    for (const mode of MENU_MODES) {
      expect(transition(INITIAL_STATE, { type: 'chooseMode', mode }).screen).toEqual({ name: 'setup', mode });
    }
  });

  it.each(['tutor', 'vsPlayer', 'x', undefined, 3])('chooseMode(%j) is ignored', (mode) => {
    expect(transition(INITIAL_STATE, { type: 'chooseMode', mode })).toBe(INITIAL_STATE);
  });

  it('setup -> menu on back, and on mainMenu', () => {
    const setup = at({ name: 'setup', mode: 'solitaire' });
    expect(transition(setup, { type: 'back' }).screen).toEqual({ name: 'menu' });
    expect(transition(setup, { type: 'mainMenu' }).screen).toEqual({ name: 'menu' });
  });

  it('setup -> playing on a valid start, beginning a new series', () => {
    const next = transition(at({ name: 'setup', mode: 'solitaire' }, 4), { type: 'start', settings });
    expect(next).toEqual({ screen: { name: 'playing', settings }, seriesNumber: 5 });
  });

  it.each([
    { ...settings, mode: 'vsBeepy' },
    { ...settings, level: 'threeDigit' },
    { ...settings, direction: 'both' },
    null,
    'solitaire',
  ])('start with invalid settings %j is ignored', (bad) => {
    const setup = at({ name: 'setup', mode: 'solitaire' });
    expect(transition(setup, { type: 'start', settings: bad })).toBe(setup);
  });

  it('playing -> gameOver or seriesOver when a game ends', () => {
    const playing = at({ name: 'playing', settings });
    expect(transition(playing, { type: 'gameEnded', seriesComplete: false }).screen).toEqual({ name: 'gameOver', settings });
    expect(transition(playing, { type: 'gameEnded', seriesComplete: true }).screen).toEqual({ name: 'seriesOver', settings });
  });

  it('playing -> menu on quit', () => {
    expect(transition(at({ name: 'playing', settings }), { type: 'quit' }).screen).toEqual({ name: 'menu' });
  });

  it('gameOver -> playing on nextGame, keeping the same series', () => {
    const next = transition(at({ name: 'gameOver', settings }, 7), { type: 'nextGame' });
    expect(next).toEqual({ screen: { name: 'playing', settings }, seriesNumber: 7 });
  });

  it('gameOver and seriesOver -> playing on playAgain, starting a new series', () => {
    for (const name of ['gameOver', 'seriesOver'] as const) {
      expect(transition(at({ name, settings }, 2), { type: 'playAgain' })).toEqual({
        screen: { name: 'playing', settings },
        seriesNumber: 3,
      });
    }
  });

  it('gameOver and seriesOver -> menu on mainMenu', () => {
    for (const name of ['gameOver', 'seriesOver'] as const) {
      expect(transition(at({ name, settings }), { type: 'mainMenu' }).screen).toEqual({ name: 'menu' });
    }
  });

  it('seriesOver does not allow nextGame', () => {
    const over = at({ name: 'seriesOver', settings });
    expect(transition(over, { type: 'nextGame' })).toBe(over);
  });

  it('every intent that does not apply leaves the state unchanged', () => {
    const allowed: Record<Screen['name'], string[]> = {
      menu: ['chooseMode'],
      setup: ['back', 'start', 'mainMenu'],
      playing: ['gameEnded', 'quit'],
      gameOver: ['nextGame', 'playAgain', 'mainMenu'],
      seriesOver: ['playAgain', 'mainMenu'],
    };
    const screens: Screen[] = [
      { name: 'menu' },
      { name: 'setup', mode: 'solitaire' },
      { name: 'playing', settings },
      { name: 'gameOver', settings },
      { name: 'seriesOver', settings },
    ];
    for (const screen of screens) {
      const state = at(screen);
      for (const intent of ALL_INTENTS) {
        const next = transition(state, intent);
        if (!allowed[screen.name].includes(intent.type)) expect(next, `${screen.name} + ${intent.type}`).toBe(state);
        else expect(next, `${screen.name} + ${intent.type}`).not.toBe(state);
      }
    }
  });

  it('an unknown intent type is ignored', () => {
    expect(transition(INITIAL_STATE, { type: 'explode' } as unknown as Intent)).toBe(INITIAL_STATE);
  });

  it('readSettings rejects a mode mismatch and accepts a valid record', () => {
    expect(readSettings(settings, 'solitaire')).toEqual(settings);
    expect(readSettings(settings, 'vsBeepy')).toBeUndefined();
  });
});

describe('labels', () => {
  it('every mode, level, and style has a title and a hint', () => {
    for (const mode of MENU_MODES) expect(MODE_LABELS[mode].title.length * MODE_LABELS[mode].hint.length).toBeGreaterThan(0);
    for (const level of MENU_LEVELS) expect(LEVEL_LABELS[level].title.length * LEVEL_LABELS[level].hint.length).toBeGreaterThan(0);
    for (const style of MENU_STYLES) expect(STYLE_LABELS[style].title.length * STYLE_LABELS[style].hint.length).toBeGreaterThan(0);
  });

  it('every end reason and player has text', () => {
    expect(Object.keys(SOLITAIRE_END_LABELS).sort()).toEqual(['allSolved', 'handEmpty']);
    expect(Object.keys(COMPETITIVE_END_LABELS).sort()).toEqual(['fewerCards', 'handEmpty', 'moreCredit']);
    expect(PLAYER_NAMES).toEqual({ human: 'You', beepy: 'Beepy' });
  });

  it('every public engine code and Math series code has friendly text', () => {
    for (const code of Object.values(ENGINE_ERROR_CODES)) {
      expect(Object.hasOwn(ERROR_TABLES.engine, code), code).toBe(true);
      expect(friendlyError(code).length).toBeGreaterThan(0);
    }
    for (const code of Object.values(MATH_SERIES_CODES)) {
      expect(Object.hasOwn(ERROR_TABLES.math, code), code).toBe(true);
      expect(friendlyError(code).length).toBeGreaterThan(0);
    }
    expect(Object.keys(ERROR_TABLES.engine).sort()).toEqual(Object.values(ENGINE_ERROR_CODES).sort());
    expect(Object.keys(ERROR_TABLES.math).sort()).toEqual(Object.values(MATH_SERIES_CODES).sort());
  });

  it('unknown codes get a generic message, never the code itself', () => {
    expect(friendlyError('SOMETHING_ODD')).toBe('Something went wrong. Please try again.');
    expect(friendlyError('toString')).toBe('Something went wrong. Please try again.');
  });

  it('the shared codes MODE_NOT_SUPPORTED and INVALID_MODE use the Math wording', () => {
    expect(friendlyError('INVALID_MODE')).toBe(ERROR_TABLES.math.INVALID_MODE);
  });
});
