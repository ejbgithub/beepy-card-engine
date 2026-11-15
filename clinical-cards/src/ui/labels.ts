/**
 * Fixed text for Beepy's Clinical Cards (M6 C6; adapted from Math Cards M5 U2).
 *
 * Every string the UI shows comes from here or from the engine's own view (prompts
 * and card faces, which are the owner-authored clinical text, verbatim). Nothing is
 * generated, and no clinical content lives here. Error text is chosen by public
 * code only; engine and validator messages are never shown.
 */

import type { EngineErrorCode, GenerationDirection, PlayerId } from '@beepy/shared-engine';
import type { ClinicalMode } from '../clinical-generator.js';
import type { ClinicalSeriesCode } from '../clinical-series.js';

export const APP_TITLE = "Beepy's Clinical Cards";
export const APP_SUBTITLE = 'Match high-yield disease facts to their diseases and categories.';

/** Decision C-13, word for word. */
export const DISCLAIMER = 'For study practice only. Not medical advice.';

/** Games in a Solitaire session, shown as "Game 2 of 5" (master spec section 5). */
export const SESSION_GAMES_LABEL = 5;

export interface ChoiceLabel {
  readonly title: string;
  readonly hint: string;
}

export const MODE_LABELS: Readonly<Record<ClinicalMode, ChoiceLabel>> = {
  solitaire: { title: 'Solitaire', hint: 'Play on your own: five challenges per game, five games per session.' },
  vsBeepy: { title: 'Play vs Beepy', hint: 'Take turns with Beepy on nine shared challenges. First to three game wins.' },
};

/** The two question styles. Examples use placeholders only (no clinical content). */
export const STYLE_LABELS: Readonly<Record<GenerationDirection, ChoiceLabel>> = {
  subjectToFact: { title: 'Disease + category → fact', hint: 'The board shows a disease and a category; find the matching fact card.' },
  factToSubject: { title: 'Fact → disease', hint: 'The board shows a fact; find the card with the disease it belongs to.' },
};

export const PLAYER_NAMES: Readonly<Record<PlayerId, string>> = {
  human: 'You',
  beepy: 'Beepy',
};

/** Why a Solitaire game ended. */
export const SOLITAIRE_END_LABELS = {
  handEmpty: 'You used every card in your hand.',
  allSolved: 'You solved all five challenges.',
} as const;

/** Why a competitive game was won. */
export const COMPETITIVE_END_LABELS = {
  handEmpty: 'played every card',
  fewerCards: 'had fewer cards left',
  moreCredit: 'solved more challenges',
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
  MISSING_CHALLENGE: 'Choose a challenge to play the card on.',
  UNEXPECTED_CHALLENGE: 'Please play the card or discard it.',
  UNKNOWN_CHALLENGE: "That challenge isn't on the board.",
  CHALLENGE_ALREADY_SOLVED: 'That challenge is already solved.',
  INVALID_DECISION: 'Choose Accept or Challenge.',
  MALFORMED_REQUEST: GENERIC_ERROR,
  SERIES_OUTCOME_MISMATCH: GENERIC_ERROR,
  SERIES_OUTCOMES_EXCESSIVE: GENERIC_ERROR,
  GAME_IN_PROGRESS: 'Finish this game first.',
  SERIES_COMPLETE: 'All the games are done. Start a new session to play again.',
  NO_GAME_STARTED: 'Start a game first.',
  STRATEGY_RESULT_INVALID: 'Beepy got stuck. Please try again.',
  ENGINE_FAULT: GENERIC_ERROR,
};

/** Friendly text for every Clinical series code. */
const CLINICAL_ERROR_TEXT: Readonly<Record<ClinicalSeriesCode, string>> = {
  INVALID_CONFIG: 'One of the game settings is not right.',
  MODE_NOT_SUPPORTED: 'That game mode is not available yet.',
  INVALID_MODE: 'That game mode is not available.',
  INVALID_DIRECTION: 'Please choose a question style.',
  INVALID_SEED: GENERIC_ERROR,
  INVALID_OPTION: 'One of the game settings is not right.',
  CLINICAL_DATA_MISSING: 'The clinical card content has not been added yet.',
  CLINICAL_REVIEW_MISSING: 'The clinical review records have not been added yet.',
  CLINICAL_DATA_INVALID: 'The clinical card data could not be loaded.',
  CLINICAL_REVIEW_INVALID: 'The clinical review data could not be loaded.',
  INVALID_REQUEST: GENERIC_ERROR,
  CLINICAL_GENERATION_FAILED: "We couldn't prepare a deck for this game. Please try again.",
  CLINICAL_SERIES_FAULT: GENERIC_ERROR,
};

/** Friendly text for a public error code. Unknown codes get a generic message. */
export function friendlyError(code: string): string {
  if (Object.hasOwn(CLINICAL_ERROR_TEXT, code)) return CLINICAL_ERROR_TEXT[code as ClinicalSeriesCode];
  if (Object.hasOwn(ENGINE_ERROR_TEXT, code)) return ENGINE_ERROR_TEXT[code as EngineErrorCode];
  return GENERIC_ERROR;
}

/** Exposed for tests: the code tables. */
export const ERROR_TABLES = { engine: ENGINE_ERROR_TEXT, clinical: CLINICAL_ERROR_TEXT } as const;
