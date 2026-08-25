/**
 * Environment compatibility shim.
 *
 * CRA exposed env vars on `process.env`.
 * Vite exposes them on `import.meta.env`.
 *
 * This module normalises the two: after importing this file, legacy code that
 * reads `process.env.REACT_APP_*` continues to work under Vite, and the Vite
 * variables are also available directly via `import.meta.env`.
 *
 * Import this module before any code that reads `process.env`.
 */

// Vite only exposes env vars prefixed with REACT_APP_ because of envPrefix.
// Fall back gracefully if `import.meta.env` is not present (e.g. during a CRA fallback build).
let viteEnv: Record<string, string | boolean | undefined> = {};
try {
  viteEnv = ((import.meta as any).env as Record<string, string | boolean | undefined>) ?? {};
} catch {
  // CRA builds do not define import.meta.env; process.env is already populated there.
}

if (typeof (globalThis as any).process === 'undefined') {
  (globalThis as any).process = { env: {} };
}

// Merge Vite env vars into the global process.env without removing existing ones.
Object.assign((globalThis as any).process.env, viteEnv);

// Vite does not expose NODE_ENV on import.meta.env, but a lot of legacy code and
// third-party packages expect it. Derive it from the Vite-provided DEV/PROD flags.
if (!(globalThis as any).process.env.NODE_ENV) {
  (globalThis as any).process.env.NODE_ENV = viteEnv.DEV ? 'development' : 'production';
}
