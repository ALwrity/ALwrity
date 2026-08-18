/**
 * Clears in-progress Video Creator work after user confirmation.
 * Channel Bible (saved profile) is not affected — only session draft state.
 */

import React, { useState } from "react";
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
} from "@mui/material";
import AddCircleOutlineIcon from "@mui/icons-material/AddCircleOutline";
import { YT_BORDER, YT_RED, YT_TEXT } from "../constants";

interface StartNewVideoButtonProps {
  onConfirm: () => void;
  disabled?: boolean;
  size?: "small" | "medium";
  /** Hub toolbar uses rail button classes instead of MUI contained. */
  variant?: "mui" | "hub";
}

export const StartNewVideoButton: React.FC<StartNewVideoButtonProps> = ({
  onConfirm,
  disabled = false,
  size = "small",
  variant = "mui",
}) => {
  const [open, setOpen] = useState(false);

  const handleConfirm = () => {
    setOpen(false);
    onConfirm();
  };

  const trigger =
    variant === "hub" ? (
      <button
        type="button"
        className="yt-rail-btn"
        data-tour="yt-start-new-video"
        disabled={disabled}
        onClick={() => setOpen(true)}
      >
        Start New Video
      </button>
    ) : (
      <Button
        variant="outlined"
        size={size}
        startIcon={<AddCircleOutlineIcon />}
        disabled={disabled}
        onClick={() => setOpen(true)}
        data-tour="yt-start-new-video"
        sx={{
          borderColor: YT_BORDER,
          color: YT_TEXT,
          backgroundColor: "white",
          textTransform: "none",
          fontWeight: 600,
          "&:hover": {
            borderColor: YT_RED,
            color: YT_RED,
            backgroundColor: "#fff5f5",
          },
        }}
      >
        Start New Video
      </Button>
    );

  return (
    <>
      {trigger}
      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Start a new video?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            This clears your current idea, plan, scenes, images, voice, and render progress from
            this browser session. Your saved Channel Bible is kept.
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setOpen(false)} sx={{ textTransform: "none" }}>
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            variant="contained"
            color="error"
            sx={{ textTransform: "none" }}
          >
            Start fresh
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};
