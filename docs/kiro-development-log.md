# Kiro Development Log — Beepy Educational Card Game Engine

A chronological, evidence-based journal of development milestones. Per the
master specification (§15) and the `.kiro/steering/verified-work-only.md`
policy, this log records **only witnessed events**. It never claims a test
passed unless the test was actually run and observed to succeed; tests that
were not run are recorded as "not run".

Kiro cannot observe activity performed outside the current Kiro session. Any
external evidence (commit hashes, chat exports, screenshots) is added by the
project owner.

---

## Entry template

Copy this template for each new milestone entry.

```markdown
## [YYYY-MM-DD] Milestone <ID> — <short title>

- **Objective:** <what this milestone set out to achieve>
- **Prompt ID / summary:** <prompt identifier and one-line summary>
- **Linked spec / steering:** <paths to the relevant .kiro spec and steering>
- **Kiro features actually used:** <specs, steering, hooks, agent features, etc.>
- **Environment:** <OS, Node, npm, git versions, as observed>

### Files created
- <path> — <purpose>

### Files modified
- <path> — <what changed and why>

### Commands run (and observed outcomes)
- `<command>` → <exact outcome: success / error text / exit code>
- (Record "none" if no commands were run.)

### Tests
- <test name> → <passed / failed / not run>
- (If no test framework is installed yet, record "not run — dependencies not installed".)

### Issues encountered and corrective actions
- <issue> → <action taken / resolution / still open>

### Outcome
- <state of the milestone: complete / partial / blocked>

### Evidence references
- <commit hash, chat export, screenshot, or "none yet">
```

---

## [2026-11-09] Milestone M1 — Project foundation and development tracking

- **Objective:** Establish a clean, reviewable project foundation (npm
  workspaces monorepo scaffolding, Kiro steering, a milestone spec, this
  development log, a safe `.gitignore`, LICENSE, and README) without
  implementing gameplay or installing dependencies.
- **Prompt ID / summary:** Kiro Prompt 01 — "Foundation and Development
  Tracking (No Game Implementation Yet)," followed by several owner follow-up
  prompts that (a) approved the technology stack as scaffold-only, (b) corrected
  a TypeScript config file, (c) corrected premature task-completion checkboxes,
  and (d) corrected and re-sequenced the README and this journal.
- **Linked spec / steering:**
  - Spec: `.kiro/specs/foundation-setup/` — `requirements.md`, `design.md`,
    `tasks.md`.
  - Steering: `.kiro/steering/architecture.md`,
    `originality-and-copyright.md`, `no-duplicate-card-invariant.md`,
    `educational-data-independence.md`, `verified-work-only.md`.
- **Kiro features actually used:**
  - Kiro steering documents (`.kiro/steering/`).
  - Kiro spec (`.kiro/specs/foundation-setup/`).
  - Kiro agent file operations (create, rename/move) and directory/file
    inspection to verify state.
  - No Kiro hooks were created (intentional — no real workflow to automate yet,
    per master spec §15 and the verified-work-only steering).
- **Environment (observed via terminal this session):**
  - OS: Windows (win32), PowerShell.
  - Node: v22.11.0
  - npm: 11.11.0
  - git: 2.43.0.windows.1

### Files created
Verified present on disk at time of writing:
- `docs/master-spec-v1.1.md` — authoritative master specification, preserved
  (renamed from a doubled-extension filename; see Issue 1).
- `package.json` — root; npm workspaces + dev scripts (not installed).
- `tsconfig.base.json` — shared strict TypeScript compiler options.
- `tsconfig.json` — solution file with references to the three workspaces.
- `eslint.config.js` — ESLint flat config.
- `.prettierrc.json`, `.prettierignore` — Prettier configuration.
- `.gitignore` — ignores dependencies/build/secrets; explicitly does NOT ignore
  `.kiro/`.
- `LICENSE` — MIT.
- `README.md` — project overview, two demos, structure, nonfunctional status.
- `shared-engine/package.json`, `shared-engine/tsconfig.json`,
  `shared-engine/src/.gitkeep`, `shared-engine/README.md`.
- `math-cards/package.json`, `math-cards/tsconfig.json`,
  `math-cards/src/.gitkeep`, `math-cards/README.md`.
- `clinical-cards/package.json`, `clinical-cards/tsconfig.json`,
  `clinical-cards/src/.gitkeep`, `clinical-cards/README.md`.
- `.kiro/steering/architecture.md`,
  `.kiro/steering/originality-and-copyright.md`,
  `.kiro/steering/no-duplicate-card-invariant.md`,
  `.kiro/steering/educational-data-independence.md`,
  `.kiro/steering/verified-work-only.md`.
- `.kiro/specs/foundation-setup/requirements.md`,
  `.kiro/specs/foundation-setup/design.md`,
  `.kiro/specs/foundation-setup/tasks.md`.
- `.kiro/hooks/.gitkeep` — placeholder; no real hooks yet.
- `docs/kiro-development-log.md` — this journal.

### Files modified
- `package.json` — devDependencies adjusted so the ESLint packages listed
  (`@eslint/js`, `typescript-eslint`) match what `eslint.config.js` imports,
  replacing an initial `@typescript-eslint/eslint-plugin` + `parser` listing.
- `shared-engine/tsconfig.json` — recreated after rejection (see Issue 2).
- `.kiro/specs/foundation-setup/tasks.md` — recreated twice to correct
  completion honesty (see Issue 3).
- `README.md` — recreated/corrected across review to stop describing this
  development log as already existing (see Issue 4).

### Commands run (and observed outcomes)
- `node --version` → `v22.11.0` (exit 0).
- `npm --version` → `11.11.0` (exit 0).
- `git --version` → `git version 2.43.0.windows.1` (exit 0).
- `git rev-parse --is-inside-work-tree` → `fatal: not a git repository`
  (exit 1). The workspace is not a Git repository; none was initialized this
  milestone (nothing published to GitHub, per scope).
- **Dependency installation:** not run.
- **Build:** not run.
- No other commands were executed.

### Tests
- **Not run — dependencies not installed and no engine code exists yet.**
- No automated tests were written this milestone. The card-invariant and other
  tests required by master spec §16 are deferred to a later milestone.

### Issues encountered and corrective actions
1. **Master spec had a doubled file extension** (`master-spec-v1.1.md.md`).
   Action: renamed to `docs/master-spec-v1.1.md`, contents preserved exactly.
   Verified present. Resolved.
2. **Invalid `$comment` key inside `compilerOptions`** in the first
   `shared-engine/tsconfig.json`. The owner rejected that file in review
   because `$comment` is not a valid `compilerOptions` entry. Action: recreated
   the file without the invalid key, keeping `composite: true`, `rootDir`,
   `outDir`, and the project-reference setup. Confirmed the top-level
   `$comment` in `tsconfig.base.json` sits outside `compilerOptions` and is
   tolerated, so it was left unchanged. Resolved.
3. **Premature task-completion checkboxes** in `tasks.md`. An early version
   marked tasks complete before their files existed; the owner rejected it.
   A second correction was also needed because a follow-up draft still would
   have claimed uncreated files. Action: verified actual on-disk state via
   directory listings, then recreated `tasks.md` so each task is checked only
   after its files are verified present. Task 6 (this journal) was left
   unchecked until the journal actually existed and was accepted. Resolved.
4. **Development journal described uncreated work as done.** The first draft of
   this journal was rejected because it listed files and corrections as
   complete before they existed on disk (including the journal itself and, at
   the time, the README). The README was likewise corrected three times during
   review to stop implying this log already existed. Action: re-sequenced the
   work (README → tasks.md → journal), re-verified every file against disk via
   directory listings, and rewrote this entry to describe only verified state.
   Resolved.

### Outcome
- **Milestone M1 substantially complete.** Foundation scaffolding, five
  steering documents, the milestone spec, a safe `.gitignore`, LICENSE, README,
  and this development log are in place and verified on disk. Dependencies are
  intentionally not installed and no gameplay, decks, artwork, or UI exist.
- The next milestone (schema/engine implementation) has **not** begun and
  requires explicit owner approval.

### Outstanding items / owner decisions
- Explicit approval required before starting the next milestone.
- Git repository not yet initialized; GitHub publishing deferred by design.
- `LICENSE` uses a generic copyright-holder line
  ("Beepy Educational Card Game Engine contributors"); the owner may wish to
  set a specific name or entity.
- UI framework choice (React or other) remains deferred, as agreed.

### Evidence references
- None captured automatically (no Git repository initialized this milestone).
- Session/conversation export to be preserved by the project owner as external
  evidence; Kiro cannot capture that on its own.

---

## [2026-11-09] Milestone M2 (preparation) — Educational Data Schema and Validation spec

- **Objective:** Prepare the M2 specification only — requirements, design, and
  tasks for the unified educational data schema, configurable generation
  direction, and validation invariants (master spec §18, phase 2). No
  implementation.
- **Prompt ID / summary:** Kiro Prompt 02 — "Prepare the M2 specification
  only," followed by owner follow-ups that (a) corrected `design.md`
  deck-exhaustion and deck-size wording, (b) approved `tasks.md`, and (c)
  directed this log entry.
- **Linked spec / steering:**
  - Spec: `.kiro/specs/educational-data-schema/` — `requirements.md`,
    `design.md`, `tasks.md` (all verified present on disk).
  - Steering consulted: `.kiro/steering/educational-data-independence.md`,
    `no-duplicate-card-invariant.md`, `architecture.md`,
    `originality-and-copyright.md`, `verified-work-only.md`.
  - Master spec sections relied on: §4, §7, §8, §9, §10, §11, §12, §16, §18,
    §19.
- **Kiro features actually used:**
  - Kiro spec (`.kiro/specs/educational-data-schema/`).
  - Kiro steering (read for grounding; not modified).
  - Kiro agent file operations (create/append) and directory/file inspection to
    verify state.
  - No hooks created or used.

### Files created
- `.kiro/specs/educational-data-schema/requirements.md` — M2 requirements
  (8 requirements with acceptance criteria).
- `.kiro/specs/educational-data-schema/design.md` — M2 design (three-layer
  schema/generation/deck contracts, validation pipeline, D1–D8, proposed
  tests, open decisions).
- `.kiro/specs/educational-data-schema/tasks.md` — M2 implementation plan
  (20 tasks, all unchecked).

### Files modified
- `docs/kiro-development-log.md` — this M2 preparation entry appended (M1 entry
  unchanged).
- During review, `design.md` was rejected once and recreated with two owner-
  requested corrections before approval (see Issues).

### Commands run (and observed outcomes)
- None this milestone. No `node`/`npm`/`git` commands, no install, no build,
  no test run.

### Tests
- **Not run.** M2 preparation defines a set of *proposed* tests only
  (`uniqueness-across-zones`, `one-correct-card-per-challenge`,
  `ambiguous-answer-rejected`, `duplicate-display-text-rejected`,
  `valid-starting-hand-composition`, `competitive-dual-hand-feasibility`,
  `direction-factToSubject`, `direction-subjectToFact`,
  `contextual-play-and-discard`, `competitive-math-deck-size-target`,
  `smaller-validated-deck-when-range-limited`,
  `draw-pile-exhaustion-reports-condition`, `insufficient-data-fails-cleanly`,
  `invalid-json-import-errors`). None are implemented or executed.
- All M2 implementation tasks (tasks 1–20 in `tasks.md`) remain **unchecked**.

### Dependencies on later milestones
- **Runtime deck-exhaustion handling (design D6)** can only be exercised once
  the game-engine turn/penalty lifecycle exists; its behavior and the
  `draw-pile-exhaustion-reports-condition` test require later game-engine
  implementation.
- **Contextual play/discard correctness** (`contextual-play-and-discard`)
  likewise depends on the engine's play/discard evaluation, which is a later
  milestone. M2 defines the generation/validation contract that makes those
  behaviors testable, not the runtime behavior itself.

### Issues encountered and corrective actions
1. **`design.md` rejected in review for deck-exhaustion and deck-size wording.**
   Action: recreated `design.md` with (a) D6 strengthened so a penalty card
   must always have a unique valid display value and, if none exists, an
   explicit deck-exhaustion condition is reported rather than any invalid or
   duplicate card (uniqueness invariant never relaxed); and (b) a new D8
   deck-size section preserving the 24-card competitive Math target where
   feasible, allowing a smaller validated deck when the plausible unique-answer
   range is insufficient, and requiring valid starting hands for both players.
   Owner approved the revision. Resolved.

### Outcome
- **M2 specification preparation complete.** All three spec documents exist and
  are approved; the development log is updated. No implementation performed.
- The M2 implementation milestone has **not** begun and requires explicit owner
  approval. Open design decisions (identifier namespace rule, collection
  wrapper specifics, deck-count bounds + fallback algorithm/exhaustion-condition
  shape, source-schema type placement, explanation-fallback policy) remain for
  owner input before implementation (see `design.md` Open decisions and
  `tasks.md` task 20).

### Evidence references
- None captured automatically (no Git repository initialized; none initialized
  this milestone). Session/conversation export to be preserved by the project
  owner.

---

## [2026-11-09] Milestone M2 (preparation, revision) — Approved design decisions folded into the spec

- **Objective:** Update the existing M2 specification (`requirements.md`,
  `design.md`, `tasks.md`) to reflect five owner-approved design decisions.
  Specification/documentation only — not authorization to implement M2.
- **Prompt ID / summary:** Kiro Prompt 02c — owner approved the five open M2
  design decisions "for specification updates only" and requested the three
  spec documents and this log be updated consistently.
- **Linked spec / steering:**
  - Spec: `.kiro/specs/educational-data-schema/` — `requirements.md`,
    `design.md`, `tasks.md` (all verified present on disk after edits).
  - Steering unchanged; relied on `no-duplicate-card-invariant.md`,
    `educational-data-independence.md`, `architecture.md`.
  - Master spec sections relied on: §4, §5, §7, §8, §9, §10, §12, §16.
- **Kiro features actually used:**
  - Kiro spec editing (`.kiro/specs/educational-data-schema/`).
  - Kiro agent file operations (read, str_replace edits, append) and grep-based
    consistency verification across the three spec files.
  - No hooks; no code; no steering changes.

### The five approved decisions (recorded)
1. **Identifier namespaces** — globally unique, stable, descriptive string ids
   with subject-qualified prefixes preventing Math/Clinical collisions;
   uniqueness validated across all imported collections; duplicate ids are
   actionable errors.
2. **Collection wrapper** — common versioned wrapper
   `{ "schemaVersion": "1.0.0", "subjects": [] }`; identical schema for both
   apps; merge only when schema versions match and all ids stay unique; reject
   incompatible versions and conflicting ids; never silently overwrite.
3. **Deck counts and exhaustion** — competitive Math target 24 cards (9 correct
   + 15 distractors); competitive minimum 14 cards subject to two valid
   non-overlapping five-card hands plus one unused penalty distractor; Solitaire
   uses five challenges, a five-card hand, and one penalty distractor, no
   24-card target; on exhaustion, generate a fallback only when valid, plausible,
   globally unique, and unused, else return structured `PENALTY_CARD_EXHAUSTED`;
   gameplay consequence deferred to the engine milestone; uniqueness invariant
   never relaxed.
4. **Shared schema placement** — source-data types, generated-deck contracts,
   and subject-neutral validation contracts in `shared-engine/`; Math generation
   in `math-cards/`, clinical generation in `clinical-cards/`; engine consumes
   validated decks only; no UI/DOM in shared contracts.
5. **Optional explanations** — optional and challenge-contextual; omit when
   absent; never invent or substitute; never on a card face.

### Files modified
- `.kiro/specs/educational-data-schema/requirements.md` — Req 1.4 (versioned
  wrapper + merge rules), Req 1.5 (global descriptive prefixed ids), Req 3.6
  (optional contextual explanations), Req 4.5–4.6 (dual-hand + penalty reserve;
  Solitaire reserve), Req 5.4 (concrete shared-engine placement), Req 6.3
  (`PENALTY_CARD_EXHAUSTED`), Req 6.4 (24/14 competitive bounds + Solitaire).
- `.kiro/specs/educational-data-schema/design.md` — D2 and new D2a (namespaces +
  wrapper/merge), D5 (optional explanations), D6 (`PENALTY_CARD_EXHAUSTED`,
  gameplay consequence deferred), D8 (competitive 24 target / 14 minimum /
  Solitaire rules), Separation section (concrete placement), and the former
  "Open decisions" section rewritten as "Resolved decisions" with a deferred
  implementation-details list. Collection-wrapper code comment updated to
  semver.
- `.kiro/specs/educational-data-schema/tasks.md` — tasks 2, 2a (new), 3, 5, 10,
  11, 12, and 20 updated to reflect resolved decisions; all tasks remain
  unchecked.
- `docs/kiro-development-log.md` — this entry appended (M1 and the prior M2
  preparation entry preserved).

### Commands run (and observed outcomes)
- No shell/build/test commands. Two `grep_search` consistency checks were run
  via Kiro tooling: confirmed remaining "open decision" text appears only in the
  historical "Resolved decisions" heading and task 20, and that
  `PENALTY_CARD_EXHAUSTED` is used consistently across all three spec files.

### Tests
- **Not run.** M2 remains specification-only; the proposed tests are unchanged
  and unimplemented. All M2 implementation tasks (including the renumbered set
  with new task 2a) remain **unchecked**.

### Dependencies on later milestones (unchanged, restated)
- Runtime deck-exhaustion handling and the gameplay consequence of
  `PENALTY_CARD_EXHAUSTED` require the later game-engine milestone.
- Contextual play/discard correctness depends on the engine's evaluation logic
  (later milestone). M2 defines the generation/validation contract only.

### Issues encountered and corrective actions
- None. Edits applied cleanly; a post-edit consistency scan found no stale
  "open decision" wording outside its intended historical context.

### Outcome
- **M2 specification revision complete.** The three spec documents consistently
  reflect the five approved decisions; architecture, master spec, the
  no-duplicate-card invariant, and prior requirements are retained. No
  implementation performed; nothing installed, built, committed, or deployed.
- M2 implementation remains **not started** and requires explicit owner
  approval. Remaining implementation-level details (exact id prefix tokens,
  `PENALTY_CARD_EXHAUSTED` payload shape and fallback algorithm,
  controlled-repetition specifics) are flagged for that milestone.

### Evidence references
- None captured automatically (no Git repository initialized). Session export to
  be preserved by the project owner.

---

## [2026-11-09] Milestone M2 (implementation) — Task 1: source-data schema types

- **Objective:** Implement ONLY Task 1 of the M2 spec — the common,
  subject-neutral source-data TypeScript types — in `shared-engine/src/`.
- **Prompt ID / summary:** Kiro Prompt 02d — owner approved beginning M2
  implementation limited to Task 1; no other tasks, no gameplay/UI/generators,
  no Git, no dependency install without asking. Followed by a correction prompt
  requiring Task 1 to stay unchecked until compiler verification is run.
- **Linked spec / steering:**
  - Spec: `.kiro/specs/educational-data-schema/` (`requirements.md` Req 1,
    `design.md` Layer 1 / D1 / D2 / D2a / D5, `tasks.md` Task 1).
  - Steering: `educational-data-independence.md`, `architecture.md`,
    `no-duplicate-card-invariant.md`, `verified-work-only.md`.
- **Kiro features actually used:**
  - Kiro spec (task tracking; Task 1 checkbox kept UNCHECKED per the
    verified-work-only rule).
  - Kiro agent file operations (create, read-back, delete placeholder) and
    terminal checks.
  - No hooks; no steering changes.
- **Environment (observed this session):** Node v22.11.0, npm 11.11.0 (from the
  M1 entry; unchanged). No `node_modules` present.

### Files created
- `shared-engine/src/source-data.ts` — `AnswerEntry`, `Topic`, `SubjectRecord`,
  `SubjectCollection` interfaces; subject-neutral; `explanation` optional;
  versioned collection wrapper with `schemaVersion`. Verified present and
  content read back.
- `shared-engine/src/index.ts` — barrel re-exporting the four source-data types
  (type-only export, ESM `./source-data.js` specifier for the approved
  Bundler/verbatimModuleSyntax tsconfig). Verified present.

### Files modified
- `.kiro/specs/educational-data-schema/tasks.md` — Task 1 left UNCHECKED; note
  added that implementation and manual inspection are done but compiler
  verification is pending.
- `docs/kiro-development-log.md` — this entry appended (all earlier entries
  preserved).

### Files deleted
- `shared-engine/src/.gitkeep` — obsolete empty-directory placeholder; `src/`
  now contains real source files.

### Commands run (and observed outcomes)
- `Test-Path node_modules` → no `node_modules` (dependencies not installed).
- `npx --no-install tsc --version` → failed (exit 1): no local TypeScript and
  `--no-install` prevented download. Confirms a type-check cannot run without an
  install, which was not authorized.

### Tests / checks
- **No automated tests or TypeScript compilation have been completed.**
- **TypeScript type-check (`tsc`): NOT run** — dependencies not installed; not
  authorized to install. This is the check that would satisfy the
  verified-work-only completion rule for Task 1; it remains outstanding until an
  install is approved.
- **Automated tests: not run** — none exist yet (test tasks are 14–19, not in
  scope here).
- **Checks actually performed:** files verified present via directory listing;
  full content read back and confirmed to match the approved spec (four types,
  correct fields, optional `explanation`, versioned wrapper). This is a manual
  structural review only, not a compiler verification.

### Issues encountered and corrective actions
- Could not run `tsc` without installing dependencies; per instruction, did not
  install. Initially the Task 1 checkbox was marked complete; this was corrected
  — Task 1 is returned to unchecked because the verified-work-only rule requires
  the compiler check, which has not been run.

### Outcome
- **Task 1 implemented and manually inspected; compiler verification pending.**
  Task 1 remains **unchecked**. All other M2 tasks remain unchecked. No
  gameplay, UI, generators, Git, or deployment.

### Outstanding items / owner decisions
- **Dependency install approval needed** to run the TypeScript compiler and
  thereby verify these interfaces, which is required before Task 1 can be marked
  complete. Until then the `tsc` check is "not run".
- Proceeding to any further M2 task (2, 2a, 3, ...) requires explicit approval.

### Evidence references
- None captured automatically (no Git repository initialized). Session export to
  be preserved by the project owner.

---

## [2026-11-09] Milestone M2 (implementation) — Task 1 verification (type-check passed)

- **Objective:** Verify Task 1 only — install the declared dependencies and run
  the TypeScript type-check for the `shared-engine` workspace; mark Task 1
  complete only if it passes.
- **Prompt ID / summary:** Kiro Prompt 02e — owner approved `npm install` of the
  already-declared dependencies and running the shared-engine type-check;
  no other tasks, no Git, no gameplay/UI, no Task 2.
- **Linked spec / steering:** `.kiro/specs/educational-data-schema/` (Task 1);
  `.kiro/steering/verified-work-only.md` (completion rule now satisfied for
  Task 1).
- **Kiro features actually used:** Kiro spec task tracking (Task 1 marked
  complete after verification); Kiro agent terminal execution and file
  operations. No hooks; no steering changes.
- **Environment (observed):** Node v22.11.0, npm 11.11.0, Windows/PowerShell.

### Files created (by tooling, not hand-authored)
- `shared-engine/dist/index.d.ts`, `index.js`, `index.js.map`,
  `source-data.d.ts`, `source-data.js`, `source-data.js.map` — emitted by
  `tsc --build`. Covered by `.gitignore` (`dist/`).
- `shared-engine/tsconfig.tsbuildinfo` — incremental build info. Covered by
  `.gitignore` (`*.tsbuildinfo`).
- Root `node_modules/` and `package-lock.json` — from `npm install`.
  `node_modules/` is git-ignored. (`package-lock.json` is not ignored; it is
  normal to commit it, but no Git action was taken this session.)

### Files modified
- `.kiro/specs/educational-data-schema/tasks.md` — Task 1 marked complete,
  citing the passing type-check and emitted declarations.
- `docs/kiro-development-log.md` — this verification entry appended (all earlier
  entries preserved).

### Commands run (and observed outcomes)
- `npm install` → exit 0. Added 153 packages, audited 157. Warnings (non-fatal):
  `EBADENGINE` for `eslint-visitor-keys@5.0.1` (wants Node ^20.19 || ^22.13 ||
  >=24; we run v22.11.0) — affects ESLint tooling only, not `tsc`; deprecation
  notice for `eslint@9.39.5`; `npm audit` reported 13 vulnerabilities (10
  moderate, 1 high, 2 critical) in the dependency tree. None blocked the
  type-check.
- `npx tsc --build shared-engine/tsconfig.json --verbose` → **exit 0, no
  diagnostics.** Built the shared-engine project and emitted declarations to
  `shared-engine/dist/`.

### Tests / checks
- **TypeScript type-check (`tsc --build` on shared-engine): PASSED** (exit 0, no
  errors). Verified by exit code and by the presence of emitted
  `shared-engine/dist/*.d.ts` / `*.js` outputs.
- **Automated unit tests: not run** — none exist yet (test tasks 14–19 are out
  of scope here).

### Issues encountered and corrective actions
- `npm install` emitted an `EBADENGINE` warning (Node v22.11.0 vs a dependency
  wanting ^22.13.0+) and a vulnerability-audit summary. These are warnings, did
  not fail the install, and did not affect the type-check. No action taken;
  flagged here for visibility. No corrective code changes were needed — the
  type-check passed on the first run.

### Outcome
- **Task 1 complete and verified.** Source-data types compile cleanly under the
  approved strict tsconfig. No other M2 task started; no Git, gameplay, or UI.

### Outstanding items / owner decisions
- Dependency-tree vulnerabilities (10 moderate / 1 high / 2 critical) reported
  by `npm audit`; these are in dev tooling. Recommend reviewing before any
  publish, but no change made now.
- `EBADENGINE` warning suggests a Node upgrade (to >=22.13) would silence an
  ESLint-related engine mismatch; optional, not required for TypeScript.
- Proceeding to Task 2 (or any later task) requires explicit approval.

### Evidence references
- Type-check exit code 0 and emitted `shared-engine/dist/` declarations observed
  this session. No Git repository initialized; session export to be preserved by
  the project owner.

---

## [2026-11-09] Milestone M2 (implementation) — Task 2: stable identifier namespace

- **Objective:** Implement ONLY Task 2 — the stable identifier namespace rule
  (Decision 1): globally unique, subject-prefixed descriptive string ids and the
  Task 2 identifier utilities, including cross-collection duplicate detection.
- **Prompt ID / summary:** Kiro Prompt 02f — owner approved Task 2 only; no
  Task 2a/3 or later; no new dependencies, no `npm audit fix`, no Git, no
  gameplay/UI/generators.
- **Linked spec / steering:** `.kiro/specs/educational-data-schema/`
  (Req 1.5, Design D2, Task 2); steering `educational-data-independence.md`,
  `architecture.md`, `verified-work-only.md`.
- **Kiro features actually used:** Kiro spec task tracking (Task 2 marked
  complete after verification); Kiro agent file operations and terminal
  execution. No hooks; no steering changes.
- **Environment (observed):** Node v22.11.0, npm 11.11.0, Windows/PowerShell.
  Dependencies already installed in the prior (Task 1 verification) step; none
  added this step.

### Finalized identifier convention (documented, Decision 1)
- Shape: `<namespace>.<kind>.<slug...>`.
- Namespaces: `math`, `clinical` (subject-qualified, prevents cross-app
  collisions).
- Kinds: `subject`, `topic`, `answer`.
- Slug: one or more `.`-separated segments, each `[a-z0-9]+(-[a-z0-9]+)*`.
- Examples: `math.subject.7`, `clinical.subject.graves-disease`,
  `clinical.topic.graves-disease.workup`,
  `clinical.answer.graves-disease.workup.positive-tsi`.

### Files created
- `shared-engine/src/identifiers.ts` — namespace/kind constants and types
  (`SUBJECT_NAMESPACES`, `ID_KINDS`, `SubjectNamespace`, `IdKind`, `ParsedId`,
  `DuplicateId`), id helpers (`buildId`, `isValidId`, `parseId`,
  `isInNamespace`), and collection utilities (`collectIds`, `findDuplicateIds`
  for global cross-collection duplicate detection, `findMalformedIds`).
  Subject-neutral; no DOM/UI; no gameplay logic. Does NOT implement the
  wrapper/merge (Task 2a) or the full validation pipeline (later tasks).

### Files modified
- `shared-engine/src/index.ts` — re-exports the new identifier types and
  utilities alongside the Task 1 source-data types. Task 1 exports unchanged.
- `.kiro/specs/educational-data-schema/tasks.md` — Task 2 marked complete with
  the passing type-check cited. Other tasks remain unchecked.
- `docs/kiro-development-log.md` — this entry appended (all earlier entries
  preserved).

### Files created by tooling (git-ignored)
- `shared-engine/dist/identifiers.{d.ts,js,js.map}` emitted by `tsc --build`;
  `dist/` and `*.tsbuildinfo` remain git-ignored.

### Commands run (and observed outcomes)
- `npx tsc --build shared-engine/tsconfig.json --force` → **exit 0, no
  diagnostics.** Verified by exit code and the emitted
  `shared-engine/dist/identifiers.d.ts` / `.js` outputs.
- No `npm install`, no `npm audit fix`, no Git commands.

### Tests / checks
- **TypeScript type-check (`tsc --build` on shared-engine): PASSED** (exit 0).
- **Automated unit tests: not run** — none exist yet (test tasks 14–19 are out
  of scope here; the duplicate-detection and malformed-id utilities will be
  exercised by those later tests).

### Issues encountered and corrective actions
- None. The type-check passed on the first build after adding the module; no
  corrective changes were needed.

### Outcome
- **Task 2 complete and verified.** Identifier conventions finalized and
  documented; Task 2 utilities (including global cross-collection duplicate
  detection) implemented in `shared-engine/` and type-checked. Task 1 and all
  established architecture/invariants preserved. No Task 2a/3 or later work; no
  Git, gameplay, or UI.

### Outstanding items / owner decisions
- Proceeding to Task 2a (collection wrapper + merge) or any later task requires
  explicit approval.
- Dependency-tree audit findings from the Task 1 step remain unaddressed by
  request (no `npm audit fix`).

### Evidence references
- Type-check exit code 0 and emitted `shared-engine/dist/identifiers.*` observed
  this session. No Git repository initialized; session export to be preserved by
  the project owner.

---

## [2026-11-09] Milestone M2 (implementation) — Task 2a: versioned collection wrapper and merge rules

- **Objective:** Implement ONLY Task 2a — the versioned `SubjectCollection`
  wrapper and safe merge rules (Decision 2 / D2a): merge only when schema
  versions match exactly and all identifiers are globally unique; reject
  mismatches and duplicates with actionable errors; never overwrite.
- **Prompt ID / summary:** Kiro Prompt 02g — owner approved Task 2a only
  (followed by a correction to check a single collection for internal duplicate
  ids, and approval to export, type-check, run focused functional checks, and
  document). No Task 3 or later; no new dependencies; no `npm audit fix`; no
  Git.
- **Linked spec / steering:** `.kiro/specs/educational-data-schema/`
  (Req 1.4, Design D2a, Task 2a); steering `educational-data-independence.md`,
  `architecture.md`, `verified-work-only.md`.
- **Kiro features actually used:** Kiro spec task tracking (Task 2a marked
  complete after verification); Kiro agent file operations and terminal
  execution. No hooks; no steering changes.
- **Environment (observed):** Node v22.11.0, npm 11.11.0, Windows/PowerShell.
  Dependencies already installed (Task 1 step); none added.

### Files created
- `shared-engine/src/collection.ts` — `CURRENT_SCHEMA_VERSION`,
  `MERGE_ERROR_CODES`, `MergeErrorCode`, `CollectionMergeError`,
  `createCollection`, `MergeCheck`, `checkMergeable`, `assertMergeable`,
  `mergeCollections`. Reuses Task 2 `findDuplicateIds`. Subject-neutral; no
  DOM/UI; no generated-deck contract, generators, gameplay, or validation
  pipeline. A single collection is checked for internal duplicate ids (per the
  owner correction before approval).

### Files modified
- `shared-engine/src/index.ts` — re-exports the collection types/utilities
  alongside the Task 1 + Task 2 exports; doc comment updated to list Task 2a.
- `.kiro/specs/educational-data-schema/tasks.md` — Task 2a marked complete with
  verification cited. Other tasks remain unchecked.
- `docs/kiro-development-log.md` — this entry appended (all earlier entries
  preserved).

### Files created by tooling (git-ignored)
- `shared-engine/dist/collection.{d.ts,js,js.map}` emitted by `tsc --build`;
  `dist/` and `*.tsbuildinfo` remain git-ignored.

### Temporary files (created and removed this task)
- `tmp-checks/task2a-check.mjs` — an ad-hoc ESM script that imported the
  compiled `shared-engine/dist/index.js` and exercised the merge rules. Created
  for verification only, then deleted; the empty `tmp-checks/` directory was
  removed after confirming it was empty. This was ad-hoc verification, not the
  project's test suite (unit tests remain Tasks 14-19).

### Commands run (and observed outcomes)
- `npx tsc --build shared-engine/tsconfig.json --force` → **exit 0, no
  diagnostics**; emitted `shared-engine/dist/collection.*`.
- `node tmp-checks/task2a-check.mjs` → **exit 0; RESULT: 9 passed, 0 failed.**
- Directory emptiness check then `Remove-Item tmp-checks` → "removed empty
  tmp-checks" (removed only after confirming it was empty).
- No `npm install`, no `npm audit fix`, no Git commands.

### Tests / checks
- **TypeScript type-check (`tsc --build` on shared-engine): PASSED** (exit 0).
- **Focused functional checks: 9/9 PASSED**, covering the five required
  scenarios:
  1. Successful merge of compatible collections (2 subjects, version preserved);
     `checkMergeable` ok.
  2. Mismatched schema versions rejected with `SCHEMA_VERSION_MISMATCH`;
     `mergeCollections` throws `CollectionMergeError`.
  3. Duplicate id across collections rejected with `DUPLICATE_IDENTIFIER`
     (duplicate reported with count 2).
  4. Duplicate id within a single collection rejected with
     `DUPLICATE_IDENTIFIER`; `mergeCollections` throws.
  5. Zero collections -> empty collection at current version; `checkMergeable()`
     ok.
- **Automated unit tests: not run** — none exist yet (Tasks 14-19). The ad-hoc
  checks above are not a substitute for that suite and were removed.

### Issues encountered and corrective actions
- Pre-approval, the first draft of `checkMergeable` short-circuited on
  `collections.length <= 1`, which would have skipped the internal-duplicate
  check for a single collection. Corrected to short-circuit only on
  `length === 0`; docs updated to state a single collection is checked for
  internal duplicate ids. Functional check #4 confirms the fix.

### Outcome
- **Task 2a complete and verified.** Wrapper + merge rules implemented in
  `shared-engine/`, type-checked, and exercised by 9 passing functional checks;
  temporary verification files cleaned up. Task 1, Task 2, and all established
  architecture/invariants preserved. No Task 3 or later; no Git, gameplay, or
  UI.

### Outstanding items / owner decisions
- Proceeding to Task 3 (generated-deck contract) or any later task requires
  explicit approval.
- Dependency-tree audit findings from the Task 1 step remain unaddressed by
  request.

### Evidence references
- `tsc` exit 0; functional-check output "9 passed, 0 failed" observed this
  session. No Git repository initialized; session export to be preserved by the
  project owner.

---

## [2026-11-09] Milestone M2 (implementation) — Task 3: generated-deck contract

- **Objective:** Implement ONLY Task 3 — the subject-neutral generated-deck
  TypeScript contracts (`GeneratedChallenge`, `GeneratedAnswerCard`,
  `GeneratedDeck`, and supporting types) consumed by the engine.
- **Prompt ID / summary:** Kiro Prompt 02h — owner approved Task 3 only
  (followed by a request to document validator-enforced invariants V1-V5 without
  implementing validation). No Task 4 or later; no generators/validators/
  gameplay/Beepy/UI; no new dependencies; no `npm audit fix`; no Git.
- **Linked spec / steering:** `.kiro/specs/educational-data-schema/`
  (Req 2.4, 3.6, 5.1, 5.3; Design Layer 2 D4/D5, D8; Task 3); steering
  `no-duplicate-card-invariant.md`, `educational-data-independence.md`,
  `architecture.md`, `verified-work-only.md`.
- **Kiro features actually used:** Kiro spec task tracking (Task 3 marked
  complete after verification); Kiro agent file operations and terminal
  execution. No hooks; no steering changes.
- **Environment (observed):** Node v22.11.0, npm 11.11.0, Windows/PowerShell.
  Dependencies already installed; none added.

### Files created
- `shared-engine/src/generated-deck.ts` — type contracts only:
  `GenerationDirection` (`factToSubject` | `subjectToFact`),
  `GeneratedSourceRef`, `GeneratedChallenge` (one `correctAnswerCardId` per
  challenge), `GeneratedAnswerCard` (globally unique `displayValue`; optional
  `explanationByChallengeId`), `GeneratedDeck`, `GeneratedDeckMeta`. Subject-
  neutral; no DOM/UI/framework; no generator, validator, gameplay, or Beepy
  logic. Documents validator-enforced invariants for later tasks:
  - V1 every `correctAnswerCardId` references an existing answer card;
  - V2 correct-card assignments unique across challenges (one per challenge);
  - V3 card ids (and challenge ids) globally unique;
  - V4 every `displayValue` globally unique across all game zones;
  - V5 `meta.actualCardCount === answerCards.length`.

### Files modified
- `shared-engine/src/index.ts` — re-exports the six generated-deck types
  alongside Tasks 1/2/2a exports; doc comment updated to list Task 3.
- `.kiro/specs/educational-data-schema/tasks.md` — Task 3 marked complete with
  verification cited. Other tasks remain unchecked.
- `docs/kiro-development-log.md` — this entry appended (all earlier entries
  preserved).

### Files created by tooling (git-ignored)
- `shared-engine/dist/generated-deck.{d.ts,js,js.map}` emitted by `tsc --build`;
  `dist/` and `*.tsbuildinfo` remain git-ignored.

### Commands run (and observed outcomes)
- `npx tsc --build shared-engine/tsconfig.json --force` → **exit 0, no
  diagnostics.** Verified by exit code and the emitted
  `shared-engine/dist/generated-deck.d.ts`.
- No `npm install`, no `npm audit fix`, no Git commands.

### Tests / checks
- **TypeScript type-check (`tsc --build` on shared-engine): PASSED** (exit 0);
  expected declaration file `generated-deck.d.ts` generated.
- **Automated unit tests: not run** — none exist yet (Tasks 14-19). No tests
  added this task, per the prompt's "no unrelated implementation work or tests."
- No ad-hoc functional script was needed; the deliverable is type contracts
  only, validated by the compiler.

