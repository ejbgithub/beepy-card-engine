/**
 * Clinical review records, contextual validity, and the review report
 * (Milestone M6, stage C2; alternative-diagnosis safeguard Q-1 added before C3).
 *
 * Principle (decision C-3): missing data never implies clinical falsehood. A card
 * is treated as WRONG for a challenge only when the dataset or an owner review
 * says so. Everything else is UNKNOWN, and unknown cards are never used as
 * distractors.
 *
 * This module contains no clinical knowledge and makes no clinical judgments. It
 * reads the owner-authored dataset and the owner-authored review file, checks
 * them, and reports what has and has not been reviewed.
 *
 * Contents:
 * - Fingerprints: deterministic FNV-1a 64-bit hashes of reviewed content, so a
 *   review becomes STALE when that content changes.
 *   - `topicFingerprint`: a topic's disease name, category and correct facts.
 *   - `alternativesFingerprint`: a disease's name, all its correct facts by
 *     category, and the alternative-diagnosis texts a record covers.
 * - `validateReviewFile`: structure, attestation, references and staleness of
 *   `clinical-review.json`, for both record kinds:
 *   - `reviews` (topic groups): the correct facts of each listed topic were
 *     reviewed against every other listed topic;
 *   - `alternativeReviews` (Q-1): every correct fact of one disease was reviewed
 *     against the listed alternative diagnoses of that disease.
 * - `createValidityPolicy`: valid / invalid / unknown for fact cards
 *   (subjectToFact) and disease-name cards (factToSubject), and a bridge to the
 *   M2 ambiguity analysis (`factValidityMatrix`).
 * - `buildReviewReport` / `formatReviewReport`: the owner's review checklist.
 * - `draftReviewRecord` / `draftAlternativeReview`: ready-to-fill records with
 *   current fingerprints, so the owner never calculates a fingerprint by hand.
 *
 * Preconditions: functions that take a `SubjectCollection` expect one that has
 * passed `validateClinicalCollection` (stage C1). `buildReviewReport` takes
 * untrusted values and validates them itself.
 *
 * References:
 * - .kiro/specs/clinical-cards/requirements.md (Req 3)
 * - .kiro/specs/clinical-cards/design.md (section 4)
 * - clinical-cards/authoring/AUTHORING.md (section 7)
 */

import {
  normalizeDisplayText,
  type AnswerEntry,
  type ContextualValidityMap,
  type SubjectCollection,
  type SubjectRecord,
  type Topic,
  type ValidationIssue,
} from '@beepy/shared-engine';
import {
  categoryOfTopicName,
  validateClinicalCollection,
  type ClinicalCategoryKey,
  type ClinicalContentIssue,
} from './clinical-content.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** The review-file format this build understands. */
export const REVIEW_FORMAT_VERSION = '1.0.0';

/**
 * The owner attestation every topic-group record must carry, word for word. It is
 * what makes a review record establish invalidity; a record without it
 * establishes nothing.
 */
export const REVIEW_STATEMENT =
  "Every correct fact of each topic listed was reviewed against every other topic listed. A fact does not apply to another listed topic unless it is also listed in that topic's corrects.";

/** The owner attestation every alternative-diagnosis record must carry (Q-1). */
export const ALTERNATIVE_REVIEW_STATEMENT =
  'Every correct fact of this disease was reviewed against every alternative diagnosis listed in this record. None of those facts applies to any of those alternative diagnoses.';

/** Placeholders written by the draft helpers; a record still containing them is rejected. */
export const REVIEW_PLACEHOLDER_REVIEWER = '<reviewer name>';
export const REVIEW_PLACEHOLDER_DATE = 'YYYY-MM-DD';

/** Fingerprint format: version tag plus 16 lowercase hex digits (64 bits). */
const FINGERPRINT_PATTERN = /^fp1-[0-9a-f]{16}$/;
const REVIEW_ID_PATTERN = /^review\.[a-z0-9]+(?:-[a-z0-9]+)*(?:\.[a-z0-9]+(?:-[a-z0-9]+)*)*$/;
const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Stable issue codes for the review file. */
export const REVIEW_CODES = {
  invalidFile: 'REVIEW_INVALID_FILE',
  unsupportedVersion: 'REVIEW_UNSUPPORTED_VERSION',
  unknownField: 'REVIEW_UNKNOWN_FIELD',
  invalidRecord: 'REVIEW_INVALID_RECORD',
  invalidId: 'REVIEW_INVALID_ID',
  duplicateId: 'REVIEW_DUPLICATE_ID',
  missingReviewer: 'REVIEW_MISSING_REVIEWER',
  invalidDate: 'REVIEW_INVALID_DATE',
  statementMismatch: 'REVIEW_STATEMENT_MISMATCH',
  tooFewTopics: 'REVIEW_TOO_FEW_TOPICS',
  duplicateTopic: 'REVIEW_DUPLICATE_TOPIC',
  unknownTopic: 'REVIEW_UNKNOWN_TOPIC',
  invalidFingerprint: 'REVIEW_INVALID_FINGERPRINT',
  stale: 'REVIEW_STALE',
  unknownSubject: 'REVIEW_UNKNOWN_SUBJECT',
  noAlternatives: 'REVIEW_NO_ALTERNATIVES',
  unknownAlternative: 'REVIEW_UNKNOWN_ALTERNATIVE',
  duplicateAlternative: 'REVIEW_DUPLICATE_ALTERNATIVE',
} as const;

export type ReviewCode = (typeof REVIEW_CODES)[keyof typeof REVIEW_CODES];

/** One structured, actionable issue (same shape as the M2 issues). */
export interface ReviewIssue {
  readonly code: ReviewCode;
  readonly message: string;
  readonly path: string;
}

// ---------------------------------------------------------------------------
// Review-file types
// ---------------------------------------------------------------------------

export interface ReviewTopicEntry {
  readonly topicId: string;
  readonly fingerprint: string;
}

/** A topic-group record (`reviews[]`). */
export interface ReviewRecord {
  readonly id: string;
  readonly reviewedBy: string;
  readonly reviewedOn: string;
  readonly statement: string;
  readonly topics: readonly ReviewTopicEntry[];
}

/** An alternative-diagnosis record (`alternativeReviews[]`, Q-1). */
export interface AlternativeReviewRecord {
  readonly id: string;
  readonly reviewedBy: string;
  readonly reviewedOn: string;
  readonly statement: string;
  readonly subjectId: string;
  /** Ids of entries in that disease's `subjectIncorrects`. */
  readonly alternativeIds: readonly string[];
  readonly fingerprint: string;
}

export interface ReviewFile {
  readonly reviewFormatVersion: string;
  readonly reviews: readonly ReviewRecord[];
  /** Optional. */
  readonly alternativeReviews?: readonly AlternativeReviewRecord[];
}

export type RecordState = 'current' | 'stale' | 'invalid';

/** Where one topic-group record stands after validation. Only `current` records are used. */
export interface ReviewRecordStatus {
  readonly index: number;
  readonly path: string;
  /** The record id when it is a string, otherwise `undefined`. */
  readonly id: string | undefined;
  readonly state: RecordState;
  /** Topic ids named by the record that exist in the dataset. */
  readonly topicIds: readonly string[];
  /** Topics whose recorded fingerprint no longer matches the dataset. */
  readonly staleTopicIds: readonly string[];
}

