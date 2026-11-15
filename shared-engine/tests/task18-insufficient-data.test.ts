/**
 * Task 18 - insufficient-data-fails-cleanly (Req 7.1, 7.2; Req 6.1, 6.2; design D7, D8).
 *
 * When data cannot produce a valid deck - too few unique values, no unambiguous
 * correct card, or a range below the mode's hands plus draw reserve - the checks
 * fail with actionable structured issues and return NOTHING else: no plan, no
 * analysis, no deck. Pools are tested in both a Math (numeric) and a Clinical
 * (text, placeholder content) form.
 */

import { describe, expect, it } from 'vitest';
import {
  DECK_VALIDATION_CODES as C,
  analyzeCandidateAmbiguity,
  assessDeckData,
  countUniqueValues,
  formatIssues,
  isStructuredIssue,
  planDeckSize,
  type DeckMode,
} from '../src/index.js';

const issue = (code: string, path?: string) =>
  expect.objectContaining(path === undefined ? { code } : { code, path });

interface PoolStyle {
  readonly numeric: boolean;
  readonly correct: (from: number, count: number) => string[];
  readonly distractor: (from: number, count: number) => string[];
  /** A different spelling of the same value (text) or the same number (numeric). */
  readonly variant: (value: string) => string;
  /** A value that cannot be used in this style. */
  readonly invalid: string;
}

const range = (count: number, make: (i: number) => string): string[] => Array.from({ length: count }, (_, i) => make(i));

const STYLES: ReadonlyArray<readonly [string, PoolStyle]> = [
  [
    'Math (numeric)',
    {
      numeric: true,
      correct: (from, count) => range(count, (i) => String(100 + from + i)),
      distractor: (from, count) => range(count, (i) => String(200 + from + i)),
      variant: (value) => `0${value}`, // "0100" is the number 100
      invalid: 'seven',
    },
  ],
  [
    'Clinical (text, placeholder content)',
    {
      numeric: false,
      correct: (from, count) => range(count, (i) => `Test finding ${from + i}`),
      distractor: (from, count) => range(count, (i) => `Test distractor ${from + i}`),
      variant: (value) => `  ${value.toUpperCase()}  `,
      invalid: '   ',
    },
  ],
];

// ---------------------------------------------------------------------------
describe('countUniqueValues', () => {
  it('collapses case and whitespace variants in text mode and counts blanks as invalid', () => {
    const counted = countUniqueValues(['Fever', 'fever ', 'Rash', '', '   ']);
    expect(counted).toMatchObject({ supplied: 5, unique: 2, duplicates: 1, invalid: 2 });
    expect(counted.keys.has('fever')).toBe(true);
  });

  it('joins "7", "07" and "7.0" in numeric mode and counts non-numbers as invalid', () => {
    expect(countUniqueValues(['7', '07', '7.0', '8', 'abc'], { numericAnswers: true })).toMatchObject({
      supplied: 5,
      unique: 2,
      duplicates: 2,
      invalid: 1,
    });
  });

  it('handles an empty pool', () => {
    expect(countUniqueValues([])).toMatchObject({ supplied: 0, unique: 0, duplicates: 0, invalid: 0 });
  });
});

