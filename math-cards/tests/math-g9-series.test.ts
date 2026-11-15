/**
 * M4 G9 (part 2) - the Math series wrapper, used exactly as a UI would.
 *
 * The test agent sees only sanitized views and public events. It chooses moves by
 * doing the arithmetic on the visible text (the independent oracle), never by
 * reading a deck. The step limit is a TEST-ONLY nontermination guard.
 */

import { describe, expect, it } from 'vitest';
import type { ControllerResult, PlayerView, PublicEvent } from '@beepy/shared-engine';
import { createMathSeries, deriveGeneratorSeed, type MathSeries, type MathSeriesConfig, type MathSeriesDiagnostic } from '../src/math-series.js';
import { cardNumber, promptSum, type Direction, type Level, type Mode } from './math-oracle.js';

const TEST_STEP_LIMIT = 3000;
const SECRET_SEED = 987654321;

function seriesFor(config: Partial<MathSeriesConfig> & { mode: Mode; level: Level }): MathSeries {
  const created = createMathSeries({ seed: SECRET_SEED, ...config } as MathSeriesConfig);
  if (!created.ok) throw new Error(`series: ${created.error.code}`);
  return created.series;
}

const okView = (result: ControllerResult | { ok: false; error: { code: string } }): { view: PlayerView; events: readonly PublicEvent[] } => {
  if (!result.ok) throw new Error(`expected success, got ${result.error.code}`);
  return result;
};

const directionOf = (view: PlayerView): Direction =>
  view.challenges[0]!.promptText.startsWith('Which addition expression') ? 'subjectToFact' : 'factToSubject';

const openSums = (view: PlayerView): Map<number, string> => {
  const direction = directionOf(view);
  return new Map(view.challenges.filter((c) => c.status === 'open').map((c) => [promptSum(c.promptText, direction), c.id]));
};

function validAction(view: PlayerView) {
  const direction = directionOf(view);
  const open = openSums(view);
  for (const card of view.hand) {
    const target = open.get(cardNumber(card.displayValue, direction)!);
    if (target !== undefined) return { kind: 'play', handle: card.handle, challengeId: target };
  }
  const card = view.hand.find((c) => !open.has(cardNumber(c.displayValue, direction)!))!;
  return { kind: 'discard', handle: card.handle };
}

function invalidAction(view: PlayerView) {
  const direction = directionOf(view);
  const open = openSums(view);
  const correct = view.hand.find((c) => open.has(cardNumber(c.displayValue, direction)!));
  if (correct !== undefined) return { kind: 'discard', handle: correct.handle };
  return { kind: 'play', handle: view.hand[0]!.handle, challengeId: [...open.values()][0]! };
}

function pendingValid(view: PlayerView): boolean {
  const direction = directionOf(view);
  const p = view.pending!;
  const value = cardNumber(p.card.displayValue, direction)!;
  const open = openSums(view);
  if (p.kind === 'play') return open.get(value) === p.destination;
  return !open.has(value);
}

interface Played {
  readonly views: PlayerView[];
  readonly events: PublicEvent[];
  readonly beepyRulings: boolean[];
  readonly drawsWhilePileEmpty: number;
}

/** Play the current game to the end through the wrapper only. */
function playGame(series: MathSeries, startView: PlayerView, wrongAt: (step: number) => boolean): Played {
  const views: PlayerView[] = [startView];
  const events: PublicEvent[] = [];
  const beepyRulings: boolean[] = [];
  let drawsWhilePileEmpty = 0;
  let view = startView;
  let steps = 0;
  while (view.phase !== 'ended') {
    steps += 1;
    if (steps > TEST_STEP_LIMIT) throw new Error('test-only step limit exceeded');
    const pileWasEmpty = view.drawPileCount === 0;
    let result: ControllerResult;
    if (view.phase === 'awaitingEvaluation') {
      const valid = pendingValid(view);
      beepyRulings.push(valid);
      result = series.decide(valid ? 'accept' : 'challenge');
    } else if (view.activePlayer === 'beepy') {
      result = series.advanceBeepy();
    } else {
      const wrong = wrongAt(steps);
      result = series.submitHumanAction(wrong ? invalidAction(view) : validAction(view));
    }
    const step = okView(result);
    if (pileWasEmpty) drawsWhilePileEmpty += step.events.filter((e) => e.type === 'PENALTY_DRAWN').length;
    events.push(...step.events);
    view = step.view;
    views.push(view);
  }
  return { views, events, beepyRulings, drawsWhilePileEmpty };
}

