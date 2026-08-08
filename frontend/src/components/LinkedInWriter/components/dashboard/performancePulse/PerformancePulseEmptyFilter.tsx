import React from "react";
import { colors } from "../../GrowthEngine/styles";
import { getEmptyFilterMessage } from "./performancePulseFilterConfig";
import type { PerformancePulseFilter } from "./types";

export interface PerformancePulseEmptyFilterProps {
  filter: PerformancePulseFilter;
  onShowAll: () => void;
}

export const PerformancePulseEmptyFilter: React.FC<
  PerformancePulseEmptyFilterProps
> = ({ filter, onShowAll }) => (
  <div
    style={{
      textAlign: "center",
      padding: "24px 16px",
      background: "#f8fafc",
      borderRadius: 10,
      border: "1px dashed #cbd5e1",
    }}
  >
    <div style={{ fontSize: 28, marginBottom: 8 }}>🔍</div>
    <div
      style={{
        fontSize: 14,
        fontWeight: 700,
        color: colors.textDark,
        marginBottom: 6,
      }}
    >
      Nothing in this filter
    </div>
    <p
      style={{
        margin: "0 0 14px",
        fontSize: 13,
        color: colors.textSecondary,
        lineHeight: 1.5,
      }}
    >
      {getEmptyFilterMessage(filter)}
    </p>
    <button
      type="button"
      onClick={onShowAll}
      style={{
        padding: "6px 14px",
        background: colors.primary,
        color: "#fff",
        border: "none",
        borderRadius: 6,
        fontSize: 12,
        fontWeight: 700,
        cursor: "pointer",
      }}
    >
      Show all content
    </button>
  </div>
);
