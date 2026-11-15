/**
 * M6 C6 - Clinical Cards app shell and Solitaire board (tasks.md C6; design section 8).
 *
 * Node only, no DOM library (U-2 pattern): the screen flow, labels, board model,
 * feedback and session are tested as data; the renderers are checked statically and
 * by the production build; visual checks are the owner's Chrome check.
 *
 * The session tests play full Solitaire sessions on the SHIPPED, owner-reviewed data.
 * The test player chooses moves only from what the view shows, using an oracle built
 * from the shipped dataset's own lists (a card is correct for "disease · category"
 * when that topic lists it as correct), never from the policy or generator code.
 */

import { describe, expect, it } from 'vitest';
import { ENGINE_ERROR_CODES, normalizeDisplayText, type PlayerView, type PublicEvent, type SubjectCollection } from '@beepy/shared-engine';
import { CLINICAL_CATEGORIES } from '../src/clinical-content.js';
import { CLINICAL_SERIES_CODES } from '../src/clinical-series.js';
import { loadShippedClinicalContent } from '../src/shipped-data.js';
import { DEFAULT_STYLE, INITIAL_STATE, MENU_MODES, MENU_STYLES, readSettings, transition, type AppState } from '../src/ui/app-state.js';
import { AVAILABLE_MODES, contentProblem } from '../src/ui/app.js';
import { promptDisplay, toBoardModel } from '../src/ui/board-model.js';
import { FEEDBACK_TEXT, toFeedback } from '../src/ui/feedback.js';
import { DISCLAIMER, ERROR_TABLES, MODE_LABELS, STYLE_LABELS, friendlyError } from '../src/ui/labels.js';
import { createGameSession, type GameSession } from '../src/ui/session.js';

async function readSource(relative: string): Promise<string> {
  const specifier = 'node:fs/promises';
  const fs = (await import(/* @vite-ignore */ specifier)) as { readFile(path: URL, encoding: string): Promise<string> };
  return fs.readFile(new URL(relative, import.meta.url), 'utf8');
}

/** Source without comments (block and line), so checks see only code. */
const code = (text: string): string => text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const UI_FILES = ['app-state.ts', 'app.ts', 'board-model.ts', 'feedback.ts', 'labels.ts', 'main.ts', 'seed.ts', 'session.ts', 'render/board.ts', 'render/menu.ts', 'render/dom.ts', 'render/beepy-avatar.ts', 'render/drag.ts'];

/** C7: sessions take a scheduler for Beepy's turn; Solitaire never uses it. */
const NO_BEEPY = { after: () => () => undefined };

const shipped = (): SubjectCollection => {
  const loaded = loadShippedClinicalContent();
  if (!loaded.ok) throw new Error(`shipped content refused: ${loaded.code}`);
  return loaded.content.collection;
};

// ---------------------------------------------------------------------------
// Screen flow
// ---------------------------------------------------------------------------

