# @beepy/shared-engine

The subject-neutral gameplay engine shared by both demo applications
(`math-cards` and `clinical-cards`). It knows about cards, challenges, hands,
turns, penalties, and scoring, never about math or medicine.

**Status:** implemented and tested for **Solitaire** and **Player vs. Beepy**.
Tutor Mode and Player vs. Player are not implemented (the engine rejects them
with `MODE_NOT_IMPLEMENTED`).

## What is in here

| Area | Modules (`src/`) | Milestone |
|---|---|---|
| Source-data schema, ids, collections | `source-data.ts`, `identifiers.ts`, `collection.ts` | M2 |
| Generated-deck contract, generation direction | `generated-deck.ts`, `generation-config.ts`, `generator.ts` | M2 (result type M4) |
| Deck validation (mapping, ambiguity, uniqueness, hands, size) | `validation.ts`, `challenge-mapping.ts`, `uniqueness.ts`, `starting-hand.ts`, `dual-hand.ts`, `deck-size.ts` | M2 |
| Penalty draws and bounded fallback | `penalty-draw.ts` | M2 |
| Structured issues, data sufficiency | `issues.ts`, `deck-issues.ts`, `data-sufficiency.ts` | M2 |
| Game engine (seeded randomness, deal, judge, penalties, Solitaire, vs Beepy, series) | `game/*.ts` | M3 |
| Trusted controller, sanitized views, public events | `game/controller.ts`, `game/view.ts` | M3 |
| Replaceable Beepy strategy | `game/beepy-strategy.ts` | M3 |

## Key guarantees (all covered by automated tests)

- Every challenge has exactly one designated correct card; every card face is
  unique across all zones (hands, draw pile, played, discard).
- Starting hands have five distinct cards with two or three correct answers.
- Judging is deterministic and lives only in the engine.
- An invalid action keeps the card and draws one unique penalty card. When no
  eligible card exists, the penalty is waived and recorded; a card is never
  reused or invented.
- Same seed and same requests reproduce the same game.
- The UI receives only sanitized views, public events, and fixed public errors
  from the trusted controller. The engine state stays inside the controller's
  closure. In a static browser app it is still inspectable with developer tools;
  it is hidden from the ordinary interface, not cryptographically secret.

## Boundaries

- No educational data, decks, or subject-specific generators live here.
- No DOM access and no UI framework dependency.

See `../docs/master-spec-v1.1.md` for the authoritative rules and
`../.kiro/specs/` for the milestone specs.
