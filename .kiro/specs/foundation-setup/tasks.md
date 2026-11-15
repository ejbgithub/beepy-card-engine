# Foundation Setup — Tasks

Implementation plan for milestone M1 (foundation). All tasks are scaffolding
and documentation only. No dependency installation, no gameplay.

Completion rule: a task is checked only after its required files have been
verified to exist on disk and the work has actually been performed and
accepted.

- [x] 1. Confirm clean workspace and preserve the master spec
  - Confirmed the workspace root and that no prior Beepy 2018 code is present
  - Renamed `docs/master-spec-v1.1.md.md` to `docs/master-spec-v1.1.md`,
    preserving contents exactly (verified present)
  - _Requirements: 1, 5.2_

- [x] 2. Create root configuration (scaffold only, no install)
  - Root `package.json` with npm workspaces and dev scripts (verified present)
  - `tsconfig.base.json` (strict) and solution `tsconfig.json` with references
    (verified present)
  - `eslint.config.js`, `.prettierrc.json`, `.prettierignore` (verified present)
  - `LICENSE` (MIT) (verified present)
  - _Requirements: 2.1, 2.2, 2.4_

- [x] 3. Create the three workspaces with placeholders
  - `shared-engine/` with `package.json`, `tsconfig.json`, `src/.gitkeep`,
    README (verified present)
  - `math-cards/` and `clinical-cards/` likewise, each depending on
    `@beepy/shared-engine` (verified present)
  - _Requirements: 3.1, 3.2, 3.3_

- [x] 4. Create steering documents
  - architecture, originality/copyright, no-duplicate-card invariant,
    educational-data independence, record-only-verified-work (all five verified
    present under `.kiro/steering/`)
  - _Requirements: 4.1_

- [x] 5. Create this milestone spec
  - `requirements.md`, `design.md`, `tasks.md` under
    `.kiro/specs/foundation-setup/` (requirements.md and design.md verified
    present; this tasks.md is the file being created)
  - _Requirements: 5.1_

- [x] 6. Create the development log
  - `docs/kiro-development-log.md` with a reusable template and the first
    factual entry for this milestone (verified present and accepted)
  - Test status recorded honestly ("not run — dependencies not installed")
  - _Requirements: 6.1, 6.2, 6.3_

- [x] 7. Create a safe `.gitignore`
  - Ignores `node_modules/`, build output, and secrets (verified present)
  - Does not ignore `.kiro/` or its subfolders (verified in file contents)
  - _Requirements: 7.1, 7.2_

- [x] 8. Create an honest root README
  - Purpose, two demo apps, structure, nonfunctional status (verified present)
  - Does not claim the games work; development log referenced as planned, not
    existing
  - _Requirements: 8.1, 8.2_

- [ ] 9. Hold for owner approval before the next milestone
  - Do not implement gameplay, schema, generators, UI, or tests without
    explicit approval
  - _Requirements: 9.1, 9.2, 9.3_
