/**
 * Structural and identifier validation (Milestone M2, Task 6).
 *
 * Implements validation pipeline stages 1-2 (design) with the D7 structured
 * error model:
 *   Stage 1 - structural validation: shape, required fields, value types, and
 *             `schemaVersion` (semantic-version) compatibility. Suitable for
 *             UNTRUSTED imported JSON (input typed as `unknown`).
 *   Stage 2 - identifier validation, using the Task 2 id convention
 *             `<namespace>.<kind>.<slug...>`:
 *               - every id conforms to the convention (shape/resolvability),
 *               - every id has the expected KIND for its position
 *                 (subject / topic / answer),
 *               - every topic and answer id shares the NAMESPACE of the subject
 *                 that owns it, and
 *               - every id is globally unique within the collection.
 *             Each issue carries the actual JSON path where it occurs.
 *
 * Scope (Task 6 only). This module does NOT implement later pipeline stages:
 * challenge mapping, ambiguity elimination, global display-value uniqueness,
 * starting-hand feasibility, or deck-size/exhaustion (Tasks 7-13). It also
 * implements no generation algorithm, gameplay, Beepy AI, or UI.
 *
 * Errors are returned as structured, actionable issues (code, message, path)
 * rather than thrown opaque errors (design D7; master spec section 12).
 *
 * Interpretation note: the approved design (D2) requires subject-qualified
 * prefixes that prevent Math/Clinical collisions. Requiring nested topic and
 * answer ids to share their owning subject's namespace is the reading of that
 * rule enforced here. Slug-level hierarchy (e.g. a topic slug starting with its
 * subject's slug) appears only in illustrative examples and is NOT enforced.
 *
 * References:
 * - .kiro/specs/educational-data-schema/requirements.md (Req 1.5, 6.5)
 * - .kiro/specs/educational-data-schema/design.md (pipeline stages 1-2, D2, D7)
 * - .kiro/steering/educational-data-independence.md
 *
 * Subject-neutral; no DOM/UI/framework dependency.
 */

import type { SubjectCollection } from './source-data.js';
import {
  ID_KINDS,
  isValidId,
  parseId,
  type IdKind,
  type SubjectNamespace,
} from './identifiers.js';

/** Stable issue codes for structural + identifier validation (design D7). */
export const VALIDATION_CODES = {
  /** A value had the wrong JavaScript type or was missing where required. */
  invalidType: 'INVALID_TYPE',
  /** A required field was absent. */
  missingField: 'MISSING_FIELD',
  /** `schemaVersion` was missing, malformed, or an unsupported version. */
  schemaVersionUnsupported: 'SCHEMA_VERSION_UNSUPPORTED',
  /** An identifier did not conform to the id convention (Task 2). */
  malformedIdentifier: 'MALFORMED_IDENTIFIER',
  /** An identifier had the wrong kind for its position (e.g. a topic id on an answer). */
  wrongIdentifierKind: 'WRONG_IDENTIFIER_KIND',
  /** A nested id's namespace differs from its owning subject's namespace. */
  namespaceMismatch: 'NAMESPACE_MISMATCH',
  /** An identifier was not globally unique within the collection. */
  duplicateIdentifier: 'DUPLICATE_IDENTIFIER',
} as const;

export type ValidationCode =
  (typeof VALIDATION_CODES)[keyof typeof VALIDATION_CODES];

/**
 * A single structured, actionable validation issue (design D7).
 * `path` is the dotted/indexed JSON location of the offending value, e.g.
 * `subjects[2].topics[0].corrects[1].id`.
 */
export interface ValidationIssue {
  readonly code: ValidationCode;
  readonly message: string;
  readonly path: string;
}

/** The result of a validation pass. `ok` is true iff `issues` is empty. */
export interface ValidationResult {
  readonly ok: boolean;
  readonly issues: readonly ValidationIssue[];
}

/** Schema versions this build understands (stage 1). */
export const SUPPORTED_SCHEMA_VERSIONS: readonly string[] = ['1.0.0'];

const SEMVER_PATTERN = /^\d+\.\d+\.\d+$/;

