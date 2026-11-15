# Authoring Guide: Beepy's Clinical Cards Dataset

This guide is for the project owner and any medical reviewer the owner designates.
It explains the file format, the rules the validator checks, and how to review
facts that may apply to more than one disease.

The guide contains no medical knowledge. Every example uses fictitious
placeholders ("Example Disease A"). All real clinical content is written and
reviewed by people, not by Kiro or any other AI tool (decision C-2).

## 1. What the game needs

Beepy's Clinical Cards is a review game for high-yield disease facts. It is
**not** a question bank:

- No vignettes, no question stems, no NBME-style items.
- No text copied from question banks, review books, or other copyrighted sources.
  Write every fact in your own words.

A challenge on the board is a disease plus a category, for example
"Example Disease A · Work-up". An answer card is one concise fact. In the second
question style the board shows a fact and the cards show disease names.

## 2. Files

| File | Who writes it | Notes |
|---|---|---|
| `clinical-authoring.json` (this folder) | **Owner** | The file you edit: diseases and facts in the simple format (section 2b) |
| `clinical-authoring.template.json` (this folder) | Kiro (empty fields only) | One blank disease record, for reference |
| `clinical-cards/src/data/clinical-demo.json` | **Generated** by `npm run convert` | Do not edit by hand; it is rebuilt from `clinical-authoring.json` |
| `clinical-cards/src/data/clinical-demo.generated.txt` | Generated | Lets the converter recognise its own output (overwrite protection) |
| `clinical-cards/src/data/clinical-review.json` | **Owner / reviewer** | Review records (section 7); not generated, never attested by tooling |
| `clinical-review.template.json` (this folder) | Kiro (fictitious placeholders only) | Review-record format reference |
| `clinical-dataset.template.json` (this folder) | Kiro (fictitious placeholders only) | Reference for the generated format (section 3); you no longer write it |
| `backups/` (this folder) | Written by the commands | Copies made before a file is changed |
| `clinical-cards/review-output/` | Written by `npm run review-report` | Report and review drafts; safe to delete |

The app uses exactly the two files in `clinical-cards/src/data/`. Until both
exist and validate, it refuses to start a Clinical game with a friendly message.
It never falls back to example or test content.

## 2a. Step-by-step workflow (start here)

This is the practical path for the first 16–20 diseases. Every command is run
from the project folder (`beepy-card-engine`).

**Step 1. Add a disease.**

```text
npm run add-disease -w clinical-cards
```

In PowerShell you can give the name at the same time:

```text
$env:CLINICAL_DISEASE_NAME = "<disease name>"; npm run add-disease -w clinical-cards; Remove-Item Env:CLINICAL_DISEASE_NAME
```

This appends a blank record to `clinical-cards/authoring/clinical-authoring.json`
(creating the file if needed) with `name`, `alternativeDiagnoses`, and all four
categories with empty `correct` and `incorrect` lists. It writes no clinical
content, and backs up the previous file first. Then open the file and type the
name and facts (section 2b). You can also copy and paste a blank record by hand.

**Step 1b. Generate the dataset.**

```text
npm run convert -w clinical-cards
```

This converts `clinical-authoring.json` into
`clinical-cards/src/data/clinical-demo.json`:
- Ids, category names and the corrects/incorrects arrays are generated.
- Every text and explanation is copied exactly.
- Empty explanations and empty categories are left out.

If something is wrong, nothing is written and every problem is listed with its
place in your file, for example `diseases[2].workup.correct[1]`.

Run `convert` after every edit. It refuses to replace a `clinical-demo.json`
that it didn't write itself, or that was edited by hand. To replace such a file
deliberately, run it once with `$env:CLINICAL_CONVERT_OVERWRITE = "1"`; the old
file is backed up to `authoring/backups/` first.

If `clinical-review.json` exists, `convert` also says how many review records
are current, stale or invalid after your edit.

**Step 2. Run the check.**

```text
npm run review-report -w clinical-cards
```

It validates `clinical-demo.json` and writes two files to
`clinical-cards/review-output/`:

- `review-report.txt`: a summary, the deck-sufficiency check, and the review
  report (section 7).
- `review-drafts.json`: suggested review records with the current fingerprints
  filled in and placeholders for reviewer and date.

If the dataset has a problem, the command fails and lists every issue with its
exact location (section 4 explains each code). Fix them in
`clinical-authoring.json`, run `convert`, and run the check again. On
this first run, "NOT PLAYABLE" is expected: nothing has been reviewed yet, so
almost every relationship is unknown.

