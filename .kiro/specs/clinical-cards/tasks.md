# Beepy's Clinical Cards — Tasks (M6)

The owner approved the plan with revisions on 2026-11-12 (`design.md` §10).
All accepted on 2026-11-12:
- C0 and C1;
- C2, with the Q-1 alternative-diagnosis safeguard;
- C3, with neutral card ids;
- C4.

**Current status (2026-11-14):** C5–C8 were later authorized and accepted by the
owner. C9 was authorized on 2026-11-14 and is done; final M6 acceptance is the
owner's. (Earlier: "Authorized: C5 preparation only", superseded.) Each stage
ends with verification, a log entry, and a stop for owner review. Real commands
and results only; owner browser checks are recorded only as the owner reports them.

Standing verification for every code stage: `npx tsc --build tsconfig.json
--force`, `npm run typecheck:tests`, `npx vitest run`, ESLint on new and changed
files, and `npm run build -w math-cards` (Math must stay green and unchanged).

- [x] C0. Planning decisions and approval documentation (no code)
  - Record approval of C-1, C-2, C-4, C-5, C-7–C-11, C-13, C-14 as recommended.
  - Record the revised C-3 (reviewed policy; unknown never justifies a
    distractor; review report), C-6 (16–20 diseases; 15 / 24 targets; name-pool
    limit; real sizes tested; never pad), C-12 (140 characters), and the
    `subjectIncorrects` terminology.
  - Update `requirements.md`, `design.md`, `tasks.md` consistently; log it.

- [x] C1. Clinical content validation foundation (45 new tests passing; awaiting owner review)
  - `clinical-cards/src/clinical-content.ts`: the four categories, limits
    (1–3 corrects, 140-character card text), `CLINICAL_CONTENT_CODES`, and
    `validateClinicalCollection` on top of `validateCollectionSource` with exact
    paths (`design.md` §3).
  - `clinical-cards/tests/fixtures/fake-clinical.ts`: fictitious test dataset.
  - `clinical-cards/authoring/clinical-dataset.template.json` (fictitious
    placeholders only) and `clinical-cards/authoring/AUTHORING.md` (authoring,
    terminology, how to find shared facts and record cross-disease applicability,
    without supplying medical knowledge).
  - Tests (`clinical-cards/tests/c1-content-validation.test.ts`): each rule with
    exact code and path; boundaries; M2 pass-through; fixture and template pass.
  - No tsconfig change (template read from disk in tests; JSON import is C5).

- [x] C2. Review records, validity policy, review report (accepted by the owner, 2026-11-12)
  - Q-1 safeguard (added before C3, owner-required): alternative diagnoses are
    unknown unless a current `alternativeReviews` record covers them; fingerprint
    over the disease's correct facts and the covered alternative texts; stale on
    change; report sections 2, 5 and 7b; `draftAlternativeReview`; template
    updated; `tests/q1-alternative-reviews.test.ts`.
  - `src/clinical-review.ts`: review-file validation with attestation, topic
    fingerprints and stale detection, the §4 policy for facts and disease names,
    the M2 matrix bridge, draft/renewal records, the review report and its text
    rendering.
  - `authoring/clinical-review.template.json`; `AUTHORING.md` §7 updated.
  - Tests (`tests/c2-review-and-validity.test.ts`, fixture
    `tests/fixtures/fake-review-dataset.ts`): hand-worked relation tables; absence
    never yields "invalid"; shared and cross-category relations; coverage;
    stale reviews; malformed files and records; report contents; templates.

- [x] C3. Generator (accepted by the owner, 2026-11-12; neutral card ids approved)
  - Replace the stub; `ClinicalGenerationRequest` (C-14); both directions; sizing;
    full matrix with no unknown pairs; contextual explanations; self-check.
  - C-9: the stub assertion in the Task 18 Clinical test is replaced by stronger
    tests. The module-name test is unchanged until a fallback module exists (C4).
  - C-8: the 2 Clinical Task 16 todos are converted (Task 16 stays unchecked;
    4 engine todos remain).
  - Tests: `tests/c3-generator.test.ts` and fixture
    `tests/fixtures/fake-large-clinical.ts`.

- [x] C4. Fallback and series wrapper (accepted by the owner, 2026-11-12)
  - `src/clinical-fallback.ts`, `src/clinical-series.ts` with `explainResolved`.
  - Generator exports for reuse: `cardUniverse`, `relationFor`,
    `resolveChallengeContext`, `authoredExplanation`.
  - C-9 completed: the obsolete Task 18 "no fallback module" test is replaced
    by an exact module check and a fallback-through-penalty-draw property test.
  - Tests: `tests/c4-fallback.test.ts`, `tests/c4-series.test.ts` (full
    simulated sessions and matches with Explain Why checked on every resolved
    action).

