/**
 * Convert the simplified authoring file into the production dataset.
 *
 *   npm run convert -w clinical-cards
 *
 * Reads  clinical-cards/authoring/clinical-authoring.json   (or CLINICAL_AUTHORING_FILE)
 * Writes clinical-cards/src/data/clinical-demo.json          (or CLINICAL_DATA_DIR)
 *        clinical-cards/src/data/clinical-demo.generated.txt (fingerprint of what was written)
 *
 * Never silently overwrites owner content: an existing clinical-demo.json is replaced
 * only when it is exactly what this command wrote last time. Otherwise the command
 * stops, unless CLINICAL_CONVERT_OVERWRITE=1 is set, and then the old file is first
 * copied to clinical-cards/authoring/backups/. It creates no review records and
 * attests nothing; if clinical-review.json exists, it reports which records are now
 * stale or invalid.
 */

import { expect, it } from 'vitest';
import { convertAuthoringText, decideOverwrite, generatedFingerprint } from '../src/clinical-authoring-format.js';
import { CLINICAL_DATASET_FILE, CLINICAL_REVIEW_FILE, parseJsonText } from '../src/clinical-data.js';
import { validateReviewFile } from '../src/clinical-review.js';
import { nodeIo, stamp } from './io.js';

const FINGERPRINT_FILE = 'clinical-demo.generated.txt';

it('Convert clinical-authoring.json to clinical-demo.json', async () => {
  const io = await nodeIo();
  const source = io.file('CLINICAL_AUTHORING_FILE', '../authoring/clinical-authoring.json');
  const dataDir = io.folder('CLINICAL_DATA_DIR', '../src/data/');
  const backups = io.folder('CLINICAL_BACKUP_DIR', '../authoring/backups/');
  const lines: string[] = [];
  const problems: string[] = [];

  const text = await io.readIfExists(source);
  if (text === undefined) {
    problems.push(`${io.show(source)} does not exist. Create it with: npm run add-disease -w clinical-cards`);
  } else {
    const converted = convertAuthoringText(text);
    if (!converted.ok) {
      problems.push(...converted.issues.map((i) => `[${i.code}] ${i.path}: ${i.message}`));
    } else {
      const target = new URL(CLINICAL_DATASET_FILE, dataDir);
      const marker = new URL(FINGERPRINT_FILE, dataDir);
      const existingText = await io.readIfExists(target);
      const recordedFingerprint = await io.readIfExists(marker);
      const decision = decideOverwrite({ existingText, recordedFingerprint, newText: converted.json, overwriteAllowed: io.env['CLINICAL_CONVERT_OVERWRITE'] === '1' });
      if (decision === 'refuse') {
        problems.push(
          `${io.show(target)} exists and was not written by this command (or was edited by hand since). Nothing was changed. ` +
            'Move it aside, or run again with CLINICAL_CONVERT_OVERWRITE=1 to replace it (the old file is backed up to clinical-cards/authoring/backups/ first).',
        );
      } else {
        if (decision === 'write') {
          const generatedBefore = existingText !== undefined && recordedFingerprint?.trim() === generatedFingerprint(existingText);
          if (existingText !== undefined && !generatedBefore) {
            await io.fs.mkdir(backups, { recursive: true });
            const backup = new URL(`clinical-demo.${stamp()}.json`, backups);
            await io.fs.copyFile(target, backup);
            lines.push(`Backed up the previous ${CLINICAL_DATASET_FILE} to ${io.show(backup)}`);
          }
          await io.fs.mkdir(dataDir, { recursive: true });
          await io.fs.writeFile(target, converted.json, 'utf8');
          await io.fs.writeFile(marker, `${generatedFingerprint(converted.json)}\n`, 'utf8');
          lines.push(`Wrote ${io.show(target)}`);
        } else {
          lines.push(`${io.show(target)} is already up to date.`);
        }
        const subjects = converted.collection.subjects;
        const facts = subjects.reduce((n, s) => n + s.topics.reduce((m, t) => m + t.corrects.length + t.incorrects.length, 0), 0);
        lines.push(`Diseases: ${subjects.length}. Categories: ${subjects.reduce((n, s) => n + s.topics.length, 0)}. Facts: ${facts}. Alternative diagnoses: ${subjects.reduce((n, s) => n + s.subjectIncorrects.length, 0)}.`);

        const reviewText = await io.readIfExists(new URL(CLINICAL_REVIEW_FILE, dataDir));
        if (reviewText === undefined) {
          lines.push(`${CLINICAL_REVIEW_FILE} does not exist yet. Next: npm run review-report -w clinical-cards`);
        } else {
          const parsed = parseJsonText(reviewText, CLINICAL_REVIEW_FILE);
          if (!parsed.ok) {
            lines.push(`NOTE: ${parsed.issue.message}`);
          } else {
            const review = validateReviewFile(parsed.value, converted.collection);
            const all = [...review.records, ...review.alternativeRecords];
            lines.push(
              `Review records: ${all.filter((r) => r.state === 'current').length} current, ${all.filter((r) => r.state === 'stale').length} stale, ${all.filter((r) => r.state === 'invalid').length} invalid.`,
            );
            for (const s of review.stale) lines.push(`STALE: ${s.path}: ${s.message}`);
            lines.push('Next: npm run review-report -w clinical-cards');
          }
        }
      }
    }
  }
  console.log([...lines, ...problems.map((p) => `PROBLEM: ${p}`)].join('\n'));
  expect(problems, 'The authoring file could not be converted (see the PROBLEM lines above)').toEqual([]);
});
