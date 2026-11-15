/**
 * M6 stage C4 - Clinical penalty fallback (decision C-4; requirements Req 5).
 *
 * Fictional data only. Expected eligibility is computed in the test from the
 * fixture TEXT, which encodes disease, category and correctness, not from the
 * policy code.
 */

import { describe, expect, it } from 'vitest';
import {
  drawPenaltyCards,
  normalizeDisplayText,
  type GeneratedAnswerCard,
  type GeneratedDeck,
  type PenaltyCandidate,
  type SubjectCollection,
} from '@beepy/shared-engine';
import { createClinicalFallbackProvider } from '../src/clinical-fallback.js';
import { generateClinicalDeck } from '../src/clinical-generator.js';
import { NO_REVIEWS, validateReviewFile } from '../src/clinical-review.js';
import { validateClinicalCollection } from '../src/clinical-content.js';
import { LABEL, largeFakeDataset, parseFactText, reviewFileFor, type TopicCoverage } from './fixtures/fake-large-clinical.js';
import type { FakeCollection } from './fixtures/fake-clinical.js';

type Direction = 'subjectToFact' | 'factToSubject';
const n = normalizeDisplayText;

const collectionOf = (data: FakeCollection): SubjectCollection => {
  const result = validateClinicalCollection(data);
  if (!result.ok) throw new Error('fixture invalid');
  return result.collection;
};

function deckFor(data: FakeCollection, direction: Direction, mode: 'solitaire' | 'vsBeepy', seed: number, review: unknown): GeneratedDeck {
  const result = generateClinicalDeck({
    source: data,
    config: { app: 'clinical', generationDirection: direction },
    mode,
    challengeCount: mode === 'solitaire' ? 5 : 9,
    targetCardCount: mode === 'solitaire' ? 15 : 24,
    seed,
    review,
  });
  if (!result.ok) throw new Error(JSON.stringify(result.issues));
  return result.deck;
}

const providerFor = (data: FakeCollection, direction: Direction, review: unknown) => {
  const collection = collectionOf(data);
  return createClinicalFallbackProvider({ collection, direction, review: review === undefined ? NO_REVIEWS : validateReviewFile(review, collection) });
};

const candidatesOf = (provider: ReturnType<typeof providerFor>, deck: GeneratedDeck, used: readonly GeneratedAnswerCard[] = deck.answerCards): PenaltyCandidate[] => [
  ...provider.candidates({ activeChallenges: deck.challenges, usedCards: used, numericAnswers: false }),
];

/** Disease number and category label of a challenge, from its visible prompt. */
function challengeOf(prompt: string, direction: Direction): { disease: number; label: string } {
  const labelOf = (topicName: string) =>
    ({ 'Classic Signs & Symptoms': LABEL.signs, 'Work-up': LABEL.workup, Pathology: LABEL.pathology, 'Management/Treatment': LABEL.management })[topicName] as string;
  if (direction === 'subjectToFact') {
    const [disease, topicName] = prompt.split(' · ') as [string, string];
    return { disease: Number(disease.replace('Test Disease ', '')), label: labelOf(topicName) };
  }
  const topicName = prompt.slice(0, prompt.indexOf(': '));
  const fact = parseFactText(prompt.slice(prompt.indexOf(': ') + 2));
  return { disease: fact?.disease ?? -1, label: labelOf(topicName) };
}

