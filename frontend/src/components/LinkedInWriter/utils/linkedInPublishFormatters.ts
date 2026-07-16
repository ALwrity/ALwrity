/**
 * LinkedIn publish formatting utilities.
 * Converts editor markdown to platform-native plain text and strips citation placeholders.
 */

/** Strip inline source citation placeholders from draft content. */
export function stripSourceCitations(content: string): string {
  if (!content) return '';

  let result = content;

  // Parenthetical groups containing citations: ([Source 3]), ([Source 7]; ... [Source 8])
  result = result.replace(
    /\(\s*(?:\[Source\s+\d+\]|\[source\s+\d+\]|\(\s*Source\s+\d+\s*\))(?:\s*[;,]\s*(?:\.\.\.\s*)?(?:\[Source\s+\d+\]|\[source\s+\d+\]|\(\s*Source\s+\d+\s*\)))*\s*\)/gi,
    '',
  );

  // Adjacent shorthand: [Source N] [M]
  result = result.replace(/\[Source\s+\d+\]\s*\[\d+\]/gi, '');

  // Standard inline citation markers
  result = result.replace(/\[Source\s+\d+\]/gi, '');
  result = result.replace(/\[source\s+\d+\]/gi, '');
  result = result.replace(/\(\s*Source\s+\d+\s*\)/gi, '');

  // Clean up leftover whitespace and orphaned punctuation
  result = result.replace(/\(\s*\)/g, '');
  result = result.replace(/\s{2,}/g, ' ');
  result = result.replace(/\s+([.,;:!?])/g, '$1');
  result = result.replace(/([(\[])\s+/g, '$1');
  result = result.replace(/\s+([)\]])/g, '$1');

  return result.trim();
}

/** Convert markdown content to clean plain text suitable for LinkedIn publishing. */
export function markdownToPlainText(content: string): string {
  if (!content) return '';

  let text = content;

  // Fenced code blocks and inline code
  text = text.replace(/```[\s\S]*?```/g, '');
  text = text.replace(/`([^`]+)`/g, '$1');

  // Links and images — keep link text only; strip image markdown entirely
  text = text.replace(/!\[[^\]]*\]\([^)]+\)/g, '');
  text = text.replace(/!\[[^\]]*\]\([^\)]*\)/g, '');
  text = text.replace(/https?:\/\/[^\s]*\/api\/linkedin\/images\/[^\s)\]]+/gi, '');
  text = text.replace(/\[\s*https?:\/\/[^\]\)]+\)\]/gi, '');
  text = text.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');

  // Headers
  text = text.replace(/^#{1,6}\s+(.+)$/gm, '$1');

  // Bold / italic (order matters for ***text***)
  text = text.replace(/\*\*\*([^*]+)\*\*\*/g, '$1');
  text = text.replace(/\*\*([^*]+)\*\*/g, '$1');
  text = text.replace(/\*([^*\n]+)\*/g, '$1');
  text = text.replace(/__([^_]+)__/g, '$1');
  text = text.replace(/_([^_\n]+)_/g, '$1');

  // Strikethrough and blockquotes
  text = text.replace(/~~([^~]+)~~/g, '$1');
  text = text.replace(/^>\s?/gm, '');

  // Horizontal rules
  text = text.replace(/^[-*_]{3,}\s*$/gm, '');

  // Bullet lists — preserve bullet character
  text = text.replace(/^[\t ]*[-*+•·]\s+/gm, '• ');

  // Normalize excessive blank lines while preserving paragraph breaks
  text = text.replace(/\n{3,}/g, '\n\n');

  return text.trim();
}

/** Full publish pipeline: strip citations then convert markdown to plain text. */
export function formatDraftForPublish(content: string): string {
  if (!content) return '';
  const withoutCitations = stripSourceCitations(content);
  return markdownToPlainText(withoutCitations).trim();
}

/** Extract LinkedIn image IDs from draft markdown for publish media (Phase 3). */
export { extractPublishImageIds } from './linkedInPublishMediaUtils';
