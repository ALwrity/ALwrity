/**
 * Engagement Wedge — 5 AI-first feature modals (priority order)
 *
 * E5  EngagementBoosterModal      — see EngagementBoosterModal.tsx
 * E2  CommentAssistantModal       — extracted to CommentAssistantInboxModal.tsx
 * E1  OpportunitiesModal          — Conversations to Join quick-view (top 3 from growth cache)
 * E4  GrowNetworkModal            — AI Network Advisor + Live PYMK (see GrowNetworkModal.tsx)
 *
 * Performance Pulse — see performancePulse/ module and remarkWedgeModalExports.ts
 */
import React, { useEffect, useState, useMemo } from "react";
import { DashboardActionModal } from "./DashboardActionModal";
import {
  type EngagementOpportunityItem,
} from "../../../../services/linkedInGrowthApi";
import { linkedInWriterApi } from "../../../../services/linkedInWriterApi";
import {
  colors,
  rowBase,
  CONFIDENCE_COLORS,
} from "../GrowthEngine/styles";
import { openGrowthEngineModal } from "../../utils/linkedInDashboardEvents";
import { pushDraftToStudio } from "./engagementWedgeDraftUtils";
import { useGrowthCache } from "./useGrowthCache";
import {
  ENGAGEMENT_RETURN,
  openQuickCreateFromWedge,
} from "./engagementWedgeNavigation";
import {
  engagementPostSizeModalClassName,
  engagementPostSizeSubModalProps,
} from "./engagementWedgeModalUi";
import { CONVERSATIONS_TO_JOIN_MODAL } from "./engagementWedgeCopy";

export { CommentAssistantModal } from "./CommentAssistantInboxModal";
export { EngagementBoosterModal } from "./EngagementBoosterModal";
export { NetworkAdvisorModal } from "./NetworkAdvisorModal";
export { GrowNetworkModal } from "./GrowNetworkModal";

const ConnectPrompt: React.FC<{ message: string }> = ({ message }) => (
  <div style={{ textAlign: "center", padding: "30px 0" }}>
    <div style={{ fontSize: 40, marginBottom: 12, opacity: 0.7 }}>🔗</div>
    <div
      style={{
        fontWeight: 700,
        fontSize: 15,
        color: colors.textDark,
        marginBottom: 8,
      }}
    >
      LinkedIn Account Required
    </div>
    <div
      style={{
        fontSize: 13,
        color: colors.textSecondary,
        lineHeight: 1.5,
        maxWidth: 340,
        margin: "0 auto",
      }}
    >
      {message}
    </div>
  </div>
);

const StaleDataNote: React.FC = () => (
  <div
    style={{
      padding: "8px 12px",
      background: "#fffbeb",
      borderRadius: 8,
      color: "#92400e",
      fontSize: 12,
      marginBottom: 14,
      display: "flex",
      alignItems: "center",
      gap: 6,
    }}
  >
    <span>⚠️</span>
    <span>
      Showing cached data. Connect your LinkedIn account for the latest
      insights.
    </span>
  </div>
);

// ── Shared UI ────────────────────────────────────────────────────────────────

const Spinner = () => (
  <>
    <style>{`@keyframes ew-spin { to { transform: rotate(360deg); } }`}</style>
    <span
      style={{
        display: "inline-block",
        width: 16,
        height: 16,
        border: "2px solid #d1d5db",
        borderTopColor: colors.primary,
        borderRadius: "50%",
        animation: "ew-spin 0.7s linear infinite",
        flexShrink: 0,
      }}
    />
  </>
);

const ConfPill: React.FC<{ level: string }> = ({ level }) => {
  const cc =
    CONFIDENCE_COLORS[level as "high" | "medium" | "low"] ??
    CONFIDENCE_COLORS.medium;
  return (
    <span
      style={{
        fontSize: 10,
        fontWeight: 700,
        background: cc.bg,
        color: cc.text,
        padding: "1px 6px",
        borderRadius: 4,
      }}
    >
      {level}
    </span>
  );
};

