import type { FrameMetadata } from './types';

/** Captures current page context for a frame. */
export function captureFrameMetadata(sequence: number): FrameMetadata {
  const selection = window.getSelection()?.toString()?.trim();
  const heading = document.querySelector('h1')?.textContent?.trim();
  const metaDesc = document.querySelector('meta[name="description"]')?.getAttribute('content');
  return {
    sequence,
    capturedAt: new Date().toISOString(),
    pageTitle: document.title || '',
    pageUrl: window.location.href || '',
    pageHeading: heading || '',
    pageDescription: metaDesc || '',
    selectedText: selection || undefined,
  };
}
