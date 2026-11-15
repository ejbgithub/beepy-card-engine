# Beepy Math Cards Browser Interface — Tasks

All tasks are unchecked. Nothing is authorized until the owner approves
`requirements.md`, `design.md`, and decisions U-1 to U-11. After approval the tasks
run in order; stop and ask only if a new architectural decision or an integration
defect in M2–M4 appears. Mark a task complete only after its checks pass, and log
each task when verified. No new dependencies, no Git, no `npm audit fix`, no
Clinical, Tutor, or Player vs. Player.

- [x] U0. Owner approval of this spec and decisions U-1 to U-11 (granted 2026-11-11; staged: U0–U6 authorized)

- [x] U1. App shell and build plumbing (U-6) (tsc, vite build 38 modules, suite 1762 unchanged)
  - `math-cards/index.html`, `src/ui/main.ts` (placeholder mount),
    `src/ui/styles.css` (base), the `build`/`preview` scripts, and `web-dist/` in
    `.gitignore`
  - Checks: `npx tsc --build tsconfig.json --force`; `npm run build -w math-cards`
    produces `web-dist/` with relative asset paths, and `@beepy/shared-engine`
    resolves; the existing suite is unchanged
  - _Requirement 1_

- [x] U2. Screen flow and labels (ui-u2: 30/30 passed)
  - `src/ui/app-state.ts`, `src/ui/labels.ts`
  - Tests: every transition; unknown intents ignored; a label for every level,
    style, mode, end reason, and public error code; Tutor and vsPlayer are absent
    from the menu model
  - _Requirements 2, 7.3_

- [x] U3. Board model and feedback (ui-u3: 23/23 passed, real engine views and events)
  - `src/ui/board-model.ts`, `src/ui/feedback.ts`
  - Tests: Solitaire and vsBeepy models built from real views; solved, solver,
    selection, and disabled states; the pending panel only while
    `awaitingEvaluation`; header values equal view and series fields; every feedback
    row built from real events, including both-draw, waived, and not-applied
  - **Non-leak:** pending-valid and pending-invalid models are identical except for
    the card face and destination text; no model contains data absent from its view
  - _Requirements 3, 5.2, 6, 7.4, 8.3_

- [x] U4. Session orchestrator (ui-u4: 29/29 passed, incl. 16 full simulated series)
  - `src/ui/session.ts`, `src/ui/seed.ts`; scheduler interface with browser and
    test implementations
  - Tests: select, cancel, play, discard; busy-guard; selection cleared after
    actions; the Beepy scheduler flow; `leave()` cancels the timer; public errors
    become friendly states
  - Full simulated series through the orchestrator (choosing only via the board
    model) for both modes × both styles × every level, with a test-only step limit
  - _Requirements 4.3, 4.4, 5.1, 5.3, 10_

- [x] U5. Menu and setup screens (build, type-check, lint, vite build passed; dev server serves the app; visual check by the owner pending in U6/U12)
  - `src/ui/render/dom.ts`, `src/ui/render/menu.ts`
  - Checks: build, type-check, lint; the screens render in the dev server
    (observed by the owner in U12)
  - _Requirement 2_

- [x] U6. Solitaire board with click/tap and keyboard (first playable) — automated checks passed; **owner's Chrome smoke test PASSED for the tested Solitaire functionality (2026-11-11)**. Not yet tested, so carried to U9/U12: keyboard-only navigation, narrow-screen layouts, touch interaction, the final penalty-waiver message
  - `src/ui/render/board.ts` (Solitaire layout), selection, play, discard, cancel,
    feedback banner (live region), header
  - Checks: build, type-check, lint, and a `vite build`; owner smoke check of one
    Solitaire game
  - _Requirements 3.1, 3.3–3.5, 4, 6_

- [x] U7. Player vs. Beepy board, Beepy's turns, Accept/Challenge — automated checks passed; **owner's Chrome match test PASSED for the tested functionality (2026-11-11; match ended You 0 – Beepy 3)**
  - Beepy avatar and count, nine-challenge layout, the "thinking" state, the pending
    panel, focus management (to the panel heading only)
  - Checks: as U6; owner smoke check of one match
  - _Requirements 3.2, 5_

