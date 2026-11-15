/**
 * M6 stage C3 - Clinical deck generator (requirements Req 4; design section 5).
 *
 * Fictional data only (fixtures/fake-large-clinical.ts). Expected validity comes
 * from an ORACLE written here from the raw fixture data and the review coverage
 * the test chose; it never calls the policy code.
 */

import { describe, expect, it } from 'vitest';
import {
  DECK_VALIDATION_CODES,
  createReferenceBeepyStrategy,
  createSeriesController,
  normalizeDisplayText,
  validateDeckForPlay,
  type GeneratedDeck,
  type GenerationResult,
} from '@beepy/shared-engine';
import {
  CLINICAL_COMPETITIVE_TARGET_CARD_COUNT,
  CLINICAL_GENERATION_CODES as G,
  CLINICAL_SOLITAIRE_TARGET_CARD_COUNT,
  ClinicalDeckGenerator,
  generateClinicalDeck,
  type ClinicalMode,
} from '../src/clinical-generator.js';
import { largeFakeDataset, reviewFileFor, type TopicCoverage } from './fixtures/fake-large-clinical.js';
import type { FakeCollection, FakeDisease, FakeTopic } from './fixtures/fake-clinical.js';

type Direction = 'subjectToFact' | 'factToSubject';
const MODES: readonly ClinicalMode[] = ['solitaire', 'vsBeepy'];
const DIRECTIONS: readonly Direction[] = ['subjectToFact', 'factToSubject'];
const SEEDS = Array.from({ length: 30 }, (_, i) => i + 1);
const n = normalizeDisplayText;

const request = (data: FakeCollection, mode: ClinicalMode, direction: Direction, seed: number, review: unknown, extra: Record<string, unknown> = {}) => ({
  source: data,
  config: { app: 'clinical', generationDirection: direction },
  mode,
  challengeCount: mode === 'solitaire' ? 5 : 9,
  targetCardCount: mode === 'solitaire' ? CLINICAL_SOLITAIRE_TARGET_CARD_COUNT : CLINICAL_COMPETITIVE_TARGET_CARD_COUNT,
  seed,
  review,
  ...extra,
});

const ok = (result: GenerationResult) => {
  if (!result.ok) throw new Error(`expected a deck: ${JSON.stringify(result.issues)}`);
  return result;
};

// ---------------------------------------------------------------------------
// Independent oracle (from raw data + the coverage chosen by the test)
// ---------------------------------------------------------------------------

type Rel = 'valid' | 'invalid' | 'unknown';
interface Coverage {
  readonly topics: TopicCoverage;
  /** Disease ids whose alternatives have a CURRENT alternative review. */
  readonly alternativesReviewed: ReadonlySet<string>;
}
const categoryKey = (topicId: string) => topicId.slice(topicId.lastIndexOf('.') + 1);

