/**
 * Beepy Math Cards deck generator (Milestone M4, G3-G6; replaces the M2 Task 5 stub).
 *
 * Produces one validated deck per game: real second-grade addition challenges,
 * unique answer cards, and the COMPLETE contextual-validity matrix that M2 Task 7
 * requires. It implements the shared `DeckGenerator` contract with the structured
 * `GenerationResult` (decision M4-1). It never deals hands: dealing stays in M3.
 *
 * Algorithm (design "Generation algorithm"; owner correction 1, plan from the
 * actual pool):
 *   1. validate the request (mode, level, direction, seed, target);
 *   2. CHOOSE THE CHALLENGES FIRST, with distinct sums;
 *   3. one correct card per challenge;
 *   4. build the ACTUAL eligible distractor pool for exactly these challenges;
 *   5. only then plan the size with the M2 planner (target is a ceiling, 24 is a
 *      target and not a guarantee, minimums come from M2);
 *   6. select distractors by near-miss tier;
 *   7. compute the matrix from the arithmetic of each card itself, independent of
 *      which card was designated;
 *   8. assemble the deck with neutral ids;
 *   9. self-validate with the exported M3 gate `validateDeckForPlay`. Any issue
 *      discards the deck.
 *
 * Determinism: a pure function of the request. Randomness comes only from the M3
 * seeded helpers, threaded explicitly. There is no Math.random, clock, or
 * module-level state.
 *
 * Privacy: challenge ids are public in M3 views, so they are `c1`..`cN` in the
 * seeded board order and never encode an operand or sum. Card ids are `m1`..`mK` in
 * a seeded order and say nothing about correctness. `sourceRef` (revealed only once
 * a challenge is solved) uses M2-format ids for later progress tracking.
 *
 * Modes: only `solitaire` and `vsBeepy`. `tutor` and `vsPlayer` give
 * MODE_NOT_SUPPORTED; anything else gives INVALID_MODE.
 */

import {
  GENERATION_APPS,
  canonicalNumber,
  expectedChallengeCount,
  isGenerationDirection,
  isValidId,
  nextInt,
  planDeckSize,
  shuffle,
  toRngState,
  validateDeckForPlay,
  type DeckGenerator,
  type DeckSizePlan,
  type GeneratedAnswerCard,
  type GeneratedChallenge,
  type GeneratedDeck,
  type GenerationDirection,
  type GenerationIssue,
  type GenerationResult,
  type RngState,
} from '@beepy/shared-engine';
import { MATH_COMPETITIVE_TARGET_CARD_COUNT, planMathCompetitiveDeckSize } from './deck-size.js';
import { buildEligiblePool, selectDistractors, type DistractorCandidate } from './distractors.js';
import {
  BASE_LEVEL_SPECS,
  canonicalPairs,
  formatExpression,
  isMathLevel,
  parseExpression,
  MATH_LEVELS,
  MIXED_BASE_LEVELS,
  type BaseMathLevel,
  type MathLevel,
  type OperandPair,
} from './levels.js';

/** Default Solitaire deck size (decision M4-5). */
export const MATH_SOLITAIRE_DEFAULT_CARD_COUNT = 15;

/** Stable Math generation issue codes. M2 planner codes are passed through as-is. */
export const MATH_GENERATION_CODES = {
  invalidRequest: 'INVALID_REQUEST',
  modeNotSupported: 'MODE_NOT_SUPPORTED',
  invalidMode: 'INVALID_MODE',
  invalidLevel: 'INVALID_LEVEL',
  invalidDirection: 'INVALID_DIRECTION',
  invalidSeed: 'INVALID_SEED',
  invalidCount: 'INVALID_COUNT',
  insufficientProblems: 'INSUFFICIENT_PROBLEMS',
  invalidSourceRef: 'INVALID_SOURCE_REF',
  generationFault: 'GENERATION_FAULT',
} as const;

const CODES = MATH_GENERATION_CODES;

/** Modes the Math generator supports in M4. */
export type MathMode = 'solitaire' | 'vsBeepy';

