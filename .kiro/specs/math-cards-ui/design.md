# Beepy Math Cards Browser Interface — Design

Companion to `requirements.md`. Specification only; no code is authorized.

## What exists today (reviewed)

- `math-cards/` has `src/` (generator, series wrapper, levels, fallbacks), `tests/`,
  `package.json` (scripts `dev: vite`, `build: vite build`, `preview`), and a
  `tsconfig.json` that compiles `src/**/*.ts` to `dist/`. There is no `index.html`
  and no Vite config yet.
- Vite 5 and Vitest 2 are installed. There is no DOM test environment (jsdom or
  happy-dom) and no browser automation.
- `tsconfig.base.json` includes the `DOM` lib, so UI code type-checks as it is.
- `createMathSeries(config)` returns a frozen object with seven methods:
  `startNextGame`, `getView`, `submitHumanAction`, `decide`, `advanceBeepy`,
  `getSeriesStatus`, `getPublicEvents`. Every action returns
  `{ ok, view, events }` or `{ ok: false, error: { code, message } }`.
- `PlayerView` provides the hand (handle + face), the opponent's count, challenges
  (id, prompt, status, solver, played card), the discard pile, the draw-pile count,
  the pending action (card + destination only), stats, outcome, and series status.
- `PublicEvent` covers: `GAME_STARTED`, `ACTION_PENDING`, `ACTION_RESOLVED` (with
  `valid` and `decision`), `CHALLENGE_SOLVED`, `PENALTY_DRAWN` (face only for the
  viewer's own card), `PENALTY_WAIVED`, `PENALTY_NOT_APPLIED`, and `GAME_ENDED`.
- The M4 determinism test scans `math-cards/src/*.ts` (top level only) for
  `Math.random`, `Date`, and `crypto`. UI code lives in `src/ui/`, so the one place
  that reads `crypto.getRandomValues` (the seed) is outside that scan by design. A
  new M5 guard test pins it to exactly one file.

Everything M5 needs is already exposed. No engine, generator, or wrapper change is
expected.

## Architecture

```
math-cards/
  index.html                 page shell, links styles.css, loads src/ui/main.ts
  src/ui/
    main.ts                  entry: create the app, mount it in #app
    seed.ts                  the ONLY browser random source (crypto.getRandomValues)
    app-state.ts             PURE screen flow: menu → setup → playing → results
    session.ts               PURE-ish orchestrator around one MathSeries
    board-model.ts           PURE: PlayerView → what to draw (labels, states, aria)
    feedback.ts              PURE: PublicEvent[] → short messages (fixed table)
    labels.ts                fixed text: levels, styles, modes, results, errors
    render/
      dom.ts                 tiny h() helper and element utilities (no framework)
      menu.ts                main menu and setup screens
      board.ts               table layout, cards, challenges, piles, Beepy
      results.ts             game-over and series-over panels
      drag.ts                pointer-event drag and drop
      beepy-avatar.ts        original inline SVG of Beepy
    styles.css               the whole visual design
```

Layering rules (enforced by guard tests):
- `app-state`, `session`, `board-model`, `feedback`, and `labels` are DOM-free and
  are tested in Node.
- `render/*` turns models into DOM. It holds no game logic.
- Only `session.ts` imports `createMathSeries`. Other UI files may import only
  public *types* and constants from `@beepy/shared-engine` and `../math-series.js`.
  Nothing in `src/ui/` imports the generator, levels internals, fallbacks, or
  `shared-engine` internal paths.

### Why no framework (decision U-1)

The UI has about six screens and one board whose entire state is the engine's
`PlayerView`. Re-rendering the board from each new view is simple, fast at this
size, and needs no dependency. A framework (React or similar) would add a
dependency and build setup for little benefit. If the UI grows in a later
milestone, the pure layers (`board-model`, `feedback`, `session`) carry over
unchanged.

## Screen flow (`app-state.ts`)

```
menu ──choose mode──► setup ──Start──► playing ──game ends──► gameOver
  ▲                     │                 │                      │
  └──── Main menu ◄─────┴── Quit (confirm)┘      Next game ◄─────┤ (series not complete)
                                                                 │
                                          seriesOver ◄───────────┘ (series complete)
                                            ├─ Play again (same settings, new seed)
                                            └─ Main menu
```

The screen state is a small tagged union with a pure `transition(state, intent)`
function. Unknown intents leave the state unchanged. Tested for every edge.

## Session orchestrator (`session.ts`)

It owns one `MathSeries` and the transient UI state the engine doesn't hold:
- `selectedHandle` (cleared on cancel, on any successful action, and when the card
  leaves the hand);
- `busy` (true while a request is in flight or Beepy's timer runs, so repeat clicks
  are ignored);
- the latest `PlayerView` and the feedback for the last step.

Its intents are `select(handle)`, `cancel()`, `playOn(challengeId)`, `discard()`,
`accept()`, `challenge()`, `nextGame()`, and `leave()`. It calls only the series
methods. Beepy's turn runs through an injected scheduler, so tests can drive it:

```
after any step: if view.phase === 'awaitingAction' and activePlayer === 'beepy'
  → status "Beepy is thinking…" → scheduler.after(BEEPY_THINK_MS) → advanceBeepy()
  → the view now has `pending` → show Accept / Challenge (no timer: the human decides)
```

`leave()` cancels any scheduled Beepy step (Requirement 10.3). The browser
scheduler wraps `setTimeout`. The test scheduler runs callbacks on demand, so
simulations are deterministic and instant.

## Board model (`board-model.ts`)

`toBoardModel(view, uiState)` returns plain data the renderer draws:
- the header: mode, game number (from `gameIndex`), whose turn, turn count, the
  draw-pile count, and the score line (Solitaire: series `sessionScore` so far;
  competitive: series `wins` and credits counted from `challenges[].solvedBy`, which
  is display tallying of public data, not scoring);
- challenges: id, prompt, `open`/`solved`, solver label, the played card face,
  and whether it is clickable right now;
- hand cards: handle, face, `wide` when the face contains "+", and whether it is
  selected;
- piles: draw count, the top discard face, and discard-target enabled;
- Beepy (competitive): card count and a "thinking" flag;
- pending (competitive): the card face, a destination label ("on c4: 3 + 4 = ?" or
  "to the discard pile"), and the Accept/Challenge controls;
- accessible names for everything, built only from the same fields.

The model never contains anything that isn't in the view. A guard test serializes
models from many simulated games and checks that they contain no field or value
beyond the view's own (Requirement 11.2).

## Feedback (`feedback.ts`)

`toFeedback(events, viewerIsHuman)` maps public events to at most a few short
messages, each tagged `good`, `oops`, or `info`. It uses a fixed table. Examples of
proposed wording (owner may edit; decision U-3):

| Event | Message |
|---|---|
| Human valid play | ✓ "Great! That card solves the problem." |
| Human valid discard | ✓ "Good discard." |
| Human invalid play/discard | ✗ "Oops, that wasn't right. The card stays in your hand." |
| Penalty drawn (human) | ✗ "You drew 1 card." (the new card is highlighted briefly) |
| Beepy valid, human Accept | ✓ "You're right, Beepy's move was correct." |
| Beepy valid, human Challenge | ✗ "Beepy's move was correct. You draw 1 card." |
| Beepy invalid, human Challenge | ✓ "Good catch! Beepy's move was wrong. Beepy draws 1 card." |
| Beepy invalid, human Accept | ✗ "Beepy's move was wrong. You both draw 1 card." |
| Penalty waived | ℹ "No cards left to draw, so no penalty card this time." |
| Penalty not applied | ℹ "The game ended before any card was drawn." |
| Game ended | from the outcome ("You win!", "Beepy wins!", "Game over") |

The messages follow from `ACTION_RESOLVED.valid`, `decision`, and the
`PENALTY_DRAWN` events actually present, so they match exactly what the engine did.
They never state the correct answer or any explanation.

## Layout

### Solitaire (desktop)

```
┌──────────────────────────────────────────────────────────────────┐
│ Beepy Math Cards   Solitaire · Game 2 of 5   Turns 4   Session 17  [Menu] │
├──────────────────────────────────────────────────────────────────┤
│  ┌───────┐ ┌───────┐ ┌───────┐ ┌───────┐ ┌───────┐                    │
│  │ 3+4=? │ │ 8+5=? │ │ 2+9=? │ │ 6+6=? │ │ 1+7=? │   five challenges  │
│  └───────┘ └───────┘ └───────┘ └───────┘ └───────┘                    │
│                 ┌──────────┐   ┌──────────┐                           │
│                 │ Draw (8) │   │ Discard  │   centered piles          │
│                 └──────────┘   └──────────┘                           │
│   [ feedback banner — live region ]                                   │
│        ┌──┐ ┌──┐ ┌──┐ ┌──┐ ┌──┐                                       │
│        │ 7│ │12│ │ 9│ │15│ │ 8│   your hand                           │
│        └──┘ └──┘ └──┘ └──┘ └──┘                                       │
└──────────────────────────────────────────────────────────────────┘
```

### Player vs. Beepy (desktop)

```
┌──────────────────────────────────────────────────────────────────┐
│ Beepy Math Cards  vs Beepy · Game 3 · You 1 – Beepy 1   [Menu]        │
├──────────────────────────────────────────────────────────────────┤
│  (Beepy avatar)  Beepy · 6 cards  ▢▢▢▢▢▢   "Beepy is thinking…"       │
│  ┌──┐┌──┐┌──┐┌──┐┌──┐                                                 │
│  │c1││c2││c3││c4││c5│      nine challenges: 5 + 4 rows                 │
│  └──┘└──┘└──┘└──┘└──┘      solved ones show the card and "You"/"Beepy" │
│    ┌──┐┌──┐┌──┐┌──┐                                                   │
│    │c6││c7││c8││c9│                                                   │
│    └──┘└──┘└──┘└──┘                                                   │
│      Draw (12)   Discard   │ Beepy plays [ 14 ] on "6 + 8 = ?"          │
│                            │   [ Accept ]  [ Challenge ]               │
│   [ feedback banner ]                                                 │
│   ┌──┐ ┌──┐ ┌──┐ ┌──┐ ┌──┐   your hand · You solved 2, Beepy solved 3  │
└──────────────────────────────────────────────────────────────────┘
```

### Responsive behavior
- Tablet (≈ 768–1024 px): the same structure; challenge cards shrink; the hand
  wraps onto two rows if needed.
- Phone (< 768 px): challenges in a 3-column grid (nine becomes 3 × 3), the piles in
  one compact row, the hand scrolls horizontally with snap, the pending panel
  becomes a bottom sheet with large Accept/Challenge buttons, and the header becomes
  two lines.
- Expression cards (`subjectToFact`) are wider than number cards. Prompts wrap.

### Visual direction
- A modern, friendly look: soft gradient background, rounded cards with subtle
  shadows, a clear sans-serif system font stack (no web-font download), large
  numerals.
- A calm palette with accessible contrast. Green with ✓ for correct, coral with ✗
  for incorrect, blue for information. Never color alone.
- Beepy: an original, simple rounded robot drawn as inline SVG, with idle, thinking,
  happy, and oops poses made with CSS classes on one SVG (decision U-9). No reuse of
  the 2018 artwork.
- Motion: card lift on select, a short slide for plays and draws, and a gentle pulse
  on Beepy while thinking. All of it is disabled under `prefers-reduced-motion`.

## Interaction details

- **Click/tap:** tap a card to select it (it lifts and outlines); tap a challenge to
  play or the discard pile to discard; tap the card again or press Escape to cancel.
  A "Cancel" chip appears while a card is selected.
- **Drag (decision U-7):** pointer events (`pointerdown`/`move`/`up`, with pointer
  capture) work for mouse and touch; native HTML5 drag-and-drop doesn't work on
  touch. Dropping on a challenge or the discard pile calls the same intents.
  Dropping elsewhere cancels. Drag ships after the click path is playable.
- **Keyboard:** cards, challenges, the discard pile, and Accept/Challenge are
  `<button>`s in a sensible tab order. Enter or Space selects or acts; Escape
  cancels. When a pending Beepy action appears, focus moves to the pending panel
  heading, never to Accept or Challenge, so focus doesn't steer the decision.
- **No pre-judging:** with a card selected, every open challenge and the discard
  pile are enabled. Solved challenges are disabled for everyone (the engine refuses
  them anyway).
- **No discard confirmation.** A confirmation that appeared only for some cards
  would hint at the answer, and one for every discard would slow play down.
- **Hand order (decision U-10):** the engine's order, with penalty cards appended.
  The UI doesn't sort, because sorting would need numeric parsing in the UI.

## Privacy and integration

- The UI's only engine-facing object is the frozen `MathSeries`. It renders only
  `PlayerView` and `PublicEvent` fields.
- Card handles may appear as `data-handle` attributes. They are opaque tokens
  (M3) and reveal nothing.
- The seed comes from `seed.ts`: `crypto.getRandomValues(new Uint32Array(1))[0]`,
  with a fresh seed for each new session or match. It is never rendered, put in the
  URL, or stored (decision U-5).
- Diagnostics are not connected to the UI. In development builds only, `session.ts`
  passes a callback that writes to `console.debug`, so developers can see generator
  issues. Production builds pass none (decision U-5).
- **Inherent limit (documented in the app README):** this is a static app, so the
  generated deck exists in browser memory. Anyone can open developer tools and
  inspect it. The boundary guarantees that the UI's own data path (views, events,
  DOM, URL, storage) reveals nothing, which is what the master spec requires; it is
  not tamper-proofing.

