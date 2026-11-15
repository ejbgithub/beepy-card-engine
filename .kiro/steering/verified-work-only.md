# Record Only Verified Work

This project keeps an evidence-based development journal
(`docs/kiro-development-log.md`). The integrity of that journal is a hard
requirement (master spec §15).

## Rules for recording work

- Record **only witnessed events**. Do not infer, assume, or invent actions,
  test results, or Kiro features.
- **Never** claim a test passed unless it was actually run and success was
  observed. Record tests that were not run as "not run", and record failures
  as failures.
- Record the real commands that were run and their real outcomes, including
  errors.
- List only Kiro capabilities that were **actually used** in the milestone
  (specs, steering, hooks, agent features, etc.).
- Do not create fictitious hooks or features merely to list them. Add a hook
  only when there is a real workflow to automate.
- Kiro cannot observe activity performed outside the current session. Do not
  imply otherwise. The project owner provides external logs/exports/evidence
  for the record.

## Journal entry expectations

Each meaningful milestone adds a chronological entry covering: date, milestone
ID and objective, prompt ID/summary, linked spec/steering, Kiro features
actually used, files created/modified, commands actually run, test names and
observed results (including "not run" and failures), problems and corrective
actions, outcome, and evidence references (commit hashes, exports) where
available.

## Scope discipline

Do not advance past an approved milestone into later implementation without the
project owner's explicit approval. Keep milestones small and auditable.
