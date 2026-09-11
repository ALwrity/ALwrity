/**
 * Phase SIF-Search — SemanticIndexCard preset-query interaction tests.
 *
 * When the active strategy is actually searchable (phase success or skipped
 * with embedding_count > 0) the card shows a "Try a semantic search" panel
 * with preset questions. Clicking one calls
 * contentPlanningApi.searchStrategySif() and renders the matching strategy
 * passages (kind label, score, text). The panel is hidden for any
 * non-indexed phase, and errors/empty results degrade to guidance text.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

import SemanticIndexCard from '../SemanticIndexCard';

vi.mock('../../../../hooks/useStrategySifStatus', () => ({
  useStrategySifStatus: vi.fn(),
}));

vi.mock('../../../../services/contentPlanningApi', () => ({
  contentPlanningApi: {
    searchStrategySif: vi.fn(),
  },
}));

import { useStrategySifStatus } from '../../../../hooks/useStrategySifStatus';
import { contentPlanningApi } from '../../../../services/contentPlanningApi';

const mockUseStrategySifStatus = vi.mocked(useStrategySifStatus);
const mockSearchStrategySif = vi.mocked(contentPlanningApi.searchStrategySif);

const indexing = (phase: string, over: Record<string, any> = {}) => ({
  activation: { strategy_id: 1, activated_at: '2026-01-01T00:00:00Z' },
  indexing: { phase, status: phase, embedding_count: 8, attempt: 1, ...over },
  watermark: { embedding_count: 8, indexed_at: '2026-01-01T00:00:01Z' },
  vfs_mirror: { exists: true },
  document_kinds: { names: ['Content strategy', 'Persona'], doc_ids: ['1', '2'], checked: false },
});

const hookState = (over: any = {}) => ({
  data: null as any,
  loading: false,
  error: null as string | null,
  refresh: vi.fn(),
  ...over,
});

describe('SemanticIndexCard — preset semantic queries', () => {
  beforeEach(() => {
    mockUseStrategySifStatus.mockReset();
    mockSearchStrategySif.mockReset();
    mockSearchStrategySif.mockResolvedValue({ query: 'q', hits: [] });
  });

  it('renders the query panel when the strategy is searchable (success)', () => {
    mockUseStrategySifStatus.mockReturnValue(hookState({ data: indexing('success') }));

    render(<SemanticIndexCard />);
    expect(screen.getByTestId('semantic-try-queries')).toBeInTheDocument();
    expect(screen.getByText('Try a semantic search')).toBeInTheDocument();
    expect(screen.getAllByTestId('semantic-query-chip').length).toBeGreaterThanOrEqual(5);
  });

  it('renders the query panel for skipped (unchanged but still searchable)', () => {
    mockUseStrategySifStatus.mockReturnValue(hookState({ data: indexing('skipped') }));

    render(<SemanticIndexCard />);
    expect(screen.getByTestId('semantic-try-queries')).toBeInTheDocument();
  });

  it.each(['pending', 'running', 'failed', 'not_indexed', 'no_active_strategy'])(
    'hides the query panel for %s',
    (phase) => {
      mockUseStrategySifStatus.mockReturnValue(
        hookState({ data: indexing(phase, phase === 'running' ? { embedding_count: 0 } : {}) }),
      );

      render(<SemanticIndexCard />);
      expect(screen.queryByTestId('semantic-try-queries')).not.toBeInTheDocument();
    },
  );

  it('clicking a chip calls searchStrategySif with that query', async () => {
    mockUseStrategySifStatus.mockReturnValue(hookState({ data: indexing('success') }));

    render(<SemanticIndexCard />);
    await userEvent.click(screen.getByText('What are the business objectives?'));

    await waitFor(() => {
      expect(mockSearchStrategySif).toHaveBeenCalledWith('What are the business objectives?', 4);
    });
  });

  it('renders the retrieved strategy passages with kind label, score and text', async () => {
    mockUseStrategySifStatus.mockReturnValue(hookState({ data: indexing('success') }));
    mockSearchStrategySif.mockResolvedValue({
      query: 'objectives',
      hits: [
        {
          id: 'user:42:strategy_active:current:form_summary',
          kind: 'form_summary',
          kind_label: 'Strategy summary',
          score: 0.921,
          text: 'business_objectives: grow organic revenue 30% this year.',
        },
      ],
    });

    render(<SemanticIndexCard />);
    await userEvent.click(screen.getByText('What are the business objectives?'));

    expect(await screen.findByTestId('semantic-search-hit')).toBeInTheDocument();
    expect(screen.getByText('Strategy summary')).toBeInTheDocument();
    expect(screen.getByText(/grow organic revenue 30%/)).toBeInTheDocument();
  });

  it('pretty-prints JSON chunks instead of raw text', async () => {
    mockUseStrategySifStatus.mockReturnValue(hookState({ data: indexing('success') }));
    mockSearchStrategySif.mockResolvedValue({
      query: 'roadmap',
      hits: [
        {
          id: 'user:42:strategy_active:current:implementation_roadmap',
          kind: 'implementation_roadmap',
          kind_label: 'Implementation roadmap',
          score: 0.336,
          text: '{"phases":[{"phase":"Phase 1","tasks":["a","b"]}]}',
        },
      ],
    });

    render(<SemanticIndexCard />);
    await userEvent.click(screen.getByText('What does the implementation roadmap look like?'));

    const pre = await screen.findByTestId('semantic-passage-json');
    expect(pre.textContent).toContain('"phases"');
    expect(pre.textContent).toContain('"Phase 1"');
    expect(pre.textContent).not.toContain('{"phases"');
  });

  it('renders key-value passages as labeled rows, dropping empty values', async () => {
    mockUseStrategySifStatus.mockReturnValue(hookState({ data: indexing('success') }));
    mockSearchStrategySif.mockResolvedValue({
      query: 'objectives',
      hits: [
        {
          id: 'user:42:strategy_active:current:form_summary',
          kind: 'form_summary',
          kind_label: 'Strategy summary',
          score: 0.334,
          text: 'name: Enhanced Content Strategy\nindustry: technology\nbusiness_objectives:\ntarget_metrics:',
        },
      ],
    });

    render(<SemanticIndexCard />);
    await userEvent.click(screen.getByText('What are the business objectives?'));

    const kv = await screen.findByTestId('semantic-passage-kv');
    expect(kv).toHaveTextContent('name:');
    expect(kv).toHaveTextContent('Enhanced Content Strategy');
    expect(kv).toHaveTextContent('industry:');
    expect(kv).toHaveTextContent('technology');
    expect(kv).not.toHaveTextContent('business_objectives');
    expect(kv).not.toHaveTextContent('target_metrics');
  });

  it('shows a guidance message when no passage matches', async () => {
    mockUseStrategySifStatus.mockReturnValue(hookState({ data: indexing('success') }));
    mockSearchStrategySif.mockResolvedValue({ query: 'goals', hits: [] });

    render(<SemanticIndexCard />);
    await userEvent.click(screen.getByText('What are the business objectives?'));

    expect(await screen.findByTestId('semantic-search-empty')).toBeInTheDocument();
  });

  it('lets the user type a question and asks SIF directly', async () => {
    mockUseStrategySifStatus.mockReturnValue(hookState({ data: indexing('success') }));
    mockSearchStrategySif.mockResolvedValue({ query: 'custom', hits: [] });

    render(<SemanticIndexCard />);
    const input = screen.getByTestId('semantic-question-input');
    fireEvent.change(input, { target: { value: 'What risks did the strategy identify?' } });
    await waitFor(() => expect(screen.getByTestId('semantic-ask-button')).toBeEnabled());
    await userEvent.click(screen.getByTestId('semantic-ask-button'));

    await waitFor(() => {
      expect(mockSearchStrategySif).toHaveBeenCalledWith('What risks did the strategy identify?', 4);
    });
  });

  it('submits the typed question on Enter', async () => {
    mockUseStrategySifStatus.mockReturnValue(hookState({ data: indexing('success') }));
    mockSearchStrategySif.mockResolvedValue({ query: 'custom', hits: [] });

    render(<SemanticIndexCard />);
    const input = screen.getByTestId('semantic-question-input');
    fireEvent.change(input, { target: { value: 'Summarize the risk assessment' } });
    await waitFor(() => expect(screen.getByTestId('semantic-ask-button')).toBeEnabled());
    fireEvent.keyDown(input, { key: 'Enter' });

    await waitFor(() => {
      expect(mockSearchStrategySif).toHaveBeenCalledWith('Summarize the risk assessment', 4);
    });
  });

  it('ignores empty typed questions', async () => {
    mockUseStrategySifStatus.mockReturnValue(hookState({ data: indexing('success') }));
    mockSearchStrategySif.mockResolvedValue({ query: 'custom', hits: [] });

    render(<SemanticIndexCard />);
    const input = screen.getByTestId('semantic-question-input');
    fireEvent.change(input, { target: { value: '   ' } });
    await waitFor(() => expect(input).not.toBeDisabled());
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(mockSearchStrategySif).not.toHaveBeenCalled();
  });

  it('surfaces a readable error when the search fails', async () => {
    mockUseStrategySifStatus.mockReturnValue(hookState({ data: indexing('success') }));
    mockSearchStrategySif.mockRejectedValue(new Error('backend down'));

    render(<SemanticIndexCard />);
    await userEvent.click(screen.getByText('What are the business objectives?'));

    expect(await screen.findByTestId('semantic-search-error')).toHaveTextContent(/backend down|unavailable/i);
  });
});