/** Where one alternative-diagnosis record stands after validation. */
export interface AlternativeReviewStatus {
  readonly index: number;
  readonly path: string;
  readonly id: string | undefined;
  readonly state: RecordState;
  /** The disease, when the record names one that exists. */
  readonly subjectId: string | undefined;
  /** Alternative entry ids that exist under that disease. */
  readonly alternativeIds: readonly string[];
}

export interface ReviewValidationResult {
  /** True when the file has no errors. Stale records are reported separately. */
  readonly ok: boolean;
  /** False when the file itself is unusable (no record is then used). */
  readonly fileUsable: boolean;
  /** Errors in the file or in individual records. */
  readonly issues: readonly ReviewIssue[];
  /** One `REVIEW_STALE` issue per changed fingerprint in an otherwise valid record. */
  readonly stale: readonly ReviewIssue[];
  readonly records: readonly ReviewRecordStatus[];
  readonly alternativeRecords: readonly AlternativeReviewStatus[];
}

/** A review result with no records (no review file supplied). */
export const NO_REVIEWS: ReviewValidationResult = Object.freeze({
  ok: true,
  fileUsable: true,
  issues: [],
  stale: [],
  records: [],
  alternativeRecords: [],
});

// ---------------------------------------------------------------------------
// Fingerprints
// ---------------------------------------------------------------------------

const FNV_OFFSET = 0xcbf29ce484222325n;
const FNV_PRIME = 0x100000001b3n;
const MASK_64 = 0xffffffffffffffffn;

/** FNV-1a 64-bit hash of the UTF-8 bytes of `text`, as 16 lowercase hex digits. */
export function fnv1a64Hex(text: string): string {
  let hash = FNV_OFFSET;
  for (const byte of new TextEncoder().encode(text)) {
    hash ^= BigInt(byte);
    hash = (hash * FNV_PRIME) & MASK_64;
  }
  return hash.toString(16).padStart(16, '0');
}

const sortedKeys = (entries: readonly { readonly text: string }[]): string[] =>
  [...new Set(entries.map((entry) => normalizeDisplayText(entry.text)))].sort();

/**
 * The fingerprint of a topic's REVIEWED content: the disease name, the category,
 * and the set of correct-fact texts (normalized, de-duplicated, sorted). It does
 * not change when facts are reordered, ids change, or explanations or incorrects
 * are edited, because a review group covers the applicability of correct facts.
 * Any other change to those texts, an added or removed fact, a renamed disease,
 * or a changed category makes reviews of this topic stale.
 */
export function topicFingerprint(diseaseName: string, topic: Topic): string {
  const canonical = JSON.stringify(['clinical-topic-v1', normalizeDisplayText(diseaseName), topic.topicName, sortedKeys(topic.corrects)]);
  return `fp1-${fnv1a64Hex(canonical)}`;
}

/**
 * The fingerprint of an alternative-diagnosis review (Q-1): the disease name,
 * every category with its correct facts, and the texts of the covered
 * alternatives. Editing any correct fact of the disease, adding or removing a
 * category, renaming the disease, or editing a covered alternative's text makes
 * the record stale.
 */
export function alternativesFingerprint(disease: SubjectRecord, alternatives: readonly AnswerEntry[]): string {
  const topics = disease.topics.map((topic) => [topic.topicName, sortedKeys(topic.corrects)] as const);
  topics.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
  const canonical = JSON.stringify(['clinical-alternatives-v1', normalizeDisplayText(disease.subject), topics, sortedKeys(alternatives)]);
  return `fp1-${fnv1a64Hex(canonical)}`;
}

// ---------------------------------------------------------------------------
// Dataset index (internal)
// ---------------------------------------------------------------------------

interface TopicInfo {
  readonly topic: Topic;
  readonly disease: SubjectRecord;
  readonly path: string;
  readonly label: string;
  readonly category: ClinicalCategoryKey | undefined;
  readonly correctKeys: ReadonlySet<string>;
  readonly incorrectKeys: ReadonlySet<string>;
  readonly fingerprint: string;
}

interface DiseaseInfo {
  readonly disease: SubjectRecord;
  readonly path: string;
  readonly byCategory: ReadonlyMap<ClinicalCategoryKey, TopicInfo>;
  readonly alternativesById: ReadonlyMap<string, AnswerEntry>;
  readonly alternativeKeys: ReadonlySet<string>;
}

interface DatasetIndex {
  readonly topics: ReadonlyMap<string, TopicInfo>;
  /** Topic ids in document order. */
  readonly topicOrder: readonly string[];
  readonly diseases: ReadonlyMap<SubjectRecord, DiseaseInfo>;
  readonly diseaseById: ReadonlyMap<string, DiseaseInfo>;
  readonly diseaseByName: ReadonlyMap<string, SubjectRecord>;
}

const keysOf = (texts: readonly { readonly text: string }[]): Set<string> =>
  new Set(texts.map((entry) => normalizeDisplayText(entry.text)));

function indexDataset(collection: SubjectCollection): DatasetIndex {
  const topics = new Map<string, TopicInfo>();
  const topicOrder: string[] = [];
  const diseases = new Map<SubjectRecord, DiseaseInfo>();
  const diseaseById = new Map<string, DiseaseInfo>();
  const diseaseByName = new Map<string, SubjectRecord>();
  collection.subjects.forEach((disease, d) => {
    diseaseByName.set(normalizeDisplayText(disease.subject), disease);
    const byCategory = new Map<ClinicalCategoryKey, TopicInfo>();
    disease.topics.forEach((topic, t) => {
      const category = categoryOfTopicName(topic.topicName);
      const info: TopicInfo = {
        topic,
        disease,
        path: `subjects[${d}].topics[${t}]`,
        label: `${disease.subject} · ${topic.topicName}`,
        category,
        correctKeys: keysOf(topic.corrects),
        incorrectKeys: keysOf(topic.incorrects),
        fingerprint: topicFingerprint(disease.subject, topic),
      };
      topics.set(topic.id, info);
      topicOrder.push(topic.id);
      if (category !== undefined) byCategory.set(category, info);
    });
    const info: DiseaseInfo = {
      disease,
      path: `subjects[${d}]`,
      byCategory,
      alternativesById: new Map(disease.subjectIncorrects.map((entry) => [entry.id, entry])),
      alternativeKeys: keysOf(disease.subjectIncorrects),
    };
    diseases.set(disease, info);
    diseaseById.set(disease.id, info);
  });
  return { topics, topicOrder, diseases, diseaseById, diseaseByName };
}

// ---------------------------------------------------------------------------
// Review-file validation
// ---------------------------------------------------------------------------

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isRealDate = (text: string): boolean => {
  const match = DATE_PATTERN.exec(text);
  if (match === null) return false;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
};

const FILE_FIELDS = ['reviewFormatVersion', 'reviews', 'alternativeReviews'];
const RECORD_FIELDS = ['id', 'reviewedBy', 'reviewedOn', 'statement', 'topics'];
const ALTERNATIVE_FIELDS = ['id', 'reviewedBy', 'reviewedOn', 'statement', 'subjectId', 'alternativeIds', 'fingerprint'];
const TOPIC_FIELDS = ['topicId', 'fingerprint'];
const quoteList = (fields: readonly string[]): string => fields.map((f) => `"${f}"`).join(', ');

