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
import TopicIcon from '@mui/icons-material/Topic';
import LinkIcon from '@mui/icons-material/Link';
import BudgetIcon from '@mui/icons-material/AccountTree';
import CheckIcon from '@mui/icons-material/CheckCircle';
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
      <Box
        sx={{
          height: 4,
          borderRadius: 2,
          bgcolor: "#e2e8f0",
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

// A small labelled stat within a SectionCard, with a plain-language hint.
const MiniStat: React.FC<{
  label: string;
  value: string | number | undefined;
  hint?: string;
  status?: { label: string; color: string };
}> = ({ label, value, hint, status }) => (
  <Box sx={{ p: 0.75, bgcolor: "#fff", borderRadius: 1.5, border: "1px solid #eef2f7", minWidth: 0 }}>
    <Typography variant="caption" sx={{ color: "#64748b", display: "block" }}>{label}</Typography>
    <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, flexWrap: "wrap" }}>
      <Typography variant="body2" sx={{ color: "#0f172a", fontWeight: 700 }}>{value}</Typography>
      {status && (
        <Chip
          label={status.label}
          size="small"
          sx={{ height: 16, fontSize: "0.58rem", fontWeight: 600, bgcolor: status.color + "1a", color: status.color }}
        />
      )}
    </Box>
    {hint && (
      <Typography variant="caption" sx={{ color: "#475569", display: "block", mt: 0.25, lineHeight: 1.3 }}>
        {hint}
      </Typography>
    )}
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

  const freshScore = fresh?.freshness_score ?? 0;
  const stalePct = fresh?.stale_content_percentage ?? 0;
  const wastePct = budgetData?.waste_percentage ?? 0;
  const optScore = budgetData?.optimization_score ?? 0;

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
              <Grid item xs={6} sm={4}>
                <MetricBox
                  label="Links"
                  value={linkData.total_links_found}
                  message={`${linkData.internal_link_percentage || 0}% point to pages on your own site.`}
                  tooltipKey="total_links"
                />
              </Grid>
            ) : null}
            {budgetData?.pages_crawled ? (
              <Grid item xs={6} sm={4}>
                <MetricBox
                  label="Pages Crawled"
                  value={budgetData.pages_crawled}
                  message="How many pages we found and analyzed on your site."
                  tooltipKey="pages_crawled"
                />
              </Grid>
            ) : null}
            {budgetData?.waste_percentage !== undefined ? (
              <Grid item xs={6} sm={4}>
                <MetricBox
                  label="Crawl Waste"
                  value={`${wastePct}%`}
                  message="Wasted crawl requests. Lower is better."
                  status={statusFor(wastePct, true)}
                  tooltipKey="crawl_waste"
                />
              </Grid>
            ) : null}
            {fresh?.freshness_score !== undefined ? (
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
            {fresh?.stale_content_percentage !== undefined ? (
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
          </Grid>

          {/* Link health detail */}
          {linkData?.total_links_found ? (
            <SectionCard
              icon={<LinkIcon sx={{ fontSize: 16, color: "#0ea5e9" }} />}
              title="Link Health"
              tooltipKey="link_health"
            >
              <Grid container spacing={1}>
                <Grid item xs={6}>
                  <MiniStat
                    label="Internal Links"
                    value={linkData.internal_link_count}
                    hint="Links to your own pages — help visitors and search engines find content."
                  />
                </Grid>
                <Grid item xs={6}>
                  <MiniStat
                    label="External Links"
                    value={linkData.external_link_count}
                    hint="Links out to other websites. High-quality ones add credibility."
                  />
                </Grid>
                <Grid item xs={6}>
                  <MiniStat
                    label="Nofollow"
                    value={linkData.nofollow_link_count}
                    hint="Links search engines won't count. Normal for ads and comments."
                  />
                </Grid>
                <Grid item xs={6}>
                  <MiniStat
                    label="Avg per Page"
                    value={linkData.avg_links_per_page}
                    hint="Average links on each page. A healthy amount aids navigation."
                  />
                </Grid>
              </Grid>
            </SectionCard>
          ) : null}

          {/* Page status */}
          {pages && Object.keys(pages).length > 0 ? (
            <SectionCard
              icon={<CheckIcon sx={{ fontSize: 16, color: "#10b981" }} />}
              title="Page Status"
              tooltipKey="page_status"
            >
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
              <Typography variant="caption" sx={{ color: "#475569", display: "block", mt: 0.75, lineHeight: 1.4 }}>
                200 means a page loaded correctly; 404 means it's missing; 5xx means a server error.
              </Typography>
            </SectionCard>
          ) : null}

          {/* Crawl budget score */}
          {budgetData?.success ? (
            <SectionCard
              icon={<BudgetIcon sx={{ fontSize: 16, color: "#f59e0b" }} />}
              title="Crawl Budget"
              tooltipKey="crawl_budget"
            >
              <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.5 }}>
                <Typography variant="subtitle2" sx={{ color: "#0f172a", fontWeight: 700 }}>
                  {optScore}
                </Typography>
                <Chip
                  label={statusFor(optScore).label}
                  size="small"
                  sx={{ height: 18, fontSize: "0.6rem", fontWeight: 600, bgcolor: statusFor(optScore).color + "1a", color: statusFor(optScore).color }}
                />
              </Box>
              <ScoreBar value={optScore} label="Optimization Score" />
              <Typography variant="caption" sx={{ color: "#475569", display: "block", lineHeight: 1.4 }}>
                Search engines have a limited crawl budget. {budgetData.pages_crawled} of {budgetData.sitemap_total_urls} sitemap URLs were crawled — a higher score means your important pages are easier to find.
              </Typography>
            </SectionCard>
          ) : null}

          {/* Top themes */}
          {data.augmented_themes && data.augmented_themes.length > 0 ? (
            <SectionCard
              icon={<TopicIcon sx={{ fontSize: 16, color: "#8b5cf6" }} />}
              title="Top Content Themes"
              tooltipKey="top_themes"
            >
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
              <Typography variant="caption" sx={{ color: "#475569", display: "block", mt: 0.75, lineHeight: 1.4 }}>
                The topics that appear most often in your content — this is what search engines think your site is about.
              </Typography>
            </SectionCard>
          ) : null}

          {/* View full report hint */}
          <Box sx={{ mt: 2, pt: 1.5, borderTop: "1px solid #e2e8f0" }}>
            <Typography variant="caption" sx={{ color: "#64748b" }}>
              Full report with redirect audit, image SEO, robots.txt, and crawl details available on the SEO Dashboard after onboarding.
            </Typography>
          </Box>
        </Box>
      </Collapse>
    </Paper>
  );
};

export default ContentAuditSummaryCard;
