/**
 * Loading panel shown while YouTube brainstorm ideas are generating.
 */

import React from "react";
import { Box, LinearProgress, Stack, Typography } from "@mui/material";
import { YOUTUBE_BRAINSTORM_LOADER_MESSAGES } from "../utils/youtubeBrainstormLoaderMessages";

interface PlanBrainstormLoadingPanelProps {
  loaderMessageIndex: number;
  includeTrending?: boolean;
  includeRepurpose?: boolean;
}

export const PlanBrainstormLoadingPanel: React.FC<PlanBrainstormLoadingPanelProps> = ({
  loaderMessageIndex,
  includeTrending = false,
  includeRepurpose = false,
}) => {
  const message =
    YOUTUBE_BRAINSTORM_LOADER_MESSAGES[
      Math.min(loaderMessageIndex, YOUTUBE_BRAINSTORM_LOADER_MESSAGES.length - 1)
    ];
  const progress = Math.min(
    95,
    ((loaderMessageIndex + 1) / YOUTUBE_BRAINSTORM_LOADER_MESSAGES.length) * 100,
  );

  return (
    <Box
      role="status"
      aria-live="polite"
      sx={{
        p: 1.5,
        borderRadius: 1.5,
        border: "1px solid #e5e7eb",
        bgcolor: "#fff",
      }}
    >
      <Typography sx={{ fontWeight: 600, color: "#111827", mb: 0.5 }}>
        Generating video ideas
      </Typography>
      <Typography variant="body2" sx={{ color: "#4b5563", mb: 1.25 }}>
        {message}
      </Typography>
      <LinearProgress
        variant="determinate"
        value={progress}
        sx={{
          mb: 1.25,
          height: 6,
          borderRadius: 999,
          bgcolor: "#f3f4f6",
          "& .MuiLinearProgress-bar": { bgcolor: "#ff0000", borderRadius: 999 },
        }}
      />
      <Stack component="ul" spacing={0.5} sx={{ m: 0, pl: 2.25, color: "#6b7280" }}>
        <Typography component="li" variant="caption">
          Searching the web via Exa
        </Typography>
        {includeTrending ? (
          <Typography component="li" variant="caption">
            Fetching YouTube search interest from Google Trends
          </Typography>
        ) : null}
        {includeRepurpose ? (
          <Typography component="li" variant="caption">
            Reviewing your saved YouTube brainstorm ideas
          </Typography>
        ) : null}
        <Typography component="li" variant="caption">
          Analyzing sources for video angles
        </Typography>
        <Typography component="li" variant="caption">
          Tailoring to your topic and Channel Bible
        </Typography>
        <Typography component="li" variant="caption">
          Building brainstorm idea cards
        </Typography>
      </Stack>
    </Box>
  );
};
