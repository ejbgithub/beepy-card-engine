/**
 * M6 C5 authoring workflow - the simplified authoring format and its converter.
 *
 * Fictional data only, except the last block, which checks that the owner's own
 * authoring file converts and that clinical-demo.json is up to date with it. Those
 * tests read the owner's content; they never create or change clinical content.
 */

import { describe, expect, it } from 'vitest';
import { isValidId, type SubjectCollection } from '@beepy/shared-engine';
import {
  AUTHORING_CATEGORY_FIELDS,
  AUTHORING_CODES as A,
  addBlankDisease,
  blankDisease,
  convertAuthoring,
  convertAuthoringText,
  decideOverwrite,
  generatedFingerprint,
  slugify,
  type AuthoringFile,
} from '../src/clinical-authoring-format.js';
import { CLINICAL_CATEGORIES, categoryOfTopicName } from '../src/clinical-content.js';
import { generateClinicalDeck } from '../src/clinical-generator.js';
import { draftAlternativeReview, draftReviewRecord, validateReviewFile } from '../src/clinical-review.js';
import { createClinicalSeries } from '../src/clinical-series.js';
import { shippedClinicalFiles } from '../src/shipped-data.js';
import { largeFakeDataset, reviewFileFor } from './fixtures/fake-large-clinical.js';
import type { FakeCollection } from './fixtures/fake-clinical.js';

async function readText(relative: string): Promise<string | undefined> {
  const specifier = 'node:fs/promises';
  const fs = (await import(/* @vite-ignore */ specifier)) as { readFile(path: URL, encoding: string): Promise<string> };
  try {
    return await fs.readFile(new URL(relative, import.meta.url), 'utf8');
  } catch {
    return undefined;
  }
}

const ok = (result: ReturnType<typeof convertAuthoring>) => {
  if (!result.ok) throw new Error(JSON.stringify(result.issues, null, 2));
  return result;
};
const issuesOf = (value: unknown) => {
  const result = convertAuthoring(value);
  return result.ok ? [] : result.issues.map(({ code, path }) => ({ code, path }));
};

/** A fictional disease in the simplified format. */
const fictional = (): AuthoringFile => ({
  diseases: [
    {
      name: 'Test Disease Alpha',
      alternativeDiagnoses: ['Test Alternative One', { text: 'Test Alternative Two', explanation: 'Placeholder: why Two is different.' }],
      signs: { correct: ['Test sign one', { text: 'Test sign two', explanation: 'Placeholder sign explanation.' }], incorrect: ['Test non-sign'] },
      workup: { correct: ['Test work-up finding'], incorrect: [] },
      pathology: { correct: [{ text: 'Test mechanism', explanation: '' }], incorrect: [] },
      management: { correct: ['Test treatment; with punctuation (kept)'], incorrect: [{ text: 'Test non-treatment', explanation: 'Placeholder: not used.' }] },
    },
    {
      name: 'Test Disease Beta',
      workup: { correct: ['Test Beta work-up'] },
    },
  ],
});

/** Convert the fictional large fixture into the simplified format (test helper). */
function toAuthoring(data: FakeCollection): AuthoringFile {
  const fact = (e: { text: string; explanation?: string }) => (e.explanation === undefined ? e.text : { text: e.text, explanation: e.explanation });
  return {
    diseases: data.subjects.map((s) => ({
      name: s.subject,
      alternativeDiagnoses: s.subjectIncorrects.map(fact),
      ...Object.fromEntries(s.topics.map((t) => [categoryOfTopicName(t.topicName) as string, { correct: t.corrects.map(fact), incorrect: t.incorrects.map(fact) }])),
    })),
  };
}

