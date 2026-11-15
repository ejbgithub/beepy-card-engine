/**
 * M3 E5 - penalty application (requirement 4): atomic events, fallback, exhaustion.
 */

import { describe, expect, it } from 'vitest';
import { applyPenaltyEvent } from '../src/game/penalty.js';
import { submitAction } from '../src/game/game.js';
import type { PenaltyCandidate, PenaltyFallbackProvider } from '../src/penalty-draw.js';
import {
  act,
  discardReq,
  expectInvariants,
  invalidRequest,
  ok,
  start,
  validRequest,
} from './m3-helpers.js';
import type { EngineState, OwedPenalty } from '../src/game/types.js';

const human: OwedPenalty = { playerId: 'human', reason: 'INVALID_ACTION' };
const beepy: OwedPenalty = { playerId: 'beepy', reason: 'INVALID_ACTION' };

/** Move the whole draw pile to the discard pile, keeping every card accounted for. */
const withPile = (state: EngineState, keep: number): EngineState => ({
  ...state,
  drawPile: state.drawPile.slice(0, keep),
  discard: [...state.discard, ...state.drawPile.slice(keep)],
});

/** A provider of fresh numeric distractors that are valid for no challenge. */
function freshNumbers(start = 1000, withExplanation = false): PenaltyFallbackProvider {
  return {
    candidates(context) {
      return (function* (): Generator<PenaltyCandidate> {
        for (let n = start; ; n += 1) {
          yield {
            card: {
              id: `fallback-${n}`,
              displayValue: String(n),
              ...(withExplanation ? { explanationByChallengeId: { x: 'invented' } } : {}),
            },
            plausible: true,
            validForChallenges: Object.fromEntries(context.activeChallenges.map((c) => [c.id, false])),
          };
        }
      })();
    },
  };
}

describe('drawing from the draw pile', () => {
  it('gives the top pile card to the player who owes the draw', () => {
    const state = start('solitaire', { seed: 1 });
    const top = state.drawPile[0]!;
    const step = ok(applyPenaltyEvent(state, [human]));
    expect(step.state.hands.human).toEqual([...state.hands.human, top]);
    expect(step.state.drawPile).toEqual(state.drawPile.slice(1));
    expect(step.events).toEqual([
      { type: 'PENALTY_DRAWN', player: 'human', cardId: top, reason: 'INVALID_ACTION', source: 'drawPile' },
    ]);
    expectInvariants(step.state);
  });

  it('an empty owed list changes nothing', () => {
    const state = start('solitaire');
    const step = ok(applyPenaltyEvent(state, []));
    expect(step.state).toBe(state);
    expect(step.events).toEqual([]);
  });

  it('draws for two players in one atomic event, in request order', () => {
    const state = start('vsBeepy', { seed: 1 });
    const [a, b] = [state.drawPile[0]!, state.drawPile[1]!];
    const step = ok(applyPenaltyEvent(state, [{ ...human, reason: 'MISSED_CHALLENGE' }, beepy]));
    expect(step.state.hands.human).toEqual([...state.hands.human, a]);
    expect(step.state.hands.beepy).toEqual([...state.hands.beepy, b]);
    expect(step.state.drawPile).toEqual(state.drawPile.slice(2));
    expectInvariants(step.state);
  });

  it('never reuses a card: repeated draws take distinct cards', () => {
    let state = start('solitaire', { seed: 2 });
    const seen = new Set<string>();
    for (let i = 0; i < state.drawPile.length; i += 0) {
      const top = state.drawPile[0]!;
      expect(seen.has(top)).toBe(false);
      seen.add(top);
      state = ok(applyPenaltyEvent(state, [human])).state;
      if (state.drawPile.length === 0) break;
    }
    expect(state.drawPile).toEqual([]);
    expectInvariants(state);
  });
});

