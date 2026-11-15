/**
 * M3 E13 - private history and its public projection (requirement 10).
 *
 * Whole games are played step by step with the pure core. After every step the
 * private history must equal the previous history plus exactly the events the step
 * returned, and at the end the history must agree with the final state and stats.
 * The test-only step limit guards against nontermination; the engine has no cap.
 */

import { describe, expect, it } from 'vitest';
import { advanceBeepy, evaluatePending, submitAction } from '../src/game/game.js';
import { judgeAction } from '../src/game/judge.js';
import { createReferenceBeepyStrategy } from '../src/game/beepy-strategy.js';
import { toPublicEvents, type PublicEvent } from '../src/game/view.js';
import type { EngineEvent, EngineMode, EngineState, PlayerId, StepResult } from '../src/game/types.js';
import { COMBOS, expectInvariants, invalidRequest, ok, start, validRequest } from './m3-helpers.js';
import type { ContentStyle } from './fixtures.js';
import type { GenerationDirection } from '../src/index.js';

const TEST_STEP_LIMIT = 2000;

const beepy = (() => {
  const created = createReferenceBeepyStrategy({ errorRate: 0.3 });
  if (!created.ok) throw new Error('strategy');
  return created.strategy;
})();

interface Played {
  readonly final: EngineState;
  readonly publicPerStep: PublicEvent[];
}

/** Play a game, checking the history after every step. */
function play(mode: EngineMode, seed: number, style: ContentStyle, direction: GenerationDirection): Played {
  let state = start(mode, { seed, style, direction });
  const publicPerStep: PublicEvent[] = [...toPublicEvents(state.history, state, 'human')];
  let steps = 0;
  while (state.phase !== 'ended') {
    steps += 1;
    if (steps > TEST_STEP_LIMIT) throw new Error('test-only step limit exceeded');
    let result: StepResult;
    if (state.phase === 'awaitingEvaluation') {
      const p = state.pending!;
      const valid = judgeAction(state, p.kind, p.cardId, p.challengeId);
      // The human is right about two times in three.
      result = evaluatePending(state, (steps % 3 === 0) === valid ? 'challenge' : 'accept');
    } else if (state.activePlayer === 'beepy') {
      result = advanceBeepy(state, beepy);
    } else {
      result = submitAction(state, steps % 4 === 0 ? invalidRequest(state, 'human') : validRequest(state, 'human'));
    }
    const step = ok(result);
    // The history grows by exactly the step's events, in order.
    expect(step.state.history).toEqual([...state.history, ...step.events]);
    publicPerStep.push(...toPublicEvents(step.events, step.state, 'human'));
    state = step.state;
    expectInvariants(state);
  }
  return { final: state, publicPerStep };
}

const ofType = <T extends EngineEvent['type']>(history: readonly EngineEvent[], type: T) =>
  history.filter((e): e is Extract<EngineEvent, { type: T }> => e.type === type);

