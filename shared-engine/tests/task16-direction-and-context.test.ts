/**
 * Task 16 - Generation-direction and contextual-correctness tests (Req 7.1, 7.2).
 *
 *   direction-factToSubject / direction-subjectToFact   -> Req 2.1-2.5
 *   contextual-play-and-discard                         -> master spec 4; Req 3.1, 3.6
 *
 * What these tests CAN cover today, and what they cannot:
 *   - Generation-direction CONFIGURATION (Task 4) is fully covered.
 *   - Direction at the CONTRACT level: hand-authored decks for both directions and
 *     both app styles pass the whole validation pipeline. No deck is generated:
 *     the Math and Clinical generators do not exist yet.
 *   - Contextual correctness at the VALIDATOR and DATA level: validity belongs to a
 *     (challenge, card) pair, never to a card on its own.
 *   - The runtime judging of a play or a discard belongs to the game engine, a later
 *     milestone, so it is recorded below as `it.todo` rather than faked.
 *   - M4 G10: the two Math-generator todos are now real tests with the real Math
 *     generator (owner decision M4-9).
 *   - M6 C3: the two Clinical-generator todos are now real tests with the real
 *     Clinical generator and fictitious data (owner decision C-8). The four engine
 *     todos are left unchanged. Task 16 stays unchecked.
 *
 * Clinical fixtures use placeholder text. The only real wording is the two examples
 * printed in master spec section 9.
 */

import { describe, expect, it } from 'vitest';
// Test-only import of the real Math generator (M4 G10).
import { generateMathDeck } from '../../math-cards/src/math-generator.js';
// Test-only imports of the real Clinical generator and a fictitious fixture (M6 C3).
import { generateClinicalDeck } from '../../clinical-cards/src/clinical-generator.js';
import { largeFakeDataset, reviewFileFor } from '../../clinical-cards/tests/fixtures/fake-large-clinical.js';
import {
  DECK_VALIDATION_CODES as C,
  DEFAULT_DIRECTION_BY_APP,
  GENERATION_APPS,
  GENERATION_DIRECTIONS,
  analyzeCandidateAmbiguity,
  defaultDirectionForApp,
  drawPenaltyCards,
  isGenerationDirection,
  oppositeDirection,
  resolveGenerationDirection,
  validateChallengeMapping,
  validateCollectionSource,
  validateDeckSize,
  validateDualStartingHands,
  validateStartingHand,
  validateStructure,
  validateUniqueness,
  validateDeckForPlay,
  type GenerationRequest,
  type SubjectCollection,
} from '../src/index.js';
import {
  COMBOS,
  buildDeck,
  cloneDeck,
  comboName,
  fullMatrix,
  isNumericStyle,
  request,
} from './fixtures.js';

const issue = (code: string, path?: string) =>
  expect.objectContaining(path === undefined ? { code } : { code, path });

