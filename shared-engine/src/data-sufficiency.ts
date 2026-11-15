/**
 * Insufficient-data detection (Milestone M2, Task 13; Req 6.1, 6.2; design D7, D8).
 *
 * Before a deck is built, two pure checks decide whether the data CAN produce a
 * valid deck. When it cannot, they fail cleanly with actionable structured issues
 * and return nothing else: no plan, no analysis, and never a partial or invalid
 * deck. Both are subject-neutral.
 *
 * 1. `assessDeckData` - are there enough UNIQUE values? It counts the distinct
 *    usable values in a pool of correct answers and a pool of distractors
 *    (case/whitespace-insensitive, or numerically in numeric mode), then checks
 *    them against the mode's requirements through the Task 11 planner:
 *      - a pool whose supplied count LOOKS sufficient but whose unique count is
 *        not reports `TOO_FEW_UNIQUE_VALUES` (duplicates, invalid values, and
 *        distractors equal to a correct value are all counted out);
 *      - a pool that is simply too small, so the range cannot cover the mode's
 *        required hands plus draw reserve, reports `INSUFFICIENT_DECK_DATA`;
 *      - an unusable target or mode passes through the planner's own issue.
 *
 * 2. `analyzeCandidateAmbiguity` - is there an UNAMBIGUOUS correct card for every
 *    challenge? From the generator's full candidate-by-challenge evaluation (the
 *    Task 7 matrix shape, with no skipped pair), it sorts candidates into
 *    unambiguous correct options per challenge, ambiguous cards (valid for more
 *    than one challenge, which the generator must resolve or exclude, Req 6.2), and
 *    distractor candidates. A challenge with no unambiguous option reports
 *    `NO_UNAMBIGUOUS_CORRECT_CARD`.
 *
 * Scope (Task 13 only). These checks do not select values, create cards, or build
 * a deck; the generators (later work) use them as a gate. The `DeckGenerator`
 * interface from Task 5 is unchanged.
 *
 * References:
 * - .kiro/specs/educational-data-schema/requirements.md (Req 6.1, 6.2)
 * - .kiro/specs/educational-data-schema/design.md (D7, D8)
 */

import {
  normalizeDisplayText,
  type ContextualValidityMap,
} from './challenge-mapping.js';
import { DECK_VALIDATION_CODES as CODES, deckIssue, type DeckValidationIssue } from './deck-issues.js';
import { MIN_PENALTY_RESERVE } from './dual-hand.js';
import {
  expectedChallengeCount,
  handCountForMode,
  isDeckMode,
  minimumDistractors,
  planDeckSize,
  type DeckMode,
  type DeckSizePlan,
} from './deck-size.js';
import { canonicalNumber } from './uniqueness.js';

/** How many usable, distinct values a pool of display values contains. */
export interface UniqueValueCount {
  /** Values supplied, valid or not. */
  readonly supplied: number;
  /** Distinct usable values. */
  readonly unique: number;
  /** Usable values that repeat an earlier one. */
  readonly duplicates: number;
  /** Blank, non-string, or (numeric mode) non-numeric values. */
  readonly invalid: number;
  /** The normalized key of each distinct usable value. */
  readonly keys: ReadonlySet<string>;
}

/**
 * Count the distinct usable values in a pool. Text mode compares with the same
 * case/whitespace normalization as the duplicate-text check; numeric mode compares
 * as numbers, so "7", "07" and "7.0" are one value.
 */
export function countUniqueValues(
  values: readonly string[],
  options: { readonly numericAnswers?: boolean } = {},
): UniqueValueCount {
  const numeric = options.numericAnswers === true;
  const keys = new Set<string>();
  let invalid = 0;
  let valid = 0;
  for (const value of values) {
    const key =
      typeof value !== 'string' || value.trim() === ''
        ? undefined
        : numeric
          ? canonicalNumber(value)
          : normalizeDisplayText(value);
    if (key === undefined) {
      invalid += 1;
      continue;
    }
    valid += 1;
    keys.add(key);
  }
  return {
    supplied: values.length,
    unique: keys.size,
    duplicates: valid - keys.size,
    invalid,
    keys,
  };
}

/** Pools of display values a generator could draw from. */
export interface DeckDataPools {
  /** Values that could serve as correct answers (one per challenge is needed). */
  readonly correctValues: readonly string[];
  /** Values that could serve as plausible distractors. */
  readonly distractorValues: readonly string[];
  /** Compare values as numbers (Math). */
  readonly numericAnswers?: boolean;
}

/**
 * The outcome of `assessDeckData`. A failure carries issues only: no plan and no
 * deck.
 */
export type DeckDataAssessment =
  | {
      readonly ok: true;
      readonly plan: Extract<DeckSizePlan, { readonly ok: true }>;
      readonly uniqueCorrect: number;
      readonly uniqueDistractors: number;
    }
  | { readonly ok: false; readonly issues: readonly DeckValidationIssue[] };

