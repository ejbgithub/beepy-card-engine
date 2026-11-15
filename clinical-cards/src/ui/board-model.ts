/**
 * Board model (M6 C6-C7; adapted from Math Cards M5 U3). Pure: no DOM, no engine calls.
 *
 * `toBoardModel(view, ui)` turns the engine's sanitized `PlayerView` plus the UI's
 * own transient state into plain data the renderer draws. It adds labels, enabled
 * flags and accessible names, but NO game knowledge:
 *   - it never judges: with a card selected, every open challenge and the discard
 *     pile are enabled alike;
 *   - it never scores: Solitaire scores come only from the outcome and series status;
 *     competitive credit is a display tally of `solvedBy` on the board;
 *   - it never adds data: clinical text is the view's prompt and card text, verbatim.
 *     The pending panel shows only Beepy's card and destination.
 *
 * Clinical display (design section 8): a prompt is split for layout only:
 *   subjectToFact  "<disease> · <category>"   -> heading = disease, label = category
 *   factToSubject  "<category>: <fact>"       -> label = category, heading = fact
 * Every card is drawn wide and multi-line (up to 140 characters, C-12).
 */

import type { CardFace, GameOutcome, PendingView, PlayerView } from '@beepy/shared-engine';
import { CLINICAL_CATEGORIES } from '../clinical-content.js';
import { COMPETITIVE_END_LABELS, PLAYER_NAMES, SESSION_GAMES_LABEL, SOLITAIRE_END_LABELS } from './labels.js';

export interface UiState {
  readonly selectedHandle?: string;
  readonly busy?: boolean;
  readonly beepyThinking?: boolean;
  readonly newCardHandles?: readonly string[];
  /** Outcomes of the finished games of this series, oldest first (engine data). */
  readonly completedOutcomes?: readonly GameOutcome[];
  /** Explain Why for the last resolved play (from the session). */
  readonly explain?: { readonly available: boolean; readonly text?: string };
}

export interface CardModel {
  readonly handle: string;
  readonly face: string;
  readonly selected: boolean;
  readonly isNew: boolean;
  readonly enabled: boolean;
  readonly ariaLabel: string;
}

/** How a prompt is laid out. Both parts together are exactly the prompt's text. */
export interface PromptDisplay {
  readonly heading: string;
  readonly label?: string;
  readonly kind: 'diseaseCategory' | 'categoryFact' | 'plain';
}

export interface ChallengeModel {
  readonly id: string;
  readonly number: number;
  readonly prompt: string;
  readonly display: PromptDisplay;
  readonly status: 'open' | 'solved';
  readonly solverLabel?: string;
  readonly playedFace?: string;
  readonly target: boolean;
  readonly ariaLabel: string;
}

export interface PendingModel {
  readonly playerLabel: string;
  readonly face: string;
  /** "on challenge 4: <prompt>" or "to the discard pile". */
  readonly destinationLabel: string;
  readonly isDiscard: boolean;
  readonly canDecide: boolean;
}

export type ScoreModel =
  | { readonly kind: 'solitaire'; readonly gameLabel: string; readonly sessionTotal: number; readonly gamesCompleted: number; readonly gameScores: readonly number[] }
  | {
      readonly kind: 'vsBeepy';
      readonly gameLabel: string;
      readonly wins: { readonly human: number; readonly beepy: number };
      readonly credits: { readonly human: number; readonly beepy: number };
    };

export interface OutcomeModel {
  readonly title: string;
  readonly lines: readonly string[];
  readonly score?: number;
  readonly humanWon?: boolean;
}

export interface MatchModel {
  readonly scoreLine: string;
  readonly decided: boolean;
  readonly winnerLabel?: string;
  readonly games: readonly { readonly number: number; readonly winnerLabel: string; readonly reasonLabel: string }[];
}

export interface BoardModel {
  readonly mode: PlayerView['mode'];
  readonly newCards: readonly { readonly handle: string; readonly face: string }[];
  readonly phase: PlayerView['phase'];
  readonly turnLabel: string;
  readonly turnCount: number;
  readonly drawPileCount: number;
  readonly score: ScoreModel;
  readonly challenges: readonly ChallengeModel[];
  readonly hand: readonly CardModel[];
  readonly handCount: number;
  readonly discard: { readonly count: number; readonly topFace?: string; readonly target: boolean; readonly ariaLabel: string };
  readonly canAct: boolean;
  readonly selectedFace?: string;
  readonly beepy?: { readonly cardCount: number; readonly thinking: boolean };
  readonly pending?: PendingModel;
  readonly outcome?: OutcomeModel;
  readonly match?: MatchModel;
  /** Explain Why: offered only after a resolved play that has an authored explanation. */
  readonly explain?: { readonly open: boolean; readonly text?: string };
  readonly seriesComplete: boolean;
}

const CATEGORY_NAMES = CLINICAL_CATEGORIES.map((c) => c.topicName);

/** Split a prompt for display only. Never changes or drops text. */
export function promptDisplay(prompt: string): PromptDisplay {
  for (const category of CATEGORY_NAMES) {
    const suffix = ` · ${category}`;
    if (prompt.endsWith(suffix) && prompt.length > suffix.length) {
      return { heading: prompt.slice(0, -suffix.length), label: category, kind: 'diseaseCategory' };
    }
    const prefix = `${category}: `;
    if (prompt.startsWith(prefix) && prompt.length > prefix.length) {
      return { heading: prompt.slice(prefix.length), label: category, kind: 'categoryFact' };
    }
  }
  return { heading: prompt, kind: 'plain' };
}

function destinationLabel(pending: PendingView, view: PlayerView): string {
  if (pending.destination === 'discard') return 'to the discard pile';
  const index = view.challenges.findIndex((c) => c.id === pending.destination);
  const challenge = view.challenges[index];
  return challenge === undefined ? 'on a challenge' : `on challenge ${index + 1}: ${challenge.promptText}`;
}

