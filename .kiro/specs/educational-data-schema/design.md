# Educational Data Schema and Validation — Design

Design for milestone M2 (master spec §18, phase 2). This document is a
**specification/design artifact only**. It describes the intended schema,
contracts, and validation pipeline so that a later, separately approved
milestone can implement them. No code is written and nothing is executed in M2
preparation.

## Overview

M2 defines three layers and the contracts between them:

1. **Source data** — authored JSON in the common
   `subject → topics → corrects/incorrects` format (master spec §8).
2. **Generation** — app-specific, direction-configurable transformation of
   source data into a validated playable deck.
3. **Generated deck** — a subject-neutral structure the engine consumes.

The engine never reads raw source data; it only consumes a validated generated
deck. This preserves the one-engine/two-apps architecture and educational-data
independence (steering: `architecture.md`, `educational-data-independence.md`).

```text
authored JSON (source schema)
        │   loader + structural validation
        ▼
SubjectRecord[] (in a versioned collection wrapper)
        │   app-specific generator + generation-direction config
        ▼
candidate challenges + candidate answer cards
        │   deck validator (invariants: §3, §4, §6)
        ▼
GeneratedDeck  ──consumed by──▶  subject-neutral engine
```

## Layer 1 — Source-data schema (illustrative shapes)

These TypeScript-style shapes are **illustrative** and are finalized during
implementation. They mirror master spec §8.

```ts
// Illustrative only — not implemented in M2 preparation.
interface AnswerEntry {
  id: string;            // stable, unique within its namespace
  text: string;          // display text for a card or subject alternative
  explanation?: string;  // contextual; never shown on a card face
}

interface Topic {
  id: string;
  topicName: string;
  corrects: AnswerEntry[];    // contextually correct for this topic
  incorrects: AnswerEntry[];  // contextually incorrect for this topic
}

interface SubjectRecord {
  id: string;
  subject: string;
  subjectIncorrects: AnswerEntry[]; // alternative (wrong) subjects
  topics: Topic[];
}

// Versioned collection wrapper (Requirement 1.4; Decision 2). Both apps use
// this identical wrapper and schema. `schemaVersion` uses semantic versioning
// and gates merge compatibility.
interface SubjectCollection {
  schemaVersion: string;      // semver, e.g. "1.0.0"
  subjects: SubjectRecord[];
}
```

### D1 — One schema, both subjects
Math and clinical content use the identical schema. Math expresses a subject as
a numeric answer (e.g. subject `"7"`) with topics describing how that value is
produced; clinical expresses a subject as a disease with topic categories
(Classic Signs & Symptoms, Work-up, Pathology, Management/Treatment). No
subject-specific fields are added to the schema.

### D2 — Stable identifier namespaces (Decision 1, approved)
Every subject, topic, and answer-entry `id` is a **globally unique, stable,
descriptive string**. Ids use **qualified prefixes** that prevent collisions
between Math and Clinical content (illustrative: `math.subject.7`,
`clinical.subject.graves-disease`, `clinical.topic.graves-disease.workup`,
`clinical.answer.graves-disease.workup.positive-tsi`). Exact prefix tokens are
finalized in the schema task; the rule — globally unique, descriptive,
subject-prefixed — is fixed.

- Uniqueness is validated **globally across all imported collections**, not just
  within a single file.
- A duplicate id (within or across collections) is a hard error and produces an
  actionable validation error (Decision 2; D7). Records are never silently
  overwritten.

### D2a — Versioned collection wrapper and merge rules (Decision 2, approved)
Both applications use the **identical** source-data schema and the common
versioned wrapper:

```json
{
  "schemaVersion": "1.0.0",
  "subjects": []
}
```

- `schemaVersion` uses semantic versioning.
- Multiple collections may be **merged only when their schema versions match**
  and **all identifiers remain globally unique** after merge.
- Incompatible schema versions are rejected with a clear, actionable error.
- Conflicting identifiers across collections are rejected with a clear,
  actionable error. The loader **never silently overwrites** a record.

## Layer 2 — Generation (app-specific, direction-configurable)

### D3 — Generation direction is configuration, not schema
A single `generationDirection: 'factToSubject' | 'subjectToFact'` config value
selects what is shown on the challenge versus the answer card (Requirement 2;
master spec §9). The same source record can be generated either way. Generators
are app-specific (math expression construction; clinical fact selection) but
emit the same generated-deck contract.

