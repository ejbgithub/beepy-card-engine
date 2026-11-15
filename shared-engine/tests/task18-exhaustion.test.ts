/**
 * Task 18 - draw-pile-exhaustion-reports-condition (Req 7.1, 7.2; Req 6.3; design D6, D6a).
 *
 * Penalty draws are atomic per event: the whole event is supplied or nothing is
 * drawn and `PENALTY_CARD_EXHAUSTED` is returned. The game consequence (waiving the
 * penalty) belongs to the engine milestone; these tests cover the contract only.
 */

import { describe, expect, it } from 'vitest';
import {
  DECK_VALIDATION_CODES as C,
  DEFAULT_MAX_PENALTY_CANDIDATES,
  FALLBACK_REJECTIONS,
  FALLBACK_STATUSES,
  PENALTY_REASONS,
  drawPenaltyCards,
  isStructuredIssue,
  type PenaltyCandidate,
  type PenaltyDrawOptions,
  type PenaltyDrawState,
  type PenaltyFallbackContext,
  type PenaltyReason,
} from '../src/index.js';
import {
  card,
  challengeFor,
  deepFreeze,
  expectExhausted,
  expectSupplied,
  request,
  seededRandom,
} from './fixtures.js';

const active = [challengeFor('c1', 'k1'), challengeFor('c2', 'k2'), challengeFor('c3', 'k3')];
const outside = () => [card('k1', 7), card('k2', 8), card('k3', 9), card('h1', 20), card('h2', 21)];
const state = (pile: ReturnType<typeof card>[] = [], out = outside()): PenaltyDrawState =>
  deepFreeze({ drawPile: pile, cardsOutsideDrawPile: out });
const opts = (extra: Partial<PenaltyDrawOptions> = {}): PenaltyDrawOptions => ({ activeChallenges: active, ...extra });
const cand = (id: string, value: string | number, over: Partial<PenaltyCandidate> = {}): PenaltyCandidate => ({
  card: card(id, value),
  plausible: true,
  validForChallenges: { c1: false, c2: false, c3: false },
  ...over,
});
const providerOf = (list: readonly unknown[]) => ({ candidates: () => list as PenaltyCandidate[] });

describe('penalty constants and registry', () => {
  it('names the reasons, statuses, rejection reasons, default bound, and issue code', () => {
    expect(PENALTY_REASONS).toEqual({ invalidAction: 'INVALID_ACTION', wrongChallenge: 'WRONG_CHALLENGE', missedChallenge: 'MISSED_CHALLENGE' });
    expect(FALLBACK_STATUSES).toEqual({ notAvailable: 'NOT_AVAILABLE', exhausted: 'EXHAUSTED', limitReached: 'LIMIT_REACHED' });
    expect(Object.values(FALLBACK_REJECTIONS).sort()).toEqual(
      ['DUPLICATE_DISPLAY_VALUE', 'DUPLICATE_ID', 'INVALID_VALUE', 'NOT_PLAUSIBLE', 'VALID_FOR_A_CHALLENGE'],
    );
    expect(DEFAULT_MAX_PENALTY_CANDIDATES).toBe(50);
    expect(C.penaltyCardExhausted).toBe('PENALTY_CARD_EXHAUSTED');
  });
});

