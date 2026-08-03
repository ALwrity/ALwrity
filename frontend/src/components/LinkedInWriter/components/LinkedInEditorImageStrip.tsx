import React, { useCallback, useState } from "react";
import {
  Box,
  Button,
  CircularProgress,
  Typography,
} from "@mui/material";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import DownloadIcon from "@mui/icons-material/Download";
import { LinkedInAuthenticatedImage } from "./LinkedInAuthenticatedImage";
import type { LinkedInEditorImageBlock } from "../utils/linkedInEditorDraftUtils";
import {
  downloadLinkedInImageBlob,
  fetchLinkedInImageBlobUrl,
} from "../../../services/linkedInImageService";
import { showToastNotification } from "../../../utils/toastNotifications";

const LOG_PREFIX = "[LinkedInEditorImageStrip]";

/** LinkedIn Studio secondary / destructive button styles (matches image modal + toolbar). */
const downloadBtnSx = {
  textTransform: "none" as const,
  fontWeight: 600,
  fontSize: 12,
  borderColor: "#0A66C2",
  color: "#0A66C2",
  bgcolor: "#fff",
  boxShadow: "none",
  "&:hover": {
    bgcolor: "#e8f4fd",
    borderColor: "#004182",
    color: "#004182",
    boxShadow: "none",
  },
  "&.Mui-disabled": {
    borderColor: "#cbd5e1",
    color: "#94a3b8",
    bgcolor: "#f8fafc",
  },
};

const deleteBtnSx = {
  textTransform: "none" as const,
  fontWeight: 600,
  fontSize: 12,
  borderColor: "#fca5a5",
  color: "#dc2626",
  bgcolor: "#fff",
  boxShadow: "none",
  "&:hover": {
    bgcolor: "#fef2f2",
    borderColor: "#dc2626",
    color: "#b91c1c",
    boxShadow: "none",
  },
};

interface LinkedInEditorImageStripProps {
  images: LinkedInEditorImageBlock[];
  onRemove: (imageId: string) => void;
}

/**
 * Compact photo strip for Assistive Writing.
 * Actions sit beside a thumbnail (not under a tall image) so Download/Delete stay on-screen.
 */
export const LinkedInEditorImageStrip: React.FC<
  LinkedInEditorImageStripProps
> = ({ images, onRemove }) => {
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const handleDownload = useCallback(async (image: LinkedInEditorImageBlock) => {
    setDownloadingId(image.id);
    let createdBlobUrl: string | null = null;
    try {
      if (image.imageId) {
        createdBlobUrl = await fetchLinkedInImageBlobUrl(image.imageId);
        downloadLinkedInImageBlob(
          createdBlobUrl,
          `linkedin-image-${image.imageId}.png`,
        );
      } else if (image.url?.startsWith("blob:") || image.url?.startsWith("data:")) {
        downloadLinkedInImageBlob(
          image.url,
          `linkedin-image-${image.id}.png`,
        );
      } else {
        console.error(`${LOG_PREFIX} download unavailable: no imageId or blob url`, {
          imageId: image.id,
        });
        showToastNotification("Download unavailable for this image", "error");
        return;
      }
      console.log(`${LOG_PREFIX} download started`, {
        imageId: image.imageId || image.id,
      });
      showToastNotification("Image download started", "success");
    } catch (err) {
      console.error(`${LOG_PREFIX} download failed`, {
        imageId: image.imageId || image.id,
        error: err instanceof Error ? err.message : String(err),
      });
      showToastNotification("Failed to download image", "error");
    } finally {
      if (createdBlobUrl) {
        URL.revokeObjectURL(createdBlobUrl);
      }
      setDownloadingId(null);
    }
  }, []);

  const handleRemove = useCallback(
    (image: LinkedInEditorImageBlock) => {
      try {
        onRemove(image.id);
        console.log(`${LOG_PREFIX} image removed`, {
          imageId: image.imageId || image.id,
        });
        showToastNotification("Image removed from post", "info");
      } catch (err) {
        console.error(`${LOG_PREFIX} remove failed`, err);
        showToastNotification("Failed to remove image", "error");
      }
    },
    [onRemove],
  );

  if (images.length === 0) return null;

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        gap: 1,
        py: 1.25,
        position: "relative",
        zIndex: 2,
      }}
    >
      <Typography
        variant="subtitle2"
        sx={{ color: "#0f172a", fontWeight: 700, fontSize: 13 }}
      >
        Photos ({images.length})
      </Typography>

      {images.map((image) => (
        <Box
          key={image.id}
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 1.5,
            p: 1.25,
            borderRadius: 2,
            border: "1px solid #cbd5e1",
            bgcolor: "#ffffff",
            boxShadow: "0 1px 2px rgba(15, 23, 42, 0.06)",
            minHeight: 88,
          }}
        >
          <Box
            sx={{
              width: 72,
              height: 72,
              flexShrink: 0,
              borderRadius: 1.5,
              overflow: "hidden",
              border: "1px solid #e2e8f0",
              bgcolor: "#f1f5f9",
              "& img": {
                width: "72px !important",
                height: "72px !important",
                maxWidth: "72px !important",
                maxHeight: "72px !important",
                margin: "0 !important",
                borderRadius: "0 !important",
                border: "none !important",
                objectFit: "cover",
                display: "block",
              },
            }}
          >
            {image.imageId ? (
              <LinkedInAuthenticatedImage
                imageId={image.imageId}
                alt={image.alt}
              />
            ) : (
              <Box
                component="img"
                src={image.url}
                alt={image.alt}
                sx={{
                  width: 72,
                  height: 72,
                  objectFit: "cover",
                  display: "block",
                }}
              />
            )}
          </Box>

          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography
              variant="body2"
              sx={{
                color: "#334155",
                fontWeight: 600,
                mb: 1,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {image.alt || "LinkedIn post image"}
            </Typography>
            <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
              <Button
                size="small"
                variant="outlined"
                startIcon={
                  downloadingId === image.id ? (
                    <CircularProgress size={14} sx={{ color: "#0A66C2" }} />
                  ) : (
                    <DownloadIcon fontSize="small" />
                  )
                }
                onClick={() => handleDownload(image)}
                disabled={downloadingId === image.id}
                sx={downloadBtnSx}
              >
                Download
              </Button>
              <Button
                size="small"
                variant="outlined"
                startIcon={<DeleteOutlineIcon fontSize="small" />}
                onClick={() => handleRemove(image)}
                sx={deleteBtnSx}
              >
                Delete
              </Button>
            </Box>
          </Box>
        </Box>
      ))}
    </Box>
  );
};
