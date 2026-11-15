/**
 * M6 C7 - Player vs. Beepy, Explain Why, drag-and-drop (tasks.md C7; design §7-§8).
 *
 * Node only, no DOM library (U-2 pattern). Full matches are played through the UI
 * session on the SHIPPED, owner-reviewed data in both question styles, with a manual
 * scheduler for Beepy's turn. The test player sees only the view; it judges moves
 * and Beepy's pending moves with an oracle built from the shipped dataset's own lists
 * (not the policy or generator code), and makes deliberate mistakes to exercise every
 * penalty path.
 *
 * Explain Why uses the FICTIONAL fixture, because the shipped dataset currently has
 * no authored explanations (so in the shipped app the button never appears).
 */

import { describe, expect, it } from 'vitest';
import { normalizeDisplayText, type PlayerView, type SubjectCollection } from '@beepy/shared-engine';
import { loadShippedClinicalContent } from '../src/shipped-data.js';
import { toBoardModel } from '../src/ui/board-model.js';
import { FEEDBACK_TEXT } from '../src/ui/feedback.js';
import { DRAG_THRESHOLD_PX, createDragController, parseDropTarget, type DragActions } from '../src/ui/render/drag.js';
import { BEEPY_THINK_MS, createGameSession, type GameSession, type Scheduler } from '../src/ui/session.js';
import { largeFakeDataset, reviewFileFor } from './fixtures/fake-large-clinical.js';

async function readSource(relative: string): Promise<string> {
  const specifier = 'node:fs/promises';
  const fs = (await import(/* @vite-ignore */ specifier)) as { readFile(path: URL, encoding: string): Promise<string> };
  return fs.readFile(new URL(relative, import.meta.url), 'utf8');
}

function manualScheduler() {
  const tasks: Array<{ ms: number; run: () => void; cancelled: boolean }> = [];
  const scheduler: Scheduler = {
    after(ms, run) {
      const task = { ms, run, cancelled: false };
      tasks.push(task);
      return () => {
        task.cancelled = true;
      };
    },
  };
  return {
    scheduler,
    pending: () => tasks.filter((t) => !t.cancelled).length,
    lastDelay: () => tasks.at(-1)?.ms,
    runNext: (): boolean => {
      const task = tasks.find((t) => !t.cancelled);
      if (task === undefined) return false;
      task.cancelled = true;
      task.run();
      return true;
    },
  };
}

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

const shipped = (): SubjectCollection => {
  const loaded = loadShippedClinicalContent();
  if (!loaded.ok) throw new Error(loaded.code);
  return loaded.content.collection;
};

interface Tally {
  games: number;
  views: PlayerView[];
  humanTurns: number;
  beepyMoves: number;
  accepted: { valid: number; invalid: number };
  challenged: { valid: number; invalid: number };
  humanWrong: number;
  /** Penalty outcomes after each decision kind: did the expected players draw (or was it waived)? */
  penaltyChecks: number;
  beepyFirstGames: number;
}

