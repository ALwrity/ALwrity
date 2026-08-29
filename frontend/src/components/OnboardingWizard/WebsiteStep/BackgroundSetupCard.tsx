/**
 * BackgroundSetupCard — task config card shown after website analysis in onboarding.
 * Lets user toggle background tasks, run the content audit on demand, and preview results.
 */
import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  Box,
  Typography,
  Switch,
  Paper,
  Chip,
  Button,
  CircularProgress,
} from "@mui/material";
import { apiClient, longRunningApiClient } from "../../../api/client";
import { SeoPreviewCard } from "./SeoPreviewCard";
import { ContentAuditSummaryCard } from "./ContentAuditSummaryCard";
import { SiteHealthSummaryCard } from "./SiteHealthSummaryCard";

interface TaskConfig {
  enabled: boolean;
  delay_mins: number;
  label: string;
  description: string;
}

interface AdvertoolsTaskStatus {
  status: "not_created" | "scheduled" | "running" | "completed" | "failed" | "paused";
  last_executed: string | null;
  last_success: string | null;
  failure_reason: string | null;
}

interface AdvertoolsStatusResponse {
  success: boolean;
  content_audit: AdvertoolsTaskStatus;
  site_health: AdvertoolsTaskStatus;
  has_results: boolean;
}

const TAG = "[BackgroundSetup]";

const STORAGE_KEY_CONTENT_AUDIT = "content_audit_result";
const STORAGE_KEY_SITE_HEALTH = "site_health_result";

// Gradient button styles — give the primary "Run" actions a vivid gradient and
// the secondary "View Results" actions a colored outline (no white-on-white).
const GRADIENT_BUTTON = {
  textTransform: "none" as const,
  fontSize: 11,
  fontWeight: 700,
  color: "#fff",
  border: "none",
  px: 1.5,
  py: 0.4,
  borderRadius: 2,
  boxShadow: "0 2px 6px rgba(0,0,0,0.18)",
  "&:hover": { filter: "brightness(1.08)", boxShadow: "0 3px 8px rgba(0,0,0,0.25)" },
  "&:disabled": { color: "#fff", opacity: 0.6 },
};

const GRADIENTS: Record<string, { bg: string; outlineColor: string; outlineColor2: string }> = {
  seo: {
    bg: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)",
    outlineColor: "#6366f1",
    outlineColor2: "#8b5cf6",
  },
  content: {
    bg: "linear-gradient(135deg, #0ea5e9 0%, #6366f1 100%)",
    outlineColor: "#0ea5e9",
    outlineColor2: "#6366f1",
  },
  health: {
    bg: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
    outlineColor: "#10b981",
    outlineColor2: "#059669",
  },
};

const OUTLINE_BUTTON = (color: string) => ({
  textTransform: "none" as const,
  fontSize: 11,
  fontWeight: 600,
  color,
  border: `1px solid ${color}`,
  px: 1.25,
  py: 0.3,
  borderRadius: 2,
  bgcolor: "transparent",
  "&:hover": { bgcolor: color + "14", borderColor: color },
});

const TASK_ICONS: Record<string, string> = {
  seo_audit: "🔍",
  sif_indexing: "🧠",
  market_trends: "📈",
  advertools_content: "📊",
  advertools_health: "🔧",
  website_analysis_tasks: "🔄",
};

const TASK_DEFAULTS: Record<string, TaskConfig> = {
  deep_competitor: { enabled: true, delay_mins: 5, label: "Deep Competitor Analysis", description: "Full competitive intelligence scan with keyword and content gap analysis" },
  sif_indexing: { enabled: true, delay_mins: 10, label: "SIF Indexing", description: "Strategic Intelligence Framework — index your content for AI-driven insights" },
  market_trends: { enabled: true, delay_mins: 15, label: "Market Trends", description: "Track your industry's shifting topics, keywords, and content opportunities" },
};

function formatDelay(mins: number): string {
  if (mins === 0) return "Now";
  if (mins < 60) return `${mins}m`;
  return `${Math.floor(mins / 60)}h`;
}

