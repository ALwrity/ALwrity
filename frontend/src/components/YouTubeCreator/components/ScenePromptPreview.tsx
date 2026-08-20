/**
 * Collapsible template of the scene-build prompt before Build Scenes.
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
import type { VideoPlan } from "../../../services/youtubeApi";
import { buildScenePromptPreview } from "../utils/buildScenePromptPreview";
import { helperSx } from "../styles";

interface ScenePromptPreviewProps {
  plan: VideoPlan;
}

export const ScenePromptPreview: React.FC<ScenePromptPreviewProps> = ({ plan }) => {
  let preview = {
    systemPrompt: "",
    userPromptTemplate: "Prompt preview is unavailable.",
  };
  try {
    preview = buildScenePromptPreview(plan);
  } catch (error) {
    console.error("[ScenePromptPreview] Failed to build prompt template", error);
  }

  return (
    <Accordion
      disableGutters
      elevation={0}
      sx={{
        border: "1px solid #e5e7eb",
        borderRadius: "8px !important",
        "&:before": { display: "none" },
        mb: 2,
      }}
    >
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Stack spacing={0.5}>
          <Typography sx={{ fontWeight: 600, color: "#111827", fontSize: "0.9375rem" }}>
            Prompt that will be sent to build scenes
          </Typography>
          <Typography variant="caption" sx={{ color: "#6b7280" }}>
            Built from your plan. The server sends this when you click Build Scenes from Plan.
          </Typography>
        </Stack>
      </AccordionSummary>
      <AccordionDetails>
        <Stack spacing={1.5}>
          <Chip
            size="small"
            label="Text LLM: shared llm_text_gen (same as Plan / Podcast)"
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
              User prompt
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
              {preview.userPromptTemplate}
            </Box>
          </Box>
          <Typography variant="caption" sx={helperSx}>
            This is the template from your current plan. After you build scenes, the exact
            payload returned by the server is shown below.
          </Typography>
        </Stack>
      </AccordionDetails>
    </Accordion>
  );
};
