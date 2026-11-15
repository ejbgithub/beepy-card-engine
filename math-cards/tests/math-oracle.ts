/**
 * Independent arithmetic oracle for the M4 generator tests.
 *
 * Owner instruction: expected distractor counts and contextual validity must NOT be
 * computed with the selection logic under test. This file therefore imports nothing
 * from `math-cards/src`. It restates the approved level table from the M4 design
 * (decision M4-2), enumerates operand pairs with its own loops, and reads sums back
 * from prompt and card TEXT, not from generator internals.
 */

export type Level = 'oneDigit' | 'oneAndTwoDigit' | 'twoDigit' | 'mixed';
export type Direction = 'factToSubject' | 'subjectToFact';
export type Mode = 'solitaire' | 'vsBeepy';

export const LEVELS: readonly Level[] = ['oneDigit', 'oneAndTwoDigit', 'twoDigit', 'mixed'];
export const DIRECTIONS: readonly Direction[] = ['factToSubject', 'subjectToFact'];
export const MODES: readonly Mode[] = ['solitaire', 'vsBeepy'];

/** The approved table, restated (design "Difficulty levels"). */
export const SPEC = {
  oneDigit: { smaller: [1, 9], larger: [1, 9], cap: 18, plausible: [1, 20] },
  oneAndTwoDigit: { smaller: [1, 9], larger: [10, 89], cap: 99, plausible: [10, 99] },
  twoDigit: { smaller: [10, 89], larger: [10, 89], cap: 99, plausible: [20, 99] },
} as const;
export const MIXED_PLAUSIBLE = [1, 99] as const;

type Base = keyof typeof SPEC;
const BASES: readonly Base[] = ['oneDigit', 'oneAndTwoDigit', 'twoDigit'];

export const challengeCountFor = (mode: Mode): number => (mode === 'vsBeepy' ? 9 : 5);
export const defaultTargetFor = (mode: Mode): number => (mode === 'vsBeepy' ? 24 : 15);

const pairCache = new Map<Base, Array<readonly [number, number]>>();

/** Every unordered operand pair {x, y} (x <= y) allowed by a base level. */
export function oraclePairs(base: Base): Array<readonly [number, number]> {
  const cached = pairCache.get(base);
  if (cached !== undefined) return cached;
  const out = computePairs(base);
  pairCache.set(base, out);
  return out;
}

function computePairs(base: Base): Array<readonly [number, number]> {
  const spec = SPEC[base];
  const out: Array<readonly [number, number]> = [];
  for (let x = 1; x <= 99; x += 1) {
    for (let y = x; y <= 99; y += 1) {
      const fits =
        (x >= spec.smaller[0] && x <= spec.smaller[1] && y >= spec.larger[0] && y <= spec.larger[1]) ||
        (y >= spec.smaller[0] && y <= spec.smaller[1] && x >= spec.larger[0] && x <= spec.larger[1]);
      if (fits && x + y <= spec.cap) out.push([x, y]);
    }
  }
  return out;
}

export function oraclePairsOfLevel(level: Level): Array<readonly [number, number]> {
  return level === 'mixed' ? BASES.flatMap(oraclePairs) : oraclePairs(level);
}

export function plausibleOf(level: Level): readonly [number, number] {
  return level === 'mixed' ? MIXED_PLAUSIBLE : SPEC[level].plausible;
}

/** Which base level(s) a pair could belong to. */
export function basesOfPair(x: number, y: number): Base[] {
  const [a, b] = x <= y ? [x, y] : [y, x];
  return BASES.filter((base) => oraclePairs(base).some(([p, q]) => p === a && q === b));
}

/** Parse "a + b" written by anyone; undefined otherwise. */
export function parsePair(text: string): readonly [number, number] | undefined {
  const m = /^(\d+) \+ (\d+)$/.exec(text);
  return m === null ? undefined : [Number(m[1]), Number(m[2])];
}

/** The sum a challenge asks for, read from its prompt text only. */
export function promptSum(prompt: string, direction: Direction): number {
  if (direction === 'factToSubject') {
    const m = /^(\d+) \+ (\d+) = \?$/.exec(prompt);
    if (m === null) throw new Error(`unexpected factToSubject prompt: ${prompt}`);
    return Number(m[1]) + Number(m[2]);
  }
  const m = /^Which addition expression equals (\d+)\?$/.exec(prompt);
  if (m === null) throw new Error(`unexpected subjectToFact prompt: ${prompt}`);
  return Number(m[1]);
}

/** The number a card represents, read from its face only. */
export function cardNumber(display: string, direction: Direction): number | undefined {
  if (direction === 'factToSubject') {
    return /^\d+$/.test(display) ? Number(display) : undefined;
  }
  const pair = parsePair(display);
  return pair === undefined ? undefined : pair[0] + pair[1];
}

/** Size of the eligible distractor pool for a set of active sums. */
export function oraclePool(level: Level, direction: Direction, sums: readonly number[]): Array<{ display: string; value: number }> {
  const active = new Set(sums);
  if (direction === 'factToSubject') {
    const [lo, hi] = plausibleOf(level);
    const out: Array<{ display: string; value: number }> = [];
    for (let v = lo; v <= hi; v += 1) if (!active.has(v)) out.push({ display: String(v), value: v });
    return out;
  }
  return oraclePairsOfLevel(level)
    .filter(([x, y]) => !active.has(x + y))
    .map(([x, y]) => ({ display: `${x} + ${y}`, value: x + y }));
}

/** Near-miss tier, restated from the design, for an oracle candidate. */
export function oracleTier(value: number, sums: readonly number[], direction: Direction): 1 | 2 | 3 {
  const d = Math.min(...sums.map((s) => Math.abs(s - value)));
  if (d === 1) return 1;
  if (d === 2) return 2;
  if (direction === 'factToSubject' && sums.some((s) => s >= 10 && Math.abs(s - value) === 10)) return 2;
  return 3;
}

/**
 * Expected deck size under the M2 planner rule for an adequate pool: one correct
 * card per challenge plus as many distractors as both the target and the pool allow.
 */
export function expectedSize(mode: Mode, target: number, pool: number): number {
  const n = challengeCountFor(mode);
  return n + Math.min(target - n, pool);
}
