/**
 * M5 U9 - visual polish (pure-layer parts): number-only targets in "find the
 * matching addition", new-card visibility data, and color contrast. Layout,
 * artwork, and responsiveness are checked by the owner in Chrome.
 */

import { describe, expect, it } from 'vitest';
import type { ControllerResult, PlayerView, PublicEvent } from '@beepy/shared-engine';
import { TARGET_ONLY_INSTRUCTION, promptDisplay, toBoardModel } from '../src/ui/board-model.js';
import { toFeedback } from '../src/ui/feedback.js';
import { invalidAction, seriesFor, validAction } from './ui-helpers.js';

type Step = { view: PlayerView; events: readonly PublicEvent[] };
const ok = (result: ControllerResult | { ok: false; error: { code: string } }): Step => {
  if (!result.ok) throw new Error(`expected success, got ${result.error.code}`);
  return result;
};

describe('U9 A: number-only targets in "find the matching addition"', () => {
  it('promptDisplay shows only the target number for the approved prompt, and leaves others alone', () => {
    expect(promptDisplay('Which addition expression equals 10?')).toEqual({ display: '10', targetOnly: true });
    expect(promptDisplay('Which addition expression equals 87?')).toEqual({ display: '87', targetOnly: true });
    expect(promptDisplay('3 + 4 = ?')).toEqual({ display: '3 + 4 = ?', targetOnly: false });
    expect(promptDisplay('Which addition expression equals ?')).toEqual({ display: 'Which addition expression equals ?', targetOnly: false });
  });

  it.each(['solitaire', 'vsBeepy'] as const)('%s subjectToFact: tiles show the number, data and accessible labels are unchanged', (mode) => {
    const series = seriesFor({ mode, level: 'twoDigit', generationDirection: 'subjectToFact', seed: 3 });
    const view = ok(series.startNextGame()).view;
    const model = toBoardModel(view);
    expect(model.instruction).toBe(TARGET_ONLY_INSTRUCTION);
    model.challenges.forEach((tile, i) => {
      const prompt = view.challenges[i]!.promptText;
      const target = /equals (\d+)\?$/.exec(prompt)![1];
      expect(tile.prompt).toBe(prompt);
      expect(tile.display).toBe(target);
      expect(tile.targetOnly).toBe(true);
      expect(tile.ariaLabel).toContain(prompt);
    });
  });

  it.each(['solitaire', 'vsBeepy'] as const)('%s factToSubject: tiles show the full problem and no instruction', (mode) => {
    const series = seriesFor({ mode, level: 'twoDigit', generationDirection: 'factToSubject', seed: 3 });
    const view = ok(series.startNextGame()).view;
    const model = toBoardModel(view);
    expect(model.instruction).toBeUndefined();
    model.challenges.forEach((tile, i) => {
      expect(tile.display).toBe(view.challenges[i]!.promptText);
      expect(tile.targetOnly).toBe(false);
    });
  });

  it("Beepy's move panel uses the short destination in subjectToFact, the full one otherwise", () => {
    for (const direction of ['subjectToFact', 'factToSubject'] as const) {
      let checked = 0;
      for (let seed = 1; seed <= 30 && checked < 3; seed += 1) {
        const series = seriesFor({ mode: 'vsBeepy', level: 'oneAndTwoDigit', generationDirection: direction, seed, beepyErrorRate: 0 });
        const start = ok(series.startNextGame());
        ok(series.submitHumanAction(validAction(start.view)));
        const pending = ok(series.advanceBeepy()).view;
        const p = pending.pending!;
        if (p.kind !== 'play') continue;
        const index = pending.challenges.findIndex((c) => c.id === p.destination);
        const prompt = pending.challenges[index]!.promptText;
        const model = toBoardModel(pending).pending!;
        expect(model.destinationLabel).toBe(`on problem ${index + 1}: ${prompt}`);
        expect(model.destinationDisplay).toBe(
          direction === 'subjectToFact' ? `on problem ${index + 1} (${/equals (\d+)\?$/.exec(prompt)![1]})` : `on problem ${index + 1}: ${prompt}`,
        );
        checked += 1;
      }
      expect(checked).toBe(3);
    }
  });
});

describe('U9 B: a newly drawn penalty card is listed for the notice', () => {
  it('after a wrong move, newCards holds exactly the card the engine dealt', () => {
    const series = seriesFor({ mode: 'solitaire', level: 'oneDigit', seed: 8 });
    const start = ok(series.startNextGame());
    const wrong = ok(series.submitHumanAction(invalidAction(start.view)));
    const feedback = toFeedback(wrong.events);
    const drawn = wrong.events.find((e) => e.type === 'PENALTY_DRAWN');
    expect(drawn?.type === 'PENALTY_DRAWN' && drawn.card).toBeTruthy();
    const model = toBoardModel(wrong.view, { newCardHandles: feedback.newCardHandles });
    expect(model.newCards).toHaveLength(1);
    const handCard = wrong.view.hand.find((c) => c.handle === model.newCards[0]!.handle)!;
    expect(model.newCards[0]!.face).toBe(handCard.displayValue);
    if (drawn?.type === 'PENALTY_DRAWN') expect(model.newCards[0]!.handle).toBe(drawn.card!.handle);
  });

  it('with no penalty there is no new-card notice, and a big hand still lists the latest card', () => {
    const series = seriesFor({ mode: 'solitaire', level: 'oneDigit', seed: 9 });
    let step = ok(series.startNextGame());
    expect(toBoardModel(step.view, { newCardHandles: toFeedback(step.events).newCardHandles }).newCards).toEqual([]);
    for (let i = 0; i < 8; i += 1) step = ok(series.submitHumanAction(invalidAction(step.view)));
    const fb = toFeedback(step.events);
    const model = toBoardModel(step.view, { newCardHandles: fb.newCardHandles });
    expect(model.handCount).toBeGreaterThan(10);
    expect(model.newCards).toHaveLength(fb.newCardHandles.length);
    expect(model.newCards.map((c) => c.handle)).toEqual(fb.newCardHandles);
  });
});

