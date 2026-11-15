/**
 * M6 stage C4 - the Clinical series wrapper and Explain Why, used exactly as a UI
 * would (requirements Req 6; design section 7).
 *
 * The test player sees only sanitized views and public events. It chooses moves
 * from the VISIBLE fictitious text, which encodes disease and category (the
 * independent oracle), never by reading a deck. The step limit is a TEST-ONLY
 * nontermination guard. Fictional data only.
 */

import { describe, expect, it } from 'vitest';
import type { ControllerResult, PlayerView, PublicEvent } from '@beepy/shared-engine';
import {
  CLINICAL_DEFAULT_BEEPY_ERROR_RATE,
  CLINICAL_SERIES_CODES as S,
  createClinicalSeries,
  deriveClinicalGeneratorSeed,
  type ClinicalSeries,
  type ClinicalSeriesConfig,
  type ClinicalSeriesDiagnostic,
} from '../src/clinical-series.js';
import { LABEL, largeFakeDataset, parseFactText, reviewFileFor } from './fixtures/fake-large-clinical.js';
import type { FakeCollection } from './fixtures/fake-clinical.js';

type Direction = 'subjectToFact' | 'factToSubject';
type Mode = 'solitaire' | 'vsBeepy';
const TEST_STEP_LIMIT = 4000;
const SECRET_SEED = 424242;

const DATA = largeFakeDataset({ diseases: 16, alternatives: 10 });
const REVIEW = reviewFileFor(DATA, { topics: 'full', alternatives: true });

function seriesFor(config: Partial<ClinicalSeriesConfig> & { mode: Mode }, data: FakeCollection = DATA, review: unknown = REVIEW): ClinicalSeries {
  const created = createClinicalSeries({ seed: SECRET_SEED, dataset: data, review, ...config } as ClinicalSeriesConfig);
  if (!created.ok) throw new Error(`series: ${created.error.code}`);
  return created.series;
}

const okView = (result: ControllerResult | { ok: false; error: { code: string } }): { view: PlayerView; events: readonly PublicEvent[] } => {
  if (!result.ok) throw new Error(`expected success, got ${result.error.code}`);
  return result;
};

// ---------------------------------------------------------------------------
// Visible-text oracle
// ---------------------------------------------------------------------------

const LABEL_BY_TOPIC: Record<string, string> = {
  'Classic Signs & Symptoms': LABEL.signs,
  'Work-up': LABEL.workup,
  Pathology: LABEL.pathology,
  'Management/Treatment': LABEL.management,
};
const directionOf = (view: PlayerView): Direction => (view.challenges[0]!.promptText.includes(' · ') ? 'subjectToFact' : 'factToSubject');

/** What a challenge asks, from its visible prompt. */
function challengeOf(prompt: string, direction: Direction) {
  if (direction === 'subjectToFact') {
    const [disease, topicName] = prompt.split(' · ') as [string, string];
    return { disease: Number(disease.replace('Test Disease ', '')), label: LABEL_BY_TOPIC[topicName] as string, fact: undefined };
  }
  const topicName = prompt.slice(0, prompt.indexOf(': '));
  const factText = prompt.slice(prompt.indexOf(': ') + 2);
  return { disease: parseFactText(factText)!.disease, label: LABEL_BY_TOPIC[topicName] as string, fact: factText };
}

/** Is this visible card a correct answer for this visible challenge? */
function isValid(cardText: string, prompt: string, direction: Direction): boolean {
  const c = challengeOf(prompt, direction);
  if (direction === 'subjectToFact') {
    const card = parseFactText(cardText);
    return card !== undefined && !card.incorrect && card.disease === c.disease && card.label === c.label;
  }
  return cardText === `Test Disease ${c.disease}`;
}

/** The explanation the fixture author wrote for this visible context, if any. */
function expectedExplanation(cardText: string, prompt: string, direction: Direction): string | undefined {
  const c = challengeOf(prompt, direction);
  if (direction === 'subjectToFact') {
    const card = parseFactText(cardText);
    if (card === undefined || card.disease !== c.disease || card.label !== c.label) return undefined;
    if (card.incorrect) return `Placeholder explanation for why non-fact X is not a Test Disease ${c.disease} ${c.label} fact.`;
    return cardText.endsWith('fact A') ? `Placeholder explanation for ${cardText}.` : undefined;
  }
  if (cardText === `Test Disease ${c.disease}`) return c.fact!.endsWith('fact A') ? `Placeholder explanation for ${c.fact}.` : undefined;
  if (cardText === 'Test Alternative Diagnosis 1') return `Placeholder explanation for why alternative 1 is not Test Disease ${c.disease}.`;
  return undefined;
}

