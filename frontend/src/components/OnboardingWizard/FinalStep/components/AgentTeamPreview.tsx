import React from "react";
import {
  Box,
  Button,
  Typography,
  CircularProgress,
  Chip,
  Stack,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import RocketLaunchIcon from "@mui/icons-material/RocketLaunch";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import ReplayIcon from "@mui/icons-material/Replay";
import {
  previewTodayPlan,
  generateTodayPlan,
  retryTodayAgent,
  type TodayPlanPreview,
} from "../../../../api/onboarding";
import { onboardingCache } from "../../../../services/onboardingCache";

const AGENT_LABELS: Record<string, string> = {
  content_strategist: "Content Strategist",
  strategy_architect: "Strategy Architect",
  seo_specialist: "SEO Specialist",
  social_media_manager: "Social Media Manager",
  competitor_analyst: "Competitor Analyst",
  content_gap_radar: "Content Gap Radar",
};

const DIGEST_REASON_LABELS: Record<string, string> = {
  opted_out: "Daily email digest is opted out in onboarding.",
  no_contact_email: "No contact email is set for this account.",
  no_onboarding_session: "No onboarding session was found for this account.",
  not_attempted: "The digest was not attempted for this preview.",
  not_recorded_this_plan: "Digest status was not recorded for this plan.",
  retry: "No new digest email was sent — the daily digest was already enqueued when the plan was first generated.",
  rerun: "No new digest email was sent — the daily digest was already enqueued when the plan was first generated.",
};

const digestMessage = (digest?: TodayPlanPreview["digest"]): string | null => {
  if (!digest) return null;
  const reason =
    DIGEST_REASON_LABELS[digest.reason ?? ""] ??
    (digest.reason ? `Reason: ${digest.reason}.` : "");
  switch (digest.status) {
    case "enqueued":
      return digest.contact_email
        ? `Daily digest email enqueued to ${digest.contact_email}.`
        : "Daily digest email enqueued.";
    case "failed":
      return `Daily digest email failed to enqueue${reason ? ` — ${reason}` : ""}`;
    default:
      return reason || `Daily digest email was not sent (${digest.status}).`;
  }
};


const PROGRESS_STAGES = [
  { key: "initializing", message: "Initializing agent committee...", duration: "5-10s" },
  { key: "content", message: "Content Strategist analyzing your brand...", duration: "10-20s" },
  { key: "strategy", message: "Strategy Architect defining goals...", duration: "10-20s" },
  { key: "seo", message: "SEO Specialist finding opportunities...", duration: "10-20s" },
  { key: "social", message: "Social Media Manager planning engagement...", duration: "10-20s" },
  { key: "competitor", message: "Competitor Analyst researching market...", duration: "10-20s" },
  { key: "gap", message: "Content Gap Radar scanning for opportunities...", duration: "10-20s" },
  { key: "review", message: "Reviewing and normalizing proposals...", duration: "5-10s" },
  { key: "finalizing", message: "Finalizing your personalized plan...", duration: "5-10s" },
  { key: "email", message: "Preparing daily digest email...", duration: "2-5s" },
];

const STAGE_AGENT_LABELS: Record<string, string> = {
  initializing: "",
  content: "Content Strategist",
  strategy: "Strategy Architect",
  seo: "SEO Specialist",
  social: "Social Media Manager",
  competitor: "Competitor Analyst",
  gap: "Content Gap Radar",
  review: "",
  finalizing: "",
  email: "",
};

type AgentStateInfo = {
  agent: string;
  state: "error" | "declined" | "ok";
  detail?: string | null;
};

const getAgentState = (preview: TodayPlanPreview | null, agent: string): AgentStateInfo | undefined =>
  (preview?.agent_states || []).find((s) => s.agent === agent);

const AgentGroupCard: React.FC<{
  agent: string;
  tasks: any[];
  stateInfo?: AgentStateInfo;
  retrying: boolean;
  onRetry: (agent: string) => void;
  modal?: boolean;
}> = ({ agent, tasks, stateInfo, retrying, onRetry, modal }) => {
  const isError = stateInfo?.state === "error";
  const isDeclined = stateInfo?.state === "declined";

  const chipSx = modal
    ? {}
    : isError
      ? { borderColor: "rgba(248,113,113,0.6)", color: "#fca5a5" }
      : isDeclined
        ? { borderColor: "rgba(251,191,36,0.6)", color: "#fcd34d" }
        : { borderColor: "rgba(74,222,128,0.6)", color: "#86efac" };

  const taskCardSx = modal
    ? {
        p: 1.5,
        borderRadius: 2,
        border: "1px solid",
        borderColor: "divider",
        bgcolor: "background.default",
      }
    : {
        p: 1.5,
        borderRadius: 2,
        border: "1px solid rgba(255, 255, 255, 0.15)",
        bgcolor: "rgba(255, 255, 255, 0.06)",
      };

  return (
    <Box>
      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1, flexWrap: "wrap" }}>
        <Typography
          variant="subtitle2"
          sx={{ fontWeight: 700, ...(modal ? { color: "primary.main" } : {}) }}
        >
          {AGENT_LABELS[agent] || agent}
        </Typography>
        {stateInfo && (
          <>
            <Chip
              size="small"
              icon={isError ? <ErrorOutlineIcon /> : isDeclined ? <InfoOutlinedIcon /> : <CheckCircleIcon />}
              label={isError ? "Failed" : isDeclined ? "Declined" : "OK"}
              color={isError ? "error" : isDeclined ? "warning" : "success"}
              variant={modal ? "filled" : "outlined"}
              sx={chipSx}
            />
            {isError && (
              <Button
                size="small"
                variant="outlined"
                onClick={() => onRetry(agent)}
                disabled={retrying}
                startIcon={retrying ? <CircularProgress size={14} /> : <ReplayIcon />}
                sx={
                  modal
                    ? {}
                    : { color: "#e5e7eb", borderColor: "rgba(255,255,255,0.4)", "&:hover": { borderColor: "#e5e7eb" } }
                }
              >
                {retrying ? "Retrying…" : "Retry"}
              </Button>
            )}
          </>
        )}
      </Stack>
      {(isError || isDeclined) && (
        <Typography
          variant="caption"
          component="div"
          sx={{ mb: 1, opacity: 0.85, ...(isError ? (modal ? { color: "error.main" } : { color: "#fca5a5" }) : {}) }}
        >
          {stateInfo?.detail ||
            (isError
              ? "Agent proposal failed with an unknown error. Click Retry to re-run it."
              : "I have nothing to contribute")}
        </Typography>
      )}
      <Stack spacing={1}>
        {(tasks || []).map((t: any, i: number) => (
          <Box key={i} sx={taskCardSx}>
            <Stack direction="row" spacing={1} sx={{ mb: 0.5 }}>
              {t.priority && (
                <Chip
                  size="small"
                  label={t.priority}
                  sx={modal ? { color: t.priority === "high" ? "error" : t.priority === "medium" ? "warning" : "default" } : { bgcolor: "rgba(255, 255, 255, 0.12)", color: "#e5e7eb" }}
                  color={modal ? (t.priority === "high" ? "error" : t.priority === "medium" ? "warning" : "default") : "default"}
                />
              )}
              {t.pillarId && (
                <Chip
                  size="small"
                  label={t.pillarId}
                  variant="outlined"
                  sx={modal ? {} : { borderColor: "rgba(255, 255, 255, 0.3)", color: "#e5e7eb" }}
                />
              )}
            </Stack>
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              {t.title}
            </Typography>
            {t.description && (
              <Typography variant="body2" sx={modal ? { color: "text.secondary" } : { opacity: 0.85 }}>
                {t.description}
              </Typography>
            )}
          </Box>
        ))}
      </Stack>
    </Box>
  );
};

