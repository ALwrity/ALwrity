import React, { useCallback, useEffect, useMemo, useState } from "react";
import { usePostAnalytics } from "../../hooks/usePostAnalytics";
import { useLinkedInSocialConnection } from "../../../../hooks/useLinkedInSocialConnection";
import type { LinkedInPost } from "../../../../services/postAnalyticsApi";
import { ProfileGrowthWidget } from "./ProfileGrowthWidget";
import { DailyDigestWidget } from "./DailyDigestWidget";
import { ConnectLockBadge } from "./ConnectLockIcon";

const SIDEBAR_WIDTH = 340;

interface DashboardAnalyticsSidebarProps {
  onViewAll?: () => void;
}

function formatPct(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function MiniBarChart({ posts }: { posts: LinkedInPost[] }) {
  const slices = useMemo(() => {
    const recent = posts.slice(0, 4);
    const max = Math.max(
      1,
      ...recent.map(
        (p) =>
          p.engagement.reactions + p.engagement.comments + p.engagement.reposts,
      ),
    );
    return recent.map((post, i) => {
      const total =
        post.engagement.reactions +
        post.engagement.comments +
        post.engagement.reposts;
      return {
        label: `P${i + 1}`,
        heightPct: (total / max) * 100,
      };
    });
  }, [posts]);

  if (slices.length === 0) return null;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-end",
        gap: 4,
        height: 36,
        paddingTop: 2,
      }}
    >
      {slices.map((slice) => (
        <div
          key={slice.label}
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 2,
          }}
        >
          <div
            style={{
              width: "100%",
              height: `${Math.max(8, slice.heightPct)}%`,
              minHeight: 4,
              background: "linear-gradient(180deg, #0a66c2 0%, #60a5fa 100%)",
              borderRadius: 3,
            }}
          />
          <span style={{ fontSize: 7, color: "#64748b" }}>{slice.label}</span>
        </div>
      ))}
    </div>
  );
}

export const DashboardAnalyticsSidebar: React.FC<
  DashboardAnalyticsSidebarProps
