/**
 * The pure game core (Milestone M3, E2-E10).
 *
 * Every function takes an immutable `EngineState` and returns a NEW state plus the
 * private events it produced, or a structured failure. A failure never changes
 * state (the caller keeps the old one), including its random streams. Nothing here
 * is exported from the package index: the trusted controller (controller.ts) is the
 * only holder of an `EngineState`.
 *
 * Resolution order for every judged action (requirement 7.2):
 *   1. move cards for the judged action,
 *   2. count the turn,
 *   3. END-OF-GAME CHECK; if the game ended, stop: NO penalty draw is applied,
 *   4. apply the owed penalty event (atomic; waived on exhaustion),
 *   5. safety re-check,
 *   6. advance the active player.
 */

import type { GeneratedAnswerCard, GeneratedDeck } from '../generated-deck.js';
import type { ContextualValidityMap } from '../challenge-mapping.js';
import { assignHandles, dealHands } from './deal.js';
import { resolveMode, validateDeckForPlay } from './deck-gate.js';
import { checkRequest, judgeAction } from './judge.js';
import { applyPenaltyEvent } from './penalty.js';
import { deriveSeed } from './random.js';
import { beepyStrategyInput, type BeepyStrategy } from './beepy-strategy.js';
import {
  competitivePenalties,
  decideCompetitiveEnd,
  firstPlayerForGame,
  otherPlayer,
} from './competitive.js';
import { solitaireOutcome, solitairePenalties } from './solitaire.js';
import {
  EMPTY_STATS,
  ENGINE_ERROR_CODES as E,
  ENGINE_MODES,
  failure,
  type ActionKind,
  type ActionRequest,
  type Decision,
  type EngineEvent,
  type EngineState,
  type GameOptions,
  type GameOutcome,
  type OwedPenalty,
  type PlayerId,
  type PlayerStats,
  type StepResult,
} from './types.js';

/** Input for starting one game. Everything is validated; nothing is trusted. */
export interface CreateGameInput {
  readonly mode: unknown;
  readonly deck: unknown;
  readonly contextualValidity: unknown;
  /** Series seed; the game's streams derive from it and `gameIndex`. */
  readonly seed: number;
  /** 1-based game number within its session or match (default 1). */
  readonly gameIndex?: number;
  readonly options?: GameOptions;
}

/** Validate the option values the engine reads. */
function checkOptions(options: GameOptions): string | undefined {
  if (options.numericAnswers !== undefined && typeof options.numericAnswers !== 'boolean') {
    return 'options.numericAnswers must be a boolean.';
  }
  if (
    options.maxPenaltyCandidates !== undefined &&
    !(Number.isSafeInteger(options.maxPenaltyCandidates) && options.maxPenaltyCandidates >= 1)
  ) {
    return 'options.maxPenaltyCandidates must be a positive whole number.';
  }
  return undefined;
}

