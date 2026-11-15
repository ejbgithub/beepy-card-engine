/**
 * M6 stage C5 preparation - loading, validation, default shipped data, sufficiency,
 * review drafts, and the review-report command's output.
 *
 * Fictional data only. The real dataset is owner-authored; until it exists, the
 * shipped-data tests check that the app refuses to start instead of falling back.
 */

import { describe, expect, it } from 'vitest';
import {
  CLINICAL_DATA_CODES as D,
  CLINICAL_DATA_MESSAGES,
  loadClinicalContent,
  parseJsonText,
} from '../src/clinical-data.js';
import { loadShippedClinicalContent, shippedClinicalFiles } from '../src/shipped-data.js';
import { buildAuthoringOutput, checkClinicalSufficiency, suggestReviewDrafts } from '../src/clinical-authoring.js';
import { REVIEW_CODES, REVIEW_PLACEHOLDER_DATE, REVIEW_PLACEHOLDER_REVIEWER, validateReviewFile } from '../src/clinical-review.js';
import { createClinicalSeries, type ClinicalSeriesDiagnostic } from '../src/clinical-series.js';
import { largeFakeDataset, reviewFileFor } from './fixtures/fake-large-clinical.js';
import type { FakeCollection } from './fixtures/fake-clinical.js';

const json = (value: unknown) => JSON.stringify(value, null, 2);
const DATA = largeFakeDataset({ diseases: 16, alternatives: 10 });
const FULL_REVIEW = reviewFileFor(DATA, { topics: 'full', alternatives: true });

const contentOf = (data: FakeCollection, review: unknown) => {
  const loaded = loadClinicalContent({ datasetText: json(data), reviewText: review === undefined ? undefined : json(review), requireReview: false });
  if (!loaded.ok) throw new Error(JSON.stringify(loaded.issues));
  return loaded.content;
};

describe('C5 JSON text parsing', () => {
  it('parses valid JSON, ignoring a UTF-8 byte-order mark', () => {
    expect(parseJsonText('{"a": 1}', 'x.json')).toEqual({ ok: true, value: { a: 1 } });
    expect(parseJsonText('\ufeff{"a": 1}', 'x.json')).toEqual({ ok: true, value: { a: 1 } });
  });

  it('reports a syntax error with the file name, line and column', () => {
    const text = '{\n  "schemaVersion": "1.0.0",\n  "subjects": [,]\n}';
    const result = parseJsonText(text, 'clinical-demo.json');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issue.code).toBe(D.jsonSyntax);
    expect(result.issue.path).toBe('clinical-demo.json');
    expect(result.issue.message).toMatch(/^clinical-demo\.json is not valid JSON at line 3, column 16: an empty item/);
  });

  it.each([
    ['a trailing comma in an array', '{\n  "a": [1, 2,]\n}', 2, 14, /trailing comma before "\]"/],
    ['a trailing comma in an object', '{\n  "a": 1,\n}', 3, 1, /trailing comma before "\}"/],
    ['a missing comma between properties', '{\n  "a": 1\n  "b": 2\n}', 3, 3, /expected "," or "\}"/],
    ['single quotes', "{\n  'a': 1\n}", 2, 3, /single quotes|property name in double quotes/],
    ['an unclosed string', '{\n  "text": "Unclosed\n}', 2, 20, /line break .* inside a quoted string/],
    ['a file that ends early', '{\n  "reviews": [\n', 3, 1, /ends too early/],
    ['a missing colon', '{"a" 1}', 1, 6, /expected ":"/],
  ])('locates %s', (_label, text, line, column, reason) => {
    const result = parseJsonText(text, 'clinical-review.json');
    if (result.ok) throw new Error('expected a syntax error');
    expect(result.issue.message).toContain(`at line ${line}, column ${column}: `);
    expect(result.issue.message).toMatch(reason);
  });

  it('never echoes file content in the message', () => {
    const secret = 'Some long authored sentence that must not be repeated';
    const result = parseJsonText(`{"subjects": [{"subject": "${secret}",]}`, 'clinical-demo.json');
    if (result.ok) throw new Error('expected a syntax error');
    expect(result.issue.message).not.toContain(secret);
  });
});

