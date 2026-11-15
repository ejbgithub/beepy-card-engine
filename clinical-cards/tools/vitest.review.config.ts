// Vitest config for the Clinical authoring commands only (M6 C5). Each npm script picks
// its command by file name, e.g. `vitest run --config tools/vitest.review.config.ts convert-authoring`.
// Not used by the normal test suite, whose default pattern (*.test.ts) does not match *.check.ts.
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tools/*.check.ts'],
    reporters: ['verbose'],
  },
});
