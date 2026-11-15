# Beepy Math Cards Deck Generator — Design (revision 3)

Revision 3 applies these owner decisions:
- the M4-2 ranges are approved for version 1;
- zero is never a distractor;
- the `subjectToFact` prompt is "Which addition expression equals 7?";
- the one-digit `subjectToFact` pool arithmetic is corrected. The eligible pool
  decides the size, and 24 is a target, not a guarantee.

Companion to `requirements.md`. Specification only; no code is authorized.

## What exists today (reviewed)

- `shared-engine/src/generator.ts` (M2 Task 5) has `DeckGenerator.generate(request:
  GenerationRequest): GeneratedDeck`. `GenerationRequest` requires a
  `SubjectCollection`, a `GenerationConfig`, `challengeCount`, and
  `targetCardCount`. There is no matrix and no failure channel. M2 deferred this,
  and the owner approved a structured result "at generator integration", which is
  now.
- `math-cards/src/math-generator.ts`: the `MathDeckGenerator` stub; `generate`
  throws.
- `math-cards/src/deck-size.ts`: the 24-card competitive target, and
  `planMathCompetitiveDeckSize` built on M2 `planDeckSize`.
- `math-cards/src/penalty-fallback.ts`: `createMathPenaltyFallbackProvider({
  minValue, maxValue })`, which offers numeric candidates only, with ids
  `penalty-<n>`.
- `clinical-cards/src/clinical-generator.ts`: a stub implementing `DeckGenerator`.
- M3: `createSeriesController({ mode, seed, options, beepyStrategy, diagnostics })`
  with `startNextGame({ deck, contextualValidity })`. The options (`numericAnswers`,
  `fallback`) are fixed per series. `validateDeckForPlay` exists in
  `shared-engine/src/game/deck-gate.ts`, is not exported, and the API lock asserts
  that it isn't.
- M3 views show challenge ids publicly (`ChallengeView.id`, pending
  `destination`). Card ids are hidden behind handles.

## Shape of the solution

```
math-cards/src/
  levels.ts               difficulty levels: operand ranges, sum cap, plausible range
  math-generator.ts       MathDeckGenerator (replaces the stub)
  distractors.ts          eligible-pool construction and near-miss ordering
  expression-fallback.ts  subjectToFact penalty fallback (M4-4 A)
  math-series.ts          createMathSeries: generator + M3 controller (trusted layer)
```

No new dependencies, and no new shared abstractions beyond the M4-1 result type.

## Generator interface (M4-1, approved)

The M2 boundary in `shared-engine/src/generator.ts` changes to:

```ts
export type GenerationResult =
  | {
      readonly ok: true;
      readonly deck: GeneratedDeck;
      readonly contextualValidity: ContextualValidityMap; // complete matrix
      readonly numericAnswers: boolean;                   // how values compare
      readonly sizing: { readonly targetCardCount: number;
                         readonly actualCardCount: number;
                         readonly eligibleDistractors: number;
                         readonly reduced: boolean };
    }
  | { readonly ok: false; readonly issues: readonly GenerationIssue[] };

export interface GenerationIssue {   // same shape as the M2 structured issues
  readonly code: string;
  readonly message: string;
  readonly path: string;
}

export interface DeckGenerator<TRequest = GenerationRequest> {
  readonly app: GenerationConfig['app'];
  generate(request: TRequest): GenerationResult;
}
```

- The request is a type parameter because Math does not consume a
  `SubjectCollection`; it generates its own facts (M4-7). Clinical keeps
  `GenerationRequest`, which is unchanged.
- This is a type-only change, so the API lock's runtime list is unaffected by
  M4-1.
- The Clinical stub returns `{ ok: false, issues: [NOT_IMPLEMENTED] }` instead of
  throwing. That is the only Clinical edit.

### Math request

```ts
interface MathGenerationRequest {
  readonly mode: 'solitaire' | 'vsBeepy';
  readonly level: MathLevel;                          // M4-2
  readonly generationDirection?: GenerationDirection; // default factToSubject
  readonly seed: number;                              // finite number
  readonly targetCardCount?: number;                  // default 24 / 15 (M4-5)
}
```