/** Start a game: gate the deck, deal, assign handles. */
export function createGameState(input: CreateGameInput): StepResult {
  const mode = resolveMode(input.mode);
  if (typeof mode !== 'string') {
    return mode;
  }
  const options = input.options ?? {};
  const optionProblem = checkOptions(options);
  if (optionProblem !== undefined) {
    return failure(E.invalidOption, optionProblem);
  }
  const gameIndex = input.gameIndex ?? 1;
  if (!Number.isSafeInteger(gameIndex) || gameIndex < 1) {
    return failure(E.invalidOption, 'gameIndex must be a positive whole number.');
  }

  const issues = validateDeckForPlay(input.deck, mode, input.contextualValidity, {
    numericAnswers: options.numericAnswers === true,
  });
  if (issues.length > 0) {
    return failure(
      E.gameSetupInvalid,
      `The deck cannot be played: ${issues.length} issue(s) found. Nothing was dealt.`,
      issues,
    );
  }

  const deck = input.deck as GeneratedDeck;
  const dealt = dealHands(
    deck,
    mode,
    deriveSeed(input.seed, gameIndex, 'deal'),
    options.numericAnswers === true,
  );
  if (!dealt.ok) {
    return failure(
      E.gameSetupInvalid,
      `The dealt hands failed validation: ${dealt.issues.length} issue(s) found.`,
      dealt.issues,
    );
  }

  const handles = assignHandles(
    deck.answerCards.map((card) => card.id),
    deriveSeed(input.seed, gameIndex, 'engine'),
  );
  const cards: Record<string, GeneratedAnswerCard> = {};
  for (const card of deck.answerCards) {
    cards[card.id] = card;
  }

  const firstPlayer: PlayerId =
    mode === ENGINE_MODES.vsBeepy ? firstPlayerForGame(gameIndex) : 'human';
  const dealtEvent: EngineEvent = {
    type: 'GAME_DEALT',
    gameIndex,
    mode,
    firstPlayer,
    hands: { human: dealt.hands.human, beepy: dealt.hands.beepy },
    drawPile: dealt.drawPile,
  };

  const state: EngineState = {
    mode,
    gameIndex,
    firstPlayer,
    phase: 'awaitingAction',
    activePlayer: firstPlayer,
    turnCount: 0,
    deck,
    contextualValidity: input.contextualValidity as ContextualValidityMap,
    options,
    cards,
    handleByCard: handles.handleByCard,
    cardByHandle: handles.cardByHandle,
    hands: { human: dealt.hands.human, beepy: dealt.hands.beepy },
    drawPile: dealt.drawPile,
    discard: [],
    played: {},
    solvedBy: {},
    stats: { human: EMPTY_STATS, beepy: EMPTY_STATS },
    history: [dealtEvent],
    rng: handles.rng,
    beepyRng: deriveSeed(input.seed, gameIndex, 'beepy'),
  };
  return { ok: true, state, events: [dealtEvent] };
}

/** Submit a play or discard. */
export function submitAction(state: EngineState, request: ActionRequest): StepResult {
  const checked = checkRequest(state, request);
  if (!checked.ok) {
    return checked;
  }
  const submitted: EngineEvent = {
    type: 'ACTION_SUBMITTED',
    turn: state.turnCount + 1,
    player: request.player,
    kind: request.kind,
    cardId: checked.cardId,
    ...(request.challengeId === undefined ? {} : { challengeId: request.challengeId }),
  };

  // A Beepy action waits for the human's decision; everything else resolves now.
  if (state.mode === ENGINE_MODES.vsBeepy && request.player === 'beepy') {
    const pending = {
      player: request.player,
      kind: request.kind,
      cardId: checked.cardId,
      ...(request.challengeId === undefined ? {} : { challengeId: request.challengeId }),
    };
    return {
      ok: true,
      state: {
        ...state,
        phase: 'awaitingEvaluation',
        pending,
        history: [...state.history, submitted],
      },
      events: [submitted],
    };
  }

  return resolve(
    state,
    {
      player: request.player,
      kind: request.kind,
      cardId: checked.cardId,
      ...(request.challengeId === undefined ? {} : { challengeId: request.challengeId }),
    },
    undefined,
    [submitted],
  );
}

/** A valid `RngState`: a whole number from 0 to 2^32 - 1. */
const isRngState = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 0xffffffff;

/**
 * Ask a Beepy strategy for an action and submit it. The strategy sees only
 * `beepyStrategyInput` and its own random stream. The strategy is untrusted: its
 * result is read once inside a guard and copied into a plain request, and a
 * malformed result (not an object, a bad action, or an RNG state that is not a whole
 * number from 0 to 2^32 - 1) is a structured `STRATEGY_RESULT_INVALID` failure. The
 * advanced `beepyRng` is stored only if the action is accepted as a legal request;
 * on any failure the original state, including every random stream, is unchanged.
 */
