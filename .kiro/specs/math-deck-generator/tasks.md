# Beepy Math Cards Deck Generator — Tasks (revision 3)

Scope: Solitaire and Player vs. Beepy only. Tutor and Player vs. Player are
rejected. All tasks are unchecked. Nothing is authorized until the owner gives
final approval. After approval the tasks run in
order; stop and ask only if a new architectural decision appears. Mark a task
complete only after its tests pass, and log each task when verified. No UI, no
dependencies, no Git, no `npm audit fix`.

- [x] G0. Owner final approval of revision 3 (granted 2026-11-11, M4-1 to M4-10)

- [x] G1. Generator interface (M4-1) (build, typecheck, 1450 passed; stub tests updated to the approved result behavior)
  - Add `GenerationResult`, `GenerationIssue`, and generic
    `DeckGenerator<TRequest>` to `shared-engine/src/generator.ts`; export the new
    types; change the Clinical stub to return a `NOT_IMPLEMENTED` failure
  - Tests: the Clinical stub returns a failure without throwing; the runtime API
    lock passes unchanged; full build and `typecheck:tests`
  - _Requirements 9.3, 10.1_

- [x] G2. Deck-gate export (M4-6 A) (API lock 80; 1452 passed)
  - Export `validateDeckForPlay` from `shared-engine`; update the API lock (79 →
    80) and remove the name from its engine-private list; report the change
  - Tests: API lock; existing M3 gate tests unchanged
  - _Requirement 9.2, 9.3_

- [x] G3. Levels and request validation (math-g3: 52/52 passed)
  - `levels.ts`, request checks in `math-generator.ts`
  - Tests:
    - each level's operand ranges, the 99 cap, no two-digit operand of 90–99, no
      zero operand, and the plausible range;
    - zero never appears as a distractor, a fallback value, or an expression
      operand;
    - `tutor` and `vsPlayer` give `MODE_NOT_SUPPORTED`; unknown modes give
      `INVALID_MODE`;
    - unknown level or direction, a non-finite seed, or an invalid target each give
      a structured issue, with no throw and no deck
  - _Requirements 1, 2, 10.2_

- [x] G4. Challenges and correct cards (chosen first) (math-g4: 51/51 passed)
  - Tests:
    - five or nine challenges by mode;
    - operands in range; distinct sums in both directions; one correct card per
      challenge;
    - neutral challenge and card ids (no sum, no operand, no `penalty-` or `expr-`
      prefix);
    - prompt formats per direction: `"3 + 4 = ?"` and `"Which addition expression
      equals 7?"`, with expression cards such as `"3 + 4"`; `sourceRef` ids pass
      `isValidId`;
    - `mixed` uses more than one level across seeds
  - _Requirements 1.3, 4.1-4.3, 7.1-7.2, 11.3_

- [x] G5. Eligible pool, size planning, and distractors (math-g5: 59/59 passed)
  - `distractors.ts`; the planning order follows design steps 2 to 6
  - Tests:
    - **Planning order:** the eligible pool is built after the challenges and
      excludes every active answer and every expression valid for any active
      challenge (including commuted forms). The value passed to the planner equals
      an independent oracle's pool size for the same challenges, and no
      correct-answer value is ever counted as a distractor.
    - **`oneDigit` `factToSubject`:** the pool is exactly 11; competitive is 20
      cards and `reduced: true`; Solitaire is 15.
    - **`oneDigit` `subjectToFact`:** over many seeds the pool equals the oracle's
      count of canonical pairs whose sum is not a target, and the deck is
      9 + min(15, pool). A fixed case with targets 6–14 gives a pool of exactly 12
      and a 21-card deck with `reduced: true`. A fixed case with targets {2, 3, 4,
      5, 6, 15, 16, 17, 18} removes 15 pairs, leaving a pool of 30 and a 24-card
      deck. Solitaire is always 15 (the pool is at
      least 24).
    - **Other levels, both directions:** the size equals the oracle-planned size
      (expected 24 competitive and 15 Solitaire with these ranges, but the test
      asserts the oracle, not the number).
    - **No size test assumes 24.** Each compares the deck with an independently
      counted eligible pool run through the same M2 planner rules.
    - Never above the target, in every case.
    - **Minimums from M2:** a target just below the minimum returned by the M2
      planner (no hard-coded literal) gives the planner's structured issue; a
      target at that minimum succeeds; a pool too small for the mode gives a
      structured issue and no deck.
    - **Distractors:** every one is incorrect for every challenge; within the
      plausible range or operand ranges; tier 1 is used before tier 2 and tier 2
      before tier 3; no commuted duplicates in `subjectToFact`.
  - _Requirements 3, 4.2, 4.4, 5, 7.5_

