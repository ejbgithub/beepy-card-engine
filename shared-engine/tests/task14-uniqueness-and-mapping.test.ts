/**
 * Task 14 - Uniqueness and challenge-mapping tests (Req 7.1, 7.2; master spec 16).
 *
 *   uniqueness-across-zones            -> Req 3.4
 *   one-correct-card-per-challenge     -> Req 3.2
 *   ambiguous-answer-rejected          -> Req 3.3, 6.2
 *   duplicate-display-text-rejected    -> Req 3.5
 *
 * Every deck-based test runs for all four (app style, generation direction)
 * combinations. Clinical-style fixtures use placeholder text only.
 */

import { describe, expect, it } from 'vitest';
import {
  DECK_VALIDATION_CODES as C,
  analyzeCandidateAmbiguity,
  countUniqueValues,
  normalizeDisplayText,
  validateChallengeMapping,
  validateUniqueness,
  type ContextualValidityMap,
} from '../src/index.js';
import {
  COMBOS,
  buildDeck,
  cloneDeck,
  cloneMatrix,
  distractorText,
  fullMatrix,
  isNumericStyle,
  seededRandom,
  shuffle,
  type MutableDeck,
} from './fixtures.js';

const issue = (code: string, path?: string) =>
  expect.objectContaining(path === undefined ? { code } : { code, path });

/** Hands, draw pile, played, and discard for a 24-card deck. */
function zonesFor(deck: MutableDeck): Record<string, string[]> {
  const ids = deck.answerCards.map((c) => c.id);
  return {
    'hand:player': ids.slice(0, 5),
    'hand:beepy': ids.slice(5, 10),
    drawPile: ids.slice(10),
    played: [],
    discard: [],
  };
}

// ---------------------------------------------------------------------------
describe.each(COMBOS)('uniqueness-across-zones (Req 3.4): %s / %s', (style, direction) => {
  const deck = buildDeck({ style, direction, correct: 9, distractors: 15 });
  const numericAnswers = isNumericStyle(style, direction);

  it('accepts a deck partitioned across hands, draw pile, played and discard', () => {
    expect(validateUniqueness(deck, { zones: zonesFor(deck), numericAnswers }).ok).toBe(true);
  });

  it('flags a card that sits in two zones, at the repeat and citing the first place', () => {
    const zones = zonesFor(deck);
    zones.discard = ['correct-0'];
    const result = validateUniqueness(deck, { zones, numericAnswers });
    expect(result.ok).toBe(false);
    expect(result.issues).toContainEqual(issue(C.duplicateZoneCard, 'zones["discard"][0]'));
    expect(result.issues[0]?.message).toContain('zones["hand:player"][0]');
  });

  it('flags the same card listed twice inside one zone', () => {
    const zones = zonesFor(deck);
    zones.played = ['distractor-14', 'distractor-14'];
    const result = validateUniqueness(deck, { zones, numericAnswers });
    expect(result.issues).toContainEqual(issue(C.duplicateZoneCard, 'zones["played"][1]'));
  });

  it('flags two different cards that show the same value in different zones', () => {
    const clone = cloneDeck(deck);
    const first = clone.answerCards.find((c) => c.id === 'distractor-1');
    const second = clone.answerCards.find((c) => c.id === 'distractor-14');
    if (first === undefined || second === undefined) throw new Error('fixture cards missing');
    second.displayValue = first.displayValue;
    const result = validateUniqueness(clone, {
      zones: { 'hand:player': ['distractor-1'], discard: ['distractor-14'] },
      numericAnswers,
    });
    expect(result.issues).toContainEqual(issue(C.duplicateDisplayValue, 'zones["discard"][0]'));
  });

  it('flags a zone card that is not in the deck', () => {
    const zones = zonesFor(deck);
    zones.played = ['no-such-card'];
    expect(validateUniqueness(deck, { zones, numericAnswers }).issues).toContainEqual(
      issue(C.unknownZoneCard, 'zones["played"][0]'),
    );
  });

  it('accepts a partial snapshot (cards minted later are checked by the penalty draw)', () => {
    expect(validateUniqueness(deck, { zones: { drawPile: ['distractor-3'] }, numericAnswers }).ok).toBe(true);
    expect(validateUniqueness(deck, { zones: {}, numericAnswers }).ok).toBe(true);
  });

  it('flags duplicate card ids and duplicate challenge ids in the deck itself', () => {
    const clone = cloneDeck(deck);
    clone.answerCards[12]!.id = 'correct-0';
    clone.challenges[3]!.id = 'challenge-0';
    const result = validateUniqueness(clone, { numericAnswers });
    expect(result.issues).toContainEqual(issue(C.duplicateCardId, 'answerCards[12].id'));
    expect(result.issues).toContainEqual(issue(C.duplicateChallengeId, 'challenges[3].id'));
  });
});

