/**
 * Test helpers for the math-cards suites. Hand-authored Math fixtures only: a
 * numeric fact -> subject deck ("n + 9 = ?" answered by a unique number). No game
 * content is generated at runtime.
 */

import type { GeneratedAnswerCard, GeneratedChallenge, GeneratedDeck } from '@beepy/shared-engine';

export const card = (id: string, value: string | number): GeneratedAnswerCard => ({
  id,
  displayValue: String(value),
});

export const challengeFor = (id: string, correctAnswerCardId: string): GeneratedChallenge => ({
  id,
  promptText: id,
  correctAnswerCardId,
  sourceRef: { subjectId: 'math.subject.test' },
});

/** `correct` challenges (answers 10, 11, ...) plus `distractors` distractors (40, 41, ...). */
export function mathDeck(correct: number, distractors: number, target?: number): GeneratedDeck {
  const total = correct + distractors;
  return {
    direction: 'factToSubject',
    challenges: Array.from({ length: correct }, (_, i) => ({
      id: `challenge-${i}`,
      promptText: `${i + 1} + 9 = ?`,
      correctAnswerCardId: `correct-${i}`,
      sourceRef: { subjectId: `math.subject.test-${i}` },
    })),
    answerCards: [
      ...Array.from({ length: correct }, (_, i) => card(`correct-${i}`, 10 + i)),
      ...Array.from({ length: distractors }, (_, j) => card(`distractor-${j}`, 40 + j)),
    ],
    meta: { targetCardCount: target ?? total, actualCardCount: total },
  };
}

/** Each card is valid only for its own challenge. */
export function mathMatrix(deck: GeneratedDeck): Record<string, Record<string, boolean>> {
  return Object.fromEntries(
    deck.challenges.map((challenge) => [
      challenge.id,
      Object.fromEntries(deck.answerCards.map((c) => [c.id, c.id === challenge.correctAnswerCardId])),
    ]),
  );
}