describe('C5 loading and validating both files', () => {
  const datasetText = json(DATA);
  const reviewText = json(FULL_REVIEW);

  it('accepts a valid dataset and review file and returns them exactly as authored', () => {
    const loaded = loadClinicalContent({ datasetText, reviewText });
    if (!loaded.ok) throw new Error(JSON.stringify(loaded.issues));
    expect(loaded.content.datasetValue).toEqual(DATA);
    expect(loaded.content.reviewValue).toEqual(FULL_REVIEW);
    expect(loaded.content.review.records.every((r) => r.state === 'current')).toBe(true);
  });

  it.each([
    ['a missing dataset', { datasetText: undefined, reviewText }, D.dataMissing, D.dataMissing],
    ['a dataset syntax error', { datasetText: '{ "subjects": [ }', reviewText }, D.dataInvalid, D.jsonSyntax],
    ['an invalid dataset', { datasetText: json({ ...DATA, subjects: [] }), reviewText }, D.dataInvalid, 'CLINICAL_NO_DISEASES'],
    ['a missing review file', { datasetText, reviewText: undefined }, D.reviewMissing, D.reviewMissing],
    ['a review syntax error', { datasetText, reviewText: '{ "reviews": ' }, D.reviewInvalid, D.jsonSyntax],
    ['an unusable review file', { datasetText, reviewText: json({ reviewFormatVersion: '9.0.0', reviews: [] }) }, D.reviewInvalid, REVIEW_CODES.unsupportedVersion],
  ])('refuses %s with a friendly message and structured issues', (_label, input, code, issueCode) => {
    const loaded = loadClinicalContent(input);
    expect(loaded.ok).toBe(false);
    if (loaded.ok) return;
    expect(loaded.code).toBe(code);
    expect(loaded.message).toBe(CLINICAL_DATA_MESSAGES[loaded.code]);
    expect(loaded.message).not.toMatch(/Test Disease|subjects|\[/);
    expect(loaded.issues.map((i) => i.code)).toContain(issueCode);
  });

  it('dataset issues carry the file name and the exact path', () => {
    const broken = largeFakeDataset({ diseases: 3 });
    broken.subjects[1]!.topics[2]!.topicName = 'Labs';
    const loaded = loadClinicalContent({ datasetText: json(broken), reviewText: undefined });
    if (loaded.ok) throw new Error('expected a refusal');
    expect(loaded.issues).toEqual([expect.objectContaining({ code: 'CLINICAL_UNKNOWN_CATEGORY', path: 'clinical-demo.json: subjects[1].topics[2].topicName' })]);
  });

  it('a bad record inside a usable review file is not fatal: it is listed and not used', () => {
    const review = { ...(FULL_REVIEW as object), reviews: [...(FULL_REVIEW as { reviews: unknown[] }).reviews, { id: 'bad id' }] };
    const loaded = loadClinicalContent({ datasetText, reviewText: json(review) });
    if (!loaded.ok) throw new Error('expected success');
    expect(loaded.content.review.issues.length).toBeGreaterThan(0);
    expect(loaded.content.review.records.at(-1)?.state).toBe('invalid');
  });
});

describe('C5 shipped data is the default, with no fallback', () => {
  const shipped = shippedClinicalFiles();
  const present = shipped.datasetText !== undefined && shipped.reviewText !== undefined;
  const none = shipped.datasetText === undefined && shipped.reviewText === undefined;
  const datasetOnly = shipped.datasetText !== undefined && shipped.reviewText === undefined;

  it.runIf(datasetOnly)('dataset present, review file not yet (C5 in progress): the dataset validates without placeholder text, and the series refuses to start', () => {
    const loaded = loadClinicalContent({ datasetText: shipped.datasetText, reviewText: undefined, requireReview: false });
    if (!loaded.ok) throw new Error(`shipped dataset refused: ${JSON.stringify(loaded.issues, null, 2)}`);
    expect(shipped.datasetText).not.toMatch(/Test Disease|Test Alternative|Example Disease|Replace:|Placeholder explanation/);
    expect(loadShippedClinicalContent()).toMatchObject({ ok: false, code: D.reviewMissing });
    expect(createClinicalSeries({ mode: 'solitaire', seed: 1 })).toEqual({
      ok: false,
      error: { code: D.reviewMissing, message: CLINICAL_DATA_MESSAGES.CLINICAL_REVIEW_MISSING },
    });
  });

  it.runIf(none)('no owner files yet: loading reports MISSING, and the series refuses to start', () => {
    expect(loadShippedClinicalContent()).toMatchObject({ ok: false, code: D.dataMissing, message: CLINICAL_DATA_MESSAGES.CLINICAL_DATA_MISSING });
    const seen: ClinicalSeriesDiagnostic[] = [];
    const created = createClinicalSeries({ mode: 'solitaire', seed: 1, diagnostics: (d) => seen.push(d) });
    expect(created).toEqual({ ok: false, error: { code: D.dataMissing, message: CLINICAL_DATA_MESSAGES.CLINICAL_DATA_MISSING } });
    expect(seen.some((d) => 'contentIssues' in d)).toBe(true);
  });

  it.runIf(present)('owner files present (C5 gate): both validate, contain no placeholder or test text, and are playable', () => {
    const loaded = loadShippedClinicalContent();
    if (!loaded.ok) throw new Error(`shipped content refused: ${JSON.stringify(loaded.issues, null, 2)}`);
    expect(`${shipped.datasetText}${shipped.reviewText}`).not.toMatch(/Test Disease|Test Alternative|Example Disease|Replace:|<reviewer name>|YYYY-MM-DD|Placeholder explanation/);
    expect(loaded.content.review.issues).toEqual([]);
    expect(checkClinicalSufficiency(loaded.content).allPlayable).toBe(true);
  });

  it('explicit injection still works and is validated the same way', () => {
    expect(createClinicalSeries({ mode: 'solitaire', seed: 1, dataset: DATA, review: FULL_REVIEW }).ok).toBe(true);
    expect(createClinicalSeries({ mode: 'solitaire', seed: 1, dataset: { schemaVersion: '1.0.0', subjects: [] } })).toMatchObject({ ok: false, error: { code: D.dataInvalid } });
  });
});

describe('C5 deck sufficiency (real generator, fictional data)', () => {
  it('full review coverage: every combination is playable at full size', () => {
    const result = checkClinicalSufficiency(contentOf(DATA, FULL_REVIEW), { seeds: 10 });
    expect(result.allPlayable).toBe(true);
    for (const c of result.combinations) expect(c).toMatchObject({ attempts: 10, generated: 10, fullSize: 10, minCards: c.targetCardCount, maxCards: c.targetCardCount });
  });

  it('category-only coverage without alternative reviews: fact -> disease vsBeepy is playable but reduced to 16', () => {
    const result = checkClinicalSufficiency(contentOf(DATA, reviewFileFor(DATA, { topics: 'category' })), { seeds: 10 });
    const combo = result.combinations.find((c) => c.mode === 'vsBeepy' && c.direction === 'factToSubject')!;
    expect(combo).toMatchObject({ playable: true, fullSize: 0, minCards: 16, maxCards: 16 });
  });

  it('no review coverage: nothing is playable, and the failure code is reported', () => {
    const result = checkClinicalSufficiency(contentOf(DATA, undefined), { seeds: 5 });
    expect(result.allPlayable).toBe(false);
    for (const c of result.combinations) expect(c).toMatchObject({ playable: false, generated: 0, failures: { INSUFFICIENT_CHALLENGES: 5 } });
  });

  it('too few diseases for a 9-challenge fact -> disease board is reported as not playable', () => {
    const small = largeFakeDataset({ diseases: 8 });
    const result = checkClinicalSufficiency(contentOf(small, reviewFileFor(small, { topics: 'full' })), { seeds: 5 });
    expect(result.combinations.find((c) => c.mode === 'vsBeepy' && c.direction === 'factToSubject')?.playable).toBe(false);
    expect(result.combinations.find((c) => c.mode === 'solitaire' && c.direction === 'subjectToFact')?.playable).toBe(true);
  });
});

describe('C5 suggested review drafts attest nothing', () => {
  const collection = contentOf(DATA, undefined).collection;
  const drafts = suggestReviewDrafts(collection);

  it('suggests one group per category, one per disease, and one alternative review per disease', () => {
    expect(drafts.reviews.map((r) => r.id).slice(0, 4)).toEqual(['review.category.signs', 'review.category.workup', 'review.category.pathology', 'review.category.management']);
    expect(drafts.reviews).toHaveLength(4 + 16);
    expect(drafts.reviews[4]?.id).toBe('review.disease.test-disease-1');
    expect(drafts.alternativeReviews).toHaveLength(16);
    expect(drafts.reviews[0]?.topics).toHaveLength(16);
  });

  it('every draft carries placeholders, so as-is it is rejected and establishes nothing', () => {
    for (const r of [...drafts.reviews, ...drafts.alternativeReviews]) {
      expect(r.reviewedBy).toBe(REVIEW_PLACEHOLDER_REVIEWER);
      expect(r.reviewedOn).toBe(REVIEW_PLACEHOLDER_DATE);
    }
    const validated = validateReviewFile(drafts, collection);
    expect(validated.fileUsable).toBe(true);
    expect([...validated.records, ...validated.alternativeRecords].every((r) => r.state === 'invalid')).toBe(true);
    expect(checkClinicalSufficiency(contentOf(DATA, drafts), { seeds: 3 }).allPlayable).toBe(false);
  });

  it('once a reviewer fills in name and date, the fingerprints are current (category + disease groups make all four combinations playable here)', () => {
    const fill = <T extends object>(r: T) => ({ ...r, reviewedBy: 'Test Reviewer', reviewedOn: '2026-11-12' });
    const filled = { ...drafts, reviews: drafts.reviews.map(fill), alternativeReviews: drafts.alternativeReviews.map(fill) };
    const validated = validateReviewFile(filled, collection);
    expect([...validated.records, ...validated.alternativeRecords].every((r) => r.state === 'current')).toBe(true);
    expect(checkClinicalSufficiency(contentOf(DATA, filled), { seeds: 5 }).allPlayable).toBe(true);
  });
});

describe('C5 review-report command output', () => {
  it('no dataset: a blocking problem that says which file to create', () => {
    const out = buildAuthoringOutput({ datasetText: undefined, reviewText: undefined, seeds: 2 });
    expect(out.problems).toEqual([expect.stringMatching(/clinical-demo\.json does not exist yet\. Create clinical-cards\/src\/data\/clinical-demo\.json .*npm run convert -w clinical-cards/)]);
    expect(out.summary).toMatch(/^CLINICAL CONTENT CHECK: BLOCKED/);
  });

  it('first run (dataset, no review file): no blocking problem; report and drafts are written', () => {
    const out = buildAuthoringOutput({ datasetText: json(DATA), reviewText: undefined, seeds: 2 });
    expect(out.problems).toEqual([]);
    expect(out.warnings.some((w) => /clinical-review\.json does not exist yet/.test(w))).toBe(true);
    expect(Object.keys(out.files).sort()).toEqual(['review-drafts.json', 'review-report.txt']);
    expect(JSON.parse(out.files['review-drafts.json']!)).toEqual(suggestReviewDrafts(contentOf(DATA, undefined).collection));
    const report = out.files['review-report.txt']!;
    for (const heading of ['DECK SUFFICIENCY', 'CLINICAL REVIEW REPORT', 'It makes no clinical judgments.', '7. Current fingerprints']) expect(report).toContain(heading);
    expect(report).toMatch(/NOT PLAYABLE/);
  });

  it('a fully reviewed fictional dataset: valid and playable', () => {
    const out = buildAuthoringOutput({ datasetText: json(DATA), reviewText: json(FULL_REVIEW), seeds: 3 });
    expect(out.problems).toEqual([]);
    expect(out.summary).toMatch(/^CLINICAL CONTENT CHECK: VALID\n/);
    expect(out.summary.match(/^ {2}PLAYABLE {4}/gm)).toHaveLength(4);
  });

  it('record errors are blocking; stale records are notes', () => {
    const local = largeFakeDataset({ diseases: 16, alternatives: 10 });
    const review = reviewFileFor(local, { topics: 'full', alternatives: true }) as { reviews: unknown[]; alternativeReviews: unknown[] };
    local.subjects[0]!.subjectIncorrects[0]!.text = 'Test Alternative Diagnosis 1 renamed';
    const withBad = { ...review, reviews: [...review.reviews, { id: 'bad id' }] };
    const out = buildAuthoringOutput({ datasetText: json(local), reviewText: json(withBad), seeds: 2 });
    expect(out.problems.length).toBeGreaterThan(0);
    expect(out.problems.every((p) => p.includes('clinical-review.json'))).toBe(true);
    expect(out.warnings.some((w) => w.startsWith(`[${REVIEW_CODES.stale}]`))).toBe(true);
  });

  it('a JSON syntax error is blocking and located', () => {
    const out = buildAuthoringOutput({ datasetText: json(DATA), reviewText: '{\n "reviews": [\n', seeds: 2 });
    expect(out.problems).toEqual([expect.stringMatching(/^\[CLINICAL_JSON_SYNTAX\] clinical-review\.json: clinical-review\.json is not valid JSON/)]);
  });
});
