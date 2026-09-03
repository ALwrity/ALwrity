import React from "react";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Chip,
  Divider,
  Stack,
  Tooltip,
  Typography,
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import SearchIcon from "@mui/icons-material/Search";
import type {
  AgentEvidenceEntry,
  PlanTransparency as PlanTransparencyData,
  ProposalReviewSummary,
  SifQueryProvenance,
} from "../../../../api/onboarding";

const AGENT_LABELS: Record<string, string> = {
  content_strategist: "Content Strategist",
  strategy_architect: "Strategy Architect",
  seo_specialist: "SEO Specialist",
  social_media_manager: "Social Media Manager",
  competitor_analyst: "Competitor Analyst",
  content_gap_radar: "Content Gap Radar",
};

const CHECK_LABELS: Record<string, string> = {
  onboarding: "Onboarding data",
  providers: "Integrations",
  freshness: "Data freshness",
  recent_tasks: "Recent task history",
  pending_approvals: "Pending approvals",
  active_campaigns: "Active campaigns",
  calendar_conflicts: "Calendar conflicts",
  agent_health: "Agent health",
};

function statusIcon(status?: string) {
  const s = (status || "").toLowerCase();
  if (s === "available") return <CheckCircleIcon sx={{ fontSize: 16, color: "success.main" }} />;
  if (s === "error" || s === "provider_errors") return <ErrorOutlineIcon sx={{ fontSize: 16, color: "error.main" }} />;
  return <InfoOutlinedIcon sx={{ fontSize: 16, color: "info.main" }} />;
}

function outcomeChip(outcome?: string) {
  const s = (outcome || "").toLowerCase();
  if (s === "success") return <Chip size="small" label="success" color="success" variant="outlined" />;
  if (s === "miss_healed") return <Chip size="small" label="empty → index self-healed" color="warning" variant="outlined" />;
  if (s === "miss") return <Chip size="small" label="no results" color="warning" variant="outlined" />;
  if (s === "error") return <Chip size="small" label="search failed" color="error" variant="outlined" />;
  return <Chip size="small" label={s || "unknown"} variant="outlined" />;
}

export const SifQueryList: React.FC<{ queries?: SifQueryProvenance[] }> = ({ queries }) => {
  if (!queries?.length) return null;
  return (
    <Stack spacing={0.75} sx={{ mt: 0.5 }}>
      {queries.map((q, i) => (
        <Box key={i} sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
          <SearchIcon sx={{ fontSize: 14, opacity: 0.7 }} />
          <Typography variant="caption" sx={{ fontFamily: "monospace" }}>
            “{q.query}”
          </Typography>
          {typeof q.result_count === "number" && (
            <Typography variant="caption" sx={{ opacity: 0.7 }}>
              → {q.result_count} result{q.result_count === 1 ? "" : "s"}
            </Typography>
          )}
          {outcomeChip(q.outcome)}
        </Box>
      ))}
    </Stack>
  );
};

const ReviewSummary: React.FC<{ summary?: ProposalReviewSummary }> = ({ summary }) => {
  if (!summary?.counts) return null;
  const { counts, flagged } = summary;
  return (
    <Box>
      <Stack direction="row" spacing={0.75} sx={{ flexWrap: "wrap", gap: 0.75, mb: flagged?.length ? 1 : 0 }}>
        <Chip size="small" label={`${counts.accepted} accepted`} color="success" variant="outlined" />
        {counts.merged > 0 && <Chip size="small" label={`${counts.merged} merged`} variant="outlined" />}
        {counts.deferred > 0 && <Chip size="small" label={`${counts.deferred} deferred`} variant="outlined" />}
        {counts.rejected > 0 && <Chip size="small" label={`${counts.rejected} rejected`} color="warning" variant="outlined" />}
        {counts.quarantined > 0 && <Chip size="small" label={`${counts.quarantined} quarantined`} color="error" variant="outlined" />}
      </Stack>
      {(flagged || []).map((item, i) => (
        <Typography key={i} variant="caption" component="div" sx={{ opacity: 0.8 }}>
          • {item.title || "proposal"} ({item.agent || "unknown agent"}): {(item.reasons || []).join("; ")}
        </Typography>
      ))}
    </Box>
  );
};

