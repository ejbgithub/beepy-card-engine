/**
 * Simplified Clinical authoring format and its converter (Milestone M6, C5
 * authoring workflow).
 *
 * The owner writes `clinical-cards/authoring/clinical-authoring.json`:
 *
 *   {
 *     "diseases": [
 *       {
 *         "name": "<disease name>",
 *         "alternativeDiagnoses": ["<text>", { "text": "<text>", "explanation": "<optional>" }],
 *         "signs":      { "correct": [ ... ], "incorrect": [ ... ] },
 *         "workup":     { "correct": [ ... ], "incorrect": [ ... ] },
 *         "pathology":  { "correct": [ ... ], "incorrect": [ ... ] },
 *         "management": { "correct": [ ... ], "incorrect": [ ... ] }
 *       }
 *     ]
 *   }
 *
 * Each fact is a string or `{ "text", "explanation"? }`. No ids, no category names,
 * no empty explanation fields are needed.
 *
 * `convertAuthoring` turns this into the existing M2 `SubjectCollection` (written to
 * `clinical-cards/src/data/clinical-demo.json`). The shared schema, the generator, the
 * validity policy and the engine are unchanged.
 *   - Every text and explanation is copied VERBATIM. Nothing is invented, trimmed or
 *     paraphrased. A blank explanation means "none" and is omitted; a category with no
 *     facts at all is omitted.
 *   - Ids are derived from CONTENT, never from array positions, so reordering facts or
 *     diseases never changes an id:
 *       subject  clinical.subject.<disease-slug>
 *       topic    clinical.topic.<disease-slug>.<category>      (stable while the name is)
 *       fact     clinical.answer.<disease-slug>.<category>.<fact|not>.<text-slug>-<hash8>
 *       alt.     clinical.answer.<disease-slug>.alternative.<text-slug>-<hash8>
 *     <hash8> is FNV-1a 64 of the normalized text (first 8 hex digits).
 *   - The existing C1 rules (and M2 validation) run on the result; their issues are
 *     reported with paths in the OWNER's terms (`diseases[0].workup.correct[1]`).
 *   - Nothing here attests clinical validity or creates review records.
 *
 * Pure: no file system. The commands in `clinical-cards/tools/` do the I/O.
 */

import { normalizeDisplayText, type AnswerEntry, type SubjectCollection, type SubjectRecord, type Topic } from '@beepy/shared-engine';
import { CLINICAL_CATEGORIES, validateClinicalCollection, type ClinicalCategoryKey } from './clinical-content.js';
import { parseJsonText } from './clinical-data.js';
import { fnv1a64Hex } from './clinical-review.js';

/** The four category fields, in the order they are written to the dataset. */
export const AUTHORING_CATEGORY_FIELDS: readonly ClinicalCategoryKey[] = CLINICAL_CATEGORIES.map((c) => c.key);

export const AUTHORING_CODES = {
  jsonSyntax: 'AUTHORING_JSON_SYNTAX',
  invalidFile: 'AUTHORING_INVALID_FILE',
  unknownField: 'AUTHORING_UNKNOWN_FIELD',
  invalidType: 'AUTHORING_INVALID_TYPE',
  duplicateId: 'AUTHORING_DUPLICATE_ID',
} as const;

/** One issue, with a path in the authoring file's terms. */
export interface AuthoringIssue {
  readonly code: string;
  readonly message: string;
  readonly path: string;
}

export type AuthoringFact = string | { readonly text: string; readonly explanation?: string };
export interface AuthoringCategory {
  readonly correct?: readonly AuthoringFact[];
  readonly incorrect?: readonly AuthoringFact[];
}
export interface AuthoringDisease {
  readonly name: string;
  readonly alternativeDiagnoses?: readonly AuthoringFact[];
  readonly signs?: AuthoringCategory;
  readonly workup?: AuthoringCategory;
  readonly pathology?: AuthoringCategory;
  readonly management?: AuthoringCategory;
}
export interface AuthoringFile {
  readonly diseases: readonly AuthoringDisease[];
}

export type ConversionResult =
  | { readonly ok: true; readonly collection: SubjectCollection; /** Deterministic file text for clinical-demo.json. */ readonly json: string }
  | { readonly ok: false; readonly issues: readonly AuthoringIssue[] };

const DISEASE_FIELDS = ['name', 'alternativeDiagnoses', ...AUTHORING_CATEGORY_FIELDS];
const CATEGORY_FIELDS = ['correct', 'incorrect'];
const FACT_FIELDS = ['text', 'explanation'];

