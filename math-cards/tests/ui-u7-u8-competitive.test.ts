/**
 * M5 U7 (Player vs. Beepy board, Beepy's turns, Accept/Challenge) and U8 (results
 * and series screens). Pure layers only; the DOM is checked in the owner's browser
 * test. All views and events are real (from `createMathSeries`).
 */

import { describe, expect, it } from 'vitest';
import type { ControllerResult, GameOutcome, PlayerView, PublicEvent } from '@beepy/shared-engine';
import { AVAILABLE_MODES } from '../src/ui/app.js';
import { toBoardModel } from '../src/ui/board-model.js';
import { createGameSession, type GameSession, type Scheduler, type SessionSnapshot } from '../src/ui/session.js';
import type { GameSettings } from '../src/ui/app-state.js';
import { cardNumber, promptSum, type Direction } from './math-oracle.js';
import { pendingValid, seriesFor, validAction } from './ui-helpers.js';

const TEST_STEP_LIMIT = 3000;

type Step = { view: PlayerView; events: readonly PublicEvent[] };
const ok = (result: ControllerResult | { ok: false; error: { code: string } }): Step => {
  if (!result.ok) throw new Error(`expected success, got ${result.error.code}`);
  return result;
};

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

function startSession(settings: GameSettings, seed: number) {
  const clock = manualScheduler();
  const created = createGameSession({ settings, seed, scheduler: clock.scheduler });
  if (!created.ok) throw new Error(created.error);
  return { session: created.session, clock };
}

/** The child's move, chosen from the board model by doing the arithmetic itself. */
function move(s: SessionSnapshot, direction: Direction, wrong: boolean): { handle: string; challengeId?: string } {
  const board = s.board!;
  const open = new Map(board.challenges.filter((c) => c.status === 'open').map((c) => [promptSum(c.prompt, direction), c.id]));
  const value = (face: string) => cardNumber(face, direction)!;
  const correct = board.hand.find((c) => open.has(value(c.face)));
  if (wrong) return correct !== undefined ? { handle: correct.handle } : { handle: board.hand[0]!.handle, challengeId: [...open.values()][0]! };
  if (correct !== undefined) return { handle: correct.handle, challengeId: open.get(value(correct.face))! };
  return { handle: board.hand.find((c) => !open.has(value(c.face)))!.handle };
}

function act(session: GameSession, m: { handle: string; challengeId?: string }): void {
  session.select(m.handle);
  if (m.challengeId === undefined) session.discard();
  else session.playOn(m.challengeId);
}

/** Play one whole match; `judge` decides Accept (true) or Challenge (false). */
function playMatch(session: GameSession, clock: ReturnType<typeof manualScheduler>, direction: Direction, judge: (s: SessionSnapshot) => boolean) {
  const snapshots: SessionSnapshot[] = [];
  let steps = 0;
  for (;;) {
    steps += 1;
    if (steps > TEST_STEP_LIMIT) throw new Error('test-only step limit exceeded');
    const s = session.snapshot();
    snapshots.push(s);
    if (s.gameOver) {
      if (s.seriesComplete) break;
      session.nextGame();
      continue;
    }
    if (s.beepyThinking) {
      expect(clock.runNext()).toBe(true);
      continue;
    }
    if (s.view?.phase === 'awaitingEvaluation') {
      if (judge(s)) session.accept();
      else session.challenge();
      continue;
    }
    act(session, move(s, direction, steps % 5 === 0));
  }
  return snapshots;
}

const directionOfSnapshot = (s: SessionSnapshot): Direction =>
  s.board!.challenges[0]!.prompt.startsWith('Which addition expression') ? 'subjectToFact' : 'factToSubject';

/** Would Beepy's pending move be valid? Oracle from visible text only. */
function pendingIsValid(s: SessionSnapshot): boolean {
  const view = s.view!;
  return pendingValid(view);
}

describe('U7 Player vs. Beepy is available', () => {
  it('the menu enables both approved modes', () => {
    expect(AVAILABLE_MODES).toEqual(['solitaire', 'vsBeepy']);
  });
});