describe('C6 screen flow (app-state)', () => {
  const go = (state: AppState, ...intents: Parameters<typeof transition>[1][]) => intents.reduce(transition, state);
  const settings = { mode: 'solitaire', direction: 'subjectToFact' } as const;

  it('menu -> setup -> playing -> gameOver -> playing -> seriesOver -> menu', () => {
    const playing = go(INITIAL_STATE, { type: 'chooseMode', mode: 'solitaire' }, { type: 'start', settings });
    expect(playing).toEqual({ screen: { name: 'playing', settings }, seriesNumber: 1 });
    const over = go(playing, { type: 'gameEnded', seriesComplete: false });
    expect(over.screen.name).toBe('gameOver');
    expect(go(over, { type: 'nextGame' }).screen.name).toBe('playing');
    const done = go(over, { type: 'nextGame' }, { type: 'gameEnded', seriesComplete: true });
    expect(done.screen.name).toBe('seriesOver');
    expect(go(done, { type: 'playAgain' })).toEqual({ screen: { name: 'playing', settings }, seriesNumber: 2 });
    expect(go(done, { type: 'mainMenu' }).screen.name).toBe('menu');
  });

  it('setup offers only the question style (no levels); both styles are accepted, defaulting to subjectToFact', () => {
    expect(MENU_STYLES).toEqual(['subjectToFact', 'factToSubject']);
    expect(DEFAULT_STYLE).toBe('subjectToFact');
    expect(readSettings({ mode: 'solitaire', direction: 'factToSubject' }, 'solitaire')).toEqual({ mode: 'solitaire', direction: 'factToSubject' });
    expect(readSettings({ mode: 'solitaire', direction: 'sideways' }, 'solitaire')).toBeUndefined();
    expect(readSettings({ mode: 'vsBeepy', direction: 'subjectToFact' }, 'solitaire')).toBeUndefined();
    expect(readSettings({ mode: 'solitaire', direction: 'subjectToFact', level: 'x' }, 'solitaire')).toEqual(settings);
  });

  it('inapplicable intents change nothing (same object)', () => {
    for (const intent of [{ type: 'back' }, { type: 'nextGame' }, { type: 'playAgain' }, { type: 'quit' }, { type: 'start', settings }, { type: 'chooseMode', mode: 'tutor' }] as const) {
      expect(transition(INITIAL_STATE, intent)).toBe(INITIAL_STATE);
    }
  });

  it('both modes are listed and playable (vsBeepy since C7); Tutor and vsPlayer never appear', () => {
    expect(MENU_MODES).toEqual(['solitaire', 'vsBeepy']);
    expect(AVAILABLE_MODES).toEqual(['solitaire', 'vsBeepy']);
    expect(Object.keys(MODE_LABELS).sort()).toEqual(['solitaire', 'vsBeepy']);
  });
});

// ---------------------------------------------------------------------------
// Labels
// ---------------------------------------------------------------------------

describe('C6 labels', () => {
  it('has friendly text for every engine and Clinical series code', () => {
    expect(Object.keys(ERROR_TABLES.engine).sort()).toEqual(Object.values(ENGINE_ERROR_CODES).sort());
    expect(Object.keys(ERROR_TABLES.clinical).sort()).toEqual(Object.values(CLINICAL_SERIES_CODES).sort());
    expect(friendlyError('NOT_A_CODE')).toBe('Something went wrong. Please try again.');
    expect(friendlyError('CLINICAL_DATA_MISSING')).toBe('The clinical card content has not been added yet.');
  });

  it('the disclaimer is decision C-13, word for word', () => {
    expect(DISCLAIMER).toBe('For study practice only. Not medical advice.');
  });

  it('labels and feedback contain no clinical content from the dataset', () => {
    const collection = shipped();
    const authored = collection.subjects.flatMap((s) => [s.subject, ...s.topics.flatMap((t) => [...t.corrects, ...t.incorrects].map((e) => e.text))]);
    const fixed = JSON.stringify([MODE_LABELS, STYLE_LABELS, FEEDBACK_TEXT, ERROR_TABLES, DISCLAIMER]);
    for (const text of authored) expect(fixed).not.toContain(text);
  });
});

// ---------------------------------------------------------------------------
// Prompt display and board model
// ---------------------------------------------------------------------------

describe('C6 prompt display (layout only, never changes text)', () => {
  it.each(CLINICAL_CATEGORIES.map((c) => c.topicName))('"%s" in both prompt formats', (category) => {
    expect(promptDisplay(`Some Disease · ${category}`)).toEqual({ heading: 'Some Disease', label: category, kind: 'diseaseCategory' });
    expect(promptDisplay(`${category}: some fact: with a colon`)).toEqual({ heading: 'some fact: with a colon', label: category, kind: 'categoryFact' });
  });

  it('anything else is shown unchanged as one line', () => {
    for (const prompt of ['Plain text', 'Work-up', ' · Work-up', 'Labs: x']) expect(promptDisplay(prompt)).toEqual({ heading: prompt, kind: 'plain' });
  });
});