type AddIssue = (code: ReviewCode, message: string, path: string) => void;

/** Unknown fields of an object. */
function checkFields(record: Record<string, unknown>, allowed: readonly string[], path: string, add: AddIssue): void {
  for (const key of Object.keys(record)) {
    if (!allowed.includes(key)) {
      add(REVIEW_CODES.unknownField, `Unknown field "${key}". Allowed: ${quoteList(allowed)}.`, path === '' ? key : `${path}.${key}`);
    }
  }
}

/** The attestation header shared by both record kinds. Returns the record id when usable. */
function checkHeader(
  record: Record<string, unknown>,
  path: string,
  statement: string,
  seenIds: Map<string, string>,
  add: AddIssue,
): { readonly id: string | undefined; readonly label: string } {
  const id = record['id'];
  const label = typeof id === 'string' ? `Review "${id}"` : `The review at ${path}`;
  if (typeof id !== 'string' || !REVIEW_ID_PATTERN.test(id)) {
    add(REVIEW_CODES.invalidId, 'The review id must look like "review.<slug>", using lowercase letters, digits and hyphens, e.g. "review.workup-group-1".', `${path}.id`);
  } else {
    const first = seenIds.get(id);
    if (first === undefined) seenIds.set(id, path);
    else add(REVIEW_CODES.duplicateId, `Review id "${id}" is already used by ${first}. Each review needs its own id.`, `${path}.id`);
  }
  const reviewer = record['reviewedBy'];
  if (typeof reviewer !== 'string' || reviewer.trim().length === 0 || reviewer.trim() === REVIEW_PLACEHOLDER_REVIEWER) {
    add(REVIEW_CODES.missingReviewer, `${label} must name the person who performed the review in "reviewedBy".`, `${path}.reviewedBy`);
  }
  const date = record['reviewedOn'];
  if (typeof date !== 'string' || !isRealDate(date)) {
    add(REVIEW_CODES.invalidDate, `${label} needs the date the review was performed in "reviewedOn", as a real calendar date YYYY-MM-DD.`, `${path}.reviewedOn`);
  }
  if (record['statement'] !== statement) {
    add(
      REVIEW_CODES.statementMismatch,
      `${label} must carry the review attestation word for word, confirming the review was actually performed. Expected: "${statement}"`,
      `${path}.statement`,
    );
  }
  return { id: typeof id === 'string' ? id : undefined, label };
}

const fingerprintMessage =
  'The fingerprint must be copied from the review report (format "fp1-" followed by 16 hex digits). Never type or calculate it by hand.';

/**
 * Validate an UNTRUSTED review file against a validated Clinical dataset.
 *
 * Every record is checked independently: one bad record does not disable the
 * others. A record establishes nothing unless it is complete, carries the exact
 * attestation, names a reviewer and a real date, references existing dataset
 * content, and every fingerprint still matches the dataset. A record whose
 * fingerprints no longer match is `stale`: it is reported and is not used until it
 * is renewed. Never throws.
 */
