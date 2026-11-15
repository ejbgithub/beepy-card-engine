/**
 * Beepy Math Cards series wrapper (Milestone M4, G9; design "Integration with the M3
 * controller"; decisions M4-4, M4-8, M4-10).
 *
 * The TRUSTED layer for the Math app. It owns the M3 series controller and the Math
 * generator. For each game it generates a validated deck and hands it to
 * `controller.startNextGame` inside this closure. The UI calls only this object and
 * receives only what the M3 controller already exposes: sanitized views, public
 * events, public errors, and series status. Decks, matrices, designated answers,
 * generator seeds, and generator issues are never returned. Generator issues go only
 * to the trusted `diagnostics` callback.
 *
 * Per direction:
 *   factToSubject  numeric comparison; the existing numeric penalty fallback over
 *                  the level's plausible range.
 *   subjectToFact  text comparison; the new expression fallback for the level.
 *
 * Per game: the generator seed is derived from the series seed and the game index
 * here in math-cards (M4-8), so the engine's own streams are untouched and every
 * game gets its own deck. The whole series replays identically from the same seed
 * and the same request sequence.
 *
 * Modes: `solitaire` and `vsBeepy` only. Beepy's error rate is configurable and
 * defaults to 0.2 (M4-10).
 *
 * Honest limit: this is a static browser app, so the deck exists in page memory.
 * The boundary prevents leaks through the UI's data path; it does not stop a user
 * inspecting their own page with developer tools. The seed is not exposed.
 */

import {
  createReferenceBeepyStrategy,
  createSeriesController,
  isGenerationDirection,
  nextUint32,
  toRngState,
  type ControllerResult,
  type GenerationDirection,
  type GenerationIssue,
  type HumanActionRequest,
  type PenaltyFallbackProvider,
  type PublicError,
  type PublicEvent,
  type SeriesController,
  type SeriesStatusPublicResult,
  type TrustedDiagnostic,
} from '@beepy/shared-engine';
import { createMathExpressionFallbackProvider } from './expression-fallback.js';
import { isMathLevel, plausibleRangeOf, type MathLevel } from './levels.js';
import { generateMathDeck, type MathMode } from './math-generator.js';
import { createMathPenaltyFallbackProvider } from './penalty-fallback.js';

/** Default probability of a deliberate Beepy mistake (M4-10). */
export const MATH_DEFAULT_BEEPY_ERROR_RATE = 0.2;

/** Math series codes (in addition to the M3 controller's public codes). */
export const MATH_SERIES_CODES = {
  invalidConfig: 'INVALID_CONFIG',
  modeNotSupported: 'MODE_NOT_SUPPORTED',
  invalidMode: 'INVALID_MODE',
  invalidLevel: 'INVALID_LEVEL',
  invalidDirection: 'INVALID_DIRECTION',
  invalidSeed: 'INVALID_SEED',
  invalidOption: 'INVALID_OPTION',
  generationFailed: 'MATH_GENERATION_FAILED',
  seriesFault: 'MATH_SERIES_FAULT',
} as const;

export type MathSeriesCode = (typeof MATH_SERIES_CODES)[keyof typeof MATH_SERIES_CODES];

/** Fixed, detail-free public messages. */
const MESSAGES: Readonly<Record<MathSeriesCode, string>> = {
  INVALID_CONFIG: 'The game settings are invalid.',
  MODE_NOT_SUPPORTED: 'That game mode is not available yet.',
  INVALID_MODE: 'That game mode is not supported.',
  INVALID_LEVEL: 'That difficulty level is not supported.',
  INVALID_DIRECTION: 'That question style is not supported.',
  INVALID_SEED: 'The game settings are invalid.',
  INVALID_OPTION: 'A game setting is invalid.',
  MATH_GENERATION_FAILED: 'A new deck could not be prepared for this game.',
  MATH_SERIES_FAULT: 'Something went wrong while preparing the game.',
};

/** A public error from the Math series: an M3 public error or a Math code. */
export type MathSeriesError = PublicError | { readonly code: MathSeriesCode; readonly message: string };

export type MathSeriesResult = ControllerResult | { readonly ok: false; readonly error: MathSeriesError };