function formatTimeAgo(iso: string | null): string {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function statusChip(status: string, failureReason?: string | null) {
  switch (status) {
    case "running":
      return (
        <Chip
          size="small"
          label="Running..."
          color="secondary"
          variant="outlined"
          icon={<CircularProgress size={10} color="secondary" />}
          sx={{ height: 20, fontSize: "0.65rem", ml: 1 }}
        />
      );
    case "completed":
      return (
        <Chip
          size="small"
          label="Completed"
          color="success"
          variant="outlined"
          sx={{ height: 20, fontSize: "0.65rem", ml: 1 }}
        />
      );
    case "failed":
      return (
        <Chip
          size="small"
          label={failureReason ? "Failed" : "Failed"}
          color="error"
          variant="outlined"
          sx={{ height: 20, fontSize: "0.65rem", ml: 1 }}
        />
      );
    case "scheduled":
      return (
        <Chip
          size="small"
          label="Scheduled"
          color="default"
          variant="outlined"
          sx={{ height: 20, fontSize: "0.65rem", ml: 1 }}
        />
      );
    default:
      return null;
  }
}

interface BackgroundSetupCardProps {
  websiteUrl: string;
  brandAnalysis?: any;
  seoAudit?: any;
  onConfigChange?: (prefs: Record<string, { enabled: boolean; delay_mins: number }>) => void;
}

export const BackgroundSetupCard: React.FC<BackgroundSetupCardProps> = ({
  websiteUrl,
  brandAnalysis,
  seoAudit,
  onConfigChange,
}) => {
  const [prefs, setPrefs] = useState<Record<string, TaskConfig>>(TASK_DEFAULTS);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSeoPreview, setShowSeoPreview] = useState(false);
  const [showSeoResults, setShowSeoResults] = useState(false);
  const [hasSeoResults, setHasSeoResults] = useState(false);
  const [showContentAudit, setShowContentAudit] = useState(false);

  // Advertools task status
  const [advStatus, setAdvStatus] = useState<AdvertoolsStatusResponse | null>(null);
  const [runLoading, setRunLoading] = useState(false);
  const [runError, setRunError] = useState<string | null>(null);
  const [lastRunResult, setLastRunResult] = useState<any>(null);

  // Site health run state (mirrors content audit)
  const [showSiteHealth, setShowSiteHealth] = useState(false);
  const [healthLoading, setHealthLoading] = useState(false);
  const [healthError, setHealthError] = useState<string | null>(null);
  const [lastHealthRun, setLastHealthRun] = useState<any>(null);

  // Fetch advertools status
  const fetchAdvStatus = useCallback(async () => {
    try {
      const res = await apiClient.get("/api/onboarding/content-audit/status");
      if (res.data?.success) {
        setAdvStatus(res.data);
        return res.data as AdvertoolsStatusResponse;
      }
    } catch {
      console.error(TAG, "Failed to fetch content audit status");
    }
    return null;
  }, []);

  // Load preferences + status on mount
  useEffect(() => {
    let cancelled = false;
    Promise.all([
      apiClient.get("/api/onboarding/step2/task-preferences"),
      fetchAdvStatus(),
    ])
      .then(([prefRes]) => {
        if (!cancelled && prefRes.data?.success) {
          setPrefs(prefRes.data.tasks);
          onConfigChange?.(prefRes.data.tasks);
        }
      })
      .catch(() => {
        if (!cancelled) setError("Could not load task preferences");
      });
    return () => { cancelled = true; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Hydrate results from persisted DB data on mount
  useEffect(() => {
    if (advStatus?.has_results) {
      if (brandAnalysis && !lastRunResult) {
        setLastRunResult({ audit: brandAnalysis });
      }
      if (seoAudit && !lastHealthRun) {
        setLastHealthRun({ site_health: seoAudit?.site_health || seoAudit });
      }
    }
  }, [advStatus?.has_results, brandAnalysis, seoAudit, lastRunResult, lastHealthRun]);

  // Restore instantly from localStorage (survives refresh / step navigation).
  useEffect(() => {
    try {
      const cachedAudit = localStorage.getItem(STORAGE_KEY_CONTENT_AUDIT);
      if (cachedAudit) {
        const parsed = JSON.parse(cachedAudit);
        if (parsed?.audit) setLastRunResult(parsed);
      }
    } catch {}
    try {
      const cachedHealth = localStorage.getItem(STORAGE_KEY_SITE_HEALTH);
      if (cachedHealth) {
        const parsed = JSON.parse(cachedHealth);
        if (parsed?.site_health || parsed?.success) setLastHealthRun(parsed);
      }
    } catch {}
    try {
      const cachedPreview = localStorage.getItem("seo_preview_result");
      if (cachedPreview) {
        const parsed = JSON.parse(cachedPreview);
        if (parsed?.success && parsed?.pages?.length) setHasSeoResults(true);
      }
    } catch {}
  }, []);

  // Save preferences on toggle
  const savePreferences = useCallback(async (updated: Record<string, TaskConfig>) => {
    const payload: Record<string, { enabled: boolean; delay_mins: number }> = {};
    for (const [k, v] of Object.entries(updated)) {
      payload[k] = { enabled: v.enabled, delay_mins: v.delay_mins };
    }
    setSaving(true);
    try {
      await apiClient.put("/api/onboarding/step2/task-preferences", { tasks: payload });
      onConfigChange?.(payload);
    } catch {
      console.error(TAG, "Failed to save preferences");
    } finally {
      setSaving(false);
    }
  }, [onConfigChange]);

  const handleToggle = (taskId: string) => {
    if (!prefs) return;
    const updated = {
      ...prefs,
      [taskId]: { ...prefs[taskId], enabled: !prefs[taskId].enabled },
    };
    setPrefs(updated);
    savePreferences(updated);
  };

  // Run the content audit on demand (mirrors SEO preview behaviour)
  const runContentAudit = async () => {
    setRunLoading(true);
    setRunError(null);
    try {
      const res = await longRunningApiClient.post("/api/onboarding/content-audit/run", {
        website_url: websiteUrl,
      });
      if (res.data?.success || res.data?.audit) {
        setLastRunResult(res.data);
        setShowContentAudit(true);
        try {
          localStorage.setItem(STORAGE_KEY_CONTENT_AUDIT, JSON.stringify(res.data));
        } catch {}
      } else {
        setRunError(res.data?.error || "Content audit returned no results");
      }
    } catch (e: any) {
      setRunError(e?.response?.data?.detail || e?.message || "Could not run content audit");
    } finally {
      setRunLoading(false);
      fetchAdvStatus();
    }
  };

  // Run the site health analysis on demand (mirrors content audit)
  const runSiteHealth = async () => {
    setHealthLoading(true);
    setHealthError(null);
    try {
      const res = await longRunningApiClient.post("/api/onboarding/site-health/run", {
        website_url: websiteUrl,
      });
      if (res.data?.success || res.data?.site_health) {
        setLastHealthRun(res.data);
        setShowSiteHealth(true);
        try {
          localStorage.setItem(STORAGE_KEY_SITE_HEALTH, JSON.stringify(res.data));
        } catch {}
      } else {
        setHealthError(res.data?.error || "Site health analysis returned no results");
      }
    } catch (e: any) {
      setHealthError(e?.response?.data?.detail || e?.message || "Could not run site health analysis");
    } finally {
      setHealthLoading(false);
      fetchAdvStatus();
    }
  };

  const contentAuditStatus = advStatus?.content_audit;
  const hasAuditResults = advStatus?.has_results || false;

  // Merge freshly-run audit results over the (possibly stale) brandAnalysis prop
  // so the summary card shows fresh data immediately after a run.
  const mergedBrandAnalysis = useMemo(() => {
    const audit = lastRunResult?.audit;
    if (!audit) return brandAnalysis;
    // Fresh runs return `themes`; persisted DB rows store `augmented_themes`.
    // Normalize both so the summary card always renders the themes section.
    const themes = audit.themes || audit.augmented_themes || brandAnalysis?.augmented_themes;
    return {
      ...(brandAnalysis || {}),
      ...(audit || {}),
      augmented_themes: themes,
      last_advertools_audit: new Date().toISOString(),
    };
  }, [brandAnalysis, lastRunResult]);

  // Merge freshly-run site health over the (possibly stale) seoAudit prop
  // so the summary card shows fresh data immediately after a run.
  const mergedSeoAudit = useMemo(() => {
    const health = lastHealthRun?.site_health;
    if (!health) return seoAudit;
    return {
      ...(seoAudit || {}),
      site_health: health,
      last_advertools_health_check: new Date().toISOString(),
    };
  }, [seoAudit, lastHealthRun]);

  if (error) {
    return (
      <Paper sx={{ p: 3, mt: 2, border: "1px solid #e2e8f0", borderRadius: 2 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>Smart Background Setup</Typography>
        <Typography variant="body2" color="error">{error}</Typography>
      </Paper>
    );
  }

  const taskIds = Object.keys(prefs || {});
  const enabledCount = taskIds.filter((id) => prefs[id].enabled).length;

  return (
    <Paper sx={{ p: 0, mt: 3, border: "1px solid #e0e0e0", borderRadius: 2, overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
      {/* Header */}
      <Box
        sx={{
          px: 3,
          py: 2,
          bgcolor: "#fafafa",
          borderBottom: "1px solid #eee",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <Box>
          <Typography variant="subtitle1" sx={{ fontWeight: 700, color: "#1e293b" }}>
            ⚙️ Smart Background Setup
          </Typography>
          <Typography variant="body2" sx={{ color: "#64748b", mt: 0.5 }}>
            {enabledCount} of {taskIds.length} tasks enabled — these run in the background
            after you continue to keep your brand intelligence fresh.
          </Typography>
        </Box>
        {saving && <CircularProgress size={16} sx={{ flexShrink: 0 }} />}
      </Box>

      {/* Task list */}
      {taskIds.map((taskId) => {
        const task = prefs[taskId];
        const isContentAudit = taskId === "advertools_content";
        const isSeoAudit = taskId === "seo_audit";
        const isHealth = taskId === "advertools_health";
        const taskStatus = isContentAudit
          ? contentAuditStatus?.status
          : isHealth
            ? advStatus?.site_health?.status
            : null;

        return (
          <Box
            key={taskId}
            sx={{
              px: 3,
              py: 2,
              borderBottom: "1px solid #f0f0f0",
              bgcolor: "#fff",
              "&:last-child": { borderBottom: "none" },
            }}
          >
            {/* Row: icon + label + description + actions */}
            <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1.5 }}>
              <Typography sx={{ fontSize: 18, mt: 0.2 }}>{TASK_ICONS[taskId] || "📋"}</Typography>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, flexWrap: "wrap" }}>
                  <Typography variant="body2" sx={{ fontWeight: 600, color: "#334155" }}>
                    {task.label}
                  </Typography>
                  {isContentAudit && statusChip(taskStatus || "", contentAuditStatus?.failure_reason)}
                  {isHealth && statusChip(taskStatus || "", advStatus?.site_health?.failure_reason)}
                  {isContentAudit && contentAuditStatus?.last_success && (
                    <Chip
                      size="small"
                      label={formatTimeAgo(contentAuditStatus.last_success)}
                      variant="outlined"
                      sx={{ height: 20, fontSize: "0.65rem", ml: 0.5 }}
                    />
                  )}
                </Box>
                <Typography variant="caption" sx={{ color: "#64748b", lineHeight: 1.5 }}>
                  {task.description}
                </Typography>
                <Chip
                  size="small"
                  label={`⏱️ ~${formatDelay(task.delay_mins)}`}
                  variant="outlined"
                  sx={{ fontSize: 10, mt: 0.5 }}
                />
              </Box>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexShrink: 0, pt: 0.3 }}>
                {/* SEO Audit preview button */}
                {isSeoAudit && task.enabled && (
                  <Button
                    size="small"
                    sx={{ ...GRADIENT_BUTTON, background: GRADIENTS.seo.bg }}
                    onClick={() => { setShowSeoPreview(true); setShowSeoResults(false); }}
                  >
                    Run Preview
                  </Button>
                )}

                {/* SEO Audit view previous results */}
                {isSeoAudit && task.enabled && hasSeoResults && !showSeoPreview && (
                  <Button
                    size="small"
                    sx={OUTLINE_BUTTON(GRADIENTS.seo.outlineColor)}
                    onClick={() => { setShowSeoResults(true); setShowSeoPreview(false); }}
                  >
                    View Results
                  </Button>
                )}

                {/* Hide SEO preview/results */}
                {isSeoAudit && (showSeoPreview || showSeoResults) && (
                  <Button
                    size="small"
                    sx={OUTLINE_BUTTON("#64748b")}
                    onClick={() => { setShowSeoPreview(false); setShowSeoResults(false); }}
                  >
                    Hide
                  </Button>
                )}

                {/* Content Audit run button */}
                {isContentAudit && task.enabled && (
                  <Button
                    size="small"
                    disabled={runLoading}
                    startIcon={runLoading ? <CircularProgress size={10} sx={{ color: "#fff" }} /> : undefined}
                    sx={{ ...GRADIENT_BUTTON, background: GRADIENTS.content.bg }}
                    onClick={runContentAudit}
                  >
                    {runLoading ? "Running..." : "Run Content Audit"}
                  </Button>
                )}

                {/* Content Audit view results toggle */}
                {isContentAudit && !runLoading && (hasAuditResults || lastRunResult) && (
                  <Button
                    size="small"
                    sx={OUTLINE_BUTTON(GRADIENTS.content.outlineColor)}
                    onClick={() => setShowContentAudit(!showContentAudit)}
                  >
                    {showContentAudit ? "Hide Results" : "View Results"}
                  </Button>
                )}

                {/* Site Health run button */}
                {isHealth && task.enabled && (
                  <Button
                    size="small"
                    disabled={healthLoading}
                    startIcon={healthLoading ? <CircularProgress size={10} sx={{ color: "#fff" }} /> : undefined}
                    sx={{ ...GRADIENT_BUTTON, background: GRADIENTS.health.bg }}
                    onClick={runSiteHealth}
                  >
                    {healthLoading ? "Running..." : "Run Site Health"}
                  </Button>
                )}

                {/* Site Health view results toggle */}
                {isHealth && !healthLoading && (lastHealthRun || (advStatus?.site_health?.status && advStatus.site_health.status !== "not_created")) && (
                  <Button
                    size="small"
                    sx={OUTLINE_BUTTON(GRADIENTS.health.outlineColor)}
                    onClick={() => setShowSiteHealth(!showSiteHealth)}
                  >
                    {showSiteHealth ? "Hide Results" : "View Results"}
                  </Button>
                )}

                <Switch
                  size="small"
                  checked={task.enabled}
                  onChange={() => handleToggle(taskId)}
                  color="primary"
                />
              </Box>
            </Box>

            {runError && isContentAudit && (
              <Typography variant="caption" sx={{ color: "#ef4444", display: "block", mt: 1 }}>
                {runError}
              </Typography>
            )}

            {healthError && isHealth && (
              <Typography variant="caption" sx={{ color: "#ef4444", display: "block", mt: 1 }}>
                {healthError}
              </Typography>
            )}

            {/* SEO Preview — visible on click */}
            {isSeoAudit && showSeoPreview && task.enabled && (
              <Box sx={{ mt: 2 }}>
                <SeoPreviewCard websiteUrl={websiteUrl} autoRun />
              </Box>
            )}

            {/* SEO Preview results (view-only, no re-run) */}
            {isSeoAudit && showSeoResults && task.enabled && (
              <Box sx={{ mt: 2 }}>
                <SeoPreviewCard websiteUrl={websiteUrl} autoRun={false} />
              </Box>
            )}

            {/* Content Audit Results — visible on click */}
            {isContentAudit && showContentAudit && task.enabled && (
              <Box sx={{ mt: 2 }}>
                {runLoading ? (
                  <Paper sx={{ p: 2.5, borderRadius: 2, border: "1px solid #e2e8f0", bgcolor: "#f8fafc" }}>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                      <CircularProgress size={16} color="secondary" />
                      <Typography variant="body2" sx={{ color: "#475569", fontWeight: 500 }}>
                        Running content audit — this may take a minute while we crawl your site...
                      </Typography>
                    </Box>
                  </Paper>
                ) : hasAuditResults || lastRunResult ? (
                  <ContentAuditSummaryCard brandAnalysis={mergedBrandAnalysis} />
                ) : (
                  <Paper sx={{ p: 2.5, borderRadius: 2, border: "1px solid #e2e8f0", bgcolor: "#f8fafc" }}>
                    <Typography variant="body2" sx={{ color: "#475569", fontWeight: 500 }}>
                      📊 No content audit results yet. Click "Run Content Audit" to analyze your site now,
                      or it will run automatically as a scheduled background task.
                    </Typography>
                  </Paper>
                )}
              </Box>
            )}

            {/* Site Health Results — visible on click */}
            {isHealth && showSiteHealth && task.enabled && (
              <Box sx={{ mt: 2 }}>
                {healthLoading ? (
                  <Paper sx={{ p: 2.5, borderRadius: 2, border: "1px solid #e2e8f0", bgcolor: "#f8fafc" }}>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                      <CircularProgress size={16} color="success" />
                      <Typography variant="body2" sx={{ color: "#475569", fontWeight: 500 }}>
                        Analyzing site health — checking your sitemap for freshness and structure...
                      </Typography>
                    </Box>
                  </Paper>
                ) : lastHealthRun?.site_health || mergedSeoAudit?.site_health?.total_urls ? (
                  <SiteHealthSummaryCard seoAudit={mergedSeoAudit} />
                ) : (
                  <Paper sx={{ p: 2.5, borderRadius: 2, border: "1px solid #e2e8f0", bgcolor: "#f8fafc" }}>
                    <Typography variant="body2" sx={{ color: "#475569", fontWeight: 500 }}>
                      🩺 No site health results yet. Click "Run Site Health" to analyze your site now,
                      or it will run automatically as a scheduled background task.
                    </Typography>
                  </Paper>
                )}
              </Box>
            )}
          </Box>
        );
      })}
    </Paper>
  );
};
