/**
 * Dealing and card handles (Milestone M3, E3; requirement 1.4, 1.7-1.9).
 *
 * `dealHands` chooses each starting hand from a deck that already passed the
 * initialization gate: five distinct cards with two or three designated-correct
 * cards, hands that do not overlap, the rest shuffled into the draw pile. The hand
 * is shuffled so its order never reveals which cards are correct. Every choice uses
 * the explicit `RngState`, so the result is a pure function of the seed.
 *
 * The result is re-validated with the M2 validators (`validateStartingHand`,
 * `validateDualStartingHands`, and `validateUniqueness` over the dealt zones). A
 * failure is reported and never repaired.
 *
 * Handles are opaque tokens drawn from the engine random stream. They are not
 * derived from deck ids, deck order, or correctness, and a handle minted later (a
 * penalty fallback card) looks the same as one minted at deal time.
 */

import type { GeneratedDeck } from '../generated-deck.js';
import { validateStartingHand, STARTING_HAND_SIZE } from '../starting-hand.js';
import { validateDualStartingHands } from '../dual-hand.js';
import { validateUniqueness } from '../uniqueness.js';
import { MIN_PENALTY_RESERVE } from '../dual-hand.js';
import type { DeckValidationIssue } from '../deck-issues.js';
import { nextInt, nextUint32, shuffle, type RngState } from './random.js';
import { ENGINE_MODES, type EngineMode, type PlayerId, type SetupIssue } from './types.js';

export interface DealResult {
  readonly ok: true;
  readonly hands: Readonly<Record<PlayerId, readonly string[]>>;
  readonly drawPile: readonly string[];
  readonly rng: RngState;
}

export interface DealFailure {
  readonly ok: false;
  readonly issues: readonly SetupIssue[];
}

const dealIssue = (issue: DeckValidationIssue): SetupIssue => ({
  stage: 'deal',
  code: issue.code,
  message: issue.message,
  path: issue.path,
});

/** All vectors in {2,3}^handCount, as arrays. */
function correctCountVectors(handCount: number): number[][] {
  let vectors: number[][] = [[]];
  for (let i = 0; i < handCount; i += 1) {
    vectors = vectors.flatMap((vector) => [
      [...vector, 2],
      [...vector, 3],
    ]);
  }
  return vectors;
}

/** Deal the starting hand(s) and the draw pile. */
export function dealHands(
  deck: GeneratedDeck,
  mode: EngineMode,
  rng: RngState,
  numericAnswers: boolean,
): DealResult | DealFailure {
  const handCount = mode === ENGINE_MODES.vsBeepy ? 2 : 1;
  const correctIds = [...new Set(deck.challenges.map((challenge) => challenge.correctAnswerCardId))];
  const correctSet = new Set(correctIds);
  const distractorIds = [
    ...new Set(deck.answerCards.map((card) => card.id).filter((id) => !correctSet.has(id))),
  ];

  // How many correct cards each hand holds, keeping the other hand and the penalty
  // reserve feasible.
  const feasible = correctCountVectors(handCount).filter((vector) => {
    const total = vector.reduce((a, b) => a + b, 0);
    return (
      total <= correctIds.length &&
      STARTING_HAND_SIZE * handCount - total + MIN_PENALTY_RESERVE <= distractorIds.length
    );
  });
  if (feasible.length === 0) {
    return {
      ok: false,
      issues: [
        {
          stage: 'deal',
          code: 'DEAL_INFEASIBLE',
          message: 'The deck cannot supply the required starting hands and penalty reserve.',
          path: 'answerCards',
        },
      ],
    };
  }

  let state = rng;
  const [pick, afterPick] = nextInt(state, feasible.length);
  state = afterPick;
  const vector = feasible[pick] as number[];

  const [shuffledCorrect, afterCorrect] = shuffle(correctIds, state);
  const [shuffledDistractors, afterDistractors] = shuffle(distractorIds, afterCorrect);
  state = afterDistractors;

  const hands: string[][] = [];
  for (const wanted of vector) {
    const chosen = [
      ...shuffledCorrect.splice(0, wanted),
      ...shuffledDistractors.splice(0, STARTING_HAND_SIZE - wanted),
    ];
    const [ordered, afterHand] = shuffle(chosen, state);
    state = afterHand;
    hands.push(ordered);
  }

  const [drawPile, afterPile] = shuffle([...shuffledCorrect, ...shuffledDistractors], state);
  state = afterPile;

  const human = hands[0] as string[];
  const beepy = hands[1] ?? [];

  // Re-validate the deal with the M2 validators. Nothing is repaired.
  const issues: SetupIssue[] = [];
  const options = { numericAnswers };
  if (mode === ENGINE_MODES.vsBeepy) {
    issues.push(...validateDualStartingHands(deck, [human, beepy], options).issues.map(dealIssue));
  } else {
    issues.push(...validateStartingHand(deck, human, options).issues.map(dealIssue));
  }
  issues.push(
    ...validateUniqueness(deck, {
      numericAnswers,
      zones: {
        human,
        ...(mode === ENGINE_MODES.vsBeepy ? { beepy } : {}),
        drawPile,
        played: [],
        discard: [],
      },
    }).issues.map(dealIssue),
  );
  if (issues.length > 0) {
    return { ok: false, issues };
  }

  return { ok: true, hands: { human, beepy }, drawPile, rng: state };
}

/** Mint a handle that is not already taken, from the engine random stream. */
export function mintHandle(
  taken: Readonly<Record<string, string>>,
  rng: RngState,
): readonly [string, RngState] {
  let state = rng;
  for (;;) {
    const [value, next] = nextUint32(state);
    state = next;
    const handle = `h${value.toString(36).padStart(7, '0')}`;
    if (!Object.hasOwn(taken, handle)) {
      return [handle, state];
    }
  }
}

/** Assign a unique opaque handle to each card id. */
export function assignHandles(
  cardIds: readonly string[],
  rng: RngState,
): {
  readonly handleByCard: Record<string, string>;
  readonly cardByHandle: Record<string, string>;
  readonly rng: RngState;
} {
  const handleByCard: Record<string, string> = {};
  const cardByHandle: Record<string, string> = {};
  let state = rng;
  for (const id of cardIds) {
    let handle: string;
    [handle, state] = mintHandle(cardByHandle, state);
    handleByCard[id] = handle;
    cardByHandle[handle] = id;
  }
  return { handleByCard, cardByHandle, rng: state };
}