/** Lowercase, hyphen-separated id segment; diacritics removed; at most `maxWords` words. */
export function slugify(text: string, maxWords = 64, maxLength = 60): string {
  const words = text
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 0)
    .slice(0, maxWords);
  let slug = '';
  for (const word of words) {
    const next = slug === '' ? word : `${slug}-${word}`;
    if (next.length > maxLength) break;
    slug = next;
  }
  return slug === '' ? (words[0]?.slice(0, maxLength) ?? 'x') || 'x' : slug;
}

const hash8 = (text: string): string => fnv1a64Hex(normalizeDisplayText(text)).slice(0, 8);
const factSlug = (text: string): string => `${slugify(text, 6, 40)}-${hash8(text)}`;

const isObject = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);

/** A blank disease record with all four categories and empty arrays (no content). */
export function blankDisease(name = ''): AuthoringDisease {
  return {
    name,
    alternativeDiagnoses: [],
    signs: { correct: [], incorrect: [] },
    workup: { correct: [], incorrect: [] },
    pathology: { correct: [], incorrect: [] },
    management: { correct: [], incorrect: [] },
  };
}

/** Stable, deterministic text of an authoring file (2-space JSON, trailing newline). */
export const formatAuthoringFile = (file: unknown): string => `${JSON.stringify(file, null, 2)}\n`;

/**
 * Append one blank disease to the authoring file TEXT (or start a new file when it
 * does not exist). Existing content is preserved exactly: the result is checked to
 * parse back to the original diseases plus the blank one. Never writes content.
 */
export function addBlankDisease(existingText: string | undefined, name = ''): { readonly ok: true; readonly text: string } | { readonly ok: false; readonly issues: readonly AuthoringIssue[] } {
  if (existingText === undefined) return { ok: true, text: formatAuthoringFile({ diseases: [blankDisease(name)] }) };
  const parsed = parseJsonText(existingText, 'clinical-authoring.json');
  if (!parsed.ok) return { ok: false, issues: [{ ...parsed.issue, code: AUTHORING_CODES.jsonSyntax }] };
  const value = parsed.value;
  if (!isObject(value) || !Array.isArray(value['diseases'])) {
    return { ok: false, issues: [{ code: AUTHORING_CODES.invalidFile, message: 'The authoring file must be an object with a "diseases" array.', path: '$' }] };
  }
  const updated = { ...value, diseases: [...(value['diseases'] as unknown[]), blankDisease(name)] };
  const text = formatAuthoringFile(updated);
  const roundTrip = JSON.parse(text) as { diseases: unknown[] };
  if (JSON.stringify(roundTrip.diseases.slice(0, -1)) !== JSON.stringify(value['diseases'])) {
    return { ok: false, issues: [{ code: AUTHORING_CODES.invalidFile, message: 'Internal check failed: existing content would not be preserved exactly. Nothing was written.', path: '$' }] };
  }
  return { ok: true, text };
}

/** Convert authoring-file TEXT. Syntax errors are located (line, column). Never throws. */
export function convertAuthoringText(text: string): ConversionResult {
  const parsed = parseJsonText(text, 'clinical-authoring.json');
  if (!parsed.ok) return { ok: false, issues: [{ ...parsed.issue, code: AUTHORING_CODES.jsonSyntax }] };
  return convertAuthoring(parsed.value);
}