/** A Math generation request (all fields are checked at runtime). */
export interface MathGenerationRequest {
  readonly mode: MathMode;
  readonly level: MathLevel;
  /** Defaults to `factToSubject`, the Math default (master spec section 9). */
  readonly generationDirection?: GenerationDirection;
  /** Any finite number; it is reduced to a 32-bit seed. */
  readonly seed: number;
  /** Ceiling for the deck size; defaults to 24 (vsBeepy) or 15 (Solitaire). */
  readonly targetCardCount?: number;
}

/** A request that passed validation. */
export interface ValidMathRequest {
  readonly mode: MathMode;
  readonly level: MathLevel;
  readonly direction: GenerationDirection;
  readonly seed: RngState;
  /** Undefined means the mode default. */
  readonly targetCardCount: number | undefined;
}

const issue = (code: string, message: string, path: string): GenerationIssue => ({ code, message, path });

/** Validate an untyped request, reporting every problem found. Never throws. */
export function validateMathRequest(
  raw: unknown,
): { readonly ok: true; readonly request: ValidMathRequest } | { readonly ok: false; readonly issues: GenerationIssue[] } {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return { ok: false, issues: [issue(CODES.invalidRequest, 'The generation request must be an object.', 'request')] };
  }
  let mode: unknown;
  let level: unknown;
  let direction: unknown;
  let seed: unknown;
  let target: unknown;
  try {
    const record = raw as Record<string, unknown>;
    mode = record['mode'];
    level = record['level'];
    direction = record['generationDirection'];
    seed = record['seed'];
    target = record['targetCardCount'];
  } catch {
    return { ok: false, issues: [issue(CODES.invalidRequest, 'The generation request could not be read.', 'request')] };
  }

  const issues: GenerationIssue[] = [];
  if (mode === 'tutor' || mode === 'vsPlayer') {
    issues.push(issue(CODES.modeNotSupported, `Mode "${mode}" is not supported by the Math generator in this milestone.`, 'mode'));
  } else if (mode !== 'solitaire' && mode !== 'vsBeepy') {
    issues.push(issue(CODES.invalidMode, 'mode must be "solitaire" or "vsBeepy".', 'mode'));
  }
  if (!isMathLevel(level)) {
    issues.push(issue(CODES.invalidLevel, `level must be one of: ${Object.values(MATH_LEVELS).join(', ')}.`, 'level'));
  }
  if (direction !== undefined && !isGenerationDirection(direction)) {
    issues.push(issue(CODES.invalidDirection, 'generationDirection must be "factToSubject" or "subjectToFact".', 'generationDirection'));
  }
  if (typeof seed !== 'number' || !Number.isFinite(seed)) {
    issues.push(issue(CODES.invalidSeed, 'seed must be a finite number.', 'seed'));
  }
  if (target !== undefined && !(typeof target === 'number' && Number.isSafeInteger(target) && target >= 1)) {
    issues.push(issue(CODES.invalidCount, 'targetCardCount must be a positive whole number when given.', 'targetCardCount'));
  }
  if (issues.length > 0) {
    return { ok: false, issues };
  }
  return {
    ok: true,
    request: {
      mode: mode as MathMode,
      level: level as MathLevel,
      direction: (direction as GenerationDirection | undefined) ?? 'factToSubject',
      seed: toRngState(seed as number),
      targetCardCount: target as number | undefined,
    },
  };
}

/**
 * Choose `count` problems with DISTINCT sums. Bounded: each base level's canonical
 * pairs are enumerated once, shuffled with the seed, and walked in order.
 */
