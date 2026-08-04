import React from "react";
import {
  Box,
  CircularProgress,
  IconButton,
  Tooltip,
  Typography,
} from "@mui/material";
import {
  Image as ImageIcon,
  Redo as RedoIcon,
  Undo as UndoIcon,
} from "@mui/icons-material";
import MarkdownToolbar from "../../TextEditor/MarkdownToolbar";
import type { MarkdownFormatType } from "../../TextEditor/markdownFormatting";
import { LinkedInEmojiPicker } from "./LinkedInEmojiPicker";

interface LinkedInEditorToolbarProps {
  onFormat: (type: MarkdownFormatType) => void;
  onUploadImage: () => void;
  onInsertEmoji?: (emoji: string) => void;
  onUndo?: () => void;
  onRedo?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
  isUploading?: boolean;
  disabled?: boolean;
}

const toolBtnSx = {
  width: 30,
  height: 30,
  borderRadius: "6px",
  color: "#0A66C2",
  transition: "all 0.15s ease",
  "&:hover": {
    bgcolor: "#e8f4fd",
    color: "#004182",
  },
  // Keep Undo/Redo visible when disabled (MUI default washes icons out on light toolbars).
  "&.Mui-disabled": {
    color: "#94a3b8",
    opacity: 1,
  },
};

/**
 * LinkedIn assistive editor toolbar — markdown, emoji, undo/redo, image upload.
 */
export const LinkedInEditorToolbar: React.FC<LinkedInEditorToolbarProps> = ({
  onFormat,
  onUploadImage,
  onInsertEmoji,
  onUndo,
  onRedo,
  canUndo = false,
  canRedo = false,
  isUploading = false,
  disabled = false,
}) => {
  return (
    <Box
      sx={{
        bgcolor: "#f8fafc",
        border: "1px solid #e2e8f0",
        borderBottom: "none",
        borderTopLeftRadius: "8px",
        borderTopRightRadius: "8px",
      }}
    >
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 0.5,
          px: 1,
          py: 0.5,
        }}
      >
        <Box
          sx={{ display: "flex", alignItems: "center", flex: 1, minWidth: 0 }}
        >
          <MarkdownToolbar
            onFormat={onFormat}
            sx={{
              border: "none",
              borderRadius: 0,
              px: 0,
              py: 0,
              bgcolor: "transparent",
            }}
          />
          {onInsertEmoji && (
            <LinkedInEmojiPicker
              onSelect={onInsertEmoji}
              disabled={disabled}
              buttonSx={toolBtnSx}
            />
          )}
          {(onUndo || onRedo) && (
            <Box sx={{ display: "flex", alignItems: "center", ml: 0.25 }}>
              {onUndo && (
                <Tooltip title="Undo" arrow>
                  <span>
                    <IconButton
                      size="small"
                      sx={toolBtnSx}
                      onClick={onUndo}
                      disabled={disabled || !canUndo}
                      aria-label="Undo"
                    >
                      <UndoIcon sx={{ fontSize: 18 }} />
                    </IconButton>
                  </span>
                </Tooltip>
              )}
              {onRedo && (
                <Tooltip title="Redo" arrow>
                  <span>
                    <IconButton
                      size="small"
                      sx={toolBtnSx}
                      onClick={onRedo}
                      disabled={disabled || !canRedo}
                      aria-label="Redo"
                    >
                      <RedoIcon sx={{ fontSize: 18 }} />
                    </IconButton>
                  </span>
                </Tooltip>
              )}
            </Box>
          )}
        </Box>

        <Tooltip title="Add photo" arrow>
          <span>
            <IconButton
              size="small"
              sx={toolBtnSx}
              onClick={onUploadImage}
              disabled={disabled || isUploading}
              aria-label="Upload image"
            >
              {isUploading ? (
                <CircularProgress size={16} sx={{ color: "#0A66C2" }} />
              ) : (
                <ImageIcon sx={{ fontSize: 18 }} />
              )}
            </IconButton>
          </span>
        </Tooltip>
      </Box>
      <Typography
        variant="caption"
        sx={{
          display: "block",
          px: 1.25,
          pb: 0.75,
          color: "#64748b",
          fontSize: 11,
          lineHeight: 1.35,
        }}
      >
        Draft formatting — LinkedIn posts as plain text
      </Typography>
    </Box>
  );
};
