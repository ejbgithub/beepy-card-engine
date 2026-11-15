/**
 * Stable identifier namespace utilities (Milestone M2, Task 2).
 *
 * Implements Decision 1: every subject, topic, and answer-entry id is a
 * globally unique, stable, descriptive string with a SUBJECT-QUALIFIED PREFIX
 * that prevents collisions between Math Cards and Clinical Cards content.
 *
 * Scope (Task 2 only):
 * - Finalize and document the id prefix conventions.
 * - Provide utilities to build, parse, and validate the SHAPE of ids, and to
 *   detect duplicate ids across one or more imported collections.
 *
 * This module deliberately does NOT implement:
 * - the versioned collection wrapper / merge logic (Task 2a),
 * - the generated-deck contract (Task 3),
 * - the full structural/gameplay validation pipeline (Tasks 6-13).
 * It performs id-shape and duplicate-id checks only.
 *
 * References:
 * - .kiro/specs/educational-data-schema/requirements.md (Req 1.5)
 * - .kiro/specs/educational-data-schema/design.md (D2)
 * - .kiro/steering/educational-data-independence.md
 *
 * No subject-specific gameplay logic lives here; it is subject-neutral and has
 * no DOM/UI dependency.
 */

import type { SubjectCollection } from './source-data.js';

/**
 * Subject namespace tokens. These are the FINALIZED top-level prefixes that
 * segregate content by app/subject and prevent cross-subject id collisions.
 *
 * Extend this set only with a deliberate, documented decision; the engine
 * itself stays subject-neutral and treats the token purely as an opaque
 * namespace segment.
 */
export const SUBJECT_NAMESPACES = {
  math: 'math',
  clinical: 'clinical',
} as const;

export type SubjectNamespace =
  (typeof SUBJECT_NAMESPACES)[keyof typeof SUBJECT_NAMESPACES];

/**
 * Entity kinds that can own an identifier in the source schema.
 *
 * - `subject` -> a SubjectRecord
 * - `topic`   -> a Topic
 * - `answer`  -> an AnswerEntry (in corrects / incorrects / subjectIncorrects)
 */
export const ID_KINDS = {
  subject: 'subject',
  topic: 'topic',
  answer: 'answer',
} as const;

export type IdKind = (typeof ID_KINDS)[keyof typeof ID_KINDS];

/**
 * FINALIZED identifier prefix convention (Decision 1).
 *
 * Shape: `<namespace>.<kind>.<slug...>` where
 * - `<namespace>` is a SubjectNamespace token (e.g. `math`, `clinical`),
 * - `<kind>` is an IdKind (`subject` | `topic` | `answer`),
 * - `<slug...>` is one or more dot-separated descriptive, lowercase,
 *   hyphen-delimited segments that make the id human-readable and unique.
 *
 * Examples:
 * - `math.subject.7`
 * - `clinical.subject.graves-disease`
 * - `clinical.topic.graves-disease.workup`
 * - `clinical.answer.graves-disease.workup.positive-tsi`
 *
 * Separator is `.`; each slug segment matches `[a-z0-9]+(?:-[a-z0-9]+)*`.
 */
export const ID_SEPARATOR = '.';

/** A single slug segment: lowercase alphanumerics, hyphen-delimited. */
const SLUG_SEGMENT = '[a-z0-9]+(?:-[a-z0-9]+)*';

const NAMESPACE_ALTERNATION = Object.values(SUBJECT_NAMESPACES).join('|');
const KIND_ALTERNATION = Object.values(ID_KINDS).join('|');

/**
 * Full id pattern: `<namespace>.<kind>.<slug>(.<slug>)*`.
 * Anchored; the trailing group allows multi-segment descriptive slugs.
 */
const ID_PATTERN = new RegExp(
  `^(?:${NAMESPACE_ALTERNATION})\\.(?:${KIND_ALTERNATION})\\.${SLUG_SEGMENT}(?:\\.${SLUG_SEGMENT})*$`,
);

/** The parsed structure of a well-formed identifier. */
export interface ParsedId {
  readonly namespace: SubjectNamespace;
  readonly kind: IdKind;
  /** The descriptive slug segments after `<namespace>.<kind>.`. */
  readonly slug: readonly string[];
  /** The original, full id string. */
  readonly raw: string;
}

/**
 * Build a well-formed identifier from its parts.
 *
 * Throws a RangeError if any slug segment is not a valid lowercase,
 * hyphen-delimited token. This is a convenience/consistency helper for content
 * authoring and tests; it does not touch collections.
 */