export function chooseProblems(
  level: MathLevel,
  count: number,
  rng: RngState,
): { readonly ok: true; readonly problems: OperandPair[]; readonly rng: RngState } | { readonly ok: false; readonly issue: GenerationIssue } {
  let state = rng;
  const bases: readonly BaseMathLevel[] = level === MATH_LEVELS.mixed ? MIXED_BASE_LEVELS : [level];
  const queues: OperandPair[][] = [];
  for (const base of bases) {
    const [shuffled, next] = shuffle(canonicalPairs(base), state);
    state = next;
    queues.push(shuffled);
  }
  const cursors = bases.map(() => 0);
  const used = new Set<number>();
  const problems: OperandPair[] = [];

  /** Next pair from queue `q` whose sum is unused, or undefined. */
  const takeFrom = (q: number): OperandPair | undefined => {
    const queue = queues[q] as OperandPair[];
    while ((cursors[q] as number) < queue.length) {
      const pair = queue[cursors[q] as number] as OperandPair;
      cursors[q] = (cursors[q] as number) + 1;
      if (!used.has(pair.sum)) {
        return pair;
      }
    }
    return undefined;
  };

  while (problems.length < count) {
    let start = 0;
    if (bases.length > 1) {
      const [pick, next] = nextInt(state, bases.length);
      state = next;
      start = pick;
    }
    let chosen: OperandPair | undefined;
    for (let offset = 0; offset < bases.length && chosen === undefined; offset += 1) {
      chosen = takeFrom((start + offset) % bases.length);
    }
    if (chosen === undefined) {
      return {
        ok: false,
        issue: issue(
          CODES.insufficientProblems,
          `Level "${level}" cannot supply ${count} problems with distinct sums.`,
          'level',
        ),
      };
    }
    used.add(chosen.sum);
    problems.push(chosen);
  }
  return { ok: true, problems, rng: state };
}

/** Sum shown by a card: its number (factToSubject) or its expression's sum. */
function cardSum(direction: GenerationDirection, displayValue: string): number | undefined {
  if (direction === 'factToSubject') {
    const canonical = canonicalNumber(displayValue);
    return canonical === undefined ? undefined : Number(canonical);
  }
  const parsed = parseExpression(displayValue);
  return parsed === undefined ? undefined : parsed.a + parsed.b;
}

/** A generated deck and matrix before self-validation (exposed for the test seam). */
export interface MathDraft {
  readonly deck: GeneratedDeck;
  readonly contextualValidity: Record<string, Record<string, boolean>>;
}

/** Optional test seam: transform the draft just before self-validation. */
export type DraftTamper = (draft: MathDraft) => MathDraft;

/**
 * Steps 3-9 for a validated request and a chosen set of problems. Exported so tests
 * can fix the problems (for example targets 6-14) and so a test seam can corrupt
 * the draft; `generateMathDeck` is the normal entry point.
 */