const viewWith = (overrides: Partial<PlayerView> = {}): PlayerView =>
  ({
    mode: 'solitaire',
    viewer: 'human',
    gameIndex: 2,
    phase: 'awaitingAction',
    activePlayer: 'human',
    turnCount: 3,
    hand: [
      { handle: 'h1', displayValue: 'First card text' },
      { handle: 'h2', displayValue: 'Second card text, which is longer and wraps over several lines' },
    ],
    challenges: [
      { id: 'c1', promptText: 'Disease One · Work-up', status: 'open' },
      { id: 'c2', promptText: 'Disease Two · Pathology', status: 'solved', playedCard: { handle: 'hx', displayValue: 'Played text' } },
    ],
    discard: [],
    drawPileCount: 7,
    stats: { plays: 0, correctPlays: 0, discards: 0, correctDiscards: 0, invalidActions: 0 },
    series: { kind: 'session', gamesCompleted: 1, nextGameIndex: 2, complete: false, sessionScore: 4, gameScores: [4] },
    ...overrides,
  }) as unknown as PlayerView;

describe('C6 board model', () => {
  it('nothing is a target until a card is selected; then every open challenge and the discard pile are, alike', () => {
    const idle = toBoardModel(viewWith());
    expect(idle.challenges.map((c) => c.target)).toEqual([false, false]);
    expect(idle.discard.target).toBe(false);
    const selected = toBoardModel(viewWith(), { selectedHandle: 'h2' });
    expect(selected.challenges.map((c) => c.target)).toEqual([true, false]);
    expect(selected.discard.target).toBe(true);
    expect(selected.selectedFace).toBe('Second card text, which is longer and wraps over several lines');
    expect(selected.hand.map((c) => c.selected)).toEqual([false, true]);
  });

  it('card faces and prompts are the view text, verbatim; labels name only text, never ids', () => {
    const model = toBoardModel(viewWith(), { selectedHandle: 'h1' });
    expect(model.hand.map((c) => c.face)).toEqual(['First card text', 'Second card text, which is longer and wraps over several lines']);
    expect(model.challenges[0]).toMatchObject({ prompt: 'Disease One · Work-up', display: { heading: 'Disease One', label: 'Work-up' } });
    expect(model.challenges[1]).toMatchObject({ status: 'solved', playedFace: 'Played text' });
    const labels = JSON.stringify([model.hand.map((c) => c.ariaLabel), model.challenges.map((c) => c.ariaLabel), model.discard.ariaLabel]);
    expect(labels).not.toMatch(/\bk\d+\b|clinical\.|correct(?!\w)|valid/i);
  });

  it('nothing can be done when it is not the human\u2019s turn or the session is busy', () => {
    expect(toBoardModel(viewWith({ phase: 'ended' } as Partial<PlayerView>), { selectedHandle: 'h1' }).canAct).toBe(false);
    expect(toBoardModel(viewWith(), { selectedHandle: 'h1', busy: true }).discard.target).toBe(false);
  });

  it('the score comes from the series status and the outcome only', () => {
    const model = toBoardModel(viewWith());
    expect(model.score).toEqual({ kind: 'solitaire', gameLabel: 'Game 2 of 5', sessionTotal: 4, gamesCompleted: 1, gameScores: [4] });
    const ended = toBoardModel(viewWith({ phase: 'ended', outcome: { kind: 'solitaire', score: 6, turns: 9, cardsRemaining: 1, endedBy: ['allSolved'] } } as unknown as Partial<PlayerView>));
    expect(ended.outcome).toEqual({ title: 'Game over', score: 6, lines: ['You solved all five challenges.', 'Turns taken: 9', 'Cards left in your hand: 1', 'Game score: 6 (lower is better)'] });
  });
});

// ---------------------------------------------------------------------------
// Feedback
// ---------------------------------------------------------------------------

