/// <reference types="vite/client" />
/// <reference types="vitest/globals" />

/**
 * Vite env typings.
 *
 * During the migration we keep the legacy REACT_APP_* prefix, configured via
 * `envPrefix` in vite.config.ts. This interface allows any REACT_APP_* variable
 * to be read with correct typing. You can later replace it with explicit
 * declarations for each variable.
 */
interface ImportMetaEnv {
  [key: string]: string | undefined;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
