/**
 * Beepy's Clinical Cards deck generator (Milestone M6, stage C3; replaces the M2
 * Task 5 stub).
 *
 * Builds one validated deck per game from OWNER-AUTHORED, reviewed clinical data.
 * It never writes, composes, or paraphrases clinical text: every card face and the
 * clinical part of every prompt is copied verbatim from the dataset, and every
 * explanation is one the author wrote for that exact (card, challenge) context.
 * It implements the shared `DeckGenerator` contract with the structured
 * `GenerationResult`. It never deals hands: dealing stays in the M3 engine.
 *
 * Correctness comes from the C2 policy (`clinical-review.ts`): valid / invalid /
 * unknown. A card that is UNKNOWN for any challenge on the board is never placed
 * in the deck; missing data never makes a card "wrong".
 *
 * Algorithm (design section 5):
 *   1. validate the request, the dataset (C1) and the review file (C2);
 *   2. choose the challenges first (seeded), designating one correct card per
 *      challenge that is reviewed-INVALID for every other chosen challenge;
 *   3. evaluate every candidate card against every chosen challenge; drop cards
 *      with any unknown relation;
 *   4. run the M2 ambiguity analysis (`analyzeCandidateAmbiguity`): only cards
 *      valid for no challenge become distractors; cards valid for exactly one
 *      challenge (other than its designated card) or for several are excluded;
 *   5. plan the size with the M2 planner from the ACTUAL pool (target is a
 *      ceiling; smaller validated decks are allowed; never padded);
 *   6. pick distractors (subjectToFact prefers the board's categories);
 *   7. assemble with neutral ids (`c1..`, `k1..`) in seeded order, the complete
 *      matrix from the policy, and contextual explanations;
 *   8. self-validate with the M3 gate `validateDeckForPlay`. Any issue discards
 *      the deck.
 * Up to `CLINICAL_SELECTION_ATTEMPTS` seeded boards are tried; the first whose
 * pool reaches the target is used, otherwise the one with the largest pool.
 *
 * Determinism: a pure function of the request. Randomness comes only from the M3
 * seeded helpers, threaded explicitly.
 *
 * Privacy: challenge ids and card ids are neutral and say nothing about the
 * source entry or correctness. `sourceRef` (revealed only once a challenge is
 * solved) names the disease and topic.
 */

import {
  GENERATION_APPS,
  analyzeCandidateAmbiguity,
  expectedChallengeCount,
  isGenerationDirection,
  normalizeDisplayText,
  planDeckSize,
  shuffle,
  toRngState,
  validateDeckForPlay,
  type ContextualValidityMap,
  type DeckGenerator,
  type GeneratedAnswerCard,
  type GeneratedChallenge,
  type GeneratedDeck,
  type GenerationDirection,
  type GenerationIssue,
  type GenerationRequest,
  type GenerationResult,
  type RngState,
  type SubjectCollection,
  type SubjectRecord,
  type Topic,
} from '@beepy/shared-engine';
import { categoryOfTopicName, validateClinicalCollection, type ClinicalCategoryKey } from './clinical-content.js';
import {
  NO_REVIEWS,
  createValidityPolicy,
  validateReviewFile,
  type ClinicalValidityPolicy,
  type Relation,
  type ReviewValidationResult,
} from './clinical-review.js';

/** Approved deck-size targets (decision C-6). The M2 minimums still apply. */
export const CLINICAL_SOLITAIRE_TARGET_CARD_COUNT = 15;
export const CLINICAL_COMPETITIVE_TARGET_CARD_COUNT = 24;

/** Seeded boards tried before settling for the largest pool. */
export const CLINICAL_SELECTION_ATTEMPTS = 32;

/** Stable Clinical generation issue codes. M2 planner and gate codes pass through. */
export const CLINICAL_GENERATION_CODES = {
  invalidRequest: 'INVALID_REQUEST',
  invalidApp: 'INVALID_APP',
  modeNotSupported: 'MODE_NOT_SUPPORTED',
  invalidMode: 'INVALID_MODE',
  invalidDirection: 'INVALID_DIRECTION',
  invalidSeed: 'INVALID_SEED',
  invalidCount: 'INVALID_COUNT',
  challengeCountMismatch: 'CHALLENGE_COUNT_MISMATCH',
  insufficientChallenges: 'INSUFFICIENT_CHALLENGES',
  generationFault: 'GENERATION_FAULT',
} as const;

