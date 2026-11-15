/**
 * M5 U3 - board model and feedback (requirements 3, 5.2, 6, 7.4, 8.3).
 * Views and events are REAL: they come from `createMathSeries`.
 */

import { describe, expect, it } from 'vitest';
import type { ControllerResult, PlayerView, PublicEvent } from '@beepy/shared-engine';
import { toBoardModel, type BoardModel } from '../src/ui/board-model.js';
import { FEEDBACK_TEXT, toFeedback } from '../src/ui/feedback.js';
import type { MathSeries } from '../src/math-series.js';
import { invalidAction, pendingValid, seriesFor, validAction, validDiscard, validPlay } from './ui-helpers.js';

type Step = { view: PlayerView; events: readonly PublicEvent[] };
const ok = (result: ControllerResult | { ok: false; error: { code: string } }): Step => {
  if (!result.ok) throw new Error(`expected success, got ${result.error.code}`);
  return result;
};
const texts = (events: readonly PublicEvent[]): string[] => toFeedback(events).items.map((i) => i.text);
const count = (events: readonly PublicEvent[], type: PublicEvent['type']) => events.filter((e) => e.type === type).length;

function solitaire(seed = 11, level: 'oneDigit' | 'twoDigit' = 'oneDigit', direction: 'factToSubject' | 'subjectToFact' = 'factToSubject') {
  const series = seriesFor({ mode: 'solitaire', level, generationDirection: direction, seed });
  return { series, start: ok(series.startNextGame()) };
}

/** A vsBeepy series where Beepy acts first (game 2 starts with Beepy, so play game 1 out). */
function beepyPending(seed: number, beepyErrorRate: number): { series: MathSeries; pending: Step } {
  const series = seriesFor({ mode: 'vsBeepy', level: 'oneAndTwoDigit', seed, beepyErrorRate });
  const first = ok(series.startNextGame());
  ok(series.submitHumanAction(validAction(first.view)));
  return { series, pending: ok(series.advanceBeepy()) };
}

