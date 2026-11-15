/**
 * The ONLY browser random source in Beepy's Clinical Cards (copied unchanged from
 * Math Cards M5 U4, decision C-1 A; decision U-5).
 *
 * Each new session or match gets a fresh 32-bit seed from the browser's
 * cryptographic random generator. All randomness after that is the engine's own
 * seeded, replayable randomness. The seed is never shown, put in the URL, or stored.
 * A guard test checks that no other UI module reads a random source.
 */

/** A fresh 32-bit series seed. */
export function newSeriesSeed(): number {
  const values = new Uint32Array(1);
  globalThis.crypto.getRandomValues(values);
  return values[0] ?? 0;
}
