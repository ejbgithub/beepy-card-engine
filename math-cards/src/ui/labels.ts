/**
 * Fixed, child-friendly text for Beepy Math Cards (Milestone M5, U2; decision U-8).
 *
 * Every string the UI shows comes from here or from the engine's own view (prompts
 * and card faces). Nothing is generated. Error text is chosen by public code only;
 * engine messages are never shown.
 */

import type { EngineErrorCode, GenerationDirection, PlayerId } from '@beepy/shared-engine';
import type { MathLevel } from '../levels.js';
import type { MathMode } from '../math-generator.js';
import type { MathSeriesCode } from '../math-series.js';

export const APP_TITLE = "Beepy's Math Cards";

/** Games in a Solitaire session, shown as "Game 2 of 5" (master spec section 5). */
export const SESSION_GAMES_LABEL = 5;

export interface ChoiceLabel {
  readonly title: string;
  readonly hint: string;
}

export const MODE_LABELS: Readonly<Record<MathMode, ChoiceLabel>> = {
  solitaire: { title: 'Solitaire', hint: 'Play on your own. Solve five problems in five games.' },
  vsBeepy: { title: 'Play vs Beepy', hint: 'Take turns with Beepy. First to win three games!' },
};

export const LEVEL_LABELS: Readonly<Record<MathLevel, ChoiceLabel>> = {
  oneDigit: { title: 'Small numbers', hint: 'Like 3 + 4' },
  oneAndTwoDigit: { title: 'Small + big numbers', hint: 'Like 6 + 25' },
  twoDigit: { title: 'Big numbers', hint: 'Like 34 + 21' },
  mixed: { title: 'Mix it up', hint: 'A little of everything' },
};

export const STYLE_LABELS: Readonly<Record<GenerationDirection, ChoiceLabel>> = {
  factToSubject: { title: 'Solve the problem', hint: '3 + 4 = ?  →  find the card 7' },
  subjectToFact: { title: 'Find the matching addition', hint: 'Which addition equals 7?  →  find 3 + 4' },
};

export const PLAYER_NAMES: Readonly<Record<PlayerId, string>> = {
  human: 'You',
  beepy: 'Beepy',
};

/** Why a Solitaire game ended. */
export const SOLITAIRE_END_LABELS = {
  handEmpty: 'You used every card in your hand!',
  allSolved: 'You solved all five problems!',
} as const;

/** Why a competitive game was won. */
export const COMPETITIVE_END_LABELS = {
  handEmpty: 'played every card',
  fewerCards: 'had fewer cards left',
  moreCredit: 'solved more problems',
} as const;

const GENERIC_ERROR = 'Something went wrong. Please try again.';

/** Friendly text for every public engine code. */
const ENGINE_ERROR_TEXT: Readonly<Record<EngineErrorCode, string>> = {
  INVALID_MODE: 'That game mode is not available.',
  MODE_NOT_IMPLEMENTED: 'That game mode is not available yet.',
  GAME_SETUP_INVALID: "We couldn't set up this game. Please try again.",
  INVALID_OPTION: 'One of the game settings is not right.',
  GAME_ENDED: 'This game is over.',
  WRONG_PHASE: 'Please wait a moment.',
  PLAYER_NOT_IN_MODE: 'That move is not possible in this game.',
  NOT_PLAYERS_TURN: "It's not your turn yet.",
  UNKNOWN_HANDLE: "That card isn't in your hand.",
  CARD_NOT_IN_HAND: "That card isn't in your hand.",
  INVALID_ACTION_KIND: 'Please play the card or discard it.',
  MISSING_CHALLENGE: 'Choose a problem to play the card on.',
  UNEXPECTED_CHALLENGE: 'Please play the card or discard it.',
  UNKNOWN_CHALLENGE: "That problem isn't on the board.",
  CHALLENGE_ALREADY_SOLVED: 'That problem is already solved.',
  INVALID_DECISION: 'Choose Accept or Challenge.',
  MALFORMED_REQUEST: GENERIC_ERROR,
  SERIES_OUTCOME_MISMATCH: GENERIC_ERROR,
  SERIES_OUTCOMES_EXCESSIVE: GENERIC_ERROR,
  GAME_IN_PROGRESS: 'Finish this game first.',
  SERIES_COMPLETE: 'All the games are done! Start a new set to play again.',
  NO_GAME_STARTED: 'Start a game first.',
  STRATEGY_RESULT_INVALID: 'Beepy got stuck. Please try again.',
  ENGINE_FAULT: GENERIC_ERROR,
};

/** Friendly text for every Math series code. */
const MATH_ERROR_TEXT: Readonly<Record<MathSeriesCode, string>> = {
  INVALID_CONFIG: 'One of the game settings is not right.',
  MODE_NOT_SUPPORTED: 'That game mode is not available yet.',
  INVALID_MODE: 'That game mode is not available.',
  INVALID_LEVEL: 'Please choose a level.',
  INVALID_DIRECTION: 'Please choose a question style.',
  INVALID_SEED: GENERIC_ERROR,
  INVALID_OPTION: 'One of the game settings is not right.',
  MATH_GENERATION_FAILED: "We couldn't make new cards for this game. Please try again.",
  MATH_SERIES_FAULT: GENERIC_ERROR,
};

/** Friendly text for a public error code. Unknown codes get a generic message. */
export function friendlyError(code: string): string {
  if (Object.hasOwn(MATH_ERROR_TEXT, code)) return MATH_ERROR_TEXT[code as MathSeriesCode];
  if (Object.hasOwn(ENGINE_ERROR_TEXT, code)) return ENGINE_ERROR_TEXT[code as EngineErrorCode];
  return GENERIC_ERROR;
}

/** Exposed for tests: the code tables. */
export const ERROR_TABLES = { engine: ENGINE_ERROR_TEXT, math: MATH_ERROR_TEXT } as const;