export function buildId(
  namespace: SubjectNamespace,
  kind: IdKind,
  ...slug: readonly string[]
): string {
  if (slug.length === 0) {
    throw new RangeError('buildId requires at least one slug segment.');
  }
  const segmentPattern = new RegExp(`^${SLUG_SEGMENT}$`);
  for (const segment of slug) {
    if (!segmentPattern.test(segment)) {
      throw new RangeError(
        `Invalid id slug segment: "${segment}". Use lowercase alphanumerics and hyphens, e.g. "graves-disease".`,
      );
    }
  }
  return [namespace, kind, ...slug].join(ID_SEPARATOR);
}

/** Return true if `id` conforms to the finalized id pattern. */
export function isValidId(id: string): boolean {
  return ID_PATTERN.test(id);
}

/**
 * Parse a well-formed id into its structured parts, or return `undefined` if
 * the id does not conform to the finalized pattern.
 */
export function parseId(id: string): ParsedId | undefined {
  if (!isValidId(id)) {
    return undefined;
  }
  const parts = id.split(ID_SEPARATOR);
  // Pattern guarantees at least: [namespace, kind, slug0, ...].
  const [namespace, kind, ...slug] = parts as [
    SubjectNamespace,
    IdKind,
    ...string[],
  ];
  return { namespace, kind, slug, raw: id };
}

/**
 * Return true if `id` belongs to the given subject namespace. Non-conforming
 * ids return false.
 */
export function isInNamespace(id: string, namespace: SubjectNamespace): boolean {
  return parseId(id)?.namespace === namespace;
}

/**
 * A single discovered duplicate identifier.
 *
 * `count` is the total number of occurrences of `id` across all inspected
 * sources (always >= 2 for a reported duplicate).
 */
export interface DuplicateId {
  readonly id: string;
  readonly count: number;
}

/**
 * Collect every identifier declared within a single collection, in document
 * order, WITHOUT de-duplicating. Intra-collection repeats are preserved so the
 * caller can detect duplicates.
 *
 * Covers subject ids, `subjectIncorrects` entry ids, topic ids, and topic
 * `corrects` / `incorrects` entry ids.
 */
export function collectIds(collection: SubjectCollection): string[] {
  const ids: string[] = [];
  for (const subject of collection.subjects) {
    ids.push(subject.id);
    for (const alt of subject.subjectIncorrects) {
      ids.push(alt.id);
    }
    for (const topic of subject.topics) {
      ids.push(topic.id);
      for (const correct of topic.corrects) {
        ids.push(correct.id);
      }
      for (const incorrect of topic.incorrects) {
        ids.push(incorrect.id);
      }
    }
  }
  return ids;
}

/**
 * Detect duplicate identifiers across one or more imported collections
 * (Req 1.5, Decision 1). Uniqueness is evaluated GLOBALLY: the same id
 * appearing in two different collections is a duplicate, as is the same id
 * appearing twice within one collection.
 *
 * This is the Task 2 duplicate-detection utility only. It does NOT perform
 * structural validation, schema-version/merge compatibility (Task 2a), or any
 * gameplay validation (later tasks). It also does not assert id SHAPE; use
 * `findMalformedIds` for that.
 *
 * Returns duplicates sorted by id for stable, testable output.
 */
export function findDuplicateIds(
  ...collections: readonly SubjectCollection[]
): DuplicateId[] {
  const counts = new Map<string, number>();
  for (const collection of collections) {
    for (const id of collectIds(collection)) {
      counts.set(id, (counts.get(id) ?? 0) + 1);
    }
  }
  const duplicates: DuplicateId[] = [];
  for (const [id, count] of counts) {
    if (count > 1) {
      duplicates.push({ id, count });
    }
  }
  duplicates.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  return duplicates;
}

/**
 * Return every identifier across the given collections that does NOT conform to
 * the finalized id pattern (Decision 1). Useful for authoring-time checks and
 * tests. Order follows discovery order; the result may contain repeats if a
 * malformed id appears more than once.
 */
export function findMalformedIds(
  ...collections: readonly SubjectCollection[]
): string[] {
  const malformed: string[] = [];
  for (const collection of collections) {
    for (const id of collectIds(collection)) {
      if (!isValidId(id)) {
        malformed.push(id);
      }
    }
  }
  return malformed;
}