/** Play a whole match through the session; returns what happened. */
function playMatch(session: GameSession, clock: ReturnType<typeof manualScheduler>, isValid: (card: string, prompt: string) => boolean, rng: () => number): Tally {
  const t: Tally = { games: 1, views: [], humanTurns: 0, beepyMoves: 0, accepted: { valid: 0, invalid: 0 }, challenged: { valid: 0, invalid: 0 }, humanWrong: 0, penaltyChecks: 0, beepyFirstGames: 0 };
  let steps = 0;
  let firstMoveOfGame = true;
  const drew = (who: 'human' | 'beepy', items: readonly { text: string }[]) =>
    items.some((i) => i.text.startsWith(who === 'human' ? 'You drew' : 'Beepy drew')) ||
    items.some((i) => i.text === FEEDBACK_TEXT.waived || i.text === FEEDBACK_TEXT.notApplied);

  for (;;) {
    steps += 1;
    if (steps > 6000) throw new Error('test-only step limit');
    const snap = session.snapshot();
    const view = snap.view;
    t.views.push(view);

    if (snap.gameOver) {
      if (snap.seriesComplete) return t;
      session.nextGame();
      t.games += 1;
      firstMoveOfGame = true;
      continue;
    }

    if (snap.beepyThinking) {
      if (firstMoveOfGame) t.beepyFirstGames += 1;
      firstMoveOfGame = false;
      // While Beepy thinks, the human cannot act.
      const handle = view.hand[0]?.handle;
      if (handle !== undefined) session.select(handle);
      expect(session.snapshot().selectedHandle).toBeUndefined();
      expect(snap.board.canAct).toBe(false);
      expect(clock.runNext()).toBe(true);
      continue;
    }

    if (view.phase === 'awaitingEvaluation') {
      t.beepyMoves += 1;
      const p = view.pending!;
      const open = view.challenges.filter((c) => c.status === 'open');
      const valid =
        p.kind === 'play'
          ? isValid(p.card.displayValue, view.challenges.find((c) => c.id === p.destination)!.promptText)
          : !open.some((c) => isValid(p.card.displayValue, c.promptText));
      // The pending panel shows only the card and destination, and no Explain Why.
      expect(snap.board.pending).toMatchObject({ face: p.card.displayValue, canDecide: true });
      expect(snap.board.explain).toBeUndefined();
      expect(snap.explain.available).toBe(false);
      const decideRight = rng() < 0.75;
      const accept = decideRight ? valid : !valid;
      if (accept) session.accept();
      else session.challenge();
      const after = session.snapshot().feedback.items;
      const texts = after.map((i) => i.text);
      if (accept && valid) {
        t.accepted.valid += 1;
        expect(texts).toContain(FEEDBACK_TEXT.beepyValidAccepted);
      } else if (accept && !valid) {
        t.accepted.invalid += 1;
        expect(texts).toContain(FEEDBACK_TEXT.beepyInvalidAccepted);
        // Owner rule (M3): an accepted invalid Beepy move means both players draw.
        expect(drew('beepy', after) && drew('human', after)).toBe(true);
        t.penaltyChecks += 1;
      } else if (!accept && valid) {
        t.challenged.valid += 1;
        expect(texts).toContain(FEEDBACK_TEXT.beepyValidChallenged);
        expect(drew('human', after)).toBe(true); // a wrong challenge costs the human
        t.penaltyChecks += 1;
      } else {
        t.challenged.invalid += 1;
        expect(texts).toContain(FEEDBACK_TEXT.beepyInvalidChallenged);
        expect(drew('beepy', after)).toBe(true);
        t.penaltyChecks += 1;
      }
      continue;
    }

    // Human turn.
    expect(view.activePlayer).toBe('human');
    firstMoveOfGame = false;
    t.humanTurns += 1;
    const open = view.challenges.filter((c) => c.status === 'open');
    const makeWrong = rng() < 0.2;
    let move: { handle: string; challengeId?: string } | undefined;
    for (const card of view.hand) {
      const target = open.find((c) => isValid(card.displayValue, c.promptText));
      if (target !== undefined) {
        move = makeWrong ? { handle: card.handle } : { handle: card.handle, challengeId: target.id };
        break;
      }
    }
    move ??= makeWrong ? { handle: view.hand[0]!.handle, challengeId: open[0]!.id } : { handle: view.hand[0]!.handle };
    session.select(move.handle);
    if (move.challengeId === undefined) session.discard();
    else session.playOn(move.challengeId);
    const after = session.snapshot();
    expect(after.error).toBeUndefined();
    if (after.feedback.items.some((i) => i.text === FEEDBACK_TEXT.humanWrong)) {
      t.humanWrong += 1;
      expect(drew('human', after.feedback.items)).toBe(true);
    }
  }
}

const seeded = (seed: number) => {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
};

