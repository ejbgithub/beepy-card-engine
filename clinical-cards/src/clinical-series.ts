/**
 * Beepy's Clinical Cards series wrapper (Milestone M6, stage C4; design section 7).
 *
 * The TRUSTED layer for the Clinical app, following the Math series pattern in its
 * own code (no import from `math-cards`). It owns the M3 series controller, the
 * Clinical generator and the Clinical penalty fallback. For each game it generates
 * a validated deck and hands it to `controller.startNextGame` inside this closure.
 * The UI receives only what the M3 controller already exposes (sanitized views,
 * public events, public errors, series status) plus `explainResolved`.
 *
 * Never returned: decks, card ids, designated answers, validity matrices, the
 * dataset index, review records or fingerprints, generator seeds, or generator
 * and review issues. Those go only to the trusted `diagnostics` callback.
 *
 * Explain Why (decision C-5): `explainResolved(turn)` reads the controller's PUBLIC
 * events for the current game, finds the `ACTION_RESOLVED` event for that turn, and
 * returns the explanation the author wrote for exactly that (card, challenge)
 * context, verbatim, or "unavailable". A pending action has no `ACTION_RESOLVED`
 * event, so nothing about it (including Beepy's pending move before
 * Accept/Challenge) can be learned. Discards never have an explanation (C-11).
 *
 * Data (C5): by default the shipped, owner-reviewed files in clinical-cards/src/data/
 * (`shipped-data.ts`); both must exist and validate, or the series is refused with
 * a friendly code (`CLINICAL_DATA_MISSING`, `CLINICAL_REVIEW_MISSING`,
 * `CLINICAL_DATA_INVALID`, `CLINICAL_REVIEW_INVALID`). There is no fallback to other
 * content. Tests may inject `dataset` (and optionally `review`) explicitly; injected
 * values are validated the same way.
 *
 * Honest limit: this is a static browser app, so the deck exists in page memory.
 * The boundary prevents leaks through the UI's data path; it does not stop a user
 * inspecting their own page with developer tools.
 */

import {
  createReferenceBeepyStrategy,
  createSeriesController,
  isGenerationDirection,
  nextUint32,
  toRngState,
  type ControllerResult,
  type GeneratedChallenge,
  type GenerationDirection,
  type GenerationIssue,
  type HumanActionRequest,
  type PublicError,
  type PublicEvent,
  type SeriesController,
  type SeriesStatusPublicResult,
  type SubjectCollection,
  type TrustedDiagnostic,
  type ValidationIssue,
} from '@beepy/shared-engine';
import { validateClinicalCollection, type ClinicalContentIssue } from './clinical-content.js';
import { CLINICAL_DATA_MESSAGES, type ClinicalDataIssue } from './clinical-data.js';
import { loadShippedClinicalContent } from './shipped-data.js';
import { createClinicalFallbackProvider } from './clinical-fallback.js';
import {
  CLINICAL_COMPETITIVE_TARGET_CARD_COUNT,
  CLINICAL_SOLITAIRE_TARGET_CARD_COUNT,
  authoredExplanation,
  generateClinicalDeck,
  resolveChallengeContext,
  type ClinicalMode,
} from './clinical-generator.js';
import { NO_REVIEWS, createValidityPolicy, validateReviewFile, type ReviewIssue, type ReviewValidationResult } from './clinical-review.js';

/** Default probability of a deliberate Beepy mistake (same default as Math). */
export const CLINICAL_DEFAULT_BEEPY_ERROR_RATE = 0.2;

/** Clinical series codes (in addition to the M3 controller's public codes). */
export const CLINICAL_SERIES_CODES = {
  invalidConfig: 'INVALID_CONFIG',
  modeNotSupported: 'MODE_NOT_SUPPORTED',
  invalidMode: 'INVALID_MODE',
  invalidDirection: 'INVALID_DIRECTION',
  invalidSeed: 'INVALID_SEED',
  invalidOption: 'INVALID_OPTION',
  dataMissing: 'CLINICAL_DATA_MISSING',
  reviewMissing: 'CLINICAL_REVIEW_MISSING',
  invalidData: 'CLINICAL_DATA_INVALID',
  invalidReview: 'CLINICAL_REVIEW_INVALID',
  invalidRequest: 'INVALID_REQUEST',
  generationFailed: 'CLINICAL_GENERATION_FAILED',
  seriesFault: 'CLINICAL_SERIES_FAULT',
} as const;

export type ClinicalSeriesCode = (typeof CLINICAL_SERIES_CODES)[keyof typeof CLINICAL_SERIES_CODES];

