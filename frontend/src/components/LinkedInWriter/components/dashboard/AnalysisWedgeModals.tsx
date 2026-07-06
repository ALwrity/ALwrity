/**
 * Analysis Wedge — AI-first feature modals
 *
 * F1  GrowthSnapshotModal      — cached trending topic + content gap + brand score
 * F2  PostTodayModal           — AI-ranked top 3 post opportunities
 * F3  BrandScorecardModal      — full BrandScorecard component in a modal
 * F4  WeeklyPlanModal          — Mon-Fri content plan with Create Now + Schedule CTAs
 * F5  ViralCopywriterModal     — top viral patterns with "Write in This Style" CTA
 */
import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { DashboardActionModal } from './DashboardActionModal';
import {
  linkedInGrowthApi,
  type ConsolidatedGrowthResponse,
  type DailyPostIdea,
  type ViralPattern,
  type BrandDimension,
} from '../../../../services/linkedInGrowthApi';
import { contentPlanningApi } from '../../../../services/contentPlanningApi';
import { BrandScorecard } from '../GrowthEngine/BrandScorecard';
import { ViralAnalysisCard } from '../GrowthEngine/ViralAnalysisCard';
import {
  colors,
  rowBase,
  scoreColor,
  scoreBg,
  barColor,
  CONFIDENCE_COLORS,
} from '../GrowthEngine/styles';

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

const CACHE_KEY = 'alwrity_growth_engine';

interface CachePayload {
  data: ConsolidatedGrowthResponse;
  cachedAt: number;
}

const CACHE_TTL = 3600000; // 1 hour — matches backend LLM cache

function readCache(): CachePayload | null {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachePayload;
    if (!parsed.cachedAt || Date.now() - parsed.cachedAt > CACHE_TTL) {
      sessionStorage.removeItem(CACHE_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function writeCache(data: ConsolidatedGrowthResponse) {
  try {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify({ data, cachedAt: Date.now() }));
  } catch {
    // storage full — silent
  }
}

function formatAge(cachedAt: number): string {
  const ms = Date.now() - cachedAt;
  const min = Math.floor(ms / 60000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min} min ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  return `${Math.floor(hr / 24)}d ago`;
}

function openInCreate(topic: string, keyPoints: string, type: string = 'post') {
  window.dispatchEvent(
    new CustomEvent('linkedinwriter:openQuickCreate', {
      detail: { type, topic, key_points: keyPoints },
    })
  );
}

function switchToGrowthEngine() {
  window.dispatchEvent(
    new CustomEvent('linkedinwriter:switchTab', { detail: { tab: 'analytics' } })
  );
}

const Spinner = () => (
  <>
    <style>{`@keyframes aw-spin { to { transform: rotate(360deg); } }`}</style>
    <span
      style={{
        display: 'inline-block',
        width: 16,
        height: 16,
        border: '2px solid #d1d5db',
        borderTopColor: colors.primary,
        borderRadius: '50%',
        animation: 'aw-spin 0.7s linear infinite',
        flexShrink: 0,
      }}
    />
  </>
);

const ConfidencePill: React.FC<{ level: 'high' | 'medium' | 'low' }> = ({ level }) => {
  const cc = CONFIDENCE_COLORS[level] ?? CONFIDENCE_COLORS.medium;
  return (
    <span
      style={{
        fontSize: 10,
        fontWeight: 700,
        background: cc.bg,
        color: cc.text,
        padding: '1px 6px',
        borderRadius: 4,
      }}
    >
      {level} confidence
    </span>
  );
};

function useGrowthInsights(open: boolean) {
  const [data, setData] = useState<ConsolidatedGrowthResponse | null>(null);
  const [cachedAt, setCachedAt] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    const cached = readCache();
    if (cached) {
      setData(cached.data);
      setCachedAt(cached.cachedAt);
    } else {
      setData(null);
      setCachedAt(null);
    }
    setError('');
    setLoading(false);
  }, [open]);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await linkedInGrowthApi.analyzeAll();
      writeCache(result);
      setData(result);
      setCachedAt(Date.now());
      return result;
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { detail?: string } } };
      const msg = axiosErr.response?.data?.detail;
      setError(msg ?? (err instanceof Error ? err.message : 'Could not load insights. Please try again.'));
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return { data, cachedAt, loading, error, loadAll };
}

const primaryLoadBtn: React.CSSProperties = {
  padding: '10px 24px',
  background: colors.primary,
  color: '#fff',
  border: 'none',
  borderRadius: 8,
  fontSize: 14,
  fontWeight: 700,
  cursor: 'pointer',
};

