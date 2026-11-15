# Beepy's Clinical Cards — Requirements

**Milestone:** M6 — the second app, Beepy's Clinical Cards (master spec §1, §8, §9,
§11, §12, §13, §16). Follows M5 (Math Cards browser interface), which is accepted.

**Status (2026-11-14):** C0–C8 are accepted by the owner. C9 (documentation and
close-out) is done and awaits the owner's final M6 acceptance. The Teaching
Edition (single-disease Solitaire redesign) and Tutor Mode are deferred to a
separate post-hackathon project.

**Status (2026-11-12, superseded):** C0–C4 are accepted. C5 preparation is done,
but C5 is blocked until the owner supplies reviewed content. C6–C9 are not
authorized.

**Earlier status:** The owner approved the plan with revisions to C-3, C-6 and
C-12 and a terminology clarification for `subjectIncorrects`; all other decisions
were approved as recommended (`design.md` §10). **Only stages C0 and C1 are
authorized.** C2–C9 need further owner authorization.

## Introduction

Build a browser card game for medical students reviewing high-yield USMLE disease
facts. It is **not** an NBME-style multiple-choice question app: there are no
vignettes, no stems, and no question-bank content. A challenge is a disease plus a
category (for example "Disease X · Work-up"), and an answer card is one concise,
reviewed fact. The app offers Solitaire and Player vs. Beepy with exactly the same
rules, penalties, scoring and engine as Math Cards.

The shared engine (M2/M3) decides every rule. A new Clinical generator turns
owner-authored, reviewed clinical JSON into validated decks. The UI is a thin
presentation layer, consistent with Math Cards but with wider, multi-line cards.

Authoritative references: `docs/master-spec-v1.1.md` §2–§9, §11–§13, §16;
`.kiro/specs/educational-data-schema/` (schema, deck contract, penalty fallback);
`.kiro/specs/game-engine/` (controller, views, privacy boundary);
`.kiro/specs/math-deck-generator/` (pattern for generator and series wrapper);
`.kiro/specs/math-cards-ui/` (UI pattern); all five steering documents.

## Out of scope for M6

Tutor Mode; Player vs. Player; educational rewards ("Top Problem Solver"); any
change to Math Cards (`math-cards/`) or its behavior; changes to M2/M3 production
code (except a separately approved fix for a demonstrated defect); AI-generated or
Kiro-written clinical facts or explanations; a substitute production dataset;
external services, accounts, network use; user JSON import in the browser;
persistent local learning history and controlled repetition; sound; deployment;
new runtime or development dependencies; Git; `npm audit fix`.

## Requirements

### Requirement 1 — Clinical content is owner-authored and reviewed
1. Every disease name, topic fact, alternative diagnosis, explanation and
   cross-disease review decision in the shipped data SHALL be authored or supplied
   by the project owner (or a medical reviewer the owner designates) and recorded
   as reviewed. Kiro SHALL NOT write, draft, paraphrase or "fill in" clinical
   content (C-2).
2. Kiro MAY provide: the schema template, an authoring guide, validation tooling,
   review reports, and a test-only fixture dataset whose names and facts are
   obviously fictitious ("Test Disease 1", "Test Disease 1 work-up fact A").
3. Content SHALL contain no NBME items, no vignettes, and no text copied from any
   copyrighted question bank or review book (originality steering).
4. The app SHALL show the notice "For study practice only. Not medical advice."
   (C-13).

### Requirement 2 — Clinical dataset shape and content validation
1. The dataset SHALL use the existing M2 `SubjectCollection` schema unchanged:
   subject = disease; topics with `corrects` / `incorrects`; stable ids; optional
   `explanation`. `subjectIncorrects` SHALL contain only genuinely incorrect
   alternative diagnoses, never synonyms, abbreviations, or equivalent names of
   the correct disease.
2. Each disease SHALL use only the four approved categories (master spec §11):
   Classic Signs & Symptoms, Work-up, Pathology, Management/Treatment, each at most
   once. Each included category SHALL hold one to three reviewed `corrects`. A
   disease MAY omit a category.
