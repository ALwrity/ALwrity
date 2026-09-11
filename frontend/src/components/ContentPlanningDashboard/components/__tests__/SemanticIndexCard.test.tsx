/**
 * Phase 2 — SemanticIndexCard render tests.
 *
 * The card surfaces the content-strategy semantic index in plain language
 * (no SIF jargon): pending (scheduled), running (background), success
 * (searchable by agents, with document count), skipped (unchanged), failed
 * (try re-activating, error surfaced), and no-active-strategy fallback. When
 * the endpoint errors the card renders nothing (graceful degradation).
 *
 * The hook (useStrategySifStatus) is mocked — polling behavior is covered by
 * the hook tests.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';

import SemanticIndexCard from '../SemanticIndexCard';
import { StrategySifStatus } from '../../../../hooks/useStrategySifStatus';

vi.mock('../../../../hooks/useStrategySifStatus', () => ({
  useStrategySifStatus: vi.fn(),
}));

import { useStrategySifStatus } from '../../../../hooks/useStrategySifStatus';

const mockUseStrategySifStatus = vi.mocked(useStrategySifStatus);

const indexing = (phase: string, over: Record<string, any> = {}) => ({
  activation: { strategy_id: 1, activated_at: '2026-01-01T00:00:00Z' },
  indexing: { phase, status: phase, embedding_count: 8, attempt: 1, ...over },
  watermark: { embedding_count: 8, indexed_at: '2026-01-01T00:00:01Z' },
  vfs_mirror: { exists: true },
  document_kinds: { names: ['Content strategy', 'Persona'], doc_ids: ['1', '2'], checked: false },
});

const hookState = (over: Partial<ReturnType<typeof useStrategySifStatus>> = {}) => ({
  data: null as StrategySifStatus | null,
  loading: false,
  error: null as string | null,
  refresh: vi.fn(),
  ...over,
});

describe('SemanticIndexCard — Phase 2: plain-language status card', () => {
  beforeEach(() => {
    mockUseStrategySifStatus.mockReset();
  });

  it('renders a loading spinner while the first status is in flight', () => {
    mockUseStrategySifStatus.mockReturnValue(hookState({ loading: true }));

    const { container } = render(<SemanticIndexCard />);
    expect(container.querySelector('.MuiCircularProgress-root')).toBeTruthy();
  });

  it('renders "scheduled" copy for pending', () => {
    mockUseStrategySifStatus.mockReturnValue(hookState({ data: indexing('pending') as any }));

    render(<SemanticIndexCard />);
    expect(screen.getByText('Indexing scheduled')).toBeTruthy();
    expect(screen.getByText(/scheduled to run in the background/i)).toBeTruthy();
  });

  it('renders "in progress" copy for running', () => {
    mockUseStrategySifStatus.mockReturnValue(hookState({ data: indexing('running') as any }));

    render(<SemanticIndexCard />);
    expect(screen.getByText(/In progress/i)).toBeTruthy();
  });

  it('renders success with the embedded document count', () => {
    mockUseStrategySifStatus.mockReturnValue(hookState({ data: indexing('success') as any }));

    render(<SemanticIndexCard />);
    expect(screen.getByText(/Indexed & searchable/i)).toBeTruthy();
    expect(screen.getByText(/8/i)).toBeTruthy();
  });

  it('renders "unchanged" copy for skipped (no re-embedding claim)', () => {
    mockUseStrategySifStatus.mockReturnValue(hookState({ data: indexing('skipped') as any }));

    render(<SemanticIndexCard />);
    expect(screen.getByText(/unchanged|no changes/i)).toBeTruthy();
  });

  it('renders the error message for failed with a re-activate hint', () => {
    mockUseStrategySifStatus.mockReturnValue(
      hookState({ data: indexing('failed', { error_message: 'embedding crashed' }) as any }),
    );

    render(<SemanticIndexCard />);
    // NB: the body uses a typographic apostrophe, so match the word parts.
    expect(screen.getByText(/couldn.t? be indexed/i)).toBeTruthy();
    expect(screen.getByText(/embedding crashed/i)).toBeTruthy();
    expect(screen.getByText(/re-activat/i)).toBeTruthy();
  });

  it('renders a no-active-strategy fallback', () => {
    mockUseStrategySifStatus.mockReturnValue(
      hookState({ data: indexing('no_active_strategy') as any }),
    );

    render(<SemanticIndexCard />);
    expect(screen.getByText(/activate a content strategy/i)).toBeTruthy();
  });

  it('renders a not-indexed fallback', () => {
    mockUseStrategySifStatus.mockReturnValue(hookState({ data: indexing('not_indexed') as any }));

    render(<SemanticIndexCard />);
    expect(screen.getByText(/not yet indexed/i)).toBeTruthy();
  });

  it('renders nothing when the endpoint errors (graceful degradation)', () => {
    mockUseStrategySifStatus.mockReturnValue(hookState({ error: 'network down' }));

    const { container } = render(<SemanticIndexCard />);
    expect(container.firstChild).toBeNull();
  });
});