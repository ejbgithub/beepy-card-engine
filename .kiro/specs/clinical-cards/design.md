# Beepy's Clinical Cards — Design

Milestone M6. Status (2026-11-14): **approved with revisions** (C-3, C-6, C-12, and
the `subjectIncorrects` terminology). C0–C8 are accepted by the owner. C9
(documentation and close-out) is done and awaits the owner's final M6
acceptance. Decisions are listed in §10.

Earlier status (2026-11-12, superseded): C0–C4 accepted; C5 preparation done
(§7a); C5 blocked on owner-authored content; C6–C9 not authorized.

## 1. What was inspected (2026-11-12)

- `docs/master-spec-v1.1.md` §8, §9, §11, §12, §13.
- `clinical-cards/`: `src/clinical-generator.ts` (stub returning
  `NOT_IMPLEMENTED`), `tests/task18-no-runtime-generation.test.ts`, `package.json`,
  `tsconfig.json` (composite, `rootDir src`), `README.md`. No `index.html`, data or UI.
- Shared engine: `source-data.ts`, `identifiers.ts`, `validation.ts`, `issues.ts`,
  `challenge-mapping.ts` (`normalizeDisplayText`), `generator.ts`,
  `generated-deck.ts`, `penalty-draw.ts`, `game/view.ts`, `index.ts` exports.
- `math-cards/src/math-series.ts` and the import lists of `math-cards/src/ui/*`.
- The Task 16 and Task 18 `it.todo`; root `package.json`, `tsconfig.test.json`.

## 2. Reuse unchanged versus new

### Reused unchanged from `@beepy/shared-engine` (no edits)
| Area | Exports |
|---|---|
| Source schema and validation | `SubjectCollection`, `SubjectRecord`, `Topic`, `AnswerEntry`, `CURRENT_SCHEMA_VERSION`, `validateCollectionSource`, `parseId`, `isValidId`, `buildId`, `normalizeDisplayText`, `ValidationIssue`, `formatIssues` |
| Deck contract and gate | `GeneratedDeck`, `GeneratedChallenge`, `GeneratedAnswerCard` (incl. `explanationByChallengeId`), `validateDeckForPlay`, `validateChallengeMapping`, `validateUniqueness` |
| Sizing and ambiguity | `planDeckSize`, `validateDeckSize`, `analyzeCandidateAmbiguity`, `assessDeckData`, `countUniqueValues` |
| Generator boundary | `DeckGenerator<TRequest>`, `GenerationRequest`, `GenerationResult`, `GenerationIssue`, `GenerationSizing`, `resolveGenerationDirection`, `GENERATION_APPS` |
| Penalties | `drawPenaltyCards` (called by the engine), `PenaltyFallbackProvider`, `PenaltyCandidate` |
| Engine | `createSeriesController`, `createReferenceBeepyStrategy`, `ENGINE_MODES`, `ENGINE_ERROR_CODES`, views and `PublicEvent`, seeded random helpers |

Gameplay rules, deal composition, Accept/Challenge, the both-draw rule, penalties,
waivers, winning, tiebreaks and series scoring come from the engine with **no
Clinical code**.

### Not changed
`math-cards/` (all of it), M2 and M3 production code. Approved exceptions: the two
existing test files named in C-8 and C-9 (in C3).

### New Clinical-specific code (all in `clinical-cards/`)
| File | Stage | Purpose |
|---|---|---|
| `src/clinical-content.ts` | C1 | Categories, limits, Clinical content rules over `validateCollectionSource` (§3) |
| `tests/fixtures/fake-clinical.ts` | C1 | Test-only dataset with fictitious names and facts |
| `authoring/clinical-dataset.template.json` | C1 | Authoring template, fictitious placeholders only |
| `authoring/AUTHORING.md` | C1 | Authoring and review guide |
| `src/clinical-review.ts` | C2 | Review records, fingerprints, validity policy, review report (§4) |
| `authoring/clinical-review.template.json` | C2 | Review-file template for the dataset template |
| `src/clinical-generator.ts` | C3 | Real generator replacing the stub (§5) |
| `tests/fixtures/fake-large-clinical.ts` | C3 | Fictitious N-disease dataset and review-file builders |
| `src/clinical-fallback.ts` | C4 | Penalty fallback from unused reviewed entries (§6) |
| `src/clinical-series.ts` | C4 | `createClinicalSeries` plus `explainResolved` (§7) |
| `src/data/clinical-demo.json`, `src/data/clinical-review.json` | C5 | **Owner-authored** dataset and review records |
| `src/demo-data.ts` | C5 | Imports and validates the shipped data once |
| `src/ui/**`, `index.html` | C6–C7 | UI (§8) |

Config changes: `clinical-cards/tsconfig.json` and root `tsconfig.test.json` gain
`resolveJsonModule` in **C5**, when the app first imports JSON (C1 tests read the
template file from disk instead, so no config change is needed in C1).
`clinical-cards/package.json` build/preview scripts in C6. Docs in C9.

