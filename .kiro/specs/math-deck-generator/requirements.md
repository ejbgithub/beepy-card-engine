# Beepy Math Cards Deck Generator — Requirements (revision 3)

**Milestone:** M4 — Math-specific deck generator for the completed M3 engine
(master spec §10, §18 phase 3 "Math Solitaire", and the Math side of phase 5).
Follows M3 (shared game engine), which is accepted.

**Scope boundary (specification only):** These documents define what M4 will
build and verify. They do not authorize implementation. All tasks stay unchecked
until the owner gives final approval.

**Revision 2** applies the owner's four corrections and provisional decisions:
1. Plan deck size from the actual eligible distractor pool, after the challenges
   are chosen.
2. Correct the one-digit deck-size expectations per direction.
3. Support only Solitaire and Player vs. Beepy.
4. Take the Solitaire minimum from the M2 planner, not a hard-coded count.

**Revision 3** records these owner decisions:
- the M4-2 ranges are approved for version 1;
- zero is never a distractor;
- the `subjectToFact` prompt wording is approved;
- 24 cards is a competitive target, not a guarantee, so sizes come from the actual
  eligible pool.

## Introduction

Build the Math generator in `math-cards/`. It produces real second-grade addition
challenges, unique answer cards, and the complete contextual-validity matrix, as
one validated deck per game. It plugs into the M3 trusted controller through a
thin Math series wrapper, so the next milestone (UI) can make Beepy's Math Cards
playable without further engine or generator work.

Authoritative references: `docs/master-spec-v1.1.md` §3, §4, §7, §9, §10, §12,
§16; `.kiro/specs/educational-data-schema/` (M2: Task 7 matrix, D6a, D8, and the
deferred generator decision); `.kiro/specs/game-engine/` (M3: controller and
privacy boundary); steering `architecture.md`, `no-duplicate-card-invariant.md`,
`educational-data-independence.md`, `originality-and-copyright.md`,
`verified-work-only.md`.

## Out of scope for M4

- The browser UI, layout, animation, input handling, and the UI framework choice.
- **Tutor** generation and gameplay, and **Player vs. Player**. Both are rejected
  with structured unsupported-mode failures (Requirement 2).
- Subtraction, multiplication, division, three-number addition (master spec §10).
- Controlled repetition, persistence, local history.
- Showing explanations or feedback text (a UI-milestone concern).
- Clinical generation. The Clinical stub changes only as far as the shared
  interface change requires.
- New dependencies, Git, `npm audit fix`.

## Requirements

### Requirement 1 — Difficulty levels
**User story:** As a second-grade player, I want problems at my level, so that the
game is neither trivial nor overwhelming.

1. The generator SHALL support the levels in design decision M4-2: one-digit +
   one-digit, one-digit + two-digit, two-digit + two-digit, and `mixed`, which
   draws each challenge from the other three.
2. Each level SHALL define, in one place, its operand ranges, its maximum sum, and
   its plausible distractor range. An unknown level SHALL be a structured failure.
3. Every challenge SHALL add exactly two operands within the level's ranges (M4-2,
   approved for version 1):
   - no sum SHALL exceed 99;
   - two-digit operands SHALL be 10–89;
   - no operand SHALL be zero.
4. Zero SHALL NOT appear as a distractor. That covers numeric distractors, numeric
   penalty-fallback values, and any operand of an expression distractor or
   expression fallback.

### Requirement 2 — Modes and challenge counts
1. The generator SHALL support exactly two modes: `solitaire` (five challenges)
   and `vsBeepy` (nine shared challenges). The counts come from M2
   `expectedChallengeCount`, not from a Math copy.
2. `tutor` and `vsPlayer` SHALL be rejected with the structured code
   `MODE_NOT_SUPPORTED`. They are never treated as Solitaire or as any other mode.
3. Any other mode value SHALL be rejected with `INVALID_MODE`.

### Requirement 3 — Deck size, planned from the actual pool
1. The generator SHALL plan the deck size in this order:
   1. choose the mode's challenges, with distinct correct answers;
   2. build the actual eligible distractor pool. It excludes every active correct
      answer and every value or expression that is valid for any active challenge
      (including equivalent expressions such as commuted operands), and every
      duplicate display;
   3. only then call the M2 deck-size planner with the true counts:
      `availableCorrect` = the number of challenges, and `availableDistractors` =
      the size of the eligible pool.
   The pool SHALL NOT be estimated before the challenges are chosen, and values
   that become correct answers SHALL NOT be counted as distractors.
2. Competitive Math SHALL use the existing 24-card target (9 correct + 15
   distractors) through `planMathCompetitiveDeckSize`. **24 is a target, not a
   guarantee.** The actual eligible pool decides the size. When the pool holds fewer
   than 15 distractors, the M2 planner's smaller validated deck is used, never
   padded with implausible values. This can happen in either direction: for
   example, one-digit `factToSubject` always gives 20 cards, and one-digit
   `subjectToFact` gives 21 to 24 depending on the chosen sums.
3. Solitaire SHALL use the default target in M4-5 (15 cards), configurable.
4. The minimum deck size and the starting-hand composition SHALL come from the
   existing M2 planner and feasibility checks (`planDeckSize`,
   `minimumDistractors`, `canSupplyHands`, and the starting-hand validators). M4
   SHALL NOT hard-code a minimum card count.
5. A deck SHALL never exceed its target (M2: the target is a ceiling).
6. If the planner reports that the actual pool cannot support the mode, the
   generator SHALL return the planner's structured issue, not a deck.

### Requirement 4 — Correctness and uniqueness
1. Every challenge SHALL have exactly one designated correct card, and no two
   challenges SHALL share a correct card.
