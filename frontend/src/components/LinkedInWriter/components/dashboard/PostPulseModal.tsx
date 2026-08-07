/**
 * E3 — Post Engagement Pulse (Engagement wedge).
 */
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { DashboardActionModal } from "./DashboardActionModal";
import { colors, rowBase } from "../GrowthEngine/styles";
import { linkedInWriterApi } from "../../../../services/linkedInWriterApi";
import {
  postAnalyticsApi,
  type LinkedInPost,
} from "../../../../services/postAnalyticsApi";
import { pushDraftToStudio } from "./engagementWedgeDraftUtils";
import {
  EngagementConnectPrompt,
  EngagementEmptyPrompt,
  EngagementErrorBanner,
  EngagementLoadingRow,
  EngagementRefreshBar,
  EngagementSpinner,
} from "./engagementWedgeSharedUi";
import {
  ENGAGEMENT_RETURN,
  openQuickCreateFromWedge,
} from "./engagementWedgeNavigation";
import {
  buildPostPulseCreatePayload,
} from "./postPulseCreateUtils";

export interface PostPulseModalProps {
  open: boolean;
  onClose: () => void;
  onBack?: () => void;
  connected?: boolean;
}

export const PostPulseModal: React.FC<PostPulseModalProps> = ({
  open,
  onClose,
  onBack,
  connected = true,
}) => {
  const [posts, setPosts] = useState<LinkedInPost[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [boosting, setBoosting] = useState<string | null>(null);
  const [boosted, setBoosted] = useState<Record<string, string>>({});
  const [loadedAt, setLoadedAt] = useState<number | null>(null);

  const fetchPosts = useCallback(async (refresh = false) => {
    setLoading(true);
    setError("");
    try {
      const res = await postAnalyticsApi.fetchStoredAnalytics(refresh);
      const fetched = res.posts ?? [];
      setPosts(fetched);
      if (fetched.length > 0) setLoadedAt(Date.now());
    } catch {
      setError("Could not load your posts. Make sure LinkedIn is connected.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    setError("");
    setBoosted({});
    setPosts([]);
    setLoadedAt(null);
    void fetchPosts(false);
  }, [open, fetchPosts]);

  const sorted = useMemo(
    () =>
      [...posts].sort(
        (a, b) =>
          (b.engagement?.engagement_rate ?? 0) -
          (a.engagement?.engagement_rate ?? 0),
      ),
    [posts],
  );
  const topPosts = sorted.slice(0, 3);
  const bottomPost = sorted[sorted.length - 1];

  const openPostInCreate = useCallback(
    (post: LinkedInPost, mode: "repurpose" | "write_more") => {
      const payload = buildPostPulseCreatePayload(post, mode);

      openQuickCreateFromWedge({
        type: "post",
        topic: payload.topic,
        key_points: payload.key_points,
        reference_context: payload.reference_context,
        reference_mode: payload.reference_mode,
        returnTo: ENGAGEMENT_RETURN.pulse,
      });
      onClose();
    },
    [onClose],
  );

  const handleBoost = async (post: LinkedInPost) => {
    setBoosting(post.id);
    try {
      const res = await linkedInWriterApi.editContent({
        content: post.text,
        edit_type: "optimize_engagement",
      });
      const improved = res.content ?? "";
      setBoosted((prev) => ({ ...prev, [post.id]: improved }));
    } catch {
      setError("Could not boost this post. Please try again.");
    } finally {
      setBoosting(null);
    }
  };

  return (
    <DashboardActionModal
      open={open}
      title="Post Engagement Pulse"
      onClose={onClose}
      onBack={onBack}
      backLabel="Engagement"
      titleSize="xl"
      maxWidth={580}
      maxHeight="min(92vh, 740px)"
    >
      <p
        style={{
          margin: "0 0 14px",
          fontSize: 13,
          color: colors.textSecondary,
          lineHeight: 1.5,
        }}
      >
        Real engagement metrics from your recent LinkedIn posts. Repurpose
        winners and boost underperformers.
      </p>

      {loading && (
        <EngagementLoadingRow message="Loading your post metrics from LinkedIn…" />
      )}
      {error && <EngagementErrorBanner msg={error} />}

      {!loading && posts.length === 0 && !connected && !error && (
        <EngagementConnectPrompt message="Connect your LinkedIn account to view engagement metrics for your published posts." />
      )}

      {!loading && posts.length === 0 && connected && !error && (
        <EngagementEmptyPrompt
          icon="📊"
          title="No posts loaded yet"
          desc="Load your recent LinkedIn posts to see engagement metrics."
          btnLabel="🚀 Load Posts"
          onLoad={() => void fetchPosts(false)}
        />
      )}

      {!loading && topPosts.length > 0 && (
        <>
          {loadedAt && (
            <EngagementRefreshBar
              cachedAt={loadedAt}
              onRefresh={() => void fetchPosts(true)}
              loading={loading}
            />
          )}

          <SectionHeader icon="🏆" label="Top Performing Posts" />
          {topPosts.map((post) => (
            <PostMetricsRow
              key={post.id}
              post={post}
              boostedVersion={boosted[post.id]}
              isBoosting={boosting === post.id}
              onRepurpose={() => openPostInCreate(post, "repurpose")}
              onWriteMore={() => openPostInCreate(post, "write_more")}
              onBoost={() => void handleBoost(post)}
              onAcceptBoost={() => {
                pushDraftToStudio(boosted[post.id]);
                onClose();
              }}
            />
          ))}

          {bottomPost && !topPosts.includes(bottomPost) && (
            <>
              <SectionHeader icon="⬇️" label="Needs a Boost" />
              <PostMetricsRow
                post={bottomPost}
                boostedVersion={boosted[bottomPost.id]}
                isBoosting={boosting === bottomPost.id}
                onRepurpose={() => openPostInCreate(bottomPost, "repurpose")}
                onWriteMore={() => openPostInCreate(bottomPost, "write_more")}
                onBoost={() => void handleBoost(bottomPost)}
                onAcceptBoost={() => {
                  pushDraftToStudio(boosted[bottomPost.id]);
                  onClose();
                }}
                dim
              />
            </>
          )}
        </>
      )}
    </DashboardActionModal>
  );
};

const SectionHeader: React.FC<{ icon: string; label: string }> = ({
  icon,
  label,
}) => (
  <div
    style={{
      display: "flex",
      alignItems: "center",
      gap: 6,
      margin: "14px 0 8px",
      fontSize: 12,
      fontWeight: 700,
      color: colors.textSecondary,
      textTransform: "uppercase",
      letterSpacing: "0.04em",
    }}
  >
    <span style={{ fontSize: 14 }}>{icon}</span>
    {label}
  </div>
);

interface PostMetricsRowProps {
  post: LinkedInPost;
  boostedVersion?: string;
  isBoosting: boolean;
  onRepurpose: () => void;
  onWriteMore: () => void;
  onBoost: () => void;
  onAcceptBoost: () => void;
  dim?: boolean;
}

const PostMetricsRow: React.FC<PostMetricsRowProps> = ({
  post,
  boostedVersion,
  isBoosting,
  onRepurpose,
  onWriteMore,
  onBoost,
  onAcceptBoost,
  dim,
}) => {
  const m = post.engagement;
  const rate = m?.engagement_rate ?? 0;
  const ratePct = (rate * 100).toFixed(1);
  const rateColor =
    rate >= 0.05 ? "#166534" : rate >= 0.02 ? "#854d0e" : "#991b1b";
  const rateBg =
    rate >= 0.05 ? "#dcfce7" : rate >= 0.02 ? "#fef9c3" : "#fee2e2";
  const snippet = post.text.slice(0, 100) + (post.text.length > 100 ? "…" : "");

  return (
    <div style={{ ...rowBase, marginBottom: 10, opacity: dim ? 0.85 : 1 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: 8,
          marginBottom: 8,
        }}
      >
        <div
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: colors.textDark,
            flex: 1,
            lineHeight: 1.4,
          }}
        >
          {snippet}
        </div>
        <span
          style={{
            fontSize: 11,
            fontWeight: 800,
            background: rateBg,
            color: rateColor,
            padding: "2px 7px",
            borderRadius: 5,
            whiteSpace: "nowrap",
            flexShrink: 0,
          }}
        >
          {ratePct}% eng.
        </span>
      </div>
      <div style={{ display: "flex", gap: 12, marginBottom: 10 }}>
        <MetricChip icon="❤️" value={m?.reactions ?? 0} label="reactions" />
        <MetricChip icon="💬" value={m?.comments ?? 0} label="comments" />
        <MetricChip icon="🔁" value={m?.reposts ?? 0} label="reposts" />
        <MetricChip icon="👁️" value={m?.impressions ?? 0} label="views" />
      </div>

      {boostedVersion ? (
        <div
          style={{
            background: "#eff6ff",
            border: "1px solid #bfdbfe",
            borderRadius: 7,
            padding: "8px 10px",
            marginBottom: 8,
          }}
        >
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: "#1e40af",
              marginBottom: 4,
            }}
          >
            ⚡ Boosted Version
          </div>
          <div
            style={{
              fontSize: 12,
              color: "#1e3a5f",
              lineHeight: 1.55,
              whiteSpace: "pre-wrap",
            }}
          >
            {boostedVersion.slice(0, 200)}
            {boostedVersion.length > 200 ? "…" : ""}
          </div>
          <button
            type="button"
            onClick={onAcceptBoost}
            style={{
              marginTop: 8,
              padding: "5px 12px",
              background: colors.primary,
              color: "#fff",
              border: "none",
              borderRadius: 6,
              fontSize: 11,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            ✅ Use in Studio
          </button>
        </div>
      ) : (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={onRepurpose}
            style={{
              padding: "5px 12px",
              background: colors.primary,
              color: "#fff",
              border: "none",
              borderRadius: 6,
              fontSize: 11,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            ♻️ Repurpose
          </button>
          <button
            type="button"
            onClick={onWriteMore}
            style={{
              padding: "5px 12px",
              background: "none",
              border: `1.5px solid ${colors.primary}`,
              borderRadius: 6,
              fontSize: 11,
              fontWeight: 600,
              color: colors.primary,
              cursor: "pointer",
            }}
          >
            ✍️ Write More Like This
          </button>
          {dim && (
            <button
              type="button"
              onClick={onBoost}
              disabled={isBoosting}
              style={{
                padding: "5px 12px",
                background: "#f59e0b",
                color: "#fff",
                border: "none",
                borderRadius: 6,
                fontSize: 11,
                fontWeight: 700,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 4,
              }}
            >
              {isBoosting ? (
                <>
                  <EngagementSpinner /> Boosting…
                </>
              ) : (
                "⚡ Boost Engagement"
              )}
            </button>
          )}
        </div>
      )}
    </div>
  );
};

const MetricChip: React.FC<{ icon: string; value: number; label: string }> = ({
  icon,
  value,
  label,
}) => (
  <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
    <span style={{ fontSize: 12 }}>{icon}</span>
    <span style={{ fontSize: 12, fontWeight: 700, color: colors.textDark }}>
      {value.toLocaleString()}
    </span>
    <span style={{ fontSize: 10, color: colors.textTertiary }}>{label}</span>
  </div>
);
