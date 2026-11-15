/**
 * M6 stage C2 - review records, contextual validity, stale reviews, review report
 * (requirements Req 3; design section 4; AUTHORING.md section 7).
 *
 * All data is fictitious (fixtures/fake-review-dataset.ts). Expected relations
 * are written out BY HAND from the fixture diagram, not computed with the policy
 * code. Fingerprint hashing is checked against published FNV-1a 64 test vectors.
 */

import { describe, expect, it } from 'vitest';
import { analyzeCandidateAmbiguity, type SubjectCollection } from '@beepy/shared-engine';
import {
  REVIEW_CODES,
  REVIEW_FORMAT_VERSION,
  REVIEW_STATEMENT,
  buildReviewReport,
  createValidityPolicy,
  draftReviewRecord,
  fnv1a64Hex,
  formatReviewReport,
  topicFingerprint,
  validateReviewFile,
  type ReviewRecordDraft,
} from '../src/clinical-review.js';
import { validateClinicalCollection } from '../src/clinical-content.js';
import { F, T, fakeReviewDataset } from './fixtures/fake-review-dataset.js';
import type { FakeCollection } from './fixtures/fake-clinical.js';

const R = REVIEW_CODES;

async function readJson(relative: string): Promise<unknown> {
  const specifier = 'node:fs/promises';
  const fs = (await import(/* @vite-ignore */ specifier)) as { readFile(path: URL, encoding: string): Promise<string> };
  return JSON.parse(await fs.readFile(new URL(relative, import.meta.url), 'utf8')) as unknown;
}

const asCollection = (data: FakeCollection): SubjectCollection => {
  const result = validateClinicalCollection(data);
  if (!result.ok) throw new Error(`fixture invalid: ${JSON.stringify(result.issues)}`);
  return result.collection;
};

/** A filled-in, current review record for the given topics of `data`. */
const filled = (data: FakeCollection, id: string, topicIds: string[]): ReviewRecordDraft => ({
  ...draftReviewRecord(asCollection(data), id, topicIds).draft,
  reviewedBy: 'Test Reviewer',
  reviewedOn: '2026-11-12',
});
const reviewFile = (...reviews: unknown[]) => ({ reviewFormatVersion: REVIEW_FORMAT_VERSION, reviews });

const policyFor = (data: FakeCollection, file?: unknown) => {
  const collection = asCollection(data);
  return createValidityPolicy(collection, file === undefined ? undefined : validateReviewFile(file, collection));
};

describe('C2 fingerprints', () => {
  it('FNV-1a 64 matches the published test vectors', () => {
    expect(fnv1a64Hex('')).toBe('cbf29ce484222325');
    expect(fnv1a64Hex('a')).toBe('af63dc4c8601ec8c');
    expect(fnv1a64Hex('foobar')).toBe('85944171f73967e8');
  });

  const topic = (corrects: string[], topicName = 'Work-up', explanation?: string) => ({
    id: 'clinical.topic.x.workup',
    topicName,
    corrects: corrects.map((text, i) => ({ id: `clinical.answer.x.${i}`, text, ...(explanation === undefined ? {} : { explanation }) })),
    incorrects: [],
  });
  const fp = (name: string, t: ReturnType<typeof topic>) => topicFingerprint(name, t);

  it('has the documented format and is deterministic', () => {
    const value = fp('Test Disease 1', topic([F.labA, F.labB]));
    expect(value).toMatch(/^fp1-[0-9a-f]{16}$/);
    expect(fp('Test Disease 1', topic([F.labA, F.labB]))).toBe(value);
  });

  it('does not change for reordering, ids, explanations, or case/spacing', () => {
    const base = fp('Test Disease 1', topic([F.labA, F.labB]));
    expect(fp('Test Disease 1', topic([F.labB, F.labA]))).toBe(base);
    expect(fp('Test Disease 1', topic([F.labA, F.labB], 'Work-up', 'Some placeholder explanation'))).toBe(base);
    expect(fp('  test disease 1 ', topic(['TEST LAB  finding a', F.labB]))).toBe(base);
  });

  it('changes when reviewed content changes', () => {
    const base = fp('Test Disease 1', topic([F.labA, F.labB]));
    const changed = [
      fp('Test Disease 1', topic([F.labA, 'Test lab finding B2'])), // edited fact
      fp('Test Disease 1', topic([F.labA])), // removed fact
      fp('Test Disease 1', topic([F.labA, F.labB, F.labD])), // added fact
      fp('Test Disease 9', topic([F.labA, F.labB])), // renamed disease
      fp('Test Disease 1', topic([F.labA, F.labB], 'Pathology')), // changed category
    ];
    for (const value of changed) expect(value).not.toBe(base);
    expect(new Set(changed).size).toBe(changed.length);
  });
});

