/**
 * M5 U11 - privacy and information visibility (requirements 8, 11.2).
 *
 * What is checked here is the UI's ORDINARY DATA PATH: views, board models, public
 * events, feedback text, accessible labels, drag targets, and the UI source code.
 * This is a client-side game, so the deck also lives in page memory and can be
 * inspected with browser developer tools; nothing here claims otherwise.
 *
 * Ground truth for hidden cards: a test-only MIRROR of the engine. The series
 * wrapper is deterministic, so the same deck (from the same derived seed) and the
 * same requests replayed through the M3 pure core reproduce Beepy's hidden hand at
 * every step. The UI layers are then checked never to show any of those faces.
 */

import { describe, expect, it } from 'vitest';
import type { ControllerResult, PlayerView, PublicEvent } from '@beepy/shared-engine';
import { createReferenceBeepyStrategy } from '@beepy/shared-engine';
import { advanceBeepy, createGameState, evaluatePending, submitAction } from '../../shared-engine/src/game/game.js';
import type { EngineState } from '../../shared-engine/src/game/types.js';
import { deriveGeneratorSeed, MATH_DEFAULT_BEEPY_ERROR_RATE } from '../src/math-series.js';
import { generateMathDeck } from '../src/math-generator.js';
import { plausibleRangeOf } from '../src/levels.js';
import { createMathPenaltyFallbackProvider } from '../src/penalty-fallback.js';
import { createMathExpressionFallbackProvider } from '../src/expression-fallback.js';
import { toBoardModel, type BoardModel } from '../src/ui/board-model.js';
import { FEEDBACK_TEXT, toFeedback } from '../src/ui/feedback.js';
import { createGameSession, type Scheduler } from '../src/ui/session.js';
import { invalidAction, pendingValid, seriesFor, validAction, type HumanRequest } from './ui-helpers.js';

type Step = { view: PlayerView; events: readonly PublicEvent[] };
const ok = (result: ControllerResult | { ok: false; error: { code: string } }): Step => {
  if (!result.ok) throw new Error(`expected success, got ${result.error.code}`);
  return result;
};
const okState = (result: { ok: true; state: EngineState } | { ok: false; error: { code: string } }): EngineState => {
  if (!result.ok) throw new Error(`mirror failed: ${result.error.code}`);
  return result.state;
};

/** Every card face a board model shows, from its face-carrying fields only. */
function shownFaces(model: BoardModel): string[] {
  return [
    ...model.hand.map((c) => c.face),
    ...model.challenges.flatMap((c) => (c.playedFace === undefined ? [] : [c.playedFace])),
    ...(model.discard.topFace === undefined ? [] : [model.discard.topFace]),
    ...(model.pending === undefined ? [] : [model.pending.face]),
    ...model.newCards.map((c) => c.face),
    ...(model.selectedFace === undefined ? [] : [model.selectedFace]),
  ];
}

const FIXED_FEEDBACK = new Set<string>(Object.values(FEEDBACK_TEXT));
const isAllowedFeedback = (text: string): boolean =>
  FIXED_FEEDBACK.has(text) ||
  /^(You|Beepy) drew \d+ cards?\.$/.test(text) ||
  /^Game over! Your score is \d+\.$/.test(text) ||
  text === 'You win this game!' ||
  text === 'Beepy wins this game.';

