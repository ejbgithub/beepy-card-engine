# Beepy Educational Card Game Engine — Devpost submission summary

A factual, reusable summary for the Kiroween 2026 (Skeleton Crew) submission.
Everything below describes the state at the end of Milestone M6 (2026-11-14):
two playable apps on one engine. Verify against the live official rules before
publishing.

## Inspiration

Beepy began as a 2018 educational project
([original video](https://youtu.be/qOLjLOyOygM)). This entry is a new
implementation inspired by that idea. The 2018 video, code, and artwork are not
included in or reused by the new application.

## Pre-existing work and submission-period disclosure

- **Earlier inspiration and planning:** an earlier Beepy educational project
  dates to 2018. The shared-engine/two-application concept was discussed by
  October 27, 2026, before the competition's October 30 development window.
  This concept and early planning should be disclosed as pre-period work, not
  represented as software built during the event. The 2018 video, code, and
  artwork are not included in the new implementation.
- **Work completed within the period:** the master specification v1.1 was saved
  on November 8, 2026; the Kiro development log documents the newly created
  project files and implementation during November 9–14, 2026. No existing
  2018 implementation was copied into this repository. The exact date of the
  earlier v1.0 specification draft is not established.
- **Owner confirmation before Devpost submission:** confirm whether any exact
  clinical teaching fact wording incorporated into this dataset was written
  before October 30, 2026, or whether any other pre-existing material was
  incorporated beyond the concept and planning above. Disclose such work
  accurately; do not label it newly created during the event. This remains
  open until the owner confirms it.
- Tutor Mode and the single-disease/four-category Clinical Teaching Edition are
  future ideas, not delivered features in this hackathon build.

## What it does

**Beepy's Math Cards** is an addition card game for second graders that runs in
the browser.
- Children match addition problems with answer cards: "Solve the problem"
  (`3 + 4 = ?` → `7`) or "Find the matching addition" (`7` → `3 + 4`).
- Four levels: single digits, single + double digits, double digits, and a mix.
  Sums never exceed 99.
- **Solitaire:** five problems and a five-card hand. A wrong play or discard costs
  a penalty card. Score = turns + cards left, over a five-game session.
- **Player vs. Beepy:** nine shared problems.
  - Beepy, a robot opponent, sometimes makes deliberate mistakes.
  - The child decides whether to **Accept** or **Challenge** each Beepy move,
    which turns checking someone else's arithmetic into part of the game.
  - The first player to empty their hand wins; the match is best of five.
- Every game gets a fresh, validated deck. Each problem has exactly one correct
  card, no two cards show the same value, and distractors are believable
  near-misses.
- Controls: tap/click, drag-and-drop, and keyboard. There are child-friendly
  feedback messages and original vector artwork of Beepy.

## The shared engine and the second application

The core is a **subject-neutral engine** (`shared-engine/`). It contains no math:
- a common `subject → topics → corrects/incorrects` content format;
- deck validation (one answer per challenge, unique cards across all zones,
  valid starting hands, deck-size rules);
- seeded deterministic dealing, judging, penalties with a bounded fallback,
  Solitaire scoring, competitive endings and tiebreaks, and best-of-five
  matches;
- a trusted controller that gives the interface only sanitized views and public
  events.

Math-specific logic lives in `math-cards/`. Clinical-specific logic lives in
`clinical-cards/`. The engine is used unchanged by both.

**Beepy's Clinical Cards** is a disease-based, high-yield fact game for medical
students. It is not an NBME-style question bank: there are no vignettes or
stems.
- **Content:** 16 hematology diseases and 96 correct facts across four
  categories (Classic Signs & Symptoms, Work-up, Pathology,
  Management/Treatment), written and physician-reviewed by the project owner.
  No AI-written clinical content; text is shown exactly as authored.
- **Question styles:** "Disease + category → fact" and "Fact → disease", in
  Solitaire and Player vs. Beepy with the same rules as Math.
- **Clinical correctness:** a card is used as a wrong answer only when the data
  or a physician review says it is wrong. Unreviewed relationships stay
  "unknown" and are never used. Review records are fingerprinted and become
  stale automatically when reviewed facts change. Shared facts count as correct
  for every disease that lists them.
- **Decks shrink rather than pad:** Player vs. Beepy with fact → disease uses
  validated 14-card decks.
- **Authoring tooling** for the owner: a simple JSON format with a converter, a
  validator with exact error locations, and a review report that lists shared
  facts, unreviewed pairs, stale reviews and deck sufficiency. It makes no
  clinical judgments.
- **Explain Why** shows an authored explanation only after a resolved play. The
  current dataset has none yet.

## What is actually complete

- Shared engine for Solitaire and Player vs. Beepy (M2 data/validation, M3
  engine).
- Math deck generator (M4) and the Math Cards browser app (M5).
- Clinical Cards (M6):
  - content validation, review policy and tooling;
  - the generator, penalty fallback and series layer;
  - the 16-disease reviewed dataset;
  - the browser app with both modes, both styles, drag-and-drop, keyboard play
    and responsive layouts down to 320 px.

**Not complete:** Tutor Mode, Player vs. Player, progress saving, educational
rewards, clinical explanations, hosting/deployment, and the demo video.

## How we used Kiro

- **Six milestone specifications.** Kiro worked from requirements, design, and
  tasks files in `.kiro/specs/` for `foundation-setup`,
  `educational-data-schema`, `game-engine`, `math-deck-generator`,
  `math-cards-ui`, and `clinical-cards`. The owner reviewed specifications and
  their revisions before implementation. Milestones were developed with
  explicit approval gates, including separate Clinical Cards stages C0–C9.
- **Steering documents** (`.kiro/steering/`) set standing rules:
  - architecture and dependency direction;
  - the no-duplicate-card invariant;
  - separation of educational data from the engine;
  - originality and copyright boundaries;
  - "record only verified work".
- **Agent implementation and debugging:** Kiro wrote and revised the shared
  engine, Math Cards, Clinical Cards, data validators and generators, authoring
  utilities, browser interfaces, and automated tests. It ran TypeScript,
  Vitest, ESLint, and Vite commands, investigated failing tests, inspected
  generated decks and browser layouts, and fixed verified defects. The
  chronological `docs/kiro-development-log.md` records actual observations,
  changes, issues, and resolutions.
- **Clinical review boundary:** the owner authored the clinical facts and
  explicitly approved the medical applicability reviews. Kiro implemented the
  review records and fingerprints after approval; it did not independently
  certify clinical relationships. The published `.kiro/specs/clinical-cards/`
  files document the clinical milestones.
- **No Kiro hooks were created.** The hooks folder holds only a placeholder.
- **Owner-in-the-loop verification:** the owner manually tested the games in
  Chrome and reviewed the clinical content; those reported checks are recorded
  separately from Kiro's automated tests. Later repository preparation and
  submission logistics are handled outside Kiro, not presented as Kiro work.

## Challenges we ran into

- **Contextual correctness.** A card that is "correct" for one problem must not
  also answer another. The generator supplies a complete card-by-challenge
  validity matrix, and the engine re-validates every deck.
- **Deck size versus plausibility.** A 24-card competitive deck is a target, not
  a guarantee. For example, with single digits the eligible pool can support only
  20–24 cards. An early counting claim of ours was wrong and was corrected after
  the owner's review; sizes are now planned from the actual eligible pool.
- **No hints in the interface.** The interface must never reveal whether Beepy's
  pending move is correct, whether through styling, focus, timing, accessible
  labels, or drag highlighting. Dedicated tests compare right and wrong pending
  moves and find identical views apart from the card itself.
- **Penalty exhaustion.** When no unique card can be drawn, the penalty is waived
  and the game says so. It never reuses a card or pretends one was drawn.
- **Desktop layout.** The competitive screen was first too tall for a desktop
  window. It was rearranged (header and Beepy side by side, a horizontal decision
  panel) without shrinking cards or text.
- **Development workflow.** Several times, edits that the agent reported were
  later missing from disk: some were reverted while awaiting approval, and some
  writes from interrupted turns didn't persist. We worked around this by checking
  the disk after every interruption, rewriting whole files when recovering, never
  running a test in the same batch as the write it depends on, and recording each
  case in the log. We have not verified the cause.

## Testing evidence

- **Automated (end of M6, 2026-11-14):** 2390 Vitest tests passed, 0 failed, 2
  skipped (shipped-data cases that no longer apply), 6 deliberately deferred.
  - The TypeScript build, test type-check and both Vite production builds pass.
  - ESLint is clean on all M3–M6 code and reports 2 pre-existing style errors
    in M2 files (no behavior impact).
  - Clinical highlights:
    - full matches and sessions on the real dataset, judged by an independent
      oracle;
    - an engine mirror proving Beepy's hidden cards never reach the interface;
    - mutation checks;
    - in-browser layout measurement at 9 widths from 1920 to 320 px.
- **Owner-observed, Clinical (Chrome):**
  - both modes in both question styles, including a full match;
  - drag-and-drop;
  - keyboard-only play;
  - widths 1440–320 px;
  - touch via device emulation;
  - Windows Narrator.
- **Math (end of M5), earlier highlights:**
  - an invariant simulation of 320 full engine games;
  - a test-only "mirror" of the engine proving Beepy's hidden cards never reach
    the interface;
  - independent arithmetic oracles for the generator;
  - full simulated sessions and matches through the interface logic.
- **Owner-observed in Chrome:**
  - full Solitaire sessions;
  - a full Player vs. Beepy match with all four Accept/Challenge outcomes;
  - mouse drag-and-drop;
  - keyboard-only play;
  - layouts at 375, 768, 1024, and 1280 px;
  - simulated touch in Chrome device emulation.

## Known limitations

- Not tested on a physical touchscreen device. Clinical was screen-reader tested
  with Windows Narrator only; there has been no comprehensive accessibility
  audit.
- The waived-penalty case is verified by automated tests only.
- Clinical Explain Why has no explanations in the current dataset, so it has
  been tested only with fictional data.
- These are client-side apps, so game state can be inspected with browser
  developer tools. The Clinical bundle includes the review file, with the
  reviewer's name and dates.
- Not yet deployed.

## What's next (separate post-hackathon work, not part of this submission)

1. **Clinical Teaching Edition:** redesign Solitaire around one disease per
   game, with Signs, Work-up, Pathology, and Management as its four targets.
2. **Tutor Mode:** adapt that educational experience for one-on-one tutoring,
   with a human tutor evaluating student moves and tutor accuracy tracked
   separately.
3. **Educational rewards:** recognize correct answers and the player who solves
   more problems, independently of the existing win rule.

## Built with

TypeScript, Vite, Vitest, ESLint, Prettier, npm workspaces, plain HTML/CSS/DOM,
and the Kiro IDE. MIT licensed.

## Submission checklist (still outstanding)

- [ ] Publish a public GitHub repository, including the root `.kiro/` directory,
      the two application folders, and the MIT `LICENSE`. **Git has not been used
      yet.**
- [ ] Deploy both apps to public URLs (static builds in `math-cards/web-dist/`
      and `clinical-cards/web-dist/`).
- [x] The master spec's core target of **two working applications** on one
      shared engine is met (M6, 2026-11-14).
- [x] The owner approved public display of the physician reviewer's name and
      dates in `clinical-review.json`, including their presence in the Clinical
      production bundle.
- [x] Exclude `clinical-cards/review-output/` and
      `clinical-cards/authoring/backups/` from Git using `.gitignore`; preserve
      `.kiro/` and the reviewed clinical data.
- [ ] Record a public YouTube demo of **under three minutes**.
- [ ] Finalize the Devpost description from this factual draft, including the
      pre-existing-work disclosure after owner confirmation.
- [x] Re-check the live official Kiroween rules (IP, originality and deadline
      **December 4, 2026 at 2:00 PM Pacific / 5:00 PM Eastern**) on November 14,
      2026. Review again before final submission if requirements change.
- [ ] Confirm the drafting dates of any pre-October 30 master-specification or
      clinical teaching material incorporated into this project and disclose
      pre-existing work accurately. Earlier conceptual planning on October 27
      is already acknowledged above.
- [ ] Export Kiro chat or session history as supporting evidence, if desired.
