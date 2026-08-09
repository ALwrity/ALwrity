import React, { useState } from "react";
import {
  Box,
  Typography,
  Chip,
  Grid,
  Collapse,
  Paper,
  IconButton,
} from "@mui/material";
import {
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Topic as TopicIcon,
  Link as LinkIcon,
  AccountTree as BudgetIcon,
  CheckCircle as CheckIcon,
} from "@mui/icons-material";
import MetricTooltip from "../../shared/MetricTooltip";
import { getMetricTooltip } from "../../shared/metricTooltips";

interface ContentAuditData {
  augmented_themes?: Array<{ word: string; abs_freq: number }>;
  link_health?: {
    total_links_found?: number;
    internal_link_count?: number;
    external_link_count?: number;
    nofollow_link_count?: number;
    avg_links_per_page?: number;
    internal_link_percentage?: number;
  };
  crawl_budget?: {
    success?: boolean;
    sitemap_total_urls?: number;
    pages_crawled?: number;
    waste_percentage?: number;
    optimization_score?: number;
  };
  page_status?: Record<string, number>;
  freshness?: {
    publishing_recency?: Record<string, number>;
    freshness_score?: number;
    stale_content_percentage?: number;
  };
  last_advertools_audit?: string;
}

interface ContentAuditSummaryCardProps {
  brandAnalysis?: any;
}

function hasAuditData(data: any): boolean {
  if (!data) return false;
  return !!(
    data.augmented_themes?.length ||
    data.link_health?.total_links_found ||
    data.crawl_budget?.pages_crawled ||
    data.page_status ||
    data.freshness
  );
}

function formatTimeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

const ScoreBar: React.FC<{ value: number; label: string }> = ({ value, label }) => {
  const pct = Math.min(value, 100);
  const color = pct >= 80 ? "#10b981" : pct >= 50 ? "#f59e0b" : "#ef4444";
  return (
    <Box sx={{ mb: 0.75 }}>
      <Box sx={{ display: "flex", justifyContent: "space-between", mb: 0.25 }}>
        <Typography variant="caption" sx={{ color: "rgba(0,0,0,0.55)" }}>
          {label}
        </Typography>
        <Typography variant="caption" sx={{ fontWeight: 600 }}>
          {value}
        </Typography>
      </Box>
      <Box
        sx={{
          height: 4,
          borderRadius: 2,
          bgcolor: "rgba(0,0,0,0.06)",
          overflow: "hidden",
        }}
      >
        <Box
          sx={{
            width: `${pct}%`,
            height: "100%",
            borderRadius: 2,
            bgcolor: color,
            transition: "width 0.3s ease",
          }}
        />
      </Box>
    </Box>
  );
};