describe('C2 fact relations (subjectToFact), expected values worked out by hand', () => {
  it.each([
    // [card text, challenge topic, relation, basis]
    [F.labA, T.W1, 'valid', 'listedCorrect'],
    [F.labC, T.W1, 'invalid', 'listedIncorrect'],
    [F.labC, T.W2, 'valid', 'listedCorrect'],
    [F.therapyA, T.M3, 'invalid', 'listedIncorrect'],
    [F.shared, T.W2, 'valid', 'listedCorrect'],
    [F.shared, T.W3, 'valid', 'listedCorrect'],
    // Absence from a list NEVER makes a fact invalid:
    [F.labA, T.W2, 'unknown', 'notCoveredByReview'],
    [F.labD, T.W1, 'unknown', 'notCoveredByReview'],
    [F.shared, T.W1, 'unknown', 'notCoveredByReview'],
    [F.therapyA, T.W1, 'unknown', 'notCoveredByReview'], // cross-category, same disease
    [F.signA, T.S4, 'unknown', 'notCoveredByReview'], // same category, other disease
    [F.labZ, T.W2, 'unknown', 'notCoveredByReview'], // an incorrect-only text
    ['Text that is not in the dataset', T.W1, 'unknown', 'notInDataset'],
    [F.labA, 'clinical.topic.no-such-topic.workup', 'unknown', 'unknownTopic'],
  ] as const)('%s on %s is %s (%s) with no reviews', (text, topicId, relation, basis) => {
    expect(policyFor(fakeReviewDataset()).factRelation(text, topicId)).toEqual({ relation, basis });
  });

  it('matching ignores case and spacing, like card uniqueness', () => {
    expect(policyFor(fakeReviewDataset()).factRelation('  test LAB finding c ', T.W1)).toEqual({ relation: 'invalid', basis: 'listedIncorrect' });
  });

  describe('with a current review of the pair W1 + W2', () => {
    const data = fakeReviewDataset();
    const policy = policyFor(data, reviewFile(filled(data, 'review.w1-w2', [T.W1, T.W2])));
    it.each([
      [F.labA, T.W2, 'invalid', 'reviewed'], // a W1 correct, reviewed against W2
      [F.labB, T.W2, 'invalid', 'reviewed'],
      [F.shared, T.W1, 'invalid', 'reviewed'], // a W2 correct, reviewed against W1
      [F.labC, T.W1, 'invalid', 'listedIncorrect'], // explicit listing still wins
      [F.labC, T.W2, 'valid', 'listedCorrect'],
      [F.labD, T.W1, 'unknown', 'notCoveredByReview'], // W3 is not in the review
      [F.labA, T.W3, 'unknown', 'notCoveredByReview'], // the review covers only its pair
      [F.signA, T.W1, 'unknown', 'notCoveredByReview'],
      [F.labZ, T.W2, 'unknown', 'notCoveredByReview'], // reviews cover CORRECT facts only
    ] as const)('%s on %s is %s (%s)', (text, topicId, relation, basis) => {
      const result = policy.factRelation(text, topicId);
      expect(result.relation).toBe(relation);
      expect(result.basis).toBe(basis);
      if (basis === 'reviewed') expect(result.reviewId).toBe('review.w1-w2');
    });
    it('reports which reviews cover a pair, symmetrically', () => {
      expect(policy.reviewsCovering(T.W1, T.W2)).toEqual(['review.w1-w2']);
      expect(policy.reviewsCovering(T.W2, T.W1)).toEqual(['review.w1-w2']);
      expect(policy.reviewsCovering(T.W1, T.W3)).toEqual([]);
      expect(policy.reviewsCovering(T.W1, T.W1)).toEqual([]);
    });
  });

  it('a cross-category review (same disease) establishes invalidity both ways', () => {
    const data = fakeReviewDataset();
    const policy = policyFor(data, reviewFile(filled(data, 'review.d1-workup-management', [T.W1, T.M1])));
    expect(policy.factRelation(F.therapyA, T.W1)).toEqual({ relation: 'invalid', basis: 'reviewed', reviewId: 'review.d1-workup-management' });
    expect(policy.factRelation(F.labA, T.M1)).toEqual({ relation: 'invalid', basis: 'reviewed', reviewId: 'review.d1-workup-management' });
    expect(policy.factRelation(F.labA, T.M3).relation).toBe('unknown');
  });

  it('a group of three covers all three pairs; small groups can be combined', () => {
    const data = fakeReviewDataset();
    const policy = policyFor(data, reviewFile(filled(data, 'review.workup-trio', [T.W1, T.W2, T.W3]), filled(data, 'review.signs-pair', [T.S2, T.S4])));
    expect(policy.factRelation(F.labD, T.W1).relation).toBe('invalid');
    expect(policy.factRelation(F.labA, T.W3).relation).toBe('invalid');
    expect(policy.factRelation(F.signA, T.S4).relation).toBe('invalid');
    expect(policy.factRelation(F.signA, T.W1).relation).toBe('unknown');
  });
});