const ErrorBanner: React.FC<{ msg: string }> = ({ msg }) => (
  <div
    style={{
      padding: "10px 14px",
      background: "#fef2f2",
      borderRadius: 8,
      color: "#dc2626",
      fontSize: 13,
      marginBottom: 12,
    }}
  >
    {msg}
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

const EmptyPrompt: React.FC<{
  icon: string;
  title: string;
  desc: string;
  btnLabel: string;
  onLoad: () => void;
  loading?: boolean;
}> = ({ icon, title, desc, btnLabel, onLoad, loading }) => (
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
      {desc}
    </div>
    <button
      type="button"
      disabled={loading}
      onClick={onLoad}
      style={{
        padding: "10px 24px",
        background: colors.primary,
        color: "#fff",
        border: "none",
        borderRadius: 8,
        fontSize: 14,
        fontWeight: 700,
        cursor: loading ? "default" : "pointer",
        opacity: loading ? 0.7 : 1,
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
      }}
    >
      {loading ? (
        <>
          <Spinner /> Loading…
        </>
      ) : (
        btnLabel
      )}
    </button>
  </div>
);

// Shared hook — see useGrowthCache.ts

function textareaStyle(minH: number): React.CSSProperties {
  return {
    width: "100%",
    minHeight: minH,
    padding: "9px 11px",
    borderRadius: 8,
    border: `1.5px solid ${colors.border}`,
    fontSize: 12,
    resize: "vertical",
    fontFamily: "inherit",
    lineHeight: 1.6,
    color: colors.textBody,
    boxSizing: "border-box",
    marginBottom: 10,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// E1 — Conversations to Join Quick-View
// ─────────────────────────────────────────────────────────────────────────────

interface OpportunitiesModalProps {
  open: boolean;
  onClose: () => void;
  onBack?: () => void;
  connected?: boolean;
}

export const OpportunitiesModal: React.FC<OpportunitiesModalProps> = ({
  open,
  onClose,
  onBack,
  connected = true,
}) => {
  const { data, loading, error, loadAll } = useGrowthCache(open);
  const [dismissed, setDismissed] = useState<Set<number>>(new Set());
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  const [refineIdx, setRefineIdx] = useState<number | null>(null);

  useEffect(() => {
    if (open) setDismissed(new Set());
  }, [open]);

  const opportunities: EngagementOpportunityItem[] = useMemo(
    () => data?.engagement_opportunities?.opportunities ?? [],
    [data],
  );
  const visible = opportunities.filter((_, i) => !dismissed.has(i)).slice(0, 3);

  const handleCopy = async (text: string, idx: number) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      /* fallback */
    }
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 2000);
  };

  return (
    <DashboardActionModal
      open={open}
      title={CONVERSATIONS_TO_JOIN_MODAL.title}
      onClose={onClose}
      onBack={onBack}
      {...engagementPostSizeSubModalProps}
      modalClassName={engagementPostSizeModalClassName()}
    >
      <p
        style={{
          margin: "0 0 14px",
          fontSize: 13,
          color: colors.textSecondary,
          lineHeight: 1.5,
        }}
      >
        {CONVERSATIONS_TO_JOIN_MODAL.intro}
      </p>

      {!connected && data && <StaleDataNote />}

      {!data && !loading && !connected && (
        <ConnectPrompt message="Connect your LinkedIn account to discover engagement opportunities tailored to your network." />
      )}

      {!data && !loading && connected && (
        <EmptyPrompt
          icon="💬"
          title={CONVERSATIONS_TO_JOIN_MODAL.emptyTitle}
          desc={CONVERSATIONS_TO_JOIN_MODAL.emptyDesc}
          btnLabel={CONVERSATIONS_TO_JOIN_MODAL.loadButton}
          onLoad={() => void loadAll()}
          loading={loading}
        />
      )}
      {loading && <LoadingRow message="Finding engagement opportunities…" />}
      {error && <ErrorBanner msg={error} />}

      {data && !loading && visible.length === 0 && (
        <div
          style={{
            textAlign: "center",
            padding: "20px 0",
            color: colors.textSecondary,
            fontSize: 13,
          }}
        >
          All opportunities dismissed.{" "}
          <button
            type="button"
            onClick={() => void loadAll()}
            style={{
              background: "none",
              border: "none",
              color: colors.primary,
              cursor: "pointer",
              fontWeight: 600,
              fontSize: 13,
            }}
          >
            Refresh →
          </button>
        </div>
      )}

      {!loading &&
        visible.map((item, displayIdx) => {
          const origIdx = opportunities.indexOf(item);
          const isCopied = copiedIdx === origIdx;
          const isRefining = refineIdx === origIdx;
          return (
            <div
              key={origIdx}
              style={{
                ...rowBase,
                marginBottom: 10,
                borderLeft: `3px solid ${(CONFIDENCE_COLORS[item.confidence] ?? CONFIDENCE_COLORS.medium).bg === CONFIDENCE_COLORS.high.bg ? "#0a66c2" : "#8b5cf6"}`,
              }}
            >
              <div style={{ marginBottom: 6 }}>
                <div
                  style={{
                    fontWeight: 700,
                    fontSize: 13,
                    color: colors.textDark,
                    marginBottom: 2,
                  }}
                >
                  📢 {item.title}
                </div>
                <div
                  style={{
                    fontSize: 11,
                    color: colors.textSecondary,
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  {item.author} · {item.author_context}{" "}
                  <ConfPill level={item.confidence} />
                </div>
              </div>
              <div
                style={{
                  fontSize: 12,
                  color: colors.textMedium,
                  fontStyle: "italic",
                  marginBottom: 8,
                }}
              >
                💡 {item.why_engage}
              </div>
              <div
                style={{
                  background: "#fff",
                  border: `1px solid ${colors.border}`,
                  borderRadius: 7,
                  padding: "8px 11px",
                  fontSize: 12,
                  color: colors.textBody,
                  lineHeight: 1.55,
                  marginBottom: 10,
                }}
              >
                💬 {item.suggested_comment}
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button
                  type="button"
                  onClick={() =>
                    void handleCopy(item.suggested_comment, origIdx)
                  }
                  style={{
                    padding: "5px 12px",
                    background: isCopied ? "#dcfce7" : colors.primary,
                    color: isCopied ? "#166534" : "#fff",
                    border: "none",
                    borderRadius: 6,
                    fontSize: 11,
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  {isCopied ? "✓ Copied" : "📋 Copy Comment"}
                </button>
                <button
                  type="button"
                  onClick={() => setRefineIdx(isRefining ? null : origIdx)}
                  style={{
                    padding: "5px 12px",
                    background: isRefining ? "#eff6ff" : "none",
                    border: `1.5px solid ${colors.primary}`,
                    borderRadius: 6,
                    fontSize: 11,
                    fontWeight: 600,
                    color: colors.primary,
                    cursor: "pointer",
                  }}
                >
                  ✏️ Refine Reply
                </button>
                <button
                  type="button"
                  onClick={() => {
                    openQuickCreateFromWedge({
                      type: "post",
                      topic: item.title,
                      key_points: item.suggested_comment,
                      returnTo: ENGAGEMENT_RETURN.opportunities,
                    });
                    onClose();
                  }}
                  style={{
                    padding: "5px 12px",
                    background: "none",
                    border: `1px solid ${colors.border}`,
                    borderRadius: 6,
                    fontSize: 11,
                    color: colors.textSecondary,
                    cursor: "pointer",
                  }}
                >
                  ✍️ Create Post
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setDismissed((prev) => new Set(prev).add(origIdx))
                  }
                  style={{
                    padding: "5px 10px",
                    background: "none",
                    border: "none",
                    borderRadius: 6,
                    fontSize: 11,
                    color: colors.textTertiary,
                    cursor: "pointer",
                  }}
                >
                  ✕
                </button>
              </div>
              {isRefining && (
                <InlineRefineForm
                  comment={item.suggested_comment}
                  originalPost={item.title}
                  onClose={() => setRefineIdx(null)}
                  onAccept={(text) => {
                    pushDraftToStudio(text);
                    onClose();
                  }}
                />
              )}
            </div>
          );
        })}

      {data && !loading && opportunities.length > 3 && (
        <div
          style={{
            fontSize: 12,
            color: colors.textTertiary,
            marginTop: 4,
            textAlign: "center",
          }}
        >
          {CONVERSATIONS_TO_JOIN_MODAL.moreInGrowthEngine(
            opportunities.length - 3,
          )}{" "}
          <button
            type="button"
            onClick={() => {
              openGrowthEngineModal({ fromEngagementWedge: true });
              onClose();
            }}
            style={{
              background: "none",
              border: "none",
              color: colors.primary,
              cursor: "pointer",
              fontSize: 12,
              fontWeight: 600,
              padding: 0,
            }}
          >
            Growth Engine →
          </button>
        </div>
      )}
    </DashboardActionModal>
  );
};

// Small inline refine form inside opportunity card
const InlineRefineForm: React.FC<{
  comment: string;
  originalPost: string;
  onClose: () => void;
  onAccept: (text: string) => void;
}> = ({ comment, originalPost, onClose, onAccept }) => {
  const [text, setText] = useState(comment);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleRefine = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await linkedInWriterApi.generateCommentResponse({
        original_post: originalPost,
        comment,
        response_type: "value_add",
      });
      if (res.response) setText(res.response);
    } catch {
      setError("Could not refine. Edit manually above.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        marginTop: 10,
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
        Refine Reply
      </div>
      {error && (
        <div style={{ fontSize: 11, color: "#dc2626", marginBottom: 6 }}>
          {error}
        </div>
      )}
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        style={{ ...textareaStyle(70), marginBottom: 8 }}
      />
      <div style={{ display: "flex", gap: 8 }}>
        <button
          type="button"
          onClick={() => void handleRefine()}
          disabled={loading}
          style={{
            padding: "5px 12px",
            background: "#0a66c2",
            color: "#fff",
            border: "none",
            borderRadius: 6,
            fontSize: 11,
            fontWeight: 600,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 4,
          }}
        >
          {loading ? (
            <>
              <Spinner /> Refining…
            </>
          ) : (
            "✨ AI Refine"
          )}
        </button>
        <button
          type="button"
          onClick={() => onAccept(text)}
          style={{
            padding: "5px 12px",
            background: "#059669",
            color: "#fff",
            border: "none",
            borderRadius: 6,
            fontSize: 11,
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          Use This
        </button>
        <button
          type="button"
          onClick={onClose}
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
          Cancel
        </button>
      </div>
    </div>
  );
};

