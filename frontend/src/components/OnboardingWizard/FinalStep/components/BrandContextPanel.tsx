import React from "react";
import { Box, Typography, Chip, Stack } from "@mui/material";
import InsightsIcon from "@mui/icons-material/Insights";
import type { AgentTeamContextSummary } from "../../../../api/agentsTeam";

type Props = {
  websiteName: string;
  context: AgentTeamContextSummary;
};

type Field = { label: string; value: string | null };
type StepGroup = { step: string; fields: Field[] };

function asText(value: any): string | null {
  if (value == null) return null;
  if (Array.isArray(value)) {
    const flat = value.filter((v) => v && String(v).trim());
    return flat.length ? flat.join(", ") : null;
  }
  const s = String(value).trim();
  return s.length ? s : null;
}

function buildGroups(context: AgentTeamContextSummary): StepGroup[] {
  const groups: StepGroup[] = [
    {
      step: "1 · Connect",
      fields: [
        { label: "Website", value: asText(context.website_url || context.website_name) },
      ],
    },
    {
      step: "2 · Research",
      fields: [
        { label: "Industry", value: asText(context.industry) },
        { label: "Audience", value: asText(context.target_audience) },
        { label: "Research depth", value: asText(context.research_depth) },
        { label: "Content types", value: asText(context.content_types) },
        { label: "Competitors", value: asText(context.competitors) },
      ],
    },
    {
      step: "3 · Personalization",
      fields: [
        { label: "Brand voice", value: asText(context.brand_voice) },
        { label: "Pillars", value: asText(context.content_pillars) },
        { label: "Business goals", value: asText(context.business_goals) },
        { label: "Platforms", value: asText(context.connected_platforms) },
        { label: "Cadence", value: asText(context.posting_cadence) },
      ],
    },
  ];
  return groups
    .map((g) => ({ ...g, fields: g.fields.filter((f) => f.value) }))
    .filter((g) => g.fields.length > 0);
}

export const BrandContextPanel: React.FC<Props> = ({ websiteName, context }) => {
  const groups = buildGroups(context);

  return (
    <Box sx={{ mt: 2.5, pt: 2, borderTop: "1px solid rgba(255, 255, 255, 0.15)" }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1.5 }}>
        <InsightsIcon sx={{ color: "#a5b4fc", fontSize: 18 }} />
        <Typography variant="subtitle2" sx={{ fontWeight: 700, color: "#e5e7eb" }}>
          What your team knows about {websiteName || "your brand"}
        </Typography>
      </Box>

      {groups.length === 0 ? (
        <Typography variant="body2" sx={{ color: "#cbd5e1" }}>
          Complete onboarding to give your agents richer brand context.
        </Typography>
      ) : (
        <Stack spacing={1.5}>
          {groups.map((group) => (
            <Box key={group.step}>
              <Typography
                variant="caption"
                sx={{
                  display: "block",
                  mb: 0.5,
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: 0.5,
                  color: "#a5b4fc !important",
                }}
              >
                Step {group.step}
              </Typography>
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                {group.fields.map((field) => (
                  <Chip
                    key={field.label}
                    size="small"
                    label={`${field.label}: ${field.value}`}
                    sx={{
                      height: "auto",
                      py: 0.5,
                      "& .MuiChip-label": { whiteSpace: "normal" },
                      bgcolor: "rgba(255, 255, 255, 0.1)",
                      border: "1px solid rgba(255, 255, 255, 0.2)",
                      color: "#e5e7eb",
                    }}
                  />
                ))}
              </Stack>
            </Box>
          ))}
        </Stack>
      )}
    </Box>
  );
};

export default BrandContextPanel;