describe('draw pile first, then a bounded fallback', () => {
  it('draws from the top of the pile and never consults the fallback while the pile suffices', () => {
    let consulted = false;
    const provider = { candidates: () => { consulted = true; return [] as PenaltyCandidate[]; } };
    const result = expectSupplied(drawPenaltyCards(state([card('p1', 30), card('p2', 31)]), [request('student')], opts({ fallback: provider })));
    expect(result.cards.map((c) => c.id)).toEqual(['p1']);
    expect(result.sources).toEqual(['drawPile']);
    expect(result.drawPile.map((c) => c.id)).toEqual(['p2']);
    expect(consulted).toBe(false);
  });

  it('serves several owed draws from the pile in request order', () => {
    const result = expectSupplied(
      drawPenaltyCards(state([card('p1', 30), card('p2', 31)]), [request('human', 'MISSED_CHALLENGE'), request('beepy')], opts()),
    );
    expect(result.cards.map((c) => c.id)).toEqual(['p1', 'p2']);
    expect(result.drawPile).toEqual([]);
  });

  it('uses the pile then the fallback when the pile is one short', () => {
    const result = expectSupplied(
      drawPenaltyCards(state([card('p1', 30)]), [request('a'), request('b')], opts({ fallback: providerOf([cand('f1', 40)]) })),
    );
    expect(result.cards.map((c) => c.id)).toEqual(['p1', 'f1']);
    expect(result.sources).toEqual(['drawPile', 'fallback']);
  });

  it('delivers a fallback card with only an id and a display value', () => {
    const withExplanation = { ...cand('f1', 40), card: { id: 'f1', displayValue: '40', explanationByChallengeId: { c1: 'made up' } } };
    const result = expectSupplied(drawPenaltyCards(state(), [request('a')], opts({ fallback: providerOf([withExplanation]) })));
    expect(Object.keys(result.cards[0] ?? {}).sort()).toEqual(['displayValue', 'id']);
  });

  it('owes nothing, supplies nothing', () => {
    const result = expectSupplied(drawPenaltyCards(state([card('p1', 30)]), [], opts()));
    expect(result.cards).toEqual([]);
    expect(result.drawPile).toHaveLength(1);
  });

  it('hands the provider the active challenges, every card in the game, and the numeric flag', () => {
    let seen: PenaltyFallbackContext | undefined;
    const provider = { candidates: (context: PenaltyFallbackContext) => { seen = context; return [] as PenaltyCandidate[]; } };
    drawPenaltyCards(state([card('p1', 30)]), [request('a'), request('b')], opts({ fallback: provider, numericAnswers: true }));
    expect(seen?.activeChallenges).toBe(active);
    expect(seen?.usedCards).toHaveLength(6);
    expect(seen?.numericAnswers).toBe(true);
  });
});

describe('the PENALTY_CARD_EXHAUSTED condition (D6, D6a)', () => {
  it('is reported with no fallback at all as NOT_AVAILABLE', () => {
    const payload = expectExhausted(drawPenaltyCards(state(), [request('student')], opts()));
    expect(payload.code).toBe('PENALTY_CARD_EXHAUSTED');
    expect(payload.path).toBe('drawPile');
    expect(payload.details.requests).toEqual([request('student')]);
    expect(payload.details.drawPileRemaining).toBe(0);
    expect(payload.details.cardsInPlay).toBe(5);
    expect(payload.details.fallback).toEqual({ status: 'NOT_AVAILABLE', candidatesTried: 0, maxCandidates: 50, rejections: {} });
    expect(payload.message).toContain('No card was drawn, created, or reused');
    expect(isStructuredIssue(payload)).toBe(true);
  });

  it('returns no cards and no new draw pile on failure', () => {
    const result = drawPenaltyCards(state(), [request('student')], opts());
    expect(result.ok).toBe(false);
    expect('cards' in result).toBe(false);
    expect('drawPile' in result).toBe(false);
  });

  it('is EXHAUSTED when the provider simply runs out', () => {
    const payload = expectExhausted(drawPenaltyCards(state(), [request('a')], opts({ fallback: providerOf([]) })));
    expect(payload.details.fallback.status).toBe('EXHAUSTED');
    expect(payload.details.fallback.candidatesTried).toBe(0);
  });

  it('holds counts and request metadata only: no card ids or faces', () => {
    const secret = [card('hidden-card-id', 'SECRET-FACT-XYZ'), card('k1', 7), card('k2', 8), card('k3', 9)];
    const payload = expectExhausted(drawPenaltyCards(state([], secret), [request('beepy')], opts()));
    const json = JSON.stringify(payload);
    expect(json).not.toContain('SECRET-FACT-XYZ');
    expect(json).not.toContain('hidden-card-id');
    expect(json).not.toContain('"k1"');
  });

  it('keeps every request, in order, with its reason (a missed challenge owes two draws)', () => {
    const requests = [request('human', 'MISSED_CHALLENGE'), request('beepy', 'INVALID_ACTION')];
    const payload = expectExhausted(drawPenaltyCards(state([card('p1', 30)]), requests, opts()));
    expect(payload.details.requests).toEqual(requests);
    expect(payload.details.drawPileRemaining).toBe(1);
  });

  it.each(Object.values(PENALTY_REASONS))('records the %s reason', (reason: PenaltyReason) => {
    const payload = expectExhausted(drawPenaltyCards(state(), [request('p', reason)], opts()));
    expect(payload.details.requests[0]?.reason).toBe(reason);
  });
});