describe('C4 fallback: subjectToFact (full review coverage)', () => {
  const data = largeFakeDataset({ diseases: 16, alternatives: 10 });
  const review = reviewFileFor(data, { topics: 'full', alternatives: true });
  const provider = providerFor(data, 'subjectToFact', review);

  it('offers only unused authored facts from topics NOT on the board (invalid for every challenge)', () => {
    for (const seed of [1, 2, 3, 4, 5, 6]) {
      const deck = deckFor(data, 'subjectToFact', 'solitaire', seed, review);
      const board = deck.challenges.map((c) => challengeOf(c.promptText, 'subjectToFact'));
      const inGame = new Set(deck.answerCards.map((c) => n(c.displayValue)));
      const candidates = candidatesOf(provider, deck);
      expect(candidates.length).toBeGreaterThan(0);
      const authored = new Set(data.subjects.flatMap((s) => s.topics.flatMap((t) => [...t.corrects, ...t.incorrects].map((e) => e.text))));
      for (const candidate of candidates) {
        expect(authored.has(candidate.card.displayValue)).toBe(true);
        expect(inGame.has(n(candidate.card.displayValue))).toBe(false);
        const parsed = parseFactText(candidate.card.displayValue);
        expect(parsed).toBeDefined();
        expect(parsed!.incorrect).toBe(false); // listed incorrects of other topics are unknown on the board
        expect(board.some((b) => b.disease === parsed!.disease && b.label === parsed!.label)).toBe(false);
        expect(Object.values(candidate.validForChallenges)).toEqual(deck.challenges.map(() => false));
        expect(Object.keys(candidate.validForChallenges).sort()).toEqual(deck.challenges.map((c) => c.id).sort());
        expect(candidate.plausible).toBe(true);
        expect('explanationByChallengeId' in candidate.card).toBe(false);
      }
      // Every text is offered at most once, and ids are neutral, new and unique.
      expect(new Set(candidates.map((c) => n(c.card.displayValue))).size).toBe(candidates.length);
      const maxDeckId = Math.max(...deck.answerCards.map((c) => Number(c.id.slice(1))));
      expect(candidates.every((c) => /^k\d+$/.test(c.card.id) && Number(c.card.id.slice(1)) > maxDeckId)).toBe(true);
      expect(new Set(candidates.map((c) => c.card.id)).size).toBe(candidates.length);
    }
  });

  it('lists cards from the board\u2019s categories first (plausible near-misses), deterministically', () => {
    const deck = deckFor(data, 'subjectToFact', 'solitaire', 3, review);
    const labels = new Set(deck.challenges.map((c) => challengeOf(c.promptText, 'subjectToFact').label));
    const candidates = candidatesOf(provider, deck);
    const firstOther = candidates.findIndex((c) => !labels.has(parseFactText(c.card.displayValue)!.label));
    const lastSame = candidates.map((c) => labels.has(parseFactText(c.card.displayValue)!.label)).lastIndexOf(true);
    if (firstOther !== -1) expect(lastSame).toBeLessThan(firstOther);
    expect(candidatesOf(provider, deck)).toEqual(candidates);
  });

  it('skips texts already in the game anywhere, ignoring case and spacing', () => {
    const deck = deckFor(data, 'subjectToFact', 'solitaire', 1, review);
    const [first] = candidatesOf(provider, deck);
    const earlierPenalty: GeneratedAnswerCard = { id: 'k99', displayValue: `  ${first!.card.displayValue.toUpperCase()} ` };
    const after = candidatesOf(provider, deck, [...deck.answerCards, earlierPenalty]);
    expect(after.some((c) => n(c.card.displayValue) === n(first!.card.displayValue))).toBe(false);
    expect(after.every((c) => Number(c.card.id.slice(1)) > 99)).toBe(true);
  });

  it('through drawPenaltyCards: an exhausted pile is refilled with a reviewed card, without explanation', () => {
    const deck = deckFor(data, 'subjectToFact', 'solitaire', 2, review);
    const result = drawPenaltyCards({ drawPile: [], cardsOutsideDrawPile: deck.answerCards }, [{ playerId: 'human', reason: 'INVALID_ACTION' }], {
      activeChallenges: deck.challenges,
      fallback: provider,
    });
    if (!result.ok) throw new Error('expected a fallback card');
    expect(result.sources).toEqual(['fallback']);
    expect(Object.keys(result.cards[0]!).sort()).toEqual(['displayValue', 'id']);
  });

  it('the engine still bounds the search and stays atomic (limit reached: no card committed)', () => {
    const deck = deckFor(data, 'subjectToFact', 'solitaire', 2, review);
    const result = drawPenaltyCards(
      { drawPile: [], cardsOutsideDrawPile: deck.answerCards },
      [
        { playerId: 'human', reason: 'INVALID_ACTION' },
        { playerId: 'beepy', reason: 'INVALID_ACTION' },
      ],
      { activeChallenges: deck.challenges, fallback: provider, maxCandidates: 1 },
    );
    expect(result.ok).toBe(false);
    if (result.ok || !('exhausted' in result)) throw new Error('expected exhaustion');
    expect(result.exhausted.details.fallback).toMatchObject({ status: 'LIMIT_REACHED', candidatesTried: 1 });
  });
});

