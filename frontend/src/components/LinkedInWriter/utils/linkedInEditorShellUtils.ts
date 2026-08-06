/**
 * Editor shell routing for LinkedIn Studio post vs article chrome.
 */

import { normalizeDraftContentType } from "./linkedInDraftContentTypeStorage";

export type EditorShellMode = "post" | "article";

/** Resolve top-level editor shell; only article gets article chrome — others use post shell. */
export function resolveEditorShellMode(raw: unknown): EditorShellMode {
  return normalizeDraftContentType(raw) === "article" ? "article" : "post";
}