/** Play the whole series; return everything the UI saw. */
function playSeries(series: MathSeries, wrongAt: (step: number) => boolean): Played & { games: number } {
  const all: Played = { views: [], events: [], beepyRulings: [], drawsWhilePileEmpty: 0 };
  let games = 0;
  for (;;) {
    const status = series.getSeriesStatus();
    if (!status.ok) throw new Error(status.error.code);
    if (status.status.complete) break;
    const started = okView(series.startNextGame());
    games += 1;
    const played = playGame(series, started.view, wrongAt);
    all.views.push(...played.views);
    all.events.push(...started.events, ...played.events);
    all.beepyRulings.push(...played.beepyRulings);
    (all as { drawsWhilePileEmpty: number }).drawsWhilePileEmpty += played.drawsWhilePileEmpty;
  }
  return { ...all, games };
}

const COMBOS: ReadonlyArray<readonly [Mode, Level, Direction]> = [
  ['solitaire', 'oneDigit', 'factToSubject'],
  ['solitaire', 'oneDigit', 'subjectToFact'],
  ['solitaire', 'twoDigit', 'subjectToFact'],
  ['vsBeepy', 'oneDigit', 'factToSubject'],
  ['vsBeepy', 'oneAndTwoDigit', 'subjectToFact'],
  ['vsBeepy', 'mixed', 'factToSubject'],
  ['vsBeepy', 'twoDigit', 'subjectToFact'],
];

describe.each(COMBOS)('a full series through the wrapper: %s / %s / %s', (mode, level, direction) => {
  const series = seriesFor({ mode, level, generationDirection: direction });
  const played = playSeries(series, (step) => step % 4 === 0);

  it('completes: five Solitaire games, or a decided best-of-five match', () => {
    const status = series.getSeriesStatus();
    expect(status.ok).toBe(true);
    if (!status.ok) return;
    expect(status.status.complete).toBe(true);
    if (mode === 'solitaire') {
      expect(played.games).toBe(5);
      expect(status.status.sessionScore).toBe(status.status.gameScores!.reduce((a, b) => a + b, 0));
    } else {
      expect(played.games).toBeGreaterThanOrEqual(3);
      expect(played.games).toBeLessThanOrEqual(5);
      expect(status.status.winner).toBeDefined();
    }
    expect(series.startNextGame()).toMatchObject({ ok: false, error: { code: 'SERIES_COMPLETE' } });
  });

  it('every view shows the approved formats and only unique visible faces', () => {
    for (const view of played.views) {
      for (const challenge of view.challenges) {
        expect(challenge.id).toMatch(/^c\d+$/);
        if (direction === 'factToSubject') expect(challenge.promptText).toMatch(/^\d+ \+ \d+ = \?$/);
        else expect(challenge.promptText).toMatch(/^Which addition expression equals \d+\?$/);
      }
      const visible = [
        ...view.hand.map((c) => c.displayValue),
        ...view.discard.map((c) => c.displayValue),
        ...view.challenges.flatMap((c) => (c.playedCard === undefined ? [] : [c.playedCard.displayValue])),
      ];
      expect(new Set(visible).size).toBe(visible.length);
    }
  });

  it('never exposes deck card ids, the matrix, designations, or the seeds', () => {
    const text = JSON.stringify([played.views, played.events, series.getPublicEvents(), series.getSeriesStatus()]);
    expect(text).not.toMatch(/"m\d+"/);
    for (const word of ['correctAnswerCardId', 'contextualValidity', '"deck"', '"answerCards"', '"drawPile"', '"matrix"']) {
      expect(text).not.toContain(word);
    }
    expect(text).not.toContain(String(SECRET_SEED));
    for (let game = 1; game <= 5; game += 1) {
      expect(text).not.toContain(String(deriveGeneratorSeed(SECRET_SEED, game)));
    }
  });

  it('keeps open challenges free of sourceRef, and reveals it once solved', () => {
    for (const view of played.views) {
      for (const challenge of view.challenges) {
        if (challenge.status === 'open') expect(challenge.sourceRef).toBeUndefined();
        else expect(challenge.sourceRef?.subjectId).toMatch(/^math\.subject\.sum-\d+$/);
      }
    }
  });
});