describe.each(['solitaire', 'vsBeepy'] as const)('private history: %s', (mode) => {
  describe.each(COMBOS)('%s / %s', (style, direction) => {
    const runs = [1, 2, 3, 4, 5].map((seed) => play(mode, seed, style, direction));

    it('starts with GAME_DEALT and ends with exactly one GAME_ENDED', () => {
      for (const { final } of runs) {
        expect(final.history[0]?.type).toBe('GAME_DEALT');
        expect(final.history.at(-1)).toEqual({ type: 'GAME_ENDED', outcome: final.outcome });
        expect(ofType(final.history, 'GAME_ENDED')).toHaveLength(1);
      }
    });

    it('records one resolution and one TURN_COUNTED per turn, numbered 1..n in order', () => {
      for (const { final } of runs) {
        const turns = ofType(final.history, 'TURN_COUNTED').map((e) => e.turn);
        expect(turns).toEqual(Array.from({ length: final.turnCount }, (_, i) => i + 1));
        expect(ofType(final.history, 'ACTION_RESOLVED').map((e) => e.turn)).toEqual(turns);
      }
    });

    it('every submitted action is resolved exactly once with the same card and destination', () => {
      for (const { final } of runs) {
        const submitted = ofType(final.history, 'ACTION_SUBMITTED');
        const resolved = ofType(final.history, 'ACTION_RESOLVED');
        expect(resolved).toHaveLength(submitted.length);
        submitted.forEach((s, i) => {
          const r = resolved[i]!;
          expect([r.turn, r.player, r.kind, r.cardId, r.challengeId]).toEqual([s.turn, s.player, s.kind, s.cardId, s.challengeId]);
        });
      }
    });

    it('CHALLENGE_SOLVED matches the final board and carries the deck sourceRef', () => {
      for (const { final } of runs) {
        const solved = ofType(final.history, 'CHALLENGE_SOLVED');
        expect(solved.length).toBe(Object.keys(final.solvedBy).length);
        for (const event of solved) {
          const challenge = final.deck.challenges.find((c) => c.id === event.challengeId)!;
          expect(event.sourceRef).toEqual(challenge.sourceRef);
          expect(event.cardId).toBe(challenge.correctAnswerCardId);
          expect(final.solvedBy[event.challengeId]).toBe(event.solvedBy);
          expect(final.played[event.challengeId]).toBe(event.cardId);
        }
      }
    });

    it('the learning stats agree with the resolved actions in the history', () => {
      for (const { final } of runs) {
        for (const player of ['human', 'beepy'] as PlayerId[]) {
          const mine = ofType(final.history, 'ACTION_RESOLVED').filter((e) => e.player === player);
          const count = (kind: string, valid: boolean) => mine.filter((e) => e.kind === kind && e.valid === valid).length;
          expect(final.stats[player]).toEqual({
            turns: mine.length,
            correctPlays: count('play', true),
            incorrectPlays: count('play', false),
            correctDiscards: count('discard', true),
            incorrectDiscards: count('discard', false),
          });
        }
      }
    });

    it('replaying the history from the deal reproduces every final zone', () => {
      for (const { final } of runs) {
        const dealt = ofType(final.history, 'GAME_DEALT')[0]!;
        const hands: Record<PlayerId, string[]> = { human: [...dealt.hands.human], beepy: [...dealt.hands.beepy] };
        let pile = [...dealt.drawPile];
        const discard: string[] = [];
        const played: Record<string, string> = {};
        for (const event of final.history) {
          if (event.type === 'CHALLENGE_SOLVED') {
            hands[event.solvedBy] = hands[event.solvedBy].filter((id) => id !== event.cardId);
            played[event.challengeId] = event.cardId;
          } else if (event.type === 'CARD_DISCARDED') {
            hands[event.by] = hands[event.by].filter((id) => id !== event.cardId);
            discard.push(event.cardId);
          } else if (event.type === 'PENALTY_DRAWN') {
            hands[event.player].push(event.cardId);
            if (event.source === 'drawPile') {
              expect(pile[0]).toBe(event.cardId);
              pile = pile.slice(1);
            }
          }
        }
        expect(hands).toEqual({ human: final.hands.human, beepy: final.hands.beepy });
        expect(pile).toEqual(final.drawPile);
        expect(discard).toEqual(final.discard);
        expect(played).toEqual(final.played);
      }
    });
  });
});