function makeOracle(data: FakeCollection, coverage: Coverage) {
  const topics = new Map<string, { topic: FakeTopic; disease: FakeDisease }>();
  for (const disease of data.subjects) for (const topic of disease.topics) topics.set(topic.id, { topic, disease });
  const correctOwners = new Map<string, Set<string>>();
  const incorrectOwners = new Map<string, Set<string>>();
  for (const [id, { topic }] of topics) {
    for (const e of topic.corrects) correctOwners.set(n(e.text), (correctOwners.get(n(e.text)) ?? new Set()).add(id));
    for (const e of topic.incorrects) incorrectOwners.set(n(e.text), (incorrectOwners.get(n(e.text)) ?? new Set()).add(id));
  }
  const covered = (a: string, b: string): boolean =>
    a !== b && (coverage.topics === 'full' || (coverage.topics === 'category' && categoryKey(a) === categoryKey(b)));

  const fact = (text: string, topicId: string): Rel => {
    const key = n(text);
    if (correctOwners.get(key)?.has(topicId)) return 'valid';
    if (incorrectOwners.get(key)?.has(topicId)) return 'invalid';
    for (const owner of correctOwners.get(key) ?? []) if (covered(owner, topicId)) return 'invalid';
    return 'unknown';
  };
  const name = (cardName: string, topicId: string, factText: string): Rel => {
    const { disease } = topics.get(topicId) as { disease: FakeDisease };
    const key = n(cardName);
    if (key === n(disease.subject)) return 'valid';
    const other = data.subjects.find((s) => n(s.subject) === key);
    const otherTopic = other?.topics.find((t) => categoryKey(t.id) === categoryKey(topicId));
    if (otherTopic?.corrects.some((e) => n(e.text) === n(factText))) return 'valid';
    if (otherTopic?.incorrects.some((e) => n(e.text) === n(factText))) return 'invalid';
    if (disease.subjectIncorrects.some((e) => n(e.text) === key) && coverage.alternativesReviewed.has(disease.id)) return 'invalid';
    if (otherTopic !== undefined && covered(topicId, otherTopic.id)) return 'invalid';
    return 'unknown';
  };
  /** The explanation the author wrote for this exact (card, challenge) context, if any. */
  const explanation = (direction: Direction, cardText: string, topicId: string, factText: string): string | undefined => {
    const { topic, disease } = topics.get(topicId) as { topic: FakeTopic; disease: FakeDisease };
    const key = n(cardText);
    if (direction === 'subjectToFact') return [...topic.corrects, ...topic.incorrects].find((e) => n(e.text) === key && e.explanation)?.explanation;
    if (key === n(disease.subject)) return topic.corrects.find((e) => n(e.text) === n(factText))?.explanation;
    const other = data.subjects.find((s) => n(s.subject) === key);
    const otherTopic = other?.topics.find((t) => categoryKey(t.id) === categoryKey(topicId));
    const listed = otherTopic?.incorrects.find((e) => n(e.text) === n(factText) && e.explanation)?.explanation;
    if (listed !== undefined) return listed;
    if (name(cardText, topicId, factText) !== 'invalid') return undefined;
    return disease.subjectIncorrects.find((e) => n(e.text) === key && e.explanation)?.explanation;
  };
  return { fact, name, explanation, topics };
}

/** The fact a factToSubject prompt shows: everything after "<category>: ". */
const factOfPrompt = (prompt: string) => prompt.slice(prompt.indexOf(': ') + 2);

/** Check one deck completely against the oracle. Returns the challenge topic ids. */
function checkDeck(deck: GeneratedDeck, matrix: Record<string, Record<string, boolean>>, direction: Direction, data: FakeCollection, coverage: Coverage) {
  const oracle = makeOracle(data, coverage);
  const rel = (text: string, topicId: string, prompt: string) =>
    direction === 'subjectToFact' ? oracle.fact(text, topicId) : oracle.name(text, topicId, factOfPrompt(prompt));

  // Neutral ids, unique normalized texts, verbatim faces.
  expect(deck.challenges.every((c, i) => c.id === `c${i + 1}`)).toBe(true);
  expect(deck.answerCards.every((c) => /^k\d+$/.test(c.id))).toBe(true);
  expect(new Set(deck.answerCards.map((c) => n(c.displayValue))).size).toBe(deck.answerCards.length);
  const rawTexts = new Set(
    data.subjects.flatMap((s) =>
      direction === 'factToSubject'
        ? [s.subject, ...s.subjectIncorrects.map((e) => e.text)]
        : s.topics.flatMap((t) => [...t.corrects, ...t.incorrects].map((e) => e.text)),
    ),
  );
  for (const card of deck.answerCards) expect(rawTexts.has(card.displayValue)).toBe(true);

  const topicIds: string[] = [];
  for (const challenge of deck.challenges) {
    const topicId = challenge.sourceRef.topicId as string;
    topicIds.push(topicId);
    const { topic, disease } = oracle.topics.get(topicId) as { topic: FakeTopic; disease: FakeDisease };
    expect(challenge.sourceRef.subjectId).toBe(disease.id);
    if (direction === 'subjectToFact') {
      expect(challenge.promptText).toBe(`${disease.subject} · ${topic.topicName}`);
    } else {
      expect(challenge.promptText.startsWith(`${topic.topicName}: `)).toBe(true);
      expect(topic.corrects.map((e) => e.text)).toContain(factOfPrompt(challenge.promptText));
    }
    // Every pair is known, equals the matrix, and exactly one card is valid: the designated one.
    const valid: string[] = [];
    for (const card of deck.answerCards) {
      const expected = rel(card.displayValue, topicId, challenge.promptText);
      expect(expected).not.toBe('unknown');
      expect(matrix[challenge.id]?.[card.id]).toBe(expected === 'valid');
      if (expected === 'valid') valid.push(card.id);
      // Explanations only where the author wrote them for this context.
      expect(card.explanationByChallengeId?.[challenge.id]).toBe(
        oracle.explanation(direction, card.displayValue, topicId, factOfPrompt(challenge.promptText)),
      );
    }
    expect(valid).toEqual([challenge.correctAnswerCardId]);
  }
  for (const card of deck.answerCards) {
    for (const key of Object.keys(card.explanationByChallengeId ?? {})) expect(deck.challenges.map((c) => c.id)).toContain(key);
  }
  if (direction === 'factToSubject') {
    const diseases = deck.challenges.map((c) => c.sourceRef.subjectId);
    expect(new Set(diseases).size).toBe(diseases.length);
  }
  return topicIds;
}

