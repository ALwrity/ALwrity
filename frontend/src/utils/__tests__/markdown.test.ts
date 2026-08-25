import type { Mock } from 'vitest';
/**
 * Regression tests for the renderMarkdown utility.
 *
 * `marked` is ESM and CRA's Jest config can't transform it.
 * We mock the library to verify the utility function's contract:
 * - Returns a string
 * - Handles empty/falsy input
 * - Passes through to marked.parse() with the right arguments
 */

vi.mock('marked', () => ({
  marked: { parse: vi.fn((input: string) => (input ? `<p>${input}</p>` : '')) },
}));

import { marked } from 'marked';
import { renderMarkdown } from '../markdown';

const mockParse = marked.parse as unknown as Mock;

describe('renderMarkdown — regression', () => {
  beforeEach(() => {
    mockParse.mockClear();
  });

  it('is a function', () => {
    expect(typeof renderMarkdown).toBe('function');
  });

  it('returns empty string for empty input', () => {
    expect(renderMarkdown('')).toBe('');
    // Should not call marked.parse with empty string
    expect(mockParse).not.toHaveBeenCalled();
  });

  it('returns empty string for falsy input', () => {
    expect(renderMarkdown(null as unknown as string)).toBe('');
    expect(renderMarkdown(undefined as unknown as string)).toBe('');
    expect(mockParse).not.toHaveBeenCalled();
  });

  it('calls marked.parse with the input', () => {
    mockParse.mockReturnValue('output');
    const result = renderMarkdown('**hello**');
    expect(mockParse).toHaveBeenCalledWith('**hello**');
    expect(result).toBe('output');
  });

  it('returns the input string if marked throws', () => {
    mockParse.mockImplementation(() => {
      throw new Error('parse error');
    });
    const result = renderMarkdown('raw **markdown**');
    expect(result).toBe('raw **markdown**');
  });

  it('returns empty string if marked returns non-string', () => {
    mockParse.mockReturnValue(undefined as unknown as string);
    const result = renderMarkdown('hello');
    expect(result).toBe('');
  });

  it('handles story-like content', () => {
    mockParse.mockReturnValue('<h1>Story</h1><p>Content</p>');
    const result = renderMarkdown('# Story\n\nContent');
    expect(result).toBe('<h1>Story</h1><p>Content</p>');
  });
});
