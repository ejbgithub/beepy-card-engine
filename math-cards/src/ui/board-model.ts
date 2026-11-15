/**
 * Board model (Milestone M5, U3). Pure: no DOM, no engine calls.
 *
 * `toBoardModel(view, ui)` turns the engine's sanitized `PlayerView` plus the UI's
 * own transient state (which card is selected, whether Beepy is thinking) into
 * plain data the renderer draws. It adds labels, enabled flags, and accessible
 * names, but NO game knowledge:
 *   - it never judges: with a card selected, every open challenge and the discard
 *     pile are enabled;
 *   - it never scores: Solitaire scores come only from the outcome and the series
 *     status; competitive credit is a display tally of `solvedBy` on the board;
 *   - it never adds data: every value comes from the view, the UI state, or the
 *     fixed labels. The pending panel shows only the card face and destination.
 */

import type { CardFace, GameOutcome, PendingView, PlayerView } from '@beepy/shared-engine';
import { COMPETITIVE_END_LABELS, PLAYER_NAMES, SESSION_GAMES_LABEL, SOLITAIRE_END_LABELS } from './labels.js';

/** UI-only state the engine does not hold. */
export interface UiState {
  readonly selectedHandle?: string;
  /** True while Beepy's turn is being prepared or a step is in flight. */
  readonly busy?: boolean;
  readonly beepyThinking?: boolean;
  /** Handles of penalty cards just drawn by the human, to highlight briefly. */
  readonly newCardHandles?: readonly string[];
  /** Outcomes of the finished games of this series, oldest first (engine data). */
  readonly completedOutcomes?: readonly GameOutcome[];
}

export interface MatchGameModel {
  readonly number: number;
  readonly winnerLabel: string;
  readonly reasonLabel: string;
}

export interface MatchModel {
  readonly scoreLine: string;
  readonly decided: boolean;
  readonly winnerLabel?: string;
  readonly games: readonly MatchGameModel[];
}

export interface CardModel {
  readonly handle: string;
  readonly face: string;
  /** Expression cards ("3 + 4") are drawn wider than number cards. */
  readonly wide: boolean;
  readonly selected: boolean;
  readonly isNew: boolean;
  readonly enabled: boolean;
  readonly ariaLabel: string;
}

export interface ChallengeModel {
  readonly id: string;
  /** 1-based position on the board, for the "Problem 3" label. */
  readonly number: number;
  /** The engine's prompt text, unchanged (used in accessible labels). */
  readonly prompt: string;
  /** What the tile shows: the prompt, or just the target number in "find the addition" mode. */
  readonly display: string;
  /** True when `display` is only a target number (drawn larger). */
  readonly targetOnly: boolean;
  readonly status: 'open' | 'solved';
  readonly solverLabel?: string;
  readonly playedFace?: string;
  /** True when the selected card may be played here now. */
  readonly target: boolean;
  readonly ariaLabel: string;
}

export interface PendingModel {
  readonly playerLabel: string;
  readonly face: string;
  readonly wide: boolean;
  readonly destinationLabel: string;
  /** Short visible form of the destination ("on problem 4 (10)" in target-only mode). */
  readonly destinationDisplay: string;
  /** Whether the move is a discard (from the pending view's `kind`). */
  readonly isDiscard: boolean;
  readonly canDecide: boolean;
}

export type ScoreModel =
  | {
      readonly kind: 'solitaire';
      readonly gameLabel: string;
      readonly sessionTotal: number;
      readonly gamesCompleted: number;
      readonly gameScores: readonly number[];
    }
  | {
      readonly kind: 'vsBeepy';
      readonly gameLabel: string;
      readonly wins: { readonly human: number; readonly beepy: number };
      readonly credits: { readonly human: number; readonly beepy: number };
    };

export interface OutcomeModel {
  readonly title: string;
  readonly lines: readonly string[];
  /** Solitaire only: the game score from the outcome. */
  readonly score?: number;
  readonly humanWon?: boolean;
}

export interface BoardModel {
  readonly mode: PlayerView['mode'];
  /** A one-line instruction shown above the problems (target-only mode). */
  readonly instruction?: string;
  /** The cards the human just drew as penalties (faces from the hand), oldest first. */
  readonly newCards: readonly { readonly handle: string; readonly face: string }[];
  readonly phase: PlayerView['phase'];
  readonly turnLabel: string;
  readonly turnCount: number;
  readonly drawPileCount: number;
  readonly score: ScoreModel;
  readonly challenges: readonly ChallengeModel[];
  readonly hand: readonly CardModel[];
  readonly handCount: number;
  readonly discard: {
    readonly count: number;
    readonly topFace?: string;
    readonly target: boolean;
    readonly ariaLabel: string;
  };
  /** True when the human may select a card right now. */
  readonly canAct: boolean;
  readonly selectedFace?: string;
  readonly beepy?: { readonly cardCount: number; readonly thinking: boolean };
  readonly pending?: PendingModel;
  readonly outcome?: OutcomeModel;
  /** Competitive only: match score and, once games have finished, their results. */
  readonly match?: MatchModel;
  readonly seriesComplete: boolean;
}

