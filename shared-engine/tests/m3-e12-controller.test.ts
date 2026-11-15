/**
 * M3 E12 - the trusted controller, sanitized views, handles, public events, and
 * public errors (requirement 9; clarification 2a-A and 2a-B).
 *
 * The test plays through the controller exactly as a UI would: it only sees views,
 * public events, and public errors. To choose moves it uses its OWN copy of the
 * sample deck (display value -> designated challenge), never the controller.
 */

import { describe, expect, it } from 'vitest';
import {
  createSeriesController,
  toPublicError,
  type ControllerResult,
  type SeriesController,
  type TrustedDiagnostic,
} from '../src/game/controller.js';
import { createReferenceBeepyStrategy, type BeepyStrategy } from '../src/game/beepy-strategy.js';
import type { PlayerView, PublicEvent } from '../src/game/view.js';
import { buildDeck, cloneDeck, cloneMatrix, fullMatrix, type MutableDeck } from './fixtures.js';
import { sample } from './m3-helpers.js';

const TEST_STEP_LIMIT = 2000;

const strategy = (errorRate: number): BeepyStrategy => {
  const created = createReferenceBeepyStrategy({ errorRate });
  if (!created.ok) throw new Error(created.error.code);
  return created.strategy;
};

function controllerFor(mode: 'solitaire' | 'vsBeepy', seed = 1, extra: { errorRate?: number; diagnostics?: (d: TrustedDiagnostic) => void } = {}): SeriesController {
  const s = sample(mode);
  const created = createSeriesController({
    mode,
    seed,
    options: s.options,
    ...(mode === 'vsBeepy' ? { beepyStrategy: strategy(extra.errorRate ?? 0) } : {}),
    ...(extra.diagnostics === undefined ? {} : { diagnostics: extra.diagnostics }),
  });
  if (!created.ok) throw new Error(created.error.code);
  return created.controller;
}

const okResult = (result: ControllerResult): { view: PlayerView; events: readonly PublicEvent[] } => {
  if (!result.ok) throw new Error(`expected success, got ${result.error.code}`);
  return result;
};

/** The test's own answer key, from its own copy of the deck. */
function answerKey(deck: MutableDeck): Map<string, string> {
  const valueToCard = new Map(deck.answerCards.map((c) => [c.displayValue, c.id]));
  const key = new Map<string, string>();
  for (const challenge of deck.challenges) {
    const value = deck.answerCards.find((c) => c.id === challenge.correctAnswerCardId)!.displayValue;
    key.set(value, challenge.id);
  }
  void valueToCard;
  return key;
}

/** A valid human action chosen from the view and the test's own answer key. */
function validHumanAction(view: PlayerView, key: Map<string, string>) {
  const open = new Set(view.challenges.filter((c) => c.status === 'open').map((c) => c.id));
  for (const card of view.hand) {
    const target = key.get(card.displayValue);
    if (target !== undefined && open.has(target)) return { kind: 'play', handle: card.handle, challengeId: target };
  }
  const card = view.hand.find((c) => {
    const target = key.get(c.displayValue);
    return target === undefined || !open.has(target);
  })!;
  return { kind: 'discard', handle: card.handle };
}

function invalidHumanAction(view: PlayerView, key: Map<string, string>) {
  const open = new Set(view.challenges.filter((c) => c.status === 'open').map((c) => c.id));
  const correct = view.hand.find((c) => open.has(key.get(c.displayValue) ?? ''));
  if (correct !== undefined) return { kind: 'discard', handle: correct.handle };
  return { kind: 'play', handle: view.hand[0]!.handle, challengeId: [...open][0]! };
}

/** Would the pending Beepy action be valid? Decided from the test's own key. */
function pendingValid(view: PlayerView, key: Map<string, string>): boolean {
  const p = view.pending!;
  const target = key.get(p.card.displayValue);
  const open = new Set(view.challenges.filter((c) => c.status === 'open').map((c) => c.id));
  if (p.kind === 'play') return target === p.destination && open.has(target);
  return target === undefined || !open.has(target);
}