describe("U11-1 Beepy's hidden cards never reach the ordinary interface (engine mirror)", () => {
  it.each([
    ['factToSubject', 'oneDigit', 3],
    ['factToSubject', 'twoDigit', 8],
    ['subjectToFact', 'oneAndTwoDigit', 5],
    ['subjectToFact', 'mixed', 13],
  ] as const)('%s / %s, seed %i: whole game 1 checked at every step', (direction, level, seed) => {
    const series = seriesFor({ mode: 'vsBeepy', level, generationDirection: direction, seed });
    // The mirror: same deck, same options, same strategy, same requests.
    const generated = generateMathDeck({ mode: 'vsBeepy', level, generationDirection: direction, seed: deriveGeneratorSeed(seed, 1) });
    if (!generated.ok) throw new Error('deck');
    const range = plausibleRangeOf(level);
    const fallback = generated.numericAnswers
      ? createMathPenaltyFallbackProvider({ minValue: range.min, maxValue: range.max })
      : createMathExpressionFallbackProvider({ level });
    const strategy = createReferenceBeepyStrategy({ errorRate: MATH_DEFAULT_BEEPY_ERROR_RATE });
    if (!strategy.ok) throw new Error('strategy');
    let mirror = okState(
      createGameState({
        mode: 'vsBeepy',
        deck: generated.deck,
        contextualValidity: generated.contextualValidity,
        seed,
        gameIndex: 1,
        options: { numericAnswers: generated.numericAnswers, fallback },
      }),
    );

    let step = ok(series.startNextGame());
    let checks = 0;
    let beepyCardsHidden = 0;
    for (let n = 0; n < 2000 && step.view.phase !== 'ended'; n += 1) {
      const view = step.view;
      const faceOf = (id: string) => mirror.cards[id]!.displayValue;
      // The mirror is aligned with the real game.
      expect(view.hand.map((c) => c.displayValue)).toEqual(mirror.hands.human.map(faceOf));
      expect(view.opponentHandCount).toBe(mirror.hands.beepy.length);

      const pendingFace = view.pending?.card.displayValue;
      const hidden = new Set(mirror.hands.beepy.map(faceOf).filter((face) => face !== pendingFace));
      for (const id of mirror.drawPile) hidden.add(faceOf(id));
      beepyCardsHidden += hidden.size;

      const model = toBoardModel(view, { newCardHandles: toFeedback(step.events).newCardHandles });
      for (const face of shownFaces(model)) expect(hidden.has(face), `hidden face shown: ${face}`).toBe(false);
      for (const card of model.hand) expect(card.ariaLabel).toMatch(new RegExp(`^Card ${card.face.replace(/[+]/g, '\\+')}(, selected)?$`));
      expect(model.beepy?.cardCount).toBe(mirror.hands.beepy.length);
      for (const item of toFeedback(step.events).items) expect(isAllowedFeedback(item.text), item.text).toBe(true);
      // Public events never carry Beepy's drawn card faces.
      for (const event of step.events) {
        if (event.type === 'PENALTY_DRAWN' && event.player === 'beepy') expect('card' in event).toBe(false);
      }
      checks += 1;

      // Advance both the real game and the mirror with the same request.
      if (view.phase === 'awaitingEvaluation') {
        const decision = pendingValid(view) === (n % 3 !== 0) ? 'accept' : 'challenge';
        step = ok(series.decide(decision));
        mirror = okState(evaluatePending(mirror, decision));
      } else if (view.activePlayer === 'beepy') {
        step = ok(series.advanceBeepy());
        mirror = okState(advanceBeepy(mirror, strategy.strategy));
      } else {
        const request: HumanRequest = n % 4 === 0 ? invalidAction(view) : validAction(view);
        step = ok(series.submitHumanAction(request));
        mirror = okState(submitAction(mirror, { player: 'human', ...request }));
      }
    }
    expect(step.view.phase).toBe('ended');
    expect(checks).toBeGreaterThan(5);
    expect(beepyCardsHidden).toBeGreaterThan(0);
  });
});

