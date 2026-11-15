/**
 * M5 U10 - drag-and-drop. The DOM-free drag controller is driven against a REAL
 * game session, so a drag goes through exactly the same commands, engine judging,
 * penalties, and scoring as tapping. The pointer wiring itself is checked by the
 * owner in Chrome.
 */

import { describe, expect, it } from 'vitest';
import { DRAG_THRESHOLD_PX, createDragController, parseDropTarget, type DragActions, type DropTarget } from '../src/ui/render/drag.js';
import { createGameSession, type GameSession, type Scheduler } from '../src/ui/session.js';
import type { GameSettings } from '../src/ui/app-state.js';
import { cardNumber, promptSum, type Direction } from './math-oracle.js';

function manualScheduler() {
  const tasks: Array<{ run: () => void; cancelled: boolean }> = [];
  const scheduler: Scheduler = {
    after(_ms, run) {
      const task = { run, cancelled: false };
      tasks.push(task);
      return () => {
        task.cancelled = true;
      };
    },
  };
  return {
    scheduler,
    runNext: () => {
      const task = tasks.find((t) => !t.cancelled);
      if (task === undefined) return false;
      task.cancelled = true;
      task.run();
      return true;
    },
  };
}

function setup(settings: GameSettings, seed: number) {
  const clock = manualScheduler();
  const created = createGameSession({ settings, seed, scheduler: clock.scheduler });
  if (!created.ok) throw new Error(created.error);
  const session = created.session;
  const calls: string[] = [];
  const actions: DragActions = {
    select: (h) => {
      calls.push('select');
      session.select(h);
    },
    cancel: () => {
      calls.push('cancel');
      session.cancel();
    },
    playOn: (id) => {
      calls.push('playOn');
      session.playOn(id);
    },
    discard: () => {
      calls.push('discard');
      session.discard();
    },
    isSelected: (h) => session.snapshot().selectedHandle === h,
    canDrag: () => session.snapshot().board?.canAct === true,
  };
  return { session, clock, calls, drag: createDragController(actions) };
}

/** Problems and cards read from the board (the child's arithmetic, via the oracle). */
function read(session: GameSession, direction: Direction) {
  const board = session.snapshot().board!;
  const open = new Map(board.challenges.filter((c) => c.status === 'open').map((c) => [promptSum(c.prompt, direction), c.id]));
  const value = (face: string) => cardNumber(face, direction)!;
  const correct = board.hand.find((c) => open.has(value(c.face)));
  const distractor = board.hand.find((c) => !open.has(value(c.face)));
  return { board, open, value, correct, distractor };
}

/** A full drag gesture: press, move past the threshold, release over `target`. */
function dragTo(drag: ReturnType<typeof setup>['drag'], handle: string, target: DropTarget | undefined) {
  expect(drag.press(handle, 100, 100)).toBe(true);
  expect(drag.move(100, 100 - DRAG_THRESHOLD_PX - 2)).toBe('started');
  expect(drag.move(300, 40)).toBe('moving');
  return drag.release(target);
}

const solitaire: GameSettings = { mode: 'solitaire', level: 'oneDigit', direction: 'factToSubject' };

describe('parseDropTarget', () => {
  it('reads challenge and discard targets, and nothing else', () => {
    expect(parseDropTarget('challenge:c3')).toEqual({ kind: 'play', challengeId: 'c3' });
    expect(parseDropTarget('discard')).toEqual({ kind: 'discard' });
    for (const bad of [undefined, null, '', 'challenge:', 'card:h1', 'Discard']) expect(parseDropTarget(bad)).toBeUndefined();
  });
});

describe('a drag gives the same commands as tapping', () => {
  it('dragging a correct card onto its problem solves it (engine-judged)', () => {
    const { session, drag, calls } = setup(solitaire, 4);
    const { correct, open, value } = read(session, 'factToSubject');
    const id = open.get(value(correct!.face))!;
    expect(dragTo(drag, correct!.handle, { kind: 'play', challengeId: id })).toBe('dropped');
    expect(calls).toEqual(['select', 'playOn']);
    const s = session.snapshot();
    expect(s.view?.turnCount).toBe(1);
    expect(s.board?.challenges.find((c) => c.id === id)?.status).toBe('solved');
    expect(s.selectedHandle).toBeUndefined();
  });

  it('dragging onto the wrong problem gives the normal penalty', () => {
    const { session, drag } = setup(solitaire, 4);
    const { distractor, open } = read(session, 'factToSubject');
    expect(dragTo(drag, distractor!.handle, { kind: 'play', challengeId: [...open.values()][0]! })).toBe('dropped');
    const s = session.snapshot();
    expect(s.view?.turnCount).toBe(1);
    expect(s.board?.hand).toHaveLength(6);
    expect(s.feedback.items.map((i) => i.text)).toContain('You drew 1 card.');
  });

  it('dragging to Discard discards through the engine', () => {
    const { session, drag, calls } = setup(solitaire, 4);
    const { distractor } = read(session, 'factToSubject');
    expect(dragTo(drag, distractor!.handle, { kind: 'discard' })).toBe('dropped');
    expect(calls).toEqual(['select', 'discard']);
    expect(session.snapshot().board?.discard.count).toBe(1);
  });

  it('the result of a drag equals the result of tapping the same move', () => {
    const tapped = setup(solitaire, 9);
    const dragged = setup(solitaire, 9);
    const t = read(tapped.session, 'factToSubject');
    const id = t.open.get(t.value(t.correct!.face))!;
    tapped.session.select(t.correct!.handle);
    tapped.session.playOn(id);
    dragTo(dragged.drag, t.correct!.handle, { kind: 'play', challengeId: id });
    expect(dragged.session.snapshot().view).toEqual(tapped.session.snapshot().view);
  });
});