export function validateReviewFile(value: unknown, collection: SubjectCollection): ReviewValidationResult {
  const index = indexDataset(collection);
  const issues: ReviewIssue[] = [];
  const stale: ReviewIssue[] = [];
  const records: ReviewRecordStatus[] = [];
  const alternativeRecords: AlternativeReviewStatus[] = [];
  const add: AddIssue = (code, message, path) => {
    issues.push({ code, message, path });
  };
  const result = (fileUsable: boolean): ReviewValidationResult => ({
    ok: issues.length === 0,
    fileUsable,
    issues,
    stale,
    records,
    alternativeRecords,
  });

  if (!isObject(value)) {
    add(REVIEW_CODES.invalidFile, 'The review file must be a JSON object with "reviewFormatVersion" and "reviews".', '$');
    return result(false);
  }
  let fileUsable = true;
  const before = issues.length;
  checkFields(value, FILE_FIELDS, '', add);
  if (issues.length > before) fileUsable = false;
  const version = value['reviewFormatVersion'];
  if (typeof version !== 'string') {
    add(REVIEW_CODES.invalidFile, `"reviewFormatVersion" must be the string "${REVIEW_FORMAT_VERSION}".`, 'reviewFormatVersion');
    fileUsable = false;
  } else if (version !== REVIEW_FORMAT_VERSION) {
    add(REVIEW_CODES.unsupportedVersion, `Unsupported reviewFormatVersion "${version}". Supported: ${REVIEW_FORMAT_VERSION}.`, 'reviewFormatVersion');
    fileUsable = false;
  }
  const reviews = value['reviews'];
  const alternatives = value['alternativeReviews'];
  if (!Array.isArray(reviews)) {
    add(REVIEW_CODES.invalidFile, '"reviews" must be an array of review records (it may be empty).', 'reviews');
    return result(false);
  }
  if (alternatives !== undefined && !Array.isArray(alternatives)) {
    add(REVIEW_CODES.invalidFile, '"alternativeReviews" must be an array when present (it may be empty).', 'alternativeReviews');
    return result(false);
  }

  const seenIds = new Map<string, string>();

  // Topic-group records.
  reviews.forEach((record: unknown, r) => {
    const path = `reviews[${r}]`;
    const start = issues.length;
    if (!isObject(record)) {
      add(REVIEW_CODES.invalidRecord, `A review record must be an object with ${quoteList(RECORD_FIELDS)}.`, path);
      records.push({ index: r, path, id: undefined, state: 'invalid', topicIds: [], staleTopicIds: [] });
      return;
    }
    checkFields(record, RECORD_FIELDS, path, add);
    const { id, label } = checkHeader(record, path, REVIEW_STATEMENT, seenIds, add);

    const topicIds: string[] = [];
    const changed: { topicId: string; at: string }[] = [];
    const topics = record['topics'];
    if (!Array.isArray(topics)) {
      add(REVIEW_CODES.invalidRecord, `${label} needs "topics": an array of { "topicId", "fingerprint" } entries.`, `${path}.topics`);
    } else {
      const seenTopics = new Map<string, number>();
      topics.forEach((entry: unknown, t) => {
        const at = `${path}.topics[${t}]`;
        if (!isObject(entry)) {
          add(REVIEW_CODES.invalidRecord, 'Each topic entry must be an object with "topicId" and "fingerprint".', at);
          return;
        }
        checkFields(entry, TOPIC_FIELDS, at, add);
        const topicId = entry['topicId'];
        const fingerprint = entry['fingerprint'];
        if (typeof topicId !== 'string') {
          add(REVIEW_CODES.invalidRecord, '"topicId" must be a topic id string from the dataset.', `${at}.topicId`);
          return;
        }
        const info = index.topics.get(topicId);
        if (info === undefined) {
          add(REVIEW_CODES.unknownTopic, `Topic "${topicId}" is not in the dataset. Check the id, or remove it from this review.`, `${at}.topicId`);
        } else {
          const first = seenTopics.get(topicId);
          if (first === undefined) {
            seenTopics.set(topicId, t);
            topicIds.push(topicId);
          } else {
            add(REVIEW_CODES.duplicateTopic, `Topic "${topicId}" is already listed at ${path}.topics[${first}].`, `${at}.topicId`);
          }
        }
        if (typeof fingerprint !== 'string' || !FINGERPRINT_PATTERN.test(fingerprint)) {
          add(REVIEW_CODES.invalidFingerprint, fingerprintMessage, `${at}.fingerprint`);
        } else if (info !== undefined && fingerprint !== info.fingerprint) {
          changed.push({ topicId, at: `${at}.fingerprint` });
        }
      });
      if (topics.length < 2) {
        add(REVIEW_CODES.tooFewTopics, `${label} must cover at least two different topics; a review relates topics to each other.`, `${path}.topics`);
      }
    }

    if (issues.length > start) {
      records.push({ index: r, path, id, state: 'invalid', topicIds, staleTopicIds: [] });
      return;
    }
    if (changed.length > 0) {
      for (const { topicId, at } of changed) {
        const info = index.topics.get(topicId);
        stale.push({
          code: REVIEW_CODES.stale,
          message: `${label} is out of date: the reviewed content of "${info?.label ?? topicId}" (${topicId}) changed after the review was recorded. Re-review all topics in this record, then renew it with the current fingerprints from the review report. Until then it is not used.`,
          path: at,
        });
      }
      records.push({ index: r, path, id, state: 'stale', topicIds, staleTopicIds: changed.map((c) => c.topicId) });
      return;
    }
    records.push({ index: r, path, id, state: 'current', topicIds, staleTopicIds: [] });
  });

  // Alternative-diagnosis records (Q-1).
  (alternatives ?? []).forEach((record: unknown, r) => {
    const path = `alternativeReviews[${r}]`;
    const start = issues.length;
    if (!isObject(record)) {
      add(REVIEW_CODES.invalidRecord, `An alternative-diagnosis review must be an object with ${quoteList(ALTERNATIVE_FIELDS)}.`, path);
      alternativeRecords.push({ index: r, path, id: undefined, state: 'invalid', subjectId: undefined, alternativeIds: [] });
      return;
    }
    checkFields(record, ALTERNATIVE_FIELDS, path, add);
    const { id, label } = checkHeader(record, path, ALTERNATIVE_REVIEW_STATEMENT, seenIds, add);

    const subjectId = record['subjectId'];
    const disease = typeof subjectId === 'string' ? index.diseaseById.get(subjectId) : undefined;
    if (disease === undefined) {
      add(REVIEW_CODES.unknownSubject, `${label} must name a disease id from the dataset in "subjectId" (e.g. "clinical.subject.<disease-slug>").`, `${path}.subjectId`);
    }
    const alternativeIds: string[] = [];
    const covered: AnswerEntry[] = [];
    const listed = record['alternativeIds'];
    if (!Array.isArray(listed)) {
      add(REVIEW_CODES.invalidRecord, `${label} needs "alternativeIds": the ids of the alternative diagnoses that were reviewed.`, `${path}.alternativeIds`);
    } else if (listed.length === 0) {
      add(REVIEW_CODES.noAlternatives, `${label} must list at least one alternative diagnosis id.`, `${path}.alternativeIds`);
    } else {
      const seen = new Map<string, number>();
      listed.forEach((altId: unknown, a) => {
        const at = `${path}.alternativeIds[${a}]`;
        const entry = typeof altId === 'string' ? disease?.alternativesById.get(altId) : undefined;
        if (typeof altId !== 'string' || (disease !== undefined && entry === undefined)) {
          add(REVIEW_CODES.unknownAlternative, `"${String(altId)}" is not an alternative diagnosis (subjectIncorrects entry id) of this disease.`, at);
          return;
        }
        const first = seen.get(altId);
        if (first !== undefined) {
          add(REVIEW_CODES.duplicateAlternative, `Alternative "${altId}" is already listed at ${path}.alternativeIds[${first}].`, at);
          return;
        }
        seen.set(altId, a);
        if (entry !== undefined) {
          alternativeIds.push(altId);
          covered.push(entry);
        }
      });
    }
    const fingerprint = record['fingerprint'];
    if (typeof fingerprint !== 'string' || !FINGERPRINT_PATTERN.test(fingerprint)) {
      add(REVIEW_CODES.invalidFingerprint, fingerprintMessage, `${path}.fingerprint`);
    }

    const diseaseId = disease?.disease.id;
    if (issues.length > start || disease === undefined) {
      alternativeRecords.push({ index: r, path, id, state: 'invalid', subjectId: diseaseId, alternativeIds });
      return;
    }
    if (fingerprint !== alternativesFingerprint(disease.disease, covered)) {
      stale.push({
        code: REVIEW_CODES.stale,
        message: `${label} is out of date: the correct facts of "${disease.disease.subject}" (${disease.disease.id}) or the listed alternative diagnoses changed after the review was recorded. Re-review them, then renew the record with the current fingerprint from the review report. Until then it is not used.`,
        path: `${path}.fingerprint`,
      });
      alternativeRecords.push({ index: r, path, id, state: 'stale', subjectId: diseaseId, alternativeIds });
      return;
    }
    alternativeRecords.push({ index: r, path, id, state: 'current', subjectId: diseaseId, alternativeIds });
  });

  return result(fileUsable);
}

// ---------------------------------------------------------------------------
// Validity policy
// ---------------------------------------------------------------------------

export type Relation = 'valid' | 'invalid' | 'unknown';

/** Why a relation was decided. Never a clinical judgment: always a pointer to data. */
export type RelationBasis =
  | 'listedCorrect' // the card text is in the challenge topic's corrects
  | 'listedIncorrect' // the card text is in the relevant topic's incorrects
  | 'reviewed' // a current topic-group review covers both topics
  | 'reviewedAlternative' // factToSubject: a current alternative-diagnosis review covers this name
  | 'sameDisease' // factToSubject: the card is the challenge's own disease
  | 'sharedFact' // factToSubject: the other disease lists the same fact in that category
  | 'notCoveredByReview' // no listing and no current review: unknown
  | 'notInDataset' // the card text is not a dataset fact or name: unknown
  | 'notAChallengeFact' // factToSubject: the fact is not a correct fact of that topic
  | 'unknownTopic'; // the challenge topic is not in the dataset

export interface RelationResult {
  readonly relation: Relation;
  readonly basis: RelationBasis;
  /** The covering review record, when `basis` is `reviewed` or `reviewedAlternative`. */
  readonly reviewId?: string;
}

export interface FactCard {
  readonly id: string;
  readonly text: string;
}

export interface FactValidityMatrix {
  /** `challengeTopicId -> cardId -> isValid` for usable cards only (every pair known). */
  readonly contextualValidity: ContextualValidityMap;
  /** Cards known (valid or invalid) for every challenge, in input order. */
  readonly usableCardIds: readonly string[];
  /** Every (card, challenge) pair that is unknown. Such cards are excluded. */
  readonly unknownPairs: readonly { readonly cardId: string; readonly challengeTopicId: string }[];
}

