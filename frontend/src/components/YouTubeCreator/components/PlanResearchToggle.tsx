/**
 * Plan-step web research toggle (LinkedIn PostHITL research_enabled pattern).
 */

import React from "react";
import { FormControlLabel, FormHelperText, Switch, Box } from "@mui/material";

interface PlanResearchToggleProps {
  enabled: boolean;
  disabled?: boolean;
  onChange: (enabled: boolean) => void;
}

export const PlanResearchToggle: React.FC<PlanResearchToggleProps> = ({
  enabled,
  disabled = false,
  onChange,
}) => {
  return (
    <Box>
      <FormControlLabel
        control={
          <Switch
            checked={enabled}
            disabled={disabled}
            onChange={(event) => {
              const next = event.target.checked;
              try {
                console.info("[PlanResearchToggle] Research toggle changed", { enabled: next });
                onChange(next);
              } catch (error) {
                console.error("[PlanResearchToggle] Failed to update research toggle", error);
              }
            }}
            inputProps={{ "aria-label": "Enable web research for plan" }}
          />
        }
        label="Include web research (Exa)"
        sx={{ color: "#374151", ml: 0 }}
      />
      <FormHelperText sx={{ mt: 0, ml: 0, color: "#6b7280" }}>
        Same idea as LinkedIn: when on, current web findings are injected into the
        plan prompt. When off, the plan is generated from your form, Channel Bible,
        and persona only.
      </FormHelperText>
    </Box>
  );
};
