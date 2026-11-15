/**
 * Owner authoring support (Milestone M6, stage C5 preparation).
 *
 * Pure helpers behind the review-report command (`npm run review-report -w
 * clinical-cards`). They read nothing from disk themselves:
 *   - `checkClinicalSufficiency`: generates decks for both modes x both question
 *     directions over many seeds with the REAL generator and reports, per
 *     combination, whether every seed produced a playable deck and how large the
 *     decks were. It measures; it never pads or adds content.
 *   - `suggestReviewDrafts`: a review-file skeleton with CURRENT fingerprints and
 *     PLACEHOLDER reviewer and date, so it attests nothing. The validator rejects
 *     every record in it until a reviewer has done the review and filled them in.
 *   - `buildAuthoringOutput`: everything the command writes (report text, drafts
 *     JSON, a short summary) and the list of blocking problems.
 *
 * No clinical knowledge and no clinical judgments: groupings are structural
 * (same category, same disease) suggestions for the reviewer's convenience.
 */

import { normalizeDisplayText, type GenerationDirection, type SubjectCollection } from '@beepy/shared-engine';
import { CLINICAL_CATEGORIES, categoryOfTopicName } from './clinical-content.js';
import {
  CLINICAL_DATASET_FILE,
  CLINICAL_REVIEW_FILE,
  loadClinicalContent,
  type ClinicalContent,
  type ClinicalDataIssue,
} from './clinical-data.js';
import {
  CLINICAL_COMPETITIVE_TARGET_CARD_COUNT,
  CLINICAL_SOLITAIRE_TARGET_CARD_COUNT,
  generateClinicalDeck,
  type ClinicalMode,
} from './clinical-generator.js';
import {
  REVIEW_FORMAT_VERSION,
  buildReviewReport,
  draftAlternativeReview,
  draftReviewRecord,
  formatReviewReport,
  type AlternativeReviewDraft,
  type ReviewRecordDraft,
} from './clinical-review.js';

/** Seeds tried per combination by default. */
export const SUFFICIENCY_DEFAULT_SEEDS = 25;

export interface SufficiencyCombination {
  readonly mode: ClinicalMode;
  readonly direction: GenerationDirection;
  readonly targetCardCount: number;
  readonly attempts: number;
  /** Seeds that produced a validated deck. */
  readonly generated: number;
  /** Decks that reached the target size. */
  readonly fullSize: number;
  readonly minCards: number | undefined;
  readonly maxCards: number | undefined;
  /** Failure code -> count. */
  readonly failures: Readonly<Record<string, number>>;
  /** One example failure message, for guidance. */
  readonly exampleFailure: string | undefined;
  /** True when every tried seed produced a deck. */
  readonly playable: boolean;
}

export interface SufficiencyResult {
  readonly combinations: readonly SufficiencyCombination[];
  /** True when all four combinations are playable for every tried seed. */
  readonly allPlayable: boolean;
}

const COMBINATIONS: readonly (readonly [ClinicalMode, GenerationDirection])[] = [
  ['solitaire', 'subjectToFact'],
  ['vsBeepy', 'subjectToFact'],
  ['solitaire', 'factToSubject'],
  ['vsBeepy', 'factToSubject'],
];

/** Measure what the real generator can build from this content. */
export function checkClinicalSufficiency(content: ClinicalContent, options: { readonly seeds?: number } = {}): SufficiencyResult {
  const seeds = options.seeds ?? SUFFICIENCY_DEFAULT_SEEDS;
  const combinations = COMBINATIONS.map(([mode, direction]): SufficiencyCombination => {
    const targetCardCount = mode === 'vsBeepy' ? CLINICAL_COMPETITIVE_TARGET_CARD_COUNT : CLINICAL_SOLITAIRE_TARGET_CARD_COUNT;
    let generated = 0;
    let fullSize = 0;
    let minCards: number | undefined;
    let maxCards: number | undefined;
    let exampleFailure: string | undefined;
    const failures: Record<string, number> = {};
    for (let seed = 1; seed <= seeds; seed += 1) {
      const result = generateClinicalDeck({
        source: content.collection,
        config: { app: 'clinical', generationDirection: direction },
        mode,
        challengeCount: mode === 'vsBeepy' ? 9 : 5,
        targetCardCount,
        seed,
        ...(content.reviewValue === undefined ? {} : { review: content.reviewValue }),
      });
      if (result.ok) {
        generated += 1;
        const size = result.deck.answerCards.length;
        if (size === targetCardCount) fullSize += 1;
        minCards = minCards === undefined ? size : Math.min(minCards, size);
        maxCards = maxCards === undefined ? size : Math.max(maxCards, size);
      } else {
        for (const found of result.issues) failures[found.code] = (failures[found.code] ?? 0) + 1;
        exampleFailure ??= result.issues[0]?.message;
      }
    }
    return { mode, direction, targetCardCount, attempts: seeds, generated, fullSize, minCards, maxCards, failures, exampleFailure, playable: generated === seeds };
  });
  return { combinations, allPlayable: combinations.every((c) => c.playable) };
}

