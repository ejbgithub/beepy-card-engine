/**
 * M3 E1 - pure seeded randomness (decision D-1, clarification B).
 */

import { describe, expect, it } from 'vitest';
import {
  deriveSeed,
  nextFloat,
  nextInt,
  nextUint32,
  shuffle,
  toRngState,
  type RngState,
} from '../src/game/random.js';

const sequence = (seed: RngState, count: number): number[] => {
  const out: number[] = [];
  let state = seed;
  for (let i = 0; i < count; i += 1) {
    const [value, next] = nextUint32(state);
    out.push(value);
    state = next;
  }
  return out;
};

describe('nextUint32', () => {
  it('is deterministic: the same state gives the same value and next state', () => {
    expect(nextUint32(12345)).toEqual(nextUint32(12345));
    expect(sequence(7, 50)).toEqual(sequence(7, 50));
  });

  it('is a pure function: calling it does not change later results', () => {
    const first = sequence(99, 10);
    nextUint32(99);
    nextUint32(100);
    expect(sequence(99, 10)).toEqual(first);
  });

  it('gives different sequences for different seeds', () => {
    expect(sequence(1, 20)).not.toEqual(sequence(2, 20));
  });

  it('returns unsigned 32-bit values and a valid next state', () => {
    for (const seed of [0, 1, 2 ** 31, 2 ** 32 - 1, -5, 3.7, Number.NaN, Infinity]) {
      const [value, next] = nextUint32(seed);
      expect(Number.isInteger(value) && value >= 0 && value < 2 ** 32).toBe(true);
      expect(Number.isInteger(next) && next >= 0 && next < 2 ** 32).toBe(true);
    }
  });

  it('coerces seeds consistently', () => {
    expect(toRngState(-1)).toBe(2 ** 32 - 1);
    expect(toRngState(Number.NaN)).toBe(0);
    expect(toRngState(5.9)).toBe(5);
  });

  it('does not repeat values quickly (no short cycle)', () => {
    const values = sequence(42, 5000);
    expect(new Set(values).size).toBeGreaterThan(4990);
  });
});

describe('nextFloat and nextInt', () => {
  it('nextFloat stays in [0, 1)', () => {
    let state: RngState = 3;
    for (let i = 0; i < 2000; i += 1) {
      const [value, next] = nextFloat(state);
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
      state = next;
    }
  });

  it('nextInt stays in range and covers every value', () => {
    for (const bound of [1, 2, 3, 5, 9, 14, 24]) {
      const seen = new Set<number>();
      let state: RngState = bound;
      for (let i = 0; i < 2000; i += 1) {
        const [value, next] = nextInt(state, bound);
        expect(Number.isInteger(value) && value >= 0 && value < bound).toBe(true);
        seen.add(value);
        state = next;
      }
      expect(seen.size).toBe(bound);
    }
  });

  it('nextInt is roughly uniform', () => {
    const counts = [0, 0, 0];
    let state: RngState = 11;
    for (let i = 0; i < 30000; i += 1) {
      const [value, next] = nextInt(state, 3);
      counts[value] = (counts[value] ?? 0) + 1;
      state = next;
    }
    for (const count of counts) {
      expect(count).toBeGreaterThan(9000);
      expect(count).toBeLessThan(11000);
    }
  });

  it.each([0, -1, 1.5, Number.NaN, Infinity, 2 ** 32 + 1])('nextInt rejects bound %s', (bound) => {
    expect(() => nextInt(1, bound)).toThrow(RangeError);
  });
});

describe('shuffle', () => {
  const items = Array.from({ length: 14 }, (_, i) => i);

  it('returns a permutation and leaves the input untouched', () => {
    const input = Object.freeze([...items]);
    const [result] = shuffle(input, 5);
    expect([...result].sort((a, b) => a - b)).toEqual(items);
    expect(input).toEqual(items);
  });

  it('is deterministic for a seed and different across seeds', () => {
    expect(shuffle(items, 8)).toEqual(shuffle(items, 8));
    expect(shuffle(items, 8)[0]).not.toEqual(shuffle(items, 9)[0]);
  });

  it('returns the advanced state so a second shuffle differs', () => {
    const [first, next] = shuffle(items, 21);
    const [second] = shuffle(items, next);
    expect(second).not.toEqual(first);
  });

  it('handles empty and single-item arrays without consuming randomness', () => {
    expect(shuffle([], 4)).toEqual([[], 4]);
    expect(shuffle(['a'], 4)).toEqual([['a'], 4]);
  });

  it('puts every item in every position across many seeds (no fixed positions)', () => {
    const small = [0, 1, 2, 3];
    const positions = small.map(() => new Set<number>());
    for (let seed = 0; seed < 400; seed += 1) {
      shuffle(small, seed)[0].forEach((item, index) => positions[index]?.add(item));
    }
    for (const set of positions) {
      expect(set.size).toBe(4);
    }
  });
});

describe('deriveSeed', () => {
  it('is pure and deterministic', () => {
    expect(deriveSeed(1, 1, 'deal')).toBe(deriveSeed(1, 1, 'deal'));
  });

  it('separates streams, games, and series seeds', () => {
    const values = new Set<number>();
    for (const seed of [1, 2]) {
      for (const game of [1, 2, 3, 4, 5]) {
        for (const stream of ['deal', 'engine', 'beepy'] as const) {
          values.add(deriveSeed(seed, game, stream));
        }
      }
    }
    expect(values.size).toBe(30);
  });
});

describe('engine source does not use uncontrolled randomness or time', () => {
  const sources = import.meta.glob('../src/game/*.ts', {
    query: '?raw',
    import: 'default',
    eager: true,
  }) as Record<string, string>;

  it('finds the engine source files', () => {
    expect(Object.keys(sources).length).toBeGreaterThanOrEqual(2);
  });

  it.each(Object.entries(sources))('%s has no Math.random, Date, performance, or crypto calls', (_file, text) => {
    const code = text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    expect(code).not.toMatch(/Math\.random\s*\(/);
    expect(code).not.toMatch(/\bDate\b/);
    expect(code).not.toMatch(/performance\.now/);
    expect(code).not.toMatch(/\bcrypto\b/);
  });
});
