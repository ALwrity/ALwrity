import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { render, screen } from '@testing-library/react';
import SEOAnalysisLoading from '../components/SEOAnalysisLoading';

const HERE = dirname(fileURLToPath(import.meta.url));
const dashSrc = () =>
  readFileSync(resolve(HERE, '../SEODashboard.tsx'), 'utf-8');
const controllerSrc = () =>
  readFileSync(resolve(HERE, '../SEOAnalysisController.tsx'), 'utf-8');

describe('Phase 3A — honest loading states', () => {
  it('dashboard never wipes the page while loading (header/tabs persist)', () => {
    expect(dashSrc()).not.toMatch(/if\s*\(loading\)\s*\{\s*return <Skeleton/);
  });

  it('dashboard shows per-card skeletons in content area while loading', () => {
    const src = dashSrc();
    expect(src).toMatch(/DashboardLoadingSkeleton/);
    // Unified flow (Phase D): no tab guard around the loading branch.
    expect(src).toMatch(/{\(loading \? \(\s*\n?\s*<DashboardLoadingSkeleton \/>/);
    expect(src).not.toMatch(/dashboardTab/);
  });

  it('controller derives progress from activeStep (no hard-coded jumps)', () => {
    const src = controllerSrc();
    expect(src).not.toMatch(/setProgress\((20|50|75|100)\)/);
    expect(src).toMatch(/activeStep\s*\*\s*25/);
  });

  it('analysis loading shows determinate % when progress is known', () => {
    render(<SEOAnalysisLoading loading progress={50} stage="GSC analysis" />);
    const bar = screen.getByRole('progressbar');
    expect(bar).toHaveAttribute('aria-valuenow', '50');
    expect(screen.getByText(/50%/)).toBeInTheDocument();
    expect(screen.getByText(/GSC analysis/)).toBeInTheDocument();
  });

  it('analysis loading stays indeterminate when progress is unknown', () => {
    render(<SEOAnalysisLoading loading />);
    const bar = screen.getByRole('progressbar');
    expect(bar).not.toHaveAttribute('aria-valuenow');
  });

  it('analysis loading renders nothing when not loading', () => {
    const { container } = render(<SEOAnalysisLoading loading={false} />);
    expect(container).toBeEmptyDOMElement();
  });
});
