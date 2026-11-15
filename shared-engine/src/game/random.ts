/**
 * Deterministic, pure random numbers (Milestone M3, E1; decision D-1).
 *
 * There is NO mutable generator object. Randomness is an explicit 32-bit
 * `RngState` number that callers pass in and receive back, so the engine's
 * immutable state can carry it and the same seed plus the same request sequence
 * always reproduces the same game. Nothing here reads `Math.random`, the clock, or
 * module-level state.
 *
 * The step function is mulberry32. Independent streams for one game (dealing,
 * engine, Beepy) are derived from a series seed with `deriveSeed`, so using one
 * stream can never perturb another.
 *
 * Subject-neutral; no DOM/UI/framework dependency; no dependencies.
 */

/** The complete state of one random stream: an unsigned 32-bit integer. */
export type RngState = number;

/** Independent random streams used by one game. */
export type RngStream = 'deal' | 'engine' | 'beepy';

/** Coerce any finite number into a valid `RngState`. Non-finite values become 0. */
export function toRngState(seed: number): RngState {
  return Number.isFinite(seed) ? Math.trunc(seed) >>> 0 : 0;
}

/** Advance one step. Returns the next 32-bit value and the new state. */
export function nextUint32(rng: RngState): readonly [number, RngState] {
  const state = (toRngState(rng) + 0x6d2b79f5) >>> 0;
  let t = state;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return [(t ^ (t >>> 14)) >>> 0, state];
}

/** A float in [0, 1). */
export function nextFloat(rng: RngState): readonly [number, RngState] {
  const [value, next] = nextUint32(rng);
  return [value / 4294967296, next];
}

/**
 * An unbiased integer in [0, bound) using rejection sampling.
 * `bound` must be a whole number from 1 to 2^32.
 */
export function nextInt(rng: RngState, bound: number): readonly [number, RngState] {
  if (!Number.isSafeInteger(bound) || bound < 1 || bound > 4294967296) {
    throw new RangeError(`bound must be a whole number from 1 to 2^32; got ${String(bound)}.`);
  }
  const limit = Math.floor(4294967296 / bound) * bound;
  let state = rng;
  for (;;) {
    const [value, next] = nextUint32(state);
    state = next;
    if (value < limit) {
      return [value % bound, state];
    }
  }
}

/** Fisher-Yates shuffle. Returns a new array; the input is never modified. */
export function shuffle<T>(items: readonly T[], rng: RngState): readonly [T[], RngState] {
  const copy = [...items];
  let state = rng;
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const [j, next] = nextInt(state, i + 1);
    state = next;
    const a = copy[i] as T;
    copy[i] = copy[j] as T;
    copy[j] = a;
  }
  return [copy, state];
}

/**
 * Derive an independent stream seed from a series seed, a game index, and a stream
 * name. Pure: the same inputs always give the same result.
 */
export function deriveSeed(seed: number, gameIndex: number, stream: RngStream): RngState {
  let h = 2166136261 >>> 0;
  const mix = (value: number): void => {
    h = Math.imul(h ^ (value & 0xff), 16777619) >>> 0;
    h = Math.imul(h ^ ((value >>> 8) & 0xff), 16777619) >>> 0;
    h = Math.imul(h ^ ((value >>> 16) & 0xff), 16777619) >>> 0;
    h = Math.imul(h ^ ((value >>> 24) & 0xff), 16777619) >>> 0;
  };
  mix(toRngState(seed));
  mix(toRngState(gameIndex));
  for (let i = 0; i < stream.length; i += 1) {
    mix(stream.charCodeAt(i));
  }
  return nextUint32(h)[0];
}
