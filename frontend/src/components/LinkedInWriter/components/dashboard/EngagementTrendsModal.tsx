/**
 * F6 — Engagement Since You Joined ALwrity
 *
 * Phase 3: period chips refetch `?period=`; tabs bind Top/Rising/Falling from API.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { DashboardActionModal } from './DashboardActionModal';
import {
  postAnalyticsApi,
  type PostAnalyticsHistoryResponse,
  type PostDelta,
} from '../../../../services/postAnalyticsApi';
import { colors } from '../GrowthEngine/styles';
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
  insufficientHistoryMessage,
  isInsufficientHistory,
  isSyncOnCooldown,
  postsForTab,
  resolveDefaultPeriod,
  resolveSyncCooldownMs,
  syncCooldownRemainingLabel,
  type EngagementPeriodKey,
  type EngagementPostTab,
} from './engagementTrendsPeriodUtils';

function hasNoComparableChanges(data: PostAnalyticsHistoryResponse): boolean {
  const rising = data.rising_posts?.length ? data.rising_posts : data.top_gainers;
  const falling = data.falling_posts?.length ? data.falling_posts : data.top_decliners;
  return data.summary.total_posts === 0 && rising.length === 0 && falling.length === 0;
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
  const [period, setPeriod] = useState<EngagementPeriodKey>('since_joining');
  const [activeTab, setActiveTab] = useState<EngagementPostTab>('rising');
  const [nowTick, setNowTick] = useState(() => Date.now());
  const mountedRef = useRef(true);
  const periodInitializedRef = useRef(false);
  const periodRef = useRef(period);
  periodRef.current = period;

  const fetchData = useCallback(
    async (opts: {
      periodKey: EngagementPeriodKey;
      refreshFirst?: boolean;
      initDefault?: boolean;
    }) => {
      setLoading(true);
      setError('');
      try {
        if (opts.refreshFirst) {
          await postAnalyticsApi.fetchStoredAnalytics(true);
        }
        let result = await postAnalyticsApi.fetchEngagementHistory(opts.periodKey);
        if (!mountedRef.current) return;

        if (opts.initDefault && !periodInitializedRef.current) {
          const preferred = resolveDefaultPeriod(result);
          periodInitializedRef.current = true;
          setPeriod(preferred);
          if (preferred !== opts.periodKey) {
            result = await postAnalyticsApi.fetchEngagementHistory(preferred);
            if (!mountedRef.current) return;
          }
        }

        setData(result);
      } catch (err: unknown) {
        if (mountedRef.current) setError(extractErrorMessage(err));
      } finally {
        if (mountedRef.current) {
          setLoading(false);
          setNowTick(Date.now());
        }
      }
    },
    [],
  );

  useEffect(() => {
    mountedRef.current = true;
    if (!open) return;
    periodInitializedRef.current = false;
    void fetchData({ periodKey: 'since_joining', initDefault: true });
    return () => {
      mountedRef.current = false;
    };
  }, [open, fetchData]);

  const handlePeriodChange = (next: EngagementPeriodKey) => {
    setPeriod(next);
    void fetchData({ periodKey: next });
  };

  const handleLoad = () => void fetchData({ periodKey: periodRef.current });
  const cooldownMs = resolveSyncCooldownMs(data);
  const syncOnCooldown = isSyncOnCooldown(data?.last_synced_at, nowTick, cooldownMs);
  const cooldownHint = syncCooldownRemainingLabel(data?.last_synced_at, nowTick, cooldownMs);
  const handleSync = () => {
    if (syncOnCooldown) return;
    void fetchData({ periodKey: periodRef.current, refreshFirst: true });
  };

  const insufficient = Boolean(data && !loading && isInsufficientHistory(data));
  const showNoChanges =
    Boolean(data && !loading && !insufficient && hasNoComparableChanges(data));
  const risingList = data ? postsForTab('rising', data) : [];
  const hasTrendData =
    Boolean(
      data &&
        !loading &&
        !insufficient &&
        (data.summary.total_posts > 0 ||
          postsForTab('top', data).length > 0 ||
          risingList.length > 0 ||
          postsForTab('falling', data).length > 0),
    );

  const showContributionBadges = useMemo(
    () => shouldShowContributionBadges(risingList),
    [risingList],
  );

  const tabPosts = useMemo(() => (data ? postsForTab(activeTab, data) : []), [activeTab, data]);
  const tabCounts = useMemo(() => {
    if (!data) return undefined;
    return {
      top: postsForTab('top', data).length,
      rising: postsForTab('rising', data).length,
      falling: postsForTab('falling', data).length,
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

        <EngagementTrendsPeriodChips
          value={period}
          onChange={handlePeriodChange}
          disabled={loading}
        />

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
            {insufficient && !data.last_synced_at && (
              <CacheEmptyPrompt
                icon="📈"
                title={EMPTY_COPY.noDataTitle}
                description={insufficientHistoryMessage(data)}
                buttonLabel={EMPTY_COPY.syncButton}
                onLoad={handleSync}
                disabled={loading || syncOnCooldown}
              />
            )}

            {insufficient && data.last_synced_at && (
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
                  {insufficientHistoryMessage(data)}
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

                {activeTab === 'rising' && risingList.length > 0 && (
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

                {(activeTab !== 'rising' || risingList.length === 0) && (
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
              showComparison={!insufficient}
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
