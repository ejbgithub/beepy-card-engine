/**
 * Clinical content loading and validation (Milestone M6, stage C5 preparation).
 *
 * Turns the TEXT of the owner's two files into validated content, or a refusal:
 *   clinical-demo.json    the reviewed dataset (M2 schema + C1 Clinical rules)
 *   clinical-review.json  the review records (C2 format, including Q-1 records)
 *
 * Rules (owner-approved C5 default-data design):
 *   - Both files are validated before any game starts.
 *   - Invalid or unusable content is refused with a friendly, detail-free
 *     message for the player; the full structured issues are returned separately
 *     for trusted tooling and diagnostics only.
 *   - There is NO fallback to fictional, unreviewed, or invented content. A
 *     missing file is reported as missing.
 *   - Inside a usable review file, invalid or stale records are not fatal: they
 *     are simply not used (C2), and are listed in `review.issues` / `review.stale`.
 *
 * Pure: no file system, no DOM. `shipped-data.ts` supplies the bundled text; the
 * review-report command supplies text read from disk.
 */

import type { SubjectCollection } from '@beepy/shared-engine';
import { validateClinicalCollection } from './clinical-content.js';
import { validateReviewFile, type ReviewValidationResult } from './clinical-review.js';

/** The two owner-authored files, by name, in `clinical-cards/src/data/`. */
export const CLINICAL_DATASET_FILE = 'clinical-demo.json';
export const CLINICAL_REVIEW_FILE = 'clinical-review.json';

export const CLINICAL_DATA_CODES = {
  dataMissing: 'CLINICAL_DATA_MISSING',
  reviewMissing: 'CLINICAL_REVIEW_MISSING',
  jsonSyntax: 'CLINICAL_JSON_SYNTAX',
  dataInvalid: 'CLINICAL_DATA_INVALID',
  reviewInvalid: 'CLINICAL_REVIEW_INVALID',
} as const;

export type ClinicalDataCode = (typeof CLINICAL_DATA_CODES)[keyof typeof CLINICAL_DATA_CODES];

/** Friendly messages a player may see. They name no file content. */
export const CLINICAL_DATA_MESSAGES: Readonly<Record<'CLINICAL_DATA_MISSING' | 'CLINICAL_REVIEW_MISSING' | 'CLINICAL_DATA_INVALID' | 'CLINICAL_REVIEW_INVALID', string>> = {
  CLINICAL_DATA_MISSING: 'The clinical card content has not been added yet.',
  CLINICAL_REVIEW_MISSING: 'The clinical review records have not been added yet.',
  CLINICAL_DATA_INVALID: 'The clinical card data could not be loaded.',
  CLINICAL_REVIEW_INVALID: 'The clinical review data could not be loaded.',
};

/** A structured, actionable issue for trusted tooling (code, message, path). */
export interface ClinicalDataIssue {
  readonly code: string;
  readonly message: string;
  readonly path: string;
}

/** Content that passed every check and may be used to start games. */
export interface ClinicalContent {
  readonly collection: SubjectCollection;
  /** The parsed dataset value, exactly as authored. */
  readonly datasetValue: unknown;
  /** The parsed review value, exactly as authored (undefined only for test injection without reviews). */
  readonly reviewValue: unknown;
  readonly review: ReviewValidationResult;
}

export type ClinicalContentResult =
  | { readonly ok: true; readonly content: ClinicalContent }
  | {
      readonly ok: false;
      /** Public code; one of the four refusal codes. */
      readonly code: 'CLINICAL_DATA_MISSING' | 'CLINICAL_REVIEW_MISSING' | 'CLINICAL_DATA_INVALID' | 'CLINICAL_REVIEW_INVALID';
      /** Friendly, detail-free message. */
      readonly message: string;
      /** Full issues, for trusted tooling only. Never show these to a player. */
      readonly issues: readonly ClinicalDataIssue[];
    };