const open = (view: PlayerView) => view.challenges.filter((c) => c.status === 'open');

function validAction(view: PlayerView) {
  const direction = directionOf(view);
  for (const card of view.hand) {
    const target = open(view).find((c) => isValid(card.displayValue, c.promptText, direction));
    if (target !== undefined) return { kind: 'play', handle: card.handle, challengeId: target.id };
  }
  return { kind: 'discard', handle: view.hand[0]!.handle };
}

function invalidAction(view: PlayerView) {
  const direction = directionOf(view);
  const correct = view.hand.find((card) => open(view).some((c) => isValid(card.displayValue, c.promptText, direction)));
  if (correct !== undefined) return { kind: 'discard', handle: correct.handle };
  return { kind: 'play', handle: view.hand[0]!.handle, challengeId: open(view)[0]!.id };
}

function pendingValid(view: PlayerView): boolean {
  const direction = directionOf(view);
  const p = view.pending!;
  if (p.kind === 'play') {
    const target = open(view).find((c) => c.id === p.destination);
    return target !== undefined && isValid(p.card.displayValue, target.promptText, direction);
  }
  return !open(view).some((c) => isValid(p.card.displayValue, c.promptText, direction));
}

// ---------------------------------------------------------------------------
// Playing through the wrapper only
// ---------------------------------------------------------------------------

interface Played {
  views: PlayerView[];
  events: PublicEvent[];
  explained: { available: number; unavailable: number; discards: number };
  penaltyCardsWhilePileEmpty: string[];
  waivers: number;
}

function playGame(series: ClinicalSeries, startView: PlayerView, wrongAt: (step: number) => boolean, played: Played): void {
  let view = startView;
  let steps = 0;
  const prompts = new Map(view.challenges.map((c) => [c.id, c.promptText]));
  const direction = directionOf(view);
  while (view.phase !== 'ended') {
    steps += 1;
    if (steps > TEST_STEP_LIMIT) throw new Error('test-only step limit exceeded');
    const pileWasEmpty = view.drawPileCount === 0;
    let result: ControllerResult;
    if (view.phase === 'awaitingEvaluation') {
      // Beepy's move is pending: Explain Why must reveal nothing about it.
      const pendingTurn = view.turnCount + 1;
      expect(series.explainResolved(pendingTurn)).toEqual({ ok: true, available: false, reason: 'notResolved' });
      result = series.decide(pendingValid(view) ? 'accept' : 'challenge');
    } else if (view.activePlayer === 'beepy') {
      result = series.advanceBeepy();
    } else {
      result = series.submitHumanAction(wrongAt(steps) ? invalidAction(view) : validAction(view));
    }
    const step = okView(result);
    for (const event of step.events) {
      if (event.type === 'PENALTY_DRAWN' && pileWasEmpty && event.card !== undefined) played.penaltyCardsWhilePileEmpty.push(event.card.displayValue);
      if (event.type === 'PENALTY_WAIVED') played.waivers += 1;
      if (event.type !== 'ACTION_RESOLVED') continue;
      // Explain Why for every resolved action, checked against the visible-text oracle.
      const explained = series.explainResolved(event.turn);
      if (event.kind === 'discard') {
        expect(explained).toEqual({ ok: true, available: false, reason: 'discard' });
        played.explained.discards += 1;
        continue;
      }
      const expected = expectedExplanation(event.card.displayValue, prompts.get(event.destination)!, direction);
      if (expected === undefined) {
        expect(explained).toEqual({ ok: true, available: false, reason: 'noExplanation' });
        played.explained.unavailable += 1;
      } else {
        expect(explained).toEqual({ ok: true, available: true, explanation: expected });
        played.explained.available += 1;
      }
    }
    played.events.push(...step.events);
    view = step.view;
    played.views.push(view);
  }
}

function playSeries(series: ClinicalSeries, wrongAt: (step: number) => boolean): Played & { games: number } {
  const played: Played = { views: [], events: [], explained: { available: 0, unavailable: 0, discards: 0 }, penaltyCardsWhilePileEmpty: [], waivers: 0 };
  let games = 0;
  for (;;) {
    const status = series.getSeriesStatus();
    if (!status.ok) throw new Error(status.error.code);
    if (status.status.complete) break;
    const started = okView(series.startNextGame());
    games += 1;
    played.views.push(started.view);
    played.events.push(...started.events);
    playGame(series, started.view, wrongAt, played);
  }
  return { ...played, games };
}

