# Foundation Setup — Requirements

**Milestone:** M1 — Project scaffolding, specs/steering, tracking journal, and
review of technical approach (master spec §18, phase 1).

**Scope boundary:** Foundation only. No gameplay, no decks, no artwork, no
services, no deployment, no dependency installation.

## Introduction

Establish a clean, reviewable project foundation for the Beepy Educational Card
Game Engine and a trustworthy development-tracking system, so that later
milestones have a stable, auditable base. The authoritative project
specification is `docs/master-spec-v1.1.md`.

## Requirements

### Requirement 1 — Clean new project rooted in the workspace

**User story:** As the project owner, I want the foundation created as a new
project in the current workspace, so that we are not modifying earlier Beepy
2018 code.

#### Acceptance criteria
1. WHEN the foundation is created THEN all files SHALL live under the workspace
   root `beepy-card-engine/`.
2. THE foundation SHALL NOT import, copy, or modify any prior Beepy 2018 code or
   assets.

### Requirement 2 — Approved technology stack, scaffolding only

**User story:** As the project owner, I want the approved stack scaffolded
without installing dependencies, so that the first milestone stays small and
auditable.

#### Acceptance criteria
1. THE stack SHALL be TypeScript (strict), Vite, npm workspaces, and Vitest,
   with ESLint and Prettier configured.
2. THE shared engine SHALL be configured independently of any UI framework.
3. THE system SHALL NOT run `npm install` or install dependencies in this
   milestone.
4. Configuration files (package manifests, tsconfig, lint/format config) SHALL
   be created so later milestones can install and build.

### Requirement 3 — Three-workspace structure with retained empty dirs

**User story:** As the project owner, I want `shared-engine/`, `math-cards/`,
and `clinical-cards/` plus `docs/` and `.kiro/`, so that the one-engine/two-apps
architecture is physically expressed and Git retains empty directories.

#### Acceptance criteria
1. THE repository SHALL contain `shared-engine/`, `math-cards/`,
   `clinical-cards/`, `docs/`, and `.kiro/`.
2. `math-cards` and `clinical-cards` SHALL declare a dependency on
   `@beepy/shared-engine`.
3. Otherwise-empty source directories SHALL contain a placeholder so Git
   retains them.

### Requirement 4 — Steering documents

**User story:** As the project owner, I want steering documents capturing our
architecture and policies, so that later Kiro work follows them.

#### Acceptance criteria
1. THE `.kiro/steering/` directory SHALL contain documents expressing: the
   approved architecture, originality/copyright boundaries, the no-duplicate-card
   invariant, educational-data independence, and the record-only-verified-work
   policy.

### Requirement 5 — Milestone spec

**User story:** As the project owner, I want a Kiro spec for this milestone, so
that its requirements, design, and tasks are documented and reviewable.

#### Acceptance criteria
1. THE `.kiro/specs/foundation-setup/` directory SHALL contain
   `requirements.md`, `design.md`, and `tasks.md`.
2. THE master specification SHALL be preserved in `docs/`.

### Requirement 6 — Evidence-based development log

**User story:** As the project owner, I want an honest development journal with
a reusable template and a first factual entry, so that evidence accumulates
from milestone 1.

#### Acceptance criteria
1. THE file `docs/kiro-development-log.md` SHALL exist with an entry template
   and a first entry for this milestone.
2. THE first entry SHALL record date, milestone, prompt ID, files
   created/modified, Kiro features actually used, commands run, test status
   (including "not run"), issues, and outcome.
3. THE log SHALL NOT claim any test passed unless it was run and observed to
   succeed.

### Requirement 7 — Safe .gitignore that preserves .kiro

**User story:** As the project owner, I want a `.gitignore` that excludes
secrets and generated dependencies but never `.kiro/`, so that the submission
retains required Kiro material.

#### Acceptance criteria
1. THE `.gitignore` SHALL ignore `node_modules/`, build output, and common
   secret files.
2. THE `.gitignore` SHALL NOT ignore `.kiro/` or any of its subfolders.

### Requirement 8 — Honest README

**User story:** As the project owner, I want a README that states current
nonfunctional status, so that no one assumes the games work yet.

#### Acceptance criteria
1. THE root `README.md` SHALL describe the purpose, the two demo apps, the
   structure, and the current nonfunctional scaffolding status.
2. THE README SHALL NOT claim the games work yet.

### Requirement 9 — No scope creep; nothing published

#### Acceptance criteria
1. THE milestone SHALL NOT implement gameplay, generate decks, add artwork,
   connect services, or deploy.
2. THE milestone SHALL NOT publish anything to GitHub.
3. Advancing to the next milestone SHALL require the project owner's explicit
   approval.
