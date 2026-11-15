# Educational Data Schema and Validation — Tasks

Implementation plan for milestone M2 (master spec §18, phase 2), mapped to the
approved `requirements.md` and `design.md`.

**Status: all tasks below are unchecked and NOT started.** This is specification
preparation only. No implementation task may begin until the project owner
explicitly approves M2 implementation. No code is written, no dependencies are
installed, and the next milestone is not begun during M2 preparation.

Completion rule (carried from M1): a task is checked only after its work is
actually performed, its artifacts are verified on disk, and relevant tests are
run and observed — never before.

## Schema and types

- [x] 1. Define the source-data schema types
  - `SubjectRecord`, `Topic`, `AnswerEntry`, and the versioned
    `SubjectCollection` wrapper, matching master spec §8
  - Document required vs optional fields; `explanation` optional and never on a
    card face
  - Implemented in `shared-engine/src/source-data.ts`, re-exported from
    `shared-engine/src/index.ts`. **Verified:** `tsc --build
    shared-engine/tsconfig.json` passed with no diagnostics (exit 0) after
    `npm install`; declaration files emitted to `shared-engine/dist/`. The
    verified-work-only completion rule is satisfied.
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.6 · Design: Layer 1, D1_

- [x] 2. Implement the stable-identifier namespace rule (Decision 1)
  - Globally unique, stable, descriptive string ids with subject-qualified
    prefixes preventing Math/Clinical collisions; validate uniqueness across all
    imported collections; duplicate ids are actionable errors
  - Finalize the concrete prefix tokens
  - Implemented in `shared-engine/src/identifiers.ts` (prefix convention
    `<namespace>.<kind>.<slug...>`, namespaces `math`/`clinical`, kinds
    `subject`/`topic`/`answer`; utilities `buildId`, `isValidId`, `parseId`,
    `isInNamespace`, `collectIds`, `findDuplicateIds`, `findMalformedIds`),
    re-exported from `index.ts`. Full validation pipeline and wrapper/merge
    (Task 2a) intentionally NOT included. **Verified:** `tsc --build`
    passed (exit 0); declarations emitted.
  - _Requirements: 1.5 · Design: D2_

- [x] 2a. Implement the versioned collection wrapper and merge rules (Decision 2)
  - `{ "schemaVersion": "1.0.0", "subjects": [] }` (semver); merge only when
    versions match and all ids stay unique; reject incompatible versions and
    conflicting ids with actionable errors; never silently overwrite
  - Implemented in `shared-engine/src/collection.ts` (`CURRENT_SCHEMA_VERSION`,
    `createCollection`, `checkMergeable`, `assertMergeable`, `mergeCollections`,
    `CollectionMergeError`, `MERGE_ERROR_CODES`), reusing Task 2
    `findDuplicateIds`. A single collection is also checked for internal
    duplicate ids. Re-exported from `index.ts`. **Verified:** `tsc --build`
    passed (exit 0) and 9/9 focused functional checks passed (compatible merge,
    version mismatch, cross-collection duplicate, single-collection internal
    duplicate, zero-collection). Generated-deck contract and full validation
    pipeline intentionally NOT included.
  - _Requirements: 1.4 · Design: D2a_

- [x] 3. Define the generated-deck contract
  - `GeneratedChallenge`, `GeneratedAnswerCard` (with per-challenge explanation
    binding), `GeneratedDeck`; subject-neutral, no DOM/framework
  - Explanation omitted when absent; never invented/substituted; never on a card
    face (Decision 5)
  - Implemented in `shared-engine/src/generated-deck.ts` (`GenerationDirection`,
    `GeneratedSourceRef`, `GeneratedChallenge`, `GeneratedAnswerCard`,
    `GeneratedDeck`, `GeneratedDeckMeta`), re-exported from `index.ts`. Documents
    validator-enforced invariants V1-V5 (referential integrity, unique correct
    assignment, global id/display-value uniqueness, actualCardCount ===
    answerCards.length) for later tasks; no validation logic implemented.
    **Verified:** `tsc --build` passed (exit 0); `generated-deck.d.ts` emitted.
  - _Requirements: 2.4, 3.6, 5.1, 5.3 · Design: Layer 2 D4, D5_

## Generation direction