describe('C4 fallback: unknown and stale relationships are never offered', () => {
  it.each<[string, TopicCoverage]>([
    ['no reviews', 'none'],
    ['category-only reviews on a mixed-category board', 'category'],
  ])('%s: nothing is offered, so the engine waives the penalty', (_label, coverage) => {
    const data = largeFakeDataset({ diseases: 16, alternatives: 10 });
    const fullReview = reviewFileFor(data, { topics: 'full', alternatives: true });
    // Find a fully reviewed board that spans several categories.
    let deck: GeneratedDeck | undefined;
    for (let seed = 1; seed < 50 && deck === undefined; seed += 1) {
      const candidate = deckFor(data, 'subjectToFact', 'solitaire', seed, fullReview);
      if (new Set(candidate.challenges.map((c) => challengeOf(c.promptText, 'subjectToFact').label)).size > 1) deck = candidate;
    }
    if (deck === undefined) throw new Error('no mixed board found');
    const provider = providerFor(data, 'subjectToFact', coverage === 'none' ? undefined : reviewFileFor(data, { topics: coverage }));
    expect(candidatesOf(provider, deck)).toEqual([]);
    const result = drawPenaltyCards({ drawPile: [], cardsOutsideDrawPile: deck.answerCards }, [{ playerId: 'human', reason: 'INVALID_ACTION' }], {
      activeChallenges: deck.challenges,
      fallback: provider,
    });
    if (result.ok || !('exhausted' in result)) throw new Error('expected exhaustion');
    expect(result.exhausted.details.fallback.status).toBe('EXHAUSTED');
  });

  it('a stale review stops offering what it covered', () => {
    const data = largeFakeDataset({ diseases: 16 });
    const review = reviewFileFor(data, { topics: 'full' });
    const deck = deckFor(data, 'subjectToFact', 'solitaire', 1, review);
    expect(candidatesOf(providerFor(data, 'subjectToFact', review), deck).length).toBeGreaterThan(0);
    // Edit a fact of a topic that is NOT on the board: the single all-topics record goes stale.
    const boardTopics = new Set(deck.challenges.map((c) => c.sourceRef.topicId));
    const offBoard = data.subjects.flatMap((s) => s.topics).find((t) => !boardTopics.has(t.id))!;
    offBoard.corrects[2]!.text = `${offBoard.corrects[2]!.text} edited`;
    expect(candidatesOf(providerFor(data, 'subjectToFact', review), deck)).toEqual([]);
  });

  it('a challenge that does not match the dataset exactly makes the provider offer nothing', () => {
    const data = largeFakeDataset({ diseases: 16 });
    const review = reviewFileFor(data, { topics: 'full' });
    const deck = deckFor(data, 'subjectToFact', 'solitaire', 1, review);
    const tampered = { ...deck, challenges: deck.challenges.map((c, i) => (i === 0 ? { ...c, promptText: `${c.promptText}!` } : c)) };
    expect(candidatesOf(providerFor(data, 'subjectToFact', review), tampered)).toEqual([]);
  });
});

describe('C4 fallback: factToSubject and the Q-1 alternative safeguard', () => {
  const data = largeFakeDataset({ diseases: 16, alternatives: 10 });

  it('with alternative reviews: offers unused disease names and reviewed alternatives, all invalid for the board', () => {
    const review = reviewFileFor(data, { topics: 'full', alternatives: true });
    const provider = providerFor(data, 'factToSubject', review);
    for (const seed of [1, 2, 3, 4]) {
      const deck = deckFor(data, 'factToSubject', 'solitaire', seed, review);
      const boardDiseases = new Set(deck.challenges.map((c) => `Test Disease ${challengeOf(c.promptText, 'factToSubject').disease}`));
      const inGame = new Set(deck.answerCards.map((c) => n(c.displayValue)));
      const names = candidatesOf(provider, deck).map((c) => c.card.displayValue);
      expect(names.length).toBeGreaterThan(0);
      for (const name of names) {
        expect(inGame.has(n(name))).toBe(false);
        expect(boardDiseases.has(name)).toBe(false);
        expect(/^Test (Disease \d+|Alternative Diagnosis \d+)$/.test(name)).toBe(true);
      }
    }
  });

  it('without alternative reviews: alternatives are never offered (Q-1)', () => {
    const withAlternatives = reviewFileFor(data, { topics: 'full', alternatives: true });
    const deck = deckFor(data, 'factToSubject', 'solitaire', 1, withAlternatives);
    const provider = providerFor(data, 'factToSubject', reviewFileFor(data, { topics: 'full' }));
    const names = candidatesOf(provider, deck).map((c) => c.card.displayValue);
    expect(names.length).toBeGreaterThan(0);
    expect(names.some((name) => name.startsWith('Test Alternative'))).toBe(false);
  });

  it('a stale alternative review stops its alternatives from being offered on that disease\u2019s board', () => {
    const local = largeFakeDataset({ diseases: 16, alternatives: 10 });
    const review = reviewFileFor(local, { topics: 'full', alternatives: true });
    let deck: GeneratedDeck | undefined;
    for (let seed = 1; seed < 80 && deck === undefined; seed += 1) {
      const candidate = deckFor(local, 'factToSubject', 'solitaire', seed, review);
      if (candidate.challenges.some((c) => c.sourceRef.subjectId === 'clinical.subject.test-disease-1')) deck = candidate;
    }
    if (deck === undefined) throw new Error('no board with disease 1');
    // An alternative of disease 1 that is NOT in the deck is edited: disease 1's alternative review is stale.
    const inDeck = new Set(deck.answerCards.map((c) => c.displayValue));
    const alt = local.subjects[0]!.subjectIncorrects.find((e) => !inDeck.has(e.text))!;
    alt.text = `${alt.text} renamed`;
    const names = candidatesOf(providerFor(local, 'factToSubject', review), deck).map((c) => c.card.displayValue);
    expect(names.some((name) => name.startsWith('Test Alternative'))).toBe(false);
  });
});