describe("U7 Beepy's turns and the decision panel", () => {
  it('the pending panel describes the move as a play or a discard, from the view only', () => {
    let plays = 0;
    let discards = 0;
    for (let seed = 1; seed <= 40; seed += 1) {
      const series = seriesFor({ mode: 'vsBeepy', level: 'oneDigit', seed, beepyErrorRate: 0.5 });
      const start = ok(series.startNextGame());
      ok(series.submitHumanAction(validAction(start.view)));
      const pending = ok(series.advanceBeepy());
      const model = toBoardModel(pending.view).pending!;
      const p = pending.view.pending!;
      expect(model.isDiscard).toBe(p.kind === 'discard');
      if (p.kind === 'discard') {
        discards += 1;
        expect(model.destinationLabel).toBe('to the discard pile');
      } else {
        plays += 1;
        const index = pending.view.challenges.findIndex((c) => c.id === p.destination);
        expect(model.destinationLabel).toBe(`on problem ${index + 1}: ${pending.view.challenges[index]!.promptText}`);
      }
    }
    expect(plays).toBeGreaterThan(0);
    expect(discards).toBeGreaterThan(0);
  });

  it('Beepy moves first in game 2 (the engine alternates first players)', () => {
    const { session, clock } = startSession({ mode: 'vsBeepy', level: 'twoDigit', direction: 'factToSubject' }, 3);
    expect(session.snapshot().beepyThinking).toBe(false);
    // Finish game 1.
    let steps = 0;
    while (!session.snapshot().gameOver && steps < TEST_STEP_LIMIT) {
      steps += 1;
      const s = session.snapshot();
      if (s.beepyThinking) clock.runNext();
      else if (s.view?.phase === 'awaitingEvaluation') (pendingIsValid(s) ? session.accept : session.challenge)();
      else act(session, move(s, 'factToSubject', false));
    }
    session.nextGame();
    const game2 = session.snapshot();
    expect(game2.view?.gameIndex).toBe(2);
    expect(game2.view?.activePlayer).toBe('beepy');
    expect(game2.beepyThinking).toBe(true);
    expect(game2.board?.canAct).toBe(false);
  });

  it('a correct human judgment gets a good message and a wrong one an oops message', () => {
    let rightCalls = 0;
    let wrongCalls = 0;
    for (const seed of [11, 12, 13, 14, 15, 16]) {
      for (const judgeRight of [true, false]) {
        const { session, clock } = startSession({ mode: 'vsBeepy', level: 'oneDigit', direction: 'factToSubject' }, seed);
        act(session, move(session.snapshot(), 'factToSubject', false));
        clock.runNext();
        const pending = session.snapshot();
        const valid = pendingIsValid(pending);
        const sayAccept = judgeRight ? valid : !valid;
        if (sayAccept) session.accept();
        else session.challenge();
        const verdict = session.snapshot().feedback.items[0]!;
        expect(verdict.tone).toBe(judgeRight ? 'good' : 'oops');
        if (judgeRight) rightCalls += 1;
        else wrongCalls += 1;
      }
    }
    expect(rightCalls).toBe(6);
    expect(wrongCalls).toBe(6);
  });

  it('decisions are ignored while Beepy is still thinking', () => {
    const { session } = startSession({ mode: 'vsBeepy', level: 'oneDigit', direction: 'factToSubject' }, 21);
    act(session, move(session.snapshot(), 'factToSubject', false));
    const before = session.snapshot().view;
    session.accept();
    session.challenge();
    expect(session.snapshot().view).toEqual(before);
  });
});