/** Play the current game to its end through the controller only. */
function playToEnd(c: SeriesController, key: Map<string, string>, mistakesEvery = 0): PublicEvent[] {
  const all: PublicEvent[] = [];
  let view = okResult(c.getView()).view;
  let steps = 0;
  while (view.phase !== 'ended') {
    steps += 1;
    if (steps > TEST_STEP_LIMIT) throw new Error('test-only step limit exceeded');
    let result: ControllerResult;
    if (view.phase === 'awaitingEvaluation') {
      result = c.decide(pendingValid(view, key) ? 'accept' : 'challenge');
    } else if (view.activePlayer === 'beepy') {
      result = c.advanceBeepy();
    } else {
      const wrong = mistakesEvery > 0 && steps % mistakesEvery === 0;
      result = c.submitHumanAction(wrong ? invalidHumanAction(view, key) : validHumanAction(view, key));
    }
    const ok = okResult(result);
    all.push(...ok.events);
    view = ok.view;
  }
  return all;
}

// ---------------------------------------------------------------------------

describe('the controller exposes no engine state', () => {
  const c = controllerFor('vsBeepy');
  okResult(c.startNextGame({ deck: sample('vsBeepy').deck, contextualValidity: sample('vsBeepy').matrix }));

  it('is frozen and has only the documented methods', () => {
    expect(Object.isFrozen(c)).toBe(true);
    expect(Object.keys(c).sort()).toEqual(
      ['advanceBeepy', 'decide', 'getPublicEvents', 'getSeriesStatus', 'getView', 'startNextGame', 'submitHumanAction'],
    );
    for (const [name, descriptor] of Object.entries(Object.getOwnPropertyDescriptors(c))) {
      expect(typeof descriptor.value, name).toBe('function');
      expect(descriptor.get).toBeUndefined();
    }
    expect(JSON.stringify(c)).toBe('{}');
  });

  it('returns no field named state, history, deck, matrix, or drawPile', () => {
    const results = [c.getView(), c.getSeriesStatus(), { events: c.getPublicEvents() }];
    const text = JSON.stringify(results);
    for (const word of ['"state"', '"history"', '"deck"', '"contextualValidity"', '"drawPile"', 'correctAnswerCardId', '"cards"', 'handleByCard', 'cardByHandle']) {
      expect(text).not.toContain(word);
    }
  });

  it('mutating a returned view does not affect the game', () => {
    const first = okResult(c.getView()).view as unknown as { hand: unknown[]; turnCount: number };
    first.hand.length = 0;
    first.turnCount = 99;
    const again = okResult(c.getView()).view;
    expect(again.hand).toHaveLength(5);
    expect(again.turnCount).toBe(0);
  });
});

