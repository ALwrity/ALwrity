/**
 * After Confirm Changes — show added/deleted highlights so users see what changed.
 * Reuses contentFormatters.diffMarkup classes (liw-add / liw-del).
 */

import React, { useEffect } from "react";

const LOG_PREFIX = "[LinkedInConfirmedEditHighlight]";
const AUTO_DISMISS_MS = 12000;

export interface LinkedInConfirmedEditHighlightProps {
  html: string | null;
  onDismiss: () => void;
}

export const LinkedInConfirmedEditHighlight: React.FC<
  LinkedInConfirmedEditHighlightProps
> = ({ html, onDismiss }) => {
  useEffect(() => {
    if (!html) return undefined;
    console.log(`${LOG_PREFIX} showing confirmed edit highlight`, {
      htmlLength: html.length,
    });
    const timer = window.setTimeout(() => {
      console.log(`${LOG_PREFIX} auto-dismiss highlight`);
      onDismiss();
    }, AUTO_DISMISS_MS);
    return () => window.clearTimeout(timer);
  }, [html, onDismiss]);

  if (!html) return null;

  return (
    <div
      style={{
        margin: "0 0 16px 0",
        border: "1px solid #bbf7d0",
        borderRadius: 8,
        background: "#f0fdf4",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          padding: "10px 14px",
          borderBottom: "1px solid #bbf7d0",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
        }}
      >
        <strong style={{ color: "#166534", fontSize: 13 }}>
          Changes applied — green = added, red = removed
        </strong>
        <button
          type="button"
          onClick={onDismiss}
          style={{
            padding: "4px 10px",
            background: "#fff",
            color: "#166534",
            border: "1px solid #86efac",
            borderRadius: 6,
            cursor: "pointer",
            fontSize: 12,
            fontWeight: 600,
          }}
        >
          Dismiss
        </button>
      </div>
      <div style={{ padding: 14 }}>
        <div
          className="liw-confirmed-diff"
          style={{
            fontFamily: "inherit",
            fontSize: 14,
            lineHeight: 1.65,
            whiteSpace: "pre-wrap",
            color: "#0f172a",
            background: "#fff",
            border: "1px solid #e2e8f0",
            borderRadius: 8,
            padding: 12,
            maxHeight: 220,
            overflow: "auto",
          }}
          dangerouslySetInnerHTML={{ __html: html }}
        />
        <style>{`
          .liw-confirmed-diff .liw-add {
            background: #bbf7d0;
            color: #14532d;
            font-style: normal;
            font-weight: 600;
            border-radius: 2px;
            padding: 0 2px;
          }
          .liw-confirmed-diff .liw-del {
            background: #fecaca;
            color: #7f1d1d;
            text-decoration: line-through;
            opacity: 1;
            border-radius: 2px;
            padding: 0 2px;
          }
          .liw-confirmed-diff .liw-more {
            color: #475569;
            font-weight: 500;
          }
        `}</style>
      </div>
    </div>
  );
};
