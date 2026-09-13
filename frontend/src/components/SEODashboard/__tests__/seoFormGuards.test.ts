import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { parseCommaList, parseDateRangeDays } from '../seoFormParsers';

const HERE = dirname(fileURLToPath(import.meta.url));
const controllerSrc = () =>
  readFileSync(resolve(HERE, '../SEOAnalysisController.tsx'), 'utf-8');
const panelSrc = () =>
  readFileSync(resolve(HERE, '../components/SEOAnalyzerPanel.tsx'), 'utf-8');
const dashSrc = () =>
  readFileSync(resolve(HERE, '../SEODashboard.tsx'), 'utf-8');

describe('Phase 3D — form parser guards', () => {
  it('drops empty entries from comma lists', () => {
    expect(parseCommaList('a, ,b,, ')).toEqual(['a', 'b']);
    expect(parseCommaList('')).toEqual([]);
    expect(parseCommaList('  ')).toEqual([]);
    expect(parseCommaList('x')).toEqual(['x']);
  });

  it('clamps and defaults the GSC day range (NaN-safe)', () => {
    expect(parseDateRangeDays('')).toBe(90);
    expect(parseDateRangeDays('abc')).toBe(90);
    expect(parseDateRangeDays('3')).toBe(7);
    expect(parseDateRangeDays('500')).toBe(365);
    expect(parseDateRangeDays('30')).toBe(30);
  });

  it('controller uses the guarded parsers (no raw split/parseInt)', () => {
    const src = controllerSrc();
    expect(src).toMatch(/parseCommaList/);
    expect(src).toMatch(/parseDateRangeDays/);
    expect(src).not.toMatch(/\.split\(','\)\.map/);
    expect(src).not.toMatch(/parseInt\(e\.target\.value\)/);
  });

  it('analyzer panel has no dead permanently-disabled buttons', () => {
    expect(panelSrc()).not.toMatch(/Index Entire Website/);
  });

  it('dashboard back navigates client-side to /dashboard (no self reload)', () => {
    const src = dashSrc();
    expect(src).not.toMatch(/window\.location\.href = '\/seo-dashboard'/);
    expect(src).toMatch(/navigate\('\/dashboard'\)/);
  });
});