// ---------------------------------------------------------------------------
describe.each(STYLES)('insufficient-data-fails-cleanly (Req 6.1), data pools: %s', (_name, style) => {
  const assess = (mode: DeckMode, target: number, correct: string[], distractors: string[]) =>
    assessDeckData(mode, target, { correctValues: correct, distractorValues: distractors, numericAnswers: style.numeric });

  it('plans the full competitive deck when enough unique values exist', () => {
    const result = assess('vsBeepy', 24, style.correct(0, 9), style.distractor(0, 15));
    expect(result).toMatchObject({ ok: true, uniqueCorrect: 9, uniqueDistractors: 15 });
    if (result.ok) expect(result.plan).toMatchObject({ cardCount: 24, reduced: false });
  });

  it('plans a smaller deck when the range is limited, down to the 14-card minimum', () => {
    const reduced = assess('vsBeepy', 24, style.correct(0, 9), style.distractor(0, 10));
    expect(reduced.ok && reduced.plan).toMatchObject({ cardCount: 19, reduced: true });
    const minimum = assess('vsBeepy', 24, style.correct(0, 9), style.distractor(0, 5));
    expect(minimum.ok && minimum.plan).toMatchObject({ cardCount: 14 });
  });

  it('too few UNIQUE correct values: a supplied count of 9 hides only 5 distinct values', () => {
    const hidden = [...style.correct(0, 5), ...style.correct(0, 4).map(style.variant)];
    expect(hidden).toHaveLength(9);
    const result = assess('vsBeepy', 24, hidden, style.distractor(0, 15));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues).toContainEqual(issue(C.tooFewUniqueValues, 'correctValues'));
    const message = result.issues[0]?.message ?? '';
    expect(message).toContain('9 correct-answer value(s) supplied but only 5 are unique and usable');
    expect(message).toContain('4 duplicate');
    expect(message).toContain('at least 9');
    expect(message).toContain('Add more distinct values');
  });

  it('too few UNIQUE distractors: a supplied count of 15 hides only 4 distinct values', () => {
    const hidden = [...style.distractor(0, 4), ...Array.from({ length: 11 }, (_, i) => style.variant(style.distractor(i % 4, 1)[0] as string))];
    expect(hidden).toHaveLength(15);
    const result = assess('vsBeepy', 24, style.correct(0, 9), hidden);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.issues).toContainEqual(issue(C.tooFewUniqueValues, 'distractorValues'));
  });

  it('a distractor equal to a correct value is not a distractor: overlap is counted out', () => {
    const overlap = style.correct(0, 3); // three values that are really correct answers
    const enough = assess('vsBeepy', 24, style.correct(0, 9), [...overlap, ...style.distractor(0, 5)]);
    expect(enough).toMatchObject({ ok: true, uniqueDistractors: 5 });
    const short = assess('vsBeepy', 24, style.correct(0, 9), [...overlap, ...style.distractor(0, 4)]);
    expect(short.ok).toBe(false);
    if (!short.ok) {
      expect(short.issues).toContainEqual(issue(C.tooFewUniqueValues, 'distractorValues'));
      expect(short.issues[0]?.message).toContain('3 equal to a correct value');
    }
  });

  it('values that cannot be used are counted out and named in the message', () => {
    const result = assess('vsBeepy', 24, style.correct(0, 9), [...style.distractor(0, 4), style.invalid, style.invalid]);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues).toContainEqual(issue(C.tooFewUniqueValues, 'distractorValues'));
      expect(result.issues[0]?.message).toContain('2 invalid');
    }
  });

  it('a range that is simply too small reports INSUFFICIENT_DECK_DATA, not TOO_FEW_UNIQUE_VALUES', () => {
    const distractors = assess('vsBeepy', 24, style.correct(0, 9), style.distractor(0, 4)); // 13 cards: below hands + reserve
    expect(distractors.ok).toBe(false);
    if (!distractors.ok) {
      expect(distractors.issues).toContainEqual(issue(C.insufficientDeckData, 'distractorValues'));
      expect(distractors.issues.some((i) => i.code === C.tooFewUniqueValues)).toBe(false);
    }
    const correct = assess('vsBeepy', 24, style.correct(0, 8), style.distractor(0, 15));
    expect(correct.ok).toBe(false);
    if (!correct.ok) expect(correct.issues).toContainEqual(issue(C.insufficientDeckData, 'correctValues'));
  });

  it('reports both pools when both are short', () => {
    const result = assess('vsBeepy', 24, style.correct(0, 3), style.distractor(0, 2));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues).toHaveLength(2);
      expect(result.issues).toContainEqual(issue(C.insufficientDeckData, 'correctValues'));
      expect(result.issues).toContainEqual(issue(C.insufficientDeckData, 'distractorValues'));
    }
  });

  it('passes through a target below the minimum, an invalid target, and an invalid mode', () => {
    const low = assess('vsBeepy', 12, style.correct(0, 9), style.distractor(0, 15));
    expect(!low.ok && low.issues).toContainEqual(issue(C.deckBelowMinimum, 'targetCardCount'));
    const nan = assess('vsBeepy', Number.NaN, style.correct(0, 9), style.distractor(0, 15));
    expect(!nan.ok && nan.issues).toContainEqual(issue(C.invalidCount, 'targetCardCount'));
    const mode = assess('vsPlayer' as DeckMode, 24, style.correct(0, 9), style.distractor(0, 15));
    expect(mode.ok).toBe(false);
    if (!mode.ok) expect(mode.issues).toEqual([issue(C.invalidMode, 'mode')]);
  });

  it.each(['solitaire', 'tutor'] as const)('%s: 5 correct + 3 distractors is enough, 5 + 2 is not', (mode) => {
    expect(assess(mode, 8, style.correct(0, 5), style.distractor(0, 3)).ok).toBe(true);
    const short = assess(mode, 8, style.correct(0, 5), style.distractor(0, 2));
    expect(!short.ok && short.issues).toContainEqual(issue(C.insufficientDeckData, 'distractorValues'));
  });

  it('is not bound to 24 cards in Solitaire', () => {
    expect(assess('solitaire', 12, style.correct(0, 5), style.distractor(0, 9)).ok).toBe(true);
  });

  it('every failure carries only { ok, issues }: no plan, deck, or counts', () => {
    const failures = [
      assess('vsBeepy', 24, style.correct(0, 3), style.distractor(0, 2)),
      assess('vsBeepy', 24, [...style.correct(0, 5), ...style.correct(0, 4).map(style.variant)], style.distractor(0, 15)),
      assess('vsPlayer' as DeckMode, 24, [], []),
    ];
    for (const failure of failures) {
      expect(failure.ok).toBe(false);
      expect(Object.keys(failure).sort()).toEqual(['issues', 'ok']);
      if (!failure.ok) {
        expect(failure.issues.length).toBeGreaterThan(0);
        expect(failure.issues.every(isStructuredIssue)).toBe(true);
      }
    }
  });

  it('every failure is readable through the shared formatter', () => {
    const failure = assess('vsBeepy', 24, style.correct(0, 3), style.distractor(0, 2));
    if (failure.ok) throw new Error('expected a failure');
    const text = formatIssues(failure.issues);
    expect(text).toContain('[INSUFFICIENT_DECK_DATA] correctValues:');
    expect(text.split('\n')).toHaveLength(2);
  });
});

