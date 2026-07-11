/**
 * F6 — Engagement Trends Modal
 *
 * Compares post engagement between the last two DB snapshot epochs.
 * Extracted from AnalysisWedgeModals.tsx to keep files under 500 lines.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';

import { DashboardActionModal } from './DashboardActionModal';
import {
  postAnalyticsApi,
  type PostAnalyticsHistoryResponse,
  type PostDelta,
} from '../../../../services/postAnalyticsApi';
import { colors } from '../GrowthEngine/styles';
import { ComparisonPeriodBlock, LastUpdatedBanner } from './EngagementTrendsTimeDisplay';
import { hasInsufficientSnapshots } from './engagementTrendsTimeUtils';
import { ENGAGEMENT_TRENDS_MODAL_SIZE } from './engagementTrendsModalLayout';
import { PostDeltaRow } from './PostDeltaRow';
import { PostCommentsModal } from './PostCommentsModal';
import { EngagementGrowthDriversSection } from './EngagementGrowthDriversSection';

function hasNoComparableChanges(data: PostAnalyticsHistoryResponse): boolean {
  return (
    data.summary.total_posts === 0 &&
    data.top_gainers.length === 0 &&
    data.top_decliners.length === 0
  );
}

// ---------------------------------------------------------------------------
// Shared UI primitives (local to this modal)
// ---------------------------------------------------------------------------

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
  disabled?: boolean;
}> = ({ icon, title, description, buttonLabel, onLoad, disabled }) => (
  <div style={{ textAlign: 'center', padding: '24px 0' }}>
    <div style={{ fontSize: 36, marginBottom: 12 }}>{icon}</div>
    <div style={{ fontWeight: 600, fontSize: 14, color: colors.textDark, marginBottom: 6 }}>{title}</div>
    <div style={{ fontSize: 13, color: colors.textSecondary, marginBottom: 20 }}>{description}</div>
    <button
      type="button"
      onClick={onLoad}
      disabled={disabled}
      style={{
        ...primaryLoadBtn,
        opacity: disabled ? 0.6 : 1,
        cursor: disabled ? 'not-allowed' : 'pointer',
      }}
    >
      {buttonLabel}
    </button>
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
    {message}
  </div>
);

const NoChangesEmptyState: React.FC = () => (
  <div
    style={{
      textAlign: 'center',
      padding: '24px 16px',
      marginBottom: 8,
      background: colors.rowBg,
      border: `1px solid ${colors.border}`,
      borderRadius: 8,
    }}
  >
    <div style={{ fontSize: 28, marginBottom: 10 }}>📊</div>
    <div style={{ fontWeight: 600, fontSize: 14, color: colors.textDark, marginBottom: 6 }}>
      No changes detected
    </div>
    <div style={{ fontSize: 13, color: colors.textSecondary, lineHeight: 1.5 }}>
      There are no changes in post analytics to compare with.
    </div>
  </div>
);

// ---------------------------------------------------------------------------
// Modal
// ---------------------------------------------------------------------------

export interface EngagementTrendsModalProps {
  open: boolean;
  onClose: () => void;
  connected?: boolean;
}

export const EngagementTrendsModal: React.FC<EngagementTrendsModalProps> = ({
  open,
  onClose,
  connected,
}) => {
  const [data, setData] = useState<PostAnalyticsHistoryResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [commentsPost, setCommentsPost] = useState<PostDelta | null>(null);
  const mountedRef = useRef(true);

  const fetchData = useCallback(async (refreshFirst = false) => {
    setLoading(true);
    setError('');
    try {
      if (refreshFirst) {
        await postAnalyticsApi.fetchStoredAnalytics(true);
      }
      const result = await postAnalyticsApi.fetchEngagementHistory();
      if (mountedRef.current) setData(result);
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { detail?: string } } };
      if (mountedRef.current) {
        setError(
          axiosErr.response?.data?.detail ??
            (err instanceof Error ? err.message : 'Could not load engagement trends.')
        );
      }
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    if (!open) return;
    setLoading(true);
    setError('');
    postAnalyticsApi
      .fetchEngagementHistory()
      .then((result) => {
        if (mountedRef.current) setData(result);
      })
      .catch((err) => {
        const axiosErr = err as { response?: { data?: { detail?: string } } };
        if (mountedRef.current) {
          setError(
            axiosErr.response?.data?.detail ??
              (err instanceof Error ? err.message : 'Could not load engagement trends.')
          );
        }
      })
      .finally(() => {
        if (mountedRef.current) setLoading(false);
      });
    return () => {
      mountedRef.current = false;
    };
  }, [open]);

  const handleLoad = () => void fetchData(false);
  const handleSync = () => void fetchData(true);

  const showNoChanges =
    data && !loading && hasNoComparableChanges(data) && !hasInsufficientSnapshots(data.period);
  const showInsufficientSnapshots =
    data && !loading && hasInsufficientSnapshots(data.period) && hasNoComparableChanges(data);
  const hasTrendData =
    data &&
    !loading &&
    (data.summary.total_posts > 0 ||
      data.top_gainers.length > 0 ||
      data.top_decliners.length > 0);

  return (
    <DashboardActionModal
      open={open}
      title="Engagement Trends"
      onClose={onClose}
      {...ENGAGEMENT_TRENDS_MODAL_SIZE}
    >
      <div>
        <p style={{ margin: '0 0 16px', fontSize: 13, color: colors.textSecondary, lineHeight: 1.5 }}>
          See how your post engagement has changed between the last two syncs — track growth,
          spot declines, and measure what works.
        </p>

        {!connected && !data && !loading && (
          <CacheEmptyPrompt
            icon="🔗"
            title="LinkedIn not connected"
            description="Connect your LinkedIn account first to view engagement trends."
            buttonLabel="⟳ Sync Posts Now"
            onLoad={handleSync}
            disabled
          />
        )}

        {connected && !data && !loading && !error && (
          <CacheEmptyPrompt
            icon="📈"
            title="No trends yet"
            description="Sync your LinkedIn posts at least twice to see engagement trends."
            buttonLabel="⟳ Sync Posts Now"
            onLoad={handleSync}
            disabled={loading}
          />
        )}

        {connected && !data && !loading && error && (
          <div style={{ textAlign: 'center', padding: '24px 0' }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>⚠️</div>
            <div style={{ fontWeight: 600, fontSize: 14, color: colors.textDark, marginBottom: 6 }}>
              Could not load trends
            </div>
            <div style={{ fontSize: 13, color: '#dc2626', marginBottom: 20 }}>{error}</div>
            <button
              type="button"
              onClick={handleLoad}
              disabled={loading}
              style={{
                ...primaryLoadBtn,
                opacity: loading ? 0.6 : 1,
                cursor: loading ? 'not-allowed' : 'pointer',
              }}
            >
              🔁 Retry
            </button>
          </div>
        )}

        {loading && <LoadingRow message="Computing engagement trends…" />}

        {data && !loading && (
          <>
            {data.last_synced_at && (
              <LastUpdatedBanner
                lastSyncedAt={data.last_synced_at}
                onRefresh={handleSync}
                loading={loading}
              />
            )}

            {!hasInsufficientSnapshots(data.period) && (
              <ComparisonPeriodBlock from={data.period.from} to={data.period.to} />
            )}

            {showInsufficientSnapshots && !data.last_synced_at && (
              <CacheEmptyPrompt
                icon="📈"
                title="No trends yet"
                description="Sync your LinkedIn posts at least twice to see engagement trends."
                buttonLabel="⟳ Sync Posts Now"
                onLoad={handleSync}
                disabled={loading}
              />
            )}

            {showInsufficientSnapshots && data.last_synced_at && (
              <div
                style={{
                  textAlign: 'center',
                  padding: '20px 16px',
                  marginBottom: 8,
                  background: colors.rowBg,
                  border: `1px solid ${colors.border}`,
                  borderRadius: 8,
                }}
              >
                <div style={{ fontSize: 28, marginBottom: 10 }}>📈</div>
                <div style={{ fontWeight: 600, fontSize: 14, color: colors.textDark, marginBottom: 6 }}>
                  Not enough history to compare
                </div>
                <div style={{ fontSize: 13, color: colors.textSecondary, lineHeight: 1.5 }}>
                  Sync again after your post metrics change to build a comparison snapshot.
                </div>
              </div>
            )}

            {showNoChanges && <NoChangesEmptyState />}

            {hasTrendData && data.summary.total_posts > 0 && (
              <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
                <SummaryDeltaCard
                  icon="❤️"
                  label="Reactions"
                  before={data.summary.reactions.before}
                  now={data.summary.reactions.now}
                  delta={data.summary.reactions.delta}
                  pct={data.summary.reactions.pct_change}
                />
                <SummaryDeltaCard
                  icon="💬"
                  label="Comments"
                  before={data.summary.comments.before}
                  now={data.summary.comments.now}
                  delta={data.summary.comments.delta}
                  pct={data.summary.comments.pct_change}
                />
                <SummaryDeltaCard
                  icon="👁️"
                  label="Impressions"
                  before={data.summary.impressions.before}
                  now={data.summary.impressions.now}
                  delta={data.summary.impressions.delta}
                  pct={data.summary.impressions.pct_change}
                />
                <SummaryDeltaCard
                  icon="📊"
                  label="Avg ER"
                  before={Math.round(data.summary.avg_engagement_rate_before * 100)}
                  now={Math.round(data.summary.avg_engagement_rate_now * 100)}
                  delta={Math.round(
                    (data.summary.avg_engagement_rate_now - data.summary.avg_engagement_rate_before) * 100
                  )}
                  pct={0}
                  isRate
                />
              </div>
            )}

            {data.top_gainers.length > 0 && (
              <EngagementGrowthDriversSection period={data.period} summary={data.summary}>
                {data.top_gainers.map((post) => (
                  <PostDeltaRow
                    key={post.post_id}
                    post={post}
                    gain
                    onViewComments={setCommentsPost}
                  />
                ))}
              </EngagementGrowthDriversSection>
            )}

            {data.top_decliners.length > 0 && (
              <div style={{ marginBottom: 14 }}>
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: '#dc2626',
                    textTransform: 'uppercase',
                    letterSpacing: 0.6,
                    marginBottom: 6,
                  }}
                >
                  📉 Top Decliners
                </div>
                {data.top_decliners.map((post) => (
                  <PostDeltaRow
                    key={post.post_id}
                    post={post}
                    gain={false}
                    onViewComments={setCommentsPost}
                  />
                ))}
              </div>
            )}

            <button
              type="button"
              onClick={handleSync}
              disabled={loading}
              style={{
                width: '100%',
                padding: '8px',
                background: 'none',
                border: `1px solid ${colors.border}`,
                borderRadius: 6,
                fontSize: 12,
                color: colors.textSecondary,
                cursor: loading ? 'not-allowed' : 'pointer',
                fontWeight: 600,
                marginTop: 8,
                opacity: loading ? 0.6 : 1,
              }}
            >
              ⟳ Sync Latest & Recompute
            </button>
          </>
        )}
      </div>
      <PostCommentsModal
        open={!!commentsPost}
        post={commentsPost}
        connected={connected}
        onClose={() => setCommentsPost(null)}
      />
    </DashboardActionModal>
  );
};

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

const SummaryDeltaCard: React.FC<{
  icon: string;
  label: string;
  before: number;
  now: number;
  delta: number;
  pct: number;
  isRate?: boolean;
}> = ({ icon, label, before, now, delta, pct, isRate }) => {
  const up = delta >= 0;
  return (
    <div
      style={{
        flex: '1 1 calc(50% - 4px)',
        minWidth: 120,
        padding: '10px 12px',
        background: colors.rowBg,
        border: `1px solid ${colors.border}`,
        borderRadius: 8,
      }}
    >
      <div style={{ fontSize: 11, color: colors.textTertiary, marginBottom: 4, fontWeight: 600 }}>
        {icon} {label}
      </div>
      <div style={{ fontSize: 18, fontWeight: 800, color: up ? '#16a34a' : '#dc2626', marginBottom: 2 }}>
        {isRate ? `${now}%` : now.toLocaleString()}
      </div>
      <div style={{ fontSize: 11, color: colors.textSecondary }}>
        <span style={{ color: up ? '#16a34a' : '#dc2626', fontWeight: 700 }}>
          {up ? '+' : ''}
          {isRate ? `${delta}pp` : delta.toLocaleString()}
        </span>
        {!isRate && pct !== 0 && (
          <span>
            {' '}
            ({up ? '+' : ''}
            {pct}%)
          </span>
        )}
        <span style={{ color: colors.textTertiary }}>
          {' '}
          from {isRate ? `${before}%` : before.toLocaleString()}
        </span>
      </div>
    </div>
  );
};
