import React from "react";
import { colors } from "../../GrowthEngine/styles";
import {
  PERFORMANCE_PULSE_FILTER_TABS,
  getFilterTabLabel,
} from "./performancePulseFilterConfig";
import type {
  PerformancePulseFilter,
  PerformancePulseFilterCounts,
} from "./types";

export interface PerformancePulseFilterTabsProps {
  activeFilter: PerformancePulseFilter;
  counts: PerformancePulseFilterCounts;
  onChange: (filter: PerformancePulseFilter) => void;
}

export const PerformancePulseFilterTabs: React.FC<
  PerformancePulseFilterTabsProps
> = ({ activeFilter, counts, onChange }) => (
  <div
    role="tablist"
    aria-label="Filter content by format"
    style={{
      display: "flex",
      gap: 6,
      flexWrap: "wrap",
      marginBottom: 14,
    }}
  >
    {PERFORMANCE_PULSE_FILTER_TABS.map((tab) => {
      const isActive = activeFilter === tab.id;
      const count = tab.id === "all" ? counts.all : counts[tab.id];
      const disabled = tab.id !== "all" && count === 0;

      return (
        <button
          key={tab.id}
          type="button"
          role="tab"
          aria-selected={isActive}
          disabled={disabled}
          onClick={() => onChange(tab.id)}
          style={{
            padding: "5px 11px",
            borderRadius: 999,
            border: isActive
              ? `1.5px solid ${colors.primary}`
              : "1.5px solid #e2e8f0",
            background: isActive ? "#eff6ff" : disabled ? "#f8fafc" : "#fff",
            color: disabled
              ? colors.textTertiary
              : isActive
                ? colors.primary
                : colors.textSecondary,
            fontSize: 11,
            fontWeight: isActive ? 700 : 600,
            cursor: disabled ? "not-allowed" : "pointer",
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            opacity: disabled ? 0.55 : 1,
          }}
        >
          {tab.icon && <span aria-hidden>{tab.icon}</span>}
          {getFilterTabLabel(tab.id, tab.id === "all" ? undefined : count)}
        </button>
      );
    })}
  </div>
);
