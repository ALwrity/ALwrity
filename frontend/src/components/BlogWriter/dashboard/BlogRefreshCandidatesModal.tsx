import React from "react";
import type { BlogAnalyticsSummary } from "../../../api/blogAsset";

interface BlogRefreshCandidatesModalProps {
  open: boolean;
  onClose: () => void;
  candidates: BlogAnalyticsSummary["refresh_candidates"];
  loading?: boolean;
  onRefreshPost: (assetId: number) => void;
}

function formatDate(iso: string | null): string {
  if (!iso) return "Unknown date";
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return "Unknown date";
  }
}

/**
 * Remarket wedge detail: published posts that are stale (90+ days old) or
 * scoring below 70 on SEO — sourced from `refresh_candidates` in
 * `GET /api/blog/analytics/summary`. "Refresh this post" reuses the same
 * asset-restore flow already used by the Asset Library.
 */
export const BlogRefreshCandidatesModal: React.FC<BlogRefreshCandidatesModalProps> = ({
  open,
  onClose,
  candidates,
  loading = false,
  onRefreshPost,
}) => {
  if (!open) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0,0,0,0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 10000,
        padding: 20,
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          backgroundColor: "#fff",
          borderRadius: 14,
          padding: 28,
          maxWidth: 560,
          width: "100%",
          maxHeight: "80vh",
          overflowY: "auto",
          boxShadow: "0 20px 50px rgba(0,0,0,0.25)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
          <div>
            <h2 style={{ margin: "0 0 4px", fontSize: 20, color: "#0f172a" }}>
              🔁 Refresh &amp; Repurpose
            </h2>
            <p style={{ margin: 0, fontSize: 13, color: "#64748b" }}>
              Published posts that are stale or scoring low on SEO — prime candidates for a quick refresh.
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            style={{ background: "none", border: "none", fontSize: 22, cursor: "pointer", color: "#94a3b8" }}
          >
            ×
          </button>
        </div>

        {loading && (
          <div style={{ padding: "24px 0", textAlign: "center", color: "#64748b", fontSize: 13 }}>
            Loading refresh candidates…
          </div>
        )}

        {!loading && candidates.length === 0 && (
          <div style={{ padding: "24px 0", textAlign: "center", color: "#64748b", fontSize: 13 }}>
            Nothing to refresh yet — publish a few posts and check back here once they've had time to age or be scored.
          </div>
        )}

        {!loading && candidates.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {candidates.map((c) => (
              <div
                key={c.asset_id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 12,
                  padding: "12px 14px",
                  borderRadius: 10,
                  border: "1px solid #f1f5f9",
                  background: "#f8fafc",
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 14,
                      fontWeight: 700,
                      color: "#0f172a",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {c.title || "Untitled post"}
                  </div>
                  <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>
                    Published {formatDate(c.published_at)}
                    {c.seo_score !== null && (
                      <>
                        {" · "}
                        <span style={{ fontWeight: 700, color: c.seo_score < 50 ? "#dc2626" : "#d97706" }}>
                          SEO {Math.round(c.seo_score)}/100
                        </span>
                      </>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => onRefreshPost(c.asset_id)}
                  style={{
                    flexShrink: 0,
                    padding: "8px 16px",
                    background: "#f59e0b",
                    color: "#fff",
                    border: "none",
                    borderRadius: 8,
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: "pointer",
                    whiteSpace: "nowrap",
                  }}
                >
                  Refresh this post
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
