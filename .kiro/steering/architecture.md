# Architecture and Project Organization

This steering document records the approved architecture for the Beepy
Educational Card Game Engine. It reflects the master specification
(`docs/master-spec-v1.1.md`, §14) and the tooling decisions approved at
project start.

## Core principle: one engine, two apps

Separate subject-neutral gameplay from educational data and app-specific
presentation. Build two independently launchable browser demos that share one
engine, not two copies of the engine.

- `shared-engine/` — subject-neutral gameplay: players, hands, the
  turn/evaluation lifecycle, challenge validation, penalties, winning,
  scoring, and learning history. No DOM, no UI framework, no subject data.
- `math-cards/` — Beepy's Math Cards demo application.
- `clinical-cards/` — Beepy's Clinical Cards demo application.
- `docs/` — master specification and the development log.
- `.kiro/` — specs, steering, and (later) real hooks. Committed to Git.

## Approved technology stack

Approved by the project owner during the foundation milestone:

- **Language:** TypeScript in strict mode across all workspaces.
- **Build/dev tooling:** Vite, producing static bundles suitable for free
  static hosting.
- **Monorepo:** npm workspaces (`shared-engine`, `math-cards`,
  `clinical-cards`). No additional monorepo tooling adopted yet.
- **Testing:** Vitest, for engine unit tests and the invariant tests required
  by master spec §16.
- **Linting/formatting:** ESLint (flat config) + Prettier.
- **Package manager:** npm.

### Deferred / not yet decided

- **UI framework.** The shared engine must remain independent of any UI
  framework. The choice of React or another framework is deferred until UI
  development begins and will be decided explicitly with the project owner.
- Monorepo task-runner tooling beyond npm workspaces.
- Fallback strategy and card-count bounds for draw-deck exhaustion.
- Whether the first turn alternates after Game 1 in competitive matches.

## Dependency direction

`math-cards` and `clinical-cards` depend on `@beepy/shared-engine`. The engine
must never depend on either app, on subject-specific data, or on a UI
framework. Keep this direction one-way.

## End-user independence

Neither Kiro nor a Kiro account is required for end users to play the deployed
browser games. No cloud service is required for deterministic core gameplay.
