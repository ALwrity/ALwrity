/**
 * Connect & Publish cover-picture picker (phase 1: upload + thumbnails.set).
 * Creator white surface, outlined hover like Privacy/Audience. No Generate yet.
 */
import React, { useEffect, useRef, useState } from "react";
import { Box, Button, Stack, Typography } from "@mui/material";
import {
  helperSx,
  labelSx,
  outlinedControlSx,
  BACKGROUND_HOVER,
  TEXT_PRIMARY,
} from "../styles";
import { YT_RED } from "../constants";
import {
  readYouTubeThumbnailImageSize,
  validateYouTubePublishThumbnail,
  youtubeThumbnailHelperForDuration,
  youtubeThumbnailNoteForDuration,
  youtubeThumbnailMimeFromFile,
  type YouTubeThumbnailDuration,
} from "./youtubePublishThumbnail";

interface YouTubePublishThumbnailUploadProps {
  durationType: YouTubeThumbnailDuration;
  disabled?: boolean;
  file: File | null;
  error: string | null;
  onFileChange: (file: File | null, error: string | null) => void;
}

export const YouTubePublishThumbnailUpload: React.FC<
  YouTubePublishThumbnailUploadProps
> = ({ durationType, disabled, file, error, onFileChange }) => {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!file) {
      setPreviewUrl(null);
      return;
    }
    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);
    return () => {
      URL.revokeObjectURL(objectUrl);
    };
  }, [file]);

  const handlePick = async (event: React.ChangeEvent<HTMLInputElement>) => {
    try {
      const next = event.target.files?.[0];
      event.target.value = "";
      if (!next) {
        return;
      }
      console.info("[YouTubePublishThumbnailUpload] File chosen", {
        sizeBytes: next.size,
        mimeType: youtubeThumbnailMimeFromFile(next),
        durationType,
      });
      const size = await readYouTubeThumbnailImageSize(next);
      const checked = validateYouTubePublishThumbnail({
        mimeType: youtubeThumbnailMimeFromFile(next),
        sizeBytes: next.size,
        width: size.width,
        height: size.height,
        durationType,
      });
      if (!checked.ok) {
        console.warn("[YouTubePublishThumbnailUpload] File rejected", {
          durationType,
          hasError: true,
        });
        onFileChange(null, checked.error);
        return;
      }
      onFileChange(next, null);
    } catch (pickError) {
      console.error("[YouTubePublishThumbnailUpload] File read failed", {
        errorName: pickError instanceof Error ? pickError.name : "Error",
      });
      onFileChange(
        null,
        pickError instanceof Error
          ? pickError.message
          : "We could not open that picture. Try a JPEG or PNG.",
      );
    }
  };

  const handleClear = () => {
    try {
      console.info("[YouTubePublishThumbnailUpload] File cleared");
      onFileChange(null, null);
    } catch (clearError) {
      console.error("[YouTubePublishThumbnailUpload] Clear failed", {
        errorName: clearError instanceof Error ? clearError.name : "Error",
      });
    }
  };

  return (
    <Box
      sx={{
        ...outlinedControlSx,
        p: 1.5,
      }}
    >
      <Typography id="yt-cover-picture-label" sx={{ ...labelSx, mb: 0.5 }}>
        Cover picture (optional)
      </Typography>
      <Typography variant="body2" sx={{ ...helperSx, mt: 0, mb: 1.25 }}>
        {youtubeThumbnailHelperForDuration(durationType)} You can skip this —
        YouTube will pick a frame.
      </Typography>
      {youtubeThumbnailNoteForDuration(durationType) ? (
        <Typography variant="body2" sx={{ ...helperSx, mt: 0, mb: 1.25 }}>
          {youtubeThumbnailNoteForDuration(durationType)}
        </Typography>
      ) : null}

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,.jpg,.jpeg,.png"
        hidden
        disabled={disabled}
        aria-labelledby="yt-cover-picture-label"
        onChange={(event) => {
          void handlePick(event);
        }}
      />

      <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} alignItems="flex-start">
        {previewUrl ? (
          <Box
            component="img"
            src={previewUrl}
            alt="Chosen cover picture"
            sx={{
              width: durationType === "shorts" ? 72 : 128,
              height: durationType === "shorts" ? 128 : 72,
              objectFit: "cover",
              borderRadius: 1,
              border: "1.5px solid #d1d5db",
              backgroundColor: BACKGROUND_HOVER,
            }}
          />
        ) : null}

        <Stack spacing={1} sx={{ minWidth: 0 }}>
          <Button
            variant="outlined"
            color="error"
            disabled={disabled}
            onClick={() => inputRef.current?.click()}
            sx={{
              width: "fit-content",
              fontWeight: 600,
              color: YT_RED,
              borderColor: "#d1d5db",
              "&:hover": {
                borderColor: "#9ca3af",
                backgroundColor: BACKGROUND_HOVER,
              },
            }}
          >
            {file ? "Change picture" : "Choose picture"}
          </Button>
          {file ? (
            <Button
              variant="text"
              disabled={disabled}
              onClick={handleClear}
              sx={{
                width: "fit-content",
                color: TEXT_PRIMARY,
                textTransform: "none",
                fontWeight: 600,
                px: 0.5,
              }}
            >
              Remove picture
            </Button>
          ) : null}
        </Stack>
      </Stack>

      {error ? (
        <Typography variant="body2" sx={{ ...helperSx, mt: 1, color: YT_RED }} role="alert">
          {error}
        </Typography>
      ) : null}
    </Box>
  );
};
