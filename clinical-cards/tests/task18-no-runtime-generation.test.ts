/**
 * Task 18 - Clinical never generates clinical facts or explanations at runtime
 * (Req 7.1, 7.2; Req 6.3; Decision 3 and Decision 4; originality-and-copyright steering).
 *
 * Clinical fallback content must be pre-authored and reviewed. With no provider the
 * fallback status is NOT_AVAILABLE and no card is created. Since M6 C4 the Clinical
 * fallback exists (decision C-4) and only re-offers unused authored, reviewed entries;
 * the obsolete "no fallback module" test is replaced by tests of that property
 * (decision C-9). Everything below uses obviously fake placeholder text: no clinical
 * facts are invented.
 */

import { describe, expect, it } from 'vitest';
import {
  drawPenaltyCards,
  type GeneratedAnswerCard,
  type PenaltyCandidate,
  type PenaltyDrawResult,
} from '@beepy/shared-engine';
import { ClinicalDeckGenerator } from '../src/clinical-generator.js';
import { createClinicalFallbackProvider } from '../src/clinical-fallback.js';
import { validateClinicalCollection } from '../src/clinical-content.js';
import { validateReviewFile } from '../src/clinical-review.js';
import { largeFakeDataset, reviewFileFor } from './fixtures/fake-large-clinical.js';

const card = (id: string, displayValue: string): GeneratedAnswerCard => ({ id, displayValue });
const challenge = (id: string, correctAnswerCardId: string) => ({
  id,
  promptText: id,
  correctAnswerCardId,
  sourceRef: { subjectId: 'clinical.subject.test' },
});
const active = [challenge('c1', 'k1'), challenge('c2', 'k2'), challenge('c3', 'k3')];
const inPlay = (): GeneratedAnswerCard[] => [
  card('k1', 'Test finding 1'),
  card('k2', 'Test finding 2'),
  card('k3', 'Test finding 3'),
  card('h1', 'Test distractor 1'),
  card('h2', 'Test distractor 2'),
];
const reserveCard = (id: string, text: string, over: Partial<PenaltyCandidate> = {}): PenaltyCandidate => ({
  card: card(id, text),
  plausible: true,
  validForChallenges: { c1: false, c2: false, c3: false },
  ...over,
});
const draw = (options: { fallback?: { candidates: () => PenaltyCandidate[] }; drawPile?: GeneratedAnswerCard[] } = {}): PenaltyDrawResult =>
  drawPenaltyCards(
    { drawPile: options.drawPile ?? [], cardsOutsideDrawPile: inPlay() },
    [{ playerId: 'student', reason: 'INVALID_ACTION' }],
    { activeChallenges: active, ...(options.fallback === undefined ? {} : { fallback: options.fallback }) },
  );