export function advanceBeepy(state: EngineState, strategy: BeepyStrategy): StepResult {
  if (state.phase === 'ended') {
    return failure(E.gameEnded, 'The game has ended.');
  }
  if (state.mode !== ENGINE_MODES.vsBeepy) {
    return failure(E.playerNotInMode, 'Beepy only plays in vsBeepy.');
  }
  if (state.phase !== 'awaitingAction') {
    return failure(E.wrongPhase, 'An action is already waiting to be evaluated.');
  }
  if (state.activePlayer !== 'beepy') {
    return failure(E.notPlayersTurn, "It is not Beepy's turn.");
  }
  let request: ActionRequest;
  let nextRng: unknown;
  try {
    const choice: unknown = strategy.chooseAction(beepyStrategyInput(state), state.beepyRng);
    if (typeof choice !== 'object' || choice === null) {
      return failure(E.strategyResultInvalid, 'The Beepy strategy did not return an action.');
    }
    const { action, rng } = choice as { action?: unknown; rng?: unknown };
    nextRng = rng;
    if (typeof action !== 'object' || action === null) {
      return failure(E.strategyResultInvalid, 'The Beepy strategy returned no action.');
    }
    const { player, kind, handle, challengeId } = action as Record<string, unknown>;
    if (player !== 'beepy') {
      return failure(E.playerNotInMode, 'A Beepy strategy may only act for Beepy.');
    }
    if (typeof handle !== 'string' || (challengeId !== undefined && typeof challengeId !== 'string')) {
      return failure(E.strategyResultInvalid, 'The Beepy strategy returned a malformed action.');
    }
    request = {
      player: 'beepy',
      kind: kind as ActionRequest['kind'],
      handle,
      ...(challengeId === undefined ? {} : { challengeId: challengeId as string }),
    };
  } catch (error) {
    return failure(E.engineFault, `The Beepy strategy failed: ${String(error)}`);
  }
  if (!isRngState(nextRng)) {
    return failure(
      E.strategyResultInvalid,
      'The Beepy strategy returned an invalid random state; it must be a whole number from 0 to 2^32 - 1.',
    );
  }
  const submitted = submitAction(state, request);
  if (!submitted.ok) {
    return submitted;
  }
  return { ...submitted, state: { ...submitted.state, beepyRng: nextRng } };
}

/** The human accepts or challenges the pending Beepy action. */
export function evaluatePending(state: EngineState, decision: Decision): StepResult {
  if (state.phase === 'ended') {
    return failure(E.gameEnded, 'The game has ended.');
  }
  if (state.phase !== 'awaitingEvaluation' || state.pending === undefined) {
    return failure(E.wrongPhase, 'There is no pending action to evaluate.');
  }
  if (decision !== 'accept' && decision !== 'challenge') {
    return failure(E.invalidDecision, 'The decision must be "accept" or "challenge".');
  }
  return resolve(state, state.pending, decision, []);
}

interface Resolving {
  readonly player: PlayerId;
  readonly kind: ActionKind;
  readonly cardId: string;
  readonly challengeId?: string;
}

function bump(stats: PlayerStats, kind: ActionKind, valid: boolean): PlayerStats {
  return {
    turns: stats.turns + 1,
    correctPlays: stats.correctPlays + (kind === 'play' && valid ? 1 : 0),
    incorrectPlays: stats.incorrectPlays + (kind === 'play' && !valid ? 1 : 0),
    correctDiscards: stats.correctDiscards + (kind === 'discard' && valid ? 1 : 0),
    incorrectDiscards: stats.incorrectDiscards + (kind === 'discard' && !valid ? 1 : 0),
  };
}

function endOutcome(
  state: EngineState,
  hands: Readonly<Record<PlayerId, readonly string[]>>,
  solvedBy: Readonly<Record<string, PlayerId>>,
  turns: number,
): GameOutcome | undefined | 'fault' {
  const solvedCount = Object.keys(solvedBy).length;
  const challengeCount = state.deck.challenges.length;
  if (state.mode === ENGINE_MODES.solitaire) {
    return solitaireOutcome({ handCount: hands.human.length, solvedCount, challengeCount, turns });
  }
  const credits: Record<PlayerId, number> = { human: 0, beepy: 0 };
  for (const who of Object.values(solvedBy)) {
    credits[who] += 1;
  }
  const result = decideCompetitiveEnd({
    handCounts: { human: hands.human.length, beepy: hands.beepy.length },
    credits,
    allSolved: solvedCount === challengeCount,
  });
  if (result.kind === 'fault') {
    return 'fault';
  }
  return result.kind === 'ended' ? result.outcome : undefined;
}

