# Shared Game Engine — Design (revision 2a, approved)

## Principles

- **Pure and deterministic.** Pure functions over immutable engine-private state.
  Randomness is an explicit `RngState` threaded through state. No `Math.random`,
  clocks, I/O, or DOM.
- **Reuse M2, never modify it.** Setup composes `validateChallengeMapping`,
  `validateUniqueness`, `validateDeckSize`, `checkStartingHandFeasibility`,
  `checkDualHandFeasibility`, `validateStartingHand`, `validateDualStartingHands`;
  penalties use `drawPenaltyCards`. M2 has no single validate-everything function,
  so M3 adds `validateDeckForPlay` as new code.
- **Results, not exceptions.** Failures are structured; illegal requests never
  mutate state.
- **Private by construction.** The authoritative state lives only in the controller.

## Modules (`shared-engine/src/game/`)

| Module | Responsibility |
|---|---|
| `random.ts` | `RngState`, `nextUint32`, `nextInt`, `nextFloat`, `shuffle`, `deriveSeed` (pure) |
| `types.ts` | `EngineState`, `PlayerId`, requests, events, outcomes, error codes |
| `deck-gate.ts` | `validateDeckForPlay` |
| `deal.ts` | deal hands, shuffle pile, assign handles, re-validate |
| `judge.ts` | pure play/discard validity and request checking |
| `penalty.ts` | `applyPenaltyEvent` around `drawPenaltyCards` |
| `game.ts` | shared pure core: create, submit, evaluate, resolve |
| `solitaire.ts` | Solitaire end detection and scoring |
| `competitive.ts` | winner decision, penalty mapping |
| `view.ts` | sanitized views, public event projection |
| `beepy-strategy.ts` | replaceable strategy and reference implementation |
| `controller.ts` | trusted series (session/match) controller |
| `index.ts` | public exports |

Pure core functions are not exported from the package index. Exported:
controller factory, view and event types, strategy types, random helpers, and the
gate result types. Tests import internals by relative path. No `tutor.ts` in M3.

## Modes
`createGame(mode: unknown, ...)`: `solitaire`/`vsBeepy` proceed; `tutor`/`vsPlayer`
give `MODE_NOT_IMPLEMENTED`; other values give `INVALID_MODE`. No default branch.

## Initialization gate
`validateDeckForPlay(deck, mode, matrix, { numericAnswers })` collects all issues:
1. defensive shape check (stops later stages if the shape is unusable);
2. `validateChallengeMapping(deck, matrix)`;
3. `validateUniqueness(deck, { numericAnswers })`;
4. `validateDeckSize(deck, mode)`;
5. feasibility: single-hand or dual-hand.
Then dealing, `validateStartingHand` / `validateDualStartingHands`, and
`validateUniqueness` over zones `hands`, `drawPile`. Failure returns one
`GAME_SETUP_INVALID` with all issues. Nothing is repaired.

## Engine-private state
Plain immutable data: `mode, phase ('awaitingAction'|'awaitingEvaluation'|'ended'),
gameIndex, firstPlayer, activePlayer, turnCount`, the deck and matrix, `cards`,
`handleByCard`/`cardByHandle`, `hands`, `drawPile`, `discard`, `played`,
`solvedBy`, `pending`, `stats`, `history`, `outcome`, `rng`, `beepyRng`.
Players: `human`, `beepy`. No stored round.

## Randomness across transitions (clarification B)
`RngState` is a 32-bit number. `nextUint32(rng) → [value, rng']` (mulberry32 step);
`shuffle(items, rng) → [items', rng']` (Fisher-Yates, rejection-free bias-free for
these sizes via `nextInt`). Streams are derived per game with
`deriveSeed(seed, gameIndex, stream)` for `deal`, `engine`, `beepy`, so streams are
independent. Every transition returns the updated streams in the new state; failed
requests return the old state untouched. The strategy takes and returns an
`RngState`. Replay: same seed, decks, options, and request sequence give identical
output; tested twice per scenario.