## 3. Data model and content rules (C1)

```text
SubjectCollection (schemaVersion "1.0.0")
└─ subject = disease           id: clinical.subject.<disease>
   ├─ subject            disease name (also a card in factToSubject)
   ├─ subjectIncorrects  genuinely incorrect alternative diagnoses (may be empty)
   └─ topics (1–4)       id: clinical.topic.<disease>.<category>
      ├─ topicName       one of the 4 approved category names, each at most once
      ├─ corrects (1–3)  reviewed facts true for this disease + category
      └─ incorrects (0+) reviewed facts explicitly NOT true for this disease + category
```

Approved categories (key → `topicName`, exact match): `signs` → "Classic Signs &
Symptoms", `workup` → "Work-up", `pathology` → "Pathology", `management` →
"Management/Treatment".

`subjectIncorrects` holds genuinely incorrect alternative diagnoses for that
disease, never synonyms, abbreviations or equivalent names. Software cannot detect
synonyms; the validator rejects only an exact (normalized) copy of the disease's
own name, and the guide tells the author how to check the rest.

**Card text** is any text that can appear on a card: disease names, alternative
diagnoses, and topic facts. Its length is counted in Unicode code points after
trimming, maximum **140** (C-12). Explanations have no length limit in C1, must not
be empty when present, and are shown only after resolution, never on a card.

**Clinical content codes (C1).** `validateClinicalCollection(value: unknown)` runs
`validateCollectionSource` first. If that fails, it returns those M2 issues
unchanged and stops (the value is not yet trustworthy). Otherwise it adds:

| Code | Path example | Rule |
|---|---|---|
| `CLINICAL_NO_DISEASES` | `subjects` | at least one disease |
| `CLINICAL_WRONG_NAMESPACE` | `subjects[0].id` | ids use the `clinical` namespace |
| `CLINICAL_NO_CATEGORIES` | `subjects[0].topics` | at least one category |
| `CLINICAL_UNKNOWN_CATEGORY` | `subjects[0].topics[2].topicName` | one of the 4 names |
| `CLINICAL_DUPLICATE_CATEGORY` | `subjects[0].topics[3].topicName` | each category once per disease |
| `CLINICAL_NO_FACTS` | `subjects[0].topics[1].corrects` | at least 1 correct |
| `CLINICAL_TOO_MANY_FACTS` | `subjects[0].topics[1].corrects` | at most 3 corrects |
| `CLINICAL_EMPTY_TEXT` | `subjects[0].topics[1].corrects[0].text` | non-blank card text |
| `CLINICAL_TEXT_TOO_LONG` | `subjects[0].subjectIncorrects[1].text` | ≤ 140 code points |
| `CLINICAL_EMPTY_EXPLANATION` | `…corrects[0].explanation` | omit instead of blank |
| `CLINICAL_DUPLICATE_TEXT` | `…incorrects[2].text` | no repeated text within one list |
| `CLINICAL_CONTRADICTORY_ENTRY` | `…incorrects[0].text` | not both correct and incorrect for one topic |
| `CLINICAL_ALTERNATIVE_IS_DISEASE` | `subjects[0].subjectIncorrects[0].text` | an alternative diagnosis is not the disease itself |
| `CLINICAL_DUPLICATE_DISEASE_NAME` | `subjects[4].subject` | disease names are unique |

Comparisons use `normalizeDisplayText` (case, spacing, Unicode form). All issues
are reported, in document order. Repeated texts **across** topics or diseases are
not errors: they are legitimate shared facts and appear in the C2 review report.

## 4. Contextual validity and review (C-3, revised; built in C2)

Principle: **missing data never implies clinical falsehood.** A fact is never a
distractor merely because another list omits it.

For a card text F (originating in topic S) and a challenge topic T (disease D,
category K):

1. F is in `T.corrects` → **valid**.
2. F is in `T.incorrects` → **invalid** (explicit, per entry).
3. S and T are both in the scope of one owner **review record** → **invalid**
   (reviewed: F was checked against T and does not apply there).
4. Otherwise → **unknown**. Unknown cards are never placed on a board with T.

