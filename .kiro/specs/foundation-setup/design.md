# Foundation Setup — Design

This document records the design decisions for milestone M1 (foundation). It is
deliberately narrow: it designs the *scaffolding and tracking system*, not the
game engine.

## Overview

Create an npm-workspaces monorepo with three TypeScript workspaces and a
`.kiro/` directory holding steering and this spec, plus an evidence-based
development log. No dependencies are installed and no runtime code is written.

## Repository layout

```text
beepy-card-engine/
  .kiro/
    specs/foundation-setup/   requirements.md, design.md, tasks.md
    steering/                 architecture, originality, invariant, data, verified-work
    hooks/                    .gitkeep only (no real hooks yet)
  shared-engine/              package.json, tsconfig.json, src/.gitkeep, README.md
  math-cards/                 package.json, tsconfig.json, src/.gitkeep, README.md
  clinical-cards/             package.json, tsconfig.json, src/.gitkeep, README.md
  docs/                       master-spec-v1.1.md, kiro-development-log.md
  package.json                root; npm workspaces; dev scripts
  tsconfig.json               solution file with project references
  tsconfig.base.json          shared strict compiler options
  eslint.config.js            flat config
  .prettierrc.json / .prettierignore
  .gitignore                  never ignores .kiro/
  LICENSE                     MIT
  README.md
```

## Key design decisions

### D1 — npm workspaces over heavier monorepo tooling
npm workspaces ships with npm (no extra install) and satisfies the
one-engine/two-apps requirement. Heavier task runners can be added later if a
real need appears. Keeps the foundation minimal and auditable.

### D2 — TypeScript project references
The root `tsconfig.json` is a solution file referencing each workspace. Each
app's `tsconfig.json` references `../shared-engine`. This enforces the one-way
dependency direction at the type level and enables `tsc --build` across the
monorepo once dependencies are installed.

### D3 — Engine stays UI-framework independent
`shared-engine` has no DOM/framework dependency in its manifest. The base
tsconfig includes DOM libs for the *apps*, but steering forbids the engine from
depending on the DOM or any framework. The React-or-other decision is deferred.

### D4 — Scaffold config, do not install
Manifests pin version ranges but are not installed this milestone. This keeps
the milestone small and lets the development log honestly state that
dependencies are not installed and nothing has been built or tested.

### D5 — Placeholders for empty directories
Git does not track empty directories. Each empty `src/` and the `hooks/` dir
carry a `.gitkeep` so the structure survives a commit.

### D6 — `.kiro/` is first-class, committed content
The `.gitignore` explicitly documents that `.kiro/` and its subfolders are not
ignored, because they are required for the Kiroween submission.

### D7 — Honest documentation
READMEs and the development log state the nonfunctional status plainly and do
not claim working games or passing tests.

## Correctness / validation for this milestone

Because no code is installed or executed, "validation" here is limited to
structural review:

- Verify the folder tree matches this design.
- Verify `.gitignore` does not match `.kiro/`.
- Verify no gameplay/asset/service/deploy artifacts were introduced.

Type-checking, linting, and tests require a dependency install and are
therefore **deferred to a later milestone** and recorded as "not run".

## Out of scope (deferred)

Engine logic, data schema implementation, generators, UI, decks, artwork,
hosting, and all tests. These belong to later master-spec phases (§18).
