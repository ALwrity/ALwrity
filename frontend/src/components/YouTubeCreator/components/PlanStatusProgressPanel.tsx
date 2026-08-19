/**
 * Shared YouTube Plan loading status: title, rotating message, determinate bar, step list.
 * Used by brainstorm idea generation and video plan generation.
 */

import React from "react";
import { Box, LinearProgress, Stack, Typography } from "@mui/material";

export interface PlanStatusProgressPanelProps {
  title: string;
  message: string;
  progress: number;
  steps: string[];
  hint?: string;
}

export const PlanStatusProgressPanel: React.FC<PlanStatusProgressPanelProps> = ({
  title,
  message,
  progress,
  steps,
  hint,
}) => {
  const clamped = Math.min(95, Math.max(0, progress));

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
        {title}
      </Typography>
      <Typography variant="body2" sx={{ color: "#4b5563", mb: 1.25 }}>
        {message}
      </Typography>
      <LinearProgress
        variant="determinate"
        value={clamped}
        sx={{
          mb: 1.25,
          height: 6,
          borderRadius: 999,
          bgcolor: "#f3f4f6",
          "& .MuiLinearProgress-bar": { bgcolor: "#ff0000", borderRadius: 999 },
        }}
      />
      <Stack component="ul" spacing={0.5} sx={{ m: 0, pl: 2.25, color: "#6b7280" }}>
        {steps.map((step) => (
          <Typography key={step} component="li" variant="caption">
            {step}
          </Typography>
        ))}
      </Stack>
      {hint ? (
        <Typography variant="caption" sx={{ display: "block", mt: 1.25, color: "#9ca3af" }}>
          {hint}
        </Typography>
      ) : null}
    </Box>
  );
};
