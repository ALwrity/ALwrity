/**
 * Collapsible pitch prompt preview from POST /plan/pitch/preview.
 * Uses the same Python builder as Generate Pitch. No live Exa.
 */

import React, { useEffect, useState } from "react";
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
import { youtubeApi } from "../../../services/youtubeApi";
import { resolveYoutubeContentLanguageCode, type DurationType, type VideoType } from "../constants";
import { helperSx } from "../styles";
import { youtubeHandlerErrorMessage } from "../utils/youtubeHandlerError";

interface PlanPromptPreviewProps {
  userIdea: string;
  durationType: DurationType;
  videoType?: VideoType;
  targetAudience?: string;
  videoGoal?: string;
  brandStyle?: string;
  language?: string;
  enableResearch: boolean;
  creativeAngle: string;
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
  creativeAngle,
}) => {
  const [expanded, setExpanded] = useState(false);
  const [systemPrompt, setSystemPrompt] = useState("");
  const [userPrompt, setUserPrompt] = useState("");
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  const idea = userIdea.trim();
  const angle = creativeAngle.trim();
  const canPreview = Boolean(idea && angle && durationType);

  useEffect(() => {
    if (!expanded) {
      return;
    }
    if (!canPreview) {
      console.info("[PlanPromptPreview] Preview skipped; idea or angle missing", {
        hasIdea: Boolean(idea),
        hasAngle: Boolean(angle),
        durationType,
      });
      return;
    }

    let cancelled = false;
    const timer = window.setTimeout(() => {
      void (async () => {
        setLoadingPreview(true);
        setPreviewError(null);
        const contentLanguage = resolveYoutubeContentLanguageCode(language);
        try {
          console.info("[PlanPromptPreview] Fetching pitch prompt preview", {
            durationType,
            language: contentLanguage,
            enableResearch,
            ideaLen: idea.length,
            angleLen: angle.length,
          });
          const response = await youtubeApi.previewPitchPrompt({
            user_idea: idea,
            duration_type: durationType,
            video_type: videoType || undefined,
            target_audience: targetAudience || undefined,
            video_goal: videoGoal || undefined,
            brand_style: brandStyle || undefined,
            enable_research: enableResearch,
            language: contentLanguage,
            creative_angle: angle,
          });
          if (cancelled) {
            return;
          }
          if (!response.success || !response.system_prompt?.trim() || !response.user_prompt?.trim()) {
            console.warn("[PlanPromptPreview] Preview returned success=false", {
              language: contentLanguage,
              success: Boolean(response.success),
              messageLen: (response.message || "").length,
              systemLen: (response.system_prompt || "").length,
              userLen: (response.user_prompt || "").length,
            });
            setPreviewError(response.message || "Failed to load the pitch prompt preview.");
            setSystemPrompt("");
            setUserPrompt("");
            return;
          }
          setSystemPrompt(response.system_prompt);
          setUserPrompt(response.user_prompt);
          console.info("[PlanPromptPreview] Pitch prompt preview loaded", {
            language: contentLanguage,
            systemLen: response.system_prompt.length,
            userLen: response.user_prompt.length,
            hasResearchPlaceholder: response.user_prompt.includes("{{EXA_RESEARCH}}"),
          });
        } catch (error: unknown) {
          if (cancelled) {
            return;
          }
          console.error("[PlanPromptPreview] Failed to load pitch prompt preview", {
            language: contentLanguage,
            durationType,
            error: youtubeHandlerErrorMessage(error, "Failed to load the pitch prompt preview."),
          });
          setPreviewError(
            youtubeHandlerErrorMessage(error, "Failed to load the pitch prompt preview."),
          );
          setSystemPrompt("");
          setUserPrompt("");
        } finally {
          if (!cancelled) {
            setLoadingPreview(false);
          }
        }
      })();
    }, 400);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [
    expanded,
    canPreview,
    idea,
    angle,
    durationType,
    videoType,
    targetAudience,
    videoGoal,
    brandStyle,
    language,
    enableResearch,
  ]);

  return (
    <Accordion
      disableGutters
      elevation={0}
      expanded={expanded}
      onChange={(_event, nextExpanded) => {
        try {
          setExpanded(nextExpanded);
        } catch (error: unknown) {
          console.error("[PlanPromptPreview] Accordion toggle failed", {
            error: youtubeHandlerErrorMessage(error, "Could not toggle prompt preview."),
          });
        }
      }}
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
            Same pitch builder as Generate Pitch. Live Exa is added only when you generate.
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
          {!canPreview ? (
            <Typography variant="caption" sx={helperSx}>
              Enter a video idea and creative angle to preview the exact pitch prompt.
            </Typography>
          ) : null}
          {loadingPreview ? (
            <Typography variant="caption" sx={{ color: "#6b7280" }}>
              Loading pitch prompt preview…
            </Typography>
          ) : null}
          {previewError ? (
            <Typography variant="caption" sx={{ color: "#b91c1c" }}>
              {previewError}
            </Typography>
          ) : null}
          {systemPrompt ? (
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
                {systemPrompt}
              </Box>
            </Box>
          ) : null}
          {userPrompt ? (
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
                {userPrompt}
              </Box>
            </Box>
          ) : null}
          <Typography variant="caption" sx={helperSx}>
            This is not the final payload until you generate. Do not treat the
            placeholder as live research.
          </Typography>
        </Stack>
      </AccordionDetails>
    </Accordion>
  );
};