- [x] 4. Implement generation-direction configuration
  - Single `generationDirection` config: `factToSubject` | `subjectToFact`,
    not a separate schema; both directions valid for either app
  - Implemented in `shared-engine/src/generation-config.ts`
    (`GENERATION_DIRECTIONS`, `GENERATION_APPS`, `DEFAULT_DIRECTION_BY_APP`,
    `GenerationApp`, `GenerationConfig`, `isGenerationDirection`,
    `defaultDirectionForApp`, `resolveGenerationDirection`, `oppositeDirection`),
    reusing the Task 3 `GenerationDirection` type; config property named
    `generationDirection` per D3. Re-exported from `index.ts`. No card
    generation. **Verified:** `tsc --build` passed (exit 0); 13/13 functional
    checks passed (Math/Clinical defaults, overrides both directions either app,
    switching utility).
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5 · Design: D3_

- [x] 5. Implement app-specific generator boundaries (Decision 4)
  - Source-data types, generated-deck contracts, and subject-neutral validation
    contracts in `shared-engine/`; Math expression generation in `math-cards/`;
    clinical fact generation in `clinical-cards/`
  - Engine consumes validated decks only; shared contracts have no UI/DOM deps
  - Implemented the subject-neutral boundary `DeckGenerator` + `GenerationRequest`
    in `shared-engine/src/generator.ts` (re-exported from `index.ts`); and
    app-side boundary stubs `MathDeckGenerator` (`math-cards/src/math-generator.ts`)
    and `ClinicalDeckGenerator` (`clinical-cards/src/clinical-generator.ts`),
    each implementing the shared contract with `generate()` deferred (throws)
    until the later generation task. No generation algorithm, validator,
    gameplay, Beepy, or UI. **Verified:** `tsc --build tsconfig.json --force`
    (whole monorepo) passed (exit 0); app declarations emitted.
  - _Requirements: 5.1, 5.2, 5.4 · Design: Separation section_

## Validation pipeline

- [x] 6. Implement structural + identifier validation
  - Shape/required fields/`schemaVersion` compatibility; id uniqueness and
    resolvability; actionable structured errors for invalid JSON imports
  - Implemented in `shared-engine/src/validation.ts` (`validateStructure`,
    `validateIdentifiers`, `validateCollectionSource`, `VALIDATION_CODES`,
    `SUPPORTED_SCHEMA_VERSIONS`, `ValidationIssue`/`ValidationResult`), re-exported
    from `index.ts`. Identifier stage checks convention shape, expected kind per
    position (subject/topic/answer), namespace consistency between a subject and
    its nested topics/answers (owner-approved clarification; slug hierarchy NOT
    enforced), and global uniqueness with each repeat reported at its own JSON
    path. Later pipeline stages (Task 7+) intentionally NOT included.
    **Verified:** `tsc --build tsconfig.json --force` passed (exit 0);
    48/48 focused functional checks passed.
  - _Requirements: 1.5, 6.5 · Design: pipeline stages 1–2, D7_

- [x] 7. Implement challenge mapping and ambiguity elimination
  - Exactly one designated correct card per displayed challenge; reject/resolve
    answers valid for more than one active challenge; reject duplicate display
    texts
  - Implemented in `shared-engine/src/challenge-mapping.ts`
    (`validateChallengeMapping`, `normalizeDisplayText`, `ContextualValidityMap`)
    with the shared issue model in `shared-engine/src/deck-issues.ts`
    (`DECK_VALIDATION_CODES`, `DeckValidationIssue`, `DeckValidationResult`),
    re-exported from `index.ts`. Contextual validity is REQUIRED: an explicit
    `challengeId -> cardId -> boolean` matrix covering every challenge and every
    card; a missing matrix, entry, or pair is reported and never yields success.
    **Verified:** `tsc --build tsconfig.json --force` passed (exit 0); 28/28
    focused functional checks passed.
  - _Requirements: 3.1, 3.2, 3.3, 3.5 · Design: pipeline stages 3–4_

- [x] 8. Implement global uniqueness enforcement
  - Every answer-card display value unique across all zones (hands, draw deck,
    played, discard); distinct numerical answers for math
  - Implemented in `shared-engine/src/uniqueness.ts` (`validateUniqueness`,
    `canonicalNumber`, `CardZones`, `UniquenessOptions`), with new codes in
    `deck-issues.ts`, re-exported from `index.ts`. Checks unique card ids and
    challenge ids (V3), unique display values (V4), an opt-in `numericAnswers`
    mode that compares values as numbers (subject-neutral), and an optional
    caller-named zone snapshot checked for unknown cards, cards in more than one
    place, and display values repeated across zones. **Verified:**
    `tsc --build tsconfig.json --force` passed (exit 0); 30/30 focused
    functional checks passed.
  - _Requirements: 3.4 · Design: pipeline stage 5_