## Privacy: the trusted controller (clarification A)
`createSeriesController(config)` returns an object of closures. It holds the
`EngineState` and exposes **no** getter for it. Methods return
`{ ok: true, view, events }` or `{ ok:false, error }`:
`startNextGame(setup)`, `getView()`, `submitHumanAction(req)`, `decide(decision)`,
`advanceBeepy()`, `getSeriesStatus()`. The UI cannot submit Beepy actions;
`advanceBeepy` asks the configured strategy. Views and events are freshly built
plain data. Tests check: no state-bearing property, content scans for hidden
values, and that mutating a returned view does not affect the game.

**Handles.** Each card has an opaque handle: `h` plus a token drawn from the engine
`rng`, unique per game. Fallback cards get tokens when accepted, so a handle does
not reveal origin, position, or correctness.

**PlayerView:** own hand `{handle, displayValue}`; opponent hand count; challenges
`{id, promptText, status, solvedBy?, played?}`; discard pile; draw-pile size; turn
count; whose turn; phase; pending `{player, handle, displayValue, destination}`;
outcome once ended; series status. **Public events:** `GAME_STARTED`,
`ACTION_PENDING` (card, destination), `ACTION_RESOLVED` (adds validity and decision),
`CHALLENGE_SOLVED` (credit, `sourceRef`), `PENALTY_DRAWN` (face only to the drawer),
`PENALTY_WAIVED` (counts only), `GAME_ENDED`.

## Turn processing
`submitAction({player, kind, handle, challengeId?})` validates the request (illegal
requests change nothing), judges, then: Solitaire and human actions resolve now; a
Beepy action becomes `pending` (phase `awaitingEvaluation`). `evaluatePending(
'accept'|'challenge')` resolves via the §7 table.

### Resolution order (Requirement 7.2)
1. Move cards. 2. Count the turn. 3. **End check** (empty hand, all solved): if
ended, stop with no penalty draw. 4. Build owed penalty requests and call
`applyPenaltyEvent` (atomic, waived on exhaustion). 5. Safety re-check. 6. Advance
the active player.

| Event | Draws owed |
|---|---|
| Solitaire invalid action | human 1 |
| vsBeepy human invalid action | human 1 |
| Beepy valid, human Challenges | human 1 (`WRONG_CHALLENGE`) |
| Beepy invalid, human Challenges | Beepy 1 |
| Beepy invalid, human Accepts | human 1 (`MISSED_CHALLENGE`) and Beepy 1, atomic |

## Dealing
Shuffle correct and distractor ids; per hand choose k in {2,3} (feasibility via
`canSupplyHands`); fill with distractors; shuffle the hand; shuffle the remainder
into the draw pile (top = index 0); assign handles; verify with M2 validators.

## Scoring and series
Solitaire score = `turnCount + hand.length`. Competitive: empty hand, else fewer
cards, else more credit, else `ENGINE_FAULT` (pure `decideCompetitiveWinner`, unit
tested directly). `firstPlayerForGame(n)` = human for odd n, Beepy for even n.
Match best of five, first to three; session exactly five games. Each game's seeds
derive from the series seed and game index. No turn cap.

## Beepy strategy (D-2)
`BeepyStrategy.chooseAction(input, rng) → { action, rng }`. Input: Beepy's own hand
(handles and faces), open challenge ids, and a read-only `judge`. Reference
strategy: with probability `errorRate` ([0, 1], validated) propose a legal invalid
action; otherwise a valid play (preferred) or valid discard; if a class is empty,
use the other. Never an illegal request; cannot mutate state; `errorRate = 1` with
exhausted penalties can loop forever, so apps use a rate below 1.

## Simulation
Seeded harness over `solitaire` and `vsBeepy` and all four (style, direction)
combinations asserting after every step: uniqueness over all zones, conservation,
one answer per challenge, hand sizes, solved challenges only with their card, and
no leakage in views. **Test-only step limit** (for example 2,000) detects
nontermination; it is not an engine rule. Agents are progress-making: invalid
probability below 0.5, plus a stall guard forcing a valid action after three
consecutive turns without hand-size or solved-count change (the signature of
waived penalties). A valid action always exists for a non-empty hand. Exhaustion
scenarios run to completion, and a test shows an always-invalid agent does not
terminate without the guard.

## Decisions (resolved)
D-1 seeded deterministic randomness. D-2 replaceable Beepy strategy, independent
judge. D-3 alternating first player. D-4 Tutor deferred. D-5 Continue deferred.
D-6 played cards stay attached. Approved addition: opaque handles.