**Step 3. Review cross-disease applicability.**
Open `review-report.txt` and work through:

- section 3 (shared facts);
- section 4 (possible ambiguity);
- section 5 (unreviewed pairs and unreviewed alternative diagnoses).

For each relationship, decide in one of the three ways in section 7, or leave
it unknown. This is the clinical review; the tooling makes no clinical
judgments. If you change any facts, edit `clinical-authoring.json`, then run
`npm run convert` and `npm run review-report` again before the next step:
fingerprints change with content.

**Step 4. Create the review file from the drafts.**
Copy `review-output/review-drafts.json` to
`clinical-cards/src/data/clinical-review.json`. It suggests, structurally:

- one group per category, covering that category across all diseases;
- one group per disease, covering its categories;
- one alternative-diagnosis record per disease.

For each record:

- **Keep it** only if you actually did that review. Fill in `reviewedBy` and
  `reviewedOn`. The validator rejects the placeholders, so an untouched draft
  attests nothing.
- **Delete it** if you didn't do that review.
- **Split it** into smaller groups if that suits the review. Copy topic ids and
  fingerprints from section 7a of the report; never type a fingerprint.
- **Trim `alternativeIds`** to the alternatives you actually checked.

**Step 5. Run the check again.**
Repeat Step 2. Now it also validates `clinical-review.json`:

- Record errors (wrong statement, placeholder name or date, unknown topic, and
  so on) fail the command.
- Stale records are reported as notes with a renewal draft.

**Step 6. Decide whether there is enough reviewed content.**
At the top of `review-report.txt`, each of the four combinations shows
`PLAYABLE` or `NOT PLAYABLE`, plus deck sizes over 25 seeds:

- Solitaire and Player vs. Beepy;
- "disease + category → fact" and "fact → disease".

The content is ready when all four are `PLAYABLE`. A smaller deck than the
target (15 or 24) is allowed. If something is not playable, section 6 of the
report shows where coverage is thin. Typical fixes:

- review more topic pairs;
- for "fact → disease" in Player vs. Beepy, list and review more genuinely
  different alternative diagnoses under every disease;
- add diseases.

The tooling never adds content to make a deck larger.

**What the two suggested group kinds allow.**
- **Category groups only:** a "disease + category → fact" board stays within one
  category, because other cross-category relationships stay unknown.
- **Per-disease groups added:** same-disease cross-category pairs become known.
- **Mixed-category boards:** need reviews that cover topics of different
  diseases in different categories, in small groups you choose.
- All of this is reported, never assumed.

**Step 7. Hand over.**
Tell Kiro the files are in place. Kiro will run the checks and the automated
tests, and report the results for your review. Kiro doesn't edit clinical text;
it only reports issues back to you.

## 2b. The simple authoring format (`clinical-authoring.json`)

```json
{
  "diseases": [
    {
      "name": "Example Disease A",
      "alternativeDiagnoses": [
        "Example Alternative Diagnosis 1",
        { "text": "Example Alternative Diagnosis 2", "explanation": "Optional: why it is a different diagnosis." }
      ],
      "signs": {
        "correct": ["Example sign 1", { "text": "Example sign 2", "explanation": "Optional explanation." }],
        "incorrect": []
      },
      "workup": { "correct": ["Example work-up finding"], "incorrect": ["Example finding that does not apply"] },
      "pathology": { "correct": ["Example mechanism"], "incorrect": [] },
      "management": { "correct": [], "incorrect": [] }
    }
  ]
}
```

- **`name`**: the disease name, exactly as it should appear on cards.
- **Categories:** `signs` (Classic Signs & Symptoms), `workup` (Work-up),
  `pathology` (Pathology), `management` (Management/Treatment). Each has
  `correct` (1–3 reviewed facts, when the category is used) and `incorrect`
  (reviewed facts that do NOT apply to this disease and category; may be
  empty). A category with both lists empty is simply left out of the game.
- **Entries:** every fact or alternative diagnosis is either a plain string or
  `{ "text": "...", "explanation": "..." }`. Leave out `explanation` when there
  is none; you never need empty explanation fields.
- **No ids:** they are generated from the disease name, the category and the
  text, never from list positions. Reordering facts or diseases changes nothing.
  Editing a fact's text gives that fact a new id; the category ids stay the
  same, so review records still find their topics. A changed fact correctly
  makes the reviews that covered it stale.