describe('C2 disease-name relations (factToSubject), expected values worked out by hand', () => {
  it.each([
    // [card name, challenge topic, challenge fact, relation, basis]
    ['Test Disease 1', T.W1, F.labA, 'valid', 'sameDisease'],
    // Q-1: listing an alternative diagnosis alone does not make it wrong for a fact.
    ['Test Disease 3', T.W1, F.labA, 'unknown', 'notCoveredByReview'],
    ['Test Alternative Diagnosis X', T.W1, F.labA, 'unknown', 'notCoveredByReview'],
    ['Test Disease 2', T.W1, F.labA, 'unknown', 'notCoveredByReview'],
    ['Test Disease 4', T.W1, F.labA, 'unknown', 'notCoveredByReview'], // no Work-up topic
    ['Test Disease 3', T.W2, F.shared, 'valid', 'sharedFact'], // shared beats the alternative listing
    ['Test Disease 1', T.W2, F.labC, 'invalid', 'listedIncorrect'], // W1 lists C as incorrect
    ['Test Alternative Diagnosis X', T.W2, F.labC, 'unknown', 'notCoveredByReview'], // listed for D1 only
    ['Some Name Not In The Dataset', T.W1, F.labA, 'unknown', 'notInDataset'],
    ['Test Disease 2', T.W1, F.labC, 'unknown', 'notAChallengeFact'], // C is not a W1 correct
  ] as const)('%s on (%s: %s) is %s (%s)', (name, topicId, fact, relation, basis) => {
    expect(policyFor(fakeReviewDataset()).nameRelation(name, topicId, fact)).toEqual({ relation, basis });
  });

  it('a review of W1 + W2 makes Test Disease 2 invalid for a W1 fact', () => {
    const data = fakeReviewDataset();
    const policy = policyFor(data, reviewFile(filled(data, 'review.w1-w2', [T.W1, T.W2])));
    expect(policy.nameRelation('Test Disease 2', T.W1, F.labA)).toEqual({ relation: 'invalid', basis: 'reviewed', reviewId: 'review.w1-w2' });
    expect(policy.nameRelation('Test Disease 1', T.W2, F.shared)).toEqual({ relation: 'invalid', basis: 'reviewed', reviewId: 'review.w1-w2' });
  });
});

