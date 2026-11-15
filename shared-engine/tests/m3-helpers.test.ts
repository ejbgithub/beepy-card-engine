/**
 * Tests for the M3 test helpers themselves (craft and expectInvariants), so a
 * helper bug cannot hide an engine defect.
 */

import { describe, expect, it } from 'vitest';
import { craft, expectInvariants, start } from './m3-helpers.js';

describe('craft', () => {
  const base = start('solitaire', { seed: 1 });

  it('places each card exactly once and sends the rest to the pile', () => {
    const state = craft(base, { human: ['correct-0', 'distractor-0'], solved: { 'challenge-1': 'human' } });
    expect(state.hands.human).toEqual(['correct-0', 'distractor-0']);
    expect(state.played).toEqual({ 'challenge-1': 'correct-1' });
    expect(state.solvedBy).toEqual({ 'challenge-1': 'human' });
    expectInvariants(state);
  });

  it('rejects an unknown card id', () => {
    expect(() => craft(base, { human: ['nope'] })).toThrow(/unknown card id "nope"/);
  });

  it('rejects an unknown challenge id', () => {
    expect(() => craft(base, { solved: { 'challenge-99': 'human' } })).toThrow(/unknown challenge/);
  });

  it('rejects a card assigned to two places', () => {
    expect(() => craft(base, { human: ['correct-0'], discard: ['correct-0'] })).toThrow(/both human hand and discard/);
    expect(() => craft(base, { human: ['a'.repeat(0) + 'correct-0', 'correct-0'] })).toThrow(/assigned to both/);
  });

  it('rejects placing a solved challenge\'s own card elsewhere', () => {
    expect(() => craft(base, { solved: { 'challenge-0': 'human' }, human: ['correct-0'] })).toThrow(/solved challenge/);
  });
});

describe('expectInvariants', () => {
  it('passes for a freshly dealt game', () => {
    expectInvariants(start('vsBeepy', { seed: 3 }));
  });

  it('fails when a numeric-mode card has a non-numeric value', () => {
    const state = start('solitaire', { seed: 1 });
    const broken = { ...state, cards: { ...state.cards, 'distractor-0': { id: 'distractor-0', displayValue: 'abc' } } };
    expect(() => expectInvariants(broken)).toThrow(/non-numeric/);
  });

  it('fails on numerically equal values in numeric mode ("07" and "7")', () => {
    const state = start('solitaire', { seed: 1 });
    const a = state.cards['distractor-0']!;
    const b = state.cards['distractor-1']!;
    const broken = {
      ...state,
      cards: { ...state.cards, [a.id]: { ...a, displayValue: '07' }, [b.id]: { ...b, displayValue: '7' } },
    };
    expect(() => expectInvariants(broken)).toThrow();
  });

  it('fails on a duplicated card id across zones', () => {
    const state = start('solitaire', { seed: 1 });
    const broken = { ...state, discard: [state.hands.human[0]!] };
    expect(() => expectInvariants(broken)).toThrow();
  });

  it('uses text normalization outside numeric mode (case and spacing)', () => {
    const state = start('solitaire', { seed: 1, style: 'clinical' });
    const a = state.cards['distractor-0']!;
    const b = state.cards['distractor-1']!;
    const broken = {
      ...state,
      cards: { ...state.cards, [a.id]: { ...a, displayValue: 'Same  Text' }, [b.id]: { ...b, displayValue: 'same text' } },
    };
    expect(() => expectInvariants(broken)).toThrow();
  });
});
