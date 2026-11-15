/**
 * @beepy/shared-engine — public entry point.
 *
 * Milestone M2:
 * - Task 1: common, subject-neutral source-data types.
 * - Task 2: stable identifier namespace conventions and utilities.
 * - Task 2a: versioned collection wrapper and safe merge rules.
 * - Task 3: subject-neutral generated-deck contract.
 * - Task 4: generation-direction configuration (defaults + resolver).
 * - Task 5: subject-neutral deck-generator boundary (interface only).
 * - Task 6: structural and identifier validation (pipeline stages 1-2).
 * - Task 7: challenge mapping and ambiguity elimination (stages 3-4).
 * - Task 8: global uniqueness enforcement (stage 5).
 * - Task 9: single-hand starting-hand validation and feasibility (stage 6).
 * - Task 10: dual-player (competitive) starting-hand validation (stage 6).
 * - Task 11: deck-size bounds, planner, and validator (D8).
 * - Task 12: penalty-draw contract and bounded fallback (D6).
 * - Task 13: shared structured issue model and insufficient-data checks (D7).
 * Further exports (remaining validation stages, engine) are added by later,
 * separately approved tasks.
 */

export type {
  AnswerEntry,
  Topic,
  SubjectRecord,
  SubjectCollection,
} from './source-data.js';

export type {
  SubjectNamespace,
  IdKind,
  ParsedId,
  DuplicateId,
} from './identifiers.js';

export {
  SUBJECT_NAMESPACES,
  ID_KINDS,
  ID_SEPARATOR,
  buildId,
  isValidId,
  parseId,
  isInNamespace,
  collectIds,
  findDuplicateIds,
  findMalformedIds,
} from './identifiers.js';

export type { MergeErrorCode, MergeCheck } from './collection.js';

export {
  CURRENT_SCHEMA_VERSION,
  MERGE_ERROR_CODES,
  CollectionMergeError,
  createCollection,
  checkMergeable,
  assertMergeable,
  mergeCollections,
} from './collection.js';

export type {
  GenerationDirection,
  GeneratedSourceRef,
  GeneratedChallenge,
  GeneratedAnswerCard,
  GeneratedDeck,
  GeneratedDeckMeta,
} from './generated-deck.js';

export type { GenerationApp, GenerationConfig } from './generation-config.js';

export {
  GENERATION_DIRECTIONS,
  GENERATION_APPS,
  DEFAULT_DIRECTION_BY_APP,
  isGenerationDirection,
  defaultDirectionForApp,
  resolveGenerationDirection,
  oppositeDirection,
} from './generation-config.js';

export type {
  GenerationRequest,
  DeckGenerator,
  GenerationIssue,
  GenerationSizing,
  GenerationResult,
} from './generator.js';

export type {
  ValidationCode,
  ValidationIssue,
  ValidationResult,
} from './validation.js';

export {
  VALIDATION_CODES,
  SUPPORTED_SCHEMA_VERSIONS,
  validateStructure,
  validateIdentifiers,
  validateCollectionSource,
} from './validation.js';

export type {
  DeckValidationCode,
  DeckValidationIssue,
  DeckValidationResult,
} from './deck-issues.js';

export {
  DECK_VALIDATION_CODES,
  deckIssue,
  deckResult,
} from './deck-issues.js';

export type { ContextualValidityMap } from './challenge-mapping.js';

export {
  normalizeDisplayText,
  validateChallengeMapping,
} from './challenge-mapping.js';

export type { CardZones, UniquenessOptions } from './uniqueness.js';

export { canonicalNumber, validateUniqueness } from './uniqueness.js';

export type { StartingHandOptions } from './starting-hand.js';

export {
  STARTING_HAND_SIZE,
  MIN_CORRECT_IN_STARTING_HAND,
  MAX_CORRECT_IN_STARTING_HAND,
  validateStartingHand,
  checkStartingHandFeasibility,
} from './starting-hand.js';

export type { DualHands } from './dual-hand.js';