- [x] C5. Shipped dataset (completed 2026-11-14: 16 owner-reviewed diseases, 96 correct facts; all four combinations playable 25/25; C5 gate test passing)
  - Done (preparation, design §7a): `src/clinical-data.ts`, `src/shipped-data.ts`,
    `src/clinical-authoring.ts`, series default to shipped data, the
    `review-report` command (`tools/`), `AUTHORING.md` §2a workflow,
    `tests/c5-content-loading.test.ts`.
  - Blocked: `clinical-cards/src/data/clinical-demo.json` and
    `clinical-review.json` must be authored and reviewed by the owner. The
    shipped-data gate test is skipped until they exist.
  - Authoring workflow (owner-authorized, 2026-11-12; design §7b): simplified
    `authoring/clinical-authoring.json`, `src/clinical-authoring-format.ts`,
    `npm run add-disease` / `npm run convert`, overwrite protection,
    `tests/c5-authoring-format.test.ts`.
    - The owner's Hereditary Spherocytosis entry was moved into the new format.
      The proposed "Coombs test" incorrect was left out for owner review, and
      Example Disease B was removed.
    - `clinical-demo.json` is now generated (1 disease). `clinical-review.json`
      does not exist yet.
  - Original plan below. `resolveJsonModule` was replaced by `?raw` glob plus
    `vite/client` types; `demo-data.ts` is named `shipped-data.ts`.
  - Owner supplies `src/data/clinical-demo.json` (about 16–20 diseases) and
    `src/data/clinical-review.json`. Kiro does not author or edit clinical text;
    it only reports validator issues and the review report back.
  - `resolveJsonModule` in `clinical-cards/tsconfig.json` and root
    `tsconfig.test.json`; `src/demo-data.ts`.
  - Tests: shipped data validates; measured achievable deck sizes for both modes
    and both directions over many seeds, reported to the owner.

- [x] C6. App shell and Solitaire board (completed 2026-11-14; owner Chrome check passed for both question styles)
  - `index.html`, package scripts (`web-dist`, relative base), copied/adapted UI,
    Clinical theme, wide multi-line cards, disclaimer, data error screen.
  - Owner Chrome check: Solitaire in both question styles.
  - Done: `clinical-cards/index.html`; `src/ui/` (app-state, labels, feedback,
    board-model, session, app, main, seed; render/board, menu, dom,
    beepy-avatar; styles.css); `tests/c6-ui.test.ts` (31 tests); `npm run build
    -w clinical-cards` succeeds.
  - Player vs. Beepy is listed as "Coming soon" (C7).

- [x] C7. Player vs. Beepy, Explain Why, drag-and-drop (completed 2026-11-14 on the owner's Chrome acceptance; see the log for exactly what was reported)
  - Owner Chrome check: a full match; drag-and-drop; Explain Why.
  - Done: Player vs. Beepy enabled for both question styles (9 challenges as
    5 + 4, Beepy bar, pending panel with Accept/Challenge, match results);
    Explain Why after resolved plays only; drag-and-drop (`render/drag.ts`,
    the Math module unchanged); `tests/c7-vs-beepy.test.ts` (21 tests); C6
    tests updated for the C7 API.
  - Note: the shipped dataset has 0 authored explanations, so the Explain Why
    button never appears in the shipped app. It is tested with the fictional
    fixture.

- [x] C8. Privacy and final automated tests (completed 2026-11-14; owner manual checks passed)
  - Mirror M5 U11/U12; owner manual checks recorded as reported.
  - [x] Automated: `tests/c8-privacy-final.test.ts` (41 tests). It covers:
    - the U11 mirror: hidden Beepy cards checked against an engine mirror,
      pending-move indistinguishability, no storage/network/URL/markup, no seed
      exposure, import boundary, dev-only diagnostics;
    - the U12 mirror: penalty exhaustion, keyboard structure, touch cancel,
      reduced motion, breakpoints, accessible names;
    - WCAG contrast of the theme colors.
  - [x] In-browser layout measurement (headless Chrome, temporary harness):
    54 flow/width combinations with no overflow, clipping or off-screen
    controls after 3 CSS fixes; the discard pile's accessible name now
    includes its top card.
  - [x] Owner manual checks (2026-11-14, as reported by the owner): keyboard-only
    play, widths 1440/1024/768/390/320, touch-device emulation, Windows Narrator,
    and a Solitaire regression check, all passed.

- [x] C9. Documentation and close-out (completed 2026-11-14; final M6 acceptance pending with the owner)
  - [x] Verification: review report VALID; all four combinations PLAYABLE
    (25/25 seeds each); `tsc --build --force` and `typecheck:tests` exit 0;
    ESLint clean on `clinical-cards` and `math-cards` (full lint shows only the
    2 pre-existing M2 errors); `npx vitest run` 2390 passed, 2 skipped, 6 todo,
    0 failed; Math build hashes unchanged; Clinical production build succeeded.
  - [x] Production bundle audit: no test/placeholder content, dev artifacts,
    local paths, storage or network APIs. The reviewer name and review dates
    are present (the review file is bundled); flagged for the owner's decision.
  - [x] Docs: `clinical-cards/README.md`, root `README.md`, both package
    descriptions, `docs/devpost-submission.md`, spec status lines.
  - [x] Log close-out with final counts in `docs/kiro-development-log.md`.

## Deferred (documented only, not authorized)
- Tutor Mode, after Clinical Cards.
- Educational rewards ("Top Problem Solver"); win rules unchanged.
- Shared UI extraction and Math migration.
- Browser JSON import (Task 18 loader todos), local learning history, controlled
  repetition, deployment.
