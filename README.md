# Beepy Card Engine

A browser-based, subject-neutral **educational card-game engine** developed for **Kiroween 2026** in the **Skeleton Crew** category using the Kiro IDE.

**One shared engine powers two educational applications:**

- **Beepy's Math Cards** (`math-cards/`): An addition card game designed for second-grade students.
- **Beepy's Clinical Cards** (`clinical-cards/`): A disease-based, high-yield clinical fact game for medical students, with physician-authored and reviewed content. It is not an NBME-style question bank.

Both applications offer **Solitaire** and **Player vs. Beepy** modes. Beepy is the recurring character and computer opponent.

## Play the Games

Both applications are publicly deployed and can be played directly in a web browser without registration or installation.

**Beepy's Math Cards:**  
https://beepy-math-cards.netlify.app/

**Beepy's Clinical Cards:**  
https://beepy-clinical-cards.netlify.app/

**Kiroween 2026 demonstration video:**  
https://youtu.be/3QzE9GrPU84

## Project Status (November 15, 2026)

| Part | Status |
|---|---|
| Shared engine (`shared-engine/`) | Implemented and tested: Solitaire and Player vs. Beepy |
| Math Cards (`math-cards/`) | Generator and browser application implemented, tested, and owner-accepted in Chrome (M4–M5) |
| Clinical Cards (`clinical-cards/`) | Content tooling, generator, fallback, series, and browser application implemented, tested, and owner-accepted in Chrome (M6) |
| Clinical content | 16 hematology diseases, 96 correct facts, 2 current physician review records |
| Automated testing | 2,390 passing tests in the final M6 verification |
| Hosting / deployment | Both applications publicly deployed on Netlify |
| Tutor Mode / Player vs. Player | Not implemented; potential future enhancements |

## How It Fits Together

```text
beepy-card-engine/
  .kiro/
    specs/          # Kiro specifications (requirements, design, tasks)
    steering/       # Architecture and policy guidance used by Kiro
    hooks/          # No hooks created (placeholder only)
  shared-engine/    # Subject-neutral engine: schema, validation, rules, controller
  math-cards/       # Math deck generator and browser application
  clinical-cards/   # Clinical content tools, generator, review policy, and app
  docs/
    master-spec-v1.1.md       # Authoritative specification
    kiro-development-log.md   # Chronological development evidence
    devpost-submission.md     # Reusable submission summary
  README.md
  LICENSE           # MIT License
```

**Educational data → generator → validated deck → engine → sanitized view → UI**

- App-specific generators turn educational content into validated decks and complete answer-relationship matrices.
- The shared engine validates decks, manages turns, judges moves, applies penalties, and determines winners.
- The engine is subject-neutral: it contains no mathematics-specific or medicine-specific rules.
- The normal UI does not receive the answer key. It communicates with a series layer that provides sanitized views and public events.
- Given the same seed and moves, the engine supports deterministic gameplay replay.

Each package has its own documentation:

- [Shared engine](shared-engine/README.md)
- [Math Cards](math-cards/README.md)
- [Clinical Cards](clinical-cards/README.md)

## Beepy's Math Cards

Math Cards helps second-grade students practice addition through interactive card-game mechanics.

**Gameplay modes:**

- **Solitaire:** Five addition problems per round, with scoring based on turns taken and cards remaining.
- **Player vs. Beepy:** Nine shared problems, Accept/Challenge decisions on Beepy's moves, and best-of-five competitive matches.

**Difficulty levels:**

- Small numbers
- Small + big numbers
- Big numbers
- Mix it up

Sums do not exceed 99.

**Question styles:**

- Solve the problem: `3 + 4 = ?` → `7`
- Find the matching addition: `7` → `3 + 4`

Play online: https://beepy-math-cards.netlify.app/

Full documentation: [math-cards/README.md](math-cards/README.md).

## Beepy's Clinical Cards

Clinical Cards helps medical students reinforce high-yield associations between diseases and clinical facts.

The initial dataset contains **16 hematologic disorders and 96 correct clinical facts**, with physician-authored and reviewed educational content.

**Question styles:**

- Disease + category → clinical fact
- Clinical fact → disease

The four educational categories are:

1. Classic Signs & Symptoms
2. Work-up
3. Pathology
4. Management/Treatment

**Gameplay modes:**

- Solitaire
- Player vs. Beepy, including nine shared challenges in a responsive grid

The underlying game mechanics are shared with Math Cards.

**Content correctness and review:**

- A card is treated as an incorrect answer only when supported by the content data or a physician review.
- Unreviewed relationships are never used as incorrect answers.
- Stale reviews are automatically excluded.
- Generated decks shrink rather than introduce unsupported incorrect relationships when reviewed content is limited.

**Explain Why:** The engine supports authored explanations after resolved plays. The current dataset does not include explanations, so this feature is not displayed in the deployed application.

The application displays the disclaimer:

*For study practice only. Not medical advice.*

Play online: https://beepy-clinical-cards.netlify.app/

Full documentation: [clinical-cards/README.md](clinical-cards/README.md).

## How Kiro Was Used

Kiro was used as the primary AI-assisted development environment for implementing the shared engine and both educational applications.

The project followed a specification-driven development process, with detailed gameplay requirements translated into implementation specifications, code, and automated tests.

**Kiro features used:**

