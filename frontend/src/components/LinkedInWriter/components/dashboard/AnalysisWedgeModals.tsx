/**
 * Analysis Wedge — AI-first feature modals
 *
 * F1  PostTodayModal           — AI-ranked post opportunities (Create wedge)
 * F2  WeeklyPlanModal          — Mon-Fri content plan with Create Now + Schedule CTAs
 * F3  EngagementTrendsModal    — see EngagementTrendsModal.tsx
 */
import React, { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { DashboardActionModal } from "./DashboardActionModal";
import { POST_WEDGE_MODAL_SIZE, POST_WEDGE_MODAL_SIZE_CLASS } from "./wedgeModalLayout";
import {
  linkedInGrowthApi,
  type ConsolidatedGrowthResponse,
  type DailyPostIdea,
} from "../../../../services/linkedInGrowthApi";
import { contentPlanningApi } from "../../../../services/contentPlanningApi";
import { PostTodayCandidateList } from "./PostTodayCandidateList";
import {
  isGrowthDataUsable,
  rankCandidates,
} from "./postTodayGrowthUtils";
import {
  colors,
  rowBase,
} from "../GrowthEngine/styles";
import { CREATE_WEDGE_NESTED_MODAL_SIZE } from "../../utils/createWedgeNestedModalLayout";
import { buildInsightRefreshLabel } from "./growthInsightsFormatUtils";

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

const CACHE_KEY = "alwrity_growth_engine_v3";

interface CachePayload {
  data: ConsolidatedGrowthResponse;
  cachedAt: number;
}

const CACHE_TTL = 3600000; // 1 hour â€” matches backend LLM cache

function readCache(): CachePayload | null {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachePayload;
    if (!parsed.cachedAt || Date.now() - parsed.cachedAt > CACHE_TTL) {
      sessionStorage.removeItem(CACHE_KEY);
      return null;
    }
    if (!isGrowthDataUsable(parsed.data)) {
      sessionStorage.removeItem(CACHE_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function writeCache(data: ConsolidatedGrowthResponse) {
  if (!isGrowthDataUsable(data)) return;
  try {
    sessionStorage.setItem(
      CACHE_KEY,
      JSON.stringify({ data, cachedAt: Date.now() }),
    );
  } catch {
    // storage full â€” silent
  }
}

function openInCreate(topic: string, keyPoints: string, type: string = "post") {
  window.dispatchEvent(
    new CustomEvent("linkedinwriter:openQuickCreate", {
      detail: { type, topic, key_points: keyPoints },
    }),
  );
}

const Spinner = () => (
  <>
    <style>{`@keyframes aw-spin { to { transform: rotate(360deg); } }`}</style>
    <span
      style={{
        display: "inline-block",
        width: 16,
        height: 16,
        border: "2px solid #d1d5db",
        borderTopColor: colors.primary,
        borderRadius: "50%",
        animation: "aw-spin 0.7s linear infinite",
        flexShrink: 0,
      }}
    />
  </>
);

function useGrowthInsights(open: boolean, autoFetch = false) {
  const [data, setData] = useState<ConsolidatedGrowthResponse | null>(null);
  const [cachedAt, setCachedAt] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const autoFetchedRef = useRef(false);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result = await linkedInGrowthApi.analyzeAll();
      if (isGrowthDataUsable(result)) {
        writeCache(result);
        setData(result);
        setCachedAt(Date.now());
      } else {
        sessionStorage.removeItem(CACHE_KEY);
        setData(result);
        setCachedAt(Date.now());
        setError(
          "Analysis completed but no post ideas were returned. Refresh to try again.",
        );
      }
      return result;
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { detail?: string } } };
      const msg = axiosErr.response?.data?.detail;
      setError(
        msg ??
          (err instanceof Error
            ? err.message
            : "Could not load insights. Please try again."),
      );
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open) {
      autoFetchedRef.current = false;
      return;
    }
    const cached = readCache();
    if (cached) {
      setData(cached.data);
      setCachedAt(cached.cachedAt);
      setError("");
      setLoading(false);
      return;
    }
    setData(null);
    setCachedAt(null);
    setError("");
    setLoading(false);

    if (autoFetch && !autoFetchedRef.current) {
      autoFetchedRef.current = true;
      setLoading(true);
      void loadAll();
    }
  }, [open, autoFetch, loadAll]);

  return { data, cachedAt, loading, error, loadAll };
}

const primaryLoadBtn: React.CSSProperties = {
  padding: "10px 24px",
  background: colors.primary,
  color: "#fff",
  border: "none",
  borderRadius: 8,
  fontSize: 14,
  fontWeight: 700,
  cursor: "pointer",
};

