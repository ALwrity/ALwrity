/**
 * Phase 5: SemanticQuery — scoped unified Brand Brain search ("Ask your Brand Brain").
 *
 * Scope chips (all · onboarding · strategy · calendar) + per-scope preset chips
 * + free-text input. Hook (`useBrandBrainSemanticSearch`) is mocked so we can
 * exercise render paths (default / loading / error / empty / with-hits) without
 * hitting the real backend. The component never fabricates: an API failure
 * surfaces an explicit error alert and empty hits.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

const mockSearch = vi.fn();
const mockReset = vi.fn();

vi.mock('../../../hooks/useBrandBrainSemanticSearch', () => ({
  useBrandBrainSemanticSearch: vi.fn(() => ({
    loading: false,
    error: null,
    results: null,
    search: mockSearch,
    reset: mockReset,
  })),
}));

import { useBrandBrainSemanticSearch } from '../../../hooks/useBrandBrainSemanticSearch';
import SemanticQuery from '../SemanticQuery';
import { SCOPE_PRESETS } from '../semanticPresets';

const mockedHook = vi.mocked(useBrandBrainSemanticSearch);

const defaultHookState = () => ({
  loading: false,
  error: null,
  results: null,
  search: mockSearch,
  reset: mockReset,
});

describe('SemanticQuery — Phase 5: scoped Brand Brain semantic search', () => {
  beforeEach(() => {
    mockSearch.mockClear();
    mockReset.mockClear();
    mockedHook.mockImplementation(() => defaultHookState());
  });

  it('renders four scope chips (all · onboarding · strategy · calendar)', () => {
    render(<SemanticQuery />);
    expect(screen.getByRole('button', { name: /^all$/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /^onboarding$/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /^strategy$/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /^calendar$/i })).toBeTruthy();
  });

  it('shows the curated preset for the active scope (default = all)', () => {
    render(<SemanticQuery />);
    expect(screen.getByText(SCOPE_PRESETS.all[0])).toBeTruthy();
  });

  it('switching scope swaps the preset list', () => {
    render(<SemanticQuery />);
    fireEvent.click(screen.getByRole('button', { name: /^strategy$/i }));
    expect(screen.getByText(SCOPE_PRESETS.strategy[0])).toBeTruthy();
  });

  it('clicking a preset fills the input with that question', () => {
    render(<SemanticQuery />);
    fireEvent.click(screen.getByText(SCOPE_PRESETS.all[0]));
    expect(screen.getByDisplayValue(SCOPE_PRESETS.all[0])).toBeTruthy();
  });

  it('clicking Search calls hook.search with the current scope and query', () => {
    render(<SemanticQuery />);
    fireEvent.change(screen.getByPlaceholderText(/ask/i), {
      target: { value: 'brand voice' },
    });
    fireEvent.click(screen.getByRole('button', { name: /^search$/i }));
    expect(mockSearch).toHaveBeenCalledWith('brand voice', 'all', expect.any(Number));
  });

  it('switching scope and then searching passes the new scope to the hook', () => {
    render(<SemanticQuery />);
    fireEvent.click(screen.getByRole('button', { name: /^strategy$/i }));
    fireEvent.change(screen.getByPlaceholderText(/ask/i), {
      target: { value: 'roadmap' },
    });
    fireEvent.click(screen.getByRole('button', { name: /^search$/i }));
    expect(mockSearch).toHaveBeenCalledWith('roadmap', 'strategy', expect.any(Number));
  });

  it('shows a progress indicator while the hook is loading', () => {
    mockedHook.mockImplementationOnce(() => ({
      ...defaultHookState(),
      loading: true,
    }));
    render(<SemanticQuery />);
    expect(screen.getByRole('progressbar')).toBeTruthy();
  });

  it('shows the API error in an alert (never fabricates)', () => {
    mockedHook.mockImplementationOnce(() => ({
      ...defaultHookState(),
      error: 'embedding service unavailable',
    }));
    render(<SemanticQuery />);
    expect(screen.getByText(/embedding service unavailable/i)).toBeTruthy();
  });

  it('shows the honest "no matches" message when hits are empty', () => {
    mockedHook.mockImplementationOnce(() => ({
      ...defaultHookState(),
      results: { query: 'x', scope: 'all', hits: [] },
    }));
    render(<SemanticQuery />);
    expect(screen.getByText(/no matches in this scope/i)).toBeTruthy();
  });

  it('renders a hit with domain badge, kind label, score, and passage text', () => {
    mockedHook.mockImplementationOnce(() => ({
      ...defaultHookState(),
      results: {
        query: 'brand voice',
        scope: 'onboarding',
        hits: [
          {
            id: 'h1',
            domain: 'onboarding',
            kind: 'core_persona',
            kind_label: 'Core Persona',
            score: 0.82,
            text: 'Voice: warm, conversational.',
          },
        ],
      },
    }));
    render(<SemanticQuery />);
    expect(screen.getByText('Core Persona')).toBeTruthy();
    expect(screen.getByText('0.82')).toBeTruthy();
    expect(screen.getByText(/warm, conversational/i)).toBeTruthy();
  });
});