// ---------------------------------------------------------------------------
describe('direction configuration (Req 2.1, 2.4, 2.5; master spec 9)', () => {
  it('uses the two stable identifiers', () => {
    expect(GENERATION_DIRECTIONS).toEqual({ factToSubject: 'factToSubject', subjectToFact: 'subjectToFact' });
  });

  it('defaults Math to factToSubject and Clinical to subjectToFact', () => {
    expect(defaultDirectionForApp(GENERATION_APPS.math)).toBe('factToSubject');
    expect(defaultDirectionForApp(GENERATION_APPS.clinical)).toBe('subjectToFact');
    expect(DEFAULT_DIRECTION_BY_APP).toEqual({ math: 'factToSubject', clinical: 'subjectToFact' });
    expect(resolveGenerationDirection({ app: 'math' })).toBe('factToSubject');
    expect(resolveGenerationDirection({ app: 'clinical' })).toBe('subjectToFact');
  });

  it.each(COMBOS)('either app can select either direction: %s -> %s', (app, direction) => {
    expect(resolveGenerationDirection({ app, generationDirection: direction })).toBe(direction);
  });

  it('switches direction both ways and is its own inverse', () => {
    expect(oppositeDirection('factToSubject')).toBe('subjectToFact');
    expect(oppositeDirection('subjectToFact')).toBe('factToSubject');
    for (const direction of ['factToSubject', 'subjectToFact'] as const) {
      expect(oppositeDirection(oppositeDirection(direction))).toBe(direction);
    }
  });

  it('accepts exactly the two directions', () => {
    expect(isGenerationDirection('factToSubject')).toBe(true);
    expect(isGenerationDirection('subjectToFact')).toBe(true);
    for (const bad of ['', 'FactToSubject', 'subject-to-fact', 'sideways', undefined, null, 1, {}]) {
      expect(isGenerationDirection(bad)).toBe(false);
    }
  });

  it('is configuration, not schema: one source collection serves both directions unchanged', () => {
    const source: SubjectCollection = {
      schemaVersion: '1.0.0',
      subjects: [
        {
          id: 'clinical.subject.test-a',
          subject: 'Test Disease A',
          subjectIncorrects: [{ id: 'clinical.answer.test-b', text: 'Test Disease B' }],
          topics: [
            {
              id: 'clinical.topic.test-a.workup',
              topicName: 'Work-up',
              corrects: [{ id: 'clinical.answer.test-a.workup.finding-1', text: 'Test finding 1' }],
              incorrects: [{ id: 'clinical.answer.test-a.workup.finding-2', text: 'Test finding 2' }],
            },
          ],
        },
      ],
    };
    expect(validateCollectionSource(source).ok).toBe(true);
    const requests = (['factToSubject', 'subjectToFact'] as const).map(
      (generationDirection) =>
        ({
          source,
          config: { app: GENERATION_APPS.clinical, generationDirection },
          challengeCount: 5,
          targetCardCount: 12,
        }) satisfies GenerationRequest,
    );
    expect(requests[0]?.source).toBe(requests[1]?.source);
    expect(requests[0]?.config.generationDirection).not.toBe(requests[1]?.config.generationDirection);
  });
});

// ---------------------------------------------------------------------------
describe.each(COMBOS)('direction-factToSubject / direction-subjectToFact, contract level: %s / %s', (style, direction) => {
  const options = { numericAnswers: isNumericStyle(style, direction) };

  it('records the direction on the deck', () => {
    expect(buildDeck({ style, direction, correct: 5, distractors: 6 }).direction).toBe(direction);
  });

  it('a competitive deck (9 challenges, 24 cards) passes the whole validation pipeline', () => {
    const deck = buildDeck({ style, direction, correct: 9, distractors: 15, target: 24 });
    expect(validateChallengeMapping(deck, fullMatrix(deck)).ok).toBe(true);
    expect(validateUniqueness(deck, options).ok).toBe(true);
    expect(validateDeckSize(deck, 'vsBeepy').ok).toBe(true);
    const hands = [
      ['correct-0', 'correct-1', 'correct-2', 'distractor-0', 'distractor-1'],
      ['correct-3', 'correct-4', 'correct-5', 'distractor-2', 'distractor-3'],
    ] as const;
    expect(validateDualStartingHands(deck, [hands[0], hands[1]], options).ok).toBe(true);
  });

  it('a Solitaire/Tutor deck (5 challenges) passes the whole validation pipeline', () => {
    const deck = buildDeck({ style, direction, correct: 5, distractors: 8, target: 13 });
    expect(validateChallengeMapping(deck, fullMatrix(deck)).ok).toBe(true);
    expect(validateUniqueness(deck, options).ok).toBe(true);
    expect(validateDeckSize(deck, 'solitaire').ok).toBe(true);
    expect(validateDeckSize(deck, 'tutor').ok).toBe(true);
    const hand = ['correct-0', 'correct-1', 'distractor-0', 'distractor-1', 'distractor-2'];
    expect(validateStartingHand(deck, hand, options).ok).toBe(true);
  });

  it('every direction and app produces the same deck structure', () => {
    const reference = buildDeck({ style: 'math', direction: 'factToSubject', correct: 5, distractors: 6 });
    const deck = buildDeck({ style, direction, correct: 5, distractors: 6 });
    expect(Object.keys(deck).sort()).toEqual(Object.keys(reference).sort());
    expect(Object.keys(deck.challenges[0] ?? {}).sort()).toEqual(Object.keys(reference.challenges[0] ?? {}).sort());
    expect(Object.keys(deck.answerCards[0] ?? {}).sort()).toEqual(Object.keys(reference.answerCards[0] ?? {}).sort());
  });

  it(`${comboName(style, direction)}: the same validators accept it without any direction-specific schema`, () => {
    const deck = buildDeck({ style, direction, correct: 5, distractors: 6 });
    expect(validateChallengeMapping(deck, fullMatrix(deck)).issues).toEqual([]);
  });
});

