/**
 * Compact emoji popover for LinkedIn Studio editors (assistive toolbar).
 * Uses emoji-picker-react for full Unicode emoji set with search + categories.
 */
import React, { useState } from "react";
import { Box, IconButton, Popover, Tooltip } from "@mui/material";
import EmojiPicker, {
  EmojiClickData,
  Theme,
  SuggestionMode,
} from "emoji-picker-react";

interface LinkedInEmojiPickerProps {
  onSelect: (emoji: string) => void;
  disabled?: boolean;
  /** Icon button size styling to match adjacent toolbar controls. */
  buttonSx?: object;
}

/**
 * Toolbar emoji control: opens a searchable, categorized full emoji picker.
 */
export const LinkedInEmojiPicker: React.FC<LinkedInEmojiPickerProps> = ({
  onSelect,
  disabled = false,
  buttonSx,
}) => {
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const open = Boolean(anchorEl);

  const handleOpen = (event: React.MouseEvent<HTMLElement>) => {
    if (disabled) return;
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleEmojiClick = (emojiData: EmojiClickData) => {
    try {
      const emoji = emojiData.emoji;
      if (!emoji) {
        console.warn("[LinkedInEmojiPicker] empty emoji selection ignored");
        return;
      }
      onSelect(emoji);
      console.log("[LinkedInEmojiPicker] emoji selected", {
        emoji,
        unified: emojiData.unified,
        names: emojiData.names?.slice(0, 3),
      });
      handleClose();
    } catch (err) {
      console.error("[LinkedInEmojiPicker] failed to insert emoji", err);
    }
  };

  return (
    <>
      <Tooltip title="Add emoji" arrow>
        <span>
          <IconButton
            size="small"
            onClick={handleOpen}
            disabled={disabled}
            aria-label="Add emoji"
            aria-haspopup="true"
            aria-expanded={open ? "true" : undefined}
            sx={buttonSx}
          >
            <Box component="span" sx={{ fontSize: 18, lineHeight: 1 }}>
              😊
            </Box>
          </IconButton>
        </span>
      </Tooltip>
      <Popover
        open={open}
        anchorEl={anchorEl}
        onClose={handleClose}
        anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
        transformOrigin={{ vertical: "top", horizontal: "left" }}
        slotProps={{
          paper: {
            sx: {
              p: 0,
              borderRadius: 2,
              border: "1px solid #e2e8f0",
              overflow: "hidden",
              boxShadow: "0 8px 24px rgba(15, 23, 42, 0.18)",
            },
          },
        }}
      >
        <EmojiPicker
          onEmojiClick={handleEmojiClick}
          theme={Theme.LIGHT}
          searchPlaceHolder="Search emoji…"
          previewConfig={{ showPreview: false }}
          suggestedEmojisMode={SuggestionMode.RECENT}
          width={320}
          height={400}
          lazyLoadEmojis
        />
      </Popover>
    </>
  );
};