describe('candidate rejection reasons (Decision 3)', () => {
  const rows: ReadonlyArray<readonly [string, unknown, string]> = [
    ['a duplicate display value', cand('f1', 7), 'DUPLICATE_DISPLAY_VALUE'],
    ['a duplicate id', cand('k1', 99), 'DUPLICATE_ID'],
    ['an implausible value', cand('f3', 41, { plausible: false }), 'NOT_PLAUSIBLE'],
    ['a valid answer to an active challenge', cand('f4', 42, { validForChallenges: { c1: true, c2: false, c3: false } }), 'VALID_FOR_A_CHALLENGE'],
    ['a blank value', cand('f5', '  '), 'INVALID_VALUE'],
    ['a blank id', cand('', 45), 'INVALID_VALUE'],
    ['a candidate not evaluated against every challenge', cand('f6', 43, { validForChallenges: { c1: false, c2: false } }), 'INVALID_VALUE'],
    ['a non-boolean evaluation', cand('f7', 44, { validForChallenges: { c1: false, c2: false, c3: 'no' as never } }), 'INVALID_VALUE'],
    ['a candidate that is not an object', null, 'INVALID_VALUE'],
    ['a candidate with no evaluation', { card: card('f8', 46), plausible: true }, 'INVALID_VALUE'],
    ['a candidate with no card', { plausible: true, validForChallenges: { c1: false, c2: false, c3: false } }, 'INVALID_VALUE'],
  ];

  it.each(rows)('rejects %s', (_label, candidate, reason) => {
    const payload = expectExhausted(drawPenaltyCards(state(), [request('a')], opts({ fallback: providerOf([candidate]) })));
    expect(payload.details.fallback.status).toBe('EXHAUSTED');
    expect(payload.details.fallback.candidatesTried).toBe(1);
    expect(payload.details.fallback.rejections).toEqual({ [reason]: 1 });
  });

  it('counts every rejection by reason across a mixed list', () => {
    const payload = expectExhausted(drawPenaltyCards(state(), [request('a')], opts({ fallback: providerOf(rows.map((row) => row[1])) })));
    expect(payload.details.fallback.candidatesTried).toBe(rows.length);
    expect(payload.details.fallback.rejections).toEqual({
      DUPLICATE_DISPLAY_VALUE: 1,
      DUPLICATE_ID: 1,
      NOT_PLAUSIBLE: 1,
      VALID_FOR_A_CHALLENGE: 1,
      INVALID_VALUE: 7,
    });
  });

  it('records one reason per candidate, checking validity, then id, then value, then plausibility', () => {
    const everythingWrong = cand('k1', 7, { plausible: false, validForChallenges: { c1: true, c2: false, c3: false } });
    expect(expectExhausted(drawPenaltyCards(state(), [request('a')], opts({ fallback: providerOf([everythingWrong]) }))).details.fallback.rejections).toEqual({ DUPLICATE_ID: 1 });
    const valueAndPlausibility = cand('f1', 7, { plausible: false });
    expect(expectExhausted(drawPenaltyCards(state(), [request('a')], opts({ fallback: providerOf([valueAndPlausibility]) }))).details.fallback.rejections).toEqual({ DUPLICATE_DISPLAY_VALUE: 1 });
  });

  it('delivers the first eligible candidate after rejecting the ones before it', () => {
    const list = [cand('f1', 7), cand('f2', 40, { plausible: false }), cand('f3', 41)];
    expect(expectSupplied(drawPenaltyCards(state(), [request('a')], opts({ fallback: providerOf(list) }))).cards[0]?.id).toBe('f3');
  });

  it('text mode: case and whitespace variants of a used value are duplicates', () => {
    const text = [card('k1', 'Fever'), card('k2', 'Rash'), card('k3', 'Cough')];
    const payload = expectExhausted(drawPenaltyCards(state([], text), [request('a')], opts({ fallback: providerOf([cand('f1', '  fever '), cand('f2', 'FEVER')]) })));
    expect(payload.details.fallback.rejections).toEqual({ DUPLICATE_DISPLAY_VALUE: 2 });
  });

  it('numeric mode: "007" duplicates 7 and "seven" is invalid; text mode accepts "007"', () => {
    const numeric = drawPenaltyCards(state(), [request('a')], opts({ numericAnswers: true, fallback: providerOf([cand('f1', '007'), cand('f2', 'seven'), cand('f3', 10)]) }));
    expect(expectSupplied(numeric).cards[0]?.displayValue).toBe('10');
    const text = drawPenaltyCards(state(), [request('a')], opts({ fallback: providerOf([cand('f1', '007')]) }));
    expect(expectSupplied(text).cards[0]?.displayValue).toBe('007');
  });

  it('counts draw-pile cards as used, by id and by value', () => {
    const payload = expectExhausted(
      drawPenaltyCards(state([card('p1', 30)]), [request('a'), request('b')], opts({ fallback: providerOf([cand('f1', 30), cand('p1', 55)]) })),
    );
    expect(payload.details.fallback.rejections).toEqual({ DUPLICATE_DISPLAY_VALUE: 1, DUPLICATE_ID: 1 });
    expect(payload.details.drawPileRemaining).toBe(1);
  });

  it('keeps candidates accepted earlier in the same event unique', () => {
    const sameValue = drawPenaltyCards(state(), [request('a'), request('b')], opts({ fallback: providerOf([cand('f1', 50), cand('f2', 50), cand('f3', 51)]) }));
    expect(expectSupplied(sameValue).cards.map((c) => c.id)).toEqual(['f1', 'f3']);
    const sameId = drawPenaltyCards(state(), [request('a'), request('b')], opts({ fallback: providerOf([cand('f1', 50), cand('f1', 52), cand('f4', 53)]) }));
    expect(expectSupplied(sameId).cards.map((c) => c.id)).toEqual(['f1', 'f4']);
  });
});