describe('C2 bridge to the M2 ambiguity analysis', () => {
  it('excludes cards with any unknown pair and gives the M2 analysis a complete matrix', () => {
    const data = fakeReviewDataset();
    const policy = policyFor(data, reviewFile(filled(data, 'review.w1-w2', [T.W1, T.W2])));
    const cards = [
      { id: 'card-a', text: F.labA },
      { id: 'card-c', text: F.labC },
      { id: 'card-s', text: F.shared },
      { id: 'card-d', text: F.labD },
    ];
    const matrix = policy.factValidityMatrix([T.W1, T.W2], cards);
    expect(matrix.usableCardIds).toEqual(['card-a', 'card-c', 'card-s']);
    expect(matrix.unknownPairs).toEqual([
      { cardId: 'card-d', challengeTopicId: T.W1 },
      { cardId: 'card-d', challengeTopicId: T.W2 },
    ]);
    expect(matrix.contextualValidity).toEqual({
      [T.W1]: { 'card-a': true, 'card-c': false, 'card-s': false },
      [T.W2]: { 'card-a': false, 'card-c': true, 'card-s': true },
    });
    const analysis = analyzeCandidateAmbiguity([T.W1, T.W2], matrix.usableCardIds, matrix.contextualValidity);
    if (!analysis.ok) throw new Error(JSON.stringify(analysis.issues));
    expect(analysis.analysis.unambiguousByChallenge).toEqual({ [T.W1]: ['card-a'], [T.W2]: ['card-c', 'card-s'] });
    expect(analysis.analysis.ambiguousCards).toEqual([]);
  });

  it('a shared fact valid for two active challenges is reported ambiguous by M2', () => {
    const data = fakeReviewDataset();
    const policy = policyFor(data, reviewFile(filled(data, 'review.w2-w3', [T.W2, T.W3])));
    const cards = [
      { id: 'card-s', text: F.shared }, // valid for both W2 and W3
      { id: 'card-c', text: F.labC }, // valid for W2, reviewed invalid for W3
      { id: 'card-d', text: F.labD }, // valid for W3, reviewed invalid for W2
    ];
    const matrix = policy.factValidityMatrix([T.W2, T.W3], cards);
    expect(matrix.usableCardIds).toEqual(['card-s', 'card-c', 'card-d']);
    const analysis = analyzeCandidateAmbiguity([T.W2, T.W3], matrix.usableCardIds, matrix.contextualValidity);
    if (!analysis.ok) throw new Error(JSON.stringify(analysis.issues));
    expect(analysis.analysis.ambiguousCards).toEqual(['card-s']);
    expect(analysis.analysis.unambiguousByChallenge).toEqual({ [T.W2]: ['card-c'], [T.W3]: ['card-d'] });
  });

  it('without review, the same board has no usable non-shared cards (unknown is never a distractor)', () => {
    const matrix = policyFor(fakeReviewDataset()).factValidityMatrix([T.W2, T.W3], [
      { id: 'card-c', text: F.labC },
      { id: 'card-d', text: F.labD },
    ]);
    expect(matrix.usableCardIds).toEqual([]);
    expect(matrix.unknownPairs).toEqual([
      { cardId: 'card-c', challengeTopicId: T.W3 },
      { cardId: 'card-d', challengeTopicId: T.W2 },
    ]);
  });
});