describe('C7 full Player vs. Beepy matches on the shipped, reviewed data', () => {
  const collection = shipped();
  const isValid = datasetOracle(collection);
  const authoredTexts = new Set(collection.subjects.flatMap((s) => [s.subject, ...s.topics.flatMap((tp) => [...tp.corrects, ...tp.incorrects].map((e) => e.text))]));

  describe.each(['subjectToFact', 'factToSubject'] as const)('%s', (direction) => {
    const results = [11, 22, 33].map((seed) => {
      const clock = manualScheduler();
      const created = createGameSession({ settings: { mode: 'vsBeepy', direction }, seed, scheduler: clock.scheduler });
      if (!created.ok) throw new Error(created.error);
      const tally = playMatch(created.session, clock, isValid, seeded(seed));
      return { tally, final: created.session.snapshot() };
    });

    it('each match ends best-of-five: first to 3 wins, 3 to 5 games', () => {
      for (const { tally, final } of results) {
        expect(final.seriesComplete).toBe(true);
        const score = final.board.score;
        if (score.kind !== 'vsBeepy') throw new Error('expected a match score');
        expect(Math.max(score.wins.human, score.wins.beepy)).toBe(3);
        expect(tally.games).toBeGreaterThanOrEqual(3);
        expect(tally.games).toBeLessThanOrEqual(5);
        expect(final.completedOutcomes).toHaveLength(tally.games);
        expect(final.board.match?.decided).toBe(true);
        expect(final.board.match?.games).toHaveLength(tally.games);
      }
    });

    it('turns alternate; Beepy acts after its think delay, sometimes first in a game', () => {
      const all = results.map((r) => r.tally);
      expect(all.every((t) => t.humanTurns > 0 && t.beepyMoves > 0)).toBe(true);
      expect(all.reduce((n, t) => n + t.beepyFirstGames, 0)).toBeGreaterThan(0);
      expect(BEEPY_THINK_MS).toBe(1000);
    });

    it('every Accept/Challenge outcome and its penalty occurred, as the rules require', () => {
      const sum = (pick: (t: Tally) => number) => results.reduce((n, r) => n + pick(r.tally), 0);
      expect(sum((t) => t.accepted.valid)).toBeGreaterThan(0);
      expect(sum((t) => t.challenged.invalid)).toBeGreaterThan(0);
      expect(sum((t) => t.accepted.invalid + t.challenged.valid)).toBeGreaterThan(0);
      expect(sum((t) => t.humanWrong)).toBeGreaterThan(0);
      expect(sum((t) => t.penaltyChecks)).toBeGreaterThan(0);
    });

    it('nine shared challenges; no duplicate visible card; every text is authored; nothing private leaks', () => {
      for (const { tally } of results) {
        for (const view of tally.views) {
          expect(view.challenges).toHaveLength(9);
          expect(view.opponentHandCount).toBeGreaterThanOrEqual(0);
          const texts = [...view.hand, ...view.discard, ...view.challenges.flatMap((c) => (c.playedCard ? [c.playedCard] : [])), ...(view.pending ? [view.pending.card] : [])].map((c) => normalizeDisplayText(c.displayValue));
          const unique = new Set(texts);
          // The pending card is also still counted in Beepy's (hidden) hand, never twice in the visible zones.
          expect(unique.size).toBe(texts.length);
          for (const card of view.hand) expect(authoredTexts.has(card.displayValue)).toBe(true);
        }
        const visible = JSON.stringify(tally.views);
        expect(visible).not.toMatch(/"k\d+"|clinical\.answer\.|correctAnswerCardId|contextualValidity|explanationByChallengeId|fp1-|reviewedBy/);
      }
    });

    it('starting hands: five distinct cards for you, five for Beepy, with 2-3 correct in yours', () => {
      for (let seed = 1; seed <= 8; seed += 1) {
        const created = createGameSession({ settings: { mode: 'vsBeepy', direction }, seed, scheduler: manualScheduler().scheduler });
        if (!created.ok) throw new Error(created.error);
        const view = created.session.snapshot().view;
        expect(view.hand).toHaveLength(5);
        expect(view.opponentHandCount).toBe(5);
        const correct = view.hand.filter((card) => view.challenges.some((c) => isValid(card.displayValue, c.promptText))).length;
        expect([2, 3]).toContain(correct);
      }
    });
  });

  it('fact -> disease uses the validated reduced 14-card deck (10 dealt + 4 to draw); disease + category -> fact is larger', () => {
    for (let seed = 1; seed <= 6; seed += 1) {
      const f2s = createGameSession({ settings: { mode: 'vsBeepy', direction: 'factToSubject' }, seed, scheduler: manualScheduler().scheduler });
      const s2f = createGameSession({ settings: { mode: 'vsBeepy', direction: 'subjectToFact' }, seed, scheduler: manualScheduler().scheduler });
      if (!f2s.ok || !s2f.ok) throw new Error('session');
      expect(f2s.session.snapshot().view.drawPileCount).toBe(4);
      expect(s2f.session.snapshot().view.drawPileCount).toBeGreaterThanOrEqual(10);
    }
  });
});

describe('C7 Beepy turn handling', () => {
  it('you move first in game 1; after your move Beepy thinks for BEEPY_THINK_MS; leaving cancels it', () => {
    const clock = manualScheduler();
    const created = createGameSession({ settings: { mode: 'vsBeepy', direction: 'subjectToFact' }, seed: 7, scheduler: clock.scheduler });
    if (!created.ok) throw new Error(created.error);
    const s = created.session;
    expect(s.snapshot().view.activePlayer).toBe('human');
    expect(s.snapshot().beepyThinking).toBe(false);
    expect(clock.pending()).toBe(0);
    s.select(s.snapshot().view.hand[0]!.handle);
    s.discard();
    expect(s.snapshot().beepyThinking).toBe(true);
    expect(clock.lastDelay()).toBe(BEEPY_THINK_MS);
    expect(clock.pending()).toBe(1);
    s.leave();
    expect(clock.pending()).toBe(0);
  });

  it('Accept and Challenge do nothing unless Beepy\u2019s move is waiting', () => {
    const created = createGameSession({ settings: { mode: 'vsBeepy', direction: 'subjectToFact' }, seed: 2, scheduler: manualScheduler().scheduler });
    if (!created.ok) throw new Error(created.error);
    const before = created.session.snapshot().view;
    created.session.accept();
    created.session.challenge();
    expect(created.session.snapshot().view).toEqual(before);
  });
});

