/**
 * Remarket Wedge — 5 AI-first feature modals (priority order)
 *
 * R1  RepurposeLabModal       — see repurposeLab/ (extracted module)
 * R2  FormatTransformerModal  — current draft → Article / Carousel / Video Script
 * R3  ContentRefreshModal     — last 5 posts with 7 one-click edit transforms
 * R4  StaleReviverModal       — buried high-performing posts, Update & New Angle CTAs
 * R5  PerfToPlanModal         — extract winning topics, generate 5 remix ideas
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

const DRAFT_KEY = "alwrity-copilot-draft-content";

function readDraft(): string {
  try {
    return localStorage.getItem(DRAFT_KEY) ?? "";
  } catch {
    return "";
  }
}

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

function extractTopics(posts: LinkedInPost[]): string[] {
  const words = posts
    .flatMap((p) => p.text.split(/\s+/).slice(0, 20))
    .filter((w) => w.length > 4 && !/^(https?|www\.|#)/.test(w))
    .map((w) => w.replace(/[^a-zA-Z0-9 ]/g, "").toLowerCase());
  const freq: Record<string, number> = {};
  for (const w of words) {
    freq[w] = (freq[w] ?? 0) + 1;
  }
  return Object.entries(freq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map((e) => e[0]);
}

// ─────────────────────────────────────────────────────────────────────────────
// R2 — Format Transformer
// ─────────────────────────────────────────────────────────────────────────────

const FORMAT_OPTIONS = [
  {
    type: "article",
    icon: "📄",
    label: "Article",
    desc: "Long-form thought leadership piece",
    accent: "#057642",
  },
  {
    type: "carousel",
    icon: "🎠",
    label: "Carousel",
    desc: "Visual slide deck (5-8 slides)",
    accent: "#8b5cf6",
  },
  {
    type: "video_script",
    icon: "🎬",
    label: "Video Script",
    desc: "Hook, main content, CTA",
    accent: "#dc2626",
  },
] as const;

type FormatType = (typeof FORMAT_OPTIONS)[number]["type"];

interface FormatTransformerModalProps {
  open: boolean;
  onClose: () => void;
}

export const FormatTransformerModal: React.FC<FormatTransformerModalProps> = ({
  open,
  onClose,
}) => {
  const [draft, setDraft] = useState("");
  const [generating, setGenerating] = useState<FormatType | null>(null);
  const [result, setResult] = useState<{
    type: FormatType;
    content: string;
    title: string;
  } | null>(null);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!open) return;
    setDraft(readDraft());
    setResult(null);
    setError("");
    setSaved(false);
  }, [open]);

  const handleTransform = async (type: FormatType) => {
    if (!draft.trim()) {
      setError("Please write or paste a post first.");
      return;
    }
    setGenerating(type);
    setError("");
    setResult(null);
    try {
      const topic = draft.slice(0, 80).replace(/\n/g, " ").trim();
      let content = "";
      let title = "";

      if (type === "article") {
        const res = await linkedInWriterApi.generateArticle({
          topic,
          industry: "",
          key_sections: [draft],
        });
        if (!res.success || !res.data)
          throw new Error(res.error ?? "Generation failed");
        title = res.data.title;
        content = `# ${res.data.title}\n\n${res.data.content}`;
      } else if (type === "carousel") {
        const res = await linkedInWriterApi.generateCarousel({
          topic,
          industry: "",
          key_takeaways: [draft],
        });
        if (!res.success || !res.data)
          throw new Error(res.error ?? "Generation failed");
        title = res.data.title;
        content = [
          `# ${res.data.title}`,
          ...(res.data.slides ?? []).map(
            (s) => `**Slide ${s.slide_number}: ${s.title}**\n${s.content}`,
          ),
        ].join("\n\n");
      } else {
        const res = await linkedInWriterApi.generateVideoScript({
          topic,
          industry: "",
          key_messages: [draft],
        });
        if (!res.success || !res.data)
          throw new Error(res.error ?? "Generation failed");
        title = "Video Script";
        content = [
          `🎬 Hook: ${res.data.hook}`,
          "",
          res.data.main_content
            .map((s, i) => `Scene ${i + 1}: ${JSON.stringify(s)}`)
            .join("\n"),
          "",
          `✅ Conclusion: ${res.data.conclusion}`,
          "",
          `📝 Description: ${res.data.video_description}`,
        ].join("\n");
      }
      setResult({ type, content, title });
    } catch (e: any) {
      setError(e?.message ?? "Generation failed. Please try again.");
    } finally {
      setGenerating(null);
    }
  };

  const handleSave = async () => {
    if (!result) return;
    try {
      await saveLinkedInToAssetLibrary({
        title: result.title || "Transformed Content",
        content: result.content,
        topic: result.title,
        tags: [result.type],
      });
      setSaved(true);
    } catch {
      setError("Could not save to library.");
    }
  };

  const fmt = FORMAT_OPTIONS.find((f) => f.type === result?.type);

  return (
    <DashboardActionModal
      open={open}
      title="Format Transformer"
      onClose={onClose}
      maxWidth={600}
      maxHeight="min(92vh, 780px)"
    >
      <p
        style={{
          margin: "0 0 14px",
          fontSize: 13,
          color: colors.textSecondary,
          lineHeight: 1.5,
        }}
      >
        Transform your post or draft into a completely different format.
        Auto-fills from your current draft.
      </p>

      {!result && (
        <>
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: colors.textMedium,
              marginBottom: 6,
            }}
          >
            Your Post / Draft
          </div>
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Paste your post here, or open the editor first to auto-fill…"
            style={{
              width: "100%",
              minHeight: 100,
              padding: "9px 11px",
              borderRadius: 8,
              border: `1.5px solid ${colors.border}`,
              fontSize: 12,
              resize: "vertical",
              fontFamily: "inherit",
              lineHeight: 1.6,
              color: colors.textBody,
              boxSizing: "border-box",
              marginBottom: 12,
            }}
          />

          {error && <ErrorBanner msg={error} />}

          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: colors.textMedium,
              marginBottom: 8,
            }}
          >
            Transform to:
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: 10,
            }}
          >
            {FORMAT_OPTIONS.map((f) => (
              <button
                key={f.type}
                type="button"
                onClick={() => void handleTransform(f.type)}
                disabled={!!generating || !draft.trim()}
                style={{
                  padding: "14px 10px",
                  background:
                    generating === f.type ? f.accent : `${f.accent}15`,
                  border: `2px solid ${generating === f.type ? f.accent : `${f.accent}55`}`,
                  borderRadius: 10,
                  cursor: draft.trim() ? "pointer" : "default",
                  opacity: !draft.trim() ? 0.5 : 1,
                  textAlign: "center",
                  transition: "all 0.15s",
                }}
              >
                <div style={{ fontSize: 24, marginBottom: 6 }}>{f.icon}</div>
                <div
                  style={{
                    fontWeight: 700,
                    fontSize: 13,
                    color: generating === f.type ? "#fff" : f.accent,
                    marginBottom: 4,
                  }}
                >
                  {f.label}
                </div>
                <div
                  style={{
                    fontSize: 11,
                    color:
                      generating === f.type ? "#ffffffcc" : colors.textTertiary,
                    lineHeight: 1.3,
                  }}
                >
                  {f.desc}
                </div>
                {generating === f.type && (
                  <div
                    style={{
                      marginTop: 8,
                      display: "flex",
                      justifyContent: "center",
                      alignItems: "center",
                      gap: 6,
                      fontSize: 11,
                      color: "#fff",
                    }}
                  >
                    <Spinner /> Generating…
                  </div>
                )}
              </button>
            ))}
          </div>
        </>
      )}

      {result && fmt && (
        <>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              marginBottom: 12,
            }}
          >
            <span style={{ fontSize: 20 }}>{fmt.icon}</span>
            <div
              style={{ fontWeight: 700, fontSize: 14, color: colors.textDark }}
            >
              {result.title || fmt.label}
            </div>
            {saved && <SavedBadge />}
          </div>

          <div
            style={{
              background: colors.rowBg,
              border: `1.5px solid ${fmt.accent}44`,
              borderLeft: `4px solid ${fmt.accent}`,
              borderRadius: 8,
              padding: "12px 14px",
              maxHeight: 280,
              overflowY: "auto",
              fontSize: 12,
              color: colors.textBody,
              lineHeight: 1.7,
              whiteSpace: "pre-wrap",
              marginBottom: 12,
            }}
          >
            {result.content}
          </div>

          {error && <ErrorBanner msg={error} />}

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={() => {
                pushDraftToStudio(result.content);
                onClose();
              }}
              style={{
                flex: 1,
                padding: "9px",
                background: fmt.accent,
                color: "#fff",
                border: "none",
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              ✏️ Edit in Studio
            </button>
            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={saved}
              style={{
                padding: "9px 16px",
                background: saved ? "#dcfce7" : "none",
                color: saved ? "#166534" : colors.textSecondary,
                border: `1.5px solid ${saved ? "#86efac" : colors.border}`,
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 600,
                cursor: saved ? "default" : "pointer",
              }}
            >
              {saved ? "✓ Saved" : "💾 Save to Library"}
            </button>
            <button
              type="button"
              onClick={() => {
                setResult(null);
                setSaved(false);
              }}
              style={{
                padding: "9px 14px",
                background: "none",
                border: `1px solid ${colors.border}`,
                borderRadius: 8,
                fontSize: 12,
                color: colors.textTertiary,
                cursor: "pointer",
              }}
            >
              ↩ Try Another
            </button>
          </div>
        </>
      )}
    </DashboardActionModal>
  );
};

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
}

export const ContentRefreshModal: React.FC<ContentRefreshModalProps> = ({
  open,
  onClose,
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
      maxWidth={620}
      maxHeight="min(92vh, 780px)"
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
}

export const StaleReviverModal: React.FC<StaleReviverModalProps> = ({
  open,
  onClose,
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
      maxWidth={580}
      maxHeight="min(92vh, 720px)"
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

// ─────────────────────────────────────────────────────────────────────────────
// R5 — Performance-to-Plan Bridge
// ─────────────────────────────────────────────────────────────────────────────

interface RemixIdea {
  topic: string;
  angle: string;
  sourcePost: string;
}

function buildRemixIdeas(posts: LinkedInPost[]): RemixIdea[] {
  const topPosts = [...posts]
    .sort((a, b) => engagementScore(b) - engagementScore(a))
    .slice(0, 5);
  return topPosts.map((p) => {
    const sentences = p.text.split(/[.!?]/);
    const topic = (p.title ?? sentences[0] ?? "").slice(0, 80).trim();
    const angle = sentences[1]?.trim().slice(0, 100) ?? p.text.slice(0, 100);
    return { topic, angle, sourcePost: p.text.slice(0, 200) };
  });
}

const REMIX_ANGLES = [
  "What I learned from this",
  "The contrarian take",
  "Step-by-step breakdown",
  "Common myths debunked",
  "Behind the scenes story",
];

interface PerfToPlanModalProps {
  open: boolean;
  onClose: () => void;
}

export const PerfToPlanModal: React.FC<PerfToPlanModalProps> = ({
  open,
  onClose,
}) => {
  const { posts, loading, error, reload } = useRemarketPosts(open, 10);
  const [ideas, setIdeas] = useState<RemixIdea[]>([]);

  useEffect(() => {
    if (!open) return;
    setIdeas([]);
  }, [open]);

  useEffect(() => {
    if (posts.length > 0) {
      setIdeas(buildRemixIdeas(posts));
    }
  }, [posts]);

  const topTopics = useMemo(
    () =>
      extractTopics(
        [...posts]
          .sort((a, b) => engagementScore(b) - engagementScore(a))
          .slice(0, 5),
      ),
    [posts],
  );

  return (
    <DashboardActionModal
      open={open}
      title="Performance-to-Plan Bridge"
      onClose={onClose}
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
        Your top-performing topics, turned into 5 ready-to-create post ideas.
        Based on what's already proven to work.
      </p>

      {loading && (
        <LoadingRow message="Analysing your top-performing content…" />
      )}
      {error && <ErrorBanner msg={error} />}
      {!loading && !error && posts.length === 0 && (
        <EmptyPrompt
          icon="📈"
          title="No posts found"
          desc="Connect LinkedIn and publish posts to generate remix ideas."
          btnLabel="Retry"
          onLoad={reload}
        />
      )}

      {!loading && topTopics.length > 0 && (
        <div
          style={{
            background: "#eff6ff",
            border: "1px solid #bfdbfe",
            borderRadius: 8,
            padding: "10px 14px",
            marginBottom: 14,
          }}
        >
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: "#1e40af",
              marginBottom: 6,
              textTransform: "uppercase",
              letterSpacing: 0.5,
            }}
          >
            🔍 Your Winning Topics
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {topTopics.map((t) => (
              <span
                key={t}
                style={{
                  fontSize: 11,
                  background: "#dbeafe",
                  color: "#1d4ed8",
                  padding: "2px 8px",
                  borderRadius: 4,
                  fontWeight: 600,
                }}
              >
                {t}
              </span>
            ))}
          </div>
        </div>
      )}

      {!loading && ideas.length > 0 && (
        <>
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: colors.textTertiary,
              textTransform: "uppercase",
              letterSpacing: 0.5,
              marginBottom: 8,
            }}
          >
            5 Remix Ideas from Your Best Content
          </div>
          {ideas.map((idea, idx) => (
            <div
              key={idx}
              style={{
                ...rowBase,
                marginBottom: 10,
                borderLeft: `3px solid ${idx === 0 ? "#f59e0b" : colors.border}`,
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  gap: 8,
                  marginBottom: 6,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 800,
                      background: idx === 0 ? "#fef9c3" : "#f1f5f9",
                      color: idx === 0 ? "#854d0e" : colors.textTertiary,
                      padding: "1px 6px",
                      borderRadius: 3,
                    }}
                  >
                    Idea #{idx + 1}
                  </span>
                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: 700,
                      color: colors.textDark,
                    }}
                  >
                    {idea.topic || `Remix of your post #${idx + 1}`}
                  </div>
                </div>
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
                💡 Angle: "{REMIX_ANGLES[idx % REMIX_ANGLES.length]}"
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button
                  type="button"
                  onClick={() => {
                    openInCreate(
                      "post",
                      idea.topic,
                      `${REMIX_ANGLES[idx % REMIX_ANGLES.length]}. Original context: ${idea.sourcePost}`,
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
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  ✍️ Create This Post
                </button>
                <button
                  type="button"
                  onClick={() => {
                    openInCreate("carousel", idea.topic, idea.sourcePost);
                    onClose();
                  }}
                  style={{
                    padding: "5px 12px",
                    background: "none",
                    border: `1.5px solid #8b5cf6`,
                    borderRadius: 6,
                    fontSize: 11,
                    fontWeight: 600,
                    color: "#8b5cf6",
                    cursor: "pointer",
                  }}
                >
                  🎠 As Carousel
                </button>
              </div>
            </div>
          ))}
        </>
      )}
    </DashboardActionModal>
  );
};