describe('board model: Solitaire', () => {
  const { start } = solitaire();
  const model = toBoardModel(start.view);

  it('has five challenges, a five-card hand, and the Solitaire header', () => {
    expect(model.challenges).toHaveLength(5);
    expect(model.hand).toHaveLength(5);
    expect(model.handCount).toBe(5);
    expect(model.canAct).toBe(true);
    expect(model.turnLabel).toBe('Your turn');
    expect(model.beepy).toBeUndefined();
    expect(model.pending).toBeUndefined();
    expect(model.score).toEqual({ kind: 'solitaire', gameLabel: 'Game 1 of 5', sessionTotal: 0, gamesCompleted: 0, gameScores: [] });
    expect(model.turnCount).toBe(start.view.turnCount);
    expect(model.drawPileCount).toBe(start.view.drawPileCount);
  });

  it('shows prompts and faces exactly as the view gives them, in the engine order', () => {
    expect(model.challenges.map((c) => c.prompt)).toEqual(start.view.challenges.map((c) => c.promptText));
    expect(model.hand.map((c) => c.face)).toEqual(start.view.hand.map((c) => c.displayValue));
    expect(model.hand.map((c) => c.handle)).toEqual(start.view.hand.map((c) => c.handle));
    expect(model.challenges.map((c) => c.number)).toEqual([1, 2, 3, 4, 5]);
  });

  it('nothing is a target until a card is selected', () => {
    expect(model.challenges.every((c) => !c.target)).toBe(true);
    expect(model.discard.target).toBe(false);
  });

  it('with a card selected, EVERY open challenge and the discard pile are targets (no pre-judging)', () => {
    const handle = start.view.hand[2]!.handle;
    const selected = toBoardModel(start.view, { selectedHandle: handle });
    expect(selected.hand.map((c) => c.selected)).toEqual([false, false, true, false, false]);
    expect(selected.hand[2]!.ariaLabel).toMatch(/selected$/);
    expect(selected.challenges.every((c) => c.target)).toBe(true);
    expect(selected.discard.target).toBe(true);
    expect(selected.selectedFace).toBe(start.view.hand[2]!.displayValue);
    // The same flags for every card: the selection reveals nothing.
    const flags = start.view.hand.map((c) =>
      JSON.stringify(toBoardModel(start.view, { selectedHandle: c.handle }).challenges.map((ch) => ch.target)),
    );
    expect(new Set(flags).size).toBe(1);
  });

  it('ignores a selection that is not in the hand, and any selection while busy', () => {
    expect(toBoardModel(start.view, { selectedHandle: 'hnotreal' }).selectedFace).toBeUndefined();
    const busy = toBoardModel(start.view, { selectedHandle: start.view.hand[0]!.handle, busy: true });
    expect(busy.canAct).toBe(false);
    expect(busy.hand.every((c) => !c.enabled && !c.selected)).toBe(true);
    expect(busy.challenges.every((c) => !c.target)).toBe(true);
  });

  it('marks solved challenges, with the played card, and never as a target', () => {
    const { series, start: s } = solitaire(5);
    const play = validPlay(s.view)!;
    const after = ok(series.submitHumanAction(play));
    const m = toBoardModel(after.view, { selectedHandle: after.view.hand[0]!.handle });
    const solved = m.challenges.find((c) => c.id === (play as { challengeId: string }).challengeId)!;
    expect(solved.status).toBe('solved');
    expect(solved.target).toBe(false);
    expect(solved.playedFace).toBeDefined();
    expect(solved.ariaLabel).toMatch(/Solved with/);
    expect(m.hand).toHaveLength(4);
  });

  it('marks expression cards as wide in subjectToFact', () => {
    const { start: s } = solitaire(3, 'twoDigit', 'subjectToFact');
    const m = toBoardModel(s.view);
    expect(m.hand.every((c) => c.wide)).toBe(true);
    expect(toBoardModel(solitaire(3).start.view).hand.every((c) => !c.wide)).toBe(true);
  });

  it('highlights only the handles the UI passes as new', () => {
    const handle = start.view.hand[4]!.handle;
    const m = toBoardModel(start.view, { newCardHandles: [handle] });
    expect(m.hand.map((c) => c.isNew)).toEqual([false, false, false, false, true]);
  });

  it('builds the outcome and the session total only from engine data', () => {
    const { series, start: s } = solitaire(8);
    let view = s.view;
    while (view.phase !== 'ended') view = ok(series.submitHumanAction(validAction(view))).view;
    const ended = toBoardModel(view);
    const outcome = view.outcome!;
    expect(outcome.kind).toBe('solitaire');
    if (outcome.kind !== 'solitaire') return;
    expect(ended.outcome?.score).toBe(outcome.score);
    expect(ended.outcome?.lines).toContain(`Game score: ${outcome.score} (lower is better)`);
    expect(ended.outcome?.lines).toContain(`Turns taken: ${outcome.turns}`);
    expect(ended.canAct).toBe(false);
    expect(ended.turnLabel).toBe('Game over');
    expect(ended.score).toMatchObject({ sessionTotal: view.series!.sessionScore, gamesCompleted: 1, gameScores: [outcome.score] });
    const next = toBoardModel(ok(series.startNextGame()).view);
    expect(next.score).toMatchObject({ gameLabel: 'Game 2 of 5', sessionTotal: outcome.score });
  });
});

