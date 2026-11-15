/**
 * Common, subject-neutral educational source-data types.
 *
 * Milestone M2, Task 1. These types describe the authored JSON *source* format
 * shared by both demo apps (Math Cards and Clinical Cards). They are the
 * `subject -> topics -> corrects/incorrects` structure from the master
 * specification (docs/master-spec-v1.1.md, section 8).
 *
 * Scope note (Task 1 only): this module defines the SOURCE-DATA shapes only.
 * It deliberately does NOT define the generated-deck contract
 * (GeneratedChallenge / GeneratedAnswerCard / GeneratedDeck -> Task 3), the
 * validator (Tasks 6-13), or any generator (app workspaces). No runtime logic
 * is implemented here.
 *
 * Design references:
 * - .kiro/specs/educational-data-schema/requirements.md (Req 1)
 * - .kiro/specs/educational-data-schema/design.md (Layer 1, D1, D2, D2a, D5)
 * - .kiro/steering/educational-data-independence.md
 *
 * Decisions reflected:
 * - Decision 1: identifiers are globally unique, stable, descriptive strings
 *   with subject-qualified prefixes. The prefix convention is a content/authoring
 *   rule enforced by the validator in a later task; at the type level an id is a
 *   `string`.
 * - Decision 5: `explanation` is optional and contextual. It is never shown on a
 *   card face; the engine/UI decide display in later milestones. The source type
 *   only carries the optional text.
 */

/**
 * A single answer entry in the source library.
 *
 * Used for a topic's `corrects` and `incorrects`, and for a subject's
 * `subjectIncorrects`. Whether an entry is "correct" is a CONTEXTUAL
 * relationship defined by where it appears in the source data, not a universal
 * truth label (master spec section 8). The generator/validator resolve context
 * in later tasks.
 */
export interface AnswerEntry {
  /**
   * Globally unique, stable, descriptive identifier (Decision 1).
   * Example (illustrative): `clinical.answer.graves-disease.workup.positive-tsi`.
   */
  readonly id: string;

  /** Human-readable display text for this answer/card value. */
  readonly text: string;

  /**
   * Optional, contextual explanation (Decision 5). Omitted when absent.
   * Never rendered on the face of a card; never invented or substituted.
   */
  readonly explanation?: string;
}

/**
 * A topic within a subject.
 *
 * For clinical content a topic is a category such as "Work-up" or "Pathology";
 * for math a topic groups facts that produce the subject value. `corrects` and
 * `incorrects` are contextual to this topic.
 */
export interface Topic {
  /** Globally unique, stable, descriptive identifier (Decision 1). */
  readonly id: string;

  /** Display name of the topic, e.g. "Work-up". */
  readonly topicName: string;

  /** Answer entries that are contextually correct for this topic. */
  readonly corrects: readonly AnswerEntry[];

  /** Answer entries that are contextually incorrect for this topic. */
  readonly incorrects: readonly AnswerEntry[];
}

/**
 * A single-subject source record (master spec section 8).
 *
 * The same shape serves both apps: for Math the `subject` is a numeric answer
 * value (e.g. "7"); for Clinical it is a disease name (e.g. "Graves Disease").
 * No subject-specific fields are added here (Decision 4 / D1).
 */
export interface SubjectRecord {
  /** Globally unique, stable, descriptive identifier (Decision 1). */
  readonly id: string;

  /** Displayed subject value or name. */
  readonly subject: string;

  /**
   * Alternative (contextually incorrect) subjects, used as distractors when
   * the generation direction places the subject on the answer card.
   */
  readonly subjectIncorrects: readonly AnswerEntry[];

  /** Topics belonging to this subject. */
  readonly topics: readonly Topic[];
}

/**
 * Versioned collection wrapper (Decision 2 / D2a).
 *
 * Both applications use this identical wrapper and schema. `schemaVersion` uses
 * semantic versioning and gates merge compatibility: multiple collections may be
 * merged only when their `schemaVersion` values match and all identifiers remain
 * globally unique. Merge/version/duplicate-id enforcement is implemented by the
 * loader/validator in a later task; this type only declares the shape.
 */
export interface SubjectCollection {
  /** Semantic version string, e.g. "1.0.0". */
  readonly schemaVersion: string;

  /** The subject records carried by this collection. */
  readonly subjects: readonly SubjectRecord[];
}
