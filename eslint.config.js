// ESLint flat config (ESLint 9+). Applied once dependencies are installed.
// Kept minimal for the foundation milestone; rules will be tuned when real
// engine code exists.
import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default [
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    ignores: ['**/dist/**', '**/web-dist/**', '**/build/**', '**/node_modules/**', '**/coverage/**'],
  },
];
