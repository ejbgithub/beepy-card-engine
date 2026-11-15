/**
 * Initialization gate (Milestone M3, E2; requirement 1).
 *
 * The engine never assumes a deck is valid just because it is typed as a
 * `GeneratedDeck`. `validateDeckForPlay` runs EVERY M2 check that applies to a
 * deck, in order, and reports all issues together:
 *   1. defensive shape check (guards untyped callers; stops the later stages when
 *      the deck is not even usable as data),
 *   2. challenge mapping and ambiguity elimination with the COMPLETE contextual
 *      validity matrix (a missing matrix is `CONTEXTUAL_VALIDITY_MISSING`),
 *   3. global uniqueness of ids and display values,
 *   4. deck-size rules for the mode,
 *   5. starting-hand feasibility (single hand or two hands plus a penalty reserve).
 *
 * Source-data structure and identifier stages apply to source collections, which
 * the engine never receives, so they are not repeated here.
 *
 * Nothing is repaired, reordered, or relaxed. M2 modules are only called.
 */

import type { GeneratedDeck } from '../generated-deck.js';
import { isGenerationDirection } from '../generation-config.js';
import {
  validateChallengeMapping,
  type ContextualValidityMap,
} from '../challenge-mapping.js';
import { validateUniqueness } from '../uniqueness.js';
import { validateDeckSize } from '../deck-size.js';
import { checkStartingHandFeasibility } from '../starting-hand.js';
import { checkDualHandFeasibility } from '../dual-hand.js';
import type { DeckValidationIssue } from '../deck-issues.js';
import {
  ENGINE_ERROR_CODES,
  ENGINE_MODES,
  failure,
  type EngineMode,
  type Failure,
  type SetupIssue,
} from './types.js';

/** Options that affect deck validation. */
export interface GateOptions {
  /** Compare display values as numbers (Math). */
  readonly numericAnswers?: boolean;
}

/**
 * Resolve a mode value. `tutor` and `vsPlayer` are known modes the M3 engine does
 * not play, so they are rejected explicitly and never run as Solitaire.
 */
export function resolveMode(mode: unknown): EngineMode | Failure {
  if (mode === ENGINE_MODES.solitaire || mode === ENGINE_MODES.vsBeepy) {
    return mode;
  }
  if (mode === 'tutor' || mode === 'vsPlayer') {
    return failure(
      ENGINE_ERROR_CODES.modeNotImplemented,
      `Mode "${mode}" is not implemented in this engine milestone and will not be played as another mode.`,
    );
  }
  return failure(
    ENGINE_ERROR_CODES.invalidMode,
    `Unsupported mode ${JSON.stringify(mode) ?? String(mode)}. Supported modes: ${Object.values(ENGINE_MODES).join(', ')}.`,
  );
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === 'string' && value.trim() !== '';

const shapeIssue = (code: string, message: string, path: string): SetupIssue => ({
  stage: 'shape',
  code,
  message,
  path,
});

/** Defensive structural check of a deck-shaped value. */
export function checkDeckShape(deck: unknown): SetupIssue[] {
  const issues: SetupIssue[] = [];
  if (!isRecord(deck)) {
    return [shapeIssue('INVALID_SHAPE', 'The deck must be an object.', 'deck')];
  }
  if (!isGenerationDirection(deck['direction'])) {
    issues.push(
      shapeIssue('INVALID_SHAPE', 'deck.direction must be "factToSubject" or "subjectToFact".', 'direction'),
    );
  }

  const challenges = deck['challenges'];
  if (!Array.isArray(challenges)) {
    issues.push(shapeIssue('INVALID_SHAPE', 'deck.challenges must be an array.', 'challenges'));
  } else {
    challenges.forEach((challenge: unknown, i) => {
      const path = `challenges[${i}]`;
      if (!isRecord(challenge)) {
        issues.push(shapeIssue('INVALID_SHAPE', 'A challenge must be an object.', path));
        return;
      }
      for (const field of ['id', 'promptText', 'correctAnswerCardId']) {
        if (!isNonEmptyString(challenge[field])) {
          issues.push(shapeIssue('INVALID_SHAPE', `${path}.${field} must be a non-empty string.`, `${path}.${field}`));
        }
      }
      const sourceRef = challenge['sourceRef'];
      if (!isRecord(sourceRef) || !isNonEmptyString(sourceRef['subjectId'])) {
        issues.push(
          shapeIssue('INVALID_SHAPE', `${path}.sourceRef.subjectId must be a non-empty string.`, `${path}.sourceRef`),
        );
      }
    });
  }

  const cards = deck['answerCards'];
  if (!Array.isArray(cards)) {
    issues.push(shapeIssue('INVALID_SHAPE', 'deck.answerCards must be an array.', 'answerCards'));
  } else {
    cards.forEach((card: unknown, i) => {
      const path = `answerCards[${i}]`;
      if (!isRecord(card)) {
        issues.push(shapeIssue('INVALID_SHAPE', 'An answer card must be an object.', path));
        return;
      }
      for (const field of ['id', 'displayValue']) {
        if (!isNonEmptyString(card[field])) {
          issues.push(shapeIssue('INVALID_SHAPE', `${path}.${field} must be a non-empty string.`, `${path}.${field}`));
        }
      }
      const explanations = card['explanationByChallengeId'];
      if (explanations !== undefined && !isRecord(explanations)) {
        issues.push(
          shapeIssue('INVALID_SHAPE', `${path}.explanationByChallengeId must be an object when present.`, `${path}.explanationByChallengeId`),
        );
      }
    });
  }

  const meta = deck['meta'];
  if (!isRecord(meta)) {
    issues.push(shapeIssue('INVALID_SHAPE', 'deck.meta must be an object.', 'meta'));
  } else {
    for (const field of ['targetCardCount', 'actualCardCount']) {
      if (typeof meta[field] !== 'number') {
        issues.push(shapeIssue('INVALID_SHAPE', `deck.meta.${field} must be a number.`, `meta.${field}`));
      }
    }
  }
  return issues;
}

const fromDeckIssues = (
  stage: SetupIssue['stage'],
  issues: readonly DeckValidationIssue[],
): SetupIssue[] =>
  issues.map((issue) => ({ stage, code: issue.code, message: issue.message, path: issue.path }));

/**
 * Run every deck-level M2 check for a mode and return ALL issues found (an empty
 * list means the deck may be dealt). Never throws for bad input.
 */
export function validateDeckForPlay(
  deck: unknown,
  mode: EngineMode,
  contextualValidity: unknown,
  options: GateOptions = {},
): SetupIssue[] {
  const shape = checkDeckShape(deck);
  if (shape.length > 0) {
    return shape;
  }
  const typed = deck as GeneratedDeck;
  const matrix = isRecord(contextualValidity)
    ? (contextualValidity as ContextualValidityMap)
    : (undefined as unknown as ContextualValidityMap);
  const numericAnswers = options.numericAnswers === true;

  return [
    ...fromDeckIssues('mapping', validateChallengeMapping(typed, matrix).issues),
    ...fromDeckIssues('uniqueness', validateUniqueness(typed, { numericAnswers }).issues),
    ...fromDeckIssues('deckSize', validateDeckSize(typed, mode).issues),
    ...fromDeckIssues(
      'feasibility',
      (mode === ENGINE_MODES.vsBeepy
        ? checkDualHandFeasibility(typed)
        : checkStartingHandFeasibility(typed)
      ).issues,
    ),
  ];
}
