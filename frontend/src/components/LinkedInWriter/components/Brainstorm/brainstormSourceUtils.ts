import type { BrainstormIdea, BrainstormSource } from '../../hooks/usePlanWedgeBrainstorm';

const SOURCE_INDEX_PATTERNS = [
  /Sources?\s*\[(\d+)\]/gi,
  /Source\s+(\d+)\s*[:\.]/gi,
  /\[Source\s+(\d+)\]/gi,
];

function collectIndicesFromText(text: string, seen: Set<number>, indices: number[]): void {
  for (const patternSource of SOURCE_INDEX_PATTERNS) {
    const pattern = new RegExp(patternSource.source, patternSource.flags);
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(text)) !== null) {
      const index = Number.parseInt(match[1], 10);
      if (!Number.isFinite(index) || index < 1 || seen.has(index)) continue;
      seen.add(index);
      indices.push(index);
    }
  }
}

/** Extract unique 1-based source indices referenced in evidence text. */
export function parseSourceIndicesFromEvidence(evidence?: string | null): number[] {
  if (!evidence?.trim()) return [];

  const seen = new Set<number>();
  const indices: number[] = [];
  collectIndicesFromText(evidence, seen, indices);
  return indices;
}

/** Resolve which Exa sources belong to a brainstorm idea (1-based indices). */
export function getIdeaSourceIndices(idea: BrainstormIdea): number[] {
  const fromEvidence = parseSourceIndicesFromEvidence(idea.evidence);
  if (fromEvidence.length > 0) return fromEvidence;

  if (typeof idea.source_index === 'number' && idea.source_index >= 0) {
    return [idea.source_index + 1];
  }

  return [];
}

export interface ResolveIdeaSourcesOptions {
  /** 0-based card position — used when LLM omits Source [N] tags but Exa sources exist. */
  cardIndex?: number;
  allowIndexFallback?: boolean;
}

export function resolveIdeaSources(
  idea: BrainstormIdea,
  sources: BrainstormSource[],
  options: ResolveIdeaSourcesOptions = {}
): Array<{ index: number; source: BrainstormSource }> {
  if (!sources.length) return [];

  let indices = getIdeaSourceIndices(idea);

  if (
    indices.length === 0 &&
    options.allowIndexFallback &&
    typeof options.cardIndex === 'number' &&
    options.cardIndex >= 0
  ) {
    indices = [(options.cardIndex % sources.length) + 1];
  }

  return indices
    .map((index) => ({ index, source: sources[index - 1] }))
    .filter((entry): entry is { index: number; source: BrainstormSource } => Boolean(entry.source));
}

/** Strip leading "Source [N]:" prefixes for cleaner inline evidence display. */
export function formatEvidenceClaim(evidence?: string | null): string {
  if (!evidence?.trim()) return '';

  return evidence
    .replace(/Source\s*\[\d+\]\s*:\s*/gi, '')
    .replace(/\s+and\s+Source\s*\[\d+\]\s*:\s*/gi, ' · ')
    .trim();
}

export function truncateSnippet(text: string, maxLen = 48): string {
  const trimmed = text.trim();
  if (trimmed.length <= maxLen) return trimmed;
  return `${trimmed.slice(0, maxLen - 1)}…`;
}