### D4 — Generated-deck contract (illustrative)
```ts
// Illustrative only — not implemented in M2 preparation.
interface GeneratedChallenge {
  id: string;
  promptText: string;          // what the board shows
  correctAnswerCardId: string; // exactly one, designated at generation time
  sourceRef: { subjectId: string; topicId?: string };
}

interface GeneratedAnswerCard {
  id: string;
  displayValue: string;        // unique across the entire active game
  // explanation is resolved per challenge, not stored as a free-floating label
  explanationByChallengeId?: Record<string, string>;
}

interface GeneratedDeck {
  direction: 'factToSubject' | 'subjectToFact';
  challenges: GeneratedChallenge[];   // 5 (solitaire/tutor) or 9 (vs Beepy)
  answerCards: GeneratedAnswerCard[]; // dealt + draw pile
  meta: { targetCardCount: number; actualCardCount: number };
}
```

### D5 — Contextual explanation binding (Decision 5, approved)
Per steering (`educational-data-independence.md`), an explanation is optional
and contextual. The contract binds explanation text to a `challengeId` (D4,
`explanationByChallengeId`) rather than storing one explanation on a card that
might be dropped on an unrelated challenge.

- Explanations are **optional**. If no explanation exists for a given
  challenge context, the explanation display is **omitted**.
- The system **never invents** explanatory content and **never substitutes** an
  unrelated explanation to fill a gap.
- Explanations are **never rendered on a card face**.

## Layer 3 — Validation pipeline

The validator is the gatekeeper between generation and the engine. It runs in
ordered stages and fails fast with actionable errors (Requirement 6).

1. **Structural validation** — shape, required fields, id presence, and
   `schemaVersion` compatibility. Invalid JSON imports yield understandable
   structural errors (master spec §12).
2. **Identifier validation** — uniqueness within namespace and resolvability of
   all referenced ids.
3. **Challenge mapping** — each displayed challenge resolves to **exactly one**
   designated correct answer card (Requirement 3.2).
4. **Ambiguity elimination** — reject/resolve any answer card valid for more
   than one active challenge; reject duplicate display texts (Requirement 3.3,
   3.5).
5. **Global uniqueness** — every answer-card display value is unique across all
   zones; for math, distinct numerical answers (Requirement 3.4).
6. **Starting-hand feasibility** — a valid five-card hand with two or three
   correct cards and plausible distractors can be dealt without violating
   uniqueness (Requirement 4). For competitive (vs Beepy) generation, the deck
   must support a valid five-card starting hand for **both** players
   simultaneously without any shared or duplicated display value (master spec
   §7).
7. **Deck sufficiency and bounds** — see D8.

### D6 — Deck-exhaustion fallback (contract, not yet implemented)
When the draw pile empties mid-game and a penalty draw is required, the
game-specific fallback must mint a penalty card that has a **unique, valid
display value** colliding with nothing already present or used in the active
game (any hand, the draw deck, played cards, or the discard pile) (master spec
§4; steering `no-duplicate-card-invariant.md`).

- The fallback **must never** reuse an existing card, emit a duplicate display
  value, or produce an invalid/implausible card to satisfy a count.
- A fallback penalty card may be generated **only when** its display value is
  valid, plausible, globally unique, and unused (Decision 3).
- If no such card can be generated, the system **must return a structured
  `PENALTY_CARD_EXHAUSTED` condition** (surfaced through the D7 error model)
  rather than fabricate an invalid or duplicate card.
- The uniqueness invariant is never relaxed, even under exhaustion. Returning
  `PENALTY_CARD_EXHAUSTED` is the required behavior when uniqueness cannot be
  honored.
- The **consequence** of `PENALTY_CARD_EXHAUSTED` is owner-approved (see D6a):
  the event's draw penalty is waived and the game continues. The engine
  milestone implements it; M2 defines the contract that detects and reports the
  condition.

### D6a — Penalty-draw contract (owner-approved, Task 12)
- **Order.** Cards come from the draw pile first, then from an app-supplied
  `PenaltyFallbackProvider`. Discarded or played cards are never recycled.