- **Text:** copied exactly as typed. All the rules in sections 4–6 apply,
  including the 140-character card limit and no repeated text in one list.
  Problems are reported with paths in this file, for example
  `diseases[0].workup.correct[1]`.
- **Spelling of fields** is checked. A typo such as `"workUp"` or `"corect"` is
  reported, not ignored.

## 3. Structure (generated format, for reference)

`npm run convert` writes this format for you. You don't need to write it.

```text
schemaVersion        "1.0.0"
subjects[]           one record per disease
  id                 clinical.subject.<disease-slug>
  subject            the disease name (shown on cards in "fact → disease" style)
  subjectIncorrects  genuinely incorrect alternative diagnoses (may be empty)
  topics[]           one per category used (1 to 4)
    id               clinical.topic.<disease-slug>.<category-key>
    topicName        exactly one of the four approved category names
    corrects[]       1 to 3 reviewed facts true for this disease and category
    incorrects[]     reviewed facts that do NOT apply here (optional, may be empty)
```

Every entry (`corrects`, `incorrects`, `subjectIncorrects`) has:

- `id`: unique across the whole file, for example
  `clinical.answer.<disease-slug>.<category-key>.<fact-slug>`. Ids use lowercase
  letters, digits and hyphens, separated by dots. Once published, an id should not
  change.
- `text`: what appears on the card.
- `explanation` (optional): shown only after a card is resolved and the player
  asks "Explain Why". Never shown on a card face. Omit the field rather than
  leaving it blank.

### Approved categories

| Key (used in ids) | `topicName` (exact text) | Covers |
|---|---|---|
| `signs` | `Classic Signs & Symptoms` | classic presentation |
| `workup` | `Work-up` | labs, procedures, imaging |
| `pathology` | `Pathology` | causes, mechanisms, risk factors, associations, complications |
| `management` | `Management/Treatment` | treatment, drug complications, contraindications |

A disease may omit a category. Each category appears at most once per disease.

## 4. Rules the validator checks

The validator (`validateClinicalCollection` in `src/clinical-content.ts`) first
runs the shared schema checks (shape, `schemaVersion`, id format, unique ids).
Then it checks:

| Code | Meaning | Fix |
|---|---|---|
| `CLINICAL_NO_DISEASES` | the file has no diseases | add at least one |
| `CLINICAL_WRONG_NAMESPACE` | a disease id does not start with `clinical.` | use `clinical.subject.<slug>` |
| `CLINICAL_NO_CATEGORIES` | a disease has no categories | add one, or remove the disease |
| `CLINICAL_UNKNOWN_CATEGORY` | `topicName` is not one of the four names | use the exact name from the table |
| `CLINICAL_DUPLICATE_CATEGORY` | a category appears twice for one disease | merge them |
| `CLINICAL_NO_FACTS` | a category has no correct facts | add one, or remove the category |
| `CLINICAL_TOO_MANY_FACTS` | more than 3 correct facts | keep the most high-yield three |
| `CLINICAL_EMPTY_TEXT` | blank card text | write the text, or remove the entry |
| `CLINICAL_TEXT_TOO_LONG` | card text over 140 characters | shorten it; move detail to the explanation |
| `CLINICAL_EMPTY_EXPLANATION` | blank explanation | remove the field |
| `CLINICAL_DUPLICATE_TEXT` | the same text twice in one list | keep one |
| `CLINICAL_CONTRADICTORY_ENTRY` | the same text is correct and incorrect for one topic | decide which is right |
| `CLINICAL_ALTERNATIVE_IS_DISEASE` | an alternative diagnosis is the disease's own name | remove it |
| `CLINICAL_DUPLICATE_DISEASE_NAME` | two diseases share a name | merge the records |

Text comparisons ignore case, extra spaces, and Unicode form differences. Each
issue names the exact location, for example
`subjects[3].topics[1].corrects[0].text`.

**The validator cannot check medical accuracy, synonyms, or overlap between
diseases.** Those are the reviewer's job (sections 5 to 7).

## 5. Writing card text

- At most **140 characters**, counted after trimming spaces. Cards wrap onto
  several lines, so keep essential qualifiers rather than cutting them.
- One fact per card. Make it specific enough that it points to this disease and
  category rather than many.
- Put longer reasoning in `explanation`, which has no length limit.
- Write each fact so a player can't tell from the wording alone whether it is a
  correct answer or an alternative.

## 6. Alternative diagnoses (`subjectIncorrects`)