const CODES = CLINICAL_GENERATION_CODES;

export type ClinicalMode = 'solitaire' | 'vsBeepy';

/**
 * A Clinical generation request (decision C-14): the shared `GenerationRequest`
 * plus the mode, a seed, and the owner's review file. Every field is checked at
 * runtime; `source` and `review` are treated as untrusted.
 */
export interface ClinicalGenerationRequest extends GenerationRequest {
  readonly mode: ClinicalMode;
  /** Any finite number; reduced to a 32-bit seed. */
  readonly seed: number;
  /** The `clinical-review.json` value. Absent means no reviews (everything unlisted is unknown). */
  readonly review?: unknown;
}

const issue = (code: string, message: string, path: string): GenerationIssue => ({ code, message, path });

interface ValidRequest {
  readonly mode: ClinicalMode;
  readonly direction: GenerationDirection;
  readonly seed: RngState;
  readonly challengeCount: number;
  readonly targetCardCount: number;
  readonly collection: SubjectCollection;
  readonly review: ReviewValidationResult;
}

/** Validate an untyped request, reporting every problem found. Never throws. */
export function validateClinicalRequest(
  raw: unknown,
): { readonly ok: true; readonly request: ValidRequest } | { readonly ok: false; readonly issues: GenerationIssue[] } {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return { ok: false, issues: [issue(CODES.invalidRequest, 'The generation request must be an object.', 'request')] };
  }
  const record = raw as Record<string, unknown>;
  const issues: GenerationIssue[] = [];
  const mode = record['mode'];
  const seed = record['seed'];
  const config = record['config'];
  const challengeCount = record['challengeCount'];
  const target = record['targetCardCount'];

  if (mode === 'tutor' || mode === 'vsPlayer') {
    issues.push(issue(CODES.modeNotSupported, `Mode "${mode}" is not supported by the Clinical generator in this milestone.`, 'mode'));
  } else if (mode !== 'solitaire' && mode !== 'vsBeepy') {
    issues.push(issue(CODES.invalidMode, 'mode must be "solitaire" or "vsBeepy".', 'mode'));
  }
  if (typeof seed !== 'number' || !Number.isFinite(seed)) {
    issues.push(issue(CODES.invalidSeed, 'seed must be a finite number.', 'seed'));
  }
  let direction: GenerationDirection = 'subjectToFact';
  if (typeof config !== 'object' || config === null || Array.isArray(config)) {
    issues.push(issue(CODES.invalidRequest, 'config must be an object with app "clinical".', 'config'));
  } else {
    const c = config as Record<string, unknown>;
    if (c['app'] !== GENERATION_APPS.clinical) {
      issues.push(issue(CODES.invalidApp, 'config.app must be "clinical".', 'config.app'));
    }
    const wanted = c['generationDirection'];
    if (wanted !== undefined) {
      if (isGenerationDirection(wanted)) direction = wanted;
      else issues.push(issue(CODES.invalidDirection, 'generationDirection must be "factToSubject" or "subjectToFact".', 'config.generationDirection'));
    }
  }
  if (mode === 'solitaire' || mode === 'vsBeepy') {
    const expected = expectedChallengeCount(mode);
    if (challengeCount !== expected) {
      issues.push(issue(CODES.challengeCountMismatch, `Mode "${mode}" shows ${expected} challenges; challengeCount must be ${expected}.`, 'challengeCount'));
    }
  }
  if (!(typeof target === 'number' && Number.isSafeInteger(target) && target >= 1)) {
    issues.push(issue(CODES.invalidCount, 'targetCardCount must be a positive whole number.', 'targetCardCount'));
  }

  const dataset = validateClinicalCollection(record['source']);
  if (!dataset.ok) {
    for (const found of dataset.issues) issues.push(issue(found.code, found.message, `source.${found.path}`));
  }
  let review: ReviewValidationResult = NO_REVIEWS;
  if (dataset.ok && record['review'] !== undefined) {
    review = validateReviewFile(record['review'], dataset.collection);
    // Record-level problems and stale records are not fatal: such records are simply
    // not used. A file that is unusable as a whole is an authoring error.
    if (!review.fileUsable) {
      for (const found of review.issues) issues.push(issue(found.code, found.message, `review.${found.path}`));
    }
  }

  if (issues.length > 0 || !dataset.ok) return { ok: false, issues };
  return {
    ok: true,
    request: {
      mode: mode as ClinicalMode,
      direction,
      seed: toRngState(seed as number),
      challengeCount: challengeCount as number,
      targetCardCount: target as number,
      collection: dataset.collection,
      review,
    },
  };
}