- [x] 9. Implement starting-hand feasibility — single hand
  - Five distinct cards; two or three correct; plausible distractors; no leak;
    no uniqueness violation
  - Implemented in `shared-engine/src/starting-hand.ts` (`validateStartingHand`,
    `checkStartingHandFeasibility`, `STARTING_HAND_SIZE`,
    `MIN_/MAX_CORRECT_IN_STARTING_HAND`, `StartingHandOptions`), with new codes in
    `deck-issues.ts`, re-exported from `index.ts`. Checks size 5, known and
    distinct cards, no repeated display value (numeric mode optional), and 2 or 3
    designated-correct cards; feasibility confirms the deck has enough correct
    cards and distractors without dealing a hand. Non-leak (Req 4.3) and
    distractor plausibility are NOT machine-checkable here and are documented as
    dealer/generator responsibilities. **Verified:** `tsc --build tsconfig.json
    --force` passed (exit 0); 32/32 focused functional checks passed.
  - _Requirements: 4.1, 4.2, 4.3, 4.4 · Design: pipeline stage 6_

- [x] 10. Implement dual-player starting-hand validation (competitive)
  - For vs-Beepy generation, deal valid five-card starting hands to BOTH
    players simultaneously with no shared or duplicated display value across
    either hand or the remaining deck; each hand has two or three correct cards
    and at least one unused valid distractor is retained for a penalty draw
    (master spec §7; Decision 3)
  - Implemented in `shared-engine/src/dual-hand.ts`
    (`validateDualStartingHands`, `checkDualHandFeasibility`, `canSupplyHands`,
    `countCorrectAndDistractors`, `COMPETITIVE_HAND_COUNT`, `MIN_PENALTY_RESERVE`,
    `DualHands`), with new codes in `deck-issues.ts`, re-exported from `index.ts`.
    Each hand is validated with the Task 9 rules; the hands must not share a card
    or a display value; no hand value may clash with the remaining deck; and an
    unused valid distractor must remain for a penalty draw. **Verified:**
    `tsc --build tsconfig.json --force` passed (exit 0); 32/32 focused functional
    checks passed (including `canSupplyHands` matching the Task 9 check and an
    exhaustive search).
  - _Requirements: 4.4, 4.5 · Design: pipeline stage 6, D8_

## Deck-size rules (D8) and exhaustion behavior (D6)

- [x] 11. Implement deck-size targets and bounds (Decision 3, D8)
  - Competitive Math target 24 unique answer cards (9 correct + 15 distractors);
    competitive minimum 14 cards only if two valid non-overlapping five-card
    hands (two or three correct each) plus one unused penalty distractor can be
    built; Solitaire uses five challenges + five-card hand + one penalty
    distractor, no 24-card target; allow a smaller validated deck when the
    plausible range is insufficient; never pad with implausible distractors
  - Implemented in `shared-engine/src/deck-size.ts` (`DECK_MODES`, `isDeckMode`,
    `planDeckSize`, `validateDeckSize`, `minimumDistractors`,
    `expectedChallengeCount`, `handCountForMode`, mode constants) with new codes in
    `deck-issues.ts`; the Math-only 24-card target (9 + 15) and
    `planMathCompetitiveDeckSize` live in `math-cards/src/deck-size.ts`. Owner-
    approved clarification: `targetCardCount` is a MAXIMUM, not an exact count;
    smaller validated decks remain permitted and larger ones are rejected
    (`DECK_EXCEEDS_TARGET`). Invalid modes and invalid numeric inputs are rejected
    with structured `INVALID_MODE` / `INVALID_COUNT` issues. **Verified:**
    `tsc --build tsconfig.json --force` passed (exit 0); 97/97 shared checks,
    12/12 Math checks, and 31/31 regression checks passed.
  - _Requirements: 4.5, 4.6, 6.1, 6.4 · Design: D8; master spec §10_