describe('views contain no hidden information', () => {
  const s = sample('vsBeepy');
  const deckIds = [...s.deck.answerCards.map((c) => c.id)];

  it('a full game of views and events never names a deck card id or a hidden face', () => {
    const c = controllerFor('vsBeepy', 4, { errorRate: 0.3 });
    const started = okResult(c.startNextGame({ deck: s.deck, contextualValidity: s.matrix }));
    const views: PlayerView[] = [started.view];
    const key = answerKey(s.deck);
    let view = started.view;
    let steps = 0;
    while (view.phase !== 'ended' && steps < TEST_STEP_LIMIT) {
      steps += 1;
      const result =
        view.phase === 'awaitingEvaluation'
          ? c.decide(pendingValid(view, key) ? 'accept' : 'challenge')
          : view.activePlayer === 'beepy'
            ? c.advanceBeepy()
            : c.submitHumanAction(validHumanAction(view, key));
      view = okResult(result).view;
      views.push(view);
    }
    const text = JSON.stringify([views, c.getPublicEvents()]);
    for (const id of deckIds) expect(text).not.toContain(`"${id}"`);
    expect(text).not.toMatch(/correct-\d|distractor-\d/);
    // Open challenges never show a sourceRef.
    for (const v of views) {
      for (const ch of v.challenges) {
        if (ch.status === 'open') expect(ch.sourceRef).toBeUndefined();
      }
    }
  });

  it("the human's view never shows Beepy's hand faces or the draw pile", () => {
    const c = controllerFor('vsBeepy', 2);
    const view = okResult(c.startNextGame({ deck: s.deck, contextualValidity: s.matrix })).view;
    const shown = new Set([...view.hand.map((card) => card.displayValue), ...view.discard.map((card) => card.displayValue)]);
    // Everything not shown is hidden; no hidden value may appear anywhere in the view.
    const hidden = s.deck.answerCards.map((card) => card.displayValue).filter((value) => !shown.has(value));
    expect(hidden.length).toBe(s.deck.answerCards.length - 5);
    const text = JSON.stringify(view);
    for (const value of hidden) expect(text).not.toContain(`"displayValue":"${value}"`);
    expect(view.opponentHandCount).toBe(5);
    expect(view.drawPileCount).toBe(s.deck.answerCards.length - 10);
  });

  it('a pending valid and a pending invalid Beepy action produce views of identical shape', () => {
    const shapes: string[] = [];
    for (const rate of [0, 1]) {
      const c = controllerFor('vsBeepy', 9, { errorRate: rate });
      const key = answerKey(s.deck);
      const v0 = okResult(c.startNextGame({ deck: s.deck, contextualValidity: s.matrix })).view;
      okResult(c.submitHumanAction(validHumanAction(v0, key)));
      const pending = okResult(c.advanceBeepy());
      expect(pendingValid(pending.view, key)).toBe(rate === 0);
      // The pending view has card, destination, kind, and player only; no validity.
      expect(Object.keys(pending.view.pending!).sort()).toEqual(['card', 'destination', 'kind', 'player']);
      expect(pending.events.map((e) => e.type)).toEqual(['ACTION_PENDING']);
      const normalize = (value: unknown): unknown =>
        Array.isArray(value)
          ? value.map(normalize)
          : typeof value === 'object' && value !== null
            ? Object.fromEntries(Object.entries(value).sort().map(([k, v]) => [k, normalize(v)]))
            : typeof value;
      shapes.push(JSON.stringify(normalize({ view: pending.view, events: pending.events })));
      expect(JSON.stringify(pending)).not.toMatch(/"valid"/);
    }
    expect(shapes[0]).toBe(shapes[1]);
  });

  it('judgment appears only after resolution', () => {
    const c = controllerFor('vsBeepy', 9, { errorRate: 1 });
    const key = answerKey(s.deck);
    const v0 = okResult(c.startNextGame({ deck: s.deck, contextualValidity: s.matrix })).view;
    okResult(c.submitHumanAction(validHumanAction(v0, key)));
    okResult(c.advanceBeepy());
    const resolved = okResult(c.decide('challenge'));
    expect(resolved.events.find((e) => e.type === 'ACTION_RESOLVED')).toMatchObject({ valid: false, decision: 'challenge', player: 'beepy' });
  });

  it("Beepy's penalty card is a count for the human; the human's own penalty card shows its face", () => {
    const c = controllerFor('vsBeepy', 9, { errorRate: 1 });
    const key = answerKey(s.deck);
    const v0 = okResult(c.startNextGame({ deck: s.deck, contextualValidity: s.matrix })).view;
    // Human acts invalidly: the human sees its own drawn card.
    const human = okResult(c.submitHumanAction(invalidHumanAction(v0, key)));
    const own = human.events.find((e) => e.type === 'PENALTY_DRAWN');
    expect(own).toMatchObject({ player: 'human' });
    expect(own && 'card' in own && own.card).toBeTruthy();
    // Beepy errs and is challenged: Beepy draws, the human sees no face.
    okResult(c.advanceBeepy());
    const beepy = okResult(c.decide('challenge'));
    const theirs = beepy.events.find((e) => e.type === 'PENALTY_DRAWN');
    expect(theirs).toMatchObject({ player: 'beepy' });
    expect(theirs && 'card' in theirs).toBe(false);
    expect(beepy.view.opponentHandCount).toBe(6);
  });

  it('views name cards only by opaque handles', () => {
    const c = controllerFor('solitaire', 3);
    const view = okResult(c.startNextGame({ deck: sample('solitaire').deck, contextualValidity: sample('solitaire').matrix })).view;
    for (const card of view.hand) {
      expect(card.handle).toMatch(/^h[0-9a-z]{7}$/);
      expect(Object.keys(card).sort()).toEqual(['displayValue', 'handle']);
    }
  });
});

