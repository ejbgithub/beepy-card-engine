# Beepy Educational Card Game Engine
## Master Project Specification — Version 1.1 (Review Draft)

**Competition:** Kiroween 2026 · **Category:** Skeleton Crew  
**Platform:** Browser-based, desktop-first and responsive  
**Development:** Kiro IDE with structured specs, steering, testing, and evidence-based development tracking  
**Status:** Design specification, not implementation evidence

## 1. Objective and deliverables
Build one reusable educational card-game foundation and **two distinct, functioning browser applications**:

- **Beepy's Math Cards:** An addition-focused game for second graders. It supports generated or curated arithmetic questions.
- **Beepy's Clinical Cards:** A disease-based, high-yield clinical fact game for medical students preparing for NBME/USMLE Step examinations. It does **not** use NBME-style vignette questions or copyrighted NBME items.

Both use the same card-state rules, validation, input mechanisms, game modes, and general interface. Differences belong in data, content generation, sizing, feedback defaults, and presentation configuration. Beepy is the recurring character and computer opponent. Use a modern, polished visual style—not retro/pixel art. Develop new code and new assets; disclose the prior 2018 Beepy project as inspiration as appropriate and do not assume ownership of a contributor's old artwork.

## 2. Terminology
- **Turn:** One active player's attempt to play a card onto a challenge or discard it, plus any challenge/evaluation and penalty resolution. A failed action still counts as one turn.
- **Round:** One cycle of player turns; in competitive games normally one turn per player. A game may end partway through a round.
- **Game:** One newly dealt challenge board and hand(s), ending on a specified condition.
- **Match:** The complete competition/session. Solitaire and Tutor sessions use five games for cumulative scoring. Competitive matches are best of five games, first to three wins.

Score *turns*, not rounds, for Solitaire and Tutor Mode.

## 3. Game modes and development order
1. **Solitaire:** One human, one hand, five challenges; five games per session.
2. **Tutor Mode:** Student and human tutor, **one student hand**, five challenges; tutor evaluates each student move before the engine resolves it. First implementation: two people at one device, no networking.
3. **Player vs. Beepy:** Human and computerized Beepy with separate hands; one shared board of **nine** challenges; best-of-five match.
4. **Player vs. Player:** Two humans and separate hands; planned architecture only; **not implemented for this hackathon**.

Use stable identifiers such as `solitaire`, `tutor`, `vsBeepy`, and `vsPlayer`; displayed mode order should not be baked into the engine.

## 4. Universal card and challenge rules
- Each active human or Beepy hand starts with **five distinct cards**, comprising **two or three correct answer cards** for challenges currently displayed and the remaining cards being distractors. Use controlled randomized selection and shuffle; never reveal which are correct in the hand.
- Every displayed challenge has **one and only one designated correct answer card** in the generated game. Every answer-card *display value* is unique across the entire active game: hands, draw deck, played cards, and discarded cards. This also requires distinct numerical answers to all displayed math problems.
- A player chooses either **Play** (place a card onto a specific unsolved challenge) or **Discard**.
- A play is valid only when the card is the uniquely designated correct card for that unsolved challenge. A discard is valid only when the card is **not** a valid answer to any remaining unsolved challenge.
- **Valid action:** Remove the card from the hand; correct plays solve a challenge; correct discards go into the discard pile.
- **Invalid action:** Return the attempted card to the same hand and draw **one new, unique** penalty card. The action counts as one turn. Drawn cards cannot duplicate any card already present or used in that game.
- A correctly solved challenge remains visible, is marked completed, and cannot receive further plays. In competitive mode, credit it to exactly one player.
- The generator and validator—not generative AI at runtime—determine objective correctness using a verified game-specific mapping.
- If a draw deck is exhausted, a safe game-specific fallback must provide an unused, uniquely identified penalty card; validation must reject unsuitable or impossible content. Establish bounded generation/error handling during implementation rather than silently reusing an earlier card.

## 5. Solitaire: five games, five challenges each
A game ends immediately on **either** condition: (a) human hand empty, or (b) all five challenges correctly solved.

**Game score = turns taken + cards remaining in hand at game end.**  
**Session score = sum of scores for five games.** Lower is better.

Track correct and incorrect plays/discards and learning concepts separately from the score. Problem and card selection should use controlled repetition of previously missed concepts, without undermining initial-deal composition or game fairness.

