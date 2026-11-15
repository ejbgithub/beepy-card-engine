/**
 * Clinical penalty fallback (Milestone M6, stage C4; decision C-4).
 *
 * When the draw pile is exhausted, the shared `drawPenaltyCards` (M2, unchanged)
 * asks this provider for candidates and re-checks every one. This provider offers
 * ONLY unused entries of the owner-authored, reviewed dataset, of the card kind the
 * question direction uses:
 *   subjectToFact  topic facts (corrects and incorrects), verbatim;
 *   factToSubject  disease names and alternative diagnoses, verbatim.
 * It never writes, composes or paraphrases clinical text.
 *
 * A candidate is offered only when the C2 policy says it is INVALID (reviewed or
 * explicitly listed) for EVERY active challenge. Candidates that are valid or
 * unknown for any active challenge are skipped, so the Q-1 alternative-diagnosis
 * safeguard and stale-review exclusion apply exactly as in deck generation. Texts
 * already in the game (any zone; case and spacing ignored) are skipped. If any
 * active challenge cannot be matched to the dataset exactly, nothing is offered,
 * and the engine's existing waiver path applies.
 *
 * Order: deterministic, dataset order, with subjectToFact cards from the active
 * challenges' categories first (plausible near-misses). The sequence is finite;
 * the engine bounds how many candidates it examines.
 *
 * Ids: neutral `k<n>` continuing after the highest `k` number in the game, so a
 * fallback card id never reveals its source entry or correctness. Fallback cards
 * carry no explanation (the engine strips them anyway); Explain Why looks up the
 * authored explanation for the resolved context instead (clinical-series.ts).
 */

import {
  normalizeDisplayText,
  type GenerationDirection,
  type PenaltyCandidate,
  type PenaltyFallbackContext,
  type PenaltyFallbackProvider,
  type SubjectCollection,
} from '@beepy/shared-engine';
import { cardUniverse, relationFor, resolveChallengeContext, type ChallengeSpec } from './clinical-generator.js';
import { createValidityPolicy, type ReviewValidationResult } from './clinical-review.js';

export interface ClinicalFallbackOptions {
  /** A dataset that passed `validateClinicalCollection`. */
  readonly collection: SubjectCollection;
  /** The validated review file (stale and invalid records are ignored by the policy). */
  readonly review: ReviewValidationResult;
  readonly direction: GenerationDirection;
}

/** Create the Clinical fallback provider for one series. Stateless between calls. */
export function createClinicalFallbackProvider(options: ClinicalFallbackOptions): PenaltyFallbackProvider {
  const { collection, direction } = options;
  const policy = createValidityPolicy(collection, options.review);
  const relation = relationFor(policy, direction);
  const universe = cardUniverse(collection, direction);
  return {
    candidates(context: PenaltyFallbackContext): Iterable<PenaltyCandidate> {
      return enumerate(context);
    },
  };

  function* enumerate(context: PenaltyFallbackContext): Generator<PenaltyCandidate> {
    const specs: { readonly id: string; readonly spec: ChallengeSpec }[] = [];
    for (const challenge of context.activeChallenges) {
      const spec = resolveChallengeContext(collection, direction, challenge);
      if (spec === undefined) return; // cannot prove invalidity: offer nothing
      specs.push({ id: challenge.id, spec });
    }
    const used = new Set(context.usedCards.map((card) => normalizeDisplayText(card.displayValue)));
    let next = 1 + Math.max(0, ...context.usedCards.map((card) => (/^k(\d+)$/.exec(card.id) ? Number(card.id.slice(1)) : 0)));

    const categories = new Set(specs.map((s) => s.spec.category));
    const ordered =
      direction === 'subjectToFact'
        ? [...universe.filter((f) => f.category !== undefined && categories.has(f.category)), ...universe.filter((f) => f.category === undefined || !categories.has(f.category))]
        : universe;

    for (const face of ordered) {
      if (used.has(face.key)) continue;
      const validForChallenges: Record<string, boolean> = {};
      let eligible = true;
      for (const { id, spec } of specs) {
        if (relation(face, spec) !== 'invalid') {
          eligible = false; // valid or unknown: never a penalty card
          break;
        }
        validForChallenges[id] = false;
      }
      if (!eligible) continue;
      used.add(face.key);
      yield { card: { id: `k${next}`, displayValue: face.text }, plausible: true, validForChallenges };
      next += 1;
    }
  }
}
