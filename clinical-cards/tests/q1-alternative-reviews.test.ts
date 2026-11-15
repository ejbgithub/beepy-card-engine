/**
 * M6 Q-1 safeguard (before C3): alternative diagnoses are UNKNOWN for a fact
 * unless a current alternative-diagnosis review covers them.
 *
 * Fictional data only (fixtures/fake-review-dataset.ts). Expected relations are
 * worked out by hand from the fixture diagram.
 */

import { describe, expect, it } from 'vitest';
import type { SubjectCollection } from '@beepy/shared-engine';
import {
  ALTERNATIVE_REVIEW_STATEMENT,
  REVIEW_CODES,
  REVIEW_FORMAT_VERSION,
  REVIEW_STATEMENT,
  buildReviewReport,
  createValidityPolicy,
  draftAlternativeReview,
  validateReviewFile,
  type AlternativeReviewDraft,
} from '../src/clinical-review.js';
import { validateClinicalCollection } from '../src/clinical-content.js';
import { ALT, F, SUBJECT, T, fakeReviewDataset } from './fixtures/fake-review-dataset.js';
import type { FakeCollection } from './fixtures/fake-clinical.js';

const R = REVIEW_CODES;

const asCollection = (data: FakeCollection): SubjectCollection => {
  const result = validateClinicalCollection(data);
  if (!result.ok) throw new Error(`fixture invalid: ${JSON.stringify(result.issues)}`);
  return result.collection;
};

/** A filled-in, current alternative review of `subjectId` in `data`. */
const altReview = (data: FakeCollection, id: string, subjectId: string, alternativeIds?: string[]): AlternativeReviewDraft => {
  const drafted = draftAlternativeReview(asCollection(data), id, subjectId, alternativeIds);
  if (drafted === undefined) throw new Error('unknown subject');
  return { ...drafted.draft, reviewedBy: 'Test Reviewer', reviewedOn: '2026-11-12' };
};
const file = (alternativeReviews: unknown[], reviews: unknown[] = []) => ({ reviewFormatVersion: REVIEW_FORMAT_VERSION, reviews, alternativeReviews });
const policyFor = (data: FakeCollection, review?: unknown) => {
  const collection = asCollection(data);
  return createValidityPolicy(collection, review === undefined ? undefined : validateReviewFile(review, collection));
};

describe('Q-1 relations for alternative diagnoses (hand-worked)', () => {
  it('without an alternative review, listed alternatives are unknown for every fact of the disease', () => {
    const policy = policyFor(fakeReviewDataset());
    for (const [topic, fact] of [[T.W1, F.labA], [T.W1, F.labB], [T.M1, F.therapyA]] as const) {
      expect(policy.nameRelation('Test Alternative Diagnosis X', topic, fact)).toEqual({ relation: 'unknown', basis: 'notCoveredByReview' });
    }
    expect(policy.nameRelation('Test Disease 3', T.W1, F.labA)).toEqual({ relation: 'unknown', basis: 'notCoveredByReview' });
    expect(policy.nameRelation('Test Disease 3', T.W1, F.labB)).toEqual({ relation: 'unknown', basis: 'notCoveredByReview' });
  });

  it('an explicit listing decides even without an alternative review', () => {
    // D3 Management lists "Test therapy A" as incorrect, so the name "Test Disease 3"
    // is explicitly wrong for the D1 Management fact "Test therapy A".
    expect(policyFor(fakeReviewDataset()).nameRelation('Test Disease 3', T.M1, F.therapyA)).toEqual({ relation: 'invalid', basis: 'listedIncorrect' });
  });

  describe('with a current review of both D1 alternatives', () => {
    const data = fakeReviewDataset();
    const policy = policyFor(data, file([altReview(data, 'review.alt.d1', SUBJECT.d1)]));
    it.each([
      ['Test Alternative Diagnosis X', T.W1, F.labA],
      ['Test Alternative Diagnosis X', T.W1, F.labB],
      ['Test Alternative Diagnosis X', T.M1, F.therapyA],
      ['Test Disease 3', T.W1, F.labA],
      ['Test Disease 3', T.W1, F.labB],
    ] as const)('%s on (%s: %s) is invalid (reviewedAlternative)', (name, topic, fact) => {
      expect(policy.nameRelation(name, topic, fact)).toEqual({ relation: 'invalid', basis: 'reviewedAlternative', reviewId: 'review.alt.d1' });
    });
    it('does not extend to other diseases\u2019 challenges', () => {
      expect(policy.nameRelation('Test Alternative Diagnosis X', T.W2, F.labC).relation).toBe('unknown');
      expect(policy.nameRelation('Test Disease 3', T.W2, F.labC).relation).toBe('unknown');
    });
    it('matches names ignoring case and spacing', () => {
      expect(policy.nameRelation('  test alternative  DIAGNOSIS x', T.W1, F.labA).relation).toBe('invalid');
    });
    it('reports the covering review', () => {
      expect(policy.alternativeReviewCovering(SUBJECT.d1, 'Test Disease 3')).toBe('review.alt.d1');
      expect(policy.alternativeReviewCovering(SUBJECT.d2, 'Test Disease 3')).toBeUndefined();
    });
  });

  it('a partial review covers only the listed alternatives', () => {
    const data = fakeReviewDataset();
    const policy = policyFor(data, file([altReview(data, 'review.alt.d1-x', SUBJECT.d1, [ALT.d1AltX])]));
    expect(policy.nameRelation('Test Alternative Diagnosis X', T.W1, F.labA).relation).toBe('invalid');
    expect(policy.nameRelation('Test Disease 3', T.W1, F.labA).relation).toBe('unknown');
  });

  it('data that says a fact is shared still wins: the alternative stays valid there', () => {
    // D2 lists "Test Disease 3" as an alternative, but D3's Work-up also lists the shared finding.
    const data = fakeReviewDataset();
    const policy = policyFor(data, file([altReview(data, 'review.alt.d2', SUBJECT.d2)]));
    expect(policy.nameRelation('Test Disease 3', T.W2, F.shared)).toEqual({ relation: 'valid', basis: 'sharedFact' });
    expect(policy.nameRelation('Test Disease 3', T.W2, F.labC)).toEqual({ relation: 'invalid', basis: 'reviewedAlternative', reviewId: 'review.alt.d2' });
  });

  it('explicit incorrect listings still decide before alternative reviews', () => {
    const data = fakeReviewDataset();
    const policy = policyFor(data);
    expect(policy.nameRelation('Test Disease 1', T.W2, F.labC)).toEqual({ relation: 'invalid', basis: 'listedIncorrect' });
  });
});

