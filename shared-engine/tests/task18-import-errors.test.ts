/**
 * Task 18 - invalid-json-import-errors (Req 7.1, 7.2; Req 6.5; design D7).
 *
 * Imported source JSON must produce structural and identifier errors that are
 * actionable and understandable: a stable code, a message, and the exact JSON path.
 * Merge problems join the same model. Both Math and Clinical collections are used.
 *
 * Not covered, because no such code exists yet: syntactically invalid JSON TEXT (owner-approved: belongs
 * to a later loader/integration task) and a single raw-JSON import
 * function. They are recorded as `it.todo`.
 */

import { describe, expect, it } from 'vitest';
import {
  CollectionMergeError,
  SUPPORTED_SCHEMA_VERSIONS,
  VALIDATION_CODES as V,
  assertMergeable,
  checkMergeable,
  createCollection,
  formatIssues,
  isStructuredIssue,
  issuesFromMergeError,
  mergeCollections,
  validateCollectionSource,
  validateIdentifiers,
  validateStructure,
  type SubjectCollection,
} from '../src/index.js';

/* eslint-disable @typescript-eslint/no-explicit-any */
type Json = any;

const issue = (code: string, path?: string) =>
  expect.objectContaining(path === undefined ? { code } : { code, path });

const clinicalSubject = (n: number): Json => ({
  id: `clinical.subject.test-${n}`,
  subject: `Test Disease ${n}`,
  subjectIncorrects: [{ id: `clinical.answer.test-${n}.other-disease`, text: `Other test disease ${n}` }],
  topics: [
    {
      id: `clinical.topic.test-${n}.workup`,
      topicName: 'Work-up',
      corrects: [{ id: `clinical.answer.test-${n}.workup.finding-1`, text: `Test finding ${n}.1`, explanation: `Test explanation ${n}.1` }],
      incorrects: [{ id: `clinical.answer.test-${n}.workup.distractor-1`, text: `Test distractor ${n}.1` }],
    },
  ],
});

const mathSubject = (n: number): Json => ({
  id: `math.subject.${n}`,
  subject: String(n),
  subjectIncorrects: [{ id: `math.answer.${n}.alt-1`, text: String(n + 1) }],
  topics: [
    {
      id: `math.topic.${n}.addition`,
      topicName: 'Addition',
      corrects: [{ id: `math.answer.${n}.addition.expr-1`, text: '3 + 4' }],
      incorrects: [{ id: `math.answer.${n}.addition.expr-2`, text: '3 + 5' }],
    },
  ],
});

const collectionOf = (subjects: Json[]): Json => ({ schemaVersion: '1.0.0', subjects });
const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
const patched = (subjects: Json[], patch: (c: Json) => void): Json => {
  const copy = clone(collectionOf(subjects));
  patch(copy);
  return copy;
};

const STYLES: ReadonlyArray<readonly [string, (n: number) => Json]> = [
  ['Clinical', clinicalSubject],
  ['Math', mathSubject],
];

