/**
 * LinkedIn publish formatting utilities.
 * Converts editor markdown to platform-native plain text and strips citation placeholders.
 */

import { normalizeLinkedInPostSpacing } from './linkedInPostSpacing';

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
  // Bare numeric chips / leftovers: [3], 【3】, (3) after source strip
  result = result.replace(/[\[【]\s*\d+\s*[\]】]/g, '');
  result = result.replace(/\(\s*\d+\s*\)(?=\s*[📝🔗\[])/g, '');

  // Clean up leftover punctuation groups; preserve newlines (LinkedIn paragraph breaks).
  result = result.replace(/\(\s*\)/g, '');
  result = result.replace(/[^\S\n]{2,}/g, ' ');
  result = result.replace(/[^\S\n]+([.,;:!?])/g, '$1');
  result = result.replace(/([(\[])[^\S\n]+/g, '$1');
  result = result.replace(/[^\S\n]+([)\]])/g, '$1');
  result = result.replace(/\n{3,}/g, '\n\n');

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

/** Full publish pipeline: strip citations, plain text, then LinkedIn spacing. */
export function formatDraftForPublish(content: string): string {
  if (!content) return '';
  const withoutCitations = stripSourceCitations(content);
  const plain = markdownToPlainText(withoutCitations).trim();
  return normalizeLinkedInPostSpacing(plain);
}

/** Extract LinkedIn image IDs from draft markdown for publish media (Phase 3). */
export { extractPublishImageIds } from './linkedInPublishMediaUtils';
