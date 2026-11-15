/**
 * The shipped Clinical content (Milestone M6, stage C5 preparation; decision C-10).
 *
 * The owner places two reviewed files in `clinical-cards/src/data/`:
 *   clinical-demo.json    the dataset
 *   clinical-review.json  the review records
 * Vite bundles their TEXT at build time (`?raw`), so a JSON syntax error becomes a
 * friendly, located validation issue instead of a build crash. When a file does
 * not exist, the glob simply has no entry: the content is reported as MISSING.
 * There is deliberately no fallback to fictional, unreviewed or invented content,
 * and no placeholder file is shipped.
 */

import { CLINICAL_DATASET_FILE, CLINICAL_REVIEW_FILE, loadClinicalContent, type ClinicalContentResult } from './clinical-data.js';

const files: Readonly<Record<string, string>> = import.meta.glob<string>('./data/*.json', { eager: true, query: '?raw', import: 'default' });

const textOf = (name: string): string | undefined => {
  const text = files[`./data/${name}`];
  return typeof text === 'string' ? text : undefined;
};

/** The raw text of the shipped files, when present. For tooling and tests. */
export function shippedClinicalFiles(): { readonly datasetText: string | undefined; readonly reviewText: string | undefined } {
  return { datasetText: textOf(CLINICAL_DATASET_FILE), reviewText: textOf(CLINICAL_REVIEW_FILE) };
}

/** Load and validate the shipped files. Both are required. Never throws. */
export function loadShippedClinicalContent(): ClinicalContentResult {
  return loadClinicalContent({ ...shippedClinicalFiles(), requireReview: true });
}
