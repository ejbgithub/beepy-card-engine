/**
 * M5 U4 - session orchestrator (requirements 4.3, 4.4, 5.1, 5.3, 10).
 *
 * A manual scheduler makes Beepy's turns deterministic and instant. The simulated
 * "child" chooses moves only from the BOARD MODEL (prompts and faces), doing the
 * arithmetic itself with the independent oracle.
 */

import { describe, expect, it } from 'vitest';
import { BEEPY_THINK_MS, createGameSession, type GameSession, type Scheduler, type SessionSnapshot } from '../src/ui/session.js';
import { newSeriesSeed } from '../src/ui/seed.js';
import type { BoardModel } from '../src/ui/board-model.js';
import type { GameSettings } from '../src/ui/app-state.js';
import { FEEDBACK_TEXT } from '../src/ui/feedback.js';
import { cardNumber, promptSum, type Direction } from './math-oracle.js';

const TEST_STEP_LIMIT = 3000;

/** A scheduler that runs tasks only when the test says so. */
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
    delays: () => tasks.map((t) => t.ms),
    runNext: () => {
      const task = tasks.find((t) => !t.cancelled);
      if (task === undefined) return false;
      task.cancelled = true;
      task.run();
      return true;
    },
  };
}

function start(settings: GameSettings, seed: number, onChange?: (s: SessionSnapshot) => void) {
  const clock = manualScheduler();
  const created = createGameSession({ settings, seed, scheduler: clock.scheduler, ...(onChange === undefined ? {} : { onChange }) });
  if (!created.ok) throw new Error(created.error);
  return { session: created.session, clock };
}

const board = (session: GameSession): BoardModel => session.snapshot().board!;

/** The child's view of the board: sums of open problems and card values, from text. */
function read(model: BoardModel, direction: Direction) {
  const open = new Map(model.challenges.filter((c) => c.status === 'open').map((c) => [promptSum(c.prompt, direction), c.id]));
  const value = (face: string) => cardNumber(face, direction)!;
  return { open, value };
}

/** Choose a move from the board model only. */
function chooseMove(model: BoardModel, direction: Direction, wantWrong: boolean): { handle: string; challengeId?: string } {
  const { open, value } = read(model, direction);
  const correct = model.hand.find((c) => open.has(value(c.face)));
  if (wantWrong) {
    if (correct !== undefined) return { handle: correct.handle };
    return { handle: model.hand[0]!.handle, challengeId: [...open.values()][0]! };
  }
  if (correct !== undefined) return { handle: correct.handle, challengeId: open.get(value(correct.face))! };
  return { handle: model.hand.find((c) => !open.has(value(c.face)))!.handle };
}

function pendingIsValid(snapshot: SessionSnapshot, direction: Direction): boolean {
  const p = snapshot.view!.pending!;
  const { open, value } = read(snapshot.board!, direction);
  const v = value(p.card.displayValue);
  return p.kind === 'play' ? open.get(v) === p.destination : !open.has(v);
}

const solitaire: GameSettings = { mode: 'solitaire', level: 'oneDigit', direction: 'factToSubject' };
const vsBeepy: GameSettings = { mode: 'vsBeepy', level: 'oneDigit', direction: 'factToSubject' };

describe('starting a session', () => {
  it('deals game 1 and reports the start', () => {
    const { session } = start(solitaire, 1);
    const s = session.snapshot();
    expect(s.view?.gameIndex).toBe(1);
    expect(s.board?.hand).toHaveLength(5);
    expect(s.feedback.items.map((i) => i.text)).toEqual([FEEDBACK_TEXT.gameStarted]);
    expect(s.gameOver).toBe(false);
    expect(s.error).toBeUndefined();
  });

  it('returns friendly text, not an exception, for bad settings', () => {
    const bad = createGameSession({ settings: { ...solitaire, mode: 'tutor' as never }, seed: 1, scheduler: manualScheduler().scheduler });
    expect(bad).toEqual({ ok: false, error: 'That game mode is not available yet.' });
  });

  it('the seed source returns a 32-bit whole number', () => {
    for (let i = 0; i < 20; i += 1) {
      const seed = newSeriesSeed();
      expect(Number.isInteger(seed)).toBe(true);
      expect(seed).toBeGreaterThanOrEqual(0);
      expect(seed).toBeLessThan(2 ** 32);
    }
  });
});