describe('uniqueness-across-zones: numeric answers (Math)', () => {
  const deck = buildDeck({ style: 'math', direction: 'factToSubject', correct: 9, distractors: 15 });
  const clone = cloneDeck(deck);
  clone.answerCards.find((c) => c.id === 'distractor-3')!.displayValue = '010'; // equals correct-0 ("10") numerically
  const zones = { a: ['correct-0'], b: ['distractor-3'] };

  it('treats "010" and "10" as the same value in numeric mode', () => {
    expect(validateUniqueness(clone, { zones, numericAnswers: true }).issues).toContainEqual(
      issue(C.duplicateDisplayValue, 'zones["b"][0]'),
    );
  });

  it('keeps them distinct in text mode', () => {
    expect(validateUniqueness(clone, { zones }).ok).toBe(true);
  });

  it('reports a non-numeric value in numeric mode without calling it a duplicate', () => {
    const bad = cloneDeck(deck);
    bad.answerCards[11]!.displayValue = 'seven';
    const result = validateUniqueness(bad, { numericAnswers: true });
    expect(result.issues).toContainEqual(issue(C.nonNumericDisplayValue, 'answerCards[11].displayValue'));
    expect(result.issues.some((i) => i.code === C.duplicateDisplayValue)).toBe(false);
  });
});

describe('uniqueness-across-zones: property tests', () => {
  it('accepts every random partition of a valid deck and always catches one injected duplicate', () => {
    const random = seededRandom(14);
    let runs = 0;
    for (const [style, direction] of COMBOS) {
      const deck = buildDeck({ style, direction, correct: 9, distractors: 15 });
      const numericAnswers = isNumericStyle(style, direction);
      for (let run = 0; run < 100; run += 1) {
        const ids = shuffle(deck.answerCards.map((c) => c.id), random);
        const cutA = 1 + Math.floor(random() * 22);
        const cutB = cutA + Math.floor(random() * (24 - cutA));
        const cutC = cutB + Math.floor(random() * (24 - cutB));
        const zones: Record<string, string[]> = {
          a: ids.slice(0, cutA),
          b: ids.slice(cutA, cutB),
          c: ids.slice(cutB, cutC),
          d: ids.slice(cutC),
        };
        expect(validateUniqueness(deck, { zones, numericAnswers }).ok).toBe(true);

        const victim = ids[Math.floor(random() * ids.length)] as string;
        const keys = Object.keys(zones);
        const target = keys[Math.floor(random() * keys.length)] as string;
        const injected = { ...zones, [target]: [...(zones[target] as string[]), victim] };
        const result = validateUniqueness(deck, { zones: injected, numericAnswers });
        expect(result.ok).toBe(false);
        expect(result.issues.some((i) => i.code === C.duplicateZoneCard)).toBe(true);
        runs += 1;
      }
    }
    expect(runs).toBe(400);
  });
});

