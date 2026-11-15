# Educational Data Schema and Validation — Requirements

**Milestone:** M2 — Unified JSON source-data schema, generation/validation
direction, and automated invariants (master spec §18, phase 2). Follows M1
(foundation), which is complete.

**Scope boundary (specification only):** This document and its companion
`design.md` and `tasks.md` define *what* M2 will build and verify. They do
**not** authorize implementation. No source code, no real decks, no dependency
install, no builds, no UI-framework choice, no Git init, no deployment, and no
gameplay. All implementation tasks remain unchecked pending explicit owner
approval.

## Introduction

Define a single, subject-neutral educational source-data format and a
deterministic generation-and-validation contract that both Beepy's Math Cards
and Beepy's Clinical Cards can use. The format and contract must uphold the
master spec's core invariants (one designated correct card per challenge;
unique answer-card display values across the entire active game; valid starting
hands) while keeping the source data, app-specific generation, and the
subject-neutral engine cleanly separated.

Authoritative references: `docs/master-spec-v1.1.md` §4, §8, §9, §10, §11,
§12, §16; and the steering documents
`.kiro/steering/educational-data-independence.md`,
`.kiro/steering/no-duplicate-card-invariant.md`, and
`.kiro/steering/architecture.md`.

## Requirements

### Requirement 1 — Common subject → topics → corrects/incorrects source format

**User story:** As a content author for either app, I want one JSON source-data
format with stable identifiers, so that math and clinical content are expressed
the same way and can be loaded by shared tooling.

#### Acceptance criteria
1. THE schema SHALL represent a single-subject record with fields: `id`,
   `subject`, `subjectIncorrects`, and `topics`, matching master spec §8.
2. EACH topic SHALL have `id`, `topicName`, `corrects`, and `incorrects`.
3. EACH answer entry (in `corrects`, `incorrects`, and `subjectIncorrects`)
   SHALL have `id`, `text`, and an optional `explanation`.
4. THE schema SHALL define a versioned collection wrapper
   `{ "schemaVersion": "1.0.0", "subjects": [] }` (semantic versioning) that
   holds multiple subject records for the data loader (Decision 2). Multiple
   collections MAY be merged only when their `schemaVersion` values match and
   all identifiers remain globally unique; incompatible versions and
   conflicting identifiers SHALL be rejected with actionable errors, and records
   SHALL NOT be silently overwritten.
5. EVERY `id` (subject, topic, and answer entry) SHALL be a globally unique,
   stable, descriptive string using subject-qualified prefixes that prevent
   collisions between Math and Clinical content; uniqueness SHALL be validated
   across all imported collections, and a duplicate id SHALL produce an
   actionable error (Decision 1).
6. THE same schema SHALL serve both apps; there SHALL NOT be a separate schema
   per subject or per generation direction.

### Requirement 2 — Configurable generation direction, one schema

**User story:** As a game configurer, I want to choose `factToSubject` or
`subjectToFact` as configuration, so that both apps use one schema and one
generated challenge/answer-card format.

#### Acceptance criteria
1. THE generator SHALL accept a generation-direction configuration value with
   stable identifiers `factToSubject` and `subjectToFact` (master spec §9).
2. WHEN direction is `factToSubject` THEN the challenge SHALL display a
   fact/expression and the answer card SHALL display the subject
   (Math default, e.g. `3 + 4 = ?` → `7`).
3. WHEN direction is `subjectToFact` THEN the challenge SHALL display a subject
   and topic and the answer card SHALL display one selected correct fact
   (Clinical default, e.g. `Graves Disease — Work-up` → `Positive TSI/TRAb`).
4. BOTH directions SHALL work for either app and SHALL produce the same
   validated generated-challenge/answer-card structure.
5. Generation direction SHALL be configuration only; it SHALL NOT require a
   different JSON schema.

### Requirement 3 — Contextual correctness, one correct card per challenge, global uniqueness

**User story:** As the engine, I want decks validated so judging is reliable,
so that every challenge has exactly one correct card and no answer-card display
value repeats anywhere in the active game.

#### Acceptance criteria
1. THE validator SHALL treat source `corrects`/`incorrects` as **contextual**
   relationships, not universal true/false labels (master spec §8).
2. BEFORE a deck is accepted, the generator SHALL check every selected answer
   card against **all active challenges** and SHALL designate exactly one
   correct card per displayed challenge.
3. THE validator SHALL reject or resolve any answer card that is a valid answer
   to more than one active challenge (ambiguous match).
4. EVERY answer-card **display value** SHALL be unique across the entire active
   game: all hands, the draw deck, played cards, and the discard pile
   (master spec §4). FOR math, every displayed problem SHALL also have a
   distinct numerical answer.
5. THE validator SHALL reject duplicate answer-card display texts in a
   generated deck.
6. A card `explanation` SHALL be optional and contextual to a specific
   challenge, bound to a `challengeId` rather than to a card in isolation; when
   no explanation exists for a context the display SHALL be omitted, the system
   SHALL NOT invent or substitute explanatory content, and explanations SHALL
   NOT be shown on the face of a card (Decision 5).

### Requirement 4 — Valid starting hands

**User story:** As a player, I want a fair, non-leaking starting hand, so that
the deal matches the master spec's composition rules.

#### Acceptance criteria
1. EACH active hand (human or Beepy) SHALL start with **five distinct cards**.
2. A starting hand SHALL contain **two or three** cards that are valid answers
   to currently displayed challenges; the remainder SHALL be plausible
   distractors (master spec §4).