## 6. Tutor Mode: detailed, required core feature
Participants: student and tutor, co-located at one browser/device. **Only the student has a hand.** Use the same five-challenge board, deal constraints, game ending, five-game session, and student scoring as Solitaire.

For *every* student turn:
1. Student selects a card and attempts to play it on a challenge or discard it.
2. Display the **pending** action without immediately committing it or revealing correctness.
3. Tutor must press **Accept** (believes it valid) or **Challenge** (believes it invalid).
4. The authoritative engine assesses both the student action and the tutor's judgment.
5. Resolve the card movement and student's normal Solitaire penalty if the student action was invalid. Record whether the tutor's evaluation was correct. Tutor error creates **no additional student penalty**.
6. Show result; allow optional **Explain Why** and **Continue**, with time for discussion. Only then begin the next turn.

| Student move | Tutor decision | Student card outcome | Tutor evaluation |
|---|---|---|---|
| Valid | Accept | Remove played/discarded card | Correct |
| Valid | Challenge | Remove played/discarded card | Incorrect |
| Invalid | Challenge | Return card; student draws one | Correct |
| Invalid | Accept | Return card; student draws one | Incorrect |

**Privacy of the decision:** Do not reveal validity, explanation, answer highlights, or penalty until the tutor has evaluated the pending move. Tutor cannot override the rules. Track tutor accuracy separately from student learning history. Default clinical explanations appear only on request.

## 7. Player vs. Beepy: nine shared challenges
- Human and Beepy each receive five unique cards, with two or three currently valid answers each. No card value repeats across hands or the remaining deck.
- Both use the **same nine displayed challenges**; all solved challenges are globally unavailable. Human takes first turn of Game 1. Whether first turn alternates in later games remains a configuration/detail to confirm before implementation.
- Beepy acts as an always-correct **referee** of human actions: immediately challenges invalid human plays/discards, applying the ordinary return-and-draw penalty; valid actions succeed.
- As a **player**, Beepy deliberately makes occasional plausible mistakes at configurable difficulty (initial illustrative error rates may be tuned later). Its behavior must not alter the authoritative validator.
- On every Beepy action, reveal only the attempted card and destination, while the rest of its hand stays face down. Human chooses **Accept** or **Challenge** before resolution.

| Beepy move | Human judgment | Outcome |
|---|---|---|
| Valid | Accept | Beepy removes the card |
| Valid | Challenge | Beepy removes card; **human** draws one penalty card |
| Invalid | Challenge | Beepy retains the attempted card and draws one penalty card |
| Invalid | Accept | Beepy retains the attempted card; **both** human and Beepy draw one penalty card |

A competitive game ends **immediately** if either player empties a hand; that player wins. If all **nine** problems are solved while neither hand is empty, the player with fewer remaining cards wins. If those counts tie, the player credited with solving more of the nine challenges wins. With nine solved problems and exactly one solver per problem, the final tiebreaker is decisive. First to **three** game wins takes the best-of-five match.

## 8. Unified educational source data (Version 2)
Keep the previously agreed **subject → topics → corrects/incorrects** generalized structure. Every subject and topic has a stable ID; answer entries each have `id`, `text`, and optional `explanation`. The subject also has `subjectIncorrects` containing answer entries with the same fields.

Canonical **single-subject record** shape:

```json
{
  "id": "subject-unique-id",
  "subject": "Displayed subject",
  "subjectIncorrects": [
    { "id": "alternative-1", "text": "Alternative subject", "explanation": "Optional explanation" }
  ],
  "topics": [
    {
      "id": "topic-unique-id",
      "topicName": "Topic name",
      "corrects": [
        { "id": "fact-correct-1", "text": "Correct fact", "explanation": "Optional explanation" }
      ],
      "incorrects": [
        { "id": "fact-incorrect-1", "text": "Incorrect fact", "explanation": "Optional explanation" }
      ]
    }
  ]
}
```

Provide multiple subject records to the data loader through a versioned collection format to be finalized in the schema task. Stable identifiers must remain unique in their defined namespace and be resolvable across imported content.

**Important:** Source-library `corrects` and `incorrects` are contextual relationships, not universally true/false labels. Before making a playable deck, the generator must check every selected card against **all active challenges**, eliminate ambiguous matches and duplicate texts, and select exactly one designated correct card per challenge. Other factually correct options must not be mislabelled as distractors for an active challenge. A card explanation is also contextual; do not display an unrelated or misleading explanation when someone drops a card on a different challenge.