- [x] 12. Implement deck-exhaustion behavior (Decision 3, D6)
  - Generate a fallback penalty card only when its display value is valid,
    plausible, globally unique, and unused; never reuse a card, emit a
    duplicate, or fabricate an invalid card
  - When no suitable card can be produced, return a structured
    `PENALTY_CARD_EXHAUSTED` condition; never relax the uniqueness invariant;
    gameplay consequence deferred to the engine milestone
  - Finalize the concrete `PENALTY_CARD_EXHAUSTED` payload shape and fallback
    algorithm
  - Implemented in `shared-engine/src/penalty-draw.ts` (`drawPenaltyCards`,
    `PenaltyCardExhausted`, `PenaltyFallbackProvider`, `PenaltyCandidate`,
    `DEFAULT_MAX_PENALTY_CANDIDATES` = 50, configurable) with the
    `PENALTY_CARD_EXHAUSTED` code in `deck-issues.ts`, and the Math provider
    `createMathPenaltyFallbackProvider` in `math-cards/src/penalty-fallback.ts`.
    Owner-approved rules (recorded in Req 6.3 and design D6a): draw pile first,
    then a bounded fallback; every candidate checked against every active
    challenge and rejected if duplicated, invalid, implausible, previously used, or
    a valid answer; atomic events (all owed cards or none, state untouched); the
    consequence is a waived draw penalty with the exhaustion recorded and the game
    continuing, applied by the engine milestone; Clinical never generates facts or
    explanations at runtime (no clinical provider exists). The function is
    event-agnostic: which events owe draws, and the timing of challenge
    adjudication and win detection, belong to the engine milestone. **Verified:**
    `tsc --build tsconfig.json --force` passed (exit 0); 63/63 shared checks
    (including a 4000-event comparison with an independent oracle), 23/23 Math
    checks, and 31/31 Tasks 1-11 regression checks passed.
  - _Requirements: 6.2, 6.3 · Design: D6, D7_