- **Atomic events.** A penalty event may owe one draw or several (master spec §7:
  an accepted invalid Beepy move has each player draw one card). It is
  all-or-nothing. If every owed card cannot be supplied, no card is drawn, any
  provisionally drawn card returns to its original state, and
  `PENALTY_CARD_EXHAUSTED` is returned. The shared function is event-agnostic:
  which game events owe draws is defined by the master spec and applied by the
  engine milestone.
- **Consequence.** The event's entire draw penalty is waived, the exhaustion is
  recorded, and the game continues. The invalid card is still returned to the
  hand, the turn still counts, and the existing win conditions are unchanged
  (empty hand wins; competitive ends immediately on an empty hand). The timing of
  challenge adjudication and win detection belongs to the engine milestone.
- **Candidate checks.** Each fallback candidate is evaluated against every active
  challenge and rejected if duplicated, invalid, implausible, previously used, or
  a valid answer to an active challenge, so a penalty card is always a distractor.
  Attempts are bounded by `maxCandidates` (default 50, configurable).
- **Payload.** `PENALTY_CARD_EXHAUSTED` carries `code`, `message`, `path`
  (`drawPile`) and `details`: the owed `requests` (player id and reason:
  `INVALID_ACTION`, `WRONG_CHALLENGE`, or `MISSED_CHALLENGE`),
  `drawPileRemaining`, `cardsInPlay`, and `fallback` with `status`
  (`NOT_AVAILABLE`, `EXHAUSTED`, or `LIMIT_REACHED`), `candidatesTried`,
  `maxCandidates`, and per-reason `rejections`. It holds counts only, never card
  faces, so it is safe while a hand is hidden.
- **Subject rule.** Math may generate candidates (plausible unused numbers in the
  difficulty range). Clinical never generates facts or explanations at runtime:
  its fallback must be pre-authored, reviewed content, and with none the status
  is `NOT_AVAILABLE`. Fallback cards never carry explanations.

### D7 — Error model
Validation failures return structured, actionable errors (code, human-readable
message, offending id/path) rather than throwing opaque errors. This supports
the "understandable import errors" requirement (master spec §12). The
deck-exhaustion condition from D6 is surfaced through the same structured,
actionable model.

### D8 — Deck sufficiency and size targets (Decision 3, approved)
The deck must contain enough unique answer-card values to support the dealt
hand(s) plus expected penalty draws without violating global uniqueness
(Requirement 3.4, 4; Requirement 6).

**Competitive (Player vs. Beepy) Math Cards:**
- **Target: 24 unique answer cards** — nine correct-answer cards for the nine
  shared challenges plus fifteen distractors (master spec §10).
- **Smaller validated deck allowed** when the plausible value range cannot
  support 24 unique values. The **competitive minimum is 14 cards**, and only
  if generation can actually construct:
  - two valid, **non-overlapping** five-card starting hands (one per player),
    each containing two or three correct cards, **and**
  - at least **one unused valid distractor** retained for a penalty draw.
- A deck that cannot meet this minimum under all invariants is rejected as
  insufficient data (Requirement 6.1).

**Solitaire (and Tutor, which reuses Solitaire dealing):**
- Use **five challenges** and a **five-card starting hand** with two or three
  correct cards.
- Require at least **one additional valid distractor** available for a penalty
  draw.
- The competitive 24-card target does **not** apply; deck size is configurable
  and selected to satisfy these constraints without violating uniqueness.

**Both modes:**
- All starting-hand, challenge-mapping, and global-uniqueness invariants remain
  **mandatory**.
- Do **not** pad easy difficulty levels with implausible or absurd distractors
  merely to reach a fixed count; a smaller correct deck is preferred over an
  invalid padded one.
- If the available range cannot even support the mode's required starting
  hand(s) and minimum draw reserve, generation fails cleanly with an actionable
  insufficient-data error (Requirement 6.1) rather than emitting an unfair or
  invalid deck.

## Separation and placement (Decision 4, approved; implemented later)

Consistent with `.kiro/steering/architecture.md`:

- **`shared-engine/`** (subject-neutral): the common **source-data types**
  (`SubjectRecord`, `Topic`, `AnswerEntry`, `SubjectCollection`), the
  **generated-deck contracts** (`GeneratedDeck` and friends), and the
  **subject-neutral validation contracts**. No DOM, no UI-framework, no subject
  logic.