Review records live in a separate Clinical review file (`clinical-review.json`),
not in the M2 schema, so the shared schema stays unchanged. **As built in C2**
(the C0 proposal's `topicIds` list became `topics` entries carrying a fingerprint):

```json
{
  "reviewFormatVersion": "1.0.0",
  "reviews": [
    {
      "id": "review.example-workup-pair",
      "reviewedBy": "<reviewer name>",
      "reviewedOn": "YYYY-MM-DD",
      "statement": "<REVIEW_STATEMENT, word for word>",
      "topics": [
        { "topicId": "clinical.topic.example-disease-a.workup", "fingerprint": "fp1-83380b39848dd3d1" },
        { "topicId": "clinical.topic.example-disease-b.workup", "fingerprint": "fp1-91a57330dfe3102b" }
      ]
    }
  ]
}
```

**Record validity (C2).** A record establishes invalidity only when it has a
`review.<slug>` id unique in the file, a named reviewer (not the placeholder), a
real `YYYY-MM-DD` date (not the placeholder), the exact attestation
`REVIEW_STATEMENT`, no unknown fields, and at least two distinct dataset topics
with well-formed fingerprints. Records are checked one by one; an invalid record
is ignored without disabling others. File-level problems (not an object, wrong
or missing version, `reviews` not an array, unknown top-level field) disable all
records. Codes: `REVIEW_INVALID_FILE`, `REVIEW_UNSUPPORTED_VERSION`,
`REVIEW_UNKNOWN_FIELD`, `REVIEW_INVALID_RECORD`, `REVIEW_INVALID_ID`,
`REVIEW_DUPLICATE_ID`, `REVIEW_MISSING_REVIEWER`, `REVIEW_INVALID_DATE`,
`REVIEW_STATEMENT_MISMATCH`, `REVIEW_TOO_FEW_TOPICS`, `REVIEW_DUPLICATE_TOPIC`,
`REVIEW_UNKNOWN_TOPIC`, `REVIEW_INVALID_FINGERPRINT`, `REVIEW_STALE`.

**Stale-review detection (C2).** `topicFingerprint` = `fp1-` + FNV-1a 64-bit hex
of a canonical JSON string: a version tag, the normalized disease name, the exact
`topicName`, and the sorted, de-duplicated normalized correct-fact texts. A
mismatch makes the whole record `stale`: not used, reported per changed topic
with the review id, and offered as a renewal draft with current fingerprints.
Reordering, id changes, explanations and `incorrects` do not affect it. The
owner never computes fingerprints: the report prints them and
`draftReviewRecord` fills them in with placeholders that the validator rejects
until the reviewer fills in name and date.

**Scope of a review.** A record covers the CORRECT facts of each listed topic
against the other listed topics. Texts that appear only in `incorrects` are not
covered by group reviews.

A scope may mix diseases and categories, so cross-category relationships (for
example a fact that could be both a work-up and a management item) are reviewed
explicitly too. If review finds that a fact applies to two topics, the author lists
it in both topics' `corrects`; it is then valid for both, and the M2 ambiguity
analysis keeps those two challenges from sharing a board with that card.

**Disease-name cards (factToSubject).** For a challenge built from fact F of topic
T (disease D, category K) and a name N:
- N is D → valid.
- N is another dataset disease D2 and F is in D2's category-K `corrects` → valid
  (shared fact; the challenge is ambiguous and is not used).
- ~~N is listed in `D.subjectIncorrects` → invalid (explicit).~~ **Superseded by
  Q-1:** a listed alternative is invalid only with a current alternative-diagnosis
  review of D. See "Disease-name rule (revised for Q-1)" below.
- N is a dataset disease D2 whose category-K topic shares a review scope with T →
  invalid (reviewed).
- Otherwise → unknown, not used.

**Review report (C2).** `buildReviewReport(dataset, review?)` validates both
inputs and returns structured data; `formatReviewReport` renders text. Sections:
review-file problems; stale reviews with renewal drafts; shared facts (the same
correct text in several topics); potentially ambiguous relationships
(near-identical wording, and alternative diagnoses that are dataset diseases
sharing a same-category fact); unreviewed topic pairs grouped as same category,
same disease, or other; coverage (usable vs unknown fact distractors per topic;
fewest usable disease-name distractors per disease); current fingerprints. It
reports data relationships only and makes no clinical judgments. The command that
prints it for the shipped files is added in C5.

**Disease-name rule (revised for Q-1, before C3).** For a fact from topic T of
disease D in category K, a name N is, in this order:
1. valid if N is D;
2. valid if N is a dataset disease whose category-K topic lists the same fact as
   correct (shared fact);
3. invalid if N's category-K topic lists the fact as incorrect;
4. invalid if N is in `D.subjectIncorrects` AND a current alternative-diagnosis
   review of D covers it;
5. invalid if a current topic-group review covers T and N's category-K topic;
6. otherwise unknown.

Listing N in `subjectIncorrects` alone no longer makes it invalid (Q-1): a
genuinely different diagnosis is not automatically wrong for every fact.

**Alternative-diagnosis reviews (Q-1).** These are an optional
`alternativeReviews` array in the same review file. Each record has `id`,
`reviewedBy`, `reviewedOn`, `statement` (= `ALTERNATIVE_REVIEW_STATEMENT`, word
for word), `subjectId`, `alternativeIds` (entries of that disease's
`subjectIncorrects`), and `fingerprint`:
- One record per disease keeps the file small. A partial list leaves the
  uncovered alternatives unknown.
- `alternativesFingerprint` covers the normalized disease name, every topic name
  with its sorted normalized correct facts (topics sorted by name), and the sorted
  normalized texts of the covered alternatives. Any change to those makes the
  record stale.
- The same header checks apply as for topic groups. Ids are unique across both
  arrays.
- Additional codes: `REVIEW_UNKNOWN_SUBJECT`, `REVIEW_NO_ALTERNATIVES`,
  `REVIEW_UNKNOWN_ALTERNATIVE`, `REVIEW_DUPLICATE_ALTERNATIVE`.
- The report lists alternatives without a current review in section 5, stale
  alternative reviews with renewal drafts in section 2, and per-disease
  fingerprints in section 7b.
- `draftAlternativeReview` fills a draft.

**Bridge to M2.** `factValidityMatrix(challengeTopicIds, cards)` excludes every
card with any unknown pair and returns a complete boolean matrix for the rest,
ready for `analyzeCandidateAmbiguity`.

The M2 ambiguity checks (`analyzeCandidateAmbiguity`) and the exactly-one-answer
invariant are applied on top of this policy, unchanged.

## 5. Generator (C3)

`ClinicalDeckGenerator implements DeckGenerator<ClinicalGenerationRequest>`, where
`ClinicalGenerationRequest extends GenerationRequest` with `mode`, `seed` and the
untrusted `review` value (C-14). Randomness comes from the shared seeded helpers.
Bounded retries; failure returns issues and no deck.

**As built in C3 (`src/clinical-generator.ts`):**
- **Request.** `source`, `config` (`app: "clinical"`, optional direction,
  default `subjectToFact`), `mode`, `challengeCount` (must be 5 or 9 for the
  mode), `targetCardCount`, `seed`, optional `review`.
  - Dataset issues are returned with a `source.` path prefix.
  - A review file unusable as a whole fails the request; bad or stale records
    inside a usable file are simply not used.
  - Codes: `INVALID_REQUEST`, `INVALID_APP`, `MODE_NOT_SUPPORTED`,
    `INVALID_MODE`, `INVALID_DIRECTION`, `INVALID_SEED`, `INVALID_COUNT`,
    `CHALLENGE_COUNT_MISMATCH`, `INSUFFICIENT_CHALLENGES`, `GENERATION_FAULT`.
  - M2 planner and gate codes pass through unchanged.
- **Board choice.** The generator walks the candidates in a seeded order and adds
  a challenge when a designated card exists that is valid for it, the designated
  card is reviewed-invalid for every chosen challenge, and every chosen designated
  card is reviewed-invalid for it.
  - subjectToFact uses distinct topics; factToSubject uses distinct diseases.
  - Up to `CLINICAL_SELECTION_ATTEMPTS` (32) boards are tried. The first whose
    distractor pool reaches the target is used, otherwise the one with the
    largest pool.
- **Pool.** Cards with any unknown relation are dropped. The rest go through
  `analyzeCandidateAmbiguity`, and only cards valid for no challenge become
  distractors.
- **Ids (replaces §5.1 step 6; approved by the owner 2026-11-12).** Card ids are
  neutral (`k1..`, seeded order) like Math's, not dataset entry ids. Entry ids
  name the topic and whether an entry is correct or incorrect, so neutral ids
  keep the deck from revealing answers. Challenge ids are `c1..`. Penalty
  fallback cards continue the `k` numbering (§6).
  - The mapping from cards to source entries exists only inside the generator
    and the series closure.
  - Public views and events carry opaque engine handles and display text, never
    card ids. Challenge ids are `c1..` and say nothing about answers.
    `sourceRef` (disease and topic ids) appears only after a challenge is solved.
  - The C4 tests scan every view and event of full simulated series for `k<n>`
    ids, entry ids, matrices, designated answers, explanations and review data.
  - The UI (C6–C7) must not put card ids, entry ids or correctness into DOM
    attributes, classes or data-* values. It uses handles only, as the Math UI
    does.
- **Targets.** `CLINICAL_SOLITAIRE_TARGET_CARD_COUNT` = 15 and
  `CLINICAL_COMPETITIVE_TARGET_CARD_COUNT` = 24 are exported. The caller passes
  the target (the series wrapper in C4).
- **Test seam.** `generateClinicalDeck(raw, { tamper })` lets tests corrupt a
  draft before the gate.
- **Duplicate spellings.** A card shows the first spelling of a text in document
  order (verbatim).

### 5.1 subjectToFact (default)
1. Validate the request (`challengeCount` 5 or 9, direction, seed, content gate).
2. Candidate challenges: every topic with at least one correct. Prompt =
   `"<disease> · <category name>"`, text verbatim from the data.
3. Choose challenges by seed. Designate for each one correct fact that is
   **invalid** (not merely unknown) for every other chosen challenge. If
   impossible, reselect (bounded).
4. Eligible distractors: every other dataset text that is **invalid** for all
   chosen challenges; unknowns and duplicates removed; confirmed with
   `analyzeCandidateAmbiguity`.
5. Size with `planDeckSize(mode, target, eligiblePool)`; prefer distractors from
   the same categories as the board so they are plausible.
6. ~~Card id = dataset entry id~~ Card id = neutral `k<n>` (approved; see "Ids"
   above); `displayValue` = entry text verbatim.
7. Complete validity matrix from the policy (every pair is valid or invalid, never
   unknown); `numericAnswers: false`.
8. Self-check with `validateDeckForPlay`; return `GenerationResult`.

### 5.2 factToSubject
- Challenge = one fact F of topic T that is valid for exactly one dataset disease.
  Prompt = `"<category name>: <fact text>"`. Cards are disease names. Chosen
  challenges have distinct diseases.
- Distractors: disease names and alternative diagnoses that are invalid (§4) for
  every chosen challenge.
- Pool limit (C-6): 16 diseases give 16 disease-name cards. A 9-challenge board
  uses 9 of them as correct cards, leaving at most 7 dataset names plus any
  reviewed alternative diagnoses that are invalid for all 9. A vsBeepy deck
  therefore reaches 24 only if at least 15 suitable distractor names exist;
  otherwise it is a smaller validated deck (minimum 14), or generation fails with
  a clear issue. Tests report the real achievable sizes.

### 5.3 Explanations
An explanation is attached as `explanationByChallengeId[challengeId]` only where
the author wrote it for that context:
- subjectToFact: an entry from `T.corrects` or `T.incorrects` on challenge T.
- factToSubject: the correct disease card on the challenge built from F gets F's
  explanation; an alternative diagnosis from `D.subjectIncorrects` gets its own
  explanation on challenges from D.
Nothing else gets one. Penalty fallback cards carry none (the engine strips them).

## 6. Penalty fallback (C-4, C4)

`createClinicalFallbackProvider({ collection, review, direction })` lazily yields
unused dataset entries of the deck's card kind with `validForChallenges` from the
policy. Entries that are unknown or valid for any active challenge are skipped.
`plausible: true`. The engine still re-checks every candidate and bounds the search.

**As built in C4 (`src/clinical-fallback.ts`):**
- **Card kinds:** subjectToFact offers topic facts (corrects and incorrects);
  factToSubject offers disease names and alternative diagnoses. Both come from
  the generator's card universe, verbatim.
- **Eligibility:** a candidate must be policy-INVALID for every active
  challenge. This applies Q-1 and stale-review exclusion exactly as in
  generation. Texts already in any zone are skipped (case and spacing ignored).
- **Unmatched challenges:** each active challenge is matched to the dataset with
  `resolveChallengeContext` (sourceRef plus exact prompt). If any challenge does
  not match exactly, nothing is offered, and the engine waives the penalty
  through its existing path.
- **Order:** dataset order; subjectToFact offers the active challenges'
  categories first.
- **Ids:** `k<n>` after the highest `k` id in the game.
- **No explanations:** fallback cards carry none.
- **Engine unchanged:** the M2 `drawPenaltyCards` still re-checks every
  candidate, bounds the search (`maxCandidates`), keeps penalty events atomic,
  and reports `EXHAUSTED` or `LIMIT_REACHED` for the waiver.

## 7. Series wrapper (C4)

`createClinicalSeries(config)` mirrors `createMathSeries` in its own code (no
import from `math-cards`): `mode`, `generationDirection` (default `subjectToFact`),
`seed`, `beepyErrorRate` (default 0.2), optional deck targets, `diagnostics`; a
trusted `dataset`/`review` override for tests only. Own seed derivation and
`CLINICAL_SERIES_CODES`; `tutor` and `vsPlayer` return `MODE_NOT_SUPPORTED`.

**As built in C4 (`src/clinical-series.ts`):**
- **Config:** `mode`, `generationDirection`, `seed`, `beepyErrorRate` (default
  `CLINICAL_DEFAULT_BEEPY_ERROR_RATE` = 0.2), `targetCardCount` (one optional
  target for the chosen mode; defaults 15 or 24), `dataset`, `review`,
  `diagnostics`.
  - Until C5 ships data, `dataset` and `review` are passed by the caller.
  - They are validated as untrusted values. An invalid dataset fails with
    `CLINICAL_DATA_INVALID`; an unusable review file fails with
    `CLINICAL_REVIEW_INVALID`.
  - Invalid or stale records inside a usable file are not fatal: they are
    simply not used and are reported to the trusted sink.
- **Seeds:** `deriveClinicalGeneratorSeed(seriesSeed, gameIndex)` gives a
  per-game generator seed (its own "CLIN" mix).
- **Public codes:** `INVALID_CONFIG`, `MODE_NOT_SUPPORTED`, `INVALID_MODE`,
  `INVALID_DIRECTION`, `INVALID_SEED`, `INVALID_OPTION`, `CLINICAL_DATA_INVALID`,
  `CLINICAL_REVIEW_INVALID`, `INVALID_REQUEST`, `CLINICAL_GENERATION_FAILED`,
  `CLINICAL_SERIES_FAULT`. Messages are fixed and carry no detail; engine public
  errors pass through.
- **Interface:** the series is frozen and methods-only: the seven Math methods
  plus `explainResolved`.
- **Private state:** the closure keeps the current game's challenges (prompt and
  sourceRef) for Explain Why only.