describe('penalty fallback through the wrapper', () => {
  // The agent errs on three steps in four, so the 10-card Solitaire pile empties
  // and later penalties must come from the direction's fallback. Valid steps still
  // solve challenges, so every game ends.
  it.each(['factToSubject', 'subjectToFact'] as const)('%s: penalties are still drawn after the pile is empty', (direction) => {
    let draws = 0;
    let pileReachedZero = false;
    for (const seed of [1, 2, 3]) {
      const created = createMathSeries({ mode: 'solitaire', level: 'twoDigit', generationDirection: direction, seed });
      if (!created.ok) throw new Error('series');
      const played = playSeries(created.series, (step) => step % 4 !== 0);
      draws += played.drawsWhilePileEmpty;
      pileReachedZero ||= played.views.some((v) => v.drawPileCount === 0);
    }
    expect(pileReachedZero).toBe(true);
    expect(draws).toBeGreaterThan(0);
  });
});

describe('per-game decks and replay', () => {
  it('each game of a series gets a different deck', () => {
    const series = seriesFor({ mode: 'solitaire', level: 'twoDigit' });
    const boards: string[] = [];
    for (let game = 0; game < 5; game += 1) {
      const started = okView(series.startNextGame());
      boards.push(JSON.stringify(started.view.challenges.map((c) => c.promptText)));
      playGame(series, started.view, () => false);
    }
    expect(new Set(boards).size).toBe(5);
  });

  it('derived generator seeds differ per game and are deterministic', () => {
    const seeds = [1, 2, 3, 4, 5].map((g) => deriveGeneratorSeed(42, g));
    expect(new Set(seeds).size).toBe(5);
    expect([1, 2, 3, 4, 5].map((g) => deriveGeneratorSeed(42, g))).toEqual(seeds);
    expect(deriveGeneratorSeed(43, 1)).not.toBe(seeds[0]);
  });

  it('the same seed and the same requests replay the whole series identically', () => {
    const run = () => playSeries(seriesFor({ mode: 'vsBeepy', level: 'mixed', generationDirection: 'subjectToFact' }), (step) => step % 3 === 0);
    const a = run();
    const b = run();
    expect(b.views).toEqual(a.views);
    expect(b.events).toEqual(a.events);
  });
});

describe('Beepy error rate (M4-10)', () => {
  const rulings = (beepyErrorRate?: number) =>
    playSeries(seriesFor({ mode: 'vsBeepy', level: 'oneAndTwoDigit', ...(beepyErrorRate === undefined ? {} : { beepyErrorRate }) }), () => false).beepyRulings;

  it('rate 0: every Beepy action is valid', () => {
    const r = rulings(0);
    expect(r.length).toBeGreaterThan(0);
    expect(r.every((valid) => valid)).toBe(true);
  });

  it('the default (0.2) produces occasional mistakes', () => {
    const r = rulings();
    const mistakes = r.filter((valid) => !valid).length;
    expect(mistakes).toBeGreaterThan(0);
    expect(mistakes / r.length).toBeLessThan(0.45);
  });

  it('a configured rate of 1 makes the first Beepy action a mistake', () => {
    const series = seriesFor({ mode: 'vsBeepy', level: 'oneDigit', beepyErrorRate: 1 });
    const started = okView(series.startNextGame());
    okView(series.submitHumanAction(validAction(started.view)));
    const pending = okView(series.advanceBeepy());
    expect(pendingValid(pending.view)).toBe(false);
  });
});

