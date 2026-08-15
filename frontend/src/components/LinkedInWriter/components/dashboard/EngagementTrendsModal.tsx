/**
 * F6 — Engagement Since You Joined ALwrity
 *
 * Phase 3: period chips refetch `?period=`; tabs bind Top/Rising/Falling from API.
 */
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { DashboardActionModal } from "./DashboardActionModal";
import {
  postAnalyticsApi,
  type PostAnalyticsHistoryResponse,
  type PostDelta,
} from "../../../../services/postAnalyticsApi";
import { colors } from "../GrowthEngine/styles";
import { ENGAGEMENT_TRENDS_BODY_STYLE } from "./engagementTrendsModalLayout";
import { shouldShowContributionBadges } from "./engagementTrendsGrowthUtils";
import { PostCommentsModal } from "./PostCommentsModal";
import { EngagementTrendsSummaryGrid } from "./EngagementTrendsSummaryGrid";
import { EngagementTrendsInsightsRow } from "./EngagementTrendsInsightsRow";
import { EngagementTrendsPeriodChips } from "./engagementTrendsPeriodChips";
import { EngagementTrendsPostTabs } from "./engagementTrendsPostTabs";
import { EngagementTrendsPostList } from "./engagementTrendsPostList";
import {
  EMPTY_COPY,
  ENGAGEMENT_SINCE_SUBTITLE,
  ENGAGEMENT_SINCE_TITLE,
} from "./engagementTrendsCopy";
import {
  WEDGE_BACK_LABELS,
  wedgePostSizeModalClassName,
  wedgePostSizeSubModalProps,
} from "./wedgeModalUi";
import { extractEngagementTrendsErrorMessage } from "./engagementTrendsErrors";
import {
  CacheEmptyPrompt,
  InsufficientHistoryState,
  LoadErrorState,
  LoadingRow,
  NoChangesEmptyState,
} from "./engagementTrendsModalStates";
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
} from "./engagementTrendsPeriodUtils";

function hasNoComparableChanges(data: PostAnalyticsHistoryResponse): boolean {
  const rising = data.rising_posts?.length
    ? data.rising_posts
    : data.top_gainers;
  const falling = data.falling_posts?.length
    ? data.falling_posts
    : data.top_decliners;
  return (
    data.summary.total_posts === 0 &&
    rising.length === 0 &&
    falling.length === 0
  );
}

export interface EngagementTrendsModalProps {
  open: boolean;
  onClose: () => void;
  onBack?: () => void;
  connected?: boolean;
}

export const EngagementTrendsModal: React.FC<EngagementTrendsModalProps> = ({
  open,
  onClose,
  onBack,
  connected,
}) => {
  const [data, setData] = useState<PostAnalyticsHistoryResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [commentsPost, setCommentsPost] = useState<PostDelta | null>(null);
  const [period, setPeriod] = useState<EngagementPeriodKey>("since_joining");
  const [activeTab, setActiveTab] = useState<EngagementPostTab>("rising");
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
      setError("");
      try {
        if (opts.refreshFirst) {
          await postAnalyticsApi.fetchStoredAnalytics(true);
        }
        let result = await postAnalyticsApi.fetchEngagementHistory(
          opts.periodKey,
        );
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
        if (mountedRef.current)
          setError(extractEngagementTrendsErrorMessage(err));
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
    void fetchData({ periodKey: "since_joining", initDefault: true });
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
  const syncOnCooldown = isSyncOnCooldown(
    data?.last_synced_at,
    nowTick,
    cooldownMs,
  );
  const cooldownHint = syncCooldownRemainingLabel(
    data?.last_synced_at,
    nowTick,
    cooldownMs,
  );
  const handleSync = () => {
    if (syncOnCooldown) return;
    void fetchData({ periodKey: periodRef.current, refreshFirst: true });
  };

  const insufficient = Boolean(data && !loading && isInsufficientHistory(data));
  const showNoChanges = Boolean(
    data && !loading && !insufficient && hasNoComparableChanges(data),
  );
  const risingList = data ? postsForTab("rising", data) : [];
  const hasTrendData = Boolean(
    data &&
    !loading &&
    !insufficient &&
    (data.summary.total_posts > 0 ||
      postsForTab("top", data).length > 0 ||
      risingList.length > 0 ||
      postsForTab("falling", data).length > 0),
  );

  const showContributionBadges = useMemo(
    () => shouldShowContributionBadges(risingList),
    [risingList],
  );

  const tabPosts = useMemo(
    () => (data ? postsForTab(activeTab, data) : []),
    [activeTab, data],
  );
  const tabCounts = useMemo(() => {
    if (!data) return undefined;
    return {
      top: postsForTab("top", data).length,
      rising: postsForTab("rising", data).length,
      falling: postsForTab("falling", data).length,
    };
  }, [data]);

  const commentsOpen = !!commentsPost;
  const showGrowthDrivers = activeTab === "rising" && risingList.length > 0;

  return (
    <>
      <DashboardActionModal
        open={open && !commentsOpen}
        title={ENGAGEMENT_SINCE_TITLE}
        onClose={onClose}
        onBack={onBack}
        {...wedgePostSizeSubModalProps(WEDGE_BACK_LABELS.analysis)}
        modalClassName={wedgePostSizeModalClassName()}
      >
        <div style={ENGAGEMENT_TRENDS_BODY_STYLE}>
          <p
            style={{
              margin: "0 0 10px",
              fontSize: 12,
              color: colors.textSecondary,
              lineHeight: 1.45,
            }}
          >
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
            <LoadErrorState
              error={error}
              onRetry={handleLoad}
              loading={loading}
            />
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
                <InsufficientHistoryState
                  message={insufficientHistoryMessage(data)}
                />
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

                  <EngagementTrendsInsightsRow
                    summary={data.summary}
                    showGrowthDrivers={showGrowthDrivers}
                    showContributionBadges={showContributionBadges}
                    lastSyncedAt={data.last_synced_at}
                    period={data.period}
                    showComparison={!insufficient}
                    onRefresh={handleSync}
                    loading={loading}
                    syncDisabled={syncOnCooldown}
                    syncCooldownHint={cooldownHint}
                  />

                  <EngagementTrendsPostList
                    tab={activeTab}
                    posts={tabPosts}
                    showContribution={
                      showContributionBadges && activeTab === "rising"
                    }
                    onViewComments={setCommentsPost}
                  />
                </>
              )}

              {!hasTrendData && (
                <EngagementTrendsInsightsRow
                  summary={data.summary}
                  showGrowthDrivers={false}
                  showContributionBadges={false}
                  lastSyncedAt={data.last_synced_at}
                  period={data.period}
                  showComparison={!insufficient}
                  onRefresh={handleSync}
                  loading={loading}
                  syncDisabled={syncOnCooldown}
                  syncCooldownHint={cooldownHint}
                />
              )}
            </>
          )}
        </div>
      </DashboardActionModal>
      <PostCommentsModal
        open={commentsOpen}
        post={commentsPost}
        connected={connected}
        onClose={() => setCommentsPost(null)}
        onBack={() => setCommentsPost(null)}
        backLabel="Engagement Trends"
      />
    </>
  );
};