describe('Q-1 stale alternative reviews', () => {
  const setup = () => {
    const data = fakeReviewDataset();
    return { data, review: file([altReview(data, 'review.alt.d1', SUBJECT.d1)]) };
  };
  const state = (data: FakeCollection, review: unknown) => validateReviewFile(review, asCollection(data)).alternativeRecords[0]?.state;

  it.each([
    ['a D1 Work-up fact is edited', (d: FakeCollection) => void (d.subjects[0]!.topics[0]!.corrects[0]!.text = 'Test lab finding A2')],
    ['a D1 Management fact is added', (d: FakeCollection) => void d.subjects[0]!.topics[1]!.corrects.push({ id: 'clinical.answer.review-fixture.new', text: 'Test therapy N' })],
    ['a D1 category is added', (d: FakeCollection) => void d.subjects[0]!.topics.push({ id: 'clinical.topic.test-disease-1.pathology', topicName: 'Pathology', corrects: [{ id: 'clinical.answer.review-fixture.p', text: 'Test pathology P' }], incorrects: [] })],
    ['a D1 category is renamed', (d: FakeCollection) => void (d.subjects[0]!.topics[1]!.topicName = 'Pathology')],
    ['a covered alternative text is edited', (d: FakeCollection) => void (d.subjects[0]!.subjectIncorrects[1]!.text = 'Test Alternative Diagnosis Y')],
    ['the disease is renamed', (d: FakeCollection) => void (d.subjects[0]!.subject = 'Test Disease 1 Renamed')],
  ])('becomes stale when %s, and the alternatives return to unknown', (_label, change) => {
    const { data, review } = setup();
    change(data);
    const result = validateReviewFile(review, asCollection(data));
    expect(result.ok).toBe(true);
    expect(result.alternativeRecords[0]).toMatchObject({ id: 'review.alt.d1', state: 'stale' });
    expect(result.stale).toEqual([expect.objectContaining({ code: R.stale, path: 'alternativeReviews[0].fingerprint' })]);
    expect(result.stale[0]?.message).toContain('review.alt.d1');
    expect(result.stale[0]?.message).toContain(SUBJECT.d1);
    const policy = createValidityPolicy(asCollection(data), result);
    const fact = data.subjects[0]!.topics[0]!.corrects[0]!.text;
    expect(policy.nameRelation('Test Disease 3', T.W1, fact).relation).toBe('unknown');
  });

  it.each([
    ['facts are reordered', (d: FakeCollection) => void d.subjects[0]!.topics[0]!.corrects.reverse()],
    ['categories are reordered', (d: FakeCollection) => void d.subjects[0]!.topics.reverse()],
    ['an explanation is edited', (d: FakeCollection) => void (d.subjects[0]!.topics[0]!.corrects[0]!.explanation = 'Placeholder.')],
    ['an alternative explanation is edited', (d: FakeCollection) => void (d.subjects[0]!.subjectIncorrects[0]!.explanation = 'Placeholder.')],
    ['an incorrect fact is added', (d: FakeCollection) => void d.subjects[0]!.topics[0]!.incorrects.push({ id: 'clinical.answer.review-fixture.q', text: 'Test lab finding Q' })],
    ['another disease changes', (d: FakeCollection) => void (d.subjects[1]!.topics[0]!.corrects[0]!.text = 'Test lab finding C2')],
  ])('stays current when %s', (_label, change) => {
    const { data, review } = setup();
    change(data);
    expect(state(data, review)).toBe('current');
  });

  it('an uncovered alternative may change without making a partial review stale', () => {
    const data = fakeReviewDataset();
    const review = file([altReview(data, 'review.alt.d1-x', SUBJECT.d1, [ALT.d1AltX])]);
    data.subjects[0]!.subjectIncorrects[0]!.text = 'Test Disease 4';
    expect(state(data, review)).toBe('current');
  });

  it('the report offers a renewal draft; filled in, it is current again', () => {
    const { data, review } = setup();
    data.subjects[0]!.topics[0]!.corrects[0]!.text = 'Test lab finding A2';
    const result = buildReviewReport(data, review);
    if (!result.ok) throw new Error('expected a report');
    const [stale] = result.report.staleReviews;
    if (stale?.kind !== 'alternatives') throw new Error('expected a stale alternative review');
    expect([stale.reviewId, stale.subjectId, stale.disease]).toEqual(['review.alt.d1', SUBJECT.d1, 'Test Disease 1']);
    const renewed = file([{ ...stale.renewalDraft, reviewedBy: 'Test Reviewer', reviewedOn: '2026-11-13' }]);
    expect(state(data, renewed)).toBe('current');
  });
});