describe('conversion to the M2 SubjectCollection', () => {
  const { collection } = ok(convertAuthoring(fictional()));
  const alpha = collection.subjects[0]!;

  it('produces all four categories with the exact M2 topic names, in a fixed order', () => {
    expect(alpha.topics.map((t) => t.topicName)).toEqual(CLINICAL_CATEGORIES.map((c) => c.topicName));
    expect(alpha.topics.map((t) => t.id)).toEqual(AUTHORING_CATEGORY_FIELDS.map((k) => `clinical.topic.test-disease-alpha.${k}`));
    expect(alpha.id).toBe('clinical.subject.test-disease-alpha');
    expect(alpha.subject).toBe('Test Disease Alpha');
  });

  it('copies strings and objects verbatim; a blank explanation is omitted, never invented', () => {
    const [signs, , pathology, management] = alpha.topics;
    expect(signs!.corrects.map((e) => [e.text, e.explanation])).toEqual([
      ['Test sign one', undefined],
      ['Test sign two', 'Placeholder sign explanation.'],
    ]);
    expect(signs!.incorrects.map((e) => e.text)).toEqual(['Test non-sign']);
    expect(pathology!.corrects[0]).toEqual({ id: expect.any(String), text: 'Test mechanism' });
    expect('explanation' in pathology!.corrects[0]!).toBe(false);
    expect(management!.corrects[0]!.text).toBe('Test treatment; with punctuation (kept)');
    expect(management!.incorrects[0]!.explanation).toBe('Placeholder: not used.');
  });

  it('converts alternative diagnoses (strings and objects)', () => {
    expect(alpha.subjectIncorrects.map((e) => [e.text, e.explanation])).toEqual([
      ['Test Alternative One', undefined],
      ['Test Alternative Two', 'Placeholder: why Two is different.'],
    ]);
  });

  it('omits empty and missing categories', () => {
    const beta = collection.subjects[1]!;
    expect(beta.topics.map((t) => t.topicName)).toEqual(['Work-up']);
    expect(beta.subjectIncorrects).toEqual([]);
    expect(beta.topics[0]!.incorrects).toEqual([]);
  });

  it('every id is valid, in the clinical namespace, and unique', () => {
    const ids = collection.subjects.flatMap((s) => [s.id, ...s.subjectIncorrects.map((e) => e.id), ...s.topics.flatMap((t) => [t.id, ...t.corrects.map((e) => e.id), ...t.incorrects.map((e) => e.id)])]);
    expect(ids.every((id) => isValidId(id) && id.startsWith('clinical.'))).toBe(true);
    expect(new Set(ids).size).toBe(ids.length);
    expect(alpha.topics[0]!.corrects[0]!.id).toMatch(/^clinical\.answer\.test-disease-alpha\.signs\.fact\.test-sign-one-[0-9a-f]{8}$/);
    expect(alpha.topics[0]!.incorrects[0]!.id).toMatch(/^clinical\.answer\.test-disease-alpha\.signs\.not\.test-non-sign-[0-9a-f]{8}$/);
    expect(alpha.subjectIncorrects[0]!.id).toMatch(/^clinical\.answer\.test-disease-alpha\.alternative\.test-alternative-one-[0-9a-f]{8}$/);
  });

  it('is deterministic and does not modify its input', () => {
    const input = fictional();
    const before = JSON.stringify(input);
    expect(ok(convertAuthoring(input)).json).toBe(ok(convertAuthoring(fictional())).json);
    expect(JSON.stringify(input)).toBe(before);
  });

  it('slugs are lowercase, hyphenated and diacritic-free', () => {
    expect(slugify("Crohn's Disease (Ileal)")).toBe('crohn-s-disease-ileal');
    expect(slugify('Ménière Disease')).toBe('meniere-disease');
    expect(slugify('***')).toBe('x');
  });
});

describe('stable identifiers', () => {
  const idsByText = (collection: SubjectCollection) =>
    new Map(collection.subjects.flatMap((s) => [...s.subjectIncorrects, ...s.topics.flatMap((t) => [...t.corrects, ...t.incorrects])].map((e) => [e.text, e.id] as const)));

  it('reordering facts, alternatives and diseases changes no id', () => {
    const original = ok(convertAuthoring(fictional())).collection;
    const shuffled = fictional() as unknown as { diseases: Array<Record<string, unknown>> };
    shuffled.diseases.reverse();
    const alpha = shuffled.diseases[1] as { signs: { correct: unknown[] }; alternativeDiagnoses: unknown[] };
    alpha.signs.correct.reverse();
    alpha.alternativeDiagnoses.reverse();
    const reordered = ok(convertAuthoring(shuffled)).collection;
    expect(idsByText(reordered)).toEqual(idsByText(original));
    expect(new Set(reordered.subjects.map((s) => s.id))).toEqual(new Set(original.subjects.map((s) => s.id)));
  });

  it('editing a fact changes only that fact\u2019s id; topic ids stay the same', () => {
    const original = ok(convertAuthoring(fictional())).collection;
    const edited = fictional() as unknown as { diseases: Array<{ signs?: { correct: unknown[] } }> };
    edited.diseases[0]!.signs!.correct[0] = 'Test sign one, edited';
    const after = ok(convertAuthoring(edited)).collection;
    expect(after.subjects[0]!.topics.map((t) => t.id)).toEqual(original.subjects[0]!.topics.map((t) => t.id));
    const before = idsByText(original);
    const now = idsByText(after);
    expect(now.get('Test sign one, edited')).not.toBe(before.get('Test sign one'));
    expect(now.get('Test sign two')).toBe(before.get('Test sign two'));
  });
});