- **`math-cards/`**: Math expression generation.
- **`clinical-cards/`**: clinical fact generation.
- The gameplay **engine consumes validated generated decks only** — never raw
  subject-specific source data.
- Shared contracts carry **no UI-framework or DOM dependencies**.

Physical file placement is **not** performed during M2 preparation; this fixes
*where* the pieces will live when implementation is approved.

## Proposed tests (for later implementation; none run in M2 prep)

Each maps to an invariant/requirement (master spec §16; Requirement 7):

- `uniqueness-across-zones` → Req 3.4. No display value repeats across hands,
  draw deck, played, and discard.
- `one-correct-card-per-challenge` → Req 3.2. Exactly one designated correct
  card per displayed challenge.
- `ambiguous-answer-rejected` → Req 3.3. An answer valid for two active
  challenges is rejected or resolved.
- `duplicate-display-text-rejected` → Req 3.5.
- `valid-starting-hand-composition` → Req 4.1–4.3. Five distinct cards, two or
  three correct, no leak.
- `competitive-dual-hand-feasibility` → Req 4.4, stage 6. Both players receive
  valid, non-overlapping five-card starting hands.
- `contextual-play-and-discard` → master spec §4. A card correct only in
  context is judged correctly per challenge.
- `direction-factToSubject` and `direction-subjectToFact` → Req 2.2, 2.3. Both
  directions generate a valid deck for either app.
- `competitive-math-deck-size-target` → D8. Competitive Math generates 24 unique
  cards where the plausible range allows.
- `smaller-validated-deck-when-range-limited` → D8. A limited range yields a
  smaller but fully valid deck, not a padded or invalid one.
- `draw-pile-exhaustion-reports-condition` → D6, Req 6.3. When no unique valid
  penalty card can be produced, an explicit exhaustion condition is reported;
  no duplicate or invalid card is ever created.
- `insufficient-data-fails-cleanly` → Req 6.1. Scarce data fails with an
  actionable error and no partial deck.
- `invalid-json-import-errors` → Req 6.5. Structural/gameplay import errors are
  actionable.

**Status: proposed, not yet run.** No test is implemented or executed in M2
preparation.

## Out of scope for M2 (and for M2 preparation)

- Any implementation code, real decks, or content authoring.
- Engine turn/evaluation lifecycle, scoring, modes (those are later phases).
- UI, rendering, and the UI-framework decision.
- Dependency install, builds, Git initialization, hosting.

## Resolved decisions (approved by owner for specification; not implementation)

The five previously open decisions were reviewed and approved for
specification updates only. Approval does **not** authorize implementation.

1. **Identifier namespaces (Decision 1)** — globally unique, stable,
   descriptive string ids with subject-qualified prefixes; uniqueness validated
   across all imported collections; duplicate ids are actionable errors. (D2)
2. **Collection wrapper (Decision 2)** — common versioned wrapper
   `{ "schemaVersion": "1.0.0", "subjects": [] }`; both apps use the identical
   schema; merge only when schema versions match and all ids stay unique;
   reject incompatible versions and conflicting ids; never silently overwrite.
   (D2a)
3. **Deck counts and exhaustion (Decision 3)** — competitive Math target 24
   cards (9 correct + 15 distractors); competitive minimum 14 cards subject to
   dual-hand feasibility plus one penalty distractor; Solitaire uses five
   challenges, a five-card hand, and at least one penalty distractor, with no
   24-card target; on exhaustion, generate a fallback only when valid, plausible,
   globally unique, and unused, else return structured `PENALTY_CARD_EXHAUSTED`;
   gameplay consequence deferred to the engine milestone. (D6, D8)
4. **Shared schema placement (Decision 4)** — source-data types, generated-deck
   contracts, and subject-neutral validation contracts live in `shared-engine/`;
   math generation in `math-cards/`, clinical generation in `clinical-cards/`;
   engine consumes validated decks only; no UI/DOM in shared contracts.
   (Separation section)
5. **Optional explanations (Decision 5)** — explanations optional and
   challenge-contextual; omit when absent; never invent or substitute; never on
   a card face. (D5)

### Remaining items deferred to the approved-implementation milestone
These are implementation details, not open policy questions:
- Exact prefix tokens and the concrete `PENALTY_CARD_EXHAUSTED` payload shape.
- The precise penalty-card fallback generation algorithm.
- Controlled-repetition selection specifics (master spec §5, §12).