export const PlanTransparencyPanel: React.FC<{
  data?: PlanTransparencyData | null;
  evidenceByAgent?: Record<string, AgentEvidenceEntry>;
  variant?: "modal" | "inline";
}> = ({ data, evidenceByAgent, variant }) => {
  if (!data) return null;
  const checks = data.meeting_preflight?.checks || {};
  const checkEntries = Object.entries(CHECK_LABELS)
    .map(([key, label]) => ({ key, label, check: checks[key] }))
    .filter((entry) => entry.check);

  return (
    <Accordion
      disableGutters
      elevation={0}
      sx={{
        bgcolor: variant === "inline" ? "rgba(255,255,255,0.06)" : "background.default",
        border: "1px solid",
        borderColor: variant === "inline" ? "rgba(255,255,255,0.15)" : "divider",
        borderRadius: 2,
        mb: 2,
        "&:before": { display: "none" },
      }}
    >
      <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ minHeight: 44 }}>
        <Stack direction="row" spacing={1} alignItems="center">
          <InfoOutlinedIcon fontSize="small" />
          <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
            Why this plan? — data, sources & quality
          </Typography>
        </Stack>
      </AccordionSummary>
      <AccordionDetails sx={{ pt: 0 }}>
        {/* Data-quality strip */}
        {checkEntries.length > 0 && (
          <Box sx={{ mb: 1.5 }}>
            <Typography variant="caption" sx={{ fontWeight: 700, opacity: 0.8 }}>
              Data quality at generation time
            </Typography>
            <Stack spacing={0.5} sx={{ mt: 0.5 }}>
              {checkEntries.map(({ key, label, check }) => (
                <Stack key={key} direction="row" spacing={0.75} alignItems="center">
                  {statusIcon(check?.status)}
                  <Typography variant="caption" sx={{ fontWeight: 600 }}>
                    {label}
                    {check?.status ? ` — ${String(check.status)}` : ""}
                  </Typography>
                  {check?.message ? (
                    <Typography variant="caption" sx={{ opacity: 0.75 }} noWrap>
                      {check.message}
                    </Typography>
                  ) : null}
                </Stack>
              ))}
            </Stack>
          </Box>
        )}

        {/* Limitations */}
        {(data.limitations || []).length > 0 && (
          <Box sx={{ mb: 1.5 }}>
            <Typography variant="caption" sx={{ fontWeight: 700, opacity: 0.8 }}>
              Limitations this run
            </Typography>
            {(data.limitations || []).map((item, i) => (
              <Typography key={i} variant="caption" component="div" sx={{ opacity: 0.8 }}>
                • {item}
              </Typography>
            ))}
          </Box>
        )}

        {/* Guardian + quality */}
        <Stack direction="row" spacing={0.75} sx={{ flexWrap: "wrap", gap: 0.75, mb: 1.5 }}>
          {typeof data.guardian_health === "number" && (
            <Tooltip title="Content Guardian's audit health score for this plan">
              <Chip size="small" label={`Guardian health: ${data.guardian_health}/100`} variant="outlined" />
            </Tooltip>
          )}
          {data.quality_status && (
            <Chip size="small" label={`Quality: ${data.quality_status}`} variant="outlined" />
          )}
          {data.contextuality_validation?.is_contextual === false && (
            <Chip size="small" label="low contextuality" color="warning" variant="outlined" />
          )}
        </Stack>

        {/* Review summary */}
        {data.proposal_review_summary?.counts && (
          <Box sx={{ mb: 1.5 }}>
            <Typography variant="caption" sx={{ fontWeight: 700, opacity: 0.8 }}>
              Proposal review outcome
            </Typography>
            <Box sx={{ mt: 0.5 }}>
              <ReviewSummary summary={data.proposal_review_summary} />
            </Box>
          </Box>
        )}

        {/* Per-agent evidence + SIF queries */}
        {(data.agent_evidence || []).filter((ev) => ev.analysis || ev.sif_queries?.length).length > 0 && (
          <Box>
            <Typography variant="caption" sx={{ fontWeight: 700, opacity: 0.8 }}>
              Agent analyses & SIF searches
            </Typography>
            {(data.agent_evidence || [])
              .filter((ev) => ev.analysis || ev.sif_queries?.length)
              .map((ev, i) => (
                <Box key={i} sx={{ mt: 0.75 }}>
                  <Typography variant="caption" sx={{ fontWeight: 600 }}>
                    {AGENT_LABELS[ev.agent] || ev.agent}
                    {typeof ev.confidence === "number" && ev.confidence > 0 && ` (confidence ${(ev.confidence * 100).toFixed(0)}%)`}
                  </Typography>
                  {ev.analysis && (
                    <Typography variant="caption" component="div" sx={{ opacity: 0.8 }}>
                      {ev.analysis}
                    </Typography>
                  )}
                  <SifQueryList queries={ev.sif_queries} />
                </Box>
              ))}
            {evidenceByAgent && Object.keys(evidenceByAgent).length === 0 && <Divider sx={{ my: 0.5 }} />}
          </Box>
        )}
      </AccordionDetails>
    </Accordion>
  );
};

export default PlanTransparencyPanel;