describe('configuration and failures', () => {
  it.each(['tutor', 'vsPlayer'])('%s is MODE_NOT_SUPPORTED', (mode) => {
    expect(createMathSeries({ mode, level: 'oneDigit', seed: 1 } as never)).toMatchObject({ ok: false, error: { code: 'MODE_NOT_SUPPORTED' } });
  });

  it.each([
    [{ mode: 'speed', level: 'oneDigit', seed: 1 }, 'INVALID_MODE'],
    [{ mode: 'solitaire', level: 'hard', seed: 1 }, 'INVALID_LEVEL'],
    [{ mode: 'solitaire', level: 'oneDigit', seed: 1, generationDirection: 'x' }, 'INVALID_DIRECTION'],
    [{ mode: 'solitaire', level: 'oneDigit', seed: Number.NaN }, 'INVALID_SEED'],
    [{ mode: 'vsBeepy', level: 'oneDigit', seed: 1, beepyErrorRate: 1.5 }, 'INVALID_OPTION'],
    [{ mode: 'vsBeepy', level: 'oneDigit', seed: 1, beepyErrorRate: -0.1 }, 'INVALID_OPTION'],
    [{ mode: 'vsBeepy', level: 'oneDigit', seed: 1, solitaireDeckSize: 12 }, 'INVALID_OPTION'],
    [{ mode: 'solitaire', level: 'oneDigit', seed: 1, solitaireDeckSize: 2.5 }, 'INVALID_OPTION'],
  ])('%j gives %s', (config, code) => {
    const result = createMathSeries(config as never);
    expect(result).toMatchObject({ ok: false, error: { code } });
  });

  it('a null config is INVALID_CONFIG, without throwing', () => {
    expect(() => createMathSeries(null as never)).not.toThrow();
    expect(createMathSeries(null as never)).toMatchObject({ ok: false, error: { code: 'INVALID_CONFIG' } });
  });

  it('a generation failure gives a fixed public error; the full issues go only to diagnostics', () => {
    const diagnostics: MathSeriesDiagnostic[] = [];
    const series = seriesFor({ mode: 'solitaire', level: 'oneDigit', solitaireDeckSize: 3, diagnostics: (d) => diagnostics.push(d) });
    const result = series.startNextGame();
    expect(result).toEqual({ ok: false, error: { code: 'MATH_GENERATION_FAILED', message: 'A new deck could not be prepared for this game.' } });
    const generationDiagnostics = diagnostics.filter((d) => 'generationIssues' in d);
    expect(generationDiagnostics).toHaveLength(1);
    const first = generationDiagnostics[0]!;
    expect('generationIssues' in first && first.generationIssues.map((i) => i.code)).toContain('DECK_BELOW_MINIMUM');
    expect(series.getView()).toMatchObject({ ok: false, error: { code: 'NO_GAME_STARTED' } });
  });

  it('a throwing diagnostics sink changes nothing', () => {
    const series = seriesFor({
      mode: 'solitaire',
      level: 'oneDigit',
      solitaireDeckSize: 3,
      diagnostics: () => {
        throw new Error('logger down');
      },
    });
    expect(series.startNextGame()).toMatchObject({ ok: false, error: { code: 'MATH_GENERATION_FAILED' } });
  });

  it('the series object is frozen and exposes methods only', () => {
    const series = seriesFor({ mode: 'vsBeepy', level: 'oneDigit' });
    expect(Object.isFrozen(series)).toBe(true);
    expect(Object.keys(series).sort()).toEqual(
      ['advanceBeepy', 'decide', 'getPublicEvents', 'getSeriesStatus', 'getView', 'startNextGame', 'submitHumanAction'],
    );
    for (const descriptor of Object.values(Object.getOwnPropertyDescriptors(series))) {
      expect(typeof descriptor.value).toBe('function');
      expect(descriptor.get).toBeUndefined();
    }
    expect(JSON.stringify(series)).toBe('{}');
  });
});
