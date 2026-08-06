import type { PlatformAnalytics as PlatformAnalyticsType, AnalyticsSummary } from '../../api/analytics';

interface SummaryDisplay {
  clicks: number;
  impressions: number;
  label: string;
  na: boolean;
}

export const deriveSummaryDisplay = (
  analyticsData: Record<string, PlatformAnalyticsType>,
  priorityPlatform: 'auto' | 'gsc' | 'bing',
  summary: AnalyticsSummary | null,
): SummaryDisplay => {
  const gsc = analyticsData['gsc'];
  const bing = analyticsData['bing'];
  const isGscOk = gsc && (gsc.status === 'success' || gsc.status === 'partial');
  const isBingOk = bing && (bing.status === 'success' || bing.status === 'partial');
  const anyPlatformOk = isGscOk || isBingOk;

  const sumFromTopPages = (metrics?: any) => {
    const pages = Array.isArray(metrics?.top_pages) ? metrics.top_pages : [];
    if (!pages.length) return { clicks: 0, impressions: 0 };
    let clicks = 0;
    let impressions = 0;
    for (const row of pages) {
      clicks += Number(row?.clicks || 0);
      impressions += Number(row?.impressions || 0);
    }
    return { clicks, impressions };
  };

  const pick = (m?: any) => ({
    clicks: Number(m?.total_clicks || 0),
    impressions: Number(m?.total_impressions || 0),
  });

  if (priorityPlatform === 'auto') {
    if (isGscOk) {
      let g = pick((gsc as any)?.metrics);
      if (g.clicks === 0) {
        const fromPages = sumFromTopPages((gsc as any)?.metrics);
        if (fromPages.clicks > 0) {
          g = { clicks: fromPages.clicks, impressions: g.impressions || fromPages.impressions };
        }
      }
      return { clicks: g.clicks, impressions: g.impressions, label: 'GSC (Auto)', na: false };
    }
    if (summary) {
      const clicks = Number(summary.total_clicks || 0);
      const impressions = Number(summary.total_impressions || 0);
      return { clicks, impressions, label: 'Combined', na: !anyPlatformOk && clicks === 0 && impressions === 0 };
    }
    return { clicks: 0, impressions: 0, label: 'Combined', na: !anyPlatformOk };
  }

  if (priorityPlatform === 'gsc') {
    if (isGscOk) {
      let g = pick((gsc as any)?.metrics);
      if (g.clicks === 0) {
        const fromPages = sumFromTopPages((gsc as any)?.metrics);
        if (fromPages.clicks > 0) {
          g = { clicks: fromPages.clicks, impressions: g.impressions || fromPages.impressions };
        }
      }
      return { ...g, label: 'GSC', na: false };
    }
    return { clicks: 0, impressions: 0, label: 'GSC', na: !gsc };
  }

  if (priorityPlatform === 'bing') {
    if (isBingOk) return { ...pick((bing as any)?.metrics), label: 'Bing', na: false };
    return { clicks: 0, impressions: 0, label: 'Bing', na: !bing };
  }

  return { clicks: 0, impressions: 0, label: 'N/A', na: true };
};