describe('bounded attempts', () => {
  function endless(counter: { read: number }) {
    return {
      *candidates(): Generator<PenaltyCandidate> {
        for (let i = 0; ; i += 1) {
          counter.read += 1;
          yield cand(`bad-${i}`, 100 + i, { plausible: false });
        }
      },
    };
  }

  it('stops an endless provider at the default of 50', () => {
    const counter = { read: 0 };
    const payload = expectExhausted(drawPenaltyCards(state(), [request('a')], opts({ fallback: endless(counter) })));
    expect(payload.details.fallback).toMatchObject({ status: 'LIMIT_REACHED', candidatesTried: 50, maxCandidates: 50 });
    expect(payload.details.fallback.rejections).toEqual({ NOT_PLAUSIBLE: 50 });
    expect(counter.read).toBe(50);
  });

  it.each([1, 3, 10, 75])('honours a configured bound of %i', (bound) => {
    const counter = { read: 0 };
    const payload = expectExhausted(drawPenaltyCards(state(), [request('a')], opts({ fallback: endless(counter), maxCandidates: bound })));
    expect(payload.details.fallback).toMatchObject({ status: 'LIMIT_REACHED', candidatesTried: bound, maxCandidates: bound });
    expect(counter.read).toBe(bound);
  });

  it('counts accepted candidates toward the bound, so a bound too small for the event fails atomically', () => {
    const payload = expectExhausted(
      drawPenaltyCards(state(), [request('a'), request('b')], opts({ fallback: providerOf([cand('f1', 50), cand('f2', 51)]), maxCandidates: 1 })),
    );
    expect(payload.details.fallback).toMatchObject({ status: 'LIMIT_REACHED', candidatesTried: 1 });
  });

  it('succeeds when the one owed card is found within a bound of 1', () => {
    expect(expectSupplied(drawPenaltyCards(state(), [request('a')], opts({ fallback: providerOf([cand('f1', 50)]), maxCandidates: 1 }))).cards[0]?.id).toBe('f1');
  });

  it('always closes the provider iterator, whatever the outcome', () => {
    let closed = 0;
    const provider = (list: PenaltyCandidate[]) => ({
      *candidates(): Generator<PenaltyCandidate> {
        try { yield* list; } finally { closed += 1; }
      },
    });
    drawPenaltyCards(state(), [request('a')], opts({ fallback: provider([cand('f1', 50)]) })); // success
    drawPenaltyCards(state(), [request('a')], opts({ fallback: provider([]) })); // exhausted
    drawPenaltyCards(state(), [request('a')], opts({ fallback: provider([cand('f1', 50)]), maxCandidates: 1 })); // success at the bound
    drawPenaltyCards(state(), [request('a'), request('b')], opts({ fallback: provider([cand('f1', 50), cand('f2', 51)]), maxCandidates: 1 })); // limit
    expect(closed).toBe(4);
  });

  it.each([0, -1, 1.5, NaN, Infinity, '50'])('rejects a maxCandidates of %s as invalid, not as exhaustion', (bad) => {
    const result = drawPenaltyCards(state(), [request('a')], opts({ maxCandidates: bad as number }));
    expect(result.ok).toBe(false);
    expect('invalid' in result && !('exhausted' in result)).toBe(true);
    if (!result.ok && 'invalid' in result) {
      expect(result.invalid).toEqual(expect.objectContaining({ code: C.invalidCount, path: 'maxCandidates' }));
    }
  });
});

