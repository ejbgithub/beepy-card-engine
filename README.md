# Beepy Educational Card Game Engine

A browser-based, subject-neutral **educational card-game engine** built for
**Kiroween 2026** (Skeleton Crew category) with the Kiro IDE. One engine powers
two separate games:

- **Beepy's Math Cards** (`math-cards/`): an addition card game for second
  graders.
- **Beepy's Clinical Cards** (`clinical-cards/`): a disease-based, high-yield
  clinical fact game for medical students, with physician-authored and reviewed
  content. It is not an NBME-style question bank.

Both apps offer Solitaire and Player vs. Beepy. "Beepy" is the recurring
character and computer opponent.

## Status (end of Milestone M6, 2026-11-14)

| Part | Status |
|---|---|
| Shared engine (`shared-engine/`) | Implemented and tested: Solitaire and Player vs. Beepy |
| Math Cards (`math-cards/`) | Generator and browser app implemented, tested, owner-accepted in Chrome (M4–M5) |
| Clinical Cards (`clinical-cards/`) | Content tooling, generator, fallback, series and browser app implemented, tested, owner-accepted in Chrome (M6) |
| Clinical content | 16 hematology diseases, 96 correct facts, 2 current physician review records |
| Tutor Mode, Player vs. Player | Not implemented |
| Hosting / deployment | Not done |

## How it fits together

```text
beepy-card-engine/
  .kiro/
    specs/         # Kiro specs per milestone (requirements, design, tasks)
    steering/      # architecture and policy guidance used by Kiro
    hooks/         # none created (placeholder only)
  shared-engine/   # subject-neutral engine: schema, validation, game rules, controller
  math-cards/      # Math deck generator + the Beepy's Math Cards browser app
  clinical-cards/  # clinical content tooling, generator, review policy + the Clinical Cards app
  docs/
    master-spec-v1.1.md        # authoritative specification
    kiro-development-log.md    # chronological, evidence-based development journal
    devpost-submission.md      # reusable, factual submission summary
  README.md, LICENSE (MIT)
```

- **Educational data → generator → validated deck → engine → sanitized view → UI.**
  - App-specific generators turn subject content into a validated deck plus a
    complete "which card answers which challenge" matrix.
  - The engine checks every deck again, then deals, judges, applies penalties,
    and decides winners.
- **The engine is subject-neutral.** It knows nothing about math or medicine.
  Both apps use it unchanged.
- **The UI never sees the answer key.** It talks to a trusted series layer that
  returns only sanitized views and public events.
- **Deterministic:** the same seed and the same moves replay the same game.

Each package has its own README:
[`shared-engine/`](shared-engine/README.md),
[`math-cards/`](math-cards/README.md),
[`clinical-cards/`](clinical-cards/README.md).

## Beepy's Math Cards in brief

- **Modes:** Solitaire (five problems, five-game session, score = turns + cards
  left) and Player vs. Beepy (nine shared problems, Accept/Challenge on Beepy's
  moves, best of five).
- **Levels:** Small numbers, Small + big numbers, Big numbers, and Mix it up.
  Sums never exceed 99.
- **Question styles:** "Solve the problem" (`3 + 4 = ?` → `7`) and "Find the
  matching addition" (`7` → `3 + 4`).

Full rules: [`math-cards/README.md`](math-cards/README.md).

## Beepy's Clinical Cards in brief

- **Question styles:** "Disease + category → fact" and "Fact → disease". The
  categories are Classic Signs & Symptoms, Work-up, Pathology and
  Management/Treatment.
- **Modes:** the same Solitaire and Player vs. Beepy rules as Math, with nine
  shared challenges in a responsive grid.
- **Correctness:** a card counts as wrong only when the data or a physician
  review says so. Unreviewed relationships are never used as wrong answers, and
  stale reviews are excluded automatically. Decks shrink rather than pad when
  reviewed content is limited.
- **Explain Why:** shows an authored explanation after a resolved play. The
  current dataset has none, so the button does not appear yet.
- A disclaimer is shown: "For study practice only. Not medical advice."