> = ({ onViewAll }) => {
  const { connected, connectWithOAuth } = useLinkedInSocialConnection();
  const { data, panelState, fetchPosts, refreshPosts, errorMessage } = usePostAnalytics();
  const posts = useMemo(() => data?.posts ?? [], [data?.posts]);
  const [profileGrowthReloadToken, setProfileGrowthReloadToken] = useState(0);

  // Initial load — serve from DB cache (positionProfileGrowthWidget populates
  // the cache via /analytics/personal, so posts are fast even on first visit).
  const handleLoadPosts = useCallback(async () => {
    if (panelState === "loading") return;
    // Use DB cache — Profile Growth already synced Unipile on mount.
    await fetchPosts({ limit: 50, refresh: false });
    setProfileGrowthReloadToken((n) => n + 1);
  }, [panelState, fetchPosts]);

  // Refresh — force Unipile fetch for fresh engagement counters.
  const handleRefreshPosts = useCallback(async () => {
    if (panelState === "loading") return;
    await refreshPosts();
    setProfileGrowthReloadToken((n) => n + 1);
  }, [panelState, refreshPosts]);

  // When posts are already loaded (e.g. from Post Analytics modal), refresh
  // Profile Growth so engagements / page viewers match the synced DB.
  useEffect(() => {
    if (panelState === "loaded" && posts.length > 0) {
      setProfileGrowthReloadToken((n) => n + 1);
    }
  }, [panelState, posts.length]);

  const isError = panelState === "error";
  const isLoaded = panelState === "loaded";

  const lastRefreshedLabel = useMemo(() => {
    const syncedAt = data?.last_synced_at;
    if (!syncedAt) return null;
    const delta = Date.now() - new Date(syncedAt).getTime();
    const mins = Math.floor(delta / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  }, [data?.last_synced_at]);

  const totals = useMemo(() => {
    let impressions = 0;
    let clicks = 0;
    let followers = 0;
    let engagements = 0;
    let reach = 0;
    let reachKnown = false;
    let pageViewers = 0;
    let pageViewersKnown = false;
    for (const p of posts) {
      const eng = p.engagement;
      impressions += eng.impressions;
      clicks += eng.clicks;
      followers += eng.followers_gained;
      engagements +=
        eng.engagements != null
          ? eng.engagements
          : eng.reactions + eng.comments + eng.reposts + eng.clicks;
      if (eng.reach != null) {
        reachKnown = true;
        reach += eng.reach;
      }
      if (eng.page_viewers != null) {
        pageViewersKnown = true;
        pageViewers += eng.page_viewers;
      }
    }
    const ctr = impressions > 0 ? clicks / impressions : 0;
    return {
      impressions,
      clicks,
      followers,
      ctr,
      engagements,
      reach: reachKnown ? reach : null,
      pageViewers: pageViewersKnown ? pageViewers : null,
    };
  }, [posts]);

  const isLoading = panelState === "loading";

  return (
    <div
      className={[
        "linkedin-analytics-panel",
        !connected && "linkedin-analytics-panel--disconnected",
      ]
        .filter(Boolean)
        .join(" ")}
      style={!connected ? { maxHeight: "fit-content" } : undefined}
    >
      <div className="linkedin-analytics-panel-header">
        <div className="linkedin-analytics-panel-title-row">
          <h3
            className="linkedin-analytics-panel-title"
            style={{
              margin: 0,
              fontSize: 13,
              fontWeight: 700,
              color: "#0f172a",
            }}
          >
            Analytics
          </h3>
          {!connected && <ConnectLockBadge size={10} />}
        </div>
        {onViewAll && connected && (
          <button
            type="button"
            className="linkedin-analytics-panel-link"
            onClick={onViewAll}
          >
            View all posts
          </button>
        )}
      </div>

      {!connected ? (
        <div style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 6,
          padding: "10px 12px 12px",
        }}>
          <p style={{
            margin: 0,
            fontSize: 11,
            color: "#94a3b8",
            textAlign: "center",
            lineHeight: 1.4,
          }}>
            Connect LinkedIn to see post analytics
          </p>
          <button
            type="button"
            onClick={() => void connectWithOAuth()}
            style={{
              padding: "5px 16px",
              borderRadius: 6,
              border: "none",
              background: "#0a66c2",
              color: "#fff",
              fontSize: 11,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Connect
          </button>
        </div>
      ) : (
        <div
          className="linkedin-analytics-panel-body"
          style={{ maxHeight: 480, overflowY: "auto" }}
        >
          {/* F1 — Profile Growth Snapshot */}
          <ProfileGrowthWidget
            onViewAnalytics={onViewAll}
            reloadToken={profileGrowthReloadToken}
            pageViewersFallback={totals.pageViewers}
          />

          {/* Post engagement mini chart */}
          {isLoading ? (
            <div style={{ fontSize: 10, color: "#64748b", padding: "4px 0", textAlign: "center" }}>
              Loading posts…
            </div>
          ) : posts.length === 0 ? (
            <div style={{ textAlign: "center", padding: "12px 0" }}>
              <button
                type="button"
                onClick={handleLoadPosts}
                style={{
                  padding: "5px 14px", borderRadius: 6, border: "1px solid #d1d5db",
                  background: "#fff", color: "#0a66c2", fontSize: 11, fontWeight: 600, cursor: "pointer",
                }}
              >
                📊 Load Posts
              </button>
            </div>
          ) : isError ? (
            <div style={{ textAlign: "center", padding: "8px 0" }}>
              <p style={{ fontSize: 10, color: "#dc2626", margin: "0 0 6px", lineHeight: 1.4 }}>
                {errorMessage || "Could not load posts. Your LinkedIn account may need reconnection."}
              </p>
              {errorMessage?.toLowerCase().includes("not found") ||
               errorMessage?.toLowerCase().includes("reconnect") ? (
                <button
                  type="button"
                  onClick={() => void connectWithOAuth()}
                  style={{
                    padding: "4px 12px", borderRadius: 4, border: "none",
                    background: "#0a66c2", color: "#fff", fontSize: 10, fontWeight: 700, cursor: "pointer",
                  }}
                >
                  Connect LinkedIn
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleLoadPosts}
                  style={{
                    padding: "4px 10px", borderRadius: 4, border: "1px solid #d1d5db",
                    background: "#fff", color: "#0a66c2", fontSize: 10, fontWeight: 600, cursor: "pointer",
                  }}
                >
                  🔁 Retry
                </button>
              )}
            </div>
          ) : (
            <>
              {posts.length > 0 && (
                <div className="linkedin-analytics-panel-mini-chart">
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginBottom: 4,
                    }}
                  >
                    <div style={{ fontSize: 10, fontWeight: 700, color: "#475569" }}>
                      Post engagement
                    </div>
                    <button
                      type="button"
                      onClick={handleRefreshPosts}
                      disabled={isLoading}
                      style={{
                        background: "none", border: "none", color: isLoading ? "#94a3b8" : "#0a66c2",
                        fontSize: 10, fontWeight: 600, cursor: isLoading ? "default" : "pointer", padding: 0,
                      }}
                    >
                      {isLoading ? "Loading…" : "↻ Refresh"}
                    </button>
                  </div>
                  {lastRefreshedLabel && (
                    <div style={{ fontSize: 8, fontWeight: 500, color: "#94a3b8", textAlign: "right", marginTop: -2, marginBottom: 4 }}>
                      Last refreshed: {lastRefreshedLabel}
                    </div>
                  )}
                  <MiniBarChart posts={posts} />
                </div>
              )}
              <div
                className="linkedin-analytics-panel-stat-grid"
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 5,
                  marginTop: 8,
                }}
              >
                <div className="linkedin-analytics-stat-chip">
                  <div
                    style={{ fontSize: 9, fontWeight: 600, color: "#64748b" }}
                  >
                    Followers
                  </div>
                  <div
                    style={{
                      fontSize: 14,
                      fontWeight: 800,
                      color: "#10b981",
                      marginTop: 2,
                    }}
                  >
                    {`+${totals.followers}`}
                  </div>
                </div>
                <div className="linkedin-analytics-stat-chip">
                  <div
                    style={{ fontSize: 9, fontWeight: 600, color: "#64748b" }}
                  >
                    CTR
                  </div>
                  <div
                    style={{
                      fontSize: 14,
                      fontWeight: 800,
                      color: "#0a66c2",
                      marginTop: 2,
                    }}
                  >
                    {totals.impressions > 0 ? formatPct(totals.ctr) : "—"}
                  </div>
                </div>
                <div className="linkedin-analytics-stat-chip">
                  <div
                    style={{ fontSize: 9, fontWeight: 600, color: "#64748b" }}
                  >
                    Engagements
                  </div>
                  <div
                    style={{
                      fontSize: 14,
                      fontWeight: 800,
                      color: "#4f46e5",
                      marginTop: 2,
                    }}
                  >
                    {totals.engagements}
                  </div>
                </div>
                <div className="linkedin-analytics-stat-chip">
                  <div
                    style={{ fontSize: 9, fontWeight: 600, color: "#64748b" }}
                  >
                    Page viewers
                  </div>
                  <div
                    style={{
                      fontSize: 14,
                      fontWeight: 800,
                      color: "#db2777",
                      marginTop: 2,
                    }}
                  >
                    {totals.pageViewers != null ? totals.pageViewers : "—"}
                  </div>
                </div>
                <div className="linkedin-analytics-stat-chip">
                  <div
                    style={{ fontSize: 9, fontWeight: 600, color: "#64748b" }}
                  >
                    Reached
                  </div>
                  <div
                    style={{
                      fontSize: 14,
                      fontWeight: 800,
                      color: "#0d9488",
                      marginTop: 2,
                    }}
                  >
                    {totals.reach != null ? totals.reach : "—"}
                  </div>
                </div>
              </div>
            </>
          )}

          {/* F3 — Daily AI Digest */}
          <DailyDigestWidget />
        </div>
      )}
    </div>
  );
};

export const DASHBOARD_RIGHT_RAIL_WIDTH = SIDEBAR_WIDTH;
