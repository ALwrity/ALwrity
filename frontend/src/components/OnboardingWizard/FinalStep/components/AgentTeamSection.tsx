import React from "react";
import {
  Box,
  Button,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Switch,
  FormControlLabel,
  Typography,
  Paper,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Chip,
  Stack,
  Divider,
  Tooltip,
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import GroupIcon from "@mui/icons-material/Group";
import LockIcon from "@mui/icons-material/Lock";
import SaveIcon from "@mui/icons-material/Save";
import RestartAltIcon from "@mui/icons-material/RestartAlt";
import VisibilityIcon from "@mui/icons-material/Visibility";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";

import {
  previewAgentProfile,
  saveAgentProfile,
  type AgentTeamCatalogEntry,
  type AgentTeamContextSummary,
  type TeamCertification,
  type AgentCertification,
} from "../../../../api/agentsTeam";
import { BrandContextPanel } from "./BrandContextPanel";

type Props = {
  websiteName: string;
  agents: AgentTeamCatalogEntry[];
  contextCard: Record<string, any>;
  contextSummary?: AgentTeamContextSummary;
  certification?: TeamCertification | null;
};

type CertificationBadge = {
  label: string;
  color: string;
  bgcolor: string;
  tooltip: string;
};

const CERTIFICATION_BADGES: Record<string, CertificationBadge> = {
  certified: {
    label: "Production-real",
    color: "#166534",
    bgcolor: "#dcfce7",
    tooltip:
      "All certification gates passed: this agent's tools run on real integrations and refuse to fabricate data.",
  },
  certified_with_provider_dependency: {
    label: "Provider-dependent",
    color: "#1d4ed8",
    bgcolor: "#dbeafe",
    tooltip:
      "Gates pass when the upstream provider is connected; behavior degrades honestly (no invented data) if it is not.",
  },
  degraded: {
    label: "Degraded",
    color: "#92400e",
    bgcolor: "#fef3c7",
    tooltip:
      "Some gates failed: parts of this agent's output may be limited or unavailable rather than fully real-time.",
  },
  "not certified": {
    label: "Not certified",
    color: "#475569",
    bgcolor: "#f1f5f9",
    tooltip:
      "This agent has not completed production-real certification. Its outputs are labeled as estimates or unavailable.",
  },
};

function getAgentCertificationBadge(
  agentKey: string,
  certification?: TeamCertification | null
): CertificationBadge | null {
  const agentCert: AgentCertification | undefined = certification?.agents?.[agentKey];
  const state = agentCert?.state;
  if (!state) return null;
  const badge = CERTIFICATION_BADGES[state];
  if (!badge) return null;
  return badge;
}

function resolveDisplayName(agent: AgentTeamCatalogEntry, websiteName: string) {
  const profileName = agent.profile?.display_name;
  if (profileName && profileName.trim()) return profileName.trim();
  const template = agent.defaults?.display_name_template || agent.role || agent.agent_key;
  return String(template).replace("{website_name}", websiteName || "Your");
}

function formatSchedule(schedule: any): string {
  if (!schedule) return "Not set";
  if (typeof schedule === "string") return schedule;
  const mode = schedule?.mode;
  if (!mode) return "Not set";
  if (mode === "on_demand") return "On-demand";
  if (mode === "weekly") {
    const days = Array.isArray(schedule?.days) ? schedule.days.join(", ") : "—";
    const time = schedule?.time || "—";
    return `Weekly • ${days} • ${time}`;
  }
  if (mode === "daily") {
    const time = schedule?.time || "—";
    return `Daily • ${time}`;
  }
  return String(mode);
}

const SCHEDULE_MODES = new Set(["on_demand", "weekly", "daily"]);

function normalizeSchedule(schedule: any): any {
  // Coerce legacy / LLM-written schedule values to the supported mode set so
  // the MUI Select never receives an out-of-range value.
  if (!schedule) return { mode: "on_demand" };
  if (typeof schedule === "string") {
    const mode = SCHEDULE_MODES.has(schedule) ? schedule : "on_demand";
    return { mode };
  }
  if (typeof schedule !== "object") return { mode: "on_demand" };
  const mode = SCHEDULE_MODES.has(schedule?.mode) ? schedule.mode : "on_demand";
  return { ...schedule, mode };
}

function buildAgentContextHint(agentKey: string, ctx: Record<string, any>): string | null {
  const competitors = Array.isArray(ctx?.competitors) ? ctx.competitors.filter((c: any) => c) : [];
  const pillars = Array.isArray(ctx?.content_pillars) ? ctx.content_pillars.filter((p: any) => p) : [];
  const types = Array.isArray(ctx?.content_types) ? ctx.content_types.filter((t: any) => t) : [];
  const list = (items: any[], max = 3) => items.slice(0, max).join(", ");
  const truncate = (s: string, max = 80) => (s.length > max ? `${s.slice(0, max)}…` : s);

  let hint: string | null = null;
  switch (agentKey) {
    case "competitor_analyst":
      hint = competitors.length
        ? `Tracking ${competitors.length} competitor${competitors.length > 1 ? "s" : ""}: ${list(competitors)}`
        : null;
      break;
    case "content_strategist":
      hint = pillars.length ? `Content pillars: ${list(pillars, 4)}` : null;
      break;
    case "social_media_manager":
      hint = types.length ? `Content types: ${list(types, 4)}` : null;
      break;
    case "seo_specialist":
      hint = ctx?.website_url ? `Auditing: ${ctx.website_url}` : null;
      break;
    case "content_guardian":
      hint = ctx?.brand_voice ? `Protecting brand voice: ${ctx.brand_voice}` : null;
      break;
    case "strategy_orchestrator":
    case "strategy_architect":
      hint = pillars.length ? `Orchestrating around pillars: ${list(pillars, 4)}` : null;
      break;
    default:
      hint = null;
  }
  return hint ? truncate(hint) : null;
}

type Draft = {
  display_name: string;
  enabled: boolean;
  schedule: any;
  system_prompt: string;
  task_prompt_template: string;
};

function getDefaultSystemPrompt(agent: AgentTeamCatalogEntry): string {
  return agent.defaults?.rendered_system_prompt || agent.defaults?.system_prompt_template || "";
}

function getDefaultTaskPrompt(agent: AgentTeamCatalogEntry): string {
  return agent.defaults?.rendered_task_prompt_template || agent.defaults?.task_prompt_template || "";
}

function lintDraft(agent: AgentTeamCatalogEntry, draft: Draft) {
  const warnings: string[] = [];

  const sys = (draft.system_prompt || "").trim();
  const task = (draft.task_prompt_template || "").trim();

  if (sys.length < 80) warnings.push("System prompt is very short. It may produce generic results.");
  if (task.length < 80) warnings.push("Task prompt template is very short. It may produce generic results.");
  if (sys.length > 15000) warnings.push("System prompt is very long. Consider shortening for reliability.");
  if (task.length > 15000) warnings.push("Task prompt template is very long. Consider shortening for reliability.");

  const combined = `${sys}\n${task}`.toLowerCase();
  if (combined.includes("api key") || combined.includes("apikey")) {
    warnings.push("Avoid asking for API keys inside prompts. ALwrity handles authentication separately.");
  }
  if (combined.includes("ignore previous") || combined.includes("ignore instructions")) {
    warnings.push("Avoid instructions that bypass safety or policy. They can cause unpredictable behavior.");
  }

  const tools = new Set((agent.tools || []).map((t) => String(t)));
  const toolRefRegex = /tool\s*:\s*([a-zA-Z0-9_]+)/g;
  const unknownTools = new Set<string>();
  for (const match of combined.matchAll(toolRefRegex)) {
    const name = match[1];
    if (name && !tools.has(name)) unknownTools.add(name);
  }
  if (unknownTools.size > 0) {
    warnings.push(`Prompt references unknown tools: ${Array.from(unknownTools).join(", ")}`);
  }

  const mode = draft.schedule?.mode;
  if (mode && !["on_demand", "weekly", "daily"].includes(String(mode))) {
    warnings.push("Schedule mode is not recognized. Use on_demand, weekly, or daily.");
  }

  return warnings;
}

const AgentTeamSection: React.FC<Props> = ({ websiteName, agents, contextCard, contextSummary, certification }) => {
  const [drafts, setDrafts] = React.useState<Record<string, Draft>>({});
  const [savingKey, setSavingKey] = React.useState<string | null>(null);
  const [previewBusyKey, setPreviewBusyKey] = React.useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = React.useState(false);
  const [previewTitle, setPreviewTitle] = React.useState("");
  const [previewData, setPreviewData] = React.useState<any>(null);
  const [actionError, setActionError] = React.useState<string | null>(null);

  React.useEffect(() => {
    const next: Record<string, Draft> = {};
    for (const agent of agents) {
      const key = agent.agent_key;
      const displayName = resolveDisplayName(agent, websiteName);
      const enabled = agent.profile?.enabled ?? agent.defaults?.enabled ?? true;
      const schedule = normalizeSchedule(agent.profile?.schedule ?? agent.defaults?.schedule);
      const systemPrompt = agent.profile?.system_prompt ?? getDefaultSystemPrompt(agent);
      const taskPrompt = agent.profile?.task_prompt_template ?? getDefaultTaskPrompt(agent);
      next[key] = {
        display_name: displayName,
        enabled: Boolean(enabled),
        schedule,
        system_prompt: String(systemPrompt || ""),
        task_prompt_template: String(taskPrompt || ""),
      };
    }
    setDrafts(next);
  }, [agents, websiteName]);

  const setDraftField = (agentKey: string, patch: Partial<Draft>) => {
    setDrafts((prev) => ({ ...prev, [agentKey]: { ...(prev[agentKey] || ({} as Draft)), ...patch } }));
  };

  const handleSave = async (agent: AgentTeamCatalogEntry) => {
    const key = agent.agent_key;
    const draft = drafts[key];
    if (!draft) return;

    setSavingKey(key);
    try {
      await saveAgentProfile(key, {
        display_name: draft.display_name,
        enabled: draft.enabled,
        schedule: draft.schedule,
        system_prompt: draft.system_prompt,
        task_prompt_template: draft.task_prompt_template,
      });
    } finally {
      setSavingKey(null);
    }
  };

  const handleReset = async (agent: AgentTeamCatalogEntry) => {
    const key = agent.agent_key;
    const defaults = agent.defaults || {};
    const displayName = String(defaults.display_name_template || agent.role || key).replace("{website_name}", websiteName || "Your");
    setDraftField(key, {
      display_name: displayName,
      enabled: Boolean(defaults.enabled ?? true),
      schedule: normalizeSchedule(defaults.schedule),
      system_prompt: String(defaults.rendered_system_prompt || defaults.system_prompt_template || ""),
      task_prompt_template: String(defaults.rendered_task_prompt_template || defaults.task_prompt_template || ""),
    });

    setSavingKey(key);
    try {
      await saveAgentProfile(key, {
        display_name: null,
        schedule: null,
        system_prompt: null,
        task_prompt_template: null,
        enabled: Boolean(defaults.enabled ?? true),
      });
    } finally {
      setSavingKey(null);
    }
  };

  const handlePreview = async (agent: AgentTeamCatalogEntry) => {
    const key = agent.agent_key;
    setPreviewBusyKey(key);
    setActionError(null);
    try {
      // Send the current draft prompts so the preview reflects unsaved edits.
      const draft = drafts[key];
      const preview = await previewAgentProfile(key, contextCard, {
        system_prompt: draft?.system_prompt,
        task_prompt_template: draft?.task_prompt_template,
      });
      setPreviewTitle(resolveDisplayName(agent, websiteName));
      setPreviewData(preview);
      setPreviewOpen(true);
    } catch (e: any) {
      const message =
        e?.response?.data?.detail ||
        e?.message ||
        "Preview failed. Please try again.";
      setActionError(typeof message === "string" ? message : "Preview failed. Please try again.");
    } finally {
      setPreviewBusyKey(null);
    }
  };

  return (
    <Paper
      elevation={0}
      sx={{
        mt: 3,
        p: 3,
        borderRadius: 4,
        border: "1px solid #e2e8f0",
        bgcolor: "#ffffff",
        color: "#0f172a",
        boxShadow: "0 1px 2px rgba(15,23,42,0.04)",
        "& .MuiTypography-root": {
          color: "#111827 !important",
          WebkitTextFillColor: "#111827",
        },
        "& .MuiTypography-body2": {
          color: "#4b5563 !important",
        },
        "& .MuiTypography-caption": {
          color: "#6b7280 !important",
        },
        "& .MuiFormLabel-root": {
          color: "#4b5563 !important",
        },
        "& .MuiFormLabel-root.Mui-focused": {
          color: "#4f46e5 !important",
        },
        "& .MuiInputBase-input": {
          color: "#111827 !important",
        },
        "& .MuiOutlinedInput-root": {
          bgcolor: "#ffffff !important",
          color: "#111827 !important",
        },
        "& .MuiAccordionDetails-root": {
          bgcolor: "#ffffff !important",
        },
      }}
    >
      <Box
        sx={{
          mb: 3,
          p: 2.5,
          borderRadius: 3,
          background: "linear-gradient(135deg, #0f172a 0%, #312e81 40%, #4f46e5 100%)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 2,
          boxShadow: "0 12px 30px rgba(15,23,42,0.45)",
          "& .MuiTypography-root": {
            color: "#e5e7eb !important",
            WebkitTextFillColor: "#e5e7eb",
          },
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
          <Box
            sx={{
              width: 40,
              height: 40,
              borderRadius: "999px",
              bgcolor: "rgba(129,140,248,0.4)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#e5e7eb",
            }}
          >
            <GroupIcon />
          </Box>
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="h6" sx={{ fontWeight: 800, letterSpacing: 0.2 }}>
              Meet {websiteName || "Your"} AI Marketing Team
            </Typography>
            <Typography variant="body2" sx={{ opacity: 0.92 }}>
              Enterprise-grade autonomous agents orchestrated by ALwrity&apos;s SIF framework to run your marketing.
            </Typography>
          </Box>
        </Box>
        <Tooltip
          title="Semantic Intelligence Framework™ – Alwrity's orchestration layer for autonomous marketing agents."
          arrow
          placement="left"
        >
          <Chip
            size="small"
            label="SIF Agent Framework™"
            sx={{
              borderRadius: "999px",
              border: "1px solid rgba(191,219,254,0.9)",
              bgcolor: "rgba(15,23,42,0.75)",
              color: "#e5e7eb",
              fontWeight: 600,
              letterSpacing: 0.4,
              textTransform: "uppercase",
            }}
          />
        </Tooltip>

        <BrandContextPanel websiteName={websiteName} context={contextSummary || {}} />
      </Box>

      {actionError && (
        <Alert
          severity="error"
          onClose={() => setActionError(null)}
          sx={{ mb: 2, borderRadius: 2 }}
        >
          {actionError}
        </Alert>
      )}

      <Box
        sx={{
          mb: 2,
          px: 0.5,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 1.5,
        }}
      >
        <Stack direction="row" spacing={1} flexWrap="wrap" alignItems="center">
          <Typography variant="caption" sx={{ fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.6 }}>
            Agent roles
          </Typography>
          <Chip
            size="small"
            label="Lead"
            sx={{
              height: 22,
              borderRadius: "999px",
              bgcolor: "#eef2ff",
              color: "#312e81",
              fontWeight: 600,
            }}
          />
          <Chip
            size="small"
            label="Strategist"
            sx={{
              height: 22,
              borderRadius: "999px",
              bgcolor: "#ecfdf5",
              color: "#047857",
              fontWeight: 600,
            }}
          />
          <Chip
            size="small"
            label="Analyst"
            sx={{
              height: 22,
              borderRadius: "999px",
              bgcolor: "#eff6ff",
              color: "#1d4ed8",
              fontWeight: 600,
            }}
          />
        </Stack>
        <Stack direction="row" spacing={2} alignItems="center">
          <Stack direction="row" spacing={0.75} alignItems="center">
            <Box sx={{ width: 8, height: 8, borderRadius: "999px", bgcolor: "#22c55e" }} />
            <Typography variant="caption">Enabled</Typography>
          </Stack>
          <Stack direction="row" spacing={0.75} alignItems="center">
            <Box sx={{ width: 8, height: 8, borderRadius: "999px", bgcolor: "#e5e7eb" }} />
            <Typography variant="caption">Disabled</Typography>
          </Stack>
        </Stack>
      </Box>

      {certification && certification.default_meeting_ready === false && (
        <Alert
          severity="info"
          icon={<LockIcon fontSize="inherit" />}
          sx={{ mb: 2, borderRadius: 2 }}
        >
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            Agent team status: {certification.team_label || "not production-real"}
          </Typography>
          <Typography variant="caption" sx={{ color: "#475569" }}>
            Some agents have not completed production-real certification. Their outputs are
            honestly labeled as estimates or unavailable instead of being presented as verified
            data — badges below show each agent's certification state.
          </Typography>
        </Alert>
      )}

      <Stack spacing={2}>
        {agents.map((agent) => {
          const displayName = resolveDisplayName(agent, websiteName);
          const scheduleText = formatSchedule(agent.profile?.schedule ?? agent.defaults?.schedule);
          const draft = drafts[agent.agent_key];
          const warnings = draft ? lintDraft(agent, draft) : [];
          const contextHint = buildAgentContextHint(agent.agent_key, contextSummary || {});
          const certBadge = getAgentCertificationBadge(agent.agent_key, certification);

          return (
            <Accordion
              key={agent.agent_key}
              disableGutters
              elevation={0}
              sx={{
                borderRadius: 2,
                border: "1px solid #e2e8f0",
                bgcolor: "#f9fafb",
                "&:before": { display: "none" },
                transition: "all 160ms ease",
                "&:hover": {
                  borderColor: "#4f46e5",
                  boxShadow: "0 8px 24px rgba(15,23,42,0.12)",
                  transform: "translateY(-1px)",
                },
                "&.Mui-expanded": {
                  borderColor: "#4f46e5",
                  boxShadow: "0 12px 30px rgba(15,23,42,0.16)",
                  bgcolor: "#ffffff",
                },
              }}
            >
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", gap: 2 }}>
                  <Box sx={{ minWidth: 0 }}>
                    <Typography
                      variant="subtitle1"
                      sx={{ fontWeight: 700, lineHeight: 1.2, color: "#0f172a" }}
                      noWrap
                    >
                      {displayName}
                    </Typography>
                    <Typography
                      variant="body2"
                      sx={{ color: "#64748b" }}
                      noWrap
                    >
                      {agent.role || agent.agent_key} • {scheduleText}
                    </Typography>
                    {contextHint && (
                      <Typography
                        variant="caption"
                        sx={{ display: "block", color: "#4f46e5", fontWeight: 500 }}
                        noWrap
                      >
                        {contextHint}
                      </Typography>
                    )}
                  </Box>
                  <Stack direction="row" spacing={1} sx={{ flexShrink: 0 }}>
                    {certBadge && (
                      <Tooltip title={certBadge.tooltip} arrow>
                        <Chip
                          size="small"
                          label={certBadge.label}
                          sx={{
                            fontWeight: 600,
                            bgcolor: certBadge.bgcolor,
                            color: certBadge.color,
                          }}
                        />
                      </Tooltip>
                    )}
                    <Tooltip title="System tools this agent can call while executing your strategy." arrow>
                      <Chip
                        size="small"
                        icon={<LockIcon />}
                        label="Tools locked"
                        variant="outlined"
                        sx={{
                          fontWeight: 500,
                          borderColor: "#cbd5e1",
                          bgcolor: "#e5edff",
                          color: "#1e293b",
                        }}
                      />
                    </Tooltip>
                    <Tooltip title="High-level responsibilities are predefined for safety and reliability." arrow>
                      <Chip
                        size="small"
                        icon={<LockIcon />}
                        label="Responsibilities locked"
                        variant="outlined"
                        sx={{
                          fontWeight: 500,
                          borderColor: "#cbd5e1",
                          bgcolor: "#e5edff",
                          color: "#1e293b",
                        }}
                      />
                    </Tooltip>
                  </Stack>
                </Box>
              </AccordionSummary>
              <AccordionDetails>
                <Stack spacing={2}>
                  <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
                    <Tooltip
                      title="Preview how this agent would respond using the current configuration."
                      arrow
                    >
                      <span>
                        <Button
                          size="small"
                          variant="outlined"
                          startIcon={<VisibilityIcon />}
                          disabled={previewBusyKey === agent.agent_key}
                          onClick={() => handlePreview(agent)}
                          sx={{
                            textTransform: "none",
                            borderColor: "#0f172a",
                            color: "#0f172a",
                            "&:hover": {
                              borderColor: "#111827",
                              background: "rgba(15,23,42,0.04)",
                            },
                          }}
                        >
                          Preview
                        </Button>
                      </span>
                    </Tooltip>
                    <Tooltip
                      title="Persist this agent's configuration for future sessions."
                      arrow
                    >
                      <span>
                        <Button
                          size="small"
                          variant="contained"
                          startIcon={<SaveIcon />}
                          disabled={!draft || savingKey === agent.agent_key}
                          onClick={() => handleSave(agent)}
                          sx={{
                            textTransform: "none",
                            background: "linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)",
                            boxShadow: "0 4px 12px rgba(79,70,229,0.35)",
                            "&:hover": {
                              background: "linear-gradient(135deg, #4338ca 0%, #6d28d9 100%)",
                              boxShadow: "0 6px 18px rgba(79,70,229,0.45)",
                            },
                          }}
                        >
                          Save
                        </Button>
                      </span>
                    </Tooltip>
                    <Tooltip
                      title="Revert this agent to its recommended default settings."
                      arrow
                    >
                      <span>
                        <Button
                          size="small"
                          variant="text"
                          startIcon={<RestartAltIcon />}
                          disabled={savingKey === agent.agent_key}
                          onClick={() => handleReset(agent)}
                          sx={{ textTransform: "none" }}
                        >
                          Reset
                        </Button>
                      </span>
                    </Tooltip>
                  </Box>

                  {warnings.length > 0 && (
                    <Alert severity="warning" sx={{ borderRadius: 2 }}>
                      <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.5 }}>
                        Suggestions to improve reliability
                      </Typography>
                      <Box component="ul" sx={{ pl: 2, m: 0 }}>
                        {warnings.map((w, idx) => (
                          <li key={idx}>
                            <Typography variant="body2">{w}</Typography>
                          </li>
                        ))}
                      </Box>
                    </Alert>
                  )}

                  <Box>
                    <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
                      Responsibilities
                    </Typography>
                    <Stack spacing={0.5}>
                      {(agent.responsibilities || []).map((r, idx) => (
                        <Typography key={idx} variant="body2">
                          • {r}
                        </Typography>
                      ))}
                    </Stack>
                  </Box>

                  <Divider />

                  <Box>
                    <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
                      Tools
                    </Typography>
                    <Stack direction="row" flexWrap="wrap" gap={1}>
                      {(agent.tools || []).map((t) => (
                        <Chip key={t} size="small" label={t} />
                      ))}
                    </Stack>
                  </Box>

                  <Divider />

                  {draft && (
                    <Box
                      sx={{
                        mt: 1,
                        p: 2.5,
                        borderRadius: 2,
                        border: "1px dashed #e5e7eb",
                        bgcolor: "#f9fafb",
                      }}
                    >
                      <Typography
                        variant="subtitle2"
                        sx={{
                          fontWeight: 700,
                          mb: 1.5,
                          display: "flex",
                          alignItems: "center",
                          gap: 0.75,
                        }}
                      >
                        <EditOutlinedIcon sx={{ fontSize: 18, color: "#4f46e5" }} />
                        Editable settings
                        <Typography
                          component="span"
                          variant="caption"
                          sx={{ ml: 0.75, color: "#6b7280" }}
                        >
                          Adjust how this agent behaves for your workspace.
                        </Typography>
                      </Typography>
                      <Stack spacing={2}>
                        <TextField
                          label="Display name"
                          value={draft.display_name}
                          onChange={(e) => setDraftField(agent.agent_key, { display_name: e.target.value })}
                          fullWidth
                          sx={{
                            "& .MuiOutlinedInput-root": {
                              bgcolor: "#ffffff",
                              "& fieldset": { borderColor: "#e5e7eb" },
                              "&:hover fieldset": { borderColor: "#4f46e5" },
                              "&.Mui-focused fieldset": {
                                borderColor: "#4f46e5",
                                boxShadow: "0 0 0 1px rgba(79,70,229,0.25)",
                              },
                            },
                          }}
                        />
                        <FormControlLabel
                          control={
                            <Switch
                              checked={draft.enabled}
                              onChange={(e) => setDraftField(agent.agent_key, { enabled: e.target.checked })}
                            />
                          }
                          label="Enabled"
                        />

                        <FormControl
                          fullWidth
                          sx={{
                            "& .MuiOutlinedInput-root": {
                              bgcolor: "#ffffff",
                              "& fieldset": { borderColor: "#e5e7eb" },
                              "&:hover fieldset": { borderColor: "#4f46e5" },
                              "&.Mui-focused fieldset": {
                                borderColor: "#4f46e5",
                                boxShadow: "0 0 0 1px rgba(79,70,229,0.25)",
                              },
                            },
                          }}
                        >
                          <InputLabel>Schedule</InputLabel>
                          <Select
                            label="Schedule"
                            value={SCHEDULE_MODES.has(draft.schedule?.mode) ? draft.schedule?.mode : "on_demand"}
                            onChange={(e) => setDraftField(agent.agent_key, { schedule: { ...(draft.schedule || {}), mode: e.target.value } })}
                          >
                            <MenuItem value="on_demand">On-demand</MenuItem>
                            <MenuItem value="weekly">Weekly</MenuItem>
                            <MenuItem value="daily">Daily</MenuItem>
                          </Select>
                        </FormControl>

                        {draft.schedule?.mode === "weekly" && (
                          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                            <TextField
                              label="Days (comma separated)"
                              value={Array.isArray(draft.schedule?.days) ? draft.schedule.days.join(", ") : ""}
                              onChange={(e) =>
                                setDraftField(agent.agent_key, {
                                  schedule: {
                                    ...(draft.schedule || {}),
                                    days: e.target.value
                                      .split(",")
                                      .map((d) => d.trim())
                                      .filter(Boolean),
                                  },
                                })
                              }
                              fullWidth
                              sx={{
                                "& .MuiOutlinedInput-root": {
                                  bgcolor: "#ffffff",
                                  "& fieldset": { borderColor: "#e5e7eb" },
                                  "&:hover fieldset": { borderColor: "#4f46e5" },
                                  "&.Mui-focused fieldset": {
                                    borderColor: "#4f46e5",
                                    boxShadow: "0 0 0 1px rgba(79,70,229,0.25)",
                                  },
                                },
                              }}
                            />
                            <TextField
                              label="Time (HH:MM)"
                              value={draft.schedule?.time || ""}
                              onChange={(e) => setDraftField(agent.agent_key, { schedule: { ...(draft.schedule || {}), time: e.target.value } })}
                              fullWidth
                              sx={{
                                "& .MuiOutlinedInput-root": {
                                  bgcolor: "#ffffff",
                                  "& fieldset": { borderColor: "#e5e7eb" },
                                  "&:hover fieldset": { borderColor: "#4f46e5" },
                                  "&.Mui-focused fieldset": {
                                    borderColor: "#4f46e5",
                                    boxShadow: "0 0 0 1px rgba(79,70,229,0.25)",
                                  },
                                },
                              }}
                            />
                          </Stack>
                        )}

                        {draft.schedule?.mode === "daily" && (
                          <TextField
                            label="Time (HH:MM)"
                            value={draft.schedule?.time || ""}
                            onChange={(e) => setDraftField(agent.agent_key, { schedule: { ...(draft.schedule || {}), time: e.target.value } })}
                            fullWidth
                            sx={{
                              "& .MuiOutlinedInput-root": {
                                bgcolor: "#ffffff",
                                "& fieldset": { borderColor: "#e5e7eb" },
                                "&:hover fieldset": { borderColor: "#4f46e5" },
                                "&.Mui-focused fieldset": {
                                  borderColor: "#4f46e5",
                                  boxShadow: "0 0 0 1px rgba(79,70,229,0.25)",
                                },
                              },
                            }}
                          />
                        )}

                        <TextField
                          label="System prompt"
                          value={draft.system_prompt}
                          onChange={(e) => setDraftField(agent.agent_key, { system_prompt: e.target.value })}
                          multiline
                          minRows={6}
                          fullWidth
                          sx={{
                            "& .MuiOutlinedInput-root": {
                              bgcolor: "#ffffff",
                              "& fieldset": { borderColor: "#e5e7eb" },
                              "&:hover fieldset": { borderColor: "#4f46e5" },
                              "&.Mui-focused fieldset": {
                                borderColor: "#4f46e5",
                                boxShadow: "0 0 0 1px rgba(79,70,229,0.25)",
                              },
                            },
                          }}
                        />
                        <TextField
                          label="Task prompt template"
                          value={draft.task_prompt_template}
                          onChange={(e) => setDraftField(agent.agent_key, { task_prompt_template: e.target.value })}
                          multiline
                          minRows={6}
                          fullWidth
                          sx={{
                            "& .MuiOutlinedInput-root": {
                              bgcolor: "#ffffff",
                              "& fieldset": { borderColor: "#e5e7eb" },
                              "&:hover fieldset": { borderColor: "#4f46e5" },
                              "&.Mui-focused fieldset": {
                                borderColor: "#4f46e5",
                                boxShadow: "0 0 0 1px rgba(79,70,229,0.25)",
                              },
                            },
                          }}
                        />
                      </Stack>
                    </Box>
                  )}
                </Stack>
              </AccordionDetails>
            </Accordion>
          );
        })}
      </Stack>

      <Dialog open={previewOpen} onClose={() => setPreviewOpen(false)} fullWidth maxWidth="md">
        <DialogTitle>Preview: {previewTitle}</DialogTitle>
        <DialogContent dividers>
          <Typography variant="body2" sx={{ whiteSpace: "pre-wrap" }}>
            {typeof previewData === "string" ? previewData : JSON.stringify(previewData, null, 2)}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPreviewOpen(false)} sx={{ textTransform: "none" }}>
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
};

export default AgentTeamSection;
