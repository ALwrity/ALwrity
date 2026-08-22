/**
 * Source toggle chips for YouTube Plan brainstorm — LinkedIn DataSourceSelector pattern.
 */

import React from "react";
import { Chip, Stack } from "@mui/material";
import MenuBookOutlinedIcon from "@mui/icons-material/MenuBookOutlined";
import TravelExploreOutlinedIcon from "@mui/icons-material/TravelExploreOutlined";
import ReplayOutlinedIcon from "@mui/icons-material/ReplayOutlined";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";

export interface PlanBrainstormSourceChipsProps {
  useChannelBible: boolean;
  includeTrending: boolean;
  includeRepurpose: boolean;
  hasChannelBible: boolean;
  disabled?: boolean;
  loading?: boolean;
  /** Studio Hub Plan: always open the editor (empty or filled). Full Creator omits this. */
  onOpenChannelBible?: () => void;
  onToggleChannelBible: () => void;
  onToggleTrending: () => void;
  onToggleRepurpose: () => void;
}

function sourceChipSx(color: string, active: boolean, disabledChip = false) {
  return {
    background: active ? `${color}26` : `${color}14`,
    color: disabledChip ? "#9ca3af" : color,
    border: `1px solid ${active ? color : `${color}66`}`,
    fontWeight: 600,
    fontSize: "0.8125rem",
    "& .MuiChip-icon": {
      color: disabledChip ? "#9ca3af" : color,
    },
    "&:hover": disabledChip
      ? {}
      : {
          background: `${color}33`,
        },
  };
}

export const PlanBrainstormSourceChips: React.FC<PlanBrainstormSourceChipsProps> = ({
  useChannelBible,
  includeTrending,
  includeRepurpose,
  hasChannelBible,
  disabled = false,
  loading = false,
  onOpenChannelBible,
  onToggleChannelBible,
  onToggleTrending,
  onToggleRepurpose,
}) => {
  const controlsDisabled = disabled || loading;
  const canOpenBible = Boolean(onOpenChannelBible);
  const bibleDisabled = controlsDisabled || (!hasChannelBible && !canOpenBible);

  const handleChannelBibleClick = () => {
    if (onOpenChannelBible) {
      console.info("[PlanBrainstormSourceChips] Open Channel Bible editor");
      onOpenChannelBible();
      return;
    }
    onToggleChannelBible();
  };

  return (
    <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
      <Chip
        icon={<MenuBookOutlinedIcon sx={{ fontSize: "0.875rem !important" }} />}
        label="Channel Bible"
        onClick={handleChannelBibleClick}
        disabled={bibleDisabled}
        size="small"
        aria-pressed={hasChannelBible ? useChannelBible : false}
        sx={sourceChipSx(
          "#2563eb",
          hasChannelBible && useChannelBible,
          bibleDisabled,
        )}
        title={
          canOpenBible
            ? "Open Channel Bible to set niche, audience, and tone"
            : hasChannelBible
              ? "Include your Channel Bible niche, audience, and tone when generating ideas"
              : "Save a Channel Bible to enable this source"
        }
      />
      <Chip
        icon={<TravelExploreOutlinedIcon sx={{ fontSize: "0.875rem !important" }} />}
        label="Web research"
        size="small"
        sx={sourceChipSx("#667eea", true)}
        title="Web research via Exa is always used when generating ideas"
      />
      <Chip
        icon={<ReplayOutlinedIcon sx={{ fontSize: "0.875rem !important" }} />}
        label="Repurpose"
        onClick={onToggleRepurpose}
        disabled={controlsDisabled}
        size="small"
        aria-pressed={includeRepurpose}
        sx={sourceChipSx("#10b981", includeRepurpose, controlsDisabled)}
        title="Include your saved YouTube brainstorm ideas when generating new angles"
      />
      <Chip
        icon={<TrendingUpIcon sx={{ fontSize: "0.875rem !important" }} />}
        label="Trending"
        onClick={onToggleTrending}
        disabled={controlsDisabled}
        size="small"
        aria-pressed={includeTrending}
        sx={sourceChipSx("#f59e0b", includeTrending, controlsDisabled)}
        title="Include Google Trends (YouTube search interest) when generating ideas"
      />
    </Stack>
  );
};