describe('history of the win-before-penalty case', () => {
  it('records PENALTY_NOT_APPLIED before GAME_ENDED and no PENALTY_DRAWN', () => {
    // Found by search: a real game in which Beepy's last card is challenged.
    for (let seed = 1; seed <= 300; seed += 1) {
      let state = start('vsBeepy', { seed });
      let steps = 0;
      while (state.phase !== 'ended' && steps < TEST_STEP_LIMIT) {
        steps += 1;
        if (state.phase === 'awaitingEvaluation') {
          state = ok(evaluatePending(state, 'challenge')).state;
        } else if (state.activePlayer === 'beepy') {
          state = ok(submitAction(state, validRequest(state, 'beepy'))).state;
        } else {
          state = ok(submitAction(state, invalidRequest(state, 'human'))).state;
        }
      }
      if (state.outcome?.kind === 'vsBeepy' && state.outcome.winner === 'beepy' && state.outcome.reason === 'handEmpty') {
        const tail = state.history.slice(-2).map((e) => e.type);
        expect(tail).toEqual(['PENALTY_NOT_APPLIED', 'GAME_ENDED']);
        const lastTurn = state.history.map((e) => e.type).lastIndexOf('TURN_COUNTED');
        expect(state.history.slice(lastTurn).some((e) => e.type === 'PENALTY_DRAWN')).toBe(false);
        return;
      }
    }
    throw new Error('no qualifying game found in 300 seeds');
  });
});

describe('public projection of the history', () => {
  const runs = [1, 2, 3].map((seed) => play('vsBeepy', seed, 'clinical', 'subjectToFact'));

  it('mirrors resolutions, solved challenges, penalties, and the ending', () => {
    for (const { final, publicPerStep } of runs) {
      const count = (type: string) => publicPerStep.filter((e) => e.type === type).length;
      expect(count('GAME_STARTED')).toBe(1);
      expect(count('ACTION_RESOLVED')).toBe(ofType(final.history, 'ACTION_RESOLVED').length);
      expect(count('CHALLENGE_SOLVED')).toBe(ofType(final.history, 'CHALLENGE_SOLVED').length);
      expect(count('PENALTY_DRAWN')).toBe(ofType(final.history, 'PENALTY_DRAWN').length);
      expect(count('PENALTY_WAIVED')).toBe(ofType(final.history, 'PENALTY_EXHAUSTED').length);
      expect(count('GAME_ENDED')).toBe(1);
      // One ACTION_PENDING per Beepy action, always before its resolution.
      const beepyActions = ofType(final.history, 'ACTION_SUBMITTED').filter((e) => e.player === 'beepy').length;
      expect(count('ACTION_PENDING')).toBe(beepyActions);
    }
  });

  it('omits hidden data: no deck card ids and no faces of Beepy penalty cards', () => {
    for (const { final, publicPerStep } of runs) {
      const text = JSON.stringify(publicPerStep);
      for (const card of final.deck.answerCards) expect(text).not.toContain(`"${card.id}"`);
      expect(text).not.toContain('correctAnswerCardId');
      for (const event of publicPerStep) {
        if (event.type === 'PENALTY_DRAWN') {
          expect('card' in event).toBe(event.player === 'human');
        }
        if (event.type === 'ACTION_PENDING') {
          expect(Object.keys(event.pending).sort()).toEqual(['card', 'destination', 'kind', 'player']);
        }
      }
    }
  });

  it('reveals validity only in ACTION_RESOLVED, and matches the private ruling', () => {
    for (const { final, publicPerStep } of runs) {
      const privateRulings = ofType(final.history, 'ACTION_RESOLVED').map((e) => e.valid);
      const publicRulings = publicPerStep.flatMap((e) => (e.type === 'ACTION_RESOLVED' ? [e.valid] : []));
      expect(publicRulings).toEqual(privateRulings);
      for (const event of publicPerStep) {
        if (event.type !== 'ACTION_RESOLVED') expect(JSON.stringify(event)).not.toMatch(/"valid"/);
      }
    }
  });

  it('shows the sourceRef of solved challenges so progress tracking can use it', () => {
    for (const { final, publicPerStep } of runs) {
      for (const event of publicPerStep) {
        if (event.type === 'CHALLENGE_SOLVED') {
          const challenge = final.deck.challenges.find((c) => c.id === event.challengeId)!;
          expect(event.sourceRef).toEqual(challenge.sourceRef);
        }
      }
    }
  });
});