describe('exhaustion is waived, recorded, and atomic', () => {
  it('records PENALTY_CARD_EXHAUSTED and draws nothing when no fallback exists', () => {
    const state = withPile(start('solitaire', { seed: 1 }), 0);
    const step = ok(applyPenaltyEvent(state, [human]));
    expect(step.state.hands).toEqual(state.hands);
    expect(step.state.cards).toBe(state.cards);
    expect(step.events).toHaveLength(1);
    const event = step.events[0]!;
    expect(event.type).toBe('PENALTY_EXHAUSTED');
    if (event.type === 'PENALTY_EXHAUSTED') {
      expect(event.exhausted.code).toBe('PENALTY_CARD_EXHAUSTED');
      expect(event.exhausted.details.fallback.status).toBe('NOT_AVAILABLE');
      expect(event.owed).toEqual([human]);
    }
    expectInvariants(step.state);
  });

  it('a two-player event is all or nothing: one pile card is not enough', () => {
    const state = withPile(start('vsBeepy', { seed: 1 }), 1);
    const step = ok(applyPenaltyEvent(state, [human, beepy]));
    expect(step.state.hands).toEqual(state.hands);
    expect(step.state.drawPile).toEqual(state.drawPile);
    expect(step.events[0]?.type).toBe('PENALTY_EXHAUSTED');
  });

  it('the exhaustion payload holds counts only, never card faces', () => {
    const state = withPile(start('solitaire', { seed: 1, style: 'clinical' }), 0);
    const event = ok(applyPenaltyEvent(state, [human])).events[0]!;
    const text = JSON.stringify(event);
    for (const card of state.deck.answerCards) {
      expect(text).not.toContain(card.displayValue);
    }
  });

  it('the game continues after a waived penalty: the failed action still counted as a turn', () => {
    let state = withPile(start('solitaire', { seed: 6 }), 0);
    const step = act(state, invalidRequest(state, 'human'));
    state = step.state;
    expect(state.turnCount).toBe(1);
    expect(state.hands.human).toHaveLength(5); // the card was returned and no penalty drawn
    expect(state.phase).toBe('awaitingAction');
    expect(step.events.map((e) => e.type)).toContain('PENALTY_EXHAUSTED');
    state = act(state, validRequest(state, 'human')).state;
    expect(state.turnCount).toBe(2);
    expectInvariants(state);
  });
});

