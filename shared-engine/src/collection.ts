/**
 * Versioned collection wrapper and merge rules (Milestone M2, Task 2a).
 *
 * Implements Decision 2 / design D2a: both apps use the identical
 * `SubjectCollection` wrapper `{ schemaVersion, subjects }`. Multiple
 * collections may be merged ONLY when their `schemaVersion` values match
 * exactly AND all identifiers remain globally unique after the merge.
 * Incompatible versions and duplicate ids are rejected with clear, actionable
 * errors; records are NEVER silently overwritten.
 *
 * Scope (Task 2a only):
 * - the wrapper shape helpers, and
 * - safe merging of collections under the version + uniqueness rules.
 *
 * This module deliberately does NOT implement:
 * - the generated-deck contract (Task 3),
 * - the full structural / gameplay validation pipeline (Tasks 6-13),
 * - any generator, gameplay, or UI.
 * It reuses the Task 2 identifier utilities for duplicate detection.
 *
 * References:
 * - .kiro/specs/educational-data-schema/requirements.md (Req 1.4)
 * - .kiro/specs/educational-data-schema/design.md (D2a)
 * - .kiro/steering/educational-data-independence.md
 *
 * Subject-neutral; no DOM/UI dependency.
 */

import type { SubjectCollection, SubjectRecord } from './source-data.js';
import { findDuplicateIds, type DuplicateId } from './identifiers.js';

/** The schema version this build authors by default (semantic versioning). */
export const CURRENT_SCHEMA_VERSION = '1.0.0';

/**
 * Reasons a merge can fail. Carried on `CollectionMergeError.code` so callers
 * can branch on a stable value rather than parsing messages.
 */
export const MERGE_ERROR_CODES = {
  /** Two or more collections declared different `schemaVersion` values. */
  schemaVersionMismatch: 'SCHEMA_VERSION_MISMATCH',
  /** The same identifier appeared more than once across the collections. */
  duplicateIdentifier: 'DUPLICATE_IDENTIFIER',
} as const;

export type MergeErrorCode =
  (typeof MERGE_ERROR_CODES)[keyof typeof MERGE_ERROR_CODES];

/**
 * Structured, actionable merge error. Thrown by `mergeCollections` and
 * `assertMergeable`; callers that prefer a non-throwing API can use
 * `checkMergeable`.
 */
export class CollectionMergeError extends Error {
  readonly code: MergeErrorCode;
  /** Schema versions observed (for a version mismatch). */
  readonly schemaVersions?: readonly string[];
  /** Duplicate identifiers found (for a duplicate-id failure). */
  readonly duplicates?: readonly DuplicateId[];

  constructor(
    code: MergeErrorCode,
    message: string,
    details?: {
      schemaVersions?: readonly string[];
      duplicates?: readonly DuplicateId[];
    },
  ) {
    super(message);
    this.name = 'CollectionMergeError';
    this.code = code;
    if (details?.schemaVersions !== undefined) {
      this.schemaVersions = details.schemaVersions;
    }
    if (details?.duplicates !== undefined) {
      this.duplicates = details.duplicates;
    }
  }
}

/** Build a well-formed, empty collection at the current schema version. */
export function createCollection(
  subjects: readonly SubjectRecord[] = [],
  schemaVersion: string = CURRENT_SCHEMA_VERSION,
): SubjectCollection {
  return { schemaVersion, subjects };
}

/**
 * The outcome of a non-throwing mergeability check.
 * `ok: true` means the collections can be merged safely.
 */
export type MergeCheck =
  | { readonly ok: true }
  | {
      readonly ok: false;
      readonly code: MergeErrorCode;
      readonly message: string;
      readonly schemaVersions?: readonly string[];
      readonly duplicates?: readonly DuplicateId[];
    };

/**
 * Non-throwing check of whether the given collections can be merged.
 *
 * Fails (ok: false) when:
 * - the collections do not all share the exact same `schemaVersion`, or
 * - any identifier is not globally unique across all collections.
 *
 * A SINGLE collection is still checked for INTERNAL duplicate identifiers: with
 * one collection there are no versions to mismatch, so the check falls through
 * to global duplicate detection across that collection's own ids. Only the
 * zero-collection case short-circuits to `{ ok: true }`.
 */
export function checkMergeable(
  ...collections: readonly SubjectCollection[]
): MergeCheck {
  if (collections.length === 0) {
    return { ok: true };
  }

  const versions = collections.map((c) => c.schemaVersion);
  const firstVersion = versions[0] as string;
  const mismatch = versions.some((v) => v !== firstVersion);
  if (mismatch) {
    const distinct = [...new Set(versions)];
    return {
      ok: false,
      code: MERGE_ERROR_CODES.schemaVersionMismatch,
      message: `Cannot merge collections with differing schema versions: ${distinct
        .map((v) => `"${v}"`)
        .join(', ')}. All collections must declare the same schemaVersion.`,
      schemaVersions: distinct,
    };
  }

  const duplicates = findDuplicateIds(...collections);
  if (duplicates.length > 0) {
    const preview = duplicates.map((d) => `"${d.id}" (x${d.count})`).join(', ');
    return {
      ok: false,
      code: MERGE_ERROR_CODES.duplicateIdentifier,
      message: `Cannot merge collections: ${duplicates.length} duplicate identifier(s) found: ${preview}. Every identifier must be globally unique; records are never overwritten.`,
      duplicates,
    };
  }

  return { ok: true };
}

/**
 * Throwing variant of `checkMergeable`. Throws `CollectionMergeError` with a
 * structured code when the collections cannot be merged. A single collection is
 * checked for internal duplicate identifiers (see `checkMergeable`).
 */
export function assertMergeable(
  ...collections: readonly SubjectCollection[]
): void {
  const result = checkMergeable(...collections);
  if (!result.ok) {
    const details: {
      schemaVersions?: readonly string[];
      duplicates?: readonly DuplicateId[];
    } = {};
    if (result.schemaVersions !== undefined) {
      details.schemaVersions = result.schemaVersions;
    }
    if (result.duplicates !== undefined) {
      details.duplicates = result.duplicates;
    }
    throw new CollectionMergeError(result.code, result.message, details);
  }
}

/**
 * Merge one or more collections into one, preserving every subject record in
 * input order. Merging is permitted ONLY when all collections share the exact
 * same `schemaVersion` and all identifiers are globally unique; otherwise a
 * `CollectionMergeError` is thrown and nothing is merged. No record is ever
 * overwritten.
 *
 * A single collection is still validated for internal duplicate identifiers and
 * is rejected if any exist. Merging zero collections yields an empty collection
 * at the current schema version.
 */
export function mergeCollections(
  ...collections: readonly SubjectCollection[]
): SubjectCollection {
  if (collections.length === 0) {
    return createCollection();
  }

  assertMergeable(...collections);

  const schemaVersion = (collections[0] as SubjectCollection).schemaVersion;
  const subjects: SubjectRecord[] = [];
  for (const collection of collections) {
    for (const subject of collection.subjects) {
      subjects.push(subject);
    }
  }
  return { schemaVersion, subjects };
}