describe('direction examples printed in master spec 9', () => {
  const singleChallengeDeck = (prompt: string, answer: string, distractors: string[]) => {
    const deck = buildDeck({ style: 'math', correct: 1, distractors: distractors.length });
    deck.challenges[0]!.promptText = prompt;
    deck.answerCards[0]!.displayValue = answer;
    distractors.forEach((text, j) => (deck.answerCards[1 + j]!.displayValue = text));
    return deck;
  };

  it('Math factToSubject: "3 + 4 = ?" is answered by the card "7"', () => {
    const deck = singleChallengeDeck('3 + 4 = ?', '7', ['6', '8', '9']);
    expect(deck.challenges[0]?.promptText).toBe('3 + 4 = ?');
    expect(validateChallengeMapping(deck, fullMatrix(deck)).ok).toBe(true);
    expect(validateUniqueness(deck, { numericAnswers: true }).ok).toBe(true);
  });

  it('Clinical subjectToFact: "Graves Disease — Work-up" is answered by the card "Positive TSI/TRAb"', () => {
    const deck = singleChallengeDeck('Graves Disease — Work-up', 'Positive TSI/TRAb', ['Test distractor 1', 'Test distractor 2']);
    expect(validateChallengeMapping(deck, fullMatrix(deck)).ok).toBe(true);
    expect(validateUniqueness(deck).ok).toBe(true);
  });
});

