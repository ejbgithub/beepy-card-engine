/**
 * Test-only dataset for M6 stage C2 (review records and contextual validity).
 *
 * EVERY name and fact is fictitious placeholder text. The shape is chosen so the
 * expected relations can be worked out BY HAND (see the tables in
 * `c2-review-and-validity.test.ts`), independently of the policy code.
 *
 *   Test Disease 1 (D1)  alternatives: "Test Disease 3", "Test Alternative Diagnosis X"
 *     W1 Work-up               corrects: lab finding A, lab finding B
 *                              incorrects: lab finding C, lab finding Z
 *     M1 Management/Treatment  corrects: therapy A
 *   Test Disease 2 (D2)  alternatives: "Test Disease 3"
 *     W2 Work-up               corrects: lab finding C, shared finding S
 *     S2 Classic Signs         corrects: sign A, "Test sign B."   (note the period)
 *   Test Disease 3 (D3)
 *     W3 Work-up               corrects: lab finding D, shared finding S
 *     M3 Management/Treatment  corrects: therapy B; incorrects: therapy A
 *   Test Disease 4 (D4)
 *     S4 Classic Signs         corrects: "Test sign B"
 */

import type { FakeCollection, FakeEntry } from './fake-clinical.js';

export const T = {
  W1: 'clinical.topic.test-disease-1.workup',
  M1: 'clinical.topic.test-disease-1.management',
  W2: 'clinical.topic.test-disease-2.workup',
  S2: 'clinical.topic.test-disease-2.signs',
  W3: 'clinical.topic.test-disease-3.workup',
  M3: 'clinical.topic.test-disease-3.management',
  S4: 'clinical.topic.test-disease-4.signs',
} as const;

export const F = {
  labA: 'Test lab finding A',
  labB: 'Test lab finding B',
  labC: 'Test lab finding C',
  labD: 'Test lab finding D',
  labZ: 'Test lab finding Z',
  shared: 'Test shared finding S',
  therapyA: 'Test therapy A',
  therapyB: 'Test therapy B',
  signA: 'Test sign A',
  signBDot: 'Test sign B.',
  signB: 'Test sign B',
} as const;

/** Subject ids and alternative-diagnosis entry ids (for Q-1 alternative reviews). */
export const SUBJECT = {
  d1: 'clinical.subject.test-disease-1',
  d2: 'clinical.subject.test-disease-2',
  d3: 'clinical.subject.test-disease-3',
  d4: 'clinical.subject.test-disease-4',
} as const;
export const ALT = {
  d1AltD3: 'clinical.answer.test-disease-1.alt-d3',
  d1AltX: 'clinical.answer.test-disease-1.alt-x',
  d2AltD3: 'clinical.answer.test-disease-2.alt-d3',
} as const;

let counter = 0;
const entry = (text: string): FakeEntry => {
  counter += 1;
  return { id: `clinical.answer.review-fixture.entry-${counter}`, text };
};

export function fakeReviewDataset(): FakeCollection {
  counter = 0;
  return {
    schemaVersion: '1.0.0',
    subjects: [
      {
        id: 'clinical.subject.test-disease-1',
        subject: 'Test Disease 1',
        subjectIncorrects: [
          { id: ALT.d1AltD3, text: 'Test Disease 3' },
          { id: ALT.d1AltX, text: 'Test Alternative Diagnosis X' },
        ],
        topics: [
          { id: T.W1, topicName: 'Work-up', corrects: [entry(F.labA), entry(F.labB)], incorrects: [entry(F.labC), entry(F.labZ)] },
          { id: T.M1, topicName: 'Management/Treatment', corrects: [entry(F.therapyA)], incorrects: [] },
        ],
      },
      {
        id: 'clinical.subject.test-disease-2',
        subject: 'Test Disease 2',
        subjectIncorrects: [{ id: ALT.d2AltD3, text: 'Test Disease 3' }],
        topics: [
          { id: T.W2, topicName: 'Work-up', corrects: [entry(F.labC), entry(F.shared)], incorrects: [] },
          { id: T.S2, topicName: 'Classic Signs & Symptoms', corrects: [entry(F.signA), entry(F.signBDot)], incorrects: [] },
        ],
      },
      {
        id: 'clinical.subject.test-disease-3',
        subject: 'Test Disease 3',
        subjectIncorrects: [],
        topics: [
          { id: T.W3, topicName: 'Work-up', corrects: [entry(F.labD), entry(F.shared)], incorrects: [] },
          { id: T.M3, topicName: 'Management/Treatment', corrects: [entry(F.therapyB)], incorrects: [entry(F.therapyA)] },
        ],
      },
      {
        id: 'clinical.subject.test-disease-4',
        subject: 'Test Disease 4',
        subjectIncorrects: [],
        topics: [{ id: T.S4, topicName: 'Classic Signs & Symptoms', corrects: [entry(F.signB)], incorrects: [] }],
      },
    ],
  };
}