describe('Q-1 malformed alternative reviews', () => {
  const data = () => fakeReviewDataset();
  const good = () => altReview(fakeReviewDataset(), 'review.alt.d1', SUBJECT.d1);
  const issuesOf = (review: unknown) => validateReviewFile(review, asCollection(data())).issues.map(({ code, path }) => ({ code, path }));

  it('accepts a correct record', () => {
    const result = validateReviewFile(file([good()]), asCollection(data()));
    expect(result.issues).toEqual([]);
    expect(result.alternativeRecords).toEqual([
      { index: 0, path: 'alternativeReviews[0]', id: 'review.alt.d1', state: 'current', subjectId: SUBJECT.d1, alternativeIds: [ALT.d1AltD3, ALT.d1AltX] },
    ]);
  });

  it('the field is optional', () => {
    expect(validateReviewFile({ reviewFormatVersion: REVIEW_FORMAT_VERSION, reviews: [] }, asCollection(data())).ok).toBe(true);
  });

  it('a non-array alternativeReviews disables the file', () => {
    const result = validateReviewFile({ reviewFormatVersion: REVIEW_FORMAT_VERSION, reviews: [], alternativeReviews: {} }, asCollection(data()));
    expect(result.issues.map(({ code, path }) => ({ code, path }))).toEqual([{ code: R.invalidFile, path: 'alternativeReviews' }]);
    expect(result.fileUsable).toBe(false);
  });

  it.each([
    ['not an object', () => 7, [{ code: R.invalidRecord, path: 'alternativeReviews[0]' }]],
    ['an unknown field', () => ({ ...good(), note: 'x' }), [{ code: R.unknownField, path: 'alternativeReviews[0].note' }]],
    ['the topic-group statement', () => ({ ...good(), statement: REVIEW_STATEMENT }), [{ code: R.statementMismatch, path: 'alternativeReviews[0].statement' }]],
    ['the placeholder reviewer', () => ({ ...good(), reviewedBy: '<reviewer name>' }), [{ code: R.missingReviewer, path: 'alternativeReviews[0].reviewedBy' }]],
    ['an impossible date', () => ({ ...good(), reviewedOn: '2026-13-01' }), [{ code: R.invalidDate, path: 'alternativeReviews[0].reviewedOn' }]],
    ['an unknown disease', () => ({ ...good(), subjectId: 'clinical.subject.nope' }), [{ code: R.unknownSubject, path: 'alternativeReviews[0].subjectId' }]],
    ['no alternatives', () => ({ ...good(), alternativeIds: [] }), [{ code: R.noAlternatives, path: 'alternativeReviews[0].alternativeIds' }]],
    ['alternativeIds not an array', () => ({ ...good(), alternativeIds: ALT.d1AltX }), [{ code: R.invalidRecord, path: 'alternativeReviews[0].alternativeIds' }]],
    ['another disease\u2019s alternative', () => ({ ...good(), alternativeIds: [ALT.d1AltX, ALT.d2AltD3] }), [{ code: R.unknownAlternative, path: 'alternativeReviews[0].alternativeIds[1]' }]],
    ['a repeated alternative', () => ({ ...good(), alternativeIds: [ALT.d1AltX, ALT.d1AltX] }), [{ code: R.duplicateAlternative, path: 'alternativeReviews[0].alternativeIds[1]' }]],
    ['a malformed fingerprint', () => ({ ...good(), fingerprint: 'fp1-XYZ' }), [{ code: R.invalidFingerprint, path: 'alternativeReviews[0].fingerprint' }]],
  ])('%s', (_label, record, expected) => {
    const review = file([record()]);
    expect(issuesOf(review)).toEqual(expected);
    expect(validateReviewFile(review, asCollection(data())).alternativeRecords[0]?.state).toBe('invalid');
  });

  it('a wrong statement establishes nothing', () => {
    const d = data();
    const policy = policyFor(d, file([{ ...good(), statement: 'Reviewed.' }]));
    expect(policy.nameRelation('Test Disease 3', T.W1, F.labA).relation).toBe('unknown');
  });

  it('ids are unique across both record kinds', () => {
    const d = data();
    const topicRecord = { id: 'review.alt.d1', reviewedBy: 'Test Reviewer', reviewedOn: '2026-11-12', statement: REVIEW_STATEMENT, topics: [] };
    expect(issuesOf(file([good()], [topicRecord])).map((i) => i.code)).toContain(R.duplicateId);
    void d;
  });

  it('the unfilled draft is rejected; the draft defaults to all alternatives and reports unknown ids', () => {
    const collection = asCollection(data());
    const drafted = draftAlternativeReview(collection, 'review.alt.d1', SUBJECT.d1, [ALT.d1AltX, 'clinical.answer.nope']);
    expect(drafted?.unknownAlternativeIds).toEqual(['clinical.answer.nope']);
    expect(drafted?.draft.alternativeIds).toEqual([ALT.d1AltX]);
    expect(drafted?.draft.statement).toBe(ALTERNATIVE_REVIEW_STATEMENT);
    expect(draftAlternativeReview(collection, 'review.alt.d1', SUBJECT.d1)?.draft.alternativeIds).toEqual([ALT.d1AltD3, ALT.d1AltX]);
    expect(draftAlternativeReview(collection, 'review.x', 'clinical.subject.nope')).toBeUndefined();
    expect(issuesOf(file([drafted!.draft])).map((i) => i.code)).toEqual([R.missingReviewer, R.invalidDate]);
  });
});

describe('Q-1 in the review report', () => {
  it('lists alternatives without a current review, and counts coverage', () => {
    const d = fakeReviewDataset();
    const before = buildReviewReport(d);
    if (!before.ok) throw new Error('expected a report');
    expect(before.report.unreviewedAlternatives.map((a) => [a.disease, a.alternative])).toEqual([
      ['Test Disease 1', 'Test Disease 3'],
      ['Test Disease 1', 'Test Alternative Diagnosis X'],
      ['Test Disease 2', 'Test Disease 3'],
    ]);
    const after = buildReviewReport(d, file([altReview(d, 'review.alt.d1', SUBJECT.d1)]));
    if (!after.ok) throw new Error('expected a report');
    expect(after.report.unreviewedAlternatives.map((a) => a.disease)).toEqual(['Test Disease 2']);
    expect(after.report.summary.alternatives).toEqual({ listed: 3, reviewed: 2 });
    expect(after.report.summary.alternativeRecords).toEqual({ current: 1, stale: 0, invalid: 0 });
    expect(after.report.alternativeFingerprints.map((f) => f.subjectId)).toEqual([SUBJECT.d1, SUBJECT.d2]);
  });
});