describe('bounded fallback', () => {
  it('supplies a fresh card with a new handle, in the hand, with no explanation', () => {
    const state = withPile(start('solitaire', { seed: 1, fallback: freshNumbers(1000, true) }), 0);
    const step = ok(applyPenaltyEvent(state, [human]));
    const drawn = step.events[0]!;
    expect(drawn).toMatchObject({ type: 'PENALTY_DRAWN', source: 'fallback', cardId: 'fallback-1000' });
    expect(step.state.hands.human).toContain('fallback-1000');
    expect(step.state.cards['fallback-1000']).toEqual({ id: 'fallback-1000', displayValue: '1000' });
    const handle = step.state.handleByCard['fallback-1000']!;
    expect(handle).toMatch(/^h[0-9a-z]{7}$/);
    expect(step.state.cardByHandle[handle]).toBe('fallback-1000');
    expectInvariants(step.state);
  });

  it('rejects candidates that duplicate a card already in the game', () => {
    const base = start('solitaire', { seed: 1 });
    const taken = base.cards[base.hands.human[0]!]!.displayValue;
    const provider: PenaltyFallbackProvider = {
      candidates(context) {
        const none = Object.fromEntries(context.activeChallenges.map((c) => [c.id, false]));
        return [
          { card: { id: 'dup-value', displayValue: taken }, plausible: true, validForChallenges: none },
          { card: { id: base.hands.human[0]!, displayValue: '4242' }, plausible: true, validForChallenges: none },
          { card: { id: 'fresh', displayValue: '4243' }, plausible: true, validForChallenges: none },
        ];
      },
    };
    const state = withPile({ ...base, options: { ...base.options, fallback: provider } }, 0);
    const step = ok(applyPenaltyEvent(state, [human]));
    expect(step.events[0]).toMatchObject({ type: 'PENALTY_DRAWN', cardId: 'fresh', source: 'fallback' });
    expectInvariants(step.state);
  });

  it('is bounded: a provider that only offers unusable candidates ends in exhaustion', () => {
    const base = start('solitaire', { seed: 1 });
    const taken = base.cards[base.hands.human[0]!]!.displayValue;
    const provider: PenaltyFallbackProvider = {
      candidates(context) {
        const none = Object.fromEntries(context.activeChallenges.map((c) => [c.id, false]));
        return (function* (): Generator<PenaltyCandidate> {
          for (let n = 0; ; n += 1) {
            yield { card: { id: `d-${n}`, displayValue: taken }, plausible: true, validForChallenges: none };
          }
        })();
      },
    };
    const state = withPile(
      { ...base, options: { ...base.options, fallback: provider, maxPenaltyCandidates: 7 } },
      0,
    );
    const step = ok(applyPenaltyEvent(state, [human]));
    const event = step.events[0]!;
    expect(event.type).toBe('PENALTY_EXHAUSTED');
    if (event.type === 'PENALTY_EXHAUSTED') {
      expect(event.exhausted.details.fallback).toMatchObject({ status: 'LIMIT_REACHED', candidatesTried: 7, maxCandidates: 7 });
    }
    expect(step.state.hands).toEqual(state.hands);
  });

  it('rejects a candidate that is a valid answer to an active challenge', () => {
    const base = start('solitaire', { seed: 1 });
    const provider: PenaltyFallbackProvider = {
      candidates(context) {
        const first = context.activeChallenges[0]!.id;
        const flags = Object.fromEntries(context.activeChallenges.map((c) => [c.id, c.id === first]));
        return [{ card: { id: 'ambiguous', displayValue: '5555' }, plausible: true, validForChallenges: flags }];
      },
    };
    const state = withPile({ ...base, options: { ...base.options, fallback: provider } }, 0);
    expect(ok(applyPenaltyEvent(state, [human])).events[0]?.type).toBe('PENALTY_EXHAUSTED');
  });

  it('checks candidates against open challenges only, not solved ones', () => {
    const base = start('solitaire', { seed: 1 });
    let seen = -1;
    const provider: PenaltyFallbackProvider = {
      candidates(context) {
        seen = context.activeChallenges.length;
        return [];
      },
    };
    const solved = { ...base, solvedBy: { 'challenge-0': 'human' as const }, played: { 'challenge-0': 'correct-0' } };
    // Keep conservation: correct-0 leaves wherever it was (a hand or the pile).
    const stripped: EngineState = {
      ...solved,
      hands: { human: base.hands.human.filter((id) => id !== 'correct-0'), beepy: [] },
      drawPile: [],
      discard: base.drawPile.filter((id) => id !== 'correct-0'),
      options: { ...base.options, fallback: provider },
    };
    ok(applyPenaltyEvent(stripped, [human]));
    expect(seen).toBe(4);
  });

  it('uses a Clinical-style game with no provider: no card is created', () => {
    const state = withPile(start('solitaire', { seed: 1, style: 'clinical' }), 0);
    const step = ok(applyPenaltyEvent(state, [human]));
    expect(Object.keys(step.state.cards)).toHaveLength(Object.keys(state.cards).length);
    expect(step.events[0]?.type).toBe('PENALTY_EXHAUSTED');
  });
});

describe('penalty through a full action', () => {
  it('an invalid action draws exactly one card from the top of the pile', () => {
    const state = start('solitaire', { seed: 8 });
    const top = state.drawPile[0]!;
    const step = act(state, invalidRequest(state, 'human'));
    expect(step.state.hands.human).toContain(top);
    expect(step.state.hands.human).toHaveLength(6);
    expect(step.state.drawPile).toHaveLength(state.drawPile.length - 1);
  });

  it('a valid action draws nothing', () => {
    const state = start('solitaire', { seed: 8 });
    const step = act(state, validRequest(state, 'human'));
    expect(step.state.drawPile).toEqual(state.drawPile);
    expect(step.events.some((e) => e.type === 'PENALTY_DRAWN')).toBe(false);
  });

  it('is not applied when the action was an illegal request', () => {
    const state = start('solitaire', { seed: 8 });
    const result = submitAction(state, discardReq(state, 'human', state.drawPile[0]!));
    expect(result.ok).toBe(false);
    expect(state.drawPile).toHaveLength(8);
  });
});
