/**
 * Global uniqueness enforcement (Milestone M2, Task 8).
 *
 * Implements validation pipeline stage 5 (design) and the no-duplicate-card
 * invariant (steering; master spec section 4; Req 3.4) over a `GeneratedDeck`:
 *   - V3: every answer-card id is unique, and every challenge id is unique.
 *   - V4: every answer-card display value is unique across the whole deck.
 *   - Numeric mode: for numeric content (Math), display values are compared AS
 *     NUMBERS, so "7", "07" and "7.0" count as the same answer, and a
 *     non-numeric value is reported. This keeps the shared engine subject-
 *     neutral: the caller opts in with `numericAnswers`, the engine never knows
 *     the subject.
 *   - Zones: when a snapshot of game zones is supplied (hands, draw deck,
 *     played, discard - named by the caller, not hard-coded here), every card id
 *     must exist in the deck, appear in at most one place, and no display value
 *     may repeat across all zones together.
 *
 * Relationship to Task 7: Task 7 rejects duplicate display TEXT after
 * normalization (case/whitespace) as an ambiguity check. This module enforces
 * exact (or numeric) uniqueness of ids and display values across zones. Each
 * validator stands alone, so a defect visible to both may be reported by both.
 *
 * Scope (Task 8 only). No starting hands (Task 9+), generation, gameplay, Beepy
 * AI, or UI. A zone snapshot does not need to contain every deck card: cards
 * minted later (penalty fallback, Task 12) are checked against the snapshot by
 * that task. Subject-neutral; no DOM/UI/framework dependency.
 *
 * References:
 * - .kiro/specs/educational-data-schema/requirements.md (Req 3.4)
 * - .kiro/specs/educational-data-schema/design.md (pipeline stage 5, D7)
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
 * A snapshot of where cards currently are: zone name -> card ids in that zone.
 * Zone names are chosen by the caller (for example a hand per player, the draw
 * deck, played cards, and the discard pile); the shared engine does not
 * hard-code gameplay zones.
 */
export type CardZones = Readonly<Record<string, readonly string[]>>;

/** Options for `validateUniqueness`. */
export interface UniquenessOptions {
  /** Compare display values as numbers (Math). Non-numeric values are reported. */
  readonly numericAnswers?: boolean;
  /** Optional snapshot of card ids per zone to check across all zones. */
  readonly zones?: CardZones;
}

const DECIMAL_PATTERN = /^-?\d+(\.\d+)?$/;

/**
 * Canonical form of a plain decimal number string ("07" and "7.0" both become
 * "7"), or `undefined` when the value is not a plain decimal number.
 */
export function canonicalNumber(value: string): string | undefined {
  const trimmed = value.trim();
  if (!DECIMAL_PATTERN.test(trimmed)) {
    return undefined;
  }
  return String(Number(trimmed));
}

/**
 * Validate global uniqueness of ids and display values for a generated deck,
 * and optionally across a zone snapshot. Reports ALL issues found, each with a
 * JSON-style path.
 */
export function validateUniqueness(
  deck: GeneratedDeck,
  options: UniquenessOptions = {},
): DeckValidationResult {
  const issues: DeckValidationIssue[] = [];
  const numeric = options.numericAnswers === true;

  // Comparison key for a display value; undefined when numeric mode cannot parse it.
  const keyOf = (displayValue: string): string | undefined =>
    numeric ? canonicalNumber(displayValue) : displayValue;

  // V3: card ids.
  const firstCardIdIndex = new Map<string, number>();
  deck.answerCards.forEach((card, ai) => {
    const first = firstCardIdIndex.get(card.id);
    if (first === undefined) {
      firstCardIdIndex.set(card.id, ai);
    } else {
      issues.push(
        deckIssue(
          CODES.duplicateCardId,
          `Card id "${card.id}" duplicates answerCards[${first}]; every card id must be unique.`,
          `answerCards[${ai}].id`,
        ),
      );
    }
  });

  // V3: challenge ids.
  const firstChallengeIdIndex = new Map<string, number>();
  deck.challenges.forEach((challenge, ci) => {
    const first = firstChallengeIdIndex.get(challenge.id);
    if (first === undefined) {
      firstChallengeIdIndex.set(challenge.id, ci);
    } else {
      issues.push(
        deckIssue(
          CODES.duplicateChallengeId,
          `Challenge id "${challenge.id}" duplicates challenges[${first}]; every challenge id must be unique.`,
          `challenges[${ci}].id`,
        ),
      );
    }
  });

  // V4: display values across the whole deck.
  const firstDisplayIndex = new Map<string, number>();
  deck.answerCards.forEach((card, ai) => {
    const path = `answerCards[${ai}].displayValue`;
    const key = keyOf(card.displayValue);
    if (key === undefined) {
      issues.push(
        deckIssue(
          CODES.nonNumericDisplayValue,
          `Display value "${card.displayValue}" is not a plain number, but numeric answers were required.`,
          path,
        ),
      );
      return;
    }
    const first = firstDisplayIndex.get(key);
    if (first === undefined) {
      firstDisplayIndex.set(key, ai);
    } else {
      issues.push(
        deckIssue(
          CODES.duplicateDisplayValue,
          `Display value "${card.displayValue}" duplicates answerCards[${first}] ("${deck.answerCards[first]?.displayValue ?? ''}")${numeric ? ' numerically' : ''}; every display value must be unique.`,
          path,
        ),
      );
    }
  });

  if (options.zones !== undefined) {
    checkZones(deck, options.zones, keyOf, issues);
  }

  return deckResult(issues);
}

/** Cross-zone checks: known cards, one location per card, unique display values. */
function checkZones(
  deck: GeneratedDeck,
  zones: CardZones,
  keyOf: (displayValue: string) => string | undefined,
  issues: DeckValidationIssue[],
): void {
  const cardById = new Map<string, string>();
  for (const card of deck.answerCards) {
    if (!cardById.has(card.id)) {
      cardById.set(card.id, card.displayValue);
    }
  }

  const firstLocationOfCard = new Map<string, string>();
  const firstLocationOfDisplay = new Map<string, string>();

  for (const zoneName of Object.keys(zones)) {
    (zones[zoneName] ?? []).forEach((cardId, i) => {
      const path = `zones["${zoneName}"][${i}]`;
      const displayValue = cardById.get(cardId);
      if (displayValue === undefined) {
        issues.push(
          deckIssue(
            CODES.unknownZoneCard,
            `Zone "${zoneName}" lists card "${cardId}", which is not in the deck.`,
            path,
          ),
        );
        return;
      }

      const firstCardLocation = firstLocationOfCard.get(cardId);
      if (firstCardLocation !== undefined) {
        issues.push(
          deckIssue(
            CODES.duplicateZoneCard,
            `Card "${cardId}" is already at ${firstCardLocation}; a card may exist in only one place.`,
            path,
          ),
        );
        return;
      }
      firstLocationOfCard.set(cardId, path);

      const key = keyOf(displayValue);
      if (key === undefined) {
        return; // Non-numeric value is already reported at deck level.
      }
      const firstDisplayLocation = firstLocationOfDisplay.get(key);
      if (firstDisplayLocation === undefined) {
        firstLocationOfDisplay.set(key, path);
      } else {
        issues.push(
          deckIssue(
            CODES.duplicateDisplayValue,
            `Display value "${displayValue}" (card "${cardId}") repeats the value at ${firstDisplayLocation}; display values must be unique across all zones.`,
            path,
          ),
        );
      }
    });
  }
}
