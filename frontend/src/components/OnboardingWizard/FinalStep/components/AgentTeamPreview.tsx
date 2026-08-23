import React from "react";
import {
  Box,
  Button,
  Typography,
  CircularProgress,
  Chip,
  Stack,
  Alert,
} from "@mui/material";
import RocketLaunchIcon from "@mui/icons-material/RocketLaunch";
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

export const AgentTeamPreview: React.FC = () => {
  const [loading, setLoading] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [preview, setPreview] = React.useState<TodayPlanPreview | null>(null);
  const [saved, setSaved] = React.useState(false);

  React.useEffect(() => {
    const cached = onboardingCache.getFinalStepData()?.todayPlanPreview;
    if (cached) {
      setPreview(cached);
    }
  }, []);

  const handlePreview = async () => {
    setLoading(true);
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