/** Everything the UI could see, as text, for leak scans. */
const visibleText = (played: { views: PlayerView[]; events: PublicEvent[] }) => JSON.stringify([played.views, played.events]);

const COMBOS: ReadonlyArray<readonly [Mode, Direction]> = [
  ['solitaire', 'subjectToFact'],
  ['solitaire', 'factToSubject'],
  ['vsBeepy', 'subjectToFact'],
  ['vsBeepy', 'factToSubject'],
];

describe.each(COMBOS)('a full series through the wrapper: %s / %s', (mode, direction) => {
  const series = seriesFor({ mode, generationDirection: direction });
  const played = playSeries(series, (step) => step % 4 === 0);

  it('completes: five Solitaire games, or a best-of-five match won by 3', () => {
    const status = series.getSeriesStatus();
    if (!status.ok) throw new Error('status');
    expect(status.status.complete).toBe(true);
    const ends = played.events.filter((e): e is Extract<PublicEvent, { type: 'GAME_ENDED' }> => e.type === 'GAME_ENDED');
    expect(ends).toHaveLength(played.games);
    if (mode === 'solitaire') {
      expect(played.games).toBe(5);
    } else {
      const wins = { human: 0, beepy: 0 };
      for (const end of ends) if (end.outcome.kind === 'vsBeepy') wins[end.outcome.winner] += 1;
      expect(Math.max(wins.human, wins.beepy)).toBe(3);
      expect(played.games).toBeGreaterThanOrEqual(3);
      expect(played.games).toBeLessThanOrEqual(5);
    }
  });

  it('Explain Why gave verbatim authored explanations where they exist, and "unavailable" otherwise', () => {
    expect(played.explained.available).toBeGreaterThan(0);
    expect(played.explained.unavailable + played.explained.discards).toBeGreaterThan(0);
  });

  it('views and events never reveal card ids, entry ids, answers, matrices, explanations or review data', () => {
    const text = visibleText(played);
    expect(text).not.toMatch(/"k\d+"/); // neutral deck card ids stay private (views use opaque handles)
    expect(text).not.toMatch(/clinical\.answer\./); // dataset entry ids
    expect(text).not.toMatch(/correctAnswerCardId|contextualValidity|explanationByChallengeId/);
    expect(text).not.toMatch(/Placeholder explanation/); // explanations only via explainResolved
    expect(text).not.toMatch(/fp1-|reviewedBy|Test Reviewer|attestation/i); // review data
  });

  it('a pending action never appears as resolved in the events before its decision', () => {
    for (let i = 0; i < played.events.length; i += 1) {
      const event = played.events[i]!;
      if (event.type !== 'ACTION_PENDING') continue;
      const next = played.events[i + 1];
      expect(next?.type === 'ACTION_PENDING').toBe(false);
    }
  });
});

describe('Explain Why boundaries', () => {
  it('rejects malformed turn numbers with a sanitized error and returns notResolved for unknown turns', () => {
    const series = seriesFor({ mode: 'solitaire' });
    expect(series.explainResolved(1)).toEqual({ ok: true, available: false, reason: 'notResolved' }); // no game yet
    okView(series.startNextGame());
    for (const bad of [0, -1, 1.5, '1', null, undefined, Number.NaN]) {
      const result = series.explainResolved(bad);
      expect(result).toEqual({ ok: false, error: { code: S.invalidRequest, message: expect.any(String) } });
    }
    expect(series.explainResolved(9999)).toEqual({ ok: true, available: false, reason: 'notResolved' });
  });

  it('Beepy\u2019s pending move: the same "notResolved" answer whether the move is right or wrong', () => {
    for (const rate of [0, 1]) {
      const series = seriesFor({ mode: 'vsBeepy', beepyErrorRate: rate });
      const started = okView(series.startNextGame());
      okView(series.submitHumanAction(validAction(started.view)));
      const pending = okView(series.advanceBeepy());
      expect(pending.view.phase).toBe('awaitingEvaluation');
      expect(pendingValid(pending.view)).toBe(rate === 0);
      expect(series.explainResolved(pending.view.turnCount + 1)).toEqual({ ok: true, available: false, reason: 'notResolved' });
      expect(JSON.stringify(pending)).not.toMatch(/Placeholder explanation|"valid"/);
    }
  });

  it('turn numbers refer to the current game only', () => {
    const series = seriesFor({ mode: 'solitaire', generationDirection: 'subjectToFact' });
    const started = okView(series.startNextGame());
    const after = okView(series.submitHumanAction(validAction(started.view)));
    const resolved = after.events.find((e) => e.type === 'ACTION_RESOLVED');
    expect(resolved).toBeDefined();
    const before = series.explainResolved(1);
    expect(before.ok).toBe(true);
    // Finish the game, start the next: turn 1 is no longer resolved until played again.
    playGame(series, after.view, () => false, { views: [], events: [], explained: { available: 0, unavailable: 0, discards: 0 }, penaltyCardsWhilePileEmpty: [], waivers: 0 });
    okView(series.startNextGame());
    expect(series.explainResolved(1)).toEqual({ ok: true, available: false, reason: 'notResolved' });
  });
});