**`explainResolved(turn)` as built (C-5, C-11).** It takes an untrusted turn
number:
- Anything that is not a positive whole number gives `INVALID_REQUEST`.
- It looks up the `ACTION_RESOLVED` event with that turn among the controller's
  PUBLIC events for the current game (events reset each game).
- No such event, which includes any pending action and Beepy's move before
  Accept/Challenge, gives `{ available: false, reason: 'notResolved' }`.
- A discard gives `reason: 'discard'`.
- For a play, it matches the challenge to the dataset and returns
  `authoredExplanation(...)` for exactly that (card text, challenge) context:
  `{ available: true, explanation }`, verbatim, or `reason: 'noExplanation'`.
  This is the same rule the generator uses for `explanationByChallengeId`, so
  penalty fallback cards get their authored context explanation too.
- The result never carries card ids, validity or answers.
- No engine change.

## 7a. Shipped content and owner tooling (C5 preparation, as built)

The owner approved the shipped dataset and review file as the default sources
(2026-11-12).

**Files.** `clinical-cards/src/data/clinical-demo.json` and
`clinical-cards/src/data/clinical-review.json`, both owner-authored. Neither
exists yet. No placeholder or fictional file is shipped.

**`src/shipped-data.ts`.** Uses `import.meta.glob('./data/*.json', { eager: true,
query: '?raw' })`, so Vite bundles the file TEXT.
- A missing file has no entry and is reported as MISSING.
- A JSON syntax error becomes a located issue, not a build crash.
- `clinical-cards/tsconfig.json` gains `types: ["vite/client"]`. This replaces
  the `resolveJsonModule` plan in C-10: no JSON module import is needed.