describe('C6 feedback (correctness-only)', () => {
  const resolved = (valid: boolean, kind: 'play' | 'discard' = 'play') =>
    ({ type: 'ACTION_RESOLVED', turn: 1, player: 'human', kind, card: { handle: 'h1', displayValue: 'x' }, destination: kind === 'play' ? 'c1' : 'discard', valid }) as PublicEvent;

  it('maps each event to its fixed message', () => {
    expect(toFeedback([resolved(true)]).items).toEqual([{ tone: 'good', text: FEEDBACK_TEXT.humanPlayGood }]);
    expect(toFeedback([resolved(true, 'discard')]).items).toEqual([{ tone: 'good', text: FEEDBACK_TEXT.humanDiscardGood }]);
    const wrong = toFeedback([resolved(false), { type: 'PENALTY_DRAWN', player: 'human', reason: 'INVALID_ACTION', card: { handle: 'h9', displayValue: 'y' } } as PublicEvent]);
    expect(wrong.items).toEqual([{ tone: 'oops', text: FEEDBACK_TEXT.humanWrong }, { tone: 'oops', text: 'You drew 1 card.' }]);
    expect(wrong.newCardHandles).toEqual(['h9']);
    expect(toFeedback([resolved(false), { type: 'PENALTY_WAIVED', owed: [], fallbackStatus: 'EXHAUSTED' } as PublicEvent]).items.map((i) => i.text)).toEqual([FEEDBACK_TEXT.humanWrong, FEEDBACK_TEXT.waived]);
  });

  it('never shows the card text, the correct answer, or an explanation', () => {
    const text = JSON.stringify(toFeedback([resolved(false)]));
    expect(text).not.toContain('"x"');
    expect(JSON.stringify(FEEDBACK_TEXT)).not.toMatch(/explanation|because|answer is/i);
  });
});

// ---------------------------------------------------------------------------
// Full sessions on the shipped data
// ---------------------------------------------------------------------------

