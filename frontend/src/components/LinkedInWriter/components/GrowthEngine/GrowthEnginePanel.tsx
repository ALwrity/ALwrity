import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  linkedInGrowthApi,
  type ConsolidatedGrowthResponse,
  type TrendingTopicsResponse,
  type NetworkSuggestionsResponse,
  type EngagementOpportunitiesResponse,
  type ViralAnalysisResponse,
  type WeeklyStrategyResponse,
  type ContentGapsResponse,
  type BrandScorecardResponse,
} from '../../../../services/linkedInGrowthApi';
import { TrendingTopicCard } from './TrendingTopicCard';
import { NetworkSuggestionCard } from './NetworkSuggestionCard';
import { EngagementCard } from './EngagementCard';
import { ViralAnalysisCard } from './ViralAnalysisCard';
import { StrategyBriefCard } from './StrategyBriefCard';
import { ContentGapCard } from './ContentGapCard';
import { BrandScorecard } from './BrandScorecard';
import { EmptyState } from './EmptyState';
import ComponentErrorBoundary from '../../../../components/shared/ComponentErrorBoundary';
import { colors, primaryBtn } from './styles';

interface GrowthEnginePanelProps {
  onGeneratePost: (params?: { topic?: string; context?: string }) => Promise<{ success: boolean; data?: any; error?: string }>;
}

type PanelState = 'idle' | 'loading' | 'loaded' | 'error';

type RefreshKey = 'trending' | 'network' | 'engagement' | 'viral' | 'strategy' | 'gaps' | 'brand';

