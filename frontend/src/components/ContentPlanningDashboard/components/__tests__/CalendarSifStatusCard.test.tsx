/**
 * Phase D — CalendarSifStatusCard render tests.
 *
 * The card surfaces the calendar semantic index in plain language:
 * pending (scheduled), running (background), success (searchable),
 * skipped (unchanged), failed (error surfaced), and not_indexed
 * fallback. When the endpoint errors the card renders nothing.
 *
 * The hook (useCalendarSifStatus) and API (contentPlanningApi.searchCalendarSif)
 * are mocked — polling behavior is covered by the hook tests.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';

import CalendarSifStatusCard from '../CalendarSifStatusCard';
import { CalendarSifStatus } from '../../../../hooks/useCalendarSifStatus';

vi.mock('../../../../hooks/useCalendarSifStatus', () => ({
  useCalendarSifStatus: vi.fn(),
}));

vi.mock('../../../../services/contentPlanningApi', () => ({
  contentPlanningApi: {
    searchCalendarSif: vi.fn(),
  },
}));

vi.mock('../../../../config/strategySifConfig', () => ({
  isCalendarSifCardEnabled: () => true,
}));

import { useCalendarSifStatus } from '../../../../hooks/useCalendarSifStatus';
import { contentPlanningApi } from '../../../../services/contentPlanningApi';

const mockUseCalendarSifStatus = vi.mocked(useCalendarSifStatus);
const mockSearchCalendarSif = vi.mocked(contentPlanningApi.searchCalendarSif);

const indexing = (phase: string, over: Record<string, any> = {}) => ({
  indexing: { phase, status: phase, embedding_count: 8, attempt: 1, ...over },
  watermark: { embedding_count: 8, indexed_at: '2026-01-01T00:00:01Z' },
  document_kinds: {
    names: [
      'calendar_overview', 'daily_schedule', 'weekly_themes',
      'content_recommendations', 'performance_predictions',
      'ai_insights', 'strategy_alignment', 'calendar_events',
    ],
    doc_ids: Array(8).fill('d'),
    count: 8,
  },
});

const hookState = (over: Partial<ReturnType<typeof useCalendarSifStatus>> = {}) => ({
  data: null as CalendarSifStatus | null,
  loading: false,
  refreshing: false,
  error: null as string | null,
  refresh: vi.fn(),
  ...over,
});

describe('CalendarSifStatusCard — plain-language status card', () => {
  beforeEach(() => {
    mockUseCalendarSifStatus.mockReset();
    mockSearchCalendarSif.mockReset();
  });

  it('renders a loading spinner while the first status is in flight', () => {
    mockUseCalendarSifStatus.mockReturnValue(hookState({ loading: true }));

    const { container } = render(<CalendarSifStatusCard />);
    expect(container.querySelector('.MuiCircularProgress-root')).toBeTruthy();
  });

  it('renders "Indexing scheduled" copy for pending', () => {
    mockUseCalendarSifStatus.mockReturnValue(hookState({ data: indexing('pending') as any }));

    render(<CalendarSifStatusCard />);
    expect(screen.getByText('Indexing scheduled')).toBeTruthy();
  });

  it('renders "Indexing in progress" copy for running', () => {
    mockUseCalendarSifStatus.mockReturnValue(hookState({ data: indexing('running') as any }));

    render(<CalendarSifStatusCard />);
    expect(screen.getByText(/In progress/i)).toBeTruthy();
  });

  it('renders success with the embedded document count', () => {
    mockUseCalendarSifStatus.mockReturnValue(hookState({ data: indexing('success') as any }));

    render(<CalendarSifStatusCard />);
    expect(screen.getByText(/Indexed & searchable/i)).toBeTruthy();
    expect(screen.getByText(/8/)).toBeTruthy();
  });

  it('renders "No changes to index" copy for skipped', () => {
    mockUseCalendarSifStatus.mockReturnValue(hookState({ data: indexing('skipped') as any }));

    render(<CalendarSifStatusCard />);
    expect(screen.getByText(/unchanged|no changes/i)).toBeTruthy();
  });

  it('renders the error message for failed with a retry hint', () => {
    mockUseCalendarSifStatus.mockReturnValue(
      hookState({ data: indexing('failed', { error_message: 'embedding crashed' }) as any }),
    );

    render(<CalendarSifStatusCard />);
    expect(screen.getByText(/couldn.t? be indexed/i)).toBeTruthy();
    expect(screen.getByText(/embedding crashed/i)).toBeTruthy();
    expect(screen.getByText(/regenerating/i)).toBeTruthy();
  });

  it('renders a not-indexed fallback', () => {
    mockUseCalendarSifStatus.mockReturnValue(hookState({ data: indexing('not_indexed') as any }));

    render(<CalendarSifStatusCard />);
    expect(screen.getByText(/not yet indexed/i)).toBeTruthy();
  });

  it('renders nothing when the endpoint errors (graceful degradation)', () => {
    mockUseCalendarSifStatus.mockReturnValue(hookState({ error: 'network down' }));

    const { container } = render(<CalendarSifStatusCard />);
    expect(container.firstChild).toBeNull();
  });
});