**`src/clinical-data.ts`.**
- `parseJsonText` uses a small syntax locator (`locateJsonError`) to report the
  file, line, column and a short reason. Node's built-in messages sometimes give
  no position and can repeat the whole file, so they are not shown.
- `loadClinicalContent` validates the dataset (M2 + C1), then the review file
  (C2).
- Refusal codes, each with a fixed friendly message: `CLINICAL_DATA_MISSING`,
  `CLINICAL_REVIEW_MISSING`, `CLINICAL_DATA_INVALID`, `CLINICAL_REVIEW_INVALID`.
  Structured issues go to trusted tooling only.
- No fallback content of any kind.

**Series default.** `createClinicalSeries` without `dataset` loads the shipped
files; both must exist and validate. Injected `dataset` (and optional `review`)
remains for tests, validated the same way. The diagnostics sink receives
`contentIssues`.

**`src/clinical-authoring.ts`.**
- `checkClinicalSufficiency` runs the real generator for all four combinations
  over 25 seeds and reports playable, sizes, full-size count and failure codes.
- `suggestReviewDrafts` suggests one group per category, one per disease, and
  one alternative review per disease, with current fingerprints and rejected
  placeholders.
- `buildAuthoringOutput` produces the command's files and the blocking problems
  vs notes.

**Command.** `npm run review-report -w clinical-cards` runs
`tools/review-report.check.ts` through Vitest with `tools/vitest.review.config.ts`
(no new dependency; not part of the normal suite).
- It reads the data folder (or `CLINICAL_DATA_DIR`) and writes
  `review-output/review-report.txt` and `review-drafts.json` (or
  `CLINICAL_REPORT_DIR`).
