/**
 * BrandBrainDashboard — Phase 6: feature-flag dispatch (disabled state).
 *
 * When `isBrandBrainDashboardEnabled()` is false the page must soft-disable:
 * render a terminal warning alert, render NO section components, and still
 * call `useBrandBrainDashboard(false)` (hooks rules stay satisfied — the hook
 * skips the fetch). When enabled, the section components render normally and
 * the hook receives `true`. Config + hook + section components are mocked.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

const mockIsEnabled = vi.fn();

vi.mock('../../config/brandBrainConfig', () => ({
  isBrandBrainDashboardEnabled: (...args: unknown[]) => mockIsEnabled(...args),
}));

const mockedUseBrandBrainDashboard = vi.fn();

vi.mock('../../hooks/useBrandBrainDashboard', () => ({
  useBrandBrainDashboard: (...args: unknown[]) => mockedUseBrandBrainDashboard(...args),
}));

vi.mock('../../components/BrandBrainDashboard/IdentityOverview', () => ({
  default: () => <div data-testid="identity-overview">IDENTITY OVERVIEW</div>,
}));

vi.mock('../../components/BrandBrainDashboard/CanonicalProfileView', () => ({
  default: () => <div data-testid="canonical-profile-view">CANONICAL PROFILE</div>,
}));

vi.mock('../../components/BrandBrainDashboard/SifIndexHealthStrip', () => ({
  default: () => <div data-testid="sif-health-strip">SIF HEALTH</div>,
}));

vi.mock('../../components/BrandBrainDashboard/SemanticQuery', () => ({
  default: () => <div data-testid="semantic-query">SEMANTIC QUERY</div>,
}));

vi.mock('../../components/shared/HeaderControls', () => ({
  default: () => <div data-testid="header-controls">HEADER CONTROLS</div>,
}));

import BrandBrainDashboard from '../BrandBrainDashboard';

const idleHookState = {
  data: null,
  loading: false,
  error: null,
  refresh: vi.fn(),
};

describe('BrandBrainDashboard — Phase 6: feature-flag dispatch', () => {
  beforeEach(() => {
    mockIsEnabled.mockReset();
    mockedUseBrandBrainDashboard.mockReset();
    mockedUseBrandBrainDashboard.mockReturnValue(idleHookState);
  });

  it('renders a disabled alert and no sections when the flag is off', () => {
    mockIsEnabled.mockReturnValue(false);

    render(<BrandBrainDashboard />);

    expect(screen.getByText(/currently disabled/i)).toBeTruthy();
    expect(mockedUseBrandBrainDashboard).toHaveBeenCalledWith(false);
    expect(screen.queryByTestId('identity-overview')).toBeNull();
    expect(screen.queryByTestId('canonical-profile-view')).toBeNull();
    expect(screen.queryByTestId('sif-health-strip')).toBeNull();
    expect(screen.queryByTestId('semantic-query')).toBeNull();
    expect(screen.queryByText('COMING SOON')).toBeNull();
  });

  it('renders the sections and drives the hook when the flag is on', () => {
    mockIsEnabled.mockReturnValue(true);

    render(<BrandBrainDashboard />);

    expect(screen.queryByText(/currently disabled/i)).toBeNull();
    expect(mockedUseBrandBrainDashboard).toHaveBeenCalledWith(true);
    expect(screen.getByTestId('identity-overview')).toBeTruthy();
    expect(screen.getByTestId('canonical-profile-view')).toBeTruthy();
    expect(screen.getByTestId('sif-health-strip')).toBeTruthy();
    expect(screen.getByTestId('semantic-query')).toBeTruthy();
    expect(screen.getByText('COMING SOON')).toBeTruthy();
  });
});