// ---------------------------------------------------------------------------
describe.each(COMBOS)('one-correct-card-per-challenge (Req 3.2): %s / %s', (style, direction) => {
  const deck = buildDeck({ style, direction, correct: 5, distractors: 6 });

  it.each([5, 9])('accepts a %i-challenge deck where every challenge has exactly one valid card', (n) => {
    const sized = buildDeck({ style, direction, correct: n, distractors: 15 });
    expect(validateChallengeMapping(sized, fullMatrix(sized)).ok).toBe(true);
  });

  it('rejects a designated card that is not in the deck', () => {
    const clone = cloneDeck(deck);
    clone.challenges[2]!.correctAnswerCardId = 'no-such-card';
    const result = validateChallengeMapping(clone, fullMatrix(deck));
    expect(result.issues).toContainEqual(issue(C.correctCardNotFound, 'challenges[2].correctAnswerCardId'));
  });

  it('rejects an empty designation', () => {
    const clone = cloneDeck(deck);
    clone.challenges[0]!.correctAnswerCardId = '';
    expect(validateChallengeMapping(clone, fullMatrix(deck)).issues).toContainEqual(
      issue(C.correctCardNotFound, 'challenges[0].correctAnswerCardId'),
    );
  });

  it('rejects one card designated for two challenges, at the repeat only', () => {
    const clone = cloneDeck(deck);
    clone.challenges[3]!.correctAnswerCardId = 'correct-0';
    const result = validateChallengeMapping(clone, fullMatrix(deck));
    expect(result.issues).toContainEqual(issue(C.duplicateCorrectAssignment, 'challenges[3].correctAnswerCardId'));
    expect(result.issues).not.toContainEqual(issue(C.duplicateCorrectAssignment, 'challenges[0].correctAnswerCardId'));
  });

  it('rejects a challenge whose designated card is evaluated as not valid', () => {
    const matrix = fullMatrix(deck);
    matrix['challenge-1']!['correct-1'] = false;
    const result = validateChallengeMapping(deck, matrix);
    expect(result.issues).toContainEqual(issue(C.designatedCardNotValid, 'challenges[1].correctAnswerCardId'));
    expect(result.issues.some((i) => i.code === C.multipleValidCardsForChallenge)).toBe(false);
  });

  it('reports only DESIGNATED_CARD_NOT_VALID when exactly one other card is valid', () => {
    const matrix = fullMatrix(deck);
    matrix['challenge-1']!['correct-1'] = false;
    matrix['challenge-1']!['distractor-0'] = true;
    const result = validateChallengeMapping(deck, matrix);
    expect(result.issues).toContainEqual(issue(C.designatedCardNotValid));
    expect(result.issues.some((i) => i.code === C.multipleValidCardsForChallenge)).toBe(false);
  });

  it('reports MULTIPLE_VALID_CARDS_FOR_CHALLENGE only when two distinct cards are valid', () => {
    const matrix = fullMatrix(deck);
    matrix['challenge-1']!['distractor-0'] = true;
    const result = validateChallengeMapping(deck, matrix);
    expect(result.issues).toContainEqual(issue(C.multipleValidCardsForChallenge, 'challenges[1]'));
    expect(result.issues.some((i) => i.code === C.designatedCardNotValid)).toBe(false);
  });

  it.each([
    ['undefined', undefined],
    ['null', null],
    ['an empty object', {}],
  ])('never reports success without a complete evaluation (%s)', (_label, matrix) => {
    const result = validateChallengeMapping(deck, matrix as unknown as ContextualValidityMap);
    expect(result.ok).toBe(false);
    expect(result.issues.length).toBeGreaterThan(0);
  });

  it('mutation: removing any single evaluation is reported at exactly that cell', () => {
    const base = fullMatrix(deck);
    let cells = 0;
    for (const challenge of deck.challenges) {
      for (const cardEntry of deck.answerCards) {
        const matrix = cloneMatrix(base);
        delete matrix[challenge.id]![cardEntry.id];
        const result = validateChallengeMapping(deck, matrix);
        expect(result.ok).toBe(false);
        expect(result.issues).toContainEqual(
          issue(C.missingValidityEvaluation, `contextualValidity["${challenge.id}"]["${cardEntry.id}"]`),
        );
        expect(result.issues.filter((i) => i.code === C.missingValidityEvaluation)).toHaveLength(1);
        cells += 1;
      }
    }
    expect(cells).toBe(55);
  });

  it('mutation: flipping any single evaluation is always rejected', () => {
    const base = fullMatrix(deck);
    let cells = 0;
    deck.challenges.forEach((challenge, index) => {
      for (const cardEntry of deck.answerCards) {
        const matrix = cloneMatrix(base);
        matrix[challenge.id]![cardEntry.id] = !matrix[challenge.id]![cardEntry.id];
        const result = validateChallengeMapping(deck, matrix);
        expect(result.ok).toBe(false);
        expect(result.issues).toContainEqual(
          cardEntry.id === challenge.correctAnswerCardId
            ? issue(C.designatedCardNotValid, `challenges[${index}].correctAnswerCardId`)
            : issue(C.multipleValidCardsForChallenge, `challenges[${index}]`),
        );
        cells += 1;
      }
    });
    expect(cells).toBe(55);
  });
});

