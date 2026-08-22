/**
 * Video Creator Plan step — shortcuts into Plan wedge discovery (brainstorm / Blog/URL).
 */
import React from "react";
import { Box, Button, Stack, Tooltip } from "@mui/material";
import LightbulbOutlinedIcon from "@mui/icons-material/LightbulbOutlined";
import LinkIcon from "@mui/icons-material/Link";
import { openYouTubePlanFromCreator } from "../dashboard/youtubeStudioEvents";
import { tooltipSx } from "../styles";

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
      <Tooltip
        title="Not sure what to film? Brainstorm ideas from your topic and Channel Bible."
        arrow
        sx={tooltipSx}
      >
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Button
            fullWidth
            variant="outlined"
            size="small"
            disabled={disabled}
            startIcon={<LightbulbOutlinedIcon />}
            onClick={openBrainstorm}
            sx={{
              textTransform: "none",
              fontWeight: 600,
              borderColor: "#f59e0b",
              color: "#b45309",
              "&:hover": {
                borderColor: "#d97706",
                backgroundColor: "rgba(245, 158, 11, 0.08)",
              },
            }}
          >
            Brainstorm Video Idea
          </Button>
        </Box>
      </Tooltip>

      <Tooltip
        title="Have a blog or article? Paste the URL and we will turn it into a video idea."
        arrow
        sx={tooltipSx}
      >
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Button
            fullWidth
            variant="outlined"
            size="small"
            disabled={disabled}
            startIcon={<LinkIcon />}
            onClick={openUrlImport}
            sx={{
              textTransform: "none",
              fontWeight: 600,
              borderColor: "#0d9488",
              color: "#0f766e",
              "&:hover": {
                borderColor: "#0f766e",
                backgroundColor: "rgba(13, 148, 136, 0.08)",
              },
            }}
          >
            Blog / URL → Video
          </Button>
        </Box>
      </Tooltip>
    </Stack>
  );
}