Every field is checked at runtime. Bad values produce issues, never exceptions.

| Mode value | Result |
|---|---|
| `solitaire`, `vsBeepy` | generated |
| `tutor`, `vsPlayer` | `MODE_NOT_SUPPORTED` |
| anything else | `INVALID_MODE` |

## Difficulty levels (M4-2, approved for version 1)

| Level id | Operands | Sum cap | Plausible distractor range (`factToSubject`) |
|---|---|---|---|
| `oneDigit` (1 + 1) | 1–9 and 1–9 | ≤ 18 (natural) | 1–20 |
| `oneAndTwoDigit` (1 + 2) | 1–9 and 10–89 | ≤ 99 | 10–99 |
| `twoDigit` (2 + 2) | 10–89 and 10–89 | ≤ 99 | 20–99 |
| `mixed` | each challenge picks one of the three | per challenge | 1–99 |

**Approved exclusions (owner, version 1):**
- **No sum above 99** in any level. Three-digit results never appear.
- **Two-digit operands are 10–89** in both `oneAndTwoDigit` and `twoDigit`, so
  operands 90–99 never appear.
- **No zero operands.** Every operand is at least 1, so every sum is at least 2.
- **Zero is not a plausible distractor** either. Every numeric plausible range
  starts at 1 or higher (1–20, 10–99, 20–99, 1–99), so the generator never offers
  0 as a distractor card, and the numeric penalty fallback is configured with the
  same range, so it never offers 0. In `subjectToFact`, no distractor or fallback
  expression contains a zero operand.

These ranges are proposals for a second-grade audience. No curriculum claim is made.

`subjectToFact` distractors are expressions built from the same operand ranges, so
their pool is defined by the operand ranges and the sum cap rather than the numeric
range column.

## Generation algorithm (correction 1: plan from the actual pool)

1. **Validate the request**: mode, level, direction, seed, target.
2. **Choose the challenges first.** Enumerate the level's operand pairs, shuffle
   them with the seed, and take pairs in order while skipping any whose sum is
   already used, until the mode's challenge count is reached
   (`expectedChallengeCount`). For `mixed`, each slot first picks a level with the
   seed. The enumeration is bounded, so there is no open-ended loop. If a level
   cannot supply enough distinct sums, return a structured issue.
3. **Correct cards.** One per challenge: the sum (`factToSubject`) or the chosen
   expression (`subjectToFact`).
4. **Build the actual eligible distractor pool** for this exact set of challenges:
   - `factToSubject`: every whole number in the plausible range, minus every
     active sum.
   - `subjectToFact`: every operand pair in the level's ranges within the cap,
     minus every pair whose sum equals any active target (this removes commuted
     and other equivalent forms of the correct expressions), keeping one ordering
     per unordered pair.
   - Both: drop any candidate whose display equals a card already chosen.
   The pool is fully enumerated, so its size is exact.
5. **Plan the size only now**, with the M2 planner: `planDeckSize(mode, target,
   { availableCorrect: challengeCount, availableDistractors: pool.length })`
   (competitive through `planMathCompetitiveDeckSize`). The planner applies the
   ceiling, the mode's minimum, and hand feasibility. A failed plan is returned as
   the planner's structured issue.
6. **Select distractors.** Order the pool by near-miss tier (below), shuffle within
   each tier with the seed, and take the planned count.
7. **Matrix.** For each challenge and each card, compute arithmetic validity from
   the card itself: `Number(card) === a + b` (`factToSubject`) or
   `sum(cardExpression) === target` (`subjectToFact`).
8. **Assemble** the `GeneratedDeck` with neutral ids, `meta` counts, and
   `sourceRef`s.
9. **Self-validate** with the exported `validateDeckForPlay` (M4-6). Any issue means
   `{ ok: false, issues }` and the deck is discarded. A valid request is expected
   never to fail here; this step catches generator defects.

