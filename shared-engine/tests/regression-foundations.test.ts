/**
 * Regression - foundations and the shared issue model (Tasks 1, 2, 2a, 3, 13).
 *
 * Identifier conventions (Task 2), the versioned collection wrapper and merge rules
 * (Task 2a), the source-data and generated-deck types (Tasks 1 and 3, checked here by
 * building typed values), and the shared structured issue model (Task 13).
 */

import { describe, expect, it } from 'vitest';
import {
  CURRENT_SCHEMA_VERSION,
  CollectionMergeError,
  ID_KINDS,
  MERGE_ERROR_CODES,
  SUBJECT_NAMESPACES,
  assertMergeable,
  buildId,
  checkMergeable,
  collectIds,
  createCollection,
  drawPenaltyCards,
  findDuplicateIds,
  findMalformedIds,
  formatIssue,
  formatIssues,
  isInNamespace,
  isStructuredIssue,
  isValidId,
  issuesFromMergeError,
  mergeCollections,
  parseId,
  validateChallengeMapping,
  validateIdentifiers,
  validateStructure,
  type GeneratedDeck,
  type SubjectCollection,
  type SubjectRecord,
} from '../src/index.js';
import { buildDeck, deepFreeze, fullMatrix } from './fixtures.js';

const subject = (id: string, topic = true): SubjectRecord => ({
  id,
  subject: id,
  subjectIncorrects: [{ id: `${id.replace('.subject.', '.answer.')}.alt-1`, text: 'Alternative' }],
  topics: topic
    ? [
        {
          id: id.replace('.subject.', '.topic.') + '.workup',
          topicName: 'Work-up',
          corrects: [{ id: `${id.replace('.subject.', '.answer.')}.workup.fact-1`, text: 'Fact 1', explanation: 'Because.' }],
          incorrects: [{ id: `${id.replace('.subject.', '.answer.')}.workup.fact-2`, text: 'Fact 2' }],
        },
      ]
    : [],
});

