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
import {
  previewTodayPlan,
  generateTodayPlan,
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

export const AgentTeamPreview: React.FC = () => {
  const [loading, setLoading] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [preview, setPreview] = React.useState<TodayPlanPreview | null>(() => {
    return onboardingCache.getFinalStepData()?.todayPlanPreview ?? null;
  });
  const [saved, setSaved] = React.useState(false);

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

  const handlePreview = async () => {
    setLoading(true);
    currentStageRef.current = 0;
    setCurrentStage(0);
    setProgressPercent(0);
    setCompletedAgents([]);
    setError(null);
    setSaved(false);
    try {
      const data = await previewTodayPlan();
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
          onClick={handlePreview}
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
            </Alert>
          )}
          <Stack spacing={2}>
            {Object.entries(preview.proposals_by_agent).map(([agent, tasks]) => (
              <Box key={agent}>
                <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
                  {AGENT_LABELS[agent] || agent}
                </Typography>
                <Stack spacing={1}>
                  {(tasks || []).map((t: any, i: number) => (
                    <Box
                      key={i}
                      sx={{
                        p: 1.5,
                        borderRadius: 2,
                        border: "1px solid rgba(255, 255, 255, 0.15)",
                        bgcolor: "rgba(255, 255, 255, 0.06)",
                      }}
                    >
                      <Stack direction="row" spacing={1} sx={{ mb: 0.5 }}>
                        {t.priority && (
                          <Chip
                            size="small"
                            label={t.priority}
                            sx={{ bgcolor: "rgba(255, 255, 255, 0.12)", color: "#e5e7eb" }}
                          />
                        )}
                        {t.pillarId && (
                          <Chip
                            size="small"
                            label={t.pillarId}
                            variant="outlined"
                            sx={{ borderColor: "rgba(255, 255, 255, 0.3)", color: "#e5e7eb" }}
                          />
                        )}
                      </Stack>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        {t.title}
                      </Typography>
                      {t.description && (
                        <Typography variant="body2" sx={{ opacity: 0.85 }}>
                          {t.description}
                        </Typography>
                      )}
                    </Box>
                  ))}
                </Stack>
              </Box>
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
              onClick={handlePreview}
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
                </Alert>
              )}
              <Stack spacing={2}>
                {Object.entries(preview.proposals_by_agent).map(([agent, tasks]) => (
                  <Box key={agent}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1, color: "primary.main" }}>
                      {AGENT_LABELS[agent] || agent}
                    </Typography>
                    <Stack spacing={1}>
                      {(tasks || []).map((t: any, i: number) => (
                        <Box
                          key={i}
                          sx={{
                            p: 1.5,
                            borderRadius: 2,
                            border: "1px solid",
                            borderColor: "divider",
                            bgcolor: "background.default",
                          }}
                        >
                          <Stack direction="row" spacing={1} sx={{ mb: 0.5 }}>
                            {t.priority && (
                              <Chip
                                size="small"
                                label={t.priority}
                                color={t.priority === "high" ? "error" : t.priority === "medium" ? "warning" : "default"}
                              />
                            )}
                            {t.pillarId && (
                              <Chip size="small" label={t.pillarId} variant="outlined" />
                            )}
                          </Stack>
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>
                            {t.title}
                          </Typography>
                          {t.description && (
                            <Typography variant="body2" color="text.secondary">
                              {t.description}
                            </Typography>
                          )}
                        </Box>
                      ))}
                    </Stack>
                  </Box>
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
