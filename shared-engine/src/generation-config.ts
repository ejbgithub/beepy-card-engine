/**
 * Generation-direction configuration (Milestone M2, Task 4).
 *
 * Implements D3 / Requirement 2: a single `generationDirection` CONFIG value
 * selects what is shown on the challenge versus the answer card. Direction is
 * configuration, NOT a separate schema; the unified source-data schema is
 * unchanged. Both directions are valid for EITHER application:
 *   - Math Cards defaults to `factToSubject`.
 *   - Clinical Cards defaults to `subjectToFact`.
 *   - Either app may select the other direction.
 *
 * Scope (Task 4 only): configuration types, defaults, and a small resolver
 * utility. This module performs NO actual card generation (later tasks), and no
 * validation, gameplay, Beepy AI, or UI. It is subject-neutral and has no
 * DOM/framework dependency.
 *
 * Reuses the `GenerationDirection` type from Task 3 (generated-deck.ts); it does
 * NOT redefine it. The configuration property is named `generationDirection`,
 * per design D3 and tasks.md Task 4. (This is distinct from the separate
 * `GeneratedDeck.direction` property defined in Task 3, which is unchanged.)
 *
 * References:
 * - docs/master-spec-v1.1.md section 9 (and section 8, section 10)
 * - .kiro/specs/educational-data-schema/requirements.md (Req 2)
 * - .kiro/specs/educational-data-schema/design.md (D3)
 * - .kiro/steering/educational-data-independence.md
 */

import type { GenerationDirection } from './generated-deck.js';

/** The two approved generation directions, as named constants. */
export const GENERATION_DIRECTIONS = {
  factToSubject: 'factToSubject',
  subjectToFact: 'subjectToFact',
} as const;

/**
 * Stable application keys used to pick a per-app default direction.
 *
 * These identify the two demo apps for configuration purposes only; the shared
 * engine remains subject-neutral and contains no app-specific gameplay logic.
 */
export const GENERATION_APPS = {
  math: 'math',
  clinical: 'clinical',
} as const;

export type GenerationApp =
  (typeof GENERATION_APPS)[keyof typeof GENERATION_APPS];

/**
 * The default generation direction for each app (master spec section 9):
 * Math -> `factToSubject`, Clinical -> `subjectToFact`. A default is only a
 * starting point; either app may override it (see `resolveGenerationDirection`).
 */
export const DEFAULT_DIRECTION_BY_APP: Readonly<
  Record<GenerationApp, GenerationDirection>
> = {
  [GENERATION_APPS.math]: GENERATION_DIRECTIONS.factToSubject,
  [GENERATION_APPS.clinical]: GENERATION_DIRECTIONS.subjectToFact,
};

/**
 * Generation configuration carried alongside a generation request.
 *
 * `generationDirection` is optional: when omitted, the per-app default applies.
 * This is configuration only — it does not describe how cards are generated,
 * only which direction a later generator should use. The property name matches
 * design D3 / tasks.md Task 4 (`generationDirection`).
 */
export interface GenerationConfig {
  /** The app whose default applies when `generationDirection` is not given. */
  readonly app: GenerationApp;
  /** Explicit direction override; falls back to the app default when absent. */
  readonly generationDirection?: GenerationDirection;
}

/** Type guard: is `value` one of the two approved generation directions. */
export function isGenerationDirection(
  value: unknown,
): value is GenerationDirection {
  return (
    value === GENERATION_DIRECTIONS.factToSubject ||
    value === GENERATION_DIRECTIONS.subjectToFact
  );
}

/** The default direction for a given app (master spec section 9). */
export function defaultDirectionForApp(
  app: GenerationApp,
): GenerationDirection {
  return DEFAULT_DIRECTION_BY_APP[app];
}

/**
 * Resolve the effective generation direction from a config: an explicit
 * `generationDirection` wins; otherwise the app's default is used. Lets either
 * app run either direction (Requirement 2.4).
 */
export function resolveGenerationDirection(
  config: GenerationConfig,
): GenerationDirection {
  return config.generationDirection ?? defaultDirectionForApp(config.app);
}

/** The opposite of a given direction; useful for toggles and tests. */
export function oppositeDirection(
  direction: GenerationDirection,
): GenerationDirection {
  return direction === GENERATION_DIRECTIONS.factToSubject
    ? GENERATION_DIRECTIONS.subjectToFact
    : GENERATION_DIRECTIONS.factToSubject;
}