export interface ClinicalValidityPolicy {
  /** subjectToFact: a fact card on the challenge "disease · category" (a topic). */
  factRelation(cardText: string, challengeTopicId: string): RelationResult;
  /** factToSubject: a disease-name card on the challenge "category: fact" from a topic. */
  nameRelation(cardName: string, challengeTopicId: string, challengeFactText: string): RelationResult;
  /** Ids of current topic-group records covering both topics (empty when unreviewed). */
  reviewsCovering(topicIdA: string, topicIdB: string): readonly string[];
  /** Id of a current alternative review of `subjectId` covering the name, if any. */
  alternativeReviewCovering(subjectId: string, alternativeText: string): string | undefined;
  /**
   * Relations for every card against every challenge topic, split into a complete
   * boolean matrix for the M2 ambiguity analysis (`analyzeCandidateAmbiguity`) and
   * the unknown pairs that exclude a card.
   */
  factValidityMatrix(challengeTopicIds: readonly string[], cards: readonly FactCard[]): FactValidityMatrix;
}

const pairKey = (a: string, b: string): string => (a < b ? `${a}\u0000${b}` : `${b}\u0000${a}`);

/**
 * Build the validity policy from a validated dataset and (optionally) a review
 * validation result. Only `current` records of a usable file establish
 * invalidity; stale and invalid records are ignored.
 */
export function createValidityPolicy(collection: SubjectCollection, review?: ReviewValidationResult): ClinicalValidityPolicy {
  const index = indexDataset(collection);
  const coverage = new Map<string, string[]>();
  /** subjectId -> normalized alternative text -> review id. */
  const alternativeCoverage = new Map<string, Map<string, string>>();
  if (review !== undefined && review.fileUsable) {
    for (const record of review.records) {
      if (record.state !== 'current' || record.id === undefined) continue;
      for (let i = 0; i < record.topicIds.length; i += 1) {
        for (let j = i + 1; j < record.topicIds.length; j += 1) {
          const key = pairKey(record.topicIds[i] as string, record.topicIds[j] as string);
          const list = coverage.get(key) ?? [];
          list.push(record.id);
          coverage.set(key, list);
        }
      }
    }
    for (const record of review.alternativeRecords) {
      if (record.state !== 'current' || record.id === undefined || record.subjectId === undefined) continue;
      const disease = index.diseaseById.get(record.subjectId);
      if (disease === undefined) continue;
      const map = alternativeCoverage.get(record.subjectId) ?? new Map<string, string>();
      for (const altId of record.alternativeIds) {
        const entry = disease.alternativesById.get(altId);
        if (entry === undefined) continue;
        const key = normalizeDisplayText(entry.text);
        if (!map.has(key)) map.set(key, record.id);
      }
      alternativeCoverage.set(record.subjectId, map);
    }
  }
  const reviewsCovering = (a: string, b: string): readonly string[] => (a === b ? [] : (coverage.get(pairKey(a, b)) ?? []));
  const alternativeReviewCovering = (subjectId: string, alternativeText: string): string | undefined =>
    alternativeCoverage.get(subjectId)?.get(normalizeDisplayText(alternativeText));

  const factRelation = (cardText: string, challengeTopicId: string): RelationResult => {
    const target = index.topics.get(challengeTopicId);
    if (target === undefined) return { relation: 'unknown', basis: 'unknownTopic' };
    const key = normalizeDisplayText(cardText);
    if (target.correctKeys.has(key)) return { relation: 'valid', basis: 'listedCorrect' };
    if (target.incorrectKeys.has(key)) return { relation: 'invalid', basis: 'listedIncorrect' };
    let inDataset = false;
    for (const topicId of index.topicOrder) {
      const source = index.topics.get(topicId) as TopicInfo;
      if (source.incorrectKeys.has(key)) inDataset = true;
      if (topicId === challengeTopicId || !source.correctKeys.has(key)) continue;
      inDataset = true;
      // A review covers the CORRECT facts of each listed topic against the others.
      const covering = reviewsCovering(topicId, challengeTopicId);
      if (covering.length > 0) return { relation: 'invalid', basis: 'reviewed', reviewId: covering[0] as string };
    }
    return { relation: 'unknown', basis: inDataset ? 'notCoveredByReview' : 'notInDataset' };
  };

  const nameRelation = (cardName: string, challengeTopicId: string, challengeFactText: string): RelationResult => {
    const target = index.topics.get(challengeTopicId);
    if (target === undefined) return { relation: 'unknown', basis: 'unknownTopic' };
    const factKey = normalizeDisplayText(challengeFactText);
    if (!target.correctKeys.has(factKey)) return { relation: 'unknown', basis: 'notAChallengeFact' };
    const nameKey = normalizeDisplayText(cardName);
    if (nameKey === normalizeDisplayText(target.disease.subject)) return { relation: 'valid', basis: 'sameDisease' };

    const other = index.diseaseByName.get(nameKey);
    const otherTopic =
      other === undefined || target.category === undefined ? undefined : index.diseases.get(other)?.byCategory.get(target.category);
    if (otherTopic !== undefined && otherTopic.correctKeys.has(factKey)) return { relation: 'valid', basis: 'sharedFact' };
    if (otherTopic !== undefined && otherTopic.incorrectKeys.has(factKey)) return { relation: 'invalid', basis: 'listedIncorrect' };
    // Q-1: an alternative diagnosis counts as wrong only with a current review of it
    // against the challenge disease's correct facts.
    const altReview = alternativeReviewCovering(target.disease.id, cardName);
    if (altReview !== undefined) return { relation: 'invalid', basis: 'reviewedAlternative', reviewId: altReview };
    if (otherTopic !== undefined) {
      const covering = reviewsCovering(challengeTopicId, otherTopic.topic.id);
      if (covering.length > 0) return { relation: 'invalid', basis: 'reviewed', reviewId: covering[0] as string };
      return { relation: 'unknown', basis: 'notCoveredByReview' };
    }
    if (other !== undefined) return { relation: 'unknown', basis: 'notCoveredByReview' };
    let isAlternativeSomewhere = false;
    for (const info of index.diseases.values()) if (info.alternativeKeys.has(nameKey)) isAlternativeSomewhere = true;
    return { relation: 'unknown', basis: isAlternativeSomewhere ? 'notCoveredByReview' : 'notInDataset' };
  };

  const factValidityMatrix = (challengeTopicIds: readonly string[], cards: readonly FactCard[]): FactValidityMatrix => {
    const unknownPairs: { cardId: string; challengeTopicId: string }[] = [];
    const usableCardIds: string[] = [];
    const rows = new Map<string, Record<string, boolean>>(challengeTopicIds.map((id) => [id, {}]));
    const relations = new Map<string, boolean>();
    for (const card of cards) {
      let usable = true;
      for (const challengeTopicId of challengeTopicIds) {
        const { relation } = factRelation(card.text, challengeTopicId);
        if (relation === 'unknown') {
          usable = false;
          unknownPairs.push({ cardId: card.id, challengeTopicId });
        } else {
          relations.set(pairKey(card.id, challengeTopicId), relation === 'valid');
        }
      }
      if (usable) usableCardIds.push(card.id);
    }
    for (const challengeTopicId of challengeTopicIds) {
      const row = rows.get(challengeTopicId) as Record<string, boolean>;
      for (const cardId of usableCardIds) row[cardId] = relations.get(pairKey(cardId, challengeTopicId)) as boolean;
    }
    return { contextualValidity: Object.fromEntries(rows), usableCardIds, unknownPairs };
  };

  return Object.freeze({ factRelation, nameRelation, reviewsCovering, alternativeReviewCovering, factValidityMatrix });
}

// ---------------------------------------------------------------------------
// Drafting records
// ---------------------------------------------------------------------------