describe('C7 Explain Why (fictional fixture with authored placeholder explanations)', () => {
  const data = largeFakeDataset({ diseases: 16, alternatives: 10 });
  const review = reviewFileFor(data, { topics: 'full', alternatives: true });
  const correctOf = (card: string, prompt: string) => {
    const [disease, topicName] = prompt.split(' · ');
    const s = data.subjects.find((x) => x.subject === disease);
    return s?.topics.find((tp) => tp.topicName === topicName)?.corrects.some((e) => e.text === card) === true;
  };

  it('appears only after a resolved play that has an authored explanation; text is verbatim and only on request', () => {
    let opened = 0;
    let absentAfterPlay = 0;
    for (let seed = 1; seed <= 12; seed += 1) {
      const created = createGameSession({ settings: { mode: 'solitaire', direction: 'subjectToFact' }, seed, scheduler: manualScheduler().scheduler, dataset: data, review });
      if (!created.ok) throw new Error(created.error);
      const s = created.session;
      expect(s.snapshot().explain).toEqual({ available: false }); // nothing before any action
      for (let step = 0; step < 6 && !s.snapshot().gameOver; step += 1) {
        const view = s.snapshot().view;
        const open = view.challenges.filter((c) => c.status === 'open');
        let played = false;
        for (const card of view.hand) {
          const target = open.find((c) => correctOf(card.displayValue, c.promptText));
          if (target === undefined) continue;
          s.select(card.handle);
          s.playOn(target.id);
          played = true;
          const authored = data.subjects.flatMap((x) => x.topics).flatMap((tp) => tp.corrects).find((e) => e.text === card.displayValue)?.explanation;
          const snap = s.snapshot();
          if (authored === undefined) {
            expect(snap.explain).toEqual({ available: false });
            expect(snap.board.explain).toBeUndefined();
            absentAfterPlay += 1;
          } else {
            expect(snap.explain).toEqual({ available: true }); // offered, text hidden
            expect(snap.board.explain).toEqual({ open: false });
            expect(JSON.stringify(snap.board)).not.toContain(authored);
            s.openExplanation();
            expect(s.snapshot().explain).toEqual({ available: true, text: authored });
            expect(s.snapshot().board.explain).toEqual({ open: true, text: authored });
            s.closeExplanation();
            expect(s.snapshot().board.explain).toEqual({ open: false });
            opened += 1;
          }
          break;
        }
        if (!played) {
          s.select(view.hand[0]!.handle);
          s.discard();
          expect(s.snapshot().explain).toEqual({ available: false }); // discards: none (C-11)
        }
      }
    }
    expect(opened).toBeGreaterThan(0);
    expect(absentAfterPlay).toBeGreaterThan(0);
  });

  it('the next step clears it; a wrong play onto another topic has none (no substitute)', () => {
    const created = createGameSession({ settings: { mode: 'solitaire', direction: 'subjectToFact' }, seed: 5, scheduler: manualScheduler().scheduler, dataset: data, review });
    if (!created.ok) throw new Error(created.error);
    const s = created.session;
    const view = s.snapshot().view;
    const open = view.challenges.filter((c) => c.status === 'open');
    const card = view.hand.find((c) => open.some((ch) => !correctOf(c.displayValue, ch.promptText)))!;
    const wrongTarget = open.find((ch) => !correctOf(card.displayValue, ch.promptText))!;
    s.select(card.handle);
    s.playOn(wrongTarget.id);
    expect(s.snapshot().feedback.items.map((i) => i.text)).toContain(FEEDBACK_TEXT.humanWrong);
    expect(s.snapshot().explain).toEqual({ available: false });
  });

  it('the board model never offers Explain Why while a Beepy move is pending', () => {
    const pendingView = {
      mode: 'vsBeepy', viewer: 'human', gameIndex: 1, phase: 'awaitingEvaluation', activePlayer: 'beepy', turnCount: 1, hand: [], opponentHandCount: 5,
      challenges: [{ id: 'c1', promptText: 'D · Work-up', status: 'open' }], discard: [], drawPileCount: 3,
      pending: { player: 'beepy', kind: 'play', card: { handle: 'h1', displayValue: 'x' }, destination: 'c1' },
      stats: {},
    } as unknown as PlayerView;
    expect(toBoardModel(pendingView, { explain: { available: true, text: 'leak' } }).explain).toBeUndefined();
  });
});