const MetricBox: React.FC<{
  label: string;
  value: string | number;
  color?: string;
  tooltip?: string;
}> = ({ label, value, color, tooltip }) => (
  <Box sx={{ p: 1, bgcolor: "rgba(0,0,0,0.02)", borderRadius: 2, textAlign: "center", minWidth: 0 }}>
    <Typography variant="caption" sx={{ color: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", gap: 0.25, mb: 0.25, whiteSpace: "nowrap" }}>
      {label}
      {tooltip ? <MetricTooltip title={tooltip} /> : null}
    </Typography>
    <Typography variant="subtitle2" sx={{ color: color || "text.primary", fontWeight: 600 }}>
      {value}
    </Typography>
  </Box>
);

export const ContentAuditSummaryCard: React.FC<ContentAuditSummaryCardProps> = ({
  brandAnalysis,
}) => {
  const [expanded, setExpanded] = useState(false);
  const data = (brandAnalysis || {}) as ContentAuditData;

  if (!hasAuditData(data)) return null;

  const themeCount = data.augmented_themes?.length || 0;
  const linkData = data.link_health;
  const budgetData = data.crawl_budget;
  const pages = data.page_status;
  const fresh = data.freshness;
  const lastAudit = data.last_advertools_audit;

  return (
    <Paper
      elevation={0}
      sx={{
        mt: 1.5,
        borderRadius: 2,
        border: "1px solid #e0e0e0",
        bgcolor: "#fff",
        overflow: "hidden",
        boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
      }}
    >
      {/* Header */}
      <Box
        sx={{
          px: 2,
          py: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          cursor: "pointer",
          borderBottom: expanded ? "1px solid #f0f0f0" : "none",
        }}
        onClick={() => setExpanded(!expanded)}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <TopicIcon sx={{ color: "#6366f1", fontSize: 18 }} />
          <Typography variant="subtitle2" sx={{ fontWeight: 600, color: "#334155" }}>
            Content Audit Results
          </Typography>
          <Chip
            label={`${themeCount} themes`}
            size="small"
            sx={{
              height: 18,
              fontSize: "0.65rem",
              bgcolor: "rgba(99,102,241,0.08)",
              color: "#6366f1",
              fontWeight: 500,
            }}
          />
          {lastAudit && (
            <Typography variant="caption" sx={{ color: "#94a3b8", ml: 1 }}>
              {formatTimeAgo(lastAudit)}
            </Typography>
          )}
        </Box>
        <IconButton size="small" sx={{ p: 0 }}>
          {expanded ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
        </IconButton>
      </Box>

      <Collapse in={expanded}>
        <Box sx={{ px: 2, pb: 1.5, pt: 1 }}>
          {/* Quick metrics row */}
          <Grid container spacing={1} sx={{ mb: 1.5 }}>
            {linkData?.total_links_found ? (
              <Grid item xs={4}>
                <MetricBox
                  label={`Links (${linkData.internal_link_percentage || 0}% int)`}
                  value={linkData.total_links_found}
                  tooltip={getMetricTooltip("total_links")}
                />
              </Grid>
            ) : null}
            {budgetData?.pages_crawled ? (
              <Grid item xs={4}>
                <MetricBox
                  label="Pages Crawled"
                  value={budgetData.pages_crawled}
                  tooltip={getMetricTooltip("pages_crawled")}
                />
              </Grid>
            ) : null}
            {budgetData?.waste_percentage !== undefined ? (
              <Grid item xs={4}>
                <MetricBox
                  label="Crawl Waste"
                  value={`${budgetData.waste_percentage || 0}%`}
                  color={(budgetData.waste_percentage || 0) > 20 ? "#ef4444" : undefined}
                  tooltip={getMetricTooltip("crawl_waste")}
                />
              </Grid>
            ) : null}
            {fresh?.freshness_score !== undefined ? (
              <Grid item xs={4}>
                <MetricBox
                  label="Freshness"
                  value={fresh.freshness_score}
                  tooltip={getMetricTooltip("freshness_score")}
                />
              </Grid>
            ) : null}
            {fresh?.stale_content_percentage !== undefined ? (
              <Grid item xs={4}>
                <MetricBox
                  label="Stale Content"
                  value={`${fresh.stale_content_percentage}%`}
                  color={(fresh.stale_content_percentage || 0) > 30 ? "#ef4444" : undefined}
                  tooltip={getMetricTooltip("stale_content")}
                />
              </Grid>
            ) : null}
          </Grid>

          {/* Link health detail */}
          {linkData?.total_links_found ? (
            <Box sx={{ mb: 2 }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, mb: 1 }}>
                <LinkIcon sx={{ fontSize: 16, color: "#0ea5e9" }} />
                <Typography variant="caption" sx={{ fontWeight: 600 }}>Link Health</Typography>
                <MetricTooltip title={getMetricTooltip("link_health")} />
              </Box>
              <Grid container spacing={1}>
                <Grid item xs={6}>
                  <Typography variant="caption" sx={{ color: "rgba(0,0,0,0.5)" }}>
                    Internal: {linkData.internal_link_count} · External: {linkData.external_link_count}
                  </Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="caption" sx={{ color: "rgba(0,0,0,0.5)" }}>
                    Nofollow: {linkData.nofollow_link_count} · Avg/page: {linkData.avg_links_per_page}
                  </Typography>
                </Grid>
              </Grid>
            </Box>
          ) : null}

          {/* Page status */}
          {pages && Object.keys(pages).length > 0 ? (
            <Box sx={{ mb: 2 }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, mb: 0.75 }}>
                <CheckIcon sx={{ fontSize: 16, color: "#10b981" }} />
                <Typography variant="caption" sx={{ fontWeight: 600 }}>Page Status</Typography>
                <MetricTooltip title={getMetricTooltip("page_status")} />
              </Box>
              <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap" }}>
                {Object.entries(pages).map(([code, count]) => (
                  <Chip
                    key={code}
                    label={`${code}: ${count}`}
                    size="small"
                    sx={{
                      height: 20,
                      fontSize: "0.65rem",
                      bgcolor: code.startsWith("2")
                        ? "rgba(16,185,129,0.1)"
                        : code.startsWith("4") || code.startsWith("5")
                          ? "rgba(239,68,68,0.1)"
                          : "rgba(59,130,246,0.1)",
                      color: code.startsWith("2")
                        ? "#059669"
                        : code.startsWith("4") || code.startsWith("5")
                          ? "#dc2626"
                          : "#2563eb",
                    }}
                  />
                ))}
              </Box>
            </Box>
          ) : null}

          {/* Crawl budget score */}
          {budgetData?.success ? (
            <Box sx={{ mb: 1.5 }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, mb: 0.75 }}>
                <BudgetIcon sx={{ fontSize: 16, color: "#f59e0b" }} />
                <Typography variant="caption" sx={{ fontWeight: 600 }}>Crawl Budget</Typography>
                <MetricTooltip title={getMetricTooltip("crawl_budget")} />
              </Box>
              <ScoreBar value={budgetData.optimization_score || 0} label="Optimization Score" />
              <Typography variant="caption" sx={{ color: "rgba(0,0,0,0.4)" }}>
                {budgetData.pages_crawled} of {budgetData.sitemap_total_urls} sitemap URLs crawled
              </Typography>
            </Box>
          ) : null}

          {/* Top themes */}
          {data.augmented_themes && data.augmented_themes.length > 0 ? (
            <Box>
              <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, mb: 0.75 }}>
                <TopicIcon sx={{ fontSize: 16, color: "#8b5cf6" }} />
                <Typography variant="caption" sx={{ fontWeight: 600 }}>
                  Top Content Themes
                </Typography>
                <MetricTooltip title={getMetricTooltip("top_themes")} />
              </Box>
              <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap" }}>
                {data.augmented_themes.slice(0, 12).map((t, i) => (
                  <Chip
                    key={i}
                    label={t.word}
                    size="small"
                    sx={{
                      height: 20,
                      fontSize: "0.65rem",
                      bgcolor: "rgba(139,92,246,0.08)",
                      color: "#7c3aed",
                    }}
                  />
                ))}
              </Box>
            </Box>
          ) : null}

          {/* View full report hint */}
          <Box sx={{ mt: 2, pt: 1.5, borderTop: "1px solid rgba(0,0,0,0.06)" }}>
            <Typography variant="caption" sx={{ color: "rgba(0,0,0,0.4)" }}>
              Full report with redirect audit, image SEO, robots.txt, and crawl details available on the SEO Dashboard after onboarding.
            </Typography>
          </Box>
        </Box>
      </Collapse>
    </Paper>
  );
};

export default ContentAuditSummaryCard;