function shortageIssue(
  pool: 'correctValues' | 'distractorValues',
  label: string,
  mode: DeckMode,
  needed: number,
  counts: { supplied: number; unique: number; duplicates: number; invalid: number; overlap: number },
): DeckValidationIssue {
  const removed = counts.duplicates + counts.invalid + counts.overlap;
  if (removed > 0) {
    const parts = [
      `${counts.duplicates} duplicate`,
      `${counts.invalid} invalid`,
      ...(counts.overlap > 0 ? [`${counts.overlap} equal to a correct value`] : []),
    ].join(', ');
    return deckIssue(
      CODES.tooFewUniqueValues,
      `${counts.supplied} ${label} value(s) supplied but only ${counts.unique} are unique and usable (${parts}); mode "${mode}" needs at least ${needed}. Add more distinct values.`,
      pool,
    );
  }
  return deckIssue(
    CODES.insufficientDeckData,
    `Only ${counts.unique} distinct ${label} value(s) are available; mode "${mode}" needs at least ${needed} for its starting hands and draw reserve. The deck will not be padded with implausible values.`,
    pool,
  );
}

/**
 * Decide whether the supplied pools can produce a valid deck for a mode. Returns
 * the achievable plan on success, or every problem found (and nothing else) on
 * failure.
 */
export function assessDeckData(
  mode: DeckMode,
  targetCardCount: number,
  pools: DeckDataPools,
): DeckDataAssessment {
  if (!isDeckMode(mode)) {
    const probe = planDeckSize(mode, targetCardCount, {
      availableCorrect: 0,
      availableDistractors: 0,
    });
    return { ok: false, issues: probe.ok ? [] : [probe.issue] };
  }

  const numeric = pools.numericAnswers === true;
  const correct = countUniqueValues(pools.correctValues, { numericAnswers: numeric });
  const distractorPool = countUniqueValues(pools.distractorValues, { numericAnswers: numeric });

  // A distractor that equals a correct value is not a distractor: it would repeat a card.
  let overlap = 0;
  let uniqueDistractors = 0;
  for (const key of distractorPool.keys) {
    if (correct.keys.has(key)) {
      overlap += 1;
    } else {
      uniqueDistractors += 1;
    }
  }

  const neededCorrect = expectedChallengeCount(mode);
  const neededDistractors =
    minimumDistractors(neededCorrect, handCountForMode(mode), MIN_PENALTY_RESERVE) ?? 0;

  const issues: DeckValidationIssue[] = [];
  if (correct.unique < neededCorrect) {
    issues.push(
      shortageIssue('correctValues', 'correct-answer', mode, neededCorrect, {
        ...correct,
        overlap: 0,
      }),
    );
  }
  if (uniqueDistractors < neededDistractors) {
    issues.push(
      shortageIssue('distractorValues', 'distractor', mode, neededDistractors, {
        supplied: distractorPool.supplied,
        unique: uniqueDistractors,
        duplicates: distractorPool.duplicates,
        invalid: distractorPool.invalid,
        overlap,
      }),
    );
  }

  const plan = planDeckSize(mode, targetCardCount, {
    availableCorrect: correct.unique,
    availableDistractors: uniqueDistractors,
  });
  if (!plan.ok && (plan.issue.code !== CODES.insufficientDeckData || issues.length === 0)) {
    issues.push(plan.issue);
  }

  if (!plan.ok || issues.length > 0) {
    return { ok: false, issues };
  }
  return { ok: true, plan, uniqueCorrect: correct.unique, uniqueDistractors };
}

/** Candidate cards sorted by how many challenges they are a valid answer to. */
export interface CandidateAnalysis {
  /**
   * For each challenge, candidates valid for THAT challenge only, in candidate
   * order. The generator designates one and must exclude the rest, or the
   * challenge would have a second valid answer.
   */
  readonly unambiguousByChallenge: Readonly<Record<string, readonly string[]>>;
  /** Candidates valid for more than one challenge: resolve or exclude them (Req 6.2). */
  readonly ambiguousCards: readonly string[];
  /** Candidates valid for no challenge: usable as distractors. */
  readonly distractorCandidates: readonly string[];
}

/**
 * The outcome of `analyzeCandidateAmbiguity`. A failure carries issues only: no
 * analysis and no deck.
 */
export type CandidateAnalysisResult =
  | { readonly ok: true; readonly analysis: CandidateAnalysis }
  | { readonly ok: false; readonly issues: readonly DeckValidationIssue[] };

/**
 * Check that every challenge has at least one unambiguous correct-answer
 * candidate, given the generator's evaluation of EVERY candidate against EVERY
 * challenge (`challengeId -> cardId -> isValid`, as for `validateChallengeMapping`).
 *
 * Like the Task 7 validator, it never skips: an absent matrix, a missing challenge
 * entry, or any unevaluated or non-boolean pair is reported and no analysis is
 * produced.
 */