describe('U8 results and match flow', () => {
  it.each(['factToSubject', 'subjectToFact'] as const)('a whole match (%s): per-game results and the match winner come from the engine', (direction) => {
    const { session, clock } = startSession({ mode: 'vsBeepy', level: 'oneAndTwoDigit', direction }, 99);
    const snapshots = playMatch(session, clock, direction, (s) => pendingIsValid(s));
    expect(directionOfSnapshot(snapshots[0]!)).toBe(direction);
    const final = session.snapshot();
    const outcomes = final.completedOutcomes;
    expect(outcomes.length).toBeGreaterThanOrEqual(3);
    expect(outcomes.length).toBeLessThanOrEqual(5);
    const wins = { human: 0, beepy: 0 };
    for (const o of outcomes) if (o.kind === 'vsBeepy') wins[o.winner] += 1;
    expect(Math.max(wins.human, wins.beepy)).toBe(3);

    const board = final.board!;
    expect(board.seriesComplete).toBe(true);
    expect(board.match?.decided).toBe(true);
    expect(board.match?.scoreLine).toBe(`Match: You ${wins.human} – Beepy ${wins.beepy} (first to 3 wins)`);
    expect(board.match?.winnerLabel).toBe(wins.human === 3 ? 'You' : 'Beepy');
    expect(board.match?.games.map((g) => g.winnerLabel)).toEqual(
      outcomes.map((o) => (o.kind === 'vsBeepy' && o.winner === 'human' ? 'You' : 'Beepy')),
    );
    expect(board.match?.games.map((g) => g.number)).toEqual(outcomes.map((_, i) => i + 1));
    // The header's match score equals the series status during play too.
    for (const s of snapshots) {
      const score = s.board!.score;
      if (score.kind !== 'vsBeepy') continue;
      expect(score.wins.human).toBe(s.view!.series?.wins?.human ?? 0);
      expect(score.wins.beepy).toBe(s.view!.series?.wins?.beepy ?? 0);
    }
  });

  it('each finished game is recorded once, in order', () => {
    const { session, clock } = startSession({ mode: 'vsBeepy', level: 'twoDigit', direction: 'factToSubject' }, 7);
    const snapshots = playMatch(session, clock, 'factToSubject', () => true);
    const ends = snapshots.filter((s, i) => s.gameOver && (i === 0 || !snapshots[i - 1]!.gameOver)).length;
    expect(session.snapshot().completedOutcomes).toHaveLength(ends);
  });

  it('a Solitaire session also records its five outcomes, with scores equal to the series', () => {
    const { session, clock } = startSession({ mode: 'solitaire', level: 'oneDigit', direction: 'factToSubject' }, 5);
    playMatch(session, clock, 'factToSubject', () => true);
    const final = session.snapshot();
    expect(final.completedOutcomes).toHaveLength(5);
    const scores = final.completedOutcomes.map((o) => (o.kind === 'solitaire' ? o.score : -1));
    const score = final.board!.score;
    expect(score.kind === 'solitaire' && score.gameScores).toEqual(scores);
    expect(final.board!.match).toBeUndefined();
  });

  it('competitive result lines follow the engine outcome for every end reason', () => {
    const series = seriesFor({ mode: 'vsBeepy', level: 'oneDigit', seed: 2 });
    const view = ok(series.startNextGame()).view;
    const cases: ReadonlyArray<readonly [GameOutcome, string, string]> = [
      [{ kind: 'vsBeepy', winner: 'human', reason: 'handEmpty', handCounts: { human: 0, beepy: 3 }, credits: { human: 4, beepy: 2 } }, 'You win!', 'You played every card.'],
      [{ kind: 'vsBeepy', winner: 'beepy', reason: 'handEmpty', handCounts: { human: 2, beepy: 0 }, credits: { human: 3, beepy: 4 } }, 'Beepy wins!', 'Beepy played every card.'],
      [{ kind: 'vsBeepy', winner: 'beepy', reason: 'fewerCards', handCounts: { human: 4, beepy: 2 }, credits: { human: 5, beepy: 4 } }, 'Beepy wins!', 'Beepy had fewer cards left.'],
      [{ kind: 'vsBeepy', winner: 'human', reason: 'moreCredit', handCounts: { human: 2, beepy: 2 }, credits: { human: 5, beepy: 4 } }, 'You win!', 'You solved more problems.'],
    ];
    for (const [outcome, title, first] of cases) {
      // The public view shape with this outcome (pure model test).
      const ended: PlayerView = { ...view, phase: 'ended', outcome };
      const model = toBoardModel(ended).outcome!;
      expect(model.title).toBe(title);
      expect(model.lines[0]).toBe(first);
      expect(model.lines).toContain(`Cards left: you ${outcome.kind === 'vsBeepy' ? outcome.handCounts.human : 0}, Beepy ${outcome.kind === 'vsBeepy' ? outcome.handCounts.beepy : 0}`);
      expect(model.humanWon).toBe(title === 'You win!');
    }
  });
});

describe('Accept and Challenge are styled identically (source guard)', () => {
  const sources = import.meta.glob('../src/ui/render/board.ts', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;
  it('both decision buttons use the same class and neither is the default focus', () => {
    const text = Object.values(sources)[0]!;
    expect(text.match(/class: 'btn btn--decision'/g)).toHaveLength(2);
    expect(text).not.toMatch(/autofocus/);
  });
});