describe("U11-2 nothing reveals whether Beepy's pending move is correct", () => {
  /** View, model, and feedback for a pending move, with only the card and destination removed. */
  function pendingSnapshot(seed: number, beepyErrorRate: number, direction: 'factToSubject' | 'subjectToFact') {
    const series = seriesFor({ mode: 'vsBeepy', level: 'oneAndTwoDigit', generationDirection: direction, seed, beepyErrorRate });
    const start = ok(series.startNextGame());
    ok(series.submitHumanAction(validAction(start.view)));
    const pending = ok(series.advanceBeepy());
    const model = toBoardModel(pending.view);
    const feedback = toFeedback(pending.events);
    const valid = pendingValid(pending.view);
    const strip = (value: unknown): unknown => JSON.parse(JSON.stringify(value), (key, v) =>
      ['pending', 'card', 'face', 'wide', 'destination', 'destinationLabel', 'destinationDisplay', 'isDiscard', 'kind'].includes(key) ? undefined : v,
    );
    return { valid, model, view: strip(pending.view), board: strip(model), events: strip(pending.events), feedback };
  }

  it.each(['factToSubject', 'subjectToFact'] as const)('%s: views, models, events, and feedback are identical for a right and a wrong move', (direction) => {
    for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
      const right = pendingSnapshot(seed, 0, direction);
      const wrong = pendingSnapshot(seed, 1, direction);
      expect(right.valid).toBe(true);
      expect(wrong.valid).toBe(false);
      expect(wrong.view).toEqual(right.view);
      expect(wrong.board).toEqual(right.board);
      expect(wrong.events).toEqual(right.events);
      expect(wrong.feedback).toEqual(right.feedback);
      expect(right.feedback.items.map((i) => i.text)).toEqual([FEEDBACK_TEXT.beepyPending]);
    }
  });

  it('while a decision is pending: no drag or tap targets, the human cannot act, both buttons are available', () => {
    for (const rate of [0, 1]) {
      const { model } = pendingSnapshot(4, rate, 'factToSubject');
      expect(model.canAct).toBe(false);
      expect(model.challenges.every((c) => !c.target)).toBe(true);
      expect(model.discard.target).toBe(false);
      expect(model.hand.every((c) => !c.enabled && !c.selected)).toBe(true);
      expect(model.pending?.canDecide).toBe(true);
      expect(JSON.stringify(model)).not.toMatch(/correct|wrong|right|valid|invalid/i);
    }
  });

  it("Beepy's thinking time does not depend on whether its move will be right", () => {
    for (const rate of [0, 1]) {
      const delays: number[] = [];
      const scheduler: Scheduler = {
        after(ms) {
          delays.push(ms);
          return () => undefined;
        },
      };
      // The session uses the default Beepy rate; the delay is a single constant either way.
      const created = createGameSession({ settings: { mode: 'vsBeepy', level: 'oneDigit', direction: 'factToSubject' }, seed: 20 + rate, scheduler });
      if (!created.ok) throw new Error('session');
      const s = created.session.snapshot();
      const play = validAction(s.view!);
      created.session.select(play.handle);
      if (play.kind === 'play') created.session.playOn(play.challengeId);
      else created.session.discard();
      expect(delays).toEqual([1000]);
    }
  });
});

