# Shared Game Engine — Requirements (revision 2a, approved)

**Milestone:** M3 — Subject-neutral gameplay engine for **Solitaire** and
**Player vs. Beepy** (master spec §18, phases 3 and 5, engine portion). Follows M2,
which is accepted. Revision 2 and clarifications 2a are approved by the owner.

## Introduction

Build the subject-neutral engine that runs a game from a **validated**
`GeneratedDeck` (M2 contract): players, hands, zones, the turn and evaluation
lifecycle, play/discard judging, penalties, game ending, scoring, sessions and
matches, sanitized player views, and an event history. No DOM, UI framework,
subject data, or runtime generation. Math Cards and Clinical Cards use it unchanged.

References: `docs/master-spec-v1.1.md` §2–§7, §14, §16; steering
(`architecture`, `no-duplicate-card-invariant`, `educational-data-independence`,
`verified-work-only`); M2 modules.

## Terminology (master spec §2, unchanged)

- **Turn:** one active player's attempt to play or discard, plus any
  challenge/evaluation and penalty resolution. A failed action is one turn.
- **Round:** one cycle of player turns. Descriptive only: not a scoring unit and
  not a stored structure. In Solitaire a round and a turn coincide. In competitive
  games a display-only `roundNumber` may be derived; it never affects rules.
- **Game:** one newly dealt board and hand(s), ending on a specified condition. The
  engine's unit of play and of scoring.
- **Session (Solitaire):** five games with cumulative scoring.
- **Match (competitive):** best of five games, first to three wins.

Solitaire scores **turns**, not rounds.

## Out of scope for M3

UI; **Tutor gameplay and its Continue step** (deferred; see Requirement 13); real
generators; persistence and controlled repetition; `vsPlayer`; any gameplay turn
cap; invented clinical content; new dependencies, Git, `npm audit fix`.

## Requirements

### Requirement 1 — Initialization and validation gate
1. `createGame` SHALL accept a mode, a `GeneratedDeck`, the generator-supplied
   **complete contextual-validity matrix**, a seed, and options, and SHALL return a
   structured result. It SHALL NOT throw for bad input.
2. Supported modes: `solitaire`, `vsBeepy`. `tutor` and `vsPlayer` SHALL be rejected
   with `MODE_NOT_IMPLEMENTED` (Tutor never runs as Solitaire). Anything else:
   `INVALID_MODE`.
3. A deck SHALL NOT be assumed valid because it is typed. Before dealing, the
   engine SHALL run and require success of every M2 check that applies to a deck: a
   defensive shape check; challenge mapping and ambiguity elimination with the
   complete matrix (a missing matrix is `CONTEXTUAL_VALIDITY_MISSING`); global
   uniqueness; deck-size rules for the mode; starting-hand feasibility. Source-data
   structure/identifier stages apply to source collections the engine never sees.
4. After dealing, it SHALL validate the dealt hand(s) and re-check uniqueness over
   the dealt zones. Any failure aborts the game. No repair, regeneration, or
   relaxation.
5. All issues SHALL be reported together as `GAME_SETUP_INVALID`.
6. M2 production code SHALL NOT be modified; gaps are reported to the owner.
7. Hands: 5 distinct cards, 2 or 3 designated-correct, dealt with the seeded random
   source and shuffled so order never reveals correctness; competitive hands do not
   overlap; the rest is a shuffled draw pile. Zones: hands, draw pile, played
   (attached to challenges), discard pile.
8. **Determinism.** Randomness is threaded as explicit `RngState` inside the
   immutable state: the same seed, decks, matrices, options, and action sequence
   reproduce identical results, with no uncontrolled mutable random state.
9. Across all zones the cards SHALL equal the deck's cards plus accepted fallback
   cards (conservation) and no display value SHALL repeat.

### Requirement 2 — Judging
1. A **play** is valid only if the challenge is unsolved and the card is its
   `correctAnswerCardId`.
2. A **discard** is valid only if the card is the designated correct card of no
   remaining unsolved challenge.
3. Judging is pure and deterministic and never uses Beepy behavior or AI.
4. An action naming a card not in the acting hand, an unknown challenge, an
   **already-solved challenge**, or a player/phase that cannot act is a structured
   **illegal request**: no state change, no turn, no penalty.
5. A successfully played correct card remains attached to the challenge it just
   solved for the rest of the game (D-6) and never returns to a hand or pile.

### Requirement 3 — Valid and invalid actions
1. Valid play: remove from hand, attach to the challenge, mark solved, credit one
   player (competitive).
2. Valid discard: card goes to the discard pile.
3. Invalid action: the card stays in the same hand and one penalty draw is owed to
   the acting player.
4. Every judged action is exactly one turn.

### Requirement 4 — Penalties
1. Draws use `drawPenaltyCards` (pile first, then the bounded fallback), one atomic
   event per resolution.
2. If unsupplied: no card drawn, `PENALTY_CARD_EXHAUSTED` recorded, the draw
   penalty waived, the game continues; no reuse or fabrication.