function issue(
  code: ValidationCode,
  message: string,
  path: string,
): ValidationIssue {
  return { code, message, path };
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Validate that an UNTRUSTED value is a structurally well-formed
 * `SubjectCollection` (stage 1): correct shape, required fields present with
 * correct types, and a supported semantic-version `schemaVersion`.
 *
 * Collects ALL issues rather than stopping at the first, so an importer can
 * surface a complete, actionable report. Does not check identifiers (see
 * `validateIdentifiers`).
 */
export function validateStructure(value: unknown): ValidationResult {
  const issues: ValidationIssue[] = [];

  if (!isObject(value)) {
    issues.push(
      issue(
        VALIDATION_CODES.invalidType,
        'Collection must be a JSON object with "schemaVersion" and "subjects".',
        '$',
      ),
    );
    return { ok: false, issues };
  }

  // schemaVersion
  const schemaVersion = value['schemaVersion'];
  if (schemaVersion === undefined) {
    issues.push(
      issue(VALIDATION_CODES.missingField, 'Missing "schemaVersion".', 'schemaVersion'),
    );
  } else if (typeof schemaVersion !== 'string') {
    issues.push(
      issue(
        VALIDATION_CODES.invalidType,
        '"schemaVersion" must be a string.',
        'schemaVersion',
      ),
    );
  } else if (!SEMVER_PATTERN.test(schemaVersion)) {
    issues.push(
      issue(
        VALIDATION_CODES.schemaVersionUnsupported,
        `"schemaVersion" must be semantic versioning (e.g. "1.0.0"); got "${schemaVersion}".`,
        'schemaVersion',
      ),
    );
  } else if (!SUPPORTED_SCHEMA_VERSIONS.includes(schemaVersion)) {
    issues.push(
      issue(
        VALIDATION_CODES.schemaVersionUnsupported,
        `Unsupported schemaVersion "${schemaVersion}". Supported: ${SUPPORTED_SCHEMA_VERSIONS.join(', ')}.`,
        'schemaVersion',
      ),
    );
  }

  // subjects
  const subjects = value['subjects'];
  if (subjects === undefined) {
    issues.push(issue(VALIDATION_CODES.missingField, 'Missing "subjects".', 'subjects'));
  } else if (!Array.isArray(subjects)) {
    issues.push(
      issue(VALIDATION_CODES.invalidType, '"subjects" must be an array.', 'subjects'),
    );
  } else {
    subjects.forEach((subject, i) => {
      validateSubjectShape(subject, `subjects[${i}]`, issues);
    });
  }

  return { ok: issues.length === 0, issues };
}

function validateAnswerEntryShape(
  value: unknown,
  path: string,
  issues: ValidationIssue[],
): void {
  if (!isObject(value)) {
    issues.push(issue(VALIDATION_CODES.invalidType, 'Answer entry must be an object.', path));
    return;
  }
  requireString(value['id'], `${path}.id`, issues);
  requireString(value['text'], `${path}.text`, issues);
  // explanation is optional; if present it must be a string.
  if (value['explanation'] !== undefined && typeof value['explanation'] !== 'string') {
    issues.push(
      issue(VALIDATION_CODES.invalidType, 'Optional "explanation" must be a string.', `${path}.explanation`),
    );
  }
}

function validateTopicShape(
  value: unknown,
  path: string,
  issues: ValidationIssue[],
): void {
  if (!isObject(value)) {
    issues.push(issue(VALIDATION_CODES.invalidType, 'Topic must be an object.', path));
    return;
  }
  requireString(value['id'], `${path}.id`, issues);
  requireString(value['topicName'], `${path}.topicName`, issues);
  requireArrayOf(value['corrects'], `${path}.corrects`, issues, validateAnswerEntryShape);
  requireArrayOf(value['incorrects'], `${path}.incorrects`, issues, validateAnswerEntryShape);
}

function validateSubjectShape(
  value: unknown,
  path: string,
  issues: ValidationIssue[],
): void {
  if (!isObject(value)) {
    issues.push(issue(VALIDATION_CODES.invalidType, 'Subject must be an object.', path));
    return;
  }
  requireString(value['id'], `${path}.id`, issues);
  requireString(value['subject'], `${path}.subject`, issues);
  requireArrayOf(
    value['subjectIncorrects'],
    `${path}.subjectIncorrects`,
    issues,
    validateAnswerEntryShape,
  );
  requireArrayOf(value['topics'], `${path}.topics`, issues, validateTopicShape);
}

function requireString(value: unknown, path: string, issues: ValidationIssue[]): void {
  if (value === undefined) {
    issues.push(issue(VALIDATION_CODES.missingField, `Missing "${path}".`, path));
  } else if (typeof value !== 'string') {
    issues.push(issue(VALIDATION_CODES.invalidType, `"${path}" must be a string.`, path));
  }
}

function requireArrayOf(
  value: unknown,
  path: string,
  issues: ValidationIssue[],
  itemValidator: (item: unknown, itemPath: string, issues: ValidationIssue[]) => void,
): void {
  if (value === undefined) {
    issues.push(issue(VALIDATION_CODES.missingField, `Missing "${path}".`, path));
    return;
  }
  if (!Array.isArray(value)) {
    issues.push(issue(VALIDATION_CODES.invalidType, `"${path}" must be an array.`, path));
    return;
  }
  value.forEach((item, i) => itemValidator(item, `${path}[${i}]`, issues));
}

/** One identifier occurrence in document order, with its position context. */
interface IdOccurrence {
  readonly id: string;
  /** JSON path of the `id` field, e.g. `subjects[0].topics[1].id`. */
  readonly path: string;
  /** The kind this position requires (subject / topic / answer). */
  readonly expectedKind: IdKind;
  /**
   * The owning subject's namespace, or undefined for the subject id itself and
   * when the owning subject's own id is malformed (no namespace to compare to).
   */
  readonly ownerNamespace: SubjectNamespace | undefined;
}

/** Walk a collection and list every id occurrence with its position context. */
function listIdOccurrences(collection: SubjectCollection): IdOccurrence[] {
  const occurrences: IdOccurrence[] = [];

  collection.subjects.forEach((subject, si) => {
    const sPath = `subjects[${si}]`;
    const ownerNamespace = parseId(subject.id)?.namespace;

    occurrences.push({
      id: subject.id,
      path: `${sPath}.id`,
      expectedKind: ID_KINDS.subject,
      ownerNamespace: undefined,
    });

    subject.subjectIncorrects.forEach((entry, ai) => {
      occurrences.push({
        id: entry.id,
        path: `${sPath}.subjectIncorrects[${ai}].id`,
        expectedKind: ID_KINDS.answer,
        ownerNamespace,
      });
    });

    subject.topics.forEach((topic, ti) => {
      const tPath = `${sPath}.topics[${ti}]`;
      occurrences.push({
        id: topic.id,
        path: `${tPath}.id`,
        expectedKind: ID_KINDS.topic,
        ownerNamespace,
      });
      topic.corrects.forEach((entry, ai) => {
        occurrences.push({
          id: entry.id,
          path: `${tPath}.corrects[${ai}].id`,
          expectedKind: ID_KINDS.answer,
          ownerNamespace,
        });
      });
      topic.incorrects.forEach((entry, ai) => {
        occurrences.push({
          id: entry.id,
          path: `${tPath}.incorrects[${ai}].id`,
          expectedKind: ID_KINDS.answer,
          ownerNamespace,
        });
      });
    });
  });

  return occurrences;
}

/**
 * Validate identifiers in a structurally valid collection (stage 2). Reuses the
 * Task 2 id convention (`isValidId`, `parseId`). Checks, per occurrence:
 *   1. global uniqueness - every repeat of an id is reported at ITS OWN JSON
 *      path and names the path of the first definition;
 *   2. convention shape (malformed ids are reported and not checked further);
 *   3. expected kind for the position (subject / topic / answer);
 *   4. namespace consistency - nested topic/answer ids must share the owning
 *      subject's namespace.
 * Call AFTER `validateStructure` succeeds.
 */
export function validateIdentifiers(
  collection: SubjectCollection,
): ValidationResult {
  const issues: ValidationIssue[] = [];
  const firstSeenAt = new Map<string, string>();

  for (const occurrence of listIdOccurrences(collection)) {
    const { id, path, expectedKind, ownerNamespace } = occurrence;

    // 1. Uniqueness: report the repeat at its own path.
    const firstPath = firstSeenAt.get(id);
    if (firstPath === undefined) {
      firstSeenAt.set(id, path);
    } else {
      issues.push(
        issue(
          VALIDATION_CODES.duplicateIdentifier,
          `Identifier "${id}" is not unique; first defined at ${firstPath}. Every identifier must be globally unique.`,
          path,
        ),
      );
    }

    // 2. Convention shape.
    if (!isValidId(id)) {
      issues.push(
        issue(
          VALIDATION_CODES.malformedIdentifier,
          `Identifier "${id}" does not conform to the "<namespace>.<kind>.<slug...>" convention.`,
          path,
        ),
      );
      continue;
    }

    const parsed = parseId(id);
    if (parsed === undefined) {
      continue;
    }

    // 3. Kind for this position.
    if (parsed.kind !== expectedKind) {
      issues.push(
        issue(
          VALIDATION_CODES.wrongIdentifierKind,
          `Identifier "${id}" has kind "${parsed.kind}" but this position requires kind "${expectedKind}".`,
          path,
        ),
      );
    }

    // 4. Namespace consistency with the owning subject.
    if (ownerNamespace !== undefined && parsed.namespace !== ownerNamespace) {
      issues.push(
        issue(
          VALIDATION_CODES.namespaceMismatch,
          `Identifier "${id}" has namespace "${parsed.namespace}" but its owning subject uses namespace "${ownerNamespace}".`,
          path,
        ),
      );
    }
  }

  return { ok: issues.length === 0, issues };
}

/**
 * Convenience: run stage 1 then, only if the structure is valid, stage 2.
 * Returns the combined result. If the structure is invalid, identifier checks
 * are skipped (the value is not yet a trustworthy `SubjectCollection`).
 */
export function validateCollectionSource(value: unknown): ValidationResult {
  const structural = validateStructure(value);
  if (!structural.ok) {
    return structural;
  }
  // Safe: validateStructure guarantees the SubjectCollection shape.
  return validateIdentifiers(value as SubjectCollection);
}