export {
  COMPETITIVE_HAND_COUNT,
  MIN_PENALTY_RESERVE,
  countCorrectAndDistractors,
  canSupplyHands,
  checkDualHandFeasibility,
  validateDualStartingHands,
} from './dual-hand.js';

export type {
  DeckMode,
  DeckSizeAvailability,
  DeckSizePlan,
} from './deck-size.js';

export {
  DECK_MODES,
  isDeckMode,
  SOLITAIRE_CHALLENGE_COUNT,
  COMPETITIVE_CHALLENGE_COUNT,
  COMPETITIVE_MIN_CARD_COUNT,
  expectedChallengeCount,
  handCountForMode,
  minimumDistractors,
  planDeckSize,
  validateDeckSize,
} from './deck-size.js';

export type {
  PenaltyReason,
  PenaltyDrawRequest,
  FallbackStatus,
  FallbackRejection,
  PenaltyCardExhausted,
  PenaltyCandidate,
  PenaltyFallbackContext,
  PenaltyFallbackProvider,
  PenaltyDrawState,
  PenaltyDrawOptions,
  PenaltySource,
  PenaltyDrawResult,
} from './penalty-draw.js';

export {
  DEFAULT_MAX_PENALTY_CANDIDATES,
  PENALTY_REASONS,
  FALLBACK_STATUSES,
  FALLBACK_REJECTIONS,
  drawPenaltyCards,
} from './penalty-draw.js';

export type {
  StructuredIssue,
  AnyIssue,
  IssueModelConformance,
} from './issues.js';

export {
  isStructuredIssue,
  formatIssue,
  formatIssues,
  issuesFromMergeError,
} from './issues.js';

export type {
  UniqueValueCount,
  DeckDataPools,
  DeckDataAssessment,
  CandidateAnalysis,
  CandidateAnalysisResult,
} from './data-sufficiency.js';

export {
  countUniqueValues,
  assessDeckData,
  analyzeCandidateAmbiguity,
} from './data-sufficiency.js';

// ---------------------------------------------------------------------------
// Milestone M3 (E14): the shared game engine's public surface.
//
// Only the trusted controller, the Beepy strategy factory, the mode and error-code
// constants, and the pure seeded random helpers are exported. The pure core
// (`createGameState`, `submitAction`, `evaluatePending`, `advanceBeepy`), the
// engine-private `EngineState`, and the private history are deliberately NOT
// exported: the controller is the runtime privacy boundary (design 2a-A).
// ---------------------------------------------------------------------------
export type {
  SeriesController,
  SeriesConfig,
  GameSetup,
  HumanActionRequest,
  PublicError,
  SetupSummary,
  ControllerResult,
  SeriesStatusPublicResult,
  TrustedDiagnostic,
} from './game/controller.js';
export { createSeriesController } from './game/controller.js';
export type {
  PlayerView,
  PublicEvent,
  CardFace,
  ChallengeView,
  PendingView,
} from './game/view.js';
export type { SeriesStatus } from './game/series.js';
export type {
  BeepyStrategy,
  BeepyStrategyInput,
  BeepyChoice,
  ReferenceStrategyConfig,
} from './game/beepy-strategy.js';
export { createReferenceBeepyStrategy } from './game/beepy-strategy.js';
export type {
  EngineMode,
  PlayerId,
  ActionKind,
  Decision,
  EngineErrorCode,
  GameOptions,
  GameOutcome,
  GamePhase,
  PlayerStats,
  EndReason,
  SetupIssue,
} from './game/types.js';
export { ENGINE_MODES, ENGINE_ERROR_CODES } from './game/types.js';
// M4 G2 (decision M4-6): the deck gate is exported so app generators validate their
// output with exactly the rules `createGame` applies. It reads a deck and a matrix
// and returns issues; it exposes no game state.
export type { GateOptions } from './game/deck-gate.js';
export { validateDeckForPlay } from './game/deck-gate.js';
export type { RngState, RngStream } from './game/random.js';
export {
  toRngState,
  nextUint32,
  nextFloat,
  nextInt,
  shuffle,
  deriveSeed,
} from './game/random.js';
