/**
 * The game table (M6 C6 Solitaire, C7 Player vs. Beepy; adapted from Math Cards M5
 * U6-U10).
 *
 * Draws a `BoardModel` (and the session's feedback) as DOM. It holds no game logic:
 * every label, flag and number comes from the board model, which comes from the
 * engine's sanitized view. All interactive pieces are real buttons with accessible
 * names that reveal nothing about correctness. Elements carry only opaque engine
 * handles and neutral challenge ids (`c1`..), never card ids or source entry ids.
 *
 * Interaction: tap/click a card to select it, then tap a challenge to play it there
 * or the discard pile to discard it; or drag the card onto a lit-up target (C7, same
 * commands; see drag.ts). Tap the card again, press Escape, or use Cancel to clear.
 *
 * Player vs. Beepy (C7): Beepy sits at the top with a face-down hand (count only).
 * When Beepy moves, a panel shows ONLY the attempted card and its destination, with
 * Accept and Challenge styled identically. Nothing hints at validity.
 *
 * Explain Why (C7): after a resolved play that has an authored explanation, an
 * "Explain Why" button appears; the explanation opens in a separate panel. It is
 * never shown on a card face and never before resolution.
 */

import type { BoardModel, CardModel, ChallengeModel, PendingModel } from '../board-model.js';
import type { FeedbackItem } from '../feedback.js';
import { APP_TITLE } from '../labels.js';
import { createBeepyAvatar } from './beepy-avatar.js';
import { h } from './dom.js';

export interface BoardHandlers {
  readonly select: (handle: string) => void;
  readonly cancel: () => void;
  readonly playOn: (challengeId: string) => void;
  readonly discard: () => void;
  readonly accept: () => void;
  readonly challenge: () => void;
  readonly openExplanation: () => void;
  readonly closeExplanation: () => void;
  readonly menu: () => void;
  readonly nextGame: () => void;
  readonly playAgain: () => void;
  readonly mainMenu: () => void;
}

export interface BoardProps {
  readonly board: BoardModel;
  readonly feedback: readonly FeedbackItem[];
  readonly error?: string;
  readonly handlers: BoardHandlers;
}

const TONE_ICON: Readonly<Record<FeedbackItem['tone'], string>> = { good: '✓', oops: '✗', info: 'ℹ' };
const TONE_WORD: Readonly<Record<FeedbackItem['tone'], string>> = { good: 'Correct', oops: 'Not quite', info: 'Note' };
/** Face-down cards drawn for Beepy before showing "+n". */
const MAX_BEEPY_BACKS = 10;

const stat = (label: string, value: string | number): HTMLElement => h('span', { class: 'stat' }, h('span', { class: 'stat__label' }, label), h('strong', {}, value));

function header(board: BoardModel, onMenu: () => void): HTMLElement {
  const score = board.score;
  const stats: HTMLElement[] = [h('span', { class: 'stat stat--game' }, score.gameLabel)];
  if (score.kind === 'solitaire') {
    stats.push(stat('Turns', board.turnCount), stat('Cards in hand', board.handCount), stat('Session total', score.sessionTotal));
  } else {
    stats.push(
      stat('Match', `You ${score.wins.human} – Beepy ${score.wins.beepy}`),
      stat('Solved', `You ${score.credits.human} · Beepy ${score.credits.beepy}`),
      stat('Turns', board.turnCount),
    );
  }
  return h(
    'header',
    { class: 'topbar' },
    h('div', { class: 'topbar__brand' }, APP_TITLE),
    h('div', { class: 'topbar__stats', attrs: { 'aria-label': 'Game progress' } }, ...stats),
    h('button', { class: 'btn btn--ghost btn--small', attrs: { type: 'button', 'data-focus': 'menu' }, on: { click: onMenu } }, 'Menu'),
  );
}

function beepyBar(board: BoardModel): HTMLElement | null {
  const beepy = board.beepy;
  if (beepy === undefined) return null;
  const shown = Math.min(beepy.cardCount, MAX_BEEPY_BACKS);
  const extra = beepy.cardCount - shown;
  return h(
    'section',
    { class: 'beepy-bar', attrs: { 'aria-label': `Beepy has ${beepy.cardCount} card${beepy.cardCount === 1 ? '' : 's'}` } },
    h('span', { class: 'beepy-bar__avatar' }, createBeepyAvatar(beepy.thinking ? 'thinking' : 'idle', 72)),
    h(
      'div',
      { class: 'beepy-bar__info', attrs: { 'aria-hidden': 'true' } },
      h('span', { class: 'beepy-bar__name' }, 'Beepy'),
      h('span', { class: 'beepy-bar__count' }, `${beepy.cardCount} card${beepy.cardCount === 1 ? '' : 's'}`),
    ),
    h(
      'div',
      { class: 'beepy-bar__hand', attrs: { 'aria-hidden': 'true' } },
      ...Array.from({ length: shown }, () => h('span', { class: 'card-back' })),
      extra > 0 ? h('span', { class: 'beepy-bar__more' }, `+${extra}`) : null,
    ),
    beepy.thinking ? h('span', { class: 'beepy-bar__thinking' }, 'Beepy is thinking…') : null,
  );
}