- [x] 13. Implement insufficient-data and error model
  - Fail cleanly with actionable errors when data cannot produce a valid deck
    (too few unique values, no unambiguous correct card, or range below the
    mode's required hands + draw reserve); no partial/invalid deck emitted
  - Structured error model (code, message, offending id/path) shared with
    import and exhaustion reporting
  - Implemented in `shared-engine/src/issues.ts` (`StructuredIssue`, `AnyIssue`,
    compile-time `IssueModelConformance`, `isStructuredIssue`, `formatIssue`,
    `formatIssues`, `issuesFromMergeError`) and
    `shared-engine/src/data-sufficiency.ts` (`countUniqueValues`,
    `assessDeckData`, `analyzeCandidateAmbiguity`), with two new codes
    `TOO_FEW_UNIQUE_VALUES` and `NO_UNAMBIGUOUS_CORRECT_CARD` in `deck-issues.ts`.
    Source-import issues, deck issues, and `PENALTY_CARD_EXHAUSTED` all share the
    `code` / `message` / `path` shape (proved at compile time), and Task 2a merge
    errors are adapted into it. Insufficient-data checks fail with issues only
    (no plan, analysis, or deck). The `DeckGenerator` interface is unchanged; how
    generators report failures and deliver the Task 7 matrix is left as an
    owner decision. **Verified:** `tsc --build tsconfig.json --force` passed
    (exit 0); 76/76 Task 13 checks and 30/30 Tasks 1-12 regression checks passed.
  - _Requirements: 6.1, 6.2, 6.5 · Design: D7, D8_

## Automated invariant tests (Vitest; run and observed before checking)

- [x] 14. Uniqueness and challenge-mapping tests
  - `uniqueness-across-zones`, `one-correct-card-per-challenge`,
    `ambiguous-answer-rejected`, `duplicate-display-text-rejected`
  - Implemented in `shared-engine/tests/task14-uniqueness-and-mapping.test.ts`
    (permanent Vitest suite; all four app/direction combinations, mutation and
    property tests). **Verified:** 123/123 tests passed.
  - _Requirements: 7.1, 7.2 · master spec §16 · Design: Proposed tests_

- [x] 15. Starting-hand tests (single and dual-player)
  - `valid-starting-hand-composition`, `competitive-dual-hand-feasibility`
  - Implemented in `shared-engine/tests/task15-starting-hands.test.ts`
    (exhaustive check of all 462 five-card hands, a brute-force oracle for the
    counting rule, and 2400 randomized deals against an independent oracle).
    **Verified:** 166/166 tests passed. Not machine-checkable and left to the
    engine milestone: that a dealer or UI does not reveal which cards are correct.
  - _Requirements: 7.1, 7.2 · Design: Proposed tests_

- [ ] 16. Generation-direction and contextual-correctness tests
  - `direction-factToSubject`, `direction-subjectToFact`,
    `contextual-play-and-discard`
  - **M4 G10 update (2026-11-11):** the two Math-generator todos are now real,
    passing tests using the real Math generator (49 passed, 6 todo). The two
    Clinical-generator todos and the four engine todos remain. Task 16 stays
    unchecked pending the owner.
  - **LEFT UNCHECKED - partially satisfied.** Implemented in
    `shared-engine/tests/task16-direction-and-context.test.ts`: 47 tests pass
    (generation-direction configuration for both apps and both directions;
    hand-authored decks for all four app/direction combinations passing the whole
    validation pipeline at contract level; contextual correctness at the
    validator and data level). 8 tests are recorded as `it.todo` because the
    behavior does not exist yet and no M2 task builds it: generators producing a
    valid deck per direction (needs the Math and Clinical generators), and the
    runtime judging of a play, a discard, and an invalid action (needs the game
    engine milestone). The named `contextual-play-and-discard` test therefore
    cannot pass until the engine exists. Owner decision requested.
  - _Requirements: 7.1, 7.2 · Design: Proposed tests_

- [x] 17. Deck-size tests (D8)
  - `competitive-math-deck-size-target`,
    `smaller-validated-deck-when-range-limited`
  - Implemented in `shared-engine/tests/task17-deck-size.test.ts` (modes, bounds,
    invalid modes and counts, target as a maximum, reduced decks that pass the whole
    pipeline for all four combinations, grid properties) and
    `math-cards/tests/task17-deck-size.test.ts` (the Math-specific 24-card target).
    **Verified:** 189/189 shared and 18/18 Math tests passed (207 total).
  - _Requirements: 7.1, 7.2 · Design: D8, Proposed tests_

- [x] 18. Exhaustion, insufficient-data, and import-error tests
  - `draw-pile-exhaustion-reports-condition`, `insufficient-data-fails-cleanly`,
    `invalid-json-import-errors`
  - Implemented in `shared-engine/tests/task18-exhaustion.test.ts` (52),
    `task18-insufficient-data.test.ts` (45), `task18-import-errors.test.ts` (106),
    `math-cards/tests/task18-penalty-fallback.test.ts` (23), and
    `clinical-cards/tests/task18-no-runtime-generation.test.ts` (9).
    **Verified:** 235/235 tests passed. 2 further tests are `it.todo` for features
    that do not exist yet (syntactically invalid JSON text, and a single raw-JSON
    import entry point; an open owner decision).
  - _Requirements: 7.1, 7.2 · Design: D6, D7, Proposed tests_

- [x] 19. Record test results honestly in the development log
  - Report pass/fail/not-run per the verified-work-only steering; never claim a
    test passed unless run and observed
  - Recorded in `docs/kiro-development-log.md` (Tasks 14-19 entry): commands, per-file
    results (898 passed, 0 failed, 10 todo), the one test-fixture defect found and
    fixed, the mutation probe, and the Task 16 gap. Lint was not run.
  - _Requirements: 7.3_

## Hold point

- [x] 20. Hold for explicit owner approval before implementing
  - **Resolved (Prompt 02o).** The owner accepted Tasks 14, 15, 17, 18, 19 and kept
    Task 16 unchecked. No production code was written for this task. Approved
    decisions for FUTURE work (not implemented in M2):
    1. Generator integration uses a structured result carrying a generated deck, its
       complete contextual-validity matrix, or structured validation issues. The
       `DeckGenerator` interface change is deferred to generator integration.
    2. Raw JSON parsing and a unified import entry point belong to a later
       loader/integration task (the 2 Task 18 `it.todo`).
    3. Source-data sufficiency scanning belongs with the actual generators.
    4. Clinical deck sizes are configurable and constrained by available reviewed
       content; Clinical penalty fallback never invents facts or explanations.
    5. The engine detects an immediate empty-hand win before applying further
       penalty draws.
    6. No additional turn cap is approved.
  - Still deferred: controlled-repetition selection specifics (master spec §5, §12;
    belong with progress tracking and the engine). Id prefix tokens (task 2) and the
    `PENALTY_CARD_EXHAUSTED` payload and fallback algorithm (task 12) are finalized.
  - Outstanding `it.todo` (10): 8 in Task 16 (4 need the Math/Clinical generators, 4
    need the game engine); 2 in Task 18 (need the loader/integration task).
  - The five previously open decisions are **resolved in the spec** (Decisions
    1–5; see `design.md` "Resolved decisions"). Approval covered specification
    only, NOT implementation.
  - Remaining implementation-level details to finalize when implementation is
    approved: exact id prefix tokens (task 2), `PENALTY_CARD_EXHAUSTED` payload
    shape and fallback algorithm (finalized in task 12), controlled-repetition selection
    specifics
  - Do not write code, install dependencies, or proceed to a later milestone
    without explicit owner approval
  - _Requirements: 8.1, 8.2, 8.3 · Design: Resolved decisions 1–5_