const collectAgentKeys = (preview: TodayPlanPreview | null): string[] => {
  if (!preview) return [];
  const keys: string[] = [];
  for (const agent of Object.keys(preview.proposals_by_agent || {})) {
    if (!keys.includes(agent)) keys.push(agent);
  }
  for (const s of preview.agent_states || []) {
    if (!keys.includes(s.agent)) keys.push(s.agent);
  }
  return keys;
};

export const AgentTeamPreview: React.FC = () => {
  const [loading, setLoading] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [preview, setPreview] = React.useState<TodayPlanPreview | null>(() => {
    return onboardingCache.getFinalStepData()?.todayPlanPreview ?? null;
  });
  const [saved, setSaved] = React.useState(false);
  const [retryingKey, setRetryingKey] = React.useState<string | null>(null);
  const [retryError, setRetryError] = React.useState<string | null>(null);
  const [retryNotice, setRetryNotice] = React.useState<string | null>(null);

  // Result modal state - shows preview/error after generation
  const [resultModalOpen, setResultModalOpen] = React.useState(false);

  // Progress modal state
  const [currentStage, setCurrentStage] = React.useState(0);
  const [progressPercent, setProgressPercent] = React.useState(0);
  const [completedAgents, setCompletedAgents] = React.useState<string[]>([]);
  const currentStageRef = React.useRef(0);

  React.useEffect(() => {
    if (!loading) return;
    const interval = setInterval(() => {
      const stage = currentStageRef.current;
      if (stage >= PROGRESS_STAGES.length - 1) return;
      const next = stage + 1;
      currentStageRef.current = next;
      setCurrentStage(next);
      setProgressPercent((next / PROGRESS_STAGES.length) * 100);
      const stageInfo = PROGRESS_STAGES[next];
      const label = stageInfo ? STAGE_AGENT_LABELS[stageInfo.key] : undefined;
      if (label) {
        setCompletedAgents((completed) =>
          completed.includes(label) ? completed : [...completed, label],
        );
      }
    }, 8000);
    return () => clearInterval(interval);
  }, [loading]);

  const handlePreview = async (force = false) => {
    setLoading(true);
    currentStageRef.current = 0;
    setCurrentStage(0);
    setProgressPercent(0);
    setCompletedAgents([]);
    setError(null);
    setSaved(false);
    setRetryError(null);
    setRetryNotice(null);
    try {
      // force=true ("Re-run preview") re-runs the committee and replaces the
      // persisted plan instead of replaying today's cached/first-run plan.
      const data = await previewTodayPlan(force);
      setPreview(data);
      onboardingCache.saveFinalStepData({ todayPlanPreview: data });
      setResultModalOpen(true);
    } catch (e: any) {
      const errMsg = e?.response?.data?.detail || e?.message || "Failed to preview the team plan.";
      setError(errMsg);
      setResultModalOpen(true);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      await generateTodayPlan();
      setSaved(true);
      setResultModalOpen(true);
    } catch (e: any) {
      const errMsg = e?.response?.data?.detail || e?.message || "Failed to save today's plan.";
      setError(errMsg);
      setResultModalOpen(true);
    } finally {
      setSaving(false);
    }
  };

  const closeResultModal = () => setResultModalOpen(false);

  const handleRetryAgent = async (agent: string) => {
    setRetryingKey(agent);
    setRetryError(null);
    setRetryNotice(null);
    try {
      const result = await retryTodayAgent(agent);
      if (!result || typeof result?.proposals_by_agent !== "object") {
        setRetryError((result as any)?.detail || "Retry failed. Please try again.");
        return;
      }
      const label = AGENT_LABELS[agent] || agent;
      const merged = result.proposals_by_agent?.[agent] ?? [];
      const nextPreview: TodayPlanPreview | null = preview
        ? {
            ...preview,
            proposals_by_agent: {
              ...(preview.proposals_by_agent || {}),
              [agent]: merged,
            },
            agent_states: result.agent_states ?? preview.agent_states,
            failed_agents: result.failed_agents ?? preview.failed_agents,
            declined_agents: result.declined_agents ?? preview.declined_agents,
            template_fallback_count: result.template_fallback_count ?? preview.template_fallback_count,
            backfill_errors: result.backfill_errors ?? preview.backfill_errors,
          }
        : null;
      setPreview(nextPreview);
      if (nextPreview) {
        onboardingCache.saveFinalStepData({ todayPlanPreview: nextPreview });
      }
      setRetryNotice(merged.length > 0
        ? `${label} retried successfully — ${merged.length} new proposal${merged.length === 1 ? "" : "s"} merged into the plan.`
        : `${label} retried successfully but still had nothing to contribute.`);
    } catch (e: any) {
      const msg = e?.response?.data?.detail || e?.message || `Failed to retry ${AGENT_LABELS[agent] || agent}.`;
      setRetryError(msg);
    } finally {
      setRetryingKey(null);
    }
  };

  return (
    <Box
      sx={{
        mt: 3,
        p: 3,
        borderRadius: 3,
        background: "linear-gradient(135deg, #0f172a 0%, #312e81 40%, #4f46e5 100%)",
        boxShadow: "0 12px 30px rgba(15,23,42,0.45)",
        "& .MuiTypography-root": {
          color: "#e5e7eb !important",
          WebkitTextFillColor: "#e5e7eb",
        },
      }}
    >
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.5 }}>
        <RocketLaunchIcon sx={{ color: "#a5b4fc", fontSize: 20 }} />
        <Typography variant="h6" sx={{ fontWeight: 700 }}>
          Preview your team&apos;s plan
        </Typography>
      </Box>
      <Typography variant="body2" sx={{ opacity: 0.9, mb: 2 }}>
        See what your agents would propose for today before you launch.
      </Typography>

      {error && !resultModalOpen && (
        <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>
          {error}
        </Alert>
      )}

      {!preview && (
        <Button
          variant="contained"
          onClick={() => handlePreview(false)}
          disabled={loading}
          startIcon={loading ? <CircularProgress size={16} sx={{ color: "#4f46e5" }} /> : <RocketLaunchIcon />}
          sx={{
            textTransform: "none",
            bgcolor: "#ffffff",
            color: "#312e81",
            "&:hover": { bgcolor: "#e0e7ff" },
          }}
        >
          {loading ? "Running your agents…" : "Preview today's plan"}
        </Button>
      )}

      {preview && !resultModalOpen && (
        <>
          {preview.fallback_used && (
            <Alert severity="info" sx={{ mb: 2, borderRadius: 2 }}>
              Agents are still warming up — showing a fallback plan.
            </Alert>
          )}
          {(preview.template_fallback_count ?? 0) > 0 && (
            <Alert severity="warning" sx={{ mb: 2, borderRadius: 2 }}>
              {preview.template_fallback_count} suggestion
              {(preview.template_fallback_count ?? 0) === 1 ? " is" : "s are"} generic template
              {((preview.template_fallback_count ?? 0) === 1) ? "" : "s"} because agent analysis couldn&apos;t complete.
              {(preview.backfill_errors ?? []).length > 0 && (
                <Box component="span" sx={{ display: "block", mt: 0.5, fontSize: "0.85em", opacity: 0.9 }}>
                  {(preview.backfill_errors ?? []).map((be, idx) => (
                    <Box key={idx} sx={{ mt: 0.25 }}>
                      • {be.pillar || "unknown"}:{" "}
                      {be.error
                        ? `generation error — ${be.error}`
                        : (be.reason || "static template substituted")}
                    </Box>
                  ))}
                </Box>
              )}
            </Alert>
          )}
          {(() => {
            const msg = digestMessage(preview.digest);
            if (!msg) return null;
            const isFailure = preview.digest?.status === "failed";
            return (
              <Alert severity={isFailure ? "error" : "info"} sx={{ mb: 2, borderRadius: 2 }}>
                {msg}
              </Alert>
            );
          })()}
          {retryNotice && (
            <Alert severity="success" sx={{ mb: 2, borderRadius: 2 }}>
              {retryNotice}
            </Alert>
          )}
          {retryError && (
            <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>
              {retryError}
            </Alert>
          )}
          <Stack spacing={2}>
            {collectAgentKeys(preview).map((agent) => (
              <AgentGroupCard
                key={agent}
                agent={agent}
                tasks={preview.proposals_by_agent?.[agent] ?? []}
                stateInfo={getAgentState(preview, agent)}
                retrying={retryingKey === agent}
                onRetry={handleRetryAgent}
              />
            ))}
          </Stack>
          <Box sx={{ display: "flex", gap: 1, mt: 2 }}>
            <Button
              variant="contained"
              onClick={handleSave}
              disabled={saving || saved}
              sx={{ textTransform: "none", bgcolor: "#ffffff", color: "#312e81", "&:hover": { bgcolor: "#e0e7ff" } }}
            >
              {saving ? "Saving…" : saved ? "Saved to today's plan" : "Save as today's plan"}
            </Button>
            <Button
              variant="outlined"
              onClick={() => handlePreview(true)}
              disabled={loading}
              sx={{ textTransform: "none", borderColor: "rgba(255,255,255,0.4)", color: "#e5e7eb", "&:hover": { borderColor: "#e5e7eb" } }}
            >
              Re-run preview
            </Button>
          </Box>
        </>
      )}

      {/* Result Modal - Shows preview result or error */}
      <Dialog
        open={resultModalOpen}
        onClose={closeResultModal}
        maxWidth="md"
        fullWidth
        PaperProps={{ sx: { borderRadius: 3 } }}
      >
        <DialogTitle sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", pb: 1 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            {error ? (
              <Alert severity="error" sx={{ p: 0, minWidth: 24, height: 24, alignItems: "center" }}>!</Alert>
            ) : (
              <CheckCircleIcon sx={{ color: "success.main" }} />
            )}
            <Typography variant="h6">
              {error ? "Preview Error" : "Today's Plan Preview"}
            </Typography>
          </Box>
          <IconButton onClick={closeResultModal} size="small">
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        
        <DialogContent dividers>
          {error ? (
            <Alert severity="error" sx={{ borderRadius: 2 }}>
              {error}
            </Alert>
          ) : preview ? (
            <Stack spacing={2}>
              {preview.fallback_used && (
                <Alert severity="info" sx={{ borderRadius: 2 }}>
                  Agents are still warming up — showing a fallback plan.
                </Alert>
              )}
              {(preview.template_fallback_count ?? 0) > 0 && (
                <Alert severity="warning" sx={{ borderRadius: 2 }}>
                  {preview.template_fallback_count} suggestion
                  {(preview.template_fallback_count ?? 0) === 1 ? " is" : "s are"} generic template
                  {((preview.template_fallback_count ?? 0) === 1) ? "" : "s"} because agent analysis couldn't complete.
                  {(preview.backfill_errors ?? []).length > 0 && (
                    <Box sx={{ display: "block", mt: 0.5, fontSize: "0.85em", opacity: 0.9 }}>
                      {(preview.backfill_errors ?? []).map((be, idx) => (
                        <Box key={idx} sx={{ mt: 0.25 }}>
                          • {be.pillar || "unknown"}:{" "}
                          {be.error
                            ? `generation error — ${be.error}`
                            : (be.reason || "static template substituted")}
                        </Box>
                      ))}
                    </Box>
                  )}
                </Alert>
              )}
              {(() => {
                const msg = digestMessage(preview.digest);
                if (!msg) return null;
                const isFailure = preview.digest?.status === "failed";
                return (
                  <Alert severity={isFailure ? "error" : "info"} sx={{ borderRadius: 2 }}>
                    {msg}
                  </Alert>
                );
              })()}
              {retryNotice && (
                <Alert severity="success" sx={{ borderRadius: 2 }}>
                  {retryNotice}
                </Alert>
              )}
              {retryError && (
                <Alert severity="error" sx={{ borderRadius: 2 }}>
                  {retryError}
                </Alert>
              )}
              <Stack spacing={2}>
                {collectAgentKeys(preview).map((agent) => (
                  <AgentGroupCard
                    key={agent}
                    agent={agent}
                    tasks={preview.proposals_by_agent?.[agent] ?? []}
                    stateInfo={getAgentState(preview, agent)}
                    retrying={retryingKey === agent}
                    onRetry={handleRetryAgent}
                    modal
                  />
                ))}
              </Stack>
            </Stack>
          ) : (
            <Typography color="text.secondary">
              No preview data available. Click "Preview today's plan" to generate.
            </Typography>
          )}
        </DialogContent>
        
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={closeResultModal} variant="contained">
            {error ? "Try Again" : "Close"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default AgentTeamPreview;