// ---------------------------------------------------------------------------
describe.each(COMBOS)('ambiguous-answer-rejected (Req 3.3, 6.2): %s / %s', (style, direction) => {
  const base = buildDeck({ style, direction, correct: 5, distractors: 6 });
  const ambiguousText = distractorText(style, direction, 90);

  /** The base deck plus one extra card that is a valid answer to challenges 0 and 1. */
  function withAmbiguousCard(): { deck: MutableDeck; matrix: ReturnType<typeof fullMatrix> } {
    const deck = cloneDeck(base);
    deck.answerCards.push({ id: 'ambiguous-card', displayValue: ambiguousText });
    deck.meta = { targetCardCount: 12, actualCardCount: 12 };
    const matrix = fullMatrix(deck);
    matrix['challenge-0']!['ambiguous-card'] = true;
    matrix['challenge-1']!['ambiguous-card'] = true;
    return { deck, matrix };
  }

  it('rejects a card that is a valid answer to two active challenges, at the repeat challenge', () => {
    const matrix = fullMatrix(base);
    matrix['challenge-3']!['correct-1'] = true; // correct-1 is already valid for challenge-1
    const result = validateChallengeMapping(base, matrix);
    expect(result.ok).toBe(false);
    expect(result.issues).toContainEqual(issue(C.cardValidForMultipleChallenges, 'challenges[3]'));
  });

  it('rejects an ambiguous card that is not designated for anything', () => {
    const { deck, matrix } = withAmbiguousCard();
    const result = validateChallengeMapping(deck, matrix);
    expect(result.ok).toBe(false);
    expect(result.issues).toContainEqual(issue(C.cardValidForMultipleChallenges, 'challenges[1]'));
    expect(result.issues).toContainEqual(issue(C.multipleValidCardsForChallenge, 'challenges[0]'));
  });

  it('accepts the deck once the generator excludes the ambiguous card', () => {
    const { deck, matrix } = withAmbiguousCard();
    const excluded = cloneDeck(deck);
    excluded.answerCards = excluded.answerCards.filter((c) => c.id !== 'ambiguous-card');
    excluded.meta = { targetCardCount: 11, actualCardCount: 11 };
    for (const row of Object.values(matrix)) delete row['ambiguous-card'];
    expect(validateChallengeMapping(excluded, matrix).ok).toBe(true);
  });

  it('candidate analysis sorts the ambiguous card out, and the resulting deck passes validation', () => {
    const { deck, matrix } = withAmbiguousCard();
    const challengeIds = deck.challenges.map((c) => c.id);
    const result = analyzeCandidateAmbiguity(challengeIds, deck.answerCards.map((c) => c.id), matrix);
    if (!result.ok) throw new Error('analysis should succeed');
    expect(result.analysis.ambiguousCards).toEqual(['ambiguous-card']);
    expect(Object.values(result.analysis.unambiguousByChallenge).flat()).not.toContain('ambiguous-card');

    const designated = challengeIds.map((id) => result.analysis.unambiguousByChallenge[id]![0] as string);
    const keep = new Set([...designated, ...result.analysis.distractorCandidates]);
    const built = cloneDeck(deck);
    built.answerCards = built.answerCards.filter((c) => keep.has(c.id));
    built.challenges.forEach((c, i) => (c.correctAnswerCardId = designated[i] as string));
    built.meta = { targetCardCount: built.answerCards.length, actualCardCount: built.answerCards.length };
    const restricted = Object.fromEntries(
      challengeIds.map((id) => [id, Object.fromEntries(built.answerCards.map((c) => [c.id, matrix[id]![c.id] as boolean]))]),
    );
    expect(validateChallengeMapping(built, restricted).ok).toBe(true);
  });

  it('reports NO_UNAMBIGUOUS_CORRECT_CARD when a challenge has only ambiguous candidates', () => {
    const { deck, matrix } = withAmbiguousCard();
    matrix['challenge-1']!['correct-1'] = false; // the only valid candidate left for challenge-1 is the ambiguous one
    const result = analyzeCandidateAmbiguity(
      deck.challenges.map((c) => c.id),
      deck.answerCards.map((c) => c.id),
      matrix,
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues).toContainEqual(issue(C.noUnambiguousCorrectCard, 'challengeIds[1]'));
    expect(result.issues[0]?.message).toContain('also valid for another challenge');
  });
});