export interface ReviewDraftFile {
  readonly reviewFormatVersion: string;
  readonly reviews: readonly ReviewRecordDraft[];
  readonly alternativeReviews: readonly AlternativeReviewDraft[];
}

const slugOf = (subjectId: string): string => subjectId.split('.').slice(2).join('.');

/**
 * A suggested review file with current fingerprints and placeholders:
 *   - one topic group per category (that category's topics across all diseases);
 *   - one topic group per disease (its categories, for cross-category review);
 *   - one alternative-diagnosis record per disease that lists alternatives.
 * The reviewer keeps, splits, or deletes these, fills in name and date ONLY for
 * reviews actually performed, and may build other small groups from the report's
 * fingerprint list.
 */
export function suggestReviewDrafts(collection: SubjectCollection): ReviewDraftFile {
  const reviews: ReviewRecordDraft[] = [];
  for (const category of CLINICAL_CATEGORIES) {
    const ids = collection.subjects.flatMap((s) => s.topics.filter((t) => categoryOfTopicName(t.topicName) === category.key).map((t) => t.id));
    if (ids.length >= 2) reviews.push(draftReviewRecord(collection, `review.category.${category.key}`, ids).draft);
  }
  for (const disease of collection.subjects) {
    if (disease.topics.length >= 2) {
      reviews.push(draftReviewRecord(collection, `review.disease.${slugOf(disease.id)}`, disease.topics.map((t) => t.id)).draft);
    }
  }
  const alternativeReviews: AlternativeReviewDraft[] = [];
  for (const disease of collection.subjects) {
    if (disease.subjectIncorrects.length === 0) continue;
    const drafted = draftAlternativeReview(collection, `review.alternatives.${slugOf(disease.id)}`, disease.id);
    if (drafted !== undefined) alternativeReviews.push(drafted.draft);
  }
  return { reviewFormatVersion: REVIEW_FORMAT_VERSION, reviews, alternativeReviews };
}

/** A plain-text rendering of the sufficiency result. */
export function formatSufficiency(result: SufficiencyResult): string {
  const name = (c: SufficiencyCombination) =>
    `${c.mode === 'vsBeepy' ? 'Player vs. Beepy' : 'Solitaire'}, ${c.direction === 'subjectToFact' ? 'disease + category -> fact' : 'fact -> disease'}`;
  const lines = ['DECK SUFFICIENCY (real generator, current review coverage)'];
  for (const c of result.combinations) {
    const sizes = c.minCards === undefined ? 'no decks' : c.minCards === c.maxCards ? `${c.minCards} cards` : `${c.minCards}-${c.maxCards} cards`;
    lines.push(
      `  - ${name(c)}: ${c.playable ? 'PLAYABLE' : 'NOT PLAYABLE'} - ${c.generated}/${c.attempts} seeds produced a deck (${sizes}; target ${c.targetCardCount}; full size ${c.fullSize}/${c.attempts}).`,
    );
    const failures = Object.entries(c.failures);
    if (failures.length > 0) {
      lines.push(`      failures: ${failures.map(([code, count]) => `${code} x${count}`).join(', ')}`);
      if (c.exampleFailure !== undefined) lines.push(`      example: ${c.exampleFailure}`);
    }
  }
  lines.push(result.allPlayable ? '  Overall: every combination produced a deck for every seed tried.' : '  Overall: at least one combination cannot always produce a deck. See section 6 of the review report for where review coverage is thin.');
  return lines.join('\n');
}

export interface AuthoringOutput {
  /** Blocking problems. The command fails when this is not empty. */
  readonly problems: readonly string[];
  /** Non-blocking notes (missing review file at first run, stale reviews, limited decks). */
  readonly warnings: readonly string[];
  readonly summary: string;
  /** File name -> contents to write to the output folder. */
  readonly files: Readonly<Record<string, string>>;
}

