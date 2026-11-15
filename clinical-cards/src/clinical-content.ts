/**
 * Clinical content rules (Milestone M6, stage C1).
 *
 * Adds Clinical-specific authoring rules on top of the shared M2 source-data
 * validation (`validateCollectionSource`). The M2 schema is used unchanged:
 * subject = disease, topics = the four approved categories, `corrects` /
 * `incorrects` = reviewed facts, `subjectIncorrects` = reviewed, genuinely
 * incorrect alternative diagnoses.
 *
 * This module contains NO clinical knowledge. It checks structure, limits and
 * internal consistency only. It cannot detect synonyms, clinical overlap between
 * diseases, or factual errors: those are owner review responsibilities (see
 * `clinical-cards/authoring/AUTHORING.md`). Cross-disease applicability and the
 * contextual-validity policy belong to stage C2 (`clinical-review.ts`).
 *
 * References:
 * - .kiro/specs/clinical-cards/requirements.md (Req 1, Req 2)
 * - .kiro/specs/clinical-cards/design.md (section 3)
 * - docs/master-spec-v1.1.md section 11
 * - .kiro/steering/educational-data-independence.md
 */

import {
  normalizeDisplayText,
  parseId,
  validateCollectionSource,
  type AnswerEntry,
  type SubjectCollection,
  type ValidationIssue,
} from '@beepy/shared-engine';

/** The four approved clinical categories (master spec section 11), in display order. */
export const CLINICAL_CATEGORIES = [
  { key: 'signs', topicName: 'Classic Signs & Symptoms' },
  { key: 'workup', topicName: 'Work-up' },
  { key: 'pathology', topicName: 'Pathology' },
  { key: 'management', topicName: 'Management/Treatment' },
] as const;

export type ClinicalCategoryKey = (typeof CLINICAL_CATEGORIES)[number]['key'];

/** Maximum length of any text that can appear on a card (decision C-12), in code points. */
export const CLINICAL_MAX_CARD_TEXT_LENGTH = 140;

/** Each included category holds one to three reviewed correct facts. */
export const CLINICAL_MIN_FACTS_PER_CATEGORY = 1;
export const CLINICAL_MAX_FACTS_PER_CATEGORY = 3;

/** The id namespace every Clinical identifier uses. */
export const CLINICAL_NAMESPACE = 'clinical';

/** Stable issue codes for the Clinical content rules. */
export const CLINICAL_CONTENT_CODES = {
  noDiseases: 'CLINICAL_NO_DISEASES',
  wrongNamespace: 'CLINICAL_WRONG_NAMESPACE',
  noCategories: 'CLINICAL_NO_CATEGORIES',
  unknownCategory: 'CLINICAL_UNKNOWN_CATEGORY',
  duplicateCategory: 'CLINICAL_DUPLICATE_CATEGORY',
  noFacts: 'CLINICAL_NO_FACTS',
  tooManyFacts: 'CLINICAL_TOO_MANY_FACTS',
  emptyText: 'CLINICAL_EMPTY_TEXT',
  textTooLong: 'CLINICAL_TEXT_TOO_LONG',
  emptyExplanation: 'CLINICAL_EMPTY_EXPLANATION',
  duplicateText: 'CLINICAL_DUPLICATE_TEXT',
  contradictoryEntry: 'CLINICAL_CONTRADICTORY_ENTRY',
  alternativeIsDisease: 'CLINICAL_ALTERNATIVE_IS_DISEASE',
  duplicateDiseaseName: 'CLINICAL_DUPLICATE_DISEASE_NAME',
} as const;

export type ClinicalContentCode = (typeof CLINICAL_CONTENT_CODES)[keyof typeof CLINICAL_CONTENT_CODES];

/** One structured, actionable issue (same shape as the M2 issues: code, message, path). */
export interface ClinicalContentIssue {
  readonly code: ClinicalContentCode;
  readonly message: string;
  readonly path: string;
}

/**
 * The result of Clinical content validation. When the M2 structural or identifier
 * stage fails, `stage` is `'schema'` and `issues` are the M2 issues, unchanged.
 */
