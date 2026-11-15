/**
 * M6 stage C1 - Clinical content validation (requirements Req 2; design section 3).
 *
 * All data here is fictitious placeholder text from the test fixture or the
 * authoring template. No clinical facts are used or invented.
 */

import { describe, expect, it } from 'vitest';
import { validateCollectionSource } from '@beepy/shared-engine';
import {
  CLINICAL_CATEGORIES,
  CLINICAL_CONTENT_CODES,
  CLINICAL_MAX_CARD_TEXT_LENGTH,
  CLINICAL_MAX_FACTS_PER_CATEGORY,
  cardTextLength,
  categoryOfTopicName,
  validateClinicalCollection,
  type ClinicalContentCode,
} from '../src/clinical-content.js';
import { allCardTexts, fakeClinicalCollection, type FakeCollection } from './fixtures/fake-clinical.js';

const C = CLINICAL_CONTENT_CODES;

async function readText(relative: string): Promise<string> {
  const specifier = 'node:fs/promises';
  const fs = (await import(/* @vite-ignore */ specifier)) as { readFile(path: URL, encoding: string): Promise<string> };
  return fs.readFile(new URL(relative, import.meta.url), 'utf8');
}

/** Apply one change to a fresh fixture and return it. */
const withChange = (change: (data: FakeCollection) => void): FakeCollection => {
  const data = fakeClinicalCollection();
  change(data);
  return data;
};

/** The exact Clinical issue list as (code, path) pairs. */
const clinicalIssues = (value: unknown): { code: string; path: string }[] => {
  const result = validateClinicalCollection(value);
  if (result.ok) return [];
  expect(result.stage).toBe('clinical');
  for (const issue of result.issues) {
    expect(issue.message.length).toBeGreaterThan(10);
  }
  return result.issues.map(({ code, path }) => ({ code, path }));
};

const only = (code: ClinicalContentCode, path: string) => [{ code, path }];

describe('C1 constants', () => {
  it('defines exactly the four approved categories with their exact names', () => {
    expect(CLINICAL_CATEGORIES.map((c) => [c.key, c.topicName])).toEqual([
      ['signs', 'Classic Signs & Symptoms'],
      ['workup', 'Work-up'],
      ['pathology', 'Pathology'],
      ['management', 'Management/Treatment'],
    ]);
    expect(categoryOfTopicName('Work-up')).toBe('workup');
    expect(categoryOfTopicName('work-up')).toBeUndefined();
    expect(categoryOfTopicName(' Work-up')).toBeUndefined();
  });

  it('uses the approved limits: 140-character card text, at most 3 facts per category', () => {
    expect(CLINICAL_MAX_CARD_TEXT_LENGTH).toBe(140);
    expect(CLINICAL_MAX_FACTS_PER_CATEGORY).toBe(3);
  });

  it('has unique, CLINICAL_-prefixed issue codes', () => {
    const codes = Object.values(C);
    expect(new Set(codes).size).toBe(codes.length);
    expect(codes.every((code) => code.startsWith('CLINICAL_'))).toBe(true);
  });

  it('counts card length in code points after trimming', () => {
    expect(cardTextLength('  abc  ')).toBe(3);
    expect(cardTextLength('\u{1D538}\u{1D539}')).toBe(2);
  });
});