describe('Clinical does not generate content at runtime', () => {
  // M6 C4 (decision C-9): the earlier test "ships no penalty or fallback generation
  // module" is replaced. A fallback now exists by design (decision C-4), so the
  // module-name check became obsolete. These tests check the property it protected
  // directly: the fallback creates nothing and only re-offers authored, reviewed text.
  it('has exactly one fallback module, and no other module that could produce penalty or reserve content', () => {
    const modules = Object.keys(import.meta.glob('../src/*.ts'));
    expect(modules.length).toBeGreaterThan(0);
    const suspicious = modules.filter((path) => /penalty|fallback|reserve|generat.*(fact|explanation)/i.test(path.replace(/clinical-generator\.ts$/, '')));
    expect(suspicious).toEqual(['../src/clinical-fallback.ts']);
  });

  it('property: the Clinical fallback, through the real penalty draw, only delivers unused authored text', () => {
    const data = largeFakeDataset({ diseases: 12, alternatives: 4 });
    const review = reviewFileFor(data, { topics: 'full', alternatives: true });
    const collection = validateClinicalCollection(data);
    if (!collection.ok) throw new Error('fixture invalid');
    for (const direction of ['subjectToFact', 'factToSubject'] as const) {
      const authored = new Set(
        data.subjects.flatMap((s) =>
          direction === 'factToSubject'
            ? [s.subject, ...s.subjectIncorrects.map((e) => e.text)]
            : s.topics.flatMap((t) => [...t.corrects, ...t.incorrects].map((e) => e.text)),
        ),
      );
      const provider = createClinicalFallbackProvider({ collection: collection.collection, direction, review: validateReviewFile(review, collection.collection) });
      for (let seed = 1; seed <= 15; seed += 1) {
        const generated = new ClinicalDeckGenerator().generate({
          source: data as never,
          config: { app: 'clinical', generationDirection: direction },
          mode: 'solitaire',
          challengeCount: 5,
          targetCardCount: 15,
          seed,
          review,
        });
        if (!generated.ok) throw new Error(JSON.stringify(generated.issues));
        const inGame = new Set(generated.deck.answerCards.map((c) => c.displayValue.trim().toLowerCase()));
        const result = drawPenaltyCards(
          { drawPile: [], cardsOutsideDrawPile: generated.deck.answerCards },
          [
            { playerId: 'human', reason: 'INVALID_ACTION' },
            { playerId: 'beepy', reason: 'INVALID_ACTION' },
          ],
          { activeChallenges: generated.deck.challenges, fallback: provider },
        );
        if (!result.ok) continue; // a waiver is allowed; inventing a card is not
        for (const card of result.cards) {
          expect(authored.has(card.displayValue)).toBe(true);
          expect(inGame.has(card.displayValue.trim().toLowerCase())).toBe(false);
          expect(Object.keys(card).sort()).toEqual(['displayValue', 'id']);
        }
        expect(new Set(result.cards.map((c) => c.displayValue)).size).toBe(result.cards.length);
      }
    }
  });

  it('with no fallback source, an exhausted draw pile reports NOT_AVAILABLE and creates no card', () => {
    const result = draw();
    expect(result.ok).toBe(false);
    if (result.ok || !('exhausted' in result)) throw new Error('expected exhaustion');
    expect(result.exhausted.details.fallback).toMatchObject({ status: 'NOT_AVAILABLE', candidatesTried: 0 });
    expect('cards' in result).toBe(false);
  });

  it('with an empty reserve it reports EXHAUSTED and still creates no card', () => {
    const result = draw({ fallback: { candidates: () => [] } });
    if (result.ok || !('exhausted' in result)) throw new Error('expected exhaustion');
    expect(result.exhausted.details.fallback.status).toBe('EXHAUSTED');
    expect('cards' in result).toBe(false);
  });

  it('delivers a pre-authored reserve card exactly as supplied, adding nothing', () => {
    const result = draw({ fallback: { candidates: () => [reserveCard('reserve-1', 'Reviewed reserve text A')] } });
    if (!result.ok) throw new Error('expected the reserve card');
    expect(result.cards).toEqual([{ id: 'reserve-1', displayValue: 'Reviewed reserve text A' }]);
    expect(result.sources).toEqual(['fallback']);
  });

  it('drops contextual explanations from a reserve card instead of carrying or inventing them', () => {
    const withExplanation = {
      ...reserveCard('reserve-1', 'Reviewed reserve text A'),
      card: { id: 'reserve-1', displayValue: 'Reviewed reserve text A', explanationByChallengeId: { c1: 'unrelated explanation' } },
    };
    const result = draw({ fallback: { candidates: () => [withExplanation] } });
    if (!result.ok) throw new Error('expected the reserve card');
    expect(Object.keys(result.cards[0] ?? {}).sort()).toEqual(['displayValue', 'id']);
  });

  it('still rejects reviewed reserve content that repeats a card in play (case and spacing do not hide it)', () => {
    const result = draw({ fallback: { candidates: () => [reserveCard('reserve-1', '  TEST FINDING 2 '), reserveCard('reserve-2', 'test distractor 1')] } });
    if (result.ok || !('exhausted' in result)) throw new Error('expected exhaustion');
    expect(result.exhausted.details.fallback.rejections).toEqual({ DUPLICATE_DISPLAY_VALUE: 2 });
  });

  it('still rejects reviewed reserve content that is a valid answer to an active challenge', () => {
    const result = draw({ fallback: { candidates: () => [reserveCard('reserve-1', 'Reviewed reserve text B', { validForChallenges: { c1: false, c2: true, c3: false } })] } });
    if (result.ok || !('exhausted' in result)) throw new Error('expected exhaustion');
    expect(result.exhausted.details.fallback.rejections).toEqual({ VALID_FOR_A_CHALLENGE: 1 });
  });

  it('property: every delivered card was supplied by the pile or the reserve - the engine never makes one up', () => {
    let state = 0x2018;
    const random = () => {
      state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
      return state / 4294967296;
    };
    for (let run = 0; run < 1000; run += 1) {
      const pile = Array.from({ length: Math.floor(random() * 3) }, (_, i) => card(`pile-${i}`, `Pile text ${i}`));
      const reserve = Array.from({ length: Math.floor(random() * 6) }, (_, i) =>
        reserveCard(`reserve-${i}`, random() < 0.3 ? 'Test finding 1' : `Reserve text ${i}`, { plausible: random() > 0.2 }),
      );
      const owed = 1 + Math.floor(random() * 3);
      const result = drawPenaltyCards(
        { drawPile: pile, cardsOutsideDrawPile: inPlay() },
        Array.from({ length: owed }, (_, i) => ({ playerId: `p${i}`, reason: 'INVALID_ACTION' as const })),
        { activeChallenges: active, fallback: { candidates: () => reserve } },
      );
      if (!result.ok) continue;
      const supplied = new Set([...pile.map((c) => c.id), ...reserve.map((c) => c.card.id)]);
      expect(result.cards.every((c) => supplied.has(c.id))).toBe(true);
      expect(new Set(result.cards.map((c) => c.id)).size).toBe(result.cards.length);
    }
  });
});