/** Trusted-only diagnostics: engine errors, or the full generator issues. */
export type MathSeriesDiagnostic =
  | TrustedDiagnostic
  | { readonly operation: string; readonly generationIssues: readonly GenerationIssue[] };

/** Settings for one Solitaire session or Player vs. Beepy match. */
export interface MathSeriesConfig {
  readonly mode: MathMode;
  readonly level: MathLevel;
  /** Defaults to `factToSubject`. */
  readonly generationDirection?: GenerationDirection;
  /** Series seed (any finite number). Not exposed to the UI. */
  readonly seed: number;
  /** vsBeepy only: probability of a deliberate Beepy mistake, 0 to 1. Default 0.2. */
  readonly beepyErrorRate?: number;
  /** Solitaire only: deck-size target (the M2 planner applies the minimum). Default 15. */
  readonly solitaireDeckSize?: number;
  /** Trusted sink for unsanitized diagnostics. Never connect this to the UI. */
  readonly diagnostics?: (diagnostic: MathSeriesDiagnostic) => void;
}

/** The object the UI uses. Methods only; there is no way to read a deck. */
export interface MathSeries {
  startNextGame(): MathSeriesResult;
  getView(): ControllerResult;
  submitHumanAction(request: HumanActionRequest): ControllerResult;
  decide(decision: unknown): ControllerResult;
  advanceBeepy(): ControllerResult;
  getSeriesStatus(): SeriesStatusPublicResult;
  getPublicEvents(): readonly PublicEvent[];
}

/**
 * Derive one game's generator seed from the series seed and the 1-based game index
 * (M4-8). Pure; mixes through the exported `nextUint32`; independent of the M3
 * engine streams. Exported for tests.
 */
export function deriveGeneratorSeed(seriesSeed: number, gameIndex: number): number {
  const [first] = nextUint32((toRngState(seriesSeed) ^ 0x4d415448) >>> 0); // "MATH"
  const [second] = nextUint32((first ^ Math.imul(toRngState(gameIndex), 0x9e3779b1)) >>> 0);
  return second;
}

type Failure = { readonly ok: false; readonly error: MathSeriesError };

const publicFailure = (code: MathSeriesCode): Failure => ({ ok: false, error: { code, message: MESSAGES[code] } });

