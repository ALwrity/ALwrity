/**
 * Remarket Wedge — 5 AI-first feature modals (priority order)
 *
 * R1  RepurposeLabModal       — see repurposeLab/ (extracted module)
 * R2  FormatTransformerModal  — see formatTransformer/ (extracted module)
 * R3  ContentRefreshModal     — last 5 posts with 7 one-click edit transforms
 * R4  StaleReviverModal       — buried high-performing posts, Update & New Angle CTAs
 * R5  PerfToPlanModal         — see perfToPlan/ (extracted module)
 */
import React, { useEffect, useState, useMemo } from "react";
import { DashboardActionModal } from "./DashboardActionModal";
import { type LinkedInPost } from "../../../../services/postAnalyticsApi";
import {
  linkedInWriterApi,
  saveLinkedInToAssetLibrary,
  type LinkedInEditContentRequest,
} from "../../../../services/linkedInWriterApi";
import { colors, rowBase } from "../GrowthEngine/styles";
import {
  WEDGE_BACK_LABELS,
  wedgePostSizeModalClassName,
  wedgePostSizeSubModalProps,
} from "./wedgeModalUi";
import {
  ageInDays,
  engagementScore,
  formatRate,
  postSnippet,
} from "./remarkWedgeShared/postMetrics";
import { useRemarketPosts } from "./remarkWedgeShared/useRemarketPosts";
import {
  RemarkWedgeEmptyPrompt as EmptyPrompt,
  RemarkWedgeErrorBanner as ErrorBanner,
  RemarkWedgeLoadingRow as LoadingRow,
  RemarkWedgeMetricPill as MetricPill,
  RemarkWedgeSavedBadge as SavedBadge,
  RemarkWedgeSpinner as Spinner,
} from "./remarkWedgeShared/remarkWedgeSharedUi";

export { RepurposeLabModal } from "./repurposeLab";
export type { RepurposeLabModalProps } from "./repurposeLab";

// ─────────────────────────────────────────────────────────────────────────────
// Shared constants & helpers
// ─────────────────────────────────────────────────────────────────────────────

function pushDraftToStudio(text: string) {
  window.dispatchEvent(
    new CustomEvent("linkedinwriter:updateDraft", { detail: text }),
  );
}