3. The engine decides which events owe draws.
4. Drawn cards join the owing player's hand. Fallback cards carry no explanation.

### Requirement 5 — Solitaire
1. Five challenges, one human hand, five-game session.
2. A game ends immediately when the hand is empty or all five challenges are
   solved, whichever occurs first (both at once is one ending).
3. Game score = turns + cards remaining in hand. Session = sum of five (lower is better).
4. Per-game counts of correct and incorrect plays and discards are kept apart from
   the score.

### Requirement 6 — Player vs. Beepy
1. Nine shared challenges, separate hands, solved challenges unavailable to both and
   credited to exactly one player.
2. Human first in Game 1; first player **alternates** each game (odd: human; even:
   Beepy) (D-3).
3. Human actions are judged immediately (Beepy as always-correct referee).
4. A Beepy action becomes **pending**, exposing only the attempted card and
   destination. The human then Accepts or Challenges (master spec §7):

   | Beepy move | Human | Outcome |
   |---|---|---|
   | Valid | Accept | Beepy removes the card |
   | Valid | Challenge | Beepy removes the card; human draws one |
   | Invalid | Challenge | Beepy keeps the card and draws one |
   | Invalid | Accept | Beepy keeps the card; both human and Beepy draw one |

5. The judge is independent of Beepy. A replaceable **Beepy strategy** (D-2)
   proposes actions with a configurable, seeded error rate; it reads the judge but
   never changes it.
6. A pending Beepy action does not reveal validity, an explanation, or other cards.

### Requirement 7 — Competitive game end
1. Either hand empty ends the game at once; that player wins.
2. The empty-hand check runs **before any further penalty draw** in the same
   resolution. A valid Beepy move emptying its hand while the human wrongly
   Challenges ends the game with a Beepy win and no human penalty is applied.
3. If all nine challenges are solved with no empty hand, fewer remaining cards
   wins; on a tie, more credited challenges wins.
4. Exactly one winner; an impossible tie is a structured `ENGINE_FAULT`.

### Requirement 8 — Sessions and matches
1. A Solitaire session holds five games; the caller supplies each deck and matrix.
2. A match is best of five, first to three, ending as soon as decided.
3. Starting a game outside the permitted sequence is a structured illegal request.
4. There is **no gameplay turn cap**.

### Requirement 9 — Private information and views
1. The authoritative `EngineState` and unredacted history SHALL be retained only by
   the **trusted application controller** (runtime closure). The controller exposes
   no accessor to them. The UI receives only sanitized player views and permitted
   public events. Type branding is not relied on as a privacy boundary.
2. A view contains: own hand faces; opponent hand count; challenge prompts,
   statuses, credit; discard pile and played cards (public); draw-pile **size**
   only; scores; turn/phase; the pending Beepy action's card and destination.
3. A view never contains: correctness, `correctAnswerCardId`, the matrix, draw-pile
   order/contents, opponent faces, pending validity, or pre-resolution explanations.
4. Views use engine-issued **opaque handles**, not derived from deck ids, order, or
   correctness.
5. Public events reveal judgments only after resolution; an opponent's penalty card
   is a count, not a face.
6. Views and events are plain serializable data.

### Requirement 10 — History
1. Append-only, engine-private history: deal, action, judgment, evaluation,
   penalty drawn/exhausted, challenge solved with credit, turn, game end, series
   progress, with card/challenge ids and `sourceRef`s.
2. A redacted public projection is derived for the UI. No persistence.

### Requirement 11 — Testing and evidence
1. Tests cover every master spec §16 item owned by Solitaire and Player vs. Beepy.
2. A seeded simulation plays many full games per mode and direction, asserting
   invariants after every step, with a **test-only step limit** and
   progress-making agents (design "Simulation").
3. The 4 engine-dependent Task 16 todos may be converted only with owner approval;
   Task 16 stays unchecked. Generator todos and Task 18 loader todos stay `it.todo`.
4. M2 tests are not weakened; M2 production code is unchanged. The API-surface
   lock is updated for the new exports and reported.
5. The development log records only witnessed work.

### Requirement 12 — Architecture
Lives in `shared-engine/`; no DOM, UI framework, subject data, runtime generation,
or new dependency. Randomness is a small in-house seeded generator (D-1).

### Requirement 13 — DEFERRED: Tutor lifecycle (later milestone)
Not implemented in M3; `createGame` rejects `tutor`.
1. Same board, hand, scoring, and five-game session as Solitaire, one student hand.
2. A student action is held pending without revealing validity, explanation,
   highlight, or penalty; the tutor Accepts or Challenges.
3. Movement and the student's normal penalty depend only on the student action's
   validity; the tutor's evaluation is recorded correct/incorrect and never adds a
   student penalty (master spec §6 table).
4. A Continue acknowledgement is required before the next turn (D-5, deferred).
5. Tutor accuracy is recorded separately from the student's score.
6. M3's pending-action mechanism and privacy design are built for reuse.
