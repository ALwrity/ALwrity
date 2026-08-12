import React, { useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Stack,
  Typography,
  alpha,
} from "@mui/material";
import Download from "@mui/icons-material/Download";
import { downloadMediaBlob, fetchMediaBlobUrl } from "../../../utils/fetchMediaBlobUrl";

interface YouTubeFinalVideoPanelProps {
  finalVideoUrl: string | null;
  combining: boolean;
  combiningProgress: number;
  combiningMessage: string;
  onCombine: () => void;
}

export const YouTubeFinalVideoPanel: React.FC<YouTubeFinalVideoPanelProps> = ({
  finalVideoUrl,
  combining,
  combiningProgress,
  combiningMessage,
  onCombine,
}) => {
  const [finalVideoBlobUrl, setFinalVideoBlobUrl] = useState<string | null>(null);
  const [blobLoading, setBlobLoading] = useState(false);
  const [blobError, setBlobError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadBlobPreview(): Promise<void> {
      if (!finalVideoUrl) {
        setFinalVideoBlobUrl(null);
        setBlobError(null);
        setBlobLoading(false);
        return;
      }

      setBlobLoading(true);
      setBlobError(null);

      try {
        const blobUrl = await fetchMediaBlobUrl(finalVideoUrl);
        if (!cancelled) {
          setFinalVideoBlobUrl(blobUrl);
          if (!blobUrl) {
            setBlobError("Preview stream is temporarily unavailable. You can still publish or retry download.");
          }
        }
      } catch (error) {
        console.error("[YouTubeFinalVideoPanel] Failed to load final video blob preview:", error);
        if (!cancelled) {
          setFinalVideoBlobUrl(null);
          setBlobError("Unable to load secure preview. You can still publish or retry download.");
        }
      } finally {
        if (!cancelled) {
          setBlobLoading(false);
        }
      }
    }

    loadBlobPreview();

    return () => {
      cancelled = true;
    };
  }, [finalVideoUrl]);

  const handleDownload = async (): Promise<void> => {
    if (!finalVideoUrl) {
      return;
    }

    setDownloading(true);
    try {
      await downloadMediaBlob(finalVideoUrl, `youtube-final-${Date.now()}.mp4`);
    } catch (error) {
      console.error("[YouTubeFinalVideoPanel] Download failed:", error);
      setBlobError("Download failed. Please retry in a moment.");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <Box sx={{ mb: 3, p: 2.5, bgcolor: "#f0fdf4", borderRadius: 2, border: "2px solid #10b981" }}>
      <Typography variant="h6" sx={{ mb: 1, fontWeight: 600, color: "#065f46" }}>
        🎞️ Combine Scene Videos
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        All scene videos are ready! Combine them into one final video.
      </Typography>

      <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: finalVideoUrl ? 2 : 0 }}>
        <Button
          variant="contained"
          color="success"
          onClick={onCombine}
          disabled={combining}
          startIcon={combining ? <CircularProgress size={20} sx={{ color: "white" }} /> : undefined}
          sx={{ textTransform: "none", fontWeight: 700 }}
        >
          {combining ? "Combining Videos..." : "Combine Into Final Video"}
        </Button>

        {combining && (
          <Typography variant="body2" color="text.secondary">
            {combiningMessage} ({combiningProgress.toFixed(0)}%)
          </Typography>
        )}

        {finalVideoUrl && <Chip label="✅ Final video ready" color="success" sx={{ fontWeight: 600 }} />}
      </Stack>

      {finalVideoUrl && (
        <Stack spacing={2}>
          {blobError && (
            <Alert severity="warning" sx={{ background: alpha("#f59e0b", 0.1), border: `1px solid ${alpha("#f59e0b", 0.35)}` }}>
              {blobError}
            </Alert>
          )}

          <Box
            sx={{
              width: "100%",
              maxWidth: 960,
              borderRadius: 2,
              overflow: "hidden",
              border: `1px solid ${alpha("#10b981", 0.35)}`,
              backgroundColor: "#000",
            }}
          >
            {blobLoading ? (
              <Box sx={{ py: 6, display: "flex", justifyContent: "center" }}>
                <CircularProgress size={28} />
              </Box>
            ) : (
              <video
                controls
                src={finalVideoBlobUrl || finalVideoUrl}
                style={{ width: "100%", display: "block", maxHeight: 520 }}
              >
                Your browser does not support video playback.
              </video>
            )}
          </Box>

          <Stack direction="row" justifyContent="center">
            <Button
              variant="contained"
              startIcon={downloading ? <CircularProgress size={18} sx={{ color: "white" }} /> : <Download />}
              onClick={handleDownload}
              disabled={downloading}
              sx={{
                textTransform: "none",
                fontWeight: 700,
                background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
                "&:hover": {
                  background: "linear-gradient(135deg, #059669 0%, #047857 100%)",
                },
              }}
            >
              {downloading ? "Preparing Download..." : "Download Final Video"}
            </Button>
          </Stack>
        </Stack>
      )}
    </Box>
  );
};

