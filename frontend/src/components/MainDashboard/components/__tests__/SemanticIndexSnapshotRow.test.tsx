/**
 * Phase 3 — SemanticIndexSnapshotRow render tests.
 *
 * A compact, plain-language status row for the Main Dashboard snapshot that
 * surfaces the content-strategy semantic index. Mirrors the plain-language
 * copy of the Phase 2 card, but as a single lightweight row. On error it
 * renders nothing (graceful degradation).
 *
 * The hook (useStrategySifStatus) is mocked — polling behavior is covered by
 * the hook tests.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';

import SemanticIndexSnapshotRow from '../SemanticIndexSnapshotRow';
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
  document_kinds: { names: ['Content strategy'], doc_ids: ['1'], checked: false },
});

const hookState = (over: Partial<ReturnType<typeof useStrategySifStatus>> = {}) => ({
  data: null as StrategySifStatus | null,
  loading: false,
  error: null as string | null,
  refresh: vi.fn(),
  ...over,
});

describe('SemanticIndexSnapshotRow — Phase 3: dashboard snapshot row', () => {
  beforeEach(() => {
    mockUseStrategySifStatus.mockReset();
  });

  it('renders a loading state while the first status is in flight', () => {
    mockUseStrategySifStatus.mockReturnValue(hookState({ loading: true }));

    const { container } = render(<SemanticIndexSnapshotRow />);
    expect(container.querySelector('.MuiCircularProgress-root')).toBeTruthy();
  });

  it('renders "scheduled" copy for pending', () => {
    mockUseStrategySifStatus.mockReturnValue(hookState({ data: indexing('pending') as any }));

    render(<SemanticIndexSnapshotRow />);
    expect(screen.getByText(/Indexing scheduled/i)).toBeTruthy();
    expect(screen.getByText(/runs? in the background/i)).toBeTruthy();
  });

  it('renders "in progress" copy for running', () => {
    mockUseStrategySifStatus.mockReturnValue(hookState({ data: indexing('running') as any }));

    render(<SemanticIndexSnapshotRow />);
    expect(screen.getByText(/Indexing in progress/i)).toBeTruthy();
  });

  it('renders success with the embedded document count', () => {
    mockUseStrategySifStatus.mockReturnValue(hookState({ data: indexing('success') as any }));

    render(<SemanticIndexSnapshotRow />);
    expect(screen.getByText(/Indexed & searchable/i)).toBeTruthy();
    expect(screen.getByText(/8/i)).toBeTruthy();
  });

  it('renders "unchanged" copy for skipped', () => {
    mockUseStrategySifStatus.mockReturnValue(hookState({ data: indexing('skipped') as any }));

    render(<SemanticIndexSnapshotRow />);
    expect(screen.getByText(/No changes to index/i)).toBeTruthy();
  });

  it('renders a re-activate hint for not_indexed', () => {
    mockUseStrategySifStatus.mockReturnValue(hookState({ data: indexing('not_indexed') as any }));

    render(<SemanticIndexSnapshotRow />);
    expect(screen.getByText(/Not yet indexed/i)).toBeTruthy();
  });

  it('renders a failed state opportunistically without jargon', () => {
    mockUseStrategySifStatus.mockReturnValue(
      hookState({ data: indexing('failed', { error_message: 'embedding crashed' }) as any }),
    );

    render(<SemanticIndexSnapshotRow />);
    expect(screen.getByText(/needs attention/i)).toBeTruthy();
  });

  it('renders nothing when the endpoint errors (graceful degradation)', () => {
    mockUseStrategySifStatus.mockReturnValue(hookState({ error: 'network down' }));

    const { container } = render(<SemanticIndexSnapshotRow />);
    expect(container.firstChild).toBeNull();
  });
});