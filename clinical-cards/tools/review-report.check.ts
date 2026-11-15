/**
 * The Clinical review-report command (Milestone M6, stage C5 preparation).
 *
 *   npm run review-report -w clinical-cards
 *
 * Reads the owner's files from clinical-cards/src/data/ (or CLINICAL_DATA_DIR),
 * validates them, measures deck sufficiency, and writes to
 * clinical-cards/review-output/ (or CLINICAL_REPORT_DIR):
 *   review-report.txt    summary, deck sufficiency, and the 7-section review report
 *   review-drafts.json   suggested review records with current fingerprints and
 *                        placeholders (they attest nothing until filled in)
 * It fails (non-zero exit) when the files are missing, unreadable, invalid, or a
 * review record has errors. Stale reviews and limited decks are notes, not failures.
 *
 * It runs through Vitest with its own config (tools/vitest.review.config.ts), so it
 * needs no additional dependency, and it is not part of the normal test suite.
 * File I/O only; all logic is in src/clinical-authoring.ts.
 */

import { expect, it } from 'vitest';
import { buildAuthoringOutput } from '../src/clinical-authoring.js';
import { CLINICAL_DATASET_FILE, CLINICAL_REVIEW_FILE } from '../src/clinical-data.js';

interface Fs {
  readFile(path: URL, encoding: string): Promise<string>;
  writeFile(path: URL, data: string, encoding: string): Promise<void>;
  mkdir(path: URL, options: { recursive: boolean }): Promise<unknown>;
}

const dynamicImport = async <T>(specifier: string): Promise<T> => (await import(/* @vite-ignore */ specifier)) as T;

it('Clinical review report', async () => {
  const fs = await dynamicImport<Fs>('node:fs/promises');
  const { env } = await dynamicImport<{ env: Record<string, string | undefined> }>('node:process');
  const { pathToFileURL, fileURLToPath } = await dynamicImport<{ pathToFileURL(path: string): URL; fileURLToPath(url: URL): string }>('node:url');
  const folder = (variable: string | undefined, fallback: string): URL =>
    variable === undefined || variable === '' ? new URL(fallback, import.meta.url) : new URL(`${pathToFileURL(variable).href.replace(/\/?$/, '/')}`);
  const dataDir = folder(env['CLINICAL_DATA_DIR'], '../src/data/');
  const outDir = folder(env['CLINICAL_REPORT_DIR'], '../review-output/');

  const read = async (name: string): Promise<string | undefined> => {
    try {
      return await fs.readFile(new URL(name, dataDir), 'utf8');
    } catch (error) {
      if ((error as { code?: string }).code === 'ENOENT') return undefined;
      throw error;
    }
  };

  const output = buildAuthoringOutput({ datasetText: await read(CLINICAL_DATASET_FILE), reviewText: await read(CLINICAL_REVIEW_FILE) });
  await fs.mkdir(outDir, { recursive: true });
  for (const [name, text] of Object.entries(output.files)) await fs.writeFile(new URL(name, outDir), text, 'utf8');

  console.log(`${output.summary}\n\nWritten to: ${fileURLToPath(outDir)} (${Object.keys(output.files).join(', ')})`);
  expect(output.problems, 'Blocking problems in the clinical content (see review-report.txt)').toEqual([]);
});
