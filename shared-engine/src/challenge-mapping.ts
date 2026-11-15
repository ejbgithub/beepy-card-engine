/**
 * Challenge mapping and ambiguity elimination (Milestone M2, Task 7).
 *
 * Implements validation pipeline stages 3-4 (design) over a `GeneratedDeck`:
 *   Stage 3 - challenge mapping: every challenge designates exactly one correct
 *             answer card (V1: the card exists; V2: no card is designated for
 *             two challenges).
 *   Stage 4 - ambiguity elimination: reject duplicate display texts (Req 3.5)
 *             and reject contextual ambiguity (Req 3.3, 6.2): any answer card
 *             valid for more than one challenge, any challenge with more than
 *             one valid card, and a designated card that is not itself valid.
 *
 * Contextual validity is REQUIRED (Req 3.2). Before a deck is accepted, every
 * selected answer card must have been checked against every active challenge.
 * A generated deck records only the ONE designated card per challenge, so the
 * generator supplies its evaluation as an explicit matrix: for each challenge
 * id and each deck card id, a boolean saying whether that card is a valid answer
 * to that challenge in context (after the generator has resolved or excluded
 * ambiguous cards, Req 6.2). Because every (challenge, card) pair must carry an
 * explicit boolean, a generator cannot skip a card: a missing entry or pair is
 * reported, and a result is `ok` only when full evaluation was supplied AND no
 * ambiguity exists. If the input is absent entirely, the result is
 * `CONTEXTUAL_VALIDITY_MISSING`, never success.
 *
 * Scope (Task 7 only). No uniqueness-of-ids/zones (Task 8), starting hands
 * (Task 9+), generation, gameplay, Beepy AI, or UI. Subject-neutral.
 *
 * References:
 * - .kiro/specs/educational-data-schema/requirements.md (Req 3.1-3.3, 3.5, 6.2)
 * - .kiro/specs/educational-data-schema/design.md (pipeline stages 3-4, D7)
 * - .kiro/steering/no-duplicate-card-invariant.md
 */

import type { GeneratedDeck } from './generated-deck.js';
import {
  DECK_VALIDATION_CODES as CODES,
  deckIssue,
  deckResult,
  type DeckValidationIssue,
  type DeckValidationResult,
} from './deck-issues.js';

/**
 * Generator-supplied contextual-validity evaluation matrix:
 * `challengeId -> cardId -> isValidAnswer`. Must contain an explicit boolean for
 * EVERY challenge in the deck and EVERY card in the deck.
 */
export type ContextualValidityMap = Readonly<
  Record<string, Readonly<Record<string, boolean>>>
>;

/**
 * Normalize a display text for duplicate detection: Unicode NFC, trimmed,
 * internal whitespace collapsed, and case-folded. Two cards whose normalized
 * texts match are indistinguishable to a player.
 */
export function normalizeDisplayText(text: string): string {
  return text.normalize('NFC').trim().replace(/\s+/g, ' ').toLowerCase();
}

/**
 * Validate challenge mapping and ambiguity for a generated deck.
 *
 * `contextualValidity` is required. Reports ALL issues found (not just the
 * first), each with a JSON-style path. The deck-intrinsic checks (V1, V2,
 * duplicate display text) always run, even when contextual validity is missing.
 */
export function validateChallengeMapping(
  deck: GeneratedDeck,
  contextualValidity: ContextualValidityMap,
): DeckValidationResult {
  const issues: DeckValidationIssue[] = [];
  const cardIds = new Set(deck.answerCards.map((card) => card.id));

  // Stage 3: exactly one designated correct card per challenge (V1, V2).
  const firstChallengeForCard = new Map<string, number>();
  deck.challenges.forEach((challenge, ci) => {
    const path = `challenges[${ci}].correctAnswerCardId`;
    const cardId = challenge.correctAnswerCardId;
    if (!cardIds.has(cardId)) {
      issues.push(
        deckIssue(
          CODES.correctCardNotFound,
          `Challenge "${challenge.id}" designates correct card "${cardId}", which is not in the deck.`,
          path,
        ),
      );
      return;
    }
    const first = firstChallengeForCard.get(cardId);
    if (first === undefined) {
      firstChallengeForCard.set(cardId, ci);
    } else {
      issues.push(
        deckIssue(
          CODES.duplicateCorrectAssignment,
          `Card "${cardId}" is already the correct card for challenges[${first}]; each challenge needs its own unique correct card.`,
          path,
        ),
      );
    }
  });

  // Stage 4: duplicate display texts (Req 3.5).
  const firstCardForText = new Map<string, number>();
  deck.answerCards.forEach((card, ai) => {
    const key = normalizeDisplayText(card.displayValue);
    const first = firstCardForText.get(key);
    if (first === undefined) {
      firstCardForText.set(key, ai);
    } else {
      issues.push(
        deckIssue(
          CODES.duplicateDisplayText,
          `Display text "${card.displayValue}" duplicates answerCards[${first}] ("${deck.answerCards[first]?.displayValue ?? ''}") after normalization.`,
          `answerCards[${ai}].displayValue`,
        ),
      );
    }
  });

  // Stage 4: contextual ambiguity. Never skipped (Req 3.2, 3.3).
  if (!contextualValidity) {
    issues.push(
      deckIssue(
        CODES.contextualValidityMissing,
        'No contextual-validity evaluation was supplied. Every selected answer card must be evaluated against every active challenge before ambiguity can be validated.',
        'contextualValidity',
      ),
    );
  } else {
    checkContextualValidity(deck, contextualValidity, issues);
  }

  return deckResult(issues);
}