function promptLines(challenge: ChallengeModel): HTMLElement {
  const { heading, label, kind } = challenge.display;
  return h(
    'span',
    { class: `challenge__prompt challenge__prompt--${kind}`, attrs: { 'aria-hidden': 'true' } },
    label === undefined ? null : h('span', { class: 'challenge__category' }, label),
    h('span', { class: 'challenge__heading' }, heading),
  );
}

function challengeTile(challenge: ChallengeModel, onPlay: (id: string) => void, showSolver: boolean): HTMLElement {
  const solved = challenge.status === 'solved';
  const classes = [
    'challenge',
    solved ? 'challenge--solved' : 'challenge--open',
    challenge.target ? 'challenge--target' : '',
    solved && challenge.solverLabel === 'Beepy' ? 'challenge--beepy' : '',
  ]
    .filter((c) => c !== '')
    .join(' ');
  return h(
    'button',
    {
      class: classes,
      attrs: {
        type: 'button',
        'aria-label': challenge.ariaLabel,
        'data-focus': `challenge:${challenge.id}`,
        // A drop target only when it is a tap target (every open challenge alike).
        'data-drop': challenge.target ? `challenge:${challenge.id}` : undefined,
      },
      disabled: !challenge.target,
      on: { click: () => onPlay(challenge.id) },
    },
    h('span', { class: 'challenge__number', attrs: { 'aria-hidden': 'true' } }, challenge.number),
    promptLines(challenge),
    solved
      ? h(
          'span',
          { class: 'challenge__solved', attrs: { 'aria-hidden': 'true' } },
          h('span', { class: 'challenge__check' }, '✓'),
          h('span', { class: 'mini-card mini-card--wide mini-card--text' }, challenge.playedFace ?? ''),
        )
      : null,
    solved && showSolver && challenge.solverLabel !== undefined ? h('span', { class: 'challenge__solver', attrs: { 'aria-hidden': 'true' } }, challenge.solverLabel) : null,
  );
}

function handCard(card: CardModel, onSelect: (handle: string) => void): HTMLElement {
  const classes = ['card', 'card--wide', 'card--text', card.selected ? 'card--selected' : '', card.isNew ? 'card--new' : ''].filter((c) => c !== '').join(' ');
  return h(
    'button',
    {
      class: classes,
      attrs: { type: 'button', 'aria-label': card.ariaLabel, 'aria-pressed': card.selected ? 'true' : 'false', 'data-focus': `card:${card.handle}`, 'data-handle': card.handle },
      disabled: !card.enabled,
      on: { click: () => onSelect(card.handle) },
    },
    h('span', { class: 'card__face', attrs: { 'aria-hidden': 'true' } }, card.face),
  );
}

function pendingPanel(pending: PendingModel, handlers: BoardHandlers): HTMLElement {
  return h(
    'section',
    { class: 'pending', attrs: { 'aria-labelledby': 'pending-title' } },
    h('h2', { class: 'pending__title', attrs: { id: 'pending-title', tabindex: -1, 'data-focus': 'pending' } }, `${pending.playerLabel}'s move`),
    h(
      'p',
      { class: 'pending__move' },
      pending.isDiscard ? `${pending.playerLabel} wants to discard ` : `${pending.playerLabel} wants to play `,
      h('span', { class: 'mini-card mini-card--pending mini-card--wide mini-card--text' }, pending.face),
      ` ${pending.destinationLabel}`,
    ),
    h('p', { class: 'pending__question' }, 'Is Beepy right?'),
    h(
      'div',
      { class: 'pending__actions' },
      h('button', { class: 'btn btn--decision', attrs: { type: 'button', 'data-focus': 'accept' }, disabled: !pending.canDecide, on: { click: handlers.accept } }, 'Accept'),
      h('button', { class: 'btn btn--decision', attrs: { type: 'button', 'data-focus': 'challenge' }, disabled: !pending.canDecide, on: { click: handlers.challenge } }, 'Challenge'),
    ),
  );
}

function feedbackBanner(items: readonly FeedbackItem[], error: string | undefined): HTMLElement {
  // Visual only: the persistent live region in app.ts announces the same text.
  const rows = items.map((item) =>
    h(
      'p',
      { class: `feedback__item feedback__item--${item.tone}` },
      h('span', { class: 'feedback__icon', attrs: { 'aria-hidden': 'true' } }, TONE_ICON[item.tone]),
      h('span', { class: 'sr-only' }, `${TONE_WORD[item.tone]}: `),
      item.text,
    ),
  );
  if (error !== undefined) rows.push(h('p', { class: 'feedback__item feedback__item--error' }, h('span', { class: 'feedback__icon', attrs: { 'aria-hidden': 'true' } }, '!'), error));
  return h('div', { class: 'feedback' }, ...rows);
}

