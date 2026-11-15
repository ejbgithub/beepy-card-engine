/**
 * Regression - public API surface and issue-code registry (Tasks 2-13).
 *
 * These lock the shared engine's runtime exports and every stable code value, so a
 * change that removes, renames, or re-values something an earlier task delivered is
 * caught. Adding a new export or code later means updating the expected lists here
 * on purpose.
 */

import { describe, expect, it } from 'vitest';
import * as engine from '../src/index.js';

const EXPORTS_BY_TASK: Readonly<Record<string, readonly string[]>> = {
  'Task 2 (identifiers)': ['SUBJECT_NAMESPACES', 'ID_KINDS', 'ID_SEPARATOR', 'buildId', 'isValidId', 'parseId', 'isInNamespace', 'collectIds', 'findDuplicateIds', 'findMalformedIds'],
  'Task 2a (collections)': ['CURRENT_SCHEMA_VERSION', 'MERGE_ERROR_CODES', 'CollectionMergeError', 'createCollection', 'checkMergeable', 'assertMergeable', 'mergeCollections'],
  'Task 4 (generation direction)': ['GENERATION_DIRECTIONS', 'GENERATION_APPS', 'DEFAULT_DIRECTION_BY_APP', 'isGenerationDirection', 'defaultDirectionForApp', 'resolveGenerationDirection', 'oppositeDirection'],
  'Task 6 (source validation)': ['VALIDATION_CODES', 'SUPPORTED_SCHEMA_VERSIONS', 'validateStructure', 'validateIdentifiers', 'validateCollectionSource'],
  'Task 7 (mapping and ambiguity)': ['DECK_VALIDATION_CODES', 'deckIssue', 'deckResult', 'normalizeDisplayText', 'validateChallengeMapping'],
  'Task 8 (uniqueness)': ['canonicalNumber', 'validateUniqueness'],
  'Task 9 (starting hand)': ['STARTING_HAND_SIZE', 'MIN_CORRECT_IN_STARTING_HAND', 'MAX_CORRECT_IN_STARTING_HAND', 'validateStartingHand', 'checkStartingHandFeasibility'],
  'Task 10 (dual hands)': ['COMPETITIVE_HAND_COUNT', 'MIN_PENALTY_RESERVE', 'countCorrectAndDistractors', 'canSupplyHands', 'checkDualHandFeasibility', 'validateDualStartingHands'],
  'Task 11 (deck size)': ['DECK_MODES', 'isDeckMode', 'SOLITAIRE_CHALLENGE_COUNT', 'COMPETITIVE_CHALLENGE_COUNT', 'COMPETITIVE_MIN_CARD_COUNT', 'expectedChallengeCount', 'handCountForMode', 'minimumDistractors', 'planDeckSize', 'validateDeckSize'],
  'Task 12 (penalty draw)': ['DEFAULT_MAX_PENALTY_CANDIDATES', 'PENALTY_REASONS', 'FALLBACK_STATUSES', 'FALLBACK_REJECTIONS', 'drawPenaltyCards'],
  'Task 13 (issue model, insufficient data)': ['isStructuredIssue', 'formatIssue', 'formatIssues', 'issuesFromMergeError', 'countUniqueValues', 'assessDeckData', 'analyzeCandidateAmbiguity'],
  'M3 E14 (game engine)': ['createSeriesController', 'createReferenceBeepyStrategy', 'ENGINE_MODES', 'ENGINE_ERROR_CODES', 'toRngState', 'nextUint32', 'nextFloat', 'nextInt', 'shuffle', 'deriveSeed'],
  'M4 G2 (deck gate for generators)': ['validateDeckForPlay'],
};

describe('regression: public API surface', () => {
  it.each(Object.entries(EXPORTS_BY_TASK))('%s exports are all present', (_task, names) => {
    const missing = names.filter((name) => !(name in engine));
    expect(missing).toEqual([]);
  });

  it('exports exactly the 80 known runtime values (69 from M2 + 10 from M3 + 1 from M4): nothing lost, nothing unreviewed', () => {
    const expected = Object.values(EXPORTS_BY_TASK).flat().sort();
    expect(expected).toHaveLength(80);
    expect(Object.keys(engine).sort()).toEqual(expected);
  });

  it('keeps the engine-private core out of the public surface (M3 privacy boundary)', () => {
    for (const name of [
      'createGameState', 'submitAction', 'evaluatePending', 'advanceBeepy', 'judgeAction', 'checkRequest',
      'applyPenaltyEvent', 'dealHands', 'buildPlayerView', 'toPublicEvents', 'toPublicError', 'beepyStrategyInput',
      'seriesStatus', 'checkCanStartGame',
      // 'validateDeckForPlay' left this list in M4 G2 (decision M4-6): it reads only a
      // deck and a matrix and returns issues, so it exposes no game state.
    ]) {
      expect(name in engine, name).toBe(false);
    }
  });
});