Details: [`clinical-cards/README.md`](clinical-cards/README.md).

## Development

Requirements: Node.js 20 or newer and npm.

```bash
npm install                         # install dev dependencies (once)
npm run dev -w math-cards           # Math Cards dev server: http://localhost:5173/
npm run build -w math-cards         # static build -> math-cards/web-dist/
npm run build -w clinical-cards     # static build -> clinical-cards/web-dist/
npm run preview -w clinical-cards   # serve the Clinical build

npx tsc --build tsconfig.json       # type-check all workspaces
npm run typecheck:tests             # type-check the test files
npm test                            # run every Vitest suite once
npx eslint shared-engine math-cards clinical-cards
```

For Clinical development, run `npx vite` from `clinical-cards/`. The Clinical
authoring commands are in [`clinical-cards/README.md`](clinical-cards/README.md).

**Lint status:** all code written in M3–M6 lints clean. The full command above
reports **2 pre-existing errors in M2 files** (`shared-engine/src/issues.ts`: an
unused compile-time check type; `shared-engine/src/penalty-draw.ts`: a
line-break style rule). Both are style issues with no behavior impact, left
unchanged pending an owner decision.

**Static hosting:** both `web-dist/` folders use relative asset paths and need
no server code. Nothing has been deployed yet.

Technology: TypeScript (strict), Vite, npm workspaces, Vitest, ESLint, Prettier.
The UI is plain TypeScript, HTML, and CSS (no UI framework). There are no runtime
dependencies.

## Testing

- **Automated** (Vitest), final M6 run on 2026-11-14: **2390 passed, 0 failed,
  2 skipped, 6 todo**.
  - The 2 skipped tests are shipped-data cases that no longer apply (no data
    files, and a dataset without a review file).
  - The 6 todo are deliberately deferred M2 placeholders: 4 for engine judging,
    now tested in the M3 suites, whose conversion awaits an owner decision; 2
    for a future shared data loader.
  - The TypeScript build, test type-check and both Vite builds pass.
- **Owner-observed in Chrome (Math, M5):**
  - full Solitaire sessions;
  - a full Player vs. Beepy match with all four Accept/Challenge outcomes;
  - drag-and-drop and keyboard-only play;
  - layouts at 375–1280 px;
  - simulated touch.
- **Owner-observed in Chrome (Clinical, M6):**
  - Solitaire and Player vs. Beepy in both question styles, including a full
    match;
  - drag-and-drop onto challenges and Discard;
  - keyboard-only play;
  - widths 1440, 1024, 768, 390 and 320 px;
  - touch via Chrome device emulation;
  - Windows Narrator.

Details, test names, and every issue found are in
[`docs/kiro-development-log.md`](docs/kiro-development-log.md).

## Known limitations

- Tutor Mode, Player vs. Player, progress saving and educational rewards are not
  implemented.
- Neither app has been tested on a physical touchscreen device. Clinical was
  tested with Windows Narrator only; Math had no full screen-reader test. There
  has been no comprehensive accessibility audit.
- The Clinical dataset has no explanations yet, so Explain Why has been tested
  only with fictional data.
- These are client-side apps, so game state can be inspected with browser
  developer tools. It is hidden from the normal interface, not secret. The
  Clinical bundle includes the review file, with the reviewer's name and dates.
- Not yet deployed.

## Roadmap (documented, not implemented)

1. **Tutor Mode:** a human tutor evaluates a student's proposed move before the
   engine resolves it, with tutor accuracy tracked separately.
2. **Teaching Edition (Clinical, post-hackathon):** a single-disease,
   four-category Solitaire redesign.
3. **Educational rewards:** recognize correct answers and the player who solves
   more challenges, separately from the unchanged win rule.

## License and acknowledgements

Released under the [MIT License](LICENSE).

Inspired by an earlier (2018) Beepy project
([video](https://youtu.be/qOLjLOyOygM)). All code and artwork here are new work
created for Kiroween 2026. Nothing from the 2018 project, including its video or
artwork, is reused, and no ownership of it is claimed. The clinical content was
written and reviewed by the project owner, not generated by AI.