export type ClinicalValidationResult =
  | { readonly ok: true; readonly stage: 'clinical'; readonly collection: SubjectCollection; readonly issues: readonly [] }
  | { readonly ok: false; readonly stage: 'schema'; readonly issues: readonly ValidationIssue[] }
  | { readonly ok: false; readonly stage: 'clinical'; readonly issues: readonly ClinicalContentIssue[] };

/** The approved category for a `topicName`, by exact match, or `undefined`. */
export function categoryOfTopicName(topicName: string): ClinicalCategoryKey | undefined {
  return CLINICAL_CATEGORIES.find((category) => category.topicName === topicName)?.key;
}

/** Card-text length as the validator counts it: Unicode code points after trimming. */
export function cardTextLength(text: string): number {
  return [...text.trim()].length;
}

const quote = (text: string): string => {
  const trimmed = text.trim();
  return trimmed.length > 60 ? `"${trimmed.slice(0, 57)}..."` : `"${trimmed}"`;
};

/**
 * Validate an UNTRUSTED value as a Clinical dataset.
 *
 * Runs the shared M2 validation first; if that fails, its issues are returned
 * unchanged and the Clinical rules are skipped (the value is not yet a trustworthy
 * collection). Otherwise every Clinical rule is checked and ALL issues are
 * reported in document order. Never throws.
 */