describe('validation errors are reported in the authoring file\u2019s terms', () => {
  const one = (disease: Record<string, unknown>) => ({ diseases: [disease] });
  const base = () => ({ name: 'Test Disease Gamma', signs: { correct: ['Test sign A'], incorrect: [] } });

  it.each([
    ['an unknown top-level field', { diseases: [base()], notes: 'x' }, [{ code: A.unknownField, path: 'notes' }]],
    ['a misspelled category', one({ ...base(), workUp: { correct: ['x'] } }), [{ code: A.unknownField, path: 'diseases[0].workUp' }]],
    ['a misspelled array', one({ ...base(), workup: { corect: ['x'] } }), [{ code: A.unknownField, path: 'diseases[0].workup.corect' }]],
    ['a fact that is a number', one({ ...base(), workup: { correct: [5] } }), [{ code: A.invalidType, path: 'diseases[0].workup.correct[0]' }]],
    ['a non-string explanation', one({ ...base(), workup: { correct: [{ text: 'Test x', explanation: 3 }] } }), [{ code: A.invalidType, path: 'diseases[0].workup.correct[0].explanation' }]],
    ['a category that is not an object', one({ ...base(), workup: ['Test x'] }), [{ code: A.invalidType, path: 'diseases[0].workup' }]],
    ['a missing name', one({ signs: { correct: ['Test sign A'] } }), [{ code: A.invalidType, path: 'diseases[0].name' }]],
    ['an empty name', one({ ...base(), name: '  ' }), [{ code: 'CLINICAL_EMPTY_TEXT', path: 'diseases[0].name' }]],
    ['a disease with no facts', one({ name: 'Test Disease Gamma' }), [{ code: 'CLINICAL_NO_CATEGORIES', path: 'diseases[0]' }]],
    ['incorrect facts without any correct fact', one({ ...base(), workup: { correct: [], incorrect: ['Test x'] } }), [{ code: 'CLINICAL_NO_FACTS', path: 'diseases[0].workup.correct' }]],
    ['more than three correct facts', one({ ...base(), signs: { correct: ['Test 1', 'Test 2', 'Test 3', 'Test 4'] } }), [{ code: 'CLINICAL_TOO_MANY_FACTS', path: 'diseases[0].signs.correct' }]],
    ['a fact longer than 140 characters', one({ ...base(), workup: { correct: ['y'.repeat(141)] } }), [{ code: 'CLINICAL_TEXT_TOO_LONG', path: 'diseases[0].workup.correct[0]' }]],
    ['the same fact twice in one list', one({ ...base(), signs: { correct: ['Test sign A', 'Test sign A'] } }), [{ code: A.duplicateId, path: 'diseases[0].signs.correct[1]' }]],
    ['the same fact twice ignoring case', one({ ...base(), signs: { correct: ['Test sign A', ' test SIGN a'] } }), [{ code: A.duplicateId, path: 'diseases[0].signs.correct[1]' }]],
    ['a fact listed as correct and incorrect', one({ ...base(), signs: { correct: ['Test sign A'], incorrect: ['Test sign A'] } }), [{ code: 'CLINICAL_CONTRADICTORY_ENTRY', path: 'diseases[0].signs.incorrect[0]' }]],
    ['an alternative that is the disease itself', one({ ...base(), alternativeDiagnoses: ['test disease gamma'] }), [{ code: 'CLINICAL_ALTERNATIVE_IS_DISEASE', path: 'diseases[0].alternativeDiagnoses[0]' }]],
    ['two diseases with the same name', { diseases: [base(), base()] }, [{ code: A.duplicateId, path: 'diseases[1].name' }]],
  ])('%s', (_label, value, expected) => {
    expect(issuesOf(value)).toEqual(expected);
  });

  it('a file that is not { "diseases": [...] } is refused', () => {
    for (const bad of [null, [], { diseases: {} }, 'x']) expect(issuesOf(bad)).toEqual([{ code: A.invalidFile, path: '$' }]);
  });

  it('malformed JSON is located by line and column', () => {
    const result = convertAuthoringText('{\n  "diseases": [\n    { "name": "Test Disease Delta", }\n  ]\n}');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues[0]?.code).toBe(A.jsonSyntax);
      expect(result.issues[0]?.message).toMatch(/at line 3, column \d+: a trailing comma before "\}"/);
    }
  });
});