- [x] U8. Results and series screens (model tests and build passed; results, match summary, Play a new match, and Main menu observed working in the owner's Chrome match test)
  - `src/ui/render/results.ts`: Solitaire game over and session summary;
    competitive game over (winner and reason) and match summary; Next game, Play
    again, Main menu; quit confirmation (U-11)
  - Checks: board-model and app-state tests for results data; build
  - _Requirement 7_

- [x] U9. Visual polish, responsive layouts, reduced motion, Beepy art (U-9) — automated checks passed (ui-u9: 28/28, contrast pairs AA); **owner's Chrome visual review APPROVED (2026-11-12), including the desktop vs Beepy refinement at 100% zoom**. Still unverified: narrow widths, touch, keyboard-only, reduced motion
  - `styles.css`, `src/ui/render/beepy-avatar.ts`
  - Checks: build; contrast pairs checked against WCAG AA ratios with a small
    test-time calculation over the CSS color tokens; owner check at 1280, 1024,
    768, and 375 px
  - _Requirement 9_
  - **Owner-approved U9 improvements (2026-11-11, from the U6 browser test):**
    1. In `subjectToFact` ("Find the matching addition"), show only the target
       number on each challenge (for example `10`) instead of "Which addition
       expression equals 10?". Keep descriptive accessible labels. Do not change the
       challenge data or the judging.
    2. Make a newly drawn penalty card immediately visible or clearly discoverable
       when the hand is large (cards were appearing below the visible screen). Keep
       the layout, card sizes, and vertical spacing where possible; no unnecessary
       redesign or compression; do not auto-scroll the whole page away from the
       board. Use a simple, child-friendly solution and verify it in Chrome.
    3. (Owner, after the U7 test) Use horizontal space better on the Player vs.
       Beepy desktop screen, which is unnecessarily tall with unused space at the
       sides (around the piles, Beepy's move panel, feedback, and the hand). Keep
       the style, card readability, and ownership colors. Don't redesign Solitaire
       or compress everything just to avoid scrolling. Keep narrow screens working.
    4. Replace the temporary Beepy with the original polished artwork (no retro,
       pixel, or 8-bit style).

- [x] U10. Drag and drop (U-7) — automated checks passed (ui-u10: 14/14); **owner's Chrome mouse test APPROVED (2026-11-12)**. Not tested: real touch devices, comprehensive keyboard-only play
  - `src/ui/render/drag.ts`: pointer events, pointer capture, drop targets, cancel
    on miss; uses the same session intents
  - Checks: build, lint; owner check with mouse and touch emulation
  - _Requirement 4.2_

- [x] U11. Architecture and privacy guard tests (ui-u11: 20/20 passed; mutation probe caught injected storage use and a forbidden import; no production code changed)
  - Import boundary for `src/ui/**`; `createMathSeries` only in `session.ts`;
    `crypto.getRandomValues` only in `seed.ts`; no parsing, judging, or generator
    functions in the UI; diagnostics not wired outside dev; the M4 source scan still
    passes
  - _Requirements 8, 11.2_

- [x] U12. Build and manual browser test pass — automated verification (ui-u12: 12/12; full suite 1929 passed; build and preview served) and **owner's Chrome checks APPROVED (2026-11-12)**: keyboard-only play, 375/768/1024/1280 px layouts, simulated touch. Not performed: physical touch device, full screen-reader testing, manual reproduction of the penalty waiver (automated only), comprehensive accessibility audit
  - Run `npm run build -w math-cards` (observed). The owner runs the design's
    manual checklist and reports results; issues found are fixed and re-checked
  - _Requirements 11.3, 11.4_

- [x] U13. Documentation and report (READMEs, Devpost summary, development log finalized; final checks: tsc, typecheck:tests, Vite build pass; 1929 passed / 0 failed / 8 todo; ESLint clean on M3–M5 code, 2 pre-existing M2 style errors reported, not changed)
  - `math-cards/README.md` (how to run, how to play, the privacy limit);
    `docs/kiro-development-log.md`; this file. Final checks:
    `npx tsc --build tsconfig.json --force`, `npm run typecheck:tests`,
    `npx vitest run`, ESLint on new and changed files, `vite build`; consolidated
    M5 report
  - _Requirements 1.4, 8.6, 11.5_

## Playable checkpoints
- After U6: Solitaire is playable at every level in both styles (click/tap).
- After U8: the full required game is playable, both modes, with results.
- U9–U13: polish, drag, guards, build, manual pass, documentation.

## Future design item (documented only; NOT authorized; not part of M5)

**Educational rewards** (owner, 2026-11-11). Recognize mathematical achievement
separately from winning the card game:
- celebrate individual correct answers with brief positive feedback or subtle
  visual rewards;
- track and recognize the player who correctly solves more problems;
- consider a "Top Problem Solver" distinction and cumulative math-achievement
  indicators;
- let a child be recognized for solving more problems even when Beepy wins by
  emptying its hand first.

Constraints when it is designed: no change to the first-to-empty-hand rule, the
best-of-five match rule, scoring, engine contracts, or win conditions. It will be
designed and authorized separately.

## Future design item (documented only; NOT authorized; not part of M5)

**Tutor Mode, proposed M6** (owner, 2026-11-12). Implement it in the shared engine,
test it first in Math Cards, then reuse it in Clinical Cards. A human tutor
evaluates a student's proposed action (Accept/Challenge) before the engine
resolves it, with tutor performance tracked separately and its own feedback. The
exact rules require a design review first (the M3 Requirement 13 notes and master
spec §6 are the starting point). Both this and the educational-rewards item above
remain unimplemented.