const isWide = (face: string): boolean => face.includes('+');

/**
 * The engine's "find the matching addition" prompt (M4, owner-approved wording).
 * For display only, U9 shows just its target number on the tile; the prompt text,
 * the challenge data, and all judging are unchanged.
 */
const TARGET_PROMPT = /^Which addition expression equals (\d+)\?$/;

/** The tile text for a prompt, and whether it is a bare target number. */
export function promptDisplay(prompt: string): { readonly display: string; readonly targetOnly: boolean } {
  const match = TARGET_PROMPT.exec(prompt);
  return match === null ? { display: prompt, targetOnly: false } : { display: match[1] as string, targetOnly: true };
}

export const TARGET_ONLY_INSTRUCTION = 'Find an addition card that makes each number.';

const cardLabel = (face: string): string => `Card ${face}`;

function destinationLabel(pending: PendingView, view: PlayerView): string {
  if (pending.destination === 'discard') return 'to the discard pile';
  const index = view.challenges.findIndex((c) => c.id === pending.destination);
  const challenge = view.challenges[index];
  return challenge === undefined ? 'on a problem' : `on problem ${index + 1}: ${challenge.promptText}`;
}

function destinationDisplay(pending: PendingView, view: PlayerView): string {
  if (pending.destination === 'discard') return 'to the discard pile';
  const index = view.challenges.findIndex((c) => c.id === pending.destination);
  const challenge = view.challenges[index];
  if (challenge === undefined) return 'on a problem';
  const shown = promptDisplay(challenge.promptText);
  return shown.targetOnly ? `on problem ${index + 1} (${shown.display})` : `on problem ${index + 1}: ${shown.display}`;
}

function outcomeModel(view: PlayerView): OutcomeModel | undefined {
  const outcome = view.outcome;
  if (outcome === undefined) return undefined;
  if (outcome.kind === 'solitaire') {
    const why = outcome.endedBy.map((reason) => SOLITAIRE_END_LABELS[reason]);
    return {
      title: 'Game over!',
      score: outcome.score,
      lines: [
        ...why,
        `Turns taken: ${outcome.turns}`,
        `Cards left in your hand: ${outcome.cardsRemaining}`,
        `Game score: ${outcome.score} (lower is better)`,
      ],
    };
  }
  const humanWon = outcome.winner === 'human';
  const who = PLAYER_NAMES[outcome.winner];
  const reason = COMPETITIVE_END_LABELS[outcome.reason];
  return {
    title: humanWon ? 'You win!' : 'Beepy wins!',
    humanWon,
    lines: [
      `${who} ${reason}.`,
      `Cards left: you ${outcome.handCounts.human}, Beepy ${outcome.handCounts.beepy}`,
      `Problems solved: you ${outcome.credits.human}, Beepy ${outcome.credits.beepy}`,
    ],
  };
}

function scoreModel(view: PlayerView): ScoreModel {
  const series = view.series;
  if (view.mode === 'solitaire') {
    return {
      kind: 'solitaire',
      gameLabel: `Game ${view.gameIndex} of ${SESSION_GAMES_LABEL}`,
      sessionTotal: series?.sessionScore ?? 0,
      gamesCompleted: series?.gamesCompleted ?? 0,
      gameScores: [...(series?.gameScores ?? [])],
    };
  }
  const credits = { human: 0, beepy: 0 };
  for (const challenge of view.challenges) {
    if (challenge.solvedBy !== undefined) credits[challenge.solvedBy] += 1;
  }
  return {
    kind: 'vsBeepy',
    gameLabel: `Game ${view.gameIndex}`,
    wins: { human: series?.wins?.human ?? 0, beepy: series?.wins?.beepy ?? 0 },
    credits,
  };
}

/** Match score from the series status; per-game results from the engine's outcomes. */
function matchModel(view: PlayerView, ui: UiState): MatchModel | undefined {
  if (view.mode !== 'vsBeepy') return undefined;
  const wins = { human: view.series?.wins?.human ?? 0, beepy: view.series?.wins?.beepy ?? 0 };
  const winner = view.series?.winner;
  const games: MatchGameModel[] = [];
  (ui.completedOutcomes ?? []).forEach((outcome, i) => {
    if (outcome.kind !== 'vsBeepy') return;
    games.push({
      number: i + 1,
      winnerLabel: PLAYER_NAMES[outcome.winner],
      reasonLabel: COMPETITIVE_END_LABELS[outcome.reason],
    });
  });
  return {
    scoreLine: `Match: You ${wins.human} – Beepy ${wins.beepy} (first to 3 wins)`,
    decided: view.series?.complete === true,
    ...(winner === undefined ? {} : { winnerLabel: PLAYER_NAMES[winner] }),
    games,
  };
}