describe('the blank-disease helper writes no content', () => {
  it('starts a new file with one blank disease containing all four categories', () => {
    const result = addBlankDisease(undefined);
    if (!result.ok) throw new Error('expected text');
    expect(JSON.parse(result.text)).toEqual({ diseases: [blankDisease()] });
    expect(blankDisease()).toEqual({
      name: '',
      alternativeDiagnoses: [],
      signs: { correct: [], incorrect: [] },
      workup: { correct: [], incorrect: [] },
      pathology: { correct: [], incorrect: [] },
      management: { correct: [], incorrect: [] },
    });
  });

  it('appends to an existing file, preserving every existing entry exactly', () => {
    const existing = `${JSON.stringify(fictional())}\n`;
    const result = addBlankDisease(existing, 'Test Disease Epsilon');
    if (!result.ok) throw new Error('expected text');
    const parsed = JSON.parse(result.text) as AuthoringFile;
    expect(parsed.diseases.slice(0, 2)).toEqual(fictional().diseases);
    expect(parsed.diseases[2]).toEqual(blankDisease('Test Disease Epsilon'));
  });

  it('refuses to touch a file it cannot parse', () => {
    expect(addBlankDisease('{ "diseases": [ ', 'x')).toMatchObject({ ok: false, issues: [{ code: A.jsonSyntax }] });
  });

  it('a blank disease cannot be converted until the owner fills it in', () => {
    expect(issuesOf({ diseases: [blankDisease()] }).map((i) => i.code)).toEqual(['CLINICAL_EMPTY_TEXT', 'CLINICAL_NO_CATEGORIES']);
  });
});

describe('never silently overwrite owner content', () => {
  const generated = 'generated text\n';
  it.each([
    ['no file yet', undefined, undefined, false, 'write'],
    ['already up to date', 'new\n', undefined, false, 'unchanged'],
    ['the file is the converter\u2019s last output', generated, generatedFingerprint(generated), false, 'write'],
    ['the file was edited by hand after conversion', 'edited\n', generatedFingerprint(generated), false, 'refuse'],
    ['a hand-written file with no record', 'hand written\n', undefined, false, 'refuse'],
    ['a hand-written file, overwrite explicitly allowed', 'hand written\n', undefined, true, 'write'],
  ] as const)('%s -> %s', (_label, existingText, recordedFingerprint, overwriteAllowed, expected) => {
    expect(decideOverwrite({ existingText, recordedFingerprint, newText: 'new\n', overwriteAllowed })).toBe(expected);
  });
});

describe('review safeguards work with converted data', () => {
  const fill = <T extends object>(r: T) => ({ ...r, reviewedBy: 'Test Reviewer', reviewedOn: '2026-11-12' });
  const reviewFor = (collection: SubjectCollection) => ({
    reviewFormatVersion: '1.0.0',
    reviews: [fill(draftReviewRecord(collection, 'review.alpha-beta-workup', ['clinical.topic.test-disease-alpha.workup', 'clinical.topic.test-disease-beta.workup']).draft)],
    alternativeReviews: [fill(draftAlternativeReview(collection, 'review.alternatives.alpha', 'clinical.subject.test-disease-alpha')!.draft)],
  });

  it('the converter creates no review records; reviews built on converted ids are current', () => {
    const { collection, json } = ok(convertAuthoring(fictional()));
    expect(json).not.toMatch(/reviewedBy|statement|fingerprint/);
    const result = validateReviewFile(reviewFor(collection), collection);
    expect([...result.records, ...result.alternativeRecords].map((r) => r.state)).toEqual(['current', 'current']);
  });

  it('reordering in the authoring file keeps reviews current', () => {
    const review = reviewFor(ok(convertAuthoring(fictional())).collection);
    const shuffled = fictional() as unknown as { diseases: Array<Record<string, unknown>> };
    shuffled.diseases.reverse();
    const after = ok(convertAuthoring(shuffled)).collection;
    const result = validateReviewFile(review, after);
    expect([...result.records, ...result.alternativeRecords].map((r) => r.state)).toEqual(['current', 'current']);
  });

  it('editing a reviewed fact in the authoring file makes the covering reviews stale', () => {
    const review = reviewFor(ok(convertAuthoring(fictional())).collection);
    const edited = fictional() as unknown as { diseases: Array<{ workup?: { correct: unknown[] } }> };
    edited.diseases[0]!.workup!.correct[0] = 'Test work-up finding, edited';
    const after = ok(convertAuthoring(edited)).collection;
    const result = validateReviewFile(review, after);
    expect(result.records[0]).toMatchObject({ id: 'review.alpha-beta-workup', state: 'stale', staleTopicIds: ['clinical.topic.test-disease-alpha.workup'] });
    expect(result.alternativeRecords[0]).toMatchObject({ id: 'review.alternatives.alpha', state: 'stale' });
    expect(result.stale.map((s) => s.message).join(' ')).toMatch(/review\.alpha-beta-workup/);
  });
});