### Design note (no new decision taken)
- Introduced a named `GenerationDirection` type for the two already-approved
  identifiers (`factToSubject` | `subjectToFact`) rather than repeating the
  inline literal from the design's illustrative `GeneratedDeck`. This is a
  naming/DRY choice consistent with Req 2; it is not a new architectural
  decision and changes none of the approved rules.

### Issues encountered and corrective actions
- On re-adding the module after approval, `index.ts`'s doc comment had reverted
  to the Task-2 wording (the collection exports were already present below it).
  Corrected the comment to list Tasks 1/2/2a/3; functional exports were
  unaffected. No other issues; the type-check passed on the first build.

### Outcome
- **Task 3 complete and verified.** Generated-deck contracts implemented in
  `shared-engine/`, exported, and type-checked; validator invariants V1-V5
  documented for later enforcement. Tasks 1, 2, 2a and all established
  architecture/invariants preserved. No Task 4 or later; no Git, gameplay, UI,
  generators, or validators.

### Outstanding items / owner decisions
- Proceeding to Task 4 (generation-direction configuration) or any later task
  requires explicit approval.
- Dependency-tree audit findings from the Task 1 step remain unaddressed by
  request.

### Evidence references
- `tsc` exit 0 and emitted `shared-engine/dist/generated-deck.d.ts` observed
  this session. No Git repository initialized; session export to be preserved by
  the project owner.

---

## [2026-11-09] Milestone M2 (implementation) — Task 4: generation-direction configuration

- **Objective:** Implement ONLY Task 4 — the generation-direction configuration
  (defaults, resolver, and switching utility), reusing the Task 3
  `GenerationDirection` type. No card generation.
- **Prompt ID / summary:** Kiro Prompt 02i — owner approved Task 4 only.
  Includes a pre-approval property-name correction and a follow-up to complete
  the missing `index.ts` exports. No Task 5 or later; no dependencies; no
  `npm audit fix`; no Git; no generators/validators/gameplay/Beepy/UI.
- **Linked spec / steering:** `.kiro/specs/educational-data-schema/`
  (Req 2.1-2.5, Design D3, Task 4); master spec section 9; steering
  `educational-data-independence.md`, `architecture.md`, `verified-work-only.md`.
- **Kiro features actually used:** Kiro spec task tracking (Task 4 marked
  complete after verification); Kiro agent file operations (create, edit,
  read-back, delete temp) and terminal execution. No hooks; no steering changes.
- **Environment (observed):** Node v22.11.0, npm 11.11.0, Windows/PowerShell.
  Dependencies already installed; none added.

### Files created
- `shared-engine/src/generation-config.ts` — configuration only:
  `GENERATION_DIRECTIONS`, `GENERATION_APPS`, `DEFAULT_DIRECTION_BY_APP`
  (Math -> factToSubject, Clinical -> subjectToFact), types `GenerationApp` and
  `GenerationConfig` (optional `generationDirection`), and utilities
  `isGenerationDirection`, `defaultDirectionForApp`, `resolveGenerationDirection`
  (explicit direction wins, else app default), `oppositeDirection`. Reuses the
  Task 3 `GenerationDirection` type; does not redefine it. Subject-neutral; no
  card generation, validator, gameplay, Beepy, or UI.

### Files modified
- `shared-engine/src/index.ts` — added two type exports (`GenerationApp`,
  `GenerationConfig`) and seven runtime exports from `generation-config.ts`;
  doc comment updated to list Task 4. Tasks 1/2/2a/3 exports unchanged
  (confirmed by reading the file back from disk).
- `.kiro/specs/educational-data-schema/tasks.md` — Task 4 marked complete with
  verification cited. Other tasks remain unchecked.
- `docs/kiro-development-log.md` — this entry appended (all earlier entries
  preserved).

### Property-name correction (recorded)
- The first draft of `GenerationConfig` named the override property `direction`.
  Per design D3 and tasks.md Task 4, the configuration property is
  `generationDirection`. Before approval, the property was renamed to
  `generationDirection` in both `GenerationConfig` and
  `resolveGenerationDirection`. The separate Task 3 `GeneratedDeck.direction`
  property was intentionally left unchanged (the design names it `direction` on
  the deck).

### Files created by tooling (git-ignored)
- `shared-engine/dist/generation-config.{d.ts,js,js.map}` emitted by
  `tsc --build`; `dist/` and `*.tsbuildinfo` remain git-ignored.

### Temporary files (created and removed this task)
- `tmp-checks/task4-check.mjs` — ad-hoc ESM script importing the compiled
  `shared-engine/dist/index.js`; created for verification only, then deleted,
  and the empty `tmp-checks/` directory removed after confirming it was empty.
  Not the project's test suite (unit tests remain Tasks 14-19).

### Commands run (and observed outcomes)
- `npx tsc --build shared-engine/tsconfig.json --force` → **exit 0, no
  diagnostics**; emitted `shared-engine/dist/generation-config.*`.
- `node tmp-checks/task4-check.mjs` → **exit 0; RESULT: 13 passed, 0 failed.**
- Emptiness check then `Remove-Item tmp-checks` → "removed empty tmp-checks".
- No `npm install`, no `npm audit fix`, no Git commands.

### Tests / checks
- **TypeScript type-check (`tsc --build` on shared-engine): PASSED** (exit 0);
  `generation-config.d.ts` emitted.
- **Focused functional checks: 13/13 PASSED**, covering: Math default
  `factToSubject`; Clinical default `subjectToFact`; resolver defaults with no
  override; explicit overrides in BOTH directions for EITHER app;
  `oppositeDirection` both ways and involutive; `isGenerationDirection` guard.
- **Automated unit tests: not run** — none exist yet (Tasks 14-19); the ad-hoc
  checks are not a substitute and were removed.

### Issues encountered and corrective actions
- `index.ts` lost its Task 4 exports and doc-comment line between turns (prior
  edits reverted during the approval flow). Corrective action: re-added the
  Task 4 doc-comment line and all nine exports, then read the file back from
  disk to confirm the exports are present before building. Build and checks
  then passed.

### Outcome
- **Task 4 complete and verified.** Generation-direction configuration
  implemented in `shared-engine/`, exported, type-checked, and exercised by 13
  passing functional checks; temp files cleaned up. Tasks 1, 2, 2a, 3 and all
  established architecture/invariants preserved. No Task 5 or later; no Git,
  gameplay, generators, validators, Beepy, or UI.

### Outstanding items / owner decisions
- Proceeding to Task 5 (app-specific generator boundaries) or any later task
  requires explicit approval.
- Dependency-tree audit findings from the Task 1 step remain unaddressed by
  request.

### Evidence references
- `tsc` exit 0; functional-check output "13 passed, 0 failed" observed this
  session. No Git repository initialized; session export to be preserved by the
  project owner.

---

## [2026-11-09] Milestone M2 (implementation) — Task 5: app-specific generator boundaries

- **Objective:** Implement ONLY Task 5 — establish the subject-neutral deck-
  generator boundary in `shared-engine/` and the Math/Clinical generator
  boundaries in their app workspaces (Decision 4). No generation algorithm.
- **Prompt ID / summary:** Kiro Prompt 02j — owner approved Task 5 only. No new
  dependencies; no `npm audit fix`; no Git; no generators'
  algorithms/validators/gameplay/Beepy/UI; no Task 6 or later.
- **Linked spec / steering:** `.kiro/specs/educational-data-schema/`
  (Req 5.1, 5.2, 5.4; Design "Separation and placement"; Task 5); steering
  `architecture.md`, `educational-data-independence.md`, `verified-work-only.md`.
- **Kiro features actually used:** Kiro spec task tracking (Task 5 marked
  complete after verification); Kiro agent file operations (create, edit, delete
  placeholders) and terminal execution. No hooks; no steering changes.
- **Environment (observed):** Node v22.11.0, npm 11.11.0, Windows/PowerShell.
  Dependencies already installed; none added. Workspace symlink
  `node_modules/@beepy/shared-engine` present (verified).

### Files created
- `shared-engine/src/generator.ts` — subject-neutral boundary: `GenerationRequest`
  (source collection + `GenerationConfig` + challengeCount + targetCardCount) and
  the `DeckGenerator` interface (`app`, `generate(request): GeneratedDeck`). No
  algorithm; no DOM/UI/subject logic.
- `math-cards/src/math-generator.ts` — `MathDeckGenerator implements DeckGenerator`
  (`app = math`); `generate()` throws a clear "not implemented in Task 5" error
  (algorithm deferred to a later task).
- `clinical-cards/src/clinical-generator.ts` — `ClinicalDeckGenerator implements
  DeckGenerator` (`app = clinical`); `generate()` throws a clear "not implemented
  in Task 5" error.

### Files modified
- `shared-engine/src/index.ts` — re-exports `GenerationRequest` and
  `DeckGenerator`; doc comment updated to list Task 5. Tasks 1-4 exports
  unchanged.
- `.kiro/specs/educational-data-schema/tasks.md` — Task 5 marked complete with
  verification cited. Other tasks remain unchecked.
- `docs/kiro-development-log.md` — this entry appended (all earlier entries
  preserved).

### Files deleted
- `math-cards/src/.gitkeep` and `clinical-cards/src/.gitkeep` — obsolete empty-
  directory placeholders; both `src/` dirs now contain real source.

### Files created by tooling (git-ignored)
- `shared-engine/dist/generator.*`, `math-cards/dist/*`,
  `clinical-cards/dist/*`, and `*.tsbuildinfo` for the app workspaces — emitted
  by `tsc --build`. `dist/` and `*.tsbuildinfo` remain git-ignored.

### Commands run (and observed outcomes)
- `Test-Path node_modules/@beepy/shared-engine` → "shared-engine linked"
  (workspace symlink present, so the apps resolve the shared package).
- `npx tsc --build tsconfig.json --force` (root solution: shared-engine +
  math-cards + clinical-cards) → **exit 0, no diagnostics.**
- No `npm install`, no `npm audit fix`, no Git commands.

### Tests / checks
- **TypeScript type-check (whole monorepo, `tsc --build tsconfig.json --force`):
  PASSED** (exit 0). Confirmed both apps compiled against the shared contracts:
  `math-cards/dist/` emitted and `clinical-cards/dist/clinical-generator.d.ts`
  emitted. This proves each app's generator boundary resolves
  `@beepy/shared-engine` and satisfies the `DeckGenerator` interface.
- **Automated unit tests: not run** — none exist yet (Tasks 14-19). No ad-hoc
  runtime script was used: the deliverable is boundary interfaces/stubs whose
  `generate()` intentionally throws, verified by the compiler.

### Issues encountered and corrective actions
- None. The monorepo type-check passed on the first forced build after adding
  the boundary and the two app stubs.

### Outcome
- **Task 5 complete and verified.** The subject-neutral generator boundary lives
  in `shared-engine/`; Math and Clinical boundaries live in their respective app
  workspaces and depend only on the shared contracts; both type-check. The
  shared engine remains subject-neutral (no math/clinical logic in it), and the
  apps reuse the shared source-data schema, generated-deck contract, and
  generation-direction configuration. Tasks 1-4 and all established
  architecture/invariants preserved. No Task 6 or later; no Git, generators'
  algorithms, validators, gameplay, Beepy, or UI.

### Outstanding items / owner decisions
- Proceeding to Task 6 (structural + identifier validation) or any later task
  requires explicit approval.
- Dependency-tree audit findings from the Task 1 step remain unaddressed by
  request.

### Evidence references
- `tsc` exit 0 for the full solution; emitted `math-cards/dist/` and
  `clinical-cards/dist/clinical-generator.d.ts` observed this session. No Git
  repository initialized; session export to be preserved by the project owner.

---

## [2026-11-09] Milestone M2 (implementation) — Task 6: structural and identifier validation

- **Objective:** Implement ONLY Task 6 — validation pipeline stages 1 (structural)
  and 2 (identifier) with the D7 structured error model, reusing the Task 2
  identifier utilities. No later pipeline stages.
- **Prompt ID / summary:** Kiro Prompt 02k — owner approved Task 6 only, after a
  pre-approval review that required two corrections (duplicate-id paths; identifier
  kind and namespace checks). No Task 7 or later; no dependencies; no
  `npm audit fix`; no Git; no generation algorithms/gameplay/Beepy/UI.
- **Linked spec / steering:** `.kiro/specs/educational-data-schema/`
  (Req 1.5, 6.5; Design pipeline stages 1-2, D2, D7; Task 6); steering
  `educational-data-independence.md`, `architecture.md`, `verified-work-only.md`.
- **Kiro features actually used:** Kiro spec task tracking (Task 6 marked
  complete after verification); Kiro agent file operations (create, edit,
  read-back, delete temp) and terminal execution. No hooks; no steering changes.
- **Environment (observed):** Node v22.11.0, npm 11.11.0, Windows/PowerShell.
  Dependencies already installed; none added.

### Owner-approved clarification: identifier namespace consistency
- Design D2 requires subject-qualified id prefixes that prevent Math/Clinical
  collisions, but does not state outright that a subject's nested ids must share
  its namespace. The owner reviewed and APPROVED the following reading as an
  explicit clarification for Task 6:
  - Every topic id, `corrects`/`incorrects` id, and `subjectIncorrects` id must
    use the SAME namespace (`math` or `clinical`) as the subject that owns it.
  - Namespace is compared per subject, not per collection: one collection may
    contain both Math and Clinical subjects.
  - If the owning subject's own id is malformed, there is no namespace to compare,
    so the namespace check is skipped for its children (the malformed subject id
    is still reported).
- The owner explicitly directed that SLUG HIERARCHY is NOT enforced (for example,
  a topic slug beginning with its subject's slug). The D2 examples that show such
  a pattern are illustrative only.
- Expected identifier KIND by position follows from the Task 2 convention
  `<namespace>.<kind>.<slug...>`: `subjects[].id` = `subject`;
  `topics[].id` = `topic`; `corrects[]`, `incorrects[]` and `subjectIncorrects[]`
  ids = `answer`.

### Files created
- `shared-engine/src/validation.ts` — `VALIDATION_CODES` (INVALID_TYPE,
  MISSING_FIELD, SCHEMA_VERSION_UNSUPPORTED, MALFORMED_IDENTIFIER,
  WRONG_IDENTIFIER_KIND, NAMESPACE_MISMATCH, DUPLICATE_IDENTIFIER),
  `ValidationIssue` (code, message, path), `ValidationResult`,
  `SUPPORTED_SCHEMA_VERSIONS` (`1.0.0`), `validateStructure(unknown)` (stage 1,
  collects all issues, suitable for untrusted JSON), `validateIdentifiers`
  (stage 2), and `validateCollectionSource` (stage 1 then stage 2, short-
  circuiting when the structure is invalid). Subject-neutral; no DOM/UI.

### Files modified
- `shared-engine/src/index.ts` — re-exports three validation types and five
  runtime values; doc comment updated to list Task 6. Tasks 1-5 exports
  unchanged (confirmed by reading the file back from disk).
- `.kiro/specs/educational-data-schema/tasks.md` — Task 6 marked complete with
  verification cited. Other tasks remain unchecked.
- `docs/kiro-development-log.md` — this entry appended (all earlier entries
  preserved).

### Pre-approval corrections (recorded)
1. Duplicate-identifier issues originally put the id string in
   `ValidationIssue.path`. Corrected: each repeat is now reported at the JSON path
   where it occurs, and the message names the path of the first definition. N
   occurrences of an id yield N-1 issues; the first occurrence is not flagged.
   To obtain paths, the stage-2 duplicate check walks the collection directly
   instead of calling the Task 2 `findDuplicateIds`; it still reuses the Task 2
   `isValidId` and `parseId`.
2. Stage 2 originally checked only general id format. Corrected: it now also
   enforces expected kind per position and the namespace consistency
   clarification above.

### Files created by tooling (git-ignored)
- `shared-engine/dist/validation.{d.ts,js,js.map}` and rebuilt outputs for all
  workspaces, emitted by `tsc --build`. `dist/` and `*.tsbuildinfo` remain
  git-ignored.

### Temporary files (created and removed this task)
- `tmp-checks/task6-check.mjs` — ad-hoc ESM script importing the compiled
  `shared-engine/dist/index.js`; created for verification only, then deleted. The
  empty `tmp-checks/` directory was removed after confirming it was empty. Not the
  project's test suite (unit tests remain Tasks 14-19).

### Commands run (and observed outcomes)
- `npx tsc --build tsconfig.json --force` (shared-engine + both apps) → **exit 0,
  no diagnostics**; `shared-engine/dist/validation.d.ts` present (`Test-Path`
  returned True).
- `node tmp-checks/task6-check.mjs` → **exit 0; RESULT: 48 passed, 0 failed.**
- Emptiness check then `Remove-Item tmp-checks` → "removed empty tmp-checks".
- No `npm install`, no `npm audit fix`, no Git commands.

### Tests / checks
- **TypeScript type-check (whole monorepo, clean build): PASSED** (exit 0).
- **Focused functional checks: 48/48 PASSED**, covering:
  - valid Clinical, Math, empty, and mixed Math+Clinical collections;
  - invalid structure (null, array, string, number, non-array `subjects`,
    non-object subject);
  - missing fields (collected together, with exact paths), a non-string optional
    `explanation`, and an absent optional `explanation` accepted;
  - unsupported schema versions (`2.0.0`, non-semver `v1`, non-string);
  - malformed identifiers (including an unknown namespace) and no spurious
    kind/namespace issues on a malformed id;
  - wrong identifier kinds in all four positions (subject, topic,
    corrects/incorrects, subjectIncorrects);
  - namespace mismatches in both directions, with the mismatch as the only issue
    when the kind is correct;
  - duplicate identifiers with accurate JSON paths (N-1 issues for N
    occurrences, each at its own path, citing the first definition; cross-subject
    duplicates under `subjects[1]`);
  - `validateCollectionSource` sequencing (structure failure short-circuits;
    identifier issues surface when the structure is valid).
- **Automated unit tests: not run** — none exist yet (Tasks 14-19). The ad-hoc
  checks are not a substitute and were removed.

### Issues encountered and corrective actions
- `validation.ts` was reverted once while pending approval and was recreated with
  the two corrections above. After approval, the file persisted. No failures in
  the build or the functional checks, so no post-approval code changes were needed.

### Outcome
- **Task 6 complete and verified.** Stages 1-2 are implemented in
  `shared-engine/`, exported, type-checked, and exercised by 48 passing
  functional checks; temp files cleaned up. Tasks 1-5 and all established
  architecture/invariants preserved. No Task 7 or later; no Git, generation
  algorithms, gameplay, Beepy, or UI.

### Outstanding items / owner decisions
- Proceeding to Task 7 (challenge mapping and ambiguity elimination) or any later
  task requires explicit approval.
- Dependency-tree audit findings from the Task 1 step remain unaddressed by
  request.

### Evidence references
- `tsc` exit 0 for the full solution and functional-check output "48 passed,
  0 failed" observed this session. No Git repository initialized; session export
  to be preserved by the project owner.

---

## [2026-11-09] Milestone M2 (implementation) — Task 7: challenge mapping and ambiguity elimination

- **Objective:** Implement ONLY Task 7 — validation pipeline stages 3 (challenge
  mapping) and 4 (ambiguity elimination) over a `GeneratedDeck`.
- **Prompt ID / summary:** Kiro Prompt (M2 Tasks 7-9 batch) — owner approved Tasks
  7, 8, 9 in sequence, after a pre-approval review requiring two corrections to
  the Task 7 draft. No Task 10 or later; no dependencies; no `npm audit fix`; no
  Git; no generation algorithms/gameplay/Beepy/UI.
- **Linked spec / steering:** `.kiro/specs/educational-data-schema/` (Req 3.1,
  3.2, 3.3, 3.5, 6.2; Design pipeline stages 3-4, D7; Task 7); steering
  `no-duplicate-card-invariant.md`, `educational-data-independence.md`,
  `verified-work-only.md`.
- **Kiro features actually used:** Kiro spec task tracking; Kiro agent file
  operations and terminal execution. No hooks; no steering changes.
- **Environment (observed):** Node v22.11.0, npm 11.11.0, Windows/PowerShell.
  Dependencies already installed; none added.

### Files created
- `shared-engine/src/deck-issues.ts` — shared D7-style issue model for deck
  validation: `DECK_VALIDATION_CODES`, `DeckValidationIssue` (code, message,
  path), `DeckValidationResult`, `deckIssue`, `deckResult`. Separate from the
  verified Task 6 `validation.ts`, which was not modified.
- `shared-engine/src/challenge-mapping.ts` — `validateChallengeMapping(deck,
  contextualValidity)`, `normalizeDisplayText`, `ContextualValidityMap`.
  Checks: V1 (designated card exists), V2 (no card designated for two
  challenges), duplicate display text after normalization (Req 3.5), and
  contextual ambiguity from a required evaluation matrix. Subject-neutral.

### Files modified
- `shared-engine/src/index.ts` — exports the deck-issue model and the Task 7
  validator; doc comment lists Task 7. Tasks 1-6 exports unchanged.
- `.kiro/specs/educational-data-schema/tasks.md` — Task 7 marked complete.
- `docs/kiro-development-log.md` — this entry appended (earlier entries kept).

### Pre-approval corrections (recorded)
1. **Contextual ambiguity must not be skipped.** The first draft took an OPTIONAL
   contextual-validity input and skipped the ambiguity check when it was absent.
   Req 3.2 requires every selected card to be checked against every active
   challenge. Corrected: the input is REQUIRED and is an explicit evaluation
   matrix (`challengeId -> cardId -> boolean`), because a list of valid ids
   cannot prove a card was evaluated. Missing matrix, missing challenge entry, or
   missing/non-boolean pair is reported (`CONTEXTUAL_VALIDITY_MISSING`,
   `MISSING_VALIDITY_ENTRY`, `MISSING_VALIDITY_EVALUATION`) and the result is
   never `ok`. Owner approved this input shape; generators (math-cards,
   clinical-cards) will have to produce the matrix when generation is built.
2. **`MULTIPLE_VALID_CARDS_FOR_CHALLENGE` condition.** The first draft reported it
   whenever any valid card differed from the designated one. Corrected: it is
   reported only when MORE THAN ONE distinct card is valid for a challenge. If
   exactly one card is valid but is not the designated card, only
   `DESIGNATED_CARD_NOT_VALID` is reported.

### Commands run (and observed outcomes)
- `npx tsc --build tsconfig.json --force` (whole monorepo) → **exit 0, no
  diagnostics**; `shared-engine/dist/challenge-mapping.d.ts` present.
- `node tmp-checks/task7-check.mjs` → **exit 0; RESULT: 28 passed, 0 failed.**
- No `npm install`, no `npm audit fix`, no Git commands.

### Tests / checks
- **TypeScript type-check (whole monorepo, clean build): PASSED** (exit 0).
- **Focused functional checks: 28/28 PASSED**, covering: a valid deck with a full
  matrix; missing/undefined/null/empty matrix never `ok`; deck-intrinsic checks
  still run when the matrix is missing; a single unevaluated pair and a
  non-boolean evaluation reported at exact paths; missing challenge entry; unknown
  challenge and unknown card keys; `CORRECT_CARD_NOT_FOUND`;
  `DUPLICATE_CORRECT_ASSIGNMENT` at the repeat only; exact and case/whitespace
  duplicate display texts; the corrected multiple-valid semantics (one differing
  valid card -> only `DESIGNATED_CARD_NOT_VALID`; two distinct valid cards ->
  `MULTIPLE_VALID_CARDS_FOR_CHALLENGE`; designated false plus two others -> both;
  zero valid -> designated-not-valid only); and a card valid for two challenges.
- **Automated unit tests: not run** — none exist yet (Tasks 14-19). The ad-hoc
  script is not a substitute and was deleted. The `tmp-checks/` directory is kept
  for Tasks 8-9 and will be removed after confirming it is empty.

### Issues encountered and corrective actions
- Task 7 files were reverted while pending review and were recreated with the two
  corrections. After approval they persisted. No build or check failures.

### Outcome
- **Task 7 complete and verified.** Tasks 1-6 and all established
  architecture/invariants preserved.

### Evidence references
- `tsc` exit 0 and "28 passed, 0 failed" observed this session. No Git
  repository initialized.

---

## [2026-11-09] Milestone M2 (implementation) — Task 8: global uniqueness enforcement

- **Objective:** Implement ONLY Task 8 — validation pipeline stage 5: global
  uniqueness of ids and display values, including across game zones and as
  distinct numerical answers for Math content.
- **Prompt ID / summary:** M2 Tasks 7-9 batch (second task). No Task 10 or later;
  no dependencies; no `npm audit fix`; no Git; no gameplay/generation/Beepy/UI.
- **Linked spec / steering:** `.kiro/specs/educational-data-schema/` (Req 3.4;
  Design pipeline stage 5, D7; Task 8); steering
  `no-duplicate-card-invariant.md`, `verified-work-only.md`.
- **Kiro features actually used:** Kiro spec task tracking; Kiro agent file
  operations and terminal execution. No hooks; no steering changes.
- **Environment (observed):** Node v22.11.0, npm 11.11.0, Windows/PowerShell.
  Dependencies already installed; none added.

### Design choices made inside the approved scope (no spec change)
- **Zones are caller-named.** `CardZones` is `zone name -> card ids`, so the
  shared engine does not hard-code gameplay zones. A snapshot may be partial;
  minting later penalty cards against a snapshot belongs to Task 12.
- **Numeric mode is opt-in** (`numericAnswers`). The engine compares display
  values as numbers (so "7", "07", "7.0" collide) without knowing the subject. A
  non-numeric value in that mode is reported and not also called a duplicate.
- **Overlap with Task 7 is deliberate.** Task 7 rejects duplicate display TEXT
  after case/whitespace normalization as an ambiguity check; Task 8 enforces
  exact or numeric uniqueness of ids and values across the deck and zones. Each
  validator stands alone, so one defect may be reported by both.

### Files created
- `shared-engine/src/uniqueness.ts` — `validateUniqueness(deck, options)`,
  `canonicalNumber`, `CardZones`, `UniquenessOptions`.

### Files modified
- `shared-engine/src/deck-issues.ts` — added Task 8 codes: `DUPLICATE_CARD_ID`,
  `DUPLICATE_CHALLENGE_ID`, `DUPLICATE_DISPLAY_VALUE`,
  `NON_NUMERIC_DISPLAY_VALUE`, `UNKNOWN_ZONE_CARD`, `DUPLICATE_ZONE_CARD`.
  Existing Task 7 codes unchanged.
- `shared-engine/src/index.ts` — exports the Task 8 module; doc comment lists
  Task 8. Tasks 1-7 exports unchanged.
- `.kiro/specs/educational-data-schema/tasks.md` — Task 8 marked complete.
- `docs/kiro-development-log.md` — this entry appended.

### Commands run (and observed outcomes)
- `npx tsc --build tsconfig.json --force` (whole monorepo) → **exit 0, no
  diagnostics**; `shared-engine/dist/uniqueness.d.ts` present.
- `node tmp-checks/task8-check.mjs` → **exit 0; RESULT: 30 passed, 0 failed.**
- No `npm install`, no `npm audit fix`, no Git commands.

### Tests / checks
- **TypeScript type-check (whole monorepo, clean build): PASSED** (exit 0).
- **Focused functional checks: 30/30 PASSED**, covering: valid decks (default,
  numeric, with a two-hand/draw/played/discard zone snapshot, empty and partial
  snapshots); duplicate card id and duplicate challenge id at the repeat path;
  duplicate display values (text mode is exact); numeric mode ("07" and "7.0"
  duplicate "7", but not in text mode; "seven" is non-numeric and not also a
  duplicate); `canonicalNumber` cases ("07", " 7.50 ", "-0", "abc", "1e3");
  a card in two zones or twice in one zone (not double-reported as a display
  duplicate); an unknown zone card; and the same or numerically equal display
  value across zones, citing the first location.
- **Automated unit tests: not run** — none exist yet (Tasks 14-19). The ad-hoc
  script is not a substitute and was deleted.

### Issues encountered and corrective actions
- None. Build and checks passed on the first run.

### Outcome
- **Task 8 complete and verified.** Tasks 1-7 and all established
  architecture/invariants preserved.

### Evidence references
- `tsc` exit 0 and "30 passed, 0 failed" observed this session. No Git
  repository initialized.

---

## [2026-11-09] Milestone M2 (implementation) — Task 9: single-hand starting-hand validation, and Tasks 7-9 batch close-out

- **Objective:** Implement ONLY Task 9 — validation pipeline stage 6 for a single
  hand (Req 4.1-4.4) — then close out the Tasks 7-9 batch with a clean monorepo
  build and a regression check of Tasks 1-9.
- **Prompt ID / summary:** M2 Tasks 7-9 batch (third task). No Task 10 or later;
  no dependencies; no `npm audit fix`; no Git; no dealing/generation/gameplay/
  Beepy/UI.
- **Linked spec / steering:** `.kiro/specs/educational-data-schema/` (Req 4.1-4.4;
  Design pipeline stage 6, D7; Task 9); master spec section 4; steering
  `no-duplicate-card-invariant.md`, `verified-work-only.md`.
- **Kiro features actually used:** Kiro spec task tracking; Kiro agent file
  operations and terminal execution. No hooks; no steering changes.
- **Environment (observed):** Node v22.11.0, npm 11.11.0, Windows/PowerShell.
  Dependencies already installed; none added.

### Design choices made inside the approved scope (no spec change)
- **Two functions.** `validateStartingHand(deck, handCardIds, options)` checks a
  given hand; `checkStartingHandFeasibility(deck)` checks that the deck CAN
  supply one (exists k in {2,3} with at least k correct cards and at least 5-k
  distractors). Neither deals a hand.
- **"Correct" means designated.** At the start every challenge is displayed, so a
  hand card is correct when it is some challenge's `correctAnswerCardId`. A
  repeated card is counted once.
- **Not machine-checkable here (documented, not faked):** non-leak (Req 4.3) —
  the card contract has no correctness field, so how a dealer or UI presents
  cards is a later-milestone rule; and distractor plausibility, which is a
  generator concern (design D8).
- **Penalty-draw reserve and two-player hands are not checked** (Req 4.5-4.6;
  Tasks 10-11).

### Files created
- `shared-engine/src/starting-hand.ts`.

### Files modified
- `shared-engine/src/deck-issues.ts` — added Task 9 codes: `HAND_WRONG_SIZE`,
  `HAND_UNKNOWN_CARD`, `HAND_DUPLICATE_CARD`, `HAND_DUPLICATE_DISPLAY_VALUE`,
  `HAND_CORRECT_COUNT_OUT_OF_RANGE`, `STARTING_HAND_INFEASIBLE`.
- `shared-engine/src/index.ts` — exports the Task 9 module; doc comment lists
  Task 9.
- `.kiro/specs/educational-data-schema/tasks.md` — Task 9 marked complete. Tasks
  10 and later remain unchecked.
- `docs/kiro-development-log.md` — this entry appended.

### Commands run (and observed outcomes)
- `npx tsc --build tsconfig.json --force` after Task 9 → **exit 0**;
  `shared-engine/dist/starting-hand.d.ts` present.
- `node tmp-checks/task9-check.mjs` → **exit 0; RESULT: 32 passed, 0 failed.**
- Final batch close-out: `npx tsc --build tsconfig.json --force` (shared-engine +
  math-cards + clinical-cards) → **exit 0, no diagnostics.**
- `node tmp-checks/regression-check.mjs` → **exit 0; RESULT: 21 passed, 0 failed.**
- No `npm install`, no `npm audit fix`, no Git commands.

### Tests / checks
- **TypeScript type-check (whole monorepo, clean build): PASSED** (exit 0), run
  after Task 9 and again as the batch close-out.
- **Task 9 focused functional checks: 32/32 PASSED**, covering: valid 2-correct
  and 3-correct hands and order independence; 0, 1, 4, and 5 correct cards
  rejected; wrong sizes (4, 6, empty); unknown card at its exact path; a repeated
  card flagged at the repeat only and counted once; repeated display values (text
  mode versus numeric mode); several problems reported together; and feasibility
  for 5+6, 2+3, 3+2, and the competitive 9+15 deck versus infeasible 2+2, 1+10,
  5+0, 3+1, and empty decks, plus a designated card absent from the deck not
  being counted.
- **Batch regression check: 21/21 PASSED**, confirming every runtime export from
  Tasks 2, 2a, 4, 6, 7, 8, and 9 is present, sample behavior from Tasks 2, 2a, 4,
  and 6 is intact, and a single 5-challenge / 11-card deck passes Tasks 7, 8, and
  9 together while Task 7 still refuses a missing matrix. Task 1 and other
  type-only exports are erased at runtime and are covered by the clean build.
- **Automated unit tests: not run** — none exist yet (Tasks 14-19). The ad-hoc
  scripts are not a substitute and were deleted.

### Temporary files
- `tmp-checks/` held `task7-check.mjs`, `task8-check.mjs`, `task9-check.mjs`, and
  `regression-check.mjs`; each was deleted after use. The directory was removed
  only after confirming it was empty.

### Issues encountered and corrective actions
- None for Task 9; the build and checks passed on the first run.

### Outcome
- **Task 9 complete and verified; the Tasks 7-9 batch is complete.** Tasks 1-6 and
  all established architecture/invariants preserved. Task 10 and later not begun.

### Remaining design decisions and blockers
- None blocking. Notes for upcoming work: generators in `math-cards/` and
  `clinical-cards/` must produce the Task 7 contextual-validity matrix; the
  `PENALTY_CARD_EXHAUSTED` payload shape and fallback algorithm remain for Task 12;
  Tasks 10 onward need explicit approval.

### Evidence references
- `tsc` exit 0 (twice), "32 passed, 0 failed", and "21 passed, 0 failed" observed
  this session. No Git repository initialized.

---

## [2026-11-09] Milestone M2 (implementation) — Task 10: dual-player starting-hand validation

- **Objective:** Implement ONLY Task 10 — validation pipeline stage 6 for the
  competitive (Player vs. Beepy) deal: two simultaneous, non-overlapping hands
  plus an unused penalty distractor (Req 4.4, 4.5; master spec section 7).
- **Prompt ID / summary:** M2 Tasks 10-11 batch (first task). No Task 12 or later;
  no dependencies; no `npm audit fix`; no Git; no dealing/generation/gameplay/
  Beepy AI/UI.
- **Linked spec / steering:** `.kiro/specs/educational-data-schema/` (Req 4.4,
  4.5; Design pipeline stage 6, D8; Task 10); master spec section 7; steering
  `no-duplicate-card-invariant.md`, `verified-work-only.md`.
- **Kiro features actually used:** Kiro spec task tracking; Kiro agent file
  operations and terminal execution. No hooks; no steering changes.
- **Environment (observed):** Node v22.11.0, npm 11.11.0, Windows/PowerShell.
  Dependencies already installed; none added.

### Design choices made inside the approved scope (no spec change)
- **Reuse of Task 9.** Each hand is validated by `validateStartingHand`; its issues
  are re-pathed to `hands[0]` / `hands[1]` and prefixed "Hand 1:" / "Hand 2:".
- **Shared counting rule.** `canSupplyHands(correct, distractors, handCount,
  penaltyReserve)` is a closed form: a valid total of correct cards S exists iff
  `max(2n, 5n + reserve - distractors) <= min(correct, 3n)`. Task 11 reuses it for
  a single hand plus reserve. It was cross-checked against the verified Task 9
  check (reserve 0) and against exhaustive search for two hands plus a reserve.
- **"Valid" penalty distractor** = in the deck, in neither hand, not any
  challenge's designated correct card, with a usable display value that does not
  equal any hand card's value. Unused correct cards do not count as reserve.
- **"Remaining deck"** = deck cards in neither hand. A hand card whose display
  value equals a remaining card's value is reported (this overlaps Task 8's
  deck-wide uniqueness on purpose; each validator stands alone).

### Files created
- `shared-engine/src/dual-hand.ts`.

### Files modified
- `shared-engine/src/deck-issues.ts` — added Task 10 codes: `DUAL_HAND_SHARED_CARD`,
  `DUAL_HAND_SHARED_DISPLAY_VALUE`, `HAND_VALUE_COLLIDES_WITH_DECK`,
  `NO_PENALTY_RESERVE`, `DUAL_HAND_INFEASIBLE`.
- `shared-engine/src/index.ts` — exports the Task 10 module; doc comment lists it.
- `.kiro/specs/educational-data-schema/tasks.md` — Task 10 marked complete.
- `docs/kiro-development-log.md` — this entry appended.