## Build and run (decision U-6)

- `math-cards/index.html` at the workspace root, with `<link
  rel="stylesheet" href="/src/ui/styles.css">` and `<script type="module"
  src="/src/ui/main.ts">`.
- Scripts in `math-cards/package.json`: `dev: vite`, `build: vite build --outDir
  web-dist --base ./ --emptyOutDir`, `preview: vite preview --outDir web-dist`. No
  Vite config file. `web-dist/` is added to `.gitignore` next to `dist/`.
- Vite resolves `@beepy/shared-engine` through the workspace link to its TypeScript
  source. To be confirmed in U1 by actually running `vite build`. If it fails, I'll
  stop and report rather than add configuration silently.

## Testing

### Automated (Node; no new dependency, decision U-2)
- `app-state`: every transition, plus unknown intents ignored.
- `labels`: every level, style, mode, end reason, and public error code has text.
- `board-model`: Solitaire 5 / vsBeepy 9 challenges; solved state and solver
  labels; hand selection; disabled states per phase; the pending panel present only
  in `awaitingEvaluation`; header numbers equal view and series fields; accessible
  names present.
  - **Non-leak:** the models for a valid and an invalid pending Beepy action are
    identical apart from the card face and destination text, and no model contains
    data absent from its view.
- `feedback`: each row of the table, built from real events produced by
  `createMathSeries` (not hand-made events), including both-draw,
  win-before-penalty (`PENALTY_NOT_APPLIED`), and waived penalties.