3. A Clinical content validator SHALL run on top of `validateCollectionSource` and
   report actionable issues with exact JSON paths for at least: no diseases; a
   disease with no categories; an unknown or repeated category; zero or more than
   three corrects; empty text or explanation; card text longer than **140
   characters** (C-12); the same text twice in one list; a text listed as both
   correct and incorrect for the same topic; an alternative diagnosis equal to the
   disease's own name; two diseases with the same name; an id outside the
   `clinical` namespace.
4. Explanations MAY be longer than 140 characters. They are never shown on a card
   face, only separately after resolution (C-5).
5. Synonyms and clinical overlap cannot be detected by software. The authoring
   guide SHALL tell the author how to check for them; the validator SHALL NOT
   claim to detect them.
6. The shipped dataset SHALL be validated at startup. An invalid dataset SHALL show
   a friendly error screen and never start a game.

### Requirement 3 — Contextual correctness (C-3, revised)
1. A fact SHALL never be treated as an incorrect distractor merely because it is
   absent from another disease's or category's list. Missing data never implies
   clinical falsehood.
2. For a fact and a challenge (disease + category), the relationship is:
   **valid** when the fact is listed in that topic's `corrects`; **invalid** only
   when explicitly supported by review (listed in that topic's `incorrects`, or
   covered by an owner review record per `design.md` §4); otherwise **unknown**.
3. Unknown relationships SHALL never justify a distractor: a card that is unknown
   for any active challenge is not placed on that board.
4. The same rule applies to disease-name cards in `factToSubject`. An alternative
   diagnosis listed in `subjectIncorrects` SHALL be unknown for a disease's facts
   unless a current alternative-diagnosis review covers it (Q-1). Such reviews
   SHALL be small (one record per disease, optionally covering only some
   alternatives). They SHALL become stale when any correct fact of the disease or
   a covered alternative's text changes. Unreviewed or stale relationships SHALL
   never supply distractors. Diagnoses SHALL never be invented or added without
   review just to reach a deck-size target.
5. A review report SHALL list shared facts, potentially ambiguous relationships,
   unreviewed topic pairs (including cross-category pairs), stale review records,
   and coverage that may restrict deck generation. It SHALL make no clinical
   judgments.
6. The M2 ambiguity analysis and the exactly-one-designated-answer invariant SHALL
   be preserved: ambiguous cards and duplicate texts are removed, and each
   challenge has exactly one designated correct card.
7. A review record SHALL establish invalidity only with the owner attestation
   (exact statement, named reviewer, real date) and at least two dataset topics.
   Small groups, down to a single pair, SHALL be allowed and combine.
8. A review SHALL become stale, and stop establishing invalidity, when the
   reviewed content of any of its topics changes. Detection SHALL use a
   deterministic fingerprint computed by the tooling. The owner never computes
   one. The tooling SHALL name the review and topic to renew and offer a renewal
   draft.

### Requirement 4 — Clinical deck generator
1. `ClinicalDeckGenerator` SHALL replace the stub and implement the shared
   `DeckGenerator` contract, returning the M4 `GenerationResult` (deck, complete
   contextual-validity matrix, `numericAnswers: false`, sizing) or a full issue
   list with no deck.
2. It SHALL support `subjectToFact` (default) and `factToSubject` (C-7), for
   Solitaire (5 challenges) and vsBeepy (9 challenges).
3. It SHALL be deterministic for a given dataset, review data, request and seed.
4. Every card `displayValue` and every challenge prompt's clinical text SHALL be
   taken verbatim from the dataset. The generator never composes clinical text.
5. Every generated deck SHALL pass `validateDeckForPlay` before it is returned.
6. Deck targets SHALL be 15 (Solitaire) and 24 (Player vs. Beepy), with the M2
   minimums. A smaller validated deck is allowed when the eligible unique pool is
   insufficient. Decks are never padded with inappropriate, ambiguous, unknown or
   duplicate cards, and cards are never reused (C-6).