// ---------------------------------------------------------------------------
// Internal model
// ---------------------------------------------------------------------------

/** One candidate challenge. For subjectToFact `factText` is undefined. Trusted, never public. */
export interface ChallengeSpec {
  readonly disease: SubjectRecord;
  readonly topic: Topic;
  readonly category: ClinicalCategoryKey;
  /** factToSubject: the correct fact shown on the board (verbatim). */
  readonly factText?: string;
  readonly factExplanation?: string;
}

/** One distinct card face (by normalized text), with its verbatim text. */
export interface CardFace {
  readonly key: string;
  readonly text: string;
  /** subjectToFact: the category of the first topic that lists it (for plausibility). */
  readonly category?: ClinicalCategoryKey;
}

interface Board {
  readonly challenges: readonly ChallengeSpec[];
  /** Normalized key of the designated card per challenge (same order). */
  readonly designated: readonly string[];
  readonly pool: readonly CardFace[];
}

export type RelationFn = (card: CardFace, challenge: ChallengeSpec) => Relation;

/** The verbatim card universe: distinct normalized texts in document order. */
export function cardUniverse(collection: SubjectCollection, direction: GenerationDirection): CardFace[] {
  const seen = new Map<string, CardFace>();
  const addFace = (text: string, category?: ClinicalCategoryKey): void => {
    const key = normalizeDisplayText(text);
    if (key.length > 0 && !seen.has(key)) seen.set(key, category === undefined ? { key, text } : { key, text, category });
  };
  for (const disease of collection.subjects) {
    if (direction === 'factToSubject') {
      addFace(disease.subject);
      for (const alternative of disease.subjectIncorrects) addFace(alternative.text);
    } else {
      for (const topic of disease.topics) {
        const category = categoryOfTopicName(topic.topicName);
        for (const entry of [...topic.corrects, ...topic.incorrects]) addFace(entry.text, category);
      }
    }
  }
  return [...seen.values()];
}

function candidateChallenges(collection: SubjectCollection, direction: GenerationDirection): ChallengeSpec[] {
  const list: ChallengeSpec[] = [];
  for (const disease of collection.subjects) {
    for (const topic of disease.topics) {
      const category = categoryOfTopicName(topic.topicName);
      if (category === undefined || topic.corrects.length === 0) continue;
      if (direction === 'subjectToFact') {
        list.push({ disease, topic, category });
      } else {
        for (const entry of topic.corrects) {
          list.push({
            disease,
            topic,
            category,
            factText: entry.text,
            ...(entry.explanation === undefined ? {} : { factExplanation: entry.explanation }),
          });
        }
      }
    }
  }
  return list;
}

export const relationFor = (policy: ClinicalValidityPolicy, direction: GenerationDirection): RelationFn =>
  direction === 'subjectToFact'
    ? (card, challenge) => policy.factRelation(card.text, challenge.topic.id).relation
    : (card, challenge) => policy.nameRelation(card.text, challenge.topic.id, challenge.factText as string).relation;

/**
 * Greedy seeded board: walk the shuffled candidates and add one when a designated
 * card exists that is valid for it and reviewed-invalid for every chosen challenge,
 * and every chosen designated card is reviewed-invalid for it.
 */