/** Fixed, detail-free public messages. */
const MESSAGES: Readonly<Record<ClinicalSeriesCode, string>> = {
  INVALID_CONFIG: 'The game settings are invalid.',
  MODE_NOT_SUPPORTED: 'That game mode is not available yet.',
  INVALID_MODE: 'That game mode is not supported.',
  INVALID_DIRECTION: 'That question style is not supported.',
  INVALID_SEED: 'The game settings are invalid.',
  INVALID_OPTION: 'A game setting is invalid.',
  CLINICAL_DATA_MISSING: CLINICAL_DATA_MESSAGES.CLINICAL_DATA_MISSING,
  CLINICAL_REVIEW_MISSING: CLINICAL_DATA_MESSAGES.CLINICAL_REVIEW_MISSING,
  CLINICAL_DATA_INVALID: CLINICAL_DATA_MESSAGES.CLINICAL_DATA_INVALID,
  CLINICAL_REVIEW_INVALID: CLINICAL_DATA_MESSAGES.CLINICAL_REVIEW_INVALID,
  INVALID_REQUEST: 'That request is not valid.',
  CLINICAL_GENERATION_FAILED: 'A new deck could not be prepared for this game.',
  CLINICAL_SERIES_FAULT: 'Something went wrong while preparing the game.',
};

export type ClinicalSeriesError = PublicError | { readonly code: ClinicalSeriesCode; readonly message: string };
export type ClinicalSeriesResult = ControllerResult | { readonly ok: false; readonly error: ClinicalSeriesError };

/** Trusted-only diagnostics. Never connect these to the UI. */
export type ClinicalSeriesDiagnostic =
  | TrustedDiagnostic
  | { readonly operation: string; readonly generationIssues: readonly GenerationIssue[] }
  | { readonly operation: string; readonly datasetIssues: readonly (ValidationIssue | ClinicalContentIssue)[] }
  | { readonly operation: string; readonly contentIssues: readonly ClinicalDataIssue[] }
  | { readonly operation: string; readonly reviewIssues: readonly ReviewIssue[]; readonly staleReviews: readonly ReviewIssue[] };

/** The result of `explainResolved`. Carries no card ids, validity, or answers. */
export type ExplainResult =
  | { readonly ok: true; readonly available: true; readonly explanation: string }
  | { readonly ok: true; readonly available: false; readonly reason: 'notResolved' | 'discard' | 'noExplanation' }
  | { readonly ok: false; readonly error: ClinicalSeriesError };

/** Settings for one Solitaire session or Player vs. Beepy match. */
export interface ClinicalSeriesConfig {
  readonly mode: ClinicalMode;
  /** Defaults to `subjectToFact` (master spec section 9). */
  readonly generationDirection?: GenerationDirection;
  /** Series seed (any finite number). Not exposed to the UI. */
  readonly seed: number;
  /** vsBeepy only: probability of a deliberate Beepy mistake, 0 to 1. Default 0.2. */
  readonly beepyErrorRate?: number;
  /** Deck-size target for the mode. Defaults 15 (Solitaire) / 24 (vsBeepy). */
  readonly targetCardCount?: number;
  /**
   * Explicit dataset injection (tests). When omitted, the shipped, owner-reviewed
   * files in clinical-cards/src/data/ are used; both must exist and validate.
   */
  readonly dataset?: unknown;
  /** With an injected dataset only: the review file (optional). Ignored for shipped data. */
  readonly review?: unknown;
  /** Trusted sink for unsanitized diagnostics. Never connect this to the UI. */
  readonly diagnostics?: (diagnostic: ClinicalSeriesDiagnostic) => void;
}

/** The object the UI uses. Methods only; there is no way to read a deck. */
export interface ClinicalSeries {
  startNextGame(): ClinicalSeriesResult;
  getView(): ControllerResult;
  submitHumanAction(request: HumanActionRequest): ControllerResult;
  decide(decision: unknown): ControllerResult;
  advanceBeepy(): ControllerResult;
  getSeriesStatus(): SeriesStatusPublicResult;
  getPublicEvents(): readonly PublicEvent[];
  /** Explain Why for a RESOLVED action of the current game, by its public turn number. */
  explainResolved(turn: unknown): ExplainResult;
}

/**
 * Derive one game's generator seed from the series seed and the 1-based game
 * index. Pure; mixes through the exported `nextUint32`; independent of the M3
 * engine streams and of the Math derivation. Exported for tests.
 */
export function deriveClinicalGeneratorSeed(seriesSeed: number, gameIndex: number): number {
  const [first] = nextUint32((toRngState(seriesSeed) ^ 0x434c494e) >>> 0); // "CLIN"
  const [second] = nextUint32((first ^ Math.imul(toRngState(gameIndex), 0x9e3779b1)) >>> 0);
  return second;
}