- `session`: select, cancel, play, discard, busy-guard against duplicates,
  selection cleared after actions, the Beepy scheduler flow, `leave()` cancelling
  the timer, and error handling.
  - **Full simulated games:** a scripted "child" plays through the orchestrator with
    the test scheduler, for both modes, both styles, and every level, until the
    series completes, choosing only through the board model. A test-only step limit
    applies.
- **Guard tests:**
  - `src/ui/**` imports only allowed modules; only `session.ts` imports
    `createMathSeries`;
  - `crypto.getRandomValues` appears only in `seed.ts`;
  - no `src/ui/**` file imports or calls `parseExpression`, `canonicalNumber`,
    judging, or generator functions;
  - the existing M4 scan of `src/*.ts` still passes.

### Manual browser test plan (run by the owner; logged as observed)
1. `npm run dev -w math-cards`: open the URL in Chrome, Edge, or Firefox on desktop.
2. Menu → Solitaire → each level × each style: deal, play correct and wrong cards,
   discard, cancel a selection, see penalties, finish a game, and see the score.
3. Play a full five-game session: session summary, Play again, Main menu.
4. Menu → vs Beepy: Beepy thinks and acts; Accept and Challenge in all four
   outcomes; the pending card shows no hint; finish a match; match summary.
5. Keyboard-only play of one game; check focus visibility and Escape cancel.
6. Drag-and-drop with a mouse; on a touch device or the browser's device emulation,
   tap and drag.
