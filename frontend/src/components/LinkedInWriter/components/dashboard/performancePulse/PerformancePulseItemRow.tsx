import React from "react";
import { colors, rowBase } from "../../GrowthEngine/styles";
import { EngagementSpinner } from "../engagementWedgeSharedUi";
import { PerformancePulseContentTypeBadge } from "./PerformancePulseContentTypeBadge";
import { PerformancePulseTransformActions } from "./PerformancePulseTransformActions";
import type { PerformanceContentType, PerformancePulseItem } from "./types";

export interface PerformancePulseItemRowProps {
  item: PerformancePulseItem;
  boostedVersion?: string;
  isBoosting: boolean;
  onRepurpose: () => void;
  onWriteMore: () => void;
  onBoost: () => void;
  onAcceptBoost: () => void;
  onTransform?: (targetType: PerformanceContentType) => void;
  dim?: boolean;
}

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

export const PerformancePulseItemRow: React.FC<PerformancePulseItemRowProps> = ({
  item,
  boostedVersion,
  isBoosting,
  onRepurpose,
  onWriteMore,
  onBoost,
  onAcceptBoost,
  onTransform,
  dim,
}) => {
  const { post, contentType } = item;
  const m = post.engagement;
  const rate = m?.engagement_rate ?? 0;
  const ratePct = (rate * 100).toFixed(1);
  const rateColor =
    rate >= 0.05 ? "#166534" : rate >= 0.02 ? "#854d0e" : "#991b1b";
  const rateBg =
    rate >= 0.05 ? "#dcfce7" : rate >= 0.02 ? "#fef9c3" : "#fee2e2";
  const text = post.text ?? "";
  const snippet = text.slice(0, 100) + (text.length > 100 ? "…" : "");

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
          {snippet || "(No text)"}
        </div>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-end",
            gap: 4,
            flexShrink: 0,
          }}
        >
          <PerformancePulseContentTypeBadge contentType={contentType} />
          <span
            style={{
              fontSize: 11,
              fontWeight: 800,
              background: rateBg,
              color: rateColor,
              padding: "2px 7px",
              borderRadius: 5,
              whiteSpace: "nowrap",
            }}
          >
            {ratePct}% eng.
          </span>
        </div>
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

      {!boostedVersion && onTransform && (
        <PerformancePulseTransformActions
          sourceType={contentType}
          onTransform={onTransform}
        />
      )}
    </div>
  );
};
