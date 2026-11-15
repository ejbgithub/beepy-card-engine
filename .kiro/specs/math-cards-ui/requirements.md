# Beepy Math Cards Browser Interface — Requirements

**Milestone:** M5 — the first playable Beepy Math Cards browser app (master spec
§13, §18 phases 3 and 5, Math side). Follows M4 (Math deck generator), which is
accepted.

**Scope boundary (specification only):** These documents define what M5 will build
and verify. They do not authorize implementation. All tasks stay unchecked until
the owner approves `requirements.md`, `design.md`, `tasks.md`, and the decisions in
`design.md`.

## Introduction

Build a modern, polished browser game that a second-grade student can play on
their own: Solitaire and Player vs. Beepy, every approved Math level, and both
question styles. The app is a thin presentation layer over `createMathSeries`
(M4). The engine (M3) and the generator (M4) still decide every rule. The UI only
shows sanitized views and public events and forwards the player's choices.

Authoritative references: `docs/master-spec-v1.1.md` §2–§7, §9, §10, §12, §13, §16;
`.kiro/specs/game-engine/` (views, events, controller privacy boundary);
`.kiro/specs/math-deck-generator/` (`createMathSeries`, levels, directions);
steering `architecture.md`, `no-duplicate-card-invariant.md`,
`educational-data-independence.md`, `originality-and-copyright.md`,
`verified-work-only.md`.

## Out of scope for M5

Clinical Cards; Tutor mode and its Continue step; Player vs. Player; accounts,
cloud services, and any network use; persistent progress and controlled repetition;
"Explain Why" and any explanation text; sound; hosting and deployment (M6); new
runtime or development dependencies; changes to M2, M3, or M4 production behavior
(except a separately approved fix for a demonstrated integration defect); Git;
`npm audit fix`.

## Requirements

### Requirement 1 — App shell and build
1. The app SHALL run from `math-cards/` with the existing Vite tooling: a dev server
   and a static production build that works from any folder (relative asset paths).
2. It SHALL use plain TypeScript, HTML, and CSS (decision U-1). No new dependency.
3. The static build output SHALL not collide with the TypeScript build output
   (`math-cards/dist`) (decision U-6).
4. All new production code SHALL pass the full TypeScript build, the test
   type-check, and ESLint.

### Requirement 2 — Main menu and game setup
1. The main menu SHALL offer Solitaire and Player vs. Beepy only. Tutor and Player
   vs. Player SHALL NOT appear.
2. Setup SHALL offer the four approved levels (one-digit, one-digit + two-digit,
   two-digit, mixed) and both question styles (`factToSubject`, `subjectToFact`),
   with child-friendly labels and an example for each (decision U-8).
3. For vsBeepy, Beepy's mistake rate SHALL use the M4 default (0.2). M5 adds no
   difficulty setting for Beepy.
4. Starting SHALL create a new series with `createMathSeries` and deal Game 1. A
   setup error SHALL show a friendly message and keep the player on setup.

### Requirement 3 — The board
1. Solitaire SHALL show five challenges in one row, the draw-pile count and the
   discard pile centered beneath, and the hand along the bottom (master spec §13).
2. Player vs. Beepy SHALL show Beepy (avatar and a face-down hand showing only its
   count) at the top, nine shared challenges in a readable arrangement, centered
   piles, and the human hand at the bottom.
3. Every challenge SHALL show its prompt exactly as the engine provides it. Solved
   challenges SHALL stay visible, show the card that solved them, be visibly
   inactive, and (competitive) show who solved them.
4. The hand SHALL show every card in the view, in the order the engine gives
   (decision U-10). Number cards are compact; expression cards are wider.
5. A status area SHALL show whose turn it is, the turn count, and the draw-pile
   count. Solitaire shows the game number (1–5) and the session score so far;
   competitive shows the game number, wins for each player, and challenges credited
   to each player.

### Requirement 4 — Playing cards
1. The player SHALL select a card, then select an open challenge to play it there or
   the discard pile to discard it. The selected card SHALL be highlighted. Selecting
   it again, pressing Escape, or a Cancel control SHALL clear the selection with no
   penalty.
2. Click/tap selection SHALL be supported first. Drag-and-drop SHALL also be
   supported, built on pointer events so it works with touch (decision U-7).
   Keyboard play SHALL be possible (Tab, Enter/Space, Escape).
3. The UI SHALL NOT pre-judge: every open challenge and the discard pile accept any
   selected card. Only the engine judges.
4. Controls SHALL be disabled when the player cannot act (Beepy's turn, a pending
   decision, game over, or while a request is being processed).

### Requirement 5 — Beepy's turn and Accept/Challenge
1. On Beepy's turn the UI SHALL show that Beepy is thinking, wait briefly
   (decision U-4), then call `advanceBeepy()`.