- **Kiro IDE:** AI-assisted implementation, debugging, refinement, and testing.
- **Kiro Specs:** Six development specifications documenting requirements, design decisions, and implementation tasks.
- **Kiro Steering:** Persistent architecture and policy instructions to maintain consistency across the shared engine and applications.

**Kiro hooks were not implemented.** The `.kiro/hooks/` directory contains only a placeholder. No claims are made that hooks were used in the completed development workflow.

The project includes a chronological development journal documenting milestones, Kiro-assisted work, tests, problems encountered, and resolutions.

Development evidence: [docs/kiro-development-log.md](docs/kiro-development-log.md).

## Development

**Requirements:** Node.js 20 or newer and npm.

```bash
npm install
npm run dev -w math-cards
npm run build -w math-cards
npm run build -w clinical-cards
npm run preview -w clinical-cards

npx tsc --build tsconfig.json
npm run typecheck:tests
npm test
npx eslint shared-engine math-cards clinical-cards
```

The Math Cards development server runs at `http://localhost:5173/` by default.

Static builds are generated in:

- `math-cards/web-dist/`
- `clinical-cards/web-dist/`

For Clinical Cards development, run `npx vite` from `clinical-cards/`. Clinical content authoring commands are documented in [clinical-cards/README.md](clinical-cards/README.md).

**Lint status:** Code written during milestones M3–M6 passes linting. The full lint command reports two existing style issues in M2 files:

- `shared-engine/src/issues.ts`: Unused compile-time check type.
- `shared-engine/src/penalty-draw.ts`: Line-break formatting rule.

Neither issue affects gameplay behavior. Both were left unchanged pending an owner decision.

**Static hosting:** Both applications use relative asset paths, require no server-side application code, and are deployed using Netlify.

**Technology stack:** TypeScript (strict), Vite, npm workspaces, Vitest, ESLint, and Prettier.

The user interface uses plain TypeScript, HTML, and CSS without a UI framework. The applications have no runtime package dependencies.

## Testing

**Final automated verification — November 14, 2026**

- **2,390 tests passed**
- **0 tests failed**
- **2 tests skipped**
- **6 tests marked todo**

The two skipped tests concern shipped-data cases that no longer apply.

The six todo items are deferred M2 placeholders: four relate to judging behavior already covered by later M3 suites, and two concern a potential future shared data loader.

The TypeScript build, test type-checking, and both Vite builds passed.

**Math Cards — owner-observed testing in Chrome (M5):**

- Complete Solitaire sessions
- Complete Player vs. Beepy match
- All four Accept/Challenge outcomes
- Drag-and-drop and keyboard-only gameplay
- Responsive layouts from 375 to 1280 pixels
- Simulated touch interaction

**Clinical Cards — owner-observed testing in Chrome (M6):**

- Solitaire and Player vs. Beepy in both question styles
- Complete competitive match
- Drag-and-drop onto challenges and Discard
- Keyboard-only gameplay
- Responsive widths of 1440, 1024, 768, 390, and 320 pixels
- Touch interaction through Chrome device emulation
- Windows Narrator testing

Testing details, issue histories, and resolutions are documented in the [Kiro development log](docs/kiro-development-log.md).

Both deployed applications were also opened and tested in Chrome following deployment.

## Known Limitations

- Tutor Mode, Player vs. Player, persistent progress saving, and educational rewards are not implemented.
- Neither application has been tested on a physical touchscreen device.
- Clinical Cards was tested with Windows Narrator, but Math Cards has not received a complete screen-reader test. No comprehensive accessibility audit has been performed.
- The current Clinical Cards dataset does not include explanations. Explain Why has been tested only with fictional data.
- Both applications are client-side software. Although answer keys are not exposed through the normal game interface, underlying game state can be inspected using browser developer tools.
- The Clinical Cards bundle includes the physician review file, including the reviewer's name and review dates.

## Future Development (Not Implemented)

Potential enhancements include:

1. **Tutor Mode:** A human tutor evaluates proposed moves before the engine resolves them, with tutor accuracy tracked separately.
2. **Clinical Cards Teaching Edition:** A single-disease, four-category Solitaire redesign emphasizing focused clinical review.
3. **Additional educational content:** More mathematics operations and additional clinical subjects.
4. **Educational rewards:** Recognition of correct answers and challenge-solving performance without changing the established game win conditions.
5. **Player vs. Player:** A possible competitive mode allowing two human players to use the shared engine.

These features are proposals for future development, not part of the completed Kiroween 2026 submission. Their implementation depends on available resources and opportunities.

## License and Acknowledgements

This project is released under the [MIT License](LICENSE).

Beepy Card Engine was conceived, designed, and directed by its individual project owner, who also authored and reviewed the clinical educational content. Kiro assisted with software implementation, debugging, and testing.

The project was inspired by an earlier Beepy educational game concept submitted to Devpost in 2018:

[Beepy's Addition Bots — earlier project video](https://youtu.be/qOLjLOyOygM)

The earlier project served as conceptual inspiration only. No application code, game-engine code, video, or artwork from the 2018 project was reused.

The code and artwork in this repository were created for the Kiroween 2026 project. The clinical educational content was authored and reviewed by the project owner, not generated by AI.

**Kiroween 2026 — Skeleton Crew submission**

Demonstration video: https://youtu.be/3QzE9GrPU84