2. No two cards in a deck SHALL share a display value (numerically in
   `factToSubject`, as normalized text in `subjectToFact`), and no card id SHALL
   repeat.
3. All active challenges SHALL have distinct correct sums, in both directions.
4. Every distractor SHALL be incorrect for every active challenge, and every
   correct card SHALL be correct only for its own challenge.
5. No ambiguous card SHALL remain. The matrix (Requirement 6) must show exactly one
   valid card per challenge and at most one challenge per card.

### Requirement 5 — Plausible distractors
1. Distractors SHALL lie inside the level's plausible range (Requirement 1.2).
2. Distractors SHALL prefer believable near-misses of the active answers (design
   "Distractor selection"), chosen deterministically.
3. Easy levels SHALL NOT be padded with absurd values to reach a count.

### Requirement 6 — Contextual-validity matrix
1. The generator SHALL return the complete matrix required by M2 Task 7: an
   explicit boolean for every (challenge, card) pair.
2. Each entry SHALL be computed from the arithmetic itself, independently of the
   designation, so the M2 validator can catch a generator defect rather than
   echo it.

### Requirement 7 — Generation directions
1. `factToSubject` (Math default): the challenge shows an addition problem; the
   card shows its sum. Example from master spec §9: `3 + 4 = ?` → `7`.
2. `subjectToFact` (M4-3, approved): the challenge asks "Which addition expression
   equals 7?" and the card shows an addition expression such as "3 + 4". A card is
   valid exactly when its sum equals the target.
3. Both directions SHALL produce decks that pass every M2 deck check and start an
   M3 game. Direction is configuration, not a separate schema.
4. The generator SHALL report how values compare (`factToSubject`: numeric;
   `subjectToFact`: text), so the M3 gate and the penalty fallback agree.
5. Deck sizes SHALL be planned per direction from that direction's actual pool
   (Requirement 3). The two directions may therefore produce different sizes for
   the same level.

### Requirement 8 — Determinism
1. Generation SHALL be a pure function of its request, including an injected seed.
   It SHALL use the M3 seeded random helpers and never `Math.random`, the clock,
   or module-level state.
2. The same request SHALL give an identical deck and matrix; different seeds SHALL
   generally give different decks.
3. Each game of a session or match SHALL use its own generator seed, derived from
   the series seed and the game index (M4-8) without touching the engine's streams.

### Requirement 9 — Reuse, not duplication
1. The generator SHALL NOT deal hands. Dealing stays in M3; the generator only
   guarantees the deck is dealable through the M2 checks.
2. The generator SHALL validate its output with the exported M3 deck gate
   `validateDeckForPlay` (M4-6) before returning it. It SHALL NOT re-implement or
   relax any M2 or M3 rule.
3. M2 and M3 production code SHALL change only where an approved decision says so:
   M4-1 (generator interface and the Clinical stub's return type) and M4-6 (the
   gate export and the API lock). Every such change is recorded in the log.

### Requirement 10 — Structured results
1. `generate` SHALL return either a complete, validated deck with its matrix, or a
   structured failure listing every issue found. It SHALL NOT throw for bad
   requests and SHALL NOT return a partial or unvalidated deck.
2. Request problems (unsupported or unknown mode, unknown level or direction,
   invalid seed or target) SHALL be structured issues with stable codes.

### Requirement 11 — Engine integration and privacy
1. A Math series wrapper in `math-cards/` SHALL own the M3 controller and the
   generator. For each game it generates a deck and passes it to
   `controller.startNextGame` inside the trusted layer.
2. The wrapper SHALL expose only what the M3 controller exposes: sanitized views,
   public events, public errors, and series status. Decks, matrices, designated
   answers, generator seeds, and generator diagnostics SHALL NOT be returned to the
   UI layer.
3. M3 views show challenge ids, so generated challenge ids SHALL NOT encode the
   answer, the operands, or the sum. Card ids are hidden behind M3 handles but SHALL
   also carry no correctness hint.
4. Generator failures reach the UI only as a fixed public code and message. Full
   issues go to the trusted diagnostics callback.
5. The wrapper SHALL pass `numericAnswers` from the generator. It SHALL configure
   the penalty fallback per direction: the existing numeric provider for
   `factToSubject`, and the new expression provider for `subjectToFact` (M4-4).
6. The Beepy error rate SHALL be configurable, with a default of 0.2 (M4-10).

### Requirement 12 — Testing and evidence
1. Automated tests SHALL cover:
   - level bounds and the 99 cap;
   - mode support and rejection;
   - planning order (sizes derived from the actual eligible pool);
   - deck sizes per direction, each compared with an independently calculated
     eligible pool size for the same challenges. No test SHALL assume a 24-card
     deck;
   - no zero operand and no zero distractor;
   - the ceiling, and minimums as reported by the M2 planner;
   - distinct sums and one correct card per challenge;
   - matrix completeness and arithmetic correctness;
   - distractor plausibility and incorrectness;
   - both directions, determinism, and structured failures, with no deck on any
     failure.
2. Integration tests SHALL start M3 games from generated decks for both modes,
   every level, and both directions over many seeds. They SHALL also play full
   games through the Math series wrapper to completion, with a test-only step
   limit, asserting the M3 invariants and that views leak nothing.
3. The two Math-generator `it.todo` in M2 Task 16 SHALL become real tests (M4-9).
   The other Task 16 todos, the Task 18 todos, and Task 16's unchecked status are
   left untouched.
4. Existing M2 and M3 tests SHALL NOT be weakened. The API-surface lock changes
   only for the approved M4-6 export, and the change is reported.
5. The development log SHALL record only witnessed work.