export const GrowthEnginePanel: React.FC<GrowthEnginePanelProps> = ({
  onGeneratePost,
}) => {
  const [consolidated, setConsolidated] = useState<ConsolidatedGrowthResponse | null>(null);
  const [panelState, setPanelState] = useState<PanelState>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [refreshing, setRefreshing] = useState<Set<RefreshKey>>(new Set());
  const [tick, setTick] = useState(0);

  const mountedRef = useRef(true);
  const fetchedRef = useRef(false);

  // Re-render every 60s so relative timestamps stay current
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 60000);
    return () => clearInterval(id);
  }, []);

  // Restore sessionStorage cache on mount
  useEffect(() => {
    if (fetchedRef.current) return;
    fetchedRef.current = true;

    try {
      const raw = sessionStorage.getItem('alwrity_growth_engine');
      if (raw) {
        const parsed = JSON.parse(raw) as { data: ConsolidatedGrowthResponse; cachedAt: number };
        const age = Date.now() - parsed.cachedAt;
        const TTL = 60 * 60 * 1000; // 1 hour
        if (age < TTL) {
          setConsolidated(parsed.data);
          setPanelState('loaded');
        } else {
          sessionStorage.removeItem('alwrity_growth_engine');
        }
      }
    } catch {
      sessionStorage.removeItem('alwrity_growth_engine');
    }
  }, []);

  // Persist the latest consolidated data to sessionStorage
  const persistToSession = useCallback((data: ConsolidatedGrowthResponse) => {
    try {
      sessionStorage.setItem(
        'alwrity_growth_engine',
        JSON.stringify({ data, cachedAt: Date.now() }),
      );
    } catch {
      // sessionStorage full or unavailable — silently skip
    }
  }, []);

  const runAllAnalyses = useCallback(async () => {
    setPanelState('loading');
    setErrorMsg('');
    try {
      const data = await linkedInGrowthApi.analyzeAll();
      if (!mountedRef.current) return;
      setConsolidated(data);
      setPanelState('loaded');
      persistToSession(data);
    } catch (err: unknown) {
      if (!mountedRef.current) return;
      const msg =
        (err as any)?.response?.data?.detail ||
        (err instanceof Error ? err.message : 'Failed to load growth insights');
      setErrorMsg(msg);
      setPanelState('error');
    }
  }, [persistToSession]);

  const refreshCard = useCallback(async (key: RefreshKey) => {
    setRefreshing((prev) => new Set(prev).add(key));
    try {
      let result: unknown;
      switch (key) {
        case 'trending':
          result = await linkedInGrowthApi.getTrendingTopics();
          break;
        case 'network':
          result = await linkedInGrowthApi.getNetworkSuggestions();
          break;
        case 'engagement':
          result = await linkedInGrowthApi.getEngagementOpportunities();
          break;
        case 'viral':
          result = await linkedInGrowthApi.getViralAnalysis();
          break;
        case 'strategy':
          result = await linkedInGrowthApi.getWeeklyStrategy();
          break;
        case 'gaps':
          result = await linkedInGrowthApi.getContentGaps();
          break;
        case 'brand':
          result = await linkedInGrowthApi.getBrandScorecard();
          break;
      }
      if (!mountedRef.current) return;
      setConsolidated((prev) => {
        if (!prev) return prev;
        const updated = { ...prev };
        switch (key) {
          case 'trending':
            updated.trending = result as TrendingTopicsResponse;
            break;
          case 'network':
            updated.network_suggestions = result as NetworkSuggestionsResponse;
            break;
          case 'engagement':
            updated.engagement_opportunities = result as EngagementOpportunitiesResponse;
            break;
          case 'viral':
            updated.viral_analysis = result as ViralAnalysisResponse;
            break;
          case 'strategy':
            updated.weekly_strategy = result as WeeklyStrategyResponse;
            break;
          case 'gaps':
            updated.content_gaps = result as ContentGapsResponse;
            break;
          case 'brand':
            updated.brand_scorecard = result as BrandScorecardResponse;
            break;
        }
        persistToSession(updated);
        return updated;
      });
    } catch (err: unknown) {
      console.error(`[GrowthEngine] Failed to refresh ${key}:`, err);
    } finally {
      if (mountedRef.current) {
        setRefreshing((prev) => {
          const next = new Set(prev);
          next.delete(key);
          return next;
        });
      }
    }
  }, [persistToSession]);

  const handlePostAbout = useCallback((topic: string, hook: string) => {
    onGeneratePost({ topic, context: `Topic: ${topic}\nSuggested hook: ${hook}` });
  }, [onGeneratePost]);

  // ------------------------------------------------------------------
  // Idle state — user hasn't triggered any analysis yet
  // ------------------------------------------------------------------
  if (panelState === 'idle') {
    return (
      <div style={{ padding: '24px 32px', maxWidth: 900, margin: '0 auto' }}>
        <h2 style={{ margin: '0 0 4px', fontSize: 20, fontWeight: 700, color: colors.textDark }}>
          Growth Engine
        </h2>
        <p style={{ margin: '0 0 24px', fontSize: 13, color: colors.textSecondary }}>
          AI-powered insights to grow your LinkedIn reach. Data-backed, actionable suggestions.
        </p>
        <EmptyState
          icon="🚀"
          message="Ready to analyze your LinkedIn growth. Click below to generate all insights in one go, or load individual cards."
        />
        <div style={{ textAlign: 'center', marginTop: 16 }}>
          <button
            onClick={runAllAnalyses}
            style={{
              ...primaryBtn,
              padding: '10px 28px',
              fontSize: 14,
              borderRadius: 8,
            }}
            aria-label="Run all growth analyses"
          >
            🚀 Load All Insights (1 AI call)
          </button>
        </div>
      </div>
    );
  }

  // ------------------------------------------------------------------
  // Loading state — per-card skeleton placeholders matching the layout
  // ------------------------------------------------------------------
  if (panelState === 'loading') {
    const shimmerKeyframes = `
      @keyframes gs-shimmer {
        0% { background-position: -400px 0; }
        100% { background-position: 400px 0; }
      }
    `;
    const sk = (h: number, w?: string): React.CSSProperties => ({
      height: h,
      width: w || '100%',
      borderRadius: 6,
      background: `linear-gradient(90deg, ${colors.badgeBg} 25%, ${colors.border} 50%, ${colors.badgeBg} 75%)`,
      backgroundSize: '800px 100%',
      animation: 'gs-shimmer 1.5s ease-in-out infinite',
    });

    return (
      <div style={{ padding: '24px 32px', maxWidth: 900, margin: '0 auto' }}>
        <div style={{ marginBottom: 4 }}>
          <div style={sk(24, '280px')} />
          <div style={{ ...sk(13, '420px'), marginTop: 8 }} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20, marginTop: 20 }}>
          {[1, 2, 3, 4, 5, 6, 7].map((i) => (
            <div
              key={i}
              style={{
                border: `1px solid ${colors.border}`,
                borderRadius: 10,
                padding: 16,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
                <div style={sk(22, '70px')} />
              </div>
              <div style={sk(16)} />
              <div style={{ ...sk(14), marginTop: 8, width: '70%' }} />
              <div style={{ ...sk(14), marginTop: 6, width: '50%' }} />
              <div style={{ ...sk(14), marginTop: 6, width: '60%' }} />
            </div>
          ))}
        </div>
        <style>{shimmerKeyframes}</style>
      </div>
    );
  }

  // ------------------------------------------------------------------
  // Error state
  // ------------------------------------------------------------------
  if (panelState === 'error') {
    return (
      <div style={{ padding: '24px 32px', maxWidth: 900, margin: '0 auto' }}>
        <div
          style={{
            background: '#fef2f2',
            border: '1px solid #fecaca',
            borderRadius: 10,
            padding: '20px 24px',
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: 16, marginBottom: 8, color: '#991b1b' }}>
            Could not load growth insights
          </div>
          <div style={{ fontSize: 13, color: '#b91c1c', marginBottom: 16 }}>{errorMsg}</div>
          <button
            onClick={runAllAnalyses}
            style={{
              padding: '8px 20px',
              background: colors.primary,
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: 13,
            }}
            aria-label="Retry loading growth insights"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // ------------------------------------------------------------------
  // Loaded — render insight cards with per-card refresh
  // ------------------------------------------------------------------
  if (!consolidated) return null;

  const spinKeyframes = `
    @keyframes gs-spin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }
  `;

  const overlayStyle: React.CSSProperties = {
    position: 'absolute',
    inset: 0,
    background: 'rgba(255,255,255,0.6)',
    zIndex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
  };

  const spinnerStyle: React.CSSProperties = {
    fontSize: 20,
    animation: 'gs-spin 0.8s linear infinite',
    display: 'inline-block',
  };

  const cardWrapper = (key: RefreshKey, children: React.ReactNode) => (
    <div style={{ position: 'relative' }}>
      {refreshing.has(key) && (
        <div style={overlayStyle}>
          <span style={spinnerStyle}>⟳</span>
        </div>
      )}
      {children}
    </div>
  );

  // ---- stale detection ----
  const allGeneratedAts: string[] = [];
  const c = consolidated!; // non-null at this point
  if (c.trending?.generated_at) allGeneratedAts.push(c.trending.generated_at);
  if (c.network_suggestions?.generated_at) allGeneratedAts.push(c.network_suggestions.generated_at);
  if (c.engagement_opportunities?.generated_at) allGeneratedAts.push(c.engagement_opportunities.generated_at);
  if (c.viral_analysis?.generated_at) allGeneratedAts.push(c.viral_analysis.generated_at);
  if (c.weekly_strategy?.generated_at) allGeneratedAts.push(c.weekly_strategy.generated_at);
  if (c.content_gaps?.generated_at) allGeneratedAts.push(c.content_gaps.generated_at);
  if (c.brand_scorecard?.generated_at) allGeneratedAts.push(c.brand_scorecard.generated_at);

  const oldestMs = allGeneratedAts.length > 0
    ? Math.min(...allGeneratedAts.map((s) => new Date(s).getTime()))
    : 0;
  const isStale = oldestMs > 0 && (Date.now() - oldestMs) > 30 * 60 * 1000;

  const formatTimeAgo = (dateStr: string | null | undefined): string => {
    tick; // reference tick to ensure re-render when interval fires
    if (!dateStr) return '';
    const ms = Date.now() - new Date(dateStr).getTime();
    const min = Math.floor(ms / 60000);
    if (min < 1) return 'just now';
    if (min < 60) return `${min} min ago`;
    const hr = Math.floor(min / 60);
    if (hr < 24) return `${hr}h ago`;
    return `${Math.floor(hr / 24)}d ago`;
  };

  const { trending, network_suggestions, engagement_opportunities, viral_analysis, weekly_strategy, content_gaps, brand_scorecard } = consolidated;

  const hasContent = (trending?.trending_topics?.length ?? 0) > 0
    || (network_suggestions?.suggestions?.length ?? 0) > 0
    || (engagement_opportunities?.opportunities?.length ?? 0) > 0
    || (viral_analysis?.patterns?.length ?? 0) > 0
    || (weekly_strategy?.daily_posts?.length ?? 0) > 0
    || (content_gaps?.gaps?.length ?? 0) > 0
    || (brand_scorecard?.dimensions?.length ?? 0) > 0;

  const cardActionBtn = (key: RefreshKey, label: string, hasData: boolean) => (
    <button
      onClick={() => refreshCard(key)}
      disabled={refreshing.has(key)}
      style={{
        ...primaryBtn,
        fontSize: 11,
        padding: '4px 10px',
        opacity: refreshing.has(key) ? 0.6 : 1,
      }}
      aria-label={`${hasData ? 'Refresh' : 'Load'} ${key.replace('-', ' ')}`}
    >
      {refreshing.has(key) ? '⟳' : hasData ? '↻' : '▶'} {label}
    </button>
  );

  return (
    <div
      style={{
        padding: '24px 32px',
        maxWidth: 900,
        margin: '0 auto',
        display: 'flex',
        flexDirection: 'column',
        gap: 20,
      }}
    >
      <div style={{ marginBottom: 4 }}>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: colors.textDark }}>
          Growth Engine
        </h2>
        <p style={{ margin: '4px 0 0', fontSize: 13, color: colors.textSecondary }}>
          AI-powered insights. Refresh individual cards to get fresh AI-generated recommendations.
        </p>
      </div>

      {isStale && (
        <div
          style={{
            background: '#fef9c3',
            border: '1px solid #facc15',
            borderRadius: 8,
            padding: '10px 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: 13,
          }}
        >
          <span style={{ color: '#854d0e' }}>
            Some data may be stale (last updated {formatTimeAgo(c.generated_at)})
          </span>
          <button
            onClick={runAllAnalyses}
            style={{
              ...primaryBtn,
              fontSize: 12,
              padding: '5px 14px',
              borderRadius: 6,
            }}
            aria-label="Refresh all insights"
          >
            Refresh All
          </button>
        </div>
      )}

      {trending && trending.trending_topics.length > 0 && (
        <ComponentErrorBoundary componentName="TrendingTopicCard">
          {cardWrapper('trending', (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <span style={{ fontSize: 11, color: colors.textSecondary }}>
                  Updated {formatTimeAgo(trending.generated_at)}
                </span>
                {cardActionBtn('trending', 'Refresh', true)}
              </div>
              <TrendingTopicCard
                industry={trending.industry}
                topics={trending.trending_topics}
                dataSourceSummary={trending.data_source_summary}
                onPostAbout={handlePostAbout}
              />
            </div>
          ))}
        </ComponentErrorBoundary>
      )}

      {network_suggestions && network_suggestions.suggestions.length > 0 && (
        <ComponentErrorBoundary componentName="NetworkSuggestionCard">
          {cardWrapper('network', (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <span style={{ fontSize: 11, color: colors.textSecondary }}>
                  Updated {formatTimeAgo(network_suggestions.generated_at)}
                </span>
                {cardActionBtn('network', 'Refresh', true)}
              </div>
              <NetworkSuggestionCard
                suggestions={network_suggestions.suggestions}
                dataSourceSummary={network_suggestions.data_source_summary}
              />
            </div>
          ))}
        </ComponentErrorBoundary>
      )}

      {engagement_opportunities && engagement_opportunities.opportunities.length > 0 && (
        <ComponentErrorBoundary componentName="EngagementCard">
          {cardWrapper('engagement', (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <span style={{ fontSize: 11, color: colors.textSecondary }}>
                  Updated {formatTimeAgo(engagement_opportunities.generated_at)}
                </span>
                {cardActionBtn('engagement', 'Refresh', true)}
              </div>
              <EngagementCard
                opportunities={engagement_opportunities.opportunities}
                dataSourceSummary={engagement_opportunities.data_source_summary}
                onGeneratePost={onGeneratePost}
              />
            </div>
          ))}
        </ComponentErrorBoundary>
      )}

      {viral_analysis && viral_analysis.patterns.length > 0 && (
        <ComponentErrorBoundary componentName="ViralAnalysisCard">
          {cardWrapper('viral', (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <span style={{ fontSize: 11, color: colors.textSecondary }}>
                  Updated {formatTimeAgo(viral_analysis.generated_at)}
                </span>
                {cardActionBtn('viral', 'Refresh', true)}
              </div>
              <ViralAnalysisCard
                industry={viral_analysis.industry}
                patterns={viral_analysis.patterns}
                topRecommendation={viral_analysis.top_recommendation}
                dataSourceSummary={viral_analysis.data_source_summary}
              />
            </div>
          ))}
        </ComponentErrorBoundary>
      )}

      {weekly_strategy && weekly_strategy.daily_posts.length > 0 && (
        <ComponentErrorBoundary componentName="StrategyBriefCard">
          {cardWrapper('strategy', (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <span style={{ fontSize: 11, color: colors.textSecondary }}>
                  Updated {formatTimeAgo(weekly_strategy.generated_at)}
                </span>
                {cardActionBtn('strategy', 'Refresh', true)}
              </div>
              <StrategyBriefCard
                theme={weekly_strategy.theme}
                weekOf={weekly_strategy.week_of}
                dailyPosts={weekly_strategy.daily_posts}
                keyTopics={weekly_strategy.key_topics}
                focusArea={weekly_strategy.focus_area}
                dataSourceSummary={weekly_strategy.data_source_summary}
                onGeneratePost={onGeneratePost}
              />
            </div>
          ))}
        </ComponentErrorBoundary>
      )}

      {content_gaps && content_gaps.gaps.length > 0 && (
        <ComponentErrorBoundary componentName="ContentGapCard">
          {cardWrapper('gaps', (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <span style={{ fontSize: 11, color: colors.textSecondary }}>
                  Updated {formatTimeAgo(content_gaps.generated_at)}
                </span>
                {cardActionBtn('gaps', 'Refresh', true)}
              </div>
              <ContentGapCard
                gaps={content_gaps.gaps}
                dataSourceSummary={content_gaps.data_source_summary}
                onGeneratePost={onGeneratePost}
              />
            </div>
          ))}
        </ComponentErrorBoundary>
      )}

      {brand_scorecard && brand_scorecard.dimensions.length > 0 && (
        <ComponentErrorBoundary componentName="BrandScorecard">
          {cardWrapper('brand', (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <span style={{ fontSize: 11, color: colors.textSecondary }}>
                  Updated {formatTimeAgo(brand_scorecard.generated_at)}
                </span>
                {cardActionBtn('brand', 'Refresh', true)}
              </div>
              <BrandScorecard
                overallScore={brand_scorecard.overall_score}
                dimensions={brand_scorecard.dimensions}
                topRecommendation={brand_scorecard.top_recommendation}
                dataSourceSummary={brand_scorecard.data_source_summary}
              />
            </div>
          ))}
        </ComponentErrorBoundary>
      )}

      {!hasContent && (
        <EmptyState
          icon="📭"
          message="No growth insights returned. Try refreshing a card individually, or run Load All again."
        />
      )}

      <style>{spinKeyframes}</style>
    </div>
  );
};