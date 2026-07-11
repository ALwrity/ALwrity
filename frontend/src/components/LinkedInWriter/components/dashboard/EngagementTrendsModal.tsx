/**
 * F6 — Engagement Trends Modal
 *
 * Compares post engagement between the last two DB snapshot epochs.
 * Extracted from AnalysisWedgeModals.tsx to keep files under 500 lines.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { DashboardActionModal } from './DashboardActionModal';
import {
  postAnalyticsApi,
  type PostAnalyticsHistoryResponse,
  type PostDelta,
} from '../../../../services/postAnalyticsApi';
import { colors } from '../GrowthEngine/styles';
import { hasInsufficientSnapshots } from './engagementTrendsTimeUtils';
import {
  ENGAGEMENT_TRENDS_BODY_STYLE,
  ENGAGEMENT_TRENDS_MODAL_SIZE,
} from './engagementTrendsModalLayout';
import { shouldShowContributionBadges } from './engagementTrendsGrowthUtils';
import { PostDeltaRow } from './PostDeltaRow';
import { PostCommentsModal } from './PostCommentsModal';
import { EngagementGrowthDriversSection } from './EngagementGrowthDriversSection';
import { EngagementTrendsSummaryGrid } from './EngagementTrendsSummaryGrid';
import { EngagementTrendsMetadataFooter } from './EngagementTrendsMetadataFooter';

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
  padding: '8px 18px',
  background: colors.primary,
  color: '#fff',
  border: 'none',
  borderRadius: 8,
  fontSize: 13,
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
  <div style={{ textAlign: 'center', padding: '16px 0' }}>
    <div style={{ fontSize: 28, marginBottom: 8 }}>{icon}</div>
    <div style={{ fontWeight: 600, fontSize: 13, color: colors.textDark, marginBottom: 4 }}>{title}</div>
    <div style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 14 }}>{description}</div>
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
      gap: 10,
      padding: '16px 0',
      justifyContent: 'center',
      color: colors.textSecondary,
      fontSize: 12,
    }}
  >
    <span
      style={{
        display: 'inline-block',
        width: 14,
        height: 14,
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
      padding: '16px 12px',
      marginBottom: 8,
      background: colors.rowBg,
      border: `1px solid ${colors.border}`,
      borderRadius: 8,
    }}
  >
    <div style={{ fontSize: 24, marginBottom: 8 }}>📊</div>
    <div style={{ fontWeight: 600, fontSize: 13, color: colors.textDark, marginBottom: 4 }}>
      No changes detected
    </div>
    <div style={{ fontSize: 12, color: colors.textSecondary, lineHeight: 1.45 }}>
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

  const showContributionBadges = useMemo(
    () => (data ? shouldShowContributionBadges(data.top_gainers) : false),
    [data],
  );

  return (
    <DashboardActionModal
      open={open}
      title="Engagement Trends"
      onClose={onClose}
      {...ENGAGEMENT_TRENDS_MODAL_SIZE}
    >
      <div style={ENGAGEMENT_TRENDS_BODY_STYLE}>
        {!data && !loading && (
          <p style={{ margin: '0 0 12px', fontSize: 12, color: colors.textSecondary, lineHeight: 1.45 }}>
            See how your post engagement has changed between the last two syncs — track growth,
            spot declines, and measure what works.
          </p>
        )}

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
          <div style={{ textAlign: 'center', padding: '16px 0' }}>
            <div style={{ fontSize: 28, marginBottom: 8 }}>⚠️</div>
            <div style={{ fontWeight: 600, fontSize: 13, color: colors.textDark, marginBottom: 4 }}>
              Could not load trends
            </div>
            <div style={{ fontSize: 12, color: '#dc2626', marginBottom: 14 }}>{error}</div>
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
                  padding: '14px 12px',
                  marginBottom: 8,
                  background: colors.rowBg,
                  border: `1px solid ${colors.border}`,
                  borderRadius: 8,
                }}
              >
                <div style={{ fontSize: 24, marginBottom: 8 }}>📈</div>
                <div style={{ fontWeight: 600, fontSize: 13, color: colors.textDark, marginBottom: 4 }}>
                  Not enough history to compare
                </div>
                <div style={{ fontSize: 12, color: colors.textSecondary, lineHeight: 1.45 }}>
                  Sync again after your post metrics change to build a comparison snapshot.
                </div>
              </div>
            )}

            {showNoChanges && <NoChangesEmptyState />}

            {hasTrendData && data.summary.total_posts > 0 && (
              <EngagementTrendsSummaryGrid summary={data.summary} />
            )}

            {data.top_gainers.length > 0 && (
              <EngagementGrowthDriversSection
                period={data.period}
                summary={data.summary}
                showContributionBadges={showContributionBadges}
              >
                {data.top_gainers.map((post) => (
                  <PostDeltaRow
                    key={post.post_id}
                    post={post}
                    gain
                    showContribution={showContributionBadges}
                    onViewComments={setCommentsPost}
                  />
                ))}
              </EngagementGrowthDriversSection>
            )}

            {data.top_decliners.length > 0 && (
              <div style={{ marginBottom: 10 }}>
                <div
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    color: '#dc2626',
                    textTransform: 'uppercase',
                    letterSpacing: 0.5,
                    marginBottom: 6,
                  }}
                >
                  📉 Top decliners
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
                padding: '7px',
                background: 'none',
                border: `1px solid ${colors.border}`,
                borderRadius: 6,
                fontSize: 11,
                color: colors.textSecondary,
                cursor: loading ? 'not-allowed' : 'pointer',
                fontWeight: 600,
                marginTop: 4,
                opacity: loading ? 0.6 : 1,
              }}
            >
              ⟳ Sync Latest & Recompute
            </button>

            <EngagementTrendsMetadataFooter
              lastSyncedAt={data.last_synced_at}
              period={data.period}
              showComparison={!hasInsufficientSnapshots(data.period)}
              onRefresh={handleSync}
              loading={loading}
            />
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
