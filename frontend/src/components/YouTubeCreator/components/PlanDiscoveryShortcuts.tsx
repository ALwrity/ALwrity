/**
 * Video Creator Plan step — shortcuts into Plan wedge discovery (brainstorm / Blog/URL).
 */
import React from "react";
import { Stack } from "@mui/material";
import LightbulbOutlinedIcon from "@mui/icons-material/LightbulbOutlined";
import LinkIcon from "@mui/icons-material/Link";
import { openYouTubePlanFromCreator } from "../dashboard/youtubeStudioEvents";
import { YouTubePlanHubAction } from "./YouTubePlanHubAction";
import { YOUTUBE_PLAN_HUB_TOOLTIPS } from "./youtubePlanHubTooltips";

interface PlanDiscoveryShortcutsProps {
  userIdea: string;
  disabled?: boolean;
}

export function PlanDiscoveryShortcuts({
  userIdea,
  disabled = false,
}: PlanDiscoveryShortcutsProps) {
  const seed = userIdea.trim();

  const openBrainstorm = () => {
    console.info("[PlanDiscoveryShortcuts] Open Plan Topic Discovery", {
      seedLength: seed.length,
    });
    openYouTubePlanFromCreator({
      sub: "brainstorm",
      seed: seed || undefined,
    });
  };

  const openUrlImport = () => {
    console.info("[PlanDiscoveryShortcuts] Open Plan Blog/URL", {
      seedLength: seed.length,
    });
    openYouTubePlanFromCreator({
      sub: "url-import",
      seed: seed || undefined,
    });
  };

  return (
    <Stack
      direction={{ xs: "column", sm: "row" }}
      spacing={1}
      sx={{ mt: 1.5 }}
      data-tour="yt-plan-discovery-shortcuts"
    >
      <YouTubePlanHubAction
        wide
        disabled={disabled}
        tooltip={YOUTUBE_PLAN_HUB_TOOLTIPS.brainstorm}
        tipId="yt-plan-hub-tip-brainstorm"
        onClick={openBrainstorm}
      >
        <LightbulbOutlinedIcon fontSize="small" />
        Brainstorm Video Idea
      </YouTubePlanHubAction>
      <YouTubePlanHubAction
        wide
        disabled={disabled}
        tooltip={YOUTUBE_PLAN_HUB_TOOLTIPS.urlImport}
        tipId="yt-plan-hub-tip-url"
        onClick={openUrlImport}
      >
        <LinkIcon fontSize="small" />
        Blog / URL → Video
      </YouTubePlanHubAction>
    </Stack>
  );
}
