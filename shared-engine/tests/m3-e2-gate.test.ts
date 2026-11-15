/**
 * M3 E2 - initialization gate (requirement 1): modes and deck validation.
 */

import { describe, expect, it } from 'vitest';
import { checkDeckShape, resolveMode, validateDeckForPlay } from '../src/game/deck-gate.js';
import { cloneDeck, cloneMatrix, deepFreeze } from './fixtures.js';
import { COMBOS, sample } from './m3-helpers.js';
import type { EngineMode } from '../src/game/types.js';

const MODES: EngineMode[] = ['solitaire', 'vsBeepy'];

const codes = (issues: readonly { code: string }[]): string[] => issues.map((issue) => issue.code);

describe('resolveMode', () => {
  it.each(MODES)('accepts %s', (mode) => {
    expect(resolveMode(mode)).toBe(mode);
  });

  it.each(['tutor', 'vsPlayer'])('rejects %s with MODE_NOT_IMPLEMENTED and never runs it as Solitaire', (mode) => {
    const result = resolveMode(mode);
    expect(result).toMatchObject({ ok: false, error: { code: 'MODE_NOT_IMPLEMENTED' } });
  });

  it.each([undefined, null, '', 'Solitaire', 'competitive', 3, {}, []])('rejects %j with INVALID_MODE', (mode) => {
    expect(resolveMode(mode)).toMatchObject({ ok: false, error: { code: 'INVALID_MODE' } });
  });
});

describe.each(MODES)('validateDeckForPlay: %s', (mode) => {
  describe.each(COMBOS)('%s / %s', (style, direction) => {
    const make = () => sample(mode, style, direction);

    it('accepts a valid deck with no issues', () => {
      const s = make();
      expect(validateDeckForPlay(s.deck, mode, s.matrix, s.options)).toEqual([]);
    });

    it('does not modify its inputs', () => {
      const s = make();
      const deck = deepFreeze(cloneDeck(s.deck));
      const matrix = deepFreeze(cloneMatrix(s.matrix));
      expect(validateDeckForPlay(deck, mode, matrix, s.options)).toEqual([]);
    });

    it('reports a missing, null, or non-object matrix as CONTEXTUAL_VALIDITY_MISSING', () => {
      const s = make();
      for (const matrix of [undefined, null, 'x', 5, []]) {
        const issues = validateDeckForPlay(s.deck, mode, matrix, s.options);
        expect(codes(issues)).toContain('CONTEXTUAL_VALIDITY_MISSING');
      }
    });

    it('reports contextual ambiguity: a card valid for two challenges', () => {
      const s = make();
      const matrix = cloneMatrix(s.matrix);
      matrix['challenge-0']!['correct-1'] = true;
      const issues = validateDeckForPlay(s.deck, mode, matrix, s.options);
      expect(codes(issues)).toContain('CARD_VALID_FOR_MULTIPLE_CHALLENGES');
      expect(issues.some((issue) => issue.stage === 'mapping')).toBe(true);
    });

    it('reports a designated card evaluated as not valid', () => {
      const s = make();
      const matrix = cloneMatrix(s.matrix);
      matrix['challenge-2']!['correct-2'] = false;
      expect(codes(validateDeckForPlay(s.deck, mode, matrix, s.options))).toContain('DESIGNATED_CARD_NOT_VALID');
    });

    it('reports a card that was never evaluated against a challenge', () => {
      const s = make();
      const matrix = cloneMatrix(s.matrix);
      delete matrix['challenge-1']!['distractor-0'];
      expect(codes(validateDeckForPlay(s.deck, mode, matrix, s.options))).toContain('MISSING_VALIDITY_EVALUATION');
    });

    it('reports a duplicate display value (mapping and uniqueness stages)', () => {
      const s = make();
      const deck = cloneDeck(s.deck);
      deck.answerCards[deck.answerCards.length - 1]!.displayValue = deck.answerCards[0]!.displayValue;
      const issues = validateDeckForPlay(deck, mode, s.matrix, s.options);
      expect(codes(issues)).toContain('DUPLICATE_DISPLAY_TEXT');
      expect(codes(issues)).toContain('DUPLICATE_DISPLAY_VALUE');
    });

    it('reports a duplicate card id', () => {
      const s = make();
      const deck = cloneDeck(s.deck);
      deck.answerCards[deck.answerCards.length - 1]!.id = 'correct-0';
      expect(codes(validateDeckForPlay(deck, mode, s.matrix, s.options))).toContain('DUPLICATE_CARD_ID');
    });

    it('reports a deck larger than its target (the target is a ceiling)', () => {
      const s = make();
      const deck = cloneDeck(s.deck);
      deck.meta.targetCardCount = deck.answerCards.length - 1;
      expect(codes(validateDeckForPlay(deck, mode, s.matrix, s.options))).toContain('DECK_EXCEEDS_TARGET');
    });

    it('accepts a smaller validated deck than the target', () => {
      const s = make();
      const deck = cloneDeck(s.deck);
      deck.meta.targetCardCount = deck.answerCards.length + 10;
      expect(validateDeckForPlay(deck, mode, s.matrix, s.options)).toEqual([]);
    });

    it('reports a wrong challenge count for the mode', () => {
      const other = sample(mode === 'solitaire' ? 'vsBeepy' : 'solitaire', style, direction);
      const issues = validateDeckForPlay(other.deck, mode, other.matrix, other.options);
      expect(codes(issues)).toContain('CHALLENGE_COUNT_MISMATCH');
    });

    it('reports count-field mismatches', () => {
      const s = make();
      const deck = cloneDeck(s.deck);
      deck.meta.actualCardCount += 1;
      expect(codes(validateDeckForPlay(deck, mode, s.matrix, s.options))).toContain('CARD_COUNT_MISMATCH');
    });
  });

  it('reports hand infeasibility when there are too few distractors', () => {
    const s = sample(mode, 'math', 'factToSubject', { distractors: mode === 'vsBeepy' ? 4 : 1 });
    const issues = validateDeckForPlay(s.deck, mode, s.matrix, s.options);
    expect(issues.some((issue) => issue.stage === 'feasibility')).toBe(true);
    expect(issues.some((issue) => issue.stage === 'deckSize')).toBe(true);
  });

  it('applies the competitive 14-card minimum', () => {
    if (mode !== 'vsBeepy') return;
    const s = sample('vsBeepy', 'math', 'factToSubject', { distractors: 4 });
    expect(codes(validateDeckForPlay(s.deck, mode, s.matrix, s.options))).toContain('DECK_BELOW_MINIMUM');
    const ok = sample('vsBeepy', 'math', 'factToSubject', { distractors: 5 });
    expect(validateDeckForPlay(ok.deck, mode, ok.matrix, ok.options)).toEqual([]);
  });

  it('reports non-numeric values when numeric comparison is on', () => {
    const s = sample(mode, 'math', 'factToSubject');
    const deck = cloneDeck(s.deck);
    deck.answerCards[deck.answerCards.length - 1]!.displayValue = 'seven';
    expect(codes(validateDeckForPlay(deck, mode, s.matrix, { numericAnswers: true }))).toContain(
      'NON_NUMERIC_DISPLAY_VALUE',
    );
  });

  it('treats numerically equal values as duplicates in numeric mode only', () => {
    const s = sample(mode, 'math', 'factToSubject');
    const deck = cloneDeck(s.deck);
    deck.answerCards[deck.answerCards.length - 1]!.displayValue = '010';
    deck.answerCards[0]!.displayValue = '10';
    expect(codes(validateDeckForPlay(deck, mode, s.matrix, { numericAnswers: true }))).toContain(
      'DUPLICATE_DISPLAY_VALUE',
    );
  });

  it('reports every failing stage together, not just the first', () => {
    const s = sample(mode, 'math', 'factToSubject');
    const deck = cloneDeck(s.deck);
    deck.answerCards[deck.answerCards.length - 1]!.id = 'correct-0';
    deck.meta.targetCardCount = 3;
    const matrix = cloneMatrix(s.matrix);
    matrix['challenge-0']!['correct-1'] = true;
    const stages = new Set(validateDeckForPlay(deck, mode, matrix, s.options).map((issue) => issue.stage));
    expect(stages).toContain('mapping');
    expect(stages).toContain('uniqueness');
    expect(stages).toContain('deckSize');
  });

  it('refuses a correctly typed but invalid deck (an unresolved ambiguity)', () => {
    const s = sample(mode);
    const matrix = cloneMatrix(s.matrix);
    matrix['challenge-1']!['distractor-0'] = true; // second valid answer for challenge-1
    expect(validateDeckForPlay(s.deck, mode, matrix, s.options)).not.toEqual([]);
  });
});

