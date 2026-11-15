/**
 * Append one blank disease to the authoring file.
 *
 *   npm run add-disease -w clinical-cards
 *   (optional, PowerShell)  $env:CLINICAL_DISEASE_NAME = "<disease name>"; npm run add-disease -w clinical-cards
 *
 * Adds { "name", "alternativeDiagnoses": [], and all four categories with empty
 * "correct" and "incorrect" arrays } to clinical-cards/authoring/clinical-authoring.json
 * (or CLINICAL_AUTHORING_FILE), creating the file if needed. It writes NO clinical
 * content. Existing content is preserved exactly, and the previous file is first
 * copied to clinical-cards/authoring/backups/.
 */

import { expect, it } from 'vitest';
import { addBlankDisease } from '../src/clinical-authoring-format.js';
import { nodeIo, stamp } from './io.js';

it('Add a blank disease to clinical-authoring.json', async () => {
  const io = await nodeIo();
  const target = io.file('CLINICAL_AUTHORING_FILE', '../authoring/clinical-authoring.json');
  const backups = io.folder('CLINICAL_BACKUP_DIR', '../authoring/backups/');
  const name = io.env['CLINICAL_DISEASE_NAME'] ?? '';
  const existing = await io.readIfExists(target);
  const result = addBlankDisease(existing, name);
  if (!result.ok) {
    console.log(result.issues.map((i) => `PROBLEM: [${i.code}] ${i.path}: ${i.message}`).join('\n'));
  } else {
    if (existing !== undefined) {
      await io.fs.mkdir(backups, { recursive: true });
      await io.fs.copyFile(target, new URL(`clinical-authoring.${stamp()}.json`, backups));
    }
    await io.fs.writeFile(target, result.text, 'utf8');
    console.log(`Added a blank disease${name === '' ? ' (fill in "name")' : ` named "${name}"`} at the end of ${io.show(target)}`);
  }
  expect(result.ok ? [] : result.issues).toEqual([]);
});
