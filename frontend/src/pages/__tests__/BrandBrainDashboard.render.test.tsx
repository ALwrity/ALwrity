/**
 * BrandBrainDashboard — Phase 7: real-wiring page render.
 *
 * Unlike the Phase 6 mock test (which stubs every section), this test renders
 * the REAL Identity Overview, canonical profile viewer, quality strip, health
 * strip and semantic query against a mocked aggregate payload. It proves the
 * payload actually flows from the hook into the sections, that the sections
 * don't crash on a realistic payload, and that the honest "complete onboarding
 * first" empty state shows when onboarding is null. Only the flag, the
 * aggregate hook and HeaderControls are mocked.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { BrandBrainDashboardPayload } from '../../services/brandBrainApi';

const mockIsEnabled = vi.fn();

vi.mock('../../config/brandBrainConfig', () => ({
  isBrandBrainDashboardEnabled: (...args: unknown[]) => mockIsEnabled(...args),
}));

const mockedUseBrandBrainDashboard = vi.fn();

vi.mock('../../hooks/useBrandBrainDashboard', () => ({
  useBrandBrainDashboard: (...args: unknown[]) => mockedUseBrandBrainDashboard(...args),
}));

vi.mock('../../components/shared/HeaderControls', () => ({
  default: () => <div data-testid="header-controls">HEADER CONTROLS</div>,
}));

import BrandBrainDashboard from '../BrandBrainDashboard';

const samplePayload: BrandBrainDashboardPayload = {
  onboarding: {
    canonical_profile: {
      industry: 'B2B SaaS',
      target_audience: { demographics: 'Marketing leaders' },
    },
    sources: { industry: 'website_analysis' },
    data_quality: { overall_score: 0.8, quality_level: 'good', completeness: 0.9 },
    onboarding_session: { current_step: 6, progress: 100 },
    processing_timestamp: '2026-09-14T00:00:00',
    indexing: {
      phase: 'success',
      status: 'success',
      progress_pct: 100,
      index_freshness_hours: 2,
      index_stale: false,
    },
  },
  domains: {
    strategy: {
      indexing: { phase: 'success', status: 'success', embedding_count: 8 },
      watermark: { embedding_count: 8 },
    },
    calendar: {
      indexing: { phase: 'success', status: 'success', embedding_count: 8 },
      watermark: { embedding_count: 8 },
    },
  },
};

describe('BrandBrainDashboard — Phase 7 real wiring', () => {
  beforeEach(() => {
    mockIsEnabled.mockReset();
    mockedUseBrandBrainDashboard.mockReset();
  });

  it('flows a full aggregate payload into the real section components', () => {
    mockIsEnabled.mockReturnValue(true);
    mockedUseBrandBrainDashboard.mockReturnValue({
      data: samplePayload,
      loading: false,
      error: null,
      refresh: vi.fn(),
    });

    render(<BrandBrainDashboard />);

    // Identity Overview flows the canonical industry value into a card.
    expect(screen.getByText('B2B SaaS')).toBeTruthy();
    // Quality strip renders from data_quality.
    expect(screen.getByText('DATA QUALITY')).toBeTruthy();
    // Canonical profile viewer renders the raw SSOT header.
    expect(screen.getByText('RAW CANONICAL PROFILE')).toBeTruthy();
    // Health strip renders the disabled Re-index action (coming-soon surface).
    expect(screen.getByRole('button', { name: 'Re-index SIF' })).toBeTruthy();
    // Semantic query renders its live prompt surface.
    expect(screen.getByText('ASK YOUR BRAND BRAIN')).toBeTruthy();
    // Coming-soon strip renders alongside the sections.
    expect(screen.getByText('COMING SOON')).toBeTruthy();
  });

  it('renders the honest empty state when onboarding has not started', () => {
    mockIsEnabled.mockReturnValue(true);
    mockedUseBrandBrainDashboard.mockReturnValue({
      data: null,
      loading: false,
      error: null,
      refresh: vi.fn(),
    });

    render(<BrandBrainDashboard />);

    expect(
      screen.getByText('Complete onboarding first to build your Brand Brain.'),
    ).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Re-index SIF' })).toBeNull();
    expect(screen.queryByText('B2B SaaS')).toBeNull();
  });
});