## 9. Configurable question-generation direction
**`factToSubject` (Math default):** Board shows a correct fact/expression, answer card shows subject. Example: `3 + 4 = ?` → `7`.

**`subjectToFact` (Clinical default):** Board shows subject and topic, answer card shows one selected correct fact. Example: `Graves Disease — Work-up` → `Positive TSI/TRAb`.

Both methods must work for either app. Generation direction is **configuration**, not a separate JSON schema. Both use the same validated generated-challenge/answer-card format and shared gameplay engine.

## 10. Math content
- Hackathon scope: addition only; primary options are one-digit + one-digit, one-digit + two-digit, and two-digit + two-digit. Three-number addition optional later.
- Distinct result values for active problems; plausible unique numerical distractors, generated according to difficulty. Do not fill easy levels with absurdly large distractors merely to reach a fixed deck count.
- **Competitive initial target:** 24 unique cards total (nine correct-answer cards, fifteen distractors), including ten cards dealt and fourteen left to draw. Permit a smaller validated deck when the difficulty's plausible number range cannot support 24 unique values.
- Solitaire uses five displayed problems; deck size is configurable, selected to support an initial hand of five and penalties without violating uniqueness.
- Future arithmetic operations (subtraction, multiplication, division) are excluded from required Kiroween implementation.

## 11. Clinical content
- Disease-based high-yield facts, **not NBME-style questions**.
- Subject is a disease; topics are **Classic Signs & Symptoms**, **Work-up**, **Pathology**, and **Management/Treatment**. Include up to three concise clinical facts for each category, where available.
- Pathology may include mechanisms, causes, risk factors, associations, and complications; management includes drug complications and contraindications.
- Default challenge uses `subjectToFact`, e.g. disease + Work-up → a concise reviewed clinical finding. Avoid ambiguous clinical facts that match more than one active challenge, unless the generator can explicitly resolve/exclude them.
- Use authored/reviewed JSON with no external runtime AI needed to score play. AI creation of medical decks is out of scope for initial build.

## 12. Content sources, explanations, and adaptation
- Ship prepared demonstration JSON content for both apps.
- Support importing additional JSON with structural and gameplay validation; invalid imports must give actionable, understandable errors.
- Offer automatic math data generation through the standardized schema. Future AI-based clinical generation is optional and must include medical review before use.
- Source entries may include `explanation`; it is not displayed on the face of a card. Math defaults to brief automatic feedback on mistakes; Clinical defaults to correctness-only with an **Explain Why** button. Both defaults should be configurable.
- Track concepts and outcomes across games, including correct/incorrect plays, discards, and challenges, separately from card-game scores. Use browser-local storage for an initial no-account experience; explain that clearing browser data or switching devices can lose local history. Apply controlled repetition to problem selection.

## 13. Shared UI and interaction
- Modern polished desktop-first interface, responsive on tablets and phones. No retro/8-bit style.
- Screen flow: game choice → game setup → playing table → results/learning progress.
- **Solitaire:** header with score/game index, single horizontal row of **five** challenges, **draw deck and discard pile centered beneath board**, player hand along bottom.
- **Tutor Mode:** reuse Solitaire table; display tutor evaluation panel with Accept/Challenge for each pending student action. Do not visually leak validity before the tutor decides.
- **Player vs. Beepy:** face-down Beepy hand and avatar at top; nine shared challenges in a readable arrangement (two rows acceptable); centered draw/discard piles; human hand at bottom. Reveal only Beepy's current attempted card. Challenge/Accept buttons close to the revealed card. Show game/match score, turn, solved-problem credit, and completed challenges.
- Keep solved challenges visible and inactive; competitive challenge shows solver's identity.
- Support **both** drag-and-drop and click/tap a card then click/tap its destination. Selected cards are highlighted; cancel selection without penalty. Support keyboard access where practical.
- Correct actions use concise confirmation and smooth transition. Invalid actions or challenge outcomes display feedback, penalty animation, optional explanation, and Continue. Clinical cards can be wider and multiline; math answer cards are compact.

