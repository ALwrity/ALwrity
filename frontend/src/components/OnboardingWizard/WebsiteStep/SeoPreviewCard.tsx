/**
 * SEO Preview Card — rich 3-page audit results with metrics and fix instructions.
 */
import React, { useState, useEffect } from "react";
import {
  Box,
  Typography,
  Button,
  Chip,
  LinearProgress,
  Paper,
  Collapse,
  Tooltip,
} from "@mui/material";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import RefreshIcon from "@mui/icons-material/Refresh";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import { runSeoPreview, getSeoPreview, type SeoPreviewResult } from "./utils/seoPreviewApi";

interface SeoPreviewCardProps {
  websiteUrl: string;
  /** When true (default), fall back to running the preview if no persisted
   *  results exist. When false ("View Results" mode), only show persisted
   *  results and never trigger a fresh run. */
  autoRun?: boolean;
}

const STORAGE_KEY = "seo_preview_result";

const CATEGORY_LABELS: Record<string, string> = {
  meta: "Meta Tags",
  content: "Content",
  technical: "Technical",
  url_structure: "URL Structure",
  accessibility: "Accessibility",
  ux: "User Experience",
};

const CATEGORY_ICONS: Record<string, string> = {
  meta: "🏷️",
  content: "📝",
  technical: "⚙️",
  url_structure: "🔗",
  accessibility: "♿",
  ux: "👤",
};

const CATEGORY_DESCRIPTIONS: Record<string, string> = {
  meta: "Titles, descriptions & social sharing tags.",
  content: "Headings, length & internal links.",
  technical: "Page speed, compression & server setup.",
  url_structure: "How clean & readable your URLs are.",
  accessibility: "Alt text & screen-reader friendliness.",
  ux: "Overall user experience signals.",
};

function scoreBar(score: number): string {
  if (score >= 80) return "#10b981";
  if (score >= 60) return "#f59e0b";
  return "#ef4444";
}

function scoreLabel(s: number): string {
  if (s >= 80) return "Good";
  if (s >= 60) return "Needs work";
  return "Poor";
}

