/**
 * Phase D — CalendarSifStatusCard preset-query interaction tests.
 *
 * When the calendar is actually searchable (phase success or skipped
 * with embedding_count > 0) the card shows a "Try a semantic search"
 * panel with preset questions. Clicking one calls
 * contentPlanningApi.searchCalendarSif() and renders the matching
 * calendar passages (kind label, score, text). The panel is hidden
 * for any non-indexed phase, and errors/empty results degrade to
 * guidance text. Mirrors SemanticIndexCard.queries tests.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';

import CalendarSifStatusCard from '../CalendarSifStatusCard';

vi.mock('../../../hooks/useCalendarSifStatus', () => ({
  useCalendarSifStatus: vi.fn(),
}));

vi.mock('../../../services/contentPlanningApi', () => ({
  contentPlanningApi: {
    searchCalendarSif: vi.fn(),
  },
}));

vi.mock('../../../config/strategySifConfig', () => ({
  isCalendarSifCardEnabled: () => true,
}));

import { useCalendarSifStatus } from '../../../hooks/useCalendarSifStatus';
import { contentPlanningApi } from '../../../services/contentPlanningApi';

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

const hookState = (over: any = {}) => ({
  data: null as any,
  loading: false,
  error: null as string | null,
  refresh: vi.fn(),
  ...over,
});

describe('CalendarSifStatusCard — preset semantic queries', () => {
  beforeEach(() => {
    mockUseCalendarSifStatus.mockReset();
    mockSearchCalendarSif.mockReset();
    mockSearchCalendarSif.mockResolvedValue({ query: 'q', hits: [] });
  });

  it('renders the query panel when the calendar is searchable (success)', () => {
    mockUseCalendarSifStatus.mockReturnValue(hookState({ data: indexing('success') }));

    render(<CalendarSifStatusCard />);
    expect(screen.getByText('Try a semantic search')).toBeTruthy();
    expect(screen.getByText('Ask your calendar, e.g. what events are next week?')).toBeTruthy();
  });

  it('calls searchCalendarSif when clicking a preset chip', () => {
    mockUseCalendarSifStatus.mockReturnValue(hookState({ data: indexing('success') }));

    render(<CalendarSifStatusCard />);
    const chip = screen.getByText("What's in my calendar this month?");
    fireEvent.click(chip);

    expect(mockSearchCalendarSif).toHaveBeenCalledTimes(1);
    expect(mockSearchCalendarSif).toHaveBeenCalledWith("What's in my calendar this month?", 4);
  });

  it('calls searchCalendarSif when pressing Enter in the input', () => {
    mockUseCalendarSifStatus.mockReturnValue(hookState({ data: indexing('success') }));

    render(<CalendarSifStatusCard />);
    const input = screen.getByTestId('calendar-sif-question-input');
    fireEvent.change(input, { target: { value: 'my calendar' } });
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });

    expect(mockSearchCalendarSif).toHaveBeenCalledTimes(1);
    expect(mockSearchCalendarSif).toHaveBeenCalledWith('my calendar', 4);
  });

  it('renders search results with kind labels and scores', async () => {
    mockUseCalendarSifStatus.mockReturnValue(hookState({ data: indexing('success') }));
    mockSearchCalendarSif.mockResolvedValue({
      query: 'events',
      hits: [
        { id: 'd1', kind: 'daily_schedule', kind_label: 'Daily schedule', score: 0.92, text: 'detail' },
        { id: 'd2', kind: 'calendar_events', kind_label: 'Calendar events', score: 0.77, text: 'detail2' },
      ],
    });

    render(<CalendarSifStatusCard />);
    const chip = screen.getByText('What events are scheduled?');
    fireEvent.click(chip);

    expect(mockSearchCalendarSif).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Daily schedule')).toBeTruthy();
    expect(screen.getByText('Calendar events')).toBeTruthy();
    expect(screen.getByText('score 0.920')).toBeTruthy();
  });

  it('shows empty-state guidance when no results', async () => {
    mockUseCalendarSifStatus.mockReturnValue(hookState({ data: indexing('success') }));
    mockSearchCalendarSif.mockResolvedValue({ query: 'q', hits: [] });

    render(<CalendarSifStatusCard />);
    const chip = screen.getByText('What events are scheduled?');
    fireEvent.click(chip);

    expect(screen.getByText(/No matching passage found/i)).toBeTruthy();
  });

  it('shows error text when search fails', async () => {
    mockUseCalendarSifStatus.mockReturnValue(hookState({ data: indexing('success') }));
    mockSearchCalendarSif.mockRejectedValue(new Error('search failed'));

    render(<CalendarSifStatusCard />);
    const chip = screen.getByText('What events are scheduled?');
    fireEvent.click(chip);

    expect(screen.getByText('search failed')).toBeTruthy();
  });

  it('hides the query panel for not_indexed phase', () => {
    mockUseCalendarSifStatus.mockReturnValue(hookState({ data: indexing('not_indexed') }));

    render(<CalendarSifStatusCard />);
    expect(screen.queryByText('Try a semantic search')).toBeNull();
  });

  it('shows the education dialog trigger', () => {
    mockUseCalendarSifStatus.mockReturnValue(hookState({ data: indexing('success') }));

    render(<CalendarSifStatusCard />);
    expect(screen.getByText('Learn how the index works')).toBeTruthy();
  });
});