const fullCoverage = (data: FakeCollection): Coverage => ({ topics: 'full', alternativesReviewed: new Set(data.subjects.map((s) => s.id)) });

// ---------------------------------------------------------------------------

describe('C3 generator: both modes x both directions x many seeds (full review coverage)', () => {
  const data = largeFakeDataset({ diseases: 16, alternatives: 10 });
  const review = reviewFileFor(data, { topics: 'full', alternatives: true });
  describe.each(MODES.flatMap((mode) => DIRECTIONS.map((direction) => [mode, direction] as const)))('%s / %s', (mode, direction) => {
    it(`produces a full-size, oracle-correct deck for ${SEEDS.length} seeds`, () => {
      const expectedSize = mode === 'solitaire' ? 15 : 24;
      for (const seed of SEEDS) {
        const result = ok(generateClinicalDeck(request(data, mode, direction, seed, review)));
        expect(result.numericAnswers).toBe(false);
        expect(result.deck.direction).toBe(direction);
        expect(result.deck.challenges).toHaveLength(mode === 'solitaire' ? 5 : 9);
        expect(result.deck.answerCards).toHaveLength(expectedSize);
        expect(result.sizing).toMatchObject({ targetCardCount: expectedSize, actualCardCount: expectedSize, reduced: false });
        expect(result.deck.meta).toEqual({ targetCardCount: expectedSize, actualCardCount: expectedSize });
        expect(validateDeckForPlay(result.deck, mode, result.contextualValidity, { numericAnswers: false })).toEqual([]);
        checkDeck(result.deck, result.contextualValidity, direction, data, fullCoverage(data));
      }
    });
  });

  it('subjectToFact explanations appear for designated facts and for listed incorrects on their own topic', () => {
    let designatedWithExplanation = 0;
    for (const seed of SEEDS) {
      const { deck } = ok(generateClinicalDeck(request(data, 'vsBeepy', 'subjectToFact', seed, review)));
      for (const c of deck.challenges) {
        const card = deck.answerCards.find((k) => k.id === c.correctAnswerCardId);
        if (card?.explanationByChallengeId?.[c.id] !== undefined) designatedWithExplanation += 1;
      }
    }
    expect(designatedWithExplanation).toBeGreaterThan(0);
  });
});

describe('C3 determinism', () => {
  const data = largeFakeDataset({ diseases: 16, alternatives: 10 });
  const review = reviewFileFor(data, { topics: 'full', alternatives: true });
  it.each(DIRECTIONS)('the same request gives the same deck; different seeds vary (%s)', (direction) => {
    for (const mode of MODES) {
      expect(generateClinicalDeck(request(data, mode, direction, 7, review))).toEqual(generateClinicalDeck(request(data, mode, direction, 7, review)));
      const decks = SEEDS.slice(0, 10).map((seed) => JSON.stringify(ok(generateClinicalDeck(request(data, mode, direction, seed, review))).deck));
      expect(new Set(decks).size).toBeGreaterThanOrEqual(8);
    }
  });

  it('does not modify the dataset or the review file', () => {
    const before = JSON.stringify([data, review]);
    generateClinicalDeck(request(data, 'vsBeepy', 'factToSubject', 3, review));
    expect(JSON.stringify([data, review])).toBe(before);
  });
});