describe('atomic rollback: all owed cards or none', () => {
  it('a short pile and an empty fallback draw nothing, change nothing, and leave the pile card available', () => {
    const s = state([card('p1', 30)]);
    const before = JSON.stringify(s);
    const failure = drawPenaltyCards(s, [request('a'), request('b')], opts({ fallback: providerOf([]) }));
    const payload = expectExhausted(failure);
    expect(payload.details.drawPileRemaining).toBe(1);
    expect(JSON.stringify(s)).toBe(before);
    const again = expectSupplied(drawPenaltyCards(s, [request('a')], opts()));
    expect(again.cards.map((c) => c.id)).toEqual(['p1']);
  });

  it('one fallback card found for two owed returns no partial result, and the candidate stays usable', () => {
    const s = state();
    const list = [cand('f1', 50)];
    const failure = drawPenaltyCards(s, [request('a'), request('b')], opts({ fallback: providerOf(list) }));
    expectExhausted(failure);
    expect('cards' in failure).toBe(false);
    const later = expectSupplied(drawPenaltyCards(s, [request('a')], opts({ fallback: providerOf(list) })));
    expect(later.cards.map((c) => c.id)).toEqual(['f1']);
  });

  it('never mutates its inputs (deeply frozen state and a frozen request list)', () => {
    const s = state([card('p1', 30), card('p2', 31)]);
    const requests = deepFreeze([request('a'), request('b'), request('c')]);
    expect(() => drawPenaltyCards(s, requests, opts({ fallback: providerOf([cand('f1', 50)]) }))).not.toThrow();
    expect(() => drawPenaltyCards(s, requests, opts())).not.toThrow();
  });

  it('is deterministic', () => {
    const run = () => JSON.stringify(drawPenaltyCards(state([card('p1', 30)]), [request('a'), request('b')], opts({ fallback: providerOf([cand('f1', 50)]) })));
    expect(run()).toBe(run());
  });
});