const CacheEmptyPrompt: React.FC<{
  icon: string;
  title: string;
  description: string;
  buttonLabel: string;
  onLoad: () => void;
  disabled?: boolean;
}> = ({ icon, title, description, buttonLabel, onLoad, disabled }) => (
  <div style={{ textAlign: "center", padding: "24px 0" }}>
    <div style={{ fontSize: 36, marginBottom: 12 }}>{icon}</div>
    <div
      style={{
        fontWeight: 600,
        fontSize: 14,
        color: colors.textDark,
        marginBottom: 6,
      }}
    >
      {title}
    </div>
    <div
      style={{ fontSize: 13, color: colors.textSecondary, marginBottom: 20 }}
    >
      {description}
    </div>
    <button
      type="button"
      onClick={onLoad}
      disabled={disabled}
      style={{
        ...primaryLoadBtn,
        opacity: disabled ? 0.6 : 1,
        cursor: disabled ? "not-allowed" : "pointer",
      }}
    >
      {buttonLabel}
    </button>
  </div>
);

const LoadingRow: React.FC<{ message: string }> = ({ message }) => (
  <div
    style={{
      display: "flex",
      alignItems: "center",
      gap: 12,
      padding: "24px 0",
      justifyContent: "center",
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
      padding: "10px 14px",
      background: "#fef2f2",
      borderRadius: 8,
      color: "#dc2626",
      fontSize: 13,
      marginBottom: 14,
    }}
  >
    {message}
  </div>
);

const RefreshBar: React.FC<{
  cachedAt: number;
  generatedAt?: string | null;
  onRefresh: () => void;
  label?: string;
}> = ({ cachedAt, generatedAt, onRefresh, label = "Last refreshed" }) => (
  <div
    style={{
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 14,
      fontSize: 11,
      color: colors.textTertiary,
    }}
  >
    <span>{buildInsightRefreshLabel(cachedAt, generatedAt, label)}</span>
    <button
      type="button"
      onClick={onRefresh}
      style={{
        background: "none",
        border: `1px solid ${colors.border}`,
        borderRadius: 5,
        padding: "2px 8px",
        fontSize: 11,
        color: colors.textSecondary,
        cursor: "pointer",
        fontWeight: 600,
      }}
    >
      ↻ Refresh
    </button>
  </div>
);

// ---------------------------------------------------------------------------
// F1 — Post Today Modal
// ---------------------------------------------------------------------------

interface PostTodayModalProps {
  open: boolean;
  onClose: () => void;
  /** Stack above Quick Create Post window — same size as Brainstorm Ideas. */
  stacked?: boolean;
  /** When stacked, apply selection to the open Post form instead of opening a new Create flow. */
  onApplyCandidate?: (topic: string, hook: string) => void;
}

export const PostTodayModal: React.FC<PostTodayModalProps> = ({
  open,
  onClose,
  stacked = false,
  onApplyCandidate,
}) => {
  const { data, cachedAt, loading, error, loadAll } = useGrowthInsights(open, true);
  const candidates = useMemo(() => (data ? rankCandidates(data) : []), [data]);
  const handleLoadAll = () => void loadAll();

  return (
    <DashboardActionModal
      open={open}
      title="What Should I Post Today?"
      onClose={onClose}
      width={stacked ? CREATE_WEDGE_NESTED_MODAL_SIZE.width : undefined}
      maxWidth={stacked ? CREATE_WEDGE_NESTED_MODAL_SIZE.maxWidth : 560}
      height={stacked ? CREATE_WEDGE_NESTED_MODAL_SIZE.height : undefined}
      maxHeight={stacked ? CREATE_WEDGE_NESTED_MODAL_SIZE.maxHeight : "min(92vh, 700px)"}
      elevated={stacked}
      modalClassName={
        stacked
          ? "linkedin-post-today-modal linkedin-post-today-modal--stacked"
          : "linkedin-post-today-modal"
      }
    >
      <div>
        <p
          style={{
            margin: "0 0 16px",
            fontSize: 13,
            color: colors.textSecondary,
            lineHeight: 1.5,
          }}
        >
          ALwrity-ranked post opportunities across all your growth signals — trending
          topics, content gaps, weekly strategy, and engagement wins.
        </p>

        {loading && (
          <LoadingRow
            message={
              data
                ? "Refreshing insights…"
                : "Running AI analysis across all growth signals…"
            }
          />
        )}

        {/* No cache / fetch failed / empty analysis */}
        {!loading && candidates.length === 0 && (
          <CacheEmptyPrompt
            icon="🎯"
            title={
              error
                ? error.includes("no post ideas")
                  ? "No post recommendations yet"
                  : "Failed to load insights"
                : "No insights loaded yet"
            }
            description={
              error ||
              "Run your AI growth analysis to get ranked post recommendations from trending topics, content gaps, and more."
            }
            buttonLabel={error ? "🔄 Refresh Insights" : "🚀 Load Insights"}
            onLoad={handleLoadAll}
            disabled={loading}
          />
        )}

        {/* Ranked candidates with tabs */}
        {!loading && candidates.length > 0 && (
          <>
            {cachedAt && (
              <RefreshBar
                cachedAt={cachedAt}
                generatedAt={data?.generated_at}
                onRefresh={handleLoadAll}
              />
            )}
            <PostTodayCandidateList
              candidates={candidates}
              onUseCandidate={(topic, hook) => {
                if (onApplyCandidate) {
                  onApplyCandidate(topic, hook);
                } else {
                  openInCreate(topic, hook);
                }
                onClose();
              }}
            />
          </>
        )}
      </div>
    </DashboardActionModal>
  );
};

