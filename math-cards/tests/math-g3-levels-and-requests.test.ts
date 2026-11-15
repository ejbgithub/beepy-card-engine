/**
 * M4 G3 - difficulty levels and request validation (requirements 1, 2, 10.2).
 */

import { describe, expect, it } from 'vitest';
import {
  BASE_LEVEL_SPECS,
  MATH_LEVELS,
  MIXED_PLAUSIBLE,
  canonicalPairs,
  formatExpression,
  isMathLevel,
  pairKey,
  pairsOfLevel,
  parseExpression,
  plausibleRangeOf,
} from '../src/levels.js';
import { MathDeckGenerator, generateMathDeck, validateMathRequest } from '../src/math-generator.js';
import { LEVELS, SPEC, oraclePairs, oraclePairsOfLevel } from './math-oracle.js';

const valid = { mode: 'solitaire', level: 'oneDigit', seed: 1 } as const;
const codesOf = (raw: unknown): string[] => {
  const result = generateMathDeck(raw);
  expect(result.ok).toBe(false);
  expect('deck' in result).toBe(false);
  return result.ok ? [] : result.issues.map((i) => i.code);
};

describe('level table matches the approved version-1 spec (M4-2)', () => {
  it.each(['oneDigit', 'oneAndTwoDigit', 'twoDigit'] as const)('%s ranges, cap, and plausible range', (level) => {
    const spec = BASE_LEVEL_SPECS[level];
    expect([spec.smaller.min, spec.smaller.max]).toEqual(SPEC[level].smaller);
    expect([spec.larger.min, spec.larger.max]).toEqual(SPEC[level].larger);
    expect(spec.maxSum).toBe(SPEC[level].cap);
    expect([spec.plausible.min, spec.plausible.max]).toEqual(SPEC[level].plausible);
    expect(plausibleRangeOf(level)).toEqual(spec.plausible);
  });

  it('mixed uses 1-99 as its plausible range', () => {
    expect(MIXED_PLAUSIBLE).toEqual({ min: 1, max: 99 });
    expect(plausibleRangeOf('mixed')).toEqual({ min: 1, max: 99 });
  });

  it.each(['oneDigit', 'oneAndTwoDigit', 'twoDigit'] as const)('%s canonical pairs equal the independent enumeration', (level) => {
    const generated = canonicalPairs(level).map((p) => `${p.a}+${p.b}`).sort();
    const oracle = oraclePairs(level).map(([a, b]) => `${a}+${b}`).sort();
    expect(generated).toEqual(oracle);
  });

  it.each(LEVELS)('%s: no sum above 99, no zero operand, no two-digit operand of 90-99, canonical order', (level) => {
    const pairs = pairsOfLevel(level);
    expect(pairs.length).toBe(oraclePairsOfLevel(level).length);
    for (const p of pairs) {
      expect(p.a + p.b).toBe(p.sum);
      expect(p.sum).toBeLessThanOrEqual(99);
      expect(p.a).toBeGreaterThanOrEqual(1);
      expect(p.b).toBeGreaterThanOrEqual(1);
      expect(p.a).toBeLessThanOrEqual(p.b);
      for (const operand of [p.a, p.b]) {
        expect(operand >= 90 && operand <= 99).toBe(false);
      }
    }
  });

  it('every plausible numeric range excludes zero', () => {
    for (const level of LEVELS) {
      expect(plausibleRangeOf(level).min).toBeGreaterThanOrEqual(1);
    }
  });

  it('isMathLevel accepts exactly the four ids', () => {
    for (const level of Object.values(MATH_LEVELS)) expect(isMathLevel(level)).toBe(true);
    for (const other of ['threeDigit', 'OneDigit', '', null, 1, undefined]) expect(isMathLevel(other)).toBe(false);
  });

  it('formats canonically and parses expressions', () => {
    expect(formatExpression(4, 3)).toBe('3 + 4');
    expect(formatExpression(3, 45)).toBe('3 + 45');
    expect(parseExpression('3 + 4')).toEqual({ a: 3, b: 4 });
    expect(parseExpression('7')).toBeUndefined();
    expect(parseExpression('3 - 4')).toBeUndefined();
    expect(pairKey(4, 3)).toBe(pairKey(3, 4));
  });
});

describe('request validation (structured failures, no throw, no deck)', () => {
  it('accepts a valid request and defaults the direction to factToSubject', () => {
    const checked = validateMathRequest(valid);
    expect(checked).toMatchObject({ ok: true, request: { mode: 'solitaire', level: 'oneDigit', direction: 'factToSubject' } });
  });

  it.each(['tutor', 'vsPlayer'])('%s is MODE_NOT_SUPPORTED (never run as another mode)', (mode) => {
    expect(codesOf({ ...valid, mode })).toEqual(['MODE_NOT_SUPPORTED']);
  });

  it.each([undefined, null, '', 'Solitaire', 'competitive', 3, {}])('mode %j is INVALID_MODE', (mode) => {
    expect(codesOf({ ...valid, mode })).toEqual(['INVALID_MODE']);
  });

  it.each([undefined, 'threeDigit', 'easy', 2])('level %j is INVALID_LEVEL', (level) => {
    expect(codesOf({ ...valid, level })).toEqual(['INVALID_LEVEL']);
  });

  it.each(['both', 'subject', 5, null])('direction %j is INVALID_DIRECTION', (generationDirection) => {
    expect(codesOf({ ...valid, generationDirection })).toEqual(['INVALID_DIRECTION']);
  });

  it.each([undefined, Number.NaN, Infinity, -Infinity, '1', null])('seed %j is INVALID_SEED', (seed) => {
    expect(codesOf({ ...valid, seed })).toEqual(['INVALID_SEED']);
  });

  it.each([0, -1, 1.5, '15', Number.NaN])('targetCardCount %j is INVALID_COUNT', (targetCardCount) => {
    expect(codesOf({ ...valid, targetCardCount })).toEqual(['INVALID_COUNT']);
  });

  it('reports every request problem together', () => {
    expect(codesOf({ mode: 'tutor', level: 'x', generationDirection: 'y', seed: 'z', targetCardCount: 0 }).sort()).toEqual(
      ['INVALID_COUNT', 'INVALID_DIRECTION', 'INVALID_LEVEL', 'INVALID_SEED', 'MODE_NOT_SUPPORTED'],
    );
  });

  it.each([null, undefined, 7, 'request', [valid]])('a non-object request (%j) is INVALID_REQUEST', (raw) => {
    expect(codesOf(raw)).toEqual(['INVALID_REQUEST']);
  });

  it('a request with a throwing getter is INVALID_REQUEST, not a crash', () => {
    const hostile = Object.defineProperty({}, 'mode', {
      get: () => {
        throw new Error('trap');
      },
    });
    expect(() => generateMathDeck(hostile)).not.toThrow();
    expect(codesOf(hostile)).toEqual(['INVALID_REQUEST']);
  });

  it('negative and fractional finite seeds are accepted (reduced to a 32-bit seed)', () => {
    expect(generateMathDeck({ ...valid, seed: -42.7 }).ok).toBe(true);
  });

  it('the DeckGenerator class delegates to generateMathDeck', () => {
    const generator = new MathDeckGenerator();
    expect(generator.app).toBe('math');
    expect(generator.generate({ ...valid, seed: 5 })).toEqual(generateMathDeck({ ...valid, seed: 5 }));
  });
});
