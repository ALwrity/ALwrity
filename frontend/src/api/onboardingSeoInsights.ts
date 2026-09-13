import { apiClient } from './client';

/**
 * Phase 12 (plan Phase C) — frontend client for SEO-informed onboarding.
 *
 * - persistOnPageAudit: runs the on-page audit AND persists it into the
 *   user's SEO SSOT (website_analyses.seo_audit['on_page_audit']), unlike the
 *   older volatile /api/seo/on-page-analysis call.
 * - requestGscSnapshot: derives + persists the post-GSC-connect snapshot
 *   (striking distance / low CTR) — best-effort after OAuth success.
 * - getPrefill: onboarding content pillars + site URL for prefill.
 */
export interface SeoPrefill {
  website_url: string;
  keywords: string[];
  source: string;
}

export const onboardingSeoInsightsApi = {
  async persistOnPageAudit(websiteUrl: string, targetKeywords?: string[]) {
    const response = await apiClient.post('/api/onboarding/seo-insights/on-page-audit', {
      website_url: websiteUrl,
      target_keywords: targetKeywords || [],
    });
    return response.data;
  },

  async requestGscSnapshot(siteUrl: string, dateRangeDays = 90) {
    const response = await apiClient.post('/api/onboarding/seo-insights/gsc-snapshot', {
      site_url: siteUrl,
      date_range_days: dateRangeDays,
    });
    return response.data;
  },

  async getPrefill(): Promise<SeoPrefill> {
    const response = await apiClient.get('/api/onboarding/seo-insights/prefill');
    return response.data;
  },
};

export default onboardingSeoInsightsApi;
