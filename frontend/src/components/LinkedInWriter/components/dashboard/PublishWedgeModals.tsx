/**
 * Publish Wedge — 5 AI-first feature modals
 *
 * F4  DraftLibraryModal      — inline draft list, "Open in Studio" restore
 * F1  QualityCheckModal      — pre-publish 6-dim score card
 * F2  TimingAdvisorModal     — week-grid optimal posting times
 * F3  ScheduleQuickModal     — calendar quick-add
 * F5  PublishNowModal        — direct LinkedIn publish with pre-flight (see PublishNowModal.tsx)
 */
import React, { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { DashboardActionModal } from "./DashboardActionModal";
import { PreviewScoreCard } from "../GrowthEngine/PreviewScoreCard";
import { apiClient } from "../../../../api/client";
import { linkedInGrowthApi } from "../../../../services/linkedInGrowthApi";
import type { PostPreviewScoreResponse } from "../../../../services/linkedInGrowthApi";
import { contentPlanningApi } from "../../../../services/contentPlanningApi";
import { LinkedInPublishChecklist } from "../LinkedInPublishChecklist";
import {
  filterCompleteLinkedInDrafts,
  getDraftAssetContent,
  type LinkedInDraftAsset,
} from "../../utils/linkedInDraftLibraryUtils";
import {
  isPublishWedgeScheduleLocked,
  PUBLISH_WEDGE_SCHEDULE_LOCKED_HINT,
} from "../../utils/linkedInPublishWedgeLockedUi";
import { ConnectLockIcon } from "./ConnectLockIcon";
import { EngagementBoosterLaunchButton } from "./EngagementBoosterLaunchButton";

export { PublishNowModal } from "./PublishNowModal";

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

const DRAFT_STORAGE_KEY = "alwrity-copilot-draft-content";

function readDraftFromStorage(): string {
  try {
    return localStorage.getItem(DRAFT_STORAGE_KEY) ?? "";
  } catch {
    return "";
  }
}

function openInStudio(content: string, onDone: () => void) {
  window.dispatchEvent(
    new CustomEvent("linkedinwriter:updateDraft", { detail: content }),
  );
  onDone();
}

// ---------------------------------------------------------------------------
// Shared UI primitives
// ---------------------------------------------------------------------------

const panelBtn = (
  primary?: boolean,
  danger?: boolean,
  locked?: boolean,
): React.CSSProperties => ({
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  padding: "9px 18px",
  borderRadius: 8,
  border: primary ? "none" : "1.5px solid #d1d5db",
  background: danger ? "#ef4444" : primary ? "#0a66c2" : "#ffffff",
  color: danger ? "#fff" : primary ? "#fff" : "#374151",
  fontSize: 13,
  fontWeight: 600,
  cursor: locked ? "not-allowed" : "pointer",
  opacity: locked ? 0.72 : 1,
  transition: "opacity 140ms",
});

const sectionLabel: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  color: "#6b7280",
  textTransform: "uppercase",
  letterSpacing: 0.6,
  marginBottom: 6,
};

const cardBox: React.CSSProperties = {
  background: "#f8fafc",
  borderRadius: 10,
  border: "1.5px solid #e2e8f0",
  padding: "12px 14px",
  marginBottom: 10,
};

const Spinner = () => (
  <>
    <style>{`@keyframes pw-spin { to { transform: rotate(360deg); } }`}</style>
    <span
      style={{
        display: "inline-block",
        width: 16,
        height: 16,
        border: "2px solid #d1d5db",
        borderTopColor: "#0a66c2",
        borderRadius: "50%",
        animation: "pw-spin 0.7s linear infinite",
      }}
    />
  </>
);

// ---------------------------------------------------------------------------
// F4 — Draft Library Modal
// ---------------------------------------------------------------------------

const DRAFT_FETCH_LIMIT = 50;
const DRAFT_DISPLAY_LIMIT = 5;

interface DraftLibraryModalProps {
  open: boolean;
  onClose: () => void;
}

