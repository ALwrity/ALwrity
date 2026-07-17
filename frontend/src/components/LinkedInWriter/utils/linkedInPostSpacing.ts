/**
 * Normalize LinkedIn post body spacing to match feed Best Practices:
 * short hook, blank lines between sentences/blocks, bullets on own lines, tags at end.
 *
 * Reference: LinkedIn feed posts use generous whitespace (blank line between short blocks).
 */

/** Bullet glyphs models emit (including diamond variants). */
const BULLET_CLASS = '•·✦✧◆♦▪◾‣‧';

function countNewlines(text: string): number {
  return (text.match(/\n/g) || []).length;
}

/** Split a prose block into LinkedIn-style paragraphs (typically one sentence each). */
function breakProseIntoParagraphs(prose: string): string {
  const trimmed = prose.replace(/[ \t]+/g, ' ').trim();
  if (!trimmed) return '';

  // Already structured — keep gaps, don't over-split.
  if (countNewlines(trimmed) >= 2) {
    return trimmed.replace(/\n{3,}/g, '\n\n').trim();
  }

  const sentences = trimmed
    .split(/(?<=[.!?…])\s+(?=[A-Z0-9“"(\[]|[\u{1F300}-\u{1FAFF}])/u)
    .map((s) => s.trim())
    .filter(Boolean);

  if (sentences.length <= 1) return trimmed;

  // Feed style: each sentence is its own block with a blank line between.
  return sentences.join('\n\n');
}

function extractTrailingHashtags(text: string): { body: string; tags: string } {
  const match = text.match(/^(.*?)(?:\n+|\s+)((?:#\w[\w-]*\s*){2,})$/s);
  if (!match) return { body: text.trim(), tags: '' };
  return {
    body: match[1].trim(),
    tags: match[2].replace(/[ \t]+/g, ' ').trim(),
  };
}

/**
 * Insert LinkedIn-friendly line breaks when the model returns a dense wall of text.
 */
export function normalizeLinkedInPostSpacing(content: string): string {
  if (!content?.trim()) return '';

  let text = content.replace(/\r\n/g, '\n').trim();

  // Normalize odd bullet glyphs to •
  text = text.replace(new RegExp(`[${BULLET_CLASS}]`, 'g'), '•');

  // Keep "• Step N:" together as one bullet line (do this before generic bullet split).
  text = text.replace(/\s*•\s*(Step\s+\d+\s*:)/gi, '\n• $1');

  // Other jammed bullets → own lines
  text = text.replace(/\s+•\s+/g, '\n• ');

  // "Step N:" not already on a bullet line
  text = text.replace(/([^•\n])[ \t]+(Step\s+\d+\s*:)/gi, '$1\n\n$2');

  // Numbered list jammed inline: "ops: 1. Foo 2. Bar"
  text = text.replace(/\s+(?=\d+\.\s+[A-Z])/g, '\n');

  const { body, tags } = extractTrailingHashtags(text);

  const blocks = body
    .split(/\n+/)
    .map((b) => b.trim())
    .filter(Boolean);

  const spacedBlocks: string[] = [];
  for (const block of blocks) {
    if (/^•\s/.test(block) || /^Step\s+\d+/i.test(block) || /^\d+\.\s/.test(block)) {
      spacedBlocks.push(block.startsWith('•') ? block.replace(/^•\s*/, '• ') : block);
      continue;
    }
    const broken = breakProseIntoParagraphs(block);
    spacedBlocks.push(...broken.split(/\n\n+/).filter(Boolean));
  }

  let result = spacedBlocks.join('\n\n');

  // Repair orphaned bullet + Step lines if any slipped through
  result = result.replace(/•\s*\n+(Step\s+\d+\s*:)/gi, '• $1');

  // CTA / question stuck after a bullet line without sentence punctuation
  result = result.replace(
    /(model|ops|workflow|process|system|team|here)\s+((?:What|How|Why|Have|Do|Are|Is)\b)/gi,
    '$1\n\n$2',
  );
  result = result.replace(/([.!\u2026])[ \t]+((?:What|How|Why|Have|Do|Are|Is)\b)/g, '$1\n\n$2');
  result = result.replace(/([a-z0-9])\s+((?:What|How|Why)\s+[^?\n]+\?)/g, '$1\n\n$2');

  if (tags) {
    result = `${result.trim()}\n\n${tags}`;
  }

  return result
    .split('\n')
    .map((line) => line.replace(/[ \t]+$/g, ''))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
