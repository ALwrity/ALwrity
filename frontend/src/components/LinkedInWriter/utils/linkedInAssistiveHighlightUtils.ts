/**
 * Compute added-text ranges for assistive editor in-place highlights.
 * Optimized for pure insertions (assistive sentence completion).
 */

export interface AssistiveTextHighlightRange {
  start: number;
  end: number;
}

const LOG_PREFIX = "[linkedInAssistiveHighlightUtils]";

function commonPrefixLength(a: string, b: string): number {
  const max = Math.min(a.length, b.length);
  let i = 0;
  while (i < max && a[i] === b[i]) i += 1;
  return i;
}

function commonSuffixLength(a: string, b: string, prefixLen: number): number {
  const aRemain = a.length - prefixLen;
  const bRemain = b.length - prefixLen;
  const max = Math.min(aRemain, bRemain);
  let i = 0;
  while (
    i < max &&
    a[a.length - 1 - i] === b[b.length - 1 - i]
  ) {
    i += 1;
  }
  return i;
}

/**
 * Return the span of text that was added when going from `before` → `after`.
 * Returns null when there is no additive change to highlight.
 */
export function getAddedTextRange(
  before: string,
  after: string,
): AssistiveTextHighlightRange | null {
  try {
    if (!after || before === after) return null;

    const prefix = commonPrefixLength(before, after);
    const suffix = commonSuffixLength(before, after, prefix);
    const start = prefix;
    const end = after.length - suffix;

    if (end <= start) {
      console.log(`${LOG_PREFIX} no additive span to highlight`);
      return null;
    }

    // Prefer highlighting only when something was actually inserted.
    const removedLen = before.length - prefix - suffix;
    if (removedLen > 0 && end - start === 0) return null;

    console.log(`${LOG_PREFIX} additive highlight range`, {
      start,
      end,
      addedLength: end - start,
      removedLength: Math.max(0, removedLen),
    });

    return { start, end };
  } catch (err) {
    console.error(`${LOG_PREFIX} failed to compute highlight range`, err);
    return null;
  }
}