3. THE deal SHALL NOT reveal which cards are correct.
4. STARTING-HAND composition SHALL NOT violate the global uniqueness invariant
   in Requirement 3.4.
5. FOR competitive (Player vs. Beepy) generation, the deck SHALL support two
   valid, **non-overlapping** five-card starting hands dealt simultaneously
   (one per player), each with two or three correct cards, plus at least one
   unused valid distractor retained for a penalty draw (Decision 3; master spec
   §7).
6. FOR Solitaire (and Tutor, which reuses Solitaire dealing), the deck SHALL
   support a five-card starting hand with two or three correct cards over five
   challenges, plus at least one additional valid distractor available for a
   penalty draw (Decision 3).

### Requirement 5 — Separation of data, generation, and engine

**User story:** As a maintainer, I want source data, app-specific generation,
and the subject-neutral engine kept separate, so that the engine stays
subject-agnostic and the one-engine/two-apps architecture holds.

#### Acceptance criteria
1. THE source-data schema and the generated-deck contract SHALL be defined so
   the engine consumes a validated, subject-neutral generated deck and never
   parses raw subject source data directly.
2. SUBJECT-SPECIFIC generation logic (math expression generation, clinical fact
   selection) SHALL be defined as app-specific, not part of the engine.
3. THE schema, validation contract, and generated-deck contract SHALL NOT
   depend on any UI framework or the DOM.
4. THE common source-data types, generated-deck contracts, and subject-neutral
   validation contracts SHALL be placed in `shared-engine/`; Math expression
   generation SHALL live in `math-cards/` and clinical fact generation in
   `clinical-cards/` (Decision 4). The engine SHALL consume validated generated
   decks only, never raw subject-specific source data, and shared contracts
   SHALL carry no UI-framework or DOM dependencies. (Physical placement is
   implemented in a later milestone, not M2 spec preparation.)

### Requirement 6 — Insufficient data, ambiguity, and deck exhaustion

**User story:** As the project owner, I want safe, explicit handling of bad or
scarce data, so that the engine never silently introduces a duplicate or an
impossible deck.

#### Acceptance criteria
1. WHEN source data cannot produce a valid deck (too few unique values, no
   unambiguous correct card for a challenge) THEN generation SHALL fail with an
   actionable, understandable error and SHALL NOT emit a partial or invalid
   deck.
2. THE validator SHALL reject ambiguous answers that match more than one active
   challenge unless the generator explicitly resolves or excludes them.
3. WHEN the draw deck is exhausted THEN a fallback penalty card MAY be generated
   **only when** its display value is valid, plausible, globally unique, and
   unused; it SHALL NOT reuse any card already present or used in the game. IF
   no such card can be generated THEN the system SHALL return a structured
   `PENALTY_CARD_EXHAUSTED` condition and SHALL NOT fabricate an invalid or
   duplicate card or relax the uniqueness invariant. Every fallback candidate
   SHALL be checked against every active challenge and SHALL be rejected when it
   is duplicated, invalid, implausible, previously used, or a valid answer to an
   active challenge. Fallback attempts SHALL be bounded (default 50, configurable).
   A penalty event that cannot supply ALL of its required cards SHALL be atomic:
   no card is drawn and any provisionally drawn card returns to its original
   state. The owner-approved consequence is that the event's draw penalty is
   waived, the exhaustion is recorded, and the game continues with its existing
   win conditions unchanged. Implementing that consequence, and the timing of
   challenge adjudication and win detection, belongs to the later engine
   milestone. Clinical fallback content SHALL be pre-authored and reviewed;
   clinical facts and explanations SHALL NOT be generated at runtime (Decision 3;
   master spec §4).
4. CARD-COUNT bounds SHALL be: competitive Math target **24** unique answer
   cards (nine correct + fifteen distractors), competitive **minimum 14** cards
   subject to the dual-hand + penalty-reserve feasibility in Requirement 4.5;
   Solitaire uses five challenges with the reserve in Requirement 4.6 and no
   24-card target. A smaller validated deck SHALL be permitted when the
   plausible value range cannot support the target, rather than padding with
   implausible distractors (Decision 3; master spec §10).
5. INVALID JSON imports SHALL produce structural and gameplay validation errors
   that are actionable and understandable (master spec §12).

### Requirement 7 — Acceptance criteria and proposed tests for later implementation

**User story:** As the project owner, I want the tests defined up front, so that
implementation in a later milestone has clear, verifiable targets.

#### Acceptance criteria
1. THE spec SHALL enumerate proposed automated tests covering: card-value
   uniqueness across all zones; one-correct-card-per-challenge; valid
   starting-hand composition; contextual play/discard correctness; ambiguous-
   answer rejection; both generation directions; draw-pile exhaustion fallback;
   insufficient-data failure; and invalid-JSON import errors (master spec §16).
2. EACH proposed test SHALL name the invariant or requirement it protects.
3. THE spec SHALL record that these tests are **proposed and not yet run**; no
   test may be reported as passing in M2 preparation.

### Requirement 8 — No implementation in M2 preparation

#### Acceptance criteria
1. M2 preparation SHALL produce only `requirements.md`, `design.md`, and
   `tasks.md` under `.kiro/specs/educational-data-schema/`, plus a development-
   log entry.
2. M2 preparation SHALL NOT write source code, generate real decks, install
   dependencies, run builds, choose a UI framework, initialize Git, or publish.
3. ALL M2 implementation tasks SHALL remain unchecked until the owner
   explicitly approves implementation.
