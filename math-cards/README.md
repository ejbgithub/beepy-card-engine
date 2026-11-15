# Beepy's Math Cards

An addition card game for second graders, and the first working application on
`@beepy/shared-engine`. Children match addition problems with answer cards,
either on their own (Solitaire) or against Beepy, a friendly robot opponent.

**Status:** playable in the browser (Milestones M4 and M5).

## Features

- **Two modes:** Solitaire (five problems, five-game session) and Player vs.
  Beepy (nine shared problems, best-of-five match).
- **Four levels:**

  | Level | Problems | Example |
  |---|---|---|
  | Small numbers | 1–9 + 1–9 | 3 + 4 |
  | Small + big numbers | 1–9 + 10–89 | 6 + 25 |
  | Big numbers | 10–89 + 10–89 | 34 + 21 |
  | Mix it up | a mix of the three | |

  No sum is above 99, no number is zero, and zero is never a distractor card.
- **Two question styles:**
  - *Solve the problem* — the problem shows `3 + 4 = ?`; find the card `7`.
  - *Find the matching addition* — the problem shows a number such as `7`
    (screen readers hear "Which addition expression equals 7?"); find a card such
    as `3 + 4`.
- **New, unique decks every game**, generated from a seed: every problem has
  exactly one correct card, no two cards show the same value, and distractors are
  believable near-misses. Competitive decks aim for 24 cards and are smaller when
  the level's numbers can't support that many unique values (for example 20
  cards for Small numbers / Solve the problem).
- **Controls:** tap or click a card, then tap a problem to play it or Discard to
  discard it; or drag the card onto a problem or Discard. Escape, tapping the
  card again, or Cancel clears a selection. Everything works with the keyboard
  (Tab, Shift+Tab, Enter/Space, Escape).
- **Feedback** after every action (✓ correct / ✗ oops / ℹ note), announced to
  screen readers. Penalty cards appear with a "New!" tag and a "Your new card"
  notice with a "Show me" button.
- Original vector artwork of Beepy; respects reduced-motion settings.

## Rules

**Each turn** you play a card on an open problem or discard it.
- A correct play solves the problem; a discard is correct only if the card
  answers none of the open problems.
- A wrong play or discard keeps the card in your hand and you draw one penalty
  card. When the draw pile is empty, a fresh unused card is made up from the
  level's numbers; if none is left, the penalty is skipped and the game says so.
- Every attempt counts as one turn.

**Solitaire:** a game ends when your hand is empty or all five problems are
solved. Game score = turns taken + cards left in your hand (lower is better).
A session is five games; the session score is the total.

**Player vs. Beepy:**
- You go first in game 1; the first player alternates each game.
- Beepy checks your moves at once (a wrong move costs you a penalty card).
- When Beepy moves, you see only its card and where it wants to put it, then
  choose **Accept** or **Challenge**:

  | Beepy's move | You choose | Result |
  |---|---|---|
  | Correct | Accept | Beepy's card is played |
  | Correct | Challenge | Beepy's card is played; you draw one |
  | Wrong | Challenge | Beepy keeps the card and draws one |
  | Wrong | Accept | Beepy keeps the card; you both draw one |

- The first player to empty their hand wins the game, even if the other player
  solved more problems. If all nine problems are solved first, the player with
  fewer cards wins; if that ties, the player who solved more problems wins.
- The match is best of five: first to three wins. Beepy makes a deliberate
  mistake about 20% of the time.

## Run it

From the repository root:

```bash
npm install                    # once
npm run dev -w math-cards      # development server: http://localhost:5173/
npm run build -w math-cards    # production build into math-cards/web-dist/
npm run preview -w math-cards  # serve the production build: http://localhost:4173/
```

On some Windows machines the dev server listens on IPv6 only; use
`http://localhost:5173/`, not `127.0.0.1`.

### Static hosting

`math-cards/web-dist/` is a self-contained static site with relative asset
paths (`--base ./`), so it can be served from any folder or static host (for
example GitHub Pages or Netlify) without server code. It has not been deployed
yet.

## Privacy

- No accounts, no personal information, no browser storage, no cookies, no
  analytics, and no network requests by the app. (The production bundle
  contains Vite's standard module-preload helper, which only loads the app's own
  script files.)
- In normal play the interface never shows Beepy's cards, the draw pile, the
  answer key, or whether Beepy's pending move is correct.
- **Limitation:** this is a client-side app, so the generated deck and game state
  live in the page's memory and can be inspected with browser developer tools.
  They are hidden from the ordinary interface, not secret.

## Code layout

```text
math-cards/
  index.html
  src/
    levels.ts, distractors.ts, math-generator.ts   # deck generator (M4)
    penalty-fallback.ts, expression-fallback.ts    # penalty fallback providers
    math-series.ts                                 # trusted wrapper around the engine controller
    ui/                                            # browser interface (M5), plain TypeScript + DOM
      app-state.ts, session.ts, board-model.ts, feedback.ts, labels.ts, seed.ts, app.ts, main.ts
      render/  board.ts, menu.ts, drag.ts, beepy-avatar.ts, dom.ts
      styles.css
  tests/                                           # Vitest suites for the generator and UI logic
```

Only `src/ui/session.ts` talks to the game (through `createMathSeries`); the
rendering code draws sanitized views and holds no game rules.

## Known limitations

- Not yet tested on a physical touchscreen device (touch was checked with Chrome
  device emulation only).
- No full screen-reader test and no comprehensive accessibility audit.
- The "no penalty card this time" situation is covered by automated tests but
  was not reproduced manually.
- Tutor Mode, Player vs. Player, progress saving, and educational rewards are not
  implemented.

See `../README.md` for the whole project and `../docs/master-spec-v1.1.md` for
the authoritative rules.
