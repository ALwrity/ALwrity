import React, { useState } from "react";
import { colors } from "../../GrowthEngine/styles";
import { getTransformFormatsForSource } from "./repurposeFormats";
import type { PerformanceContentType } from "./types";

export interface PerformancePulseTransformActionsProps {
  sourceType: PerformanceContentType;
  onTransform: (targetType: PerformanceContentType) => void;
}

export const PerformancePulseTransformActions: React.FC<
  PerformancePulseTransformActionsProps
> = ({ sourceType, onTransform }) => {
  const [expanded, setExpanded] = useState(false);
  const targets = getTransformFormatsForSource(sourceType);

  if (targets.length === 0) return null;

  return (
    <div style={{ marginTop: 8 }}>
      <button
        type="button"
        onClick={() => setExpanded((prev) => !prev)}
        aria-expanded={expanded}
        style={{
          padding: 0,
          background: "none",
          border: "none",
          fontSize: 11,
          fontWeight: 600,
          color: colors.textTertiary,
          cursor: "pointer",
        }}
      >
        {expanded ? "▾ Hide transform options" : "▸ Transform to another format"}
      </button>

      {expanded && (
        <div
          style={{
            display: "flex",
            gap: 6,
            flexWrap: "wrap",
            marginTop: 8,
          }}
        >
          {targets.map((format) => (
            <button
              key={format.type}
              type="button"
              onClick={() => onTransform(format.type)}
              style={{
                padding: "4px 10px",
                background:
                  format.type === "post" ? "none" : format.accent,
                color: format.type === "post" ? format.accent : "#fff",
                border: `1.5px solid ${format.accent}`,
                borderRadius: 6,
                fontSize: 10,
                fontWeight: 700,
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
              }}
            >
              {format.icon} {format.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