function checkContextualValidity(
  deck: GeneratedDeck,
  validity: ContextualValidityMap,
  issues: DeckValidationIssue[],
): void {
  const challengeIds = new Set(deck.challenges.map((challenge) => challenge.id));
  const cardIds = [...new Set(deck.answerCards.map((card) => card.id))];
  const cardIdSet = new Set(cardIds);

  // Entries naming challenges / cards that are not in the deck.
  for (const challengeId of Object.keys(validity)) {
    if (!challengeIds.has(challengeId)) {
      issues.push(
        deckIssue(
          CODES.unknownChallenge,
          `Contextual validity names challenge "${challengeId}", which is not in the deck.`,
          `contextualValidity["${challengeId}"]`,
        ),
      );
      continue;
    }
    for (const cardId of Object.keys(validity[challengeId] ?? {})) {
      if (!cardIdSet.has(cardId)) {
        issues.push(
          deckIssue(
            CODES.unknownCard,
            `Contextual validity for challenge "${challengeId}" names card "${cardId}", which is not in the deck.`,
            `contextualValidity["${challengeId}"]["${cardId}"]`,
          ),
        );
      }
    }
  }

  const firstChallengeForCard = new Map<string, number>();
  deck.challenges.forEach((challenge, ci) => {
    const cPath = `challenges[${ci}]`;
    if (!Object.hasOwn(validity, challenge.id)) {
      issues.push(
        deckIssue(
          CODES.missingValidityEntry,
          `Contextual validity has no entry for challenge "${challenge.id}"; every challenge must be evaluated against every card.`,
          cPath,
        ),
      );
      return;
    }
    const entry = validity[challenge.id] ?? {};

    // Every card must carry an explicit boolean evaluation for this challenge.
    const validCards: string[] = [];
    let designatedEvaluation: boolean | undefined;
    for (const cardId of cardIds) {
      const evaluation = Object.hasOwn(entry, cardId) ? entry[cardId] : undefined;
      if (typeof evaluation !== 'boolean') {
        issues.push(
          deckIssue(
            CODES.missingValidityEvaluation,
            `Card "${cardId}" has no true/false evaluation for challenge "${challenge.id}"; it was not checked against this challenge.`,
            `contextualValidity["${challenge.id}"]["${cardId}"]`,
          ),
        );
        continue;
      }
      if (cardId === challenge.correctAnswerCardId) {
        designatedEvaluation = evaluation;
      }
      if (evaluation) {
        validCards.push(cardId);
        const first = firstChallengeForCard.get(cardId);
        if (first === undefined) {
          firstChallengeForCard.set(cardId, ci);
        } else if (first !== ci) {
          issues.push(
            deckIssue(
              CODES.cardValidForMultipleChallenges,
              `Card "${cardId}" is a valid answer to both challenges[${first}] and ${cPath}; an ambiguous card must be resolved or excluded.`,
              cPath,
            ),
          );
        }
      }
    }

    // The designated card was checked and found NOT valid for its challenge.
    if (designatedEvaluation === false) {
      issues.push(
        deckIssue(
          CODES.designatedCardNotValid,
          `Designated correct card "${challenge.correctAnswerCardId}" was evaluated as not valid for challenge "${challenge.id}".`,
          `${cPath}.correctAnswerCardId`,
        ),
      );
    }

    // More than one DISTINCT valid card: genuinely ambiguous challenge.
    if (validCards.length > 1) {
      issues.push(
        deckIssue(
          CODES.multipleValidCardsForChallenge,
          `Challenge "${challenge.id}" has ${validCards.length} valid answers: ${validCards.map((id) => `"${id}"`).join(', ')}. Exactly one card may be valid.`,
          cPath,
        ),
      );
    }
  });
}