export const DraftLibraryModal: React.FC<DraftLibraryModalProps> = ({
  open,
  onClose,
}) => {
  const navigate = useNavigate();
  const [drafts, setDrafts] = useState<LinkedInDraftAsset[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [qualityCheckAsset, setQualityCheckAsset] =
    useState<LinkedInDraftAsset | null>(null);
  const [showTiming, setShowTiming] = useState(false);
  const [timingForAsset, setTimingForAsset] =
    useState<LinkedInDraftAsset | null>(null);
  const [schedulePrefillDate, setSchedulePrefillDate] = useState("");
  const [schedulePrefillTime, setSchedulePrefillTime] = useState("");
  const [scheduleAsset, setScheduleAsset] = useState<LinkedInDraftAsset | null>(null);
  const scheduleLocked = isPublishWedgeScheduleLocked();

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setError("");
    setQualityCheckAsset(null);
    setShowTiming(false);
    setTimingForAsset(null);
    setSchedulePrefillDate("");
    setSchedulePrefillTime("");
    setScheduleAsset(null);
    apiClient
      .get("/api/content-assets/", {
        params: {
          source_module: "linkedin_writer",
          limit: DRAFT_FETCH_LIMIT,
          sort_by: "created_at",
          sort_order: "desc",
        },
      })
      .then((res) => {
        const data = res.data;
        const raw = Array.isArray(data) ? data : (data?.assets ?? []);
        setDrafts(filterCompleteLinkedInDrafts(raw, DRAFT_DISPLAY_LIMIT));
      })
      .catch(() => setError("Could not load drafts. Please try again."))
      .finally(() => setLoading(false));
  }, [open]);

  const getAssetContent = (asset: LinkedInDraftAsset): string =>
    getDraftAssetContent(asset);

  const handleOpenInStudio = (asset: LinkedInDraftAsset) => {
    openInStudio(getAssetContent(asset), onClose);
  };

  const handleViewAll = () => {
    onClose();
    navigate("/asset-library?source_module=linkedin_writer");
  };

  const handleCloseQualityCheck = () => {
    setQualityCheckAsset(null);
  };

  return (
    <DashboardActionModal
      open={open}
      title="My Drafts"
      onClose={onClose}
      maxWidth="80vw"
      titleSize="xl"
      modalClassName="linkedin-my-drafts-modal"
    >
      <div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            marginBottom: 18,
          }}
        >
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              background: "linear-gradient(135deg, #0a66c2, #004182)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 16,
              flexShrink: 0,
            }}
          >
            📁
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 14, color: "#1f2937" }}>
              Saved Drafts
            </div>
            <div style={{ fontSize: 12, color: "#6b7280", marginTop: 1 }}>
              Your last 5 LinkedIn drafts — open, score, optimise, or check timing
            </div>
          </div>
        </div>

        {loading && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 10,
              padding: "32px 0",
              color: "#64748b",
              fontSize: 13,
            }}
          >
            <Spinner /> Loading drafts…
          </div>
        )}

        {error && (
          <div
            style={{
              padding: "12px 16px",
              background: "#fef2f2",
              borderRadius: 10,
              border: "1px solid #fecaca",
              color: "#dc2626",
              fontSize: 13,
              marginBottom: 12,
            }}
          >
            {error}
          </div>
        )}

        {!loading && !error && drafts.length === 0 && (
          <div
            style={{
              textAlign: "center",
              padding: "40px 0",
              color: "#94a3b8",
              fontSize: 13,
            }}
          >
            No complete drafts yet. Generate a post, article, carousel, or video
            script in the Create wedge to get started.
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {drafts.map((asset) => {
            const assetContent = getAssetContent(asset);
            return (
              <div
                key={asset.id}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = "#cbd5e1";
                  e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.06)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = "#e2e8f0";
                  e.currentTarget.style.boxShadow = "none";
                }}
                style={{
                  background: "#ffffff",
                  borderRadius: 12,
                  border: "1.5px solid #e2e8f0",
                  padding: "14px 16px",
                  display: "flex",
                  flexDirection: "column",
                  gap: 10,
                  transition: "border-color 0.15s, box-shadow 0.15s",
                  position: "relative",
                  overflow: "hidden",
                }}
              >
              {/* Left accent bar */}
              <div
                style={{
                  position: "absolute",
                  left: 0,
                  top: 0,
                  bottom: 0,
                  width: 3,
                  background: "linear-gradient(180deg, #0a66c2, #8b5cf6)",
                  borderRadius: "3px 0 0 3px",
                }}
              />

              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  gap: 12,
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontWeight: 700,
                      fontSize: 14,
                      color: "#111827",
                      marginBottom: 2,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {asset.title || "Untitled Draft"}
                  </div>
                  <div
                    style={{
                      fontSize: 11,
                      color: "#9ca3af",
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                    }}
                  >
                    {asset.created_at
                      ? new Date(asset.created_at).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })
                      : ""}
                    {asset.description && (
                      <>
                        <span style={{ color: "#d1d5db" }}>·</span>
                        <span>
                          {asset.description.split(/\s+/).length} words
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>
              {(() => {
                const content = assetContent;
                const isShort = content.length < 60 && content === asset.title;
                return (
                  <div
                    style={{
                      fontSize: 12.5,
                      color: "#6b7280",
                      lineHeight: 1.6,
                      background: "#f8fafc",
                      borderRadius: 8,
                      padding: "10px 12px",
                      border: "1px solid #f1f5f9",
                    }}
                  >
                    {isShort ? (
                      <span style={{ fontStyle: "italic", color: "#9ca3af" }}>
                        Full content not available. Open in Studio to view.
                      </span>
                    ) : (
                      `"${content.slice(0, 150)}${content.length > 150 ? "…" : ""}"`
                    )}
                  </div>
                );
              })()}
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button
                  style={panelBtn(true)}
                  onClick={() => handleOpenInStudio(asset)}
                >
                  ✍️ Open in Studio
                </button>
                <button
                  style={{
                    ...panelBtn(),
                    borderColor: "#8b5cf6",
                    color: "#8b5cf6",
                  }}
                  onClick={() => setQualityCheckAsset(asset)}
                >
                  📊 Quality Check
                </button>
                <EngagementBoosterLaunchButton
                  variant="inline"
                  content={assetContent}
                  disabled={!assetContent.trim()}
                />
                <button
                  type="button"
                  style={{
                    ...panelBtn(false, false, scheduleLocked),
                    borderColor: scheduleLocked ? "#d1d5db" : "#10b981",
                    color: scheduleLocked ? "#9ca3af" : "#10b981",
                  }}
                  disabled={scheduleLocked}
                  title={
                    scheduleLocked ? PUBLISH_WEDGE_SCHEDULE_LOCKED_HINT : undefined
                  }
                  aria-label={
                    scheduleLocked
                      ? "Schedule — coming soon"
                      : "Schedule this draft"
                  }
                  onClick={() => {
                    if (!scheduleLocked) setScheduleAsset(asset);
                  }}
                >
                  📅 Schedule
                  {scheduleLocked && <ConnectLockIcon size={12} />}
                </button>
                <button
                  style={{
                    ...panelBtn(),
                    borderColor: "#0ea5e9",
                    color: "#0ea5e9",
                  }}
                  onClick={() => {
                    setTimingForAsset(asset);
                    setShowTiming(true);
                  }}
                >
                  ⏰ Best Time
                </button>
              </div>
              </div>
            );
          })}
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            marginTop: 14,
            paddingTop: 12,
            borderTop: "1px solid #e5e7eb",
          }}
        >
          <button
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "8px 18px",
              borderRadius: 8,
              border: "1.5px solid #d1d5db",
              background: "#ffffff",
              color: "#374151",
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
              transition: "border-color 0.12s",
            }}
            onClick={handleViewAll}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = "#0a66c2";
              e.currentTarget.style.color = "#0a66c2";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = "#d1d5db";
              e.currentTarget.style.color = "#374151";
            }}
          >
            View All in Library →
          </button>
        </div>
      </div>

      {/* Quality Check sub-modal for selected draft */}
      <QualityCheckModal
        open={!!qualityCheckAsset}
        onClose={handleCloseQualityCheck}
        initialContent={
          qualityCheckAsset ? getAssetContent(qualityCheckAsset) : undefined
        }
        contextHint={qualityCheckAsset?.title ?? undefined}
      />

      {/* Best Time to Post sub-modal */}
      <TimingAdvisorModal
        open={showTiming}
        onClose={() => {
          setShowTiming(false);
          setTimingForAsset(null);
        }}
        scheduleLocked={scheduleLocked}
        onScheduleSlot={
          scheduleLocked
            ? undefined
            : (date, time) => {
                setSchedulePrefillDate(date);
                setSchedulePrefillTime(time);
                setShowTiming(false);
                if (timingForAsset) {
                  setScheduleAsset(timingForAsset);
                }
                setTimingForAsset(null);
              }
        }
      />

      {/* Schedule sub-modal for selected draft */}
      <ScheduleQuickModal
        open={!!scheduleAsset}
        onClose={() => {
          setScheduleAsset(null);
          setSchedulePrefillDate("");
          setSchedulePrefillTime("");
        }}
        prefillDate={schedulePrefillDate}
        prefillTime={schedulePrefillTime}
        initialContent={
          scheduleAsset ? getAssetContent(scheduleAsset) : undefined
        }
        initialTopic={scheduleAsset?.title ?? undefined}
      />
    </DashboardActionModal>
  );
};

