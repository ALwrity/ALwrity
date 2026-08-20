/**
 * Render-step panel: video prompt preview before generate, exact payload after.
 */

import React from "react";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Typography,
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import type { Scene } from "../../../services/youtubeApi";
import { YouTubeSceneVideoPromptMeta } from "./YouTubeSceneVideoPromptMeta";
import { YouTubeSceneVideoPromptPreview } from "./YouTubeSceneVideoPromptPreview";

interface YouTubeSceneVideoPromptPanelProps {
  scene: Scene;
  resolution?: string;
}

export const YouTubeSceneVideoPromptPanel: React.FC<YouTubeSceneVideoPromptPanelProps> = ({
  scene,
  resolution,
}) => {
  if (scene.video_generation) {
    return <YouTubeSceneVideoPromptMeta generation={scene.video_generation} defaultExpanded />;
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
        <Typography sx={{ fontWeight: 600, fontSize: "0.875rem", color: "#111827" }}>
          Video request preview (before generate)
        </Typography>
      </AccordionSummary>
      <AccordionDetails>
        <YouTubeSceneVideoPromptPreview scene={scene} resolution={resolution} />
      </AccordionDetails>
    </Accordion>
  );
};