function turnLabel(view: PlayerView, ui: UiState): string {
  if (view.phase === 'ended') return 'Game over';
  if (view.phase === 'awaitingEvaluation') return 'Your call: Accept or Challenge?';
  if (view.activePlayer === 'beepy') return ui.beepyThinking === true ? 'Beepy is thinking…' : "Beepy's turn";
  return 'Your turn';
}

/** Build the board model. Pure; returns fresh data. */
export function toBoardModel(view: PlayerView, ui: UiState = {}): BoardModel {
  const canAct =
    view.phase === 'awaitingAction' && view.activePlayer === 'human' && ui.busy !== true;
  const inHand = (handle: string | undefined): handle is string =>
    handle !== undefined && view.hand.some((c) => c.handle === handle);
  const selected = canAct && inHand(ui.selectedHandle) ? ui.selectedHandle : undefined;
  const fresh = new Set(ui.newCardHandles ?? []);

  const hand: CardModel[] = view.hand.map((card: CardFace) => {
    const isSelected = card.handle === selected;
    return {
      handle: card.handle,
      face: card.displayValue,
      wide: isWide(card.displayValue),
      selected: isSelected,
      isNew: fresh.has(card.handle),
      enabled: canAct,
      ariaLabel: `${cardLabel(card.displayValue)}${isSelected ? ', selected' : ''}`,
    };
  });

  const challenges: ChallengeModel[] = view.challenges.map((challenge, index) => {
    const solved = challenge.status === 'solved';
    const solverLabel = challenge.solvedBy === undefined ? undefined : PLAYER_NAMES[challenge.solvedBy];
    const playedFace = challenge.playedCard?.displayValue;
    const number = index + 1;
    const ariaLabel = solved
      ? `Problem ${number}: ${challenge.promptText}. Solved${
          view.mode === 'vsBeepy' && solverLabel !== undefined ? ` by ${solverLabel === 'You' ? 'you' : solverLabel}` : ''
        } with ${playedFace ?? 'a card'}.`
      : `Problem ${number}: ${challenge.promptText}${selected === undefined ? '' : '. Play the selected card here.'}`;
    const shown = promptDisplay(challenge.promptText);
    return {
      id: challenge.id,
      number,
      prompt: challenge.promptText,
      display: shown.display,
      targetOnly: shown.targetOnly,
      status: challenge.status,
      ...(solverLabel === undefined ? {} : { solverLabel }),
      ...(playedFace === undefined ? {} : { playedFace }),
      target: selected !== undefined && !solved,
      ariaLabel,
    };
  });

  const top = view.discard[view.discard.length - 1];
  const pending = view.pending;
  const selectedFace = selected === undefined ? undefined : view.hand.find((c) => c.handle === selected)?.displayValue;

  const newCards = hand.filter((card) => card.isNew).map((card) => ({ handle: card.handle, face: card.face }));
  const targetOnly = challenges.length > 0 && challenges.every((c) => c.targetOnly);

  return {
    mode: view.mode,
    ...(targetOnly ? { instruction: TARGET_ONLY_INSTRUCTION } : {}),
    newCards,
    phase: view.phase,
    turnLabel: turnLabel(view, ui),
    turnCount: view.turnCount,
    drawPileCount: view.drawPileCount,
    score: scoreModel(view),
    challenges,
    hand,
    handCount: view.hand.length,
    discard: {
      count: view.discard.length,
      ...(top === undefined ? {} : { topFace: top.displayValue }),
      target: selected !== undefined,
      ariaLabel: `Discard pile, ${view.discard.length} card${view.discard.length === 1 ? '' : 's'}${
        selected === undefined ? '' : '. Discard the selected card here.'
      }`,
    },
    canAct,
    ...(selectedFace === undefined ? {} : { selectedFace }),
    ...(view.mode === 'vsBeepy'
      ? { beepy: { cardCount: view.opponentHandCount ?? 0, thinking: ui.beepyThinking === true } }
      : {}),
    ...(pending === undefined || view.phase !== 'awaitingEvaluation'
      ? {}
      : {
          pending: {
            playerLabel: PLAYER_NAMES[pending.player],
            face: pending.card.displayValue,
            wide: isWide(pending.card.displayValue),
            destinationLabel: destinationLabel(pending, view),
            destinationDisplay: destinationDisplay(pending, view),
            isDiscard: pending.kind === 'discard',
            canDecide: ui.busy !== true,
          },
        }),
    ...(() => {
      const outcome = outcomeModel(view);
      return outcome === undefined ? {} : { outcome };
    })(),
    ...(() => {
      const match = matchModel(view, ui);
      return match === undefined ? {} : { match };
    })(),
    seriesComplete: view.series?.complete === true,
  };
}
