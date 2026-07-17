/**
 * F6 — Engagement Since You Joined ALwrity
 *
 * Phase 1 UI shell: title, period chips, Top/Rising/Falling tabs, plain copy.
 * Still loads existing history API; period filter is client-only until Phase 3.
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
import { PostCommentsModal } from './PostCommentsModal';
import { EngagementGrowthDriversSection } from './EngagementGrowthDriversSection';
import { EngagementTrendsSummaryGrid } from './EngagementTrendsSummaryGrid';
import { EngagementTrendsMetadataFooter } from './EngagementTrendsMetadataFooter';
import { EngagementTrendsPeriodChips } from './engagementTrendsPeriodChips';
import { EngagementTrendsPostTabs } from './engagementTrendsPostTabs';
import { EngagementTrendsPostList } from './engagementTrendsPostList';
import {
  EMPTY_COPY,
  ENGAGEMENT_SINCE_SUBTITLE,
  ENGAGEMENT_SINCE_TITLE,
} from './engagementTrendsCopy';
import {
  isSyncOnCooldown,
  postsForTab,
  resolveDefaultPeriod,
  syncCooldownRemainingLabel,
  type EngagementPeriodKey,
  type EngagementPostTab,
} from './engagementTrendsPeriodUtils';

function hasNoComparableChanges(data: PostAnalyticsHistoryResponse): boolean {
  return (
    data.summary.total_posts === 0 &&
    data.top_gainers.length === 0 &&
    data.top_decliners.length === 0
  );
}

function extractErrorMessage(err: unknown): string {
  const axiosErr = err as {
    response?: { data?: { detail?: string | { message?: string } } };
  };
  const detail = axiosErr.response?.data?.detail;
  if (typeof detail === 'string' && detail.trim()) return detail;
  if (detail && typeof detail === 'object' && typeof detail.message === 'string') {
    return detail.message;
  }
  if (err instanceof Error && err.message) return err.message;
  return EMPTY_COPY.loadErrorFallback;
}

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
      {EMPTY_COPY.noChangesTitle}
    </div>
    <div style={{ fontSize: 12, color: colors.textSecondary, lineHeight: 1.45 }}>
      {EMPTY_COPY.noChangesDescription}
    </div>
  </div>
);

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
  const [period, setPeriod] = useState<EngagementPeriodKey>('1d');
  const [activeTab, setActiveTab] = useState<EngagementPostTab>('rising');
  const [nowTick, setNowTick] = useState(() => Date.now());
  const mountedRef = useRef(true);
  const periodInitializedRef = useRef(false);

  const fetchData = useCallback(async (refreshFirst = false) => {
    setLoading(true);
    setError('');
    try {
      if (refreshFirst) {
        await postAnalyticsApi.fetchStoredAnalytics(true);
      }
      const result = await postAnalyticsApi.fetchEngagementHistory();
      if (mountedRef.current) {
        setData(result);
        if (!periodInitializedRef.current) {
          setPeriod(resolveDefaultPeriod(result));
          periodInitializedRef.current = true;
        }
      }
    } catch (err: unknown) {
      if (mountedRef.current) setError(extractErrorMessage(err));
    } finally {
      if (mountedRef.current) {
        setLoading(false);
        setNowTick(Date.now());
      }
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    if (!open) return;
    periodInitializedRef.current = false;
    setLoading(true);
    setError('');
    postAnalyticsApi
      .fetchEngagementHistory()
      .then((result) => {
        if (mountedRef.current) {
          setData(result);
          setPeriod(resolveDefaultPeriod(result));
          periodInitializedRef.current = true;
        }
      })
      .catch((err) => {
        if (mountedRef.current) setError(extractErrorMessage(err));
      })
      .finally(() => {
        if (mountedRef.current) {
          setLoading(false);
          setNowTick(Date.now());
        }
      });
    return () => {
      mountedRef.current = false;
    };
  }, [open]);

  const handleLoad = () => void fetchData(false);
  const syncOnCooldown = isSyncOnCooldown(data?.last_synced_at, nowTick);
  const cooldownHint = syncCooldownRemainingLabel(data?.last_synced_at, nowTick);
  const handleSync = () => {
    if (syncOnCooldown) return;
    void fetchData(true);
  };

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

  const tabPosts = useMemo(() => (data ? postsForTab(activeTab, data) : []), [activeTab, data]);
  const tabCounts = useMemo(() => {
    if (!data) return undefined;
    return {
      top: postsForTab('top', data).length,
      rising: data.top_gainers.length,
      falling: data.top_decliners.length,
    };
  }, [data]);

  return (
    <DashboardActionModal
      open={open}
      title={ENGAGEMENT_SINCE_TITLE}
      onClose={onClose}
      {...ENGAGEMENT_TRENDS_MODAL_SIZE}
    >
      <div style={ENGAGEMENT_TRENDS_BODY_STYLE}>
        <p style={{ margin: '0 0 10px', fontSize: 12, color: colors.textSecondary, lineHeight: 1.45 }}>
          {ENGAGEMENT_SINCE_SUBTITLE}
        </p>

        <EngagementTrendsPeriodChips value={period} onChange={setPeriod} disabled={loading} />

        {!connected && !data && !loading && (
          <CacheEmptyPrompt
            icon="🔗"
            title={EMPTY_COPY.notConnectedTitle}
            description={EMPTY_COPY.notConnectedDescription}
            buttonLabel={EMPTY_COPY.syncButton}
            onLoad={handleSync}
            disabled
          />
        )}

        {connected && !data && !loading && !error && (
          <CacheEmptyPrompt
            icon="📈"
            title={EMPTY_COPY.noDataTitle}
            description={EMPTY_COPY.noDataDescription}
            buttonLabel={EMPTY_COPY.syncButton}
            onLoad={handleSync}
            disabled={loading || syncOnCooldown}
          />
        )}

        {connected && !data && !loading && error && (
          <div style={{ textAlign: 'center', padding: '16px 0' }}>
            <div style={{ fontSize: 28, marginBottom: 8 }}>⚠️</div>
            <div style={{ fontWeight: 600, fontSize: 13, color: colors.textDark, marginBottom: 4 }}>
              {EMPTY_COPY.loadErrorTitle}
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
              {EMPTY_COPY.retry}
            </button>
          </div>
        )}

        {loading && <LoadingRow message={EMPTY_COPY.loading} />}

        {data && !loading && (
          <>
            {showInsufficientSnapshots && !data.last_synced_at && (
              <CacheEmptyPrompt
                icon="📈"
                title={EMPTY_COPY.noDataTitle}
                description={EMPTY_COPY.noDataDescription}
                buttonLabel={EMPTY_COPY.syncButton}
                onLoad={handleSync}
                disabled={loading || syncOnCooldown}
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
                  {EMPTY_COPY.insufficientTitle}
                </div>
                <div style={{ fontSize: 12, color: colors.textSecondary, lineHeight: 1.45 }}>
                  {EMPTY_COPY.insufficientDescription}
                </div>
              </div>
            )}

            {showNoChanges && <NoChangesEmptyState />}

            {hasTrendData && data.summary.total_posts > 0 && (
              <EngagementTrendsSummaryGrid summary={data.summary} />
            )}

            {hasTrendData && (
              <>
                <EngagementTrendsPostTabs
                  value={activeTab}
                  onChange={setActiveTab}
                  counts={tabCounts}
                  disabled={loading}
                />

                {activeTab === 'rising' && data.top_gainers.length > 0 && (
                  <EngagementGrowthDriversSection
                    period={data.period}
                    summary={data.summary}
                    showContributionBadges={showContributionBadges}
                  >
                    <EngagementTrendsPostList
                      tab="rising"
                      posts={tabPosts}
                      showContribution={showContributionBadges}
                      onViewComments={setCommentsPost}
                    />
                  </EngagementGrowthDriversSection>
                )}

                {(activeTab !== 'rising' || data.top_gainers.length === 0) && (
                  <EngagementTrendsPostList
                    tab={activeTab}
                    posts={tabPosts}
                    showContribution={showContributionBadges}
                    onViewComments={setCommentsPost}
                  />
                )}
              </>
            )}

            <button
              type="button"
              onClick={handleSync}
              disabled={loading || syncOnCooldown}
              title={
                syncOnCooldown && cooldownHint
                  ? `${EMPTY_COPY.syncCooldownPrefix} (${cooldownHint})`
                  : undefined
              }
              style={{
                width: '100%',
                padding: '7px',
                background: 'none',
                border: `1px solid ${colors.border}`,
                borderRadius: 6,
                fontSize: 11,
                color: colors.textSecondary,
                cursor: loading || syncOnCooldown ? 'not-allowed' : 'pointer',
                fontWeight: 600,
                marginTop: 4,
                opacity: loading || syncOnCooldown ? 0.6 : 1,
              }}
            >
              {EMPTY_COPY.syncButton}
            </button>
            {syncOnCooldown && cooldownHint && (
              <div
                style={{
                  marginTop: 6,
                  fontSize: 10,
                  color: '#b45309',
                  textAlign: 'center',
                  lineHeight: 1.4,
                }}
              >
                {EMPTY_COPY.syncCooldownPrefix} ({cooldownHint}).
              </div>
            )}

            <EngagementTrendsMetadataFooter
              lastSyncedAt={data.last_synced_at}
              period={data.period}
              showComparison={!hasInsufficientSnapshots(data.period)}
              onRefresh={handleSync}
              loading={loading}
              syncDisabled={syncOnCooldown}
              syncCooldownHint={cooldownHint}
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