describe('C7 drag-and-drop gives the same commands as tapping (real session)', () => {
  const setup = () => {
    const created = createGameSession({ settings: { mode: 'solitaire', direction: 'subjectToFact' }, seed: 4, scheduler: manualScheduler().scheduler });
    if (!created.ok) throw new Error(created.error);
    const s = created.session;
    const actions: DragActions = {
      select: (h) => s.select(h),
      cancel: () => s.cancel(),
      playOn: (id) => s.playOn(id),
      discard: () => s.discard(),
      isSelected: (h) => s.snapshot().selectedHandle === h,
      canDrag: () => s.snapshot().board.canAct,
    };
    return { s, drag: createDragController(actions) };
  };

  it('a short press is a tap; a drag past the threshold selects; a drop on a challenge plays it through the engine', () => {
    const { s, drag } = setup();
    const view = s.snapshot().view;
    const card = view.hand[0]!;
    expect(drag.press(card.handle, 0, 0)).toBe(true);
    expect(drag.release(undefined)).toBe('tap');
    drag.press(card.handle, 0, 0);
    expect(drag.move(DRAG_THRESHOLD_PX - 1, 0)).toBe('none');
    expect(drag.move(DRAG_THRESHOLD_PX, 0)).toBe('started');
    expect(s.snapshot().selectedHandle).toBe(card.handle);
    const target = view.challenges[0]!;
    expect(drag.release(parseDropTarget(`challenge:${target.id}`))).toBe('dropped');
    expect(s.snapshot().view.turnCount).toBe(view.turnCount + 1);
    expect(s.snapshot().view.hand.some((c) => c.handle === card.handle) || s.snapshot().view.challenges[0]!.status === 'solved').toBe(true);
  });

  it('a drop outside any target plays nothing and clears the selection it made', () => {
    const { s, drag } = setup();
    const before = s.snapshot().view.turnCount;
    const card = s.snapshot().view.hand[1]!;
    drag.press(card.handle, 0, 0);
    drag.move(50, 50);
    expect(drag.release(undefined)).toBe('cancelled');
    expect(s.snapshot().selectedHandle).toBeUndefined();
    expect(s.snapshot().view.turnCount).toBe(before);
    expect(parseDropTarget('discard')).toEqual({ kind: 'discard' });
    expect(parseDropTarget('challenge:')).toBeUndefined();
  });

  it('drag.ts is the Math module unchanged, and drop targets exist only where tapping works', async () => {
    expect(await readSource('../src/ui/render/drag.ts')).toBe(await readSource('../../math-cards/src/ui/render/drag.ts'));
    const board = await readSource('../src/ui/render/board.ts');
    expect(board).toMatch(/'data-drop': challenge\.target \? `challenge:\$\{challenge\.id\}` : undefined/);
    expect(board).toMatch(/'data-drop': board\.discard\.target \? 'discard' : undefined/);
  });
});

describe('C7 structure', () => {
  it('Accept and Challenge are styled identically; Beepy\u2019s hand is face-down (count only)', async () => {
    const board = await readSource('../src/ui/render/board.ts');
    const decisions = board.match(/h\('button', \{ class: '([^']+)', attrs: \{ type: 'button', 'data-focus': '(accept|challenge)'/g) ?? [];
    expect(decisions).toHaveLength(2);
    expect(new Set(decisions.map((d) => /class: '([^']+)'/.exec(d)![1])).size).toBe(1);
    expect(board).toMatch(/card-back/);
  });

  it('the nine-challenge board is 5 + 4 on desktop, 3 and 2 columns on smaller screens', async () => {
    const css = await readSource('../src/ui/styles.css');
    const section = css.slice(css.indexOf('M6 C7: Player vs. Beepy'));
    expect(section).toMatch(/\.board--clinical\.board--vsBeepy \.challenges--nine \{[^}]*repeat\(5,/);
    expect(section).toMatch(/max-width: 1099px\)[\s\S]*repeat\(3,/);
    expect(section).toMatch(/max-width: 768px\)[\s\S]*repeat\(2,/);
  });
});