- It exits non-zero on missing, unparsable or invalid files, or on review-record
  errors.
- A missing review file (first run), stale records, and limited decks are notes.

**Not done until the owner supplies content:** the shipped-data gate test
(`c5-content-loading.test.ts`, skipped while the files are absent) requires:
- both files validate;
- no record errors;
- no placeholder or test text;
- all four combinations playable.

## 7b. Simplified authoring format and converter (C5 authoring workflow, as built)

Owner-approved on 2026-11-12, because hand-writing `SubjectCollection` JSON was
too cumbersome.

**Source file.** The owner edits `clinical-cards/authoring/clinical-authoring.json`:

```json
{ "diseases": [ { "name", "alternativeDiagnoses",
                  "signs", "workup", "pathology", "management": { "correct": [], "incorrect": [] } } ] }
```

Entries are strings or `{ text, explanation? }`. The template
`authoring/clinical-authoring.template.json` holds one blank record.

**Converter (`src/clinical-authoring-format.ts`).** It is pure and
deterministic, and turns the source into the unchanged M2 `SubjectCollection`
for `src/data/clinical-demo.json`.
- **Verbatim:** text and explanations are copied exactly. Blank explanations
  and empty categories are omitted.
- **Ids from content, never positions:**
  - `clinical.subject.<slug(name)>`
  - `clinical.topic.<slug>.<category>`
  - `clinical.answer.<slug>.<category>.<fact|not>.<text-slug>-<hash8>`
  - `clinical.answer.<slug>.alternative.<text-slug>-<hash8>`
  - `<hash8>` is FNV-1a 64 of the normalized text.