/** Oracle from the shipped dataset's own lists (not the policy code). */
function datasetOracle(collection: SubjectCollection) {
  const correctBy = new Map<string, Set<string>>(); // "<disease> · <category>" -> correct texts
  const diseasesOfFact = new Map<string, Set<string>>(); // "<category>: <fact>" -> diseases listing it as correct
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

interface Played {
  games: number;
  views: PlayerView[];
  waived: number;
  wrong: number;
  right: number;
}

function playSession(session: GameSession, isValid: (card: string, prompt: string) => boolean, wrongEvery: number): Played {
  const played: Played = { games: 1, views: [], waived: 0, wrong: 0, right: 0 };
  let steps = 0;
  for (;;) {
    const snap = session.snapshot();
    played.views.push(snap.view);
    if (snap.gameOver) {
      if (snap.seriesComplete) return played;
      session.nextGame();
      played.games += 1;
      continue;
    }
    steps += 1;
    if (steps > 5000) throw new Error('test-only step limit');
    const view = snap.view;
    const open = view.challenges.filter((c) => c.status === 'open');
    const makeWrong = steps % wrongEvery === 0;
    let move: { handle: string; challengeId?: string } | undefined;
    for (const card of view.hand) {
      const target = open.find((c) => isValid(card.displayValue, c.promptText));
      if (makeWrong) {
        if (target !== undefined) {
          move = { handle: card.handle }; // discarding a valid card is wrong
          break;
        }
      } else if (target !== undefined) {
        move = { handle: card.handle, challengeId: target.id };
        break;
      }
    }
    if (move === undefined) {
      const card = view.hand[0]!;
      move = makeWrong ? { handle: card.handle, challengeId: open[0]!.id } : { handle: card.handle };
    }
    session.select(move.handle);
    expect(session.snapshot().selectedHandle).toBe(move.handle);
    if (move.challengeId === undefined) session.discard();
    else session.playOn(move.challengeId);
    const after = session.snapshot();
    expect(after.error).toBeUndefined();
    for (const item of after.feedback.items) {
      if (item.text === FEEDBACK_TEXT.humanWrong) played.wrong += 1;
      if (item.text === FEEDBACK_TEXT.humanPlayGood || item.text === FEEDBACK_TEXT.humanDiscardGood) played.right += 1;
      if (item.text === FEEDBACK_TEXT.waived) played.waived += 1;
    }
  }
}

describe('C6 full Solitaire sessions on the shipped, reviewed data', () => {
  const collection = shipped();
  const isValid = datasetOracle(collection);
  const explanations = collection.subjects.flatMap((s) => [...s.subjectIncorrects, ...s.topics.flatMap((t) => [...t.corrects, ...t.incorrects])].flatMap((e) => (e.explanation === undefined ? [] : [e.explanation])));

  it('the shipped content loads, so the app shows the menu (no data error screen)', () => {
    expect(contentProblem()).toBeUndefined();
  });

  it.each(['subjectToFact', 'factToSubject'] as const)('%s: five games complete; verdicts match the dataset oracle; nothing leaks', (direction) => {
    for (const seed of [1, 2, 3]) {
      const created = createGameSession({ scheduler: NO_BEEPY, settings: { mode: 'solitaire', direction }, seed });
      if (!created.ok) throw new Error(created.error);
      const played = playSession(created.session, isValid, 4);
      expect(played.games).toBe(5);
      const last = created.session.snapshot();
      expect(last.seriesComplete).toBe(true);
      const score = last.board.score;
      if (score.kind !== 'solitaire') throw new Error('expected a Solitaire score');
      expect(score.gameScores).toHaveLength(5);
      expect(score.sessionTotal).toBe(score.gameScores.reduce((a, b) => a + b, 0));
      expect(played.right).toBeGreaterThan(0);
      expect(played.wrong).toBeGreaterThan(0);

      for (const view of played.views) {
        expect(view.challenges).toHaveLength(5);
        // Every prompt is in the expected format and its clinical text is authored text.
        for (const c of view.challenges) expect(promptDisplay(c.promptText).kind).toBe(direction === 'subjectToFact' ? 'diseaseCategory' : 'categoryFact');
        // No duplicate card text anywhere visible.
        const texts = [...view.hand, ...view.discard, ...view.challenges.flatMap((c) => (c.playedCard ? [c.playedCard] : []))].map((c) => normalizeDisplayText(c.displayValue));
        expect(new Set(texts).size).toBe(texts.length);
        for (const card of view.hand) expect([...card.displayValue].length).toBeLessThanOrEqual(140);
      }
      const visible = JSON.stringify(played.views);
      expect(visible).not.toMatch(/"k\d+"|clinical\.answer\.|correctAnswerCardId|contextualValidity|explanationByChallengeId|fp1-|reviewedBy/);
      for (const explanation of explanations) expect(visible).not.toContain(explanation);
    }
  });

  it('starting hands hold five distinct cards with two or three correct (per the dataset oracle)', () => {
    for (const direction of ['subjectToFact', 'factToSubject'] as const) {
      for (let seed = 1; seed <= 10; seed += 1) {
        const created = createGameSession({ scheduler: NO_BEEPY, settings: { mode: 'solitaire', direction }, seed });
        if (!created.ok) throw new Error(created.error);
        const view = created.session.snapshot().view;
        expect(view.hand).toHaveLength(5);
        const correct = view.hand.filter((card) => view.challenges.some((c) => isValid(card.displayValue, c.promptText))).length;
        expect([2, 3]).toContain(correct);
      }
    }
  });

  it('session guards: no duplicate requests, no action without a selection, and nothing after leave', () => {
    const created = createGameSession({ scheduler: NO_BEEPY, settings: { mode: 'solitaire', direction: 'subjectToFact' }, seed: 9 });
    if (!created.ok) throw new Error(created.error);
    const s = created.session;
    const before = s.snapshot().view.turnCount;
    s.discard();
    s.playOn('c1');
    expect(s.snapshot().view.turnCount).toBe(before);
    s.select('not-a-handle');
    expect(s.snapshot().selectedHandle).toBeUndefined();
    const handle = s.snapshot().view.hand[0]!.handle;
    s.select(handle);
    s.select(handle);
    expect(s.snapshot().selectedHandle).toBeUndefined();
    s.select(handle);
    s.cancel();
    expect(s.snapshot().selectedHandle).toBeUndefined();
    s.leave();
    s.select(handle);
    s.discard();
    expect(s.snapshot().view.turnCount).toBe(before);
  });

  it('a session on content that fails validation is refused with friendly text, never with other content', () => {
    const created = createGameSession({ scheduler: NO_BEEPY, settings: { mode: 'solitaire', direction: 'subjectToFact' }, seed: 1, dataset: { schemaVersion: '1.0.0', subjects: [] } });
    expect(created).toEqual({ ok: false, error: 'The clinical card data could not be loaded.', code: 'CLINICAL_DATA_INVALID' });
  });
});

// ---------------------------------------------------------------------------
// Static structure and boundaries
// ---------------------------------------------------------------------------

describe('C6 structure and boundaries', () => {
  it('the UI never imports math-cards, uses no storage, network, innerHTML, or extra random source', async () => {
    for (const file of UI_FILES) {
      const text = code(await readSource(`../src/ui/${file}`));
      expect(text, file).not.toMatch(/from ['"][^'"]*math-cards/);
      expect(text, file).not.toMatch(/localStorage|sessionStorage|indexedDB|document\.cookie|fetch\(|XMLHttpRequest|WebSocket|navigator\.sendBeacon/);
      expect(text, file).not.toMatch(/innerHTML|outerHTML|insertAdjacentHTML/);
      if (file !== 'seed.ts') expect(text, file).not.toMatch(/Math\.random|getRandomValues/);
    }
  });

  it('only session.ts creates a series; the renderers never read a deck', async () => {
    for (const file of UI_FILES) {
      const text = await readSource(`../src/ui/${file}`);
      if (file !== 'session.ts') expect(text, file).not.toMatch(/createClinicalSeries\(|explainResolved/);
      expect(text, file).not.toMatch(/correctAnswerCardId|contextualValidity|explanationByChallengeId/);
    }
  });

  it('elements carry only opaque handles and neutral challenge ids (no card ids, entry ids or correctness)', async () => {
    const board = await readSource('../src/ui/render/board.ts');
    expect(board).not.toMatch(/data-(card|entry|correct|valid|answer)/);
    expect(board).toMatch(/'data-handle': card\.handle/);
  });

  it('the menu and setup screens show the disclaimer; the data error screen offers no game', async () => {
    const menu = await readSource('../src/ui/render/menu.ts');
    expect(menu.match(/disclaimer\(\)/g)?.length).toBeGreaterThanOrEqual(3);
    const errorScreen = menu.slice(menu.indexOf('export function renderDataError'));
    expect(errorScreen).not.toMatch(/onStart|onChoose|btn--primary/);
  });

  it('index.html loads the Clinical entry and stylesheet; the build uses web-dist and relative paths', async () => {
    const html = await readSource('../index.html');
    expect(html).toContain('<title>Beepy\'s Clinical Cards</title>');
    expect(html).toContain('./src/ui/main.ts');
    expect(html).toContain('./src/ui/styles.css');
    const pkg = JSON.parse(await readSource('../package.json')) as { scripts: Record<string, string> };
    expect(pkg.scripts['build']).toBe('vite build --outDir web-dist --base ./ --emptyOutDir');
  });

  it('the stylesheet has the Clinical theme, wide multi-line cards, and no retro or pixel styling', async () => {
    const css = await readSource('../src/ui/styles.css');
    expect(css).toContain('M6 C6: Clinical theme');
    expect(css).toMatch(/\.card--text\s*\{[^}]*height: auto/);
    expect(css).toMatch(/\.card--text \.card__face\s*\{[^}]*overflow-wrap: anywhere/);
    expect(css).toContain('prefers-reduced-motion');
    expect(code(css)).not.toMatch(/pixelated|crisp-edges|press start|8-?bit|@import|url\(\s*['"]?https?:/i);
  });

  it('keyboard: every interactive board element is a real button with a focus key', async () => {
    const board = await readSource('../src/ui/render/board.ts');
    const buttons = board.match(/h\(\s*'button'/g)?.length ?? 0;
    const focusKeys = board.match(/'data-focus':/g)?.length ?? 0;
    // C7: two focusable headings (Beepy's move, the explanation) also carry focus keys.
    const focusHeadings = board.match(/h\('h2', \{[^}]*tabindex: -1, 'data-focus'/g)?.length ?? 0;
    expect(buttons).toBeGreaterThanOrEqual(7);
    expect(focusHeadings).toBe(2);
    expect(focusKeys).toBe(buttons + focusHeadings);
    expect(board).not.toMatch(/h\(\s*'div',\s*\{[^}]*on:\s*\{\s*click/);
  });
});
