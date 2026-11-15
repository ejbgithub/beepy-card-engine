# Shared Game Engine — Tasks (revision 2a, approved)

Scope: Solitaire and Player vs. Beepy only. Tutor deferred. Mark a task complete
only after its required tests pass. No dependencies, no Git, no `npm audit fix`, no
UI, no change to M2 production code.

- [x] E0. Owner approval of revision 2 and clarifications 2a (received)
- [x] E1. Core types and random source (25/25 tests passed, `m3-e1-random.test.ts`)
  - Tests: same seed same sequence; shuffle is a permutation; seeds differ; derived
    streams independent; pure (inputs unchanged); no `Math.random` in engine source
- [x] E2. Initialization gate (131 gate tests in m3-e2-gate + 9 createGame refusal tests in m3-e3-deal, all passed)
  - Tests: `tutor`/`vsPlayer` give `MODE_NOT_IMPLEMENTED`; unknown mode
    `INVALID_MODE`; missing matrix; each M2 stage failing alone; typed-but-invalid
    deck refused; malformed untyped input gives issues not a throw; all issues
    together as `GAME_SETUP_INVALID`
- [x] E3. Dealing (43 tests in m3-e3-deal incl. E2 createGame tests, passed)
  - Tests: 5 distinct; 2 or 3 correct; non-overlapping; order not correlated with
    correctness; determinism; conservation; re-validated; no repair
- [x] E4. Judging (34/34 passed, m3-e4-judge)
  - Tests: a play is valid only for the designated card on its own open challenge;
    the same card on a different open challenge is invalid; a discard is valid only
    for a card that is the designated correct card of no remaining open challenge;
    a successfully played correct card remains attached to the challenge it just
    solved and never reappears in a hand, the pile, or the discard pile; playing
    any card onto an already-solved challenge is an illegal request (no state
    change, no turn, no penalty); other illegal requests change nothing
- [x] E5. Penalty application (17/17 passed, m3-e5-penalty)
  - Tests: pile draw; fallback (no explanation); exhaustion waived and recorded;
    atomic two-player draw; Clinical with no provider; no reuse; uniqueness holds
- [x] E6. Solitaire turns (m3-e6-e7-solitaire: 24 turn tests, passed)
- [x] E7. Solitaire ending, scoring, session (m3-e6-e7-solitaire: 8 ending tests; m3-series: 28 session/match/validation tests; all passed)
- [x] E8. Competitive turns and pending Beepy action (m3-e8-e9-competitive, passed)
- [x] E9. Competitive ending and tiebreaks (m3-e8-e9-competitive, passed; 37 tests in the file incl. E10 first-player checks)
  - Includes Beepy empties hand while human Challenges: no human penalty applied
- [x] E10. Match management and alternating first player (m3-e10-match: 11/11 passed, real games; series rules in m3-series)
- [x] E11. Beepy reference strategy (m3-e11-beepy: 43/43 passed; untrusted strategy results give STRATEGY_RESULT_INVALID)
- [x] E12. Controller, views, handles, public events (m3-e12-controller: 52/52 passed; sanitized public errors, runtime request validation)
  - Tests: no state accessor; content scans; valid and invalid pending views
    identical in shape; handles independent of ids and order; replay determinism
- [x] E13. History and learning events (m3-e13-history: 53/53 passed)
- [x] E14. Invariant simulation and regression (m3-e14-simulation 21/21; API lock 20/20 at 79 exports; full suite 1450 passed)
  - Test-only step limit, progress-making agents, stall guard, exhaustion
    scenarios, non-termination demonstration; API-surface lock updated
- [x] E15. Documentation and report (lint clean on M3 code; build, typecheck:tests, and full suite 1450 passed / 0 failed / 10 todo; log updated)
  - Full build, `typecheck:tests`, test run; development log; consolidated report

## Deferred (not in M3)
Tutor gameplay and Continue; conversion of the 4 engine-dependent Task 16 todos
(needs owner approval; Task 16 stays unchecked); real generators, loader, source
sufficiency scan, UI, persistence, controlled repetition, `vsPlayer`.