describe('regression: the exported deck gate (M4 G2)', () => {
  it('is the same function the engine uses, and accepts a valid deck and rejects a missing matrix', async () => {
    const internal = await import('../src/game/deck-gate.js');
    expect(engine.validateDeckForPlay).toBe(internal.validateDeckForPlay);
    const deck = {
      direction: 'factToSubject',
      challenges: [0, 1, 2, 3, 4].map((i) => ({ id: `c${i}`, promptText: `${i + 1} + 9 = ?`, correctAnswerCardId: `k${i}`, sourceRef: { subjectId: 'math.subject.test' } })),
      answerCards: [
        ...[0, 1, 2, 3, 4].map((i) => ({ id: `k${i}`, displayValue: String(10 + i) })),
        ...[0, 1, 2, 3].map((j) => ({ id: `d${j}`, displayValue: String(40 + j) })),
      ],
      meta: { targetCardCount: 9, actualCardCount: 9 },
    };
    const matrix = Object.fromEntries(
      deck.challenges.map((c) => [c.id, Object.fromEntries(deck.answerCards.map((a) => [a.id, a.id === c.correctAnswerCardId]))]),
    );
    expect(engine.validateDeckForPlay(deck, 'solitaire', matrix, { numericAnswers: true })).toEqual([]);
    expect(engine.validateDeckForPlay(deck, 'solitaire', undefined, { numericAnswers: true }).map((i) => i.code)).toContain(
      'CONTEXTUAL_VALIDITY_MISSING',
    );
  });
});

describe('regression: M3 engine code values', () => {
  it('locks the engine modes (tutor and vsPlayer are deliberately absent)', () => {
    expect(engine.ENGINE_MODES).toEqual({ solitaire: 'solitaire', vsBeepy: 'vsBeepy' });
  });

  it('locks all 24 engine error codes, each unique', () => {
    expect(engine.ENGINE_ERROR_CODES).toEqual({
      invalidMode: 'INVALID_MODE',
      modeNotImplemented: 'MODE_NOT_IMPLEMENTED',
      gameSetupInvalid: 'GAME_SETUP_INVALID',
      invalidOption: 'INVALID_OPTION',
      gameEnded: 'GAME_ENDED',
      wrongPhase: 'WRONG_PHASE',
      playerNotInMode: 'PLAYER_NOT_IN_MODE',
      notPlayersTurn: 'NOT_PLAYERS_TURN',
      unknownHandle: 'UNKNOWN_HANDLE',
      cardNotInHand: 'CARD_NOT_IN_HAND',
      invalidActionKind: 'INVALID_ACTION_KIND',
      missingChallenge: 'MISSING_CHALLENGE',
      unexpectedChallenge: 'UNEXPECTED_CHALLENGE',
      unknownChallenge: 'UNKNOWN_CHALLENGE',
      challengeAlreadySolved: 'CHALLENGE_ALREADY_SOLVED',
      invalidDecision: 'INVALID_DECISION',
      malformedRequest: 'MALFORMED_REQUEST',
      seriesOutcomeMismatch: 'SERIES_OUTCOME_MISMATCH',
      seriesOutcomesExcessive: 'SERIES_OUTCOMES_EXCESSIVE',
      gameInProgress: 'GAME_IN_PROGRESS',
      seriesComplete: 'SERIES_COMPLETE',
      noGameStarted: 'NO_GAME_STARTED',
      strategyResultInvalid: 'STRATEGY_RESULT_INVALID',
      engineFault: 'ENGINE_FAULT',
    });
    const values = Object.values(engine.ENGINE_ERROR_CODES);
    expect(values).toHaveLength(24);
    expect(new Set(values).size).toBe(values.length);
  });
});