function openInCreate(type: string, topic: string, keyPoints: string) {
  window.dispatchEvent(
    new CustomEvent("linkedinwriter:openQuickCreate", {
      detail: { type, topic, key_points: keyPoints },
    }),
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// R3 — Content Refresh Studio
// ─────────────────────────────────────────────────────────────────────────────

const EDIT_ACTIONS: {
  type: LinkedInEditContentRequest["edit_type"];
  icon: string;
  label: string;
  color: string;
}[] = [
  { type: "optimize_engagement", icon: "⚡", label: "Boost", color: "#f59e0b" },
  {
    type: "professionalize",
    icon: "💼",
    label: "Professionalise",
    color: "#0a66c2",
  },
  { type: "add_cta", icon: "📣", label: "Add CTA", color: "#059669" },
  { type: "add_hashtags", icon: "#️⃣", label: "Hashtags", color: "#8b5cf6" },
  { type: "expand", icon: "↕", label: "Expand", color: "#0ea5e9" },
  { type: "condense", icon: "↙", label: "Condense", color: "#dc2626" },
  { type: "adjust_tone", icon: "🎭", label: "Tone", color: "#475569" },
];

interface ContentRefreshModalProps {
  open: boolean;
  onClose: () => void;
  onBack?: () => void;
}

export const ContentRefreshModal: React.FC<ContentRefreshModalProps> = ({
  open,
  onClose,
  onBack,
}) => {
  const { posts, loading, error, reload } = useRemarketPosts(open, 5);
  const [activePost, setActivePost] = useState<string | null>(null);
  const [transforming, setTransforming] = useState<string | null>(null);
  const [results, setResults] = useState<
    Record<string, { editType: string; before: string; after: string }>
  >({});
  const [saved, setSaved] = useState<Record<string, boolean>>({});
  const [transformError, setTransformError] = useState("");

  useEffect(() => {
    if (open) {
      setActivePost(null);
      setResults({});
      setSaved({});
    }
  }, [open]);

  const handleTransform = async (
    post: LinkedInPost,
    editType: LinkedInEditContentRequest["edit_type"],
  ) => {
    const key = `${post.id}_${editType}`;
    setTransforming(key);
    setTransformError("");
    try {
      const res = await linkedInWriterApi.editContent({
        content: post.text,
        edit_type: editType,
      });
      setResults((prev) => ({
        ...prev,
        [key]: { editType, before: post.text, after: res.content ?? "" },
      }));
      setActivePost(post.id);
    } catch {
      setTransformError("Transform failed. Please try again.");
    } finally {
      setTransforming(null);
    }
  };

  const handleSave = async (key: string, after: string, postId: string) => {
    try {
      await saveLinkedInToAssetLibrary({
        title: `Refreshed LinkedIn Post`,
        content: after,
        tags: ["refreshed"],
      });
      setSaved((prev) => ({ ...prev, [key]: true }));
    } catch {
      setTransformError("Could not save.");
    }
  };

  const recentPosts = posts.slice(0, 5);

  return (
    <DashboardActionModal
      open={open}
      title="Content Refresh Studio"
      onClose={onClose}
      onBack={onBack}
      {...wedgePostSizeSubModalProps(WEDGE_BACK_LABELS.remarket)}
      modalClassName={wedgePostSizeModalClassName()}
    >
      <p
        style={{
          margin: "0 0 14px",
          fontSize: 13,
          color: colors.textSecondary,
          lineHeight: 1.5,
        }}
      >
        Pick any recent post and apply one of 7 AI transforms in a single click
        — then copy, edit, or save.
      </p>

      {loading && <LoadingRow message="Loading your recent posts…" />}
      {error && <ErrorBanner msg={error} />}
      {transformError && <ErrorBanner msg={transformError} />}
      {!loading && !error && recentPosts.length === 0 && (
        <EmptyPrompt
          icon="📝"
          title="No posts found"
          desc="Connect LinkedIn to see your recent posts here."
          btnLabel="Retry"
          onLoad={reload}
        />
      )}

      {!loading &&
        recentPosts.map((post) => {
          const isActive = activePost === post.id;
          const engRate = formatRate(post.engagement?.engagement_rate ?? 0);
          const isLow = (post.engagement?.engagement_rate ?? 0) < 0.02;
          return (
            <div
              key={post.id}
              style={{
                ...rowBase,
                marginBottom: 10,
                borderLeft: `3px solid ${isLow ? "#f59e0b" : colors.border}`,
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  marginBottom: 8,
                  gap: 8,
                }}
              >
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: colors.textDark,
                    flex: 1,
                    lineHeight: 1.4,
                  }}
                >
                  {postSnippet(post.text, 80)}
                </div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    flexShrink: 0,
                  }}
                >
                  {isLow && (
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        background: "#fef9c3",
                        color: "#854d0e",
                        padding: "1px 5px",
                        borderRadius: 3,
                      }}
                    >
                      needs refresh
                    </span>
                  )}
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      color: colors.textSecondary,
                    }}
                  >
                    {engRate}
                  </span>
                </div>
              </div>

              <div
                style={{
                  display: "flex",
                  gap: 6,
                  flexWrap: "wrap",
                  marginBottom: isActive ? 10 : 0,
                }}
              >
                {EDIT_ACTIONS.map((a) => {
                  const key = `${post.id}_${a.type}`;
                  const isRunning = transforming === key;
                  return (
                    <button
                      key={a.type}
                      type="button"
                      onClick={() => void handleTransform(post, a.type)}
                      disabled={!!transforming}
                      style={{
                        padding: "4px 10px",
                        background: isRunning ? a.color : `${a.color}18`,
                        border: `1px solid ${a.color}55`,
                        borderRadius: 5,
                        fontSize: 11,
                        fontWeight: 600,
                        color: isRunning ? "#fff" : a.color,
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: 3,
                      }}
                    >
                      {isRunning ? (
                        <>
                          <Spinner />
                        </>
                      ) : (
                        a.icon
                      )}{" "}
                      {a.label}
                    </button>
                  );
                })}
              </div>

              {/* Show latest result for this post */}
              {Object.entries(results)
                .filter(([k]) => k.startsWith(post.id + "_"))
                .sort(([a], [b]) => (a > b ? -1 : 1))
                .slice(0, 1)
                .map(([key, r]) => (
                  <div
                    key={key}
                    style={{
                      marginTop: 8,
                      background: "#eff6ff",
                      border: "1px solid #bfdbfe",
                      borderRadius: 8,
                      padding: "10px 12px",
                    }}
                  >
                    <div
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        color: "#1e40af",
                        marginBottom: 6,
                      }}
                    >
                      {EDIT_ACTIONS.find((a) => a.type === r.editType)?.icon}{" "}
                      {EDIT_ACTIONS.find((a) => a.type === r.editType)?.label}{" "}
                      result
                    </div>
                    <div
                      style={{
                        fontSize: 12,
                        color: "#1e3a5f",
                        lineHeight: 1.6,
                        whiteSpace: "pre-wrap",
                        marginBottom: 8,
                      }}
                    >
                      {r.after.slice(0, 400)}
                      {r.after.length > 400 ? "…" : ""}
                    </div>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <button
                        type="button"
                        onClick={() => {
                          pushDraftToStudio(r.after);
                          onClose();
                        }}
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
                        ✏️ Edit in Studio
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleSave(key, r.after, post.id)}
                        disabled={!!saved[key]}
                        style={{
                          padding: "5px 12px",
                          background: saved[key] ? "#dcfce7" : "none",
                          color: saved[key] ? "#166534" : colors.textSecondary,
                          border: `1px solid ${saved[key] ? "#86efac" : colors.border}`,
                          borderRadius: 6,
                          fontSize: 11,
                          cursor: "pointer",
                          fontWeight: 600,
                          display: "flex",
                          alignItems: "center",
                          gap: 4,
                        }}
                      >
                        {saved[key] ? (
                          <>
                            <SavedBadge />
                          </>
                        ) : (
                          "💾 Save"
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          void navigator.clipboard.writeText(r.after);
                        }}
                        style={{
                          padding: "5px 10px",
                          background: "none",
                          border: `1px solid ${colors.border}`,
                          borderRadius: 6,
                          fontSize: 11,
                          color: colors.textTertiary,
                          cursor: "pointer",
                        }}
                      >
                        📋
                      </button>
                    </div>
                  </div>
                ))}
            </div>
          );
        })}
    </DashboardActionModal>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// R4 — Stale Content Reviver