describe('assessDeckData: properties', () => {
  const unique = (prefix: number, count: number) => Array.from({ length: count }, (_, i) => String(prefix + i));

  it('on unique pools it agrees with the planner (3 modes x targets 1-30 x 0-11 correct x 0-18 distractors)', () => {
    let cases = 0;
    for (const mode of ['solitaire', 'tutor', 'vsBeepy'] as const) {
      for (let target = 1; target <= 30; target += 1) {
        for (let c = 0; c <= 11; c += 1) {
          for (let d = 0; d <= 18; d += 1) {
            const assessed = assessDeckData(mode, target, { correctValues: unique(1000, c), distractorValues: unique(2000, d), numericAnswers: true });
            const planned = planDeckSize(mode, target, { availableCorrect: c, availableDistractors: d });
            expect(assessed.ok).toBe(planned.ok);
            if (assessed.ok && planned.ok) expect(assessed.plan.cardCount).toBe(planned.cardCount);
            cases += 1;
          }
        }
      }
    }
    expect(cases).toBe(3 * 30 * 12 * 19);
  });

  it('padding a pool with repeats never turns a failure into a success (no hidden shortage)', () => {
    const pad = (list: string[]) => (list.length === 0 ? [] : [...list, ...Array.from({ length: 20 }, () => list[0] as string)]);
    for (let c = 0; c <= 11; c += 1) {
      for (let d = 0; d <= 14; d += 1) {
        const plain = assessDeckData('vsBeepy', 24, { correctValues: unique(100, c), distractorValues: unique(200, d), numericAnswers: true });
        const padded = assessDeckData('vsBeepy', 24, { correctValues: pad(unique(100, c)), distractorValues: pad(unique(200, d)), numericAnswers: true });
        expect(padded.ok).toBe(plain.ok);
      }
    }
  });
});