describe('compatibility with the existing generator and series', () => {
  const data = largeFakeDataset({ diseases: 16, alternatives: 10 });
  const { collection } = ok(convertAuthoring(toAuthoring(data)));
  const review = reviewFileFor(collection as unknown as FakeCollection, { topics: 'full', alternatives: true });

  it.each([
    ['solitaire', 'subjectToFact'],
    ['vsBeepy', 'subjectToFact'],
    ['solitaire', 'factToSubject'],
    ['vsBeepy', 'factToSubject'],
  ] as const)('%s / %s: full-size decks from converted data', (mode, direction) => {
    for (let seed = 1; seed <= 5; seed += 1) {
      const result = generateClinicalDeck({
        source: collection,
        config: { app: 'clinical', generationDirection: direction },
        mode,
        challengeCount: mode === 'solitaire' ? 5 : 9,
        targetCardCount: mode === 'solitaire' ? 15 : 24,
        seed,
        review,
      });
      if (!result.ok) throw new Error(JSON.stringify(result.issues));
      expect(result.deck.answerCards).toHaveLength(mode === 'solitaire' ? 15 : 24);
    }
  });

  it('the converted texts equal the source texts exactly', () => {
    const texts = (c: { subjects: readonly { subject: string; subjectIncorrects: readonly { text: string }[]; topics: readonly { corrects: readonly { text: string }[]; incorrects: readonly { text: string }[] }[] }[] }) =>
      c.subjects.flatMap((s) => [s.subject, ...s.subjectIncorrects.map((e) => e.text), ...s.topics.flatMap((t) => [...t.corrects, ...t.incorrects].map((e) => e.text))]);
    expect(texts(collection)).toEqual(texts(data));
  });

  it('a series starts from converted data', () => {
    const created = createClinicalSeries({ mode: 'vsBeepy', seed: 3, dataset: collection, review });
    if (!created.ok) throw new Error(created.error.code);
    expect(created.series.startNextGame().ok).toBe(true);
  });
});

describe('the owner\u2019s files (reads owner content; creates none)', () => {
  it('the template has all four category fields and converts to "fill me in" errors only', async () => {
    const text = await readText('../authoring/clinical-authoring.template.json');
    const value = JSON.parse(text!) as AuthoringFile;
    expect(value).toEqual({ diseases: [blankDisease()] });
    expect(convertAuthoringText(text!).ok).toBe(false);
  });

  it('clinical-authoring.json converts, and clinical-demo.json is exactly its current conversion', async () => {
    const authoring = await readText('../authoring/clinical-authoring.json');
    if (authoring === undefined) return; // nothing authored yet
    const converted = convertAuthoringText(authoring);
    if (!converted.ok) throw new Error(`clinical-authoring.json does not convert:\n${JSON.stringify(converted.issues, null, 2)}`);
    const shipped = shippedClinicalFiles().datasetText;
    expect(shipped, 'run: npm run convert -w clinical-cards').toBe(converted.json);
    // Every authored text appears verbatim in the shipped dataset.
    const value = JSON.parse(authoring) as AuthoringFile;
    const authoredTexts = value.diseases.flatMap((d) => [
      d.name,
      ...(d.alternativeDiagnoses ?? []).map((f) => (typeof f === 'string' ? f : f.text)),
      ...AUTHORING_CATEGORY_FIELDS.flatMap((k) => [...(d[k]?.correct ?? []), ...(d[k]?.incorrect ?? [])].map((f) => (typeof f === 'string' ? f : f.text))),
    ]);
    for (const text of authoredTexts) expect(shipped).toContain(JSON.stringify(text));
  });
});