export function analyzeCandidateAmbiguity(
  challengeIds: readonly string[],
  candidateCardIds: readonly string[],
  contextualValidity: ContextualValidityMap,
): CandidateAnalysisResult {
  const issues: DeckValidationIssue[] = [];

  const firstChallengeIndex = new Map<string, number>();
  challengeIds.forEach((id, i) => {
    const first = firstChallengeIndex.get(id);
    if (first === undefined) {
      firstChallengeIndex.set(id, i);
    } else {
      issues.push(
        deckIssue(
          CODES.duplicateChallengeId,
          `Challenge id "${id}" duplicates challengeIds[${first}].`,
          `challengeIds[${i}]`,
        ),
      );
    }
  });
  const firstCardIndex = new Map<string, number>();
  candidateCardIds.forEach((id, i) => {
    const first = firstCardIndex.get(id);
    if (first === undefined) {
      firstCardIndex.set(id, i);
    } else {
      issues.push(
        deckIssue(
          CODES.duplicateCardId,
          `Candidate card id "${id}" duplicates candidateCardIds[${first}].`,
          `candidateCardIds[${i}]`,
        ),
      );
    }
  });

  if (!contextualValidity) {
    issues.push(
      deckIssue(
        CODES.contextualValidityMissing,
        'No contextual-validity evaluation was supplied. Every candidate card must be evaluated against every challenge before ambiguity can be analyzed.',
        'contextualValidity',
      ),
    );
    return { ok: false, issues };
  }

  const challenges = [...firstChallengeIndex.keys()];
  const cards = [...firstCardIndex.keys()];
  const challengeSet = new Set(challenges);
  const cardSet = new Set(cards);

  for (const challengeId of Object.keys(contextualValidity)) {
    if (!challengeSet.has(challengeId)) {
      issues.push(
        deckIssue(
          CODES.unknownChallenge,
          `Contextual validity names challenge "${challengeId}", which is not in challengeIds.`,
          `contextualValidity["${challengeId}"]`,
        ),
      );
      continue;
    }
    for (const cardId of Object.keys(contextualValidity[challengeId] ?? {})) {
      if (!cardSet.has(cardId)) {
        issues.push(
          deckIssue(
            CODES.unknownCard,
            `Contextual validity for challenge "${challengeId}" names card "${cardId}", which is not in candidateCardIds.`,
            `contextualValidity["${challengeId}"]["${cardId}"]`,
          ),
        );
      }
    }
  }

  // Full coverage: every challenge, every candidate, an explicit boolean.
  for (const challengeId of challenges) {
    const ci = firstChallengeIndex.get(challengeId) ?? 0;
    if (!Object.hasOwn(contextualValidity, challengeId)) {
      issues.push(
        deckIssue(
          CODES.missingValidityEntry,
          `Contextual validity has no entry for challenge "${challengeId}"; every challenge must be evaluated against every candidate.`,
          `challengeIds[${ci}]`,
        ),
      );
      continue;
    }
    const entry = contextualValidity[challengeId] ?? {};
    for (const cardId of cards) {
      const evaluation = Object.hasOwn(entry, cardId) ? entry[cardId] : undefined;
      if (typeof evaluation !== 'boolean') {
        issues.push(
          deckIssue(
            CODES.missingValidityEvaluation,
            `Candidate "${cardId}" has no true/false evaluation for challenge "${challengeId}"; it was not checked against this challenge.`,
            `contextualValidity["${challengeId}"]["${cardId}"]`,
          ),
        );
      }
    }
  }
  if (issues.length > 0) {
    return { ok: false, issues };
  }

  // Sort candidates by how many challenges they are valid for.
  const validFor = new Map<string, string[]>();
  for (const cardId of cards) {
    const challengesForCard: string[] = [];
    for (const challengeId of challenges) {
      if (contextualValidity[challengeId]?.[cardId] === true) {
        challengesForCard.push(challengeId);
      }
    }
    validFor.set(cardId, challengesForCard);
  }

  const unambiguousByChallenge: Record<string, string[]> = {};
  for (const challengeId of challenges) {
    unambiguousByChallenge[challengeId] = cards.filter((cardId) => {
      const list = validFor.get(cardId) ?? [];
      return list.length === 1 && list[0] === challengeId;
    });
  }
  const ambiguousCards = cards.filter((cardId) => (validFor.get(cardId) ?? []).length > 1);
  const distractorCandidates = cards.filter((cardId) => (validFor.get(cardId) ?? []).length === 0);

  for (const challengeId of challenges) {
    if ((unambiguousByChallenge[challengeId] ?? []).length > 0) {
      continue;
    }
    const ci = firstChallengeIndex.get(challengeId) ?? 0;
    const validCount = cards.filter((cardId) => validFor.get(cardId)?.includes(challengeId)).length;
    issues.push(
      deckIssue(
        CODES.noUnambiguousCorrectCard,
        validCount === 0
          ? `Challenge "${challengeId}" has no correct-answer candidate: none of the ${cards.length} candidate(s) is a valid answer to it.`
          : `Challenge "${challengeId}" has no unambiguous correct-answer candidate: all ${validCount} candidate(s) valid for it are also valid for another challenge. Resolve or exclude the ambiguity.`,
        `challengeIds[${ci}]`,
      ),
    );
  }
  if (issues.length > 0) {
    return { ok: false, issues };
  }

  return {
    ok: true,
    analysis: { unambiguousByChallenge, ambiguousCards, distractorCandidates },
  };
}