/** Convert an authoring value to a validated `SubjectCollection`. Never throws. */
export function convertAuthoring(value: unknown): ConversionResult {
  const issues: AuthoringIssue[] = [];
  const add = (code: string, message: string, path: string) => issues.push({ code, message, path });
  const unknownFields = (record: Record<string, unknown>, allowed: readonly string[], path: string) => {
    for (const key of Object.keys(record)) {
      if (!allowed.includes(key)) add(AUTHORING_CODES.unknownField, `Unknown field "${key}". Allowed here: ${allowed.map((a) => `"${a}"`).join(', ')}.`, path === '' ? key : `${path}.${key}`);
    }
  };

  if (!isObject(value) || !Array.isArray(value['diseases'])) {
    return { ok: false, issues: [{ code: AUTHORING_CODES.invalidFile, message: 'The authoring file must be an object with a "diseases" array: { "diseases": [ ... ] }.', path: '$' }] };
  }
  unknownFields(value, ['diseases'], '');

  /** Generated path -> authoring path, for mapping validation issues back. */
  const pathMap = new Map<string, string>();
  const subjects: SubjectRecord[] = [];

  /** Read one fact (string or object) into an M2 entry; undefined when malformed. */
  const readFact = (fact: unknown, path: string, id: (text: string) => string): AnswerEntry | undefined => {
    if (typeof fact === 'string') return { id: id(fact), text: fact };
    if (!isObject(fact)) {
      add(AUTHORING_CODES.invalidType, 'Each entry must be a text string, or an object { "text": "...", "explanation": "..." }.', path);
      return undefined;
    }
    unknownFields(fact, FACT_FIELDS, path);
    const text = fact['text'];
    const explanation = fact['explanation'];
    if (typeof text !== 'string') {
      add(AUTHORING_CODES.invalidType, '"text" must be a string.', `${path}.text`);
      return undefined;
    }
    if (explanation !== undefined && typeof explanation !== 'string') {
      add(AUTHORING_CODES.invalidType, '"explanation" must be a string when present.', `${path}.explanation`);
      return undefined;
    }
    // A blank explanation means "no explanation": omitted, never invented.
    return explanation === undefined || explanation.trim() === '' ? { id: id(text), text } : { id: id(text), text, explanation };
  };

  const readList = (list: unknown, path: string, id: (text: string) => string, generatedPath: string): AnswerEntry[] => {
    if (list === undefined) return [];
    if (!Array.isArray(list)) {
      add(AUTHORING_CODES.invalidType, 'This must be an array (use [] when empty).', path);
      return [];
    }
    const entries: AnswerEntry[] = [];
    list.forEach((fact: unknown, i) => {
      const entry = readFact(fact, `${path}[${i}]`, id);
      if (entry === undefined) return;
      const at = `${generatedPath}[${entries.length}]`;
      pathMap.set(at, `${path}[${i}]`);
      pathMap.set(`${at}.text`, `${path}[${i}]`);
      pathMap.set(`${at}.explanation`, `${path}[${i}].explanation`);
      pathMap.set(`${at}.id`, `${path}[${i}]`);
      entries.push(entry);
    });
    pathMap.set(generatedPath, path);
    return entries;
  };

  (value['diseases'] as unknown[]).forEach((raw, d) => {
    const path = `diseases[${d}]`;
    if (!isObject(raw)) {
      add(AUTHORING_CODES.invalidType, 'Each disease must be an object (see the template).', path);
      return;
    }
    unknownFields(raw, DISEASE_FIELDS, path);
    const name = raw['name'];
    if (typeof name !== 'string') {
      add(AUTHORING_CODES.invalidType, '"name" must be the disease name as a string.', `${path}.name`);
      return;
    }
    const s = subjects.length;
    const slug = slugify(name);
    pathMap.set(`subjects[${s}]`, path);
    pathMap.set(`subjects[${s}].subject`, `${path}.name`);
    pathMap.set(`subjects[${s}].id`, `${path}.name`);
    pathMap.set(`subjects[${s}].topics`, path);

    const subjectIncorrects = readList(raw['alternativeDiagnoses'], `${path}.alternativeDiagnoses`, (t) => `clinical.answer.${slug}.alternative.${factSlug(t)}`, `subjects[${s}].subjectIncorrects`);
    const topics: Topic[] = [];
    for (const key of AUTHORING_CATEGORY_FIELDS) {
      const category = raw[key];
      const catPath = `${path}.${key}`;
      if (category === undefined) continue;
      if (!isObject(category)) {
        add(AUTHORING_CODES.invalidType, `"${key}" must be an object: { "correct": [ ... ], "incorrect": [ ... ] }.`, catPath);
        continue;
      }
      unknownFields(category, CATEGORY_FIELDS, catPath);
      const t = topics.length;
      const base = `subjects[${s}].topics[${t}]`;
      const corrects = readList(category['correct'], `${catPath}.correct`, (x) => `clinical.answer.${slug}.${key}.fact.${factSlug(x)}`, `${base}.corrects`);
      const incorrects = readList(category['incorrect'], `${catPath}.incorrect`, (x) => `clinical.answer.${slug}.${key}.not.${factSlug(x)}`, `${base}.incorrects`);
      if (corrects.length === 0 && incorrects.length === 0) continue; // empty category: omitted
      pathMap.set(base, catPath);
      pathMap.set(`${base}.topicName`, catPath);
      pathMap.set(`${base}.id`, catPath);
      const topicName = CLINICAL_CATEGORIES.find((c) => c.key === key)?.topicName as string;
      topics.push({ id: `clinical.topic.${slug}.${key}`, topicName, corrects, incorrects });
    }
    subjects.push({ id: `clinical.subject.${slug}`, subject: name, subjectIncorrects, topics });
  });

  if (issues.length > 0) return { ok: false, issues };

  // Generated ids must be unique (two disease names with the same slug, or a hash clash).
  // Disease ids first: a disease clash also clashes every nested id, so report only the root cause.
  const seen = new Map<string, string>();
  for (const [generated, authored] of pathMap) {
    if (!/^subjects\[\d+\]\.id$/.test(generated)) continue;
    const id = idAt(subjects, generated) as string;
    const first = seen.get(id);
    if (first !== undefined) {
      add(AUTHORING_CODES.duplicateId, `This disease name produces the same identifier as ${first} ("${id}"). Each disease may appear only once; names that differ only in punctuation or case count as the same. Rename or merge one.`, authored);
    } else seen.set(id, authored);
  }
  if (issues.length > 0) return { ok: false, issues };
  for (const [generated, authored] of pathMap) {
    if (!generated.endsWith('.id') || /^subjects\[\d+\]\.id$/.test(generated)) continue;
    const id = idAt(subjects, generated);
    if (id === undefined) continue;
    const first = seen.get(id);
    if (first !== undefined && first !== authored) {
      add(
        AUTHORING_CODES.duplicateId,
        `This produces the same identifier as ${first} ("${id}"). Disease names that differ only in punctuation or case, or two entries with the same text, cannot both be used. Rename or remove one.`,
        authored,
      );
    } else seen.set(id, authored);
  }
  if (issues.length > 0) return { ok: false, issues };

  const collection: SubjectCollection = { schemaVersion: '1.0.0', subjects };
  const validated = validateClinicalCollection(collection);
  if (!validated.ok) {
    return { ok: false, issues: validated.issues.map((i) => ({ code: i.code, message: i.message, path: mapPath(pathMap, i.path) })) };
  }
  return { ok: true, collection, json: `${JSON.stringify(collection, null, 2)}\n` };
}

