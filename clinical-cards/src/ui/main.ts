/**
 * Beepy's Clinical Cards browser entry point (M6 C6; adapted from Math Cards M5).
 *
 * Mounts the app in `#app` with the browser seed source and a native confirmation
 * for leaving a game. Developer diagnostics go to the console in development builds
 * only and are never shown in the UI (decision U-5).
 */

import { mountApp } from './app.js';
import { newSeriesSeed } from './seed.js';
import { browserScheduler } from './session.js';

const isDevBuild = (import.meta as unknown as { env?: { DEV?: boolean } }).env?.DEV === true;

const root = document.getElementById('app');
if (root !== null) {
  mountApp(root, {
    scheduler: browserScheduler,
    newSeed: newSeriesSeed,
    confirm: (message) => globalThis.confirm(message),
    ...(isDevBuild
      ? {
          diagnostics: (diagnostic) => {
            console.debug("[Beepy's Clinical Cards diagnostics]", diagnostic);
          },
        }
      : {}),
  });
}