describe('avoiding accidental plays', () => {
  it('a press that moves less than the threshold is a tap, not a drag', () => {
    const { session, drag, calls } = setup(solitaire, 5);
    const { correct } = read(session, 'factToSubject');
    expect(drag.press(correct!.handle, 100, 100)).toBe(true);
    expect(drag.move(100 + DRAG_THRESHOLD_PX - 3, 100)).toBe('none');
    expect(drag.release({ kind: 'discard' })).toBe('tap');
    expect(calls).toEqual([]);
    expect(session.snapshot().view?.turnCount).toBe(0);
  });

  it('dropping away from any target plays nothing and clears the selection it made', () => {
    const { session, drag, calls } = setup(solitaire, 5);
    const { correct } = read(session, 'factToSubject');
    expect(dragTo(drag, correct!.handle, undefined)).toBe('cancelled');
    expect(calls).toEqual(['select', 'cancel']);
    expect(session.snapshot().selectedHandle).toBeUndefined();
    expect(session.snapshot().view?.turnCount).toBe(0);
  });

  it('a card that was already selected stays selected after a cancelled drag', () => {
    const { session, drag, calls } = setup(solitaire, 5);
    const { correct } = read(session, 'factToSubject');
    session.select(correct!.handle);
    expect(dragTo(drag, correct!.handle, undefined)).toBe('cancelled');
    expect(calls).toEqual([]);
    expect(session.snapshot().selectedHandle).toBe(correct!.handle);
  });

  it('Escape or a cancelled pointer during a drag aborts it', () => {
    const { session, drag } = setup(solitaire, 5);
    const { correct } = read(session, 'factToSubject');
    drag.press(correct!.handle, 0, 0);
    drag.move(0, 50);
    expect(session.snapshot().selectedHandle).toBe(correct!.handle);
    drag.abort();
    expect(drag.isDragging()).toBe(false);
    expect(session.snapshot().selectedHandle).toBeUndefined();
    expect(drag.release({ kind: 'discard' })).toBe('none');
    expect(session.snapshot().view?.turnCount).toBe(0);
  });

  it('dragging onto a solved problem is refused by the engine and changes nothing', () => {
    const { session, drag } = setup(solitaire, 6);
    const r = read(session, 'factToSubject');
    const id = r.open.get(r.value(r.correct!.face))!;
    session.select(r.correct!.handle);
    session.playOn(id);
    const before = session.snapshot().view;
    const other = session.snapshot().board!.hand[0]!;
    // A solved tile is not a drop target in the board, but even a stale drop is safe.
    dragTo(drag, other.handle, { kind: 'play', challengeId: id });
    expect(session.snapshot().error).toBe('That problem is already solved.');
    expect(session.snapshot().view).toEqual(before);
  });
});

describe('Player vs. Beepy', () => {
  const vsBeepy: GameSettings = { mode: 'vsBeepy', level: 'oneDigit', direction: 'subjectToFact' };

  it('a drag plays on the human turn, then cannot start while Beepy thinks or a decision is pending', () => {
    const { session, clock, drag } = setup(vsBeepy, 12);
    const r = read(session, 'subjectToFact');
    const target: DropTarget = r.correct !== undefined
      ? { kind: 'play', challengeId: r.open.get(r.value(r.correct.face))! }
      : { kind: 'discard' };
    const handle = (r.correct ?? r.distractor)!.handle;
    expect(dragTo(drag, handle, target)).toBe('dropped');
    expect(session.snapshot().view?.turnCount).toBe(1);
    expect(session.snapshot().beepyThinking).toBe(true);
    const card = session.snapshot().board!.hand[0]!.handle;
    expect(drag.press(card, 0, 0)).toBe(false);
    clock.runNext();
    expect(session.snapshot().view?.phase).toBe('awaitingEvaluation');
    expect(drag.press(card, 0, 0)).toBe(false);
  });

  it('a whole match can be played by dragging alone', () => {
    const { session, clock, drag } = setup({ mode: 'vsBeepy', level: 'twoDigit', direction: 'factToSubject' }, 33);
    let steps = 0;
    for (;;) {
      steps += 1;
      if (steps > 3000) throw new Error('test-only step limit exceeded');
      const s = session.snapshot();
      if (s.gameOver) {
        if (s.seriesComplete) break;
        session.nextGame();
        continue;
      }
      if (s.beepyThinking) {
        clock.runNext();
        continue;
      }
      if (s.view?.phase === 'awaitingEvaluation') {
        session.accept();
        continue;
      }
      const r = read(session, 'factToSubject');
      if (r.correct !== undefined) dragTo(drag, r.correct.handle, { kind: 'play', challengeId: r.open.get(r.value(r.correct.face))! });
      else dragTo(drag, r.distractor!.handle, { kind: 'discard' });
      expect(session.snapshot().error).toBeUndefined();
    }
    expect(session.snapshot().seriesComplete).toBe(true);
  });
});

describe('source guards', () => {
  const sources = import.meta.glob('../src/ui/render/{drag,board}.ts', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;
  const drag = Object.entries(sources).find(([f]) => f.endsWith('drag.ts'))![1];
  const board = Object.entries(sources).find(([f]) => f.endsWith('board.ts'))![1];

  it('drag.ts imports nothing: it only calls the session commands it is given', () => {
    expect(drag).not.toMatch(/^import /m);
  });

  it('drop targets are exactly the tap targets (no hint about the answer)', () => {
    expect(board).toContain("'data-drop': challenge.target ? `challenge:${challenge.id}` : undefined");
    expect(board).toContain("'data-drop': board.discard.target ? 'discard' : undefined");
  });
});