describe('U11-3 no personal information, storage, or network use; no seed exposure', () => {
  const tsSources = import.meta.glob('../src/ui/**/*.ts', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;
  const code = (text: string) => text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  const entries = Object.entries(tsSources).map(([file, text]) => [file, code(text)] as const);

  async function readSource(relative: string): Promise<string> {
    const specifier = 'node:fs/promises';
    const fs = (await import(/* @vite-ignore */ specifier)) as { readFile(path: URL, encoding: string): Promise<string> };
    return fs.readFile(new URL(relative, import.meta.url), 'utf8');
  }

  it('reads every UI source file', () => {
    expect(entries.length).toBeGreaterThanOrEqual(13);
    expect(entries.every(([, text]) => text.length > 0)).toBe(true);
  });

  it.each([
    ['browser storage', /\b(localStorage|sessionStorage|indexedDB|caches)\b|document\.cookie/],
    ['network requests', /\bfetch\s*\(|XMLHttpRequest|WebSocket|EventSource|sendBeacon|navigator\.(geolocation|mediaDevices)/],
    ['URL changes', /history\.(pushState|replaceState)|location\.(hash|search|href)\s*=/],
    ['unsafe markup or code', /innerHTML|outerHTML|insertAdjacentHTML|\beval\s*\(|new Function\s*\(/],
    ['free-text input fields', /type:\s*'(text|email|search|tel|password)'|contenteditable/i],
  ])('no %s anywhere in the UI code', (_name, pattern) => {
    for (const [file, text] of entries) expect(text, file).not.toMatch(pattern);
  });

  it('the page and stylesheet load nothing from other sites', async () => {
    const html = await readSource('../index.html');
    const css = await readSource('../src/ui/styles.css');
    expect(html.length).toBeGreaterThan(100);
    expect(html).not.toMatch(/https?:\/\//);
    expect(css).not.toMatch(/@import|url\(\s*['"]?https?:/);
  });

  it('a session snapshot never contains the series seed or a derived generator seed', () => {
    const seed = 987654321;
    const created = createGameSession({
      settings: { mode: 'vsBeepy', level: 'twoDigit', direction: 'factToSubject' },
      seed,
      scheduler: { after: () => () => undefined },
    });
    if (!created.ok) throw new Error('session');
    const text = JSON.stringify(created.session.snapshot());
    expect(text).not.toContain(String(seed));
    for (let game = 1; game <= 5; game += 1) expect(text).not.toContain(String(deriveGeneratorSeed(seed, game)));
    expect(Object.keys(created.session.snapshot())).not.toContain('seed');
  });
});

describe('U11-4 architecture boundary of the UI code', () => {
  const tsSources = import.meta.glob('../src/ui/**/*.ts', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;
  const stripComments = (text: string) => text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  const byFile = Object.entries(tsSources).map(([file, text]) => [file.replace('../src/ui/', ''), stripComments(text)] as const);

  /** Runtime (non-type) imports: [specifier, names]. */
  function runtimeImports(text: string): Array<{ from: string; names: string[] }> {
    const out: Array<{ from: string; names: string[] }> = [];
    for (const m of text.matchAll(/^import\s+(type\s+)?\{([^}]*)\}\s+from\s+'([^']+)';/gm)) {
      if (m[1] !== undefined) continue;
      const names = m[2]!.split(',').map((s) => s.trim()).filter((s) => s !== '' && !s.startsWith('type '));
      if (names.length > 0) out.push({ from: m[3]!, names });
    }
    return out;
  }

  it('the UI never imports engine internals, the generator, levels, or fallback code at runtime', () => {
    for (const [file, text] of byFile) {
      expect(text, file).not.toMatch(/shared-engine\/src/);
      for (const imp of runtimeImports(text)) {
        const allowed =
          imp.from.startsWith('./') ||
          (imp.from.startsWith('../') && !imp.from.startsWith('../../') && file.includes('/') && !imp.from.startsWith('../math') && !imp.from.startsWith('../levels')) ||
          (imp.from === '../math-series.js' && file === 'session.ts');
        expect(allowed, `${file} imports { ${imp.names.join(', ')} } from ${imp.from}`).toBe(true);
      }
    }
  });

  it('only session.ts creates the series, and only seed.ts reads a random source', () => {
    for (const [file, text] of byFile) {
      if (file !== 'session.ts') expect(text, file).not.toMatch(/\bcreateMathSeries\s*\(/);
      if (file !== 'seed.ts') expect(text, file).not.toMatch(/getRandomValues|Math\.random/);
    }
    expect(byFile.find(([f]) => f === 'session.ts')![1]).toMatch(/\bcreateMathSeries\s*\(/);
    expect(byFile.find(([f]) => f === 'seed.ts')![1]).toMatch(/getRandomValues/);
  });

  it('the UI does no judging, answer computation, or deck handling', () => {
    for (const [file, text] of byFile) {
      expect(text, file).not.toMatch(
        /\b(parseExpression|canonicalNumber|judgeAction|generateMathDeck|validateDeckForPlay|drawPenaltyCards|correctAnswerCardId|contextualValidity|createSeriesController)\b/,
      );
    }
  });

  it('diagnostics are connected only in development builds', () => {
    const main = byFile.find(([f]) => f === 'main.ts')![1];
    expect(main).toMatch(/isDevBuild\s*\?/);
    expect(main).toMatch(/env\?\.DEV === true/);
    for (const [file, text] of byFile) {
      if (file !== 'main.ts') expect(text, file).not.toMatch(/console\.(log|debug|info|warn|error)/);
    }
  });
});