export function assembleMathDeck(
  request: ValidMathRequest,
  problems: readonly OperandPair[],
  rng: RngState,
  tamper?: DraftTamper,
): GenerationResult {
  const direction = request.direction;
  const numericAnswers = direction === 'factToSubject';
  const challengeCount = problems.length;
  const sums = problems.map((p) => p.sum);

  // 4. The actual eligible pool for exactly these challenges.
  const pool = buildEligiblePool(request.level, direction, sums);

  // 5. Only now, plan the size with the M2 planner.
  const availability = { availableCorrect: challengeCount, availableDistractors: pool.length };
  const plan: DeckSizePlan =
    request.mode === 'vsBeepy' && request.targetCardCount === undefined
      ? planMathCompetitiveDeckSize(availability)
      : planDeckSize(
          request.mode,
          request.targetCardCount ??
            (request.mode === 'vsBeepy' ? MATH_COMPETITIVE_TARGET_CARD_COUNT : MATH_SOLITAIRE_DEFAULT_CARD_COUNT),
          availability,
        );
  if (!plan.ok) {
    return { ok: false, issues: [{ code: plan.issue.code, message: plan.issue.message, path: plan.issue.path }] };
  }
  const targetCardCount =
    request.targetCardCount ??
    (request.mode === 'vsBeepy' ? MATH_COMPETITIVE_TARGET_CARD_COUNT : MATH_SOLITAIRE_DEFAULT_CARD_COUNT);

  // 6. Distractors by near-miss tier.
  const [distractors, afterDistractors]: readonly [DistractorCandidate[], RngState] = selectDistractors(
    pool,
    plan.distractorCount,
    rng,
  );

  // 3 + 8. Correct cards, neutral ids, seeded card order.
  const correctDisplays = problems.map((p) => (numericAnswers ? String(p.sum) : formatExpression(p.a, p.b)));
  const faces = [
    ...correctDisplays.map((display, i) => ({ display, problem: i })),
    ...distractors.map((d) => ({ display: d.display, problem: -1 })),
  ];
  // The final random state is not needed: generation ends here.
  const [order] = shuffle(faces, afterDistractors);

  const answerCards: GeneratedAnswerCard[] = order.map((face, k) => ({ id: `m${k + 1}`, displayValue: face.display }));
  const correctIdByProblem = new Map<number, string>();
  order.forEach((face, k) => {
    if (face.problem >= 0) {
      correctIdByProblem.set(face.problem, `m${k + 1}`);
    }
  });

  const challenges: GeneratedChallenge[] = problems.map((p, i) => ({
    id: `c${i + 1}`,
    promptText: numericAnswers ? `${p.a} + ${p.b} = ?` : `Which addition expression equals ${p.sum}?`,
    correctAnswerCardId: correctIdByProblem.get(i) as string,
    sourceRef: {
      subjectId: `math.subject.sum-${p.sum}`,
      topicId: `math.topic.sum-${p.sum}.add-${p.a}-${p.b}`,
    },
  }));
  for (const challenge of challenges) {
    if (!isValidId(challenge.sourceRef.subjectId) || !isValidId(challenge.sourceRef.topicId as string)) {
      return { ok: false, issues: [issue(CODES.invalidSourceRef, 'A generated source reference is not a valid id.', 'sourceRef')] };
    }
  }

  const deck: GeneratedDeck = {
    direction,
    challenges,
    answerCards,
    meta: { targetCardCount, actualCardCount: answerCards.length },
  };

  // 7. Matrix from the arithmetic of each card itself, not from the designation.
  const contextualValidity: Record<string, Record<string, boolean>> = {};
  problems.forEach((p, i) => {
    const row: Record<string, boolean> = {};
    for (const card of answerCards) {
      row[card.id] = cardSum(direction, card.displayValue) === p.sum;
    }
    contextualValidity[`c${i + 1}`] = row;
  });

  let draft: MathDraft = { deck, contextualValidity };
  if (tamper !== undefined) {
    draft = tamper(draft);
  }

  // 9. Self-validate with exactly the rules createGame applies.
  const problemsFound = validateDeckForPlay(draft.deck, request.mode, draft.contextualValidity, { numericAnswers });
  if (problemsFound.length > 0) {
    return {
      ok: false,
      issues: problemsFound.map((found) => ({ code: found.code, message: found.message, path: found.path })),
    };
  }

  return {
    ok: true,
    deck: draft.deck,
    contextualValidity: draft.contextualValidity,
    numericAnswers,
    sizing: {
      targetCardCount,
      actualCardCount: draft.deck.answerCards.length,
      eligibleDistractors: pool.length,
      reduced: plan.reduced,
    },
  };
}

/** Generate one validated Math deck, or a structured failure. Never throws. */
export function generateMathDeck(raw: unknown): GenerationResult {
  try {
    const checked = validateMathRequest(raw);
    if (!checked.ok) {
      return { ok: false, issues: checked.issues };
    }
    const request = checked.request;
    const chosen = chooseProblems(request.level, expectedChallengeCount(request.mode), request.seed);
    if (!chosen.ok) {
      return { ok: false, issues: [chosen.issue] };
    }
    return assembleMathDeck(request, chosen.problems, chosen.rng);
  } catch (error) {
    return { ok: false, issues: [issue(CODES.generationFault, `Unexpected generator error: ${String(error)}`, 'generate')] };
  }
}

/** Math Cards deck generator. Implements the shared `DeckGenerator` boundary. */
export class MathDeckGenerator implements DeckGenerator<MathGenerationRequest> {
  readonly app = GENERATION_APPS.math;

  generate(request: MathGenerationRequest): GenerationResult {
    return generateMathDeck(request);
  }
}

/** Exposed for tests: the per-level specs the generator uses. */
export { BASE_LEVEL_SPECS };
