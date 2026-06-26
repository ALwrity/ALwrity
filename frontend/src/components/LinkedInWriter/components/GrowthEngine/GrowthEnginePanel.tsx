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
import { type LinkedInPreferences } from '../../utils/storageUtils';

interface GrowthEnginePanelProps {
  generatePost: (params?: any) => Promise<{ success: boolean; data?: any; error?: string }>;
  userPreferences: LinkedInPreferences;
}

type PanelState = 'idle' | 'loading' | 'loaded' | 'error';

type RefreshKey = 'trending' | 'network' | 'engagement' | 'viral' | 'strategy' | 'gaps' | 'brand';

export const GrowthEnginePanel: React.FC<GrowthEnginePanelProps> = ({
  generatePost,
  userPreferences,
}) => {
  const [consolidated, setConsolidated] = useState<ConsolidatedGrowthResponse | null>(null);
  const [panelState, setPanelState] = useState<PanelState>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [refreshing, setRefreshing] = useState<Set<RefreshKey>>(new Set());
  const [tick, setTick] = useState(0);
  const [creationModal, setCreationModal] = useState<{
    visible: boolean;
    topic: string;
    context: string;
    loading: boolean;
    error: string;
  }>({ visible: false, topic: '', context: '', loading: false, error: '' });

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

  const openPostModal = useCallback((topic: string, context: string) => {
    setCreationModal({ visible: true, topic, context, loading: false, error: '' });
  }, []);

  const findBestPick = useCallback((): { topic: string; context: string } | null => {
    const c = consolidated;
    if (!c) return null;

    const CARD_PRIORITY: Record<string, number> = {
      trending: 0.5, strategy: 0.4, engagement: 0.3, gaps: 0.2, viral: 0.1, network: 0,
    };
    const SCORE: Record<string, number> = { high: 3, medium: 2, low: 1 };

    interface Candidate { topic: string; context: string; score: number }

    const candidates: Candidate[] = [];

    if (c.trending?.trending_topics) {
      for (const item of c.trending.trending_topics) {
        candidates.push({
          topic: item.topic,
          context: `Topic: ${item.topic}\nSuggested hook: ${item.suggested_hook}`,
          score: (SCORE[item.confidence] || 1) + CARD_PRIORITY.trending,
        });
      }
    }
    if (c.engagement_opportunities?.opportunities) {
      for (const item of c.engagement_opportunities.opportunities) {
        candidates.push({
          topic: item.title,
          context: `Engaging with: "${item.title}" by ${item.author}. Suggested comment: ${item.suggested_comment}`,
          score: (SCORE[item.confidence] || 1) + CARD_PRIORITY.engagement,
        });
      }
    }
    if (c.content_gaps?.gaps) {
      for (const gap of c.content_gaps.gaps) {
        candidates.push({
          topic: gap.gap_topic,
          context: `Content gap: ${gap.gap_topic}. Suggested angle: ${gap.suggested_angle}`,
          score: (SCORE[gap.confidence] || 1) + CARD_PRIORITY.gaps,
        });
      }
    }
    if (c.weekly_strategy?.daily_posts) {
      for (const post of c.weekly_strategy.daily_posts) {
        candidates.push({
          topic: post.headline,
          context: `Weekly strategy: ${post.day} - ${post.content_type} post. Theme: "${c.weekly_strategy.theme}". Hook: ${post.hook}`,
          score: (SCORE[post.confidence] || 1) + CARD_PRIORITY.strategy,
        });
      }
    }

    if (candidates.length === 0) return null;
    candidates.sort((a, b) => b.score - a.score);
    return candidates[0];
  }, [consolidated]);

  const handleBestPick = useCallback(() => {
    const best = findBestPick();
    if (best) openPostModal(best.topic, best.context);
  }, [findBestPick, openPostModal]);

  const bestPickAvailable = useCallback(() => {
    return findBestPick() !== null;
  }, [findBestPick]);

  const handlePostAbout = useCallback((topic: string, hook: string) => {
    openPostModal(topic, `Topic: ${topic}\nSuggested hook: ${hook}`);
  }, [openPostModal]);

  const handleOpenModalFromCard = useCallback((params?: { topic?: string; context?: string }) => {
    openPostModal(params?.topic || '', params?.context || '');
    return Promise.resolve({ success: true as const });
  }, [openPostModal]);

  const handleGenerateInModal = useCallback(async () => {
    setCreationModal((prev) => ({ ...prev, loading: true, error: '' }));
    try {
      const result = await generatePost({
        topic: creationModal.topic,
        context: creationModal.context,
        ...userPreferences,
      });
      if (result.success) {
        setCreationModal({ visible: false, topic: '', context: '', loading: false, error: '' });
      } else {
        setCreationModal((prev) => ({ ...prev, loading: false, error: result.error || 'Generation failed' }));
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Generation failed';
      setCreationModal((prev) => ({ ...prev, loading: false, error: msg }));
    }
  }, [generatePost, creationModal.topic, creationModal.context, userPreferences]);

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
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: colors.textDark }}>
              Growth Engine
            </h2>
            <p style={{ margin: '4px 0 0', fontSize: 13, color: colors.textSecondary }}>
              AI-powered insights. Refresh individual cards to get fresh AI-generated recommendations.
            </p>
          </div>
          {bestPickAvailable() && (
            <button
              onClick={handleBestPick}
              style={{
                ...primaryBtn,
                padding: '8px 18px', fontSize: 13, borderRadius: 8,
                whiteSpace: 'nowrap', marginLeft: 16,
              }}
              aria-label="Generate the best post based on all insights"
            >
              🎯 Generate Best Post
            </button>
          )}
        </div>
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
                onGeneratePost={handleOpenModalFromCard}
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
                onGeneratePost={handleOpenModalFromCard}
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
                onGeneratePost={handleOpenModalFromCard}
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

      {/* ── Post creation modal ── */}
      {creationModal.visible && (
        <div
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 10020, padding: 20,
          }}
          onClick={() => { if (!creationModal.loading) setCreationModal((p) => ({ ...p, visible: false })); }}
        >
          <div
            style={{
              background: 'white', width: 520, maxWidth: '100%', borderRadius: 16,
              boxShadow: '0 20px 60px rgba(0,0,0,0.25)', overflow: 'hidden',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{
              padding: 16, borderBottom: '1px solid #e5e7eb',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <div style={{ fontWeight: 800, fontSize: 15, color: '#111827' }}>
                📝 Generate Post from Insight
              </div>
              <button
                onClick={() => setCreationModal((p) => ({ ...p, visible: false }))}
                disabled={creationModal.loading}
                style={{
                  background: 'none', border: 'none', fontSize: 20, cursor: creationModal.loading ? 'not-allowed' : 'pointer',
                  color: '#6b7280', padding: '4px 8px', borderRadius: 6, opacity: creationModal.loading ? 0.4 : 1,
                }}
              >
                ✕
              </button>
            </div>

            <div style={{ padding: 16, maxHeight: '60vh', overflow: 'auto' }}>
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', marginBottom: 4, fontWeight: 600, fontSize: 13, color: '#374151' }}>
                  Topic
                </label>
                <input
                  value={creationModal.topic}
                  onChange={(e) => setCreationModal((p) => ({ ...p, topic: e.target.value }))}
                  placeholder="Post topic"
                  disabled={creationModal.loading}
                  style={{
                    width: '100%', padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: 8,
                    fontSize: 14, outline: 'none', boxSizing: 'border-box',
                    opacity: creationModal.loading ? 0.6 : 1,
                  }}
                />
              </div>
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', marginBottom: 4, fontWeight: 600, fontSize: 13, color: '#374151' }}>
                  Context
                </label>
                <textarea
                  value={creationModal.context}
                  onChange={(e) => setCreationModal((p) => ({ ...p, context: e.target.value }))}
                  placeholder="Additional context for the post"
                  rows={3}
                  disabled={creationModal.loading}
                  style={{
                    width: '100%', padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: 8,
                    fontSize: 14, outline: 'none', resize: 'vertical', fontFamily: 'inherit',
                    boxSizing: 'border-box', opacity: creationModal.loading ? 0.6 : 1,
                  }}
                />
              </div>
              {creationModal.error && (
                <div style={{
                  padding: '10px 14px', background: '#fef2f2', border: '1px solid #fecaca',
                  borderRadius: 8, fontSize: 13, color: '#991b1b', marginBottom: 14,
                }}>
                  {creationModal.error}
                </div>
              )}
            </div>

            <div style={{
              padding: '12px 16px', borderTop: '1px solid #e5e7eb',
              display: 'flex', justifyContent: 'flex-end', gap: 8,
            }}>
              <button
                onClick={() => setCreationModal((p) => ({ ...p, visible: false }))}
                disabled={creationModal.loading}
                style={{
                  padding: '10px 20px', border: '1px solid #d1d5db', borderRadius: 8,
                  background: 'white', cursor: creationModal.loading ? 'not-allowed' : 'pointer',
                  fontSize: 14, fontWeight: 600, opacity: creationModal.loading ? 0.5 : 1,
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleGenerateInModal}
                disabled={creationModal.loading || !creationModal.topic.trim()}
                style={{
                  padding: '10px 24px', border: 'none', borderRadius: 8,
                  background: creationModal.loading || !creationModal.topic.trim() ? '#9ca3af' : colors.primary,
                  color: 'white', cursor: creationModal.loading || !creationModal.topic.trim() ? 'not-allowed' : 'pointer',
                  fontSize: 14, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8,
                  opacity: creationModal.loading || !creationModal.topic.trim() ? 0.7 : 1,
                }}
              >
                {creationModal.loading && (
                  <div style={{
                    width: 14, height: 14, borderRadius: '50%',
                    border: '2px solid white', borderTopColor: 'transparent',
                    animation: 'gs-spin 0.8s linear infinite',
                  }} />
                )}
                {creationModal.loading ? 'Generating...' : 'Generate Post'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};