describe('direction: generation itself (Math converted in M4 G10; Clinical converted in M6 C3)', () => {
  // M4 G10 (decision M4-9): the two Math todos are now real tests using the real Math
  // generator. This is a TEST-ONLY import from math-cards; the production dependency
  // direction (apps depend on the engine, never the reverse) is unchanged.
  const mathDecks = (direction: 'factToSubject' | 'subjectToFact') =>
    (['solitaire', 'vsBeepy'] as const).flatMap((mode) =>
      (['oneDigit', 'oneAndTwoDigit', 'twoDigit', 'mixed'] as const).flatMap((level) =>
        [1, 2, 3, 4, 5].map((seed) => ({ mode, result: generateMathDeck({ mode, level, generationDirection: direction, seed }) })),
      ),
    );

  it.each(['factToSubject', 'subjectToFact'] as const)('Math generator: %s produces a valid deck', (direction) => {
    for (const { mode, result } of mathDecks(direction)) {
      expect(result.ok).toBe(true);
      if (!result.ok) continue;
      const { deck, contextualValidity, numericAnswers } = result;
      expect(deck.direction).toBe(direction);
      expect(numericAnswers).toBe(direction === 'factToSubject');
      // The whole M2 pipeline, stage by stage, then the M3 gate.
      expect(validateChallengeMapping(deck, contextualValidity).ok).toBe(true);
      expect(validateUniqueness(deck, { numericAnswers }).ok).toBe(true);
      expect(validateDeckSize(deck, mode).ok).toBe(true);
      expect(validateDeckForPlay(deck, mode, contextualValidity, { numericAnswers })).toEqual([]);
    }
  });

  // M6 C3 (decision C-8): the two Clinical todos are now real tests using the real
  // Clinical generator and a fictitious, fully reviewed fixture. TEST-ONLY imports from
  // clinical-cards; the production dependency direction is unchanged.
  const clinicalData = largeFakeDataset({ diseases: 16, alternatives: 10 });
  const clinicalReview = reviewFileFor(clinicalData, { topics: 'full', alternatives: true });
  const clinicalDecks = (direction: 'factToSubject' | 'subjectToFact') =>
    (['solitaire', 'vsBeepy'] as const).flatMap((mode) =>
      [1, 2, 3, 4, 5].map((seed) => ({
        mode,
        result: generateClinicalDeck({
          source: clinicalData,
          config: { app: 'clinical', generationDirection: direction },
          mode,
          challengeCount: mode === 'solitaire' ? 5 : 9,
          targetCardCount: mode === 'solitaire' ? 15 : 24,
          seed,
          review: clinicalReview,
        }),
      })),
    );

  it.each(['subjectToFact', 'factToSubject'] as const)('Clinical generator: %s produces a valid deck', (direction) => {
    for (const { mode, result } of clinicalDecks(direction)) {
      expect(result.ok).toBe(true);
      if (!result.ok) continue;
      const { deck, contextualValidity, numericAnswers } = result;
      expect(deck.direction).toBe(direction);
      expect(numericAnswers).toBe(false);
      expect(validateChallengeMapping(deck, contextualValidity).ok).toBe(true);
      expect(validateUniqueness(deck, { numericAnswers }).ok).toBe(true);
      expect(validateDeckSize(deck, mode).ok).toBe(true);
      expect(validateDeckForPlay(deck, mode, contextualValidity, { numericAnswers })).toEqual([]);
    }
  });
});

// ---------------------------------------------------------------------------
describe.each(COMBOS)('contextual-play-and-discard, data and validator level (Req 3.1, 3.6): %s / %s', (style, direction) => {
  const deck = buildDeck({ style, direction, correct: 5, distractors: 6 });

  it('validity belongs to a (challenge, card) pair: a card valid for one challenge is not valid for the others', () => {
    const matrix = fullMatrix(deck);
    expect(matrix['challenge-1']?.['correct-1']).toBe(true);
    for (const other of ['challenge-0', 'challenge-2', 'challenge-3', 'challenge-4']) {
      expect(matrix[other]?.['correct-1']).toBe(false);
    }
  });

  it('designating a card for a challenge it is not valid for is rejected', () => {
    const clone = cloneDeck(deck);
    clone.challenges[1]!.correctAnswerCardId = 'distractor-0';
    const result = validateChallengeMapping(clone, fullMatrix(deck));
    expect(result.issues).toContainEqual(issue(C.designatedCardNotValid, 'challenges[1].correctAnswerCardId'));
  });

  it('candidate analysis keeps a card correct only for its own challenge, and distractors for none', () => {
    const challengeIds = deck.challenges.map((c) => c.id);
    const result = analyzeCandidateAmbiguity(challengeIds, deck.answerCards.map((c) => c.id), fullMatrix(deck));
    if (!result.ok) throw new Error('analysis should succeed');
    expect(result.analysis.unambiguousByChallenge['challenge-1']).toEqual(['correct-1']);
    expect(result.analysis.unambiguousByChallenge['challenge-0']).not.toContain('correct-1');
    expect(result.analysis.distractorCandidates).toEqual(Array.from({ length: 6 }, (_, j) => `distractor-${j}`));
  });
});