7. In `factToSubject`, the card pool is limited to distinct disease names plus
   reviewed alternative diagnoses: 16 diseases give at most 16 disease-name cards
   unless further reviewed incorrect diagnoses are supplied (C-6).
8. Explanations SHALL be attached only to the exact (card, challenge) context the
   author wrote them for (`design.md` §5.3).

### Requirement 5 — Penalty fallback
1. When the draw pile is exhausted, the Clinical fallback SHALL offer only unused,
   pre-authored, reviewed dataset entries that are reviewed-invalid for every
   active challenge (C-4). It never creates text and never offers unknowns.
2. When no suitable entry exists, the engine's existing waiver path applies
   unchanged.

### Requirement 6 — Clinical series wrapper
1. `createClinicalSeries` SHALL mirror `createMathSeries`: validated config, a
   frozen methods-only object, sanitized public errors, trusted diagnostics sink,
   per-game generator seed derivation, Beepy error rate default 0.2.
2. It SHALL never expose a deck, a validity matrix, or a designated answer.
3. It SHALL offer `explainResolved(turn)` (C-5), which returns an explanation only
   for an action the engine has already resolved, only for that exact card and
   challenge, never for discards (C-11), and returns "none" rather than a
   substitute.

### Requirement 7 — Gameplay parity
1. Solitaire and Player vs. Beepy SHALL use the shared engine unchanged: five
   distinct starting cards with two or three correct, the same turn, penalty,
   Accept/Challenge, both-draw rule, winning, tiebreak and series rules as Math.
2. Tutor and Player vs. Player SHALL NOT appear.

### Requirement 8 — User interface
1. Screen flow, layout, Beepy avatar, feedback, results, drag-and-drop and
   tap-to-select, keyboard access and reduced-motion support SHALL match Math Cards.
2. Cards SHALL be wider and show up to 140 characters across multiple lines
   without cutting off qualifiers; challenges SHALL show the disease and the
   category readably; nine vsBeepy challenges SHALL stay readable at desktop width.
3. Setup SHALL offer mode and question style (disease + category → fact, default;
   fact → disease). There are no difficulty levels.
4. Feedback SHALL be correctness-only by default. "Explain Why" appears only after
   resolution, shows the explanation in a separate panel, and only when one exists.
5. Visual style SHALL be modern and polished, with a Clinical theme distinct from
   Math; no retro or pixel art. All assets are new.
6. The app SHALL make no network requests and use no browser storage.

### Requirement 9 — Build and independence
1. `clinical-cards` SHALL build to a static bundle in `clinical-cards/web-dist` with
   relative paths, using the existing Vite tooling, like Math.
2. `clinical-cards` SHALL depend only on `@beepy/shared-engine`, never on
   `math-cards`; the engine SHALL never depend on `clinical-cards`.
3. Math Cards SHALL keep building and its tests SHALL keep passing unchanged.
4. All new code SHALL pass the TypeScript build, the test type-check and ESLint.

### Requirement 10 — Testing and evidence
1. Automated tests SHALL cover: content validation errors with exact codes and
   paths; the validity policy including "unknown"; the review report; generator
   invariants for both modes × both directions over many seeds (uniqueness across
   all zones, one answer per challenge, valid starting hands, verbatim text,
   contextual explanations, no unknown cards); the actual achievable deck sizes
   for both modes and directions on the shipped dataset; the fallback; series
   wrapper privacy; full simulated series to completion; UI model, privacy and
   import-boundary guards like M5.
2. Independent oracles SHALL recompute expected validity from the fixture dataset
   rather than reuse generator code.
3. Browser, touch, width and screen-reader checks SHALL be recorded only as the
   owner reports them. Untested checks are recorded as "not run".
4. Every stage SHALL be logged in `docs/kiro-development-log.md` with real commands
   and results.