describe('Clinical generator boundary (Task 5; real generator since M6 C3, decision C-9)', () => {
  // M6 C3 (decision C-9): the stub assertion is replaced by stronger checks on the real
  // generator. It never creates clinical content: every card face, every clinical part
  // of a prompt, and every explanation is copied verbatim from the authored source.
  const data = largeFakeDataset({ diseases: 12, alternatives: 4 });
  const review = reviewFileFor(data, { topics: 'full', alternatives: true });
  const authoredTexts = new Set(
    data.subjects.flatMap((s) => [
      s.subject,
      ...s.subjectIncorrects.map((e) => e.text),
      ...s.topics.flatMap((t) => [...t.corrects, ...t.incorrects].map((e) => e.text)),
    ]),
  );
  const authoredExplanations = new Set(
    data.subjects.flatMap((s) => [...s.subjectIncorrects, ...s.topics.flatMap((t) => [...t.corrects, ...t.incorrects])].flatMap((e) => (e.explanation === undefined ? [] : [e.explanation]))),
  );

  it('rejects malformed requests with structured failures, no deck, no throw', () => {
    const generator = new ClinicalDeckGenerator();
    expect(generator.app).toBe('clinical');
    for (const request of [{} as never, null as never, undefined as never]) {
      let result: ReturnType<ClinicalDeckGenerator['generate']> | undefined;
      expect(() => {
        result = generator.generate(request);
      }).not.toThrow();
      expect(result?.ok).toBe(false);
      expect(result && 'deck' in result).toBe(false);
    }
  });

  it('property: every card face and explanation in a generated deck is authored source text, verbatim', () => {
    for (const mode of ['solitaire', 'vsBeepy'] as const) {
      for (const direction of ['subjectToFact', 'factToSubject'] as const) {
        for (let seed = 1; seed <= 25; seed += 1) {
          const result = new ClinicalDeckGenerator().generate({
            source: data as never,
            config: { app: 'clinical', generationDirection: direction },
            mode,
            challengeCount: mode === 'solitaire' ? 5 : 9,
            targetCardCount: mode === 'solitaire' ? 15 : 24,
            seed,
            review,
          });
          if (!result.ok) throw new Error(JSON.stringify(result.issues));
          for (const card of result.deck.answerCards) {
            expect(authoredTexts.has(card.displayValue)).toBe(true);
            for (const explanation of Object.values(card.explanationByChallengeId ?? {})) expect(authoredExplanations.has(explanation)).toBe(true);
          }
          for (const challenge of result.deck.challenges) {
            const clinicalPart = direction === 'subjectToFact' ? challenge.promptText.split(' · ')[0] : challenge.promptText.slice(challenge.promptText.indexOf(': ') + 2);
            expect(authoredTexts.has(clinicalPart as string)).toBe(true);
          }
        }
      }
    }
  });
});
