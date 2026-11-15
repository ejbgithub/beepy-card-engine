/**
 * Beepy as a player: a replaceable strategy (Milestone M3, E11; decision D-2;
 * requirement 6.5).
 *
 * A strategy only PROPOSES an action. It never decides a ruling and never touches
 * engine state. It receives:
 *   - Beepy's own hand (opaque handles and faces),
 *   - the ids of the open challenges,
 *   - a read-only `judge(kind, handle, challengeId?)` backed by the authoritative
 *     engine judge,
 *   - an explicit `RngState`,
 * and returns an action plus the advanced `RngState`. The authoritative judge then
 * rules on the action like any other; a Beepy mistake never changes a ruling.
 *
 * The reference strategy uses a configurable error rate in [0, 1]. With probability
 * `errorRate` it proposes a legal but invalid action (a "plausible mistake": a wrong
 * play or a discard of a needed card); otherwise a valid play, or a valid discard if
 * no valid play exists. If the wanted class is empty it uses the other class. It
 * never proposes an illegal request.
 *
 * Note: with `errorRate = 1` and every penalty waived (pile and fallback exhausted),
 * Beepy would never make progress. The engine has no turn cap (owner decision), so
 * apps should use a rate below 1.
 */

import { judgeAction, openChallengeIds } from './judge.js';
import { nextFloat, nextInt, type RngState } from './random.js';
import {
  ENGINE_ERROR_CODES as E,
  failure,
  type ActionKind,
  type ActionRequest,
  type EngineState,
  type Failure,
} from './types.js';

/** What a strategy is allowed to see. No correctness data, no other hands. */
export interface BeepyStrategyInput {
  readonly hand: readonly { readonly handle: string; readonly displayValue: string }[];
  readonly openChallengeIds: readonly string[];
  /** Read-only access to the authoritative judge for Beepy's own cards. */
  readonly judge: (kind: ActionKind, handle: string, challengeId?: string) => boolean;
}

export interface BeepyChoice {
  readonly action: ActionRequest;
  readonly rng: RngState;
}

/** A replaceable source of Beepy actions. */
export interface BeepyStrategy {
  chooseAction(input: BeepyStrategyInput, rng: RngState): BeepyChoice;
}

export interface ReferenceStrategyConfig {
  /** Probability of a deliberate, plausible mistake. A number from 0 to 1. */
  readonly errorRate: number;
}

/** Build the strategy input for Beepy from engine state (engine-internal). */
export function beepyStrategyInput(state: EngineState): BeepyStrategyInput {
  const hand = state.hands.beepy.map((cardId) => ({
    handle: state.handleByCard[cardId] as string,
    displayValue: (state.cards[cardId] as { displayValue: string }).displayValue,
  }));
  const owned = new Set(hand.map((card) => card.handle));
  return {
    hand,
    openChallengeIds: openChallengeIds(state),
    judge: (kind, handle, challengeId) => {
      const cardId = owned.has(handle) ? state.cardByHandle[handle] : undefined;
      return cardId !== undefined && judgeAction(state, kind, cardId, challengeId);
    },
  };
}

interface Option {
  readonly kind: ActionKind;
  readonly handle: string;
  readonly challengeId?: string;
}

const toRequest = (option: Option): ActionRequest => ({
  player: 'beepy',
  kind: option.kind,
  handle: option.handle,
  ...(option.challengeId === undefined ? {} : { challengeId: option.challengeId }),
});

/** Create the reference strategy, or a failure for an invalid error rate. */
export function createReferenceBeepyStrategy(
  config: ReferenceStrategyConfig,
): { readonly ok: true; readonly strategy: BeepyStrategy } | Failure {
  const rate = config?.errorRate;
  if (typeof rate !== 'number' || !Number.isFinite(rate) || rate < 0 || rate > 1) {
    return failure(E.invalidOption, 'errorRate must be a number from 0 to 1.');
  }
  const strategy: BeepyStrategy = {
    chooseAction(input, rng) {
      const validPlays: Option[] = [];
      const validDiscards: Option[] = [];
      const invalid: Option[] = [];
      for (const card of input.hand) {
        for (const challengeId of input.openChallengeIds) {
          const option: Option = { kind: 'play', handle: card.handle, challengeId };
          (input.judge('play', card.handle, challengeId) ? validPlays : invalid).push(option);
        }
        const discard: Option = { kind: 'discard', handle: card.handle };
        (input.judge('discard', card.handle) ? validDiscards : invalid).push(discard);
      }

      const [roll, afterRoll] = nextFloat(rng);
      const valid = validPlays.length > 0 ? validPlays : validDiscards;
      const wantMistake = roll < rate;
      const pool = wantMistake ? (invalid.length > 0 ? invalid : valid) : valid.length > 0 ? valid : invalid;
      if (pool.length === 0) {
        throw new RangeError('Beepy has no card to act with.');
      }
      const [index, afterIndex] = nextInt(afterRoll, pool.length);
      return { action: toRequest(pool[index] as Option), rng: afterIndex };
    },
  };
  return { ok: true, strategy };
}