// ---------------------------------------------------------------------------
describe.each(COMBOS)('duplicate-display-text-rejected (Req 3.5): %s / %s', (style, direction) => {
  const deck = buildDeck({ style, direction, correct: 5, distractors: 6 });
  const matrix = fullMatrix(deck);

  it('accepts a deck whose display texts are all distinct', () => {
    expect(validateChallengeMapping(deck, matrix).ok).toBe(true);
  });

  it('rejects an exact duplicate at the repeat only', () => {
    const clone = cloneDeck(deck);
    clone.answerCards[7]!.displayValue = clone.answerCards[2]!.displayValue;
    const result = validateChallengeMapping(clone, matrix);
    const duplicates = result.issues.filter((i) => i.code === C.duplicateDisplayText);
    expect(duplicates).toHaveLength(1);
    expect(duplicates[0]?.path).toBe('answerCards[7].displayValue');
  });

  it('rejects case and whitespace variants', () => {
    const clone = cloneDeck(deck);
    clone.answerCards[8]!.displayValue = `  ${clone.answerCards[3]!.displayValue.toUpperCase()}  `;
    expect(validateChallengeMapping(clone, matrix).issues).toContainEqual(
      issue(C.duplicateDisplayText, 'answerCards[8].displayValue'),
    );
  });

  it('reports every repeat of a text, not just the first', () => {
    const clone = cloneDeck(deck);
    const shared = clone.answerCards[0]!.displayValue;
    clone.answerCards[4]!.displayValue = shared;
    clone.answerCards[9]!.displayValue = shared;
    const duplicates = validateChallengeMapping(clone, matrix).issues.filter((i) => i.code === C.duplicateDisplayText);
    expect(duplicates.map((i) => i.path)).toEqual(['answerCards[4].displayValue', 'answerCards[9].displayValue']);
  });
});

describe('duplicate-display-text-rejected: normalization details', () => {
  it('treats a composed and a decomposed accent as the same text', () => {
    expect(normalizeDisplayText('\u00e9')).toBe(normalizeDisplayText('e\u0301'));
    expect(countUniqueValues(['\u00e9', 'e\u0301']).unique).toBe(1);
  });

  it('collapses internal whitespace and ignores case', () => {
    expect(normalizeDisplayText('  A   b\tC ')).toBe('a b c');
  });

  it('keeps "7" and "07" apart as text (Task 7) while numeric uniqueness (Task 8) joins them', () => {
    const deck = buildDeck({ style: 'math', direction: 'factToSubject', correct: 5, distractors: 6 });
    const clone = cloneDeck(deck);
    clone.answerCards[9]!.displayValue = `0${clone.answerCards[0]!.displayValue}`; // "010" vs "10"
    expect(validateChallengeMapping(clone, fullMatrix(clone)).ok).toBe(true);
    expect(validateUniqueness(clone, { numericAnswers: true }).issues).toContainEqual(
      issue(C.duplicateDisplayValue, 'answerCards[9].displayValue'),
    );
  });
});
