/**
 * M5 U12 - final automated verification of the scenarios the owner has not yet
 * checked in a browser. What CAN be checked without a browser is checked here:
 *   - penalty exhaustion, through real games (no special shortcuts);
 *   - keyboard reachability of every action (structure of the rendered controls);
 *   - touch: a cancelled pointer (what a horizontal swipe produces) never plays;
 *   - reduced-motion and responsive rules exist in the stylesheet;
 *   - accessible names for number-only problems and Beepy's pending move.
 * Visual layout, real keyboard use, touch emulation, and screen-reader output still
 * need the owner's checks in Chrome; nothing here claims they passed.
 */

import { describe, expect, it } from 'vitest';
import type { ControllerResult, PlayerView, PublicEvent } from '@beepy/shared-engine';
import { toBoardModel } from '../src/ui/board-model.js';
import { FEEDBACK_TEXT, toFeedback } from '../src/ui/feedback.js';
import { createDragController } from '../src/ui/render/drag.js';
import { invalidAction, pendingValid, seriesFor, validAction } from './ui-helpers.js';

type Step = { view: PlayerView; events: readonly PublicEvent[] };
const ok = (result: ControllerResult | { ok: false; error: { code: string } }): Step => {
  if (!result.ok) throw new Error(`expected success, got ${result.error.code}`);
  return result;
};
const has = (events: readonly PublicEvent[], type: PublicEvent['type']) => events.some((e) => e.type === type);

async function readSource(relative: string): Promise<string> {
  const specifier = 'node:fs/promises';
  const fs = (await import(/* @vite-ignore */ specifier)) as { readFile(path: URL, encoding: string): Promise<string> };
  return fs.readFile(new URL(relative, import.meta.url), 'utf8');
}

describe('U12-4 penalty exhaustion in real games', () => {
  it.each(['factToSubject', 'subjectToFact'] as const)(
    'Solitaire %s: a waived penalty is reported as waived, never as a drawn card, and the game goes on to its end',
    (direction) => {
      const series = seriesFor({ mode: 'solitaire', level: 'oneDigit', generationDirection: direction, seed: 31 });
      let step = ok(series.startNextGame());
      let waivedSteps = 0;
      let drawnAfterPileEmpty = 0;
      // Keep making wrong moves until penalties run out completely.
      for (let i = 0; i < 300 && waivedSteps < 3; i += 1) {
        const before = step.view;
        step = ok(series.submitHumanAction(invalidAction(before)));
        expect(step.view.turnCount).toBe(before.turnCount + 1);
        const texts = toFeedback(step.events).items.map((item) => item.text);
        if (has(step.events, 'PENALTY_WAIVED')) {
          waivedSteps += 1;
          expect(step.view.hand.length).toBe(before.hand.length);
          expect(texts).toEqual([FEEDBACK_TEXT.humanWrong, FEEDBACK_TEXT.waived]);
          expect(texts.some((t) => t.includes('drew'))).toBe(false);
          expect(toBoardModel(step.view, { newCardHandles: toFeedback(step.events).newCardHandles }).newCards).toEqual([]);
          expect(step.view.phase).toBe('awaitingAction');
        } else {
          expect(has(step.events, 'PENALTY_DRAWN')).toBe(true);
          expect(step.view.hand.length).toBe(before.hand.length + 1);
          expect(texts).toContain('You drew 1 card.');
          if (before.drawPileCount === 0) drawnAfterPileEmpty += 1;
        }
      }
      expect(waivedSteps).toBe(3);
      // The fallback supplied cards after the pile ran out, before penalties were waived.
      expect(drawnAfterPileEmpty).toBeGreaterThan(0);
      // The game still plays to its normal end, with the normal score.
      for (let i = 0; i < 300 && step.view.phase !== 'ended'; i += 1) step = ok(series.submitHumanAction(validAction(step.view)));
      expect(step.view.phase).toBe('ended');
      const outcome = step.view.outcome!;
      if (outcome.kind !== 'solitaire') throw new Error('mode');
      expect(outcome.score).toBe(step.view.turnCount + step.view.hand.length);
    },
  );

  it('Player vs. Beepy: a waived penalty (including the both-draw case) never claims a draw', () => {
    let waivedSeen = 0;
    for (const seed of [2, 3, 4]) {
      const series = seriesFor({ mode: 'vsBeepy', level: 'oneDigit', seed, beepyErrorRate: 0.6 });
      let step = ok(series.startNextGame());
      for (let n = 0; n < 1500 && step.view.phase !== 'ended'; n += 1) {
        const view = step.view;
        if (view.phase === 'awaitingEvaluation') step = ok(series.decide(pendingValid(view) ? 'challenge' : 'accept'));
        else if (view.activePlayer === 'beepy') step = ok(series.advanceBeepy());
        else step = ok(series.submitHumanAction(invalidAction(view)));
        const texts = toFeedback(step.events).items.map((item) => item.text);
        if (has(step.events, 'PENALTY_WAIVED')) {
          waivedSeen += 1;
          expect(has(step.events, 'PENALTY_DRAWN')).toBe(false);
          expect(texts).toContain(FEEDBACK_TEXT.waived);
          expect(texts.some((t) => t.includes('drew'))).toBe(false);
        }
      }
    }
    expect(waivedSeen).toBeGreaterThan(0);
  });
});