function explainArea(board: BoardModel, handlers: BoardHandlers): HTMLElement | null {
  const explain = board.explain;
  if (explain === undefined) return null;
  if (!explain.open) {
    return h(
      'div',
      { class: 'explain' },
      h('button', { class: 'btn btn--ghost btn--small', attrs: { type: 'button', 'data-focus': 'explain' }, on: { click: handlers.openExplanation } }, 'Explain Why'),
    );
  }
  return h(
    'section',
    { class: 'explain explain--open', attrs: { 'aria-labelledby': 'explain-title' } },
    h('h2', { class: 'explain__title', attrs: { id: 'explain-title', tabindex: -1, 'data-focus': 'explain-panel' } }, 'Explanation'),
    h('p', { class: 'explain__text' }, explain.text ?? ''),
    h('button', { class: 'btn btn--ghost btn--small', attrs: { type: 'button', 'data-focus': 'explain-close' }, on: { click: handlers.closeExplanation } }, 'Close'),
  );
}

/** Bring a hand card into view and focus it, only when the player asks. */
function showCard(handle: string): void {
  const target = document.querySelector<HTMLElement>(`[data-handle="${CSS.escape(handle)}"]`);
  if (target === null) return;
  const reduce = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
  target.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: reduce ? 'auto' : 'smooth' });
  target.focus({ preventScroll: true });
}

function newCardNotice(board: BoardModel): HTMLElement | null {
  if (board.newCards.length === 0 || board.phase === 'ended') return null;
  const first = board.newCards[0];
  return h(
    'div',
    { class: 'new-card-notice' },
    h('span', { class: 'new-card-notice__label' }, board.newCards.length === 1 ? 'Your new card:' : 'Your new cards:'),
    ...board.newCards.map((card) => h('span', { class: 'mini-card mini-card--new mini-card--wide mini-card--text', attrs: { 'aria-hidden': 'true' } }, card.face)),
    h('span', { class: 'sr-only' }, board.newCards.map((card) => card.face).join('; ')),
    first === undefined
      ? null
      : h('button', { class: 'btn btn--ghost btn--small', attrs: { type: 'button', 'data-focus': 'show-new' }, on: { click: () => showCard(first.handle) } }, 'Show me ↓'),
  );
}

function selectionBar(board: BoardModel, onCancel: () => void): HTMLElement {
  if (board.phase === 'ended' || board.pending !== undefined) return h('div', { class: 'selection-bar' });
  if (!board.canAct) return h('div', { class: 'selection-bar' }, h('span', { class: 'selection-bar__hint' }, board.turnLabel));
  if (board.selectedFace === undefined) {
    return h('div', { class: 'selection-bar' }, h('span', { class: 'selection-bar__hint' }, 'Your turn: choose a card, or drag it to a challenge.'));
  }
  return h(
    'div',
    { class: 'selection-bar selection-bar--active' },
    h('span', { class: 'selection-bar__hint' }, 'Now choose a challenge for ', h('strong', {}, board.selectedFace), ', or Discard.'),
    h('button', { class: 'btn btn--ghost btn--small', attrs: { type: 'button', 'data-focus': 'cancel' }, on: { click: onCancel } }, 'Cancel'),
  );
}

function solitaireSummary(board: BoardModel): HTMLElement[] {
  const score = board.score;
  if (score.kind !== 'solitaire') return [];
  const out: HTMLElement[] = [h('p', { class: 'results__total' }, `Session total after ${score.gamesCompleted} of 5 games: `, h('strong', {}, score.sessionTotal))];
  if (board.seriesComplete) out.push(h('ol', { class: 'results__games', attrs: { 'aria-label': 'Game scores' } }, ...score.gameScores.map((value, i) => h('li', {}, `Game ${i + 1}: ${value}`))));
  return out;
}

function matchSummary(board: BoardModel): HTMLElement[] {
  const match = board.match;
  if (match === undefined) return [];
  const out: HTMLElement[] = [h('p', { class: 'results__total' }, match.scoreLine)];
  if (match.decided && match.games.length > 0) {
    out.push(
      h(
        'ol',
        { class: 'results__games', attrs: { 'aria-label': 'Match games' } },
        ...match.games.map((game) => h('li', {}, `Game ${game.number}: ${game.winnerLabel === 'You' ? 'You won' : 'Beepy won'} (${game.reasonLabel})`)),
      ),
    );
  }
  return out;
}

