// Content formatting utilities for LinkedIn Writer

import { normalizeLinkedInPostSpacing } from './linkedInPostSpacing';

// Escape HTML characters to prevent XSS
export function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// Build an inline citation badge element
function citationBadge(num: string): string {
  return `<span class="liw-cite" data-source-index="${num}">${num}</span>`;
}

/**
 * Format draft content with LinkedIn-style paragraph spacing and optional citation badges.
 * Preserves newlines (Best Practices: short paragraphs separated by blank lines).
 */
export function formatDraftContent(
  content: string,
  citations?: any[],
  researchSources?: any[],
): string {
  if (!content?.trim()) return '';

  // Normalize spacing first so Studio preview matches LinkedIn readability.
  let formatted = escapeHtml(normalizeLinkedInPostSpacing(content));

  // Convert [Source N] markers when present (supports persisted drafts).
  // Do not invent citation placements that rewrite the whole body (that destroyed newlines).
  if (/\[Source \d+\]/i.test(formatted)) {
    formatted = formatted.replace(
      /\[Source\s+(\d+)\]\s*\[(\d+)\]/gi,
      (_, n1, n2) => `${citationBadge(n1)} ${citationBadge(n2)}`,
    );
    formatted = formatted.replace(
      /\[Source\s+(\d+)\]/gi,
      (_, n) => citationBadge(n),
    );
  } else if (
    citations &&
    citations.length > 0 &&
    researchSources &&
    researchSources.length > 0
  ) {
    // Soft fallback: append one badge after the first sentence only.
    const sourceNums = citations
      .map((citation) => {
        if (citation?.reference && String(citation.reference).startsWith('Source ')) {
          return String(citation.reference).replace('Source ', '');
        }
        return null;
      })
      .filter(Boolean) as string[];

    if (sourceNums.length > 0) {
      const firstSentenceEnd = formatted.search(/[.!?]/);
      if (firstSentenceEnd >= 0) {
        const badge = ` ${citationBadge(sourceNums[0])}`;
        formatted =
          formatted.slice(0, firstSentenceEnd + 1) +
          badge +
          formatted.slice(firstSentenceEnd + 1);
      }
    }
  }

  formatted = formatted.replace(
    /#(\w+)/g,
    '<span style="color: #0a66c2; font-weight: 600;">#$1</span>',
  );

  formatted = formatted.replace(
    /@(\w+)/g,
    '<span style="color: #0a66c2; font-weight: 600;">@$1</span>',
  );

  formatted = formatted.replace(
    /^# (.+)$/gm,
    '<h1 style="font-size: 24px; font-weight: 700; color: #1d1d1f; margin: 16px 0 12px 0; line-height: 1.3;">$1</h1>',
  );
  formatted = formatted.replace(
    /^## (.+)$/gm,
    '<h2 style="font-size: 20px; font-weight: 600; color: #1d1d1f; margin: 14px 0 10px 0; line-height: 1.3;">$1</h2>',
  );
  formatted = formatted.replace(
    /^### (.+)$/gm,
    '<h3 style="font-size: 18px; font-weight: 600; color: #1d1d1f; margin: 12px 0 8px 0; line-height: 1.3;">$1</h3>',
  );

  formatted = formatted.replace(/\*\*(.+?)\*\*/g, '<strong style="font-weight: 600;">$1</strong>');
  formatted = formatted.replace(/\*(.+?)\*/g, '<em style="font-style: italic;">$1</em>');

  formatted = formatted.replace(
    /^[•·-] (.+)$/gm,
    '<div style="margin: 6px 0; padding-left: 4px; color: #191919; line-height: 1.5;">• $1</div>',
  );

  formatted = formatted.replace(/^\d+\. (.+)$/gm, (match, itemContent, offset, string) => {
    const lines = string.substring(0, offset).split('\n');
    const currentLine = lines[lines.length - 1];
    const number = currentLine.match(/^(\d+)\./)?.[1] || '1';
    return `<div style="margin: 6px 0; padding-left: 4px; color: #191919; line-height: 1.5;">${number}. ${itemContent}</div>`;
  });

  formatted = formatted.replace(
    /\n\n/g,
    '</p><p style="margin: 0 0 14px 0; line-height: 1.55; color: #191919;">',
  );
  formatted = formatted.replace(/\n/g, '<br/>');

  formatted = `<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;"><p style="margin: 0 0 14px 0; line-height: 1.55; color: #191919;">${formatted}</p></div>`;

  return formatted;
}

// Lightweight LCS-based diff highlighting for professional content changes
export function diffMarkup(oldText: string, newText: string): string {
  const MAX = 4000;
  const a = (oldText || '').slice(0, MAX);
  const b = (newText || '').slice(0, MAX);
  const n = a.length;
  const m = b.length;
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));

  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      if (a[i] === b[j]) dp[i][j] = dp[i + 1][j + 1] + 1;
      else dp[i][j] = Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }

  let i = 0;
  let j = 0;
  let out = '';

  while (i < n && j < m) {
    if (a[i] === b[j]) {
      out += a[i];
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      out += `<s class="liw-del">${escapeHtml(a[i])}</s>`;
      i++;
    } else {
      out += `<em class="liw-add">${escapeHtml(b[j])}</em>`;
      j++;
    }
  }

  while (i < n) {
    out += `<s class="liw-del">${escapeHtml(a[i++])}</s>`;
  }
  while (j < m) {
    out += `<em class="liw-add">${escapeHtml(b[j++])}</em>`;
  }

  if (oldText.length > MAX || newText.length > MAX) out += '<span class="liw-more"> …</span>';

  return out;
}
