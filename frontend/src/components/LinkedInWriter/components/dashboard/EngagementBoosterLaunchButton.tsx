import React from "react";
import { Button, Tooltip } from "@mui/material";
import BoltIcon from '@mui/icons-material/Bolt';
import { openEngagementBoosterModal } from "../../utils/linkedInDashboardEvents";

export interface EngagementBoosterLaunchButtonProps {
  /** Draft text to pre-fill; falls back to stored Studio draft when empty. */
  content?: string;
  /** Called before opening (e.g. close parent modal). */
  onBeforeOpen?: () => void;
  disabled?: boolean;
  /** panel = Publish/Quality Check; toolbar = editor; inline = My Drafts row */
  variant?: "panel" | "toolbar" | "inline";
  fullWidth?: boolean;
}

const PANEL_STYLE: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  padding: "9px 18px",
  borderRadius: 8,
  border: "1.5px solid #f59e0b",
  background: "#fffbeb",
  color: "#b45309",
  fontSize: 13,
  fontWeight: 600,
  cursor: "pointer",
};

const TOOLBAR_SX = {
  textTransform: "none" as const,
  fontSize: 12.5,
  fontWeight: 600,
  color: "#b45309",
  px: 1.2,
  py: 0.4,
  minWidth: "auto",
  minHeight: 30,
  borderRadius: 1.5,
  flexShrink: 0,
  "&:hover": { bgcolor: "#fffbeb", color: "#92400e" },
};

export const EngagementBoosterLaunchButton: React.FC<
  EngagementBoosterLaunchButtonProps
> = ({
  content,
  onBeforeOpen,
  disabled = false,
  variant = "panel",
  fullWidth = false,
}) => {
  const handleClick = () => {
    if (disabled) return;
    onBeforeOpen?.();
    const trimmed = content?.trim();
    openEngagementBoosterModal(
      trimmed ? { initialContent: trimmed } : undefined,
    );
  };

  if (variant === "toolbar") {
    return (
      <Tooltip title="Optimise for Engagement — rewrite draft for maximum engagement" arrow>
        <span style={{ display: "inline-flex", flexShrink: 0 }}>
          <Button
            type="button"
            variant="text"
            size="small"
            data-testid="engagement-booster-toolbar-btn"
            startIcon={<BoltIcon fontSize="small" sx={{ color: "#f59e0b" }} />}
            onClick={handleClick}
            disabled={disabled}
            sx={TOOLBAR_SX}
          >
            Optimise
          </Button>
        </span>
      </Tooltip>
    );
  }

  if (variant === "inline") {
    return (
      <button
        type="button"
        onClick={handleClick}
        disabled={disabled}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          padding: "7px 14px",
          borderRadius: 8,
          border: "1.5px solid #f59e0b",
          background: "#ffffff",
          color: "#b45309",
          fontSize: 13,
          fontWeight: 600,
          cursor: disabled ? "default" : "pointer",
          opacity: disabled ? 0.5 : 1,
        }}
      >
        ⚡ Optimise
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled}
      style={{
        ...PANEL_STYLE,
        width: fullWidth ? "100%" : undefined,
        opacity: disabled ? 0.5 : 1,
        cursor: disabled ? "default" : "pointer",
      }}
    >
      ⚡ Optimise for Engagement
    </button>
  );
};