// ---------------------------------------------------------------------------
// F1 — Quality Check Modal
// ---------------------------------------------------------------------------

interface QualityCheckModalProps {
  open: boolean;
  onClose: () => void;
  /** When provided, scores this content instead of the localStorage draft */
  initialContent?: string;
  /** Optional topic/context hint passed to the scoring API */
  contextHint?: string;
  qualityMetrics?: { overall_score?: number; factual_accuracy?: number; source_verification?: number; citation_coverage?: number } | null;
}

export const QualityCheckModal: React.FC<QualityCheckModalProps> = ({
  open,
  onClose,
  initialContent,
  contextHint,
  qualityMetrics,
}) => {
  const [content, setContent] = useState("");
  const [scoreResult, setScoreResult] =
    useState<PostPreviewScoreResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const hasQualityMetrics = qualityMetrics && (typeof qualityMetrics.overall_score === 'number' || typeof qualityMetrics.factual_accuracy === 'number' || typeof qualityMetrics.source_verification === 'number' || typeof qualityMetrics.citation_coverage === 'number');
  const metricItems = useMemo(() => hasQualityMetrics ? [
    { label: 'Overall', value: qualityMetrics!.overall_score || 0 },
    { label: 'Accuracy', value: qualityMetrics!.factual_accuracy || 0 },
    { label: 'Verification', value: qualityMetrics!.source_verification || 0 },
    { label: 'Coverage', value: qualityMetrics!.citation_coverage || 0 },
  ] : [], [hasQualityMetrics, qualityMetrics]);

  useEffect(() => {
    if (open) {
      setContent(initialContent ?? readDraftFromStorage());
      setScoreResult(null);
      setError("");
    }
  }, [open, initialContent]);

  const handleScore = async () => {
    if (!content.trim()) {
      setError("Please enter or paste some post content to score.");
      return;
    }
    setLoading(true);
    setError("");
    setScoreResult(null);
    try {
      const params: { content: string; context?: string } = { content };
      if (contextHint) params.context = contextHint;
      const result = await linkedInGrowthApi.getPostPreviewScore(params);
      setScoreResult(result);
    } catch {
      setError("Scoring failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleImproveInStudio = () => {
    openInStudio(content, onClose);
  };

  return (
    <DashboardActionModal
      open={open}
      title="Pre-Publish Quality Check"
      onClose={onClose}
      maxWidth={560}
      maxHeight="min(92vh, 700px)"
    >
      <div>
        {!scoreResult && (
          <>
            <p
              style={{
                margin: "0 0 12px",
                fontSize: 13,
                color: "#64748b",
                lineHeight: 1.5,
              }}
            >
              Score your post across 6 dimensions (Hook, Clarity, Engagement,
              Value, CTA, Readability) before publishing.
            </p>
            {hasQualityMetrics && (
              <div style={{ marginBottom: 16, padding: '14px 16px', background: '#f0fdf4', borderRadius: 10, border: '1px solid #bbf7d0' }}>
                <div style={{ fontWeight: 700, fontSize: 13, color: '#059669', marginBottom: 10 }}>AI Content Quality</div>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  {metricItems.map((m) => {
                    const pct = Math.round((m.value || 0) * 100);
                    const color = pct >= 70 ? '#059669' : pct >= 40 ? '#d97706' : '#dc2626';
                    return (
                      <div key={m.label} style={{ flex: '1 1 calc(50% - 5px)', minWidth: 120, padding: '8px 10px', background: '#fff', borderRadius: 8, border: '1px solid #e5e7eb' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                          <span style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>{m.label}</span>
                          <span style={{ fontSize: 12, fontWeight: 700, color }}>{pct}%</span>
                        </div>
                        <div style={{ height: 4, background: '#e5e7eb', borderRadius: 2, overflow: 'hidden' }}>
                          <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 2, transition: 'width 0.4s ease' }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            <div style={sectionLabel}>Your Post Content</div>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Paste your LinkedIn post here, or load from Studio…"
              rows={8}
              style={{
                width: "100%",
                padding: "10px 12px",
                borderRadius: 8,
                border: "1.5px solid #d1d5db",
                fontSize: 13,
                lineHeight: 1.6,
                resize: "vertical",
                fontFamily: "inherit",
                boxSizing: "border-box",
                color: "#111827",
              }}
            />
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginTop: 6,
                fontSize: 11,
                color: "#9ca3af",
              }}
            >
              <span>{content.length} / 3000 chars</span>
              {!initialContent && !readDraftFromStorage() && (
                <span>Tip: Generate content first in the Create wedge</span>
              )}
            </div>
            {error && (
              <div
                style={{
                  marginTop: 10,
                  padding: "8px 12px",
                  background: "#fef2f2",
                  borderRadius: 7,
                  color: "#dc2626",
                  fontSize: 13,
                }}
              >
                {error}
              </div>
            )}
            <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
              <button
                style={panelBtn(true)}
                onClick={handleScore}
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Spinner /> Scoring…
                  </>
                ) : (
                  "📊 Score My Post"
                )}
              </button>
            </div>
          </>
        )}

        {scoreResult && (
          <>
            <PreviewScoreCard
              overallScore={scoreResult.overall_score}
              dimensions={scoreResult.dimensions}
              topImprovement={scoreResult.top_improvement}
              dataSourceSummary={scoreResult.data_source_summary}
              onApply={handleImproveInStudio}
              onDismiss={() => setScoreResult(null)}
            />
            <div style={{ display: "flex", gap: 10, marginTop: 14, flexWrap: "wrap" }}>
              <button style={panelBtn(true)} onClick={handleImproveInStudio}>
                ✍️ Improve in Studio
              </button>
              <EngagementBoosterLaunchButton
                content={content}
                disabled={!content.trim()}
              />
              <button style={panelBtn()} onClick={() => setScoreResult(null)}>
                ← Re-score
              </button>
            </div>
          </>
        )}
        <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid #e5e7eb' }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: '#b45309', marginBottom: 10 }}>Best Practices Checklist</div>
          <LinkedInPublishChecklist draft={content || initialContent || ''} hasMedia={false} compact />
        </div>
      </div>
    </DashboardActionModal>
  );
};

// ---------------------------------------------------------------------------
// F2 — Timing Advisor Modal
// ---------------------------------------------------------------------------

interface TimingAdvisorModalProps {
  open: boolean;
  onClose: () => void;
  onScheduleSlot?: (date: string, time: string) => void;
  scheduleLocked?: boolean;
}

type ReachLevel = "high" | "medium" | "low" | "off";

interface SlotData {
  level: ReachLevel;
  label: string;
}

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri"];
const TIME_SLOTS = [
  "7–9 AM",
  "9–11 AM",
  "11 AM–1 PM",
  "1–3 PM",
  "3–5 PM",
  "5–7 PM",
];

// Industry-keyed optimal posting windows (LinkedIn algorithm-backed heuristics)
const TIMING_MATRIX: Record<string, ReachLevel[][]> = {
  Technology: [
    ["low", "medium", "high", "medium", "low", "off"],
    ["medium", "high", "high", "medium", "low", "off"],
    ["low", "high", "high", "medium", "low", "off"],
    ["medium", "high", "medium", "medium", "low", "off"],
    ["low", "medium", "low", "low", "off", "off"],
  ],
  Finance: [
    ["medium", "high", "medium", "low", "off", "off"],
    ["high", "high", "medium", "medium", "low", "off"],
    ["medium", "high", "medium", "medium", "off", "off"],
    ["medium", "high", "medium", "low", "off", "off"],
    ["low", "medium", "low", "off", "off", "off"],
  ],
  Healthcare: [
    ["low", "high", "medium", "medium", "low", "off"],
    ["medium", "high", "high", "medium", "low", "off"],
    ["low", "medium", "high", "medium", "low", "off"],
    ["medium", "high", "medium", "low", "off", "off"],
    ["low", "medium", "low", "off", "off", "off"],
  ],
  Marketing: [
    ["low", "medium", "high", "high", "medium", "low"],
    ["medium", "high", "high", "high", "medium", "low"],
    ["medium", "high", "high", "medium", "medium", "low"],
    ["low", "medium", "high", "medium", "low", "low"],
    ["low", "low", "medium", "low", "off", "off"],
  ],
  Default: [
    ["low", "high", "medium", "medium", "low", "off"],
    ["medium", "high", "high", "medium", "low", "off"],
    ["low", "high", "high", "medium", "low", "off"],
    ["medium", "high", "medium", "medium", "off", "off"],
    ["low", "medium", "low", "off", "off", "off"],
  ],
};

const REACH_COLORS: Record<
  ReachLevel,
  { bg: string; text: string; label: string }
> = {
  high: { bg: "#dcfce7", text: "#15803d", label: "High reach" },
  medium: { bg: "#fef9c3", text: "#a16207", label: "Medium reach" },
  low: { bg: "#f1f5f9", text: "#94a3b8", label: "Low reach" },
  off: { bg: "#f8f8f8", text: "#d1d5db", label: "Off-peak" },
};

const INDUSTRIES = ["Technology", "Finance", "Healthcare", "Marketing"];

export const TimingAdvisorModal: React.FC<TimingAdvisorModalProps> = ({
  open,
  onClose,
  onScheduleSlot,
  scheduleLocked = false,
}) => {
  const [industry, setIndustry] = useState("Technology");
  const [selectedSlot, setSelectedSlot] = useState<{
    day: number;
    slot: number;
  } | null>(null);

  const matrix = TIMING_MATRIX[industry] ?? TIMING_MATRIX["Default"];

  const getNextDayDate = (dayIndex: number): string => {
    const now = new Date();
    const currentDay = now.getDay(); // 0 = Sunday, 1 = Monday
    const targetDay = dayIndex + 1; // 1 = Monday
    let diff = targetDay - currentDay;
    if (diff <= 0) diff += 7;
    const target = new Date(now);
    target.setDate(now.getDate() + diff);
    return target.toISOString().split("T")[0];
  };

  const SLOT_TIMES = ["07:30", "09:30", "11:30", "13:30", "15:30", "17:30"];

  const handleScheduleThis = () => {
    if (!selectedSlot) return;
    const date = getNextDayDate(selectedSlot.day);
    const time = SLOT_TIMES[selectedSlot.slot];
    if (onScheduleSlot) {
      onScheduleSlot(date, time);
      onClose();
    }
  };

  const selectedLevel = selectedSlot
    ? matrix[selectedSlot.day][selectedSlot.slot]
    : null;

  return (
    <DashboardActionModal
      open={open}
      title="Best Time to Post"
      onClose={onClose}
      maxWidth={600}
    >
      <div>
        <p
          style={{
            margin: "0 0 14px",
            fontSize: 13,
            color: "#64748b",
            lineHeight: 1.5,
          }}
        >
          Optimal LinkedIn posting windows for your industry, based on
          algorithm-backed engagement data. Greener slots = higher organic
          reach.
        </p>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            marginBottom: 16,
          }}
        >
          <span style={{ fontSize: 13, fontWeight: 600, color: "#374151" }}>
            Industry:
          </span>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {INDUSTRIES.map((ind) => (
              <button
                key={ind}
                onClick={() => setIndustry(ind)}
                style={{
                  padding: "5px 12px",
                  borderRadius: 999,
                  border: "1.5px solid",
                  borderColor: industry === ind ? "#0a66c2" : "#d1d5db",
                  background: industry === ind ? "#dbeafe" : "#fff",
                  color: industry === ind ? "#0a66c2" : "#6b7280",
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                {ind}
              </button>
            ))}
          </div>
        </div>

        {/* Week grid */}
        <div style={{ overflowX: "auto" }}>
          <table
            style={{ borderCollapse: "collapse", width: "100%", minWidth: 400 }}
          >
            <thead>
              <tr>
                <th
                  style={{
                    width: 90,
                    textAlign: "left",
                    padding: "6px 8px",
                    fontSize: 11,
                    color: "#9ca3af",
                    fontWeight: 600,
                  }}
                >
                  Time slot
                </th>
                {DAYS.map((d) => (
                  <th
                    key={d}
                    style={{
                      textAlign: "center",
                      padding: "6px 4px",
                      fontSize: 12,
                      color: "#374151",
                      fontWeight: 700,
                    }}
                  >
                    {d}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {TIME_SLOTS.map((slot, si) => (
                <tr key={slot}>
                  <td
                    style={{
                      padding: "4px 8px",
                      fontSize: 11,
                      color: "#6b7280",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {slot}
                  </td>
                  {DAYS.map((_, di) => {
                    const level = matrix[di][si];
                    const colors = REACH_COLORS[level];
                    const isSelected =
                      selectedSlot?.day === di && selectedSlot?.slot === si;
                    return (
                      <td
                        key={di}
                        style={{ padding: "4px", textAlign: "center" }}
                      >
                        <button
                          onClick={() => setSelectedSlot({ day: di, slot: si })}
                          title={`${DAYS[di]} ${slot} — ${colors.label}`}
                          style={{
                            width: 44,
                            height: 32,
                            borderRadius: 7,
                            border: isSelected
                              ? "2px solid #0a66c2"
                              : "1.5px solid transparent",
                            background: isSelected ? "#dbeafe" : colors.bg,
                            cursor: level === "off" ? "default" : "pointer",
                            fontSize: 10,
                            color: isSelected ? "#0a66c2" : colors.text,
                            fontWeight: isSelected ? 700 : 500,
                            transition: "transform 120ms",
                          }}
                        >
                          {level === "high"
                            ? "●●●"
                            : level === "medium"
                              ? "●●"
                              : level === "low"
                                ? "●"
                                : "—"}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Legend */}
        <div
          style={{ display: "flex", gap: 12, marginTop: 12, flexWrap: "wrap" }}
        >
          {(["high", "medium", "low", "off"] as ReachLevel[]).map((level) => (
            <div
              key={level}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 5,
                fontSize: 11,
                color: "#6b7280",
              }}
            >
              <span
                style={{
                  display: "inline-block",
                  width: 14,
                  height: 14,
                  borderRadius: 3,
                  background: REACH_COLORS[level].bg,
                  border: "1px solid #e2e8f0",
                }}
              />
              {REACH_COLORS[level].label}
            </div>
          ))}
        </div>

        {selectedSlot && (
          <div
            style={{
              marginTop: 16,
              padding: "12px 14px",
              background: "#f0f9ff",
              borderRadius: 10,
              border: "1.5px solid #bae6fd",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 10,
            }}
          >
            <div>
              <div style={{ fontWeight: 600, fontSize: 13, color: "#0284c7" }}>
                {DAYS[selectedSlot.day]}, {TIME_SLOTS[selectedSlot.slot]}
              </div>
              <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>
                {selectedLevel ? REACH_COLORS[selectedLevel].label : ""} posting
                window for {industry}
              </div>
            </div>
            <button
              type="button"
              style={panelBtn(true, false, scheduleLocked || !onScheduleSlot)}
              onClick={handleScheduleThis}
              disabled={scheduleLocked || !onScheduleSlot}
              title={
                scheduleLocked ? PUBLISH_WEDGE_SCHEDULE_LOCKED_HINT : undefined
              }
              aria-label={
                scheduleLocked
                  ? "Schedule for this slot — coming soon"
                  : "Schedule for this slot"
              }
            >
              📅 Schedule for this slot
              {scheduleLocked && <ConnectLockIcon size={12} />}
            </button>
          </div>
        )}
      </div>
    </DashboardActionModal>
  );
};

// ---------------------------------------------------------------------------
// F3 — Schedule Quick-Add Modal
// ---------------------------------------------------------------------------

interface ScheduleQuickModalProps {
  open: boolean;
  onClose: () => void;
  /** Pre-fill from timing advisor */
  prefillDate?: string;
  prefillTime?: string;
  /** When provided, schedules this content instead of the localStorage draft */
  initialContent?: string;
  /** When provided, pre-fills the topic field */
  initialTopic?: string;
}

const FORMAT_OPTIONS = [
  { value: "post", label: "📝 Post" },
  { value: "article", label: "📄 Article" },
  { value: "carousel", label: "🎠 Carousel" },
];

export const ScheduleQuickModal: React.FC<ScheduleQuickModalProps> = ({
  open,
  onClose,
  prefillDate = "",
  prefillTime = "",
  initialContent,
  initialTopic,
}) => {
  const navigate = useNavigate();
  const [topic, setTopic] = useState("");
  const [format, setFormat] = useState("post");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState<{ id: string } | null>(null);

  useEffect(() => {
    if (open) {
      if (initialTopic !== undefined) {
        setTopic(initialTopic.slice(0, 100).replace(/\n/g, " "));
      } else {
        const draft = readDraftFromStorage();
        setTopic(draft.slice(0, 100).replace(/\n/g, " ") || "");
      }
      setDate(
        prefillDate ||
          new Date(Date.now() + 86400000).toISOString().split("T")[0],
      );
      setTime(prefillTime || "09:30");
      setFormat("post");
      setError("");
      setSuccess(null);
    }
  }, [open, prefillDate, prefillTime, initialTopic]);

  const handleSchedule = async () => {
    if (!topic.trim()) {
      setError("Please enter a topic or title for the scheduled post.");
      return;
    }
    if (!date) {
      setError("Please select a date.");
      return;
    }
    setLoading(true);
    setError("");
    const contentToSchedule = initialContent ?? readDraftFromStorage();
    try {
      const result = await contentPlanningApi.createEvent({
        title: topic.slice(0, 120),
        description: contentToSchedule.slice(0, 500) || topic,
        date: `${date}T${time || "09:00"}:00`,
        platform: "linkedin",
        content_type: format,
        status: "scheduled",
      });
      const eventId =
        result?.id ?? result?.event_id ?? result?.calendar_event_id ?? "saved";
      setSuccess({ id: String(eventId) });
    } catch (err: any) {
      const msg =
        err?.response?.data?.detail ??
        err?.message ??
        "Scheduling failed. Please try again.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <DashboardActionModal
        open={open}
        title="Post Scheduled"
        onClose={onClose}
        maxWidth={440}
      >
        <div style={{ textAlign: "center", padding: "16px 0" }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🎉</div>
          <div
            style={{
              fontWeight: 700,
              fontSize: 16,
              color: "#111827",
              marginBottom: 6,
            }}
          >
            Scheduled successfully!
          </div>
          <div style={{ fontSize: 13, color: "#64748b", marginBottom: 20 }}>
            Calendar event{" "}
            <code
              style={{
                background: "#f1f5f9",
                padding: "1px 6px",
                borderRadius: 4,
              }}
            >
              #{success.id}
            </code>{" "}
            created for{" "}
            {new Date(`${date}T${time}`).toLocaleString("en-US", {
              weekday: "short",
              month: "short",
              day: "numeric",
              hour: "numeric",
              minute: "2-digit",
            })}
            .
          </div>
          <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
            <button
              style={panelBtn(true)}
              onClick={() => {
                onClose();
                navigate("/content-planning", { state: { activeTab: 1 } });
              }}
            >
              📅 View in Calendar
            </button>
            <button style={panelBtn()} onClick={onClose}>
              Done
            </button>
          </div>
        </div>
      </DashboardActionModal>
    );
  }

  return (
    <DashboardActionModal
      open={open}
      title="Schedule Post"
      onClose={onClose}
      maxWidth={480}
    >
      <div>
        <p
          style={{
            margin: "0 0 14px",
            fontSize: 13,
            color: "#64748b",
            lineHeight: 1.5,
          }}
        >
          Add this post to your LinkedIn content calendar without leaving the
          studio.
        </p>

        <div style={sectionLabel}>Topic / Title</div>
        <input
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          placeholder="What is this post about?"
          maxLength={120}
          style={{
            width: "100%",
            padding: "9px 12px",
            borderRadius: 8,
            border: "1.5px solid #d1d5db",
            fontSize: 13,
            color: "#111827",
            boxSizing: "border-box",
            marginBottom: 14,
          }}
        />

        <div style={sectionLabel}>Format</div>
        <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
          {FORMAT_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setFormat(opt.value)}
              style={{
                padding: "7px 14px",
                borderRadius: 8,
                border: "1.5px solid",
                borderColor: format === opt.value ? "#0a66c2" : "#d1d5db",
                background: format === opt.value ? "#dbeafe" : "#fff",
                color: format === opt.value ? "#0a66c2" : "#6b7280",
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <div style={{ display: "flex", gap: 12, marginBottom: 14 }}>
          <div style={{ flex: 1 }}>
            <div style={sectionLabel}>Date</div>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              min={new Date().toISOString().split("T")[0]}
              style={{
                width: "100%",
                padding: "9px 12px",
                borderRadius: 8,
                border: "1.5px solid #d1d5db",
                fontSize: 13,
                color: "#111827",
                boxSizing: "border-box",
              }}
            />
          </div>
          <div style={{ flex: 1 }}>
            <div style={sectionLabel}>Time</div>
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              style={{
                width: "100%",
                padding: "9px 12px",
                borderRadius: 8,
                border: "1.5px solid #d1d5db",
                fontSize: 13,
                color: "#111827",
                boxSizing: "border-box",
              }}
            />
          </div>
        </div>

        {error && (
          <div
            style={{
              padding: "8px 12px",
              background: "#fef2f2",
              borderRadius: 7,
              color: "#dc2626",
              fontSize: 13,
              marginBottom: 12,
            }}
          >
            {error}
          </div>
        )}

        <div style={{ display: "flex", gap: 10 }}>
          <button
            style={panelBtn(true)}
            onClick={handleSchedule}
            disabled={loading}
          >
            {loading ? (
              <>
                <Spinner /> Scheduling…
              </>
            ) : (
              "📅 Confirm Schedule"
            )}
          </button>
          <button style={panelBtn()} onClick={onClose}>
            Cancel
          </button>
        </div>
      </div>
    </DashboardActionModal>
  );
};

// PublishNowModal moved to ./PublishNowModal.tsx (Phase 1 media UI)

// ---------------------------------------------------------------------------
// PreflightRow helper (used by other modals in this file)
// ---------------------------------------------------------------------------
interface PreflightRowProps {
  icon: string;
  label: string;
  value: string;
  ok: boolean | null;
}

const PreflightRow: React.FC<PreflightRowProps> = ({
  icon,
  label,
  value,
  ok,
}) => (
  <div
    style={{
      display: "flex",
      alignItems: "flex-start",
      gap: 10,
      padding: "9px 12px",
      background:
        ok === true ? "#f0fdf4" : ok === false ? "#fef2f2" : "#fffbeb",
      borderRadius: 8,
      border: `1px solid ${ok === true ? "#bbf7d0" : ok === false ? "#fecaca" : "#fde68a"}`,
    }}
  >
    <span style={{ fontSize: 14, lineHeight: "20px", flexShrink: 0 }}>
      {icon}
    </span>
    <div>
      <div style={{ fontWeight: 600, fontSize: 12, color: "#374151" }}>
        {label}
      </div>
      <div
        style={{
          fontSize: 12,
          color: "#6b7280",
          marginTop: 1,
          lineHeight: 1.4,
        }}
      >
        {value}
      </div>
    </div>
  </div>
);
