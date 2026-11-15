/**
 * Shared test fixtures for the shared-engine test suites.
 *
 * Decks are hand-authored by deterministic builders; nothing here generates game
 * content at runtime. Clinical-style fixtures use obviously fake placeholder text
 * ("Test Disease 1", "Test finding 1"): no clinical facts are invented. The only
 * real wording comes from the examples printed in master spec section 9.
 */

import { expect } from 'vitest';
import type {
  GeneratedDeck,
  GenerationDirection,
  PenaltyCardExhausted,
  PenaltyDrawResult,
  PenaltyDrawRequest,
  GeneratedChallenge,
  GeneratedAnswerCard,
  PenaltyReason,
} from '../src/index.js';

export type ContentStyle = 'math' | 'clinical';

/** Every (app style, generation direction) combination; both directions work for either app. */
export const COMBOS: ReadonlyArray<readonly [ContentStyle, GenerationDirection]> = [
  ['math', 'factToSubject'],
  ['math', 'subjectToFact'],
  ['clinical', 'subjectToFact'],
  ['clinical', 'factToSubject'],
];

export const comboName = (style: ContentStyle, direction: GenerationDirection): string =>
  `${style} / ${direction}`;

/** Display values are numeric (and compared numerically) only for Math fact -> subject. */
export const isNumericStyle = (style: ContentStyle, direction: GenerationDirection): boolean =>
  style === 'math' && direction === 'factToSubject';

export const defaultDirectionFor = (style: ContentStyle): GenerationDirection =>
  style === 'math' ? 'factToSubject' : 'subjectToFact';

export function promptText(style: ContentStyle, direction: GenerationDirection, i: number): string {
  if (style === 'math') {
    return direction === 'factToSubject' ? `${i + 1} + 9 = ?` : `Sum ${10 + i} — Addition`;
  }
  return direction === 'subjectToFact' ? `Test Disease ${i + 1} — Work-up` : `Test finding ${i + 1}`;
}

export function correctText(style: ContentStyle, direction: GenerationDirection, i: number): string {
  if (style === 'math') {
    return direction === 'factToSubject' ? `${10 + i}` : `${i + 1} + 9`;
  }
  return direction === 'subjectToFact' ? `Test finding ${i + 1}` : `Test Disease ${i + 1}`;
}

export function distractorText(style: ContentStyle, direction: GenerationDirection, j: number): string {
  if (style === 'math') {
    return direction === 'factToSubject' ? `${40 + j}` : `${40 + j} + 1`;
  }
  return direction === 'subjectToFact' ? `Test distractor ${j + 1}` : `Other test disease ${j + 1}`;
}

/** Writable copies, so tests can mutate a clone of a fixture. */
export interface MutableDeck {
  direction: GenerationDirection;
  challenges: Array<{
    id: string;
    promptText: string;
    correctAnswerCardId: string;
    sourceRef: { subjectId: string; topicId?: string };
  }>;
  answerCards: Array<{
    id: string;
    displayValue: string;
    explanationByChallengeId?: Record<string, string>;
  }>;
  meta: { targetCardCount: number; actualCardCount: number };
}

export type MutableMatrix = Record<string, Record<string, boolean>>;

export interface DeckSpec {
  readonly style: ContentStyle;
  readonly direction?: GenerationDirection;
  /** Number of challenges = number of correct cards. */
  readonly correct: number;
  readonly distractors: number;
  readonly target?: number;
}

/**
 * Build a valid deck: card ids `correct-i` / `distractor-j`, challenge ids
 * `challenge-i`, unique display values, and meta counts that match.
 */
export function buildDeck(spec: DeckSpec): MutableDeck {
  const direction = spec.direction ?? defaultDirectionFor(spec.style);
  const total = spec.correct + spec.distractors;
  return {
    direction,
    challenges: Array.from({ length: spec.correct }, (_, i) => ({
      id: `challenge-${i}`,
      promptText: promptText(spec.style, direction, i),
      correctAnswerCardId: `correct-${i}`,
      sourceRef: { subjectId: `${spec.style}.subject.test-${i}` },
    })),
    answerCards: [
      ...Array.from({ length: spec.correct }, (_, i) => ({
        id: `correct-${i}`,
        displayValue: correctText(spec.style, direction, i),
      })),
      ...Array.from({ length: spec.distractors }, (_, j) => ({
        id: `distractor-${j}`,
        displayValue: distractorText(spec.style, direction, j),
      })),
    ],
    meta: { targetCardCount: spec.target ?? total, actualCardCount: total },
  };
}

export function cloneDeck(deck: GeneratedDeck | MutableDeck): MutableDeck {
  return structuredClone(deck) as MutableDeck;
}

/** The complete, correct evaluation: each card is valid only for its own challenge. */
export function fullMatrix(deck: GeneratedDeck | MutableDeck): MutableMatrix {
  return Object.fromEntries(
    deck.challenges.map((challenge) => [
      challenge.id,
      Object.fromEntries(
        deck.answerCards.map((card) => [card.id, card.id === challenge.correctAnswerCardId]),
      ),
    ]),
  );
}

export function cloneMatrix(matrix: MutableMatrix): MutableMatrix {
  return structuredClone(matrix);
}

/** Deterministic pseudo-random numbers in [0, 1). */
export function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

export function shuffle<T>(items: readonly T[], random: () => number): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j] as T, copy[i] as T];
  }
  return copy;
}

/** Freeze a value deeply so any accidental mutation by the code under test throws. */
export function deepFreeze<T>(value: T): T {
  if (typeof value === 'object' && value !== null && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const inner of Object.values(value)) {
      deepFreeze(inner);
    }
  }
  return value;
}

/** All k-element combinations of `items`. */
export function combinations<T>(items: readonly T[], k: number): T[][] {
  const result: T[][] = [];
  const current: T[] = [];
  const walk = (start: number): void => {
    if (current.length === k) {
      result.push([...current]);
      return;
    }
    for (let i = start; i < items.length; i += 1) {
      current.push(items[i] as T);
      walk(i + 1);
      current.pop();
    }
  };
  walk(0);
  return result;
}

/** All orderings of `items`. */
export function permutations<T>(items: readonly T[]): T[][] {
  if (items.length <= 1) {
    return [[...items]];
  }
  return items.flatMap((item, index) =>
    permutations([...items.slice(0, index), ...items.slice(index + 1)]).map((rest) => [item, ...rest]),
  );
}

// ---- Penalty-draw helpers -------------------------------------------------

export const card = (id: string, value: string | number): GeneratedAnswerCard => ({
  id,
  displayValue: String(value),
});

export const challengeFor = (id: string, correctAnswerCardId: string): GeneratedChallenge => ({
  id,
  promptText: id,
  correctAnswerCardId,
  sourceRef: { subjectId: 'math.subject.test' },
});

export const request = (
  playerId: string,
  reason: PenaltyReason = 'INVALID_ACTION',
): PenaltyDrawRequest => ({ playerId, reason });

/** Narrow a penalty result to its exhaustion payload, failing the test otherwise. */
export function expectExhausted(result: PenaltyDrawResult): PenaltyCardExhausted {
  expect(result.ok).toBe(false);
  if (result.ok || !('exhausted' in result)) {
    throw new Error('expected a PENALTY_CARD_EXHAUSTED result');
  }
  return result.exhausted;
}

/** Narrow a penalty result to its success variant, failing the test otherwise. */
export function expectSupplied(result: PenaltyDrawResult): Extract<PenaltyDrawResult, { ok: true }> {
  expect(result.ok).toBe(true);
  if (!result.ok) {
    throw new Error('expected the penalty draw to be supplied');
  }
  return result;
}
