/**
 * After-generate: exact prompt sent to llm_text_gen, plus research sources.
 */

import React, { useCallback, useState } from "react";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Box,
  Button,
  Chip,
  Link,
  Stack,
  Typography,
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import type { VideoPlan, VideoPlanGeneration, VideoPlanResearchSource } from "../../../services/youtubeApi";

interface PlanGenerationMetaProps {
  plan: VideoPlan;
}

function PromptBlock({ label, text }: { label: string; text: string }) {
  return (
    <Box>
      <Typography variant="caption" sx={{ fontWeight: 600, color: "#6b7280" }}>
        {label}
      </Typography>
      <Box
        component="pre"
        sx={{
          mt: 0.5,
          p: 1.5,
          bgcolor: "#f8fafc",
          borderRadius: 1,
          whiteSpace: "pre-wrap",
          fontSize: "0.8125rem",
          color: "#374151",
          fontFamily: "inherit",
          m: 0,
          maxHeight: 360,
          overflow: "auto",
        }}
      >
        {text || "(empty)"}
      </Box>
    </Box>
  );
}

export const PlanGenerationMeta: React.FC<PlanGenerationMetaProps> = ({ plan }) => {
  const generation: VideoPlanGeneration | undefined = plan.generation;
  const sources: VideoPlanResearchSource[] = plan.research_sources || [];
  const [copyMessage, setCopyMessage] = useState<string | null>(null);

  const handleCopy = useCallback(async () => {
    if (!generation) {
      console.warn("[PlanGenerationMeta] Copy skipped: no generation metadata");
      return;
    }
    const payload = [
      "SYSTEM PROMPT",
      generation.system_prompt || "",
      "",
      "USER PROMPT",
      generation.user_prompt || "",
    ].join("\n");
    try {
      if (!navigator?.clipboard?.writeText) {
        throw new Error("Clipboard API unavailable");
      }
      await navigator.clipboard.writeText(payload);
      setCopyMessage("Copied exact prompt");
      console.info("[PlanGenerationMeta] Copied exact prompt", {
        promptLen: payload.length,
      });
    } catch (error) {
      console.error("[PlanGenerationMeta] Copy failed", error);
      setCopyMessage("Could not copy. Select the text instead.");
    }
  }, [generation]);

  if (!generation && sources.length === 0 && plan.research_enabled == null) {
    return null;
  }

  const injected = Boolean(generation?.research_injected);
  const researchOn = generation?.research_enabled ?? plan.research_enabled ?? false;

  return (
    <Accordion
      defaultExpanded
      disableGutters
      elevation={0}
      sx={{
        border: "1px solid #e5e7eb",
        borderRadius: "8px !important",
        "&:before": { display: "none" },
      }}
    >
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Typography sx={{ fontWeight: 600, color: "#111827", fontSize: "0.9375rem" }}>
          Exact prompt sent to the LLM
        </Typography>
      </AccordionSummary>
      <AccordionDetails>
        <Stack spacing={1.5}>
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            <Chip
              size="small"
              label={`Gateway: ${generation?.text_gateway || "llm_text_gen"}`}
            />
            {generation?.configured_provider ? (
              <Chip size="small" label={`Provider: ${generation.configured_provider}`} />
            ) : null}
            <Chip
              size="small"
              color={injected ? "success" : "default"}
              label={
                injected
                  ? "Research injected"
                  : researchOn
                    ? "Research skipped or empty"
                    : "Research off"
              }
            />
            {generation?.json_schema_applied ? (
              <Chip size="small" label="Structured JSON schema applied" />
            ) : null}
          </Stack>

          {!generation ? (
            <Alert severity="info">
              This saved plan has no stored prompt. Generate a new plan to see the exact
              text sent to the LLM.
            </Alert>
          ) : (
            <>
              <PromptBlock label="System prompt" text={generation.system_prompt || ""} />
              <PromptBlock label="User prompt (includes Exa if injected)" text={generation.user_prompt || ""} />
              <Button variant="outlined" size="small" onClick={handleCopy} sx={{ alignSelf: "flex-start", textTransform: "none" }}>
                Copy exact prompt
              </Button>
              {copyMessage ? (
                <Typography variant="caption" sx={{ color: "#6b7280" }}>
                  {copyMessage}
                </Typography>
              ) : null}
            </>
          )}

          {sources.length > 0 ? (
            <Box>
              <Typography variant="caption" sx={{ fontWeight: 600, color: "#6b7280" }}>
                Research sources ({sources.length})
              </Typography>
              <Stack component="ul" spacing={0.5} sx={{ pl: 2.5, mt: 0.5, mb: 0 }}>
                {sources.map((source, index) => (
                  <Typography key={`${source.url}-${index}`} component="li" variant="body2" sx={{ color: "#374151" }}>
                    {source.url ? (
                      <Link href={source.url} target="_blank" rel="noopener noreferrer">
                        {source.title || source.url}
                      </Link>
                    ) : (
                      source.title || "Untitled source"
                    )}
                  </Typography>
                ))}
              </Stack>
            </Box>
          ) : null}
        </Stack>
      </AccordionDetails>
    </Accordion>
  );
};
