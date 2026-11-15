/**
 * Shared file I/O for the Clinical authoring commands (tools/*.check.ts).
 * Node built-ins are loaded with untyped dynamic imports because the project has no
 * @types/node; only the few calls used here are typed.
 */

export interface Fs {
  readFile(path: URL, encoding: string): Promise<string>;
  writeFile(path: URL, data: string, encoding: string): Promise<void>;
  mkdir(path: URL, options: { recursive: boolean }): Promise<unknown>;
  copyFile(from: URL, to: URL): Promise<void>;
}

export interface NodeIo {
  readonly fs: Fs;
  readonly env: Record<string, string | undefined>;
  /** A folder URL from an environment variable (absolute path), or the default relative to tools/. */
  folder(variable: string, fallback: string): URL;
  /** A file URL from an environment variable (absolute path), or the default relative to tools/. */
  file(variable: string, fallback: string): URL;
  /** Read a UTF-8 file, or undefined when it does not exist. */
  readIfExists(url: URL): Promise<string | undefined>;
  /** A printable local path. */
  show(url: URL): string;
}

const load = async <T>(specifier: string): Promise<T> => (await import(/* @vite-ignore */ specifier)) as T;

export async function nodeIo(): Promise<NodeIo> {
  const fs = await load<Fs>('node:fs/promises');
  const { env } = await load<{ env: Record<string, string | undefined> }>('node:process');
  const url = await load<{ pathToFileURL(path: string): URL; fileURLToPath(url: URL): string }>('node:url');
  const fromEnv = (variable: string): string | undefined => (env[variable] === undefined || env[variable] === '' ? undefined : env[variable]);
  return {
    fs,
    env,
    folder(variable, fallback) {
      const value = fromEnv(variable);
      return value === undefined ? new URL(fallback, import.meta.url) : new URL(url.pathToFileURL(value).href.replace(/\/?$/, '/'));
    },
    file(variable, fallback) {
      const value = fromEnv(variable);
      return value === undefined ? new URL(fallback, import.meta.url) : url.pathToFileURL(value);
    },
    async readIfExists(target) {
      try {
        return await fs.readFile(target, 'utf8');
      } catch (error) {
        if ((error as { code?: string }).code === 'ENOENT') return undefined;
        throw error;
      }
    },
    show: (target) => url.fileURLToPath(target),
  };
}

/** A filesystem-safe local timestamp such as 2026-11-12T14-03-27. */
export const stamp = (): string => new Date().toISOString().slice(0, 19).replace(/:/g, '-');
