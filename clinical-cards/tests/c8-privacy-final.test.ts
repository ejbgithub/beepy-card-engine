/**
 * M6 C8 - privacy and final automated tests (tasks.md C8: "Mirror M5 U11/U12").
 *
 * U11 mirror (privacy): Beepy's hidden cards never reach the ordinary interface
 * (checked against a test-only engine MIRROR); nothing reveals whether Beepy's
 * pending move is correct; no storage, network, URL changes or unsafe markup; no seed
 * exposure; the UI's architecture boundary.
 * U12 mirror (final): penalty exhaustion in real games; keyboard reachability;
 * touch (a cancelled pointer never plays); reduced motion and breakpoints; accessible
 * names. C8 additions: WCAG contrast of the Clinical theme colors, and the layout
 * fixes found by in-browser measurement during C8.
 *
 * This is a client-side game, so the deck also lives in page memory and can be seen
 * with developer tools; nothing here claims otherwise. Real screen-reader output,
 * real touch devices and real keyboard use are the owner's checks.
 * Data: the SHIPPED, owner-reviewed dataset (read only). No clinical content is created.
 */

import { describe, expect, it } from 'vitest';
import { createReferenceBeepyStrategy, normalizeDisplayText, type ControllerResult, type PlayerView, type PublicEvent, type SubjectCollection } from '@beepy/shared-engine';
import { advanceBeepy, createGameState, evaluatePending, submitAction } from '../../shared-engine/src/game/game.js';
import type { EngineState } from '../../shared-engine/src/game/types.js';
import { createClinicalFallbackProvider } from '../src/clinical-fallback.js';
import { generateClinicalDeck } from '../src/clinical-generator.js';
import { CLINICAL_DEFAULT_BEEPY_ERROR_RATE, createClinicalSeries, deriveClinicalGeneratorSeed, type ClinicalSeries } from '../src/clinical-series.js';
import { loadShippedClinicalContent } from '../src/shipped-data.js';
import { toBoardModel, type BoardModel } from '../src/ui/board-model.js';
import { FEEDBACK_TEXT, toFeedback } from '../src/ui/feedback.js';
import { createDragController } from '../src/ui/render/drag.js';
import { createGameSession, type Scheduler } from '../src/ui/session.js';

type Direction = 'subjectToFact' | 'factToSubject';
type Step = { view: PlayerView; events: readonly PublicEvent[] };
const ok = (result: ControllerResult | { ok: false; error: { code: string } }): Step => {
  if (!result.ok) throw new Error(`expected success, got ${result.error.code}`);
  return result;
};
const okState = (result: { ok: true; state: EngineState } | { ok: false; error: { code: string } }): EngineState => {
  if (!result.ok) throw new Error(`mirror failed: ${result.error.code}`);
  return result.state;
};
const has = (events: readonly PublicEvent[], type: PublicEvent['type']) => events.some((e) => e.type === type);

async function readSource(relative: string): Promise<string> {
  const specifier = 'node:fs/promises';
  const fs = (await import(/* @vite-ignore */ specifier)) as { readFile(path: URL, encoding: string): Promise<string> };
  return fs.readFile(new URL(relative, import.meta.url), 'utf8');
}
const stripComments = (text: string) => text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const content = (() => {
  const loaded = loadShippedClinicalContent();
  if (!loaded.ok) throw new Error(`shipped content refused: ${loaded.code}`);
  return loaded.content;
})();

/** Oracle from the shipped dataset's own lists (not the policy code). */
function datasetOracle(collection: SubjectCollection) {
  const correctBy = new Map<string, Set<string>>();
  const diseasesOfFact = new Map<string, Set<string>>();
  for (const s of collection.subjects) {
    for (const t of s.topics) {
      correctBy.set(`${s.subject} · ${t.topicName}`, new Set(t.corrects.map((e) => normalizeDisplayText(e.text))));
      for (const e of t.corrects) {
        const key = `${t.topicName}: ${e.text}`;
        diseasesOfFact.set(key, (diseasesOfFact.get(key) ?? new Set()).add(normalizeDisplayText(s.subject)));
      }
    }
  }
  return (card: string, prompt: string): boolean =>
    correctBy.get(prompt)?.has(normalizeDisplayText(card)) === true || diseasesOfFact.get(prompt)?.has(normalizeDisplayText(card)) === true;
}
const isValid = datasetOracle(content.collection);