## 14. Architecture and project organization
Separate subject-neutral gameplay (players, hands, turn/evaluation lifecycle, challenge validation, penalties, winning, scoring, history) from educational data and app-specific generators/themes. Build two independently launchable demos with shared code rather than two copies of the engine.

Illustrative root structure (Kiro may recommend equivalent tooling before code is started):

```text
beepy-card-engine/
  .kiro/
    specs/
    steering/
    hooks/                 # only real, functional hooks when implemented
  math-cards/               # distinct app 1
  clinical-cards/           # distinct app 2
  shared-engine/            # reusable code
  docs/
    master-spec-v1.1.md
    kiro-development-log.md
  README.md
  LICENSE
  .gitignore
```

Never list `.kiro/` or its required descendants in `.gitignore`. Neither Kiro nor a Kiro account is needed for end users to play the deployed browser games. No cloud service is required for deterministic core gameplay.

## 15. Development evidence: mandatory from milestone 1
Keep `docs/kiro-development-log.md` as a **chronological, evidence-based journal**, updated at each meaningful milestone. Entries must cover:

- Date/time or date, milestone ID, and objective.
- Prompt ID/summary and linked Kiro spec or steering material.
- Kiro capabilities **actually used** (specs, steering, hooks, agent features, etc.).
- Files created or modified, commands actually run, and relevant Git commits (when available).
- Test names and observed results, including failures.
- Problems encountered and corrective actions.
- Outcome, outstanding issues, and evidence references (conversation export, screenshots, commit).

Record **only witnessed events**; do not infer or invent actions, successful tests, or Kiro features. Periodically export Kiro chats/session history and preserve material useful for the final write-up. ChatGPT cannot observe the user's local Kiro session automatically; the user will periodically provide logs/exports/code for review.

Create meaningful `.kiro` specs and steering early. Add a functional hook later when we have a real workflow to automate; do not create fictitious hooks merely to list features.

## 16. Testing and acceptance
Automate tests for card-value uniqueness across all game zones, the one-answer-per-challenge invariant, valid starting-hand compositions, contextual discard/play correctness, draw/penalty rules, draw-pile exhaustion, turn counts, Solitaire scoring/end states, Tutor evaluation and non-leakage, competitive challenge outcomes and wins/tiebreakers, both generation directions, invalid JSON imports, and controlled repetition. Perform browser smoke tests for both apps in all implemented modes and screen-size checks.

Core acceptance requires two independently working applications using shared code, no duplicate answer values in an active game, reliable deterministic judging, accurate game results, and public demo access.

## 17. Delivery and competition compliance
Public GitHub repo with two separate application folders, all required source/assets/instructions, detectable open-source license, and **root `.kiro/` directory included in Git**. Publish working URLs for both apps; prepare a **public YouTube demo under three minutes** and an evidence-based description of Kiro's development contribution. Respect intellectual property rights, original/new project restrictions, and the December 4, 2026 submission deadline. Check the live official rules before publishing.

## 18. Planned development phases
1. Project scaffolding, specs/steering, tracking journal and review of technical approach.
2. Unified JSON schema, game generation/validation, and automated invariants.
3. Shared engine + Math Solitaire and tests.
4. Tutor evaluation workflow on Math, then Clinical.
5. Player vs. Beepy mechanics and match logic.
6. Clinical curated content and working second application.
7. UI polish, responsive checks, adaptive review, import/generation features.
8. GitHub/hosting, tests, demo, submission documentation.

**Core target for hackathon:** Both apps working in Solitaire, Tutor, and Player vs. Beepy modes. If schedule becomes constrained, prioritize two functioning apps, stable shared engine, and competition submission requirements over optional enhancements. Player vs. Player, remote tutoring, and live AI clinical content generation remain future work.

## 19. Open implementation decisions (explicitly not agreed yet)
- Exact development framework and monorepo tooling; Kiro should propose these before writing implementation code.
- Concrete fallback strategy and card-count bounds when the draw deck runs out.
- Whether the first turn alternates after Game 1 in competitive matches.
- Detailed card proportions, animation timing, and accessibility refinements.
- Final collection wrapper for multiple source subjects, unique-ID namespace rules, and explanation fallback policy.

**Version 1.1 note:** Promotes Tutor Mode to Mode 2 and planned core scope; adds detailed Tutor Mode evaluation rules and updates implementation order. Supersedes Version 1.0 draft.
