import React from "react";

import {
  getDraftAssetContent,
  getDraftContentType,
  type LinkedInDraftAsset,
} from "../../../utils/linkedInDraftLibraryUtils";
import { ConnectLockIcon } from "../ConnectLockIcon";
import { EngagementBoosterLaunchButton } from "../EngagementBoosterLaunchButton";
import { PerformancePulseContentTypeBadge } from "../performancePulse/PerformancePulseContentTypeBadge";
import type { PerformanceContentType } from "../performancePulse/types";
import {
  PUBLISH_WEDGE_SCHEDULE_LOCKED_HINT,
  PUBLISH_WEDGE_TIMING_LOCKED_HINT,
} from "../../../utils/linkedInPublishWedgeLockedUi";
import { publishWedgePanelBtn } from "./publishWedgePanelUi";

export interface DraftLibraryCardProps {
  asset: LinkedInDraftAsset;
  scheduleLocked: boolean;
  timingLocked: boolean;
  onOpenInStudio: (asset: LinkedInDraftAsset) => void;
  onQualityCheck: (asset: LinkedInDraftAsset) => void;
  onSchedule: (asset: LinkedInDraftAsset) => void;
  onBestTime: (asset: LinkedInDraftAsset) => void;
}

function resolveDraftBadgeType(
  asset: LinkedInDraftAsset,
): PerformanceContentType {
  return getDraftContentType(asset) ?? "post";
}

export const DraftLibraryCard: React.FC<DraftLibraryCardProps> = ({
  asset,
  scheduleLocked,
  timingLocked,
  onOpenInStudio,
  onQualityCheck,
  onSchedule,
  onBestTime,
}) => {
  const assetContent = getDraftAssetContent(asset);
  const contentType = resolveDraftBadgeType(asset);
  const isShort = assetContent.length < 60 && assetContent === asset.title;

  return (
    <div
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
              display: "flex",
              alignItems: "center",
              gap: 8,
              marginBottom: 2,
              minWidth: 0,
            }}
          >
            <div
              style={{
                fontWeight: 700,
                fontSize: 14,
                color: "#111827",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
                flex: 1,
                minWidth: 0,
              }}
            >
              {asset.title || "Untitled Draft"}
            </div>
            <PerformancePulseContentTypeBadge contentType={contentType} />
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
                <span>{asset.description.split(/\s+/).length} words</span>
              </>
            )}
          </div>
        </div>
      </div>

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
          `"${assetContent.slice(0, 150)}${assetContent.length > 150 ? "…" : ""}"`
        )}
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button
          type="button"
          style={publishWedgePanelBtn(true)}
          onClick={() => onOpenInStudio(asset)}
        >
          ✍️ Open in Studio
        </button>
        <button
          type="button"
          style={{
            ...publishWedgePanelBtn(),
            borderColor: "#8b5cf6",
            color: "#8b5cf6",
          }}
          onClick={() => onQualityCheck(asset)}
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
            ...publishWedgePanelBtn(false, false, scheduleLocked),
            borderColor: scheduleLocked ? "#d1d5db" : "#10b981",
            color: scheduleLocked ? "#9ca3af" : "#10b981",
          }}
          disabled={scheduleLocked}
          title={
            scheduleLocked ? PUBLISH_WEDGE_SCHEDULE_LOCKED_HINT : undefined
          }
          aria-label={
            scheduleLocked ? "Schedule — coming soon" : "Schedule this draft"
          }
          onClick={() => {
            if (!scheduleLocked) onSchedule(asset);
          }}
        >
          📅 Schedule
          {scheduleLocked && <ConnectLockIcon size={12} />}
        </button>
        <button
          type="button"
          style={{
            ...publishWedgePanelBtn(false, false, timingLocked),
            borderColor: timingLocked ? "#d1d5db" : "#0ea5e9",
            color: timingLocked ? "#9ca3af" : "#0ea5e9",
          }}
          disabled={timingLocked}
          title={timingLocked ? PUBLISH_WEDGE_TIMING_LOCKED_HINT : undefined}
          aria-label={
            timingLocked
              ? "Best Time — coming soon"
              : "Find the best time to post this draft"
          }
          onClick={() => {
            if (!timingLocked) onBestTime(asset);
          }}
        >
          ⏰ Best Time
          {timingLocked && <ConnectLockIcon size={12} />}
        </button>
      </div>
    </div>
  );
};