type HumanRequest = { kind: 'play'; handle: string; challengeId: string } | { kind: 'discard'; handle: string };
const open = (view: PlayerView) => view.challenges.filter((c) => c.status === 'open');
function validAction(view: PlayerView): HumanRequest {
  for (const card of view.hand) {
    const target = open(view).find((c) => isValid(card.displayValue, c.promptText));
    if (target !== undefined) return { kind: 'play', handle: card.handle, challengeId: target.id };
  }
  return { kind: 'discard', handle: view.hand[0]!.handle };
}
function invalidAction(view: PlayerView): HumanRequest {
  const correct = view.hand.find((card) => open(view).some((c) => isValid(card.displayValue, c.promptText)));
  if (correct !== undefined) return { kind: 'discard', handle: correct.handle };
  return { kind: 'play', handle: view.hand[0]!.handle, challengeId: open(view)[0]!.id };
}
function pendingValid(view: PlayerView): boolean {
  const p = view.pending!;
  if (p.kind === 'play') return isValid(p.card.displayValue, view.challenges.find((c) => c.id === p.destination)!.promptText);
  return !open(view).some((c) => isValid(p.card.displayValue, c.promptText));
}

function seriesFor(mode: 'solitaire' | 'vsBeepy', direction: Direction, seed: number, extra: { beepyErrorRate?: number; targetCardCount?: number } = {}): ClinicalSeries {
  const created = createClinicalSeries({ mode, generationDirection: direction, seed, ...extra });
  if (!created.ok) throw new Error(created.error.code);
  return created.series;
}

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
  FIXED_FEEDBACK.has(text) || /^(You|Beepy) drew \d+ cards?\.$/.test(text) || /^Game over\. Your score is \d+\.$/.test(text) || text === 'You win this game!' || text === 'Beepy wins this game.';

// ---------------------------------------------------------------------------
// U11 mirror: privacy
// ---------------------------------------------------------------------------

describe("C8-U11-1 Beepy's hidden cards never reach the ordinary interface (engine mirror)", () => {
  it.each([
    ['subjectToFact', 3],
    ['subjectToFact', 14],
    ['factToSubject', 5],
    ['factToSubject', 21],
  ] as const)('%s, seed %i: the whole of game 1 checked at every step', (direction, seed) => {
    const series = seriesFor('vsBeepy', direction, seed);
    const generated = generateClinicalDeck({
      source: content.collection,
      config: { app: 'clinical', generationDirection: direction },
      mode: 'vsBeepy',
      challengeCount: 9,
      targetCardCount: 24,
      seed: deriveClinicalGeneratorSeed(seed, 1),
      review: content.reviewValue,
    });
    if (!generated.ok) throw new Error('deck');
    const fallback = createClinicalFallbackProvider({ collection: content.collection, review: content.review, direction });
    const strategy = createReferenceBeepyStrategy({ errorRate: CLINICAL_DEFAULT_BEEPY_ERROR_RATE });
    if (!strategy.ok) throw new Error('strategy');
    let mirror = okState(
      createGameState({ mode: 'vsBeepy', deck: generated.deck, contextualValidity: generated.contextualValidity, seed, gameIndex: 1, options: { numericAnswers: false, fallback } }),
    );

    let step = ok(series.startNextGame());
    let checks = 0;
    let hiddenSeen = 0;
    for (let n = 0; n < 3000 && step.view.phase !== 'ended'; n += 1) {
      const view = step.view;
      const faceOf = (id: string) => mirror.cards[id]!.displayValue;
      expect(view.hand.map((c) => c.displayValue)).toEqual(mirror.hands.human.map(faceOf));
      expect(view.opponentHandCount).toBe(mirror.hands.beepy.length);

      const pendingFace = view.pending?.card.displayValue;
      const hidden = new Set(mirror.hands.beepy.map(faceOf).filter((face) => face !== pendingFace));
      for (const id of mirror.drawPile) hidden.add(faceOf(id));
      hiddenSeen += hidden.size;

      const feedback = toFeedback(step.events);
      const model = toBoardModel(view, { newCardHandles: feedback.newCardHandles });
      for (const face of shownFaces(model)) expect(hidden.has(face), `hidden face shown: ${face}`).toBe(false);
      const labels = JSON.stringify([model.hand.map((c) => c.ariaLabel), model.challenges.map((c) => c.ariaLabel), model.discard.ariaLabel]);
      for (const face of hidden) expect(labels.includes(face), `hidden face in a label: ${face}`).toBe(false);
      for (const item of feedback.items) expect(isAllowedFeedback(item.text), item.text).toBe(true);
      for (const event of step.events) if (event.type === 'PENALTY_DRAWN' && event.player === 'beepy') expect('card' in event).toBe(false);
      checks += 1;

      if (view.phase === 'awaitingEvaluation') {
        const decision = pendingValid(view) === (n % 3 !== 0) ? 'accept' : 'challenge';
        step = ok(series.decide(decision));
        mirror = okState(evaluatePending(mirror, decision));
      } else if (view.activePlayer === 'beepy') {
        step = ok(series.advanceBeepy());
        mirror = okState(advanceBeepy(mirror, strategy.strategy));
      } else {
        const request = n % 4 === 0 ? invalidAction(view) : validAction(view);
        step = ok(series.submitHumanAction(request));
        mirror = okState(submitAction(mirror, { player: 'human', ...request }));
      }
    }
    expect(step.view.phase).toBe('ended');
    expect(checks).toBeGreaterThan(5);
    expect(hiddenSeen).toBeGreaterThan(0);
  });
});