/** Line and column (1-based) of a character offset in `text`. */
function lineAndColumn(text: string, offset: number): { line: number; column: number } {
  const before = text.slice(0, Math.max(0, Math.min(offset, text.length)));
  const lines = before.split(/\r\n|\r|\n/);
  return { line: lines.length, column: (lines[lines.length - 1] ?? '').length + 1 };
}

/**
 * Find where JSON text first goes wrong. Used only after `JSON.parse` has failed,
 * because the built-in message does not always give a position, and some messages
 * repeat the whole file. Returns the offset and a short reason.
 */
export function locateJsonError(text: string): { readonly offset: number; readonly reason: string } {
  let i = 0;
  const ws = () => {
    while (i < text.length && ' \t\n\r'.includes(text[i] as string)) i += 1;
  };
  const fail = (reason: string): never => {
    throw { offset: i, reason };
  };
  const expectChar = (char: string, reason: string) => {
    if (text[i] !== char) fail(i >= text.length ? 'the file ends too early' : reason);
    i += 1;
  };
  const string = () => {
    expectChar('"', 'expected a quoted string');
    while (i < text.length && text[i] !== '"') {
      const c = text.charCodeAt(i);
      if (c < 0x20) fail('a line break or control character inside a quoted string (close the quote, or use \\n)');
      if (text[i] === '\\') {
        i += 1;
        if (!'"\\/bfnrtu'.includes(text[i] ?? '')) fail('an invalid backslash escape inside a string');
        if (text[i] === 'u') {
          if (!/^[0-9a-fA-F]{4}$/.test(text.slice(i + 1, i + 5))) fail('an invalid \\u escape');
          i += 4;
        }
      }
      i += 1;
    }
    expectChar('"', 'a string is not closed');
  };
  const value = (): void => {
    ws();
    const c = text[i];
    if (c === undefined) fail('the file ends too early');
    if (c === '{') {
      i += 1;
      ws();
      if (text[i] === '}') {
        i += 1;
        return;
      }
      for (;;) {
        ws();
        if (text[i] !== '"') fail(text[i] === '}' ? 'a trailing comma before "}"' : 'expected a property name in double quotes');
        string();
        ws();
        expectChar(':', 'expected ":" after a property name');
        value();
        ws();
        if (text[i] === ',') {
          i += 1;
          continue;
        }
        expectChar('}', 'expected "," or "}" (a comma may be missing)');
        return;
      }
    }
    if (c === '[') {
      i += 1;
      ws();
      if (text[i] === ']') {
        i += 1;
        return;
      }
      for (;;) {
        ws();
        if (text[i] === ']' || text[i] === ',') fail(text[i] === ']' ? 'a trailing comma before "]"' : 'an empty item (two commas in a row)');
        value();
        ws();
        if (text[i] === ',') {
          i += 1;
          continue;
        }
        expectChar(']', 'expected "," or "]" (a comma may be missing)');
        return;
      }
    }
    if (c === '"') return string();
    const literal = /^(true|false|null|-?(0|[1-9]\d*)(\.\d+)?([eE][+-]?\d+)?)/.exec(text.slice(i));
    if (literal === null) fail(c === "'" ? 'single quotes are not allowed; use double quotes' : `unexpected character "${c}"`);
    i += (literal as RegExpExecArray)[0].length;
  };
  try {
    value();
    ws();
    if (i < text.length) fail('unexpected text after the end of the JSON value');
    return { offset: text.length, reason: 'unknown syntax error' };
  } catch (error) {
    const found = error as { offset?: number; reason?: string };
    return { offset: found.offset ?? 0, reason: found.reason ?? 'unknown syntax error' };
  }
}

/**
 * Parse JSON text. A syntax error becomes a structured issue naming the file, the
 * line and column, and a short reason. It never echoes the file content. Never throws.
 */
