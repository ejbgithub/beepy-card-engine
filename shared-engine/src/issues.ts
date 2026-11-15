/**
 * Shared structured error model (Milestone M2, Task 13; design D7).
 *
 * Every failure the shared engine reports - source-data import problems
 * (`ValidationIssue`), generated-deck problems (`DeckValidationIssue`), and deck
 * exhaustion (`PenaltyCardExhausted`) - has the same core shape: a stable `code`,
 * an actionable `message`, and the `path` of the offending value. This module
 * names that shared shape (`StructuredIssue`), proves at compile time that the
 * three families conform to it, and provides the helpers an importer or UI needs
 * to show problems in a uniform, readable way.
 *
 * It also adapts the Task 2a merge error (`CollectionMergeError`, thrown when
 * collections cannot be merged) into the same model, so a collection import can
 * report every kind of problem through one channel.
 *
 * Scope (Task 13 only). No new validation rules and no gameplay, generation, or
 * UI. Subject-neutral; no DOM/UI/framework dependency.
 *
 * References:
 * - .kiro/specs/educational-data-schema/requirements.md (Req 6.1, 6.5)
 * - .kiro/specs/educational-data-schema/design.md (D7)
 * - docs/master-spec-v1.1.md section 12
 */

import type { CollectionMergeError } from './collection.js';
import type { DeckValidationIssue } from './deck-issues.js';
import type { PenaltyCardExhausted } from './penalty-draw.js';
import type { ValidationIssue } from './validation.js';

/** The core shape shared by every structured problem report. */
export interface StructuredIssue {
  /** Stable machine-readable code. */
  readonly code: string;
  /** Actionable, human-readable explanation. */
  readonly message: string;
  /** Location of the offending value (a JSON-style path, or the affected collection). */
  readonly path: string;
}

/** Any issue the shared engine can report. */
export type AnyIssue = ValidationIssue | DeckValidationIssue | PenaltyCardExhausted;

type AssertConforms<_Issue extends StructuredIssue> = true;

/**
 * Compile-time proof that each issue family conforms to `StructuredIssue`. If one
 * stops conforming, the build fails here.
 */
export type IssueModelConformance = readonly [
  AssertConforms<ValidationIssue>,
  AssertConforms<DeckValidationIssue>,
  AssertConforms<PenaltyCardExhausted>,
];

/** True when `value` has a string `code`, `message`, and `path`. */
export function isStructuredIssue(value: unknown): value is StructuredIssue {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const candidate = value as { code?: unknown; message?: unknown; path?: unknown };
  return (
    typeof candidate.code === 'string' &&
    typeof candidate.message === 'string' &&
    typeof candidate.path === 'string'
  );
}

/** One readable line: `[CODE] path: message`. */
export function formatIssue(issue: StructuredIssue): string {
  return `[${issue.code}] ${issue.path}: ${issue.message}`;
}

/** A numbered, newline-separated report; an empty string when there are no issues. */
export function formatIssues(issues: readonly StructuredIssue[]): string {
  return issues.map((issue, index) => `${index + 1}. ${formatIssue(issue)}`).join('\n');
}

/**
 * Convert a `CollectionMergeError` into structured issues.
 *
 * - Schema version mismatch: one issue at `schemaVersion`.
 * - Duplicate identifiers: one issue per duplicated id, at `subjects` (the array
 *   holding the colliding records), naming the id and how many times it appears.
 *   A merge does not track where each copy came from, so exact per-occurrence paths
 *   come from `validateIdentifiers` on a single collection instead.
 */
export function issuesFromMergeError(error: CollectionMergeError): StructuredIssue[] {
  if (error.schemaVersions !== undefined) {
    return [{ code: error.code, message: error.message, path: 'schemaVersion' }];
  }
  if (error.duplicates !== undefined && error.duplicates.length > 0) {
    return error.duplicates.map((duplicate) => ({
      code: error.code,
      message: `Identifier "${duplicate.id}" appears ${duplicate.count} times across the collections being merged. Every identifier must be globally unique; records are never overwritten.`,
      path: 'subjects',
    }));
  }
  return [{ code: error.code, message: error.message, path: '$' }];
}
