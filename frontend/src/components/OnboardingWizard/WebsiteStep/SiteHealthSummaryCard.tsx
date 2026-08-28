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
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import HealthIcon from '@mui/icons-material/HealthAndSafety';
import ScheduleIcon from '@mui/icons-material/Schedule';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import WarningIcon from '@mui/icons-material/Warning';
import StructureIcon from '@mui/icons-material/AccountTree';
import MetricTooltip from "../../shared/MetricTooltip";
import { getMetricTooltip } from "../../shared/metricTooltips";

interface SiteHealthData {
  total_urls?: number;
  publishing_velocity?: number;
  stale_content_count?: number;
  stale_content_percentage?: number;
  freshness_score?: number;
  publishing_recency?: Record<string, number>;
  publishing_trend?: string;
  top_pillars?: Record<string, number>;
  url_structure?: {
    total_urls_analyzed?: number;
    parameter_usage?: {
      urls_with_params?: number;
      percentage_with_params?: number;
    };
    directory_depth?: {
      average_depth?: number;
      max_depth?: number;
      distribution?: Record<string, number>;
    };
    subdomains?: {
      unique_count?: number;
    };
  };
}

interface SEOAudit {
  site_health?: SiteHealthData;
  last_advertools_health_check?: string;
}

interface SiteHealthSummaryCardProps {
  seoAudit?: SEOAudit;
}

function hasHealthData(data: SEOAudit | undefined): boolean {
  const sh = data?.site_health;
  return !!(
    sh?.total_urls ||
    sh?.freshness_score !== undefined ||
    sh?.publishing_velocity !== undefined ||
    sh?.stale_content_percentage !== undefined ||
    (sh?.top_pillars && Object.keys(sh.top_pillars).length > 0)
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

// Plain-language status for a 0-100 score.
function statusFor(score: number, invert = false): { label: string; color: string } {
  const s = invert ? 100 - score : score;
  if (s >= 80) return { label: "Good", color: "#10b981" };
  if (s >= 50) return { label: "Needs work", color: "#f59e0b" };
  return { label: "Needs attention", color: "#ef4444" };
}

const ScoreBar: React.FC<{ value: number; label: string }> = ({ value, label }) => {
  const pct = Math.min(value, 100);
  const color = pct >= 80 ? "#10b981" : pct >= 50 ? "#f59e0b" : "#ef4444";
  return (
    <Box sx={{ mb: 0.75 }}>
      <Box sx={{ display: "flex", justifyContent: "space-between", mb: 0.25 }}>
        <Typography variant="caption" sx={{ color: "#64748b" }}>
          {label}
        </Typography>
        <Typography variant="caption" sx={{ fontWeight: 600, color: "#1e293b" }}>
          {value}
        </Typography>
      </Box>
      <Box sx={{ height: 4, borderRadius: 2, bgcolor: "#e2e8f0", overflow: "hidden" }}>
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

// A single metric with a value, a plain-language message, and an info tooltip.
const MetricBox: React.FC<{
  label: string;
  value: string | number;
  message: string;
  status?: { label: string; color: string };
  tooltipKey?: string;
}> = ({ label, value, message, status, tooltipKey }) => (
  <Box sx={{ p: 1, bgcolor: "#f8fafc", borderRadius: 2, minWidth: 0, height: "100%" }}>
    <Typography variant="caption" sx={{ color: "#64748b", display: "flex", alignItems: "center", justifyContent: "center", gap: 0.25, mb: 0.25, whiteSpace: "nowrap" }}>
      {label}
      {tooltipKey ? <MetricTooltip title={getMetricTooltip(tooltipKey)} /> : null}
    </Typography>
    <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 0.5, flexWrap: "wrap" }}>
      <Typography variant="subtitle2" sx={{ color: "#0f172a", fontWeight: 700 }}>
        {value}
      </Typography>
      {status && (
        <Chip
          label={status.label}
          size="small"
          sx={{ height: 18, fontSize: "0.6rem", fontWeight: 600, bgcolor: status.color + "1a", color: status.color }}
        />
      )}
    </Box>
    <Typography variant="caption" sx={{ color: "#475569", display: "block", mt: 0.5, lineHeight: 1.35 }}>
      {message}
    </Typography>
  </Box>
);

// A titled card section with a header (icon + label + tooltip) and body.
const SectionCard: React.FC<{
  icon: React.ReactNode;
  title: string;
  tooltipKey: string;
  children: React.ReactNode;
}> = ({ icon, title, tooltipKey, children }) => (
  <Box sx={{ mb: 1.5, p: 1.25, bgcolor: "#f8fafc", borderRadius: 2, border: "1px solid #eef2f7" }}>
    <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, mb: 1 }}>
      {icon}
      <Typography variant="caption" sx={{ fontWeight: 700, color: "#1e293b" }}>{title}</Typography>
      <MetricTooltip title={getMetricTooltip(tooltipKey)} />
    </Box>
    {children}
  </Box>
);

