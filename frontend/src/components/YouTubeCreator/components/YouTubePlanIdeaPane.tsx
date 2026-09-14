/**
 * Plan Your Video idea canvas — topic, mic, Enhance Topic with AI, Brainstorm, Blog/URL.
 */

import React, { useState } from "react";
import {
  Box,
  Button,
  CircularProgress,
  IconButton,
  InputLabel,
  TextField,
  Tooltip,
} from "@mui/material";
import AutoAwesome from "@mui/icons-material/AutoAwesome";
import InfoOutlined from "@mui/icons-material/InfoOutlined";
import MicIcon from "@mui/icons-material/Mic";
import StopIcon from "@mui/icons-material/Stop";
import type { DurationType, YouTubeContentLanguage } from "../constants";
import { helperSx, inputSx, labelSx, tooltipPopperProps, tooltipSx } from "../styles";
import { youtubeApi } from "../../../services/youtubeApi";
import { useYouTubePlanSpeechInput } from "../hooks/useYouTubePlanSpeechInput";
import { PlanDiscoveryShortcuts } from "./PlanDiscoveryShortcuts";
import { YouTubePlanEnhanceChoicesModal } from "./YouTubePlanEnhanceChoicesModal";
import { YouTubePlanIdeaEnhanceProgressPanel } from "./YouTubePlanIdeaEnhanceProgressPanel";
import { YouTubePlanPaneCard } from "./YouTubePlanPaneCard";

export interface YouTubePlanIdeaPaneProps {
  userIdea: string;
  loading: boolean;
  language?: YouTubeContentLanguage;
  durationType?: DurationType;
  onIdeaChange: (idea: string) => void;
}

export const YouTubePlanIdeaPane: React.FC<YouTubePlanIdeaPaneProps> = ({
  userIdea,
  loading,
  language = "en",
  durationType = "medium",
  onIdeaChange,
}) => {
  const speech = useYouTubePlanSpeechInput(language);
  const [enhancing, setEnhancing] = useState(false);
  const [enhanceError, setEnhanceError] = useState<string | null>(null);
  const [choices, setChoices] = useState<string[]>([]);
  const [rationales, setRationales] = useState<string[]>([]);
  const [choicesOpen, setChoicesOpen] = useState(false);

  const ideaReady = userIdea.trim().length > 0;
  const busy = loading || enhancing || speech.isListening;
  const helperText =
    speech.error ||
    enhanceError ||
    "Describe the topic in 1–2 sentences. Who it is for and your goal are chosen below.";
  const helperIsError = Boolean(speech.error || enhanceError);

  const handleMicClick = () => {
    try {
      if (speech.isListening) {
        speech.stopListening();
        return;
      }
      speech.startListening(userIdea, onIdeaChange);
    } catch (error) {
      console.error("[YouTubePlan] Microphone toggle failed", error);
    }
  };

  const handleEnhance = async () => {
    if (!ideaReady || busy) {
      return;
    }
    setEnhanceError(null);
    setEnhancing(true);
    try {
      console.info("[YouTubePlan] Enhance topic started", {
        ideaLen: userIdea.trim().length,
        durationType,
        language,
      });
      const result = await youtubeApi.enhancePlanIdea({
        user_idea: userIdea.trim(),
        duration_type: durationType,
        language,
      });
      setChoices(result.enhanced_ideas);
      setRationales(result.rationales);
      setChoicesOpen(true);
    } catch (error) {
      const message =
        error instanceof Error && error.message
          ? error.message
          : "Could not enhance this topic. Please try again.";
      console.error("[YouTubePlan] Enhance topic UI failed", {
        durationType,
        language,
        messageLen: message.length,
      });
      setEnhanceError(
        /could not enhance/i.test(message) ? message : `Could not enhance this topic. ${message}`,
      );
    } finally {
      setEnhancing(false);
    }
  };

  return (
    <YouTubePlanPaneCard
      step={1}
      title="Your idea"
      subtitle="Topic first. Brainstorm or Blog/URL if you need a prompt."
      ariaLabel="Your idea"
    >
      <Box>
        <Box sx={{ display: "flex", alignItems: "center", mb: 0.5 }}>
          <InputLabel sx={labelSx} required>
            What&apos;s your video about?
          </InputLabel>
          <Tooltip
            title="Name the topic in plain language. Audience, goal, and style are separate fields below."
            arrow
            sx={tooltipSx}
            PopperProps={tooltipPopperProps}
          >
            <IconButton size="small" sx={{ ml: 0.5, p: 0.25, color: "#64748b" }}>
              <InfoOutlined fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
        <Box className="yt-plan-idea-field">
          <TextField
            placeholder="Example: 'Budget travel packing for a Tokyo weekend' or 'How black holes work'"
            value={userIdea}
            onChange={(event) => onIdeaChange(event.target.value)}
            multiline
            rows={4}
            fullWidth
            required
            disabled={speech.isListening}
            error={helperIsError}
            helperText={helperText}
            sx={inputSx}
            FormHelperTextProps={{ sx: helperSx }}
          />
          {speech.isSupported && !loading ? (
            <Tooltip
              title={speech.isListening ? "Stop dictation" : "Dictate your topic"}
              arrow
              sx={tooltipSx}
            >
              <IconButton
                type="button"
                className={
                  speech.isListening ? "yt-plan-mic yt-plan-mic--listening" : "yt-plan-mic"
                }
                aria-label={speech.isListening ? "Stop dictating video topic" : "Dictate video topic"}
                onClick={handleMicClick}
                disabled={enhancing}
              >
                {speech.isListening ? <StopIcon /> : <MicIcon />}
              </IconButton>
            </Tooltip>
          ) : null}
        </Box>

        <Button
          fullWidth
          variant="contained"
          color="error"
          size="small"
          startIcon={enhancing ? <CircularProgress size={16} color="inherit" /> : <AutoAwesome />}
          disabled={!ideaReady || busy}
          onClick={() => {
            void handleEnhance();
          }}
          sx={{ mt: 1.5, textTransform: "none", fontWeight: 600 }}
        >
          {enhancing ? "Enhancing topic…" : "Enhance Topic with AI"}
        </Button>

        <PlanDiscoveryShortcuts userIdea={userIdea} disabled={busy} />
        {enhancing ? (
          <Box sx={{ mt: 1.5 }}>
            <YouTubePlanIdeaEnhanceProgressPanel />
          </Box>
        ) : null}
      </Box>

      <YouTubePlanEnhanceChoicesModal
        open={choicesOpen}
        enhancedIdeas={choices}
        rationales={rationales}
        onClose={() => setChoicesOpen(false)}
        onSelectChoice={(idea) => {
          onIdeaChange(idea);
          setChoicesOpen(false);
        }}
      />
    </YouTubePlanPaneCard>
  );
};