### Commands run (and observed outcomes)
- `npx tsc --build tsconfig.json --force` → **exit 0, no diagnostics**;
  `shared-engine/dist/dual-hand.d.ts` present. (An informational npm "new version
  available" notice was printed by `npx`; it is not an error.)
- `node tmp-checks/task10-check.mjs` → **exit 0; RESULT: 32 passed, 0 failed.**
- No `npm install`, no `npm audit fix`, no Git commands.

### Tests / checks
- **TypeScript type-check (whole monorepo, clean build): PASSED** (exit 0).
- **Focused functional checks: 32/32 PASSED**, covering: valid 3+3 and 2+3 deals
  (text and numeric mode); per-hand problems re-pathed to the right hand (wrong
  size, unknown card, too few correct); a card in both hands; a shared display
  value across hands (text versus numeric); a hand value that clashes with a
  remaining-deck value; penalty reserve present (14-card deck), absent (13-card
  deck), unused correct cards not counting, and a clashing reserve card not
  counting; feasibility for 9+15, 9+5, 9+4, 4+7, 4+6, 3+20, and empty decks; and
  the two cross-checks of `canSupplyHands` described above.
- **Automated unit tests: not run** — none exist yet (Tasks 14-19). The ad-hoc
  script was deleted.

### Issues encountered and corrective actions
- None; the build and checks passed on the first run.

### Outcome
- **Task 10 complete and verified.** Tasks 1-9 and all established
  architecture/invariants preserved.

### Evidence references
- `tsc` exit 0 and "32 passed, 0 failed" observed this session. No Git
  repository initialized.

---

## [2026-11-09] Milestone M2 (implementation) — Task 11: deck-size targets and bounds, and Tasks 10-11 batch close-out

- **Objective:** Implement ONLY Task 11 — subject-neutral deck-size rules for
  Solitaire, Tutor, and competitive modes, plus the Math-only 24-card target
  (Decision 3; design D8; master spec section 10) — then close out the Tasks 10-11
  batch with a clean monorepo build and a Tasks 1-10 regression check.
- **Prompt ID / summary:** M2 Tasks 10-11 batch (second task), after a pre-approval
  review requiring a target-ceiling rule and numeric-input validation, and a final
  approved correction for invalid modes. No Task 12 or later; no dependencies; no
  `npm audit fix`; no Git; no generation/gameplay/Beepy AI/UI.
- **Linked spec / steering:** `.kiro/specs/educational-data-schema/` (Req 4.5, 4.6,
  6.1, 6.4; Design D8; Task 11); master spec sections 3, 7, 10; steering
  `no-duplicate-card-invariant.md`, `verified-work-only.md`.
- **Kiro features actually used:** Kiro spec task tracking; Kiro agent file
  operations and terminal execution. No hooks; no steering changes.
- **Environment (observed):** Node v22.11.0, npm 11.11.0, Windows/PowerShell.
  Dependencies already installed; none added.

### Owner-approved design clarifications (recorded)
1. **`targetCardCount` is a MAXIMUM, not a required exact count.** The spec
   (master spec section 10, design D8, Req 6.4, and the Task 3 `GeneratedDeckMeta`
   comment "may be smaller when valid") permits a smaller validated deck and never
   mentions a larger one; it does not say "upper bound" in those words, so this
   reading was proposed as an interpretation and the owner confirmed it. Effect: a
   deck with more cards than `meta.targetCardCount` is rejected
   (`DECK_EXCEEDS_TARGET`); smaller validated decks stay permitted; `planDeckSize`
   never exceeds the target and never counts values the caller did not report as
   plausible, so it cannot pad. `design.md` and `requirements.md` were NOT edited
   for this wording; the clarification is recorded here and in `tasks.md`.
2. **Invalid game modes are rejected explicitly.** An unsupported mode is never
   silently treated as Solitaire. `planDeckSize` and `validateDeckSize` check the
   mode first and return a structured `INVALID_MODE` issue (path `mode`) without
   throwing; the small helpers `expectedChallengeCount` and `handCountForMode`
   throw `RangeError` for an unknown mode. `isDeckMode` is exported as a guard.

### Design choices made inside the approved scope (no spec change)
- **Where the numbers live.** The 24-card competitive target (9 correct + 15
  distractors) is Math-specific, so it is in `math-cards/src/deck-size.ts`. The
  shared engine holds only subject-neutral bounds and takes the target from the
  caller. No clinical target exists because none is approved, and nothing clinical
  was added or invented.
- **Modes** use the master spec section 3 ids `solitaire`, `tutor`, `vsBeepy`.
  `vsPlayer` is excluded: it is planned architecture only and its deck rules are
  not approved.
- **Rules:** Solitaire/Tutor = 5 challenges, one hand, one penalty distractor, no
  24-card target; competitive = 9 challenges, two non-overlapping hands, a penalty
  reserve, and a 14-card minimum (equal to 9 correct + the 5 minimum distractors,
  asserted by a check). Both use the Task 10 `canSupplyHands` counting rule.
- **Numeric validation.** Targets must be positive whole numbers; availability
  counts and `meta.actualCardCount` must be non-negative whole numbers (safe
  integers). NaN, fractions, negatives, `Infinity`, and non-numbers produce
  `INVALID_COUNT` and never a successful plan. An invalid `actualCardCount` is not
  also reported as a mismatch.

### Files created
- `shared-engine/src/deck-size.ts`.
- `math-cards/src/deck-size.ts` — `MATH_COMPETITIVE_TARGET_CARD_COUNT` (24),
  `MATH_COMPETITIVE_CORRECT_CARDS` (9), `MATH_COMPETITIVE_DISTRACTOR_CARDS` (15),
  `planMathCompetitiveDeckSize`.

### Files modified
- `shared-engine/src/deck-issues.ts` — added Task 11 codes: `INVALID_MODE`,
  `INVALID_COUNT`, `CHALLENGE_COUNT_MISMATCH`, `CARD_COUNT_MISMATCH`,
  `DECK_EXCEEDS_TARGET`, `DECK_BELOW_MINIMUM`, `INSUFFICIENT_DECK_DATA`. Earlier
  codes unchanged.
- `shared-engine/src/index.ts` — exports the Task 11 module (including
  `isDeckMode`); doc comment lists Task 11.
- `.kiro/specs/educational-data-schema/tasks.md` — Task 11 marked complete.
- `docs/kiro-development-log.md` — this entry appended.

### Commands run (and observed outcomes)
- `npx tsc --build tsconfig.json --force` (shared-engine + math-cards +
  clinical-cards) → **exit 0, no diagnostics**; `shared-engine/dist/deck-size.d.ts`
  and `math-cards/dist/deck-size.d.ts` present.
- `node tmp-checks/task11-check.mjs` → **exit 0; RESULT: 97 passed, 0 failed.**
- `node --import ./tmp-checks/register.mjs tmp-checks/task11-math-check.mjs` →
  **exit 0; RESULT: 12 passed, 0 failed.** (A temporary resolve hook maps
  `@beepy/shared-engine` to the compiled shared output, because the package's
  `main` points at TypeScript source that plain Node cannot run.)
- `node tmp-checks/regression-check.mjs` → **exit 0; RESULT: 31 passed, 0 failed.**
- No `npm install`, no `npm audit fix`, no Git commands.

### Tests / checks
- **TypeScript type-check (whole monorepo, clean build): PASSED** (exit 0).
- **Task 11 shared checks: 97/97 PASSED**, covering: mode ids, constants, and
  challenge/hand counts for all three modes; 14 = 9 + minimum distractors;
  `minimumDistractors` edge and invalid inputs; `isDeckMode` accept/reject lists;
  `RangeError` from the helpers for an unknown mode; `INVALID_MODE` (no throw) from
  both validators for six and four bad modes, and mode checked before numbers;
  Solitaire (5+3 ok, 5+2 insufficient, no competitive minimum, no 24 requirement,
  9-challenge mismatch) and Tutor equivalents; competitive (9+15 ok, 9+5 minimum
  ok, a 14-card deck against a target of 24 ok, 9+4 below minimum and insufficient,
  5-challenge mismatch); the target ceiling (over target rejected, equal and smaller
  accepted, Solitaire too, and a lying `actualCardCount` unable to hide an oversized
  deck); invalid `meta` counts (seven target values, five actual values) and a real
  count mismatch; `planDeckSize` full, capped, range-limited (19 and 14 cards),
  insufficient (4 distractors, 8 correct), below-minimum target, Solitaire and
  Tutor plans, and invalid numeric inputs for all three numeric parameters; and
  three exhaustive properties over a 3-mode x 30 x 31 grid (a plan never exceeds its
  target, never uses more distractors than available, and always builds a deck that
  `validateDeckSize` accepts) plus plan/validator agreement for 0-20 distractors.
- **Math checks: 12/12 PASSED** against the compiled `math-cards` output: 24 =
  9 + 15; 24 cards when values suffice and not more even with plenty; an easy-level
  case of 19 distinct sums gives 19 reduced cards instead of padding to 24; the
  14-card floor; insufficient and invalid-count failures; the Math wrapper equals
  the shared planner with target 24 in `vsBeepy` mode; and Solitaire is not bound
  to 24.
- **Tasks 1-10 regression: 31/31 PASSED**, confirming all runtime exports from
  Tasks 2, 2a, 4, 6, 7, 8, 9, and 10 are present; the 28 issue codes added in
  Tasks 7-10 keep their exact string values; all issue-code values are unique;
  sample behavior from Tasks 2, 2a, 4, and 6 is intact; and one 9-challenge /
  24-card deck passes Tasks 7, 8, 9, 10, and 11 together, with Task 7 still refusing
  a missing matrix and Task 10 still rejecting a shared card. Task 1 and other
  type-only exports are erased at runtime and are covered by the clean build.
- **Automated unit tests: not run** — none exist yet (Tasks 14-19). The ad-hoc
  scripts are not a substitute and were deleted.

### Temporary files
- `tmp-checks/` held `task10-check.mjs` (deleted after Task 10), and for Task 11
  `task11-check.mjs`, `task11-math-check.mjs`, `loader.mjs`, `register.mjs`, and
  `regression-check.mjs`; each was deleted after use. The directory is removed only
  after confirming it is empty.

### Issues encountered and corrective actions
- All pending Task 11 files and edits were reverted twice while awaiting review
  (the file creations and the shared-file edits) and were recreated each time. After
  approval they persisted. The two owner-requested corrections (target ceiling and
  numeric validation, then invalid modes) were applied before verification. No build
  or check failures.

### Outcome
- **Task 11 complete and verified; the Tasks 10-11 batch is complete.** Tasks 1-10
  and all established architecture/invariants preserved. Task 12 and later not
  begun.

### Limitations and remaining decisions
- No clinical deck-size target is defined (none approved); the Clinical competitive
  size needs a decision before Clinical generation.
- The `vsPlayer` mode has no deck-size rules (not implemented; rules not approved).
- Solitaire/Tutor sizes are caller-configured (master spec section 10); no default
  size is defined.
- The `design.md` / `requirements.md` text does not yet say "target is a maximum";
  the clarification lives in this log and `tasks.md` unless the owner wants the
  spec text amended.
- Task 12 (`PENALTY_CARD_EXHAUSTED` payload shape and fallback algorithm) needs
  explicit approval.

### Evidence references
- `tsc` exit 0; "97 passed, 0 failed", "12 passed, 0 failed", and "31 passed, 0
  failed" observed this session. No Git repository initialized.

---

## [2026-11-09] Milestone M2 (implementation) — Task 12: penalty-draw contract and deck-exhaustion fallback

- **Objective:** Implement ONLY Task 12 — the shared penalty-draw contract, the
  bounded fallback mechanism, the structured `PENALTY_CARD_EXHAUSTED` payload, and
  the Math fallback provider (Decision 3; design D6; master spec section 4).
- **Prompt ID / summary:** Kiro Prompt 02l — owner approved the recommended Task 12
  design (five decisions) with a clarification to verify the missed-challenge
  penalty rule first. No gameplay, turn limits, Beepy AI, or UI; no Task 13; no
  dependencies; no `npm audit fix`; no Git.
- **Linked spec / steering:** `.kiro/specs/educational-data-schema/` (Req 6.2, 6.3;
  Design D6, D6a, D7; Task 12); master spec sections 4 and 7; steering
  `no-duplicate-card-invariant.md`, `educational-data-independence.md`,
  `originality-and-copyright.md`, `verified-work-only.md`.
- **Kiro features actually used:** Kiro spec task tracking and spec editing; Kiro
  agent file operations and terminal execution. No hooks; no steering changes.
- **Environment (observed):** Node v22.11.0, npm 11.11.0, Windows/PowerShell.
  Dependencies already installed; none added.

### Missed-challenge penalty rule: verified, no document conflict
- **What the master spec says (section 7 table, "Invalid | Accept"):** "Beepy
  retains the attempted card; **both** human and Beepy draw one penalty card." So
  that event owes two draws in total, ONE CARD PER PLAYER. No player draws two
  cards. The other rows: valid + Challenge, the human draws one; invalid +
  Challenge, Beepy draws one; a human invalid action refereed by Beepy, the human
  draws one (section 7); Solitaire/Tutor, the student draws one (sections 4, 6).
- **Search result:** a search of the `.kiro` specs and steering, the development
  log, and the README found no statement that contradicts or restates this rule. So
  no documents conflict. The only discrepancy is between the owner's summary
  ("the human draws when failing to challenge Beepy's invalid move") and the
  authoritative master spec, which also has Beepy draw. The human does draw exactly
  one card, as remembered.
- **Effect on Task 12:** none. `drawPenaltyCards` is event-agnostic: the engine
  passes a list of one or more draw requests. It hard-codes no event rules and
  introduces no two-card penalty. The `MISSED_CHALLENGE` reason labels the human's
  draw in that event and `INVALID_ACTION` labels Beepy's. The owner should confirm
  before the engine milestone whether the master spec row stands as written.

### Owner-approved decisions implemented (recorded)
1. **Payload.** `PENALTY_CARD_EXHAUSTED` with `code`, `message`, `path`
   (`drawPile`) and `details` (`requests`, `drawPileRemaining`, `cardsInPlay`, and
   `fallback` with `status` = `NOT_AVAILABLE` | `EXHAUSTED` | `LIMIT_REACHED`,
   `candidatesTried`, `maxCandidates`, per-reason `rejections`). Counts only, no
   card faces or ids. Default bound 50 (`DEFAULT_MAX_PENALTY_CANDIDATES`),
   configurable through `maxCandidates`.
2. **Atomic waiver (Option A).** An event that cannot supply ALL owed cards draws
   none and leaves the input state untouched (the function is pure, so provisionally
   taken pile cards are never committed). The consequence (waive the event's draw
   penalty, record the exhaustion, continue, win conditions unchanged) is applied by
   the later engine milestone, along with the timing of challenge adjudication and
   win detection.
3. **Candidate checks.** Every fallback candidate must be evaluated against every
   active challenge (an explicit boolean for each) and is rejected if duplicated
   (id or display value, including within the same event), invalid, implausible,
   previously used, or a valid answer to an active challenge.
4. **Clinical restriction.** Nothing clinical is generated. No clinical provider
   exists; with none the status is `NOT_AVAILABLE`. Delivered fallback cards carry
   only an id and display value; contextual explanations are dropped.
5. **Spec updates.** Requirement 6.3 and design D6 were amended and a new D6a records
   the rules. The master specification and the other approved decisions are
   unchanged.

### Design details chosen inside the approved scope (no spec change)
- **Candidate rejection order:** invalid, duplicate id, duplicate display value,
  not plausible, valid for a challenge. One reason is recorded per candidate. An
  unevaluated candidate (missing or non-boolean validity for any active challenge)
  is classified `INVALID_VALUE`, keeping the approved five rejection names.
- **Duplicate comparison:** numeric mode compares as numbers; text mode uses the
  Task 7 normalization (case and whitespace), which is stricter than exact match.
- **`cardsInPlay`** = cards in hands, played, and discard (outside the draw pile);
  **`drawPileRemaining`** = pile size when the event began (can be less than owed).
- **Invalid `maxCandidates`** (not a positive whole number) returns a third result
  variant, `{ ok: false, invalid }` with `INVALID_COUNT`, rather than throwing or
  pretending to be exhaustion.
- **Math provider.** Enumerates unused whole numbers in the difficulty's inclusive
  range, nearest-first to the active challenges' answers (ties ascending),
  deterministic, capped at 10,000 values (`MAX_RANGE_SIZE`). If an active
  challenge's answer cannot be found among the cards in the game, it leaves that
  challenge unevaluated so the shared function rejects the candidate instead of
  guessing.

### Files created
- `shared-engine/src/penalty-draw.ts`.
- `math-cards/src/penalty-fallback.ts`.

### Files modified
- `shared-engine/src/deck-issues.ts` — added `PENALTY_CARD_EXHAUSTED`
  (`penaltyCardExhausted`); earlier codes unchanged (36 codes in total).
- `shared-engine/src/index.ts` — exports the Task 12 types and values; doc comment
  lists Task 12.
- `.kiro/specs/educational-data-schema/requirements.md` — Req 6.3 extended with the
  approved rules.
- `.kiro/specs/educational-data-schema/design.md` — D6 consequence bullet replaced
  and D6a added.
- `.kiro/specs/educational-data-schema/tasks.md` — Task 12 marked complete; the
  Task 20 note says the payload and algorithm were finalized in Task 12.
- `docs/kiro-development-log.md` — this entry appended.
- Not changed: `clinical-cards/` (no clinical fallback code exists by design), the
  master specification, and the steering documents.

### Commands run (and observed outcomes)
- Searches of the master spec and the `.kiro` / log / README documents for the
  missed-challenge rule (results above).
- `npx tsc --build tsconfig.json --force` (shared-engine + math-cards +
  clinical-cards) → **exit 0, no diagnostics**; `shared-engine/dist/penalty-draw.d.ts`
  and `math-cards/dist/penalty-fallback.d.ts` present.
- `node tmp-checks/task12-check.mjs` → **exit 0; RESULT: 63 passed, 0 failed.**
- `node --import ./tmp-checks/register.mjs tmp-checks/task12-math-check.mjs` →
  first run **22 passed, 1 failed**; after correcting the test expectation, **exit 0;
  RESULT: 23 passed, 0 failed.** (A temporary resolve hook maps
  `@beepy/shared-engine` to the compiled shared output, because the package `main`
  points at TypeScript source plain Node cannot run.)
- `node tmp-checks/regression-check.mjs` → **exit 0; RESULT: 31 passed, 0 failed.**
- No `npm install`, no `npm audit fix`, no Git commands.

### Tests / checks
- **TypeScript type-check (whole monorepo, clean build): PASSED** (exit 0).
- **Shared checks: 63/63 PASSED**, covering: constants and registry code; draw-pile
  first with order preserved and the fallback not consulted when the pile suffices;
  pile-plus-fallback mixes; explanations dropped from fallback cards; the full
  exhaustion payload (code, path, requests, counts, statuses, bound, message) and no
  card ids or faces leaking into it; all five rejection reasons with exact counts
  (including malformed, blank, unevaluated, and non-boolean candidates); text-mode
  case/whitespace and numeric-mode duplicates; draw-pile cards counted as used;
  within-event uniqueness; bounded attempts (an endless provider read exactly 50
  times, configurable bound of 3, accepted candidates counting toward the bound);
  iterator cleanup on success, exhaustion, and limit; invalid `maxCandidates`
  (six bad values) returning a structured `INVALID_COUNT`; atomic rollback (state
  unchanged, nothing exposed, the provisionally taken pile card still available
  afterwards, an unconsumed candidate still available afterwards, and determinism);
  multi-request payloads keeping request order and reasons; the context handed to
  providers; Clinical no-generation (no provider -> `NOT_AVAILABLE`, empty reserve ->
  `EXHAUSTED`, a pre-authored reserve card delivered exactly as supplied), plus a
  check that `clinical-cards/dist` contains no penalty or fallback code; and a
  4000-event randomized comparison with an independent oracle (ok/exhausted agreed
  in every event; no duplicate id or value ever delivered; every card came from the
  pile prefix or an eligible candidate; attempts never exceeded the bound; both
  outcomes well represented).
- **Math checks: 23/23 PASSED** against the compiled `math-cards` output: invalid
  ranges throw `RangeError`; nearest-first deterministic order (6, then 10, then 5);
  a minted card is never offered again; delivered values unique and never equal to an
  active answer; range limits respected; exhaustion and the 50-candidate bound are
  atomic; an unevaluable challenge never leads to a guess (small range ends
  `EXHAUSTED` after 15 rejections, wide range `LIMIT_REACHED` after 50); an id
  collision is rejected and the next candidate used.
- **Tasks 1-11 regression: 31/31 PASSED**: runtime exports of Tasks 2-12 present; the
  35 issue codes from Tasks 7-11 keep their exact values and Task 12 adds exactly one
  (36 total, all unique); sample behavior from Tasks 2, 2a, 4, and 6 intact; one
  9-challenge / 24-card deck passes Tasks 7-11 together, Task 7 still refuses a
  missing matrix, Task 10 still rejects a shared card, Task 11 still treats the
  target as a maximum, rejects invalid modes, and reduces rather than pads.
- **Automated unit tests: not run** — none exist yet (Tasks 14-19). The ad-hoc
  scripts are not a substitute and were deleted.

### Issues encountered and corrective actions
- One Math check failed on its first run. The test assumed a challenge whose answer
  could not be found would end in `LIMIT_REACHED` after 50 rejections, but the 0-18
  range has only 15 unused values, so the run correctly ended `EXHAUSTED` after 15
  rejections. The code was right and the expectation was wrong; the test now covers
  both a small range (`EXHAUSTED`, 15) and a wide range (`LIMIT_REACHED`, 50). No
  production code changed because of it.

### Temporary files
- `tmp-checks/` held `task12-check.mjs`, `task12-math-check.mjs`, `loader.mjs`,
  `register.mjs`, and `regression-check.mjs`; each was deleted after use, and the
  directory is removed only after confirming it is empty.

### Outcome
- **Task 12 complete and verified.** Tasks 1-11 and all established
  architecture/invariants preserved. Task 13 not begun.

### Limitations and remaining decisions
- The engine milestone must: map each game event to its list of draw requests (per
  master spec sections 4, 6, 7); apply the waiver and record the exhaustion; decide
  the timing of challenge adjudication and win detection (for example whether a
  win check precedes any penalty draw when a valid Beepy move empties its hand); and
  decide whether a turn cap is needed, since waived penalties make repeated invalid
  actions cheaper once cards run out.
- The owner should confirm the section 7 row "both human and Beepy draw one penalty
  card" before the engine milestone.
- No Clinical fallback content exists. Clinical needs pre-authored, reviewed reserve
  distractors before it can supply any fallback card; until then its status is
  `NOT_AVAILABLE`.
- The Math range per difficulty (for example 0-18 for one digit plus one digit) is
  chosen by the caller and not yet wired to a difficulty setting.
- Generators are still to be written and must produce the Task 7 contextual-validity
  matrix.

### Evidence references
- `tsc` exit 0; "63 passed, 0 failed", "23 passed, 0 failed", and "31 passed, 0
  failed" observed this session. No Git repository initialized.

---

## [2026-11-09] Milestone M2 (implementation) — Task 13: insufficient-data checks and shared error model

- **Objective:** Implement ONLY Task 13 — fail cleanly with actionable errors when
  data cannot produce a valid deck (too few unique values, no unambiguous correct
  card, range below the mode's hands plus draw reserve) with no partial or invalid
  deck emitted, and a structured error model (code, message, offending id/path)
  shared across import, deck validation, and exhaustion reporting.
- **Prompt ID / summary:** Kiro Prompt 02m — owner approved Task 13 only, and asked
  to record a confirmation of the master spec section 7 penalty rule. No gameplay;
  no Task 14; no dependencies; no `npm audit fix`; no Git.
- **Linked spec / steering:** `.kiro/specs/educational-data-schema/` (Req 6.1, 6.2,
  6.5; Design D7, D8; Task 13); master spec sections 7 and 12; steering
  `no-duplicate-card-invariant.md`, `educational-data-independence.md`,
  `verified-work-only.md`.
- **Kiro features actually used:** Kiro spec task tracking; Kiro agent file
  operations and terminal execution. No hooks; no steering changes.
- **Environment (observed):** Node v22.11.0, npm 11.11.0, Windows/PowerShell.
  Dependencies already installed; none added.

### Owner confirmation recorded (master spec section 7)
- The owner confirmed the existing written rule, to be retained for future gameplay
  implementation: **when Beepy makes an invalid move and the human fails to
  challenge it (Accepts), each of them draws one penalty card.** This matches the
  master spec section 7 table row "Invalid | Accept" ("both human and Beepy draw one
  penalty card"). It resolves the question left open after Task 12. No gameplay was
  implemented in Task 13; the rule belongs to the later engine milestone.

### Architectural decision check
- No unapproved architectural decision was needed to complete Task 13, so the task
  was not paused. The Task 5 `DeckGenerator` interface and the Task 7 validator were
  not changed. One related decision is NOT made here and is listed under open items:
  how generators report failures and hand over the Task 7 contextual-validity matrix.

### Design choices made inside the approved scope (no spec change)
- **One issue model.** `StructuredIssue` names the shared `code` / `message` / `path`
  shape. A compile-time type (`IssueModelConformance`) proves the source-import
  issue, the deck issue, and `PenaltyCardExhausted` all conform; the build fails if
  one stops conforming. `formatIssue` / `formatIssues` print any of them uniformly
  (`[CODE] path: message`), and `isStructuredIssue` is a runtime guard.
- **Merge errors join the model.** `issuesFromMergeError` adapts a Task 2a
  `CollectionMergeError`: a version mismatch becomes one issue at `schemaVersion`; each
  duplicated id becomes one issue at `subjects` that names the id and its count. A
  merge does not record where each copy came from, so exact per-occurrence paths come
  from `validateIdentifiers` on one collection. Task 2a was not modified.
- **Too few unique values.** `countUniqueValues` counts distinct usable values (text
  mode uses the Task 7 case/whitespace normalization; numeric mode compares as
  numbers). `assessDeckData` counts distractors equal to a correct value as unusable,
  checks both pools against the mode's needs through the Task 11 planner, and reports
  `TOO_FEW_UNIQUE_VALUES` when the supplied count looks sufficient but duplicates,
  invalid values, or overlap leave too few, or `INSUFFICIENT_DECK_DATA` when the range
  is simply too small. Both pools are reported when both are short. Target and mode
  problems pass through the planner's own issue.
- **No unambiguous correct card.** `analyzeCandidateAmbiguity` takes the generator's
  full candidate-by-challenge evaluation (the Task 7 matrix shape) and sorts
  candidates into per-challenge unambiguous options, ambiguous cards (valid for more
  than one challenge, for the generator to resolve or exclude, Req 6.2), and
  distractor candidates. A challenge with no unambiguous option reports
  `NO_UNAMBIGUOUS_CORRECT_CARD`, with a message distinguishing "no candidate is valid"
  from "every valid candidate is ambiguous". Like Task 7 it never skips a pair.
- **No partial deck.** On any failure both functions return `{ ok: false, issues }`
  and nothing else - no plan, analysis, or deck.

### Files created
- `shared-engine/src/issues.ts`.
- `shared-engine/src/data-sufficiency.ts`.

### Files modified
- `shared-engine/src/deck-issues.ts` — added `TOO_FEW_UNIQUE_VALUES` and
  `NO_UNAMBIGUOUS_CORRECT_CARD` (38 codes in total); earlier codes unchanged.
- `shared-engine/src/index.ts` — exports the Task 13 types and functions; doc comment
  lists Task 13.
- `.kiro/specs/educational-data-schema/tasks.md` — Task 13 marked complete.
- `docs/kiro-development-log.md` — this entry appended.
- Not changed: requirements and design documents, `math-cards/`, `clinical-cards/`,
  the master specification, and steering.

### Commands run (and observed outcomes)
- `npx tsc --build tsconfig.json --force` (shared-engine + math-cards +
  clinical-cards) → **exit 0, no diagnostics**; `shared-engine/dist/issues.d.ts` and
  `data-sufficiency.d.ts` present.
- `node tmp-checks/task13-check.mjs` → first run **75 total, 1 failed**; after
  correcting the test expectation, **exit 0; RESULT: 76 passed, 0 failed.**
- `node --import ./tmp-checks/register.mjs tmp-checks/regression-check.mjs` →
  **exit 0; RESULT: 30 passed, 0 failed.** (A temporary resolve hook maps
  `@beepy/shared-engine` to the compiled shared output so the compiled Math output can
  run in plain Node.)
- No `npm install`, no `npm audit fix`, no Git commands.

### Tests / checks
- **TypeScript type-check (whole monorepo, clean build): PASSED** (exit 0), including
  the compile-time issue-model conformance.
- **Task 13 checks: 76/76 PASSED**, covering: all four report families (source import,
  identifier, deck, `PENALTY_CARD_EXHAUSTED`) recognised as structured issues and
  printed by one formatter; junk rejected by the guard; merge errors adapted (version
  mismatch, per-id duplicates with counts, a bare error); `countUniqueValues` in text
  and numeric modes; `assessDeckData` for competitive (24, reduced to 19, the 14-card
  minimum), duplicates hiding a shortage in the correct pool and in the distractor pool,
  distractors equal to correct values, non-numeric values, pure range shortages,
  both pools short, target and mode problems, Solitaire, Tutor, and Clinical-like text
  pools; `analyzeCandidateAmbiguity` for clean, multi-option, ambiguous, all-ambiguous,
  none-valid, and all-challenges-failing cases, a missing, empty, partial, or
  non-boolean matrix, unknown keys, duplicate ids, and zero challenges; a deck built
  from the analysis (ambiguous card excluded) passing the Task 7 validator while
  including the ambiguous card is caught by it; every failure carrying only
  `{ ok, issues }`; and two properties: on unique pools `assessDeckData` agrees with
  `planDeckSize` (3 modes x 30 targets x 12 x 19 pool sizes) and padding pools with
  duplicates never changes the verdict.
- **Tasks 1-12 regression: 30/30 PASSED**: runtime exports of Tasks 2-13 present; the
  36 issue codes from Tasks 7-12 keep their exact values and Task 13 adds exactly two
  (38 total, all unique); source-validation and merge codes unchanged; sample behavior
  from Tasks 2, 2a, 4, 6, 7, 8, 9, 10, and 11; and Task 12 (Math fallback supplies 6
  then 10 from the compiled output, atomic exhaustion with no cards, and the 50-candidate
  bound) plus the Math 24-card planner.
- **Automated unit tests: not run** — none exist yet (Tasks 14-19). The ad-hoc scripts
  are not a substitute and were deleted.

### Issues encountered and corrective actions
- One Task 13 check failed on its first run. It expected four distractor variants that
  normalize to three unique values to fail for Solitaire, but Solitaire needs exactly
  three, so the code correctly returned a reduced 8-card plan. The code was right and
  the expectation was wrong; the test now covers both sides of the boundary (3 unique
  is enough, 2 unique reports `TOO_FEW_UNIQUE_VALUES`). No production code changed.

### Temporary files
- `tmp-checks/` held `task13-check.mjs`, `regression-check.mjs`, `loader.mjs`, and
  `register.mjs`; each was deleted after use, and the directory is removed only after
  confirming it is empty.

### Outcome
- **Task 13 complete and verified.** Tasks 1-12 and all established
  architecture/invariants preserved. Task 14 not begun.

### Open items and decisions for the owner
- **Generator integration (decision needed).** The Task 5 `DeckGenerator.generate`
  returns only a `GeneratedDeck`, so a generator has no channel to return these issues
  or the Task 7 contextual-validity matrix other than throwing. Options: change the
  interface to return a result type (`{ ok, deck, contextualValidity }` or
  `{ ok: false, issues }`); or add a typed error that carries issues, following the
  `CollectionMergeError` precedent. Neither was done here.
- **Raw-JSON import entry point.** The pieces exist (structural and identifier
  validation, merge, the shared issue model and merge adapter), but no single function
  yet takes raw JSON files and returns a merged collection or a full issue list with
  per-collection paths. Whether that belongs in M2 or a later loader task is for the
  owner to say.
- **Source-data sufficiency scan.** `assessDeckData` and `analyzeCandidateAmbiguity`
  work on the pools and evaluation a generator supplies. A scan of an imported
  `SubjectCollection` that predicts, before generation, whether a topic or subject can
  fill a deck would need generator selection rules that are not yet written.
- Task 14 and later need explicit approval.

### Evidence references
- `tsc` exit 0; "76 passed, 0 failed" and "30 passed, 0 failed" observed this session.
  No Git repository initialized.

---

## [2026-11-09] Milestone M2 (implementation) — Tasks 14-19: permanent automated test suites

- **Objective:** Replace the throwaway functional checks with permanent, repeatable
  Vitest suites for Tasks 14-18, convert the earlier regression checks into permanent
  tests, and record the results honestly (Task 19).
- **Prompt ID / summary:** Kiro Prompt 02n - owner approved Tasks 14-19 as one
  controlled testing batch, then approved the test infrastructure with one correction:
  remove `"noUncheckedIndexedAccess": false` from `tsconfig.test.json` so the tests
  inherit the base setting, and report errors rather than weaken the configuration.
  Production code, dependencies, and Git untouched; no Task 20.
- **Linked spec / steering:** `.kiro/specs/educational-data-schema/` (Req 7.1, 7.2,
  7.3; master spec section 16; Design "Proposed tests"); steering
  `verified-work-only.md`, `no-duplicate-card-invariant.md`,
  `originality-and-copyright.md`.
- **Kiro features actually used:** Kiro spec task tracking; Kiro agent file operations
  and terminal execution. No hooks; no steering changes.
- **Environment (observed):** Node v22.11.0, npm 11.11.0, Vitest 2.1.9,
  Windows/PowerShell. No dependency was added.

### Test infrastructure
- Framework: Vitest (approved in Decision 2, already installed). No config file; the
  default include pattern finds `*.test.ts`. `npm test` runs `vitest run`.
- `tsconfig.test.json` (new, root): extends the base config with `noEmit`, no
  composite/declaration/source maps, and `types: ["vite/client"]` (for
  `import.meta.glob`). It does NOT relax strictness: after the owner's correction it
  inherits `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes` from the base.
- `package.json`: one script added, `"typecheck:tests": "tsc -p tsconfig.test.json"`.
  Nothing else changed.
- `@types/node` is not installed, so no test uses Node APIs.
- Permanent files (kept, not deleted):
  - `shared-engine/tests/fixtures.ts` - deterministic deck builders for all four
    (app style, generation direction) combinations, matrices, seeded random, freeze,
    combinatorics, and penalty helpers.
  - `shared-engine/tests/task14-uniqueness-and-mapping.test.ts`
  - `shared-engine/tests/task15-starting-hands.test.ts`
  - `shared-engine/tests/task16-direction-and-context.test.ts`
  - `shared-engine/tests/task17-deck-size.test.ts`
  - `shared-engine/tests/task18-exhaustion.test.ts`
  - `shared-engine/tests/task18-insufficient-data.test.ts`
  - `shared-engine/tests/task18-import-errors.test.ts`
  - `shared-engine/tests/regression-api-surface.test.ts`
  - `shared-engine/tests/regression-foundations.test.ts`
  - `shared-engine/tests/regression-pipeline.test.ts`
  - `math-cards/tests/helpers.ts`, `math-cards/tests/task17-deck-size.test.ts`,
    `math-cards/tests/task18-penalty-fallback.test.ts`
  - `clinical-cards/tests/task18-no-runtime-generation.test.ts`
- Clinical-style fixtures use obviously fake placeholder text ("Test Disease 1",
  "Test finding 1"). No clinical fact or explanation was invented. The only real
  wording is the two examples printed in master spec section 9.

### Commands run (and observed outcomes)
- `npm run typecheck:tests` (after the correction and after every new file) → **exit 0,
  no diagnostics.** The strict inherited settings produced no errors.
- `npx vitest run <task>` for each suite as it was written.
- `npx tsc --build tsconfig.json --force` (shared-engine + math-cards + clinical-cards)
  → **exit 0, no diagnostics.**
- `npx vitest run` (the whole project, JSON report) → **exit 0; 898 passed, 0 failed,
  10 todo, 908 total** in 13 test files.
- A mutation probe on a throwaway copy (see below).
- No `npm install`, no `npm audit fix`, no Git commands. Lint was NOT run.

### Results by task (Vitest counts expanded tests, so one `it.each` counts per row)
| Task | Files | Passed | Todo | Failed |
|---|---|---|---|---|
| 14 uniqueness and challenge mapping | task14 | 123 | 0 | 0 |
| 15 starting hands, single and dual | task15 | 166 | 0 | 0 |
| 16 direction and contextual correctness | task16 | 47 | 8 | 0 |
| 17 deck size | shared task17 (189) + Math task17 (18) | 207 | 0 | 0 |
| 18 exhaustion, insufficient data, import errors | exhaustion 52, insufficient 45, import 106 (+2 todo), Math fallback 23, Clinical 9 | 235 | 2 | 0 |
| Regression (Tasks 1-13) | api-surface 16, foundations 56, pipeline 48 | 120 | 0 | 0 |
| **Total** | 13 files | **898** | **10** | **0** |

### Coverage
- **Task 14** - `uniqueness-across-zones`: valid partitions, a card in two zones or twice
  in one, equal values across zones (text and numeric), unknown cards, partial snapshots,
  duplicate card and challenge ids, 400 random partitions each accepted and each with one
  injected duplicate always caught. `one-correct-card-per-challenge`: 5- and 9-challenge
  decks, missing or empty designation, shared designation, every matrix semantic case,
  and two mutation sweeps over all 55 cells of a 5x11 matrix (removing any cell is
  reported at exactly that cell; flipping any cell is always rejected).
  `ambiguous-answer-rejected`: a card valid for two challenges, an ambiguous card
  excluded by the generator, candidate analysis, and a deck built from it passing.
  `duplicate-display-text-rejected`: exact, case/whitespace, repeated copies, Unicode
  normalization, and the text-versus-numeric split between Tasks 7 and 8.
- **Task 15** - `valid-starting-hand-composition`: 2 and 3 correct, all 120 orderings,
  0/1/4/5 correct, sizes 0-7, unknown, repeated, equal-valued, combined problems,
  numeric mode, an exhaustive pass over all 462 five-card hands (350 valid, 112 rejected
  with exactly one issue), brute-force feasibility. `competitive-dual-hand-feasibility`:
  valid deals, per-hand issues with hand-named paths, shared card, shared value, clash
  with the remaining deck, the penalty reserve (14 versus 13 cards, unused correct cards,
  a clashing reserve), the 14-card boundary, `canSupplyHands` against brute force for
  1-3 hands, and 2400 random deals against an independent oracle.
- **Task 16** - generation-direction configuration (defaults, all four overrides,
  switching, guard, configuration-not-schema); all four combinations passing the whole
  pipeline at contract level for competitive and Solitaire/Tutor decks; the two master
  spec section 9 examples; contextual correctness at the validator and data level
  (validity belongs to a challenge-and-card pair; one fact may be correct in one context
  and incorrect in another; explanations optional, bound to a challenge, off the card
  face, and dropped from fallback cards).
- **Task 17** - modes, bounds, `minimumDistractors`, invalid modes (explicit
  `INVALID_MODE`, `RangeError` from helpers), Solitaire, Tutor, and competitive
  boundaries, the target as a maximum, invalid counts, `planDeckSize`, reduced decks
  that pass the whole pipeline for all four combinations, grid properties (never
  exceeds the target, never pads, monotonic); Math: 24 = 9 + 15, exactly 24 when
  possible and never more, reduced decks, failure below the minimum, and the wrapper
  matching the shared planner.
- **Task 18** - `draw-pile-exhaustion-reports-condition`: pile first, fallback, the full
  payload with no leaked card data, every rejection reason with exact counts, reason
  precedence, within-event uniqueness, bounded attempts (endless provider read exactly
  the bound), iterator cleanup, invalid bounds, atomic rollback with frozen inputs, and
  4000 random events against an independent oracle. `insufficient-data-fails-cleanly`:
  Math and Clinical pools (duplicates and invalid values hiding a shortage, overlap with
  correct values, pure range shortage, both pools short, target and mode problems),
  failures carrying only `{ ok, issues }`, agreement with the planner over 20,520 cases,
  padding invariance, and `analyzeCandidateAmbiguity`. `invalid-json-import-errors`: 19
  structural cases and 7 version cases per app, 10 identifier cases per app, duplicate
  paths, Math and Clinical together, and merge errors adapted into the shared model.
  Math: the provider end to end, including drawing one penalty at a time until a 19-value
  range is used up (15 unique cards, then exhaustion, with the whole game still unique).
  Clinical: no penalty or fallback module ships, `NOT_AVAILABLE` and empty-reserve
  behavior, pre-authored reserve delivered exactly as supplied, explanations dropped,
  unsafe reserve content rejected, and 1000 random events showing every delivered card
  came from the pile or the reserve. Both generator stubs still refuse to generate.
- **Regression** - the 69 runtime exports and every stable code value are locked
  (38 deck issue codes, 7 source-validation codes, 2 merge codes, constants);
  identifier conventions, merge rules, and the shared issue model; and an integrated
  pipeline test that injects eleven different defects into a valid competitive deck for
  all four combinations and requires exactly the right stages to fail and every other
  stage to stay clean.

### Issues encountered and corrective actions
1. **Test-fixture defect (not a production defect).** Four Task 15 cases (the "2 + 3
   correct" dual deal, once per combination) failed on the first run. The second hand
   reused `distractor-2`, which the first hand already held, so the deal really did
   share a card and the validator correctly rejected it. The fixture was corrected so
   the second hand's distractors start at `distractor-3`; the assertion was not changed.
2. **Lost command output.** Two of my own PowerShell commands lost their printed results
   (output after a long `npx` line was dropped). The commands were split and the results
   re-read from a temp file; no result was assumed.
3. **No production defect was found.** No production source file was edited in this batch
   (there is no Git to diff; this is from the edit history of this session), and no
   assertion was weakened to make a test pass.

### Test sensitivity probe (mutation check)
- To show the suites can fail, four deliberate bugs were injected into a throwaway COPY
  of `shared-engine` (production untouched): disabling the cross-zone duplicate check;
  letting the deck planner pad with unavailable distractors; multiplying the penalty
  candidate bound by 100; and allowing a fourth correct card in a starting hand. The copy's
  tests reported **65 failing assertions** (Task 14: 9, Task 15: 9, Task 17: 37,
  Task 18 exhaustion: 7, Task 18 insufficient-data: 3). The copy was deleted afterwards.
  The regression files did not fail on those four particular bugs, which is expected
  because they target different defects. This is a spot check, not full mutation testing.

### Not covered (recorded, not faked)
- **Task 16 gap - owner decision requested.** `it.todo` entries (8) record behavior that
  no M2 task builds: generators producing a valid deck per direction (Math and Clinical
  generators, a later milestone) and the runtime judging of a play, a discard, a card that
  is correct for another challenge, and an invalid action (the game engine, a later
  milestone). Because the named `contextual-play-and-discard` test cannot pass yet, Task
  16 was left UNCHECKED. The owner can accept the covered part and close it, or keep it
  open until the engine exists.
- **Task 18 todos (2):** syntactically invalid JSON text, and a single raw-JSON import
  entry point. Neither exists in code; whether they belong in M2 is an owner decision.
- **Non-leak (Req 4.3):** only the card contract is checked (no correctness field). Whether
  a dealer or UI reveals which cards are correct belongs to the engine milestone.
- Lint was not run on the tests. Real generators, the engine, and the UI have no tests
  because they do not exist.

### Outcome
- **Tasks 14, 15, 17, 18, and 19 complete and verified. Task 16 left open with its gap
  documented.** Task 20 not begun. All production code, the master specification,
  steering, and dependencies are unchanged.

### Evidence references
- `tsc` build exit 0, `typecheck:tests` exit 0, and `vitest run` "898 passed, 0 failed,
  10 todo" observed this session. No Git repository initialized.

## M2 Task 20 - Hold point resolved, M2 closeout (Prompt 02o)

### Owner decisions recorded
- Accepted Tasks 14, 15, 17, 18, 19 (898 passing tests). Task 16 stays UNCHECKED; its 8
  `it.todo` must not be replaced by artificial implementations.
- Approved for future work (nothing implemented in M2): (1) generator integration uses a
  structured result carrying a deck, its full contextual-validity matrix, or structured
  validation issues, with the `DeckGenerator` change deferred; (2) raw JSON parsing and a
  unified import entry point belong to a later loader/integration task; (3) source-data
  sufficiency scanning belongs with the real generators; (4) Clinical deck sizes are
  configurable and bounded by reviewed content, and Clinical penalty fallback never invents
  facts or explanations; (5) the engine detects an immediate empty-hand win before any
  further penalty draw; (6) no additional turn cap.

### Changes made
- `tasks.md`: Task 20 checked, with the decisions and outstanding items recorded. Task 16
  remains `[ ]`.
- Only the text of `it.todo` titles/comments changed in `task16-direction-and-context.test.ts`
  and `task18-import-errors.test.ts`, to state each dependency. No assertion was changed or
  removed; no production code was modified; no dependencies were added.

### Verification (observed this session)
- `npx tsc --build tsconfig.json --force`: exit 0. `npm run typecheck:tests`: exit 0.
- `npx vitest run`: 13 files passed, 898 passed, 0 failed, 10 todo. Lint not run.

### Outstanding / deferred
- 10 `it.todo`: Task 16 (4 need Math/Clinical generators, 4 need the game engine); Task 18
  (2 need the loader/integration task).
- Deferred: controlled-repetition specifics, generator result type, loader, sufficiency scan,
  Clinical sizing and reserve content, engine win-before-penalty ordering.
- No Git repository initialized. No next milestone started.

## [2026-11-10] Milestone M3 (shared game engine) — specification, and Tasks E0-E9

This entry was written at the owner's request before E10, from the task records, the
files on disk, and command output observed in this session. Times are file
`LastWriteTime` values or vitest "Start at" stamps shown in the terminal. Where no
time was recorded, the entry says so.

- **Objective:** Build the subject-neutral engine for Solitaire and Player vs. Beepy
  that both apps use, starting from validated sample decks. No UI, no real
  generators, no persistence, no Tutor gameplay.
- **Prompt summary:** The owner approved moving to the engine milestone and asked
  for a spec first. Revision 1 (requirements, design, tasks) was reviewed. The owner
  then gave decisions D-1 to D-6 and six corrections, giving revision 2. Revision 2
  was approved with three clarifications (2a): the E4 test wording, the controller as
  the runtime privacy boundary, and random state threaded through the immutable
  state. E1-E15 were then authorized to run in order.
- **Linked spec / steering:** `.kiro/specs/game-engine/requirements.md`,
  `design.md`, `tasks.md` (revision 2a); `docs/master-spec-v1.1.md` sections 2-7,
  14 and 16; steering `architecture.md`, `no-duplicate-card-invariant.md`,
  `educational-data-independence.md`, `verified-work-only.md`.
- **Kiro features actually used:** Kiro specs (requirements, design, tasks) and task
  tracking; steering documents read as constraints; agent file operations and
  terminal execution. No hooks were created. Steering was not changed.
- **Dependencies, Git, audit:** None added. Git not used. `npm audit fix` not run.

### Specification
- Revision 1: the date was not recorded, and the files were later overwritten. It
  proposed decisions D-1 to D-6 and an optional Tutor task.
- Owner decisions: D-1 seeded deterministic randomness, no dependency. D-2 a
  simple, replaceable Beepy strategy with a configurable error rate, and a judge
  independent of it. D-3 the first player alternates, with the human starting Game 1.
  D-4 Tutor deferred. D-5 the Continue step deferred with Tutor. D-6 a played correct
  card stays attached to its solved challenge.
- Revision 2 corrections:
  - the gate runs every applicable M2 check, including the full matrix;
  - the UI never receives private state;
  - Solitaire terminology matches master spec section 2 (turns are scored; rounds
    are descriptive only; five games make a session);
  - a test-only step limit plus agents that make progress, with no gameplay cap;
  - clearer E4 wording;
  - Tutor removed from M3, with its requirements kept as Requirement 13, and
    `createGame` rejects `tutor`.
- Revision 2a clarifications were written into all three spec files. Observed
  timestamps: requirements.md 03:25:51, design.md 03:26:10.

### E1 - pure seeded randomness and core types (verified)
- `shared-engine/src/game/random.ts` (new): `RngState` is a plain 32-bit number.
  It provides `nextUint32` (mulberry32), `nextFloat`, `nextInt` (rejection sampling,
  unbiased), `shuffle` (Fisher-Yates, returns a new array) and `deriveSeed` (separate
  streams per game: `deal`, `engine`, `beepy`). There is no mutable generator object.
- `shared-engine/src/game/types.ts` (new): modes, players, requests, private events,
  `EngineState`, outcomes, error codes and the `failure` helper.
- Problem found while writing, before any test run: `deriveSeed` returned the
  advanced state rather than the generated value. I fixed it before the first run.
- Tests: `shared-engine/tests/m3-e1-random.test.ts`, 25/25 passed. The file also
  scans engine source for `Math.random`, `Date`, `performance.now` and `crypto`. That
  scan runs once per engine file, so the file's count grows as files are added: it
  was 33 at the later full runs, all passed.

### E2 - initialization gate (verified)
- `shared-engine/src/game/deck-gate.ts` (new):
  - `resolveMode`: `solitaire` and `vsBeepy` are accepted. `tutor` and `vsPlayer`
    give `MODE_NOT_IMPLEMENTED`; anything else gives `INVALID_MODE`.
  - `checkDeckShape`: a defensive check for untyped input.
  - `validateDeckForPlay`: runs the shape check, then calls M2's
    `validateChallengeMapping` (full matrix required), `validateUniqueness`,
    `validateDeckSize`, and the single- or dual-hand feasibility check. It returns
    every issue found, never throws, and modifies no M2 code.
- Tests: `m3-e2-gate.test.ts`, 131/131 passed. One assertion that could never fail
  was replaced with a real check before the first run.

### E3 - dealing and handles (verified)
- `shared-engine/src/game/deal.ts` (new):
  - `dealHands` picks how many correct cards each hand gets (2 or 3, keeping the
    penalty reserve feasible), shuffles each hand and the draw pile, and re-validates
    the deal with `validateStartingHand`, `validateDualStartingHands` and
    `validateUniqueness` over the zones. It never repairs a bad deal.
  - `mintHandle` and `assignHandles` create opaque handles from the engine stream.
- `shared-engine/src/game/game.ts` (new): `createGameState` gates the deck, deals,
  assigns handles and records `GAME_DEALT`.
- Tests: `m3-e3-deal.test.ts`, 43/43 passed. This includes the createGame-level E2
  refusals, the hand composition over many seeds, a check that hand position doesn't
  reveal correctness, determinism, the alternating first player, and handles that are
  independent of card ids.

### E4 - judging (verified)
- `shared-engine/src/game/judge.ts` (new):
  - `judgeAction` is the only place validity is decided. A play is valid only for
    the designated card on an open challenge. A discard is valid only for a card
    that is the designated card of no open challenge.
  - `checkRequest` handles illegal requests, including a challenge that is already
    solved. These change nothing, aren't a turn, and draw no penalty.
- Tests: `m3-e4-judge.test.ts`, 34/34 passed. Wording follows clarification 2a.

### E5 - penalty application (verified)
- `shared-engine/src/game/penalty.ts` (new): `applyPenaltyEvent` wraps M2's
  `drawPenaltyCards` as one atomic event.
  - On success, cards join the owing players' hands, and fallback cards get handles
    with no explanation.
  - On exhaustion nothing is drawn, `PENALTY_EXHAUSTED` is recorded, and the penalty
    is waived.
- Tests: `m3-e5-penalty.test.ts`, 17/17 passed. They cover pile draws, the atomic
  two-player draw, exhaustion and the waived penalty, the bounded fallback (with the
  limit reached), rejection of duplicate or ambiguous candidates, and Clinical play
  with no provider.

### Test helpers (owner corrections applied)
- `shared-engine/tests/m3-helpers.ts`: deck samples, request builders,
  `expectInvariants` and `craft`.
- First owner correction: `expectInvariants` now reuses M2's `canonicalNumber` and
  `normalizeDisplayText`, and fails on a non-numeric value in numeric mode.
- Second owner correction: `craft` throws on an unknown card id, an unknown challenge
  id, or a card placed twice. Its comment now says crafted states are for focused
  tests only and have no matching event history.
- Tests: `m3-helpers.test.ts`, 10/10 passed. A combined run with E3-E5 had 104
  passed, vitest start 05:28:37.

### E6 and E7 - Solitaire turns, ending, scoring, session (verified)
- `shared-engine/src/game/solitaire.ts` (new): `solitairePenalties` and
  `solitaireOutcome`. The score is turns plus cards left in hand. A game ends on an
  empty hand or when all challenges are solved, and both at once count as one ending.
- `game.ts` resolution order: move cards, count the turn, check for the end (no
  penalty is drawn if the game ended), apply the penalty, re-check as a safeguard,
  then advance the active player.
- `shared-engine/src/game/series.ts` (new) went through two owner review rounds:
  - First: `seriesStatus` silently skipped outcomes of the wrong kind and treated
    unknown modes as matches. It now returns `SeriesStatusResult` and rejects a
    mismatched outcome kind (`SERIES_OUTCOME_MISMATCH`), too many outcomes, or
    outcomes recorded after the match was decided (`SERIES_OUTCOMES_EXCESSIVE`).
    Unsupported modes give `MODE_NOT_IMPLEMENTED` or `INVALID_MODE`.
  - Second: `maxGamesFor` now returns a `MaxGamesResult` and also rejects
    unsupported modes, without throwing. `checkCanStartGame` uses the same checks.
  - Both new codes were added to `ENGINE_ERROR_CODES` in `types.ts`.
- Tests:
  - `m3-e6-e7-solitaire.test.ts`, 32 passed: turn tests for all four content
    combinations, ending and scoring cases, and real games through to the end.
  - `m3-series.test.ts`, 28 passed: valid five-game sessions, best-of-five results,
    mismatched kinds, too many outcomes, games after the match was decided, and
    unsupported modes.
- Callers checked: `seriesStatus`, `maxGamesFor` and `checkCanStartGame` are called
  only from `series.ts` and `m3-series.test.ts`. They are not yet exported from the
  package index.
- Full verification: `npx tsc --build tsconfig.json --force` exit 0,
  `npm run typecheck:tests` exit 0, and `npx vitest run` gave 21 files, 1226 passed,
  0 failed, 10 todo (vitest start 05:46:07).

### E8 and E9 - competitive turns, pending Beepy action, ending (verified)
- `shared-engine/src/game/competitive.ts` (new):
  - `competitivePenalties` implements the master spec section 7 table, including
    both players drawing on an accepted invalid Beepy move.
  - `decideCompetitiveEnd`: an empty hand wins; otherwise fewer cards wins, then
    more credit; an exact tie is reported as a fault.
  - Also `firstPlayerForGame` and the match constants.
- `game.ts`: a Beepy action becomes `pending` (phase `awaitingEvaluation`) and is
  resolved by `evaluatePending`. A game that ends before the penalty records
  `PENALTY_NOT_APPLIED`, so a Beepy win that empties its hand while the human
  wrongly challenges applies no human penalty.
- Tests: `m3-e8-e9-competitive.test.ts`, 37 passed. They cover referee judging, all
  four table rows, the atomic both-draw and its waiver, win before penalty,
  fewer-cards and credit tiebreaks, and alternating first players.
- Correction, from the owner's review: the test "an impossible tie inside a real
  resolution returns ENGINE_FAULT and no new state" did not create a tie. It
  produced a decisive 5-4 result and expected success.
  - A tie can't happen on a valid nine-challenge board, because each challenge has
    one solver and nine is odd.
  - The test was replaced by nine real-resolution tests ("credit tiebreak through
    real resolutions"). Each has equal hands; Beepy holds 0 to 8 of the first eight
    challenges, and each test asserts the exact `moreCredit` outcome.
  - The fault branch stays covered by the pure `decideCompetitiveEnd` tests. No
    impossible board was fabricated, and no production code was changed.
- Full verification: build exit 0, `typecheck:tests` exit 0, and `npx vitest run`
  gave 22 files, 1263 passed, 0 failed, 10 todo (vitest start 07:50:41).

### Problems: lost file writes
Several writes did not persist when a turn was interrupted or a change was rejected.
Each was found by checking the disk and then rewritten.
- The first appends of clarification 2a failed with "Path does not exist": the
  revision 2 spec files were missing from `.kiro/specs/game-engine/`. All three
  files were rewritten as revision 2a.
- The first `craft()` helper append was lost. It was re-added with the owner's
  corrections.
- A first `m3-e6-solitaire.test.ts` write was interrupted and never created.
- The first `m3-e6-e7-solitaire.test.ts` (37 passed at 05:32:59) and both earlier
  `series.ts` revisions, with their `types.ts` codes, were not on disk when next
  checked. They were rewritten, and the session tests moved into `m3-series.test.ts`.
- The first fix to the E8-E9 tie test was also lost, so the file still had the
  original faulty test when the owner reviewed it.
- Since then, every change has been followed by a disk check: `Test-Path`, file
  listings with sizes and times, and `Select-String` for key lines.

### Status after E9
- E0-E9 are checked in `tasks.md`. E10-E15 are not started.
- M2 production code, the M2 tests, and `shared-engine/src/index.ts` are unchanged.
  The API-surface lock still expects 69 exports, which is correct because nothing
  new is exported yet.
- Task 16 is still unchecked. The 10 M2 todos are unchanged.
- Lint was not run.

## [2026-11-10] Milestone M3 — E10: match management with real games (verified)

- **What:** No new production code. The match rules were already in `series.ts`
  (verified in the E7 entry) and `competitive.ts`. E10 adds
  `shared-engine/tests/m3-e10-match.test.ts`, which plays whole competitive games
  through `createGameState`, `submitAction` and `evaluatePending`, and feeds the
  real outcomes into `seriesStatus` and `checkCanStartGame`.
- **How the scripted games work:** the intended winner always acts validly and the
  loser always acts invalidly. The human Challenges every Beepy move when the human
  is meant to win, and Accepts every Beepy move when Beepy is. A test-only step limit
  of 2000 guards against a game that never ends. It is not an engine rule.
- **Results:** 11/11 passed (vitest start 07:57:06), and `typecheck:tests` exit 0.
  Covered:
  - 3-0, 3-1 and 3-2 matches, won by each player;
  - no game can start after the match is decided, and a fourth outcome after 3-0
    gives `SERIES_OUTCOMES_EXCESSIVE`;
  - `GAME_IN_PROGRESS` is enforced;
  - the first player alternates across real games (human, Beepy, human, Beepy,
    human);
  - each game gets a different deal from its derived seed;
  - a whole match replays identically from the same seed.
- **Issues:** none.

## [2026-11-10] Milestone M3 — E11: replaceable Beepy strategy (verified)

- **Files:**
  - `shared-engine/src/game/beepy-strategy.ts` (new, 08:00:13):
    - `BeepyStrategy` interface;
    - `beepyStrategyInput`, which shows Beepy only its own hand (handles and faces),
      the open challenge ids, and a read-only judge for its own cards;
    - `createReferenceBeepyStrategy({ errorRate })`, which validates the rate to
      [0, 1].
  - `shared-engine/src/game/game.ts`: new `advanceBeepy`.
  - `shared-engine/src/game/types.ts`: new code `STRATEGY_RESULT_INVALID`.
- **Owner check (can `advanceBeepy` throw on a bad RNG state from a strategy?):**
  - It did not throw. But the first version passed the returned value through
    `toRngState`, which silently turned any non-finite value into 0. That is a
    hidden coercion, not a structured failure.
  - It also read `choice.action` outside the guard, so a result whose getters throw
    could crash the call.
  - Fixed in `game.ts` (08:57:04):
    - the strategy result is read once inside the guard and copied into a plain
      request;
    - a result that isn't an object, has no action, or has a non-string handle or
      challenge id gives `STRATEGY_RESULT_INVALID`;
    - an RNG state that isn't a whole number from 0 to 2^32 - 1 gives
      `STRATEGY_RESULT_INVALID`;
    - a strategy that throws, or a getter that throws, gives `ENGINE_FAULT`.
  - `beepyRng` is stored only after the request is accepted as legal. On every
    failure the original state and all random streams are unchanged.
- **Reference strategy:** with probability `errorRate` it proposes a legal but
  invalid action; otherwise a valid play, or a valid discard if there is no valid
  play. It never proposes an illegal request. The authoritative judge rules on the
  action as usual, so a strategy cannot change a ruling.
- **Tests:** `shared-engine/tests/m3-e11-beepy.test.ts`, 43/43 passed (vitest start
  09:00:55). Covered:
  - error-rate validation;
  - the strategy input exposes no hidden data;
  - the strategy's judge agrees with the authoritative judge;
  - rate 0 is never wrong (single steps over 60 seeds, and 15 whole games);
  - rate 1 is always legal but invalid (single steps only);
  - rate 0.25 gives a plausible mix;
  - only legal requests across whole games at rate 0.3;
  - identical replay of a single step and of a whole game;
  - judging is unchanged by strategy calls;
  - a strategy cannot make a wrong play succeed;
  - nine invalid RNG values (negative, fraction, NaN, Infinity, 2^32, string,
    undefined, object, bigint) each give `STRATEGY_RESULT_INVALID` with the frozen
    state unchanged;
  - the boundary values 0 and 2^32 - 1 are accepted;
  - six malformed results;
  - throwing getters and throwing strategies give `ENGINE_FAULT`;
  - impersonation and unknown handles change nothing.
- **Problem: lost file.** The first write of `m3-e11-beepy.test.ts` (08:0x) did not
  persist after an interrupted turn. The disk check showed the production files
  present and the test file missing, so it was rewritten. Its first run was issued in
  the same batch as the write, so it was re-run on its own to confirm (43 passed at
  09:00:55).
- **Regression:**
  - `npx tsc --build tsconfig.json --force` exit 0;
  - `npm run typecheck:tests` exit 0;
  - `npx vitest run`: 24 files, 1318 passed, 0 failed, 10 todo (vitest start
    09:00:58).
- **Not changed:** M2 production code and tests; package exports (the API lock is
  still at 69).

## [2026-11-10] Milestone M3 — E12: trusted controller, sanitized views, public events and errors (verified)

- **Files:**
  - `shared-engine/src/game/view.ts` (new, 09:02:58): `buildPlayerView` and
    `toPublicEvents`. Both build fresh, plain data field by field. Cards appear only
    as `{ handle, displayValue }`.
    - The opponent's hand and the draw pile are counts only.
    - A pending action shows only player, kind, card and destination.
    - An open challenge shows no `sourceRef`, because a source id could encode the
      answer. It appears once the challenge is solved.
    - A penalty card's face goes only to the player who drew it.
  - `shared-engine/src/game/controller.ts` (new, 09:10:01): `createSeriesController`.
    The authoritative `EngineState`, the finished outcomes and the event list live
    only in a closure. The returned object is frozen and has seven methods: no state
    field, no getter, and no method that returns state, the matrix or the private
    history.
  - `shared-engine/src/game/types.ts` (09:09:22): new code `MALFORMED_REQUEST`.
- **Owner correction 1, privacy of errors:** the first draft copied M2 issue
  messages and paths into public errors. Those can name card ids, challenge ids, or
  which card answers which challenge. Now:
  - `toPublicError` returns only the code and a fixed message from a
    `PUBLIC_MESSAGES` table. The table is typed `Record<EngineErrorCode, string>`,
    so the compiler rejects any code without a message.
  - A setup failure adds only a summary: the issue count, counts per check stage,
    and the distinct stable M2 code constants.
  - Engine messages, including strategy exception text, are never copied.
  - `UNKNOWN_HANDLE` is shown as `CARD_NOT_IN_HAND`, so handles can't be probed.
  - Full diagnostics stay in the trusted layer: an optional `diagnostics` callback
    in the controller config receives the unsanitized engine error, with every M2
    message and path, for developer logging. A sink that throws is ignored and
    doesn't change the result. This optional callback is a small addition within the
    approved controller design; the owner's instruction was to keep diagnostics in
    the trusted layer.
- **Owner correction 2, input validation:** `String(...)` coercion was removed.
  - `readHumanRequest` checks runtime types: the request must be a non-array
    object; `kind` a string equal to "play" or "discard"; `handle` a non-empty
    string; `challengeId` absent or a non-empty string. Otherwise it returns
    `MALFORMED_REQUEST` (or `INVALID_ACTION_KIND` for an unknown kind string).
  - Reading the request is guarded, so a throwing getter returns
    `MALFORMED_REQUEST`.
  - `decide()` accepts only "accept" or "challenge"; `startNextGame()` requires an
    object.
  - Every method runs in a guard, so an unexpected exception returns `ENGINE_FAULT`
    (with a fixed message) and the game is unchanged.
- **Tests:** `shared-engine/tests/m3-e12-controller.test.ts`, 52/52 passed (vitest
  start 09:17:57). The test drives the controller the way a UI would and chooses
  moves from its own copy of the deck. Covered:
  - the controller is frozen, has only methods, and `JSON.stringify` gives `{}`;
  - no `state`, `history`, `deck`, matrix, pile or mapping field appears in any
    result;
  - mutating a returned view has no effect;
  - a whole competitive game of views and events never contains a deck card id;
  - hidden faces and Beepy's faces are absent;
  - pending valid and pending invalid Beepy views have identical shape and no
    validity field;
  - the judgment appears only after resolution;
  - Beepy's penalty card shows as a count, while the human's own penalty card shows
    its face.
  - Privacy: a deck with revealing ids (`SECRET-card-i-IS-ANSWER`,
    `SECRET-challenge-i`), broken three ways (ambiguity, duplicate face, over
    target), gives a public error with no `SECRET`, no issue paths and no face text.
    It has only code, message and summary. The trusted sink does receive the full
    issues with `SECRET`.
  - All 22 public codes return fixed messages even when the engine text contains
    secrets.
  - Malformed requests, 18 cases: null, undefined, number, string, array, missing
    or numeric kind, unknown kind, missing, numeric or empty handle, a handle with a
    throwing `toString`, a symbol handle, an object that only coerces to a real
    handle, numeric, empty or object challengeId, and a throwing getter. Each gives
    a structured failure, no throw, and an unchanged view and event list.
  - A full five-game Solitaire session through the controller, and a competitive
    match to a decision with alternating first players.
  - Identical replay of views and events for the same seed, including interleaved
    failed requests.
- **Mutation probe** (temporary, reverted): two bugs were injected into a backed-up
  copy of `controller.ts` (public message = engine message; handle type check
  disabled). 10 of 52 tests failed. The original was restored, and `Select-String`
  confirmed the original lines and that the backup was removed.
- **Regression:**
  - `npx tsc --build tsconfig.json --force` exit 0;
  - `npm run typecheck:tests` exit 0;
  - `npx vitest run`: 25 files, 1372 passed, 0 failed, 10 todo (vitest start
    09:18:33).
- **Problem: lost file.** The first draft of `controller.ts` (created about 09:03)
  was not on disk after the interrupted turn, while `view.ts` was. It was rewritten
  with both corrections.
- **Not changed:** M2 production code and tests, gameplay rules, and package
  exports (the lock is still at 69; exports come in E14).

## [2026-11-10] Milestone M3 — E13: history and learning events (verified)

- **What:** No production change. The history was already built in `game.ts` and
  `penalty.ts`, and the public projection in `view.ts`. E13 adds
  `shared-engine/tests/m3-e13-history.test.ts`, which plays whole games step by step
  with the pure core for both modes and all four (style, direction) combinations, 5
  seeds each. The human makes deliberate errors and the Beepy reference strategy
  runs at 0.3. A test-only step limit of 2000 guards against a game that never ends.
- **Results:** 53/53 passed (vitest start 09:22:08); `typecheck:tests` exit 0.
  Asserted:
  - After every step, the history equals the previous history plus exactly that
    step's events, in order.
  - Each game starts with `GAME_DEALT` and ends with exactly one `GAME_ENDED`.
  - `TURN_COUNTED` and `ACTION_RESOLVED` are numbered 1..n, and each submitted
    action is resolved once with the same card and destination.
  - `CHALLENGE_SOLVED` matches the final board and carries the deck's `sourceRef`.
  - The per-player learning stats equal the counts derived from `ACTION_RESOLVED`.
  - Replaying the history from the deal reproduces every final zone (hands, pile
    order, discard, played).
  - A real game where Beepy wins by emptying its hand under a Challenge records
    `PENALTY_NOT_APPLIED` then `GAME_ENDED`, with no `PENALTY_DRAWN`. It was found
    by a seed search, and the test fails if none is found.
  - The public projection mirrors the counts of resolutions, solved challenges,
    penalty draws, waivers and the ending, with one `ACTION_PENDING` per Beepy
    action. It contains no deck card ids and no Beepy penalty faces.
  - Validity appears only in `ACTION_RESOLVED` and matches the private ruling.
  - Solved challenges expose their `sourceRef` for later progress tracking.
- **Problem:** the first typecheck failed (TS2551) because the test used
  `Array.prototype.findLastIndex`, which isn't in the project's ES2022 lib. The test
  was changed to `map(...).lastIndexOf(...)`. The compiler configuration was not
  changed.
- **Not changed:** production code, M2 code and tests.

## [2026-11-10] Milestone M3 — E14: public exports, API lock, invariant simulation (verified)

- **Public surface:** `shared-engine/src/index.ts` (09:23:41). This is an additive
  block only; no existing M2 export was changed or removed.
  - New runtime exports (10): `createSeriesController`,
    `createReferenceBeepyStrategy`, `ENGINE_MODES`, `ENGINE_ERROR_CODES`, and the
    pure random helpers `toRngState`, `nextUint32`, `nextFloat`, `nextInt`,
    `shuffle`, `deriveSeed`.
  - New type exports: the controller and view or event types, the strategy types,
    and the public engine types.
  - Deliberately not exported: the pure core (`createGameState`, `submitAction`,
    `evaluatePending`, `advanceBeepy`), `EngineState`, the private history, and the
    view, judge and gate internals. The controller is the runtime privacy boundary.
- **API-surface lock updated, as planned and reported to the owner:**
  `shared-engine/tests/regression-api-surface.test.ts` (09:25:02).
  - The expected runtime exports went from 69 to 79 (69 from M2 plus 10 from M3).
    The exact name list is still asserted, so the lock is no weaker.
  - New tests: the engine-private core names are absent from the package; the
    engine modes are locked (`solitaire`, `vsBeepy` only); all 24 engine error codes
    are locked, unique, and counted.
  - My first draft of the test name said "26" codes. Counting showed 24, and the
    name was corrected before the run, with an explicit length assertion added.
- **Simulation:** `shared-engine/tests/m3-e14-simulation.test.ts` (09:25:39).
  - 40 seeded full games for each mode and each of the four (style, direction)
    combinations, which is 320 games.
  - After every step it asserts the card invariants and that the human's view
    contains no card id, no `correctAnswerCardId`, no face from Beepy's hand or the
    draw pile (except Beepy's pending card), and the right draw-pile count.
  - Agents: the human picks invalid actions with probability 0.35. Beepy is the
    reference strategy at 0.3, and the human's decisions are random.
  - Stall guard: after 3 consecutive turns by an agent with no change in its hand
    size or the solved count, a valid action is forced.
  - The test-only step limit is 2000. It belongs to the harness and is not an
    engine rule.
- **Exhaustion scenarios:**
  - A tiny pile with no fallback (both modes, all combinations, 15 seeds):
    penalties were waived and every game ended.
  - A fallback that gives out after 2 cards: fallback cards entered with no
    explanation and never repeated, then penalties were waived, and every game
    ended. Clinical-style fallback text is placeholder ("Test fallback distractor
    n"), not clinical content.
  - The stall guard was exercised.
- **Non-termination demonstration:** with the guard disabled, an always-invalid
  agent and exhausted penalties ran until the 300-step test limit stopped it
  (asserted). With the guard, the same agent finished. No engine cap was added.
- **Results:**
  - simulation 21/21 passed and the API lock 20/20 passed (vitest start 09:26:29);
  - `npx tsc --build tsconfig.json --force` exit 0;
  - `npm run typecheck:tests` exit 0;
  - `npx vitest run`: 27 files, 1450 passed, 0 failed, 10 todo (vitest start
    09:26:55).
- **Unchanged:** M2 production code and the other M2 tests. The 10 `it.todo` are
  still present (8 in Task 16, 2 in Task 18; counted with `Select-String`).
  Task 16 is still unchecked. The 4 engine-dependent Task 16 todos were NOT
  converted, because that needs owner approval.

## [2026-11-10] Milestone M3 — E15: final verification and milestone close-out (verified)

- **Lint (first run in M3):** `npx eslint shared-engine/src/game` reported 5
  `prefer-const` errors. They were in `beepy-strategy.ts` (2) and `deal.ts` (3),
  all from the `let x; [x, state] = f()` destructuring pattern. I rewrote them as
  `const [x, next] = f(state)` with explicit state threading. The order in which
  the random stream is consumed is unchanged, and no behavior changed. Re-run:
  `npx eslint shared-engine/src/game` exit 0 and `npx eslint
  shared-engine/tests/m3-*.ts` exit 0. Lint was not run on M2 files or on the
  whole repository.
- **Final verification (after the lint edits):**
  - `npx tsc --build tsconfig.json --force` exit 0;
  - `npm run typecheck:tests` exit 0;
  - `npx vitest run`: 27 files, 1460 tests: 1450 passed, 0 failed, 10 todo
    (vitest start 09:29:25). A JSON-reporter run gave the same totals.
- **M3 per-file results (all passed):**

  | File | Tests |
  |---|---|
  | m3-e1-random | 36 (grows with the per-file source scan) |
  | m3-e2-gate | 131 |
  | m3-e3-deal | 43 |
  | m3-e4-judge | 34 |
  | m3-e5-penalty | 17 |
  | m3-e6-e7-solitaire | 32 |
  | m3-series | 28 |
  | m3-e8-e9-competitive | 37 |
  | m3-e10-match | 11 |
  | m3-e11-beepy | 43 |
  | m3-e12-controller | 52 |
  | m3-e13-history | 53 |
  | m3-e14-simulation | 21 |
  | m3-helpers | 10 |

  The M3 total is 548. M2 suites: 902 passed (the original 898 plus 4 new
  API-lock tests) and 10 todo, with every other M2 suite count unchanged.
- **Kiro features used in M3:** specs (requirements, design, tasks, with three
  owner revision rounds), task tracking, steering documents as constraints, agent
  file operations and terminal execution. No hooks were created. Steering was
  unchanged.
- **Production files added in M3 (`shared-engine/src/game/`):** `random.ts`,
  `types.ts`, `deck-gate.ts`, `deal.ts`, `judge.ts`, `penalty.ts`, `solitaire.ts`,
  `competitive.ts`, `series.ts`, `game.ts`, `beepy-strategy.ts`, `view.ts`,
  `controller.ts`. Existing file changed: `shared-engine/src/index.ts` (an
  additive export block).
- **Test files added:** 14 `m3-*.ts` files plus the helper `m3-helpers.ts`.
  Existing test changed: `regression-api-surface.test.ts` (the lock went from 69 to
  79, and M3 locks were added).
- **Not changed:** every M2 production module; every M2 test except the API lock;
  dependencies (none added); Git (not used); `npm audit fix` (not run); the UI, the
  generators, persistence and Tutor (none built).
- **Outstanding:**
  - Task 16 is still unchecked with its 8 todos. 4 of them depend on the game
    engine and could now become real tests, but only with owner approval.
  - The 2 Task 18 loader todos remain.
  - Tutor and its Continue step are deferred (Requirement 13 preserved), and
    `createGame` rejects `tutor`.
  - Controlled repetition, persistence, real generators, the loader and the UI are
    later milestones.
  - The trusted `diagnostics` callback is an addition within the approved
    controller design, recorded in the E12 entry.
- **Outcome:** M3 tasks E0-E15 are complete and verified. No next milestone was
  started.

## [2026-11-11] Milestone M4 (Math deck generator) — specification and G0 approval

- **Objective:** Build the Math deck generator for the M3 engine: real
  second-grade addition decks in both generation directions, the complete
  contextual-validity matrix, and a Math series wrapper on the M3 controller.
- **Spec:** `.kiro/specs/math-deck-generator/` (`requirements.md`, `design.md`,
  `tasks.md`), written on 2026-11-11 and revised twice after owner review.
  - Revision 2 corrections: plan the deck size from the actual eligible pool after
    the challenges are chosen; one-digit sizes differ by direction; only Solitaire
    and Player vs. Beepy are supported (Tutor and vsPlayer give
    `MODE_NOT_SUPPORTED`); minimums come from the M2 planner, not a literal.
  - Revision 3 corrections:
    - The M4-2 ranges are approved for version 1 (sum cap 99, two-digit operands
      10–89, no zero operands), and zero is never a distractor.
    - The `subjectToFact` prompt is "Which addition expression equals 7?".
    - A counting error of mine was corrected: I had written that at least 15
      one-digit expression distractors always remain for a competitive deck. That
      was wrong. The owner's counterexample (targets 6–14 remove 33 of the 45
      pairs, leaving 12, so the deck is 21 cards) was checked with a PowerShell
      count: removable pairs for nine sums range from 15 to 33. The spec now states
      that 24 is a target, not a guarantee, and that tests use independently
      counted pools.
  - An interrupted turn had reverted three spec edits, which were then rewritten
    in full.
- **Approval:** the owner granted final approval of revision 3 and decisions
  M4-1 to M4-10, and authorized G0 to G11 in order.
- **Baseline before G1:** `npx vitest run` gave 1450 passed, 0 failed, 10 todo
  (vitest start 02:36:29).
- **Kiro features used:** specs, task tracking, steering as constraints, agent
  file operations and terminal execution. No hooks.

## [2026-11-11] Milestone M4 — G1: structured generator interface (verified)

- **Approved shared-engine change (M4-1):** `shared-engine/src/generator.ts` gains
  `GenerationIssue`, `GenerationSizing`, `GenerationResult`, and a generic
  `DeckGenerator<TRequest = GenerationRequest>` whose `generate` returns
  `GenerationResult`. `GenerationRequest` is unchanged. `shared-engine/src/index.ts`
  exports the three new types. This is type-only: no runtime export was added or
  removed.
- **Stubs:**
  - `clinical-cards/src/clinical-generator.ts` now returns
    `{ ok: false, issues: [NOT_IMPLEMENTED] }` instead of throwing. No clinical
    content is created.
  - `math-cards/src/math-generator.ts` returns the same failure until G3-G6
    replace it.
- **Two existing tests changed, as a direct consequence of the approved
  behavior:** `clinical-cards/tests/task18-no-runtime-generation.test.ts` and
  `math-cards/tests/task18-penalty-fallback.test.ts` asserted
  `toThrow(/not implemented/)`.
  - They now assert no throw, `ok: false`, at least one issue, and no `deck`
    field. The Clinical test also checks the exact `NOT_IMPLEMENTED` issue for
    `{}`, `null` and `undefined` requests.
  - Each test still checks that no deck can be produced, so neither is weaker.
- **Verification:**
  - `npx tsc --build tsconfig.json --force` exit 0;
  - `npm run typecheck:tests` exit 0;
  - `npx vitest run`: 1450 passed, 0 failed, 10 todo (vitest start 02:38:40). The
    runtime API lock is unchanged at 79.

## [2026-11-11] Milestone M4 — G2: deck-gate export (verified)

- **Approved shared-engine change (M4-6 A):** `shared-engine/src/index.ts` now
  exports `validateDeckForPlay` and its `GateOptions` type. The function is
  unchanged. It reads a deck, a mode, a matrix and options, and returns issues; it
  exposes no game state.
- **API lock** (`shared-engine/tests/regression-api-surface.test.ts`, reported to
  the owner):
  - the runtime exports went from 79 to 80, with an `M4 G2` group added to the
    exact name list;
  - `validateDeckForPlay` was removed from the "engine-private" absence list, with
    a comment explaining why;
  - a new test asserts that the exported function is the same object as the
    engine's internal gate, that it accepts a valid deck, and that it reports
    `CONTEXTUAL_VALIDITY_MISSING`.
- **Verification:**
  - build exit 0; `typecheck:tests` exit 0;
  - the API lock and M3 gate suites: 153 passed (vitest start 02:39:45);
  - full suite: 1452 passed, 0 failed, 10 todo (vitest start 02:39:47). That is 2
    more than G1, from the new export-group check and the gate identity test.
  - The existing M3 gate tests are unchanged and passing.

## [2026-11-11] Milestone M4 — G3: levels and request validation (verified)

- **Production files (new in `math-cards/src/`):**
  - `levels.ts`: the approved version-1 table (`oneDigit` 1–9 + 1–9, cap 18,
    plausible 1–20; `oneAndTwoDigit` 1–9 + 10–89, cap 99, plausible 10–99;
    `twoDigit` 10–89 + 10–89, cap 99, plausible 20–99; `mixed`, plausible 1–99),
    canonical pair enumeration (a ≤ b), and the expression format/parse helpers.
  - `distractors.ts`: the eligible pool and tier ordering. Tested in G5.
  - `math-generator.ts`: rewritten, replacing the G1 stub. Request validation,
    problem choice, assembly, matrix, and self-validation with the exported gate.
    The rest is tested in G4–G7.
  - ESLint on `math-cards/src` exit 0. Build exit 0.
- **Independent oracle:** `math-cards/tests/math-oracle.ts` imports nothing from
  `math-cards/src`. It restates the approved table, enumerates operand pairs with
  its own loops, and reads sums from prompt and card text (owner instruction 5).
- **Tests:** `math-cards/tests/math-g3-levels-and-requests.test.ts`, 52/52 passed
  (vitest start 02:44:57); `typecheck:tests` exit 0. Covered:
  - the level table equals the spec;
  - canonical pairs equal the oracle's enumeration;
  - no sum above 99, no zero operand, no operand 90–99, and every plausible range
    starts at 1 or higher;
  - `tutor` and `vsPlayer` give `MODE_NOT_SUPPORTED`; seven other mode values give
    `INVALID_MODE`;
  - invalid level, direction, seed or target give `INVALID_LEVEL`,
    `INVALID_DIRECTION`, `INVALID_SEED` or `INVALID_COUNT`;
  - every problem is reported together;
  - non-object requests and a throwing getter give `INVALID_REQUEST`, with no throw;
  - no failure carries a deck.

## [2026-11-11] Milestone M4 — G4: challenges and correct cards (verified)

- **What:** No new production file. The challenge choice (`chooseProblems`:
  canonical pairs shuffled with the seed, walked in order, skipping used sums,
  bounded) and the correct-card and id assembly in `math-generator.ts` were
  exercised.
- **Tests:** `math-cards/tests/math-g4-challenges.test.ts`, 51/51 passed (vitest
  start 02:45:59); `typecheck:tests` exit 0. Every expectation is read back from
  deck text with the oracle. It runs both modes × four levels × both directions,
  25 seeds each. Covered:
  - 5 or 9 challenges; distinct sums; in-range canonical operands belonging to the
    level; one distinct designated card per challenge, showing the right sum or
    expression;
  - prompt formats `"a + b = ?"` and `"Which addition expression equals s?"`;
    numeric cards with no leading zero and never 0; canonical expression cards; no
    explanations;
  - ids `c1..cN` and `m1..mK`, with no `penalty-` or `expr-` prefix;
  - `sourceRef` equals `math.subject.sum-s` and `math.topic.sum-s.add-a-b`, and
    passes `isValidId`;
  - c1's sum varies across seeds, and correct cards occupy all 15 card positions
    over 200 seeds, so neither the board order nor the card order reveals anything;
  - `mixed` draws from all three base levels, and from more than one level within
    most decks.

## [2026-11-11] Milestone M4 — G5: eligible pool, size planning, distractors (verified)

- **Production:** `math-cards/src/distractors.ts` (`buildEligiblePool`,
  `selectDistractors`), used by `assembleMathDeck`.
  - The order follows correction 1: the challenges are chosen, then the pool is
    built for exactly those sums, and only then is the M2 planner called with
    `availableDistractors` = the pool size (`planMathCompetitiveDeckSize` for the
    default competitive target, otherwise `planDeckSize`).
  - A failed plan returns the planner's issue and no deck.
- **Tests:** `math-cards/tests/math-g5-pool-and-size.test.ts`, 59/59 passed (vitest
  start 02:47:29); `typecheck:tests` exit 0. Expected sizes come from the oracle's
  pool count for each deck's own challenges, read from prompt text. No test assumes
  24 cards. Covered:
  - For both modes × four levels × both directions × 30 seeds: `eligibleDistractors`
    equals the oracle pool; no correct value is counted as a distractor; the size
    equals challenges + min(target − challenges, pool); `sizing` and `meta` match;
    the size never exceeds the target.
  - Distractors are incorrect for every challenge, unique, never 0, inside the
    plausible range or the level's operand ranges, with no commuted duplicates in
    `subjectToFact`.
  - Tier order: when a higher tier is used, every lower-tier pool member was used
    first (tiers computed by the oracle).
  - One-digit `factToSubject`: the pool is exactly 11, competitive is 20 cards
    (`reduced: true`), and Solitaire is 15.
  - One-digit `subjectToFact` over 300 seeds: pools fall between 12 and 30, and the
    deck is 9 + min(15, pool). I did not tabulate how often each size appeared; the
    test asserts only that every size is between 21 and 24.
  - Fixed cases through the `assembleMathDeck` seam: targets 6–14 give a pool of 12,
    a 21-card deck, and `reduced: true`. Targets {2, 3, 4, 5, 6, 15, 16, 17, 18} give
    a pool of 30 and 24 cards.
  - Solitaire one-digit `subjectToFact` is always 15; the worst five targets, sums
    8–12, leave exactly 24 pairs.
  - Minimums: the test finds the M2 minimum by asking `planDeckSize`, with no
    literal. A target one below it gives `DECK_BELOW_MINIMUM` and no deck; a target
    at the minimum succeeds at that size. Configured targets are ceilings.
- **Note on "a pool too small for the mode":** with the approved v1 levels this
  cannot happen, because the smallest possible pool is 11 (one-digit
  `factToSubject`). The test checks that with the oracle and shows that the M2
  planner accepts 11 and refuses 0. The generator's handling of a planner refusal is
  covered by the below-minimum target test. This is a test-approach note; the spec
  is unchanged.

## [2026-11-11] Milestone M4 — G6: matrix, self-validation, results (verified)

- **Production:** in `assembleMathDeck` (math-generator.ts), each matrix entry is
  computed from the card's own face (its number, or its expression's sum) compared
  with the challenge's sum. It doesn't depend on which card was designated. The
  draft is then checked with the exported `validateDeckForPlay`. Any issue returns
  `{ ok: false, issues }` with no deck. The optional `tamper` parameter is the
  documented test seam.
- **Tests:** `math-cards/tests/math-g6-g7-matrix-and-determinism.test.ts`; 36 of
  its 45 tests are G6 (vitest start 02:48:24).
  - For both modes × four levels × both directions × 40 seeds: the matrix has
    exactly the deck's challenge and card ids; every entry equals the oracle (the
    sum from the prompt text compared with the value from the card text); each
    challenge has exactly one valid card, the designated one; the deck passes
    `validateDeckForPlay`; `numericAnswers` is true only for `factToSubject`;
    `sizing` matches the deck.
  - Four corruptions through the seam, in both directions: a distractor marked
    valid gives `MULTIPLE_VALID_CARDS_FOR_CHALLENGE`; a missing matrix row gives
    `MISSING_VALIDITY_ENTRY`; a duplicated face gives a `DUPLICATE_DISPLAY_*` code;
    a wrong meta count gives `CARD_COUNT_MISMATCH`. Each returns `ok: false` with no
    deck, and the same draft without the corruption succeeds.

## [2026-11-11] Milestone M4 — G7: determinism (verified)

- **Tests:** the remaining 9 of the same file's 45 tests, all passed.
  - The same request gives an identical result for every mode, level and direction
    at three seeds.
  - Different seeds give different decks (at least 39 distinct decks from 40 seeds
    per level and direction).
  - Results don't depend on call order, so there is no hidden module state.
  - A source scan of the 5 files in `math-cards/src/` finds no `Math.random`,
    `Date`, `performance.now` or `crypto`.
- `typecheck:tests` exit 0.

## [2026-11-11] Milestone M4 — G8: expression penalty fallback for subjectToFact (verified)

- **Production (new):** `math-cards/src/expression-fallback.ts`,
  `createMathExpressionFallbackProvider({ level })`.
  - It reads each active challenge's target from the expression on its designated
    card.
  - It offers canonical pairs from the level whose operand pair isn't already in
    the game (in either order) and whose sum matches no active target.
  - Candidates come nearest-first, with ids `expr-a-b`, `plausible: true`, a
    `validForChallenges` entry for every readable target, and no explanation.
  - A challenge whose target can't be read is left unevaluated, so the shared
    check rejects the candidate.
  - An unknown level throws `RangeError`, mirroring the existing numeric provider.
  - `math-cards/src/penalty-fallback.ts` (the numeric provider) is unchanged.
- **Correction during the task:** the first version computed each candidate's
  distance inside the sort comparator. It now computes the distance once per
  candidate before sorting. The order is the same and the 38 tests pass before and
  after; this was done for speed during play.
- **Tests:** `math-cards/tests/math-g8-expression-fallback.test.ts`, 15/15 passed,
  and the existing `task18-penalty-fallback.test.ts`, 23/23 (vitest start
  02:50:36). Build exit 0, `typecheck:tests` exit 0, ESLint on `math-cards/src`
  exit 0. Covered:
  - for each level × 5 seeds, the offered set equals the oracle's set of unused
    canonical pairs whose sum is no target (so it's finite); every candidate is in
    range, has no zero operand and no target sum, is evaluated false for every
    challenge, has an `expr-` id and no explanation;
  - `drawPenaltyCards` accepts 4 fallback draws with all pair keys unique;
  - candidates come nearest-first, with the first at distance 1;
  - the provider is deterministic;
  - a crafted "9 + 2" in the game blocks "2 + 9";
  - an unreadable target leaves its challenge unevaluated, and the shared function
    rejects with 5 `INVALID_VALUE` at `maxCandidates` 5;
  - an unknown level throws `RangeError`.

## [2026-11-11] Milestone M4 — G9: Math series wrapper and engine integration (verified)

- **Production (new):** `math-cards/src/math-series.ts`, `createMathSeries(config)`.
  - It validates its config, reading every field as `unknown`.
    `tutor`/`vsPlayer` give `MODE_NOT_SUPPORTED`. Other problems give
    `INVALID_MODE`, `INVALID_LEVEL`, `INVALID_DIRECTION`, `INVALID_SEED`,
    `INVALID_OPTION` (Beepy rate outside [0, 1], or `solitaireDeckSize` invalid or
    given for vsBeepy), or `INVALID_CONFIG`.
  - It builds the M3 controller:
    - `numericAnswers` follows the direction;
    - the fallback is the numeric provider over the level's plausible range
      (`factToSubject`) or the expression provider (`subjectToFact`);
    - the reference Beepy strategy runs at the configured rate, default 0.2
      (M4-10);
    - the trusted diagnostics callback is passed through.
  - `startNextGame()` takes the next game index from the controller, derives the
    generator seed with `deriveGeneratorSeed(seriesSeed, gameIndex)` (M4-8, via the
    exported `nextUint32`, no M3 change), generates, and passes the deck and matrix
    to `controller.startNextGame` inside the closure.
  - A generator failure returns the fixed public error `MATH_GENERATION_FAILED`,
    and the full issues go only to `diagnostics`. Other methods pass straight
    through.
  - The object is frozen and has methods only.
  - The first draft did not type-check (TS2367: comparing the typed `mode` with
    `'tutor'`). Fixed by reading the config fields as `unknown`. Build exit 0 and
    ESLint exit 0 after the fix.
- **Tests, part 1:** `math-cards/tests/math-g9-engine-integration.test.ts`, 34
  passed.
  - Generated decks start M3 games for both modes × four levels × both directions ×
    30 seeds, with valid dealt hands and every M3 invariant checked.
  - 6 whole games per combination are played with the M3 pure core, checking
    `expectInvariants` after every step (uniqueness across all zones, conservation,
    one answer per challenge, handles), with a test-only step limit of 3000.
  - With the wrapper's fallback configuration, fallback cards are drawn in both
    directions under those invariants.
- **Tests, part 2:** `math-cards/tests/math-g9-series.test.ts`, 50 passed. The agent
  sees only views and events and chooses moves by doing the arithmetic on the
  visible text. Covered:
  - Seven full series (Solitaire and vsBeepy, all levels, both directions)
    complete: 5 Solitaire games with session score = sum of game scores, or a
    decided match of 3 to 5 games. A further game is refused with
    `SERIES_COMPLETE`.
  - Approved prompt formats; challenge ids `c<n>`; all visible faces unique.
  - No `"m<k>"` card id, `correctAnswerCardId`, matrix, `deck`, `answerCards` or
    `drawPile` field, series seed, or derived generator seed appears in any view,
    event or status.
  - `sourceRef` is hidden while a challenge is open and shown once it is solved.
  - Penalties continue after the pile is empty in both directions.
  - Each game gets a different deck; generator seeds are distinct and
    deterministic; a whole vsBeepy series replays identically.
  - Beepy rate 0 is never wrong, the default 0.2 makes occasional mistakes (fewer
    than 45%), and rate 1 is wrong on the first move.
  - Config errors; a null config doesn't throw.
  - The generation failure path, using `solitaireDeckSize: 3`, below the M2
    minimum: the fixed public error, with `DECK_BELOW_MINIMUM` only in diagnostics
    and no game started. A throwing diagnostics sink changes nothing.
  - The object is frozen, has methods only, and `JSON.stringify` gives `{}`.
- **Failure and correction:** the first run of part 2 had 2 failures out of 84
  (vitest start 02:55:53), both in "penalties are still drawn after the pile is
  empty".
  - Cause: a test-design defect. With a mistake every second step, Solitaire games
    finished before the 10-card pile emptied, so no draw happened on an empty pile.
  - Fix, in the test only: the agent errs on three steps in four, uses `twoDigit`
    (where a large fallback pool is available), and the test now also asserts that
    the pile reached zero, so it can't pass vacuously. The play helpers now take a
    `wrongAt(step)` function; all other tests keep their earlier mistake patterns.
  - No production code changed. Re-run: 84/84 passed (vitest start 02:56:32);
    `typecheck:tests` exit 0.

## [2026-11-11] Milestone M4 — G10: Task 16 Math-generator todos converted (verified)

- **Change (M4-9):** in `shared-engine/tests/task16-direction-and-context.test.ts`,
  the two Math `it.todo` ("Math generator: factToSubject / subjectToFact produces a
  valid deck") are now one parameterized real test.
  - It generates decks for both modes × four levels × 5 seeds per direction, and
    checks each with `validateChallengeMapping`, `validateUniqueness`,
    `validateDeckSize` and the M3 gate `validateDeckForPlay`.
  - The test imports `generateMathDeck` from `../../math-cards/src`. This import is
    test-only; production code still depends only one way (the apps on the engine).
- **Untouched:** the two Clinical-generator todos, the four engine-judging todos,
  and the two Task 18 loader todos. Task 16 stays unchecked. A dated factual note
  was added to Task 16 in `.kiro/specs/educational-data-schema/tasks.md`, because
  its earlier text counted 8 todos.
- **Verification:** `typecheck:tests` exit 0. The Task 16 file has 49 passed and 6
  todo (previously 47 passed and 8 todo). `Select-String` counts 8 `it.todo` across
  the Task 16 and Task 18 files (6 + 2).

## [2026-11-11] Milestone M4 — G11: final verification and close-out (verified)

- **ESLint** on every new and changed file (`math-cards/src`, `math-cards/tests`,
  the Clinical stub and its test, `shared-engine/src/generator.ts` and `index.ts`,
  the API lock test, and the Task 16 test):
  - The first run reported 1 error: `_request` unused in
    `clinical-cards/src/clinical-generator.ts`. That parameter came from the M2
    stub, which was never linted before.
  - My first fix removed the parameter, but `typecheck:tests` then failed with
    TS2554, because the Clinical test calls `generate(request)` on the class. I
    reverted that.
  - Final fix: keep `generate(request: GenerationRequest)` and mark the parameter
    deliberately unused with `void request`. Behavior is unchanged.
  - ESLint exit 0.
- **Final checks (after the lint fix):**
  - `npx tsc --build tsconfig.json --force` exit 0;
  - `npm run typecheck:tests` exit 0;
  - `npx vitest run` (JSON reporter): 34 test files, 1770 tests: **1762 passed, 0
    failed, 8 todo**. Reconciliation: 1450 baseline + 2 (G2) + 2 (Task 16
    conversions) + 308 new M4 tests = 1762.
  - `math-g6-g7` reports 47 here, against 45 at G7, because its per-file source
    scan now covers the 6 files in `math-cards/src` (`expression-fallback.ts` and
    `math-series.ts` were added in G8 and G9).
- **M4 test files (all passed):** math-g3 52, math-g4 51, math-g5 59, math-g6-g7 47,
  math-g8 15, math-g9 engine integration 34, math-g9 series 50. That is 308 tests.
- **Changed-file audit (by `LastWriteTime` after the 02:36 baseline):**
  - `shared-engine/src`: only `generator.ts` (M4-1) and `index.ts` (M4-1 types and
    the M4-6 export).
  - `math-cards/src`: `levels.ts`, `distractors.ts`, `math-generator.ts`,
    `expression-fallback.ts`, `math-series.ts`.
  - `clinical-cards/src`: `clinical-generator.ts`.
  - `deck-size.ts`, `penalty-fallback.ts` and every `shared-engine/src/game/*`
    module are unchanged.
  - Tests changed: the two stub tests (G1), the API lock (G2) and Task 16 (G10).
  - Docs: the three M4 spec files, a dated note on Task 16 in the M2 tasks.md, and
    this log.
- **Not done, as instructed:** no browser UI, no dependencies, no Git, no
  `npm audit fix`, and no Tutor or vsPlayer. M5 was not started.
- **Remaining deferred tests (8 `it.todo`):** Task 16 still has 2 Clinical-generator
  and 4 engine-judging todos; Task 18 still has 2 loader todos. Task 16 stays
  unchecked.
- **Outcome:** M4 tasks G0–G11 are complete and verified.

## [2026-11-11] Milestone M5 (Math Cards browser interface) — specification and U0 approval

- **Objective:** a modern, playable Beepy Math Cards browser app over
  `createMathSeries`, with Solitaire and Player vs. Beepy, all levels, both
  question styles.
- **Spec:** `.kiro/specs/math-cards-ui/` (`requirements.md`, `design.md`,
  `tasks.md`), written on 2026-11-11 and approved by the owner without revision,
  together with decisions U-1 to U-11 as recommended.
- **Staged authorization:** U0–U6 only, ending at the first playable Solitaire
  version. U7 and later need separate approval. The owner runs the browser smoke
  test personally, so U6's browser check stays pending until the owner reports it.
- **Baseline before U1:** `npx vitest run` gave 1762 passed, 0 failed, 8 todo
  (vitest start 03:33:40).
- **Kiro features used:** specs, task tracking, steering as constraints, agent
  file operations and terminal execution. No hooks.

## Evidence summary for the Devpost write-up: lost and reverted edits (M1–M4)

The owner asked for a record of a recurring workflow problem. The facts below
restate entries already in this log. **The technical cause has not been
verified;** only the symptoms and the recovery steps were observed.

- **Symptom:** a file write or edit reported by the agent was not on disk later.
  Cases fell into three groups:
  1. pending edits were reverted while awaiting the owner's approval in the Kiro
     interface (M2 Tasks 2a, 4, 6, 7, and 11; Task 11 twice);
  2. writes from a turn that was interrupted or ended with "This tool was
     interrupted before it reported a result" were missing (M3: the revision 2
     spec files, the `craft()` helper, a Solitaire test file, `series.ts` twice,
     the E8–E9 tie-test fix, `m3-e11-beepy.test.ts`, the first `controller.ts`;
     M4: three spec edits);
  3. in a few cases the tool reported success, yet a later check found the
     earlier content (for example `index.ts` comments in M2).
- **Impact:**
  - Work had to be redone.
  - Once, a fix was assumed applied but was missing. The owner's review of the
    E8–E9 competitive test found the original faulty test still there.
  - Several times a test was run in the same batch as the write it depended on,
    so the result could not be trusted until it was re-run on its own.
- **Recovery used each time:**
  - check the disk (`Test-Path`, file listings with size and `LastWriteTime`,
    `Select-String` for a key line);
  - rewrite the missing content in full rather than patching;
  - re-run the affected checks;
  - record the event here.
- **Revised workflow (in use since M3):**
  - after any interruption, check the disk before continuing;
  - re-read files that a review depends on;
  - never run a test in the same batch as the write it depends on;
  - prefer whole-file writes for recovery;
  - confirm key lines with `Select-String`;
  - record each lost or reverted edit in that task's log entry;
  - for M5 this continues, and each task entry states whether a disk check found
    anything missing.

## [2026-11-11] Milestone M5 — U1: app shell and build plumbing (verified)

- **Files:**
  - New: `math-cards/index.html` (page shell, `#app`, a stylesheet link and the
    module script, both as relative paths `./src/ui/...`; the design showed `/src/ui/`,
    and I used relative paths so the page also works from a subfolder);
    `math-cards/src/ui/main.ts` (placeholder mount that imports `../math-series.js`
    to prove resolution); `math-cards/src/ui/styles.css` (base).
  - Changed: `math-cards/package.json` scripts (`build: vite build --outDir web-dist
    --base ./ --emptyOutDir`, `preview: vite preview --outDir web-dist`; U-6);
    `.gitignore` (`web-dist/`).
- **Checks (observed):**
  - `npx tsc --build tsconfig.json --force` exit 0;
  - `npm run build -w math-cards`: Vite 5.4.21, 38 modules transformed, exit 0;
    `web-dist/index.html` references `./assets/...` (relative). The design's open
    risk is closed: `@beepy/shared-engine` resolves from its TypeScript source
    through the workspace link, with no Vite config file;
  - ESLint on `math-cards/src/ui` exit 0;
  - `npx vitest run`: 1762 passed, 0 failed, 8 todo (vitest start 03:35:39),
    unchanged.
- **Disk check:** all U1 files are present; nothing was missing.

## [2026-11-11] Milestone M5 — U2: screen flow and labels (verified)

- **Files (new):**
  - `math-cards/src/ui/app-state.ts`: a pure `transition(state, intent)` over the
    screens menu → setup → playing → gameOver / seriesOver;
    - `seriesNumber` increases on `start` and `playAgain`, but not on `nextGame`;
    - settings are validated by `readSettings`;
    - menu lists `MENU_MODES` (solitaire, vsBeepy), `MENU_LEVELS` and `MENU_STYLES`;
    - defaults are small numbers / solve the problem (U-8).
  - `math-cards/src/ui/labels.ts`: fixed child-friendly text for modes, levels
    (U-8), styles, players and end reasons. `friendlyError(code)` is backed by two
    tables typed `Record<EngineErrorCode, string>` and `Record<MathSeriesCode,
    string>`, so the compiler rejects any missing code. Unknown codes get generic
    text. Engine messages are never shown.
  - `math-cards/tests/ui-u2-app-state-and-labels.test.ts`.
- **Tests:** 30/30 passed (vitest start 03:39:16). Covered:
  - the menu has no Tutor or vsPlayer;
  - the levels and styles equal the generator's and engine's constants;
  - every valid transition;
  - invalid `chooseMode` and `start` values are ignored;
  - a full matrix of 5 screens × 8 intents: non-applicable intents return the same
    object, applicable ones change it;
  - an unknown intent is ignored;
  - the label tables cover exactly every public engine code (24) and Math series
    code (9);
  - unknown codes, including `toString`, get generic text.
- **Checks:** build exit 0, `typecheck:tests` exit 0, ESLint exit 0.
- **Disk check:** files present; nothing missing.

## [2026-11-11] Milestone M5 — U3: board model and feedback (verified)

- **Files (new):**
  - `math-cards/src/ui/board-model.ts`: `toBoardModel(view, uiState)` turns the
    view into plain render data: header, challenges, hand, discard, Beepy, pending,
    outcome, and series totals.
    - It never pre-judges: with a card selected, every open challenge and the
      discard pile are targets.
    - It never scores: Solitaire numbers come only from the outcome and series
      status; competitive credit is a display tally of `solvedBy`.
    - The pending panel holds only the card face and destination.
  - `math-cards/src/ui/feedback.ts`: `toFeedback(events)` maps one step's events
    through a fixed `FEEDBACK_TEXT` table (decision U-3). Drawn, waived and
    not-applied penalties each have their own message, and a "drew" line is
    emitted only per real `PENALTY_DRAWN` event, with its count. The ending comes
    from `GAME_ENDED.outcome`. During coding I also added an ending message ("Game
    over! Your score is N." / "You win this game!" / "Beepy wins this game.")
    because the live region needs to announce the end. The design table listed it
    as "from the outcome", which this follows.
  - `math-cards/tests/ui-helpers.ts`: a test player that chooses moves by doing the
    arithmetic on visible text with the independent oracle.
  - `math-cards/tests/ui-u3-board-model-and-feedback.test.ts`.
- **Tests:** 23/23 passed (vitest start 03:50:49). All views and events are real,
  produced by `createMathSeries`. Covered:
  - Solitaire and vsBeepy models;
  - engine order of the hand;
  - the same target flags for every selected card;
  - busy and invalid selections ignored;
  - solved state; wide expression cards; new-card highlight;
  - outcome and session totals equal the engine values;
  - Beepy count and thinking; the pending panel only in `awaitingEvaluation`;
  - **non-leak:** for 6 seeds, the models for a pending valid and a pending invalid
    Beepy move (error rate 0 vs 1, same seed) are identical except the card face
    and destination, and contain no right/wrong words;
  - whole games: models contain no deck ids or source refs, only view faces and
    prompts;
  - feedback for start, valid play and discard, invalid action plus exactly 1 drawn
    card, waived (shown as waived, never as drawn, hand unchanged), all four Beepy
    decision rows, not applied (found deterministically: Beepy at rate 0 while the
    human always challenges), and the Solitaire ending score;
  - over 3 whole vsBeepy games, every "drew", waived and not-applied line matches
    the events exactly; the fixed table contains no digits and no
    explanation-style wording.
- **Error and correction:** the first `typecheck:tests` failed with TS2379
  (`exactOptionalPropertyTypes`: a possibly-undefined `selectedHandle` in a test).
  Fixed in the test only. Re-run: exit 0.
- **Checks:** build exit 0, ESLint exit 0.
- **Disk check:** all files present; nothing missing.

## [2026-11-11] Milestone M5 — U4: session orchestrator and seed source (verified)

- **Files (new):**
  - `math-cards/src/ui/session.ts`: `createGameSession({ settings, seed,
    scheduler, onChange, diagnostics })`.
    - It is the only UI module that calls `createMathSeries`. It owns one series
      plus the transient UI state (selection, Beepy thinking, latest view,
      feedback, friendly error).
    - Intents: `select`, `cancel`, `playOn`, `discard`, `accept`, `challenge`,
      `nextGame`, `leave`. It forwards choices and never judges.
    - After any step that leaves Beepy to act, it marks Beepy as thinking and
      schedules `advanceBeepy()` after `BEEPY_THINK_MS` = 1000 through an injected
      `Scheduler` (`browserScheduler` wraps `setTimeout`) (decision U-4).
    - `leave()` cancels the timer and makes the session inert.
    - Intents are ignored while busy; selection is cleared after every successful
      action.
    - Engine refusals become friendly text and leave the game unchanged.
  - `math-cards/src/ui/seed.ts`: `newSeriesSeed()` via
    `crypto.getRandomValues`. It is the only browser random source (U-5).
  - `math-cards/tests/ui-u4-session.test.ts`.
- **Tests:** 29/29 passed (vitest start 03:55:00). A manual scheduler makes Beepy
  deterministic, and the simulated child chooses moves only from the board model,
  doing the arithmetic itself. Covered:
  - game 1 is dealt with the start message;
  - bad settings return friendly text;
  - the seed is a 32-bit integer;
  - select toggles, cancel works, and unknown handles are ignored;
  - play and discard without a selection send nothing;
  - a correct play solves the problem and clears the selection;
  - a wrong move keeps the card, draws 1, highlights the new card, and shows both
    messages;
  - repeat clicks send one request;
  - playing on a just-solved problem shows "That problem is already solved." with
    the view unchanged;
  - Beepy thinks (label, the human disabled, one 1000 ms task), then acts into the
    pending phase;
  - the human can't select while Beepy thinks or a decision is pending;
  - Accept and Challenge work only while pending;
  - `leave()` cancels the task, and later intents cause no change notifications;
  - **16 full simulated series**, both modes × 4 levels × 2 styles, completing
    through the session with a test-only step limit of 3000: Solitaire plays 5
    games with session total = sum of game scores; vsBeepy plays 3 to 5 games until
    a player has 3 wins. `nextGame` after the series is complete changes nothing.
- **Checks:** build exit 0, `typecheck:tests` exit 0, ESLint exit 0.
- **Errors and corrections:** none at run time. An unused constant was removed
  before the first build.
- **Disk check:** files present; nothing missing.

## [2026-11-11] Milestone M5 — U5: menu, setup, and app wiring (verified by automated checks)

- **Files (new):**
  - `math-cards/src/ui/render/dom.ts`: an `h()` element helper (text through
    `textContent`, attributes through `setAttribute`, never `innerHTML`) and
    focus-key helpers.
  - `math-cards/src/ui/render/menu.ts`: the main menu (two mode cards) and setup
    (radio cards for the four levels and the two question styles, defaults per
    U-8, Back and "Let's play!").
  - `math-cards/src/ui/app.ts`: `mountApp(root, options)`. It holds the screen
    state, the current session and the setup choices, and redraws after every
    change.
    - One persistent, visually hidden `aria-live="polite"` region announces each
      step's feedback.
    - Focus is kept across redraws with `data-focus` keys, and Escape cancels a
      selection.
    - Leaving a game in progress asks for confirmation through an injected
      `confirm` (U-11; the browser uses `window.confirm`).
  - `math-cards/src/ui/main.ts` was rewritten from the U1 placeholder. It mounts
    the app with `browserScheduler`, `newSeriesSeed` and `confirm`, and in
    development builds only, a `console.debug` diagnostics callback (U-5).
- **Staging decision inside approved scope:** the menu shows "Play vs Beepy" as a
  disabled "Coming soon" card (`AVAILABLE_MODES = ['solitaire']` in `app.ts`),
  because its board and Accept/Challenge controls belong to U7, which isn't
  authorized yet. U7 will enable it.
- **Built together with U6.** `app.ts` and `main.ts` wire both the menu and the
  board, so U5 and U6 code were verified in the same check runs (see U6).
- **Checks (observed):** build exit 0; `typecheck:tests` exit 0; ESLint on
  `math-cards/src/ui` exit 0; `npm run build -w math-cards`: 48 modules, exit 0.
- **Not observed:** what the menu and setup look like in a browser. That is
  pending the owner's check.

## [2026-11-11] Milestone M5 — U6: Solitaire board, click/tap and keyboard (automated checks passed; browser smoke test AWAITING owner)

- **Files:**
  - New: `math-cards/src/ui/render/board.ts`, `renderBoard`:
    - a header (game "1 of 5", turns, cards in hand, session total, Menu);
    - five problem tiles (numbered, prompt exactly as the engine gives it, solved
      tiles with a ✓ and the played card);
    - the draw-pile count and a discard-pile button;
    - a feedback banner (icon plus a word, never color alone);
    - a selection bar ("Now tap a problem to play 7, or tap Discard." with Cancel);
    - the hand as `<button aria-pressed>` cards (expression cards wider; new penalty
      cards highlighted);
    - a results panel when a game ends (the outcome lines from the engine, the
      session total, Next game, or after game 5 the five scores and "Play a new
      set", and Main menu). U8 will finish the results screens (including vs Beepy)
      and refine the quit confirmation.
  - Changed: `math-cards/src/ui/styles.css` (full visual design: soft gradient,
    rounded cards, system fonts, large numerals, dashed outlines on valid drop
    targets once a card is selected, responsive rules for 1024 and 768 px,
    `prefers-reduced-motion` turns off animation).
- **Interaction:**
  - Tap or click a card to select it, then a problem or Discard. Tapping the card
    again, Escape, or Cancel clears the selection.
  - Problems and Discard are enabled only once a card is selected, and then all
    open problems are enabled. Every card enables the same targets, so nothing is
    pre-judged.
  - Keyboard: everything is a real button (Tab, Enter or Space, Escape).
  - Drag-and-drop is U10.
- **Checks (observed):**
  - `npx tsc --build tsconfig.json --force` exit 0;
  - `npm run typecheck:tests` exit 0;
  - ESLint on `math-cards/src` and `math-cards/tests` exit 0;
  - `npm run build -w math-cards`: 48 modules, `web-dist/` (index.html 0.60 kB,
    CSS 10.34 kB, JS 78.72 kB), exit 0;
  - a text search of the production bundle found no diagnostics string, no
    `Math.random` and no `innerHTML`; `getRandomValues` is present, from `seed.ts`;
  - `npx vitest run`: 1844 passed, 0 failed, 8 todo (vitest start 05:22:38), which
    is 1762 + 30 (U2) + 23 (U3) + 29 (U4);
  - dev-server HTTP checks (not a browser):
    - `npx vite --port 5199` in `math-cards/` served `/`, `/src/ui/main.ts`,
      `/src/ui/app.ts` and the shared-engine source through `/@fs/`, all HTTP 200;
    - `npm run dev -w math-cards` served `http://localhost:5173/` with HTTP 200.
      The server listened on `::1` only: `127.0.0.1:5173` refused the connection
      and `[::1]:5173` returned 200;
    - one earlier request right after start-up failed to connect, and a retry
      after a longer wait succeeded.
- **Problems and corrections:**
  - My first dev-server attempt, `npm run dev -w math-cards -- --port 5199
    --strictPort`, passed `5199` to Vite as the root folder (npm printed "Unknown
    cli config" warnings), so Vite found no entry. I stopped it and ran Vite
    directly from `math-cards/`.
  - The `nextGame` handler first changed screens before dealing. I reordered it
    before the first build, so it now deals first and changes screen only if the
    new game started.
- **Not observed, so U6 stays unchecked:** the owner-operated Solitaire browser
  smoke test. No claim is made that the game looks or plays correctly in a
  browser.
- **Workflow evidence (Devpost):** the disk check after U6 found every UI file
  present. File times show a gap of about 80 minutes between `render/menu.ts`
  (03:56:19) and `render/board.ts` (05:18:27), which were written in consecutive
  steps. I don't know the cause and record only the timestamps. No file was found
  missing or reverted in M5 so far.

## [2026-11-11] Milestone M5 — U6 owner browser smoke test (owner-observed; recorded as reported)

- **Who and where:** the owner, in Chrome, on the local dev server. Kiro did not
  observe the browser; everything below is the owner's report.
- **Result: PASSED for the tested Solitaire functionality.** Verified by the owner:
  - correct plays and invalid plays;
  - valid and invalid discards;
  - penalty-card draws;
  - the Math penalty fallback after the draw pile reached zero;
  - both question styles;
  - the empty-hand ending;
  - game scoring and five-game session scoring, including a complete five-game
    session with scores 9, 5, 5, 5, 5 and a total of 29;
  - Next game, new session, and the Menu confirmation and its cancellation.
- **No gameplay defects observed.**
- **Not tested, so not claimed:** keyboard-only navigation, narrow-screen layouts,
  touch interaction, and the final penalty-waiver message. They stay with their
  verification tasks (U9 and U12).
- **U6 checked off** on the owner's verified smoke test.
- **Two UI improvements approved for U9:**
  1. In `subjectToFact`, show only the target number on each challenge, keeping a
     descriptive accessible label, with no change to challenge data or judging.
  2. Make a newly drawn penalty card visible or easy to find in a large hand. In
     the test, extra cards appeared below the visible screen, so it looked as if no
     card had been drawn. Keep the layout and avoid auto-scrolling the page away
     from the board.
  Both were recorded in `tasks.md` under U9.
- **Authorization:** U7 and U8 only. Stop after U8 for the owner's Player vs.
  Beepy browser test.

## [2026-11-11] Milestone M5 — U7: Player vs. Beepy board, Beepy's turns, Accept/Challenge (automated checks passed; Chrome match test AWAITING owner)

- **Files changed:**
  - `math-cards/src/ui/render/board.ts`, rewritten in full. It adds:
    - a Beepy bar: a simple CSS placeholder Beepy (the original artwork is U9),
      Beepy's card count, face-down card backs (up to 10, then "+n"), and "Beepy is
      thinking…";
    - nine shared problems in rows of 5 + 4 (3 per row below 768 px);
    - solver badges ("You" / "Beepy") on solved problems;
    - a vs Beepy header (game, match score, problems solved by each, turns);
    - a decision panel showing only Beepy's card and destination ("Beepy wants to
      play 14 on problem 4: …" or "Beepy wants to discard 14"), "Is Beepy right?",
      and Accept and Challenge with identical styling (`btn btn--decision`).
  - `math-cards/src/ui/board-model.ts`: `PendingModel.isDiscard` comes from the
    pending view's `kind`, which is public as part of the destination.
  - `math-cards/src/ui/app.ts`:
    - `AVAILABLE_MODES` now includes `vsBeepy`;
    - `accept` and `challenge` handlers;
    - when a Beepy decision appears, focus moves to the panel heading
      (`tabindex="-1"`), never to Accept or Challenge;
    - after a decision, focus returns to the first card.
  - `math-cards/src/ui/styles.css`: Beepy bar, card backs, the nine-problem layout,
    solver badges, the decision panel, identical decision buttons, and narrow-screen
    rules.
  - `math-cards/tests/ui-u3-board-model-and-feedback.test.ts`: the U3 non-leak
    comparison now also ignores `isDiscard` alongside the face and destination it
    already ignored, because play vs discard is part of the public destination. No
    assertion was loosened beyond that.
- **No engine change.** Beepy's turns still go through `advanceBeepy()` after the
  1000 ms think delay (U4). The §7 table, win-before-penalty and the tiebreaks
  remain entirely the engine's.
- **Tests (new):** `math-cards/tests/ui-u7-u8-competitive.test.ts`, 11 tests, of
  which these are U7:
  - both modes are available;
  - over 40 seeds at Beepy rate 0.5, the panel describes plays and discards exactly
    from the view (both kinds occurred);
  - Beepy moves first in game 2;
  - over 12 decisions (6 seeds, right and wrong judgments), a correct human
    judgment gets a good message and a wrong one an oops message;
  - decisions are ignored while Beepy is thinking;
  - a source guard: exactly two `btn btn--decision` buttons and no `autofocus`.
- **Not observed:** how Player vs. Beepy looks and plays in a browser. That is
  pending the owner's test.

## [2026-11-11] Milestone M5 — U8: results and series screens (verified by the listed checks)

- **Files changed:**
  - `math-cards/src/ui/session.ts`: `completedOutcomes`, each finished game's
    outcome exactly as the engine gave it, recorded once when the game ends.
  - `math-cards/src/ui/board-model.ts`: a `MatchModel` built from the series status
    and `completedOutcomes`: score line "Match: You 2 – Beepy 1 (first to 3 wins)",
    decided flag, winner, and per-game winner and reason. It recomputes nothing.
  - `math-cards/src/ui/labels.ts`: competitive reasons reworded so they read for
    either player ("played every card", "had fewer cards left", "solved more
    problems").
  - `math-cards/src/ui/render/board.ts`: the results panel.
    - Competitive game over: "You win!" / "Beepy wins!", the reason, cards left,
      problems solved, the match score, Next game.
    - Match over: "You won the match!" / "Beepy won the match!", every game's
      result, "Play a new match", Main menu.
    - The Solitaire session summary from U6 is unchanged.
  - The quit confirmation (U-11) is the U5 `confirm` prompt; no change.
- **Tests:** the U8 part of `ui-u7-u8-competitive.test.ts`. Covered:
  - Two whole matches through the session (`factToSubject` and `subjectToFact`):
    3 to 5 outcomes with one player reaching 3; the model's score line, winner and
    per-game winners equal the engine outcomes; the header's match score equals the
    series status at every step.
  - Each finished game is recorded once.
  - A Solitaire session records its 5 outcomes, and their scores equal the series
    scores.
  - Result lines are correct for all three competitive end reasons and both
    winners. This uses the public view shape with a substituted outcome, because the
    fewer-cards and more-credit endings are rare in seeded play.
- **Checks (observed, after U7 and U8 together):**
  - `npx tsc --build tsconfig.json --force` exit 0;
  - `npm run typecheck:tests` exit 0;
  - ESLint on `math-cards/src` and `math-cards/tests` exit 0;
  - `npm run build -w math-cards` exit 0 (CSS 13.50 kB, JS 82.63 kB); the bundle has
    no diagnostics string, `Math.random` or `innerHTML`;
  - `npx vitest run`: 1855 passed, 0 failed, 8 todo (vitest start 07:34:28), which
    is 1844 + 11;
  - `npm run dev -w math-cards`: `/`, `/src/ui/main.ts`, `/src/ui/render/board.ts`
    and `/src/ui/styles.css` returned HTTP 200 on `localhost:5173`.
- **Disk check:** all UI files present with U7/U8 timestamps; nothing missing.
- **Stopped after U8, as instructed.** U9 and later are not started; the two
  approved U9 improvements are recorded only.

## [2026-11-11] Milestone M5 — U7/U8 owner browser test (owner-observed; recorded as reported)

- **Who and where:** the owner, in Chrome, on the local dev server. Kiro did not
  observe the browser; everything below is the owner's report.
- **Result: PASSED for the tested functionality.** A complete competitive match was
  played; Beepy won three games, so the match ended You 0 – Beepy 3. The owner
  verified:
  - nine shared problems and five starting cards per player, with the correct
    starting-hand composition;
  - alternating first player: the human in Game 1, Beepy in Game 2;
  - correct human plays and valid discards;
  - Beepy's correct plays and valid discards;
  - all four Accept/Challenge outcomes: correct move + Accept; correct move +
    Challenge (human penalty); incorrect move + Challenge (Beepy penalty); incorrect
    move + Accept (both penalized);
  - correctly credited problems and the player-specific colors;
  - the first-to-empty-hand win, including a game Beepy won despite solving fewer
    problems;
  - correct game results and cumulative match scoring;
  - the match ending immediately at Beepy's third win, and the final results
    listing all three games;
  - Play a new match and Main menu.
- **No gameplay defects observed.** U7 and U8 checked off.
- **Still not tested, so not claimed:** keyboard-only navigation, touch
  interaction, narrow-screen behavior, and the final penalty-waiver message.
- **Owner feedback for U9:** the competitive desktop screen is unnecessarily tall,
  with unused space at the sides. Use horizontal space better and keep the style.
  Recorded in `tasks.md` under U9, together with the earlier two improvements and
  the Beepy artwork.
- **Future design item (documented only, not implemented):** educational rewards,
  meaning recognition for correct answers and for the player who solves more
  problems (for example "Top Problem Solver"), separate from winning and with no
  rule, scoring, or engine change. Recorded at the end of the M5 `tasks.md`.
- **Authorization:** U9 only.

## [2026-11-11] Milestone M5 — U9: visual polish, owner refinements A–D (automated checks passed; Chrome visual review AWAITING owner)

- **A. Number-only targets ("Find the matching addition"):**
  - `board-model.ts`: `promptDisplay(prompt)` matches only the engine's approved
    prompt "Which addition expression equals N?" and returns `N` for the tile.
    `ChallengeModel` adds `display` and `targetOnly`; `prompt` stays the engine text,
    and the accessible label still reads the full prompt.
  - The challenge data, matching and uniqueness are untouched. This is display
    formatting of public prompt text.
  - In that mode a one-line instruction appears above the problems ("Find an
    addition card that makes each number.").
  - Beepy's move panel shows a short destination ("on problem 4 (10)"); the full
    label is kept in the model.
- **B. Newly drawn penalty card:** `BoardModel.newCards` lists the cards just
  drawn, taken from the hand by the handles in the engine's `PENALTY_DRAWN`
  events.
  - Right below the feedback, near the board, a notice shows "Your new card:" with
    the card face and a "Show me ↓" button. Only when the player taps it does it
    scroll the card into view (smooth, or instant under reduced motion) and focus
    it.
  - The card in the hand also gets a "New!" tag and a highlight.
  - No automatic scrolling; card sizes and layout are unchanged.
- **C. Wider vs Beepy desktop layout (`styles.css` only; Solitaire layout
  unchanged):**
  - the vs Beepy screen may use up to 1440 px;
  - a more compact Beepy bar;
  - all nine problems in one row from 1280 px wide (5 + 4 below that);
  - from 1100 px, the piles, Beepy's move panel, feedback, the new-card notice and
    the selection hint share one row (`.action-row`) instead of stacking;
  - below 1100 px the earlier stacked layout and the 768 px rules still apply.
- **D. Beepy artwork:** new `render/beepy-avatar.ts`, an original inline-SVG robot
  (gradient head, visor face with eyes and smile, antenna light, side ears, cheeks,
  thought dots), with "idle" (gentle float) and "thinking" (eyes up, pulsing light,
  thought dots) poses set by CSS. It is shown in the vs Beepy bar (72 px) and on
  the menu (132 px). The CSS placeholder was removed. No retro, pixel or 8-bit
  styling. All motion is disabled by the existing `prefers-reduced-motion` rule.
- **Not done (out of U9 scope):** the educational-rewards idea (documented only).
- **Tests:** new `math-cards/tests/ui-u9-polish.test.ts`, 28/28 passed (vitest start
  09:54:32). Covered:
  - `promptDisplay`;
  - number-only tiles in both modes with the data and accessible labels unchanged;
  - factToSubject unchanged;
  - short vs full destinations;
  - `newCards` equals the engine's drawn card, and is empty with no penalty, and
    still lists the latest card in an 11+ card hand;
  - **colour contrast:** 16 foreground/background pairs, using tokens read from
    `styles.css`, all at least 4.5:1;
  - artwork guards: SVG namespace, used by board and menu, placeholder gone, no
    pixel-art rendering rules.
  - `ui-u3` non-leak test: `destinationDisplay` added to the fields it ignores
    (destination text, which is public).
- **Errors and corrections during U9:**
  1. An edit to `styles.css` was **not executed** ("input stream was
     interrupted"). The tool result said so. Only the earlier removal of the
     placeholder styles had taken effect, and I re-applied the full edit (Devpost
     evidence: a tool call cut off mid-input, reported as not executed; nothing lost
     on disk).
  2. All 16 contrast tests first failed with "missing token". A throwaway probe
    test (created, run, deleted; deletion confirmed) showed that Vitest returns an
    **empty string** for `styles.css?raw`, because it doesn't process CSS by
    default. Fix: the test reads the CSS from disk with Node's file API through an
    untyped dynamic import of `node:fs/promises`. This is the first M5 test to use
    a Node API at runtime; `@types/node` is still not installed, so there is no
    new dependency, and the test asserts the CSS was actually read.
  3. 3 contrast tests then failed because my token pattern `[a-z-]+` excluded
    digits (`--sky-1`, `--sky-2`). Fixed to `[a-z0-9-]+`; 28/28.
  4. Nine problems in one row was first set for 1100 px. I moved it to 1280 px
    before the build, because at 1100 px a tile would be about 108 px, too narrow
    for "34 + 21 = ?".
- **Checks (observed):**
  - `npx tsc --build tsconfig.json --force` exit 0;
  - `npm run typecheck:tests` exit 0;
  - ESLint on `math-cards/src` and `math-cards/tests` exit 0;
  - `npm run build -w math-cards` exit 0 (CSS 14.97 kB, JS 86.39 kB); the bundle has
    no diagnostics string, `Math.random` or `innerHTML`, and contains the SVG
    namespace;
  - `npx vitest run`: 1883 passed, 0 failed, 8 todo (vitest start 09:55:28), which
    is 1855 + 28;
  - `npm run dev -w math-cards`: `/`, `main.ts`, `beepy-avatar.ts`, `board.ts` and
    `styles.css` returned HTTP 200 on `localhost:5173`.
- **Disk check:** all UI files present with U9 timestamps; the probe test is gone.
- **Not observed, so U9 stays unchecked:** the appearance in Chrome, the new-card
  notice in a large hand, the wide vs Beepy layout, and widths 1280/1024/768/375.
  Still unverified from earlier tasks: keyboard-only navigation, touch interaction,
  narrow-screen behavior, and the final penalty-waiver message.
- **Stopped after U9, as instructed.** U10–U13 are not started.

## [2026-11-12] Milestone M5 — U9 owner review and desktop layout refinement (refinement AWAITING owner review)

- **Owner review (Chrome, 100% zoom, about 1830 px wide; owner-observed, recorded
  as reported):** approved the new Beepy artwork, the number-only
  matching-addition challenges, the penalty-card notification, and the wider
  competitive layout. The owner also verified that challenging an incorrect Beepy
  move still works.
- **Remaining issue reported:** while Beepy's move is showing, the hand extends
  below the window even when maximized, so the player has to scroll.
- **Penalty-card scrolling:** the owner does not consider it blocking. The
  notification, "New!" tag and "Show me" button are unchanged.
- **Change (`math-cards/src/ui/styles.css` only; no TypeScript, gameplay or engine
  change):**
  - ≥ 1100 px: Beepy's move panel is laid out horizontally, with the title, move
    and question on the left and Accept and Challenge stacked on the right (same
    identical styling). The solver badge sits in the tile corner instead of under
    the card, so solved tiles don't grow taller.
  - ≥ 1440 px, vs Beepy only: the screen becomes a grid, with the header and the
    Beepy bar sharing the top row, then the problems, the action row and the hand.
    The page may use up to 1720 px of width.
  - Font sizes and card sizes are unchanged. Nine problems stay in one row from
    1280 px. Solitaire and screens narrower than 1100 px are unaffected.
- **Estimate, not a measurement:** adding up the CSS heights, the vs Beepy screen at
  ≥ 1440 px with Beepy's move showing is roughly 600–650 px tall with a five-card
  hand, down from roughly 800 px. Kiro could not measure this; the owner's review
  will confirm it.
- **Checks (observed):**
  - `npx tsc --build tsconfig.json --force` exit 0;
  - `npm run typecheck:tests` exit 0;
  - ESLint on `math-cards/src` and `math-cards/tests` exit 0;
  - `npm run build -w math-cards` exit 0 (CSS 16.18 kB);
  - `npx vitest run`: 1883 passed, 0 failed, 8 todo (vitest start 01:56:22). No
    test was added, because layout fit can't be checked without a browser.
- **Disk check:** the refinement block is present in `styles.css` (from line 1010).
- **Still unverified:** keyboard-only navigation, touch interaction, narrow-screen
  behavior, and the final penalty-waiver message. U9 stays unchecked until the
  owner reviews the refinement. U10 is not started.

## [2026-11-12] Milestone M5 — U9 owner acceptance (owner-observed; recorded as reported)

- **Owner review in Chrome: U9 APPROVED.** The owner verified:
  - the modern Beepy artwork on the main menu and the competitive screen;
  - number-only challenges in "Find the matching addition";
  - the penalty-card notification, the orange "New!" highlight, and a working
    "Show me" button;
  - the improved desktop Player vs. Beepy layout at 100% zoom, with the nine
    problems, Beepy's move, the Accept/Challenge buttons and the hand all visible
    together;
  - correct gameplay after the layout changes.
- The owner accepts the current scrolling behavior when penalty cards are drawn;
  no change was made.
- U9 checked off.
- **Still unverified, so not claimed:** narrow widths (1024/768/375), touch,
  keyboard-only play, reduced motion, and the final penalty-waiver message.
- **Authorization:** U10 (drag-and-drop) only.

## [2026-11-12] Milestone M5 — U10: drag-and-drop (automated checks passed; Chrome check AWAITING owner)

- **Design:** dragging is only another way to give the same session commands as
  tapping. Starting a drag calls `select(card)`, so every open problem and Discard
  light up exactly as for a tap, revealing nothing. Dropping on a problem calls
  `playOn`; dropping on Discard calls `discard`. The engine judges as always.
  There are no drag-specific rules, and nothing changed in M2–M4.
- **Files:**
  - **New: `math-cards/src/ui/render/drag.ts`.**
    - `createDragController(actions)` is DOM-free. A press becomes a drag only
      after 10 px of movement (`DRAG_THRESHOLD_PX`); a shorter press is an ordinary
      tap. Dropping away from a target, Escape, or a cancelled pointer plays
      nothing, and clears the selection only if the drag created it.
    - `parseDropTarget` reads `data-drop`.
    - `installDragAndDrop(root, actions)` wires the pointer events (mouse, pen and
      touch through one API). Its listeners sit on the window, because the board is
      redrawn when the drag selects the card. It adds a floating "ghost" card that
      ignores the pointer, and a stronger outline on the target under the pointer.
      The click that follows a drag is suppressed, so it can't also select or play.
      The browser's native drag of a card is blocked. The file has no imports.
  - **`render/board.ts`:**
    - problem tiles and the Discard button get `data-drop` only when they are tap
      targets;
    - the hint now reads "Your turn! Tap a card, or drag it to a problem."
  - **`app.ts`:** installs drag-and-drop once with the session's
    `select`/`cancel`/`playOn`/`discard`. A drag can start only when the board model
    says the human may act on the playing screen.
  - **`styles.css`:** ghost card; solid outline and slight lift on the hovered
    target; a grabbing cursor while dragging; and `touch-action: pan-x` and no text
    selection on cards. With `pan-x`, a horizontal swipe still scrolls a long hand
    on a phone, and other moves can drag the card. The tradeoff: on touch, a drag
    that starts mostly sideways is treated as a scroll.
- **Kept unchanged:** tapping, keyboard play (Tab, Enter or Space, Escape), and
  the penalty-card notice and scrolling.
- **Tests (new):** `math-cards/tests/ui-u10-drag.test.ts`, 14/14 passed (vitest
  start 02:13:22). The controller drives a real game session. Covered:
  - `parseDropTarget`;
  - a drag onto the right problem solves it with the calls `select`, `playOn`;
  - onto a wrong problem it draws the normal penalty;
  - onto Discard it discards;
  - a drag's resulting view equals the tapped move's view for the same seed;
  - a short press is a tap with no call;
  - a drop away from a target cancels and clears the selection it made, while a
    card already selected stays selected;
  - abort works;
  - a stale drop on a solved problem is refused by the engine with no change;
  - in vs Beepy, a drag can't start while Beepy thinks or while a decision is
    pending;
  - a whole vs Beepy match played by dragging alone;
  - source guards: `drag.ts` has no imports, and drop targets equal tap targets.
- **Checks (observed):**
  - `npx tsc --build tsconfig.json --force` exit 0;
  - `npm run typecheck:tests` exit 0;
  - ESLint on `math-cards/src` and `math-cards/tests` exit 0;
  - `npm run build -w math-cards` exit 0 (CSS 16.91 kB, JS 90.25 kB); the bundle has
    no diagnostics string, `Math.random` or `innerHTML`;
  - `npx vitest run`: 1897 passed, 0 failed, 8 todo (vitest start 02:13:35), which
    is 1883 + 14;
  - the dev server returned HTTP 200 for `/`, `app.ts`, `render/drag.ts` and
    `styles.css`.
- **Errors and corrections:** none.
- **Disk check:** all files present.
- **Not tested, so not claimed:** dragging with a mouse in Chrome, touch dragging
  (real or emulated), keyboard-only play, narrow widths. U10 stays unchecked until
  the owner's Chrome check. U11 is not started.

## [2026-11-12] Milestone M5 — U10 owner acceptance (owner-observed; recorded as reported)

- **Owner test in Chrome: U10 APPROVED.** The owner verified:
  - dragging a correct card onto a problem solves it;
  - dragging an incorrect card gives the expected penalty;
  - dragging an unneeded card to Discard works;
  - dropping outside a valid target cancels with no state change;
  - Escape during a drag cancels it with no penalty;
  - in Player vs. Beepy, dragging works on the human's turn, is disabled while
    Beepy's move waits for Accept/Challenge, and works again when the human's turn
    begins.
- **A competitive game was completed using drag-and-drop:**
  - the human won by emptying their hand;
  - cards left: human 0, Beepy 3; problems solved: human 2, Beepy 3;
  - match score human 1, Beepy 0; 9 turns;
  - the win went correctly to the first player to empty their hand, although Beepy
    solved more problems;
  - the results panel scrolled into view appropriately.
- **No gameplay defects observed** in the tested flows. U10 checked off.
- **Not tested, so not claimed:** real touch devices and comprehensive
  keyboard-only play.
- **Authorization:** U11 (privacy and information visibility) only.

## [2026-11-12] Milestone M5 — U11: privacy and information-visibility guards (verified by automated checks)

- **Scope:** this verifies the UI's ordinary data path: views, board models,
  public events, feedback text, accessible labels, drag and tap targets, and the
  UI source code. It does **not** claim that client-side state is secret. The
  generated deck and engine state live in page memory and can be inspected with
  browser developer tools.
- **No production code changed.** The existing code passed every new guard on the
  first run.
- **New test file:** `math-cards/tests/ui-u11-privacy.test.ts`, 20/20 passed
  (vitest start 02:28:56).
  1. **Beepy's hidden cards (engine mirror).** A test-only mirror replays each game
     through the M3 pure core (same deck from the same derived seed, same options,
     same Beepy strategy, same requests). That gives the true hidden set at every
     step: Beepy's hand (except the pending card) plus the draw pile.
     - For 4 whole games (both question styles, four levels), every step checks
       that the mirror matches the real view (the human hand faces and Beepy's
       count).
     - No hidden face appears in any face-carrying field of the board model (hand,
       played cards, discard top, pending card, new-card notice, selection).
     - Hand-card labels name only that card.
     - Feedback text comes only from the fixed table, with no faces.
     - Beepy's penalty events never carry a card.
  2. **Pending move gives no hint.** For 8 seeds × both styles, Beepy at error rate
     0 (right) and 1 (wrong) with the same seed are compared after removing only
     the pending card and destination: the view, board model, public events and
     feedback are identical.
     - While a decision is pending, nothing is a tap or drag target, the human
       can't act, both buttons are available, and no right/wrong wording appears.
     - Beepy's think delay is one constant (1000 ms).
  3. **Personal data, storage, network.**
     - No browser storage (localStorage, sessionStorage, indexedDB, caches,
       cookies) in any UI file.
     - No network calls (fetch, XHR, WebSocket, EventSource, sendBeacon), no
       geolocation or media access.
     - No URL changes; no innerHTML, eval or `new Function`; no free-text input
       fields (the only inputs are the level and style radio buttons).
     - `index.html` and `styles.css` load nothing from other sites.
     - A session snapshot never contains the series seed or any derived generator
       seed.
  4. **Architecture boundary.**
     - UI files never import engine internals, the generator, levels or fallback
       code at runtime; type-only imports are allowed.
     - Only `session.ts` calls `createMathSeries`; only `seed.ts` reads a random
       source.
     - No UI file names judging, answer, deck or matrix functions or fields.
     - Diagnostics are connected only in development builds (`main.ts`), and no
       other UI file logs to the console.
- **Mutation probe (temporary, reverted):** storage access and a runtime import
  of `generateMathDeck` were appended to a backed-up `labels.ts`. 3 of the 20 tests
  failed (storage, import boundary, no-deck-handling). The file was restored, with
  no probe lines left and the backup removed.
- **Production-bundle text search (reported, not asserted):**
  - no localStorage, sessionStorage, indexedDB, `document.cookie`, sendBeacon,
    XMLHttpRequest, WebSocket, diagnostics string, innerHTML or `Math.random`;
  - one `fetch(` is present. Its surrounding code is Vite's built-in module-preload
    helper (`fetch(s.href, …)` for the app's own `<link rel="modulepreload">`
    files, same-origin credentials). It is not app code and sends no game or
    personal data. It was left as is, because changing it would need a Vite config.
- **Errors and corrections:** ESLint flagged one unused import
  (`createMathSeries`) in the new test; removed. ESLint exit 0 after the fix.
- **Checks (observed):**
  - `npx tsc --build tsconfig.json --force` exit 0;
  - `npm run typecheck:tests` exit 0;
  - ESLint on `math-cards/src` and `math-cards/tests` exit 0;
  - `npm run build -w math-cards` exit 0;
  - `npx vitest run`: 1917 passed, 0 failed, 8 todo (vitest start 02:30:00), which
    is 1897 + 20.
- **Remaining limitations, to document in U13:** the deck and engine state are
  inspectable with developer tools in this static app; card handles appear as
  opaque `data-handle` attributes; and a sighted observer next to the player
  could, of course, see the screen. Real touch devices, comprehensive
  keyboard-only play and screen-reader behavior remain untested.
- **Stopped after U11.** U12 and U13 are not started. The educational-rewards
  item stays documented only.

## [2026-11-12] Milestone M5 — U11 owner approval (recorded as reported)

- The owner reviewed the U11 report and **approved U11**. U11 was already checked
  off in `tasks.md` on its automated evidence; the owner's approval is now
  recorded.
- The owner accepts the documented client-side limitation: game state can be
  inspected with browser developer tools.
- **Authorization:** U12 (final verification and browser testing) only. U12 stays
  pending until the owner reports the browser results. U13 is not authorized.

## [2026-11-12] Milestone M5 — U12: final automated verification (owner's Chrome checks AWAITING)

- **No production code changed.** U12 adds tests and the owner's checklist only.
- **New test file:** `math-cards/tests/ui-u12-final.test.ts`, 12/12 passed (vitest
  start 02:43:26). It checks what can be checked without a browser:
  - **Penalty exhaustion in real games** (no special shortcuts), in Solitaire with
    both question styles.
    - The test keeps making wrong moves until three penalties in a row are waived.
      Before that, fallback cards are drawn after the pile reaches 0.
    - Every waived step shows exactly "Oops…" and the waived message, never "drew",
      with no new-card notice, the hand size unchanged, and the turn counted.
    - Every non-waived step shows "You drew 1 card." with the hand one larger.
    - The game then plays to its normal end, with score = turns + cards left.
    - In vs Beepy (3 seeds, Beepy rate 0.6, the human always wrong), waived
      penalties occurred, including in decision steps. None reported a draw, and
      none had a `PENALTY_DRAWN` event.
  - **Keyboard structure.**
    - Every click or change handler in `render/board.ts` and `render/menu.ts` is on
      a real `<button>` or radio `<input>` (at least 12 handlers found).
    - Every button is `type="button"`.
    - Escape cancels a selection in `app.ts` and a drag in `drag.ts`.
    - Beepy's decision heading is focusable (`tabindex=-1`) and receives focus.
    - Accept and Challenge have visible text.
  - **Touch.** A press followed by a small or sideways move and then a pointer
    cancel (what a horizontal swipe produces under `touch-action: pan-x`) gives no
    command. The CSS keeps `pan-x` on cards and a horizontally scrolling hand below
    768 px.
  - **Motion and layout rules.** The reduced-motion block disables every animation
    and transition, and "Show me" uses an instant scroll under reduced motion. The
    1024, 768, 1100, 1280 and 1440 px breakpoints are present.
  - **Accessible names.** Number-only problems are named "Problem n: Which addition
    expression equals N?" in both modes. Beepy's pending destination text has the
    form "on problem n (N)" or "to the discard pile".
- **Checks (observed):**
  - `npx tsc --build tsconfig.json --force` exit 0;
  - `npm run typecheck:tests` exit 0;
  - ESLint on `math-cards/src` and `math-cards/tests` exit 0;
  - `npm run build -w math-cards` exit 0 (CSS 16.91 kB, JS 90.25 kB);
  - `npx vitest run`: **1929 passed, 0 failed, 8 todo** (vitest start 02:44:05),
    which is 1917 + 12;
  - **Production preview:** `vite preview --outDir web-dist --port 4173` served `/`
    and the built JS with HTTP 200.
- **Problems while checking the preview:**
  - Two attempts through the background-process tool reported "Unable to connect",
    and that tool showed no output for the process.
  - A third attempt, started with `Start-Process` with output redirected, served
    HTTP 200.
  - Afterwards one `node` process (pid 20804) was still listening on 4173. I
    stopped it and confirmed nothing was listening there.
  - I don't know why the first two attempts failed, and I record only what was
    observed.
- **Design observation for the owner (not changed):** keyboard focus order follows
  the screen top to bottom, so the problems and Discard come before the hand.
  After selecting a card with Enter, a keyboard player presses **Shift+Tab** to
  move back through Cancel, Discard and the problems. This works, but it isn't the
  most direct path. Possible later improvement: move focus to the first problem
  after a keyboard selection. It is noted for the owner's keyboard check.
- **Not yet performed, so not claimed:** keyboard-only play, the 1280/1024/768/375
  px layout checks, Chrome touch emulation, a physical touch device, screen-reader
  output, and reduced motion in a real browser. U12 stays unchecked. U13 is not
  started.

- **Correction to the U12 entry above (same session, written immediately after):**
  the sentence "one `node` process (pid 20804) was still listening on 4173. I
  stopped it" is wrong.
  - What was actually observed: after the preview check, nothing was listening on
    4173. One `node` process (pid 7600) was listening on 5173 (a Vite dev server).
    My `Stop-Process -Id 20804` failed with "Cannot find a process", because that
    pid came from my own mistake and not from any output.
  - The process on 5173 was **left running**, because it may be the owner's own dev
    server.
  - This is recorded as an agent reporting error, caught by checking the command
    output.

## [2026-11-12] Milestone M5 — U12 owner verification (owner-observed; recorded as reported)

- **Owner checks in Chrome: U12 APPROVED for the tested functionality.** Passed:
  - keyboard-only navigation from the main menu through Solitaire setup and game
    start;
  - keyboard-only selection and correct play of a card;
  - Escape to cancel;
  - keyboard-only discarding;
  - keyboard operation of Player vs. Beepy, including Accept/Challenge and the Menu
    confirmation;
  - Solitaire and Player vs. Beepy layouts at 375 px (including the decision panel
    and hand);
  - responsive layouts at 768, 1024 and 1280 px;
  - **simulated** touch in Chrome device emulation: tapping, dragging, and
    horizontal swiping through the hand without accidental plays or discards.
- **No problems observed** in these manual tests.
- The owner considers the existing keyboard order (Shift+Tab back to the problems)
  functional and requests no change.
- **Automated evidence (from the U12 entry):** 1929 passed, 0 failed, 8 todo;
  TypeScript, test type-check, ESLint and the Vite build passing. Penalty
  exhaustion and the waiver message are covered by automated tests.
- **Remaining limitations (not claimed as passed):**
  - no physical touchscreen device was tested;
  - no full manual screen-reader testing was done;
  - the final penalty-waiver condition was verified by automated tests only, not
    reproduced manually in Chrome;
  - keyboard operation was verified, but no comprehensive accessibility audit was
    performed.
- U12 checked off. **Authorization:** U13 (final M5 documentation) only.

## [2026-11-12] Milestone M5 — U13: final documentation, and M5 close-out

### U13 changes (documentation and metadata only; no gameplay, engine, or UI code changed)
- `README.md` (root): rewritten from the M1 "scaffolding only" text. It covers the
  status table, architecture and data flow, Math Cards in brief, development,
  build, preview and static-hosting commands, testing results, known limitations,
  the roadmap (Tutor Mode as proposed M6, educational rewards, Clinical Cards),
  and the 2018 Beepy video as historical context only.
- `math-cards/README.md`: features, the four levels, both question styles,
  controls, the complete Solitaire and Player vs. Beepy rules (including the
  Accept/Challenge table), run/build/preview/hosting, privacy and its limitation,
  code layout, and known limitations.
- `shared-engine/README.md`: modules by milestone and the guarantees covered by
  tests.
- `clinical-cards/README.md`: the status is now stated as "not implemented
  (generator stub only)".
- New `docs/devpost-submission.md`: a reusable factual summary (inspiration with
  the 2018 video, explicitly not reused; what it does; the shared engine and the
  planned second app; what is complete; how Kiro was used; challenges; testing
  evidence; limitations; next steps; the outstanding submission checklist).
- `package.json` descriptions (root and three workspaces): the stale "no gameplay
  implemented yet" text was replaced with the actual status. Metadata only; no
  dependency changes.
- `.kiro/specs/math-cards-ui/tasks.md`: added the future item "Tutor Mode
  (proposed M6)", documented only, next to the educational-rewards item.
- `eslint.config.js`: added `**/web-dist/**` to `ignores` (see below).

### Problem found during U13 and how it was handled
- I first wrote the README lint command, `npx eslint shared-engine math-cards
  clinical-cards`, without running it. When I ran it: 164 errors.
  - 162 came from linting the Vite build output `math-cards/web-dist/` (it wasn't
    in the ignore list). Fixed by ignoring `**/web-dist/**`, the same treatment as
    `dist/`.
  - 2 are **pre-existing errors in M2 files that were never linted before**:
    `shared-engine/src/issues.ts:43` (`_Issue` unused, a compile-time conformance
    type) and `shared-engine/src/penalty-draw.ts:276` (`no-unexpected-multiline`).
  - Both are style-only. Per the instruction not to modify M2 production code,
    they were **not changed**. They are reported in the README, the Devpost
    summary, and here for an owner decision.
- After the ignore fix, linting `shared-engine/src/game`, `shared-engine/tests`,
  `math-cards` and `clinical-cards` gives exit 0. The full three-folder command
  reports exactly the 2 M2 errors.

### Final checks (observed)
- `npx tsc --build tsconfig.json --force` exit 0.
- `npm run typecheck:tests` exit 0.
- `npm run build -w math-cards` exit 0 (CSS 16.91 kB, JS 90.25 kB).
- ESLint: clean on all M3–M5 code; 2 pre-existing M2 errors as above.
- `npx vitest run`: **1929 passed, 0 failed, 8 todo** (vitest start 03:29:39).
  - The 8 todo: 2 Clinical-generator tests, 4 M2 engine-judging placeholders
    (behavior now tested in M3; conversion awaits owner), 2 loader tests.
- `.kiro/`: 21 files present (5 specs × 3 files, 5 steering files, the hooks
  placeholder). Nothing deleted.

### M5 summary
- Tasks U0–U13 are complete. U6–U12 were each checked off only after the owner's
  Chrome results.
- Delivered: a playable Beepy Math Cards browser app in plain TypeScript, HTML
  and CSS, with no framework and no new dependency. It has:
  - menu and setup; Solitaire and Player vs. Beepy;
  - four levels and two question styles (number-only targets in "Find the
    matching addition");
  - feedback that reflects actual engine events (drawn, waived and not-applied
    penalties kept distinct); a new-card notice;
  - results and series screens;
  - original SVG Beepy art; a wide desktop vs Beepy layout; responsive layouts;
    reduced motion;
  - pointer drag-and-drop, keyboard play, and privacy guards.
- Tests added in M5: 167 (1762 at the M5 baseline to 1929).
- Owner-verified in Chrome:
  - full Solitaire sessions (for example scores 9, 5, 5, 5, 5, total 29);
  - a full match (You 0 – Beepy 3), with all four Accept/Challenge outcomes;
  - drag-and-drop, including a game won by emptying the hand while Beepy solved
    more problems;
  - keyboard-only play; widths 375/768/1024/1280; simulated touch.
- Not performed: a physical touch device, full screen-reader testing, manual
  reproduction of the penalty waiver, a comprehensive accessibility audit.
- M2–M4 engine contracts unchanged in M5. The UI framework decision deferred in
  the architecture steering was resolved by owner decision U-1 (plain
  TypeScript + DOM). The steering file itself was not edited.

### Project overview, M1–M5 (index to the entries above, which remain the record)
- **M1 (2026-11-09) Foundation:** monorepo scaffolding, 5 steering documents, the
  foundation spec, this journal.
- **M2 (2026-11-09) Educational data schema and validation:** the source-data
  schema, ids, collections, the generated-deck contract, validation stages, deck
  sizing, the penalty draw with bounded fallback, the structured issue model, and
  permanent test suites (898 passed at close-out). Task 16 deliberately left
  unchecked.
- **M3 (2026-11-10) Shared game engine:** seeded deterministic engine for
  Solitaire and Player vs. Beepy, the trusted controller with sanitized views,
  the Beepy strategy, and invariant simulation (1450 passed at close-out).
- **M4 (2026-11-11) Math deck generator:** structured generator result, the
  exported deck gate, four levels, both directions, plan-from-actual-pool
  sizing, the expression fallback, and the Math series wrapper (1762 passed at
  close-out).
- **M5 (2026-11-11/12) Math Cards browser interface:** above (1929 passed at
  close-out).

### Kiro features actually used, M1–M5
- Specs, each with requirements, design and tasks, reviewed and revised with the
  owner before implementation: `foundation-setup`, `educational-data-schema`,
  `game-engine`, `math-deck-generator`, `math-cards-ui`.
- Steering, five documents in `.kiro/steering/`, applied as standing constraints.
- Task tracking in the spec `tasks.md` files with approval gates.
- Agent file operations and terminal execution (builds, tests, lint, dev and
  preview servers, file and disk checks).
- **Not used:** hooks (only the `.kiro/hooks/.gitkeep` placeholder exists).

### Workflow difficulties (Devpost evidence; cause not verified)
- The M1–M4 summary is in the entry "Evidence summary for the Devpost write-up:
  lost and reverted edits (M1–M4)".
- Observed in M5:
  - **U9:** one `styles.css` edit was not executed, because the tool's input was
    cut off and the tool said so. It was re-applied, and nothing was lost on disk.
  - **U6:** an unexplained gap of about 80 minutes between two consecutive file
    writes. Only the timestamps were recorded.
  - **U12:** two production-preview attempts through the background-process tool
    couldn't be reached; a third, started differently, worked.
  - **U12:** an agent reporting error. The log first named a process I hadn't
    actually observed; it was corrected right away from the command output.
- No M5 file was found missing or reverted. The revised workflow (disk checks
  after interruptions, whole-file recovery, no test in the same batch as the write
  it depends on, recording each event) was kept throughout.

### Outstanding for submission (not done; see `docs/devpost-submission.md`)
- Git and a public GitHub repository (Git not used yet).
- Deployment to a public URL.
- The master spec's two-app target: Clinical Cards is not implemented.
- A YouTube demo of under three minutes.
- Re-checking the live rules (deadline December 4, 2026).
- The 2 pre-existing M2 lint errors (owner decision).

### Next
- M6 (Tutor Mode) and educational rewards are documented only and not
  authorized. Work stopped after U13.

## 2026-11-12 — M6 planning: Beepy's Clinical Cards (specification only)

- **Date:** 2026-11-12 (machine clock, `Get-Date`, 03:41 local).
- **Milestone / objective:** M6 planning. Define how Clinical Cards reuses the
  shared engine without changing Math Cards. No implementation.
- **Prompt summary:** "M6 — Begin Beepy Clinical Cards planning only." Disease-based
  high-yield USMLE facts, not NBME-style questions; up to three facts per category;
  Solitaire and Player vs. Beepy; same rules; manually authored clinical JSON; no
  AI-generated clinical content or external services; inspect first; report stages,
  files, testing and decisions; stop after planning.
- **Linked spec / steering:** new `.kiro/specs/clinical-cards/`; all five steering
  documents; master spec §8, §9, §11, §12, §13 re-read.
- **Kiro features actually used:** spec authoring (requirements, design, tasks);
  steering as constraints; agent file reads, searches and writes; terminal
  commands. Not used: hooks, sub-agents.
- **Inspected:** the Clinical stub, its test, `package.json`, `tsconfig.json`,
  README; shared-engine `generator.ts`, `generated-deck.ts`, `penalty-draw.ts`,
  `game/view.ts`; `math-cards/src/math-series.ts`; import lists of
  `math-cards/src/ui/*`; the Task 16 and Task 18 `it.todo`; root `package.json` and
  `tsconfig.test.json`.
- **Findings recorded in the design:**
  - The engine needs no change for Clinical gameplay.
  - "Explain Why" can be served by the Clinical series wrapper from the public
    `ACTION_RESOLVED` event (display values are unique in a game), so no engine
    change is needed (decision C-5).
  - The existing Clinical test forbids a `*fallback*` module and asserts the stub;
    it must be updated with approval (C-9).
  - No `resolveJsonModule` is configured (C-10).
  - Math UI: `app-state`, `app`, `labels`, `menu`, `session` import Math types;
    the rest is subject-neutral (C-1).
- **Files created:** `.kiro/specs/clinical-cards/requirements.md`, `design.md`,
  `tasks.md` (C0–C9, all unchecked). **Modified:** this log (append only).
- **Commands actually run:** `Get-ChildItem` line counts of `math-cards/src/ui`;
  `Get-Content` of the log tail; `Get-Date`. No build, test or lint was run, because
  no code changed. Tests: not run.
- **Not done, as instructed:** no code, no Clinical content, no changes to M2–M5
  code or tests, no dependencies, no Git, no `npm audit fix`.
- **Outcome:** M6 plan written. Waiting on owner review of decisions C-1 to C-14.
  Clinical dataset authorship (C-2) is a blocking dependency for stage C5.

## 2026-11-12 — M6 C0: owner decisions recorded, planning documents revised

- **Milestone / objective:** M6 stage C0. Record the owner's decisions on C-1 to
  C-14 and set the revised baseline. No code.
- **Prompt summary:** "M6 — Approve planning with revisions; authorize C0–C1 only."
- **Owner decisions:**
  - Approved as recommended: C-1 (copy and adapt the UI), C-2 (owner authors and
    reviews), C-4 (fallback from unused reviewed entries), C-5 (`explainResolved`
    in the wrapper), C-7 (both directions), C-8, C-9, C-10, C-11, C-13, C-14.
  - **C-3 revised:** a fact is never treated as an incorrect distractor merely
    because it is absent from another list. Cross-disease applicability needs
    explicit owner review; a review report must list potentially shared or
    ambiguous facts, including cross-category relationships; unreviewed
    relationships stay unknown and never justify a distractor. M2 ambiguity checks
    and the exactly-one-answer invariant are kept.
  - **C-6 revised:** initial reviewed dataset of about 16–20 diseases, up to four
    categories each, 1–3 reviewed corrects per included category; targets 15 and
    24; smaller validated decks allowed; account for 16 diseases giving only 16
    disease-name cards unless reviewed incorrect diagnoses are added; test real
    achievable sizes; never pad.
  - **C-12 revised:** card text maximum 140 characters; explanations may be longer
    and are shown separately after resolution.
  - Terminology: `subjectIncorrects` holds genuinely incorrect alternative
    diagnoses, never synonyms or equivalent names.
- **Resulting design changes:** the validity policy now has three outcomes (valid,
  invalid only when review supports it, unknown). Review records live in a separate
  Clinical review file (`clinical-review.json`, format proposed in `design.md` §4),
  so the M2 schema is unchanged. The policy module is renamed `clinical-review.ts`
  (C2). The `resolveJsonModule` change moves from C1 to C5, because C1 tests read
  the template from disk.
- **Files modified:** `.kiro/specs/clinical-cards/requirements.md`, `design.md`,
  `tasks.md` (rewritten consistently); this log (append only).
- **Commands run:** none for C0. Tests: not run (no code changed).

## 2026-11-12 — M6 C1: Clinical content validation foundation

- **Milestone / objective:** M6 stage C1. Four approved categories, Clinical content
  validation on top of the M2 schema, the 140-character card limit, exact-path
  issues, a fictitious test dataset, an authoring template and guide, tests.
- **Prompt summary:** same prompt as C0 ("authorize C0–C1 only"; stop after C1).
- **Linked spec / steering:** `.kiro/specs/clinical-cards/` (Req 1, Req 2; design
  §3); steering `educational-data-independence.md`, `originality-and-copyright.md`,
  `verified-work-only.md`.
- **Kiro features actually used:** spec task tracking; steering as constraints;
  agent file reads, searches and writes; terminal execution. Not used: hooks,
  sub-agents.
- **Files created:**
  - `clinical-cards/src/clinical-content.ts`: `CLINICAL_CATEGORIES`,
    `CLINICAL_MAX_CARD_TEXT_LENGTH` (140), 1–3 facts limits, `CLINICAL_NAMESPACE`,
    14 `CLINICAL_CONTENT_CODES`, `categoryOfTopicName`, `cardTextLength`,
    `validateClinicalCollection` (M2 issues passed through unchanged when the
    schema stage fails; otherwise all Clinical issues in document order).
  - `clinical-cards/tests/fixtures/fake-clinical.ts`: four fictitious diseases
    ("Test Disease 1" to "4"), placeholder facts and explanations only.
  - `clinical-cards/authoring/clinical-dataset.template.json`: template with
    "Example Disease A/B" and "Replace: ..." placeholders only.
  - `clinical-cards/authoring/AUTHORING.md`: format, categories, validator codes,
    card-text guidance, `subjectIncorrects` terminology, and how to record shared
    facts and cross-disease applicability (shared `corrects`, explicit
    `incorrects`, review records in the proposed format). It contains no medical
    knowledge.
  - `clinical-cards/tests/c1-content-validation.test.ts`: 45 tests.
- **Files modified:** `clinical-cards/README.md` (status and authoring pointer);
  `.kiro/specs/clinical-cards/tasks.md` (C0 and C1 checked); this log.
- **Not changed:** `math-cards/`, M2/M3 production code and tests, the Clinical
  stub and its Task 18 test, tsconfig files, `package.json` files, dependencies.
- **Commands actually run and results:**
  - `npx tsc --build tsconfig.json --force`: exit 0.
  - `npm run typecheck:tests`: exit 0.
  - `npx vitest run clinical-cards/tests`: 2 files, 54 passed (45 new + 9 existing).
  - `npx vitest run`: 43 files, 1974 passed, 0 failed, 8 todo (start 05:31:09).
    Previously 1929 passed; the +45 are the new C1 tests. The 8 todo are unchanged.
  - `npx eslint clinical-cards`: exit 0.
  - `npx eslint shared-engine math-cards clinical-cards`: exit 1 with the same 2
    pre-existing M2 errors (`issues.ts:43`, `penalty-draw.ts:276`); nothing new.
  - `npm run build -w math-cards`: exit 0.
- **Tests not run / not applicable:** no browser checks (no UI in C1). Review
  records are not validated yet: their format is proposed in the guide and is
  validated from C2.
- **Problems:** none observed. All C1 tests passed on the first run.
- **Outcome:** C1 complete, awaiting owner review of the template and guide.
  Work stopped. C2–C9 not started.

## 2026-11-12 — M6 C2: contextual validity, review records, stale-review detection

- **Milestone / objective:** M6 stage C2. The valid / invalid / unknown policy;
  validation of `clinical-review.json`; detection of stale reviews; the review
  report; tests with fictional data only.
- **Prompt summary:** "M6 — Accept C0–C1 and authorize C2 only." The owner
  accepted C0–C1 with the reported results (45 new tests; 1974 passed, 0 failed,
  8 todo). Approved: the dataset template and placeholders, the four categories,
  the 140-character limit, the three-state model, the separate review file, the 14
  error messages, and the guide. C2 requirements: explicit listings decide first;
  reviewed cross-topic relationships may establish invalidity; unreviewed stays
  unknown and never justifies a distractor; review groups require owner
  attestation; outdated reviews must be detected without the owner computing
  fingerprints; small groups allowed; a report without clinical judgments.
- **Linked spec / steering:** `.kiro/specs/clinical-cards/` (Req 3; design §4);
  steering `educational-data-independence.md`, `no-duplicate-card-invariant.md`,
  `originality-and-copyright.md`, `verified-work-only.md`.
- **Kiro features actually used:** spec task tracking; steering as constraints;
  agent file reads, searches and writes; terminal execution. Not used: hooks,
  sub-agents.
- **Design decisions made in C2 (for owner review):**
  - **Review-record format change:** the C0 proposal's `topicIds` array became
    `topics: [{ topicId, fingerprint }]`, so each topic carries the fingerprint of
    the content that was reviewed. All other fields are kept.
  - **Attestation:** `statement` must equal `REVIEW_STATEMENT` word for word.
    `reviewedBy` and `reviewedOn` must not be the draft placeholders.
  - **Fingerprint:** `fp1-` + FNV-1a 64-bit hex (implemented in code, no
    dependency) of a canonical JSON of: a version tag, the normalized disease
    name, the exact `topicName`, and the sorted, de-duplicated normalized
    correct-fact texts. Any mismatch makes the whole record stale (not used).
  - **Scope of a group review:** it covers correct facts only. Texts that appear
    only in `incorrects` stay unknown on other topics.
  - **Disease-name rule:** implemented as approved in design §4.
    `subjectIncorrects` entries are not fingerprinted (open question Q-1 below).
- **Files created:**
  - `clinical-cards/src/clinical-review.ts`: `REVIEW_FORMAT_VERSION`,
    `REVIEW_STATEMENT`, 14 `REVIEW_CODES`, `fnv1a64Hex`, `topicFingerprint`,
    `validateReviewFile`, `createValidityPolicy` (`factRelation`, `nameRelation`,
    `reviewsCovering`, `factValidityMatrix`), `draftReviewRecord`,
    `buildReviewReport`, `formatReviewReport`.
  - `clinical-cards/authoring/clinical-review.template.json`: two example records
    for the dataset template's topics, with placeholder reviewer and date.
  - `clinical-cards/tests/fixtures/fake-review-dataset.ts`: a 4-disease, 7-topic
    fictional dataset designed so relations can be worked out by hand.
  - `clinical-cards/tests/c2-review-and-validity.test.ts`: 94 tests.
- **Files modified:** `clinical-cards/authoring/AUTHORING.md` (§2 file table; §7
  rewritten: format, validity conditions, small groups, fingerprints and stale
  reviews, alternative diagnoses, report sections); `clinical-cards/README.md`
  (status); `.kiro/specs/clinical-cards/requirements.md` (Req 3.5 revised, 3.7
  and 3.8 added), `design.md` (§2 table, §4 as built), `tasks.md` (C2 checked);
  this log.
- **Not changed:** `math-cards/`, M2/M3 production code and tests, the Clinical
  stub and its Task 18 test, tsconfig and package files, dependencies.
- **Commands actually run and results:**
  - `npx tsc --build tsconfig.json --force`: exit 0 (before tests, and again
    after).
  - A **temporary** test `clinical-cards/tests/tmp-fingerprints.test.ts` printed
    the fingerprints of the dataset template's topics for the review template
    (1 passed). It was then deleted.
  - `npx vitest run clinical-cards/tests/c2-review-and-validity.test.ts`: first
    run 94 passed. I had fixed one expectation before that run: M2's
    `analyzeCandidateAmbiguity` rejects a board where a challenge has no
    unambiguous candidate, so that test now uses a reviewed W2+W3 board.
  - **Mutation check:** I temporarily changed the policy so that unlisted facts
    returned "invalid". The C2 file then had 24 failed and 70 passed. I reverted
    the change and confirmed by search that no mutation text remained.
  - `npx vitest run` (start 05:51:37): 44 files, 2068 passed, 0 failed, 8 todo.
    That is 1974 + 94. The 8 todo are unchanged.
  - `npm run typecheck:tests`: exit 0.
  - `npx eslint clinical-cards`: exit 0. `npx eslint shared-engine math-cards
    clinical-cards`: exit 1 with only the same 2 pre-existing M2 errors.
  - `npm run build -w math-cards`: exit 0.
  - After those runs, only Markdown files were edited (`AUTHORING.md`, README,
    spec documents). No code or test changed after the final test run.
- **Not run / not applicable:** no browser checks (no UI). No command yet prints
  the report for real files; that is planned for C5.
- **Open question for the owner (Q-1):** `subjectIncorrects` act as reviewed
  wrong answers for every correct fact of their disease (approved design §4), but
  they carry no fingerprint, so editing a disease's facts does not flag them. The
  guide tells the author to re-check them. Options: keep this; or add an optional
  review mechanism for alternative diagnoses in a later stage.
- **Outcome:** C2 complete, awaiting owner review. Work stopped. C3–C9 not started.

## 2026-11-12 — M6: owner accepts C2; Q-1 alternative-diagnosis safeguard

- **Prompt summary:** "M6 — Accept C2 and authorize C3 only."
- **Owner acceptance of C2:**
  - The three-state model.
  - Explicit review before unlisted facts count as incorrect.
  - The `topics: [{ topicId, fingerprint }]` format.
  - Automatic fingerprints.
  - Stale-review exclusion.
  - Small review groups.
  - The seven-section report.
  - The reported results: 94 new tests; 2068 passed, 0 failed, 8 todo;
    TypeScript checks; Clinical ESLint clean; Math build.
  - C2 is marked complete in `tasks.md`.
- **Owner decision Q-1:** a genuinely different diagnosis is not automatically
  wrong for every fact of another disease.
  - Keep `subjectIncorrects` in the M2 schema.
  - Default to unknown unless an explicit review covers the alternative.
  - Provide a small review mechanism compatible with the existing approach.
  - Reviews go stale when the facts or the alternative text change.
  - Unreviewed or stale relationships never supply distractors.
  - Never invent diagnoses to reach a deck size.
- **Q-1 as built (in `clinical-cards/src/clinical-review.ts`):**
  - **Record format:** an optional `alternativeReviews` array in the same review
    file. One record per disease: `id`, `reviewedBy`, `reviewedOn`, `statement` =
    `ALTERNATIVE_REVIEW_STATEMENT`, `subjectId`, `alternativeIds` (may be partial),
    `fingerprint`.
  - **Fingerprint:** `alternativesFingerprint` covers the normalized disease name,
    every topic name with its correct facts, and the covered alternative texts.
  - **New codes:** `REVIEW_UNKNOWN_SUBJECT`, `REVIEW_NO_ALTERNATIVES`,
    `REVIEW_UNKNOWN_ALTERNATIVE`, `REVIEW_DUPLICATE_ALTERNATIVE`. Record ids are
    unique across both arrays.
  - **Policy:** `nameRelation` no longer treats a listed alternative as invalid.
    The basis `alternativeDiagnosis` was replaced by `reviewedAlternative`, which
    requires a current alternative review.
  - **Report:** alternative counts in the summary; section 2 lists stale
    alternative reviews with renewal drafts; section 5 lists alternatives without
    a current review; section 7b gives per-disease fingerprints.
  - **New helpers:** `draftAlternativeReview` and `NO_REVIEWS`.
- **Changed C2 tests (owner-required semantic change):**
  - `c2-review-and-validity.test.ts`: two disease-name cases changed from
    `invalid (alternativeDiagnosis)` to `unknown (notCoveredByReview)`.
  - The report summary and heading expectations were updated, and the template
    test now expects the new record's placeholder issues.
- **Fixture:** `fake-review-dataset.ts` gives the alternatives readable ids and
  exports `SUBJECT` and `ALT`.
- **Template:** `clinical-review.template.json` gains one `alternativeReviews`
  example. Its fingerprint came from a temporary test
  (`tmp-alt-fingerprint.test.ts`, run once, 1 passed, then deleted).
- **New test file:** `clinical-cards/tests/q1-alternative-reviews.test.ts`.
  - First run: 2 failed, caused by my expectations, not the code. The fixture's
    Test Disease 3 Management lists "Test therapy A" as incorrect, so the name
    "Test Disease 3" on (D1 Management: therapy A) is explicitly invalid
    (`listedIncorrect`). I had expected `reviewedAlternative` or unknown.
  - I corrected the expectations and added a test for that explicit listing.
  - Then all Clinical tests passed: 4 files, 193 passed.

## 2026-11-12 — M6 C3: Clinical deck generator (implemented; awaiting owner review)

- **Milestone / objective:** M6 stage C3. Replace the stub with a real
  `ClinicalDeckGenerator`:
  - both directions and both modes;
  - deterministic;
  - targets 15 and 24, with reduced validated decks;
  - one designated answer per challenge and no duplicate text;
  - valid starting hands;
  - complete matrices;
  - verbatim text and authored-context explanations;
  - structured failures.
- **Linked spec / steering:** `.kiro/specs/clinical-cards/` (Req 3, Req 4;
  design §4, §5); all five steering documents.
- **Kiro features actually used:** spec task tracking; steering as constraints;
  agent file reads, searches and writes; terminal execution. Not used: hooks,
  sub-agents.
- **Files created:**
  - `clinical-cards/src/clinical-generator.ts` (replaces the stub):
    - `ClinicalGenerationRequest`, `validateClinicalRequest`,
      `generateClinicalDeck` (with a `tamper` test seam), `ClinicalDeckGenerator`;
    - `CLINICAL_SOLITAIRE_TARGET_CARD_COUNT` (15),
      `CLINICAL_COMPETITIVE_TARGET_CARD_COUNT` (24),
      `CLINICAL_SELECTION_ATTEMPTS` (32), `CLINICAL_GENERATION_CODES`.
  - `clinical-cards/tests/fixtures/fake-large-clinical.ts`: an N-disease
    fictitious dataset, plus review-file builders that use the real draft helpers
    (`full`, `category` or `none` topic coverage; alternative reviews for all
    diseases or some).
  - `clinical-cards/tests/c3-generator.test.ts`: 45 tests with an oracle written
    in the test from the raw fixture and the coverage the test chose.
- **Files modified:**
  - `clinical-cards/tests/task18-no-runtime-generation.test.ts` (C-9): the stub
    assertion was replaced by two tests: malformed requests fail without
    throwing, and a property check that every card face, every clinical part of
    a prompt and every explanation is authored source text, verbatim. The other
    8 tests are unchanged. The module-name test is kept until a fallback module
    exists (C4).
  - `shared-engine/tests/task16-direction-and-context.test.ts` (C-8): the 2
    Clinical-generator `it.todo` are now one parameterized real test (two
    directions), with test-only imports from `clinical-cards`. The 4 engine
    todos are unchanged. Task 16 stays unchecked.
  - `.kiro/specs/clinical-cards/requirements.md` (status; Req 3.4 with Q-1),
    `design.md` (status; §2; §4 rule revised for Q-1; alternative reviews; §5 as
    built; §10 Q-1 row), `tasks.md` (C2 accepted with Q-1; C3 left `[ ]` as
    implemented and awaiting approval).
  - `clinical-cards/authoring/AUTHORING.md` (§6, §7 alternative reviews, report
    sections); `clinical-cards/README.md` (status); this log.
- **Design deviation, recorded for owner review:** card ids are neutral (`k1..`,
  seeded order), like Math's, instead of dataset entry ids (design §5.1 step 6).
  Entry ids name the topic and whether an entry is correct or incorrect.
- **Not changed:** `math-cards/` and M2/M3 production code. No tsconfig or
  package changes, and no dependencies.
- **Commands actually run and results:**
  - `npx tsc --build tsconfig.json --force`: exit 0 (after the generator was
    written, and again in the final checks).
  - The generator file write was interrupted once ("input stream was
    interrupted"; nothing was written); it was re-sent in full.
  - One edit was made with a PowerShell `-replace` instead of the edit tool: it
    renamed `best.` to `board.` after the `const board` line, for TypeScript
    narrowing. I checked the result by search.
  - `npm run typecheck:tests`: exit 0.
  - `npx vitest run clinical-cards/tests/c3-generator.test.ts`: first run 45
    passed. I had made two test-side fixes before that run: an array-length
    mismatch in one `toMatchObject`, and a 10-disease dataset for the
    partial-alternatives case.
  - **Mutation checks** (temporary, reverted, then confirmed by search that no
    `TEMP MUTATION` text remains):
    1. Unknown relations treated as invalid in the pool and the matrix: 9 failed,
       36 passed.
    2. Explanations looked up across all topics instead of the challenge's own
       topic: 6 failed, 39 passed.
  - `npx vitest run` (start 09:26:47): 46 files, **2161 passed, 0 failed, 6
    todo**. Previously 2068 passed and 8 todo. The change is +45 (Q-1), +45 (C3),
    +1 (Task 18: 1 replaced by 2), and +2 / −2 todo (Task 16).
  - `npx eslint clinical-cards shared-engine/tests/task16-direction-and-context.test.ts`:
    exit 0.
  - `npx eslint shared-engine math-cards clinical-cards`: exit 1 with only the
    same 2 pre-existing M2 errors.
  - `npm run build -w math-cards`: exit 0. The bundle names are unchanged
    (`index-DV1gMuHt.js`, `index-DqIP83JI.css`).
  - Documentation was edited after the final test run (Markdown only).
- **Observed generator behavior on fictitious data (from the tests):**
  - **16 diseases, all topics reviewed together, alternatives reviewed:** all four
    mode/direction combinations give full 15- and 24-card decks for 30 seeds.
  - **Category-only reviews:** disease + category boards stay within one
    category. Fact → disease in Player vs. Beepy gives a reduced 16-card deck
    (9 + 7 disease names), because unreviewed alternatives are never used.
  - **No reviews:** generation fails with `INSUFFICIENT_CHALLENGES`.
  - **14 diseases, no alternatives:** fact → disease in Player vs. Beepy gives a
    14-card deck (reduced).
  - **12 diseases, no alternatives:** fails with the M2 `INSUFFICIENT_DECK_DATA`.
- **Not run / not applicable:** no browser checks (no UI); no real clinical data.
- **Outcome:** C3 implemented and verified as above. Not marked complete; awaiting
  owner approval. Work stopped. C4–C9 not started.

## 2026-11-12 — M6: owner accepts C3; neutral card ids approved

- **Prompt summary:** "M6 — Accept C3 and authorize C4 only."
- **Owner acceptance of C3:**
  - generation for Solitaire and Player vs. Beepy, in both directions;
  - seeded determinism;
  - the valid / invalid / unknown rules and the Q-1 safeguard;
  - unique cards and exactly one designated answer per challenge;
  - 5-card hands with 2–3 correct answers;
  - reduced validated decks;
  - verbatim, context-specific explanations;
  - structured errors.
  - Reported results accepted: 2161 passed, 0 failed, 6 todo; TypeScript checks;
    Clinical ESLint clean; Math build.
  - C3 is marked `[x]` in `tasks.md`.
- **Owner approval:** neutral generated card ids (`k1..`) instead of dataset entry
  ids, because source ids may reveal topic or correctness. The documentation is
  updated: `design.md` §5 "Ids" now states the private mapping, the public
  boundary and the C6–C7 UI-attribute rule; §5.1 step 6 is marked replaced; §10
  has a new row.

## 2026-11-12 — M6 C4: penalty fallback, Clinical series wrapper, Explain Why (implemented; awaiting owner review)

- **Milestone / objective:** M6 stage C4.
  - A penalty fallback from unused, reviewed entries only.
  - `createClinicalSeries` following the Math pattern.
  - `explainResolved`.
  - Replacement of the obsolete Task 18 fallback-module test.
- **Linked spec / steering:** `.kiro/specs/clinical-cards/` (Req 5, Req 6; design
  §6, §7); all five steering documents.
- **Kiro features actually used:** spec task tracking; steering as constraints;
  agent file reads, searches and writes; terminal execution. Not used: hooks,
  sub-agents.
- **Files created:**
  - `clinical-cards/src/clinical-fallback.ts`: `createClinicalFallbackProvider`.
  - `clinical-cards/src/clinical-series.ts`: `createClinicalSeries`,
    `deriveClinicalGeneratorSeed`, `CLINICAL_SERIES_CODES`,
    `CLINICAL_DEFAULT_BEEPY_ERROR_RATE` (0.2), `ExplainResult`,
    `explainResolved`.
  - `clinical-cards/tests/c4-fallback.test.ts` (12 tests).
  - `clinical-cards/tests/c4-series.test.ts` (41 tests). Moves are chosen from
    visible fictitious text only, like the Math G9 tests. Explain Why is checked
    on every resolved action of 4 full series (two modes × two directions).
- **Files modified:**
  - `clinical-cards/src/clinical-generator.ts`: additive only. `ChallengeSpec`,
    `CardFace`, `RelationFn`, `cardUniverse` and `relationFor` are now exported,
    and two functions were added: `resolveChallengeContext` and
    `authoredExplanation`. Generation logic is unchanged.
  - `clinical-cards/tests/task18-no-runtime-generation.test.ts` (C-9, part 2):
    - "ships no penalty or fallback generation module" is replaced, because a
      fallback now exists by design (C-4).
    - In its place, an exact module check (the only matching module is
      `clinical-fallback.ts`) and a property test: through the real
      `drawPenaltyCards`, fallback cards are unused authored text, unique,
      without explanations; a waiver is allowed, inventing a card is not.
    - The header comment explains the replacement. The other 9 tests are
      unchanged.
  - `.kiro/specs/clinical-cards/requirements.md`, `design.md` (status; ids;
    §6, §7 as built; §10), `tasks.md` (C3 `[x]`; C4 `[ ]`, implemented and
    awaiting approval); `clinical-cards/README.md`; this log.
- **Not changed:** `math-cards/`, M2/M3 production code, tsconfig and package
  files, dependencies.
- **Commands actually run and results:**
  - `npx tsc --build tsconfig.json --force`: first run, 1 error, TS2322 in
    `clinical-series.ts`. The declared failure type was too narrow for the
    engine's `PublicError`. I widened it to `ClinicalSeriesError`; exit 0 after.
  - `npx vitest run clinical-cards/tests/c4-fallback.test.ts`: 12 passed (first
    run).
  - `npx vitest run clinical-cards/tests/c4-series.test.ts`: 41 passed (first
    run).
  - **Mutation checks** (temporary, reverted, then confirmed by search):
    3. The fallback offers unknown candidates (`=== 'valid'` instead of
       `!== 'invalid'`): 7 failed, 46 passed across the two C4 files.
    4. Explain Why substitutes another explanation when none is authored: the
       series file failed at collection. Its full-series play asserts Explain
       Why on every resolved action ("expected available: true to equal
       available: false"); 0 tests ran, 1 suite failed.
    - One search right after reverting 4 still showed the mutation, because it
      ran in parallel with the revert. A second search found none.
  - `npx vitest run` (start 09:50:32): 48 files, **2215 passed, 0 failed, 6
    todo**. That is 2161 + 12 + 41 + 1 (Task 18: 1 test replaced by 2).
  - The Task 18 header-comment edit ran in parallel with that suite run, so I
    re-ran the file: `npx vitest run clinical-cards/tests/task18-no-runtime-generation.test.ts`
    gave 11 passed.
  - `npm run typecheck:tests`: exit 0. `npx eslint clinical-cards`: exit 0.
    `npx eslint shared-engine math-cards clinical-cards`: exit 1 with only the
    same 2 pre-existing M2 errors.
  - `npm run build -w math-cards`: exit 0. The bundle names are unchanged
    (`index-DV1gMuHt.js`, `index-DqIP83JI.css`).
  - Documentation was edited after the final runs (Markdown only).
- **Observed (fictional data):**
  - Solitaire series complete in 5 games; matches end at 3 wins.
  - With an 8-card target, penalty cards drawn after the pile emptied were
    authored entries and never repeated a visible text.
  - With a 2-disease, 1-fact dataset (every usable fact already in the deck),
    penalties were waived with `fallbackStatus: 'EXHAUSTED'`, and all 5 games
    still ended.
  - The leak scan found no `k<n>` ids, entry ids, matrices, designated answers,
    explanations or review data in any view or event.
- **Not run / not applicable:** no browser checks (no UI); no real clinical data.
- **Outcome:** C4 implemented and verified as above. Left unchecked pending owner
  approval. Work stopped. C5–C9 not started.

## 2026-11-12 — M6: owner accepts C4; C5 default-data design approved

- **Prompt summary:** "M6 — Accept C4 and authorize C5 preparation only."
- **Owner acceptance of C4:**
  - the penalty fallback;
  - `createClinicalSeries` for both modes and directions;
  - the default 0.2 Beepy error rate;
  - deterministic generation;
  - context-specific Explain Why;
  - neutral ids and privacy protections;
  - the revised Task 18 tests.
  - Reported results accepted: 2215 passed, 0 failed, 6 todo; TypeScript build
    and test type-check; Clinical ESLint clean; Math build.
  - C4 is marked `[x]` in `tasks.md`.
- **Owner approval (C5 design):**
  - The shipped dataset and review file are the default sources.
  - Both are validated before a game; invalid or unusable content is refused
    with a friendly error.
  - There is no silent fallback to fictional, unreviewed or invented content.
  - Explicit injection is kept for tests.
  - The engine and Math Cards stay unchanged.

## 2026-11-12 — M6 C5 preparation: loading, validation, sufficiency, review-report command (C5 blocked on owner content)

- **Milestone / objective:** C5 preparation only:
  - loading and validation infrastructure for both files;
  - the review-report command;
  - sufficiency checks for both modes and directions;
  - authoring and review instructions;
  - fictional fixtures only.
  - No production dataset was created.
- **Linked spec / steering:** `.kiro/specs/clinical-cards/` (design §7a);
  steering `verified-work-only.md`, `originality-and-copyright.md`,
  `educational-data-independence.md`, `architecture.md`.
- **Kiro features actually used:** spec task tracking; steering as constraints;
  agent file reads, searches and writes; terminal execution. Not used: hooks,
  sub-agents.
- **Files created:**
  - `clinical-cards/src/clinical-data.ts`: `CLINICAL_DATASET_FILE`
    (`clinical-demo.json`), `CLINICAL_REVIEW_FILE` (`clinical-review.json`),
    `CLINICAL_DATA_CODES`, `CLINICAL_DATA_MESSAGES`, `locateJsonError`,
    `parseJsonText`, `loadClinicalContent`.
  - `clinical-cards/src/shipped-data.ts`: `shippedClinicalFiles`,
    `loadShippedClinicalContent`, using an `import.meta.glob` `?raw` eager import
    of `./data/*.json`.
  - `clinical-cards/src/clinical-authoring.ts`: `checkClinicalSufficiency`,
    `formatSufficiency`, `suggestReviewDrafts`, `buildAuthoringOutput`.
  - `clinical-cards/tools/review-report.check.ts` (file I/O only) and
    `clinical-cards/tools/vitest.review.config.ts`.
  - `clinical-cards/tests/c5-content-loading.test.ts`: 34 tests (33 run; 1 is
    the shipped-data gate, skipped while the owner files are absent).
- **Files modified:**
  - `clinical-cards/src/clinical-series.ts`:
    - `dataset` is now optional; without it, the shipped files are loaded.
    - New public codes `CLINICAL_DATA_MISSING` and `CLINICAL_REVIEW_MISSING`;
      the messages come from `CLINICAL_DATA_MESSAGES`.
    - New diagnostic variant `contentIssues`.
    - The injected-review variable was renamed `injectedReview`.
  - `clinical-cards/tsconfig.json`: `"types": ["vite/client"]`.
  - Root `tsconfig.test.json`: includes `clinical-cards/tools/**/*.check.ts`.
  - `clinical-cards/package.json`: a `review-report` script and an updated
    description.
  - `clinical-cards/authoring/AUTHORING.md`: new §2a step-by-step workflow; §2
    file table; the report command.
  - `clinical-cards/README.md`; `.kiro/specs/clinical-cards/requirements.md`,
    `design.md` (status, new §7a, C-10 row), `tasks.md` (C4 `[x]`; C5 marked
    preparation done, blocked, not complete); this log.
- **Not changed:** `math-cards/`, M2/M3 production code, dependencies. The 2
  M2 Task 18 loader `it.todo` remain: they concern a shared M2 loader, not this
  Clinical-only loader.
- **Commands actually run and results:**
  - `npx tsc --build tsconfig.json --force`: exit 0 (after the data modules;
    after the series change; final).
  - **Temporary experiment** `clinical-cards/tests/tmp-glob-raw.test.ts`:
    `import.meta.glob` with `?raw` in Vitest returned the template's JSON text
    (string, 3151 characters), and an empty folder gave `{}`. It passed and was
    deleted.
  - `npm run typecheck:tests`: exit 0.
  - **First C5 test run:** 1 failed, 24 passed, 1 skipped. The syntax-error
    test expected a line and column, but Node 22's `JSON.parse` message for that
    error carries no position.
    - A temporary script `tmp-json-errors.mjs`, run with
      `node tmp-json-errors.mjs` and then deleted, showed that Node 22's
      messages sometimes have no position. Messages of the form
      "Unexpected token …" also repeat the whole source text.
    - **Resolution:** I added `locateJsonError`, a small syntax locator, and
      changed `parseJsonText` to report the file, line, column and a short
      reason without echoing content. I also added 8 tests: 7 located mistakes
      and 1 no-echo check.
  - **Second run:** 2 failed, 31 passed. Both were my column arithmetic in the
    test expectations (16 and 14 are correct, not 17 and 16); the locator was
    right. After correcting them: 33 passed, 1 skipped.
  - `npm run review-report -w clinical-cards` with no owner files: "CLINICAL
    CONTENT CHECK: BLOCKED — clinical-demo.json does not exist yet. Create
    clinical-cards/src/data/clinical-demo.json, starting from …template.json";
    it wrote `review-report.txt` and exited 1. The printed path showed as
    `/C:/…`, so I changed it to use `fileURLToPath`.
  - **End-to-end run on fictional data:**
    - A temporary test (`tmp-write-fictional.test.ts`, then deleted) wrote a
      16-disease fictional dataset and a category-group plus alternative review
      file to `%TEMP%\beepy-c5-fictional`.
    - I then ran the command with `CLINICAL_DATA_DIR` and
      `CLINICAL_REPORT_DIR` set. Result: "VALID"; 16 diseases, 64 topics, 192
      correct facts, 26 distinct names; 480 of 2016 topic pairs reviewed; 160 of
      160 alternatives covered; 4 current topic records and 16 current
      alternative reviews.
    - All four combinations were PLAYABLE for 25/25 seeds at 15 and 24 cards.
      Exit 0. Files written: `review-report.txt` (139961 bytes) and
      `review-drafts.json` (39403 bytes).
  - **Cleanup:** I removed both temp folders and the `clinical-cards/review-output/`
    folder created by the first run, and confirmed by `Test-Path` that they are
    gone. `clinical-cards/src/data/` does not exist.
  - `npx vitest run` (start 11:09:07): 49 files, **2248 passed, 1 skipped, 6
    todo, 0 failed**. That is 2215 + 33; the skipped test is the shipped-data
    gate. The `.check.ts` command file is not part of the normal suite.
  - `npx eslint clinical-cards`: exit 0 (includes `tools/`).
    `npx eslint shared-engine math-cards clinical-cards`: exit 1 with only the
    same 2 pre-existing M2 errors.
  - `npm run build -w math-cards`: exit 0; the bundle names are unchanged.
  - **Not run:** `npm run build -w clinical-cards` (there is no `index.html`
    until C6).
  - Documentation was edited after the final runs (Markdown only).
- **Blocked (owner-authored content required):**
  - `clinical-cards/src/data/clinical-demo.json` (about 16–20 diseases) and
    `clinical-cards/src/data/clinical-review.json`, reviewed by the owner.
  - The C5 gate test, the shipped-data validation and the real sufficiency
    results cannot be run until they exist.
- **Outcome:** C5 preparation is complete and verified as above. C5 is NOT marked
  complete. Work stopped. C6–C9 not started.

## 2026-11-13 — M6 C5: simplified clinical authoring workflow (C5 still incomplete)

- **Date:** the machine clock read 2026-11-13 (backup timestamp
  `2026-11-13T07-49-40`, UTC).
- **Prompt summary:** "M6 C5 — Simplify Clinical JSON authoring."
  - C5 preparation is accepted, and C5 remains incomplete.
  - The owner found the `SubjectCollection` JSON too cumbersome to maintain and
    authorized a simpler disease-oriented format with a converter, a
    blank-disease helper, and migration of their Hereditary Spherocytosis entry.
  - The proposed "Coombs test" incorrect is NOT to be added, and Example
    Disease B is to be removed.
  - The shared schema, generator, validity policy, engine and Math Cards stay
    unchanged.
- **Kiro features actually used:** spec task tracking; steering as constraints;
  agent file reads, searches and writes; terminal execution. Not used: hooks,
  sub-agents.
- **Found at start (owner-authored, read only):**
  - `clinical-cards/src/data/clinical-demo.json`, written by hand.
  - It held Hereditary Spherocytosis, with 1 alternative, 4 categories, 5
    correct facts, and one incorrect ("Coombs test") under Work-up.
  - It also held the template's Example Disease B.
  - It would not have validated: ids with underscores (`hereditary_spherocytosis`),
    three empty `"explanation": ""` fields, and placeholder text.
  - Its SHA-256 began `B1EAC06F…`.
- **Files created:**
  - `clinical-cards/src/clinical-authoring-format.ts`: `convertAuthoring`,
    `convertAuthoringText`, `blankDisease`, `addBlankDisease`,
    `formatAuthoringFile`, `slugify`, `decideOverwrite`, `generatedFingerprint`,
    `AUTHORING_CODES`, `AUTHORING_CATEGORY_FIELDS`.
  - `clinical-cards/tools/io.ts`, `tools/convert-authoring.check.ts`,
    `tools/add-disease.check.ts`.
  - `clinical-cards/authoring/clinical-authoring.template.json`: one blank
    record, all four categories.
  - `clinical-cards/authoring/clinical-authoring.json`: the owner's Hereditary
    Spherocytosis content, moved into the new format.
    - All texts are verbatim.
    - The three empty explanation fields were omitted, since they are not
      content.
    - "Coombs test" was left out as instructed, and Example Disease B was not
      carried over.
  - `clinical-cards/tests/c5-authoring-format.test.ts` (49 tests).
- **Generated by the new command:**
  - `clinical-cards/src/data/clinical-demo.json`: 1 disease, 4 categories, 5
    facts, 1 alternative; content-based ids.
  - `clinical-cards/src/data/clinical-demo.generated.txt`.
  - `clinical-cards/authoring/backups/clinical-demo.2026-11-13T07-49-40.json`:
    a copy of the owner's hand-written file, the same SHA-256 as the original.
- **Files modified:**
  - `clinical-cards/tools/vitest.review.config.ts`: includes `tools/*.check.ts`.
  - `clinical-cards/package.json`: scripts `convert` and `add-disease`;
    `review-report` gains its filename filter.
  - Root `tsconfig.test.json`: includes `clinical-cards/tools/**/*.ts`.
  - `clinical-cards/src/clinical-authoring.ts`: the missing-dataset message now
    points to the new workflow.
  - `clinical-cards/tests/c5-content-loading.test.ts`: the shipped-data tests
    now distinguish "no files", "dataset only, review missing" and "both
    files"; the message assertion was updated.
  - `clinical-cards/authoring/AUTHORING.md`: §2 files table, §2a steps 1 and 1b
    with the new commands, new §2b (simple format), §3 relabelled as the
    generated format.
  - `clinical-cards/README.md`; `.kiro/specs/clinical-cards/design.md` (new
    §7b); `tasks.md` (C5 entry; still unchecked); this log.
- **Not changed:** M2/M3 production code, `clinical-generator.ts`,
  `clinical-review.ts`, `clinical-fallback.ts`, `clinical-series.ts`,
  `math-cards/`, dependencies.
- **Commands actually run and results:**
  - `npx tsc --build tsconfig.json --force`: exit 0 (each time).
  - `npm run typecheck:tests`: first run, 4 errors, TS2352 readonly-to-mutable
    casts in the new test. I changed the casts to go through `unknown`
    (PowerShell `-replace` on `fictional() as {`, 4 replaced). That check had
    run in parallel with the edit, so I re-ran it: exit 0, and 4 casts
    confirmed.
  - `npm run convert -w clinical-cards`, first run: refused. "…clinical-demo.json
    exists and was not written by this command … Nothing was changed"; exit 1;
    the file hash was unchanged.
  - Then, with `CLINICAL_CONVERT_OVERWRITE=1`, as this prompt authorized: the
    backup was written, then `clinical-demo.json`; "Diseases: 1. Categories: 4.
    Facts: 5. Alternative diagnoses: 1."; exit 0. The backup hash equals the
    original.
  - `npm run convert` again: "already up to date"; exit 0; no new backup.
  - `npm run add-disease`, run against a temporary COPY of the authoring file
    (`CLINICAL_AUTHORING_FILE`, `CLINICAL_BACKUP_DIR`, and
    `CLINICAL_DISEASE_NAME` set to a fictional name):
    - It appended a blank record after Hereditary Spherocytosis with empty
      lists, and wrote a backup identical to the original.
    - Exit 0. The temp folder was removed; the owner's file was not modified.
  - `npm run review-report -w clinical-cards` on the converted owner data:
    "VALID (decks limited)"; 1 disease, 4 topics, 5 correct facts; 0 of 6 pairs
    reviewed; all four combinations NOT PLAYABLE (one disease and no review
    file, as expected); exit 0. The `review-output/` folder was removed
    afterwards.
  - Full suite, first run: 1 failed, "two diseases with the same name". It
    produced 3 duplicate-id issues (disease, topic, fact) instead of the one
    root cause.
    - **Fix:** disease-id clashes are now checked first and returned alone.
    - The authoring tests then passed (49).
  - Final `npx vitest run` (start 02:55:00): 50 files, **2297 passed, 2
    skipped, 6 todo, 0 failed**. That is 2248 + 49.
    - Skipped: the all-files gate and the no-files case.
    - The dataset-only case now runs and passes on the owner's converted file.
  - `npx eslint clinical-cards`: exit 0. `npx eslint shared-engine math-cards
    clinical-cards`: exit 1 with only the same 2 pre-existing M2 errors.
  - `npm run build -w math-cards`: exit 0; the bundle names are unchanged.
  - Documentation was edited after the final runs (Markdown only), apart from
    the one message change, which was tested before the final full run.
- **Open for the owner:**
  - "Coombs test" was not added; whether it belongs under Hereditary
    Spherocytosis Work-up `incorrect` is the owner's clinical decision.
  - `clinical-review.json` does not exist yet.
  - About 15–19 more diseases are needed for the planned dataset.
- **Outcome:** the authoring workflow is implemented and verified as above. C5
  remains unchecked. Work stopped. C6–C9 not started.

## 2026-11-14 — M6 C5: diagnosis of the vsBeepy / fact → disease failure (no code or data changed)

- **Prompt summary:** "M6 C5 — Investigate the remaining clinical deck-generation
  failure." Diagnostic only.
- **Observed input (owner files, read only):**
  - 16 diseases, 57 topics, 97 correct facts, no alternative diagnoses.
  - All 16 diseases have a Work-up topic.
  - `clinical-review.json` has one current record covering 16 topics: 12
    Work-up topics, plus the Pathology topics of Anemia of Chronic Disease,
    Aplastic Anemia, Sickle Cell Disease and Hodgkin lymphoma (C(16,2) = 120
    pairs).
  - The file's write time was recent; it was not written by Kiro in this
    session.
- **Commands run:**
  - A temporary read-only test `clinical-cards/tests/tmp-diagnose-f2s.test.ts`.
    The first run failed: it imported `loadShippedClinicalContent` from the
    wrong module. I fixed the import and ran it again (1 passed). Then I
    deleted it and confirmed by `Test-Path` that it is gone.
  - Its "what if" reviews were built in memory only and never written to disk.
- **Findings:**
  - For a Work-up fact of a reviewed disease, 11 other names are reviewed
    invalid; 4 are unknown (the 4 diseases whose Work-up topics are not
    reviewed).
  - For each reviewed Pathology topic, only 3 other names are invalid.
  - Current data: 0/25 decks (`INSUFFICIENT_DECK_DATA`).
  - Hypothetical: adding 2 Work-up topics to the group gives 25/25 decks of 14
    cards; adding all 4 gives 25/25 decks of 16 cards.
- **Conclusion:** the limit comes from review coverage, not a generator defect.
  The recommended fix is a physician review of the 4 unreviewed Work-up topics
  against the 12 reviewed ones, with no code change. Waiting on the owner. C6
  not started.

## 2026-11-14 — M6 C5 complete: physician-approved Work-up revisions; all four combinations playable

- **Prompt summary:** "M6 C5 — Complete Clinical Review Coverage and Verify All
  Four Game Combinations."
  - The physician approved revised Work-up facts for Anemia of Chronic Disease
    and Aplastic Anemia.
  - The physician approved their distinction from the 12 previously reviewed
    Work-up topics and from each other.
- **Authoring file:** the two requested edits were already present in
  `clinical-cards/authoring/clinical-authoring.json` when I read it. It was
  saved by the owner at 02:31, before this session's first check at 02:33
  (SHA-256 prefix `78EE20FC05DF5AC2`). Kiro made no edit to it.
  - Anemia of Chronic Disease · Work-up: "low serum iron and TIBC with normal
    to elevated ferritin", plus the unchanged second fact.
  - Aplastic Anemia · Work-up: the single fact "pancytopenia with
    reticulocytopenia and markedly hypocellular bone marrow containing abundant
    fat cells".
- **Commands and results:**
  - `npm run convert -w clinical-cards`: "Wrote …clinical-demo.json"; 16
    diseases, 57 categories, 96 facts, 0 alternatives; "Review records: 1
    current, 0 stale, 0 invalid"; exit 0.
    - The converter replaced its own previous output, so no override or backup
      was needed.
    - The existing record stayed current: its Work-up topics were unchanged,
      and the two edited Work-up topics were not in it.
  - Temporary test `tmp-draft-workup14.test.ts`, run once and then deleted.
    `draftReviewRecord` produced 14 topics with current fingerprints and 0
    unknown ids. The 12 carried-over fingerprints are identical to the existing
    record.
  - `clinical-cards/src/data/clinical-review.json`: the existing record
    `review.approved-sixteen-workup-and-pathology` is kept unchanged. A second
    record `review.approved-fourteen-workup` was added.
    - It covers the 12 Work-up topics plus Anemia of Chronic Disease and
      Aplastic Anemia Work-up, with fingerprints copied from the tooling output.
    - `reviewedBy` is "Earl_Brown", as in the existing record. `reviewedOn` is
      "2026-11-14", the machine date; the owner did not state the review date.
    - Overlapping records are allowed by the validator, and pairs are covered
      when any current record covers them.
    - No other relationship was attested.
  - `npm run review-report -w clinical-cards`: "VALID"; 16 diseases, 57 topics,
    96 correct facts; 145 of 1596 topic pairs reviewed (120 + 25 new: 2 × 12 +
    1); 2 current records, 0 stale, 0 invalid; exit 0.
    - Solitaire / subjectToFact: 25/25 seeds, 15 cards.
    - vsBeepy / subjectToFact: 25/25 seeds, 20–23 cards.
    - Solitaire / factToSubject: 25/25 seeds, 14 cards.
    - vsBeepy / factToSubject: 25/25 seeds, 14 cards (reduced from 24; no
      padding).
    - The B12/Folate shared Work-up fact is still reported as shared, so it is
      valid for both and never used as a wrong answer between them.
  - `npx vitest run`: 50 files, 2297 passed, 0 failed, 2 skipped, 6 todo.
    - The C5 gate test ("owner files present … both validate, contain no
      placeholder or test text, and are playable") now runs and passes.
    - "clinical-demo.json is exactly its current conversion" passes.
    - The 2 skipped tests are the no-files and dataset-only cases, which no
      longer apply.
  - `npx tsc --build tsconfig.json --force` and `npm run typecheck:tests`: exit
    0. `npx eslint clinical-cards`: exit 0. The full lint shows only the same 2
    pre-existing M2 errors.
  - `npm run build -w math-cards`: exit 0; the bundle names are unchanged
    (`index-DV1gMuHt.js`, `index-DqIP83JI.css`).
  - No `.ts` or `.css` file under `shared-engine/src`, `math-cards/src` or
    `clinical-cards/src` was modified today (checked by `LastWriteTime`).
- **Resolution of `INSUFFICIENT_DECK_DATA`:** with 14 reviewed Work-up topics,
  9-challenge Work-up boards have 5 reviewed-wrong disease names (14 − 9), which
  meets the 14-card minimum. This matches the earlier diagnosis.
- **Outcome:** C5 marked `[x]` in `tasks.md`. C6 not started; awaiting owner
  authorization.

## 2026-11-14 — M6 C6: Clinical Cards app shell and Solitaire board (implemented; owner Chrome check pending)

- **Prompt summary:** "M6 C6 — Implement the Clinical Cards Browser Interface."
  C6 only, following the approved specs.
- **Scope confirmed from the specs** (`tasks.md` C6; `design.md` §8):
  - `index.html`, package scripts (`web-dist`, relative base), copied and
    adapted UI, Clinical theme, wide multi-line cards, disclaimer, data error
    screen.
  - Owner Chrome check: Solitaire in both question styles.
  - Not in C6: Player vs. Beepy, Explain Why, drag-and-drop (C7); final privacy
    and accessibility tests (C8); docs close-out (C9).
- **Kiro features actually used:** spec and task review; steering as constraints;
  agent file reads, searches and writes; terminal execution; a background
  process for `vite preview`. Not used: hooks, sub-agents.
- **Files created** (all under `clinical-cards/`):
  - **Copied unchanged from `math-cards/src/ui` (C-1 A)**, apart from header
    comments: `src/ui/render/dom.ts`, `src/ui/render/beepy-avatar.ts`,
    `src/ui/seed.ts`, `src/ui/styles.css`. The CSS gets an appended "M6 C6:
    Clinical theme" section.
  - **Adapted:** `src/ui/app-state.ts`, `labels.ts`, `feedback.ts`,
    `board-model.ts`, `session.ts`, `app.ts`, `main.ts`, `render/menu.ts`
    (menu, setup, data error screen), `render/board.ts` (Solitaire table).
  - `index.html`.
  - `tests/c6-ui.test.ts` (31 tests).
- **Files modified:** `clinical-cards/package.json` (`build`: `vite build
  --outDir web-dist --base ./ --emptyOutDir`; `preview`: `--outDir web-dist`);
  `clinical-cards/README.md`; `.kiro/specs/clinical-cards/design.md` (§8 as
  built); `tasks.md` (C6 implemented, left unchecked); this log.
- **Not changed** (checked by `LastWriteTime`):
  - `math-cards/` and `shared-engine/src`.
  - The clinical generator, review, fallback, series and data modules.
  - `clinical-demo.json`, `clinical-review.json`, `clinical-authoring.json`:
    their write times (02:31–02:35) are from the C5 step.
  - Dependencies.
- **Commands actually run and results:**
  - `npx tsc --build tsconfig.json --force`: exit 0. `npm run typecheck:tests`:
    exit 0.
  - `npm run build -w clinical-cards`: exit 0. Output `web-dist/index.html`,
    `assets/index-BBg8yeZs.js` (152.30 kB), `assets/index-B6pmuZj2.css`
    (19.33 kB).
  - Bundle inspection:
    - contains the shipped dataset and review record;
    - does not contain the generator's `.generated.txt`, "Math Cards", or any
      `Test Disease` / `Example Disease` text;
    - `index.html` uses `./assets/` paths.
  - **First C6 test run:** 2 failed, 29 passed. Both failures were matches in
    comments: `dom.ts` says it never uses `innerHTML`, and the CSS header says
    "No retro, pixel-art, or 8-bit styling". The two static checks now strip
    comments first. Then 31 passed.
  - `npx vite preview --outDir web-dist --port 4174 --strictPort` (background
    process): `Invoke-WebRequest` got 200 for the page (title correct) and for
    both assets. This proves only that the build is served; it is not a visual
    or interactive check.
  - `npx vitest run` (start 02:51:08): 51 files, 2328 passed, 2 skipped, 6
    todo, 0 failed. That is 2297 + 31.
  - `npx eslint clinical-cards`: exit 0. The full lint shows only the same 2
    pre-existing M2 errors.
  - `npm run build -w math-cards`: exit 0; the bundle names are unchanged
    (`index-DV1gMuHt.js`, `index-DqIP83JI.css`).
- **What the C6 tests cover** (Node, no DOM library, U-2 pattern):
  - Screen flow; label coverage of every engine and Clinical code; the exact
    disclaimer; no dataset text in fixed labels.
  - Prompt splitting for all four categories in both formats, with the text
    unchanged.
  - The board model: no judging (all open challenges are targets alike),
    verbatim text, no ids in labels, scores from the engine.
  - Correctness-only feedback.
  - Full 5-game Solitaire sessions on the SHIPPED data in both question styles
    (3 seeds each), with the test player using a dataset-list oracle:
    - verdicts and scores as expected;
    - no duplicate visible card text;
    - no ids, explanations or review data in any view.
  - Starting hands of 5 distinct cards with 2–3 correct (10 seeds per style).
  - Session guards; refusal of invalid content.
  - Static guards: no `math-cards` import, storage, network, `innerHTML` or
    extra random source; only `session.ts` creates a series; no
    card-id/correctness attributes; the disclaimer on the menu and setup; no
    game on the error screen; the build script; the theme with no
    retro/pixel styling; every board button has a focus key.
- **Not run:** browser rendering and interaction, screen widths, touch, screen
  readers. These are the owner's Chrome check for C6 and the later C8 checks.
- **Open:** the owner Chrome check (Solitaire, both question styles). The
  preview server was left running at http://localhost:4174/ for it.
- **Outcome:** C6 implemented and automated checks pass. It is not marked
  complete until the owner reports the Chrome check. C7 not started.

## 2026-11-14 — M6 C6 accepted: owner Chrome check passed

- **Owner report (manual testing by the owner; not observed by Kiro):** Beepy's
  Clinical Cards was tested in Chrome at http://localhost:4174/ (the production
  preview of the C6 build).
- **Result, as reported:** both Solitaire question styles passed:
  - "Disease + category → fact";
  - "Fact → disease".
  - The board, card selection, correct and incorrect actions, discarding,
    drawing, game progression and session results worked correctly.
- **Not part of this check:** widths, touch and screen readers (C8).
- **Changes:** `.kiro/specs/clinical-cards/tasks.md` (C6 marked `[x]`); this
  log. No code or data changed, and no commands or tests were run for this
  entry.
- **Outcome:** C6 complete. C7 not started; awaiting owner authorization.

## 2026-11-14 — M6 C7: Player vs. Beepy, Explain Why, drag-and-drop (implemented; owner Chrome check pending)

- **Prompt summary:** "M6 C7 — Implement Clinical Cards Player vs. Beepy." C7
  only, per the approved specs.
- **Scope confirmed from the specs:** `tasks.md` C7 is "Player vs. Beepy,
  Explain Why, drag-and-drop", with an owner Chrome check of a full match,
  drag-and-drop and Explain Why. Requirement 8.4 and design §7–§8 define
  Explain Why. All three were implemented; nothing beyond them.
- **Finding:** the shipped `clinical-demo.json` has 0 authored explanations
  (counted by a PowerShell scan of every entry). Per Requirement 8.4, the
  Explain Why button appears only when one exists, so it never appears in the
  shipped app. No explanation text was added. The feature is tested with the
  fictional fixture.
- **Kiro features actually used:** spec and task review; steering as
  constraints; agent file reads, searches and writes; terminal execution; the
  existing background `vite preview` process. Not used: hooks, sub-agents.
- **Files created:**
  - `clinical-cards/src/ui/render/drag.ts`: copied from
    `math-cards/src/ui/render/drag.ts`; the SHA-256 is equal, and a test checks
    that the content is identical.
  - `clinical-cards/tests/c7-vs-beepy.test.ts` (21 tests).
- **Files modified:**
  - `clinical-cards/src/ui/session.ts`:
    - the Beepy scheduler (`BEEPY_THINK_MS`, `Scheduler`, `browserScheduler`);
    - `accept`, `challenge`, `openExplanation`, `closeExplanation`;
    - `completedOutcomes` and the `explain` state.
  - `clinical-cards/src/ui/board-model.ts`: the Beepy, pending and match
    models, solver labels, the score union, and `explain` (never while a move
    is pending).
  - `clinical-cards/src/ui/render/board.ts`: the Beepy bar, the pending panel,
    the nine-challenge board, `data-drop`, the Explain Why button and panel,
    and match results.
  - `clinical-cards/src/ui/app.ts`: vsBeepy enabled, the scheduler, focus on
    Beepy's decision heading, drag-and-drop installed, explain handlers.
  - `clinical-cards/src/ui/main.ts`: passes `browserScheduler`.
  - `clinical-cards/src/ui/styles.css`: appended an "M6 C7" section (5 + 4 /
    3 / 2 column nine-board, the pending card, the explain panel, a
    multi-line drag ghost).
  - `clinical-cards/tests/c6-ui.test.ts`, updated for the C7 API (each change
    is necessary, and none weakens a check):
    - sessions get an inert scheduler;
    - the Solitaire score is narrowed by `kind`;
    - `AVAILABLE_MODES` now expects both modes;
    - only `session.ts` may call `explainResolved`;
    - the focus-key count includes the 2 focusable headings;
    - `drag.ts` is added to the static UI scan.
  - `clinical-cards/README.md`; `.kiro/specs/clinical-cards/design.md` (§8 as
    built for C7); `tasks.md` (C7 implemented, left unchecked); this log.
- **Not changed:** `math-cards/`, `shared-engine/src`, the clinical generator,
  review, fallback, series and data modules, `clinical-demo.json`,
  `clinical-review.json`, `clinical-authoring.json` (their write times are from
  C5), dependencies.
- **Commands actually run and results:**
  - `npx tsc --build tsconfig.json --force`: exit 0.
  - `npm run typecheck:tests`: the first run had errors in the C6 tests (a
    missing `scheduler`, and the score union). After the updates above: exit 0.
  - **First run** of `c6-ui` plus `c7-vs-beepy`: 1 failed, 51 passed. The
    failing test assumed Beepy could move first in Game 1, but the human always
    moves first in Game 1 (master spec §7). I rewrote that test to make one
    human move and then check Beepy's scheduled turn and its cancellation.
    Then 52 passed.
  - **Mutation check:** I removed the "no Explain Why while a move is pending"
    guard in `board-model.ts`. Exactly 1 test failed (the pending guard test).
    I reverted it and confirmed by search that no `TEMP MUTATION` text remains.
  - `npx vitest run` (start 03:21:23): 52 files, **2349 passed, 2 skipped, 6
    todo, 0 failed**. That is 2328 + 21.
  - `npx eslint clinical-cards`: exit 0. The full lint shows only the same 2
    pre-existing M2 errors.
  - `npm run build -w math-cards`: exit 0; the bundle names are unchanged
    (`index-DV1gMuHt.js`, `index-DqIP83JI.css`).
  - `npm run build -w clinical-cards`: exit 0 (`index-wN8YWqMd.js` 163.30 kB,
    `index-BdgjdZ5t.css` 20.86 kB).
  - The running preview (http://localhost:4174/) serves the new bundle (200),
    and it contains "Explain Why" and "Is Beepy right?". This is a served-files
    check only, not a visual one.
- **What the C7 tests cover:**
  - **Full matches** on the shipped data, 3 seeds per question style, using a
    dataset-list oracle with 20% deliberate wrong moves and 25% deliberate
    wrong decisions:
    - best-of-five ending at 3 wins, 3–5 games;
    - alternating turns, with Beepy sometimes first in later games;
    - all four Accept/Challenge outcomes with the required penalties: an
      accepted invalid move makes both draw, a wrong challenge makes the human
      draw, a correct challenge makes Beepy draw (or a truthful waiver);
    - human wrong moves draw a card;
    - 9 challenges; no duplicate visible text; only authored text; no private
      data in views.
  - **Starting hands:** 5 cards each, with 2–3 correct in the human's.
  - **Reduced deck:** fact → disease draws from the reduced 14-card deck (4
    left after dealing).
  - **Beepy's turn:** the 1000 ms think delay and its cancellation on leave;
    Accept and Challenge are inert unless a move is pending.
  - **Explain Why** (fictional fixture): offered only after a resolved play
    that has an authored explanation; the text is hidden until requested and
    verbatim; none for discards or for wrong plays onto other topics; cleared by
    the next step; never while a move is pending.
  - **Drag-and-drop** against a real session: tap vs. drag threshold, drop
    plays through the engine, a drop outside cancels; `drag.ts` is identical to
    Math; drop targets exist only where taps work.
  - **Structure:** identical Accept/Challenge styling; a face-down Beepy hand;
    the 5 + 4 / 3 / 2 layout.
- **Not run:** browser rendering, real pointer drag, touch, screen widths,
  screen readers. These are the owner's C7 Chrome check, and C8.
- **Outcome:** C7 implemented, and the automated checks pass. It is not marked
  complete until the owner reports the Chrome check. C8 not started.

## 2026-11-14 — M6 C7 accepted: owner Chrome check passed

- **Owner report (manual testing by the owner; not observed by Kiro):** Clinical
  Cards Player vs. Beepy was tested in Chrome at http://localhost:4174/ (the
  production preview of the C7 build).
- **Reported as passing:**
  - both question styles, "Disease + category → fact" and "Fact → disease";
  - the nine-challenge shared board, card selection, correct and incorrect
    plays, drawing and discarding;
  - Beepy's turns, Accept and Challenge, and game progression;
  - a completed competitive match with the correct match result;
  - Solitaire still working.
- **Explain Why:** the owner confirmed the button was absent, as expected,
  because the dataset has no authored explanations. Showing and opening an
  explanation was therefore not checked in the browser; it is covered only by
  the automated tests with fictional data.
- **Drag-and-drop:** the owner's report does not mention it explicitly ("card
  selection" was reported). It is recorded here as not explicitly reported. The
  automated drag tests passed in C7.
- **Not part of this check:** screen widths, touch and screen readers (C8).
- **Changes:** `.kiro/specs/clinical-cards/tasks.md` (C7 marked `[x]`, as the
  owner instructed); this log. No code or data changed, and no commands or
  tests were run for this entry.
- **Outcome:** C7 complete. C8 not started; awaiting owner authorization.

## 2026-11-14 — M6 C7: owner drag-and-drop check (addendum)

- **Owner report (manual testing by the owner in Chrome; not observed by Kiro):**
  dragging a card onto a clinical challenge and dragging a card onto the
  discard pile both worked correctly.
- This supersedes the earlier note that drag-and-drop was "not explicitly
  reported". The C7 owner check of drag-and-drop is now recorded as passed.
- Dropping a card on empty space and touch dragging were not mentioned in this
  report; touch belongs to C8.
- **Changes:** this log only. C7 stays `[x]` in `tasks.md`. No code or data
  changed, and no commands or tests were run.
- **Outcome:** C8 not started; awaiting owner authorization.

## 2026-11-14 — M6 C8: privacy and final automated tests; responsive and accessibility fixes (owner manual checks pending)

- **Prompt summary:** "M6 C8 — Clinical Cards Responsive Design, Touch, and
  Accessibility." C8 only.
- **Scope confirmed from the specs:** `tasks.md` C8 is "Privacy and final
  automated tests — Mirror M5 U11/U12; owner manual checks recorded as
  reported". Design §9 item 7 adds privacy, storage/network and import-boundary
  guards like U11, plus keyboard, touch and reduced-motion structure like U12.
  Requirements 8.1–8.2, 8.6 and 10.3 also apply. The prompt's responsive,
  keyboard, touch and screen-reader items were verified within that scope, and
  only defects actually found were fixed. No new features were added.
- **Kiro features actually used:** spec and task review; steering as
  constraints; agent file reads, searches and writes; terminal execution;
  background processes (`npx vite` dev server, then stopped; the existing
  `vite preview`); image reading of headless-Chrome screenshots. Not used:
  hooks, sub-agents.
- **In-browser verification (real rendering, headless Chrome 
  `C:\Program Files\Google\Chrome\Application\chrome.exe`, temporary profile):**
  - **Harness:** a temporary page `clinical-cards/tmp-c8-harness.html` loaded
    the real app and clicked through menu, setup and board (for vsBeepy, through
    to Beepy's pending move). It measured horizontal page overflow, clipped text,
    off-screen controls, the elements past the right edge, the grid column
    count and the focused element.
  - **Narrow widths:** headless Chrome would not size its window below about
    548 px (390 and 320 rendered as 548). True phone widths were therefore
    measured inside an iframe of exact width (`tmp-c8-frame.html`).
  - **First pass** (6 flows at 1440/1100/820, plus 548, plus iframe 390/320):
    two defects found.
    - **A.** vsBeepy at ≥1100 px (measured at 1408 and 1268): page overflow in
      both styles. `div.feedback` reached right=1478 at width 1408. Cause: the
      inherited Math action-row puts the piles plus Beepy's move panel beside
      the messages, and the panel's `auto` text column grew with the long
      clinical text.
    - **B.** vsBeepy at 320 px: `span.card-back` reached right=330.
    - Everything else had no overflow, no clipping and no off-screen controls.
  - **Fixes A and B** (CSS only, `.board--clinical`): for A, at ≥1100 px the
    messages stack under the piles, the panel's text column is
    `minmax(0, 1fr)`, and the piles row wraps; for B, at ≤480 px the card backs
    overlap more and the row clips (the count stays in text and in the label).
  - **Second pass:** 9 widths (1920, 1440, 1300, 1100, 820, 600, and iframe
    390, 360, 320) × 6 flows = 54 combinations, all with overflowX=false and 0
    clipped, off-screen or sticking-out elements.
    - Grid columns: Solitaire 5, then 2 at ≤768 px; vsBeepy 5, then 3 below
      1100 px, then 2 at ≤768 px.
    - Focus starts on a hand card, and is on Beepy's move heading when his move
      is shown.
  - **Screenshots** read as images (kept in `%TEMP%\beepy-c8-shots`): vsBeepy
    desktop 1440, Solitaire fact → disease desktop 1440, vsBeepy fact → disease
    at 390 px.
    - Layout is readable, and long facts wrap.
    - **Defect C** was found here: the discard pile's 4-line clamp showed half
      of a fifth line, because its vertical padding sat inside the clamp box.
  - **Fix C:** solved tiles and the new-card notice show the full text with no
    clamp; the discard pile copy is clamped to 3 whole lines with no vertical
    padding. A re-captured screenshot showed 3 whole lines and an ellipsis.
  - **Fix D (accessibility):** the discard pile's accessible name now includes
    "Top card: <full text>" (`board-model.ts`), because the visual copy is
    clamped.
  - **Cleanup:** the dev server was stopped; both temporary HTML files and the
    temporary Chrome profile were deleted, and their absence was confirmed with
    `Test-Path`.
- **Files modified:**
  - `clinical-cards/src/ui/styles.css`: appended "M6 C8: responsive fixes"
    (A, B) and the small-copy rule (C).
  - `clinical-cards/src/ui/board-model.ts`: the discard accessible name (D).
  - `.kiro/specs/clinical-cards/design.md` (C8 note); `tasks.md` (C8
    automated items checked; owner checks open); this log.
- **Files created:** `clinical-cards/tests/c8-privacy-final.test.ts` (41
  tests).
- **Not changed:** `math-cards/`, `shared-engine/src`, the clinical generator,
  review, fallback, series and data modules, the dataset, generated data,
  review records (their write times are from C5), dependencies. No new clinical
  content.
- **Commands actually run and results:**
  - `npm run typecheck:tests`: exit 0.
  - **C8 tests, first run:** 41 passed.
  - **Mutation check:** I dropped the challenge text from Beepy's pending
    destination label. Exactly 1 test failed (the accessible-names test). I
    reverted it and confirmed by `Select-String` that the line is restored.
  - The first final build and suite ran in parallel with that revert, so I
    re-ran both in sequence. `npm run build -w clinical-cards`: exit 0, with
    the same bundle names both times (`index-CE_sWxj3.js`,
    `index-C8wA5QcL.css`). `npx vitest run` (start 03:54:35): **2390 passed, 2
    skipped, 6 todo, 0 failed**. That is 2349 + 41.
  - `npx tsc --build tsconfig.json --force`: exit 0. `npx eslint
    clinical-cards`: exit 0. The full lint shows only the same 2 pre-existing
    M2 errors.
  - `npm run build -w math-cards`: exit 0; the bundle names are unchanged
    (`index-DV1gMuHt.js`, `index-DqIP83JI.css`).
  - The preview at http://localhost:4174/ serves the C8 bundle (200).
- **What the C8 tests cover:**
  - **U11 mirror on the shipped data:**
    - in 4 vsBeepy games (both styles), at every step against an engine mirror,
      no hidden Beepy or draw-pile card appears in the board model or labels,
      only fixed feedback appears, and Beepy's drawn cards are never in events;
    - a right and a wrong pending Beepy move give identical views, models,
      events, feedback and Explain Why (6 seeds × 2 styles);
    - no targets during a decision; a constant 1000 ms think time;
    - no storage, network, URL changes, unsafe markup or text inputs in any of
      the 13 UI files; no external loads; no seed in snapshots;
    - runtime imports limited to the engine package and three named Clinical
      modules; only `session.ts` creates the series; no judging, policy or deck
      handling in the UI; diagnostics only in development builds.
  - **U12 mirror:**
    - penalty exhaustion in Solitaire with an 8-card target in both styles:
      reviewed fallback cards first, then truthful waivers, and the game still
      ends;
    - vsBeepy waivers never claim a draw;
    - every handler is on a button or radio, and all buttons are
      `type="button"`;
    - Escape cancels a selection or a drag; Beepy's move and explanation
      headings can take focus; no other global shortcuts; focus-ring CSS;
    - a cancelled pointer never plays; `touch-action: pan-x`; the phone hand
      scrolls;
    - reduced motion; the breakpoints and the C8 fix rules;
    - full authored text in challenge, card, discard and pending labels (both
      modes, both styles).
  - **Contrast:** WCAG ratios of 8 theme color pairs, all at least 4.5:1;
    state is not shown by color alone (icons, words, check mark,
    `aria-pressed`).
- **Not run (owner manual checks still pending):**
  - real keyboard-only play in Chrome;
  - width checks by the owner;
  - a real touch device (or Chrome device emulation with touch);
  - a screen reader (for example Windows Narrator or NVDA).
  - The headless measurements above are evidence of layout only, not of
    interaction or announcements.
- **Outcome:** C8's automated part is done. C8 is not marked complete until the
  owner's manual checks pass. C9 not started.

## 2026-11-14 — M6 C8 accepted: owner manual checks passed

- **Owner report (manual testing by the owner; not observed by Kiro):** the C8
  build was tested at http://localhost:4174/ using Chrome, Chrome device
  emulation and Windows Narrator.
- **Results, as reported:**
  - Keyboard-only navigation and gameplay: PASS.
  - Responsive widths 1440, 1024, 768, 390 and 320 px: PASS.
  - Touch-device emulation (card selection, dragging, discarding, invalid
    drops): PASS.
  - Windows Narrator screen-reader testing: PASS.
  - Solitaire regression check: PASS.
- **Scope of this evidence:** touch was tested with Chrome's device emulation,
  not on a physical touch device. The screen reader tested was Windows Narrator
  only.
- **Changes:** `.kiro/specs/clinical-cards/tasks.md` (C8 and its owner-check
  item marked `[x]`); this log. No code or data changed, and no commands or
  tests were run for this entry.
- **Outcome:** C8 complete. C9 not started; awaiting owner authorization.
## 2026-11-14 — M6 C9: documentation and close-out
- **Prompt:** "M6 C9 — Final Clinical Cards Milestone." Proceed with C9 only,
  following the approved spec and task list. Verify, update documentation, log,
  report, and stop. No new features, no gameplay redesign, no added clinical
  explanations, no deployment, no Git or GitHub changes, no Devpost submission.
- **Spec and steering:** `.kiro/specs/clinical-cards/{requirements,design,tasks}.md`
  (C9 entry); steering: verified-work-only, originality-and-copyright,
  no-duplicate-card-invariant, educational-data-independence, architecture.
- **Kiro features used:** spec files (read and status updates), steering rules,
  file read/write/search tools, the terminal, and the existing background
  preview process (terminal 1, `npx vite preview --outDir web-dist --port 4174
  --strictPort` in `clinical-cards`). No hooks were created or used. No
  sub-agents were used.
- **Commands run and observed results:**
  - Review report on the shipped data, written to a temporary folder
    (`$env:TEMP\beepy-c9-report`, deleted afterwards) so the owner's
    `clinical-cards/review-output/` was not overwritten: VALID. 16 diseases, 57
    topics, 96 correct facts, 16 distinct disease names; 145 of 1596 pairs
    reviewed; 2 current review records, 0 stale, 0 invalid.
  - Playability, 25 seeds per combination, all PLAYABLE 25/25:
    solitaire/subjectToFact 15 cards; vsBeepy/subjectToFact 20–23;
    solitaire/factToSubject 14; vsBeepy/factToSubject 14.
  - `npx tsc --build tsconfig.json --force`: exit 0.
    `npm run typecheck:tests`: exit 0.
  - `npx eslint clinical-cards`: 0 problems. `npx eslint math-cards`: 0
    problems. Full lint: only the 2 pre-existing M2 errors
    (`shared-engine/src/issues.ts:43`, `_Issue` unused;
    `shared-engine/src/penalty-draw.ts:276`, `no-unexpected-multiline`). No new
    errors.
  - `npm run build -w math-cards`: exit 0; bundle names unchanged
    (`index-DV1gMuHt.js`, `index-DqIP83JI.css`).
  - `npm run build -w clinical-cards`: exit 0; `web-dist/index.html` (669 B),
    `assets/index-CE_sWxj3.js` (163385 B), `assets/index-C8wA5QcL.css`
    (22080 B). Same bundle names as C8.
  - `npx vitest run` (start 04:08:41): 53 files; **2390 passed, 2 skipped, 6
    todo, 0 failed**.
- **Production bundle audit (Clinical `web-dist`, text search):**
  - 0 matches for: Test Disease, Test Alternative, Example Disease, Replace:,
    Placeholder explanation, tmp-c8, harness, review-output,
    clinical-demo.generated, clinical-authoring, backups, localhost, https://,
    localStorage, sessionStorage, XMLHttpRequest, WebSocket, console.debug,
    Math Cards, local Windows path and profile markers.
  - Benign matches: `<reviewer name>` and `YYYY-MM-DD` are the validator's
    placeholder-detection constants; `http://` is the SVG namespace; `fetch(`
    is Vite's same-origin modulepreload polyfill.
  - The educational disclaimer is present (2 occurrences).
  - **Finding for the owner:** the reviewer name "Earl_Brown" (2 occurrences)
    and the review dates are in the bundle, because `clinical-review.json` is
    bundled whole. Not changed; the owner decides whether this should be public.
  - **Finding for the owner:** `.gitignore` does not list
    `clinical-cards/review-output/` or `clinical-cards/authoring/backups/`.
    Neither is bundled. Not changed; reported as a recommendation.
- **Files modified:**
  - `clinical-cards/README.md` (rewritten for the finished app);
  - `clinical-cards/package.json` (description);
  - root `README.md` (rewritten; M6 status);
  - root `package.json` (description names both demos);
  - `docs/devpost-submission.md` (M6 header, Clinical section, completed work,
    testing evidence, limitations, checklist with two new owner decisions);
  - `.kiro/specs/clinical-cards/requirements.md`, `design.md`, `tasks.md`
    (stale status lines updated; C9 marked `[x]`);
  - this log.
  - No changes to Math Cards, the shared engine, clinical content, or review
    records.
- **Automated tests vs. owner manual tests (M6):**
  - Kiro ran the automated checks: Vitest suites, TypeScript, ESLint, builds,
    review report and playability runs, and in C8 a headless-Chrome layout
    measurement (layout evidence only).
  - The owner ran the manual Chrome checks, recorded only as reported: C6
    Solitaire; C7 vsBeepy plus a drag-and-drop addendum; C8 keyboard-only play,
    widths 1440/1024/768/390/320, touch-device emulation, Windows Narrator, and
    a Solitaire regression check. All reported PASS. Kiro did not observe them.
  - No browser, touch or screen-reader checks were run by Kiro in C9.
- **Close-out, final counts (M1–M6):**
  - Workspaces: `shared-engine`, `math-cards`, `clinical-cards`.
  - Test suite: 53 files; 2390 passed, 2 skipped, 6 todo, 0 failed.
  - Clinical dataset: 16 physician-authored diseases, 57 topics, 96 correct
    facts, 0 authored explanations; 2 review records.
  - Clinical Cards: Solitaire and vsBeepy, both question styles, all four
    combinations playable on the shipped data.
- **Known limitations:**
  - The dataset has no authored explanations, so Explain Why does not appear;
    none were added.
  - Touch was tested only by Chrome device emulation; the screen reader tested
    was Windows Narrator only.
  - Game state is client-side and can be inspected with browser developer
    tools.
  - Neither app is deployed.
  - 2 pre-existing M2 lint errors remain; 6 todo tests remain (Task 18 loader).
  - Teaching Edition (single-disease, four-category Solitaire) and Tutor Mode
    are deferred to a separate post-hackathon project.
- **Outcome:** C9 is done. M6 awaits the owner's final acceptance. Stopped; no
  further work until the owner authorizes it.

---

## 2026-11-14 — Post-M6 repository documentation preparation (outside Kiro)

- **Scope:** following final M6 acceptance, the owner provided an archived
  complete project for publication preparation with ChatGPT. No further Kiro
  development was requested or performed in this step.
- **Files reviewed:** root `.gitignore`, `README.md`, `LICENSE`,
  `docs/devpost-submission.md`, this log, and the six `.kiro/specs/` folders.
  Git's ignore rules selected 197 source/documentation files from the archived
  workspace. The excluded folders include dependencies, build output, authoring
  backups, and generated clinical review reports.
- **Changes (documentation only):** removed one unnecessary Windows-profile
  identifier from the earlier C9 audit log entry; corrected the Devpost draft's
  list from five to six Kiro specifications; clarified Kiro's real contribution,
  owner-authored clinical review, and the post-submission status of Tutor Mode
  and single-disease Solitaire; updated completed `.gitignore` and reviewer
  attribution checklist items; noted the unresolved dating question for any
  pre-existing specification or teaching text; earlier concept discussions on
  October 27, 2026 were identified for disclosure, separate from newly written
  code.
- **Owner decision:** the physician reviewer name and review dates remain
  public by the owner's express preference. Review JSON and clinical data
  were not edited.
- **Verification:** file/ignore-list inspection only; no new TypeScript,
  Vitest, lint, browser, or production-build runs in this documentation pass.
  Previously reported Kiro validation (2390 passed, 2 skipped, 6 todo) is
  historical M6 evidence, not a new run here. No GitHub push or deployment.
- **Prior-work evidence:** the user had discussed the shared-engine and two-app
  concept by October 27, 2026. A saved master specification v1.1 is dated
  November 8, 2026; the first logged Kiro project creation was November 9.
  Earlier conceptual planning is explicitly distinguished from project code.
- **Open owner confirmation:** confirm whether any exact clinical fact wording,
  earlier v1.0 specification text, or other incorporated material predates the
  October 30, 2026 submission-period start so the final Devpost disclosure
  can be accurate.
