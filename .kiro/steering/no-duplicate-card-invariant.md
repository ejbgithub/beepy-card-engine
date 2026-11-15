# The No-Duplicate-Card Invariant

This is a core correctness rule of the engine (master spec §4, §16). It is
easy to violate accidentally during generation, penalty draws, and fallback
handling, so it is called out as its own steering document.

## The invariant

Every answer-card **display value** is unique across the **entire active
game** — across all zones at once:

- every player hand (human and Beepy),
- the draw deck,
- played cards, and
- the discard pile.

For math this also means every displayed math problem must have a **distinct
numerical answer**.

## Supporting rules

- Every displayed challenge has **exactly one** designated correct answer card
  in the generated game.
- A starting hand holds **five distinct cards**: two or three correct answers
  for currently displayed challenges, the rest plausible distractors. Never
  reveal which cards are correct.
- On an invalid action, the player draws **one new, unique** penalty card.
  A drawn card must not duplicate any card already present or used in the game.
- If the draw deck is exhausted, a safe game-specific fallback must supply an
  unused, uniquely identified penalty card. Validation must reject unsuitable
  or impossible content. **Never** silently reuse an earlier card to fill a
  deck or satisfy a count.
- Do not pad easy difficulty levels with absurd distractors merely to reach a
  fixed deck size; a smaller validated deck is acceptable when the plausible
  value range is limited.

## Testing obligation

Automated tests must verify card-value uniqueness across all game zones and the
one-answer-per-challenge rule. These tests are required before the engine is
considered correct. (No tests are written in the foundation milestone.)
