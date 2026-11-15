/**
 * Test helpers for the M5 UI tests.
 *
 * The test "player" chooses moves the way a child would: by doing the arithmetic on
 * the text it can see (prompts and card faces), using the independent oracle in
 * `math-oracle.ts`. It never reads a deck or engine state.
 */

import type { PlayerView } from '@beepy/shared-engine';
import { createMathSeries, type MathSeries, type MathSeriesConfig } from '../src/math-series.js';
import { cardNumber, promptSum, type Direction } from './math-oracle.js';

export type HumanRequest =
  | { readonly kind: 'play'; readonly handle: string; readonly challengeId: string }
  | { readonly kind: 'discard'; readonly handle: string };

export function seriesFor(config: MathSeriesConfig): MathSeries {
  const created = createMathSeries(config);
  if (!created.ok) throw new Error(`series: ${created.error.code}`);
  return created.series;
}

export const directionOf = (view: PlayerView): Direction =>
  view.challenges[0]!.promptText.startsWith('Which addition expression') ? 'subjectToFact' : 'factToSubject';

/** Open challenges by their sum, read from prompt text. */
export function openSums(view: PlayerView): Map<number, string> {
  const direction = directionOf(view);
  return new Map(view.challenges.filter((c) => c.status === 'open').map((c) => [promptSum(c.promptText, direction), c.id]));
}

const valueOf = (view: PlayerView, face: string): number => cardNumber(face, directionOf(view))!;

/** A valid play if one exists, else a valid discard. */
export function validAction(view: PlayerView): HumanRequest {
  const open = openSums(view);
  for (const card of view.hand) {
    const target = open.get(valueOf(view, card.displayValue));
    if (target !== undefined) return { kind: 'play', handle: card.handle, challengeId: target };
  }
  const card = view.hand.find((c) => !open.has(valueOf(view, c.displayValue)))!;
  return { kind: 'discard', handle: card.handle };
}

/** A valid discard, if the hand has a card that answers no open problem. */
export function validDiscard(view: PlayerView): HumanRequest | undefined {
  const open = openSums(view);
  const card = view.hand.find((c) => !open.has(valueOf(view, c.displayValue)));
  return card === undefined ? undefined : { kind: 'discard', handle: card.handle };
}

/** A valid play, if one exists. */
export function validPlay(view: PlayerView): HumanRequest | undefined {
  const open = openSums(view);
  for (const card of view.hand) {
    const target = open.get(valueOf(view, card.displayValue));
    if (target !== undefined) return { kind: 'play', handle: card.handle, challengeId: target };
  }
  return undefined;
}

/** An invalid action: discard a needed card, or play a card on the wrong problem. */
export function invalidAction(view: PlayerView): HumanRequest {
  const open = openSums(view);
  const correct = view.hand.find((c) => open.has(valueOf(view, c.displayValue)));
  if (correct !== undefined) return { kind: 'discard', handle: correct.handle };
  return { kind: 'play', handle: view.hand[0]!.handle, challengeId: [...open.values()][0]! };
}

/** Would Beepy's pending move be valid? (Oracle; decided from visible text only.) */
export function pendingValid(view: PlayerView): boolean {
  const p = view.pending!;
  const value = valueOf(view, p.card.displayValue);
  const open = openSums(view);
  if (p.kind === 'play') return open.get(value) === p.destination;
  return !open.has(value);
}