describe('C3 starting hands through the real engine (5 cards, 2-3 correct)', () => {
  const data = largeFakeDataset({ diseases: 16, alternatives: 10 });
  const review = reviewFileFor(data, { topics: 'full', alternatives: true });
  it.each(MODES.flatMap((mode) => DIRECTIONS.map((direction) => [mode, direction] as const)))('%s / %s', (mode, direction) => {
    for (const seed of SEEDS.slice(0, 12)) {
      const { deck, contextualValidity } = ok(generateClinicalDeck(request(data, mode, direction, seed, review)));
      const strategy = createReferenceBeepyStrategy({ errorRate: 0 });
      if (!strategy.ok) throw new Error('strategy');
      const created = createSeriesController({
        mode,
        seed: seed * 101,
        options: { numericAnswers: false },
        ...(mode === 'vsBeepy' ? { beepyStrategy: strategy.strategy } : {}),
      });
      if (!created.ok) throw new Error('controller');
      const started = created.controller.startNextGame({ deck, contextualValidity });
      if (!started.ok) throw new Error(JSON.stringify(started.error));
      const view = started.view;
      expect(view.hand).toHaveLength(5);
      const correctIds = new Set(deck.challenges.map((c) => c.correctAnswerCardId));
      const idByText = new Map(deck.answerCards.map((c) => [c.displayValue, c.id]));
      const correctInHand = view.hand.filter((face) => correctIds.has(idByText.get(face.displayValue) as string)).length;
      expect([2, 3]).toContain(correctInHand);
      expect(new Set(view.hand.map((f) => n(f.displayValue))).size).toBe(5);
      if (mode === 'vsBeepy') expect(view.opponentHandCount).toBe(5);
      expect(view.challenges).toHaveLength(mode === 'solitaire' ? 5 : 9);
    }
  });
});

describe('C3 review coverage limits what is used: unknown is never a distractor', () => {
  const data = largeFakeDataset({ diseases: 16, alternatives: 10 });

  it('no reviews at all: no valid board can be chosen (structured failure, no deck)', () => {
    for (const direction of DIRECTIONS) {
      const result = generateClinicalDeck(request(data, 'solitaire', direction, 1, undefined));
      expect(result).toEqual({ ok: false, issues: [expect.objectContaining({ code: G.insufficientChallenges, path: 'source' })] });
    }
  });

  it('category-only reviews: subjectToFact boards stay within one category, full size', () => {
    const review = reviewFileFor(data, { topics: 'category' });
    const coverage: Coverage = { topics: 'category', alternativesReviewed: new Set() };
    for (const mode of MODES) {
      for (const seed of SEEDS.slice(0, 15)) {
        const result = ok(generateClinicalDeck(request(data, mode, 'subjectToFact', seed, review)));
        const topicIds = checkDeck(result.deck, result.contextualValidity, 'subjectToFact', data, coverage);
        expect(new Set(topicIds.map(categoryKey)).size).toBe(1);
        expect(result.deck.answerCards).toHaveLength(mode === 'solitaire' ? 15 : 24);
      }
    }
  });

  it('unreviewed alternatives never appear; fact -> disease vsBeepy is a reduced 16-card deck (9 + 7 names)', () => {
    const review = reviewFileFor(data, { topics: 'category' });
    const coverage: Coverage = { topics: 'category', alternativesReviewed: new Set() };
    for (const seed of SEEDS.slice(0, 15)) {
      const result = ok(generateClinicalDeck(request(data, 'vsBeepy', 'factToSubject', seed, review)));
      checkDeck(result.deck, result.contextualValidity, 'factToSubject', data, coverage);
      expect(result.deck.answerCards.some((c) => c.displayValue.startsWith('Test Alternative'))).toBe(false);
      expect(result.sizing).toEqual({ targetCardCount: 24, actualCardCount: 16, eligibleDistractors: 7, reduced: true });
    }
  });

  it('alternatives reviewed for some diseases only: they appear only when every challenge disease is covered', () => {
    const local = largeFakeDataset({ diseases: 10, alternatives: 10 });
    const reviewed = [1, 2, 3, 4, 5, 6, 7, 8];
    const review = reviewFileFor(local, { topics: 'full', alternatives: reviewed });
    const coverage: Coverage = { topics: 'full', alternativesReviewed: new Set(reviewed.map((i) => `clinical.subject.test-disease-${i}`)) };
    let withAlternatives = 0;
    for (const seed of Array.from({ length: 40 }, (_, i) => i + 1)) {
      const result = ok(generateClinicalDeck(request(local, 'solitaire', 'factToSubject', seed, review)));
      checkDeck(result.deck, result.contextualValidity, 'factToSubject', local, coverage);
      if (result.deck.answerCards.some((c) => c.displayValue.startsWith('Test Alternative'))) {
        withAlternatives += 1;
        for (const c of result.deck.challenges) expect(coverage.alternativesReviewed.has(c.sourceRef.subjectId)).toBe(true);
      }
    }
    expect(withAlternatives).toBeGreaterThan(0);
  });

  it('a stale alternative review stops its alternatives from being used on that disease\u2019s challenges', () => {
    const local = largeFakeDataset({ diseases: 16, alternatives: 10 });
    const review = reviewFileFor(local, { topics: 'full', alternatives: true });
    // Edit a covered alternative of disease 1 AFTER the review: its alternative review is stale.
    local.subjects[0]!.subjectIncorrects[1]!.text = 'Test Alternative Diagnosis 2 renamed';
    const coverage: Coverage = { topics: 'full', alternativesReviewed: new Set(local.subjects.slice(1).map((s) => s.id)) };
    let boardsWithDisease1 = 0;
    for (const seed of Array.from({ length: 60 }, (_, i) => i + 1)) {
      const result = ok(generateClinicalDeck(request(local, 'solitaire', 'factToSubject', seed, review)));
      checkDeck(result.deck, result.contextualValidity, 'factToSubject', local, coverage);
      expect(result.deck.answerCards.some((c) => c.displayValue === 'Test Alternative Diagnosis 2 renamed')).toBe(false);
      if (result.deck.challenges.some((c) => c.sourceRef.subjectId === 'clinical.subject.test-disease-1')) {
        boardsWithDisease1 += 1;
        expect(result.deck.answerCards.some((c) => c.displayValue.startsWith('Test Alternative'))).toBe(false);
      }
    }
    expect(boardsWithDisease1).toBeGreaterThan(0);
  });

  it('a stale topic review stops the relationships it covered', () => {
    const local = largeFakeDataset({ diseases: 16 });
    const review = reviewFileFor(local, { topics: 'full' });
    local.subjects[0]!.topics[0]!.corrects[0]!.text = 'Test Disease 1 sign fact A edited';
    // The single all-topics record is now stale: nothing is reviewed.
    expect(generateClinicalDeck(request(local, 'solitaire', 'subjectToFact', 1, review))).toMatchObject({ ok: false, issues: [{ code: G.insufficientChallenges }] });
  });
});