describe('board model: vs Beepy', () => {
  it('has nine challenges, Beepy with a card count, and the match header', () => {
    const series = seriesFor({ mode: 'vsBeepy', level: 'oneDigit', seed: 4 });
    const start = ok(series.startNextGame());
    const m = toBoardModel(start.view);
    expect(m.challenges).toHaveLength(9);
    expect(m.beepy).toEqual({ cardCount: 5, thinking: false });
    expect(m.score).toEqual({ kind: 'vsBeepy', gameLabel: 'Game 1', wins: { human: 0, beepy: 0 }, credits: { human: 0, beepy: 0 } });
    expect(toBoardModel(start.view, { beepyThinking: true }).beepy?.thinking).toBe(true);
  });

  it('shows the pending panel only while awaiting a decision, and the human cannot act', () => {
    const { pending } = beepyPending(21, 0.3);
    expect(pending.view.phase).toBe('awaitingEvaluation');
    const m = toBoardModel(pending.view);
    expect(m.canAct).toBe(false);
    expect(m.pending).toBeDefined();
    expect(m.pending!.face).toBe(pending.view.pending!.card.displayValue);
    expect(m.pending!.playerLabel).toBe('Beepy');
    expect(m.turnLabel).toBe('Your call: Accept or Challenge?');
    expect(toBoardModel(pending.view, { busy: true }).pending?.canDecide).toBe(false);
  });

  it('a pending VALID and a pending INVALID Beepy move give models identical apart from the card and destination', () => {
    const strip = (model: BoardModel) => {
      const copy = JSON.parse(JSON.stringify(model)) as Record<string, unknown> & { pending?: Record<string, unknown> };
      if (copy.pending !== undefined) {
        delete copy.pending['face'];
        delete copy.pending['wide'];
        delete copy.pending['destinationLabel'];
        // Play vs discard is part of the destination, which is public.
        delete copy.pending['isDiscard'];
        delete copy.pending['destinationDisplay'];
      }
      return copy;
    };
    let compared = 0;
    for (const seed of [1, 2, 3, 4, 5, 6]) {
      const valid = beepyPending(seed, 0).pending.view;
      const invalid = beepyPending(seed, 1).pending.view;
      expect(pendingValid(valid)).toBe(true);
      expect(pendingValid(invalid)).toBe(false);
      expect(strip(toBoardModel(valid))).toEqual(strip(toBoardModel(invalid)));
      expect(JSON.stringify(toBoardModel(invalid))).not.toMatch(/valid|correct|wrong|right/i);
      compared += 1;
    }
    expect(compared).toBe(6);
  });

  it('credits come from the solvers shown on the board', () => {
    const series = seriesFor({ mode: 'vsBeepy', level: 'oneDigit', seed: 9, beepyErrorRate: 0 });
    let view = ok(series.startNextGame()).view;
    for (let i = 0; i < 6 && view.phase !== 'ended'; i += 1) {
      if (view.phase === 'awaitingEvaluation') view = ok(series.decide('accept')).view;
      else if (view.activePlayer === 'beepy') view = ok(series.advanceBeepy()).view;
      else view = ok(series.submitHumanAction(validAction(view))).view;
    }
    const m = toBoardModel(view);
    if (m.score.kind !== 'vsBeepy') throw new Error('mode');
    const solvedBy = view.challenges.filter((c) => c.solvedBy !== undefined);
    expect(m.score.credits.human + m.score.credits.beepy).toBe(solvedBy.length);
    expect(m.score.credits.human).toBe(solvedBy.filter((c) => c.solvedBy === 'human').length);
    for (const c of m.challenges.filter((ch) => ch.status === 'solved')) expect(['You', 'Beepy']).toContain(c.solverLabel);
  });
});

describe('board model never contains data beyond the view', () => {
  it('over whole games: no deck ids, no source refs, only faces and prompts from the view', () => {
    for (const [mode, direction] of [['solitaire', 'factToSubject'], ['vsBeepy', 'subjectToFact']] as const) {
      const series = seriesFor({ mode, level: 'mixed', generationDirection: direction, seed: 77 });
      let view = ok(series.startNextGame()).view;
      let steps = 0;
      while (view.phase !== 'ended' && steps < 2000) {
        steps += 1;
        const first = view.hand[0]?.handle;
        const m = toBoardModel(view, first === undefined ? {} : { selectedHandle: first });
        const text = JSON.stringify(m);
        expect(text).not.toMatch(/"m\d+"/);
        expect(text).not.toContain('math.subject');
        expect(text).not.toContain('sourceRef');
        const faces = new Set([
          ...view.hand.map((c) => c.displayValue),
          ...view.discard.map((c) => c.displayValue),
          ...view.challenges.flatMap((c) => (c.playedCard ? [c.playedCard.displayValue] : [])),
          ...(view.pending ? [view.pending.card.displayValue] : []),
        ]);
        for (const card of m.hand) expect(faces.has(card.face)).toBe(true);
        if (m.discard.topFace !== undefined) expect(faces.has(m.discard.topFace)).toBe(true);
        if (m.pending) expect(faces.has(m.pending.face)).toBe(true);
        const prompts = new Set(view.challenges.map((c) => c.promptText));
        for (const c of m.challenges) expect(prompts.has(c.prompt)).toBe(true);
        view =
          view.phase === 'awaitingEvaluation'
            ? ok(series.decide(pendingValid(view) ? 'accept' : 'challenge')).view
            : view.activePlayer === 'beepy'
              ? ok(series.advanceBeepy()).view
              : ok(series.submitHumanAction(steps % 3 === 0 ? invalidAction(view) : validAction(view))).view;
      }
      expect(view.phase).toBe('ended');
    }
  });
});

