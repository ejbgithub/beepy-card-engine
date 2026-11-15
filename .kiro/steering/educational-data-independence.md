# Educational-Data Independence

The engine scores play deterministically and must stay independent of subject
matter and of any runtime AI (master spec §4, §8, §9, §12).

## Separation of concerns

- The **engine** knows about cards, challenges, hands, turns, penalties, and
  scoring. It does not know whether a subject is math or medicine.
- **Educational data** lives outside the engine, in a shared source-data
  format: `subject → topics → corrects / incorrects`, with stable IDs and
  answer entries carrying `id`, `text`, and optional `explanation`.
- App-specific **generators** turn source data into a validated playable deck
  of challenges and answer cards. Generation direction (`factToSubject` for
  Math, `subjectToFact` for Clinical) is **configuration**, not a separate
  schema. Both directions must work for either app.

## Determinism and no runtime AI

- The generator and validator — not generative AI at runtime — decide objective
  correctness, using a verified game-specific mapping.
- No external runtime AI is needed to score play in either app.

## Contextual correctness (not universal labels)

- Source `corrects` / `incorrects` express **contextual** relationships, not
  universal true/false labels.
- Before building a playable deck, the generator must check every selected card
  against **all active challenges**, remove ambiguous matches and duplicate
  texts, and designate exactly one correct card per challenge.
- A card `explanation` is contextual. Do not display an unrelated or misleading
  explanation when a card is dropped on a different challenge. Explanations are
  never shown on the face of a card.

## Local-only learning history

- Track concepts and outcomes (correct/incorrect plays, discards, challenges)
  separately from card-game scores.
- Use browser-local storage for an initial no-account experience. Make clear
  that clearing browser data or switching devices can lose local history.
