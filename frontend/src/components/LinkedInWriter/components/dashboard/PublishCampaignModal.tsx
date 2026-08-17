/**
 * F6 — Publish Campaign Command Center (Phase 1)
 * Read-only campaign timeline + rule-based ROI insights (HITL actions).
 */

import React, { useCallback, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { DashboardActionModal } from "./DashboardActionModal";
import { POST_WEDGE_MODAL_SIZE, POST_WEDGE_MODAL_SIZE_CLASS } from "./wedgeModalLayout";
import { useLinkedInPublishCampaignData } from "../../hooks/useLinkedInPublishCampaignData";
import {
  findCampaignItemById,
  formatCampaignDateTime,
  getCampaignContentTypeIcon,
  roiTierLabel,
  type PublishCampaignHorizon,
  type PublishCampaignInsight,
  type PublishCampaignItem,
} from "../../utils/publishCampaignUtils";
import { QualityCheckModal, ScheduleQuickModal } from "./PublishWedgeModals";
import { apiClient } from "../../../../api/client";
import { openDraftContentInStudio } from "../../utils/openDraftInStudio";
import type { LinkedInDraftContentType } from "../../utils/linkedInDraftContentTypeStorage";

const DISMISS_STORAGE_KEY = "alwrity-publish-campaign-dismissed-insights";

const ROI_TIER_COLORS = {
  high: { bg: "#dcfce7", text: "#059669", border: "#86efac" },
  medium: { bg: "#fef9c3", text: "#d97706", border: "#fde68a" },
  low: { bg: "#f1f5f9", text: "#6b7280", border: "#e2e8f0" },
};

function loadDismissed(): Set<string> {
  try {
    const raw = localStorage.getItem(DISMISS_STORAGE_KEY);
    if (!raw) return new Set();
    return new Set(JSON.parse(raw) as string[]);
  } catch {
    return new Set();
  }
}

function saveDismissed(ids: Set<string>) {
  try {
    localStorage.setItem(DISMISS_STORAGE_KEY, JSON.stringify([...ids]));
  } catch {
    /* ignore */
  }
}

const Spinner = () => (
  <>
    <style>{`@keyframes pc-spin { to { transform: rotate(360deg); } }`}</style>
    <span
      style={{
        display: "inline-block",
        width: 16,
        height: 16,
        border: "2px solid #d1d5db",
        borderTopColor: "#0ea5e9",
        borderRadius: "50%",
        animation: "pc-spin 0.7s linear infinite",
      }}
    />
  </>
);

interface PublishCampaignModalProps {
  open: boolean;
  onClose: () => void;
}

export const PublishCampaignModal: React.FC<PublishCampaignModalProps> = ({
  open,
  onClose,
}) => {
  const navigate = useNavigate();
  const { data, loading, error, horizonDays, setHorizonDays, refresh } =
    useLinkedInPublishCampaignData(open);

  const [dismissed, setDismissed] = useState<Set<string>>(() => loadDismissed());
  const [qualityItem, setQualityItem] = useState<PublishCampaignItem | null>(null);
  const [scheduleItem, setScheduleItem] = useState<PublishCampaignItem | null>(null);
  const [scheduleContent, setScheduleContent] = useState<string>("");
  const [loadingContent, setLoadingContent] = useState(false);

  const visibleInsights = useMemo(() => {
    if (!data) return [];
    return data.insights.filter((i) => !dismissed.has(i.id));
  }, [data, dismissed]);

  const dismissInsight = useCallback((id: string) => {
    setDismissed((prev) => {
      const next = new Set(prev);
      next.add(id);
      saveDismissed(next);
      return next;
    });
  }, []);

  const openInStudio = useCallback(
    (content: string, contentType?: LinkedInDraftContentType) => {
      openDraftContentInStudio(content, contentType, onClose);
    },
    [onClose],
  );

  const resolveItemContent = useCallback(
    async (item: PublishCampaignItem): Promise<string> => {
      if (item.contentPreview && item.contentPreview.length >= 60) {
        return item.contentPreview;
      }
      if (item.assetId) {
        try {
          const res = await apiClient.get(
            `/api/content-assets/${item.assetId}/content`,
          );
          const body = res.data?.content ?? res.data ?? "";
          if (typeof body === "string") return body;
        } catch {
          /* fall through */
        }
      }
      return item.contentPreview ?? "";
    },
    [],
  );

  const handleQualityCheck = useCallback(
    async (item: PublishCampaignItem) => {
      setLoadingContent(true);
      try {
        const content = await resolveItemContent(item);
        setQualityItem({ ...item, contentPreview: content });
      } finally {
        setLoadingContent(false);
      }
    },
    [resolveItemContent],
  );

  const handleSchedule = useCallback(
    async (item: PublishCampaignItem) => {
      setLoadingContent(true);
      try {
        const content = await resolveItemContent(item);
        setScheduleContent(content);
        setScheduleItem(item);
      } finally {
        setLoadingContent(false);
      }
    },
    [resolveItemContent],
  );

  const handleInsightAction = useCallback(
    async (insight: PublishCampaignInsight) => {
      if (!data) return;
      const item = insight.targetItemId
        ? findCampaignItemById(data.items, insight.targetItemId)
        : undefined;

      switch (insight.actionType) {
        case "open_calendar":
          onClose();
          navigate("/content-planning", { state: { activeTab: 1 } });
          break;
        case "quality_check":
          if (item) await handleQualityCheck(item);
          break;
        case "schedule":
        case "reschedule":
          if (item) await handleSchedule(item);
          break;
        case "open_studio":
          if (item) {
            const content = await resolveItemContent(item);
            openInStudio(content, item.contentType);
          }
          break;
        default:
          break;
      }
    },
    [
      data,
      handleQualityCheck,
      handleSchedule,
      navigate,
      onClose,
      openInStudio,
      resolveItemContent,
    ],
  );

  return (
    <>
      <DashboardActionModal
        open={open}
        title="Publish Campaign"
        onClose={onClose}
        {...POST_WEDGE_MODAL_SIZE}
        titleSize="xl"
        modalClassName={`linkedin-publish-campaign-modal ${POST_WEDGE_MODAL_SIZE_CLASS}`}
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
            Your LinkedIn publish plan for the next {horizonDays} days — ranked
            by predicted ROI with actionable next steps. Scheduled in ALwrity
            Calendar (not LinkedIn-native queue).
          </p>

          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              gap: 10,
              marginBottom: 16,
            }}
          >
            <span style={{ fontSize: 12, fontWeight: 600, color: "#374151" }}>
              Horizon:
            </span>
            {([7, 14] as PublishCampaignHorizon[]).map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setHorizonDays(d)}
                style={{
                  padding: "5px 12px",
                  borderRadius: 999,
                  border: "1.5px solid",
                  borderColor: horizonDays === d ? "#0ea5e9" : "#d1d5db",
                  background: horizonDays === d ? "#e0f2fe" : "#fff",
                  color: horizonDays === d ? "#0284c7" : "#6b7280",
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                {d} days
              </button>
            ))}
            <button
              type="button"
              onClick={() => void refresh()}
              disabled={loading}
              style={{
                marginLeft: "auto",
                padding: "5px 12px",
                borderRadius: 8,
                border: "1px solid #e5e7eb",
                background: "#fff",
                fontSize: 12,
                fontWeight: 600,
                color: "#64748b",
                cursor: loading ? "wait" : "pointer",
              }}
            >
              Refresh
            </button>
          </div>

          {data && (
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 10,
                marginBottom: 16,
                padding: "12px 14px",
                background: "#f0f9ff",
                borderRadius: 10,
                border: "1px solid #bae6fd",
              }}
            >
              <div style={{ flex: "1 1 120px" }}>
                <div style={{ fontSize: 11, color: "#64748b", fontWeight: 600 }}>
                  Campaign health
                </div>
                <div style={{ fontSize: 22, fontWeight: 800, color: "#0284c7" }}>
                  {data.healthScore}
                  <span style={{ fontSize: 13, fontWeight: 600 }}>/100</span>
                </div>
              </div>
              <div style={{ flex: "1 1 100px" }}>
                <div style={{ fontSize: 11, color: "#64748b", fontWeight: 600 }}>
                  Scheduled
                </div>
                <div style={{ fontSize: 18, fontWeight: 700, color: "#111827" }}>
                  {data.scheduledCount}
                </div>
              </div>
              <div style={{ flex: "1 1 100px" }}>
                <div style={{ fontSize: 11, color: "#64748b", fontWeight: 600 }}>
                  Ready drafts
                </div>
                <div style={{ fontSize: 18, fontWeight: 700, color: "#111827" }}>
                  {data.readyDraftCount}
                </div>
              </div>
            </div>
          )}

          {visibleInsights.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: "#6b7280",
                  textTransform: "uppercase",
                  letterSpacing: 0.6,
                  marginBottom: 8,
                }}
              >
                Actionable insights
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {visibleInsights.map((insight) => (
                  <InsightCard
                    key={insight.id}
                    insight={insight}
                    onAction={() => void handleInsightAction(insight)}
                    onDismiss={() => dismissInsight(insight.id)}
                  />
                ))}
              </div>
            </div>
          )}

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
              <Spinner /> Loading campaign…
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

          {!loading && !error && data && data.items.length === 0 && (
            <div
              style={{
                textAlign: "center",
                padding: "36px 16px",
                color: "#94a3b8",
                fontSize: 13,
              }}
            >
              No campaign items in this window. Schedule content from My Drafts
              or generate in Create wedge.
            </div>
          )}

          {!loading && data && data.items.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: "#6b7280",
                  textTransform: "uppercase",
                  letterSpacing: 0.6,
                }}
              >
                Campaign timeline
              </div>
              {data.items.map((item) => (
                <CampaignItemCard
                  key={item.id}
                  item={item}
                  disabled={loadingContent}
                  onOpenStudio={() =>
                    void resolveItemContent(item).then((content) =>
                      openInStudio(content, item.contentType),
                    )
                  }
                  onQualityCheck={() => void handleQualityCheck(item)}
                  onSchedule={() => void handleSchedule(item)}
                />
              ))}
            </div>
          )}

          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              marginTop: 16,
              paddingTop: 12,
              borderTop: "1px solid #e5e7eb",
            }}
          >
            <button
              type="button"
              onClick={() => {
                onClose();
                navigate("/content-planning", { state: { activeTab: 1 } });
              }}
              style={{
                padding: "8px 16px",
                borderRadius: 8,
                border: "1.5px solid #0ea5e9",
                background: "#fff",
                color: "#0284c7",
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Open full calendar →
            </button>
          </div>
        </div>
      </DashboardActionModal>

      <QualityCheckModal
        open={!!qualityItem}
        onClose={() => setQualityItem(null)}
        initialContent={qualityItem?.contentPreview}
        initialContentType={qualityItem?.contentType}
        contextHint={qualityItem?.title}
      />

      <ScheduleQuickModal
        open={!!scheduleItem}
        onClose={() => {
          setScheduleItem(null);
          setScheduleContent("");
          void refresh();
        }}
        initialContent={scheduleContent}
        initialTopic={scheduleItem?.title}
      />
    </>
  );
};