function chooseBoard(
  candidates: readonly ChallengeSpec[],
  faces: ReadonlyMap<string, CardFace>,
  count: number,
  direction: GenerationDirection,
  relation: RelationFn,
  rng: RngState,
): readonly [{ challenges: ChallengeSpec[]; designated: string[] } | undefined, RngState] {
  let state = rng;
  const [order, afterOrder] = shuffle([...candidates], state);
  state = afterOrder;
  const challenges: ChallengeSpec[] = [];
  const designated: string[] = [];
  const usedDiseases = new Set<SubjectRecord>();
  const usedTopics = new Set<Topic>();
  for (const candidate of order) {
    if (challenges.length === count) break;
    if (direction === 'subjectToFact' ? usedTopics.has(candidate.topic) : usedDiseases.has(candidate.disease)) continue;
    let options: string[];
    if (direction === 'subjectToFact') {
      const [shuffled, next] = shuffle([...new Set(candidate.topic.corrects.map((e) => normalizeDisplayText(e.text)))], state);
      state = next;
      options = shuffled;
    } else {
      options = [normalizeDisplayText(candidate.disease.subject)];
    }
    for (const key of options) {
      const face = faces.get(key);
      if (face === undefined || designated.includes(key)) continue;
      if (relation(face, candidate) !== 'valid') continue;
      const compatible = challenges.every((chosen, i) => {
        const chosenFace = faces.get(designated[i] as string) as CardFace;
        return relation(face, chosen) === 'invalid' && relation(chosenFace, candidate) === 'invalid';
      });
      if (!compatible) continue;
      challenges.push(candidate);
      designated.push(key);
      usedTopics.add(candidate.topic);
      usedDiseases.add(candidate.disease);
      break;
    }
  }
  return [challenges.length === count ? { challenges, designated } : undefined, state];
}

/** Distractor pool for a board via the M2 ambiguity analysis, or undefined on a fault. */
function distractorPool(
  board: { readonly challenges: readonly ChallengeSpec[]; readonly designated: readonly string[] },
  universe: readonly CardFace[],
  relation: RelationFn,
): CardFace[] | undefined {
  const challengeIds = board.challenges.map((_, i) => `x${i}`);
  const usable: CardFace[] = [];
  const matrix: Record<string, Record<string, boolean>> = Object.fromEntries(challengeIds.map((id) => [id, {}]));
  universe.forEach((face) => {
    const relations = board.challenges.map((challenge) => relation(face, challenge));
    if (relations.includes('unknown')) return; // unknown is never a distractor
    usable.push(face);
    relations.forEach((r, i) => {
      (matrix[`x${i}`] as Record<string, boolean>)[face.key] = r === 'valid';
    });
  });
  const analysis = analyzeCandidateAmbiguity(challengeIds, usable.map((f) => f.key), matrix);
  if (!analysis.ok) return undefined;
  for (let i = 0; i < board.designated.length; i += 1) {
    if (!(analysis.analysis.unambiguousByChallenge[`x${i}`] ?? []).includes(board.designated[i] as string)) return undefined;
  }
  const allowed = new Set(analysis.analysis.distractorCandidates);
  return usable.filter((face) => allowed.has(face.key));
}

// ---------------------------------------------------------------------------
// Explanations (authored context only)
// ---------------------------------------------------------------------------

const explanationOf = (entries: readonly { readonly text: string; readonly explanation?: string }[], key: string): string | undefined =>
  entries.find((entry) => normalizeDisplayText(entry.text) === key && entry.explanation !== undefined)?.explanation;

function explanationFor(
  collection: SubjectCollection,
  direction: GenerationDirection,
  card: CardFace,
  challenge: ChallengeSpec,
  relation: Relation,
): string | undefined {
  if (direction === 'subjectToFact') {
    // An entry of THIS topic with this text: written for this disease + category.
    return explanationOf([...challenge.topic.corrects, ...challenge.topic.incorrects], card.key);
  }
  if (card.key === normalizeDisplayText(challenge.disease.subject)) {
    // The correct disease for the fact: the fact's own explanation.
    return relation === 'valid' ? challenge.factExplanation : undefined;
  }
  if (relation !== 'invalid') return undefined;
  const factKey = normalizeDisplayText(challenge.factText as string);
  const other = collection.subjects.find((s) => normalizeDisplayText(s.subject) === card.key);
  const otherTopic = other?.topics.find((t) => categoryOfTopicName(t.topicName) === challenge.category);
  // The other disease explicitly lists this fact as NOT applying in this category.
  const listed = otherTopic === undefined ? undefined : explanationOf(otherTopic.incorrects, factKey);
  if (listed !== undefined) return listed;
  // An alternative diagnosis of the challenge's disease, with its own explanation.
  return explanationOf(challenge.disease.subjectIncorrects, card.key);
}

/**
 * Recover the trusted context of a generated challenge (its disease, topic and,
 * for factToSubject, the verbatim fact) from its `sourceRef` and prompt. Returns
 * `undefined` when the challenge does not match the dataset exactly; callers then
 * treat it as unknown (safe). Used by the penalty fallback and Explain Why (C4).
 */