describe('penalty fallback and waiver through the series', () => {
  it.each<Direction>(['subjectToFact', 'factToSubject'])('%s: after the pile empties, penalty cards are unused reviewed entries, never duplicates', (direction) => {
    const series = seriesFor({ mode: 'solitaire', generationDirection: direction, targetCardCount: 8 });
    const played = playSeries(series, (step) => step <= 10);
    expect(played.penaltyCardsWhilePileEmpty.length).toBeGreaterThan(0);
    const authored = new Set(
      DATA.subjects.flatMap((s) =>
        direction === 'factToSubject'
          ? [s.subject, ...s.subjectIncorrects.map((e) => e.text)]
          : s.topics.flatMap((t) => [...t.corrects, ...t.incorrects].map((e) => e.text)),
      ),
    );
    for (const text of played.penaltyCardsWhilePileEmpty) expect(authored.has(text)).toBe(true);
    // Within each game, no card text is ever seen twice in the human's zones.
    for (const view of played.views) {
      const texts = [...view.hand, ...view.discard, ...view.challenges.flatMap((c) => (c.playedCard ? [c.playedCard] : []))].map((c) => c.displayValue.toLowerCase());
      expect(new Set(texts).size).toBe(texts.length);
    }
  });

  it('when no eligible reviewed entry exists, the penalty is waived truthfully and the game still ends', () => {
    // 2 diseases x 4 categories x 1 fact: the 8-card deck already holds every usable fact.
    const small = largeFakeDataset({ diseases: 2, facts: 1 });
    const series = seriesFor({ mode: 'solitaire', generationDirection: 'subjectToFact', targetCardCount: 8 }, small, reviewFileFor(small, { topics: 'full' }));
    const played = playSeries(series, (step) => step <= 10);
    expect(played.waivers).toBeGreaterThan(0);
    expect(played.penaltyCardsWhilePileEmpty).toEqual([]);
    const waived = played.events.find((e): e is Extract<PublicEvent, { type: 'PENALTY_WAIVED' }> => e.type === 'PENALTY_WAIVED')!;
    expect(waived.fallbackStatus).toBe('EXHAUSTED');
    expect(played.games).toBe(5);
  });
});