// ---------------------------------------------------------------------------
describe('insufficient-data-fails-cleanly: no unambiguous correct card (Req 6.1, 6.2)', () => {
  const challenges = ['ch1', 'ch2', 'ch3'];
  const cards = ['c1', 'c2', 'c3', 'c4', 'c5', 'c6'];
  const matrixFor = (validity: Record<string, string[]>, ids: string[] = cards) =>
    Object.fromEntries(challenges.map((ch) => [ch, Object.fromEntries(ids.map((c) => [c, (validity[c] ?? []).includes(ch)]))]));
  const base = { c1: ['ch1'], c2: ['ch2'], c3: ['ch3'] };

  it('sorts clean candidates into one option per challenge plus distractors', () => {
    const result = analyzeCandidateAmbiguity(challenges, cards, matrixFor(base));
    if (!result.ok) throw new Error('expected success');
    expect(result.analysis.unambiguousByChallenge).toEqual({ ch1: ['c1'], ch2: ['c2'], ch3: ['c3'] });
    expect(result.analysis.distractorCandidates).toEqual(['c4', 'c5', 'c6']);
    expect(result.analysis.ambiguousCards).toEqual([]);
  });

  it('lists several unambiguous options for one challenge, in candidate order', () => {
    const ids = [...cards, 'c7'];
    const result = analyzeCandidateAmbiguity(challenges, ids, matrixFor({ ...base, c7: ['ch1'] }, ids));
    if (!result.ok) throw new Error('expected success');
    expect(result.analysis.unambiguousByChallenge.ch1).toEqual(['c1', 'c7']);
  });

  it('sets an ambiguous card aside without failing while every challenge still has its own option', () => {
    const ids = [...cards, 'c8'];
    const result = analyzeCandidateAmbiguity(challenges, ids, matrixFor({ ...base, c8: ['ch1', 'ch2'] }, ids));
    if (!result.ok) throw new Error('expected success');
    expect(result.analysis.ambiguousCards).toEqual(['c8']);
    expect(Object.values(result.analysis.unambiguousByChallenge).flat()).not.toContain('c8');
  });

  it('fails when a challenge has only ambiguous candidates, explaining why', () => {
    const ids = [...cards, 'c8'];
    const result = analyzeCandidateAmbiguity(challenges, ids, matrixFor({ c1: ['ch1'], c3: ['ch3'], c8: ['ch1', 'ch2'] }, ids));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues).toContainEqual(issue(C.noUnambiguousCorrectCard, 'challengeIds[1]'));
    expect(result.issues[0]?.message).toContain('also valid for another challenge');
    expect(result.issues[0]?.message).toContain('Resolve or exclude the ambiguity');
  });

  it('fails when no candidate is valid for a challenge, saying so', () => {
    const result = analyzeCandidateAmbiguity(challenges, cards, matrixFor({ c1: ['ch1'], c3: ['ch3'] }));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues).toContainEqual(issue(C.noUnambiguousCorrectCard, 'challengeIds[1]'));
      expect(result.issues[0]?.message).toContain('none of the 6 candidate(s)');
    }
  });

  it('reports one issue per failing challenge', () => {
    const result = analyzeCandidateAmbiguity(challenges, cards, matrixFor({}));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues).toHaveLength(3);
      expect(result.issues.every((i) => i.code === C.noUnambiguousCorrectCard)).toBe(true);
    }
  });

  it.each([
    ['undefined', undefined],
    ['null', null],
  ])('never skips: a %s evaluation is reported, not treated as success', (_label, matrix) => {
    const result = analyzeCandidateAmbiguity(challenges, cards, matrix as never);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.issues).toContainEqual(issue(C.contextualValidityMissing, 'contextualValidity'));
  });

  it('reports a missing entry per challenge, and a missing or non-boolean pair at its exact cell', () => {
    const empty = analyzeCandidateAmbiguity(challenges, cards, {});
    expect(!empty.ok && empty.issues.filter((i) => i.code === C.missingValidityEntry)).toHaveLength(3);

    const missing = matrixFor(base);
    delete missing.ch2!.c5;
    const oneGap = analyzeCandidateAmbiguity(challenges, cards, missing);
    expect(!oneGap.ok && oneGap.issues).toEqual([issue(C.missingValidityEvaluation, 'contextualValidity["ch2"]["c5"]')]);

    const nonBoolean = matrixFor(base) as Record<string, Record<string, unknown>>;
    nonBoolean.ch1!.c4 = 'yes';
    const bad = analyzeCandidateAmbiguity(challenges, cards, nonBoolean as never);
    expect(!bad.ok && bad.issues).toContainEqual(issue(C.missingValidityEvaluation, 'contextualValidity["ch1"]["c4"]'));
  });

  it('reports unknown challenge and card keys, and duplicate ids at their own index', () => {
    const matrix = matrixFor(base) as Record<string, Record<string, boolean>>;
    matrix.ghost = { c1: true };
    matrix.ch1!.zzz = false;
    const unknown = analyzeCandidateAmbiguity(challenges, cards, matrix);
    expect(!unknown.ok && unknown.issues).toContainEqual(issue(C.unknownChallenge, 'contextualValidity["ghost"]'));
    expect(!unknown.ok && unknown.issues).toContainEqual(issue(C.unknownCard, 'contextualValidity["ch1"]["zzz"]'));

    const dup = analyzeCandidateAmbiguity(['ch1', 'ch1', 'ch2', 'ch3'], ['c1', 'c1', 'c2', 'c3', 'c4'], matrixFor(base));
    expect(!dup.ok && dup.issues).toContainEqual(issue(C.duplicateChallengeId, 'challengeIds[1]'));
    expect(!dup.ok && dup.issues).toContainEqual(issue(C.duplicateCardId, 'candidateCardIds[1]'));
  });

  it('accepts zero challenges with empty results', () => {
    const result = analyzeCandidateAmbiguity([], ['c1'], {});
    if (!result.ok) throw new Error('expected success');
    expect(result.analysis.unambiguousByChallenge).toEqual({});
    expect(result.analysis.distractorCandidates).toEqual(['c1']);
  });

  it('every failure carries only { ok, issues }', () => {
    for (const failure of [analyzeCandidateAmbiguity(challenges, cards, matrixFor({})), analyzeCandidateAmbiguity(challenges, cards, undefined as never)]) {
      expect(Object.keys(failure).sort()).toEqual(['issues', 'ok']);
    }
  });
});
