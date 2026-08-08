/**
 * Compact banner when Quick Create is pre-filled from a Performance Pulse reference post.
 */
import React, { useState } from "react";
import type { PostPulseCreateMode } from "./postPulseCreateUtils";

const MODE_LABELS: Record<PostPulseCreateMode, string> = {
  repurpose: "Repurpose",
  write_more: "Write More Like This",
};

interface ReferencePostContextBannerProps {
  mode: PostPulseCreateMode;
  referenceContext: string;
}

export const ReferencePostContextBanner: React.FC<
  ReferencePostContextBannerProps
> = ({ mode, referenceContext }) => {
  const [expanded, setExpanded] = useState(false);
  const preview = referenceContext.replace(/^CREATION INTENT:.*?\n\n/s, "").trim();

  return (
    <div
      style={{
        marginBottom: 14,
        padding: "10px 12px",
        background: "#f0f9ff",
        border: "1px solid #bae6fd",
        borderRadius: 10,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
        }}
      >
        <span style={{ fontSize: 12, fontWeight: 600, color: "#0369a1" }}>
          📎 Reference post attached ({MODE_LABELS[mode]})
        </span>
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          style={{
            background: "none",
            border: "none",
            fontSize: 11,
            fontWeight: 600,
            color: "#0284c7",
            cursor: "pointer",
            padding: "2px 6px",
          }}
        >
          {expanded ? "Hide" : "Preview"}
        </button>
      </div>
      <p
        style={{
          margin: "6px 0 0",
          fontSize: 11,
          color: "#475569",
          lineHeight: 1.45,
        }}
      >
        Key Points below outline your new post. The reference post is used
        internally for tone and message — it won&apos;t be pasted into Key Points.
      </p>
      {expanded && (
        <pre
          style={{
            margin: "8px 0 0",
            padding: "8px 10px",
            background: "#fff",
            border: "1px solid #e2e8f0",
            borderRadius: 8,
            fontSize: 11,
            lineHeight: 1.5,
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
            maxHeight: 160,
            overflowY: "auto",
            color: "#334155",
            fontFamily: "inherit",
          }}
        >
          {preview}
        </pre>
      )}
    </div>
  );
};