describe('C1 valid data', () => {
  it('accepts the fictitious fixture and returns the same collection', () => {
    const data = fakeClinicalCollection();
    const result = validateClinicalCollection(data);
    expect(result).toEqual({ ok: true, stage: 'clinical', collection: data, issues: [] });
  });

  it('accepts the authoring template', async () => {
    const template: unknown = JSON.parse(await readText('../authoring/clinical-dataset.template.json'));
    const result = validateClinicalCollection(template);
    expect(result.ok ? [] : result.issues).toEqual([]);
  });

  it('fixture and template contain only obviously fictitious placeholder text', async () => {
    expect(allCardTexts(fakeClinicalCollection()).every((text) => /^Test (Disease \d|Alternative Diagnosis \d)/.test(text))).toBe(true);
    const template = JSON.parse(await readText('../authoring/clinical-dataset.template.json')) as FakeCollection;
    expect(allCardTexts(template).every((text) => /^(Example (Disease|Alternative Diagnosis) [A-Z0-9]|Replace: )/.test(text))).toBe(true);
  });

  it('does not modify its input', () => {
    const data = withChange((d) => {
      (d.subjects[0]!.topics[0]!.corrects[0]!).text = '';
    });
    const before = JSON.stringify(data);
    validateClinicalCollection(data);
    expect(JSON.stringify(data)).toBe(before);
  });

  it('allows a fact shared across diseases or categories (reviewed in C2, not an error)', () => {
    const shared = withChange((d) => {
      d.subjects[1]!.topics[1]!.corrects.push({ id: 'clinical.answer.test-disease-2.workup.shared', text: 'Test Disease 1 work-up fact A' });
      d.subjects[0]!.topics[2]!.corrects[2]!.text = 'Test Disease 1 work-up fact B';
    });
    expect(clinicalIssues(shared)).toEqual([]);
  });

  it('allows an alternative diagnosis that is another disease in the dataset', () => {
    const data = fakeClinicalCollection();
    expect(data.subjects[2]!.subjectIncorrects.map((e) => e.text)).toContain('Test Disease 4');
    expect(clinicalIssues(data)).toEqual([]);
  });
});

describe('C1 M2 schema stage runs first and is passed through unchanged', () => {
  it.each([
    ['null', null],
    ['an array', []],
    ['a string', 'not a dataset'],
    ['a missing subjects field', { schemaVersion: '1.0.0' }],
    ['an unsupported version', { schemaVersion: '2.0.0', subjects: [] }],
  ])('reports M2 issues for %s without throwing', (_label, value) => {
    const result = validateClinicalCollection(value);
    expect(result.ok).toBe(false);
    expect(result.stage).toBe('schema');
    expect(result.issues).toEqual(validateCollectionSource(value).issues);
  });

  it('reports M2 identifier issues (malformed and duplicate ids) and skips Clinical rules', () => {
    const data = withChange((d) => {
      d.subjects[0]!.topics[0]!.corrects[0]!.id = 'Not An Id';
      d.subjects[1]!.topics[0]!.corrects[0]!.id = d.subjects[1]!.topics[0]!.corrects[1]!.id;
      d.subjects[0]!.topics[0]!.topicName = 'Unknown'; // a Clinical issue that must NOT appear yet
    });
    const result = validateClinicalCollection(data);
    expect(result.stage).toBe('schema');
    expect(result.issues).toEqual(validateCollectionSource(data).issues);
    expect(result.issues.some((issue) => issue.code.startsWith('CLINICAL_'))).toBe(false);
  });
});