function resultsPanel(board: BoardModel, handlers: BoardHandlers): HTMLElement | null {
  const outcome = board.outcome;
  if (outcome === undefined) return null;
  const competitive = board.mode === 'vsBeepy';
  let title = outcome.title;
  let subtitle: string | undefined;
  if (board.seriesComplete) {
    if (competitive) {
      title = board.match?.winnerLabel === 'You' ? 'You won the match!' : 'Beepy won the match!';
      subtitle = `This game: ${outcome.title}`;
    } else {
      title = 'Session complete';
      subtitle = outcome.title;
    }
  }
  const won = outcome.humanWon === true || (board.seriesComplete && board.match?.winnerLabel === 'You');
  return h(
    'section',
    { class: `results${won ? ' results--win' : ''}`, attrs: { role: 'dialog', 'aria-modal': 'false', 'aria-labelledby': 'results-title' } },
    h('h2', { class: 'results__title', attrs: { id: 'results-title' } }, title),
    subtitle === undefined ? null : h('p', { class: 'results__subtitle' }, subtitle),
    h('ul', { class: 'results__lines' }, ...outcome.lines.map((line) => h('li', {}, line))),
    ...(competitive ? matchSummary(board) : solitaireSummary(board)),
    h(
      'div',
      { class: 'results__actions' },
      board.seriesComplete
        ? h('button', { class: 'btn btn--primary btn--big', attrs: { type: 'button', 'data-focus': 'again' }, on: { click: handlers.playAgain } }, competitive ? 'Play a new match' : 'Play a new session')
        : h('button', { class: 'btn btn--primary btn--big', attrs: { type: 'button', 'data-focus': 'next' }, on: { click: handlers.nextGame } }, 'Next game →'),
      h('button', { class: 'btn btn--ghost', attrs: { type: 'button', 'data-focus': 'main' }, on: { click: handlers.mainMenu } }, 'Main menu'),
    ),
  );
}

/** Render the table for one board model. */
export function renderBoard(props: BoardProps): HTMLElement {
  const { board, handlers } = props;
  const competitive = board.mode === 'vsBeepy';
  const piles = h(
    'section',
    { class: 'table-center', attrs: { 'aria-label': 'Piles' } },
    h(
      'div',
      { class: 'pile pile--draw', attrs: { 'aria-label': `Draw pile, ${board.drawPileCount} cards` } },
      h('span', { class: 'pile__stack', attrs: { 'aria-hidden': 'true' } }),
      h('span', { class: 'pile__label', attrs: { 'aria-hidden': 'true' } }, 'Draw pile'),
      h('strong', { class: 'pile__count', attrs: { 'aria-hidden': 'true' } }, board.drawPileCount),
    ),
    h(
      'button',
      {
        class: `pile pile--discard${board.discard.target ? ' pile--target' : ''}`,
        attrs: { type: 'button', 'aria-label': board.discard.ariaLabel, 'data-focus': 'discard', 'data-drop': board.discard.target ? 'discard' : undefined },
        disabled: !board.discard.target,
        on: { click: handlers.discard },
      },
      board.discard.topFace === undefined
        ? h('span', { class: 'pile__empty', attrs: { 'aria-hidden': 'true' } })
        : h('span', { class: 'mini-card mini-card--wide mini-card--text', attrs: { 'aria-hidden': 'true' } }, board.discard.topFace),
      h('span', { class: 'pile__label', attrs: { 'aria-hidden': 'true' } }, 'Discard'),
      h('strong', { class: 'pile__count', attrs: { 'aria-hidden': 'true' } }, board.discard.count),
    ),
    board.pending === undefined ? null : pendingPanel(board.pending, handlers),
  );
  const messages = h(
    'div',
    { class: 'messages' },
    feedbackBanner(props.feedback, props.error),
    explainArea(board, handlers),
    newCardNotice(board),
    selectionBar(board, handlers.cancel),
  );
  return h(
    'section',
    { class: `screen screen--board board--${board.mode} board--clinical`, attrs: { 'aria-label': 'Game table' } },
    header(board, handlers.menu),
    h('h1', { class: 'sr-only' }, `${board.score.gameLabel}. ${board.turnLabel}`),
    beepyBar(board),
    h(
      'section',
      { class: `challenges challenges--clinical${competitive ? ' challenges--nine' : ''}`, attrs: { 'aria-label': 'Challenges' } },
      ...board.challenges.map((c) => challengeTile(c, handlers.playOn, competitive)),
    ),
    competitive ? h('div', { class: 'action-row' }, piles, messages) : piles,
    competitive ? null : messages,
    h('section', { class: 'hand hand--clinical', attrs: { 'aria-label': `Your hand, ${board.handCount} cards` } }, ...board.hand.map((card) => handCard(card, handlers.select))),
    resultsPanel(board, handlers),
  );
}