const CacheEmptyPrompt: React.FC<{
  icon: string;
  title: string;
  description: string;
  buttonLabel: string;
  onLoad: () => void;
}> = ({ icon, title, description, buttonLabel, onLoad }) => (
  <div style={{ textAlign: 'center', padding: '24px 0' }}>
    <div style={{ fontSize: 36, marginBottom: 12 }}>{icon}</div>
    <div style={{ fontWeight: 600, fontSize: 14, color: colors.textDark, marginBottom: 6 }}>{title}</div>
    <div style={{ fontSize: 13, color: colors.textSecondary, marginBottom: 20 }}>{description}</div>
    <button type="button" onClick={onLoad} style={primaryLoadBtn}>{buttonLabel}</button>
  </div>
);

const LoadingRow: React.FC<{ message: string }> = ({ message }) => (
  <div
    style={{
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      padding: '24px 0',
      justifyContent: 'center',
      color: colors.textSecondary,
      fontSize: 13,
    }}
  >
    <Spinner /> {message}
  </div>
);

const ErrorBanner: React.FC<{ message: string }> = ({ message }) => (
  <div
    style={{
      padding: '10px 14px',
      background: '#fef2f2',
      borderRadius: 8,
      color: '#dc2626',
      fontSize: 13,
      marginBottom: 14,
    }}
  >
    {message}
  </div>
);

const RefreshBar: React.FC<{ cachedAt: number; onRefresh: () => void; label?: string }> = ({
  cachedAt,
  onRefresh,
  label = 'Last refreshed',
}) => (
  <div
    style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 14,
      fontSize: 11,
      color: colors.textTertiary,
    }}
  >
    <span>{label} {formatAge(cachedAt)}</span>
    <button
      type="button"
      onClick={onRefresh}
      style={{
        background: 'none',
        border: `1px solid ${colors.border}`,
        borderRadius: 5,
        padding: '2px 8px',
        fontSize: 11,
        color: colors.textSecondary,
        cursor: 'pointer',
        fontWeight: 600,
      }}
    >
      ↻ Refresh
    </button>
  </div>
);

// ---------------------------------------------------------------------------
// F1 — Growth Snapshot Modal
// ---------------------------------------------------------------------------

interface GrowthSnapshotModalProps {
  open: boolean;
  onClose: () => void;
}