export interface ReviewRecordDraft {
  readonly id: string;
  readonly reviewedBy: string;
  readonly reviewedOn: string;
  readonly statement: string;
  readonly topics: readonly ReviewTopicEntry[];
}

export interface AlternativeReviewDraft {
  readonly id: string;
  readonly reviewedBy: string;
  readonly reviewedOn: string;
  readonly statement: string;
  readonly subjectId: string;
  readonly alternativeIds: readonly string[];
  readonly fingerprint: string;
}

/**
 * A topic-group record ready to fill in, with the CURRENT fingerprints of the
 * given topics. `reviewedBy` and `reviewedOn` are placeholders the validator
 * rejects, so a draft establishes nothing until the reviewer has done the review
 * and filled them in. Unknown topic ids are returned separately and left out.
 */
export function draftReviewRecord(
  collection: SubjectCollection,
  id: string,
  topicIds: readonly string[],
): { readonly draft: ReviewRecordDraft; readonly unknownTopicIds: readonly string[] } {
  const index = indexDataset(collection);
  const topics: ReviewTopicEntry[] = [];
  const unknownTopicIds: string[] = [];
  for (const topicId of new Set(topicIds)) {
    const info = index.topics.get(topicId);
    if (info === undefined) unknownTopicIds.push(topicId);
    else topics.push({ topicId, fingerprint: info.fingerprint });
  }
  return {
    draft: { id, reviewedBy: REVIEW_PLACEHOLDER_REVIEWER, reviewedOn: REVIEW_PLACEHOLDER_DATE, statement: REVIEW_STATEMENT, topics },
    unknownTopicIds,
  };
}

/**
 * An alternative-diagnosis record ready to fill in (Q-1), covering the given
 * alternative ids of one disease (all of them when omitted), with the CURRENT
 * fingerprint. Returns `undefined` for an unknown disease. Unknown alternative ids
 * are returned separately and left out.
 */
export function draftAlternativeReview(
  collection: SubjectCollection,
  id: string,
  subjectId: string,
  alternativeIds?: readonly string[],
): { readonly draft: AlternativeReviewDraft; readonly unknownAlternativeIds: readonly string[] } | undefined {
  const disease = indexDataset(collection).diseaseById.get(subjectId);
  if (disease === undefined) return undefined;
  const wanted = alternativeIds ?? disease.disease.subjectIncorrects.map((entry) => entry.id);
  const covered: AnswerEntry[] = [];
  const ids: string[] = [];
  const unknownAlternativeIds: string[] = [];
  for (const altId of new Set(wanted)) {
    const entry = disease.alternativesById.get(altId);
    if (entry === undefined) unknownAlternativeIds.push(altId);
    else {
      covered.push(entry);
      ids.push(altId);
    }
  }
  return {
    draft: {
      id,
      reviewedBy: REVIEW_PLACEHOLDER_REVIEWER,
      reviewedOn: REVIEW_PLACEHOLDER_DATE,
      statement: ALTERNATIVE_REVIEW_STATEMENT,
      subjectId,
      alternativeIds: ids,
      fingerprint: alternativesFingerprint(disease.disease, covered),
    },
    unknownAlternativeIds,
  };
}

// ---------------------------------------------------------------------------
// Review report
// ---------------------------------------------------------------------------

export interface ReportTopicRef {
  readonly topicId: string;
  readonly label: string;
  readonly path: string;
}

export type PairKind = 'sameCategory' | 'sameDisease' | 'crossDiseaseCrossCategory';

type RecordCounts = { readonly current: number; readonly stale: number; readonly invalid: number };

export interface ReviewReport {
  readonly summary: {
    readonly diseases: number;
    readonly topics: number;
    readonly topicPairs: number;
    readonly reviewedPairs: number;
    readonly unreviewedPairs: number;
    readonly records: RecordCounts;
    readonly alternativeRecords: RecordCounts;
    /** Alternative diagnoses listed in the dataset, and how many a current review covers. */
    readonly alternatives: { readonly listed: number; readonly reviewed: number };
    /** False when the review file itself is unusable; then no record is used. */
    readonly reviewFileUsable: boolean;
  };
  /** Current fingerprint of every topic, for building or renewing records. */
  readonly fingerprints: readonly (ReportTopicRef & { readonly fingerprint: string })[];
  /** Current alternative-review fingerprint of each disease with alternatives (covering all of them). */
  readonly alternativeFingerprints: readonly { readonly subjectId: string; readonly disease: string; readonly fingerprint: string }[];
  readonly reviewIssues: readonly ReviewIssue[];
  readonly staleReviews: readonly (
    | {
        readonly kind: 'topics';
        readonly reviewId: string;
        readonly path: string;
        readonly changedTopics: readonly ReportTopicRef[];
        /** The same record with current fingerprints, to use after re-review. */
        readonly renewalDraft: ReviewRecordDraft;
      }
    | {
        readonly kind: 'alternatives';
        readonly reviewId: string;
        readonly path: string;
        readonly subjectId: string;
        readonly disease: string;
        readonly renewalDraft: AlternativeReviewDraft;
      }
  )[];
  /** The same correct-fact text listed in more than one topic. */
  readonly sharedFacts: readonly { readonly text: string; readonly topics: readonly ReportTopicRef[] }[];
  /** Texts identical apart from punctuation, case or spacing, in different entries. */
  readonly nearIdenticalTexts: readonly { readonly texts: readonly { readonly text: string; readonly path: string }[] }[];
  /** An alternative diagnosis that is a dataset disease sharing a correct fact in the same category. */
  readonly alternativeConflicts: readonly {
    readonly path: string;
    readonly alternative: string;
    readonly disease: string;
    readonly sharedFactText: string;
    readonly topics: readonly ReportTopicRef[];
  }[];
  /** Topic pairs with no current review, grouped by kind. */
  readonly unreviewedPairs: readonly { readonly kind: PairKind; readonly a: ReportTopicRef; readonly b: ReportTopicRef }[];
  /** Alternative diagnoses not covered by a current alternative review (unknown in fact -> disease). */
  readonly unreviewedAlternatives: readonly { readonly subjectId: string; readonly disease: string; readonly alternative: string; readonly path: string }[];
  /** How many cards each challenge could use as distractors with the current review coverage. */
  readonly coverage: {
    readonly topics: readonly (ReportTopicRef & { readonly usableFactDistractors: number; readonly unknownFacts: number })[];
    readonly diseases: readonly {
      readonly subjectId: string;
      readonly disease: string;
      /** The fewest usable disease-name distractors over this disease's challenge facts. */
      readonly minUsableNames: number;
      /** Names that are unknown for at least one of this disease's challenge facts. */
      readonly namesUnknownForSomeFact: number;
    }[];
  };
}

export type ReviewReportResult =
  | { readonly ok: true; readonly report: ReviewReport }
  | { readonly ok: false; readonly stage: 'dataset'; readonly issues: readonly (ValidationIssue | ClinicalContentIssue)[] };

const ref = (info: TopicInfo): ReportTopicRef => ({ topicId: info.topic.id, label: info.label, path: info.path });
const looseKey = (text: string): string => normalizeDisplayText(text).replace(/[^\p{L}\p{N}]+/gu, '');
const countStates = (records: readonly { readonly state: RecordState }[]): RecordCounts => ({
  current: records.filter((r) => r.state === 'current').length,
  stale: records.filter((r) => r.state === 'stale').length,
  invalid: records.filter((r) => r.state === 'invalid').length,
});

