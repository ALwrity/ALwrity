import React, { useState } from "react";
import { colors } from "../../GrowthEngine/styles";
import { FormatActionButton } from "./FormatActionButton";
import { getPerformancePulseTransformFormats } from "./performancePulseTransformFormats";
import type { PerformanceContentType } from "./types";

export interface PerformancePulseTransformActionsProps {
  sourceType: PerformanceContentType;
  onTransform: (targetType: PerformanceContentType) => void;
}

export const PerformancePulseTransformActions: React.FC<
  PerformancePulseTransformActionsProps
> = ({ sourceType, onTransform }) => {
  const [expanded, setExpanded] = useState(false);
  const targets = getPerformancePulseTransformFormats(sourceType);

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
            <FormatActionButton
              key={format.type}
              icon={format.icon}
              label={format.label}
              colors={{ bg: format.bg, border: format.border, text: format.text }}
              locked={Boolean(format.locked)}
              compact
              onClick={() => {
                if (!format.locked) onTransform(format.type);
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
};