describe('untyped and malformed input never throws', () => {
  const bad: unknown[] = [
    undefined,
    null,
    5,
    'deck',
    [],
    {},
    { direction: 'factToSubject' },
    { direction: 'nope', challenges: [], answerCards: [], meta: { targetCardCount: 1, actualCardCount: 0 } },
    { direction: 'factToSubject', challenges: [null], answerCards: [5], meta: {} },
    { direction: 'factToSubject', challenges: [{ id: '' }], answerCards: [{ id: 'a' }], meta: { targetCardCount: 'x', actualCardCount: 1 } },
  ];

  it.each(bad.map((value, index) => [index, value] as const))('input #%i gives shape issues, not an exception', (_i, value) => {
    for (const mode of MODES) {
      expect(() => validateDeckForPlay(value, mode, {}, {})).not.toThrow();
      const issues = validateDeckForPlay(value, mode, {}, {});
      expect(issues.length).toBeGreaterThan(0);
      expect(issues.every((issue) => issue.stage === 'shape')).toBe(true);
    }
    expect(checkDeckShape(value).length).toBeGreaterThan(0);
  });

  it('rejects an explanationByChallengeId that is not an object', () => {
    const s = sample('solitaire');
    const deck = cloneDeck(s.deck) as unknown as { answerCards: Array<Record<string, unknown>> };
    deck.answerCards[0]!['explanationByChallengeId'] = 'text';
    expect(checkDeckShape(deck).map((issue) => issue.path)).toContain('answerCards[0].explanationByChallengeId');
  });
});