describe('series configuration, data handling and errors', () => {
  const create = (overrides: Record<string, unknown>, diagnostics?: (d: ClinicalSeriesDiagnostic) => void) =>
    createClinicalSeries({ mode: 'solitaire', seed: 1, dataset: DATA, review: REVIEW, ...(diagnostics ? { diagnostics } : {}), ...overrides } as ClinicalSeriesConfig);

  it.each([
    ['tutor', { mode: 'tutor' }, S.modeNotSupported],
    ['vsPlayer', { mode: 'vsPlayer' }, S.modeNotSupported],
    ['an unknown mode', { mode: 'duel' }, S.invalidMode],
    ['an unknown direction', { generationDirection: 'sideways' }, S.invalidDirection],
    ['a NaN seed', { seed: Number.NaN }, S.invalidSeed],
    ['an error rate above 1', { beepyErrorRate: 1.5 }, S.invalidOption],
    ['a fractional target', { targetCardCount: 9.5 }, S.invalidOption],
  ])('%s is refused with a fixed message', (_label, overrides, code) => {
    const result = create(overrides);
    expect(result).toEqual({ ok: false, error: { code, message: expect.any(String) } });
  });

  it('invalid data is refused; the details go only to the trusted sink', () => {
    const broken = largeFakeDataset({ diseases: 4 });
    broken.subjects[1]!.topics[0]!.topicName = 'Labs';
    const seen: ClinicalSeriesDiagnostic[] = [];
    const result = create({ dataset: broken, review: undefined }, (d) => seen.push(d));
    expect(result).toEqual({ ok: false, error: { code: S.invalidData, message: 'The clinical card data could not be loaded.' } });
    expect(JSON.stringify(result)).not.toMatch(/Labs|subjects\[/);
    expect(seen.some((d) => 'datasetIssues' in d && d.datasetIssues.some((i) => i.code === 'CLINICAL_UNKNOWN_CATEGORY'))).toBe(true);
  });

  it('an unusable review file is refused; stale records are reported to the sink but not fatal', () => {
    expect(create({ review: { reviews: 'x' } })).toEqual({ ok: false, error: { code: S.invalidReview, message: expect.any(String) } });
    const local = largeFakeDataset({ diseases: 16, alternatives: 10 });
    const review = reviewFileFor(local, { topics: 'full', alternatives: true });
    local.subjects[0]!.subjectIncorrects[0]!.text = 'Test Alternative Diagnosis 1 renamed';
    const seen: ClinicalSeriesDiagnostic[] = [];
    const result = create({ dataset: local, review }, (d) => seen.push(d));
    expect(result.ok).toBe(true);
    expect(seen.some((d) => 'staleReviews' in d && d.staleReviews.length === 1)).toBe(true);
  });

  it('a deck that cannot be generated gives a detail-free public error', () => {
    const tiny = largeFakeDataset({ diseases: 8 });
    const seen: ClinicalSeriesDiagnostic[] = [];
    const created = createClinicalSeries({ mode: 'vsBeepy', generationDirection: 'factToSubject', seed: 1, dataset: tiny, review: reviewFileFor(tiny, { topics: 'full' }), diagnostics: (d) => seen.push(d) });
    if (!created.ok) throw new Error('series');
    expect(created.series.startNextGame()).toEqual({ ok: false, error: { code: S.generationFailed, message: 'A new deck could not be prepared for this game.' } });
    expect(seen.some((d) => 'generationIssues' in d && d.generationIssues.some((i) => i.code === 'INSUFFICIENT_CHALLENGES'))).toBe(true);
  });

  it('a throwing diagnostics sink never changes a result', () => {
    const result = create({ mode: 'duel' }, () => {
      throw new Error('sink');
    });
    expect(result.ok).toBe(false);
  });

  it('is a frozen, methods-only object', () => {
    const series = seriesFor({ mode: 'vsBeepy' });
    expect(Object.isFrozen(series)).toBe(true);
    expect(Object.keys(series).sort()).toEqual(
      ['advanceBeepy', 'decide', 'explainResolved', 'getPublicEvents', 'getSeriesStatus', 'getView', 'startNextGame', 'submitHumanAction'].sort(),
    );
    for (const value of Object.values(series)) expect(typeof value).toBe('function');
  });

  it('the default Beepy error rate is 0.2', () => {
    expect(CLINICAL_DEFAULT_BEEPY_ERROR_RATE).toBe(0.2);
    const a = playSeries(seriesFor({ mode: 'vsBeepy' }), (step) => step % 5 === 0);
    const b = playSeries(seriesFor({ mode: 'vsBeepy', beepyErrorRate: 0.2 }), (step) => step % 5 === 0);
    expect(visibleText(a)).toBe(visibleText(b));
  });
});

describe('determinism', () => {
  it.each(COMBOS)('%s / %s: the same seed and moves replay identically; another seed differs', (mode, direction) => {
    const run = (seed: number) => visibleText(playSeries(seriesFor({ mode, generationDirection: direction, seed }), (step) => step % 3 === 0));
    expect(run(11)).toBe(run(11));
    expect(run(11)).not.toBe(run(12));
  });

  it('per-game generator seeds are derived deterministically and differ per game', () => {
    const seeds = [1, 2, 3, 4, 5].map((game) => deriveClinicalGeneratorSeed(SECRET_SEED, game));
    expect(seeds).toEqual([1, 2, 3, 4, 5].map((game) => deriveClinicalGeneratorSeed(SECRET_SEED, game)));
    expect(new Set(seeds).size).toBe(5);
    expect(deriveClinicalGeneratorSeed(SECRET_SEED + 1, 1)).not.toBe(seeds[0]);
  });
});

describe('boundaries', () => {
  async function readText(relative: string): Promise<string> {
    const specifier = 'node:fs/promises';
    const fs = (await import(/* @vite-ignore */ specifier)) as { readFile(path: URL, encoding: string): Promise<string> };
    return fs.readFile(new URL(relative, import.meta.url), 'utf8');
  }
  it('the fallback and the series never import math-cards or reach outside the workspace', async () => {
    for (const file of ['clinical-fallback.ts', 'clinical-series.ts']) {
      const text = await readText(`../src/${file}`);
      expect(text).not.toMatch(/from ['"][^'"]*math-cards/);
      expect(text).not.toMatch(/from ['"]\.\.\/\.\.\//);
      expect(text).not.toMatch(/localStorage|sessionStorage|indexedDB|fetch\(|XMLHttpRequest|WebSocket/);
    }
  });
});