const issueLines = (issues: readonly ClinicalDataIssue[]): string[] => issues.map((i) => `[${i.code}] ${i.path}: ${i.message}`);

/**
 * Everything the review-report command produces, from the TEXT of the two files
 * (undefined when a file does not exist). A missing review file is allowed here
 * (first run): the report and drafts are still produced so the review can begin.
 */
export function buildAuthoringOutput(input: { readonly datasetText: string | undefined; readonly reviewText: string | undefined; readonly seeds?: number }): AuthoringOutput {
  const problems: string[] = [];
  const warnings: string[] = [];
  const loaded = loadClinicalContent({ datasetText: input.datasetText, reviewText: input.reviewText, requireReview: false });
  if (!loaded.ok) {
    if (loaded.code === 'CLINICAL_DATA_MISSING') {
      problems.push(
        `${CLINICAL_DATASET_FILE} does not exist yet. Create clinical-cards/src/data/${CLINICAL_DATASET_FILE} by entering diseases in clinical-cards/authoring/clinical-authoring.json (npm run add-disease -w clinical-cards) and running: npm run convert -w clinical-cards.`,
      );
    } else {
      problems.push(...issueLines(loaded.issues));
    }
    const summary = ['CLINICAL CONTENT CHECK: BLOCKED', ...problems.map((p) => `  - ${p}`)].join('\n');
    return { problems, warnings, summary, files: { 'review-report.txt': `${summary}\n` } };
  }
  const { content } = loaded;
  if (input.reviewText === undefined) {
    warnings.push(`${CLINICAL_REVIEW_FILE} does not exist yet: every unlisted relationship is unknown, so few or no decks can be built. Use review-drafts.json to start it.`);
  }
  problems.push(...content.review.issues.map((i) => `[${i.code}] ${CLINICAL_REVIEW_FILE}: ${i.path}: ${i.message}`));
  warnings.push(...content.review.stale.map((i) => `[${i.code}] ${CLINICAL_REVIEW_FILE}: ${i.path}: ${i.message}`));

  const report = buildReviewReport(content.datasetValue, content.reviewValue);
  if (!report.ok) throw new Error('unreachable: the dataset was already validated');
  const sufficiency = checkClinicalSufficiency(content, input.seeds === undefined ? {} : { seeds: input.seeds });
  if (!sufficiency.allPlayable) warnings.push('Not every mode and question style can always produce a deck yet (see DECK SUFFICIENCY).');

  const s = report.report.summary;
  const facts = content.collection.subjects.reduce((sum, d) => sum + d.topics.reduce((t, topic) => t + topic.corrects.length, 0), 0);
  const names = new Set(content.collection.subjects.flatMap((d) => [d.subject, ...d.subjectIncorrects.map((e) => e.text)].map(normalizeDisplayText))).size;
  const summary = [
    `CLINICAL CONTENT CHECK: ${problems.length > 0 ? 'PROBLEMS FOUND' : 'VALID'}${sufficiency.allPlayable ? '' : ' (decks limited)'}`,
    `  Diseases: ${s.diseases}. Categories (topics): ${s.topics}. Correct facts: ${facts}. Distinct disease and alternative names: ${names}.`,
    `  Topic pairs reviewed: ${s.reviewedPairs} of ${s.topicPairs}. Alternatives covered: ${s.alternatives.reviewed} of ${s.alternatives.listed}.`,
    `  Review records: ${s.records.current} current, ${s.records.stale} stale, ${s.records.invalid} invalid; alternative reviews: ${s.alternativeRecords.current} current, ${s.alternativeRecords.stale} stale, ${s.alternativeRecords.invalid} invalid.`,
    ...sufficiency.combinations.map(
      (c) => `  ${c.playable ? 'PLAYABLE    ' : 'NOT PLAYABLE'} ${c.mode} / ${c.direction}: ${c.generated}/${c.attempts} seeds, ${c.minCards ?? 0}-${c.maxCards ?? 0} cards (target ${c.targetCardCount})`,
    ),
    ...problems.map((p) => `  PROBLEM: ${p}`),
    ...warnings.map((w) => `  NOTE: ${w}`),
  ].join('\n');

  const reportText = [summary, '', formatSufficiency(sufficiency), '', formatReviewReport(report.report, { limit: 100000 }), ''].join('\n');
  return {
    problems,
    warnings,
    summary,
    files: {
      'review-report.txt': reportText,
      'review-drafts.json': `${JSON.stringify(suggestReviewDrafts(content.collection), null, 2)}\n`,
    },
  };
}
