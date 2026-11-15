/**
 * Deck-generator boundary (Milestone M2, Task 5).
 *
 * Decision 4 / design "Separation and placement": subject-specific generation
 * logic lives in the app workspaces (`math-cards/`, `clinical-cards/`), while
 * `shared-engine/` owns only the subject-neutral CONTRACT that both generators
 * implement and the engine relies on. This module defines that boundary — the
 * `DeckGenerator` interface and its request/result shapes — so the two apps
 * produce the same `GeneratedDeck` contract from the same shared source-data
 * schema and generation-direction configuration.
 *
 * Scope (Task 5 only): the generator INTERFACE and its I/O types. This module
 * implements NO generation algorithm, validation, gameplay, Beepy AI, or UI.
 * The shared engine stays subject-neutral: nothing here knows about math
 * expressions or clinical facts.
 *
 * References:
 * - .kiro/specs/educational-data-schema/requirements.md (Req 5)
 * - .kiro/specs/educational-data-schema/design.md (Separation and placement)
 * - .kiro/steering/architecture.md
 * - .kiro/steering/educational-data-independence.md
 *
 * Subject-neutral; no DOM/UI/framework dependency.
 */

import type { SubjectCollection } from './source-data.js';
import type { GenerationConfig } from './generation-config.js';
import type { GeneratedDeck } from './generated-deck.js';
import type { ContextualValidityMap } from './challenge-mapping.js';

/**
 * Input to a deck generator.
 *
 * `source` is the validated/mergeable source content (subject-neutral schema);
 * `config` selects the app and generation direction (Task 4). `challengeCount`
 * is the number of displayed challenges the mode needs (e.g. 5 for
 * solitaire/tutor, 9 for vs Beepy). `targetCardCount` is the desired deck size
 * (design D8); a generator may produce a smaller validated deck when the
 * plausible range is limited.
 */
export interface GenerationRequest {
  readonly source: SubjectCollection;
  readonly config: GenerationConfig;
  readonly challengeCount: number;
  readonly targetCardCount: number;
}

/**
 * One structured generation problem. Same shape as the M2 structured issues
 * (`code`, `message`, `path`).
 */
export interface GenerationIssue {
  /** Stable machine-readable code. */
  readonly code: string;
  readonly message: string;
  /** JSON-style location of the problem, or a short field name. */
  readonly path: string;
}

/** Deck-size bookkeeping reported with a successful generation. */
export interface GenerationSizing {
  readonly targetCardCount: number;
  readonly actualCardCount: number;
  /** Size of the eligible distractor pool the deck was planned from. */
  readonly eligibleDistractors: number;
  /** True when the deck is smaller than its target. */
  readonly reduced: boolean;
}

/**
 * The structured result of a generation (Milestone M4, decision M4-1).
 *
 * Success carries a validated deck, its COMPLETE contextual-validity matrix (an
 * explicit boolean for every challenge and every card, as M2 Task 7 requires), and
 * how display values compare. Failure carries every issue found and NO deck: a
 * generator never returns a partial or unvalidated deck.
 */
export type GenerationResult =
  | {
      readonly ok: true;
      readonly deck: GeneratedDeck;
      readonly contextualValidity: ContextualValidityMap;
      /** Compare display values as numbers (true) or as normalized text (false). */
      readonly numericAnswers: boolean;
      readonly sizing: GenerationSizing;
    }
  | { readonly ok: false; readonly issues: readonly GenerationIssue[] };

/**
 * The subject-neutral deck-generator boundary each app implements.
 *
 * An app-specific generator (Math expression generation in `math-cards/`,
 * clinical fact selection in `clinical-cards/`) implements this interface. The
 * engine depends only on this contract and never on an app's internal generation
 * logic.
 *
 * The request type is a parameter (M4-1): Math generates its own facts and takes a
 * Math request, while Clinical selects from authored source data and keeps the
 * default `GenerationRequest`.
 *
 * Implementations uphold the generated-deck invariants (generated-deck.ts V1-V5)
 * and the deck-size rules (D8), and must validate their output before returning
 * it. `generate` must not throw for bad requests; it returns `{ ok: false }`.
 */
export interface DeckGenerator<TRequest = GenerationRequest> {
  /**
   * The app this generator produces content for. Lets a host pick the right
   * generator and lets the generator apply its app default direction.
   */
  readonly app: GenerationConfig['app'];

  /** Produce a validated deck and its matrix, or a structured failure. */
  generate(request: TRequest): GenerationResult;
}