describe('select, cancel, play, discard', () => {
  it('select toggles; cancel clears; an unknown handle is ignored', () => {
    const changes: SessionSnapshot[] = [];
    const { session } = start(solitaire, 2, (s) => changes.push(s));
    const handle = board(session).hand[1]!.handle;
    session.select(handle);
    expect(session.snapshot().selectedHandle).toBe(handle);
    expect(board(session).hand[1]!.selected).toBe(true);
    session.select(handle);
    expect(session.snapshot().selectedHandle).toBeUndefined();
    session.select(handle);
    session.cancel();
    expect(session.snapshot().selectedHandle).toBeUndefined();
    session.select('hnotmine');
    expect(session.snapshot().selectedHandle).toBeUndefined();
    expect(changes.length).toBe(4);
    expect(session.snapshot().view?.turnCount).toBe(0);
  });

  it('play and discard need a selection; without one nothing is sent', () => {
    const { session } = start(solitaire, 3);
    session.playOn(board(session).challenges[0]!.id);
    session.discard();
    expect(session.snapshot().view?.turnCount).toBe(0);
  });

  it('a correct play solves the problem and clears the selection', () => {
    const { session } = start(solitaire, 4);
    const move = chooseMove(board(session), 'factToSubject', false);
    session.select(move.handle);
    session.playOn(move.challengeId!);
    const s = session.snapshot();
    expect(s.view?.turnCount).toBe(1);
    expect(s.selectedHandle).toBeUndefined();
    expect(s.board?.challenges.find((c) => c.id === move.challengeId)?.status).toBe('solved');
    expect(s.feedback.items[0]?.text).toBe(FEEDBACK_TEXT.humanPlayGood);
  });

  it('a wrong move keeps the card, draws a penalty, and highlights the new card', () => {
    const { session } = start(solitaire, 4);
    const move = chooseMove(board(session), 'factToSubject', true);
    session.select(move.handle);
    if (move.challengeId === undefined) session.discard();
    else session.playOn(move.challengeId);
    const s = session.snapshot();
    expect(s.board?.hand).toHaveLength(6);
    expect(s.board?.hand.some((c) => c.handle === move.handle)).toBe(true);
    expect(s.board?.hand.filter((c) => c.isNew)).toHaveLength(1);
    expect(s.feedback.items.map((i) => i.text)).toEqual([FEEDBACK_TEXT.humanWrong, 'You drew 1 card.']);
  });

  it('repeat clicks cannot send a second request', () => {
    const { session } = start(solitaire, 5);
    const move = chooseMove(board(session), 'factToSubject', false);
    session.select(move.handle);
    session.playOn(move.challengeId!);
    session.playOn(move.challengeId!);
    session.discard();
    expect(session.snapshot().view?.turnCount).toBe(1);
  });

  it('an engine refusal becomes friendly text and changes nothing', () => {
    const { session } = start(solitaire, 6);
    const move = chooseMove(board(session), 'factToSubject', false);
    session.select(move.handle);
    session.playOn(move.challengeId!);
    const before = session.snapshot().view;
    // Play another card onto the challenge that was just solved.
    session.select(board(session).hand[0]!.handle);
    session.playOn(move.challengeId!);
    const s = session.snapshot();
    expect(s.error).toBe('That problem is already solved.');
    expect(s.view).toEqual(before);
  });
});

