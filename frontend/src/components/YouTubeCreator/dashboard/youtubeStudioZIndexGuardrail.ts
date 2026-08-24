/**
 * Phase 5: scan YouTube Creator sources for overlay z-index / isolation regressions.
 * Allowlisted CSS values are in-tree Hub chrome only (rail, toolbar, FAB).
 * ESLint in frontend/package.json blocks the same overlay-scale zIndex literals.
 * Do not re-add isolation: isolate on Hub main (that is Problem 1).
 */
import * as fs from "fs";
import * as path from "path";

const YOUTUBE_CREATOR_ROOT = path.resolve(__dirname, "..");

const SKIP_SCAN_FILES = new Set([
  "youtubeStudioZIndex.ts",
  "youtubeStudioOverlayInventory.ts",
  "youtubeStudioZIndexGuardrail.ts",
]);

/** In-tree Hub chrome only. Overlay-scale values (1300+) are forbidden in CSS. */
const ALLOWED_CSS_Z_INDEX = new Set([1, 2, 10, 20, 24, 25, 1200]);

const SCAN_EXTENSIONS = new Set([".ts", ".tsx", ".css"]);

export interface YouTubeZIndexGuardrailHit {
  file: string;
  line: number;
  snippet: string;
  reason: string;
}

function stripComments(source: string, ext: string): string {
  if (ext === ".css") {
    return source.replace(/\/\*[\s\S]*?\*\//g, "");
  }
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

function walkSourceFiles(dir: string, acc: string[] = []): string[] {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "__tests__" || entry.name === "node_modules") continue;
      walkSourceFiles(full, acc);
      continue;
    }
    const ext = path.extname(entry.name);
    if (!SCAN_EXTENSIONS.has(ext)) continue;
    if (entry.name.includes(".test.")) continue;
    if (SKIP_SCAN_FILES.has(entry.name)) continue;
    acc.push(full);
  }
  return acc;
}

function recordHits(
  file: string,
  lines: string[],
  pattern: RegExp,
  reason: string,
  hits: YouTubeZIndexGuardrailHit[],
): void {
  lines.forEach((line, index) => {
    if (!pattern.test(line)) return;
    hits.push({
      file: path.relative(YOUTUBE_CREATOR_ROOT, file).replace(/\\/g, "/"),
      line: index + 1,
      snippet: line.trim().slice(0, 160),
      reason,
    });
  });
}

export function scanYouTubeCreatorOverlayGuardrails(): YouTubeZIndexGuardrailHit[] {
  const hits: YouTubeZIndexGuardrailHit[] = [];
  const files = walkSourceFiles(YOUTUBE_CREATOR_ROOT);

  for (const file of files) {
    const ext = path.extname(file);
    const raw = fs.readFileSync(file, "utf8");
    const source = stripComments(raw, ext);
    const lines = source.split(/\r?\n/);

    recordHits(
      file,
      lines,
      /isolation\s*:\s*isolate/i,
      "isolation: isolate recreates Problem 1 on Hub stacking",
      hits,
    );

    if (ext === ".css") {
      lines.forEach((line, index) => {
        const match = line.match(/z-index\s*:\s*(-?\d+)/i);
        if (!match) return;
        const value = Number.parseInt(match[1], 10);
        if (ALLOWED_CSS_Z_INDEX.has(value)) return;
        hits.push({
          file: path.relative(YOUTUBE_CREATOR_ROOT, file).replace(/\\/g, "/"),
          line: index + 1,
          snippet: line.trim().slice(0, 160),
          reason: `CSS z-index ${value} is not an allowlisted Hub chrome tier`,
        });
      });
      continue;
    }

    recordHits(
      file,
      lines,
      /YT_Z_MODAL\s*\+\s*\d+/,
      "YT_Z_MODAL + n overlay patches are forbidden",
      hits,
    );

    lines.forEach((line, index) => {
      const match = line.match(/\bzIndex\s*:\s*(-?\d+)/);
      if (!match) return;
      const value = Number.parseInt(match[1], 10);
      if (value < 100) return;
      hits.push({
        file: path.relative(YOUTUBE_CREATOR_ROOT, file).replace(/\\/g, "/"),
        line: index + 1,
        snippet: line.trim().slice(0, 160),
        reason: `Numeric zIndex ${value} must use youtubeStudioZIndex.ts constants (or stay < 100 for in-tree layout)`,
      });
    });
  }

  return hits;
}
