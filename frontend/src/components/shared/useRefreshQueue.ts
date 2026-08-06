import { useState, useCallback } from 'react';
import { cachedAnalyticsAPI } from '../../api/cachedAnalytics';
import type { PlatformAnalytics as PlatformAnalyticsType } from '../../api/analytics';

export interface RefreshQueueData {
  risingQueries: Array<{ query: string; deltaClicks: number; deltaImpressions: number }>;
  decliningQueries: Array<{ query: string; deltaClicks: number; deltaImpressions: number }>;
}

interface UseRefreshQueueParams {
  analyticsData: Record<string, PlatformAnalyticsType>;
  rangeDays: number;
}

interface UseRefreshQueueResult {
  refreshQueue: RefreshQueueData;
  loadingQueue: boolean;
  computeRefreshQueue: () => Promise<void>;
}

const emptyQueue: RefreshQueueData = { risingQueries: [], decliningQueries: [] };

export const useRefreshQueue = ({
  analyticsData,
  rangeDays,
}: UseRefreshQueueParams): UseRefreshQueueResult => {
  const [refreshQueue, setRefreshQueue] = useState<RefreshQueueData>(emptyQueue);
  const [loadingQueue, setLoadingQueue] = useState<boolean>(false);

  const computeRefreshQueue = useCallback(async () => {
    try {
      setLoadingQueue(true);
      const end = new Date();
      const start = new Date(end);
      start.setDate(end.getDate() - (rangeDays - 1));
      const prevEnd = new Date(start);
      prevEnd.setDate(start.getDate() - 1);
      const prevStart = new Date(prevEnd);
      prevStart.setDate(prevEnd.getDate() - (rangeDays - 1));
      const fmt = (d: Date) => d.toISOString().slice(0, 10);
      let currentGSC = (analyticsData['gsc'] as PlatformAnalyticsType | undefined);
      if (!currentGSC) {
        const currentResp = await cachedAnalyticsAPI.getAnalyticsData(['gsc'], false, {
          start_date: fmt(start),
          end_date: fmt(end),
        });
        currentGSC = (currentResp.data as any)['gsc'] as PlatformAnalyticsType | undefined;
      }
      const prevResp = await cachedAnalyticsAPI.getAnalyticsData(['gsc'], false, {
        start_date: fmt(prevStart),
        end_date: fmt(prevEnd),
      });
      const prevGSC = (prevResp.data as any)['gsc'] as PlatformAnalyticsType | undefined;
      const currQueries = (currentGSC?.metrics as any)?.top_queries || [];
      const prevQueries = (prevGSC?.metrics as any)?.top_queries || [];
      const prevMap: Record<string, { clicks: number; impressions: number }> = {};
      prevQueries.forEach((q: any) => {
        const key = String(q.query || '').toLowerCase();
        prevMap[key] = { clicks: Number(q.clicks || 0), impressions: Number(q.impressions || 0) };
      });
      const rising: Array<{ query: string; deltaClicks: number; deltaImpressions: number }> = [];
      const declining: Array<{ query: string; deltaClicks: number; deltaImpressions: number }> = [];
      const riseClicksThresh = rangeDays <= 7 ? 5 : rangeDays <= 30 ? 20 : 40;
      const riseImprThresh = rangeDays <= 7 ? 50 : rangeDays <= 30 ? 200 : 500;
      const dropClicksThresh = -riseClicksThresh;
      const dropImprThresh = -riseImprThresh;
      currQueries.forEach((q: any) => {
        const key = String(q.query || '').toLowerCase();
        const prev = prevMap[key] || { clicks: 0, impressions: 0 };
        const deltaClicks = Number(q.clicks || 0) - prev.clicks;
        const deltaImpressions = Number(q.impressions || 0) - prev.impressions;
        if (deltaClicks > 0 && deltaImpressions > 0 && (deltaClicks >= riseClicksThresh || deltaImpressions >= riseImprThresh)) {
          rising.push({ query: String(q.query || ''), deltaClicks, deltaImpressions });
        }
        if (deltaClicks < 0 && deltaImpressions <= 0 && (deltaClicks <= dropClicksThresh || deltaImpressions <= dropImprThresh)) {
          declining.push({ query: String(q.query || ''), deltaClicks, deltaImpressions });
        }
      });
      rising.sort((a, b) => (b.deltaClicks + b.deltaImpressions) - (a.deltaClicks + a.deltaImpressions));
      declining.sort((a, b) => (a.deltaClicks + a.deltaImpressions) - (b.deltaClicks + b.deltaImpressions));
      if (rising.length === 0 && declining.length === 0) {
        const deltas: Array<{ query: string; deltaClicks: number; deltaImpressions: number; score: number }> = [];
        currQueries.forEach((q: any) => {
          const key = String(q.query || '').toLowerCase();
          const prev = prevMap[key] || { clicks: 0, impressions: 0 };
          const dC = Number(q.clicks || 0) - prev.clicks;
          const dI = Number(q.impressions || 0) - prev.impressions;
          const score = Math.abs(dC) + Math.abs(dI);
          if (score > 0) {
            deltas.push({ query: String(q.query || ''), deltaClicks: dC, deltaImpressions: dI, score });
          }
        });
        deltas.sort((a, b) => b.score - a.score);
        const top = deltas.slice(0, 10);
        if (top.length === 0 && Array.isArray(currQueries) && currQueries.length > 0) {
          const topByClicks = [...currQueries]
            .sort((a: any, b: any) => Number(b.clicks || 0) - Number(a.clicks || 0))
            .slice(0, 10);
          setRefreshQueue({
            risingQueries: topByClicks.map((q: any) => ({
              query: String(q.query || ''),
              deltaClicks: Number(q.clicks || 0),
              deltaImpressions: Number(q.impressions || 0),
            })),
            decliningQueries: [],
          });
        } else {
          setRefreshQueue({
            risingQueries: top.filter(d => d.deltaClicks > 0 || d.deltaImpressions > 0).map(({ score, ...rest }) => rest),
            decliningQueries: top.filter(d => d.deltaClicks < 0 || d.deltaImpressions < 0).map(({ score, ...rest }) => rest),
          });
        }
      } else {
        setRefreshQueue({ risingQueries: rising.slice(0, 10), decliningQueries: declining.slice(0, 10) });
      }
    } catch (e) {
      console.error('Error computing refresh queue:', e);
      setRefreshQueue(emptyQueue);
    } finally {
      setLoadingQueue(false);
    }
  }, [rangeDays, analyticsData]);

  return { refreshQueue, loadingQueue, computeRefreshQueue };
};