`subjectIncorrects` lists **genuinely incorrect** alternative diagnoses for that
disease, as candidate wrong answer cards. They are used only after an
alternative-diagnosis review (section 7). Never list:

- the disease itself,
- a synonym, eponym, abbreviation, or older name for it,
- a subtype or umbrella term that would make the card arguably correct.

The validator only catches an exact copy of the disease name. The reviewer must
catch the rest.

## 7. Shared facts and cross-disease applicability

This is the most important review step. The game must never mark a true answer
as wrong. The rule (decision C-3) is:

> A fact is treated as wrong for a disease and category **only when a reviewer
> has said so**. A fact that is simply not listed somewhere is "unknown", and the
> game will not use it as a wrong answer there.

So missing data is safe: it makes the game use fewer cards, never wrong ones. To
let the game use more cards, the reviewer records decisions in one of three ways:

1. **The fact also applies.** Add the same text to the other topic's `corrects`
   as well. The game then treats it as correct for both and never puts both
   challenges on the board with that card.
2. **The fact does not apply to one specific topic.** Add the same text to that
   topic's `incorrects`.
3. **A group of topics was reviewed together.** Add a review record (below)
   listing the topic ids. It states that every correct fact of each listed topic
   was checked against every other listed topic, and does not apply there unless
   it is also listed in that topic's `corrects`.

A group may mix diseases and categories, so cross-category questions (for example,
whether an item listed as a work-up fact could also count as a management fact)
are covered by including both topics in one record.

### Review record file (`clinical-review.json`, validated since stage C2)

See `clinical-review.template.json` in this folder. Each record lists its topics
together with a **fingerprint** of each topic's reviewed content:

```json
{
  "reviewFormatVersion": "1.0.0",
  "reviews": [
    {
      "id": "review.example-workup-pair",
      "reviewedBy": "<reviewer name>",
      "reviewedOn": "YYYY-MM-DD",
      "statement": "Every correct fact of each topic listed was reviewed against every other topic listed. A fact does not apply to another listed topic unless it is also listed in that topic's corrects.",
      "topics": [
        { "topicId": "clinical.topic.example-disease-a.workup", "fingerprint": "fp1-83380b39848dd3d1" },
        { "topicId": "clinical.topic.example-disease-b.workup", "fingerprint": "fp1-91a57330dfe3102b" }
      ]
    }
  ]
}
```

A record counts only when all of these hold:

- `id` looks like `review.<slug>` and is unique in the file.
- `reviewedBy` names the person who did the review. The placeholder
  `<reviewer name>` is rejected.
- `reviewedOn` is the real date of the review (`YYYY-MM-DD`). The placeholder is
  rejected.
- `statement` is the attestation above, **word for word**. It is your
  confirmation that the review was actually done. A record without it
  establishes nothing.
- `topics` lists at least two different topics that exist in the dataset, each
  with its current fingerprint.

A record with any problem is ignored, and the report says why. Other records
still count. Problems with the file itself (wrong version, unknown top-level
fields) disable every record until fixed.

**Keep groups small.** A record can cover just one pair of topics. You don't need
one large group. Several small records combine: the game uses every pair that
any current record covers. Only add a topic to a group after actually checking
its correct facts against every other topic in that group.

**What a review covers.** A record covers the **correct** facts of each listed
topic. An entry that appears only in some topic's `incorrects` is not covered,
so it stays unknown on other topics unless it is listed there explicitly.

### Fingerprints and stale reviews

You never calculate or type a fingerprint. The tooling computes it and the
review report prints it, ready to copy. To start a record, copy the current
fingerprints of its topics from the report (section 7 of the report), or use a
draft record that the tooling fills in for you.

A topic's fingerprint covers what the review judged: the disease name, the
category, and the set of correct-fact texts. It changes when a correct fact is
edited, added or removed, the disease is renamed, or the category changes. It
does **not** change when facts are reordered, ids change, explanations are
edited, or `incorrects` change. Case and spacing differences are ignored, as
they are for card uniqueness.

When a fingerprint no longer matches, the record becomes **stale**:

- it is no longer used, so its relationships go back to unknown;
- the report names the review and the topic that changed;
- the report prints a renewal draft with the new fingerprints.

After re-reviewing **all** topics in the record, replace it with the renewal
draft and fill in `reviewedBy` and the new `reviewedOn`.

### Alternative diagnoses in "fact → disease" challenges

A genuinely different diagnosis is not automatically a wrong answer for every
fact of a disease. So, when a board shows a fact from disease D and the cards are
disease names, an alternative listed in D's `subjectIncorrects` is **unknown**,
and is not used, until an **alternative-diagnosis review** covers it.