- **Checks:** unknown fields (typos), wrong types, and duplicate ids. Disease
  clashes are reported first, as the root cause. Then the C1 rules run, with
  issue paths mapped back to the authoring file. The JSON locator reports syntax
  errors.

**Commands (Vitest-run, no new dependency).**
- `npm run add-disease -w clinical-cards`: appends a blank record. The optional
  `CLINICAL_DISEASE_NAME` sets the name. Existing content is preserved exactly
  (round-trip check), and a backup goes to `authoring/backups/`.
- `npm run convert -w clinical-cards`: writes `clinical-demo.json` plus a
  fingerprint file `clinical-demo.generated.txt`, which is not bundled because it
  isn't `.json`.
  - It overwrites only its own unmodified output (`decideOverwrite`).
  - Otherwise it refuses, unless `CLINICAL_CONVERT_OVERWRITE=1`, and then backs
    the old file up first.
  - It reports how many records in `clinical-review.json` are current, stale or
    invalid. It never creates or attests review records.
- `tools/vitest.review.config.ts` now includes `tools/*.check.ts`; each script
  picks its command by file name.

**Review compatibility.**
- Topic ids depend only on disease name and category, so editing a fact keeps
  the topic id.
- The topic fingerprint changes, so covering reviews become stale. This is
  tested.

## 8. User interface (C6–C7)

Copy and adapt the Math UI into `clinical-cards/src/ui` (C-1 A). Same flow, layout
and interaction as M5. Differences: setup offers mode and question style only;
wide multi-line cards fitting 140 characters; prompts show disease and category on
separate lines; vsBeepy 3 × 3 or 5 + 4 board; correctness-only feedback with
"Explain Why" opening a separate explanation panel after resolution; a new
Clinical theme; the disclaimer on the menu; an error screen for invalid data.

**As built in C6 (2026-11-14).**
- **Copied from Math (C-1 A):** `render/dom.ts`, `render/beepy-avatar.ts`,
  `seed.ts` and `styles.css` are copied unchanged, apart from header comments.
  The CSS gets an appended "M6 C6: Clinical theme" section: a teal palette, wide
  multi-line `.card--text` cards, clamped `.mini-card--text` copies, category
  chips, the disclaimer, and the data error screen.
- **Adapted:** `app-state` (no levels; style default `subjectToFact`), `labels`
  (Clinical codes), `feedback` (correctness-only), `board-model`, `session`,
  `app`, `main`, `render/menu`, `render/board`.
- **Prompt display:** `promptDisplay` splits a prompt for layout only:
  `"<disease> · <category>"` and `"<category>: <fact>"`, matched by the exact
  `CLINICAL_CATEGORIES` names. The text is never changed.
- **Startup:** `contentProblem()` validates the shipped files before the menu.
  On failure, `renderDataError` shows the friendly message and offers no game.
- **Modes:** `AVAILABLE_MODES = ['solitaire']`. Player vs. Beepy is shown as
  "Coming soon" until C7.
- **Interaction:** tap or click to select, then tap a challenge or the discard
  pile; Escape and Cancel clear the selection. Drag-and-drop is C7.
- **Session:** no Beepy scheduler in C6. `dataset` and `review` exist for tests
  only.

**As built in C7 (2026-11-14).**
- **Modes:** `AVAILABLE_MODES = ['solitaire', 'vsBeepy']`.
- **Session:** gains the Beepy scheduler (`BEEPY_THINK_MS` = 1000, cancelled
  on leave), Accept/Challenge, match outcomes, and Explain Why
  (`openExplanation` / `closeExplanation`).
  - After each step it asks `explainResolved` about that step's resolved
    plays, newest first, and keeps the first authored explanation.
  - It never asks about a pending move; discards have none.
  - The text is revealed only on request and cleared by the next step.
- **Board:** the Beepy bar (face-down count), the pending panel (card and
  destination only, identical Accept/Challenge buttons), solver labels, match
  results, and `data-drop` targets only where tapping works. "Explain Why"
  opens a separate panel.
- **Layout:** nine challenges are 5 + 4 on desktop, 3 columns below 1100 px,
  and 2 below 768 px.