// ---------------------------------------------------------------------------
// F2 — Weekly Content Plan Modal
// ---------------------------------------------------------------------------

const DAY_EMOJIS: Record<string, string> = {
  Monday: "ðŸŸ¦",
  Tuesday: "ðŸŸ©",
  Wednesday: "ðŸŸ§",
  Thursday: "ðŸŸª",
  Friday: "ðŸŸ¥",
  Saturday: "â¬œ",
  Sunday: "â¬œ",
};

interface WeeklyPlanModalProps {
  open: boolean;
  onClose: () => void;
}

export const WeeklyPlanModal: React.FC<WeeklyPlanModalProps> = ({
  open,
  onClose,
}) => {
  const { data, loading, error, loadAll } = useGrowthInsights(open);
  const [scheduling, setScheduling] = useState<number | null>(null);
  const [scheduled, setScheduled] = useState<number[]>([]);
  const [scheduleError, setScheduleError] = useState("");

  useEffect(() => {
    if (!open) return;
    setScheduled([]);
    setScheduleError("");
  }, [open]);

  const handleLoad = () => void loadAll();

  const ws = data?.weekly_strategy;
  const posts: DailyPostIdea[] = ws?.daily_posts ?? [];

  const getNextWeekday = (dayName: string): string => {
    const days: Record<string, number> = {
      Monday: 1,
      Tuesday: 2,
      Wednesday: 3,
      Thursday: 4,
      Friday: 5,
      Saturday: 6,
      Sunday: 0,
    };
    const today = new Date();
    const targetDay = days[dayName] ?? 1;
    const todayDay = today.getDay();
    let daysAhead = targetDay - todayDay;
    if (daysAhead <= 0) daysAhead += 7;
    const target = new Date(today);
    target.setDate(today.getDate() + daysAhead);
    return target.toISOString().split("T")[0];
  };

  const handleScheduleAll = async () => {
    if (!posts.length) return;
    setScheduleError("");
    const results = await Promise.allSettled(
      posts.map((post, i) =>
        contentPlanningApi
          .createEventSafe({
            title: post.headline,
            description: `Hook: ${post.hook}\n\n${post.why_this_works}`,
            date: getNextWeekday(post.day),
            platform: "linkedin",
            content_type: post.content_type,
            status: "draft",
          })
          .then(() => i),
      ),
    );
    const succeeded = results
      .filter(
        (r): r is PromiseFulfilledResult<number> => r.status === "fulfilled",
      )
      .map((r) => r.value);
    setScheduled(succeeded);
    if (succeeded.length < posts.length) {
      setScheduleError(
        `Scheduled ${succeeded.length}/${posts.length} posts. Some may have failed.`,
      );
    }
  };

  const handleScheduleOne = async (post: DailyPostIdea, idx: number) => {
    setScheduling(idx);
    setScheduleError("");
    try {
      await contentPlanningApi.createEventSafe({
        title: post.headline,
        description: `Hook: ${post.hook}\n\n${post.why_this_works}`,
        date: getNextWeekday(post.day),
        platform: "linkedin",
        content_type: post.content_type,
        status: "draft",
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
      {...POST_WEDGE_MODAL_SIZE}
      modalClassName={POST_WEDGE_MODAL_SIZE_CLASS}
    >
      <div>
        <p
          style={{
            margin: "0 0 14px",
            fontSize: 13,
            color: colors.textSecondary,
            lineHeight: 1.5,
          }}
        >
          AI-generated 5-day content plan. Create posts or add to your calendar
          with one click.
        </p>

        {!data && !loading && (
          <CacheEmptyPrompt
            icon="ðŸ“…"
            title="No weekly plan in cache"
            description="Generate a personalised Monâ€“Fri content plan."
            buttonLabel="ðŸš€ Generate Weekly Plan"
            onLoad={handleLoad}
          />
        )}

        {loading && <LoadingRow message="Building your weekly content planâ€¦" />}
        {error && <ErrorBanner message={error} />}

        {ws && !loading && (
          <>
            {/* Plan header */}
            <div
              style={{
                background: "#eff6ff",
                border: "1px solid #bfdbfe",
                borderRadius: 10,
                padding: "12px 16px",
                marginBottom: 14,
              }}
            >
              <div
                style={{
                  fontWeight: 700,
                  fontSize: 14,
                  color: "#1e40af",
                  marginBottom: 2,
                }}
              >
                Week of {ws.week_of} Â· {ws.theme}
              </div>
              <div style={{ fontSize: 12, color: "#3b82f6" }}>
                Focus: {ws.focus_area} Â· Topics: {ws.key_topics.join(", ")}
              </div>
            </div>

            {/* Day cards */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 10,
                marginBottom: 14,
              }}
            >
              {posts.map((post, idx) => {
                const isScheduled = scheduled.includes(idx);
                const isSchedulingThis = scheduling === idx;
                return (
                  <div
                    key={idx}
                    style={{
                      ...rowBase,
                      borderLeft: `3px solid ${isScheduled ? "#22c55e" : colors.border}`,
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "flex-start",
                        marginBottom: 6,
                        gap: 8,
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 7,
                        }}
                      >
                        <span style={{ fontSize: 16 }}>
                          {DAY_EMOJIS[post.day] ?? "ðŸ“Œ"}
                        </span>
                        <div>
                          <span
                            style={{
                              fontSize: 10,
                              fontWeight: 800,
                              color: colors.textTertiary,
                              textTransform: "uppercase",
                              letterSpacing: 0.6,
                              display: "block",
                            }}
                          >
                            {post.day}
                          </span>
                          <span
                            style={{
                              fontWeight: 700,
                              fontSize: 13,
                              color: colors.textDark,
                            }}
                          >
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
                          padding: "2px 7px",
                          borderRadius: 4,
                          whiteSpace: "nowrap",
                          flexShrink: 0,
                        }}
                      >
                        {post.content_type}
                      </span>
                    </div>

                    <div
                      style={{
                        fontSize: 11,
                        fontStyle: "italic",
                        color: colors.textSecondary,
                        background: colors.badgeBg,
                        padding: "5px 9px",
                        borderRadius: 5,
                        marginBottom: 8,
                        lineHeight: 1.5,
                      }}
                    >
                      ðŸ’¡ "{post.hook}"
                    </div>

                    <div
                      style={{
                        display: "flex",
                        gap: 8,
                        alignItems: "center",
                        flexWrap: "wrap",
                      }}
                    >
                      <button
                        onClick={() => {
                          openInCreate(
                            post.headline,
                            post.hook,
                            post.content_type,
                          );
                          onClose();
                        }}
                        style={{
                          padding: "5px 12px",
                          background: colors.primary,
                          color: "#fff",
                          border: "none",
                          borderRadius: 6,
                          fontSize: 11,
                          fontWeight: 600,
                          cursor: "pointer",
                        }}
                      >
                        âœï¸ Create Now
                      </button>
                      <button
                        disabled={isScheduled || isSchedulingThis}
                        onClick={() => void handleScheduleOne(post, idx)}
                        style={{
                          padding: "5px 12px",
                          background: isScheduled ? "#dcfce7" : "none",
                          color: isScheduled ? "#166534" : colors.textSecondary,
                          border: `1px solid ${isScheduled ? "#86efac" : colors.border}`,
                          borderRadius: 6,
                          fontSize: 11,
                          fontWeight: 600,
                          cursor: isScheduled ? "default" : "pointer",
                          display: "flex",
                          alignItems: "center",
                          gap: 4,
                        }}
                      >
                        {isSchedulingThis ? (
                          <>
                            <Spinner /> Addingâ€¦
                          </>
                        ) : isScheduled ? (
                          "âœ“ Scheduled"
                        ) : (
                          "ðŸ“… Add to Calendar"
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {scheduleError && (
              <div
                style={{
                  padding: "8px 12px",
                  background: "#fef9c3",
                  borderRadius: 7,
                  color: "#854d0e",
                  fontSize: 12,
                  marginBottom: 10,
                }}
              >
                {scheduleError}
              </div>
            )}

            {/* Schedule all CTA */}
            {scheduled.length < posts.length && (
              <button
                onClick={() => void handleScheduleAll()}
                disabled={loading}
                style={{
                  width: "100%",
                  padding: "10px",
                  background: "#059669",
                  color: "#fff",
                  border: "none",
                  borderRadius: 8,
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                ðŸ“… Schedule All {posts.length} Posts to Calendar
              </button>
            )}

            {scheduled.length === posts.length && posts.length > 0 && (
              <div
                style={{
                  textAlign: "center",
                  padding: "12px",
                  background: "#dcfce7",
                  borderRadius: 8,
                  color: "#166534",
                  fontWeight: 700,
                  fontSize: 13,
                }}
              >
                âœ… All {posts.length} posts added to your calendar!
              </div>
            )}
          </>
        )}
      </div>
    </DashboardActionModal>
  );
};

