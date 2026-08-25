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
            <Typography variant="caption" sx={{ color: "rgba(0,0,0,0.4)", ml: 1 }}>
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
              <Grid item xs={4}>
                <MetricBox
                  label="Total Pages"
                  value={sh.total_urls}
                  tooltip={getMetricTooltip("total_pages")}
                />
              </Grid>
            ) : null}
            {sh?.publishing_velocity !== undefined ? (
              <Grid item xs={4}>
                <MetricBox
                  label="Velocity"
                  value={`${sh.publishing_velocity}/wk`}
                  tooltip={getMetricTooltip("publishing_velocity")}
                />
              </Grid>
            ) : null}
            {sh?.stale_content_percentage !== undefined ? (
              <Grid item xs={4}>
                <MetricBox
                  label="Stale Content"
                  value={`${sh.stale_content_percentage}%`}
                  color={(sh.stale_content_percentage || 0) > 30 ? "#ef4444" : undefined}
                  tooltip={getMetricTooltip("stale_content_6mo")}
                />
              </Grid>
            ) : null}
            {sh?.freshness_score !== undefined ? (
              <Grid item xs={4}>
                <MetricBox
                  label="Freshness"
                  value={sh.freshness_score}
                  tooltip={getMetricTooltip("freshness_score")}
                />
              </Grid>
            ) : null}
            {trend ? (
              <Grid item xs={4}>
                <Box sx={{ p: 1, bgcolor: "rgba(0,0,0,0.02)", borderRadius: 2, textAlign: "center" }}>
                  <Typography variant="caption" sx={{ color: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", gap: 0.25, mb: 0.25, whiteSpace: "nowrap" }}>
                    Publishing Trend
                    <MetricTooltip title={getMetricTooltip("publishing_trend")} />
                  </Typography>
                  <Box sx={{ display: "flex", justifyContent: "center" }}>
                    <TrendChip trend={trend} />
                  </Box>
                </Box>
              </Grid>
            ) : null}
            {Object.keys(recency).length > 0 ? (
              <Grid item xs={4}>
                <MetricBox
                  label="Published 30d"
                  value={recency.last_30d ?? 0}
                  tooltip={getMetricTooltip("publishing_recency")}
                />
              </Grid>
            ) : null}
          </Grid>

          {/* Publishing recency detail */}
          {Object.keys(recency).length > 0 ? (
            <Box sx={{ mb: 2 }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, mb: 1 }}>
                <ScheduleIcon sx={{ fontSize: 16, color: "#3b82f6" }} />
                <Typography variant="caption" sx={{ fontWeight: 600 }}>Publishing Recency</Typography>
                <MetricTooltip title={getMetricTooltip("publishing_recency")} />
              </Box>
              <Grid container spacing={1}>
                {Object.entries(recency).map(([period, count]) => (
                  <Grid item xs={3} key={period}>
                    <Box sx={{ p: 1, bgcolor: "rgba(0,0,0,0.02)", borderRadius: 2, textAlign: "center" }}>
                      <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                        {count as number}
                      </Typography>
                      <Typography variant="caption" sx={{ color: "rgba(0,0,0,0.5)", textTransform: "capitalize" }}>
                        {period.replace("last_", "").replace("d", "d")}
                      </Typography>
                    </Box>
                  </Grid>
                ))}
              </Grid>
            </Box>
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
            <Box sx={{ mb: 2 }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, mb: 1 }}>
                <StructureIcon sx={{ fontSize: 16, color: "#8b5cf6" }} />
                <Typography variant="caption" sx={{ fontWeight: 600 }}>URL Structure</Typography>
                <MetricTooltip title={getMetricTooltip("url_structure")} />
              </Box>
              <Grid container spacing={1}>
                {urlStructure.directory_depth?.average_depth !== undefined ? (
                  <Grid item xs={4}>
                    <MetricBox
                      label="Avg Depth"
                      value={urlStructure.directory_depth.average_depth}
                      tooltip={getMetricTooltip("avg_depth")}
                    />
                  </Grid>
                ) : null}
                {urlStructure.directory_depth?.max_depth !== undefined ? (
                  <Grid item xs={4}>
                    <MetricBox
                      label="Max Depth"
                      value={urlStructure.directory_depth.max_depth}
                      tooltip={getMetricTooltip("max_depth")}
                    />
                  </Grid>
                ) : null}
                {params?.percentage_with_params !== undefined ? (
                  <Grid item xs={4}>
                    <MetricBox
                      label="URLs w/ Params"
                      value={`${params.percentage_with_params}%`}
                      color={(params.percentage_with_params || 0) > 20 ? "#ef4444" : undefined}
                      tooltip={getMetricTooltip("urls_with_params")}
                    />
                  </Grid>
                ) : null}
                {urlStructure.subdomains?.unique_count !== undefined ? (
                  <Grid item xs={4}>
                    <MetricBox
                      label="Subdomains"
                      value={urlStructure.subdomains.unique_count}
                      tooltip={getMetricTooltip("subdomains")}
                    />
                  </Grid>
                ) : null}
              </Grid>
            </Box>
          ) : null}

          {/* Top pillars */}
          {sh?.top_pillars && Object.keys(sh.top_pillars).length > 0 ? (
            <Box>
              <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, mb: 0.75 }}>
                <TrendingUpIcon sx={{ fontSize: 16, color: "#10b981" }} />
                <Typography variant="caption" sx={{ fontWeight: 600 }}>
                  Top Content Pillars
                </Typography>
                <MetricTooltip title={getMetricTooltip("primary_structure")} />
              </Box>
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
            </Box>
          ) : null}
        </Box>
      </Collapse>
    </Paper>
  );
};

export default SiteHealthSummaryCard;