export const GrowthSnapshotModal: React.FC<GrowthSnapshotModalProps> = ({ open, onClose }) => {
  const { data, cachedAt, loading, error, loadAll } = useGrowthInsights(open);
  const handleLoadAll = () => void loadAll();

  const topTrend = data?.trending?.trending_topics?.[0] ?? null;
  const topGap = data?.content_gaps?.gaps?.[0] ?? null;
  const brandScore = data?.brand_scorecard?.overall_score ?? null;
  const brandRank =
    brandScore !== null
      ? brandScore >= 85 ? 'Exceptional' : brandScore >= 65 ? 'Strong' : brandScore >= 40 ? 'Developing' : 'Beginner'
      : null;

  return (
    <DashboardActionModal
      open={open}
      title="Growth Snapshot"
      onClose={onClose}
      maxWidth={540}
      maxHeight="min(92vh, 680px)"
    >
      <div>
        <p style={{ margin: '0 0 16px', fontSize: 13, color: colors.textSecondary, lineHeight: 1.5 }}>
          Your latest AI growth insights at a glance — trending topic, content gap, and brand health.
        </p>

        {/* ── No cache state ── */}
        {!data && !loading && (
          <CacheEmptyPrompt
            icon="🚀"
            title="No recent analysis found"
            description="Run a one-time AI analysis to see your growth snapshot. Takes ~20 seconds."
            buttonLabel="🚀 Load All Insights (1 AI call)"
            onLoad={handleLoadAll}
          />
        )}

        {loading && <LoadingRow message="Running AI analysis across 7 dimensions…" />}

        {error && <ErrorBanner message={error} />}

        {/* ── Snapshot sections ── */}
        {data && !loading && (
          <>
            {/* Cache age */}
            {cachedAt && <RefreshBar cachedAt={cachedAt} onRefresh={handleLoadAll} />}

            {/* Section 1 — Trending Topic */}
            <SnapshotSection
              icon="🔥"
              label="Top Trending Topic"
              accent="#f59e0b"
            >
              {topTrend ? (
                <div>
                  <div
                    style={{
                      fontWeight: 700,
                      fontSize: 14,
                      color: colors.textDark,
                      marginBottom: 4,
                    }}
                  >
                    {topTrend.emoji} {topTrend.topic}
                  </div>
                  <div
                    style={{ fontSize: 12, color: colors.textMedium, lineHeight: 1.5, marginBottom: 8 }}
                  >
                    {topTrend.why_now}
                  </div>
                  <div
                    style={{
                      fontSize: 11,
                      fontStyle: 'italic',
                      color: colors.textSecondary,
                      background: colors.badgeBg,
                      padding: '6px 10px',
                      borderRadius: 6,
                      marginBottom: 8,
                      lineHeight: 1.5,
                    }}
                  >
                    💡 Hook idea: "{topTrend.suggested_hook}"
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <button
                      onClick={() => {
                        openInCreate(topTrend.topic, topTrend.suggested_hook);
                        onClose();
                      }}
                      style={{
                        padding: '6px 14px',
                        background: colors.primary,
                        color: '#fff',
                        border: 'none',
                        borderRadius: 6,
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      ✍️ Create Post
                    </button>
                    <ConfidencePill level={topTrend.confidence} />
                  </div>
                </div>
              ) : (
                <NoDataRow label="trending topics" onRefresh={handleLoadAll} />
              )}
            </SnapshotSection>

            {/* Section 2 — Content Gap */}
            <SnapshotSection
              icon="🔍"
              label="Biggest Content Gap"
              accent="#8b5cf6"
            >
              {topGap ? (
                <div>
                  <div
                    style={{
                      fontWeight: 700,
                      fontSize: 14,
                      color: colors.textDark,
                      marginBottom: 4,
                    }}
                  >
                    {topGap.gap_topic}
                  </div>
                  <div
                    style={{ fontSize: 12, color: colors.textMedium, lineHeight: 1.5, marginBottom: 4 }}
                  >
                    {topGap.why_it_matters}
                  </div>
                  <div
                    style={{
                      fontSize: 11,
                      fontStyle: 'italic',
                      color: colors.textSecondary,
                      background: colors.badgeBg,
                      padding: '6px 10px',
                      borderRadius: 6,
                      marginBottom: 8,
                      lineHeight: 1.5,
                    }}
                  >
                    💡 Post angle: {topGap.suggested_angle}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <button
                      onClick={() => {
                        openInCreate(topGap.gap_topic, topGap.suggested_angle);
                        onClose();
                      }}
                      style={{
                        padding: '6px 14px',
                        background: '#8b5cf6',
                        color: '#fff',
                        border: 'none',
                        borderRadius: 6,
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      ✍️ Fill This Gap
                    </button>
                    <ConfidencePill level={topGap.confidence} />
                  </div>
                </div>
              ) : (
                <NoDataRow label="content gaps" onRefresh={handleLoadAll} />
              )}
            </SnapshotSection>

            {/* Section 3 — Brand Score */}
            <SnapshotSection
              icon="🏆"
              label="Personal Brand Score"
              accent="#0ea5e9"
            >
              {brandScore !== null ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                  <div
                    style={{
                      width: 64,
                      height: 64,
                      borderRadius: '50%',
                      background: scoreBg(brandScore),
                      color: scoreColor(brandScore),
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 800,
                      fontSize: 22,
                      flexShrink: 0,
                      border: `2px solid ${barColor(brandScore)}44`,
                    }}
                  >
                    {brandScore}
                  </div>
                  <div>
                    <div
                      style={{
                        fontWeight: 700,
                        fontSize: 15,
                        color: scoreColor(brandScore),
                        marginBottom: 4,
                      }}
                    >
                      {brandRank} Brand
                    </div>
                    <div style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 8 }}>
                      {data.brand_scorecard?.top_recommendation}
                    </div>
                    <button
                      onClick={() => {
                        switchToGrowthEngine();
                        onClose();
                      }}
                      style={{
                        padding: '5px 12px',
                        background: 'none',
                        border: `1.5px solid ${colors.primary}`,
                        borderRadius: 6,
                        fontSize: 12,
                        fontWeight: 600,
                        color: colors.primary,
                        cursor: 'pointer',
                      }}
                    >
                      See Full Breakdown →
                    </button>
                  </div>
                </div>
              ) : (
                <NoDataRow label="brand scorecard" onRefresh={handleLoadAll} />
              )}
            </SnapshotSection>

            {/* Footer */}
            <div
              style={{
                marginTop: 16,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <button
                onClick={() => {
                  switchToGrowthEngine();
                  onClose();
                }}
                style={{
                  fontSize: 12,
                  color: colors.primary,
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  fontWeight: 600,
                  padding: 0,
                }}
              >
                Open Full Growth Engine →
              </button>
            </div>
          </>
        )}
      </div>
    </DashboardActionModal>
  );
};

// ---------------------------------------------------------------------------
// Snapshot section wrapper
// ---------------------------------------------------------------------------
interface SnapshotSectionProps {
  icon: string;
  label: string;
  accent: string;
  children: React.ReactNode;
}

const SnapshotSection: React.FC<SnapshotSectionProps> = ({ icon, label, accent, children }) => (
  <div
    style={{
      ...rowBase,
      marginBottom: 12,
      borderLeft: `3px solid ${accent}`,
    }}
  >
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        marginBottom: 10,
        fontSize: 11,
        fontWeight: 700,
        color: colors.textTertiary,
        textTransform: 'uppercase',
        letterSpacing: 0.6,
      }}
    >
      <span style={{ fontSize: 14 }}>{icon}</span>
      {label}
    </div>
    {children}
  </div>
);

const NoDataRow: React.FC<{ label: string; onRefresh: () => void }> = ({ label, onRefresh }) => (
  <div style={{ fontSize: 12, color: colors.textTertiary }}>
    No {label} in current analysis.{' '}
    <button
      onClick={onRefresh}
      style={{
        background: 'none',
        border: 'none',
        color: colors.primary,
        cursor: 'pointer',
        fontSize: 12,
        fontWeight: 600,
        padding: 0,
      }}
    >
      Refresh →
    </button>
  </div>
);

// ---------------------------------------------------------------------------
// F2 — Post Today Modal
// ---------------------------------------------------------------------------

interface PostCandidate {
  topic: string;
  hook: string;
  sourceLabel: string;
  sourceIcon: string;
  confidence: 'high' | 'medium' | 'low';
  score: number;
}

const CARD_PRIORITY: Record<string, number> = {
  trending: 0.5,
  strategy: 0.4,
  engagement: 0.3,
  gaps: 0.2,
  viral: 0.1,
  network: 0,
};
const SCORE_MAP: Record<string, number> = { high: 3, medium: 2, low: 1 };

function rankCandidates(c: ConsolidatedGrowthResponse): PostCandidate[] {
  const candidates: PostCandidate[] = [];

  if (c.trending?.trending_topics) {
    for (const item of c.trending.trending_topics) {
      candidates.push({
        topic: item.topic,
        hook: item.suggested_hook,
        sourceLabel: 'Trending Now',
        sourceIcon: '🔥',
        confidence: item.confidence,
        score: (SCORE_MAP[item.confidence] ?? 1) + CARD_PRIORITY.trending,
      });
    }
  }

  if (c.weekly_strategy?.daily_posts) {
    for (const post of c.weekly_strategy.daily_posts) {
      candidates.push({
        topic: post.headline,
        hook: post.hook,
        sourceLabel: `Weekly Plan · ${post.day}`,
        sourceIcon: '📅',
        confidence: post.confidence,
        score: (SCORE_MAP[post.confidence] ?? 1) + CARD_PRIORITY.strategy,
      });
    }
  }

  if (c.engagement_opportunities?.opportunities) {
    for (const item of c.engagement_opportunities.opportunities) {
      candidates.push({
        topic: item.title,
        hook: item.suggested_comment,
        sourceLabel: 'Engagement Opportunity',
        sourceIcon: '💬',
        confidence: item.confidence,
        score: (SCORE_MAP[item.confidence] ?? 1) + CARD_PRIORITY.engagement,
      });
    }
  }

  if (c.content_gaps?.gaps) {
    for (const gap of c.content_gaps.gaps) {
      candidates.push({
        topic: gap.gap_topic,
        hook: gap.suggested_angle,
        sourceLabel: 'Content Gap',
        sourceIcon: '🔍',
        confidence: gap.confidence,
        score: (SCORE_MAP[gap.confidence] ?? 1) + CARD_PRIORITY.gaps,
      });
    }
  }

  if (c.viral_analysis?.patterns) {
    for (const p of c.viral_analysis.patterns) {
      candidates.push({
        topic: p.example_headline,
        hook: p.description,
        sourceLabel: 'Viral Pattern',
        sourceIcon: '📈',
        confidence: p.confidence,
        score: (SCORE_MAP[p.confidence] ?? 1) + CARD_PRIORITY.viral,
      });
    }
  }

  if (c.network_suggestions?.suggestions) {
    for (const s of c.network_suggestions.suggestions) {
      candidates.push({
        topic: `${s.name} — ${s.title}${s.company ? ` @ ${s.company}` : ''}`,
        hook: s.why_connect,
        sourceLabel: 'Network Suggestion',
        sourceIcon: '🤝',
        confidence: s.confidence,
        score: (SCORE_MAP[s.confidence] ?? 1) + CARD_PRIORITY.network,
      });
    }
  }

  candidates.sort((a, b) => b.score - a.score);
  return candidates;
}

interface PostTodayModalProps {
  open: boolean;
  onClose: () => void;
}

export const PostTodayModal: React.FC<PostTodayModalProps> = ({ open, onClose }) => {
  const { data, cachedAt, loading, error, loadAll } = useGrowthInsights(open);
  const candidates = useMemo(() => (data ? rankCandidates(data) : []), [data]);
  const handleLoadAll = () => void loadAll();
  const top3 = candidates.slice(0, 3);

  return (
    <DashboardActionModal
      open={open}
      title="What Should I Post Today?"
      onClose={onClose}
      maxWidth={560}
      maxHeight="min(92vh, 700px)"
    >
      <div>
        <p style={{ margin: '0 0 16px', fontSize: 13, color: colors.textSecondary, lineHeight: 1.5 }}>
          AI-ranked post opportunities across all your growth signals — trending topics, content gaps,
          weekly strategy, and engagement wins.
        </p>

        {/* No cache */}
        {!loading && candidates.length === 0 && (
          <>
            <CacheEmptyPrompt
              icon="🎯"
              title={error ? 'Failed to load insights' : 'No insights loaded yet'}
              description={error ? 'Try again or close and reopen the modal.' : 'Load your growth analysis to get AI-ranked post recommendations.'}
              buttonLabel={error ? '🔁 Retry' : '🚀 Load Insights'}
              onLoad={handleLoadAll}
            />
            {error && <ErrorBanner message={error} />}
          </>
        )}

        {loading && <LoadingRow message={data ? 'Refreshing insights…' : 'Running AI analysis across all growth signals…'} />}

        {/* Ranked candidates */}
        {!loading && top3.length > 0 && (
          <>
            {cachedAt && (
              <RefreshBar cachedAt={cachedAt} onRefresh={handleLoadAll} label="Based on analysis from" />
            )}

            {top3.map((candidate, idx) => (
              <PostCandidateCard
                key={idx}
                candidate={candidate}
                rank={idx + 1}
                onUse={() => {
                  openInCreate(candidate.topic, candidate.hook);
                  onClose();
                }}
              />
            ))}

            {candidates.length > 3 && (
              <div style={{ fontSize: 12, color: colors.textTertiary, marginTop: 8, textAlign: 'center' }}>
                + {candidates.length - 3} more opportunities in the{' '}
                <button
                  onClick={() => {
                    switchToGrowthEngine();
                    onClose();
                  }}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: colors.primary,
                    cursor: 'pointer',
                    fontSize: 12,
                    fontWeight: 600,
                    padding: 0,
                  }}
                >
                  Growth Engine →
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </DashboardActionModal>
  );
};

// ---------------------------------------------------------------------------
// PostCandidateCard sub-component
// ---------------------------------------------------------------------------
interface PostCandidateCardProps {
  candidate: PostCandidate;
  rank: number;
  onUse: () => void;
}

const RANK_STYLES: Record<number, { border: string; badge: string; badgeText: string }> = {
  1: { border: '#0a66c2', badge: '#dbeafe', badgeText: '#1d4ed8' },
  2: { border: '#8b5cf6', badge: '#ede9fe', badgeText: '#6d28d9' },
  3: { border: '#e2e8f0', badge: '#f1f5f9', badgeText: '#64748b' },
};

const PostCandidateCard: React.FC<PostCandidateCardProps> = ({ candidate, rank, onUse }) => {
  const rs = RANK_STYLES[rank] ?? RANK_STYLES[3];

  return (
    <div
      style={{
        ...rowBase,
        marginBottom: 10,
        borderLeft: `3px solid ${rs.border}`,
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: 8,
          gap: 8,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
          <span
            style={{
              fontSize: 10,
              fontWeight: 800,
              background: rs.badge,
              color: rs.badgeText,
              padding: '2px 7px',
              borderRadius: 4,
              flexShrink: 0,
            }}
          >
            #{rank}
          </span>
          <div
            style={{
              fontWeight: 700,
              fontSize: 13,
              color: colors.textDark,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {candidate.topic}
          </div>
        </div>
        <ConfidencePill level={candidate.confidence} />
      </div>

      <div
        style={{
          fontSize: 11,
          color: colors.textSecondary,
          background: colors.badgeBg,
          padding: '6px 10px',
          borderRadius: 6,
          marginBottom: 10,
          lineHeight: 1.5,
          fontStyle: 'italic',
        }}
      >
        💡 "{candidate.hook}"
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
        }}
      >
        <div
          style={{
            fontSize: 11,
            color: colors.textTertiary,
            display: 'flex',
            alignItems: 'center',
            gap: 4,
          }}
        >
          <span>{candidate.sourceIcon}</span>
          {candidate.sourceLabel}
        </div>
        <button
          onClick={onUse}
          style={{
            padding: '6px 14px',
            background: rank === 1 ? colors.primary : 'none',
            color: rank === 1 ? '#fff' : colors.primary,
            border: `1.5px solid ${colors.primary}`,
            borderRadius: 6,
            fontSize: 12,
            fontWeight: 700,
            cursor: 'pointer',
            whiteSpace: 'nowrap',
          }}
        >
          {rank === 1 ? '✍️ Create This Post' : 'Create Post'}
        </button>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// F3 — Brand Score Breakdown Modal
// ---------------------------------------------------------------------------

interface BrandScorecardModalProps {
  open: boolean;
  onClose: () => void;
}

export const BrandScorecardModal: React.FC<BrandScorecardModalProps> = ({ open, onClose }) => {
  const { data, loading, error, loadAll } = useGrowthInsights(open);
  const handleLoad = () => void loadAll();
  const sc = data?.brand_scorecard;

  return (
    <DashboardActionModal
      open={open}
      title="Personal Brand Score"
      onClose={onClose}
      maxWidth={560}
      maxHeight="min(92vh, 720px)"
    >
      <div>
        {!data && !loading && (
          <CacheEmptyPrompt
            icon="🏆"
            title="No brand scorecard in cache"
            description="Run an AI analysis to see a detailed breakdown of your personal brand."
            buttonLabel="🚀 Load Brand Analysis"
            onLoad={handleLoad}
          />
        )}

        {loading && <LoadingRow message="Analysing your personal brand…" />}
        {error && <ErrorBanner message={error} />}

        {sc && !loading && (
          <BrandScorecard
            overallScore={sc.overall_score}
            dimensions={sc.dimensions as BrandDimension[]}
            topRecommendation={sc.top_recommendation}
            dataSourceSummary={sc.data_source_summary}
          />
        )}
      </div>
    </DashboardActionModal>
  );
};

// ---------------------------------------------------------------------------
// F4 — Weekly Content Plan Modal
// ---------------------------------------------------------------------------

const DAY_EMOJIS: Record<string, string> = {
  Monday: '🟦', Tuesday: '🟩', Wednesday: '🟧', Thursday: '🟪', Friday: '🟥',
  Saturday: '⬜', Sunday: '⬜',
};

interface WeeklyPlanModalProps {
  open: boolean;
  onClose: () => void;
}

export const WeeklyPlanModal: React.FC<WeeklyPlanModalProps> = ({ open, onClose }) => {
  const { data, loading, error, loadAll } = useGrowthInsights(open);
  const [scheduling, setScheduling] = useState<number | null>(null);
  const [scheduled, setScheduled] = useState<number[]>([]);
  const [scheduleError, setScheduleError] = useState('');

  useEffect(() => {
    if (!open) return;
    setScheduled([]);
    setScheduleError('');
  }, [open]);

  const handleLoad = () => void loadAll();

  const ws = data?.weekly_strategy;
  const posts: DailyPostIdea[] = ws?.daily_posts ?? [];

  const getNextWeekday = (dayName: string): string => {
    const days: Record<string, number> = {
      Monday: 1, Tuesday: 2, Wednesday: 3, Thursday: 4, Friday: 5, Saturday: 6, Sunday: 0,
    };
    const today = new Date();
    const targetDay = days[dayName] ?? 1;
    const todayDay = today.getDay();
    let daysAhead = targetDay - todayDay;
    if (daysAhead <= 0) daysAhead += 7;
    const target = new Date(today);
    target.setDate(today.getDate() + daysAhead);
    return target.toISOString().split('T')[0];
  };

  const handleScheduleAll = async () => {
    if (!posts.length) return;
    setScheduleError('');
    const results = await Promise.allSettled(
      posts.map((post, i) =>
        contentPlanningApi.createEventSafe({
          title: post.headline,
          description: `Hook: ${post.hook}\n\n${post.why_this_works}`,
          date: getNextWeekday(post.day),
          platform: 'linkedin',
          content_type: post.content_type,
          status: 'draft',
        }).then(() => i)
      )
    );
    const succeeded = results
      .filter((r): r is PromiseFulfilledResult<number> => r.status === 'fulfilled')
      .map((r) => r.value);
    setScheduled(succeeded);
    if (succeeded.length < posts.length) {
      setScheduleError(`Scheduled ${succeeded.length}/${posts.length} posts. Some may have failed.`);
    }
  };

  const handleScheduleOne = async (post: DailyPostIdea, idx: number) => {
    setScheduling(idx);
    setScheduleError('');
    try {
      await contentPlanningApi.createEventSafe({
        title: post.headline,
        description: `Hook: ${post.hook}\n\n${post.why_this_works}`,
        date: getNextWeekday(post.day),
        platform: 'linkedin',
        content_type: post.content_type,
        status: 'draft',
      });
      setScheduled((prev) => [...prev, idx]);
    } catch {
      setScheduleError(`Could not schedule "${post.headline}".`);
    } finally {
      setScheduling(null);
    }
  };

  return (
    <DashboardActionModal
      open={open}
      title="Weekly Content Plan"
      onClose={onClose}
      maxWidth={580}
      maxHeight="min(92vh, 740px)"
    >
      <div>
        <p style={{ margin: '0 0 14px', fontSize: 13, color: colors.textSecondary, lineHeight: 1.5 }}>
          AI-generated 5-day content plan. Create posts or add to your calendar with one click.
        </p>

        {!data && !loading && (
          <CacheEmptyPrompt
            icon="📅"
            title="No weekly plan in cache"
            description="Generate a personalised Mon–Fri content plan."
            buttonLabel="🚀 Generate Weekly Plan"
            onLoad={handleLoad}
          />
        )}

        {loading && <LoadingRow message="Building your weekly content plan…" />}
        {error && <ErrorBanner message={error} />}

        {ws && !loading && (
          <>
            {/* Plan header */}
            <div
              style={{
                background: '#eff6ff',
                border: '1px solid #bfdbfe',
                borderRadius: 10,
                padding: '12px 16px',
                marginBottom: 14,
              }}
            >
              <div style={{ fontWeight: 700, fontSize: 14, color: '#1e40af', marginBottom: 2 }}>
                Week of {ws.week_of} · {ws.theme}
              </div>
              <div style={{ fontSize: 12, color: '#3b82f6' }}>
                Focus: {ws.focus_area} · Topics: {ws.key_topics.join(', ')}
              </div>
            </div>

            {/* Day cards */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 14 }}>
              {posts.map((post, idx) => {
                const isScheduled = scheduled.includes(idx);
                const isSchedulingThis = scheduling === idx;
                return (
                  <div
                    key={idx}
                    style={{
                      ...rowBase,
                      borderLeft: `3px solid ${isScheduled ? '#22c55e' : colors.border}`,
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'flex-start',
                        marginBottom: 6,
                        gap: 8,
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                        <span style={{ fontSize: 16 }}>{DAY_EMOJIS[post.day] ?? '📌'}</span>
                        <div>
                          <span
                            style={{
                              fontSize: 10,
                              fontWeight: 800,
                              color: colors.textTertiary,
                              textTransform: 'uppercase',
                              letterSpacing: 0.6,
                              display: 'block',
                            }}
                          >
                            {post.day}
                          </span>
                          <span style={{ fontWeight: 700, fontSize: 13, color: colors.textDark }}>
                            {post.headline}
                          </span>
                        </div>
                      </div>
                      <span
                        style={{
                          fontSize: 10,
                          color: colors.textSecondary,
                          background: colors.badgeBg,
                          border: `1px solid ${colors.border}`,
                          padding: '2px 7px',
                          borderRadius: 4,
                          whiteSpace: 'nowrap',
                          flexShrink: 0,
                        }}
                      >
                        {post.content_type}
                      </span>
                    </div>

                    <div
                      style={{
                        fontSize: 11,
                        fontStyle: 'italic',
                        color: colors.textSecondary,
                        background: colors.badgeBg,
                        padding: '5px 9px',
                        borderRadius: 5,
                        marginBottom: 8,
                        lineHeight: 1.5,
                      }}
                    >
                      💡 "{post.hook}"
                    </div>

                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                      <button
                        onClick={() => {
                          openInCreate(post.headline, post.hook, post.content_type);
                          onClose();
                        }}
                        style={{
                          padding: '5px 12px',
                          background: colors.primary,
                          color: '#fff',
                          border: 'none',
                          borderRadius: 6,
                          fontSize: 11,
                          fontWeight: 600,
                          cursor: 'pointer',
                        }}
                      >
                        ✍️ Create Now
                      </button>
                      <button
                        disabled={isScheduled || isSchedulingThis}
                        onClick={() => void handleScheduleOne(post, idx)}
                        style={{
                          padding: '5px 12px',
                          background: isScheduled ? '#dcfce7' : 'none',
                          color: isScheduled ? '#166534' : colors.textSecondary,
                          border: `1px solid ${isScheduled ? '#86efac' : colors.border}`,
                          borderRadius: 6,
                          fontSize: 11,
                          fontWeight: 600,
                          cursor: isScheduled ? 'default' : 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4,
                        }}
                      >
                        {isSchedulingThis ? <><Spinner /> Adding…</> : isScheduled ? '✓ Scheduled' : '📅 Add to Calendar'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {scheduleError && (
              <div style={{ padding: '8px 12px', background: '#fef9c3', borderRadius: 7, color: '#854d0e', fontSize: 12, marginBottom: 10 }}>
                {scheduleError}
              </div>
            )}

            {/* Schedule all CTA */}
            {scheduled.length < posts.length && (
              <button
                onClick={() => void handleScheduleAll()}
                disabled={loading}
                style={{
                  width: '100%',
                  padding: '10px',
                  background: '#059669',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 8,
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                📅 Schedule All {posts.length} Posts to Calendar
              </button>
            )}

            {scheduled.length === posts.length && posts.length > 0 && (
              <div
                style={{
                  textAlign: 'center',
                  padding: '12px',
                  background: '#dcfce7',
                  borderRadius: 8,
                  color: '#166534',
                  fontWeight: 700,
                  fontSize: 13,
                }}
              >
                ✅ All {posts.length} posts added to your calendar!
              </div>
            )}
          </>
        )}
      </div>
    </DashboardActionModal>
  );
};

// ---------------------------------------------------------------------------
// F5 — Viral Pattern Copywriter Modal
// ---------------------------------------------------------------------------

interface ViralCopywriterModalProps {
  open: boolean;
  onClose: () => void;
}

export const ViralCopywriterModal: React.FC<ViralCopywriterModalProps> = ({ open, onClose }) => {
  const { data, loading, error, loadAll } = useGrowthInsights(open);
  const handleLoad = () => void loadAll();
  const va = data?.viral_analysis;
  const patterns: ViralPattern[] = va?.patterns ?? [];
  const industry = va?.industry ?? 'your industry';

  return (
    <DashboardActionModal
      open={open}
      title="Viral Pattern Copywriter"
      onClose={onClose}
      maxWidth={580}
      maxHeight="min(92vh, 740px)"
    >
      <div>
        <p style={{ margin: '0 0 14px', fontSize: 13, color: colors.textSecondary, lineHeight: 1.5 }}>
          AI-identified content patterns that drive viral engagement in your industry. Pick a pattern
          and create a post in that exact style.
        </p>

        {!data && !loading && (
          <CacheEmptyPrompt
            icon="🔥"
            title="No viral patterns in cache"
            description="Load an AI analysis to discover what formats go viral in your niche."
            buttonLabel="🚀 Load Viral Patterns"
            onLoad={handleLoad}
          />
        )}

        {loading && <LoadingRow message={`Analysing viral patterns in ${industry}…`} />}
        {error && <ErrorBanner message={error} />}

        {va && !loading && (
          <>
            {/* Full viral analysis card */}
            <ViralAnalysisCard
              industry={industry}
              patterns={patterns}
              topRecommendation={va.top_recommendation}
              dataSourceSummary={va.data_source_summary}
            />

            {/* Per-pattern "Write in This Style" CTAs */}
            {patterns.length > 0 && (
              <div style={{ marginTop: 14 }}>
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: colors.textTertiary,
                    textTransform: 'uppercase',
                    letterSpacing: 0.6,
                    marginBottom: 8,
                  }}
                >
                  Write in a Viral Style
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {patterns.map((pattern, idx) => (
                    <div
                      key={idx}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '10px 14px',
                        background: colors.rowBg,
                        border: `1px solid ${colors.border}`,
                        borderRadius: 8,
                        gap: 10,
                      }}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 600, fontSize: 12, color: colors.textDark, marginBottom: 2 }}>
                          📌 {pattern.pattern_name}
                        </div>
                        <div style={{ fontSize: 11, color: colors.textTertiary }}>
                          {pattern.engagement_multiplier} engagement · {pattern.confidence} confidence
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          const topic = `[Write a LinkedIn post using the "${pattern.pattern_name}" pattern]`;
                          const keyPoints = [
                            `Pattern: ${pattern.pattern_name}`,
                            `Description: ${pattern.description}`,
                            `Example format: ${pattern.example_headline}`,
                            `Engagement goal: ${pattern.engagement_multiplier}`,
                          ].join('\n');
                          openInCreate(topic, keyPoints);
                          onClose();
                        }}
                        style={{
                          padding: '6px 14px',
                          background: '#dc2626',
                          color: '#fff',
                          border: 'none',
                          borderRadius: 6,
                          fontSize: 11,
                          fontWeight: 700,
                          cursor: 'pointer',
                          whiteSpace: 'nowrap',
                          flexShrink: 0,
                        }}
                      >
                        🔥 Write in This Style
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </DashboardActionModal>
  );
};

