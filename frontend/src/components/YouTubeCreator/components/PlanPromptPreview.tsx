/**
 * Collapsible template of the plan prompt before generate (no live Exa).
 */

import React from "react";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Chip,
  Stack,
  Typography,
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import type { YouTubeChannelBible } from "../../../services/youtubeApi";
import { buildPlanPromptPreview, PLANNER_SYSTEM_PROMPT_PREVIEW } from "../utils/buildPlanPromptPreview";
import { helperSx } from "../styles";

interface PlanPromptPreviewProps {
  userIdea: string;
  durationType: string;
  videoType?: string;
  targetAudience?: string;
  videoGoal?: string;
  brandStyle?: string;
  language?: string;
  enableResearch: boolean;
  channelBible?: YouTubeChannelBible | null;
}

export const PlanPromptPreview: React.FC<PlanPromptPreviewProps> = ({
  userIdea,
  durationType,
  videoType,
  targetAudience,
  videoGoal,
  brandStyle,
  language,
  enableResearch,
  channelBible,
}) => {
  let preview = {
    systemPrompt: PLANNER_SYSTEM_PROMPT_PREVIEW,
    userPromptTemplate: "Prompt preview is unavailable. You can still generate a plan.",
  };
  try {
    preview = buildPlanPromptPreview({
      userIdea,
      durationType,
      videoType,
      targetAudience,
      videoGoal,
      brandStyle,
      language,
      enableResearch,
      channelBible,
    });
  } catch (error) {
    console.error("[PlanPromptPreview] Failed to build prompt template", error);
  }

  return (
    <Accordion
      disableGutters
      elevation={0}
      sx={{
        border: "1px solid #e5e7eb",
        borderRadius: "8px !important",
        "&:before": { display: "none" },
      }}
    >
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Stack spacing={0.5}>
          <Typography sx={{ fontWeight: 600, color: "#111827", fontSize: "0.9375rem" }}>
            Prompt that will be sent
          </Typography>
          <Typography variant="caption" sx={{ color: "#6b7280" }}>
            Template from this form. Live Exa text and persona are added on the server.
          </Typography>
        </Stack>
      </AccordionSummary>
      <AccordionDetails>
        <Stack spacing={1.5}>
          <Chip
            size="small"
            label="Text LLM: shared llm_text_gen (same as LinkedIn / Podcast)"
            sx={{ alignSelf: "flex-start", bgcolor: "#f3f4f6" }}
          />
          <Box>
            <Typography variant="caption" sx={{ fontWeight: 600, color: "#6b7280" }}>
              System prompt
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
              }}
            >
              {preview.systemPrompt}
            </Box>
          </Box>
          <Box>
            <Typography variant="caption" sx={{ fontWeight: 600, color: "#6b7280" }}>
              User prompt template
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
                maxHeight: 320,
                overflow: "auto",
              }}
            >
              {preview.userPromptTemplate}
            </Box>
          </Box>
          <Typography variant="caption" sx={helperSx}>
            This is not the final payload until you generate. Do not treat the
            placeholder as live research.
          </Typography>
        </Stack>
      </AccordionDetails>
    </Accordion>
  );
};