7. Responsive check at 1280, 1024, 768, and 375 px widths.
8. `prefers-reduced-motion` on: no animations.
9. Screen reader spot check (NVDA or Narrator): feedback is announced, and controls
   have names. (A spot check only, not a WCAG audit.)
10. `npm run build -w math-cards`, then `npm run preview -w math-cards`: the built
    app works.

I can't see a browser. I will run the build and the automated tests and report
those. The owner reports what the manual checklist shows.

## Shortest path to a playable first version

1. **U1–U4:** shell, flow, models, and orchestrator, all testable without a
   browser. At the end of U4 the whole game runs headless through the UI's own
   logic.
2. **U5–U6:** menu and the Solitaire board with click/tap. **First playable:**
   Solitaire, all levels, both styles.
3. **U7–U8:** the vs Beepy board, Beepy's turns, Accept/Challenge, and the results
   and summary screens. **The full required game is playable.**
4. **U9–U10:** visual polish and responsive layouts, then drag-and-drop.
5. **U11–U13:** guards, build, the manual checklist, and documentation.

## Complexity estimate

About 1,300–1,800 lines of TypeScript (≈ 700 pure logic, ≈ 800 DOM rendering and
drag), ≈ 500–700 lines of CSS, one small original SVG, and ≈ 120–180 automated
tests. That's comparable to M4 in code, but more of the effort is visual and needs
manual checking.