const InsightCard: React.FC<{
  insight: PublishCampaignInsight;
  onAction: () => void;
  onDismiss: () => void;
}> = ({ insight, onAction, onDismiss }) => {
  const priorityColor =
    insight.priority === "high"
      ? "#dc2626"
      : insight.priority === "medium"
        ? "#d97706"
        : "#64748b";

  return (
    <div
      style={{
        padding: "10px 12px",
        borderRadius: 10,
        border: "1px solid #e2e8f0",
        background: "#f8fafc",
        display: "flex",
        gap: 10,
        alignItems: "flex-start",
      }}
    >
      <span
        style={{
          width: 8,
          height: 8,
          borderRadius: "50%",
          background: priorityColor,
          marginTop: 5,
          flexShrink: 0,
        }}
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, color: "#374151", lineHeight: 1.45 }}>
          {insight.message}
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
          {insight.ctaLabel && insight.actionType && (
            <button
              type="button"
              onClick={onAction}
              style={{
                padding: "4px 10px",
                borderRadius: 6,
                border: "none",
                background: "#0ea5e9",
                color: "#fff",
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              {insight.ctaLabel}
            </button>
          )}
          <button
            type="button"
            onClick={onDismiss}
            style={{
              padding: "4px 10px",
              borderRadius: 6,
              border: "1px solid #e5e7eb",
              background: "#fff",
              color: "#64748b",
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
};

const CampaignItemCard: React.FC<{
  item: PublishCampaignItem;
  disabled?: boolean;
  onOpenStudio: () => void;
  onQualityCheck: () => void;
  onSchedule: () => void;
}> = ({ item, disabled, onOpenStudio, onQualityCheck, onSchedule }) => {
  const tier = ROI_TIER_COLORS[item.roiTier];

  return (
    <div
      style={{
        borderRadius: 12,
        border: "1.5px solid #e2e8f0",
        padding: "12px 14px",
        background: "#fff",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: 10,
          marginBottom: 8,
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontWeight: 700,
              fontSize: 14,
              color: "#111827",
              marginBottom: 2,
            }}
          >
            {getCampaignContentTypeIcon(item.contentType)} {item.title}
          </div>
          <div style={{ fontSize: 12, color: "#64748b" }}>
            {formatCampaignDateTime(item.scheduledAt)} ·{" "}
            {item.status === "ready" ? "Ready to schedule" : item.status}
          </div>
        </div>
        <span
          style={{
            fontSize: 11,
            fontWeight: 700,
            padding: "3px 8px",
            borderRadius: 999,
            background: tier.bg,
            color: tier.text,
            border: `1px solid ${tier.border}`,
            whiteSpace: "nowrap",
          }}
        >
          {roiTierLabel(item.roiTier)}
        </span>
      </div>

      {item.contentPreview && (
        <div
          style={{
            fontSize: 12,
            color: "#6b7280",
            lineHeight: 1.5,
            marginBottom: 10,
            padding: "8px 10px",
            background: "#f8fafc",
            borderRadius: 8,
          }}
        >
          {item.contentPreview.slice(0, 120)}
          {item.contentPreview.length > 120 ? "…" : ""}
        </div>
      )}

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <ActionBtn label="Studio" onClick={onOpenStudio} disabled={disabled} />
        <ActionBtn
          label="Quality"
          onClick={onQualityCheck}
          disabled={disabled}
          accent="#8b5cf6"
        />
        <ActionBtn
          label={item.scheduledAt ? "Reschedule" : "Schedule"}
          onClick={onSchedule}
          disabled={disabled}
          accent="#10b981"
        />
      </div>
    </div>
  );
};

const ActionBtn: React.FC<{
  label: string;
  onClick: () => void;
  disabled?: boolean;
  accent?: string;
}> = ({ label, onClick, disabled, accent = "#0a66c2" }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    style={{
      padding: "5px 12px",
      borderRadius: 7,
      border: `1px solid ${accent}`,
      background: "#fff",
      color: accent,
      fontSize: 12,
      fontWeight: 600,
      cursor: disabled ? "wait" : "pointer",
      opacity: disabled ? 0.6 : 1,
    }}
  >
    {label}
  </button>
);
