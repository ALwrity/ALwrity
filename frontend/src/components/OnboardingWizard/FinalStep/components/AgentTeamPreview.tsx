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
  LinearProgress,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
} from "@mui/material";
import RocketLaunchIcon from "@mui/icons-material/RocketLaunch";
import PsychologyIcon from "@mui/icons-material/Psychology";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import EmailIcon from "@mui/icons-material/Email";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import {
  previewTodayPlan,
  generateTodayPlan,
  type TodayPlanPreview,
} from "../../../../api/onboarding";
import { onboardingCache } from "../../../../services/onboardingCache";

const AGENT_LABELS: Record<string, string> = {
  ContentStrategyAgent: "Content Strategist",
  StrategyArchitectAgent: "Strategy Architect",
  SEOOptimizationAgent: "SEO Specialist",
  SocialAmplificationAgent: "Social Media Manager",
  CompetitorResponseAgent: "Competitor Analyst",
  ContentGapRadarAgent: "Content Gap Radar",
};

const AGENT_TEAM_INFO = [
  {
    key: "ContentStrategyAgent",
    label: "Content Strategist",
    icon: "📝",
    description: "Analyzes your brand and competitors to recommend content pillars and topics",
  },
  {
    key: "StrategyArchitectAgent", 
    label: "Strategy Architect",
    icon: "🏗️",
    description: "Defines your overall content strategy and business goals alignment",
  },
  {
    key: "SEOOptimizationAgent",
    label: "SEO Specialist", 
    icon: "🔍",
    description: "Optimizes content for search engines and discovers opportunities",
  },
  {
    key: "SocialAmplificationAgent",
    label: "Social Media Manager",
    icon: "📱",
    description: "Creates social media engagement strategies and post ideas",
  },
  {
    key: "CompetitorResponseAgent",
    label: "Competitor Analyst",
    icon: "🎯",
    description: "Monitors competitor activities and suggests response strategies",
  },
  {
    key: "ContentGapRadarAgent",
    label: "Content Gap Radar",
    icon: "📡",
    description: "Identifies content gaps and opportunities in your market",
  },
];

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

  // Progress modal state
  const [currentStage, setCurrentStage] = React.useState(0);
  const [progressPercent, setProgressPercent] = React.useState(0);
  const [completedAgents, setCompletedAgents] = React.useState<string[]>([]);
  // Mirrors currentStage for use inside the interval callback (pure setters only).
  const currentStageRef = React.useRef(0);

  // Simulate progress through stages
  React.useEffect(() => {
    if (!loading) {
      return;
    }

    const interval = setInterval(() => {
      const stage = currentStageRef.current;
      if (stage >= PROGRESS_STAGES.length - 1) {
        return;
      }
      const next = stage + 1;
      currentStageRef.current = next;
      setCurrentStage(next);
      setProgressPercent((next / PROGRESS_STAGES.length) * 100);

      // Track completed agents based on stage
      const stageInfo = PROGRESS_STAGES[next];
      const label = stageInfo ? STAGE_AGENT_LABELS[stageInfo.key] : undefined;
      if (label) {
        setCompletedAgents((completed) =>
          completed.includes(label) ? completed : [...completed, label],
        );
      }
    }, 8000); // Update every 8 seconds (rough estimate per agent)

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
    } catch (e: any) {
      setError(e?.response?.data?.detail || e?.message || "Failed to preview the team plan.");
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
    } catch (e: any) {
      setError(e?.response?.data?.detail || e?.message || "Failed to save today's plan.");
    } finally {
      setSaving(false);
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

      {error && (
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

      {preview && (
        <>
          {preview.fallback_used && (
            <Alert severity="info" sx={{ mb: 2, borderRadius: 2 }}>
              Agents are still warming up — showing a fallback plan.
            </Alert>
          )}

          {(preview.template_fallback_count ?? 0) > 0 && (
            <Alert severity="warning" sx={{ mb: 2, borderRadius: 2 }}>
              {preview.template_fallback_count} suggestion
              {(preview.template_fallback_count ?? 0) === 1 ? " is" : "s are"} generic
              template{((preview.template_fallback_count ?? 0) === 1) ? "" : "s"} because agent
              analysis couldn&apos;t complete.
            </Alert>
          )}

          <Stack spacing={2}>
            {Object.entries(preview.proposals_by_agent).map(([agent, tasks]) => (
              <Box key={agent}>
                <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
                  {AGENT_LABELS[agent] || agent}
                </Typography>
                <Stack spacing={1}>
                  {(tasks || []).map((t, i) => (
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
    </Box>
  );
};

export default AgentTeamPreview;
