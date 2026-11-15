/**
 * M4 G6 (matrix, self-validation, results) and G7 (determinism).
 * The matrix is checked against an independent arithmetic oracle that reads only
 * prompt and card text.
 */

import { describe, expect, it } from 'vitest';
import { validateDeckForPlay } from '@beepy/shared-engine';
import { assembleMathDeck, generateMathDeck, validateMathRequest, type MathDraft } from '../src/math-generator.js';
import { chooseProblems } from '../src/math-generator.js';
import { DIRECTIONS, LEVELS, MODES, cardNumber, promptSum, type Direction, type Level, type Mode } from './math-oracle.js';

const SEEDS = Array.from({ length: 40 }, (_, i) => i * 31337 + 5);

function generate(mode: Mode, level: Level, direction: Direction, seed: number) {
  const result = generateMathDeck({ mode, level, generationDirection: direction, seed });
  if (!result.ok) throw new Error(result.issues.map((i) => i.code).join(', '));
  return result;
}

describe.each(MODES)('G6 matrix and self-validation: %s', (mode) => {
  describe.each(LEVELS)('%s', (level) => {
    describe.each(DIRECTIONS)('%s', (direction) => {
      it('the matrix covers every (challenge, card) pair and equals the arithmetic oracle', () => {
        for (const seed of SEEDS) {
          const { deck, contextualValidity } = generate(mode, level, direction, seed);
          expect(Object.keys(contextualValidity).sort()).toEqual(deck.challenges.map((c) => c.id).sort());
          for (const challenge of deck.challenges) {
            const row = contextualValidity[challenge.id]!;
            expect(Object.keys(row).sort()).toEqual(deck.answerCards.map((c) => c.id).sort());
            const target = promptSum(challenge.promptText, direction);
            for (const card of deck.answerCards) {
              expect(row[card.id], `${challenge.promptText} vs ${card.displayValue}`).toBe(cardNumber(card.displayValue, direction) === target);
            }
            // Exactly one valid card, and it is the designated one.
            const validCards = Object.entries(row).filter(([, v]) => v).map(([id]) => id);
            expect(validCards).toEqual([challenge.correctAnswerCardId]);
          }
        }
      });

      it('passes the exported M3 deck gate, with the right comparison mode', () => {
        for (const seed of SEEDS) {
          const result = generate(mode, level, direction, seed);
          expect(result.numericAnswers).toBe(direction === 'factToSubject');
          expect(validateDeckForPlay(result.deck, mode, result.contextualValidity, { numericAnswers: result.numericAnswers })).toEqual([]);
          expect(result.sizing.actualCardCount).toBe(result.deck.answerCards.length);
          expect(result.sizing.targetCardCount).toBe(result.deck.meta.targetCardCount);
        }
      });
    });
  });
});

describe('G6 a corrupted internal step yields a structured failure and no deck (test seam)', () => {
  const setup = (direction: Direction) => {
    const checked = validateMathRequest({ mode: 'vsBeepy', level: 'twoDigit', generationDirection: direction, seed: 12 });
    if (!checked.ok) throw new Error('request');
    const chosen = chooseProblems('twoDigit', 9, checked.request.seed);
    if (!chosen.ok) throw new Error('problems');
    return { request: checked.request, problems: chosen.problems, rng: chosen.rng };
  };

  const tampers: ReadonlyArray<readonly [string, (d: MathDraft) => MathDraft, string]> = [
    [
      'a distractor marked valid for a challenge (ambiguity)',
      (d) => {
        const first = d.deck.challenges[0]!;
        const designated = new Set(d.deck.challenges.map((c) => c.correctAnswerCardId));
        const distractor = d.deck.answerCards.find((c) => !designated.has(c.id))!;
        return { ...d, contextualValidity: { ...d.contextualValidity, [first.id]: { ...d.contextualValidity[first.id]!, [distractor.id]: true } } };
      },
      'MULTIPLE_VALID_CARDS_FOR_CHALLENGE',
    ],
    [
      'a missing matrix row',
      (d) => {
        const { [d.deck.challenges[0]!.id]: _drop, ...rest } = d.contextualValidity;
        void _drop;
        return { ...d, contextualValidity: rest };
      },
      'MISSING_VALIDITY_ENTRY',
    ],
    [
      'a duplicated card face',
      (d) => ({
        ...d,
        deck: {
          ...d.deck,
          answerCards: d.deck.answerCards.map((c, i) => (i === 1 ? { ...c, displayValue: d.deck.answerCards[0]!.displayValue } : c)),
        },
      }),
      'DUPLICATE_DISPLAY_VALUE',
    ],
    [
      'a wrong card count in meta',
      (d) => ({ ...d, deck: { ...d.deck, meta: { ...d.deck.meta, actualCardCount: d.deck.meta.actualCardCount + 1 } } }),
      'CARD_COUNT_MISMATCH',
    ],
  ];

  it.each(tampers)('%s', (_name, tamper, code) => {
    for (const direction of DIRECTIONS) {
      const { request, problems, rng } = setup(direction);
      expect(assembleMathDeck(request, problems, rng).ok).toBe(true);
      const result = assembleMathDeck(request, problems, rng, tamper);
      expect(result.ok).toBe(false);
      expect('deck' in result).toBe(false);
      if (!result.ok) {
        const codes = result.issues.map((i) => i.code);
        // Text decks compare by normalized text, so a duplicate face reports the text code.
        if (code === 'DUPLICATE_DISPLAY_VALUE') expect(codes.some((c) => c.startsWith('DUPLICATE_DISPLAY'))).toBe(true);
        else expect(codes).toContain(code);
      }
    }
  });
});

describe('G7 determinism', () => {
  it('the same request gives an identical result', () => {
    for (const mode of MODES) {
      for (const level of LEVELS) {
        for (const direction of DIRECTIONS) {
          for (const seed of [1, 99, 123456789]) {
            const request = { mode, level, generationDirection: direction, seed };
            expect(generateMathDeck(request)).toEqual(generateMathDeck(request));
          }
        }
      }
    }
  });

  it('different seeds give different decks', () => {
    for (const level of LEVELS) {
      for (const direction of DIRECTIONS) {
        const decks = new Set(SEEDS.map((seed) => JSON.stringify(generate('vsBeepy', level, direction, seed).deck)));
        expect(decks.size).toBeGreaterThan(SEEDS.length - 2);
      }
    }
  });

  it('generation does not depend on call order (no hidden module state)', () => {
    const a = generateMathDeck({ mode: 'solitaire', level: 'mixed', seed: 7 });
    for (let i = 0; i < 20; i += 1) generateMathDeck({ mode: 'vsBeepy', level: 'twoDigit', seed: i });
    expect(generateMathDeck({ mode: 'solitaire', level: 'mixed', seed: 7 })).toEqual(a);
  });

  const sources = import.meta.glob('../src/*.ts', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;

  it('finds the math-cards source files', () => {
    expect(Object.keys(sources).length).toBeGreaterThanOrEqual(5);
  });

  it.each(Object.entries(sources))('%s has no Math.random, Date, performance.now, or crypto', (_file, text) => {
    const code = text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    expect(code).not.toMatch(/Math\.random\s*\(/);
    expect(code).not.toMatch(/\bDate\b/);
    expect(code).not.toMatch(/performance\.now/);
    expect(code).not.toMatch(/\bcrypto\b/);
  });
});