describe('Task 1 and Task 3 types: typed values build and flow through the engine', () => {
  it('a SubjectCollection and a GeneratedDeck can be constructed and validated', () => {
    const collection: SubjectCollection = { schemaVersion: '1.0.0', subjects: [subject('clinical.subject.test-1')] };
    expect(validateStructure(collection).ok).toBe(true);
    const deck: GeneratedDeck = buildDeck({ style: 'clinical', correct: 5, distractors: 6 });
    expect(validateChallengeMapping(deck, fullMatrix(deck)).ok).toBe(true);
  });

  it('an answer entry needs no explanation', () => {
    const entry: SubjectCollection['subjects'][number]['subjectIncorrects'][number] = { id: 'math.answer.1.x', text: '1' };
    expect(entry.explanation).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
describe('Task 2: identifier conventions <namespace>.<kind>.<slug...>', () => {
  it('names the namespaces, kinds, and separator', () => {
    expect(SUBJECT_NAMESPACES).toEqual({ math: 'math', clinical: 'clinical' });
    expect(ID_KINDS).toEqual({ subject: 'subject', topic: 'topic', answer: 'answer' });
  });

  it('builds the documented examples', () => {
    expect(buildId('math', 'subject', '7')).toBe('math.subject.7');
    expect(buildId('clinical', 'subject', 'graves-disease')).toBe('clinical.subject.graves-disease');
    expect(buildId('clinical', 'topic', 'graves-disease', 'workup')).toBe('clinical.topic.graves-disease.workup');
    expect(buildId('clinical', 'answer', 'graves-disease', 'workup', 'positive-tsi')).toBe(
      'clinical.answer.graves-disease.workup.positive-tsi',
    );
  });

  it.each([[[]], [['Upper']], [['has space']], [['under_score']], [['']], [['-lead']], [['trail-']], [['dou--ble']]])(
    'refuses to build from the invalid slug %j',
    (slug) => {
      expect(() => buildId('math', 'answer', ...(slug as string[]))).toThrow(RangeError);
    },
  );

  it.each([
    'math.subject.7',
    'clinical.subject.graves-disease',
    'clinical.topic.graves-disease.workup',
    'math.answer.1.alt-1',
    'math.topic.12.addition',
  ])('accepts %s', (id) => {
    expect(isValidId(id)).toBe(true);
  });

  it.each([
    '',
    'math',
    'math.subject',
    'math.subject.',
    'Math.subject.7',
    'math.Subject.7',
    'physics.subject.x',
    'math.widget.7',
    'math.subject.UPPER',
    'math.subject.a..b',
    'math.subject.-a',
    'math.subject.a-',
    'math.subject.a b',
    ' math.subject.7',
  ])('rejects %j', (id) => {
    expect(isValidId(id)).toBe(false);
  });

  it('parses a valid id into its parts and returns nothing for an invalid one', () => {
    expect(parseId('clinical.answer.graves-disease.workup.positive-tsi')).toEqual({
      namespace: 'clinical',
      kind: 'answer',
      slug: ['graves-disease', 'workup', 'positive-tsi'],
      raw: 'clinical.answer.graves-disease.workup.positive-tsi',
    });
    expect(parseId('nonsense')).toBeUndefined();
  });

  it('knows which namespace an id belongs to', () => {
    expect(isInNamespace('math.subject.7', 'math')).toBe(true);
    expect(isInNamespace('math.subject.7', 'clinical')).toBe(false);
    expect(isInNamespace('garbage', 'math')).toBe(false);
  });

  it('collects ids in document order: subject, its alternatives, then each topic with its answers', () => {
    const collection = createCollection([subject('clinical.subject.test-1')]);
    expect(collectIds(collection)).toEqual([
      'clinical.subject.test-1',
      'clinical.answer.test-1.alt-1',
      'clinical.topic.test-1.workup',
      'clinical.answer.test-1.workup.fact-1',
      'clinical.answer.test-1.workup.fact-2',
    ]);
  });

  it('finds duplicates across collections, sorted by id, with counts', () => {
    const a = createCollection([subject('math.subject.2', false), subject('math.subject.1', false)]);
    const b = createCollection([subject('math.subject.2', false), subject('math.subject.3', false)]);
    expect(findDuplicateIds(a, b)).toEqual([
      { id: 'math.answer.2.alt-1', count: 2 },
      { id: 'math.subject.2', count: 2 },
    ]);
    expect(findDuplicateIds(a)).toEqual([]);
    expect(findDuplicateIds()).toEqual([]);
  });

  it('finds a duplicate inside one collection', () => {
    expect(findDuplicateIds(createCollection([subject('math.subject.1', false), subject('math.subject.1', false)]))).toContainEqual({
      id: 'math.subject.1',
      count: 2,
    });
  });

  it('lists malformed ids', () => {
    const bad = createCollection([{ ...subject('math.subject.1', false), id: 'Not Valid' }]);
    expect(findMalformedIds(bad)).toEqual(['Not Valid']);
    expect(findMalformedIds(createCollection([subject('math.subject.1')]))).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
describe('Task 2a: versioned collection wrapper and merge rules', () => {
  it('creates a collection at the current schema version by default', () => {
    expect(CURRENT_SCHEMA_VERSION).toBe('1.0.0');
    expect(createCollection()).toEqual({ schemaVersion: '1.0.0', subjects: [] });
    expect(createCollection([], '2.0.0').schemaVersion).toBe('2.0.0');
  });

  it('merges compatible collections in order, keeping the very same records, without mutating inputs', () => {
    const a = deepFreeze(createCollection([subject('math.subject.1')]));
    const b = deepFreeze(createCollection([subject('clinical.subject.test-1'), subject('math.subject.2')]));
    const merged = mergeCollections(a, b);
    expect(merged.subjects.map((s) => s.id)).toEqual(['math.subject.1', 'clinical.subject.test-1', 'math.subject.2']);
    expect(merged.subjects[0]).toBe(a.subjects[0]);
    expect(merged.schemaVersion).toBe('1.0.0');
  });

  it('merges a single valid collection and nothing at all', () => {
    const only = createCollection([subject('math.subject.1')]);
    expect(mergeCollections(only).subjects).toHaveLength(1);
    expect(mergeCollections()).toEqual({ schemaVersion: '1.0.0', subjects: [] });
    expect(checkMergeable()).toEqual({ ok: true });
  });

  it('rejects mismatched schema versions, naming each distinct version once', () => {
    const result = checkMergeable(createCollection([], '1.0.0'), createCollection([], '2.0.0'), createCollection([], '2.0.0'));
    expect(result).toMatchObject({ ok: false, code: 'SCHEMA_VERSION_MISMATCH', schemaVersions: ['1.0.0', '2.0.0'] });
  });

  it('rejects an identifier repeated across collections and inside one collection', () => {
    const a = createCollection([subject('math.subject.1', false)]);
    expect(checkMergeable(a, a)).toMatchObject({ ok: false, code: 'DUPLICATE_IDENTIFIER' });
    expect(checkMergeable(createCollection([subject('math.subject.1', false), subject('math.subject.1', false)]))).toMatchObject({
      ok: false,
      code: 'DUPLICATE_IDENTIFIER',
    });
  });

  it('checks the version before identifiers', () => {
    const a = createCollection([subject('math.subject.1', false)], '1.0.0');
    const b = createCollection([subject('math.subject.1', false)], '2.0.0');
    expect(checkMergeable(a, b)).toMatchObject({ code: 'SCHEMA_VERSION_MISMATCH' });
  });

  it('throws a structured CollectionMergeError that carries what was found', () => {
    expect(MERGE_ERROR_CODES).toEqual({ schemaVersionMismatch: 'SCHEMA_VERSION_MISMATCH', duplicateIdentifier: 'DUPLICATE_IDENTIFIER' });
    const a = createCollection([subject('math.subject.1', false)]);
    try {
      assertMergeable(a, a);
      throw new Error('should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(CollectionMergeError);
      const merge = error as CollectionMergeError;
      expect(merge.name).toBe('CollectionMergeError');
      expect(merge.code).toBe('DUPLICATE_IDENTIFIER');
      expect(merge.duplicates?.some((d) => d.id === 'math.subject.1' && d.count === 2)).toBe(true);
      expect(merge.schemaVersions).toBeUndefined();
    }
    expect(() => mergeCollections(createCollection([], '1.0.0'), createCollection([], '9.9.9'))).toThrow(CollectionMergeError);
  });
});

// ---------------------------------------------------------------------------
describe('Task 13: the shared structured issue model', () => {
  const sourceIssues = validateStructure({}).issues;
  const identifierIssues = validateIdentifiers(createCollection([subject('math.subject.1', false), subject('math.subject.1', false)])).issues;
  const deckIssues = validateChallengeMapping(
    { ...buildDeck({ style: 'math', correct: 2, distractors: 3 }), challenges: [{ id: 'challenge-0', promptText: 'q', correctAnswerCardId: 'nope', sourceRef: { subjectId: 'math.subject.x' } }] },
    { 'challenge-0': { 'correct-0': false } },
  ).issues;
  const exhaustion = (() => {
    const result = drawPenaltyCards({ drawPile: [], cardsOutsideDrawPile: [] }, [{ playerId: 'p', reason: 'INVALID_ACTION' }], { activeChallenges: [] });
    if (result.ok || !('exhausted' in result)) throw new Error('expected exhaustion');
    return result.exhausted;
  })();
  const mergeIssues = (() => {
    try { mergeCollections(createCollection([], '1.0.0'), createCollection([], '2.0.0')); } catch (error) { return issuesFromMergeError(error as CollectionMergeError); }
    return [];
  })();

  it('every family of problem has the same code / message / path shape', () => {
    const everything = [...sourceIssues, ...identifierIssues, ...deckIssues, exhaustion, ...mergeIssues];
    expect(sourceIssues.length).toBeGreaterThan(0);
    expect(identifierIssues.length).toBeGreaterThan(0);
    expect(deckIssues.length).toBeGreaterThan(0);
    expect(mergeIssues.length).toBeGreaterThan(0);
    expect(everything.every(isStructuredIssue)).toBe(true);
  });

  it('the exhaustion condition keeps its own details beside the shared shape', () => {
    expect(Object.keys(exhaustion).sort()).toEqual(['code', 'details', 'message', 'path']);
  });

  it.each([
    ['null', null],
    ['undefined', undefined],
    ['a string', 'x'],
    ['an empty object', {}],
    ['a numeric code', { code: 1, message: 'm', path: 'p' }],
    ['a missing path', { code: 'C', message: 'm' }],
    ['a missing message', { code: 'C', path: 'p' }],
    ['an array', []],
  ])('does not mistake %s for an issue', (_label, value) => {
    expect(isStructuredIssue(value)).toBe(false);
  });

  it('prints one line per issue as "[CODE] path: message", numbered in a report', () => {
    expect(formatIssue({ code: 'X_Y', message: 'Something broke', path: 'subjects[0].id' })).toBe('[X_Y] subjects[0].id: Something broke');
    expect(formatIssues([{ code: 'A', message: 'm1', path: 'p1' }, { code: 'B', message: 'm2', path: 'p2' }])).toBe('1. [A] p1: m1\n2. [B] p2: m2');
    expect(formatIssues([])).toBe('');
  });

  it('adapts merge problems: a version mismatch at schemaVersion, duplicates per id at subjects', () => {
    expect(mergeIssues).toEqual([expect.objectContaining({ code: 'SCHEMA_VERSION_MISMATCH', path: 'schemaVersion' })]);
    const a = createCollection([subject('math.subject.1', false), subject('math.subject.2', false)]);
    let error: unknown;
    try { mergeCollections(a, a); } catch (caught) { error = caught; }
    const issues = issuesFromMergeError(error as CollectionMergeError);
    expect(issues.length).toBeGreaterThanOrEqual(2);
    expect(issues.every((i) => i.code === 'DUPLICATE_IDENTIFIER' && i.path === 'subjects')).toBe(true);
    expect(issues.some((i) => i.message.includes('"math.subject.1"') && i.message.includes('2 times'))).toBe(true);
  });
});