describe('public errors never carry private identifiers (correction 1)', () => {
  /** A deck whose ids are deliberately revealing, then broken in several ways. */
  function secretDeck(): { deck: MutableDeck; matrix: Record<string, Record<string, boolean>> } {
    const deck = buildDeck({ style: 'clinical', direction: 'subjectToFact', correct: 5, distractors: 8 });
    const rename = new Map<string, string>();
    deck.answerCards.forEach((card, i) => {
      const next = `SECRET-card-${i}-${card.id.startsWith('correct') ? 'IS-ANSWER' : 'distractor'}`;
      rename.set(card.id, next);
      card.id = next;
    });
    deck.challenges.forEach((challenge, i) => {
      challenge.id = `SECRET-challenge-${i}`;
      challenge.correctAnswerCardId = rename.get(challenge.correctAnswerCardId)!;
    });
    const matrix = fullMatrix(deck);
    // Break it: an ambiguous card, a duplicate face, and an over-target size.
    matrix['SECRET-challenge-0']![deck.answerCards[1]!.id] = true;
    deck.answerCards[12]!.displayValue = deck.answerCards[0]!.displayValue;
    deck.meta.targetCardCount = 10;
    return { deck, matrix };
  }

  it('the public setup error has only a code, a fixed message, and counts', () => {
    const diagnostics: TrustedDiagnostic[] = [];
    const c = controllerFor('solitaire', 1, { diagnostics: (d) => diagnostics.push(d) });
    const { deck, matrix } = secretDeck();
    const result = c.startNextGame({ deck, contextualValidity: matrix });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    const text = JSON.stringify(result);
    expect(text).not.toContain('SECRET');
    expect(text).not.toContain('IS-ANSWER');
    expect(text).not.toMatch(/answerCards\[|challenges\[|contextualValidity\[/);
    expect(text).not.toContain(deck.answerCards[0]!.displayValue);
    expect(result.error.code).toBe('GAME_SETUP_INVALID');
    expect(result.error.message).toBe('The game content could not be validated, so no game was dealt.');
    expect(Object.keys(result.error).sort()).toEqual(['code', 'message', 'setup']);
    expect(result.error.setup!.issueCount).toBeGreaterThanOrEqual(3);
    expect(result.error.setup!.codes).toEqual(expect.arrayContaining(['CARD_VALID_FOR_MULTIPLE_CHALLENGES', 'DUPLICATE_DISPLAY_TEXT', 'DECK_EXCEEDS_TARGET']));
    expect(Object.keys(result.error.setup!.byStage)).toEqual(expect.arrayContaining(['mapping', 'uniqueness', 'deckSize']));
    // No game was dealt.
    expect(c.getView()).toMatchObject({ ok: false, error: { code: 'NO_GAME_STARTED' } });
  });

  it('the trusted diagnostics sink receives the full, unsanitized issues', () => {
    const diagnostics: TrustedDiagnostic[] = [];
    const c = controllerFor('solitaire', 1, { diagnostics: (d) => diagnostics.push(d) });
    const { deck, matrix } = secretDeck();
    c.startNextGame({ deck, contextualValidity: matrix });
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]!.operation).toBe('startNextGame');
    const full = JSON.stringify(diagnostics[0]);
    expect(full).toContain('SECRET');
    expect(diagnostics[0]!.error.issues!.length).toBe(
      (c.startNextGame({ deck, contextualValidity: matrix }) as { error: { setup: { issueCount: number } } }).error.setup.issueCount,
    );
  });

  it('a throwing diagnostics sink does not change the public result', () => {
    const c = controllerFor('solitaire', 1, {
      diagnostics: () => {
        throw new Error('logger down');
      },
    });
    const { deck, matrix } = secretDeck();
    expect(c.startNextGame({ deck, contextualValidity: matrix })).toMatchObject({ ok: false, error: { code: 'GAME_SETUP_INVALID' } });
    const good = sample('solitaire');
    expect(c.startNextGame({ deck: good.deck, contextualValidity: good.matrix }).ok).toBe(true);
  });

  it('every engine error code maps to a fixed message, never the engine text', () => {
    const codes = [
      'INVALID_MODE', 'MODE_NOT_IMPLEMENTED', 'INVALID_OPTION', 'GAME_ENDED', 'WRONG_PHASE', 'PLAYER_NOT_IN_MODE',
      'NOT_PLAYERS_TURN', 'CARD_NOT_IN_HAND', 'INVALID_ACTION_KIND', 'MISSING_CHALLENGE', 'UNEXPECTED_CHALLENGE',
      'UNKNOWN_CHALLENGE', 'CHALLENGE_ALREADY_SOLVED', 'INVALID_DECISION', 'MALFORMED_REQUEST', 'SERIES_OUTCOME_MISMATCH',
      'SERIES_OUTCOMES_EXCESSIVE', 'GAME_IN_PROGRESS', 'SERIES_COMPLETE', 'NO_GAME_STARTED', 'STRATEGY_RESULT_INVALID', 'ENGINE_FAULT',
    ] as const;
    for (const code of codes) {
      const result = toPublicError({ code, message: 'leak SECRET-card-3 answers SECRET-challenge-1' });
      expect(result.code).toBe(code);
      expect(result.message).not.toContain('SECRET');
      expect(result.message.length).toBeGreaterThan(0);
      expect(Object.keys(result)).toEqual(['code', 'message']);
    }
  });

  it('UNKNOWN_HANDLE is reported as CARD_NOT_IN_HAND so handles cannot be probed', () => {
    expect(toPublicError({ code: 'UNKNOWN_HANDLE', message: 'x' })).toEqual({
      code: 'CARD_NOT_IN_HAND',
      message: "That card is not in the acting player's hand.",
    });
    const c = controllerFor('solitaire');
    const s = sample('solitaire');
    okResult(c.startNextGame({ deck: s.deck, contextualValidity: s.matrix }));
    expect(c.submitHumanAction({ kind: 'discard', handle: 'hzzzzzzz' })).toMatchObject({ ok: false, error: { code: 'CARD_NOT_IN_HAND' } });
  });

  it('a strategy fault message is not exposed', () => {
    const c = createSeriesController({
      mode: 'vsBeepy',
      seed: 1,
      options: sample('vsBeepy').options,
      beepyStrategy: { chooseAction: () => { throw new Error('SECRET-internal-detail'); } },
    });
    if (!c.ok) throw new Error('setup');
    const s = sample('vsBeepy');
    const key = answerKey(s.deck);
    const v0 = okResult(c.controller.startNextGame({ deck: s.deck, contextualValidity: s.matrix })).view;
    okResult(c.controller.submitHumanAction(validHumanAction(v0, key)));
    const result = c.controller.advanceBeepy();
    expect(result).toMatchObject({ ok: false, error: { code: 'ENGINE_FAULT' } });
    expect(JSON.stringify(result)).not.toContain('SECRET');
  });
});

describe('malformed untyped human requests (correction 2)', () => {
  const s = sample('solitaire');
  const fresh = (): SeriesController => {
    const c = controllerFor('solitaire', 5);
    okResult(c.startNextGame({ deck: s.deck, contextualValidity: s.matrix }));
    return c;
  };
  const validHandle = (c: SeriesController): string => okResult(c.getView()).view.hand[0]!.handle;
  const hostileToString = { toString: () => { throw new Error('boom'); } };
  const throwingGetter = Object.defineProperty({}, 'handle', { get: () => { throw new Error('trap'); }, enumerable: true });
  (throwingGetter as Record<string, unknown>)['kind'] = 'discard';

  const cases: ReadonlyArray<readonly [string, (c: SeriesController) => unknown, string]> = [
    ['null', () => null, 'MALFORMED_REQUEST'],
    ['undefined', () => undefined, 'MALFORMED_REQUEST'],
    ['a number', () => 7, 'MALFORMED_REQUEST'],
    ['a string', () => 'discard', 'MALFORMED_REQUEST'],
    ['an array', () => ['discard', 'h1'], 'MALFORMED_REQUEST'],
    ['a missing kind', (c) => ({ handle: validHandle(c) }), 'MALFORMED_REQUEST'],
    ['a numeric kind', (c) => ({ kind: 1, handle: validHandle(c) }), 'MALFORMED_REQUEST'],
    ['an unknown kind', (c) => ({ kind: 'throw', handle: validHandle(c) }), 'INVALID_ACTION_KIND'],
    ['a missing handle', () => ({ kind: 'discard' }), 'MALFORMED_REQUEST'],
    ['a numeric handle', () => ({ kind: 'discard', handle: 5 }), 'MALFORMED_REQUEST'],
    ['an empty handle', () => ({ kind: 'discard', handle: '' }), 'MALFORMED_REQUEST'],
    ['an object handle with a throwing toString', () => ({ kind: 'discard', handle: hostileToString }), 'MALFORMED_REQUEST'],
    ['a symbol handle', () => ({ kind: 'discard', handle: Symbol('h') }), 'MALFORMED_REQUEST'],
    ['a handle that only coerces to a real one', (c) => ({ kind: 'discard', handle: { toString: () => validHandle(c) } }), 'MALFORMED_REQUEST'],
    ['a numeric challengeId', (c) => ({ kind: 'play', handle: validHandle(c), challengeId: 0 }), 'MALFORMED_REQUEST'],
    ['an empty challengeId', (c) => ({ kind: 'play', handle: validHandle(c), challengeId: '' }), 'MALFORMED_REQUEST'],
    ['an object challengeId', (c) => ({ kind: 'play', handle: validHandle(c), challengeId: { id: 'challenge-0' } }), 'MALFORMED_REQUEST'],
    ['a throwing getter', () => throwingGetter, 'MALFORMED_REQUEST'],
  ];

  it.each(cases)('%s gives a structured failure, never a throw, and changes nothing', (_name, build, code) => {
    const c = fresh();
    const before = JSON.stringify(c.getView());
    const request = build(c);
    let result: ControllerResult | undefined;
    expect(() => {
      result = c.submitHumanAction(request as never);
    }).not.toThrow();
    expect(result).toMatchObject({ ok: false, error: { code } });
    expect(JSON.stringify(c.getView())).toBe(before);
    expect(c.getPublicEvents().filter((e) => e.type !== 'GAME_STARTED')).toEqual([]);
  });

  it('a well-formed request still works after malformed ones', () => {
    const c = fresh();
    c.submitHumanAction(null as never);
    c.submitHumanAction({ kind: 'discard', handle: 5 });
    const key = answerKey(s.deck);
    const result = okResult(c.submitHumanAction(validHumanAction(okResult(c.getView()).view, key)));
    expect(result.view.turnCount).toBe(1);
  });

  it.each([null, 3, 'Accept', 'ACCEPT', {}, undefined])('decide(%j) is INVALID_DECISION, not a throw', (decision) => {
    const c = controllerFor('vsBeepy');
    const v = sample('vsBeepy');
    okResult(c.startNextGame({ deck: v.deck, contextualValidity: v.matrix }));
    expect(c.decide(decision)).toMatchObject({ ok: false, error: { code: 'INVALID_DECISION' } });
  });

  it.each([null, 5, 'deck'])('startNextGame(%j) is a structured failure', (setup) => {
    const c = controllerFor('solitaire');
    expect(c.startNextGame(setup as never)).toMatchObject({ ok: false, error: { code: 'MALFORMED_REQUEST' } });
  });
});

describe('series flow through the controller', () => {
  it('runs a full five-game Solitaire session and refuses a sixth', () => {
    const c = controllerFor('solitaire', 31);
    const s = sample('solitaire');
    const key = answerKey(s.deck);
    for (let game = 1; game <= 5; game += 1) {
      expect(okResult(c.startNextGame({ deck: s.deck, contextualValidity: s.matrix })).view.gameIndex).toBe(game);
      expect(c.startNextGame({ deck: s.deck, contextualValidity: s.matrix })).toMatchObject({ ok: false, error: { code: 'GAME_IN_PROGRESS' } });
      playToEnd(c, key, 3);
    }
    const status = c.getSeriesStatus();
    expect(status).toMatchObject({ ok: true, status: { kind: 'session', complete: true, gamesCompleted: 5 } });
    if (status.ok) {
      expect(status.status.sessionScore).toBe(status.status.gameScores!.reduce((a, b) => a + b, 0));
    }
    expect(c.startNextGame({ deck: s.deck, contextualValidity: s.matrix })).toMatchObject({ ok: false, error: { code: 'SERIES_COMPLETE' } });
  });

  it('runs a competitive match to a decision with alternating first players', () => {
    const c = controllerFor('vsBeepy', 41, { errorRate: 0.3 });
    const s = sample('vsBeepy');
    const key = answerKey(s.deck);
    const firsts: string[] = [];
    let complete = false;
    while (!complete) {
      const started = okResult(c.startNextGame({ deck: s.deck, contextualValidity: s.matrix }));
      firsts.push(started.view.activePlayer);
      playToEnd(c, key);
      const status = c.getSeriesStatus();
      if (!status.ok) throw new Error(status.error.code);
      complete = status.status.complete;
    }
    expect(firsts).toEqual(['human', 'beepy', 'human', 'beepy', 'human'].slice(0, firsts.length));
    expect(c.startNextGame({ deck: s.deck, contextualValidity: s.matrix })).toMatchObject({ ok: false, error: { code: 'SERIES_COMPLETE' } });
  });

  it('refuses actions before a game is started', () => {
    const c = controllerFor('vsBeepy');
    expect(c.getView()).toMatchObject({ ok: false, error: { code: 'NO_GAME_STARTED' } });
    expect(c.submitHumanAction({ kind: 'discard', handle: 'h' })).toMatchObject({ ok: false, error: { code: 'NO_GAME_STARTED' } });
    expect(c.advanceBeepy()).toMatchObject({ ok: false, error: { code: 'NO_GAME_STARTED' } });
  });

  it('Solitaire has no Beepy', () => {
    const c = controllerFor('solitaire');
    const s = sample('solitaire');
    okResult(c.startNextGame({ deck: s.deck, contextualValidity: s.matrix }));
    expect(c.advanceBeepy()).toMatchObject({ ok: false, error: { code: 'PLAYER_NOT_IN_MODE' } });
  });

  it('rejects bad configuration with structured errors', () => {
    expect(createSeriesController({ mode: 'tutor', seed: 1 })).toMatchObject({ ok: false, error: { code: 'MODE_NOT_IMPLEMENTED' } });
    expect(createSeriesController({ mode: 'other', seed: 1 })).toMatchObject({ ok: false, error: { code: 'INVALID_MODE' } });
    expect(createSeriesController({ mode: 'solitaire', seed: Number.NaN })).toMatchObject({ ok: false, error: { code: 'INVALID_OPTION' } });
    expect(createSeriesController({ mode: 'vsBeepy', seed: 1 })).toMatchObject({ ok: false, error: { code: 'INVALID_OPTION' } });
    expect(createSeriesController(null as never)).toMatchObject({ ok: false, error: { code: 'INVALID_OPTION' } });
  });
});

describe('deterministic replay through the controller (clarification 2a-B)', () => {
  function run(seed: number): unknown[] {
    const c = controllerFor('vsBeepy', seed, { errorRate: 0.3 });
    const s = sample('vsBeepy');
    const key = answerKey(s.deck);
    const log: unknown[] = [];
    log.push(c.startNextGame({ deck: s.deck, contextualValidity: s.matrix }));
    // Interleave failed requests: they must not change anything.
    log.push(c.submitHumanAction({ kind: 'discard', handle: 42 }));
    log.push(c.decide('accept'));
    log.push(...playToEnd(c, key, 4));
    log.push(c.getSeriesStatus(), c.getPublicEvents());
    return log;
  }

  it('the same seed and request sequence give identical views and events', () => {
    expect(run(77)).toEqual(run(77));
  });

  it('a different seed gives a different game', () => {
    expect(JSON.stringify(run(77))).not.toBe(JSON.stringify(run(78)));
  });

  it('failed requests between steps do not change the replay', () => {
    const plain = controllerFor('solitaire', 12);
    const noisy = controllerFor('solitaire', 12);
    const s = sample('solitaire');
    const key = answerKey(s.deck);
    okResult(plain.startNextGame({ deck: s.deck, contextualValidity: s.matrix }));
    okResult(noisy.startNextGame({ deck: s.deck, contextualValidity: s.matrix }));
    for (let i = 0; i < 4; i += 1) {
      noisy.submitHumanAction({ kind: 'nope', handle: 'x' });
      noisy.submitHumanAction({ kind: 'discard', handle: 'hzzzzzzz' });
      const a = okResult(plain.submitHumanAction(validHumanAction(okResult(plain.getView()).view, key)));
      const b = okResult(noisy.submitHumanAction(validHumanAction(okResult(noisy.getView()).view, key)));
      expect(b).toEqual(a);
      if (a.view.phase === 'ended') break;
    }
  });
});

describe('sanity: the fixture-cloning helpers used above are inert', () => {
  it('cloneDeck and cloneMatrix give independent copies', () => {
    const s = sample('solitaire');
    const d = cloneDeck(s.deck);
    const m = cloneMatrix(s.matrix);
    d.answerCards[0]!.displayValue = 'changed';
    m['challenge-0']!['correct-0'] = false;
    expect(s.deck.answerCards[0]!.displayValue).not.toBe('changed');
    expect(s.matrix['challenge-0']!['correct-0']).toBe(true);
  });
});
