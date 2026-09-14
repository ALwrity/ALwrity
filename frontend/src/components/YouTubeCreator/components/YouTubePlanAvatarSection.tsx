/**
 * Plan Your Video avatar + optional visual style guide.
 */

import React, { useCallback, useMemo, useState } from "react";
import {
  Box,
  Button,
  IconButton,
  InputLabel,
  Paper,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import AutoAwesome from "@mui/icons-material/AutoAwesome";
import CloudUpload from "@mui/icons-material/CloudUpload";
import Collections from "@mui/icons-material/Collections";
import Delete from "@mui/icons-material/Delete";
import InfoOutlined from "@mui/icons-material/InfoOutlined";
import { OperationButton } from "../../shared/OperationButton";
import { AssetLibraryImageModal } from "../../shared/AssetLibraryImageModal";
import type { ContentAsset } from "../../../hooks/useContentAssets";
import { YT_RED } from "../constants";
import { helperSx, inputSx, labelSx, tooltipPopperProps, tooltipSx } from "../styles";
import { useAvatarBlobUrl } from "../hooks/useAvatarBlobUrl";
import { buildImageEditingOperation } from "../utils/operationHelpers";

const presentableSx = {
  background: YT_RED,
  color: "white",
  fontWeight: 600,
  fontSize: "0.8125rem",
  textTransform: "none" as const,
  borderRadius: 1.5,
  px: 2,
  py: 0.875,
  boxShadow: "0 2px 8px 0 rgba(255, 0, 0, 0.28)",
  "&:hover:not(:disabled)": {
    background: "#e60000",
    boxShadow: "0 4px 12px 0 rgba(255, 0, 0, 0.35)",
  },
  "&:disabled": {
    background: "linear-gradient(135deg, #cbd5e1 0%, #94a3b8 100%)",
    color: "#64748b",
    boxShadow: "none",
  },
  "& .MuiCircularProgress-root": { color: "white" },
};

export interface YouTubePlanAvatarSectionProps {
  referenceImage: string;
  avatarPreview?: string | null;
  uploadingAvatar?: boolean;
  makingPresentable?: boolean;
  onReferenceImageChange: (image: string) => void;
  onAvatarUpload: (file: File) => void;
  onRemoveAvatar: () => void;
  onMakePresentable: () => void;
  onAvatarSelectFromLibrary: (asset: ContentAsset) => void;
}

export const YouTubePlanAvatarSection: React.FC<YouTubePlanAvatarSectionProps> = ({
  referenceImage,
  avatarPreview,
  uploadingAvatar = false,
  makingPresentable = false,
  onReferenceImageChange,
  onAvatarUpload,
  onRemoveAvatar,
  onMakePresentable,
  onAvatarSelectFromLibrary,
}) => {
  const imageEditingOperation = useMemo(() => buildImageEditingOperation(), []);
  const { avatarBlobUrl, avatarLoading } = useAvatarBlobUrl(avatarPreview);
  const [assetLibraryOpen, setAssetLibraryOpen] = useState(false);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    try {
      const file = event.target.files?.[0];
      if (!file) {
        console.warn("[PlanStep] Avatar file input had no file");
        return;
      }
      onAvatarUpload(file);
    } catch (error) {
      console.error("[PlanStep] Avatar file selection failed", error);
    }
  };

  const handleAssetLibrarySelect = useCallback(
    (asset: ContentAsset) => {
      try {
        if (!asset.file_url) {
          console.warn("[PlanStep] Asset library selection skipped: missing file_url");
          return;
        }
        onAvatarSelectFromLibrary(asset);
        setAssetLibraryOpen(false);
      } catch (error) {
        console.error("[PlanStep] Asset library selection failed", error);
      }
    },
    [onAvatarSelectFromLibrary],
  );

  return (
    <Paper variant="outlined" sx={{ p: 2, borderColor: "#d1d5db", borderRadius: 2, bgcolor: "#f9fafb" }}>
      <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1.5, color: "#0f172a" }}>
        Creator Avatar & Visual Style
      </Typography>
      <Stack spacing={2}>
        <Box>
          <Box sx={{ display: "flex", alignItems: "center", mb: 0.5 }}>
            <InputLabel sx={{ ...labelSx, fontSize: "0.875rem" }}>Visual Style Guide (Optional)</InputLabel>
            <Tooltip
              title="Describe the visual style, mood, or specific scenes you want for your video. Use descriptive keywords like colors, lighting, composition, atmosphere. This helps AI generate consistent visuals that match your vision. Examples: 'neon-lit Tokyo alley, rainy night, cinematic bokeh' or 'bright, clean, modern office space'"
              arrow
              sx={tooltipSx}
              PopperProps={tooltipPopperProps}
            >
              <IconButton size="small" sx={{ ml: 0.5, p: 0.25, color: "#64748b" }}>
                <InfoOutlined fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>
          <TextField
            placeholder="Example: 'neon-lit Tokyo alley, rainy night, cinematic bokeh' or 'bright, clean, modern office space'"
            value={referenceImage}
            onChange={(event) => onReferenceImageChange(event.target.value)}
            multiline
            rows={2}
            fullWidth
            size="small"
            helperText="Optional: Describe visual style, mood, or scenes to guide AI-generated visuals."
            sx={{ ...inputSx, "& .MuiInputBase-root": { fontSize: "0.875rem" } }}
            FormHelperTextProps={{ sx: { ...helperSx, fontSize: "0.75rem" } }}
          />
        </Box>

        <Box>
          <Typography variant="body2" sx={{ fontWeight: 500, mb: 1, color: "#475569" }}>
            Creator Avatar
          </Typography>
          <Typography variant="caption" sx={{ color: "#64748b", mb: 1.5, display: "block" }}>
            <strong>Option 1:</strong> Upload your photo → Click &quot;Make Presentable&quot; to optimize it with AI
            <br />
            <strong>Option 2:</strong> Skip upload → AI will auto-generate a creator avatar in the next step
          </Typography>

          <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} alignItems="flex-start">
            {avatarPreview ? (
              <>
                <Box sx={{ position: "relative", width: 120, flexShrink: 0 }}>
                  {avatarLoading ? (
                    <Box
                      sx={{
                        width: "100%",
                        height: 120,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        bgcolor: "#f1f5f9",
                        borderRadius: 1.5,
                        border: "1px solid #e2e8f0",
                      }}
                    >
                      <Typography variant="caption" sx={{ color: "#64748b" }}>
                        Loading...
                      </Typography>
                    </Box>
                  ) : (
                    <Box
                      component="img"
                      src={avatarBlobUrl || undefined}
                      alt="Avatar preview"
                      onError={() => {
                        console.warn("[PlanStep] Avatar image failed to load", {
                          hasBlobUrl: Boolean(avatarBlobUrl),
                        });
                      }}
                      sx={{
                        width: "100%",
                        height: 120,
                        objectFit: "cover",
                        borderRadius: 1.5,
                        border: "1px solid #e2e8f0",
                        display: avatarBlobUrl ? "block" : "none",
                      }}
                    />
                  )}
                  <IconButton
                    size="small"
                    onClick={onRemoveAvatar}
                    sx={{
                      position: "absolute",
                      top: -8,
                      right: -8,
                      bgcolor: "white",
                      border: "1px solid #e2e8f0",
                      width: 24,
                      height: 24,
                      "&:hover": { bgcolor: "#f8fafc" },
                      "& svg": { fontSize: "0.875rem" },
                    }}
                  >
                    <Delete fontSize="small" />
                  </IconButton>
                </Box>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <OperationButton
                    operation={imageEditingOperation}
                    label="Make Presentable"
                    variant="contained"
                    size="medium"
                    color="primary"
                    startIcon={<AutoAwesome fontSize="small" />}
                    onClick={onMakePresentable}
                    disabled={makingPresentable}
                    loading={makingPresentable}
                    checkOnHover
                    checkOnMount={false}
                    showCost
                    sx={presentableSx}
                    buttonProps={{
                      children: makingPresentable ? "Transforming..." : undefined,
                    }}
                  />
                  <Typography variant="caption" sx={{ display: "block", mt: 0.75, color: "#64748b", fontSize: "0.75rem" }}>
                    AI will optimize your photo using your video type, audience, and style preferences.
                  </Typography>
                  <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
                    <Button
                      variant="outlined"
                      startIcon={<Collections />}
                      onClick={() => setAssetLibraryOpen(true)}
                      fullWidth
                      sx={{
                        borderColor: "#d1d5db",
                        color: "#6b7280",
                        "&:hover": { borderColor: YT_RED, backgroundColor: "#f9fafb" },
                      }}
                    >
                      Upload from Asset Library
                    </Button>
                  </Stack>
                </Box>
              </>
            ) : (
              <Box
                component="label"
                sx={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  width: "100%",
                  minHeight: 100,
                  border: "2px dashed #cbd5e1",
                  borderRadius: 1.5,
                  bgcolor: "#f8fafc",
                  cursor: "pointer",
                  py: 1.5,
                  "&:hover": { borderColor: YT_RED, bgcolor: "#f1f5f9" },
                }}
              >
                <input type="file" accept="image/*" onChange={handleFileChange} style={{ display: "none" }} />
                <CloudUpload sx={{ color: "#94a3b8", fontSize: 28, mb: 0.75 }} />
                <Typography variant="body2" sx={{ color: "#475569", fontWeight: 600, fontSize: "0.875rem" }}>
                  {uploadingAvatar ? "Uploading..." : "Upload Your Photo (Optional)"}
                </Typography>
                <Typography variant="caption" sx={{ color: "#94a3b8", textAlign: "center", px: 2, fontSize: "0.75rem" }}>
                  Max 5MB. JPG, PNG, WebP. Clear, front-facing photos work best.
                </Typography>
                <Button
                  variant="outlined"
                  startIcon={<Collections />}
                  onClick={() => setAssetLibraryOpen(true)}
                  fullWidth
                  sx={{
                    mt: 1.5,
                    borderColor: "#d1d5db",
                    color: "#6b7280",
                    "&:hover": { borderColor: YT_RED, backgroundColor: "#f9fafb" },
                  }}
                >
                  Upload from Asset Library
                </Button>
              </Box>
            )}
          </Stack>
        </Box>
      </Stack>
      <AssetLibraryImageModal
        open={assetLibraryOpen}
        onClose={() => setAssetLibraryOpen(false)}
        onSelect={handleAssetLibrarySelect}
        title="Select Avatar from Asset Library"
        sourceModule={undefined}
        allowFavoritesOnly={false}
        showBrandAvatarShortcut
      />
    </Paper>
  );
};