describe.each(STYLES)('invalid-json-import-errors, %s collections (Req 6.5)', (name, make) => {
  const ns = name === 'Clinical' ? 'clinical' : 'math';
  const other = name === 'Clinical' ? 'math' : 'clinical';
  const subjects = () => [make(1), make(2)];

  it('accepts a well-formed collection, including after a JSON text round trip', () => {
    const valid = collectionOf(subjects());
    expect(validateCollectionSource(valid).ok).toBe(true);
    expect(validateCollectionSource(JSON.parse(JSON.stringify(valid))).ok).toBe(true);
  });

  it.each([
    ['null', null],
    ['an array', []],
    ['a string', 'text'],
    ['a number', 5],
    ['a boolean', true],
  ])('rejects %s as the whole document, at the root', (_label, value) => {
    expect(validateStructure(value).issues).toEqual([issue(V.invalidType, '$')]);
  });

  it.each([
    ['missing schemaVersion', (c: Json) => delete c.schemaVersion, V.missingField, 'schemaVersion'],
    ['missing subjects', (c: Json) => delete c.subjects, V.missingField, 'subjects'],
    ['subjects not an array', (c: Json) => (c.subjects = 'nope'), V.invalidType, 'subjects'],
    ['a subject that is not an object', (c: Json) => (c.subjects[0] = 5), V.invalidType, 'subjects[0]'],
    ['schemaVersion not a string', (c: Json) => (c.schemaVersion = 1), V.invalidType, 'schemaVersion'],
    ['a subject with no name', (c: Json) => delete c.subjects[0].subject, V.missingField, 'subjects[0].subject'],
    ['a subject with no id', (c: Json) => delete c.subjects[1].id, V.missingField, 'subjects[1].id'],
    ['a subject with no subjectIncorrects', (c: Json) => delete c.subjects[0].subjectIncorrects, V.missingField, 'subjects[0].subjectIncorrects'],
    ['a subject with no topics', (c: Json) => delete c.subjects[0].topics, V.missingField, 'subjects[0].topics'],
    ['a topic that is not an object', (c: Json) => (c.subjects[0].topics[0] = 'x'), V.invalidType, 'subjects[0].topics[0]'],
    ['a topic with no name', (c: Json) => delete c.subjects[0].topics[0].topicName, V.missingField, 'subjects[0].topics[0].topicName'],
    ['a topic with no corrects', (c: Json) => delete c.subjects[0].topics[0].corrects, V.missingField, 'subjects[0].topics[0].corrects'],
    ['a topic with no incorrects', (c: Json) => delete c.subjects[0].topics[0].incorrects, V.missingField, 'subjects[0].topics[0].incorrects'],
    ['corrects not an array', (c: Json) => (c.subjects[0].topics[0].corrects = {}), V.invalidType, 'subjects[0].topics[0].corrects'],
    ['an answer that is not an object', (c: Json) => (c.subjects[0].topics[0].corrects[0] = null), V.invalidType, 'subjects[0].topics[0].corrects[0]'],
    ['an answer with no text', (c: Json) => delete c.subjects[0].topics[0].incorrects[0].text, V.missingField, 'subjects[0].topics[0].incorrects[0].text'],
    ['an answer with no id', (c: Json) => delete c.subjects[0].subjectIncorrects[0].id, V.missingField, 'subjects[0].subjectIncorrects[0].id'],
    ['a numeric id', (c: Json) => (c.subjects[0].topics[0].corrects[0].id = 7), V.invalidType, 'subjects[0].topics[0].corrects[0].id'],
    ['a non-string explanation', (c: Json) => (c.subjects[0].topics[0].corrects[0].explanation = 42), V.invalidType, 'subjects[0].topics[0].corrects[0].explanation'],
  ])('structure: %s', (_label, mutate, code, path) => {
    const result = validateStructure(patched(subjects(), mutate));
    expect(result.ok).toBe(false);
    expect(result.issues).toContainEqual(issue(code, path));
  });

  it('accepts an answer with no explanation (it is optional)', () => {
    const noExplanation = patched(subjects(), (c) => delete c.subjects[0].topics[0].corrects[0].explanation);
    expect(validateStructure(noExplanation).ok).toBe(true);
  });

  it('collects every structural problem in one pass, not just the first', () => {
    const result = validateStructure(
      patched(subjects(), (c) => {
        delete c.subjects[0].subject;
        delete c.subjects[0].topics[0].corrects;
        delete c.subjects[1].topics[0].incorrects[0].text;
      }),
    );
    expect(result.issues).toHaveLength(3);
  });

  it.each([
    ['2.0.0', V.schemaVersionUnsupported],
    ['0.9.0', V.schemaVersionUnsupported],
    ['v1', V.schemaVersionUnsupported],
    ['1.0', V.schemaVersionUnsupported],
    ['1.0.0.0', V.schemaVersionUnsupported],
    ['1.0.0-beta', V.schemaVersionUnsupported],
    ['', V.schemaVersionUnsupported],
  ])('rejects schemaVersion %j with an unsupported-version issue naming the supported versions', (version, code) => {
    const result = validateStructure(patched(subjects(), (c) => (c.schemaVersion = version)));
    expect(result.issues).toContainEqual(issue(code, 'schemaVersion'));
    expect(SUPPORTED_SCHEMA_VERSIONS).toContain('1.0.0');
    expect(result.issues[0]?.message.length).toBeGreaterThan(10);
  });

  it.each([
    ['a malformed subject id', (c: Json) => (c.subjects[0].id = 'Bad Subject'), V.malformedIdentifier, 'subjects[0].id'],
    ['a malformed answer id', (c: Json) => (c.subjects[0].topics[0].corrects[0].id = 'Not Valid!'), V.malformedIdentifier, 'subjects[0].topics[0].corrects[0].id'],
    ['an unknown namespace', (c: Json) => (c.subjects[0].topics[0].id = 'physics.topic.x'), V.malformedIdentifier, 'subjects[0].topics[0].id'],
    ['a topic id with the answer kind', (c: Json) => (c.subjects[0].topics[0].id = `${ns}.answer.topic-id`), V.wrongIdentifierKind, 'subjects[0].topics[0].id'],
    ['a subject id with the topic kind', (c: Json) => (c.subjects[0].id = `${ns}.topic.subject-id`), V.wrongIdentifierKind, 'subjects[0].id'],
    ['an answer id with the subject kind', (c: Json) => (c.subjects[0].topics[0].incorrects[0].id = `${ns}.subject.answer-id`), V.wrongIdentifierKind, 'subjects[0].topics[0].incorrects[0].id'],
    ['a subjectIncorrects id with the topic kind', (c: Json) => (c.subjects[0].subjectIncorrects[0].id = `${ns}.topic.alt-id`), V.wrongIdentifierKind, 'subjects[0].subjectIncorrects[0].id'],
    ['an answer from the other app inside the subject', (c: Json) => (c.subjects[0].topics[0].corrects[0].id = `${other}.answer.stray`), V.namespaceMismatch, 'subjects[0].topics[0].corrects[0].id'],
    ['a topic from the other app inside the subject', (c: Json) => (c.subjects[0].topics[0].id = `${other}.topic.stray`), V.namespaceMismatch, 'subjects[0].topics[0].id'],
    ['a subjectIncorrects id from the other app', (c: Json) => (c.subjects[0].subjectIncorrects[0].id = `${other}.answer.stray`), V.namespaceMismatch, 'subjects[0].subjectIncorrects[0].id'],
  ])('identifiers: %s', (_label, mutate, code, path) => {
    const result = validateCollectionSource(patched(subjects(), mutate));
    expect(result.ok).toBe(false);
    expect(result.issues).toContainEqual(issue(code, path));
  });

  it('reports a repeated id at the repeat, citing the first definition (N occurrences give N-1 issues)', () => {
    const triple = patched(subjects(), (c) => {
      const id = c.subjects[0].id;
      c.subjects[0].subjectIncorrects[0].id = id;
      c.subjects[0].topics[0].corrects[0].id = id;
    });
    const duplicates = validateIdentifiers(triple).issues.filter((i) => i.code === V.duplicateIdentifier);
    expect(duplicates.map((i) => i.path)).toEqual(['subjects[0].subjectIncorrects[0].id', 'subjects[0].topics[0].corrects[0].id']);
    expect(duplicates.every((i) => i.message.includes('subjects[0].id'))).toBe(true);
  });

  it('reports a duplicated whole subject under the second copy', () => {
    const doubled = collectionOf([make(1), make(1)]);
    const paths = validateIdentifiers(doubled).issues.filter((i) => i.code === V.duplicateIdentifier).map((i) => i.path);
    expect(paths).toContain('subjects[1].id');
    expect(paths).toContain('subjects[1].topics[0].corrects[0].id');
    expect(paths.every((p) => p.startsWith('subjects[1]'))).toBe(true);
  });

  it('a malformed subject id is reported once and its children are not blamed for a namespace mismatch', () => {
    const result = validateIdentifiers(patched(subjects(), (c) => (c.subjects[0].id = 'Bad Subject')));
    expect(result.issues).toContainEqual(issue(V.malformedIdentifier, 'subjects[0].id'));
    expect(result.issues.some((i) => i.code === V.namespaceMismatch)).toBe(false);
  });

  it('stops at structural errors without piling identifier errors on top', () => {
    const result = validateCollectionSource(
      patched(subjects(), (c) => {
        delete c.subjects[0].subject;
        c.subjects[0].topics[0].corrects[0].id = 'Bad ID';
      }),
    );
    expect(result.issues.some((i) => i.code === V.missingField)).toBe(true);
    expect(result.issues.some((i) => i.code === V.malformedIdentifier)).toBe(false);
  });

  it('every import problem is a structured issue and prints as a readable report', () => {
    const result = validateCollectionSource(
      patched(subjects(), (c) => {
        c.subjects[0].id = 'Bad Subject';
        c.subjects[1].topics[0].id = `${other}.topic.stray`;
      }),
    );
    expect(result.issues.every(isStructuredIssue)).toBe(true);
    const report = formatIssues(result.issues);
    expect(report.split('\n')).toHaveLength(result.issues.length);
    expect(report).toContain('[MALFORMED_IDENTIFIER] subjects[0].id:');
  });
});