/** The id stored at a generated `...id` path. */
function idAt(subjects: readonly SubjectRecord[], path: string): string | undefined {
  const m = /^subjects\[(\d+)\](?:\.(subjectIncorrects)\[(\d+)\]|\.topics\[(\d+)\](?:\.(corrects|incorrects)\[(\d+)\])?)?\.id$/.exec(path);
  if (m === null) return undefined;
  const subject = subjects[Number(m[1])];
  if (subject === undefined) return undefined;
  if (m[2] !== undefined) return subject.subjectIncorrects[Number(m[3])]?.id;
  if (m[4] === undefined) return subject.id;
  const topic = subject.topics[Number(m[4])];
  if (m[5] === undefined) return topic?.id;
  return (m[5] === 'corrects' ? topic?.corrects : topic?.incorrects)?.[Number(m[6])]?.id;
}

/** Map a generated-collection path back to the authoring path (longest known prefix). */
function mapPath(map: ReadonlyMap<string, string>, path: string): string {
  if (map.has(path)) return map.get(path) as string;
  let best = '';
  for (const key of map.keys()) if (path.startsWith(key) && key.length > best.length) best = key;
  return best === '' ? path : (map.get(best) as string);
}

export type OverwriteDecision = 'write' | 'unchanged' | 'refuse';

/**
 * Whether the converter may write `clinical-demo.json`:
 *   - no file yet                                   -> write
 *   - the file already equals the new output        -> unchanged
 *   - the file is exactly what the converter wrote  -> write (tracked by fingerprint)
 *   - anything else (hand-edited, or not generated) -> refuse, unless the owner
 *     explicitly allows overwriting (the command then backs the file up first)
 */
export function decideOverwrite(input: {
  readonly existingText: string | undefined;
  readonly recordedFingerprint: string | undefined;
  readonly newText: string;
  readonly overwriteAllowed: boolean;
}): OverwriteDecision {
  if (input.existingText === undefined) return 'write';
  if (input.existingText === input.newText) return 'unchanged';
  if (input.recordedFingerprint !== undefined && input.recordedFingerprint.trim() === generatedFingerprint(input.existingText)) return 'write';
  return input.overwriteAllowed ? 'write' : 'refuse';
}

/** Fingerprint of generated file text, recorded next to it so later runs can recognise it. */
export const generatedFingerprint = (text: string): string => `fp1-${fnv1a64Hex(text)}`;