type Failure = { readonly ok: false; readonly error: { readonly code: ClinicalSeriesCode; readonly message: string } };
const publicFailure = (code: ClinicalSeriesCode): Failure => ({ ok: false, error: { code, message: MESSAGES[code] } });

/** Create a Clinical series, or a structured failure for invalid settings or data. Never throws. */
export function createClinicalSeries(
  config: ClinicalSeriesConfig,
): { readonly ok: true; readonly series: ClinicalSeries } | { readonly ok: false; readonly error: ClinicalSeriesError } {
  let sink: ((d: ClinicalSeriesDiagnostic) => void) | undefined;
  const report = (diagnostic: ClinicalSeriesDiagnostic): void => {
    if (sink === undefined) return;
    try {
      sink(diagnostic);
    } catch {
      // A failing diagnostics sink never changes a result.
    }
  };

  try {
    if (typeof config !== 'object' || config === null) return publicFailure(CLINICAL_SERIES_CODES.invalidConfig);
    sink = typeof config.diagnostics === 'function' ? config.diagnostics : undefined;
    const raw = config as unknown as Record<string, unknown>;
    const mode: unknown = raw['mode'];
    const seed: unknown = raw['seed'];
    const direction: unknown = raw['generationDirection'] ?? 'subjectToFact';
    const errorRate: unknown = raw['beepyErrorRate'] ?? CLINICAL_DEFAULT_BEEPY_ERROR_RATE;
    const target: unknown = raw['targetCardCount'];
    const injectedReview: unknown = raw['review'];

    const problems: GenerationIssue[] = [];
    const add = (code: ClinicalSeriesCode, message: string, path: string): void => {
      problems.push({ code, message, path });
    };
    if (mode === 'tutor' || mode === 'vsPlayer') add(CLINICAL_SERIES_CODES.modeNotSupported, `Mode "${mode}" is not supported.`, 'mode');
    else if (mode !== 'solitaire' && mode !== 'vsBeepy') add(CLINICAL_SERIES_CODES.invalidMode, 'mode must be "solitaire" or "vsBeepy".', 'mode');
    if (!isGenerationDirection(direction)) add(CLINICAL_SERIES_CODES.invalidDirection, 'Unknown generation direction.', 'generationDirection');
    if (typeof seed !== 'number' || !Number.isFinite(seed)) add(CLINICAL_SERIES_CODES.invalidSeed, 'seed must be a finite number.', 'seed');
    if (typeof errorRate !== 'number' || !Number.isFinite(errorRate) || errorRate < 0 || errorRate > 1) {
      add(CLINICAL_SERIES_CODES.invalidOption, 'beepyErrorRate must be a number from 0 to 1.', 'beepyErrorRate');
    }
    if (target !== undefined && !(typeof target === 'number' && Number.isSafeInteger(target) && target >= 1)) {
      add(CLINICAL_SERIES_CODES.invalidOption, 'targetCardCount must be a positive whole number.', 'targetCardCount');
    }
    if (problems.length > 0) {
      report({ operation: 'createClinicalSeries', generationIssues: problems });
      return publicFailure((problems[0] as GenerationIssue).code as ClinicalSeriesCode);
    }

    // Data (C5): the shipped, owner-reviewed files are the default. A `dataset` in the
    // config is explicit injection (tests). Either way the content is validated before
    // any game, and there is no fallback to other content.
    let collection: SubjectCollection;
    let review: ReviewValidationResult;
    let reviewValue: unknown;
    if (raw['dataset'] === undefined) {
      const shipped = loadShippedClinicalContent();
      if (!shipped.ok) {
        report({ operation: 'createClinicalSeries', contentIssues: shipped.issues });
        return publicFailure(shipped.code);
      }
      collection = shipped.content.collection;
      review = shipped.content.review;
      reviewValue = shipped.content.reviewValue;
    } else {
      const dataset = validateClinicalCollection(raw['dataset']);
      if (!dataset.ok) {
        report({ operation: 'createClinicalSeries', datasetIssues: dataset.issues });
        return publicFailure(CLINICAL_SERIES_CODES.invalidData);
      }
      collection = dataset.collection;
      reviewValue = injectedReview;
      review = reviewValue === undefined ? NO_REVIEWS : validateReviewFile(reviewValue, collection);
      if (!review.fileUsable) {
        report({ operation: 'createClinicalSeries', reviewIssues: review.issues, staleReviews: review.stale });
        return publicFailure(CLINICAL_SERIES_CODES.invalidReview);
      }
    }
    if (review.issues.length > 0 || review.stale.length > 0) {
      // Not fatal: such records are simply not used. The trusted sink hears about them.
      report({ operation: 'createClinicalSeries', reviewIssues: review.issues, staleReviews: review.stale });
    }

    const seriesMode = mode as ClinicalMode;
    const seriesSeed = seed as number;
    const seriesDirection = direction as GenerationDirection;
    const targetCardCount =
      (target as number | undefined) ?? (seriesMode === 'vsBeepy' ? CLINICAL_COMPETITIVE_TARGET_CARD_COUNT : CLINICAL_SOLITAIRE_TARGET_CARD_COUNT);
    const policy = createValidityPolicy(collection, review);
    const fallback = createClinicalFallbackProvider({ collection, review, direction: seriesDirection });

    let beepyStrategy;
    if (seriesMode === 'vsBeepy') {
      const created = createReferenceBeepyStrategy({ errorRate: errorRate as number });
      if (!created.ok) return publicFailure(CLINICAL_SERIES_CODES.invalidOption);
      beepyStrategy = created.strategy;
    }

    const created = createSeriesController({
      mode: seriesMode,
      seed: seriesSeed,
      options: { numericAnswers: false, fallback },
      ...(beepyStrategy === undefined ? {} : { beepyStrategy }),
      diagnostics: (diagnostic) => report(diagnostic),
    });
    if (!created.ok) return { ok: false, error: created.error };
    const controller: SeriesController = created.controller;

    /** Private: the current game's challenges (prompt + sourceRef), for Explain Why only. */
    let currentChallenges = new Map<string, Pick<GeneratedChallenge, 'promptText' | 'sourceRef'>>();

    const explainResolved = (turn: unknown): ExplainResult => {
      try {
        if (typeof turn !== 'number' || !Number.isSafeInteger(turn) || turn < 1) return publicFailure(CLINICAL_SERIES_CODES.invalidRequest);
        const event = controller
          .getPublicEvents()
          .find((e): e is Extract<PublicEvent, { type: 'ACTION_RESOLVED' }> => e.type === 'ACTION_RESOLVED' && e.turn === turn);
        if (event === undefined) return { ok: true, available: false, reason: 'notResolved' };
        if (event.kind !== 'play') return { ok: true, available: false, reason: 'discard' };
        const challenge = currentChallenges.get(event.destination);
        const spec = challenge === undefined ? undefined : resolveChallengeContext(collection, seriesDirection, challenge);
        const explanation = spec === undefined ? undefined : authoredExplanation(collection, policy, seriesDirection, event.card.displayValue, spec);
        return explanation === undefined ? { ok: true, available: false, reason: 'noExplanation' } : { ok: true, available: true, explanation };
      } catch {
        return publicFailure(CLINICAL_SERIES_CODES.seriesFault);
      }
    };

    const series: ClinicalSeries = {
      startNextGame() {
        try {
          const status = controller.getSeriesStatus();
          if (!status.ok) return { ok: false, error: status.error };
          const generated = generateClinicalDeck({
            source: collection,
            config: { app: 'clinical', generationDirection: seriesDirection },
            mode: seriesMode,
            challengeCount: seriesMode === 'vsBeepy' ? 9 : 5,
            targetCardCount,
            seed: deriveClinicalGeneratorSeed(seriesSeed, status.status.nextGameIndex),
            ...(reviewValue === undefined ? {} : { review: reviewValue }),
          });
          if (!generated.ok) {
            report({ operation: 'startNextGame', generationIssues: generated.issues });
            return publicFailure(CLINICAL_SERIES_CODES.generationFailed);
          }
          // The deck and matrix stay inside this closure and the controller.
          const result = controller.startNextGame({ deck: generated.deck, contextualValidity: generated.contextualValidity });
          if (result.ok) {
            currentChallenges = new Map(generated.deck.challenges.map((c) => [c.id, { promptText: c.promptText, sourceRef: c.sourceRef }]));
          }
          return result;
        } catch {
          return publicFailure(CLINICAL_SERIES_CODES.seriesFault);
        }
      },
      getView: () => controller.getView(),
      submitHumanAction: (request) => controller.submitHumanAction(request),
      decide: (decision) => controller.decide(decision),
      advanceBeepy: () => controller.advanceBeepy(),
      getSeriesStatus: () => controller.getSeriesStatus(),
      getPublicEvents: () => controller.getPublicEvents(),
      explainResolved,
    };
    return { ok: true, series: Object.freeze(series) };
  } catch {
    return publicFailure(CLINICAL_SERIES_CODES.seriesFault);
  }
}