2. The pending action SHALL show only Beepy's attempted card and its destination,
   with Accept and Challenge buttons next to it. Nothing on screen (text, color,
   order, focus, timing, or accessible names) SHALL hint at whether it is valid.
3. The result SHALL be shown only after the human decides, from the resolution
   events.
4. The competitive rules SHALL come entirely from the engine, including the §7
   table, empty-hand wins checked before penalty draws, fewer cards, and the credit
   tiebreak. The UI only displays them.

### Requirement 6 — Feedback
1. After each resolution the UI SHALL show a short, age-appropriate message built
   only from public events: valid or invalid, which challenge was solved and by
   whom, who drew a penalty card, a waived penalty, a penalty not applied because
   the game ended, and the game ending.
2. Correct and incorrect outcomes SHALL be visually distinct (color and an icon or
   word, never color alone), and announced to assistive technology through a live
   region.
3. Feedback SHALL NOT include explanations, the correct answer, or any arithmetic
   done by the UI (decision U-3). Feedback text SHALL be a fixed message table
   written for this app, not generated content.
4. A penalty card the human draws SHALL be shown arriving in the hand. Beepy's
   penalty card SHALL only increase Beepy's card count.

### Requirement 7 — Results and series flow
1. Solitaire game over SHALL show turns taken, cards left, and the game score
   (turns + cards left, lower is better), using the outcome as given, plus the
   running session total. After game 5 a session summary SHALL list all five
   scores and the total.
2. Competitive game over SHALL show the winner and why (emptied hand, fewer cards,
   or more challenges solved), both hand counts and credits, and the match score.
   After the match is decided, a match summary SHALL show the winner and each game.
3. Players SHALL be able to start the next game, start a new session or match with
   the same settings, and return to the main menu. Leaving a game in progress SHALL
   ask for confirmation.
4. All scores, counts, and winners SHALL come from the engine's outcome and series
   status. The UI SHALL NOT recompute them.

### Requirement 8 — Privacy and integration
1. The UI SHALL use only `createMathSeries` and its public methods, plus public
   types and constants. It SHALL NOT import engine internals, the generator, or the
   fallback providers.
2. The UI SHALL NOT judge, deal, score, detect wins, or compute answers. Automated
   checks SHALL enforce the import boundary (Requirement 11).
3. Nothing beyond the sanitized view and public events SHALL reach the DOM: no
   deck, matrix, designations, hidden cards, seeds, or diagnostics. Card handles may
   appear as opaque attributes.
4. The series seed SHALL come from the browser's random source in one UI module and
   SHALL NOT be shown on screen, in the URL, or in storage (decision U-5).
5. The trusted diagnostics callback SHALL NOT be connected to the UI. In
   development builds it MAY log to the console (decision U-5).
6. The documentation SHALL state the inherent limit: in a static browser app, the
   deck lives in page memory, and a user with developer tools can inspect it. The
   boundary prevents leaks through the UI's data path only.

### Requirement 9 — Visual design and accessibility
1. A modern, polished look with no retro, pixel-art, or 8-bit styling. Beepy SHALL
   be an original illustration created for this project (decision U-9).
2. Text SHALL be large and readable for a second grader. Text and controls SHALL
   meet WCAG 2.1 AA contrast targets, and touch targets SHALL be at least 44 × 44
   CSS pixels.
3. All interactive elements SHALL be real buttons with visible focus and accessible
   names that reveal no correctness. The board SHALL be usable with a keyboard.
4. Motion SHALL be short and SHALL respect `prefers-reduced-motion`.
5. Desktop first, with responsive layouts for tablets and phones. The nine-challenge
   board SHALL stay readable at narrow widths.
6. Full WCAG compliance needs manual testing with assistive technologies and an
   expert review; M5 covers the automated and manual checks listed in the design.

### Requirement 10 — Robustness
1. Every public error SHALL be shown as a friendly message, and the app SHALL stay
   usable (retry, or return to the menu).
2. Rapid repeated clicks SHALL NOT send duplicate requests.
3. A pending Beepy timer SHALL be cancelled when the player leaves the game.

### Requirement 11 — Testing and evidence
1. Automated tests (Vitest, Node environment, no new dependency) SHALL cover the
   pure UI layers: screen flow, board model, feedback messages, the session
   orchestrator, and full simulated games through the orchestrator for both modes
   and both styles.
2. Automated guard tests SHALL check the import boundary, that the seed source
   exists in exactly one UI module, and that rendered board models contain no
   private data.
3. The production build (`vite build`) SHALL be run and observed.
4. A manual browser test checklist SHALL be run by the owner, who can see the
   screen. The development log SHALL record only what was actually observed.
5. M2, M3, and M4 tests SHALL stay green and unchanged.
