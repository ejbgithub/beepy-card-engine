/**
 * Math difficulty levels (Milestone M4, G3; decision M4-2, approved for version 1).
 *
 * Each level states, in one place, its operand ranges, its sum cap, and its
 * plausible distractor range:
 *
 *   level            smaller operand  larger operand  sum cap  plausible numbers
 *   oneDigit         1-9              1-9             18       1-20
 *   oneAndTwoDigit   1-9              10-89           99       10-99
 *   twoDigit         10-89            10-89           99       20-99
 *   mixed            each challenge uses one of the three      1-99
 *
 * Version 1 rules (owner-approved): no sum above 99; two-digit operands are 10-89;
 * no zero operand; and zero is never a distractor, because every plausible numeric
 * range starts at 1 or higher.
 *
 * Expressions are written in CANONICAL order "a + b" with a <= b (smaller operand
 * first), so each unordered operand pair has exactly one display. Commuted forms
 * ("4 + 3") are never generated.
 *
 * Subject-neutral engine code is not touched; this is Math-specific.
 */

/** Approved Math level ids. */
export const MATH_LEVELS = {
  oneDigit: 'oneDigit',
  oneAndTwoDigit: 'oneAndTwoDigit',
  twoDigit: 'twoDigit',
  mixed: 'mixed',
} as const;

export type MathLevel = (typeof MATH_LEVELS)[keyof typeof MATH_LEVELS];
export type BaseMathLevel = Exclude<MathLevel, 'mixed'>;

/** Inclusive whole-number range. */
export interface NumberRange {
  readonly min: number;
  readonly max: number;
}

/** A single (non-mixed) level. */
export interface BaseLevelSpec {
  readonly id: BaseMathLevel;
  /** Range of the operand written first. */
  readonly smaller: NumberRange;
  /** Range of the operand written second. */
  readonly larger: NumberRange;
  /** No sum may exceed this. */
  readonly maxSum: number;
  /** Plausible numeric distractor range (factToSubject). */
  readonly plausible: NumberRange;
}

/** Global version-1 cap: no sum above 99. */
export const MAX_SUM = 99;

export const BASE_LEVEL_SPECS: Readonly<Record<BaseMathLevel, BaseLevelSpec>> = {
  oneDigit: {
    id: 'oneDigit',
    smaller: { min: 1, max: 9 },
    larger: { min: 1, max: 9 },
    maxSum: 18,
    plausible: { min: 1, max: 20 },
  },
  oneAndTwoDigit: {
    id: 'oneAndTwoDigit',
    smaller: { min: 1, max: 9 },
    larger: { min: 10, max: 89 },
    maxSum: MAX_SUM,
    plausible: { min: 10, max: 99 },
  },
  twoDigit: {
    id: 'twoDigit',
    smaller: { min: 10, max: 89 },
    larger: { min: 10, max: 89 },
    maxSum: MAX_SUM,
    plausible: { min: 20, max: 99 },
  },
};

/** The base levels a `mixed` deck draws from, in a fixed order. */
export const MIXED_BASE_LEVELS: readonly BaseMathLevel[] = ['oneDigit', 'oneAndTwoDigit', 'twoDigit'];

/** Plausible numeric range for a mixed deck. */
export const MIXED_PLAUSIBLE: NumberRange = { min: 1, max: 99 };

/** Is `value` an approved level id? */
export function isMathLevel(value: unknown): value is MathLevel {
  return (
    value === MATH_LEVELS.oneDigit ||
    value === MATH_LEVELS.oneAndTwoDigit ||
    value === MATH_LEVELS.twoDigit ||
    value === MATH_LEVELS.mixed
  );
}

/** The base levels a level draws from. */
export function baseLevelsOf(level: MathLevel): readonly BaseMathLevel[] {
  return level === MATH_LEVELS.mixed ? MIXED_BASE_LEVELS : [level];
}

/** Plausible numeric distractor range for a level. */
export function plausibleRangeOf(level: MathLevel): NumberRange {
  return level === MATH_LEVELS.mixed ? MIXED_PLAUSIBLE : BASE_LEVEL_SPECS[level].plausible;
}

/** A canonical addition: `a <= b`, `a + b = sum`. */
export interface OperandPair {
  readonly a: number;
  readonly b: number;
  readonly sum: number;
  readonly level: BaseMathLevel;
}

/** Every canonical operand pair of one base level, in ascending (a, b) order. */
export function canonicalPairs(level: BaseMathLevel): OperandPair[] {
  const spec = BASE_LEVEL_SPECS[level];
  const pairs: OperandPair[] = [];
  for (let a = spec.smaller.min; a <= spec.smaller.max; a += 1) {
    for (let b = Math.max(a, spec.larger.min); b <= spec.larger.max; b += 1) {
      if (a + b <= spec.maxSum) {
        pairs.push({ a, b, sum: a + b, level });
      }
    }
  }
  return pairs;
}

/** Every canonical pair a level draws from (the union for `mixed`). */
export function pairsOfLevel(level: MathLevel): OperandPair[] {
  return baseLevelsOf(level).flatMap(canonicalPairs);
}

/** Canonical display of an addition expression. */
export function formatExpression(a: number, b: number): string {
  return `${Math.min(a, b)} + ${Math.max(a, b)}`;
}

const EXPRESSION_PATTERN = /^\s*(\d+)\s*\+\s*(\d+)\s*$/;

/** Parse "a + b" (whole numbers); `undefined` when the text is not an addition. */
export function parseExpression(text: string): { readonly a: number; readonly b: number } | undefined {
  const match = EXPRESSION_PATTERN.exec(text);
  if (match === null) {
    return undefined;
  }
  return { a: Number(match[1]), b: Number(match[2]) };
}

/** Key identifying an unordered operand pair, so commuted forms collide. */
export function pairKey(a: number, b: number): string {
  return `${Math.min(a, b)}+${Math.max(a, b)}`;
}
