/**
 * Plan Your Video idea canvas — topic, Brainstorm, Blog/URL.
 */

import React from "react";
import { Box, IconButton, InputLabel, TextField, Tooltip } from "@mui/material";
import InfoOutlined from "@mui/icons-material/InfoOutlined";
import { helperSx, inputSx, labelSx, tooltipPopperProps, tooltipSx } from "../styles";
import { PlanDiscoveryShortcuts } from "./PlanDiscoveryShortcuts";
import { YouTubePlanPaneCard } from "./YouTubePlanPaneCard";

export interface YouTubePlanIdeaPaneProps {
  userIdea: string;
  loading: boolean;
  onIdeaChange: (idea: string) => void;
}

export const YouTubePlanIdeaPane: React.FC<YouTubePlanIdeaPaneProps> = ({
  userIdea,
  loading,
  onIdeaChange,
}) => {
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
        <TextField
          placeholder="Example: 'Budget travel packing for a Tokyo weekend' or 'How black holes work'"
          value={userIdea}
          onChange={(event) => onIdeaChange(event.target.value)}
          multiline
          rows={4}
          fullWidth
          required
          helperText="Describe the topic in 1–2 sentences. Who it is for and your goal are chosen below."
          sx={inputSx}
          FormHelperTextProps={{ sx: helperSx }}
        />
        <PlanDiscoveryShortcuts userIdea={userIdea} disabled={loading} />
      </Box>
    </YouTubePlanPaneCard>
  );
};