export const SeoPreviewCard: React.FC<SeoPreviewCardProps> = ({ websiteUrl, autoRun = true }) => {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SeoPreviewResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expandedPages, setExpandedPages] = useState<Set<number>>(new Set());
  const [autoLoaded, setAutoLoaded] = useState(false);

  const runPreview = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await runSeoPreview(websiteUrl);
      setResult(data);
      if (data.success) {
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
        } catch {}
      } else {
        setError(data.error || "Preview failed");
      }
    } catch (e: any) {
      setError(e?.message || "Could not run preview");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!autoLoaded && websiteUrl) {
      setAutoLoaded(true);

      // 1. Restore instantly from localStorage (survives refresh).
      try {
        const cached = localStorage.getItem(STORAGE_KEY);
        if (cached) {
          const parsed = JSON.parse(cached) as SeoPreviewResult;
          if (parsed?.success && parsed?.pages?.length) {
            setResult(parsed);
            return;
          }
        }
      } catch {}

      // 2. Otherwise load persisted results from the DB (no re-run, no 429s).
      getSeoPreview(websiteUrl)
        .then((data) => {
          if (data?.success && data?.pages?.length) {
            setResult(data);
            try {
              localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
            } catch {}
          } else if (autoRun) {
            runPreview();
          }
        })
        .catch(() => {
          if (autoRun) runPreview();
        });
    }
  }, [websiteUrl, autoLoaded, autoRun]);

  const togglePage = (i: number) => {
    setExpandedPages((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  };

  // Count issues by severity
  const stats = result?.pages?.length
    ? {
        critical: 0,
        warning: 0,
        pages: result.pages.length,
      }
    : null;
  if (stats && result?.pages) {
    for (const p of result.pages) {
      for (const iss of p.top_issues || []) {
        const sev = (iss as any)?.severity || iss.category || "";
        if (String(sev).includes("critical")) stats.critical++;
        else stats.warning++;
      }
    }
  }

  return (
    <Paper sx={{ p: 2.5, mt: 2, border: "1px solid #e0e0e0", borderRadius: 2, bgcolor: "#fff", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
      {/* Header */}
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: result ? 2 : 0 }}>
        <Box>
          <Typography variant="subtitle1" sx={{ fontWeight: 700, color: "#1e293b" }}>
            🔍 SEO Audit Preview
          </Typography>
          <Typography variant="body2" sx={{ color: "#64748b", mt: 0.3 }}>
            Sample of what the full 500-page audit finds. Run to see real issues from your site.
          </Typography>
        </Box>
        <Button
          variant="outlined"
          size="small"
          onClick={runPreview}
          disabled={loading}
          startIcon={loading ? undefined : <RefreshIcon />}
          sx={{ textTransform: "none", flexShrink: 0, ml: 2 }}
        >
          {loading ? "Running..." : result ? "Re-run" : "Run Preview"}
        </Button>
      </Box>

      {loading && <LinearProgress sx={{ mt: 2, borderRadius: 1 }} />}
      {error && <Typography sx={{ color: "#ef4444", mt: 1, fontSize: 13 }}>{error}</Typography>}

      {result?.success && stats && (
        <>
          {/* Summary Bar */}
          <Box sx={{ display: "flex", gap: 2, mt: 2, flexWrap: "wrap", alignItems: "center" }}>
            <Chip
              size="small"
              icon={<CheckCircleIcon sx={{ color: scoreBar(result.average_score ?? 0) }} />}
              label={`Overall: ${result.average_score}% — ${scoreLabel(result.average_score ?? 0)}`}
              sx={{ fontWeight: 700, fontSize: 13, py: 2 }}
            />
            <Chip size="small" label={`${stats.pages} pages analyzed`} variant="outlined" />
            <Chip
              size="small"
              icon={<ErrorOutlineIcon fontSize="small" sx={{ color: "#ef4444" }} />}
              label={`${stats.critical} critical`}
              color="error"
              variant="outlined"
            />
            <Chip
              size="small"
              icon={<WarningAmberIcon fontSize="small" sx={{ color: "#f59e0b" }} />}
              label={`${stats.warning} warnings`}
              color="warning"
              variant="outlined"
            />
          </Box>

          {/* Per-category scores */}
          <Box sx={{ mt: 2, display: "flex", gap: 0.5, flexWrap: "wrap" }}>
            {(["meta", "content", "technical", "accessibility", "ux", "url_structure"] as const).map((cat) => {
              const avg = result.pages?.length
                ? Math.round(
                    result.pages.reduce((sum, p) => sum + ((p as any)[cat]?.score ?? 0) * 100, 0) /
                      result.pages!.length
                  )
                : 0;
              return (
                <Box key={cat} sx={{ flex: "1 1 100px", minWidth: 100, maxWidth: 160 }}>
                  <Typography variant="caption" sx={{ color: "#64748b", display: "block", textAlign: "center" }}>
                    {CATEGORY_ICONS[cat]} {CATEGORY_LABELS[cat]}
                  </Typography>
                  <Box sx={{ bgcolor: "#f1f5f9", borderRadius: 1, height: 6, mt: 0.5, overflow: "hidden" }}>
                    <Box
                      sx={{
                        width: `${avg}%`,
                        height: "100%",
                        bgcolor: scoreBar(avg),
                        borderRadius: 1,
                        transition: "width 0.5s",
                      }}
                    />
                  </Box>
                  <Tooltip title={CATEGORY_DESCRIPTIONS[cat] || CATEGORY_LABELS[cat]} arrow>
                    <Typography
                      variant="caption"
                      sx={{
                        color: "#475569",
                        display: "block",
                        textAlign: "center",
                        mt: 0.4,
                        lineHeight: 1.3,
                        fontSize: 9,
                        cursor: "help",
                      }}
                    >
                      {CATEGORY_DESCRIPTIONS[cat]}
                    </Typography>
                  </Tooltip>
                  <Typography variant="caption" sx={{ color: scoreBar(avg), textAlign: "center", display: "block", mt: 0.2 }}>
                    {avg}%
                  </Typography>
                </Box>
              );
            })}
          </Box>

          {/* Per-page details */}
          <Typography variant="caption" sx={{ color: "#94a3b8", display: "block", mt: 2 }}>
            Click a page to see specific issues and fixes
          </Typography>
          {result.pages?.map((page, i) => {
            const isOpen = expandedPages.has(i);
            const topIssues = page.top_issues || [];
            const criticalCount = topIssues.filter((iss) => {
              const sev = (iss as any)?.severity || iss.category || "";
              return String(sev).includes("critical");
            }).length;

            return (
              <Paper
                key={page.url}
                elevation={0}
                sx={{ mt: 1, border: "1px solid #e2e8f0", borderRadius: 2, overflow: "hidden" }}
              >
                {/* Page row */}
                <Box
                  onClick={() => togglePage(i)}
                  sx={{
                    px: 2,
                    py: 1.5,
                    display: "flex",
                    alignItems: "center",
                    gap: 2,
                    cursor: "pointer",
                    "&:hover": { bgcolor: "#f8fafc" },
                  }}
                >
                  <Chip
                    size="small"
                    label={`${page.overall_score}%`}
                    sx={{ fontWeight: 700, color: "#fff", bgcolor: scoreBar(page.overall_score), minWidth: 55 }}
                  />
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography variant="body2" sx={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      Page {i + 1}: {page.url.replace(/^https?:\/\//, "")}
                    </Typography>
                    <Typography variant="caption" sx={{ color: "#64748b" }}>
                      {criticalCount > 0 ? `${criticalCount} critical · ` : ""}
                      {topIssues.length} issues found
                    </Typography>
                  </Box>
                  {isOpen ? <ExpandLessIcon sx={{ color: "#94a3b8" }} /> : <ExpandMoreIcon sx={{ color: "#94a3b8" }} />}
                </Box>

                {/* Expanded details */}
                <Collapse in={isOpen}>
                  <Box sx={{ px: 2, pb: 2, bgcolor: "#fafafa", borderTop: "1px solid #f1f5f9" }}>
                    {/* Issues list */}
                    {topIssues.map((issue, j) => {
                      const rawIssue: any = (issue as any);
                      const severity = (rawIssue.severity || rawIssue.category || "issue")?.toString() || "issue";
                      const isCritical = severity.includes("critical") || severity === "error";
                      const issueText = typeof rawIssue.issue === 'string' && rawIssue.issue
                        ? rawIssue.issue
                        : (rawIssue.message || "");
                      const fixText = typeof rawIssue.fix === 'string' ? rawIssue.fix : "";
                      const label = CATEGORY_LABELS[rawIssue.category] || rawIssue.category || "SEO";
                      return (
                      <Box key={j} sx={{ mt: 1.5, pl: 1, borderLeft: `3px solid ${isCritical ? "#ef4444" : "#f59e0b"}` }}>
                        <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
                          <Chip
                            size="small"
                            label={isCritical ? "Critical" : "Needs work"}
                            sx={{
                              height: 20,
                              fontSize: 10,
                              fontWeight: 700,
                              color: "#fff",
                              bgcolor: isCritical ? "#ef4444" : "#f59e0b",
                            }}
                          />
                          <Typography variant="caption" sx={{ fontWeight: 700, color: "#334155" }}>
                            {label}
                          </Typography>
                        </Box>
                        <Typography variant="body2" sx={{ color: "#334155", mt: 0.5 }}>
                          {issueText || "Issue detected"}
                        </Typography>
                        {fixText && (
                          <Typography variant="caption" sx={{ color: "#64748b", mt: 0.5, display: "block" }}>
                            Fix: {fixText}
                          </Typography>
                        )}
                      </Box>
                    )})}
                    {topIssues.length === 0 && (
                      <Typography variant="caption" sx={{ color: "#10b981", mt: 1, display: "block" }}>
                        No issues found — this page looks good!
                      </Typography>
                    )}

                    {/* Category bars */}
                    <Box sx={{ display: "flex", gap: 1, mt: 2, flexWrap: "wrap" }}>
                      {(["meta", "content", "technical", "accessibility", "ux", "url_structure"] as const).map((cat) => {
                        const s = ((page as any)[cat]?.score ?? 0) * 100;
                        return (
                          <Tooltip key={cat} title={`${CATEGORY_LABELS[cat]} (${Math.round(s)}%): ${CATEGORY_DESCRIPTIONS[cat] || ""}`} arrow>
                            <Box sx={{ flex: "1 1 80px", minWidth: 60 }}>
                              <Typography variant="caption" sx={{ fontSize: 10, color: "#64748b" }}>
                                {CATEGORY_LABELS[cat]}
                              </Typography>
                              <Box sx={{ bgcolor: "#e2e8f0", borderRadius: 1, height: 4, mt: 0.3 }}>
                                <Box sx={{ width: `${s}%`, height: "100%", bgcolor: scoreBar(s), borderRadius: 1 }} />
                              </Box>
                            </Box>
                          </Tooltip>
                        );
                      })}
                    </Box>
                  </Box>
                </Collapse>
              </Paper>
            );
          })}

          <Typography variant="caption" sx={{ display: "block", color: "#94a3b8", mt: 1.5 }}>
            Full audit runs after onboarding — analyzes up to 500 pages across all 6 SEO categories.
          </Typography>
        </>
      )}
    </Paper>
  );
};