const TrendChip: React.FC<{ trend?: string }> = ({ trend }) => {
  const label = trend || "unknown";
  const color =
    label === "increasing" ? "#059669" : label === "decreasing" ? "#dc2626" : "#2563eb";
  const bg =
    label === "increasing"
      ? "rgba(16,185,129,0.1)"
      : label === "decreasing"
        ? "rgba(239,68,68,0.1)"
        : "rgba(59,130,246,0.1)";
  return (
    <Chip
      label={label}
      size="small"
      sx={{ height: 20, fontSize: "0.65rem", bgcolor: bg, color, textTransform: "capitalize" }}
    />
  );
};

const RECENCY_LABELS: Record<string, string> = {
  last_24h: "Last 24h",
  last_7d: "Last 7 days",
  last_30d: "Last 30 days",
  last_90d: "Last 90 days",
};

export const SiteHealthSummaryCard: React.FC<SiteHealthSummaryCardProps> = ({ seoAudit }) => {
  const [expanded, setExpanded] = useState(true);
  const data = (seoAudit || {}) as SEOAudit;
  const sh = data.site_health;

  if (!hasHealthData(data)) return null;

  const lastCheck = data.last_advertools_health_check;
  const trend = sh?.publishing_trend;
  const recency = sh?.publishing_recency || {};
  const urlStructure = sh?.url_structure;
  const params = urlStructure?.parameter_usage;

  const freshScore = sh?.freshness_score ?? 0;
  const stalePct = sh?.stale_content_percentage ?? 0;
  const paramPct = params?.percentage_with_params ?? 0;

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
          <HealthIcon sx={{ color: "#10b981", fontSize: 18 }} />
          <Typography variant="subtitle2" sx={{ fontWeight: 600, color: "#334155" }}>
            Site Health Results
          </Typography>
          {sh?.freshness_score !== undefined && (
            <Chip
              label={`${sh.freshness_score} freshness`}
              size="small"
              sx={{
                height: 18,
                fontSize: "0.65rem",
                bgcolor:
                  sh.freshness_score >= 80
                    ? "rgba(16,185,129,0.1)"
                    : sh.freshness_score >= 50
                      ? "rgba(245,158,11,0.1)"
                      : "rgba(239,68,68,0.1)",
                color:
                  sh.freshness_score >= 80
                    ? "#059669"
                    : sh.freshness_score >= 50
                      ? "#b45309"
                      : "#dc2626",
                fontWeight: 500,
              }}
            />
          )}
          {lastCheck && (
            <Typography variant="caption" sx={{ color: "#94a3b8", ml: 1 }}>
              {formatTimeAgo(lastCheck)}
            </Typography>
          )}
        </Box>
        <IconButton size="small" sx={{ p: 0 }}>
          {expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
        </IconButton>
      </Box>

      <Collapse in={expanded}>
        <Box sx={{ px: 2, pb: 1.5, pt: 1 }}>
          {/* Quick metrics row */}
          <Grid container spacing={1} sx={{ mb: 1.5 }}>
            {sh?.total_urls ? (
              <Grid item xs={6} sm={4}>
                <MetricBox
                  label="Total Pages"
                  value={sh.total_urls}
                  message="All pages listed in your sitemap."
                  tooltipKey="total_pages"
                />
              </Grid>
            ) : null}
            {sh?.publishing_velocity !== undefined ? (
              <Grid item xs={6} sm={4}>
                <MetricBox
                  label="Publishing Velocity"
                  value={`${sh.publishing_velocity}/wk`}
                  message="How often you publish. Consistency matters most."
                  tooltipKey="publishing_velocity"
                />
              </Grid>
            ) : null}
            {sh?.stale_content_percentage !== undefined ? (
              <Grid item xs={6} sm={4}>
                <MetricBox
                  label="Stale Content"
                  value={`${stalePct}%`}
                  message="Pages not updated in 6+ months. Lower is better."
                  status={statusFor(stalePct, true)}
                  tooltipKey="stale_content"
                />
              </Grid>
            ) : null}
            {sh?.freshness_score !== undefined ? (
              <Grid item xs={6} sm={4}>
                <MetricBox
                  label="Freshness"
                  value={freshScore}
                  message="How recently your content was updated. Higher is better."
                  status={statusFor(freshScore)}
                  tooltipKey="freshness_score"
                />
              </Grid>
            ) : null}
            {trend ? (
              <Grid item xs={6} sm={4}>
                <Box sx={{ p: 1, bgcolor: "#f8fafc", borderRadius: 2, textAlign: "center", height: "100%" }}>
                  <Typography variant="caption" sx={{ color: "#64748b", display: "flex", alignItems: "center", justifyContent: "center", gap: 0.25, mb: 0.25, whiteSpace: "nowrap" }}>
                    Publishing Trend
                    <MetricTooltip title={getMetricTooltip("publishing_trend")} />
                  </Typography>
                  <Box sx={{ display: "flex", justifyContent: "center" }}>
                    <TrendChip trend={trend} />
                  </Box>
                  <Typography variant="caption" sx={{ color: "#475569", display: "block", mt: 0.5, lineHeight: 1.35 }}>
                    Whether your publishing is rising, falling, or steady.
                  </Typography>
                </Box>
              </Grid>
            ) : null}
          </Grid>

          {/* Publishing recency detail */}
          {Object.keys(recency).length > 0 ? (
            <SectionCard
              icon={<ScheduleIcon sx={{ fontSize: 16, color: "#3b82f6" }} />}
              title="Publishing Recency"
              tooltipKey="publishing_recency"
            >
              <Grid container spacing={1}>
                {Object.entries(recency).map(([period, count]) => (
                  <Grid item xs={3} key={period}>
                    <Box sx={{ p: 0.75, bgcolor: "#fff", borderRadius: 1.5, border: "1px solid #eef2f7", textAlign: "center" }}>
                      <Typography variant="body2" sx={{ fontWeight: 700, color: "#0f172a" }}>
                        {count as number}
                      </Typography>
                      <Typography variant="caption" sx={{ color: "#64748b", fontSize: 9 }}>
                        {RECENCY_LABELS[period] || period.replace("last_", "")}
                      </Typography>
                    </Box>
                  </Grid>
                ))}
              </Grid>
              <Typography variant="caption" sx={{ color: "#475569", display: "block", mt: 0.75, lineHeight: 1.4 }}>
                How many pages you published or updated in recent time windows — a sign of an actively maintained site.
              </Typography>
            </SectionCard>
          ) : null}

          {/* Stale content warning */}
          {(sh?.stale_content_percentage || 0) > 30 && (
            <Box
              sx={{
                mb: 2,
                p: 1.5,
                borderRadius: 2,
                border: "1px solid rgba(239,68,68,0.2)",
                bgcolor: "rgba(239,68,68,0.04)",
                display: "flex",
                alignItems: "center",
                gap: 1,
              }}
            >
              <WarningIcon sx={{ fontSize: 16, color: "#dc2626" }} />
              <Typography variant="caption" sx={{ color: "#b91c1c" }}>
                {sh?.stale_content_count || 0} pages haven't been updated in 6+ months.
                Refreshing older content is a low-effort way to boost freshness.
              </Typography>
            </Box>
          )}

          {/* URL structure */}
          {urlStructure ? (
            <SectionCard
              icon={<StructureIcon sx={{ fontSize: 16, color: "#8b5cf6" }} />}
              title="URL Structure"
              tooltipKey="url_structure"
            >
              <Grid container spacing={1}>
                {urlStructure.directory_depth?.average_depth !== undefined ? (
                  <Grid item xs={6}>
                    <MetricBox
                      label="Avg Depth"
                      value={urlStructure.directory_depth.average_depth}
                      message="Clicks from homepage to a page. Shallower is easier to find."
                      tooltipKey="avg_depth"
                    />
                  </Grid>
                ) : null}
                {urlStructure.directory_depth?.max_depth !== undefined ? (
                  <Grid item xs={6}>
                    <MetricBox
                      label="Max Depth"
                      value={urlStructure.directory_depth.max_depth}
                      message="Deepest page on your site. Buried pages are harder to rank."
                      tooltipKey="max_depth"
                    />
                  </Grid>
                ) : null}
                {params?.percentage_with_params !== undefined ? (
                  <Grid item xs={6}>
                    <MetricBox
                      label="URLs w/ Params"
                      value={`${paramPct}%`}
                      message="URLs with ?query params — too many can create duplicates."
                      status={statusFor(paramPct, true)}
                      tooltipKey="urls_with_params"
                    />
                  </Grid>
                ) : null}
                {urlStructure.subdomains?.unique_count !== undefined ? (
                  <Grid item xs={6}>
                    <MetricBox
                      label="Subdomains"
                      value={urlStructure.subdomains.unique_count}
                      message="Separate subdomains (like blog.example.com)."
                      tooltipKey="subdomains"
                    />
                  </Grid>
                ) : null}
              </Grid>
            </SectionCard>
          ) : null}

          {/* Top pillars */}
          {sh?.top_pillars && Object.keys(sh.top_pillars).length > 0 ? (
            <SectionCard
              icon={<TrendingUpIcon sx={{ fontSize: 16, color: "#10b981" }} />}
              title="Top Content Pillars"
              tooltipKey="primary_structure"
            >
              <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap" }}>
                {Object.entries(sh.top_pillars)
                  .slice(0, 12)
                  .map(([pillar, count], i) => (
                    <Chip
                      key={i}
                      label={`${pillar} (${count})`}
                      size="small"
                      sx={{
                        height: 20,
                        fontSize: "0.65rem",
                        bgcolor: "rgba(16,185,129,0.08)",
                        color: "#047857",
                      }}
                    />
                  ))}
              </Box>
              <Typography variant="caption" sx={{ color: "#475569", display: "block", mt: 0.75, lineHeight: 1.4 }}>
                The main sections of your site, based on your URL structure — how your content is organized.
              </Typography>
            </SectionCard>
          ) : null}
        </Box>
      </Collapse>
    </Paper>
  );
};

export default SiteHealthSummaryCard;