export function parseJsonText(text: string, file: string): { readonly ok: true; readonly value: unknown } | { readonly ok: false; readonly issue: ClinicalDataIssue } {
  // A UTF-8 byte-order mark is common when files are saved by some editors; it is not content.
  const source = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  try {
    return { ok: true, value: JSON.parse(source) as unknown };
  } catch {
    const { offset, reason } = locateJsonError(source);
    const { line, column } = lineAndColumn(source, offset);
    return {
      ok: false,
      issue: {
        code: CLINICAL_DATA_CODES.jsonSyntax,
        message: `${file} is not valid JSON at line ${line}, column ${column}: ${reason}. Check for a missing comma, quote, or bracket near that place.`,
        path: file,
      },
    };
  }
}

const refuse = (
  code: 'CLINICAL_DATA_MISSING' | 'CLINICAL_REVIEW_MISSING' | 'CLINICAL_DATA_INVALID' | 'CLINICAL_REVIEW_INVALID',
  issues: readonly ClinicalDataIssue[],
): ClinicalContentResult => ({ ok: false, code, message: CLINICAL_DATA_MESSAGES[code], issues });

export interface ClinicalContentInput {
  /** The dataset file text, or undefined when the file does not exist. */
  readonly datasetText: string | undefined;
  /** The review file text, or undefined when the file does not exist. */
  readonly reviewText: string | undefined;
  /** Shipped content requires the review file. Default true. */
  readonly requireReview?: boolean;
}

/**
 * Validate the TEXT of the two files. The dataset is checked first (M2 schema and
 * C1 rules); the review file is then checked against it (C2). Missing, unparsable,
 * invalid, or unusable content is refused. Never throws.
 */
export function loadClinicalContent(input: ClinicalContentInput): ClinicalContentResult {
  try {
    if (input.datasetText === undefined) {
      return refuse(CLINICAL_DATA_CODES.dataMissing, [
        { code: CLINICAL_DATA_CODES.dataMissing, message: `${CLINICAL_DATASET_FILE} was not found in clinical-cards/src/data/.`, path: CLINICAL_DATASET_FILE },
      ]);
    }
    const parsedDataset = parseJsonText(input.datasetText, CLINICAL_DATASET_FILE);
    if (!parsedDataset.ok) return refuse(CLINICAL_DATA_CODES.dataInvalid, [parsedDataset.issue]);
    const dataset = validateClinicalCollection(parsedDataset.value);
    if (!dataset.ok) {
      return refuse(
        CLINICAL_DATA_CODES.dataInvalid,
        dataset.issues.map((i) => ({ code: i.code, message: i.message, path: `${CLINICAL_DATASET_FILE}: ${i.path}` })),
      );
    }

    if (input.reviewText === undefined) {
      if (input.requireReview ?? true) {
        return refuse(CLINICAL_DATA_CODES.reviewMissing, [
          { code: CLINICAL_DATA_CODES.reviewMissing, message: `${CLINICAL_REVIEW_FILE} was not found in clinical-cards/src/data/.`, path: CLINICAL_REVIEW_FILE },
        ]);
      }
      return { ok: true, content: { collection: dataset.collection, datasetValue: parsedDataset.value, reviewValue: undefined, review: validateReviewFile({ reviewFormatVersion: '1.0.0', reviews: [] }, dataset.collection) } };
    }
    const parsedReview = parseJsonText(input.reviewText, CLINICAL_REVIEW_FILE);
    if (!parsedReview.ok) return refuse(CLINICAL_DATA_CODES.reviewInvalid, [parsedReview.issue]);
    const review = validateReviewFile(parsedReview.value, dataset.collection);
    if (!review.fileUsable) {
      return refuse(
        CLINICAL_DATA_CODES.reviewInvalid,
        review.issues.map((i) => ({ code: i.code, message: i.message, path: `${CLINICAL_REVIEW_FILE}: ${i.path}` })),
      );
    }
    return { ok: true, content: { collection: dataset.collection, datasetValue: parsedDataset.value, reviewValue: parsedReview.value, review } };
  } catch (error) {
    return refuse(CLINICAL_DATA_CODES.dataInvalid, [{ code: 'CLINICAL_DATA_FAULT', message: `Unexpected error while loading: ${String(error)}`, path: '$' }]);
  }
}