describe("C8-U11-2 nothing reveals whether Beepy's pending move is correct", () => {
  function pendingSnapshot(seed: number, beepyErrorRate: number, direction: Direction) {
    const series = seriesFor('vsBeepy', direction, seed, { beepyErrorRate });
    const start = ok(series.startNextGame());
    ok(series.submitHumanAction(validAction(start.view)));
    const pending = ok(series.advanceBeepy());
    const model = toBoardModel(pending.view);
    const strip = (value: unknown): unknown =>
      JSON.parse(JSON.stringify(value), (key, v) => (['pending', 'card', 'face', 'destination', 'destinationLabel', 'isDiscard', 'kind'].includes(key) ? undefined : v));
    return {
      valid: pendingValid(pending.view),
      model,
      view: strip(pending.view),
      board: strip(model),
      events: strip(pending.events),
      feedback: toFeedback(pending.events),
      explain: series.explainResolved(pending.view.turnCount + 1),
    };
  }

  it.each(['subjectToFact', 'factToSubject'] as const)('%s: views, models, events, feedback and Explain Why are identical for a right and a wrong move', (direction) => {
    for (const seed of [1, 2, 3, 4, 5, 6]) {
      const right = pendingSnapshot(seed, 0, direction);
      const wrong = pendingSnapshot(seed, 1, direction);
      expect(right.valid).toBe(true);
      expect(wrong.valid).toBe(false);
      expect(wrong.view).toEqual(right.view);
      expect(wrong.board).toEqual(right.board);
      expect(wrong.events).toEqual(right.events);
      expect(wrong.feedback).toEqual(right.feedback);
      expect(right.feedback.items.map((i) => i.text)).toEqual([FEEDBACK_TEXT.beepyPending]);
      expect(right.explain).toEqual({ ok: true, available: false, reason: 'notResolved' });
      expect(wrong.explain).toEqual(right.explain);
    }
  });

  it('while a decision is pending: no tap or drag targets, the human cannot act, both decisions are available', () => {
    for (const rate of [0, 1]) {
      const { model } = pendingSnapshot(4, rate, 'subjectToFact');
      expect(model.canAct).toBe(false);
      expect(model.challenges.every((c) => !c.target)).toBe(true);
      expect(model.discard.target).toBe(false);
      expect(model.hand.every((c) => !c.enabled && !c.selected)).toBe(true);
      expect(model.pending?.canDecide).toBe(true);
      expect(model.explain).toBeUndefined();
      expect(JSON.stringify(model)).not.toMatch(/\b(correct|wrong|right|valid|invalid)\b/i);
    }
  });

  it("Beepy's thinking time is one constant, whatever its move", () => {
    for (const seed of [20, 21, 22]) {
      const delays: number[] = [];
      const scheduler: Scheduler = {
        after(ms) {
          delays.push(ms);
          return () => undefined;
        },
      };
      const created = createGameSession({ settings: { mode: 'vsBeepy', direction: 'subjectToFact' }, seed, scheduler });
      if (!created.ok) throw new Error('session');
      const play = validAction(created.session.snapshot().view);
      created.session.select(play.handle);
      if (play.kind === 'play') created.session.playOn(play.challengeId);
      else created.session.discard();
      expect(delays).toEqual([1000]);
    }
  });
});

