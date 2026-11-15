/**
 * Larger test-only Clinical dataset builder for M6 stage C3 (generator tests,
 * nine-challenge games, both directions).
 *
 * EVERY name and fact is fictitious placeholder text. The text encodes where it
 * came from ("Test Disease 7 work-up fact B"), so tests can compute expected
 * relations from the text itself, independently of the policy code.
 *
 * Shape of disease i (1-based):
 *   subject           "Test Disease i"
 *   subjectIncorrects "Test Alternative Diagnosis 1".."Test Alternative Diagnosis S"
 *                     (the same S fictitious names under every disease)
 *   topics            the chosen categories, each with F corrects
 *                     "Test Disease i <label> fact A".. and one incorrect
 *                     "Test Disease i <label> non-fact X"
 *   explanations      on fact A of each topic, on the incorrect, and on
 *                     alternative 1, all "Placeholder explanation ..."
 */

import {
  draftAlternativeReview,
  draftReviewRecord,
  REVIEW_FORMAT_VERSION,
} from '../../src/clinical-review.js';
import { CLINICAL_CATEGORIES, type ClinicalCategoryKey } from '../../src/clinical-content.js';
import type { SubjectCollection } from '@beepy/shared-engine';
import type { FakeCollection, FakeDisease, FakeTopic } from './fake-clinical.js';

export const LABEL: Record<ClinicalCategoryKey, string> = {
  signs: 'sign',
  workup: 'work-up',
  pathology: 'pathology',
  management: 'management',
};
const ALL_KEYS = CLINICAL_CATEGORIES.map((c) => c.key);
const LETTERS = ['A', 'B', 'C'];

export interface LargeOptions {
  /** Number of diseases. */
  readonly diseases: number;
  /** Correct facts per category (1 to 3). Default 3. */
  readonly facts?: number;
  /** Shared fictitious alternative diagnoses listed under every disease. Default 0. */
  readonly alternatives?: number;
  /** Categories per disease. Default all four. */
  readonly categories?: readonly ClinicalCategoryKey[];
}

export const topicIdOf = (i: number, key: ClinicalCategoryKey): string => `clinical.topic.test-disease-${i}.${key}`;
export const subjectIdOf = (i: number): string => `clinical.subject.test-disease-${i}`;

export function largeFakeDataset(options: LargeOptions): FakeCollection {
  const facts = options.facts ?? 3;
  const keys = options.categories ?? ALL_KEYS;
  const subjects: FakeDisease[] = [];
  for (let i = 1; i <= options.diseases; i += 1) {
    const topics: FakeTopic[] = keys.map((key) => ({
      id: topicIdOf(i, key),
      topicName: CLINICAL_CATEGORIES.find((c) => c.key === key)?.topicName ?? key,
      corrects: LETTERS.slice(0, facts).map((letter, f) => ({
        id: `clinical.answer.test-disease-${i}.${key}.fact-${letter.toLowerCase()}`,
        text: `Test Disease ${i} ${LABEL[key]} fact ${letter}`,
        ...(f === 0 ? { explanation: `Placeholder explanation for Test Disease ${i} ${LABEL[key]} fact ${letter}.` } : {}),
      })),
      incorrects: [
        {
          id: `clinical.answer.test-disease-${i}.${key}.non-fact-x`,
          text: `Test Disease ${i} ${LABEL[key]} non-fact X`,
          explanation: `Placeholder explanation for why non-fact X is not a Test Disease ${i} ${LABEL[key]} fact.`,
        },
      ],
    }));
    const alternatives = Array.from({ length: options.alternatives ?? 0 }, (_, a) => ({
      id: `clinical.answer.test-disease-${i}.alt-${a + 1}`,
      text: `Test Alternative Diagnosis ${a + 1}`,
      ...(a === 0 ? { explanation: `Placeholder explanation for why alternative 1 is not Test Disease ${i}.` } : {}),
    }));
    subjects.push({ id: subjectIdOf(i), subject: `Test Disease ${i}`, subjectIncorrects: alternatives, topics });
  }
  return { schemaVersion: '1.0.0', subjects };
}

export type TopicCoverage = 'none' | 'category' | 'full';

const filled = <T extends object>(draft: T): T => ({ ...draft, reviewedBy: 'Test Reviewer', reviewedOn: '2026-11-12' });

/**
 * A review file for `data` with current fingerprints:
 * - `topics: 'full'`: one record covering every topic (all pairs reviewed);
 * - `topics: 'category'`: one record per category across all diseases;
 * - `alternatives`: one alternative review per disease (all its alternatives),
 *   optionally only for some disease numbers.
 */
export function reviewFileFor(
  data: FakeCollection,
  options: { readonly topics: TopicCoverage; readonly alternatives?: boolean | readonly number[] },
): unknown {
  const collection = data as unknown as SubjectCollection;
  const allTopics = data.subjects.flatMap((s) => s.topics.map((t) => t.id));
  const reviews: unknown[] = [];
  if (options.topics === 'full') {
    reviews.push(filled(draftReviewRecord(collection, 'review.all-topics', allTopics).draft));
  } else if (options.topics === 'category') {
    for (const key of ALL_KEYS) {
      const ids = allTopics.filter((id) => id.endsWith(`.${key}`));
      if (ids.length >= 2) reviews.push(filled(draftReviewRecord(collection, `review.category-${key}`, ids).draft));
    }
  }
  const alternativeReviews: unknown[] = [];
  const wanted = options.alternatives;
  if (wanted !== undefined && wanted !== false) {
    data.subjects.forEach((disease, d) => {
      if (disease.subjectIncorrects.length === 0) return;
      if (Array.isArray(wanted) && !wanted.includes(d + 1)) return;
      const drafted = draftAlternativeReview(collection, `review.alt.test-disease-${d + 1}`, disease.id);
      if (drafted !== undefined) alternativeReviews.push(filled(drafted.draft));
    });
  }
  return { reviewFormatVersion: REVIEW_FORMAT_VERSION, reviews, alternativeReviews };
}

/** Parse a fixture fact text: disease number and category label, or undefined for names. */
export function parseFactText(text: string): { readonly disease: number; readonly label: string; readonly incorrect: boolean } | undefined {
  const match = /^Test Disease (\d+) (sign|work-up|pathology|management) (fact [A-C]|non-fact X)$/.exec(text);
  if (match === null) return undefined;
  return { disease: Number(match[1]), label: match[2] as string, incorrect: (match[3] as string).startsWith('non-fact') };
}