describe('C2 review-file validation: malformed files and records', () => {
  const collection = () => asCollection(fakeReviewDataset());
  const good = () => filled(fakeReviewDataset(), 'review.w1-w2', [T.W1, T.W2]);
  const issuesOf = (file: unknown) => validateReviewFile(file, collection()).issues.map(({ code, path }) => ({ code, path }));

  it('accepts a correct file: the record is current', () => {
    const result = validateReviewFile(reviewFile(good()), collection());
    expect(result).toMatchObject({ ok: true, fileUsable: true, issues: [], stale: [] });
    expect(result.records).toEqual([{ index: 0, path: 'reviews[0]', id: 'review.w1-w2', state: 'current', topicIds: [T.W1, T.W2], staleTopicIds: [] }]);
  });

  it('accepts an empty review list', () => {
    expect(validateReviewFile(reviewFile(), collection())).toMatchObject({ ok: true, fileUsable: true, records: [] });
  });

  it.each([
    ['not an object', null, [{ code: R.invalidFile, path: '$' }]],
    ['an array', [], [{ code: R.invalidFile, path: '$' }]],
    ['missing version', { reviews: [] }, [{ code: R.invalidFile, path: 'reviewFormatVersion' }]],
    ['wrong version', { reviewFormatVersion: '2.0.0', reviews: [] }, [{ code: R.unsupportedVersion, path: 'reviewFormatVersion' }]],
    ['reviews not an array', { reviewFormatVersion: '1.0.0', reviews: {} }, [{ code: R.invalidFile, path: 'reviews' }]],
    ['an unknown top-level field', { reviewFormatVersion: '1.0.0', reviews: [], notes: 'x' }, [{ code: R.unknownField, path: 'notes' }]],
  ])('file-level: %s', (_label, file, expected) => {
    expect(issuesOf(file)).toEqual(expected);
    expect(validateReviewFile(file, collection()).fileUsable).toBe(false);
  });

  it.each([
    ['not an object', () => 'x', [{ code: R.invalidRecord, path: 'reviews[0]' }]],
    ['an unknown field', () => ({ ...good(), note: 'x' }), [{ code: R.unknownField, path: 'reviews[0].note' }]],
    ['a malformed id', () => ({ ...good(), id: 'Review 1' }), [{ code: R.invalidId, path: 'reviews[0].id' }]],
    ['a blank reviewer', () => ({ ...good(), reviewedBy: '  ' }), [{ code: R.missingReviewer, path: 'reviews[0].reviewedBy' }]],
    ['the placeholder reviewer', () => ({ ...good(), reviewedBy: '<reviewer name>' }), [{ code: R.missingReviewer, path: 'reviews[0].reviewedBy' }]],
    ['the placeholder date', () => ({ ...good(), reviewedOn: 'YYYY-MM-DD' }), [{ code: R.invalidDate, path: 'reviews[0].reviewedOn' }]],
    ['an impossible date', () => ({ ...good(), reviewedOn: '2026-02-30' }), [{ code: R.invalidDate, path: 'reviews[0].reviewedOn' }]],
    ['an unpadded date', () => ({ ...good(), reviewedOn: '2026-1-5' }), [{ code: R.invalidDate, path: 'reviews[0].reviewedOn' }]],
    ['a changed attestation', () => ({ ...good(), statement: 'Reviewed.' }), [{ code: R.statementMismatch, path: 'reviews[0].statement' }]],
    ['a missing attestation', () => ({ ...good(), statement: undefined }), [{ code: R.statementMismatch, path: 'reviews[0].statement' }]],
    ['topics not an array', () => ({ ...good(), topics: 'W1' }), [{ code: R.invalidRecord, path: 'reviews[0].topics' }]],
    ['only one topic', () => ({ ...good(), topics: good().topics.slice(0, 1) }), [{ code: R.tooFewTopics, path: 'reviews[0].topics' }]],
    ['a repeated topic', () => ({ ...good(), topics: [good().topics[0], good().topics[0]] }), [{ code: R.duplicateTopic, path: 'reviews[0].topics[1].topicId' }]],
    ['an unknown topic', () => ({ ...good(), topics: [good().topics[0], { topicId: 'clinical.topic.nope.workup', fingerprint: 'fp1-0000000000000000' }] }), [{ code: R.unknownTopic, path: 'reviews[0].topics[1].topicId' }]],
    ['a malformed fingerprint', () => ({ ...good(), topics: [good().topics[0], { topicId: T.W2, fingerprint: 'abc' }] }), [{ code: R.invalidFingerprint, path: 'reviews[0].topics[1].fingerprint' }]],
    ['an unknown topic-entry field', () => ({ ...good(), topics: [good().topics[0], { ...good().topics[1], hash: 'x' }] }), [{ code: R.unknownField, path: 'reviews[0].topics[1].hash' }]],
  ])('record-level: %s', (_label, record, expected) => {
    const file = reviewFile(record());
    expect(issuesOf(file)).toEqual(expected);
    const result = validateReviewFile(file, collection());
    expect(result.fileUsable).toBe(true);
    expect(result.records[0]?.state).toBe('invalid');
  });

  it('a duplicate id invalidates the second record only', () => {
    const result = validateReviewFile(reviewFile(good(), good()), collection());
    expect(result.issues.map(({ code, path }) => ({ code, path }))).toEqual([{ code: R.duplicateId, path: 'reviews[1].id' }]);
    expect(result.records.map((r) => r.state)).toEqual(['current', 'invalid']);
  });

  it('an unfilled draft establishes nothing', () => {
    const data = fakeReviewDataset();
    const { draft } = draftReviewRecord(asCollection(data), 'review.w1-w2', [T.W1, T.W2]);
    expect(issuesOf(reviewFile(draft))).toEqual([
      { code: R.missingReviewer, path: 'reviews[0].reviewedBy' },
      { code: R.invalidDate, path: 'reviews[0].reviewedOn' },
    ]);
    expect(policyFor(data, reviewFile(draft)).factRelation(F.labA, T.W2).relation).toBe('unknown');
  });

  it('an invalid record establishes nothing, and does not disable a valid one', () => {
    const data = fakeReviewDataset();
    const broken = { ...filled(data, 'review.w1-w3', [T.W1, T.W3]), statement: 'Looks fine.' };
    const policy = policyFor(data, reviewFile(broken, filled(data, 'review.w1-w2', [T.W1, T.W2])));
    expect(policy.factRelation(F.labA, T.W3).relation).toBe('unknown');
    expect(policy.factRelation(F.labA, T.W2).relation).toBe('invalid');
  });

  it('a file-level problem disables every record', () => {
    const data = fakeReviewDataset();
    const policy = policyFor(data, { ...reviewFile(filled(data, 'review.w1-w2', [T.W1, T.W2])), extra: true });
    expect(policy.factRelation(F.labA, T.W2).relation).toBe('unknown');
  });

  it('never throws for odd values', () => {
    for (const value of [undefined, 0, 'x', [], { reviews: [null, 1, []] }, reviewFile({ topics: [null, 1] })]) {
      expect(() => validateReviewFile(value, collection())).not.toThrow();
    }
  });

  it('the draft helper fills current fingerprints and reports unknown topics', () => {
    const data = fakeReviewDataset();
    const collectionValue = asCollection(data);
    const { draft, unknownTopicIds } = draftReviewRecord(collectionValue, 'review.x', [T.W1, 'clinical.topic.nope.workup', T.W1]);
    expect(unknownTopicIds).toEqual(['clinical.topic.nope.workup']);
    expect(draft.statement).toBe(REVIEW_STATEMENT);
    expect(draft.topics).toEqual([{ topicId: T.W1, fingerprint: topicFingerprint('Test Disease 1', data.subjects[0]!.topics[0]!) }]);
  });
});