export function validateClinicalCollection(value: unknown): ClinicalValidationResult {
  const schema = validateCollectionSource(value);
  if (!schema.ok) {
    return { ok: false, stage: 'schema', issues: schema.issues };
  }
  const collection = value as SubjectCollection;
  const issues: ClinicalContentIssue[] = [];
  const add = (code: ClinicalContentCode, message: string, path: string): void => {
    issues.push({ code, message, path });
  };

  /** Card text: non-blank and within the length limit. */
  const checkCardText = (text: string, path: string, what: string): void => {
    if (text.trim().length === 0) {
      add(CLINICAL_CONTENT_CODES.emptyText, `${what} must not be empty or blank.`, path);
      return;
    }
    const length = cardTextLength(text);
    if (length > CLINICAL_MAX_CARD_TEXT_LENGTH) {
      add(
        CLINICAL_CONTENT_CODES.textTooLong,
        `${what} is ${length} characters; card text may be at most ${CLINICAL_MAX_CARD_TEXT_LENGTH}. Shorten it, or move detail into the explanation.`,
        path,
      );
    }
  };

  /** Entries in one list: card text, optional explanation, no repeated text. */
  const checkEntries = (entries: readonly AnswerEntry[], listPath: string, what: string): void => {
    const seen = new Map<string, number>();
    entries.forEach((entry, index) => {
      const path = `${listPath}[${index}]`;
      checkCardText(entry.text, `${path}.text`, what);
      if (entry.explanation !== undefined && entry.explanation.trim().length === 0) {
        add(
          CLINICAL_CONTENT_CODES.emptyExplanation,
          'An explanation must not be blank. Remove the "explanation" field if there is none.',
          `${path}.explanation`,
        );
      }
      const key = normalizeDisplayText(entry.text);
      if (key.length === 0) return;
      const first = seen.get(key);
      if (first === undefined) {
        seen.set(key, index);
      } else {
        add(
          CLINICAL_CONTENT_CODES.duplicateText,
          `${quote(entry.text)} repeats ${listPath}[${first}] (case and spacing are ignored). Keep one entry.`,
          `${path}.text`,
        );
      }
    });
  };

  if (collection.subjects.length === 0) {
    add(CLINICAL_CONTENT_CODES.noDiseases, 'The dataset must contain at least one disease.', 'subjects');
  }

  const diseaseNames = new Map<string, number>();
  collection.subjects.forEach((disease, d) => {
    const base = `subjects[${d}]`;

    if (parseId(disease.id)?.namespace !== CLINICAL_NAMESPACE) {
      add(
        CLINICAL_CONTENT_CODES.wrongNamespace,
        `Disease id "${disease.id}" must use the "${CLINICAL_NAMESPACE}" namespace, e.g. "clinical.subject.<disease-slug>".`,
        `${base}.id`,
      );
    }

    checkCardText(disease.subject, `${base}.subject`, 'The disease name');
    const nameKey = normalizeDisplayText(disease.subject);
    if (nameKey.length > 0) {
      const first = diseaseNames.get(nameKey);
      if (first === undefined) {
        diseaseNames.set(nameKey, d);
      } else {
        add(
          CLINICAL_CONTENT_CODES.duplicateDiseaseName,
          `Disease name ${quote(disease.subject)} is already used by subjects[${first}]. Each disease appears once; merge the two records.`,
          `${base}.subject`,
        );
      }
    }

    checkEntries(disease.subjectIncorrects, `${base}.subjectIncorrects`, 'An alternative diagnosis');
    disease.subjectIncorrects.forEach((alternative, a) => {
      if (nameKey.length > 0 && normalizeDisplayText(alternative.text) === nameKey) {
        add(
          CLINICAL_CONTENT_CODES.alternativeIsDisease,
          `Alternative diagnosis ${quote(alternative.text)} is the disease itself. subjectIncorrects must list genuinely incorrect diagnoses, never the disease, a synonym, or an equivalent name.`,
          `${base}.subjectIncorrects[${a}].text`,
        );
      }
    });

    if (disease.topics.length === 0) {
      add(
        CLINICAL_CONTENT_CODES.noCategories,
        `Disease ${quote(disease.subject)} has no categories. Include at least one of: ${CLINICAL_CATEGORIES.map((c) => `"${c.topicName}"`).join(', ')}.`,
        `${base}.topics`,
      );
    }

    const categoriesSeen = new Map<ClinicalCategoryKey, number>();
    disease.topics.forEach((topic, t) => {
      const topicPath = `${base}.topics[${t}]`;
      const category = categoryOfTopicName(topic.topicName);
      if (category === undefined) {
        add(
          CLINICAL_CONTENT_CODES.unknownCategory,
          `Unknown category ${quote(topic.topicName)}. Use exactly one of: ${CLINICAL_CATEGORIES.map((c) => `"${c.topicName}"`).join(', ')}.`,
          `${topicPath}.topicName`,
        );
      } else {
        const first = categoriesSeen.get(category);
        if (first === undefined) {
          categoriesSeen.set(category, t);
        } else {
          add(
            CLINICAL_CONTENT_CODES.duplicateCategory,
            `Category "${topic.topicName}" already appears at ${base}.topics[${first}]. Each category appears at most once per disease; merge the facts.`,
            `${topicPath}.topicName`,
          );
        }
      }

      if (topic.corrects.length < CLINICAL_MIN_FACTS_PER_CATEGORY) {
        add(
          CLINICAL_CONTENT_CODES.noFacts,
          'An included category needs at least one reviewed correct fact. Add one, or remove the category.',
          `${topicPath}.corrects`,
        );
      } else if (topic.corrects.length > CLINICAL_MAX_FACTS_PER_CATEGORY) {
        add(
          CLINICAL_CONTENT_CODES.tooManyFacts,
          `This category has ${topic.corrects.length} correct facts; the maximum is ${CLINICAL_MAX_FACTS_PER_CATEGORY}. Keep the most high-yield ones.`,
          `${topicPath}.corrects`,
        );
      }

      checkEntries(topic.corrects, `${topicPath}.corrects`, 'A fact');
      checkEntries(topic.incorrects, `${topicPath}.incorrects`, 'A fact');

      const correctKeys = new Map<string, number>();
      topic.corrects.forEach((entry, c) => {
        const key = normalizeDisplayText(entry.text);
        if (key.length > 0 && !correctKeys.has(key)) correctKeys.set(key, c);
      });
      topic.incorrects.forEach((entry, i) => {
        const match = correctKeys.get(normalizeDisplayText(entry.text));
        if (match !== undefined) {
          add(
            CLINICAL_CONTENT_CODES.contradictoryEntry,
            `${quote(entry.text)} is listed as both correct (${topicPath}.corrects[${match}]) and incorrect for this topic. Keep only the reviewed answer.`,
            `${topicPath}.incorrects[${i}].text`,
          );
        }
      });
    });
  });

  if (issues.length > 0) {
    return { ok: false, stage: 'clinical', issues };
  }
  return { ok: true, stage: 'clinical', collection, issues: [] };
}