function resolve(
  state: EngineState,
  action: Resolving,
  decision: Decision | undefined,
  preEvents: readonly EngineEvent[],
): StepResult {
  const valid = judgeAction(state, action.kind, action.cardId, action.challengeId);
  const turn = state.turnCount + 1;
  const events: EngineEvent[] = [...preEvents];

  // 1. Move cards for the judged action.
  const hands: Record<PlayerId, readonly string[]> = {
    human: state.hands.human,
    beepy: state.hands.beepy,
  };
  const played: Record<string, string> = { ...state.played };
  const solvedBy: Record<string, PlayerId> = { ...state.solvedBy };
  let discard = state.discard;

  events.push({
    type: 'ACTION_RESOLVED',
    turn,
    player: action.player,
    kind: action.kind,
    cardId: action.cardId,
    ...(action.challengeId === undefined ? {} : { challengeId: action.challengeId }),
    valid,
    ...(decision === undefined ? {} : { decision }),
  });

  if (valid) {
    hands[action.player] = hands[action.player].filter((id) => id !== action.cardId);
    if (action.kind === 'play' && action.challengeId !== undefined) {
      played[action.challengeId] = action.cardId;
      solvedBy[action.challengeId] = action.player;
      const challenge = state.deck.challenges.find((c) => c.id === action.challengeId);
      if (challenge !== undefined) {
        events.push({
          type: 'CHALLENGE_SOLVED',
          challengeId: challenge.id,
          cardId: action.cardId,
          solvedBy: action.player,
          sourceRef: challenge.sourceRef,
        });
      }
    } else {
      discard = [...discard, action.cardId];
      events.push({ type: 'CARD_DISCARDED', cardId: action.cardId, by: action.player });
    }
  }

  // 2. Count the turn.
  events.push({ type: 'TURN_COUNTED', turn });
  const stats: Record<PlayerId, PlayerStats> = {
    human: state.stats.human,
    beepy: state.stats.beepy,
  };
  stats[action.player] = bump(stats[action.player], action.kind, valid);

  const owed: OwedPenalty[] =
    state.mode === ENGINE_MODES.solitaire
      ? solitairePenalties(valid)
      : competitivePenalties(action.player, valid, decision);

  // 3. End-of-game check, BEFORE any penalty draw.
  const outcome = endOutcome(state, hands, solvedBy, turn);
  if (outcome === 'fault') {
    return failure(E.engineFault, 'The game ended without a decisive winner.');
  }

  const { pending: _cleared, ...withoutPending } = state;
  void _cleared;
  const base: EngineState = {
    ...withoutPending,
    turnCount: turn,
    hands,
    played,
    solvedBy,
    discard,
    stats,
    history: [...state.history, ...events],
  };

  if (outcome !== undefined) {
    if (owed.length > 0) {
      events.push({ type: 'PENALTY_NOT_APPLIED', owed });
    }
    events.push({ type: 'GAME_ENDED', outcome });
    return {
      ok: true,
      state: {
        ...base,
        phase: 'ended',
        outcome,
        history: [...state.history, ...events],
      },
      events,
    };
  }

  // 4. Apply the penalty event (atomic; waived on exhaustion).
  const penalised = applyPenaltyEvent(base, owed);
  if (!penalised.ok) {
    return penalised;
  }
  events.push(...penalised.events);

  // 5. Safety re-check: a penalty draw can neither empty a hand nor solve a challenge.
  if (endOutcome(state, penalised.state.hands, solvedBy, turn) !== undefined) {
    return failure(E.engineFault, 'A penalty draw changed the end-of-game result.');
  }

  // 6. Advance the active player.
  const nextPlayer =
    state.mode === ENGINE_MODES.vsBeepy ? otherPlayer(action.player) : ('human' as PlayerId);
  return {
    ok: true,
    state: {
      ...penalised.state,
      phase: 'awaitingAction',
      activePlayer: nextPlayer,
    },
    events,
  };
}