describe('invalid-json-import-errors: Math and Clinical together', () => {
  it('accepts a collection holding both apps, because namespaces are checked per subject', () => {
    expect(validateCollectionSource(collectionOf([clinicalSubject(1), mathSubject(7)])).ok).toBe(true);
  });

  it('rejects a Math answer id inside a Clinical subject and a Clinical answer id inside a Math subject', () => {
    const both = collectionOf([clinicalSubject(1), mathSubject(7)]);
    both.subjects[0].topics[0].corrects[0].id = 'math.answer.stray';
    both.subjects[1].topics[0].corrects[0].id = 'clinical.answer.stray';
    const result = validateCollectionSource(both);
    expect(result.issues).toContainEqual(issue(V.namespaceMismatch, 'subjects[0].topics[0].corrects[0].id'));
    expect(result.issues).toContainEqual(issue(V.namespaceMismatch, 'subjects[1].topics[0].corrects[0].id'));
  });
});

// ---------------------------------------------------------------------------
describe('invalid-json-import-errors: merging imported collections (Decision 2)', () => {
  const sub = (s: Json) => s as SubjectCollection['subjects'][number];
  const merge = (...collections: SubjectCollection[]) => mergeCollections(...collections);

  it('merges compatible collections in order without overwriting anything', () => {
    const merged = merge(createCollection([sub(clinicalSubject(1))]), createCollection([sub(mathSubject(7))]));
    expect(merged.subjects.map((s) => s.id)).toEqual(['clinical.subject.test-1', 'math.subject.7']);
    expect(merged.schemaVersion).toBe('1.0.0');
  });

  it('rejects mismatched versions with a structured error and adapts it to the shared model', () => {
    const a = createCollection([sub(mathSubject(1))], '1.0.0');
    const b = createCollection([sub(mathSubject(2))], '2.0.0');
    expect(checkMergeable(a, b)).toMatchObject({ ok: false, code: 'SCHEMA_VERSION_MISMATCH' });
    let error: unknown;
    try { merge(a, b); } catch (caught) { error = caught; }
    expect(error).toBeInstanceOf(CollectionMergeError);
    const issues = issuesFromMergeError(error as CollectionMergeError);
    expect(issues).toEqual([issue('SCHEMA_VERSION_MISMATCH', 'schemaVersion')]);
    expect(issues[0]?.message).toContain('"1.0.0"');
    expect(issues[0]?.message).toContain('"2.0.0"');
  });

  it('rejects identifiers repeated across collections, one issue per id, naming id and count', () => {
    const a = createCollection([sub(mathSubject(1)), sub(mathSubject(2))]);
    const b = createCollection([sub(mathSubject(1)), sub(mathSubject(2)), sub(mathSubject(3))]);
    let error: unknown;
    try { merge(a, b); } catch (caught) { error = caught; }
    const issues = issuesFromMergeError(error as CollectionMergeError);
    expect(issues.length).toBeGreaterThanOrEqual(2);
    expect(issues.every((i) => i.code === 'DUPLICATE_IDENTIFIER' && i.path === 'subjects')).toBe(true);
    expect(issues.some((i) => i.message.includes('"math.subject.1"') && i.message.includes('2 times'))).toBe(true);
    expect(issues.every(isStructuredIssue)).toBe(true);
  });

  it('rejects an identifier repeated inside a single collection', () => {
    const dup = createCollection([sub(mathSubject(1)), sub(mathSubject(1))]);
    expect(() => assertMergeable(dup)).toThrow(CollectionMergeError);
    expect(checkMergeable(dup)).toMatchObject({ ok: false, code: 'DUPLICATE_IDENTIFIER' });
  });

  it('merges nothing and returns an empty current-version collection for no input', () => {
    const empty = merge();
    expect(empty.subjects).toEqual([]);
    expect(empty.schemaVersion).toBe('1.0.0');
    expect(checkMergeable().ok).toBe(true);
  });

  it('adapts a bare merge error without details to a single structured issue', () => {
    const issues = issuesFromMergeError(new CollectionMergeError('DUPLICATE_IDENTIFIER', 'something went wrong'));
    expect(issues).toEqual([issue('DUPLICATE_IDENTIFIER', '$')]);
  });
});

describe('invalid-json-import-errors: parsing JSON text (not yet implemented)', () => {
  it.todo('reports syntactically invalid JSON text with its position (depends on the later loader/integration task, which will add the JSON-text parser and the unified import entry point)');
  it.todo('imports several raw JSON files into one merged collection or one full issue list with per-collection paths (depends on the later loader/integration task and its unified import entry point)');
});