/** Create a Math series, or a structured failure for invalid settings. Never throws. */
export function createMathSeries(
  config: MathSeriesConfig,
): { readonly ok: true; readonly series: MathSeries } | Failure {
  let sink: ((d: MathSeriesDiagnostic) => void) | undefined;
  const report = (diagnostic: MathSeriesDiagnostic): void => {
    if (sink === undefined) return;
    try {
      sink(diagnostic);
    } catch {
      // A failing diagnostics sink never changes a result.
    }
  };

  try {
    if (typeof config !== 'object' || config === null) {
      return publicFailure(MATH_SERIES_CODES.invalidConfig);
    }
    sink = typeof config.diagnostics === 'function' ? config.diagnostics : undefined;
    // Untrusted input: read every field as unknown and validate it.
    const raw = config as unknown as Record<string, unknown>;
    const mode: unknown = raw['mode'];
    const level: unknown = raw['level'];
    const seed: unknown = raw['seed'];
    const direction: unknown = raw['generationDirection'] ?? 'factToSubject';
    const errorRate: unknown = raw['beepyErrorRate'] ?? MATH_DEFAULT_BEEPY_ERROR_RATE;
    const deckSize: unknown = raw['solitaireDeckSize'];

    // Validate everything; report the full list in diagnostics, the first publicly.
    const problems: GenerationIssue[] = [];
    const add = (code: MathSeriesCode, message: string, path: string): void => {
      problems.push({ code, message, path });
    };
    if (mode === 'tutor' || mode === 'vsPlayer') add(MATH_SERIES_CODES.modeNotSupported, `Mode "${mode}" is not supported.`, 'mode');
    else if (mode !== 'solitaire' && mode !== 'vsBeepy') add(MATH_SERIES_CODES.invalidMode, 'mode must be "solitaire" or "vsBeepy".', 'mode');
    if (!isMathLevel(level)) add(MATH_SERIES_CODES.invalidLevel, 'Unknown level.', 'level');
    if (!isGenerationDirection(direction)) add(MATH_SERIES_CODES.invalidDirection, 'Unknown generation direction.', 'generationDirection');
    if (typeof seed !== 'number' || !Number.isFinite(seed)) add(MATH_SERIES_CODES.invalidSeed, 'seed must be a finite number.', 'seed');
    if (typeof errorRate !== 'number' || !Number.isFinite(errorRate) || errorRate < 0 || errorRate > 1) {
      add(MATH_SERIES_CODES.invalidOption, 'beepyErrorRate must be a number from 0 to 1.', 'beepyErrorRate');
    }
    if (deckSize !== undefined) {
      if (mode !== 'solitaire') add(MATH_SERIES_CODES.invalidOption, 'solitaireDeckSize applies only to Solitaire.', 'solitaireDeckSize');
      else if (!(typeof deckSize === 'number' && Number.isSafeInteger(deckSize) && deckSize >= 1)) {
        add(MATH_SERIES_CODES.invalidOption, 'solitaireDeckSize must be a positive whole number.', 'solitaireDeckSize');
      }
    }
    if (problems.length > 0) {
      report({ operation: 'createMathSeries', generationIssues: problems });
      return publicFailure((problems[0] as GenerationIssue).code as MathSeriesCode);
    }

    const seriesMode = mode as MathMode;
    const seriesLevel = level as MathLevel;
    const seriesSeed = seed as number;
    const seriesDirection = direction as GenerationDirection;
    const seriesErrorRate = errorRate as number;
    const seriesDeckSize = deckSize as number | undefined;
    const numericAnswers = seriesDirection === 'factToSubject';
    const range = plausibleRangeOf(seriesLevel);
    const fallback: PenaltyFallbackProvider = numericAnswers
      ? createMathPenaltyFallbackProvider({ minValue: range.min, maxValue: range.max })
      : createMathExpressionFallbackProvider({ level: seriesLevel });

    let beepyStrategy;
    if (seriesMode === 'vsBeepy') {
      const created = createReferenceBeepyStrategy({ errorRate: seriesErrorRate });
      if (!created.ok) {
        return publicFailure(MATH_SERIES_CODES.invalidOption);
      }
      beepyStrategy = created.strategy;
    }

    const created = createSeriesController({
      mode: seriesMode,
      seed: seriesSeed,
      options: { numericAnswers, fallback },
      ...(beepyStrategy === undefined ? {} : { beepyStrategy }),
      diagnostics: (diagnostic) => report(diagnostic),
    });
    if (!created.ok) {
      return { ok: false, error: created.error };
    }
    const controller: SeriesController = created.controller;

    const series: MathSeries = {
      startNextGame() {
        try {
          const status = controller.getSeriesStatus();
          if (!status.ok) {
            return { ok: false, error: status.error };
          }
          const gameIndex = status.status.nextGameIndex;
          const generated = generateMathDeck({
            mode: seriesMode,
            level: seriesLevel,
            generationDirection: seriesDirection,
            seed: deriveGeneratorSeed(seriesSeed, gameIndex),
            ...(seriesDeckSize === undefined ? {} : { targetCardCount: seriesDeckSize }),
          });
          if (!generated.ok) {
            report({ operation: 'startNextGame', generationIssues: generated.issues });
            return publicFailure(MATH_SERIES_CODES.generationFailed);
          }
          // The deck and matrix stay inside this closure and the controller.
          return controller.startNextGame({
            deck: generated.deck,
            contextualValidity: generated.contextualValidity,
          });
        } catch {
          return publicFailure(MATH_SERIES_CODES.seriesFault);
        }
      },
      getView: () => controller.getView(),
      submitHumanAction: (request) => controller.submitHumanAction(request),
      decide: (decision) => controller.decide(decision),
      advanceBeepy: () => controller.advanceBeepy(),
      getSeriesStatus: () => controller.getSeriesStatus(),
      getPublicEvents: () => controller.getPublicEvents(),
    };
    return { ok: true, series: Object.freeze(series) };
  } catch {
    return publicFailure(MATH_SERIES_CODES.seriesFault);
  }
}