### Expected sizes (computed from the pool, not assumed)

Tests compute these with an independent oracle on the actual challenges. The
figures below are the expected outcomes that the tests will check.
- **`oneDigit`, `factToSubject`:** the plausible range 1–20 has 20 values, and all
  nine distinct sums lie within it, so the eligible pool is exactly 11. Competitive
  is 9 + 11 = **20 cards** (reduced; at least the competitive minimum). Solitaire is
  5 + min(10, 15) = **15**.
- **`oneDigit`, `subjectToFact`:** there are 45 canonical (unordered) operand
  pairs from 1–9. The number of pairs per sum is: 2:1, 3:1, 4:2, 5:2, 6:3, 7:3,
  8:4, 9:4, 10:5, 11:4, 12:4, 13:3, 14:3, 15:2, 16:2, 17:1, 18:1. The eligible pool
  is 45 minus the pairs whose sum is a target, so it **depends on which sums the
  seed picks**:
  - competitive (nine targets): between 15 pairs removed (pool 30) and 33 removed
    (pool 12; for example targets 6–14, the owner's example). The deck is
    9 + min(15, pool), so **21 to 24 cards**. 24 is a target, not a guarantee;
  - Solitaire (five targets): at most 21 pairs removed (sums 8–12), so the pool is
    at least 24 and the deck is always 5 + 10 = **15**.
- **`oneAndTwoDigit`, `twoDigit`, `mixed`:** the pools are much larger, so 24
  (competitive) and 15 (Solitaire) are expected with these ranges. Tests still
  assert the independently counted size, not these figures.

**Rule:** the actual eligible pool decides the size. A 24-card competitive deck is
the target, never a guarantee; whenever the pool holds fewer than 15 distractors,
the M2 planner's smaller validated deck is used. Every size test compares the deck
with an independent count of the eligible pool for the same challenges, run
through the same M2 planner rules. No test assumes 24.

### Minimums (correction 4)

M4 does not hard-code a minimum. The Solitaire and competitive minimums, and
whether a pool can supply the starting hand or hands plus the penalty reserve, come
from M2 `planDeckSize` (using `minimumDistractors` and `canSupplyHands`) and are
re-checked by `validateDeckForPlay`. Tests that probe the boundary ask the M2
functions for the minimum instead of using a literal.

### Identifiers and privacy

- Challenge ids are public, so they are neutral: `c1` … `cN` assigned in a seeded
  order, never tied to the sum or operands.
- Card ids are hidden by M3 handles but still carry no hint: `m<k>`, where k is a
  seeded index. They never start with `penalty-` or `expr-`, so they can't collide
  with the fallback ids.
- `sourceRef` (shown only after a challenge is solved) uses M2-format ids, checked
  with `isValidId`: `subjectId: math.subject.sum-<s>`,
  `topicId: math.topic.sum-<s>.add-<a>-<b>`.
- Prompt text: `factToSubject` uses `"3 + 4 = ?"` (master spec §9 wording);
  `subjectToFact` uses `"Which addition expression equals 7?"` (owner-approved),
  with answer cards such as `"3 + 4"`.

### Distractor selection (tiers)

- `factToSubject` (numbers):
  - tier 1: an active sum ± 1;
  - tier 2: ± 2, plus ± 10 for two-digit sums (the classic carrying slip);
  - tier 3: the rest of the range.
- `subjectToFact` (expressions):
  - tier 1: pairs summing to an active target ± 1;
  - tier 2: ± 2;
  - tier 3: the rest.

Within each tier the seed decides the order. Tiers only order the pool; they never
add values outside it.

## Directions and comparison

| Direction | Challenge | Card | `numericAnswers` | Penalty fallback (M4-4 A) |
|---|---|---|---|---|
| `factToSubject` | `3 + 4 = ?` | `7` | true | existing numeric provider, level range |
| `subjectToFact` | `Which addition expression equals 7?` | `3 + 4` | false | new expression provider |

The existing numeric provider is unsuitable for `subjectToFact`: it can't read a
numeric answer from an expression card, so the shared check would reject every
candidate. `expression-fallback.ts` is a new file. It reads each active challenge's
target from the expression on its designated card, offers unused expressions in the
level's operand ranges whose sum matches no active target (one ordering per pair),
uses ids `expr-<a>-<b>`, and is deterministic and bounded. The shared
`drawPenaltyCards` re-checks every candidate as usual. The existing numeric
provider is unchanged.

## Integration with the M3 controller

```ts
createMathSeries({ mode, level, generationDirection?, seed,
                   beepyErrorRate? /* default 0.2 */, solitaireDeckSize? /* 15 */,
                   diagnostics? })
  → { ok: true, series } | { ok: false, error }

series.startNextGame()        // no arguments from the UI
series.getView() / submitHumanAction() / decide() / advanceBeepy()
series.getSeriesStatus() / getPublicEvents()
```

- `createMathSeries` validates its own config (the same mode rule as the
  generator). It then builds the M3 controller with `numericAnswers` for the
  direction, the fallback for the direction and level, the reference Beepy strategy
  at the configured rate (vsBeepy only), and the trusted `diagnostics` callback.
- `startNextGame()` derives this game's generator seed from the series seed and
  the next game index (M4-8: mixed through the exported `nextUint32` in
  `math-cards`, with no change to M3's `RngStream`). It calls the generator and, on
  success, passes `{ deck, contextualValidity }` to `controller.startNextGame`
  inside the closure. The deck and matrix are never returned.
- A generator failure returns the fixed public error `MATH_GENERATION_FAILED`
  (a math-cards code) and sends the full issues to `diagnostics`. Every other
  method passes straight through to the controller.
- The series object is frozen, exposes methods only, and holds no state field,
  matching the M3 boundary.

**Honest limit:** this is a static browser app, so the deck exists in the page's
memory. The boundary stops leaks through the UI's data path (views, events, errors,
the DOM, storage, the URL). It does not stop a user inspecting their own page with
developer tools. For the same reason the seed is not shown in the UI by default.

## Shortest path to a playable Math Cards app

1. **M4 (this spec):** the generator plus `createMathSeries`, fully tested without
   a UI. After M4, a whole Solitaire session and a vsBeepy match can be played by
   code through one object.
2. **M5 Math UI:** a Vite page in `math-cards/` with setup (mode, level), the
   Solitaire table, and the vsBeepy table. Click or tap a card, then its
   destination, first; drag-and-drop and keyboard after that. It calls only
   `createMathSeries`. Two decisions are needed before M5:
   - the **UI framework** (deferred since M1). Plain TypeScript + DOM needs no
     dependency; React would add one;
   - **mistake feedback.** Math's brief automatic feedback can be built in the UI
     from public resolution events. A true "Explain Why" would need a small
     post-resolution controller addition.
3. **M6:** hosting, smoke tests, demo. Tutor and Clinical follow per the master spec.

## Decisions

Approved by the owner (revisions 2 and 3):
- **M4-1:** structured `GenerationResult` and generic `DeckGenerator`.
- **M4-3:** target sum → addition expression.
- **M4-4:** option A, the expression fallback.
- **M4-5:** default Solitaire deck size 15.
- **M4-6:** option A, export and reuse `validateDeckForPlay`.
- **M4-7:** option A, M2-format `sourceRef`s only, no synthesized
  `SubjectCollection`.
- **M4-8:** deterministic per-game generator seeds derived in `math-cards`.
- **M4-9:** convert the two Math-generator Task 16 todos.
- **M4-10:** configurable Beepy error rate, default 0.2.

- **M4-2:** the level table for version 1, with a 99 sum cap, two-digit operands
  10–89, no zero operands, and no zero distractors.
- **Prompt wording:** `subjectToFact` asks "Which addition expression equals 7?"
  with cards such as "3 + 4".

No design decisions remain open. M4 now waits only for final implementation
approval.