describe('C1 Clinical rules: one failing input each, exact code and path', () => {
  it('CLINICAL_NO_DISEASES', () => {
    expect(clinicalIssues({ schemaVersion: '1.0.0', subjects: [] })).toEqual(only(C.noDiseases, 'subjects'));
  });

  it('CLINICAL_WRONG_NAMESPACE (a disease whose ids all use another namespace)', () => {
    const data = withChange((d) => {
      d.subjects[3] = JSON.parse(JSON.stringify(d.subjects[3]).replaceAll('"clinical.', '"math.')) as FakeCollection['subjects'][number];
    });
    expect(validateCollectionSource(data).ok).toBe(true);
    expect(clinicalIssues(data)).toEqual(only(C.wrongNamespace, 'subjects[3].id'));
  });

  it('CLINICAL_NO_CATEGORIES', () => {
    expect(clinicalIssues(withChange((d) => void (d.subjects[3]!.topics = [])))).toEqual(only(C.noCategories, 'subjects[3].topics'));
  });

  it.each(['Signs', 'work-up', 'Work-up ', 'Management', 'Diagnosis'])('CLINICAL_UNKNOWN_CATEGORY for "%s"', (name) => {
    expect(clinicalIssues(withChange((d) => void (d.subjects[1]!.topics[0]!.topicName = name)))).toEqual(
      only(C.unknownCategory, 'subjects[1].topics[0].topicName'),
    );
  });

  it('CLINICAL_DUPLICATE_CATEGORY', () => {
    expect(clinicalIssues(withChange((d) => void (d.subjects[1]!.topics[2]!.topicName = 'Classic Signs & Symptoms')))).toEqual(
      only(C.duplicateCategory, 'subjects[1].topics[2].topicName'),
    );
  });

  it('CLINICAL_NO_FACTS', () => {
    expect(clinicalIssues(withChange((d) => void (d.subjects[3]!.topics[0]!.corrects = [])))).toEqual(
      only(C.noFacts, 'subjects[3].topics[0].corrects'),
    );
  });

  it('CLINICAL_TOO_MANY_FACTS at 4; 3 is allowed', () => {
    const data = fakeClinicalCollection();
    expect(data.subjects[0]!.topics[0]!.corrects).toHaveLength(3);
    expect(clinicalIssues(data)).toEqual([]);
    const four = withChange((d) => {
      d.subjects[0]!.topics[0]!.corrects.push({ id: 'clinical.answer.test-disease-1.signs.fact-d', text: 'Test Disease 1 sign fact D' });
    });
    expect(clinicalIssues(four)).toEqual(only(C.tooManyFacts, 'subjects[0].topics[0].corrects'));
  });

  it.each([
    ['a fact', (d: FakeCollection) => void (d.subjects[0]!.topics[1]!.corrects[0]!.text = '   '), 'subjects[0].topics[1].corrects[0].text'],
    ['an incorrect fact', (d: FakeCollection) => void (d.subjects[0]!.topics[0]!.incorrects[0]!.text = ''), 'subjects[0].topics[0].incorrects[0].text'],
    ['a disease name', (d: FakeCollection) => void (d.subjects[1]!.subject = '\t'), 'subjects[1].subject'],
    ['an alternative diagnosis', (d: FakeCollection) => void (d.subjects[0]!.subjectIncorrects[0]!.text = ''), 'subjects[0].subjectIncorrects[0].text'],
  ])('CLINICAL_EMPTY_TEXT for %s', (_label, change, path) => {
    expect(clinicalIssues(withChange(change))).toEqual(only(C.emptyText, path));
  });

  it('CLINICAL_TEXT_TOO_LONG at 141 code points; 140 is allowed', () => {
    const at = (length: number) => `Test Disease 1 ${'x'.repeat(length - 15)}`;
    expect(cardTextLength(at(140))).toBe(140);
    expect(clinicalIssues(withChange((d) => void (d.subjects[0]!.topics[1]!.corrects[0]!.text = at(140))))).toEqual([]);
    expect(clinicalIssues(withChange((d) => void (d.subjects[0]!.topics[1]!.corrects[0]!.text = at(141))))).toEqual(
      only(C.textTooLong, 'subjects[0].topics[1].corrects[0].text'),
    );
  });

  it('counts surrounding spaces and astral characters fairly', () => {
    const padded = `   ${'y'.repeat(140)}   `;
    const astral = '\u{1D538}'.repeat(140); // 140 code points, 280 UTF-16 units
    expect(clinicalIssues(withChange((d) => void (d.subjects[0]!.topics[1]!.corrects[0]!.text = padded)))).toEqual([]);
    expect(clinicalIssues(withChange((d) => void (d.subjects[0]!.topics[1]!.corrects[0]!.text = astral)))).toEqual([]);
  });

  it.each([
    ['a disease name', (d: FakeCollection, t: string) => void (d.subjects[1]!.subject = t), 'subjects[1].subject'],
    ['an alternative diagnosis', (d: FakeCollection, t: string) => void (d.subjects[0]!.subjectIncorrects[0]!.text = t), 'subjects[0].subjectIncorrects[0].text'],
    ['an incorrect fact', (d: FakeCollection, t: string) => void (d.subjects[0]!.topics[2]!.incorrects[0]!.text = t), 'subjects[0].topics[2].incorrects[0].text'],
  ])('CLINICAL_TEXT_TOO_LONG applies to %s', (_label, change, path) => {
    expect(clinicalIssues(withChange((d) => change(d, 'z'.repeat(141))))).toEqual(only(C.textTooLong, path));
  });

  it('explanations may be longer than 140 characters', () => {
    expect(clinicalIssues(withChange((d) => void (d.subjects[0]!.topics[0]!.corrects[0]!.explanation = 'e'.repeat(1000))))).toEqual([]);
  });

  it('CLINICAL_EMPTY_EXPLANATION', () => {
    expect(clinicalIssues(withChange((d) => void (d.subjects[0]!.topics[0]!.corrects[1]!.explanation = '  ')))).toEqual(
      only(C.emptyExplanation, 'subjects[0].topics[0].corrects[1].explanation'),
    );
  });

  it('CLINICAL_DUPLICATE_TEXT within one list, ignoring case and spacing', () => {
    expect(clinicalIssues(withChange((d) => void (d.subjects[0]!.topics[0]!.corrects[1]!.text = '  test disease 1   SIGN fact a ')))).toEqual(
      only(C.duplicateText, 'subjects[0].topics[0].corrects[1].text'),
    );
  });

  it('CLINICAL_DUPLICATE_TEXT within subjectIncorrects', () => {
    const data = withChange((d) => void (d.subjects[2]!.subjectIncorrects[1]!.text = 'TEST ALTERNATIVE DIAGNOSIS 2'));
    expect(clinicalIssues(data)).toEqual(only(C.duplicateText, 'subjects[2].subjectIncorrects[1].text'));
  });

  it('CLINICAL_CONTRADICTORY_ENTRY: the same text correct and incorrect for one topic', () => {
    expect(clinicalIssues(withChange((d) => void (d.subjects[0]!.topics[0]!.incorrects[0]!.text = 'Test Disease 1 sign fact C')))).toEqual(
      only(C.contradictoryEntry, 'subjects[0].topics[0].incorrects[0].text'),
    );
  });

  it('CLINICAL_ALTERNATIVE_IS_DISEASE (exact name, ignoring case and spacing)', () => {
    expect(clinicalIssues(withChange((d) => void (d.subjects[0]!.subjectIncorrects[0]!.text = ' TEST  disease 1')))).toEqual(
      only(C.alternativeIsDisease, 'subjects[0].subjectIncorrects[0].text'),
    );
  });

  it('CLINICAL_DUPLICATE_DISEASE_NAME', () => {
    expect(clinicalIssues(withChange((d) => void (d.subjects[2]!.subject = 'test disease 2 ')))).toEqual(
      only(C.duplicateDiseaseName, 'subjects[2].subject'),
    );
  });
});

describe('C1 reporting', () => {
  it('reports every issue together, in document order', () => {
    const data = withChange((d) => {
      d.subjects[0]!.subject = '';
      d.subjects[0]!.topics[3]!.topicName = 'Treatment';
      d.subjects[1]!.topics[1]!.corrects = [];
      d.subjects[3]!.topics[0]!.corrects[0]!.text = 'q'.repeat(200);
    });
    expect(clinicalIssues(data)).toEqual([
      { code: C.emptyText, path: 'subjects[0].subject' },
      { code: C.unknownCategory, path: 'subjects[0].topics[3].topicName' },
      { code: C.noFacts, path: 'subjects[1].topics[1].corrects' },
      { code: C.textTooLong, path: 'subjects[3].topics[0].corrects[0].text' },
    ]);
  });

  it('messages are actionable: they name the limit or the fix', () => {
    const result = validateClinicalCollection(withChange((d) => void (d.subjects[0]!.topics[1]!.corrects[0]!.text = 'w'.repeat(150))));
    if (result.ok) throw new Error('expected an issue');
    expect(result.issues[0]?.message).toMatch(/150 characters.*at most 140/);
  });
});
