import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const HERE = dirname(fileURLToPath(import.meta.url));

const dashboardSrc = () =>
  readFileSync(resolve(HERE, '../SEODashboard.tsx'), 'utf-8');
const storeSrc = () =>
  readFileSync(
    resolve(HERE, '../../../stores/seoDashboardStore.ts'),
    'utf-8',
  );

describe('Phase 1E — no mock fallbacks hiding outages', () => {
  it('SEODashboard shows error state instead of mock health_score:84', () => {
    const src = dashboardSrc();
    expect(src).not.toMatch(/score:\s*84/);
    expect(src).not.toMatch(/value:\s*12500/);
    expect(src).not.toMatch(/Fallback to mock data/);
  });

  it('SEODashboard never defaults to alwrity.com as the user site', () => {
    const src = dashboardSrc();
    expect(src).not.toMatch(/https:\/\/alwrity\.com/);
  });

  it('SEODashboard surfaces fetch failures via setError', () => {
    const src = dashboardSrc();
    expect(src).toMatch(/setError\(/);
  });

  it('store never analyzes example.com as a fallback URL', () => {
    const src = storeSrc();
    expect(src).not.toMatch(/https:\/\/example\.com/);
  });
});