export function resolveChallengeContext(
  collection: SubjectCollection,
  direction: GenerationDirection,
  challenge: Pick<GeneratedChallenge, 'promptText' | 'sourceRef'>,
): ChallengeSpec | undefined {
  const disease = collection.subjects.find((s) => s.id === challenge.sourceRef.subjectId);
  const topic = disease?.topics.find((t) => t.id === challenge.sourceRef.topicId);
  const category = topic === undefined ? undefined : categoryOfTopicName(topic.topicName);
  if (disease === undefined || topic === undefined || category === undefined) return undefined;
  if (direction === 'subjectToFact') {
    return challenge.promptText === `${disease.subject} · ${topic.topicName}` ? { disease, topic, category } : undefined;
  }
  const prefix = `${topic.topicName}: `;
  if (!challenge.promptText.startsWith(prefix)) return undefined;
  const factText = challenge.promptText.slice(prefix.length);
  const entry = topic.corrects.find((e) => e.text === factText);
  if (entry === undefined) return undefined;
  return { disease, topic, category, factText, ...(entry.explanation === undefined ? {} : { factExplanation: entry.explanation }) };
}

/**
 * The explanation the author wrote for this exact (card text, challenge) context,
 * or `undefined`. Never composed or substituted. The same rule the generator uses
 * for `explanationByChallengeId`, so a penalty card gets its authored explanation
 * for the context too (the engine strips explanations from fallback cards).
 */
export function authoredExplanation(
  collection: SubjectCollection,
  policy: ClinicalValidityPolicy,
  direction: GenerationDirection,
  cardText: string,
  challenge: ChallengeSpec,
): string | undefined {
  const face: CardFace = { key: normalizeDisplayText(cardText), text: cardText };
  return explanationFor(collection, direction, face, challenge, relationFor(policy, direction)(face, challenge));
}

// ---------------------------------------------------------------------------
// Generation
// ---------------------------------------------------------------------------

/** A generated deck and matrix before self-validation (exposed for the test seam). */
export interface ClinicalDraft {
  readonly deck: GeneratedDeck;
  readonly contextualValidity: Record<string, Record<string, boolean>>;
}

export interface ClinicalGenerationOptions {
  /** Test seam: transform the draft just before self-validation. */
  readonly tamper?: (draft: ClinicalDraft) => ClinicalDraft;
}