describe('regression: stable code values', () => {
  it('locks all 38 generated-deck issue codes (Tasks 7-13)', () => {
    expect(engine.DECK_VALIDATION_CODES).toEqual({
      correctCardNotFound: 'CORRECT_CARD_NOT_FOUND',
      duplicateCorrectAssignment: 'DUPLICATE_CORRECT_ASSIGNMENT',
      duplicateDisplayText: 'DUPLICATE_DISPLAY_TEXT',
      contextualValidityMissing: 'CONTEXTUAL_VALIDITY_MISSING',
      unknownChallenge: 'UNKNOWN_CHALLENGE',
      unknownCard: 'UNKNOWN_CARD',
      missingValidityEntry: 'MISSING_VALIDITY_ENTRY',
      missingValidityEvaluation: 'MISSING_VALIDITY_EVALUATION',
      designatedCardNotValid: 'DESIGNATED_CARD_NOT_VALID',
      multipleValidCardsForChallenge: 'MULTIPLE_VALID_CARDS_FOR_CHALLENGE',
      cardValidForMultipleChallenges: 'CARD_VALID_FOR_MULTIPLE_CHALLENGES',
      duplicateCardId: 'DUPLICATE_CARD_ID',
      duplicateChallengeId: 'DUPLICATE_CHALLENGE_ID',
      duplicateDisplayValue: 'DUPLICATE_DISPLAY_VALUE',
      nonNumericDisplayValue: 'NON_NUMERIC_DISPLAY_VALUE',
      unknownZoneCard: 'UNKNOWN_ZONE_CARD',
      duplicateZoneCard: 'DUPLICATE_ZONE_CARD',
      handWrongSize: 'HAND_WRONG_SIZE',
      handUnknownCard: 'HAND_UNKNOWN_CARD',
      handDuplicateCard: 'HAND_DUPLICATE_CARD',
      handDuplicateDisplayValue: 'HAND_DUPLICATE_DISPLAY_VALUE',
      handCorrectCountOutOfRange: 'HAND_CORRECT_COUNT_OUT_OF_RANGE',
      startingHandInfeasible: 'STARTING_HAND_INFEASIBLE',
      dualHandSharedCard: 'DUAL_HAND_SHARED_CARD',
      dualHandSharedDisplayValue: 'DUAL_HAND_SHARED_DISPLAY_VALUE',
      handValueCollidesWithDeck: 'HAND_VALUE_COLLIDES_WITH_DECK',
      noPenaltyReserve: 'NO_PENALTY_RESERVE',
      dualHandInfeasible: 'DUAL_HAND_INFEASIBLE',
      invalidMode: 'INVALID_MODE',
      invalidCount: 'INVALID_COUNT',
      challengeCountMismatch: 'CHALLENGE_COUNT_MISMATCH',
      cardCountMismatch: 'CARD_COUNT_MISMATCH',
      deckExceedsTarget: 'DECK_EXCEEDS_TARGET',
      deckBelowMinimum: 'DECK_BELOW_MINIMUM',
      insufficientDeckData: 'INSUFFICIENT_DECK_DATA',
      penaltyCardExhausted: 'PENALTY_CARD_EXHAUSTED',
      tooFewUniqueValues: 'TOO_FEW_UNIQUE_VALUES',
      noUnambiguousCorrectCard: 'NO_UNAMBIGUOUS_CORRECT_CARD',
    });
  });

  it('keeps every deck issue code value unique', () => {
    const values = Object.values(engine.DECK_VALIDATION_CODES);
    expect(new Set(values).size).toBe(values.length);
    expect(values).toHaveLength(38);
  });

  it('locks the source-validation codes (Task 6) and the merge codes (Task 2a)', () => {
    expect(engine.VALIDATION_CODES).toEqual({
      invalidType: 'INVALID_TYPE',
      missingField: 'MISSING_FIELD',
      schemaVersionUnsupported: 'SCHEMA_VERSION_UNSUPPORTED',
      malformedIdentifier: 'MALFORMED_IDENTIFIER',
      wrongIdentifierKind: 'WRONG_IDENTIFIER_KIND',
      namespaceMismatch: 'NAMESPACE_MISMATCH',
      duplicateIdentifier: 'DUPLICATE_IDENTIFIER',
    });
    expect(engine.MERGE_ERROR_CODES).toEqual({
      schemaVersionMismatch: 'SCHEMA_VERSION_MISMATCH',
      duplicateIdentifier: 'DUPLICATE_IDENTIFIER',
    });
  });

  it('locks the approved constants', () => {
    expect(engine.CURRENT_SCHEMA_VERSION).toBe('1.0.0');
    expect(engine.SUPPORTED_SCHEMA_VERSIONS).toEqual(['1.0.0']);
    expect(engine.STARTING_HAND_SIZE).toBe(5);
    expect([engine.MIN_CORRECT_IN_STARTING_HAND, engine.MAX_CORRECT_IN_STARTING_HAND]).toEqual([2, 3]);
    expect([engine.COMPETITIVE_HAND_COUNT, engine.MIN_PENALTY_RESERVE]).toEqual([2, 1]);
    expect([engine.SOLITAIRE_CHALLENGE_COUNT, engine.COMPETITIVE_CHALLENGE_COUNT, engine.COMPETITIVE_MIN_CARD_COUNT]).toEqual([5, 9, 14]);
    expect(engine.DEFAULT_MAX_PENALTY_CANDIDATES).toBe(50);
    expect(engine.DECK_MODES).toEqual({ solitaire: 'solitaire', tutor: 'tutor', vsBeepy: 'vsBeepy' });
    expect(engine.GENERATION_DIRECTIONS).toEqual({ factToSubject: 'factToSubject', subjectToFact: 'subjectToFact' });
    expect(engine.SUBJECT_NAMESPACES).toEqual({ math: 'math', clinical: 'clinical' });
    expect(engine.ID_KINDS).toEqual({ subject: 'subject', topic: 'topic', answer: 'answer' });
  });
});