/**
 * Build the review report from UNTRUSTED dataset and review values. The report
 * lists data relationships only; it never decides whether a fact is clinically
 * true. With no review file, every unlisted relationship is reported as unreviewed.
 */
export function buildReviewReport(datasetValue: unknown, reviewValue?: unknown): ReviewReportResult {
  const dataset = validateClinicalCollection(datasetValue);
  if (!dataset.ok) return { ok: false, stage: 'dataset', issues: dataset.issues };
  const collection = dataset.collection;
  const index = indexDataset(collection);
  const review: ReviewValidationResult = reviewValue === undefined ? NO_REVIEWS : validateReviewFile(reviewValue, collection);
  const policy = createValidityPolicy(collection, review);
  const infos = index.topicOrder.map((id) => index.topics.get(id) as TopicInfo);

  // Stale records with renewal drafts.
  const staleReviews: ReviewReport['staleReviews'][number][] = [];
  for (const record of review.records) {
    if (record.state !== 'stale' || record.id === undefined) continue;
    staleReviews.push({
      kind: 'topics',
      reviewId: record.id,
      path: record.path,
      changedTopics: record.staleTopicIds.map((id) => ref(index.topics.get(id) as TopicInfo)),
      renewalDraft: draftReviewRecord(collection, record.id, record.topicIds).draft,
    });
  }
  for (const record of review.alternativeRecords) {
    if (record.state !== 'stale' || record.id === undefined || record.subjectId === undefined) continue;
    const drafted = draftAlternativeReview(collection, record.id, record.subjectId, record.alternativeIds);
    if (drafted === undefined) continue;
    staleReviews.push({
      kind: 'alternatives',
      reviewId: record.id,
      path: record.path,
      subjectId: record.subjectId,
      disease: (index.diseaseById.get(record.subjectId) as DiseaseInfo).disease.subject,
      renewalDraft: drafted.draft,
    });
  }

  // Shared correct facts.
  const byFact = new Map<string, { text: string; topics: ReportTopicRef[] }>();
  for (const info of infos) {
    for (const entry of info.topic.corrects) {
      const key = normalizeDisplayText(entry.text);
      const group = byFact.get(key) ?? { text: entry.text.trim(), topics: [] };
      if (!group.topics.some((t) => t.topicId === info.topic.id)) group.topics.push(ref(info));
      byFact.set(key, group);
    }
  }
  const sharedFacts = [...byFact.values()].filter((group) => group.topics.length > 1);

  // Near-identical wording across all card texts.
  const allTexts: { text: string; path: string }[] = [];
  collection.subjects.forEach((disease, d) => {
    allTexts.push({ text: disease.subject, path: `subjects[${d}].subject` });
    disease.subjectIncorrects.forEach((e, a) => allTexts.push({ text: e.text, path: `subjects[${d}].subjectIncorrects[${a}].text` }));
    disease.topics.forEach((topic, t) => {
      topic.corrects.forEach((e, c) => allTexts.push({ text: e.text, path: `subjects[${d}].topics[${t}].corrects[${c}].text` }));
      topic.incorrects.forEach((e, i) => allTexts.push({ text: e.text, path: `subjects[${d}].topics[${t}].incorrects[${i}].text` }));
    });
  });
  const byLoose = new Map<string, { text: string; path: string }[]>();
  for (const item of allTexts) {
    const key = looseKey(item.text);
    if (key.length === 0) continue;
    byLoose.set(key, [...(byLoose.get(key) ?? []), item]);
  }
  const nearIdenticalTexts = [...byLoose.values()]
    .filter((items) => new Set(items.map((item) => normalizeDisplayText(item.text))).size > 1)
    .map((texts) => ({ texts }));

  // Alternative diagnoses that are dataset diseases sharing a same-category fact.
  const alternativeConflicts: ReviewReport['alternativeConflicts'][number][] = [];
  const unreviewedAlternatives: ReviewReport['unreviewedAlternatives'][number][] = [];
  let alternativesListed = 0;
  collection.subjects.forEach((disease, d) => {
    const mine = index.diseases.get(disease) as DiseaseInfo;
    disease.subjectIncorrects.forEach((alternative, a) => {
      const path = `subjects[${d}].subjectIncorrects[${a}].text`;
      alternativesListed += 1;
      if (policy.alternativeReviewCovering(disease.id, alternative.text) === undefined) {
        unreviewedAlternatives.push({ subjectId: disease.id, disease: disease.subject, alternative: alternative.text, path });
      }
      const other = index.diseaseByName.get(normalizeDisplayText(alternative.text));
      if (other === undefined) return;
      const theirs = (index.diseases.get(other) as DiseaseInfo).byCategory;
      for (const [category, info] of mine.byCategory) {
        const otherInfo = theirs.get(category);
        if (otherInfo === undefined) continue;
        for (const entry of info.topic.corrects) {
          if (otherInfo.correctKeys.has(normalizeDisplayText(entry.text))) {
            alternativeConflicts.push({ path, alternative: alternative.text, disease: disease.subject, sharedFactText: entry.text, topics: [ref(info), ref(otherInfo)] });
          }
        }
      }
    });
  });

  // Topic pairs without a current review.
  const unreviewedPairs: ReviewReport['unreviewedPairs'][number][] = [];
  let reviewedPairs = 0;
  for (let i = 0; i < infos.length; i += 1) {
    for (let j = i + 1; j < infos.length; j += 1) {
      const a = infos[i] as TopicInfo;
      const b = infos[j] as TopicInfo;
      if (policy.reviewsCovering(a.topic.id, b.topic.id).length > 0) {
        reviewedPairs += 1;
        continue;
      }
      const kind: PairKind = a.disease === b.disease ? 'sameDisease' : a.category === b.category ? 'sameCategory' : 'crossDiseaseCrossCategory';
      unreviewedPairs.push({ kind, a: ref(a), b: ref(b) });
    }
  }
  const kindOrder: Record<PairKind, number> = { sameCategory: 0, sameDisease: 1, crossDiseaseCrossCategory: 2 };
  unreviewedPairs.sort((x, y) => kindOrder[x.kind] - kindOrder[y.kind]);

  // Coverage: usable distractors per challenge.
  const factUniverse = new Map<string, string>();
  for (const item of allTexts.filter((t) => /\.(corrects|incorrects)\[/.test(t.path))) {
    const key = normalizeDisplayText(item.text);
    if (!factUniverse.has(key)) factUniverse.set(key, item.text);
  }
  const topicCoverage = infos.map((info) => {
    let usable = 0;
    let unknown = 0;
    for (const [key, text] of factUniverse) {
      if (info.correctKeys.has(key)) continue;
      const { relation } = policy.factRelation(text, info.topic.id);
      if (relation === 'invalid') usable += 1;
      else if (relation === 'unknown') unknown += 1;
    }
    return { ...ref(info), usableFactDistractors: usable, unknownFacts: unknown };
  });
  const nameUniverse = new Map<string, string>();
  for (const disease of collection.subjects) {
    for (const text of [disease.subject, ...disease.subjectIncorrects.map((e) => e.text)]) {
      const key = normalizeDisplayText(text);
      if (!nameUniverse.has(key)) nameUniverse.set(key, text);
    }
  }
  const diseaseCoverage = collection.subjects.map((disease) => {
    let minUsable = Number.POSITIVE_INFINITY;
    const unknownNames = new Set<string>();
    for (const topic of disease.topics) {
      for (const fact of topic.corrects) {
        let usable = 0;
        for (const [key, name] of nameUniverse) {
          const { relation } = policy.nameRelation(name, topic.id, fact.text);
          if (relation === 'invalid') usable += 1;
          else if (relation === 'unknown') unknownNames.add(key);
        }
        minUsable = Math.min(minUsable, usable);
      }
    }
    return {
      subjectId: disease.id,
      disease: disease.subject,
      minUsableNames: Number.isFinite(minUsable) ? minUsable : 0,
      namesUnknownForSomeFact: unknownNames.size,
    };
  });

  const totalPairs = (infos.length * (infos.length - 1)) / 2;
  return {
    ok: true,
    report: {
      summary: {
        diseases: collection.subjects.length,
        topics: infos.length,
        topicPairs: totalPairs,
        reviewedPairs,
        unreviewedPairs: totalPairs - reviewedPairs,
        records: countStates(review.records),
        alternativeRecords: countStates(review.alternativeRecords),
        alternatives: { listed: alternativesListed, reviewed: alternativesListed - unreviewedAlternatives.length },
        reviewFileUsable: review.fileUsable,
      },
      fingerprints: infos.map((info) => ({ ...ref(info), fingerprint: info.fingerprint })),
      alternativeFingerprints: collection.subjects
        .filter((disease) => disease.subjectIncorrects.length > 0)
        .map((disease) => ({ subjectId: disease.id, disease: disease.subject, fingerprint: alternativesFingerprint(disease, disease.subjectIncorrects) })),
      reviewIssues: review.issues,
      staleReviews,
      sharedFacts,
      nearIdenticalTexts,
      alternativeConflicts,
      unreviewedPairs,
      unreviewedAlternatives,
      coverage: { topics: topicCoverage, diseases: diseaseCoverage },
    },
  };
}

/** Plain-text rendering of a report. Long lists are cut after `limit` items. */
export function formatReviewReport(report: ReviewReport, options: { readonly limit?: number } = {}): string {
  const limit = options.limit ?? 25;
  const lines: string[] = [];
  const list = <T>(items: readonly T[], render: (item: T) => string): void => {
    if (items.length === 0) {
      lines.push('  (none)');
      return;
    }
    items.slice(0, limit).forEach((item) => lines.push(`  - ${render(item)}`));
    if (items.length > limit) lines.push(`  ... and ${items.length - limit} more`);
  };
  const s = report.summary;
  lines.push('CLINICAL REVIEW REPORT');
  lines.push('This report lists data relationships only. It makes no clinical judgments.');
  lines.push('');
  lines.push(`Diseases: ${s.diseases}. Topics: ${s.topics}. Topic pairs: ${s.topicPairs} (reviewed ${s.reviewedPairs}, unreviewed ${s.unreviewedPairs}).`);
  lines.push(`Topic-group reviews: ${s.records.current} current, ${s.records.stale} stale, ${s.records.invalid} invalid.`);
  lines.push(`Alternative-diagnosis reviews: ${s.alternativeRecords.current} current, ${s.alternativeRecords.stale} stale, ${s.alternativeRecords.invalid} invalid. Alternatives covered: ${s.alternatives.reviewed} of ${s.alternatives.listed}.`);
  if (!s.reviewFileUsable) lines.push('The review file has file-level problems, so NO review record is used (see section 1).');
  lines.push('');
  lines.push('1. Review file problems (records with problems are not used)');
  list(report.reviewIssues, (i) => `[${i.code}] ${i.path}: ${i.message}`);
  lines.push('');
  lines.push('2. Stale reviews (content changed after review; not used until renewed)');
  list(report.staleReviews, (r) =>
    r.kind === 'topics'
      ? `${r.reviewId} (${r.path}): changed ${r.changedTopics.map((t) => `"${t.label}"`).join(', ')}. After re-review, replace the record with: ${JSON.stringify(r.renewalDraft)}`
      : `${r.reviewId} (${r.path}): the facts of "${r.disease}" or its listed alternatives changed. After re-review, replace the record with: ${JSON.stringify(r.renewalDraft)}`,
  );
  lines.push('');
  lines.push('3. Shared facts (the same text is a correct fact in several topics)');
  list(report.sharedFacts, (f) => `"${f.text}" in ${f.topics.map((t) => `"${t.label}"`).join(', ')}`);
  lines.push('');
  lines.push('4. Potentially ambiguous relationships');
  lines.push(' 4a. Near-identical wording');
  list(report.nearIdenticalTexts, (g) => g.texts.map((t) => `"${t.text}" (${t.path})`).join(' ~ '));
  lines.push(' 4b. Alternative diagnoses that share a same-category fact with the disease');
  list(report.alternativeConflicts, (c) => `${c.path}: "${c.alternative}" is listed as an alternative to "${c.disease}", but both list "${c.sharedFactText}"`);
  lines.push('');
  lines.push('5. Unreviewed relationships (they stay unknown until reviewed)');
  for (const kind of ['sameCategory', 'sameDisease', 'crossDiseaseCrossCategory'] as const) {
    const title = { sameCategory: 'Same category, different diseases', sameDisease: 'Same disease, different categories', crossDiseaseCrossCategory: 'Different diseases and categories' }[kind];
    const pairs = report.unreviewedPairs.filter((p) => p.kind === kind);
    lines.push(` ${title}: ${pairs.length}`);
    list(pairs, (p) => `"${p.a.label}" <-> "${p.b.label}"`);
  }
  lines.push(` Alternative diagnoses without a current review: ${report.unreviewedAlternatives.length}`);
  list(report.unreviewedAlternatives, (a) => `"${a.alternative}" for "${a.disease}" (${a.path})`);
  lines.push('');
  lines.push('6. Review coverage that may restrict deck generation (fewest usable distractors first)');
  lines.push(' 6a. Disease + category challenges: usable fact distractors / unknown facts');
  list([...report.coverage.topics].sort((a, b) => a.usableFactDistractors - b.usableFactDistractors), (t) => `"${t.label}": ${t.usableFactDistractors} usable, ${t.unknownFacts} unknown`);
  lines.push(' 6b. Fact -> disease challenges: fewest usable disease-name distractors');
  list([...report.coverage.diseases].sort((a, b) => a.minUsableNames - b.minUsableNames), (d) => `"${d.disease}": at least ${d.minUsableNames} usable, ${d.namesUnknownForSomeFact} unknown for some fact`);
  lines.push('');
  lines.push('7. Current fingerprints (copy into review records; never type them by hand)');
  lines.push(' 7a. Topics');
  list(report.fingerprints, (f) => `${f.topicId}  ${f.fingerprint}  ("${f.label}")`);
  lines.push(' 7b. Alternative-diagnosis reviews (covering ALL listed alternatives of the disease)');
  list(report.alternativeFingerprints, (f) => `${f.subjectId}  ${f.fingerprint}  ("${f.disease}")`);
  return lines.join('\n');
}