## Decisions needing owner approval (with recommendations)

- **U-1 Technology:** plain TypeScript + DOM + CSS with Vite, and no framework.
  *Recommended.*
- **U-2 Testing approach:** test the pure layers in Node and verify DOM rendering
  manually. The alternative is adding `happy-dom` as a dev dependency for render
  tests. *Recommended: no new dependency in M5.*
- **U-3 Feedback content:** the fixed message table above, which says
  right/wrong/penalty but never the correct answer. Showing the correct answer
  after a mistake would require UI arithmetic or engine support. *Recommended:
  generic messages; the owner may reword them.*
- **U-4 Beepy pacing:** Beepy waits about 1 s ("thinking"), then acts; the human
  decides with no time limit; results stay visible until the next action. The
  alternative is an "OK" button after every Beepy resolution. *Recommended: no
  extra button.*
- **U-5 Seed and diagnostics:** a browser random seed per series from `seed.ts`
  only, never displayed; diagnostics go to the console in dev builds only.
  *Recommended.*
- **U-6 Build output:** `vite build --outDir web-dist --base ./` via package.json
  scripts, with no Vite config file, and `web-dist/` added to `.gitignore`.
  *Recommended.*
- **U-7 Drag-and-drop:** pointer-event drag implemented after click/tap is
  playable, in M5. The alternative is deferring drag to M6. *Recommended: in M5,
  as a late task.*
- **U-8 Labels:** levels "Small numbers (1–9)", "Small + big numbers",
  "Big numbers (10–89)", and "Mix it up"; styles "Solve the problem (3 + 4 = ?)"
  and "Find the matching addition (Which addition equals 7?)"; defaults Solitaire,
  small numbers, solve the problem. *Recommended, owner may reword.*
- **U-9 Beepy art:** an original inline SVG robot created in M5, with no reuse of
  the 2018 artwork. *Recommended.*
- **U-10 Hand order:** the engine's order with penalty cards appended, and no
  UI sorting. *Recommended.*
- **U-11 Quitting a game in progress:** a confirmation, after which the series is
  simply discarded. No engine change. *Recommended.*
