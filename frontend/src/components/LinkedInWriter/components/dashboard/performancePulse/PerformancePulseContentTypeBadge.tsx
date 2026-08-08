import React from "react";
import { getPerformanceContentTypeMeta } from "./contentTypeLabels";
import type { PerformanceContentType } from "./types";

export const PerformancePulseContentTypeBadge: React.FC<{
  contentType: PerformanceContentType;
}> = ({ contentType }) => {
  const meta = getPerformanceContentTypeMeta(contentType);

  return (
    <span
      title={`Content format: ${meta.label}`}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        fontSize: 10,
        fontWeight: 700,
        background: meta.background,
        color: meta.color,
        padding: "2px 7px",
        borderRadius: 5,
        whiteSpace: "nowrap",
        flexShrink: 0,
        letterSpacing: "0.02em",
      }}
    >
      <span aria-hidden>{meta.icon}</span>
      {meta.label}
    </span>
  );
};