describe('C3 shared, duplicate and ambiguous facts', () => {
  // Disease 1 and 2 Work-up both list the same fact (with different case/spacing in one).
  const data = largeFakeDataset({ diseases: 16, alternatives: 10 });
  data.subjects[0]!.topics[1]!.corrects[2]!.text = 'Test shared work-up fact S';
  data.subjects[1]!.topics[1]!.corrects[2]!.text = '  test SHARED work-up   fact s ';
  const review = reviewFileFor(data, { topics: 'full', alternatives: true });
  const shared = n('Test shared work-up fact S');

  it.each(MODES.flatMap((mode) => DIRECTIONS.map((direction) => [mode, direction] as const)))(
    '%s / %s: every deck still has exactly one valid card per challenge',
    (mode, direction) => {
      for (const seed of Array.from({ length: 60 }, (_, i) => i + 1)) {
        const result = ok(generateClinicalDeck(request(data, mode, direction, seed, review)));
        const topicIds = checkDeck(result.deck, result.contextualValidity, direction, data, fullCoverage(data));
        if (direction === 'subjectToFact') {
          const card = result.deck.answerCards.find((c) => n(c.displayValue) === shared);
          const onBoard = topicIds.filter((t) => t === 'clinical.topic.test-disease-1.workup' || t === 'clinical.topic.test-disease-2.workup');
          if (onBoard.length === 2) expect(card).toBeUndefined();
          if (card !== undefined) expect(card.displayValue).toBe('Test shared work-up fact S'); // first spelling, verbatim
        } else {
          // A challenge showing the shared fact never has both diseases' names in the deck.
          for (const c of result.deck.challenges.filter((x) => n(factOfPrompt(x.promptText)) === shared)) {
            const names = result.deck.answerCards.map((k) => k.displayValue);
            expect(names.includes('Test Disease 1') && names.includes('Test Disease 2')).toBe(false);
            void c;
          }
        }
      }
    },
  );
});

