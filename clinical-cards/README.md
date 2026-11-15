# Beepy's Clinical Cards

A disease-based, high-yield clinical fact card game for medical students
reviewing for USMLE-style examinations. Demo application #2, built on the same
`@beepy/shared-engine` as Beepy's Math Cards.

It is **not** a question bank: no vignettes, no question stems, no NBME items. A
challenge is a disease and a category (or a fact), and a card is one concise,
reviewed fact (or a disease name).

**Status (Milestone M6 complete through C9, 2026-11-14):** playable in the
browser, with Solitaire and Player vs. Beepy in both question styles. It was
tested by automated suites and accepted by the owner in Chrome (see
`../docs/kiro-development-log.md`).

> For study practice only. Not medical advice.

## What it does

- **Question styles**
  - **Disease + category → fact** (default): the board shows "Hereditary
    Spherocytosis · Work-up"; find the matching fact card.
  - **Fact → disease:** the board shows a fact; find the card with its disease.
- **Solitaire:** five challenges, a five-card hand, five games per session.
  Score = turns + cards left (lower is better).
- **Player vs. Beepy:** nine shared challenges, alternating turns.
  - Beepy, a robot opponent, sometimes makes deliberate mistakes; you Accept or
    Challenge each of his moves.
  - Wrong moves and wrong decisions draw penalty cards. If you accept a wrong
    move, both of you draw.
  - Best of five games.
- **Controls:** tap or click a card, then a challenge or Discard; or drag and
  drop. Full keyboard play (Tab, Enter or Space, and Escape to cancel), and a
  responsive layout from desktop to a 320 px phone.
- **Explain Why:** appears after a resolved play only when the author wrote an
  explanation for that exact card and challenge. The current dataset has no
  explanations, so the button does not appear.

## Clinical content and correctness

- **Content:** 16 hematology diseases, 57 categories and 96 correct facts,
  written and physician-reviewed by the project owner. No AI-written clinical
  content; every text is shown exactly as authored.
- **Validity:** a card counts as wrong for a challenge only when the data or an
  owner review says so. Anything unreviewed is "unknown" and is never used as a
  wrong answer.
  - Review records carry fingerprints and become stale when reviewed content
    changes.
  - Shared facts (for example the B12/Folate Work-up fact) count as correct for
    both diseases.
- **Decks:** each deck has exactly one correct card per challenge and no
  duplicate card text anywhere in the game.
  - Decks are smaller than the target when reviewed content is limited. Player
    vs. Beepy with fact → disease uses validated 14-card decks; nothing is
    padded.
- **Penalty fallback:** when the draw pile runs out, penalty cards come only
  from unused, reviewed entries. Otherwise the penalty is waived and the game
  says so.
- **Startup:** the app validates its content before showing the menu. Missing or
  invalid content shows an error screen. There is no fallback to example
  content.

## Running it

From the project root (Node.js 20+):

```bash
npm run build -w clinical-cards     # static build -> clinical-cards/web-dist/
npm run preview -w clinical-cards   # serve that build (http://localhost:4173/)
```

For development, run `npx vite` from `clinical-cards/`, then open
http://localhost:5173/. `web-dist/` uses relative paths and works on any static
host. It has not been deployed.

## Authoring and review (owner workflow)

Step by step in [`authoring/AUTHORING.md`](authoring/AUTHORING.md) §2a–§2b:

- `npm run add-disease -w clinical-cards`: adds a blank disease to
  `authoring/clinical-authoring.json`, the simple file the owner edits.
- `npm run convert -w clinical-cards`: generates `src/data/clinical-demo.json`
  from it. Don't edit the generated file by hand. It won't overwrite a file it
  didn't write without explicit permission.
- `npm run review-report -w clinical-cards`: validation, deck sufficiency for all
  four mode and style combinations, the review report and review drafts,
  written to `review-output/`.
- `src/data/clinical-review.json` holds the owner's review records. Tooling never
  creates or attests them.

## Code map (`src/`)

| File | Purpose |
|---|---|
| `clinical-content.ts` | Categories and content rules on top of the shared schema validation |
| `clinical-review.ts` | Review records, fingerprints, stale detection, the valid / invalid / unknown policy, the review report |
| `clinical-generator.ts` | Deck generator for both modes and both styles; verbatim text; neutral card ids (`k1`…) |
| `clinical-fallback.ts` | Penalty fallback from unused reviewed entries |
| `clinical-series.ts` | `createClinicalSeries`, the trusted layer the UI uses, with `explainResolved` |
| `clinical-data.ts`, `shipped-data.ts` | Loading and validating the two shipped JSON files |
| `clinical-authoring-format.ts`, `clinical-authoring.ts` | Authoring converter, sufficiency check, review drafts |
| `ui/` | The browser app (plain TypeScript, HTML and CSS), adapted from Math Cards |

## Known limitations

- No explanations in the current dataset, so Explain Why has only been tested
  with fictional data.
- Touch was checked with Chrome device emulation, not a physical device. The
  screen reader tested was Windows Narrator only.
- As a client-side app, the deck and the review file (including reviewer name
  and dates) are in page memory and in the bundle. They are hidden from the
  normal interface, not secret.
- Tutor Mode and the single-disease Teaching Edition are planned post-hackathon,
  and not part of this app.

See `../docs/master-spec-v1.1.md` and `../.kiro/specs/clinical-cards/`.
