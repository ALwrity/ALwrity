/**
 * P5 — Compact Growth Engine teaser linking to the unified Grow Network modal.
 */
import React from "react";
import { openGrowNetworkModal } from "../../utils/linkedInDashboardEvents";
import { GROW_NETWORK_ENGINE_LINK } from "../dashboard/growNetworkConstants";
import { DataSourceBadge } from "./DataSourceBadge";
import { cardBase, colors, primaryBtn, secondaryBtn } from "./styles";

export interface GrowNetworkEngineLinkCardProps {
  suggestionCount: number;
  dataSourceSummary?: string;
  updatedLabel?: string;
  onRefresh?: () => void;
  refreshing?: boolean;
  /** Optional preview names from cached AI suggestions (max 2). */
  previewNames?: string[];
}

export const GrowNetworkEngineLinkCard: React.FC<
  GrowNetworkEngineLinkCardProps
> = ({
  suggestionCount,
  dataSourceSummary,
  updatedLabel,
  onRefresh,
  refreshing = false,
  previewNames = [],
}) => {
  const handleOpen = () => {
    openGrowNetworkModal({ scrollToSection: "ai-advisor" });
  };

  const countLine =
    suggestionCount > 0
      ? `${suggestionCount} grounded AI suggestion${suggestionCount === 1 ? "" : "s"} ready`
      : "Grounded AI outreach + live LinkedIn PYMK in one workspace";

  return (
    <div style={cardBase}>
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 12,
          marginBottom: 10,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 20 }} aria-hidden="true">
            🌐
          </span>
          <div>
            <div
              style={{ fontWeight: 700, fontSize: 15, color: colors.textDark }}
            >
              {GROW_NETWORK_ENGINE_LINK.title}
            </div>
            <div
              style={{
                fontSize: 12,
                color: colors.textSecondary,
                marginTop: 2,
                lineHeight: 1.45,
              }}
            >
              {GROW_NETWORK_ENGINE_LINK.description}
            </div>
          </div>
        </div>
        {updatedLabel ? (
          <span
            style={{
              fontSize: 11,
              color: colors.textSecondary,
              whiteSpace: "nowrap",
            }}
          >
            Updated {updatedLabel}
          </span>
        ) : null}
      </div>

      <p
        style={{
          margin: "0 0 10px",
          fontSize: 13,
          color: colors.textBody,
          lineHeight: 1.5,
        }}
      >
        {countLine}
        {previewNames.length > 0 ? (
          <>
            {" "}
            — e.g. {previewNames.slice(0, 2).join(", ")}
            {suggestionCount > previewNames.length ? "…" : ""}
          </>
        ) : null}
      </p>

      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <button
          type="button"
          onClick={handleOpen}
          style={primaryBtn}
          aria-label={GROW_NETWORK_ENGINE_LINK.cta}
        >
          {GROW_NETWORK_ENGINE_LINK.cta}
        </button>
        {onRefresh ? (
          <button
            type="button"
            onClick={onRefresh}
            disabled={refreshing}
            style={{
              ...secondaryBtn,
              opacity: refreshing ? 0.6 : 1,
            }}
            aria-label="Refresh AI network suggestions"
          >
            {refreshing ? "⟳ Refreshing…" : "↻ Refresh AI data"}
          </button>
        ) : null}
      </div>

      {dataSourceSummary ? (
        <div style={{ marginTop: 12 }}>
          <DataSourceBadge label="Grow Network" detail={dataSourceSummary} />
        </div>
      ) : null}
    </div>
  );
};