describe('U12-1 keyboard reachability (structure of the rendered controls)', async () => {
  const files = ['board.ts', 'menu.ts'] as const;
  const sources = Object.fromEntries(
    await Promise.all(files.map(async (f) => [f, await readSource(`../src/ui/render/${f}`)] as const)),
  ) as Record<(typeof files)[number], string>;
  const app = await readSource('../src/ui/app.ts');
  const drag = await readSource('../src/ui/render/drag.ts');

  it('every click or change handler is on a real button or radio input (keyboard-operable)', () => {
    let handlers = 0;
    for (const [file, text] of Object.entries(sources)) {
      for (const m of text.matchAll(/on: \{ (click|change):/g)) {
        handlers += 1;
        const before = text.slice(0, m.index);
        // The element whose props hold this handler is the nearest preceding h(<tag>.
        const tag = [...before.matchAll(/h\(\s*'([a-z]+)'/g)].at(-1)?.[1];
        expect(['button', 'input'], `${file}: handler on <${tag}>`).toContain(tag);
      }
    }
    expect(handlers).toBeGreaterThanOrEqual(12);
  });

  it('every button declares type="button", and inputs are radios', () => {
    for (const [file, text] of Object.entries(sources)) {
      const buttons = text.match(/h\(\s*'button'/g)?.length ?? 0;
      const typed = text.match(/type: 'button'/g)?.length ?? 0;
      expect(typed, file).toBeGreaterThanOrEqual(buttons);
    }
    expect(sources['menu.ts']).toContain("type: 'radio'");
  });

  it("Escape cancels a selection (app) and a drag (drag.ts); Beepy's decision panel heading can take focus", () => {
    expect(app).toMatch(/event\.key === 'Escape'\) session\?\.cancel\(\)/);
    expect(drag).toMatch(/event\.key !== 'Escape'/);
    expect(sources['board.ts']).toMatch(/id: 'pending-title', tabindex: -1, 'data-focus': 'pending'/);
    expect(app).toMatch(/restoreFocus\(screenHost, \['pending'\]\)/);
  });

  it('Accept and Challenge have visible text labels', () => {
    expect(sources['board.ts']).toMatch(/on: \{ click: handlers\.accept \} \}, 'Accept'\)/);
    expect(sources['board.ts']).toMatch(/on: \{ click: handlers\.challenge \} \}, 'Challenge'\)/);
  });
});

describe('U12-3 touch: a swipe that the browser turns into a cancelled pointer never plays', () => {
  it('press, small or sideways movement, then pointercancel: no command is given', () => {
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

  it('cards allow horizontal panning (so a long hand scrolls), and a narrow-screen hand scrolls sideways', async () => {
    const css = await readSource('../src/ui/styles.css');
    expect(css).toMatch(/\.card \{[^}]*touch-action: pan-x;/);
    const narrow = css.slice(css.indexOf('@media (max-width: 768px)'));
    expect(narrow).toMatch(/\.hand \{[^}]*overflow-x: auto;/);
  });
});

describe('U12-5 accessibility and motion', () => {
  it('reduced motion turns off every animation and transition', async () => {
    const css = await readSource('../src/ui/styles.css');
    const block = css.slice(css.indexOf('@media (prefers-reduced-motion: reduce)'));
    expect(block).toMatch(/animation: none !important;/);
    expect(block).toMatch(/transition: none !important;/);
    const board = await readSource('../src/ui/render/board.ts');
    expect(board).toMatch(/prefers-reduced-motion: reduce/);
  });

  it('the stylesheet has the tablet and phone breakpoints and the wide vs Beepy rules', async () => {
    const css = await readSource('../src/ui/styles.css');
    for (const query of ['(max-width: 1024px)', '(max-width: 768px)', '(min-width: 1100px)', '(min-width: 1280px)', '(min-width: 1440px)']) {
      expect(css, query).toContain(`@media ${query}`);
    }
  });

  it('number-only problems are named with their full question; the pending move is described by visible text', () => {
    for (const mode of ['solitaire', 'vsBeepy'] as const) {
      const series = seriesFor({ mode, level: 'oneDigit', generationDirection: 'subjectToFact', seed: 6, beepyErrorRate: 0 });
      let step = ok(series.startNextGame());
      const model = toBoardModel(step.view);
      for (const tile of model.challenges) {
        expect(tile.display).toMatch(/^\d+$/);
        expect(tile.ariaLabel).toMatch(new RegExp(`^Problem ${tile.number}: Which addition expression equals ${tile.display}\\?`));
      }
      if (mode === 'vsBeepy') {
        step = ok(series.submitHumanAction(validAction(step.view)));
        step = ok(series.advanceBeepy());
        const pending = toBoardModel(step.view).pending!;
        expect(pending.destinationDisplay).toMatch(pending.isDiscard ? /^to the discard pile$/ : /^on problem \d+ \(\d+\)$/);
      }
    }
  });
});