describe('C3 insufficient data and reduced decks', () => {
  const full = (data: FakeCollection) => reviewFileFor(data, { topics: 'full', alternatives: true });

  it('too few topics for a Solitaire board', () => {
    const data = largeFakeDataset({ diseases: 1 });
    expect(generateClinicalDeck(request(data, 'solitaire', 'subjectToFact', 1, undefined))).toMatchObject({ ok: false, issues: [{ code: G.insufficientChallenges }] });
  });

  it('too few diseases for a 9-challenge fact -> disease board', () => {
    const data = largeFakeDataset({ diseases: 8 });
    expect(generateClinicalDeck(request(data, 'vsBeepy', 'factToSubject', 1, full(data)))).toMatchObject({ ok: false, issues: [{ code: G.insufficientChallenges }] });
  });

  it('12 diseases, no alternatives: 9 + 3 names is below the 14-card minimum (M2 code, no padding)', () => {
    const data = largeFakeDataset({ diseases: 12 });
    const result = generateClinicalDeck(request(data, 'vsBeepy', 'factToSubject', 1, full(data)));
    expect(result).toMatchObject({ ok: false, issues: [{ code: DECK_VALIDATION_CODES.insufficientDeckData }] });
  });

  it('14 diseases, no alternatives: a validated 14-card deck, reported as reduced', () => {
    const data = largeFakeDataset({ diseases: 14 });
    for (const seed of SEEDS.slice(0, 10)) {
      const result = ok(generateClinicalDeck(request(data, 'vsBeepy', 'factToSubject', seed, full(data))));
      expect(result.sizing).toEqual({ targetCardCount: 24, actualCardCount: 14, eligibleDistractors: 5, reduced: true });
      checkDeck(result.deck, result.contextualValidity, 'factToSubject', data, fullCoverage(data));
    }
  });

  it('a small Solitaire dataset gives the 8-card minimum deck', () => {
    // 2 diseases x 4 categories x 1 fact: 5 board topics + 3 other facts. Listed incorrects of
    // other topics are unknown on the board, so they are not used.
    const data = largeFakeDataset({ diseases: 2, facts: 1 });
    const result = ok(generateClinicalDeck(request(data, 'solitaire', 'subjectToFact', 4, full(data))));
    expect(result.sizing).toEqual({ targetCardCount: 15, actualCardCount: 8, eligibleDistractors: 3, reduced: true });
    checkDeck(result.deck, result.contextualValidity, 'subjectToFact', data, fullCoverage(data));
  });

  it('an explicit smaller target is honored; a target below the minimum is rejected', () => {
    const data = largeFakeDataset({ diseases: 16, alternatives: 10 });
    const review = full(data);
    expect(ok(generateClinicalDeck(request(data, 'solitaire', 'subjectToFact', 2, review, { targetCardCount: 10 }))).sizing).toMatchObject({ actualCardCount: 10, reduced: false });
    expect(generateClinicalDeck(request(data, 'solitaire', 'subjectToFact', 2, review, { targetCardCount: 7 }))).toMatchObject({
      ok: false,
      issues: [{ code: DECK_VALIDATION_CODES.deckBelowMinimum }],
    });
  });
});