// ─────────────────────────────────────────────────────────────────────────────

interface StaleReviverModalProps {
  open: boolean;
  onClose: () => void;
  onBack?: () => void;
}

export const StaleReviverModal: React.FC<StaleReviverModalProps> = ({
  open,
  onClose,
  onBack,
}) => {
  const { posts, loading, error, reload } = useRemarketPosts(open, 20);
  const [reviving, setReviving] = useState<string | null>(null);
  const [revived, setRevived] = useState<Record<string, string>>({});
  const [reviveError, setReviveError] = useState("");

  useEffect(() => {
    if (open) {
      setRevived({});
      setReviveError("");
    }
  }, [open]);

  const gems = useMemo(
    () =>
      [...posts]
        .filter((p) => ageInDays(p.created_at) >= 14)
        .sort((a, b) => engagementScore(b) - engagementScore(a))
        .slice(0, 3),
    [posts],
  );

  const handleRevive = async (post: LinkedInPost) => {
    setReviving(post.id);
    setReviveError("");
    try {
      // Chain: expand → optimize_engagement
      const expanded = await linkedInWriterApi.editContent({
        content: post.text,
        edit_type: "expand",
      });
      const optimised = await linkedInWriterApi.editContent({
        content: expanded.content ?? post.text,
        edit_type: "optimize_engagement",
      });
      setRevived((prev) => ({
        ...prev,
        [post.id]: optimised.content ?? post.text,
      }));
    } catch {
      setReviveError("Revival failed. Please try again.");
    } finally {
      setReviving(null);
    }
  };

  return (
    <DashboardActionModal
      open={open}
      title="Stale Content Reviver"
      onClose={onClose}
      onBack={onBack}
      {...wedgePostSizeSubModalProps(WEDGE_BACK_LABELS.remarket)}
      modalClassName={wedgePostSizeModalClassName()}
    >
      <p
        style={{
          margin: "0 0 14px",
          fontSize: 13,
          color: colors.textSecondary,
          lineHeight: 1.5,
        }}
      >
        High-performing posts that haven't been seen in a while. Refresh them
        with expanded content and stronger hooks.
      </p>

      {loading && <LoadingRow message="Finding your buried gems…" />}
      {error && <ErrorBanner msg={error} />}
      {reviveError && <ErrorBanner msg={reviveError} />}

      {!loading && !error && posts.length > 0 && gems.length === 0 && (
        <EmptyPrompt
          icon="🌱"
          title="All posts are fresh"
          desc="Come back after 14 days to revive your older high-performing content."
        />
      )}
      {!loading && !error && posts.length === 0 && (
        <EmptyPrompt
          icon="📭"
          title="No posts found"
          desc="Connect LinkedIn to discover revival opportunities."
          btnLabel="Retry"
          onLoad={reload}
        />
      )}

      {!loading &&
        gems.map((post) => {
          const days = ageInDays(post.created_at);
          const isReviving = reviving === post.id;
          const revivedText = revived[post.id];
          return (
            <div
              key={post.id}
              style={{
                ...rowBase,
                marginBottom: 12,
                borderLeft: "3px solid #f59e0b",
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
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 12,
                      fontWeight: 600,
                      color: colors.textDark,
                      lineHeight: 1.4,
                      marginBottom: 3,
                    }}
                  >
                    {postSnippet(post.text, 90)}
                  </div>
                  <div
                    style={{
                      display: "flex",
                      gap: 8,
                      alignItems: "center",
                      flexWrap: "wrap",
                    }}
                  >
                    <span
                      style={{
                        fontSize: 10,
                        background: "#fef9c3",
                        color: "#854d0e",
                        padding: "1px 6px",
                        borderRadius: 3,
                        fontWeight: 700,
                      }}
                    >
                      {days}d ago
                    </span>
                    <MetricPill
                      icon="❤️"
                      value={post.engagement.reactions ?? 0}
                      label="react."
                    />
                    <MetricPill
                      icon="💬"
                      value={post.engagement.comments ?? 0}
                      label="comments"
                    />
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        color: "#166534",
                      }}
                    >
                      {formatRate(post.engagement.engagement_rate ?? 0)} eng.
                    </span>
                  </div>
                </div>
              </div>

              {revivedText ? (
                <div
                  style={{
                    background: "#f0fdf4",
                    border: "1px solid #86efac",
                    borderRadius: 8,
                    padding: "10px 12px",
                    marginBottom: 8,
                  }}
                >
                  <div
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      color: "#166534",
                      marginBottom: 6,
                    }}
                  >
                    ✨ Revived Version
                  </div>
                  <div
                    style={{
                      fontSize: 12,
                      color: "#14532d",
                      lineHeight: 1.65,
                      whiteSpace: "pre-wrap",
                      marginBottom: 8,
                    }}
                  >
                    {revivedText.slice(0, 300)}
                    {revivedText.length > 300 ? "…" : ""}
                  </div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <button
                      type="button"
                      onClick={() => {
                        pushDraftToStudio(revivedText);
                        onClose();
                      }}
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
                      ✏️ Edit in Studio
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        void navigator.clipboard.writeText(revivedText);
                      }}
                      style={{
                        padding: "5px 10px",
                        background: "none",
                        border: `1px solid ${colors.border}`,
                        borderRadius: 6,
                        fontSize: 11,
                        color: colors.textTertiary,
                        cursor: "pointer",
                      }}
                    >
                      📋 Copy
                    </button>
                  </div>
                </div>
              ) : (
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button
                    type="button"
                    onClick={() => void handleRevive(post)}
                    disabled={!!reviving}
                    style={{
                      padding: "5px 14px",
                      background: isReviving ? "#f59e0b" : "#fef9c3",
                      color: isReviving ? "#fff" : "#854d0e",
                      border: "1.5px solid #f59e0b",
                      borderRadius: 6,
                      fontSize: 11,
                      fontWeight: 700,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: 5,
                    }}
                  >
                    {isReviving ? (
                      <>
                        <Spinner /> Reviving…
                      </>
                    ) : (
                      "✨ Revive & Refresh"
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      openInCreate(
                        "post",
                        post.title ?? "Post",
                        `New angle on: ${post.text.slice(0, 200)}`,
                      );
                      onClose();
                    }}
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
                    💡 New Angle
                  </button>
                </div>
              )}
            </div>
          );
        })}
    </DashboardActionModal>
  );
};

export { PerfToPlanModal } from "./perfToPlan";