- [x] G6. Matrix, self-validation, results (math-g6-g7: 36 G6 tests passed)
  - Tests:
    - the matrix has every (challenge, card) pair, and each entry equals an
      independent arithmetic oracle;
    - `validateDeckForPlay` passes for both modes, every level, and both directions
      over many seeds;
    - a deliberately corrupted internal step (test seam) yields `{ ok: false }`
      with no deck;
    - `numericAnswers` is correct per direction;
    - `sizing` matches the deck
  - _Requirements 4.5, 6, 9.2, 10.1_

- [x] G7. Determinism (math-g6-g7: 9 G7 tests passed)
  - Tests: the same request gives an identical result; different seeds differ; the
    new source has no `Math.random`, `Date`, or `crypto` (source scan, as in M3 E1)
  - _Requirement 8.1, 8.2_

- [x] G8. Expression penalty fallback for `subjectToFact` (M4-4 A) (math-g8: 15/15; numeric provider tests 23/23 unchanged)
  - `expression-fallback.ts`
  - Tests: candidates are unused, within the operand ranges and cap, valid for no
    active challenge, one ordering per pair, deterministic, and bounded; they are
    accepted by the shared `drawPenaltyCards`; the existing numeric provider is
    unchanged
  - _Requirement 11.5_

- [x] G9. Math series wrapper and engine integration (math-g9 engine 34 + series 50 passed; one test-design defect fixed, logged)
  - `math-series.ts` (`createMathSeries`; per-game seeds per M4-8; Beepy error rate
    default 0.2 per M4-10)
  - Tests:
    - `tutor` and `vsPlayer` are rejected;
    - generated decks start M3 games for both modes, every level, and both
      directions;
    - full Solitaire sessions and vsBeepy matches play to completion through the
      wrapper, with a test-only step limit and the M3 invariant checks, in both
      directions (so the fallback is exercised in each);
    - views and events contain no deck card id, no answer-revealing challenge id,
      and no seed;
    - the wrapper object is frozen and exposes methods only;
    - a generation failure gives a fixed public error, with the full issues only in
      `diagnostics`;
    - each game gets a different deck, and the whole series replays identically
      from the same seed;
    - the default and a configured Beepy error rate are both applied
  - _Requirements 8.3, 11_

- [x] G10. Task 16 Math todos (M4-9) (2 converted and passing; 6 Task 16 todos left untouched; Task 16 unchecked)
  - Convert the two Math-generator `it.todo` in
    `shared-engine/tests/task16-direction-and-context.test.ts` into real tests using
    the Math generator, one per direction. Leave the Clinical todos, the engine
    todos, the Task 18 todos, and Task 16's unchecked status untouched
  - _Requirement 12.3_

- [x] G11. Verification and report (build, typecheck:tests, ESLint exit 0; 1762 passed / 0 failed / 8 todo)
  - Run `npx tsc --build tsconfig.json --force`, `npm run typecheck:tests`,
    `npx vitest run`, and ESLint on the new and changed files; update this file and
    `docs/kiro-development-log.md`; write the consolidated M4 report
  - _Requirements 12.4, 12.5_

## Size estimate

About 500 to 700 lines of production code in `math-cards/` and about 30 lines in
`shared-engine/` (types and one export), with roughly 150 to 250 new tests. That is
smaller than M3, because dealing, judging, penalties, scoring, privacy, and replay
are reused unchanged.
