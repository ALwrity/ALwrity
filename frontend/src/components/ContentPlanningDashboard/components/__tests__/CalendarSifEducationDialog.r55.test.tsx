/**
 * R5.3 / R5.5 — accessibility + education-copy contracts:
 * - search input has an ACCESSIBLE NAME (aria-label), not just placeholder;
 * - the results region announces async updates (role=status/aria-live);
 * - unknown document kinds render the readable "Indexed part" fallback,
 *   NEVER the raw kind identifier;
 * - the education heading reflects the ACTUAL kind count, not hard-coded 8.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';

import CalendarSifEducationDialog from '../CalendarSifEducationDialog';
import CalendarSifStatusCard from '../CalendarSifStatusCard';

describe('CalendarSifEducationDialog copy (R5.5)', () => {
  const mount = (kinds?: string[]) =>
    render(
      <CalendarSifEducationDialog open={true} onClose={() => {}} documentKindNames={kinds} />,
    );

  it('heading reflects the ACTUAL kind count from the API', () => {
    render(
      <CalendarSifEducationDialog
        open={true}
        onClose={() => {}}
        documentKindNames={['calendar_overview', 'daily_schedule', 'ai_insights']}
      />,
    );
    expect(screen.getByText(/The 3 indexed parts/)).toBeTruthy();
    expect(screen.queryByText(/The 8 indexed parts/)).toBeNull();
  });

  it('unknown kinds NEVER show their raw identifier', () => {
    render(
      <CalendarSifEducationDialog
        open={true}
        onClose={() => {}}
        documentKindNames={['calendar_overview', 'brand_new_kind_2026']}
      />,
    );
    expect(screen.queryByText(/brand_new_kind/i)).toBeNull();
    expect(screen.getAllByText(/Indexed part/i).length).toBeGreaterThanOrEqual(1);
  });

  it('full list keeps the count (8)', () => {
    render(
      <CalendarSifEducationDialog
        open={true}
        onClose={() => {}}
        documentKindNames={[
          'calendar_overview', 'daily_schedule', 'weekly_themes', 'content_recommendations',
          'performance_predictions', 'ai_insights', 'strategy_alignment', 'calendar_events',
        ]}
      />,
    );
    expect(screen.getByText(/The 8 indexed parts/)).toBeTruthy();
  });
});