- **Drag-and-drop:** `render/drag.ts` is the Math module byte-for-byte.
- **Explanations in the shipped data:** the dataset has none yet, so the
  button does not appear there.

**C8 (2026-11-14).** Four layout and accessibility fixes, found by in-browser
measurement:
- **A.** At ≥1100 px, Player vs. Beepy stacks the messages under the piles,
  and Beepy's move panel's text column may shrink. It had overflowed the page.
- **B.** At ≤480 px, Beepy's face-down cards overlap more and the row clips.
- **C.** Small card copies show no partial line: solved tiles and the new-card
  notice show the full text; the discard pile clamps to 3 whole lines.
- **D.** The discard pile's accessible name includes the top card's full text.

No gameplay, data, or engine change.

## 9. Testing strategy

All tests run in Node with Vitest, no DOM library (U-2 pattern).

1. **Content validation (C1):** one failing input per rule asserting the exact
   code and path; multiple issues reported together; M2 issues returned unchanged
   for malformed input; the fixture and the authoring template pass; boundaries
   at 140/141 code points and at 3/4 facts.
2. **Policy oracle (C2):** an independent table-driven oracle recomputes
   valid/invalid/unknown; tests prove that absence never yields "invalid".
3. **Review report (C2):** lists shared texts, same-category pairs, cross-category
   pairs and unreviewed pairs for the fixture.
4. **Generator (C3):** both modes × both directions × many seeds: passes
   `validateDeckForPlay`; uniqueness; exactly one valid card per challenge per the
   oracle; no unknown pair in the matrix; verbatim text; contextual explanations;
   determinism; structured failures when data are insufficient.
5. **Fallback and series (C4):** only reviewed-invalid unused entries; series
   privacy; `explainResolved` gating; full simulated series for both modes and
   directions with M3 invariants at every step.
6. **Shipped data (C5):** validates; the real achievable deck sizes for every mode
   and direction over many seeds are measured and reported.
7. **UI (C6–C8):** model tests; privacy, storage/network and import-boundary
   guards like M5 U11; keyboard, touch and reduced-motion structure like U12.
8. **Regression (every code stage):** full `npx vitest run`, Math unchanged and
   passing, `tsc --build --force`, `typecheck:tests`, Math build, ESLint.
9. **Owner checks:** recorded only as the owner reports them.

## 10. Owner decisions (approved 2026-11-12)

| ID | Decision |
|---|---|
| C-1 | Copy and adapt the Math UI into `clinical-cards/src/ui`; dedupe later |
| C-2 | Owner authors and reviews all clinical content; review recorded in README and log; Kiro supplies template, guide, validator and reports only |
| C-3 | **Revised:** reviewed, dataset-closed policy with explicit review records; unreviewed relationships stay unknown and never justify a distractor; review report required; M2 ambiguity checks and exactly-one-answer invariant kept (§4) |
| C-4 | Fallback offers unused, reviewed-invalid dataset entries only |
| C-5 | Explain Why via `explainResolved` in the series wrapper; no engine change |
| C-6 | **Revised:** initial dataset of about 16–20 diseases, up to 4 categories each, 1–3 reviewed corrects per included category; targets 15 / 24; smaller validated decks allowed; factToSubject name-pool limit accounted for (§5.2); actual sizes tested; never pad |
| C-7 | Ship both question directions |
| C-8 | Convert the 2 Clinical `it.todo` in Task 16 (C3); Task 16 stays unchecked |
| C-9 | Replace the 2 named tests in `task18-no-runtime-generation.test.ts` with stronger ones (C3); keep the other 7 |
| C-10 | Ship data as JSON, validated at startup. As built in C5 preparation, the files are bundled as raw text via `import.meta.glob(..., { query: '?raw' })` with `vite/client` types (no `resolveJsonModule`), so syntax errors are located and missing files are reported (§7a) |
| C-11 | No explanations for discards |
| C-12 | **Revised:** card text maximum 140 characters; explanations may be longer and are shown separately after resolution |
| C-13 | Disclaimer: "For study practice only. Not medical advice." |
| C-14 | `ClinicalGenerationRequest extends GenerationRequest` adds `seed` (and review data); the M4 doc comment is left unedited |
| Terminology | `subjectIncorrects` = genuinely incorrect alternative diagnoses, never synonyms or equivalent names |
| Neutral ids (owner, 2026-11-12) | Generated card ids are neutral (`k1..`), never dataset entry ids; the source mapping stays private; views, events and UI attributes never reveal correctness through identifiers (§5 "Ids") |
| Q-1 (owner, 2026-11-12) | An alternative diagnosis is unknown for a disease's facts unless a current alternative-diagnosis review covers it; such reviews go stale when the disease's correct facts or the alternative's text change; never invent diagnoses to reach a deck size (§4) |

Still open from earlier milestones: the 2 pre-existing M2 lint errors; the 2 Task 18
loader `it.todo` (browser JSON import stays out of scope).
