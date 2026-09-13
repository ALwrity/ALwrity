import type { Mock } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { enterpriseSeoAPI } from '../enterpriseSeoApi';
import { llmInsightsGenerator } from '../llmInsightsGenerator';
import { apiClient } from '../client';

vi.mock('../client', () => ({
  apiClient: { get: vi.fn(), post: vi.fn() },
  longRunningApiClient: { get: vi.fn(), post: vi.fn() },
  aiApiClient: { get: vi.fn(), post: vi.fn() },
}));

// Verified against the live backend route table (backend/app.py, full mode).
// Every frontend SEO client path MUST be in this list — no /api/seo-tools/*.
const BACKEND_SEO_ROUTES = new Set([
  '/api/seo/enterprise/complete-audit',
  '/api/seo/enterprise/quick-audit',
  '/api/seo/enterprise/health',
  '/api/seo/gsc/analyze-search-performance',
  '/api/seo/gsc/content-opportunities',
  '/api/seo/llm/generate-audit-insights',
  '/api/seo/llm/generate-gsc-insights',
  '/api/seo/llm/generate-content-strategy',
  '/api/seo/llm/generate-traffic-roadmap',
  '/api/seo/llm/generate-competitive-insights',
  '/api/seo/llm/prioritized-recommendations',
  '/api/seo/llm/quick-wins',
  '/api/seo/llm/keyword-expansion',
]);

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = resolve(HERE, '../..');
const read = (rel: string) => readFileSync(resolve(SRC, rel), 'utf-8');
const postedPaths = (src: string): string[] =>
  [...src.matchAll(/\.post\('([^']+)'/g)].map((m) => m[1]);

describe('Phase 4 — frontend SEO clients match the backend contract', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('no stale /api/seo-tools/ paths in SEO clients', () => {
    for (const rel of ['api/enterpriseSeoApi.ts', 'api/llmInsightsGenerator.ts']) {
      expect(read(rel)).not.toMatch(/\/api\/seo-tools\//);
    }
  });

  it('every posted SEO path exists on the backend', () => {
    for (const rel of ['api/enterpriseSeoApi.ts', 'api/llmInsightsGenerator.ts']) {
      for (const p of postedPaths(read(rel))) {
        expect(BACKEND_SEO_ROUTES.has(p), `${rel} posts to unknown ${p}`).toBe(true);
      }
    }
  });

  it('quick audit posts JSON body to the fixed 1A endpoint', async () => {
    const { longRunningApiClient } = await import('../client');
    (longRunningApiClient.post as Mock).mockResolvedValue({ data: { ok: true } });
    await enterpriseSeoAPI.executeQuickAudit('https://example.com');
    expect(longRunningApiClient.post).toHaveBeenCalledWith(
      '/api/seo/enterprise/quick-audit',
      { website_url: 'https://example.com' },
    );
  });

  it('audit insights body matches EnterpriseAuditInsightsRequest', async () => {
    (apiClient.post as Mock).mockResolvedValue({ data: { ok: true } });
    await (llmInsightsGenerator as any).generateEnterpriseAuditInsights(
      {
        overall_score: 80,
        executive_summary: {
          overall_score: 80,
          estimated_traffic_potential: 'high',
          critical_issues: [],
          top_opportunities: [],
        },
      },
      'https://example.com',
    );
    expect(apiClient.post).toHaveBeenCalledWith(
      '/api/seo/llm/generate-audit-insights',
      expect.objectContaining({
        audit_results: expect.objectContaining({ overall_score: 80 }),
        website_url: 'https://example.com',
      }),
    );
  });

  it('content strategy body matches ContentStrategyRequest', async () => {
    (apiClient.post as Mock).mockResolvedValue({ data: { ok: true } });
    await (llmInsightsGenerator as any).generateContentStrategy({
      currentContent: { pages: 10 },
      contentGaps: ['pricing'],
      targetKeywords: ['seo tools'],
    });
    expect(apiClient.post).toHaveBeenCalledWith(
      '/api/seo/llm/generate-content-strategy',
      expect.objectContaining({
        current_content: { pages: 10 },
        content_gaps: ['pricing'],
        target_keywords: ['seo tools'],
      }),
    );
  });

  it('methods without backend routes are gone (defs, not comments)', () => {
    const src = read('api/llmInsightsGenerator.ts');
    expect(src).not.toMatch(/async generateContentOptimization\(/);
    expect(src).not.toMatch(/async generateTechnicalImprovementPlan\(/);
    const ent = read('api/enterpriseSeoApi.ts');
    expect(ent).not.toMatch(/async getTrafficImprovementStrategies\(/);
    expect(ent).not.toMatch(/async generateAuditInsights\(/);
    expect(ent).not.toMatch(/async generateGSCInsights\(/);
  });

  it('SEOCopilotTest playground is deleted (zero prod value)', () => {
    expect(existsSync(resolve(SRC, 'components/SEODashboard/SEOCopilotTest.tsx'))).toBe(false);
    expect(read('components/SEODashboard/index.ts')).not.toMatch(/SEOCopilotTest/);
  });
});