function outcomeModel(view: PlayerView): OutcomeModel | undefined {
  const outcome = view.outcome;
  if (outcome === undefined) return undefined;
  if (outcome.kind === 'solitaire') {
    return {
      title: 'Game over',
      score: outcome.score,
      lines: [
        ...outcome.endedBy.map((reason) => SOLITAIRE_END_LABELS[reason]),
        `Turns taken: ${outcome.turns}`,
        `Cards left in your hand: ${outcome.cardsRemaining}`,
        `Game score: ${outcome.score} (lower is better)`,
      ],
    };
  }
  const humanWon = outcome.winner === 'human';
  return {
    title: humanWon ? 'You win!' : 'Beepy wins!',
    humanWon,
    lines: [
      `${PLAYER_NAMES[outcome.winner]} ${COMPETITIVE_END_LABELS[outcome.reason]}.`,
      `Cards left: you ${outcome.handCounts.human}, Beepy ${outcome.handCounts.beepy}`,
      `Challenges solved: you ${outcome.credits.human}, Beepy ${outcome.credits.beepy}`,
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
  for (const challenge of view.challenges) if (challenge.solvedBy !== undefined) credits[challenge.solvedBy] += 1;
  return { kind: 'vsBeepy', gameLabel: `Game ${view.gameIndex}`, wins: { human: series?.wins?.human ?? 0, beepy: series?.wins?.beepy ?? 0 }, credits };
}

function matchModel(view: PlayerView, ui: UiState): MatchModel | undefined {
  if (view.mode !== 'vsBeepy') return undefined;
  const wins = { human: view.series?.wins?.human ?? 0, beepy: view.series?.wins?.beepy ?? 0 };
  const winner = view.series?.winner;
  const games: MatchModel['games'][number][] = [];
  (ui.completedOutcomes ?? []).forEach((outcome, i) => {
    if (outcome.kind === 'vsBeepy') games.push({ number: i + 1, winnerLabel: PLAYER_NAMES[outcome.winner], reasonLabel: COMPETITIVE_END_LABELS[outcome.reason] });
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
  const canAct = view.phase === 'awaitingAction' && view.activePlayer === 'human' && ui.busy !== true;
  const selected = canAct && ui.selectedHandle !== undefined && view.hand.some((c) => c.handle === ui.selectedHandle) ? ui.selectedHandle : undefined;
  const fresh = new Set(ui.newCardHandles ?? []);
  const competitive = view.mode === 'vsBeepy';

  const hand: CardModel[] = view.hand.map((card: CardFace) => {
    const isSelected = card.handle === selected;
    return {
      handle: card.handle,
      face: card.displayValue,
      selected: isSelected,
      isNew: fresh.has(card.handle),
      enabled: canAct,
      ariaLabel: `Card: ${card.displayValue}${isSelected ? ', selected' : ''}`,
    };
  });

  const challenges: ChallengeModel[] = view.challenges.map((challenge, index) => {
    const solved = challenge.status === 'solved';
    const playedFace = challenge.playedCard?.displayValue;
    const solverLabel = challenge.solvedBy === undefined ? undefined : PLAYER_NAMES[challenge.solvedBy];
    const number = index + 1;
    const by = competitive && solverLabel !== undefined ? ` by ${solverLabel === 'You' ? 'you' : solverLabel}` : '';
    const ariaLabel = solved
      ? `Challenge ${number}: ${challenge.promptText}. Solved${by} with: ${playedFace ?? 'a card'}.`
      : `Challenge ${number}: ${challenge.promptText}${selected === undefined ? '' : '. Play the selected card here.'}`;
    return {
      id: challenge.id,
      number,
      prompt: challenge.promptText,
      display: promptDisplay(challenge.promptText),
      status: challenge.status,
      ...(solverLabel === undefined ? {} : { solverLabel }),
      ...(playedFace === undefined ? {} : { playedFace }),
      target: selected !== undefined && !solved,
      ariaLabel,
    };
  });

  const top = view.discard[view.discard.length - 1];
  const selectedFace = selected === undefined ? undefined : view.hand.find((c) => c.handle === selected)?.displayValue;
  const outcome = outcomeModel(view);
  const match = matchModel(view, ui);
  const pending = view.pending;

  return {
    mode: view.mode,
    newCards: hand.filter((card) => card.isNew).map((card) => ({ handle: card.handle, face: card.face })),
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
      ariaLabel: `Discard pile, ${view.discard.length} card${view.discard.length === 1 ? '' : 's'}${top === undefined ? '' : `. Top card: ${top.displayValue}`}${selected === undefined ? '' : '. Discard the selected card here.'}`,
    },
    canAct,
    ...(selectedFace === undefined ? {} : { selectedFace }),
    ...(competitive ? { beepy: { cardCount: view.opponentHandCount ?? 0, thinking: ui.beepyThinking === true } } : {}),
    ...(pending === undefined || view.phase !== 'awaitingEvaluation'
      ? {}
      : {
          pending: {
            playerLabel: PLAYER_NAMES[pending.player],
            face: pending.card.displayValue,
            destinationLabel: destinationLabel(pending, view),
            isDiscard: pending.kind === 'discard',
            canDecide: ui.busy !== true,
          },
        }),
    ...(outcome === undefined ? {} : { outcome }),
    ...(match === undefined ? {} : { match }),
    ...(ui.explain?.available === true && view.phase !== 'awaitingEvaluation'
      ? { explain: ui.explain.text === undefined ? { open: false } : { open: true, text: ui.explain.text } }
      : {}),
    seriesComplete: view.series?.complete === true,
  };
}
