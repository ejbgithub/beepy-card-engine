/**
 * Test-only Clinical dataset (Milestone M6, stage C1).
 *
 * EVERY name and fact here is fictitious placeholder text ("Test Disease 1",
 * "Test Disease 1 work-up fact A"). Nothing here is clinical knowledge, and this
 * fixture must never be shipped or used as a substitute production dataset. The
 * real dataset is owner-authored and reviewed (decision C-2, stage C5).
 */

import { CLINICAL_CATEGORIES, type ClinicalCategoryKey } from '../../src/clinical-content.js';

/** Mutable copies of the M2 source shapes, so tests can break one field at a time. */
export interface FakeEntry {
  id: string;
  text: string;
  explanation?: string;
}
export interface FakeTopic {
  id: string;
  topicName: string;
  corrects: FakeEntry[];
  incorrects: FakeEntry[];
}
export interface FakeDisease {
  id: string;
  subject: string;
  subjectIncorrects: FakeEntry[];
  topics: FakeTopic[];
}
export interface FakeCollection {
  schemaVersion: string;
  subjects: FakeDisease[];
}

const topicName = (key: ClinicalCategoryKey): string =>
  CLINICAL_CATEGORIES.find((category) => category.key === key)?.topicName ?? key;

const LABEL: Record<ClinicalCategoryKey, string> = {
  signs: 'sign',
  workup: 'work-up',
  pathology: 'pathology',
  management: 'management',
};

function fakeTopic(n: number, key: ClinicalCategoryKey, factCount: number, withIncorrect: boolean): FakeTopic {
  const letters = ['a', 'b', 'c', 'd'];
  return {
    id: `clinical.topic.test-disease-${n}.${key}`,
    topicName: topicName(key),
    corrects: letters.slice(0, factCount).map((letter, i) => ({
      id: `clinical.answer.test-disease-${n}.${key}.fact-${letter}`,
      text: `Test Disease ${n} ${LABEL[key]} fact ${letter.toUpperCase()}`,
      ...(i === 0 ? { explanation: `Placeholder explanation for Test Disease ${n} ${LABEL[key]} fact ${letter.toUpperCase()}.` } : {}),
    })),
    incorrects: withIncorrect
      ? [
          {
            id: `clinical.answer.test-disease-${n}.${key}.not-fact-x`,
            text: `Test Disease ${n} ${LABEL[key]} non-fact X`,
            explanation: `Placeholder explanation for why non-fact X does not apply to Test Disease ${n}.`,
          },
        ]
      : [],
  };
}

/**
 * A fresh, fictitious four-disease dataset. Disease 1 has all four categories with
 * three facts each; the others vary (one to three facts, omitted categories,
 * optional incorrects and alternative diagnoses) to exercise the rules.
 */
export function fakeClinicalCollection(): FakeCollection {
  return {
    schemaVersion: '1.0.0',
    subjects: [
      {
        id: 'clinical.subject.test-disease-1',
        subject: 'Test Disease 1',
        subjectIncorrects: [
          {
            id: 'clinical.answer.test-disease-1.alternative-1',
            text: 'Test Alternative Diagnosis 1',
            explanation: 'Placeholder explanation for the alternative diagnosis.',
          },
        ],
        topics: [
          fakeTopic(1, 'signs', 3, true),
          fakeTopic(1, 'workup', 3, false),
          fakeTopic(1, 'pathology', 3, true),
          fakeTopic(1, 'management', 3, false),
        ],
      },
      {
        id: 'clinical.subject.test-disease-2',
        subject: 'Test Disease 2',
        subjectIncorrects: [],
        topics: [fakeTopic(2, 'signs', 2, false), fakeTopic(2, 'workup', 1, true), fakeTopic(2, 'management', 2, false)],
      },
      {
        id: 'clinical.subject.test-disease-3',
        subject: 'Test Disease 3',
        subjectIncorrects: [
          { id: 'clinical.answer.test-disease-3.alternative-1', text: 'Test Alternative Diagnosis 2' },
          { id: 'clinical.answer.test-disease-3.alternative-2', text: 'Test Disease 4' },
        ],
        topics: [fakeTopic(3, 'workup', 2, false), fakeTopic(3, 'pathology', 1, false)],
      },
      {
        id: 'clinical.subject.test-disease-4',
        subject: 'Test Disease 4',
        subjectIncorrects: [],
        topics: [fakeTopic(4, 'management', 1, false)],
      },
    ],
  };
}

/** Every card text in a dataset (disease names, alternatives, facts), for tests. */
export function allCardTexts(collection: FakeCollection): string[] {
  return collection.subjects.flatMap((disease) => [
    disease.subject,
    ...disease.subjectIncorrects.map((entry) => entry.text),
    ...disease.topics.flatMap((topic) => [...topic.corrects, ...topic.incorrects].map((entry) => entry.text)),
  ]);
}