describe("Beepy's turns", () => {
  /** Play the human's first move in a match so that Beepy is next. */
  function toBeepyTurn(seed: number) {
    const ctx = start(vsBeepy, seed);
    const move = chooseMove(board(ctx.session), 'factToSubject', false);
    ctx.session.select(move.handle);
    if (move.challengeId === undefined) ctx.session.discard();
    else ctx.session.playOn(move.challengeId);
    return ctx;
  }

  it('Beepy thinks first, then acts after the scheduled delay', () => {
    const { session, clock } = toBeepyTurn(7);
    const thinking = session.snapshot();
    expect(thinking.beepyThinking).toBe(true);
    expect(thinking.board?.turnLabel).toBe('Beepy is thinking…');
    expect(thinking.board?.canAct).toBe(false);
    expect(clock.delays()).toEqual([BEEPY_THINK_MS]);
    expect(clock.runNext()).toBe(true);
    const pending = session.snapshot();
    expect(pending.beepyThinking).toBe(false);
    expect(pending.view?.phase).toBe('awaitingEvaluation');
    expect(pending.board?.pending).toBeDefined();
    expect(pending.feedback.items.map((i) => i.text)).toEqual([FEEDBACK_TEXT.beepyPending]);
    expect(clock.pending()).toBe(0);
  });

  it('the human cannot select while Beepy thinks or while a decision is pending', () => {
    const { session, clock } = toBeepyTurn(8);
    session.select(board(session).hand[0]!.handle);
    expect(session.snapshot().selectedHandle).toBeUndefined();
    clock.runNext();
    session.select(board(session).hand[0]!.handle);
    expect(session.snapshot().selectedHandle).toBeUndefined();
  });

  it('Accept and Challenge resolve the pending move, and only then', () => {
    const a = toBeepyTurn(9);
    a.session.accept();
    expect(a.session.snapshot().view?.turnCount).toBe(1);
    a.clock.runNext();
    a.session.accept();
    expect(a.session.snapshot().view?.phase).toBe('awaitingAction');
    expect(a.session.snapshot().view?.turnCount).toBe(2);
    const c = toBeepyTurn(9);
    c.clock.runNext();
    c.session.challenge();
    expect(c.session.snapshot().view?.turnCount).toBe(2);
    expect(c.session.snapshot().feedback.items.some((i) => /Beepy's move was|Good catch/.test(i.text))).toBe(true);
  });

  it('leave() cancels a scheduled Beepy step and makes the session inert', () => {
    const changes: SessionSnapshot[] = [];
    const clock = manualScheduler();
    const created = createGameSession({ settings: vsBeepy, seed: 10, scheduler: clock.scheduler, onChange: (s) => changes.push(s) });
    if (!created.ok) throw new Error('session');
    const session = created.session;
    const move = chooseMove(board(session), 'factToSubject', false);
    session.select(move.handle);
    if (move.challengeId === undefined) session.discard();
    else session.playOn(move.challengeId);
    expect(clock.pending()).toBe(1);
    const before = changes.length;
    session.leave();
    expect(clock.pending()).toBe(0);
    expect(clock.runNext()).toBe(false);
    session.select(board(session).hand[0]!.handle);
    session.accept();
    session.nextGame();
    expect(changes.length).toBe(before);
  });
});

describe('full simulated series through the session (board model only)', () => {
  const LEVELS = ['oneDigit', 'oneAndTwoDigit', 'twoDigit', 'mixed'] as const;
  const DIRECTIONS = ['factToSubject', 'subjectToFact'] as const;
  const MODES = ['solitaire', 'vsBeepy'] as const;

  it.each(MODES.flatMap((mode) => LEVELS.flatMap((level) => DIRECTIONS.map((direction) => [mode, level, direction] as const))))(
    '%s / %s / %s plays to the end of the series',
    (mode, level, direction) => {
      const { session, clock } = start({ mode, level, direction }, 1234);
      let steps = 0;
      let games = 1;
      for (;;) {
        steps += 1;
        if (steps > TEST_STEP_LIMIT) throw new Error('test-only step limit exceeded');
        const s = session.snapshot();
        if (s.gameOver) {
          expect(s.board?.outcome).toBeDefined();
          if (s.seriesComplete) break;
          session.nextGame();
          games += 1;
          continue;
        }
        if (s.beepyThinking) {
          expect(clock.runNext()).toBe(true);
          continue;
        }
        if (s.view?.phase === 'awaitingEvaluation') {
          if (pendingIsValid(s, direction)) session.accept();
          else session.challenge();
          continue;
        }
        const move = chooseMove(s.board!, direction, steps % 4 === 0);
        session.select(move.handle);
        if (move.challengeId === undefined) session.discard();
        else session.playOn(move.challengeId);
        expect(session.snapshot().error).toBeUndefined();
      }
      const final = session.snapshot();
      expect(final.seriesComplete).toBe(true);
      if (mode === 'solitaire') {
        expect(games).toBe(5);
        const score = final.board!.score;
        expect(score.kind).toBe('solitaire');
        if (score.kind === 'solitaire') {
          expect(score.gamesCompleted).toBe(5);
          expect(score.sessionTotal).toBe(score.gameScores.reduce((a, b) => a + b, 0));
        }
      } else {
        expect(games).toBeGreaterThanOrEqual(3);
        expect(games).toBeLessThanOrEqual(5);
        const score = final.board!.score;
        if (score.kind === 'vsBeepy') expect(Math.max(score.wins.human, score.wins.beepy)).toBe(3);
      }
      // nextGame after the series is complete changes nothing.
      const before = session.snapshot().view;
      session.nextGame();
      expect(session.snapshot().view).toEqual(before);
    },
  );
});