describe('contextual correctness in source data (Req 3.1)', () => {
  const entry = (id: string, text: string) => ({ id, text });
  const record = (name: string, corrects: ReturnType<typeof entry>[], incorrects: ReturnType<typeof entry>[]) => ({
    id: `clinical.subject.${name}`,
    subject: `Test Disease ${name.toUpperCase()}`,
    subjectIncorrects: [],
    topics: [{ id: `clinical.topic.${name}.workup`, topicName: 'Work-up', corrects, incorrects }],
  });

  it('allows one fact to be correct in one context and incorrect in another (no universal labels)', () => {
    const collection: SubjectCollection = {
      schemaVersion: '1.0.0',
      subjects: [
        record('a', [entry('clinical.answer.a.workup.shared', 'Shared test finding')], []),
        record('b', [], [entry('clinical.answer.b.workup.shared', 'Shared test finding')]),
      ],
    };
    expect(validateCollectionSource(collection).ok).toBe(true);
  });

  it('treats an explanation as optional, but a present one must be text', () => {
    const base = (explanation?: unknown) => ({
      schemaVersion: '1.0.0',
      subjects: [
        {
          id: 'clinical.subject.a',
          subject: 'Test Disease A',
          subjectIncorrects: [],
          topics: [
            {
              id: 'clinical.topic.a.workup',
              topicName: 'Work-up',
              corrects: [{ id: 'clinical.answer.a.workup.f1', text: 'Test finding 1', ...(explanation === undefined ? {} : { explanation }) }],
              incorrects: [],
            },
          ],
        },
      ],
    });
    expect(validateStructure(base()).ok).toBe(true);
    expect(validateStructure(base('Test explanation')).ok).toBe(true);
    expect(validateStructure(base(42)).issues).toContainEqual(
      issue('INVALID_TYPE', 'subjects[0].topics[0].corrects[0].explanation'),
    );
  });
});

describe('contextual explanations in the generated deck (Req 3.6)', () => {
  it('are bound to a challenge id, optional, and never part of the card face', () => {
    const deck = cloneDeck(buildDeck({ style: 'clinical', correct: 5, distractors: 6 }));
    deck.answerCards[0]!.explanationByChallengeId = { 'challenge-0': 'Test explanation for challenge 0' };
    expect(validateChallengeMapping(deck, fullMatrix(deck)).ok).toBe(true);
    expect(deck.answerCards[0]?.explanationByChallengeId).toEqual({ 'challenge-0': 'Test explanation for challenge 0' });
    expect(deck.answerCards[0]?.explanationByChallengeId?.['challenge-1']).toBeUndefined();
    expect(deck.answerCards[1]?.explanationByChallengeId).toBeUndefined();
    expect(deck.answerCards[0]?.displayValue).not.toContain('Test explanation');
  });

  it('are never invented or carried onto a fallback penalty card', () => {
    const result = drawPenaltyCards(
      { drawPile: [], cardsOutsideDrawPile: [] },
      [request('student')],
      {
        activeChallenges: [],
        fallback: {
          candidates: () => [
            {
              card: { id: 'reserve-1', displayValue: 'Reviewed reserve text', explanationByChallengeId: { 'challenge-0': 'unrelated' } },
              plausible: true,
              validForChallenges: {},
            },
          ],
        },
      },
    );
    if (!result.ok) throw new Error('the reserve card should be supplied');
    expect(Object.keys(result.cards[0] ?? {}).sort()).toEqual(['displayValue', 'id']);
  });
});

describe('contextual-play-and-discard: runtime judging (needs the game engine, a later milestone)', () => {
  it.todo('a play is valid only for the designated card on an unsolved challenge (depends on the game engine milestone; not implemented)');
  it.todo('a discard is valid only for a card that is valid for no remaining unsolved challenge (depends on the game engine milestone; not implemented)');
  it.todo('a card that is correct for one challenge is judged correctly when played onto a different challenge (depends on the game engine milestone; not implemented)');
  it.todo('an invalid play or discard returns the card to the hand and draws a penalty card (depends on the game engine milestone; not implemented)');
});