describe('C8-U11-3 no storage, network, URL changes, unsafe markup, or seed exposure', () => {
  const tsSources = import.meta.glob('../src/ui/**/*.ts', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;
  const entries = Object.entries(tsSources).map(([file, text]) => [file, stripComments(text)] as const);

  it('reads every UI source file', () => {
    expect(entries.length).toBe(13);
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
    expect(html).not.toMatch(/https?:\/\//);
    expect(css).not.toMatch(/@import|url\(\s*['"]?https?:/);
  });

  it('a session snapshot never contains the series seed or a derived generator seed', () => {
    const seed = 987654321;
    const created = createGameSession({ settings: { mode: 'vsBeepy', direction: 'factToSubject' }, seed, scheduler: { after: () => () => undefined } });
    if (!created.ok) throw new Error('session');
    const text = JSON.stringify(created.session.snapshot());
    expect(text).not.toContain(String(seed));
    for (let game = 1; game <= 5; game += 1) expect(text).not.toContain(String(deriveClinicalGeneratorSeed(seed, game)));
  });
});

describe('C8-U11-4 architecture boundary of the UI code', () => {
  const tsSources = import.meta.glob('../src/ui/**/*.ts', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;
  const byFile = Object.entries(tsSources).map(([file, text]) => [file.replace('../src/ui/', ''), stripComments(text)] as const);

  function runtimeImports(text: string): Array<{ from: string; names: string[] }> {
    const out: Array<{ from: string; names: string[] }> = [];
    for (const m of text.matchAll(/^import\s+(type\s+)?\{([^}]*)\}\s+from\s+'([^']+)';/gm)) {
      if (m[1] !== undefined) continue;
      const names = m[2]!.split(',').map((s) => s.trim()).filter((s) => s !== '' && !s.startsWith('type '));
      if (names.length > 0) out.push({ from: m[3]!, names });
    }
    return out;
  }

  it('the UI imports at runtime only its own modules, the engine package, and three named Clinical modules', () => {
    const allowedClinical: Record<string, string[]> = {
      'session.ts': ['../clinical-series.js'],
      'app.ts': ['../shipped-data.js'],
      'board-model.ts': ['../clinical-content.js'],
    };
    for (const [file, text] of byFile) {
      expect(text, file).not.toMatch(/shared-engine\/src|math-cards/);
      for (const imp of runtimeImports(text)) {
        const ok2 = imp.from.startsWith('./') || imp.from === '@beepy/shared-engine' || (file.startsWith('render/') && imp.from.startsWith('../') && !imp.from.startsWith('../../')) || (allowedClinical[file] ?? []).includes(imp.from);
        expect(ok2, `${file} imports { ${imp.names.join(', ')} } from ${imp.from}`).toBe(true);
      }
    }
  });

  it('only session.ts creates the series; only seed.ts reads a random source', () => {
    for (const [file, text] of byFile) {
      if (file !== 'session.ts') expect(text, file).not.toMatch(/\bcreateClinicalSeries\s*\(/);
      if (file !== 'seed.ts') expect(text, file).not.toMatch(/getRandomValues|Math\.random/);
    }
  });

  it('the UI does no judging, deck handling, or policy evaluation', () => {
    for (const [file, text] of byFile) {
      expect(text, file).not.toMatch(/\b(judgeAction|generateClinicalDeck|validateDeckForPlay|drawPenaltyCards|correctAnswerCardId|contextualValidity|createSeriesController|createValidityPolicy|factRelation|nameRelation|explanationByChallengeId)\b/);
    }
  });

  it('diagnostics are connected only in development builds', () => {
    const main = byFile.find(([f]) => f === 'main.ts')![1];
    expect(main).toMatch(/isDevBuild\s*\?/);
    expect(main).toMatch(/env\?\.DEV === true/);
    for (const [file, text] of byFile) if (file !== 'main.ts') expect(text, file).not.toMatch(/console\.(log|debug|info|warn|error)/);
  });
});

// ---------------------------------------------------------------------------
// U12 mirror: final checks
// ---------------------------------------------------------------------------

describe('C8-U12 penalty exhaustion in real games (shipped data)', () => {
  it.each(['subjectToFact', 'factToSubject'] as const)('Solitaire %s, 8-card deck: after the pile and the reviewed fallback run out, penalties are waived truthfully; the game still ends normally', (direction) => {
    const series = seriesFor('solitaire', direction, 31, { targetCardCount: 8 });
    let step = ok(series.startNextGame());
    let waived = 0;
    let drawnAfterPileEmpty = 0;
    for (let i = 0; i < 400 && waived < 3; i += 1) {
      const before = step.view;
      step = ok(series.submitHumanAction(invalidAction(before)));
      expect(step.view.turnCount).toBe(before.turnCount + 1);
      const texts = toFeedback(step.events).items.map((item) => item.text);
      if (has(step.events, 'PENALTY_WAIVED')) {
        waived += 1;
        expect(step.view.hand.length).toBe(before.hand.length);
        expect(texts).toEqual([FEEDBACK_TEXT.humanWrong, FEEDBACK_TEXT.waived]);
        expect(toBoardModel(step.view, { newCardHandles: toFeedback(step.events).newCardHandles }).newCards).toEqual([]);
      } else {
        expect(has(step.events, 'PENALTY_DRAWN')).toBe(true);
        expect(texts).toContain('You drew 1 card.');
        if (before.drawPileCount === 0) drawnAfterPileEmpty += 1;
      }
      const visible = [...step.view.hand, ...step.view.discard].map((c) => normalizeDisplayText(c.displayValue));
      expect(new Set(visible).size).toBe(visible.length);
    }
    expect(waived).toBe(3);
    expect(drawnAfterPileEmpty).toBeGreaterThan(0); // reviewed fallback entries were used first
    for (let i = 0; i < 400 && step.view.phase !== 'ended'; i += 1) step = ok(series.submitHumanAction(validAction(step.view)));
    expect(step.view.phase).toBe('ended');
  });

  it('Player vs. Beepy: a waived penalty never claims a draw', () => {
    let waivedSeen = 0;
    for (const seed of [2, 3, 4]) {
      const series = seriesFor('vsBeepy', 'factToSubject', seed, { beepyErrorRate: 0.6 });
      let step = ok(series.startNextGame());
      for (let n = 0; n < 2000 && step.view.phase !== 'ended'; n += 1) {
        const view = step.view;
        if (view.phase === 'awaitingEvaluation') step = ok(series.decide(pendingValid(view) ? 'challenge' : 'accept'));
        else if (view.activePlayer === 'beepy') step = ok(series.advanceBeepy());
        else step = ok(series.submitHumanAction(invalidAction(view)));
        if (has(step.events, 'PENALTY_WAIVED')) {
          waivedSeen += 1;
          expect(has(step.events, 'PENALTY_DRAWN')).toBe(false);
          const texts = toFeedback(step.events).items.map((i) => i.text);
          expect(texts).toContain(FEEDBACK_TEXT.waived);
          expect(texts.some((t) => t.includes('drew'))).toBe(false);
        }
      }
    }
    expect(waivedSeen).toBeGreaterThan(0);
  });
});

describe('C8-U12 keyboard reachability (structure of the rendered controls)', async () => {
  const board = await readSource('../src/ui/render/board.ts');
  const menu = await readSource('../src/ui/render/menu.ts');
  const app = await readSource('../src/ui/app.ts');
  const drag = await readSource('../src/ui/render/drag.ts');
  const sources = { 'board.ts': board, 'menu.ts': menu };

  it('every click or change handler is on a real button or radio input', () => {
    let handlers = 0;
    for (const [file, text] of Object.entries(sources)) {
      for (const m of text.matchAll(/on: \{ (click|change):/g)) {
        handlers += 1;
        const tag = [...text.slice(0, m.index).matchAll(/h\(\s*'([a-z0-9]+)'/g)].at(-1)?.[1];
        expect(['button', 'input'], `${file}: handler on <${tag}>`).toContain(tag);
      }
    }
    expect(handlers).toBeGreaterThanOrEqual(15);
  });

  it('every button declares type="button"; setup uses radio inputs', () => {
    for (const [file, text] of Object.entries(sources)) {
      expect(text.match(/type: 'button'/g)?.length ?? 0, file).toBeGreaterThanOrEqual(text.match(/h\(\s*'button'/g)?.length ?? 0);
    }
    expect(menu).toContain("type: 'radio'");
  });

  it("Escape cancels a selection and a drag; Beepy's move heading and the explanation heading can take focus", () => {
    expect(app).toMatch(/event\.key === 'Escape'\) session\?\.cancel\(\)/);
    expect(drag).toMatch(/event\.key !== 'Escape'/);
    expect(board).toMatch(/id: 'pending-title', tabindex: -1, 'data-focus': 'pending'/);
    expect(board).toMatch(/id: 'explain-title', tabindex: -1, 'data-focus': 'explain-panel'/);
    expect(app).toMatch(/restoreFocus\(screenHost, \['pending'\]\)/);
    expect(app).not.toMatch(/event\.key === '(?!Escape)/); // no other global shortcuts
  });

  it('focus rings are visible on every button, radio and focusable heading', async () => {
    const css = await readSource('../src/ui/styles.css');
    expect(css).toMatch(/button:focus-visible,\s*\.choice__input:focus-visible \+ \.choice__body \{[^}]*box-shadow: var\(--focus\)/);
    expect(css).toMatch(/\.pending__title:focus-visible \{[^}]*box-shadow: var\(--focus\)/);
  });
});

describe('C8-U12 touch: a cancelled pointer (what a swipe produces) never plays', () => {
  it('press, small movement, then pointercancel: no command is given', () => {
    const calls: string[] = [];
    const controller = createDragController({
      select: () => calls.push('select'),
      cancel: () => calls.push('cancel'),
      playOn: () => calls.push('playOn'),
      discard: () => calls.push('discard'),
      isSelected: () => false,
      canDrag: () => true,
    });
    controller.press('h1', 100, 100);
    controller.move(104, 101);
    controller.abort();
    expect(calls).toEqual([]);
    expect(controller.release({ kind: 'discard' })).toBe('none');
    expect(calls).toEqual([]);
  });

  it('cards allow horizontal panning, and the narrow-screen hand scrolls sideways', async () => {
    const css = await readSource('../src/ui/styles.css');
    expect(css).toMatch(/\.card \{[^}]*touch-action: pan-x;/);
    expect(css.slice(css.indexOf('@media (max-width: 768px)'))).toMatch(/\.hand \{[^}]*overflow-x: auto;/);
  });
});

describe('C8-U12 motion, responsive rules, and accessible names', () => {
  it('reduced motion turns off every animation and transition', async () => {
    const css = await readSource('../src/ui/styles.css');
    const block = css.slice(css.indexOf('@media (prefers-reduced-motion: reduce)'));
    expect(block).toMatch(/animation: none !important;/);
    expect(block).toMatch(/transition: none !important;/);
    expect(await readSource('../src/ui/render/board.ts')).toMatch(/prefers-reduced-motion: reduce/);
  });

  it('the Clinical breakpoints and the C8 layout fixes are present', async () => {
    const css = await readSource('../src/ui/styles.css');
    for (const query of ['(max-width: 1024px)', '(max-width: 768px)', '(max-width: 1099px)', '(max-width: 480px)', '(min-width: 1100px)']) expect(css, query).toContain(`@media ${query}`);
    const c8 = css.slice(css.indexOf('M6 C8: responsive fixes'));
    expect(c8).toMatch(/\.board--clinical \.action-row \{[^}]*grid-template-columns: minmax\(0, 1fr\)/);
    expect(c8).toMatch(/\.board--clinical \.action-row \.pending \{[^}]*grid-template-columns: minmax\(0, 1fr\) auto/);
    expect(c8).toMatch(/max-width: 480px\)[\s\S]*\.board--clinical \.card-back/);
    expect(c8).toMatch(/\.pile--discard \.mini-card--text \{[^}]*padding-top: 0;[^}]*padding-bottom: 0;/);
  });

  it('challenges, cards, the discard pile and Beepy\u2019s move are named with their full authored text', () => {
    for (const mode of ['solitaire', 'vsBeepy'] as const) {
      for (const direction of ['subjectToFact', 'factToSubject'] as const) {
        const series = seriesFor(mode, direction, 6, { beepyErrorRate: 0 });
        let step = ok(series.startNextGame());
        const model = toBoardModel(step.view);
        model.challenges.forEach((tile) => expect(tile.ariaLabel).toBe(`Challenge ${tile.number}: ${tile.prompt}`));
        model.hand.forEach((card) => expect(card.ariaLabel).toBe(`Card: ${card.face}`));
        step = ok(series.submitHumanAction(invalidAction(step.view)));
        if (mode === 'vsBeepy' && step.view.activePlayer === 'beepy') {
          step = ok(series.advanceBeepy());
          const pending = toBoardModel(step.view).pending!;
          const target = step.view.challenges.find((c) => c.id === step.view.pending?.destination);
          expect(pending.destinationLabel).toBe(pending.isDiscard ? 'to the discard pile' : `on challenge ${step.view.challenges.indexOf(target!) + 1}: ${target!.promptText}`);
        }
        const top = step.view.discard.at(-1);
        const discard = toBoardModel(step.view).discard;
        if (top !== undefined) expect(discard.ariaLabel).toContain(`Top card: ${top.displayValue}`);
      }
    }
  });
});

describe('C8 color contrast of the Clinical theme (WCAG 2.x, normal text >= 4.5:1)', async () => {
  const css = await readSource('../src/ui/styles.css');
  /** The last value of a custom property in :root blocks (the Clinical theme overrides come last). */
  const variable = (name: string): string => {
    const values = [...css.matchAll(new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})`, 'g'))].map((m) => m[1]!);
    if (values.length === 0) throw new Error(`no --${name}`);
    return values.at(-1)!;
  };
  const luminance = (hex: string): number => {
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
    return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
  };
  const ratio = (a: string, b: string): number => {
    const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x);
    return (l1! + 0.05) / (l2! + 0.05);
  };

  it.each([
    ['brand text on paper', 'brand', 'paper'],
    ['white button text on brand', 'brand-ink', 'brand'],
    ['category chip: brand on brand-soft', 'brand', 'brand-soft'],
    ['body text on the background', 'ink', 'sky-1'],
    ['secondary text on paper', 'ink-soft', 'paper'],
    ['correct feedback', 'good', 'good-soft'],
    ['wrong feedback', 'oops', 'oops-soft'],
    ['info feedback', 'info', 'info-soft'],
  ])('%s', (_label, fg, bg) => {
    expect(ratio(variable(fg), variable(bg))).toBeGreaterThanOrEqual(4.5);
  });

  it('state is never shown by color alone: feedback has icons and words, solved tiles a check mark, selection aria-pressed', async () => {
    const board = await readSource('../src/ui/render/board.ts');
    expect(board).toMatch(/TONE_ICON/);
    expect(board).toMatch(/TONE_WORD/);
    expect(board).toMatch(/challenge__check' \}, '✓'/);
    expect(board).toMatch(/'aria-pressed': card\.selected \? 'true' : 'false'/);
  });
});