/**
 * Read a source file as text. Vitest returns an EMPTY string for `.css?raw` (it does
 * not process CSS by default), so CSS is read from disk with Node's file API. The
 * module is loaded through an untyped dynamic import because `@types/node` is not
 * installed (no new dependency).
 */
async function readSource(relative: string): Promise<string> {
  const specifier = 'node:fs/promises';
  const fs = (await import(/* @vite-ignore */ specifier)) as { readFile(path: URL, encoding: string): Promise<string> };
  return fs.readFile(new URL(relative, import.meta.url), 'utf8');
}

describe('U9 colour contrast (WCAG 2.1 AA, 4.5:1 for text)', async () => {
  const css = await readSource('../src/ui/styles.css');
  const tokens = new Map<string, string>();
  for (const m of css.matchAll(/--([a-z0-9-]+):\s*(#[0-9a-fA-F]{6})\s*;/g)) tokens.set(m[1]!, m[2]!.toLowerCase());

  it('reads the colour tokens from the stylesheet', () => {
    expect(css.length).toBeGreaterThan(1000);
    for (const name of ['ink', 'ink-soft', 'paper', 'sky-1', 'sky-2', 'brand', 'good', 'oops', 'info']) expect(tokens.has(name), name).toBe(true);
  });
  const color = (name: string): string => {
    if (name.startsWith('#')) return name;
    const value = tokens.get(name);
    if (value === undefined) throw new Error(`missing token --${name}`);
    return value;
  };
  const luminance = (hex: string): number => {
    const channel = (i: number) => {
      const c = parseInt(hex.slice(i, i + 2), 16) / 255;
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    };
    return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
  };
  const ratio = (a: string, b: string): number => {
    const [l1, l2] = [luminance(color(a)), luminance(color(b))].sort((x, y) => y - x) as [number, number];
    return (l1 + 0.05) / (l2 + 0.05);
  };

  it.each([
    ['ink', 'paper'],
    ['ink-soft', 'paper'],
    ['ink', 'sky-1'],
    ['ink-soft', 'sky-1'],
    ['ink-soft', 'sky-2'],
    ['brand', 'paper'],
    ['brand', 'brand-soft'],
    ['brand-ink', 'brand'],
    ['good', 'good-soft'],
    ['oops', 'oops-soft'],
    ['info', 'info-soft'],
    ['#ffffff', 'good'],
    ['#ffffff', 'oops'],
    ['#ffffff', 'info'],
    ['ink', 'accent'],
    ['oops', 'paper'],
  ])('%s on %s meets 4.5:1', (fg, bg) => {
    expect(ratio(fg, bg)).toBeGreaterThanOrEqual(4.5);
  });
});

describe('U9 artwork guard', async () => {
  const tsSources = import.meta.glob('../src/ui/**/*.ts', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;
  const sources: Record<string, string> = { ...tsSources, '../src/ui/styles.css': await readSource('../src/ui/styles.css') };

  it('reads every UI source, including the stylesheet', () => {
    expect(Object.keys(tsSources).length).toBeGreaterThanOrEqual(10);
    expect(Object.values(tsSources).every((text) => text.length > 0)).toBe(true);
    expect(sources['../src/ui/styles.css']!.length).toBeGreaterThan(1000);
  });

  it('Beepy is drawn as vector SVG and used on the menu and the Beepy bar; the placeholder is gone', () => {
    const avatar = Object.entries(sources).find(([file]) => file.endsWith('beepy-avatar.ts'))![1];
    expect(avatar).toContain('http://www.w3.org/2000/svg');
    const board = Object.entries(sources).find(([file]) => file.endsWith('render/board.ts'))![1];
    const menu = Object.entries(sources).find(([file]) => file.endsWith('render/menu.ts'))![1];
    expect(board).toContain('createBeepyAvatar(');
    expect(menu).toContain('createBeepyAvatar(');
    for (const [file, text] of Object.entries(sources)) expect(text, file).not.toContain('beepy-badge');
  });

  it('no pixel-art rendering anywhere in the UI', () => {
    for (const [file, text] of Object.entries(sources)) {
      // Comments say "no pixel-art"; check only the code and style rules.
      const code = text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
      expect(code, file).not.toMatch(/image-rendering|pixelated|crisp-edges|8-bit|pixel-art/i);
    }
  });
});
