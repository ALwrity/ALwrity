/**
 * Phase 5: SifIndexHealthStrip — three mini-cards for the per-domain SIF status.
 *
 * Consumes the same BrandBrainDashboardPayload (no extra requests). Each card
 * derives a tone from the domain's indexing lifecycle + watermark; the
 * "Re-index SIF" action is rendered disabled (wiring deferred, §8.2).
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import SifIndexHealthStrip from '../SifIndexHealthStrip';
import type { BrandBrainDashboardPayload } from '../../../services/brandBrainApi';

const successPayload: BrandBrainDashboardPayload = {
  onboarding: {
    canonical_profile: {},
    sources: {},
    data_quality: {},
    onboarding_session: {},
    indexing: {
      status: 'success',
      phase: 'success',
      progress_pct: 100,
      last_success: '2026-01-01T00:00:00Z',
      index_freshness_hours: 5,
      index_stale: false,
    },
  },
  domains: {
    strategy: {
      indexing: { phase: 'success', status: 'success', progress_pct: 100 },
      watermark: { embedding_count: 8 },
    },
    calendar: {
      indexing: { phase: 'success', status: 'success', progress_pct: 100 },
      watermark: { embedding_count: 8 },
    },
  },
};

describe('SifIndexHealthStrip — Phase 5: three-domain status strip', () => {
  it('renders a card for every SIF domain (Onboarding, Strategy, Calendar)', () => {
    render(<SifIndexHealthStrip payload={successPayload} />);
    expect(screen.getByText('Onboarding')).toBeTruthy();
    expect(screen.getByText('Strategy')).toBeTruthy();
    expect(screen.getByText('Calendar')).toBeTruthy();
  });

  it('shows "indexed" status when every domain reports success', () => {
    render(<SifIndexHealthStrip payload={successPayload} />);
    expect(screen.getAllByText(/indexed/i).length).toBeGreaterThanOrEqual(3);
  });

  it('renders a disabled "Re-index SIF" button', () => {
    render(<SifIndexHealthStrip payload={successPayload} />);
    expect(screen.getByRole('button', { name: /re-index sif/i })).toBeDisabled();
  });

  it('shows failed status when a domain reports failure', () => {
    const payload: BrandBrainDashboardPayload = {
      ...successPayload,
      domains: {
        ...successPayload.domains,
        strategy: {
          indexing: { phase: 'failed', status: 'failed', progress_pct: 0 },
          watermark: { embedding_count: 0 },
        },
      },
    };
    render(<SifIndexHealthStrip payload={payload} />);
    expect(screen.getByText(/failed/i)).toBeTruthy();
  });

  it('shows "no active strategy" tone when the strategy domain has none', () => {
    const payload: BrandBrainDashboardPayload = {
      ...successPayload,
      domains: {
        ...successPayload.domains,
        strategy: {
          indexing: { phase: 'no_active_strategy', status: 'pending', progress_pct: 0 },
          watermark: { embedding_count: 0 },
        },
      },
    };
    render(<SifIndexHealthStrip payload={payload} />);
    expect(screen.getByText(/no active strategy/i)).toBeTruthy();
  });

  it('renders nothing when the payload is null', () => {
    const { container } = render(<SifIndexHealthStrip payload={null} />);
    expect(container.firstChild).toBeNull();
  });
});