function generate(request: ValidRequest, options: ClinicalGenerationOptions): GenerationResult {
  const { collection, direction, mode, challengeCount, targetCardCount } = request;
  const policy = createValidityPolicy(collection, request.review);
  const relation = relationFor(policy, direction);
  const universe = cardUniverse(collection, direction);
  const faces = new Map(universe.map((face) => [face.key, face]));
  const candidates = candidateChallenges(collection, direction);
  const wantedDistractors = targetCardCount - challengeCount;

  // 2-4. Choose boards; keep the first that reaches the target, else the largest pool.
  let state = request.seed;
  let best: Board | undefined;
  for (let attempt = 0; attempt < CLINICAL_SELECTION_ATTEMPTS; attempt += 1) {
    const [chosen, next] = chooseBoard(candidates, faces, challengeCount, direction, relation, state);
    state = next;
    if (chosen === undefined) continue;
    const pool = distractorPool(chosen, universe, relation);
    if (pool === undefined) continue;
    if (best === undefined || pool.length > best.pool.length) best = { ...chosen, pool };
    if (pool.length >= wantedDistractors) break;
  }
  if (best === undefined) {
    return {
      ok: false,
      issues: [
        issue(
          CODES.insufficientChallenges,
          `Could not choose ${challengeCount} ${direction === 'factToSubject' ? 'fact challenges from different diseases' : 'disease + category challenges'} whose answers are reviewed as not applying to each other. Add reviewed content or review coverage (see the review report).`,
          'source',
        ),
      ],
    };
  }

  const board: Board = best;

  // 5. Plan from the actual pool.
  const plan = planDeckSize(mode, targetCardCount, { availableCorrect: challengeCount, availableDistractors: board.pool.length });
  if (!plan.ok) {
    return { ok: false, issues: [issue(plan.issue.code, plan.issue.message, plan.issue.path)] };
  }

  // 6. Distractors: subjectToFact prefers the board's categories (plausible), then others.
  let distractors: CardFace[];
  if (direction === 'subjectToFact') {
    const boardCategories = new Set(board.challenges.map((c) => c.category));
    const [near, afterNear] = shuffle(board.pool.filter((f) => f.category !== undefined && boardCategories.has(f.category)), state);
    const [far, afterFar] = shuffle(board.pool.filter((f) => f.category === undefined || !boardCategories.has(f.category)), afterNear);
    state = afterFar;
    distractors = [...near, ...far].slice(0, plan.distractorCount);
  } else {
    const [shuffled, next] = shuffle([...board.pool], state);
    state = next;
    distractors = shuffled.slice(0, plan.distractorCount);
  }

  // 7. Assemble with neutral ids in seeded order.
  const designatedFaces = board.designated.map((key) => faces.get(key) as CardFace);
  const [order] = shuffle([...designatedFaces, ...distractors], state);
  const idByKey = new Map(order.map((face, k) => [face.key, `k${k + 1}`]));

  const challenges: GeneratedChallenge[] = board.challenges.map((spec, i) => ({
    id: `c${i + 1}`,
    promptText:
      direction === 'subjectToFact' ? `${spec.disease.subject} · ${spec.topic.topicName}` : `${spec.topic.topicName}: ${spec.factText as string}`,
    correctAnswerCardId: idByKey.get(board.designated[i] as string) as string,
    sourceRef: { subjectId: spec.disease.id, topicId: spec.topic.id },
  }));

  const contextualValidity: Record<string, Record<string, boolean>> = {};
  const explanations = new Map<string, Record<string, string>>();
  for (let i = 0; i < board.challenges.length; i += 1) {
    const spec = board.challenges[i] as ChallengeSpec;
    const challengeId = `c${i + 1}`;
    const row: Record<string, boolean> = {};
    for (const face of order) {
      const r = relation(face, spec);
      if (r === 'unknown') {
        return { ok: false, issues: [issue(CODES.generationFault, 'Internal error: an unknown relation reached the deck.', 'contextualValidity')] };
      }
      row[idByKey.get(face.key) as string] = r === 'valid';
      const explanation = explanationFor(collection, direction, face, spec, r);
      if (explanation !== undefined) {
        const map = explanations.get(face.key) ?? {};
        map[challengeId] = explanation;
        explanations.set(face.key, map);
      }
    }
    contextualValidity[challengeId] = row;
  }

  const answerCards: GeneratedAnswerCard[] = order.map((face) => {
    const id = idByKey.get(face.key) as string;
    const map = explanations.get(face.key);
    return map === undefined ? { id, displayValue: face.text } : { id, displayValue: face.text, explanationByChallengeId: map };
  });

  let draft: ClinicalDraft = {
    deck: { direction, challenges, answerCards, meta: { targetCardCount, actualCardCount: answerCards.length } },
    contextualValidity,
  };
  if (options.tamper !== undefined) draft = options.tamper(draft);

  // 8. Self-validate with exactly the rules the engine applies.
  const problems = validateDeckForPlay(draft.deck, mode, draft.contextualValidity as ContextualValidityMap, { numericAnswers: false });
  if (problems.length > 0) {
    return { ok: false, issues: problems.map((p) => issue(p.code, p.message, p.path)) };
  }
  return {
    ok: true,
    deck: draft.deck,
    contextualValidity: draft.contextualValidity,
    numericAnswers: false,
    sizing: {
      targetCardCount,
      actualCardCount: draft.deck.answerCards.length,
      eligibleDistractors: board.pool.length,
      reduced: plan.reduced,
    },
  };
}

/** Generate one validated Clinical deck, or a structured failure. Never throws. */
export function generateClinicalDeck(raw: unknown, options: ClinicalGenerationOptions = {}): GenerationResult {
  try {
    const checked = validateClinicalRequest(raw);
    if (!checked.ok) return { ok: false, issues: checked.issues };
    return generate(checked.request, options);
  } catch (error) {
    return { ok: false, issues: [issue(CODES.generationFault, `Unexpected generator error: ${String(error)}`, 'generate')] };
  }
}

/**
 * Clinical Cards deck generator. Implements the shared `DeckGenerator` boundary.
 * Default direction is `subjectToFact` (master spec section 9).
 */
export class ClinicalDeckGenerator implements DeckGenerator<ClinicalGenerationRequest> {
  readonly app = GENERATION_APPS.clinical;

  generate(request: ClinicalGenerationRequest): GenerationResult {
    return generateClinicalDeck(request);
  }
}
