/**
 * Article editor image menu — toolbar icon opens generate/upload popover (matches post shell).
 */

import React, { useCallback, useState } from "react";
import {
  Box,
  Button,
  CircularProgress,
  IconButton,
  Popover,
  Tooltip,
  Typography,
} from "@mui/material";
import GenerateIcon from '@mui/icons-material/AutoAwesome';
import UploadIcon from '@mui/icons-material/CloudUpload';
import ImageIcon from '@mui/icons-material/Image';

export interface ArticleEditorImageMenuProps {
  onUploadImage: () => void;
  onGenerateImage?: () => void;
  isUploading?: boolean;
  disabled?: boolean;
  hasImages?: boolean;
}

export const ArticleEditorImageMenu: React.FC<ArticleEditorImageMenuProps> = ({
  onUploadImage,
  onGenerateImage,
  isUploading = false,
  disabled = false,
  hasImages = false,
}) => {
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const open = Boolean(anchorEl);

  const handleClose = useCallback(() => {
    setAnchorEl(null);
  }, []);

  const handleUpload = useCallback(() => {
    handleClose();
    onUploadImage();
  }, [handleClose, onUploadImage]);

  const handleGenerate = useCallback(() => {
    handleClose();
    onGenerateImage?.();
  }, [handleClose, onGenerateImage]);

  return (
    <>
      <Tooltip title={hasImages ? "Article images attached" : "Add article image"} arrow>
        <span>
          <IconButton
            size="small"
            data-testid="article-editor-image-menu-trigger"
            onClick={(event) => setAnchorEl(event.currentTarget)}
            disabled={disabled || isUploading}
            aria-label="Add article image"
            sx={{
              width: 30,
              height: 30,
              borderRadius: "6px",
              color: hasImages ? "#0A66C2" : "#0A66C2",
              transition: "all 0.15s ease",
              "&:hover": { bgcolor: "#e8f4fd", color: "#004182" },
              "&.Mui-disabled": { color: "#94a3b8", opacity: 1 },
            }}
          >
            {isUploading ? (
              <CircularProgress size={16} sx={{ color: "#0A66C2" }} />
            ) : (
              <ImageIcon sx={{ fontSize: 18 }} />
            )}
          </IconButton>
        </span>
      </Tooltip>

      <Popover
        open={open}
        anchorEl={anchorEl}
        onClose={handleClose}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
        slotProps={{
          paper: { sx: { p: 2, width: 360, maxWidth: "92vw" } },
        }}
      >
        <Box data-testid="article-editor-image-menu">
          <Typography
            variant="caption"
            sx={{
              color: "#64748b",
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: 0.5,
              display: "block",
              mb: 1,
            }}
          >
            Article image
          </Typography>
          <Box
            sx={{
              p: 1.5,
              borderRadius: 2,
              border: "1.5px dashed #cbd5e1",
              bgcolor: "#f8fafc",
              textAlign: "center",
            }}
          >
            <Typography
              variant="caption"
              sx={{ color: "#64748b", display: "block", mb: 1 }}
            >
              Attach an image to your article editor strip.
            </Typography>
            <Box display="flex" flexWrap="wrap" gap={1} justifyContent="center">
              {onGenerateImage ? (
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<GenerateIcon />}
                  onClick={handleGenerate}
                  disabled={isUploading}
                  sx={{
                    textTransform: "none",
                    borderColor: "#0A66C2",
                    color: "#0A66C2",
                    "&:hover": { borderColor: "#004182", bgcolor: "#f0f7ff" },
                  }}
                >
                  Generate with AI
                </Button>
              ) : null}
              <Button
                size="small"
                variant="outlined"
                startIcon={<UploadIcon />}
                onClick={handleUpload}
                disabled={isUploading}
                sx={{ textTransform: "none" }}
              >
                Upload image
              </Button>
            </Box>
            <Typography
              variant="caption"
              sx={{ color: "#94a3b8", display: "block", mt: 1 }}
            >
              PNG, JPEG, GIF, WebP · max 8 MB
            </Typography>
          </Box>
        </Box>
      </Popover>
    </>
  );
};
