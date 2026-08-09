import React from "react";
import type { SavedBrainstormIdea } from "./MySavedIdeas";
import type { QuickCreateReturnTarget } from "../dashboard/workflowWedgeNavigation";

const ITEM_STYLE: React.CSSProperties = {
  padding: "14px 16px",
  border: "1px solid #e2e8f0",
  borderRadius: 10,
  background: "#ffffff",
  display: "flex",
  flexDirection: "column",
  gap: 8,
};

const ACTION_BTN_STYLE: React.CSSProperties = {
  padding: "6px 12px",
  borderRadius: 8,
  fontSize: 12,
  fontWeight: 600,
  cursor: "pointer",
};

const PRIMARY_BTN_STYLE: React.CSSProperties = {
  ...ACTION_BTN_STYLE,
  background: "#0a66c2",
  color: "#ffffff",
  border: "none",
};

const SECONDARY_BTN_STYLE: React.CSSProperties = {
  ...ACTION_BTN_STYLE,
  background: "#ffffff",
  color: "#475569",
  border: "1px solid #cbd5e1",
};

const DANGER_BTN_STYLE: React.CSSProperties = {
  ...ACTION_BTN_STYLE,
  background: "#ffffff",
  color: "#b91c1c",
  border: "1px solid #fecaca",
};

export interface MySavedIdeasBodyProps {
  ideas: SavedBrainstormIdea[];
  loading: boolean;
  error: string | null;
  copiedId: string | null;
  deletingId: string | null;
  onUseInCopilot?: (prompt: string) => void;
  onClose: () => void;
  onCopy: (idea: SavedBrainstormIdea) => void;
  onDelete: (idea: SavedBrainstormIdea) => void;
  quickCreateReturnTo?: QuickCreateReturnTarget;
  formatRelative: (iso: string) => string;
}

export const MySavedIdeasBody: React.FC<MySavedIdeasBodyProps> = ({
  ideas,
  loading,
  error,
  copiedId,
  deletingId,
  onUseInCopilot,
  onClose,
  onCopy,
  onDelete,
  quickCreateReturnTo,
  formatRelative,
}) => (
  <>
    {error && (
      <div
        style={{
          padding: 12,
          borderRadius: 8,
          background: "#fef2f2",
          color: "#b91c1c",
          border: "1px solid #fecaca",
          fontSize: 13,
          marginBottom: 12,
        }}
      >
        {error}
      </div>
    )}

    {loading && ideas.length === 0 && (
      <div style={{ padding: 24, textAlign: "center", color: "#64748b" }}>
        Loading your saved ideas…
      </div>
    )}

    {!loading && !error && ideas.length === 0 && (
      <div
        style={{
          padding: 32,
          textAlign: "center",
          color: "#64748b",
          background: "#ffffff",
          border: "1px dashed #cbd5e1",
          borderRadius: 12,
        }}
      >
        <div style={{ fontSize: 32, marginBottom: 8 }}>📭</div>
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>
          No saved ideas yet
        </div>
        <div style={{ fontSize: 12 }}>
          Run a brainstorm and tap the bookmark on any idea to keep it.
        </div>
      </div>
    )}

    {ideas.length > 0 && (
      <div style={{ display: "grid", gap: 10 }}>
        {ideas.map((idea) => (
          <div key={idea.id} style={ITEM_STYLE}>
            <div
              style={{
                fontSize: 14,
                fontWeight: 600,
                color: "#0f172a",
                lineHeight: 1.4,
              }}
            >
              {idea.prompt}
            </div>
            {idea.rationale && (
              <div
                style={{
                  fontSize: 12,
                  color: "#64748b",
                  lineHeight: 1.45,
                }}
              >
                {idea.rationale}
              </div>
            )}
            {idea.source_seed && (
              <div style={{ fontSize: 11, color: "#94a3b8" }}>
                <span style={{ fontWeight: 600 }}>From seed:</span>{" "}
                {idea.source_seed}
              </div>
            )}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 8,
                marginTop: 4,
                flexWrap: "wrap",
              }}
            >
              <div style={{ fontSize: 11, color: "#94a3b8" }}>
                Saved {formatRelative(idea.created_at)}
              </div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {onUseInCopilot && (
                  <button
                    type="button"
                    onClick={() => onUseInCopilot(idea.prompt)}
                    style={SECONDARY_BTN_STYLE}
                  >
                    Use in Copilot
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    window.dispatchEvent(
                      new CustomEvent("linkedinwriter:openQuickCreate", {
                        detail: {
                          type: "post",
                          topic: idea.prompt,
                          ...(idea.rationale
                            ? { key_points: idea.rationale }
                            : {}),
                          ...(quickCreateReturnTo
                            ? { returnTo: quickCreateReturnTo }
                            : {}),
                        },
                      }),
                    );
                    onClose();
                  }}
                  style={{
                    ...ACTION_BTN_STYLE,
                    background: "#ec4899",
                    color: "#ffffff",
                    border: "none",
                  }}
                  title="Open this idea in the Post creator"
                >
                  ✍️ Create Post
                </button>
                <button
                  type="button"
                  onClick={() => void onCopy(idea)}
                  style={PRIMARY_BTN_STYLE}
                >
                  {copiedId === idea.id ? "Copied ✓" : "Copy"}
                </button>
                <button
                  type="button"
                  onClick={() => void onDelete(idea)}
                  disabled={deletingId === idea.id}
                  style={DANGER_BTN_STYLE}
                >
                  {deletingId === idea.id ? "Deleting…" : "Delete"}
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    )}
  </>
);