describe('randomized events against an independent oracle', () => {
  it('agrees on every event, never delivers a duplicate, and never exceeds the bound (4000 events)', () => {
    const random = seededRandom(18);
    let supplied = 0;
    let exhausted = 0;
    for (let run = 0; run < 4000; run += 1) {
      const usedValues = new Set<number>();
      while (usedValues.size < 3 + Math.floor(random() * 8)) usedValues.add(Math.floor(random() * 41));
      const out = [...usedValues].map((v, i) => card(`o${i}`, v));
      const pile = Array.from({ length: Math.floor(random() * 4) }, (_, i) => card(`p${i}`, 41 + i));
      const challenges = [challengeFor('c1', 'o0'), challengeFor('c2', 'o1')];
      const list: PenaltyCandidate[] = Array.from({ length: Math.floor(random() * 13) }, (_, j) => {
        const k = random();
        return {
          card: card(k < 0.1 ? 'o0' : k < 0.15 ? 'p0' : `f${j}`, Math.floor(random() * 70)),
          plausible: random() > 0.15,
          validForChallenges: { c1: random() < 0.1, c2: random() < 0.1 },
        };
      });
      const owed = 1 + Math.floor(random() * 3);
      const bound = 1 + Math.floor(random() * 15);
      const requests = Array.from({ length: owed }, (_, i) => request(`pl${i}`));
      const result = drawPenaltyCards({ drawPile: pile, cardsOutsideDrawPile: out }, requests, {
        activeChallenges: challenges,
        fallback: providerOf(list),
        maxCandidates: bound,
        numericAnswers: true,
      });

      // Independent oracle.
      const need = owed - Math.min(owed, pile.length);
      const ids = new Set([...pile, ...out].map((c) => c.id));
      const values = new Set([...pile, ...out].map((c) => Number(c.displayValue)));
      let got = 0;
      for (let i = 0; i < Math.min(bound, list.length) && got < need; i += 1) {
        const c = list[i] as PenaltyCandidate;
        const eligible = c.plausible && !c.validForChallenges.c1 && !c.validForChallenges.c2 && !ids.has(c.card.id) && !values.has(Number(c.card.displayValue));
        if (eligible) { got += 1; ids.add(c.card.id); values.add(Number(c.card.displayValue)); }
      }
      expect(result.ok).toBe(got >= need);

      if (result.ok) {
        supplied += 1;
        expect(result.cards).toHaveLength(owed);
        const existingIds = new Set([...pile, ...out].map((c) => c.id));
        const existingValues = new Set([...pile, ...out].map((c) => Number(c.displayValue)));
        const seenIds = new Set<string>();
        const seenValues = new Set<number>();
        result.cards.forEach((c, i) => {
          if (result.sources[i] === 'drawPile') {
            expect(c.id).toBe(pile[i]?.id);
          } else {
            expect(existingIds.has(c.id)).toBe(false);
            expect(existingValues.has(Number(c.displayValue))).toBe(false);
            const source = list.find((x) => x.card.id === c.id && x.card.displayValue === c.displayValue);
            expect(source?.plausible).toBe(true);
            expect(source?.validForChallenges.c1).toBe(false);
            expect(source?.validForChallenges.c2).toBe(false);
          }
          expect(seenIds.has(c.id)).toBe(false);
          expect(seenValues.has(Number(c.displayValue))).toBe(false);
          seenIds.add(c.id);
          seenValues.add(Number(c.displayValue));
        });
      } else {
        exhausted += 1;
        expect('cards' in result).toBe(false);
        const payload = expectExhausted(result);
        expect(payload.details.fallback.candidatesTried).toBeLessThanOrEqual(bound);
      }
    }
    expect(supplied).toBeGreaterThan(200);
    expect(exhausted).toBeGreaterThan(200);
  });
});
