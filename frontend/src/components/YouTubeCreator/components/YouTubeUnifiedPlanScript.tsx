/**
 * Unified cohesive script editor — no metadata chips or guideline outlines.
 */

import React from "react";
import { Paper, TextField, Typography } from "@mui/material";
import { YT_BORDER } from "../constants";
import { inputSx } from "../styles";

export interface YouTubeUnifiedPlanScriptProps {
  value: string;
  disabled?: boolean;
  onChange?: (value: string) => void;
}

export const YouTubeUnifiedPlanScript: React.FC<YouTubeUnifiedPlanScriptProps> = ({
  value,
  disabled = false,
  onChange,
}) => {
  return (
    <Paper
      elevation={0}
      sx={{ p: 2.5, border: `1px solid ${YT_BORDER}`, borderRadius: 2, bgcolor: "#fff", mb: 2 }}
    >
      <Typography variant="subtitle1" sx={{ fontWeight: 700, color: "#0f172a", mb: 1.5 }}>
        Full script
      </Typography>
      <TextField
        fullWidth
        multiline
        minRows={12}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange?.(event.target.value)}
        inputProps={{ "aria-label": "Full video script" }}
        sx={inputSx}
        placeholder="Your expanded script will appear here after you confirm a pitch."
      />
    </Paper>
  );
};