An alternative-diagnosis review states that every correct fact of D was checked
against the listed alternatives and none of those facts applies to them. It is
one small record per disease, in the same review file:

```json
"alternativeReviews": [
  {
    "id": "review.alternatives.example-disease-a",
    "reviewedBy": "<reviewer name>",
    "reviewedOn": "YYYY-MM-DD",
    "statement": "Every correct fact of this disease was reviewed against every alternative diagnosis listed in this record. None of those facts applies to any of those alternative diagnoses.",
    "subjectId": "clinical.subject.example-disease-a",
    "alternativeIds": ["clinical.answer.example-disease-a.alternative-1"],
    "fingerprint": "fp1-67c2a8a8d1b8fad9"
  }
]
```

- `alternativeIds` lists the `subjectIncorrects` entry ids you checked. If one
  alternative does fit one of D's facts, leave it out. It then stays unknown for
  D, which is safe.
- The `fingerprint` covers D's name, every category with its correct facts, and
  the texts of the listed alternatives. Editing any correct fact of D, adding or
  removing a category, renaming D, or editing a listed alternative's text makes
  the record stale. Reordering, explanations, incorrect facts and unlisted
  alternatives do not.
- The report prints this fingerprint for a record that covers all of a disease's
  alternatives (section 7b). For a partial record, use a draft from the tooling.
- Explicit data still decides first. If the alternative is also a disease in the
  file that lists the same fact in the same category, it is correct there, and
  the report flags the conflict (section 4b). If that disease lists the fact in
  its `incorrects`, it is wrong there even without a review.

**What this means for deck size.** On a "fact → disease" board, a distractor
name must be known to be wrong for every challenge on the board. So an
alternative diagnosis can only be used when every disease on the board lists it
and has a current alternative review covering it. Other diseases in the file count as wrong answers once the relevant topics are
reviewed against each other. Missing reviews never add doubtful cards; they only
make decks smaller.

### The review report

The report (`buildReviewReport`, printed with `formatReviewReport`) lists data
relationships only. It never decides whether a fact is clinically true. Its
sections:

1. Review file problems: records with problems, and why.
2. Stale reviews: which review, which topic changed, and a renewal draft.
3. Shared facts: the same correct-fact text in more than one topic.
4. Potentially ambiguous relationships:
   - texts that are identical apart from punctuation, case or spacing;
   - alternative diagnoses that are dataset diseases sharing a same-category
     fact.
5. Unreviewed relationships: topic pairs, grouped as same category with different
   diseases, same disease with different categories, and everything else; plus
   alternative diagnoses without a current alternative review.
6. Coverage: for each disease + category challenge, how many fact cards are
   usable as wrong answers and how many are unknown. For "fact → disease", the
   fewest usable disease-name cards. Low numbers show where more review would
   allow fuller decks.
7. Current fingerprints: (a) topics; (b) alternative-diagnosis reviews that
   cover all of a disease's alternatives.

For each item, the reviewer decides which of the three ways above applies, or
leaves it unknown. A manual check also works: for each fact, ask "could this card
also be a correct answer for any other disease and category in the file?"

Run the report with `npm run review-report -w clinical-cards` (section 2a). It
reads `clinical-cards/src/data/clinical-demo.json` and `clinical-review.json` and
writes `clinical-cards/review-output/review-report.txt` and `review-drafts.json`.

## 8. Dataset size

The approved target (decision C-6) is about **16–20 diseases**, each with up to
four categories and one to three facts per included category.

- Disease + category → fact: the board needs 5 (Solitaire) or 9 (Player vs. Beepy)
  challenges, and decks aim for 15 and 24 cards.
- Fact → disease: the cards are disease names and alternative diagnoses, so
  16 diseases give at most 16 disease-name cards. A full 24-card Player vs. Beepy
  deck needs at least 15 suitable wrong names besides the 9 correct ones. Adding
  reviewed alternative diagnoses helps. Otherwise the game uses a smaller
  validated deck (at least 14 cards).
- Unknown relationships reduce the usable cards, so review coverage matters as
  much as the number of diseases.

The game never pads a deck with doubtful, duplicate or unreviewed cards. Real
achievable deck sizes are measured once the dataset exists (stage C5).

## 9. Recording the review

Record who reviewed the dataset and when in `reviewedBy` / `reviewedOn` of the
review records, in `clinical-cards/README.md`, and in the development log.