describe('C3 request validation (structured failures, never throws)', () => {
  const data = largeFakeDataset({ diseases: 16 });
  const base = () => request(data, 'solitaire', 'subjectToFact', 1, reviewFileFor(data, { topics: 'full' }));
  it.each([
    ['not an object', () => null, G.invalidRequest, 'request'],
    ['tutor mode', () => ({ ...base(), mode: 'tutor' }), G.modeNotSupported, 'mode'],
    ['vsPlayer mode', () => ({ ...base(), mode: 'vsPlayer' }), G.modeNotSupported, 'mode'],
    ['an unknown mode', () => ({ ...base(), mode: 'duel' }), G.invalidMode, 'mode'],
    ['a NaN seed', () => ({ ...base(), seed: Number.NaN }), G.invalidSeed, 'seed'],
    ['the Math app', () => ({ ...base(), config: { app: 'math' } }), G.invalidApp, 'config.app'],
    ['a missing config', () => ({ ...base(), config: undefined }), G.invalidRequest, 'config'],
    ['an unknown direction', () => ({ ...base(), config: { app: 'clinical', generationDirection: 'sideways' } }), G.invalidDirection, 'config.generationDirection'],
    ['a wrong challenge count', () => ({ ...base(), challengeCount: 9 }), G.challengeCountMismatch, 'challengeCount'],
    ['a fractional target', () => ({ ...base(), targetCardCount: 12.5 }), G.invalidCount, 'targetCardCount'],
  ])('%s', (_label, make, code, path) => {
    const result = generateClinicalDeck(make());
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.issues).toContainEqual(expect.objectContaining({ code, path }));
  });

  it('an invalid dataset reports its C1/M2 issues under "source." and no deck', () => {
    const broken = largeFakeDataset({ diseases: 6 });
    broken.subjects[2]!.topics[1]!.topicName = 'Labs';
    const result = generateClinicalDeck({ ...base(), source: broken });
    expect(result).toEqual({ ok: false, issues: [expect.objectContaining({ code: 'CLINICAL_UNKNOWN_CATEGORY', path: 'source.subjects[2].topics[1].topicName' })] });
  });

  it('an unusable review file is an error; a bad record inside a usable file is simply not used', () => {
    const unusable = generateClinicalDeck({ ...base(), review: { reviews: 'x' } });
    expect(unusable.ok).toBe(false);
    if (!unusable.ok) expect(unusable.issues).toContainEqual(expect.objectContaining({ code: 'REVIEW_INVALID_FILE', path: 'review.reviews' }));
    const review = reviewFileFor(data, { topics: 'full' }) as { reviews: unknown[] };
    const withBadRecord = { ...review, reviews: [...review.reviews, { id: 'bad id' }] };
    expect(generateClinicalDeck({ ...base(), review: withBadRecord }).ok).toBe(true);
  });

  it('defaults to subjectToFact when no direction is given', () => {
    const result = ok(generateClinicalDeck({ ...base(), config: { app: 'clinical' } }));
    expect(result.deck.direction).toBe('subjectToFact');
  });
});

describe('C3 self-validation gate and the generator class', () => {
  const data = largeFakeDataset({ diseases: 16, alternatives: 10 });
  const review = reviewFileFor(data, { topics: 'full', alternatives: true });

  it('a corrupted draft is rejected by validateDeckForPlay and no deck is returned', () => {
    const result = generateClinicalDeck(request(data, 'solitaire', 'subjectToFact', 1, review), {
      tamper: (draft) => {
        const cards = draft.deck.answerCards.map((c, i) => (i === 1 ? { ...c, displayValue: (draft.deck.answerCards[0] as { displayValue: string }).displayValue } : c));
        return { ...draft, deck: { ...draft.deck, answerCards: cards } };
      },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.issues.length).toBeGreaterThan(0);
    expect('deck' in result).toBe(false);
  });

  it('ClinicalDeckGenerator implements the shared boundary', () => {
    const generator = new ClinicalDeckGenerator();
    expect(generator.app).toBe('clinical');
    const viaClass = generator.generate(request(data, 'vsBeepy', 'subjectToFact', 5, review) as never);
    expect(viaClass).toEqual(generateClinicalDeck(request(data, 'vsBeepy', 'subjectToFact', 5, review)));
  });
});

describe('C3 boundaries: Math Cards and the engine are untouched by Clinical', () => {
  async function readText(relative: string): Promise<string> {
    const specifier = 'node:fs/promises';
    const fs = (await import(/* @vite-ignore */ specifier)) as { readFile(path: URL, encoding: string): Promise<string> };
    return fs.readFile(new URL(relative, import.meta.url), 'utf8');
  }
  it('Clinical source never imports math-cards', async () => {
    for (const file of ['clinical-content.ts', 'clinical-review.ts', 'clinical-generator.ts']) {
      const text = await readText(`../src/${file}`);
      expect(text).not.toMatch(/from ['"][^'"]*math-cards/);
      expect(text).not.toMatch(/from ['"]\.\.\/\.\.\//);
    }
  });
  it('the engine index exports nothing Clinical-specific', async () => {
    const text = await readText('../../shared-engine/src/index.ts');
    expect(text).not.toMatch(/clinical-cards/);
  });
});