describe('feedback built from real events', () => {
  it('game start', () => {
    expect(texts(solitaire().start.events)).toEqual([FEEDBACK_TEXT.gameStarted]);
  });

  it('a valid play and a valid discard', () => {
    const { series, start } = solitaire(13);
    const played = ok(series.submitHumanAction(validPlay(start.view)!));
    expect(toFeedback(played.events).items).toEqual([{ tone: 'good', text: FEEDBACK_TEXT.humanPlayGood }]);
    const discard = validDiscard(played.view)!;
    const discarded = ok(series.submitHumanAction(discard));
    expect(toFeedback(discarded.events).items).toEqual([{ tone: 'good', text: FEEDBACK_TEXT.humanDiscardGood }]);
  });

  it('an invalid action: oops, and exactly the penalty card the engine drew', () => {
    const { series, start } = solitaire(13);
    const wrong = ok(series.submitHumanAction(invalidAction(start.view)));
    expect(count(wrong.events, 'PENALTY_DRAWN')).toBe(1);
    const fb = toFeedback(wrong.events);
    expect(fb.items).toEqual([
      { tone: 'oops', text: FEEDBACK_TEXT.humanWrong },
      { tone: 'oops', text: 'You drew 1 card.' },
    ]);
    expect(fb.newCardHandles).toHaveLength(1);
    expect(wrong.view.hand.map((c) => c.handle)).toContain(fb.newCardHandles[0]);
  });

  it('a waived penalty is reported as waived, never as a drawn card', () => {
    // One-digit Solitaire: 10 cards in the pile, 5 fallback values, then nothing left.
    const { series, start } = solitaire(17);
    let step: Step = start;
    let waivedStep: Step | undefined;
    for (let i = 0; i < 40 && waivedStep === undefined; i += 1) {
      const before = step.view.hand.length;
      step = ok(series.submitHumanAction(invalidAction(step.view)));
      if (count(step.events, 'PENALTY_WAIVED') > 0) {
        waivedStep = step;
        expect(step.view.hand.length).toBe(before);
      }
    }
    expect(waivedStep).toBeDefined();
    const t = texts(waivedStep!.events);
    expect(t).toContain(FEEDBACK_TEXT.waived);
    expect(t.some((x) => x.includes('drew'))).toBe(false);
    expect(toFeedback(waivedStep!.events).newCardHandles).toEqual([]);
  });

  it('Beepy pending, then each row of the decision table', () => {
    const v = beepyPending(31, 0);
    expect(texts(v.pending.events)).toEqual([FEEDBACK_TEXT.beepyPending]);
    expect(texts(ok(v.series.decide('accept')).events)).toEqual([FEEDBACK_TEXT.beepyValidAccepted]);

    const vc = beepyPending(31, 0);
    const vcStep = ok(vc.series.decide('challenge'));
    expect(texts(vcStep.events)).toEqual([FEEDBACK_TEXT.beepyValidChallenged, 'You drew 1 card.']);

    const ic = beepyPending(31, 1);
    expect(texts(ok(ic.series.decide('challenge')).events)).toEqual([FEEDBACK_TEXT.beepyInvalidChallenged, 'Beepy drew 1 card.']);

    const ia = beepyPending(31, 1);
    const iaStep = ok(ia.series.decide('accept'));
    expect(count(iaStep.events, 'PENALTY_DRAWN')).toBe(2);
    expect(texts(iaStep.events)).toEqual([FEEDBACK_TEXT.beepyInvalidAccepted, 'You drew 1 card.', 'Beepy drew 1 card.']);
    const tones = toFeedback(iaStep.events).items.map((i) => i.tone);
    expect(tones).toEqual(['oops', 'oops', 'info']);
  });

  it('a penalty not applied because the game ended is reported as such', () => {
    // Beepy never errs and the human always challenges: Beepy's last valid move ends the
    // game under a Challenge, so the human's draw is not applied.
    const series = seriesFor({ mode: 'vsBeepy', level: 'oneAndTwoDigit', seed: 5, beepyErrorRate: 0 });
    let step = ok(series.startNextGame());
    let final: Step | undefined;
    for (let i = 0; i < 400 && final === undefined; i += 1) {
      const view = step.view;
      if (view.phase === 'awaitingEvaluation') step = ok(series.decide('challenge'));
      else if (view.activePlayer === 'beepy') step = ok(series.advanceBeepy());
      else step = ok(series.submitHumanAction(invalidAction(view)));
      if (step.view.phase === 'ended') final = step;
    }
    expect(final).toBeDefined();
    expect(count(final!.events, 'PENALTY_NOT_APPLIED')).toBe(1);
    expect(count(final!.events, 'PENALTY_DRAWN')).toBe(0);
    const t = texts(final!.events);
    expect(t).toEqual([FEEDBACK_TEXT.beepyValidChallenged, FEEDBACK_TEXT.notApplied, 'Beepy wins this game.']);
  });

  it('the Solitaire ending reports the engine score', () => {
    const { series, start } = solitaire(19);
    let step: Step = start;
    while (step.view.phase !== 'ended') step = ok(series.submitHumanAction(validAction(step.view)));
    const outcome = step.view.outcome!;
    if (outcome.kind !== 'solitaire') throw new Error('mode');
    expect(texts(step.events).at(-1)).toBe(`Game over! Your score is ${outcome.score}.`);
  });

  it('over whole games, every "drew" line matches PENALTY_DRAWN events exactly', () => {
    for (const seed of [41, 42, 43]) {
      const series = seriesFor({ mode: 'vsBeepy', level: 'oneDigit', seed, beepyErrorRate: 0.4 });
      let step = ok(series.startNextGame());
      let steps = 0;
      while (step.view.phase !== 'ended' && steps < 2000) {
        steps += 1;
        const view = step.view;
        step =
          view.phase === 'awaitingEvaluation'
            ? ok(series.decide(steps % 2 === 0 ? 'accept' : 'challenge'))
            : view.activePlayer === 'beepy'
              ? ok(series.advanceBeepy())
              : ok(series.submitHumanAction(steps % 3 === 0 ? invalidAction(view) : validAction(view)));
        const t = texts(step.events);
        const humanDraws = step.events.filter((e) => e.type === 'PENALTY_DRAWN' && e.player === 'human').length;
        const beepyDraws = step.events.filter((e) => e.type === 'PENALTY_DRAWN' && e.player === 'beepy').length;
        expect(t.includes('You drew 1 card.')).toBe(humanDraws === 1);
        expect(t.includes('Beepy drew 1 card.')).toBe(beepyDraws === 1);
        expect(t.includes(FEEDBACK_TEXT.waived)).toBe(count(step.events, 'PENALTY_WAIVED') > 0);
        expect(t.includes(FEEDBACK_TEXT.notApplied)).toBe(count(step.events, 'PENALTY_NOT_APPLIED') > 0);
      }
    }
  });

  it('feedback never contains an answer, an explanation, or arithmetic', () => {
    const all = Object.values(FEEDBACK_TEXT).join(' ');
    expect(all).not.toMatch(/\d/);
    expect(all).not.toMatch(/because|answer is|equals/i);
  });
});