describe('C2 stale-review detection', () => {
  const setup = () => {
    const data = fakeReviewDataset();
    const file = reviewFile(filled(data, 'review.w1-w2', [T.W1, T.W2]));
    return { data, file };
  };
  const check = (data: FakeCollection, file: unknown) => validateReviewFile(file, asCollection(data));

  it.each([
    ['a W2 fact is edited', (d: FakeCollection) => void (d.subjects[1]!.topics[0]!.corrects[1]!.text = 'Test shared finding S2')],
    ['a W2 fact is added', (d: FakeCollection) => void d.subjects[1]!.topics[0]!.corrects.push({ id: 'clinical.answer.review-fixture.new', text: 'Test lab finding N' })],
    ['a W2 fact is removed', (d: FakeCollection) => void d.subjects[1]!.topics[0]!.corrects.pop()],
    ['Test Disease 2 is renamed', (d: FakeCollection) => void (d.subjects[1]!.subject = 'Test Disease 2 Renamed')],
    ['W2 changes category', (d: FakeCollection) => void (d.subjects[1]!.topics[0]!.topicName = 'Pathology')],
  ])('becomes stale when %s, names the review and topic, and is no longer used', (_label, change) => {
    const { data, file } = setup();
    change(data);
    const result = check(data, file);
    expect(result.ok).toBe(true); // stale is not a file error; the record is just not used
    expect(result.records[0]).toMatchObject({ id: 'review.w1-w2', state: 'stale', staleTopicIds: [T.W2] });
    expect(result.stale).toHaveLength(1);
    expect(result.stale[0]).toMatchObject({ code: R.stale, path: 'reviews[0].topics[1].fingerprint' });
    expect(result.stale[0]?.message).toContain('review.w1-w2');
    expect(result.stale[0]?.message).toContain(T.W2);
    expect(result.stale[0]?.message).toMatch(/Re-review/);
    expect(createValidityPolicy(asCollection(data), result).factRelation(F.labA, T.W2).relation).toBe('unknown');
  });

  it.each([
    ['facts are reordered', (d: FakeCollection) => void d.subjects[1]!.topics[0]!.corrects.reverse()],
    ['an explanation is added', (d: FakeCollection) => void (d.subjects[1]!.topics[0]!.corrects[0]!.explanation = 'Placeholder explanation.')],
    ['an incorrect is added', (d: FakeCollection) => void d.subjects[1]!.topics[0]!.incorrects.push({ id: 'clinical.answer.review-fixture.inc', text: 'Test lab finding Q' })],
    ['an unrelated topic changes', (d: FakeCollection) => void (d.subjects[2]!.topics[0]!.corrects[0]!.text = 'Test lab finding D2')],
  ])('stays current when %s', (_label, change) => {
    const { data, file } = setup();
    change(data);
    expect(check(data, file).records[0]?.state).toBe('current');
  });

  it('the report offers a renewal draft with the new fingerprints; filled in, it is current again', () => {
    const { data, file } = setup();
    data.subjects[1]!.topics[0]!.corrects[1]!.text = 'Test shared finding S2';
    const result = buildReviewReport(data, file);
    if (!result.ok) throw new Error('expected a report');
    const [stale] = result.report.staleReviews;
    if (stale?.kind !== 'topics') throw new Error('expected a stale topic-group review');
    expect(stale.reviewId).toBe('review.w1-w2');
    expect(stale.changedTopics.map((t) => t.topicId)).toEqual([T.W2]);
    const renewed = reviewFile({ ...stale!.renewalDraft, reviewedBy: 'Test Reviewer', reviewedOn: '2026-11-13' });
    expect(check(data, renewed).records[0]?.state).toBe('current');
  });
});

describe('C2 review report (no clinical judgments)', () => {
  const report = (file?: unknown) => {
    const result = buildReviewReport(fakeReviewDataset(), file);
    if (!result.ok) throw new Error('expected a report');
    return result.report;
  };
  const twoReviews = () => {
    const data = fakeReviewDataset();
    return reviewFile(filled(data, 'review.w1-w2', [T.W1, T.W2]), filled(data, 'review.d1-workup-management', [T.W1, T.M1]));
  };

  it('refuses an invalid dataset with the dataset issues', () => {
    const data = fakeReviewDataset();
    data.subjects[0]!.topics[0]!.topicName = 'Labs';
    const result = buildReviewReport(data);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.issues[0]?.code).toBe('CLINICAL_UNKNOWN_CATEGORY');
  });

  it('summarizes topics, pairs and records (7 topics, 21 pairs)', () => {
    expect(report(twoReviews()).summary).toEqual({
      diseases: 4,
      topics: 7,
      topicPairs: 21,
      reviewedPairs: 2,
      unreviewedPairs: 19,
      records: { current: 2, stale: 0, invalid: 0 },
      alternativeRecords: { current: 0, stale: 0, invalid: 0 },
      alternatives: { listed: 3, reviewed: 0 },
      reviewFileUsable: true,
    });
  });

  it('lists shared facts', () => {
    expect(report().sharedFacts.map((f) => [f.text, f.topics.map((t) => t.topicId)])).toEqual([[F.shared, [T.W2, T.W3]]]);
  });

  it('lists near-identical wording and alternative-diagnosis conflicts', () => {
    const r = report();
    expect(r.nearIdenticalTexts.map((g) => g.texts.map((t) => t.text))).toEqual([[F.signBDot, F.signB]]);
    expect(r.alternativeConflicts.map((c) => [c.path, c.alternative, c.disease, c.sharedFactText])).toEqual([
      ['subjects[1].subjectIncorrects[0].text', 'Test Disease 3', 'Test Disease 2', F.shared],
    ]);
  });

  it('groups unreviewed pairs: 4 same-category, 2 same-disease, 13 other', () => {
    const pairs = report(twoReviews()).unreviewedPairs;
    const count = (kind: string) => pairs.filter((p) => p.kind === kind).length;
    expect([count('sameCategory'), count('sameDisease'), count('crossDiseaseCrossCategory')]).toEqual([4, 2, 13]);
    const sameCategory = pairs.filter((p) => p.kind === 'sameCategory').map((p) => [p.a.topicId, p.b.topicId].sort().join(' + '));
    expect(sameCategory.sort()).toEqual([[T.M1, T.M3].sort().join(' + '), [T.S2, T.S4].sort().join(' + '), [T.W1, T.W3].sort().join(' + '), [T.W2, T.W3].sort().join(' + ')].sort());
  });

  it('measures coverage that restricts generation (W2: 0 usable / 9 unknown, then 2 / 7 after review)', () => {
    // 11 distinct fact texts in the dataset; W2 lists 2 of them as correct, leaving 9.
    const w2 = (r: ReturnType<typeof report>) => r.coverage.topics.find((t) => t.topicId === T.W2);
    expect(w2(report())).toMatchObject({ usableFactDistractors: 0, unknownFacts: 9 });
    // With W1 + W2 reviewed, lab finding A and B become usable for W2.
    expect(w2(report(twoReviews()))).toMatchObject({ usableFactDistractors: 2, unknownFacts: 7 });
  });

  it('reports stale reviews and file problems', () => {
    const data = fakeReviewDataset();
    const file = reviewFile(filled(data, 'review.w1-w2', [T.W1, T.W2]), { ...filled(data, 'review.bad', [T.W1, T.W3]), reviewedOn: 'soon' });
    data.subjects[0]!.subject = 'Test Disease 1 Renamed';
    const result = buildReviewReport(data, file);
    if (!result.ok) throw new Error('expected a report');
    expect(result.report.staleReviews.map((s) => [s.reviewId, s.kind === 'topics' ? s.changedTopics.map((t) => t.topicId) : []])).toEqual([['review.w1-w2', [T.W1]]]);
    expect(result.report.reviewIssues.map((i) => i.code)).toEqual([R.invalidDate]);
    expect(result.report.summary.records).toEqual({ current: 0, stale: 1, invalid: 1 });
  });

  it('formats a readable report with every section and the no-judgment notice', () => {
    const text = formatReviewReport(report(twoReviews()), { limit: 3 });
    expect(text).toContain('It makes no clinical judgments.');
    for (const heading of ['1. Review file problems', '2. Stale reviews', '3. Shared facts', '4. Potentially ambiguous', '5. Unreviewed relationships', '6. Review coverage', '7. Current fingerprints']) {
      expect(text).toContain(heading);
    }
    expect(text).toMatch(/\.\.\. and \d+ more/);
    expect(text).not.toMatch(/\b(true|false|correct answer is)\b/i);
  });
});

describe('C2 authoring templates', () => {
  it('the review template matches the dataset template and fails only on its placeholders', async () => {
    const dataset = validateClinicalCollection(await readJson('../authoring/clinical-dataset.template.json'));
    if (!dataset.ok) throw new Error('dataset template invalid');
    const result = validateReviewFile(await readJson('../authoring/clinical-review.template.json'), dataset.collection);
    expect(result.stale).toEqual([]); // the fingerprints are current
    expect(result.issues.map(({ code, path }) => ({ code, path }))).toEqual([
      { code: R.missingReviewer, path: 'reviews[0].reviewedBy' },
      { code: R.invalidDate, path: 'reviews[0].reviewedOn' },
      { code: R.missingReviewer, path: 'reviews[1].reviewedBy' },
      { code: R.invalidDate, path: 'reviews[1].reviewedOn' },
      { code: R.missingReviewer, path: 'alternativeReviews[0].reviewedBy' },
      { code: R.invalidDate, path: 'alternativeReviews[0].reviewedOn' },
    ]);
  });
});
