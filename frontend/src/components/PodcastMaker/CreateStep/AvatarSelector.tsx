import React from "react";
import { Stack, Box, Typography, Tabs, Tab, CircularProgress, Button, IconButton, Tooltip, alpha, useTheme, useMediaQuery, Chip } from "@mui/material";
import {
  Person as PersonIcon,
  Info as InfoIcon,
  CheckCircle as CheckCircleIcon,
  Refresh as RefreshIcon,
  Collections as CollectionsIcon,
  Delete as DeleteIcon,
  AutoAwesome as AutoAwesomeIcon,
  CloudUpload as CloudUploadIcon,
  PhotoCamera as PhotoCameraIcon,
} from "@mui/icons-material";
import { AvatarAssetBrowser } from "../AvatarAssetBrowser";
import { CameraSelfie } from "../CameraSelfie";
import { PodcastMode } from "../types";
import { useSubscription } from "../../../contexts/SubscriptionContext";
import { useModelPricing } from "../../../hooks/useModelPricing";

interface AvatarSelectorProps {
  avatarTab: number;
  setAvatarTab: (event: React.SyntheticEvent, newValue: number) => void;
  avatarFile: File | null;
  avatarPreview: string | null;
  avatarUrl: string | null;
  loadingBrandAvatar: boolean;
  handleUseBrandAvatar: () => void;
  handleAvatarSelectFromLibrary: (url: string) => void;
  handleAvatarChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleCameraSelfie: (imageDataUrl: string) => void;
  handleRemoveAvatar: () => void;
  handleMakePresentable: () => void;
  makingPresentable: boolean;
  avatarPreviewBlobUrl: string | null;
  brandAvatarFromDb?: string | null;
  brandAvatarBlobUrl?: string | null;
  cameraSelfieOpen: boolean;
  setCameraSelfieOpen: (open: boolean) => void;
  podcastMode?: PodcastMode;
  presenterReferenceUrl?: string | null;
  presenterReferenceBlobUrl?: string | null;
  generatingPresenterReference?: boolean;
  onGeneratePresenterReference?: (forceRegenerate?: boolean, styleIndex?: number) => void;
  presenterStyleIndex?: number;
}

export const AvatarSelector: React.FC<AvatarSelectorProps> = ({
  avatarTab,
  setAvatarTab,
  avatarFile,
  avatarPreview,
  avatarUrl,
  loadingBrandAvatar,
  handleUseBrandAvatar,
  handleAvatarSelectFromLibrary,
  handleAvatarChange,
  handleCameraSelfie,
  handleRemoveAvatar,
  handleMakePresentable,
  makingPresentable,
  avatarPreviewBlobUrl,
  brandAvatarFromDb,
  brandAvatarBlobUrl,
  cameraSelfieOpen,
  setCameraSelfieOpen,
  podcastMode,
  presenterReferenceUrl,
  presenterReferenceBlobUrl,
  generatingPresenterReference,
  onGeneratePresenterReference,
  presenterStyleIndex,
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isTablet = useMediaQuery(theme.breakpoints.down('md'));

  const { subscription } = useSubscription();
  const { getImageCostDisplay } = useModelPricing();
  const presenterCostDisplay = getImageCostDisplay('flux-kontext-pro', 0.04);
  const customAvatarCostDisplay = getImageCostDisplay('flux-kontext-pro', 0.04);
  const isFreeTier = !subscription || subscription.tier?.toLowerCase() === 'free' || subscription.plan?.toLowerCase() === 'free';

  // Shorter tab labels for mobile
  const tabLabels = isMobile 
    ? ["AI Host", "Brand", "Library", "Selfie", avatarFile && avatarPreview ? "Uploaded" : "Upload"]
    : ["AI Studio Host", "Use Brand Avatar", "Asset Library", "Take Selfie", avatarFile && avatarPreview ? "Successfully Uploaded" : "Upload Your Photo"];

  if (podcastMode === "audio_only") {
    return (
      <Box
        sx={{
          flex: 1,
          minWidth: 0,
          p: { xs: 1.5, sm: 2.5 },
          borderRadius: 2,
          background: "#f8fafc",
          border: "1px dashed rgba(15, 23, 42, 0.12)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          minHeight: 200,
        }}
      >
        <Stack spacing={1} alignItems="center" sx={{ textAlign: "center" }}>
          <PersonIcon sx={{ color: "#94a3b8", fontSize: 40 }} />
          <Typography variant="subtitle2" sx={{ color: "#64748b", fontWeight: 600 }}>
            No avatar needed for audio-only
          </Typography>
          <Typography variant="caption" sx={{ color: "#94a3b8" }}>
            Avatar is only used for video podcasts. Switch to Video or Both to enable.
          </Typography>
        </Stack>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        flex: 1,
        minWidth: 0,
        borderRadius: 3,
        background: "#ffffff",
        border: "1px solid",
        borderColor: "#e2e8f0",
        boxShadow: "0 8px 30px rgba(15, 23, 42, 0.12)",
        position: "relative",
        overflow: "hidden",
        "&::before": {
          content: '""',
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: "3px",
          background: "linear-gradient(90deg, #667eea 0%, #764ba2 50%, #667eea 100%)",
        },
      }}
    >
      {/* Header with Tabs */}
      <Box sx={{ px: 2.5, pt: 2.5, pb: 1.5, background: "linear-gradient(180deg, #eff6ff 0%, #f0f9ff 60%, #ffffff 100%)", borderBottom: "1px solid #e0e7ff" }}>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={{ xs: 1.5, sm: 1.5 }} alignItems={{ xs: "flex-start", sm: "center" }} justifyContent="space-between">
          <Stack direction="row" spacing={1.5} alignItems="center">
            <Box
              sx={{
                width: 28,
                height: 28,
                borderRadius: "50%",
                background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "0 2px 8px rgba(102, 126, 234, 0.3), inset 0 1px 0 rgba(255,255,255,0.2)",
              }}
            >
              <Typography sx={{ color: "#fff", fontSize: "0.75rem", fontWeight: 700 }}>3</Typography>
            </Box>
            <Box
              sx={{
                width: 40,
                height: 40,
                borderRadius: 2,
                background: "linear-gradient(135deg, rgba(99, 102, 241, 0.15) 0%, rgba(139, 92, 246, 0.15) 100%)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
                boxShadow: "inset 0 1px 0 rgba(255,255,255,0.5)",
              }}
            >
              <PersonIcon fontSize="medium" sx={{ color: "#6366f1" }} />
            </Box>
            <Box>
              <Stack direction="row" spacing={1} alignItems="center">
                <Typography variant="subtitle1" sx={{ color: "#0f172a", fontWeight: 700, fontSize: "1rem", letterSpacing: "-0.01em" }}>
                  Podcast Presenter Avatar
                </Typography>
              </Stack>
              <Typography variant="caption" sx={{ color: "#64748b", fontSize: "0.75rem", display: "block", mt: -0.25 }}>
                Select or upload an image for your presenter, or use an AI studio presenter
              </Typography>
            </Box>
          </Stack>
          
          {/* Tabs in header - Mobile Responsive */}
          <Tabs 
            value={avatarTab} 
            onChange={setAvatarTab}
            variant="scrollable"
            scrollButtons="auto"
            allowScrollButtonsMobile
            sx={{ 
              minHeight: { xs: 32, sm: 38 },
              "& .MuiTabs-scrollButtons": {
                color: "#64748b",
                "&.Mui-disabled": { opacity: 0.3 },
              },
              "& .MuiTabs-indicator": {
                display: "none",
              },
              "& .MuiTabs-flexContainer": {
                gap: 0.5,
              },
              "& .MuiTab-root": {
                textTransform: "none",
                minHeight: { xs: 28, sm: 36 },
                fontWeight: 600,
                fontSize: { xs: "0.65rem", sm: "0.8rem" },
                borderRadius: 1,
                px: { xs: 1, sm: 1.5 },
                py: 0.5,
                minWidth: "auto",
                color: "#64748b",
                border: "1px solid #e2e8f0",
                backgroundColor: "#ffffff",
                transition: "all 0.2s ease",
                "&:hover": {
                  borderColor: "#c7d2fe",
                  backgroundColor: "#eef2ff",
                },
                "&.Mui-selected": {
                  color: "#ffffff",
                  borderColor: "transparent",
                  background: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)",
                  boxShadow: "0 2px 8px rgba(99, 102, 241, 0.3)",
                },
              },
            }}
          >
            {tabLabels.map((label, index) => (
              <Tab key={index} label={label} />
            ))}
          </Tabs>
          
          <Tooltip
            title={
              <Box sx={{ p: 1 }}>
                <Typography variant="body2" sx={{ fontWeight: 600, mb: 1, color: "#fff" }}>
                  Avatar Options:
                </Typography>
                <Typography variant="caption" component="div" sx={{ lineHeight: 1.6, color: "#e5e7eb" }}>
                  <strong>AI Studio Presenter:</strong> Generates a consistent AI studio presenter ({presenterCostDisplay}).<br/>
                  <strong>Custom Photo Clone:</strong> Upload or capture your photo to create a consistent presenter clone across all scenes ({customAvatarCostDisplay}).
                </Typography>
              </Box>
            }
            arrow
            placement="top"
          >
            <InfoIcon fontSize="small" sx={{ color: "#94a3b8", cursor: "help" }} />
          </Tooltip>
        </Stack>
      </Box>
      
      {/* Content Area */}
      <Stack direction={{ xs: "column", lg: "row" }} spacing={3} alignItems="flex-start" sx={{ p: 2.5 }}>
        {/* Left Side: Content based on selected tab */}
        <Box sx={{ flex: 1, width: "100%" }}>

          {avatarTab === 0 && (
            <Stack direction={{ xs: "column", sm: "row" }} spacing={3} alignItems="center">
              {/* Left: Presenter Image Frame / Preview */}
              <Box
                sx={{
                  width: { xs: "100%", sm: 220 },
                  height: { xs: 180, sm: 220 },
                  borderRadius: 2.5,
                  bgcolor: "#f8fafc",
                  border: "2px dashed",
                  borderColor: presenterReferenceUrl ? "#6366f1" : "#cbd5e1",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  position: "relative",
                  overflow: "hidden",
                  boxShadow: presenterReferenceUrl ? "0 8px 24px rgba(99, 102, 241, 0.18)" : "none",
                  flexShrink: 0,
                }}
              >
                {generatingPresenterReference ? (
                  <Stack spacing={1.5} alignItems="center" sx={{ p: 2, textAlign: "center" }}>
                    <CircularProgress size={36} sx={{ color: "#6366f1" }} />
                    <Typography variant="caption" sx={{ color: "#475569", fontWeight: 600 }}>
                      Generating Studio Presenter...
                    </Typography>
                    <Typography variant="caption" sx={{ color: "#94a3b8", fontSize: "0.7rem" }}>
                      Locking 5600K lighting & identity anchor
                    </Typography>
                  </Stack>
                ) : presenterReferenceUrl ? (
                  <>
                    <Box
                      component="img"
                      src={presenterReferenceBlobUrl || presenterReferenceUrl}
                      alt="Locked AI Studio Presenter"
                      sx={{
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                        display: "block",
                      }}
                    />
                    <Box
                      sx={{
                        position: "absolute",
                        bottom: 0,
                        left: 0,
                        right: 0,
                        background: "linear-gradient(180deg, transparent 0%, rgba(15, 23, 42, 0.85) 100%)",
                        p: 1.25,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                      }}
                    >
                      <Stack direction="row" spacing={0.75} alignItems="center">
                        <CheckCircleIcon sx={{ color: "#10b981", fontSize: 16 }} />
                        <Typography sx={{ color: "#ffffff", fontSize: "0.75rem", fontWeight: 700 }}>
                          Host Locked
                        </Typography>
                      </Stack>
                      <Tooltip title="Re-roll to generate another diverse professional presenter">
                        <IconButton
                          size="small"
                          onClick={() => onGeneratePresenterReference?.(true, ((presenterStyleIndex ?? 0) + 1) % 5)}
                          sx={{
                            bgcolor: "rgba(255, 255, 255, 0.2)",
                            color: "#fff",
                            "&:hover": { bgcolor: "rgba(255, 255, 255, 0.4)" },
                            p: 0.5,
                          }}
                        >
                          <RefreshIcon sx={{ fontSize: 16 }} />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  </>
                ) : (
                  <Stack spacing={1.5} alignItems="center" sx={{ p: 2, textAlign: "center" }}>
                    <Box
                      sx={{
                        width: 48,
                        height: 48,
                        borderRadius: "50%",
                        background: "linear-gradient(135deg, rgba(99, 102, 241, 0.15) 0%, rgba(139, 92, 246, 0.15) 100%)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <PersonIcon sx={{ color: "#6366f1", fontSize: 28 }} />
                    </Box>
                    <Typography variant="caption" sx={{ color: "#64748b", fontWeight: 600 }}>
                      AI Studio Host
                    </Typography>
                    <Button
                      variant="contained"
                      size="small"
                      onClick={() => onGeneratePresenterReference?.(false)}
                      startIcon={<AutoAwesomeIcon sx={{ fontSize: 16 }} />}
                      sx={{
                        borderRadius: 1.5,
                        textTransform: "none",
                        fontWeight: 600,
                        fontSize: "0.75rem",
                        background: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)",
                        boxShadow: "0 2px 8px rgba(99, 102, 241, 0.3)",
                        px: 1.5,
                        py: 0.5,
                      }}
                    >
                      Preview Presenter
                    </Button>
                  </Stack>
                )}
              </Box>

              {/* Right: Explanation & Controls */}
              <Box sx={{ flex: 1, width: "100%" }}>
                <Stack spacing={2}>
                  <Box>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Typography variant="subtitle1" sx={{ fontWeight: 700, color: "#0f172a", fontSize: "0.95rem" }}>
                        Consistent AI Studio Presenter
                      </Typography>
                      <Chip
                        label={presenterReferenceUrl ? "Anchored" : "Auto-Generated"}
                        size="small"
                        sx={{
                          background: presenterReferenceUrl ? "rgba(16, 185, 129, 0.12)" : "rgba(99, 102, 241, 0.12)",
                          color: presenterReferenceUrl ? "#059669" : "#4f46e5",
                          fontWeight: 700,
                          fontSize: "0.65rem",
                          height: 20,
                        }}
                      />
                    </Stack>
                    <Typography variant="body2" sx={{ color: "#475569", mt: 0.5, fontSize: "0.825rem", lineHeight: 1.5 }}>
                      This reference image is generated once upfront and acts as the real <strong>image-to-image anchor</strong> ({presenterCostDisplay}) for all scenes in your episode. Ethnicity, facial structure, skin tone, and wardrobe remain consistent across all camera angles.
                    </Typography>
                  </Box>

                  {presenterReferenceUrl && (
                    <Stack direction="row" spacing={1.5} alignItems="center">
                      <Button
                        variant="outlined"
                        size="small"
                        startIcon={<RefreshIcon />}
                        onClick={() => onGeneratePresenterReference?.(true, ((presenterStyleIndex ?? 0) + 1) % 5)}
                        disabled={generatingPresenterReference}
                        sx={{
                          borderRadius: 1.5,
                          textTransform: "none",
                          fontWeight: 600,
                          fontSize: "0.75rem",
                          borderColor: "#c7d2fe",
                          color: "#4338ca",
                          "&:hover": { borderColor: "#6366f1", bgcolor: "#eef2ff" },
                        }}
                      >
                        Re-roll AI Presenter
                      </Button>
                      <Typography variant="caption" sx={{ color: "#64748b" }}>
                        Cycles between 5 diverse studio host looks
                      </Typography>
                    </Stack>
                  )}

                  <Box
                    sx={{
                      p: 1.25,
                      borderRadius: 1.5,
                      background: alpha("#f0f4ff", 0.6),
                      border: "1px solid rgba(99, 102, 241, 0.2)",
                    }}
                  >
                    <Typography variant="caption" sx={{ color: "#475569", display: "block", fontSize: "0.75rem" }}>
                      💡 To clone your own face instead, click the <strong>"Take Selfie"</strong> or <strong>"Upload Your Photo"</strong> tabs above.
                    </Typography>
                  </Box>
                </Stack>
              </Box>
            </Stack>
          )}

          {avatarTab === 1 && (
            <Stack spacing={2}>
              <Box sx={{ minHeight: { xs: 160, sm: 200 }, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", bgcolor: "#f8fafc", borderRadius: 2, p: { xs: 1.5, sm: 2 }, position: "relative" }}>
                {loadingBrandAvatar ? (
                  <CircularProgress size={32} />
                ) : avatarPreview && avatarPreview === brandAvatarFromDb ? (
                  <Stack spacing={2} alignItems="center" sx={{ width: "100%", maxWidth: { xs: 220, sm: 280 } }}>
                    <Box sx={{ position: "relative", width: "100%" }}>
                      <Box
                        component="img"
                        src={avatarPreviewBlobUrl || ""}
                        alt="Selected Brand Avatar"
                        sx={{
                          width: "100%",
                          height: "auto",
                          maxHeight: { xs: 160, sm: 200 },
                          objectFit: "contain",
                          borderRadius: 2,
                          border: "2px solid #667eea",
                          boxShadow: "0 4px 12px rgba(102, 126, 234, 0.25)",
                        }}
                      />
                      <IconButton
                        size="small"
                        onClick={handleRemoveAvatar}
                        sx={{
                          position: "absolute",
                          top: -8,
                          right: -8,
                          bgcolor: "white",
                          border: "1.5px solid #e2e8f0",
                          boxShadow: "0 2px 4px rgba(15, 23, 42, 0.1)",
                          "&:hover": {
                            bgcolor: "#fef2f2",
                            borderColor: "#ef4444",
                            color: "#ef4444",
                          },
                        }}
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Box>
                    <Stack direction="row" alignItems="center" spacing={1}>
                      <CheckCircleIcon color="primary" fontSize="small" />
                      <Typography variant="body2" sx={{ color: "#64748b", fontStyle: "italic" }}>
                        Active Presenter
                      </Typography>
                    </Stack>
                  </Stack>
                ) : brandAvatarFromDb ? (
                  <Stack spacing={2} alignItems="center" sx={{ width: "100%", maxWidth: { xs: 220, sm: 280 } }}>
                    <Box
                      component="img"
                      src={brandAvatarBlobUrl || ""}
                      alt="Available Brand Avatar"
                      sx={{
                        width: "100%",
                        height: "auto",
                        maxHeight: { xs: 160, sm: 200 },
                        objectFit: "contain",
                        borderRadius: 2,
                        border: "1.5px solid #e2e8f0",
                        opacity: 0.8,
                        filter: "grayscale(0.3)",
                      }}
                    />
                    <Button 
                      variant="contained" 
                      size="small" 
                      onClick={handleUseBrandAvatar}
                      startIcon={<CheckCircleIcon />}
                      sx={{ 
                        borderRadius: "8px",
                        textTransform: "none",
                        background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                      }}
                    >
                      Use this Avatar
                    </Button>
                  </Stack>
                ) : (
                  <Stack spacing={2} alignItems="center">
                    <PersonIcon sx={{ fontSize: { xs: 36, sm: 48 }, color: "#cbd5e1" }} />
                    <Typography variant="body2" color="text.secondary" sx={{ textAlign: "center", px: 2 }}>
                      No brand avatar found.
                    </Typography>
                    <Button size="small" startIcon={<RefreshIcon />} onClick={() => void handleUseBrandAvatar()}>
                      Retry
                    </Button>
                  </Stack>
                )}
              </Box>
              <Box
                sx={{
                  p: { xs: 1, sm: 1.5 },
                  borderRadius: 1.5,
                  background: alpha("#f0f4ff", 0.6),
                  border: "1px solid rgba(99, 102, 241, 0.2)",
                }}
              >
                <Typography variant="body2" sx={{ color: "#0f172a", fontSize: { xs: "0.75rem", sm: "0.875rem" }, fontWeight: 600, mb: 0.5, display: "flex", alignItems: "center", gap: 0.5 }}>
                  <AutoAwesomeIcon fontSize="small" sx={{ color: "#667eea" }} />
                  Brand Avatar
                </Typography>
                <Typography variant="body2" sx={{ color: "#475569", fontSize: { xs: "0.75rem", sm: "0.8125rem" }, lineHeight: 1.6 }}>
                  Select your pre-configured brand avatar to maintain consistency. If not selected, a new AI presenter will be generated.
                </Typography>
              </Box>
            </Stack>
          )}

          {avatarTab === 2 && (
            <Stack spacing={2}>
              <Box sx={{ minHeight: { xs: 240, sm: 300 }, position: "relative" }}>
                {avatarPreview && !avatarFile && (
                  <IconButton
                    size="small"
                    onClick={handleRemoveAvatar}
                    sx={{
                      position: "absolute",
                      top: 8,
                      right: 8,
                      zIndex: 10,
                      bgcolor: "white",
                      border: "1.5px solid #e2e8f0",
                      boxShadow: "0 2px 4px rgba(15, 23, 42, 0.1)",
                      "&:hover": {
                        bgcolor: "#fef2f2",
                        borderColor: "#ef4444",
                        color: "#ef4444",
                      },
                    }}
                  >
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                )}
                <AvatarAssetBrowser
                  selectedUrl={avatarUrl}
                  onSelect={(url) => handleAvatarSelectFromLibrary(url)}
                />
              </Box>
              <Box
                sx={{
                  p: { xs: 1, sm: 1.5 },
                  borderRadius: 1.5,
                  background: alpha("#f8fafc", 0.8),
                  border: "1px solid rgba(15, 23, 42, 0.1)",
                }}
              >
                <Typography variant="body2" sx={{ color: "#0f172a", fontSize: { xs: "0.75rem", sm: "0.875rem" }, fontWeight: 600, mb: 0.5, display: "flex", alignItems: "center", gap: 0.5 }}>
                  <CollectionsIcon fontSize="small" sx={{ color: "#64748b" }} />
                  Asset Library
                </Typography>
                <Typography variant="body2" sx={{ color: "#475569", fontSize: { xs: "0.75rem", sm: "0.8125rem" }, lineHeight: 1.6 }}>
                  Select from your previously uploaded images. Filter by favorites or search to find the perfect presenter.
                </Typography>
              </Box>
            </Stack>
          )}

          {avatarTab === 3 && (
            <Stack spacing={2}>
              <Box>
                {avatarFile && avatarPreview ? (
                  <Stack spacing={2} alignItems="center" sx={{ bgcolor: "#f8fafc", borderRadius: 2, p: { xs: 1.5, sm: 2 } }}>
                    <Box sx={{ position: "relative", display: "inline-block", width: "100%", maxWidth: { xs: 220, sm: 280 } }}>
                      <Box
                        component="img"
                        src={avatarPreviewBlobUrl || avatarPreview || ""}
                        alt="Selfie preview"
                        sx={{
                          width: "100%",
                          height: "auto",
                          maxHeight: { xs: 160, sm: 200 },
                          objectFit: "contain",
                          borderRadius: 2,
                          border: "2px solid #e2e8f0",
                          boxShadow: "0 2px 8px rgba(15, 23, 42, 0.08)",
                        }}
                      />
                      <IconButton
                        size="small"
                        onClick={handleRemoveAvatar}
                        sx={{
                          position: "absolute",
                          top: -8,
                          right: -8,
                          bgcolor: "white",
                          border: "1.5px solid #e2e8f0",
                          boxShadow: "0 2px 4px rgba(15, 23, 42, 0.1)",
                          "&:hover": {
                            bgcolor: "#f8fafc",
                            borderColor: "#dc2626",
                            color: "#dc2626",
                          },
                        }}
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Box>

                    {avatarUrl && (
                      <Tooltip
                        title="Transform your selfie into a professional podcast presenter."
                        arrow
                        placement="top"
                      >
                        <Box sx={{ width: "100%", maxWidth: { xs: 220, sm: 280 } }}>
                          <Button
                            onClick={handleMakePresentable}
                            disabled={makingPresentable}
                            variant="contained"
                            startIcon={!makingPresentable ? <AutoAwesomeIcon fontSize="small" /> : <CircularProgress size={14} thickness={5} sx={{ color: "rgba(255,255,255,0.92)" }} />}
                            sx={{
                              width: "100%",
                              textTransform: "none",
                              fontSize: { xs: "0.75rem", sm: "0.875rem" },
                              fontWeight: 600,
                              borderRadius: 2.5,
                              color: "#f8fbff",
                              px: 1.8,
                              border: "1px solid rgba(148, 211, 255, 0.6)",
                              background: "linear-gradient(120deg, #0ea5e9 0%, #2563eb 55%, #1d4ed8 100%)",
                              boxShadow: "0 8px 18px rgba(37, 99, 235, 0.28), inset 0 1px 0 rgba(255,255,255,0.22)",
                              "&:hover": {
                                background: "linear-gradient(120deg, #38bdf8 0%, #2563eb 50%, #1e40af 100%)",
                                boxShadow: "0 12px 24px rgba(29, 78, 216, 0.35), inset 0 1px 0 rgba(255,255,255,0.26)",
                                transform: "translateY(-1px)",
                              },
                              "&.Mui-disabled": {
                                color: "#e2e8f0",
                                borderColor: "rgba(186, 230, 253, 0.7)",
                                background: "linear-gradient(120deg, #0ea5e9 0%, #2563eb 55%, #1d4ed8 100%)",
                                opacity: 0.78,
                              },
                            }}
                          >
                            {makingPresentable ? "Transforming..." : "Make Presentable"}
                          </Button>
                        </Box>
                      </Tooltip>
                    )}
                  </Stack>
                ) : (
                  <Box
                    component="button"
                    onClick={() => setCameraSelfieOpen(true)}
                    sx={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      width: "100%",
                      minHeight: { xs: 160, sm: 200 },
                      border: "2px dashed #cbd5e1",
                      borderRadius: 2.5,
                      bgcolor: "#f8fafc",
                      cursor: "pointer",
                      transition: "all 0.2s",
                      "&:hover": {
                        borderColor: "#667eea",
                        bgcolor: "#f1f5f9",
                        borderWidth: "2.5px",
                        boxShadow: "0 0 0 3px rgba(102, 126, 234, 0.08)",
                      },
                    }}
                  >
                    <PhotoCameraIcon sx={{ color: "#94a3b8", fontSize: { xs: 28, sm: 36 }, mb: 1.5 }} />
                    <Typography variant="body2" sx={{ color: "#64748b", fontWeight: 600, mb: 0.5 }}>
                      Take a Selfie
                    </Typography>
                    <Typography variant="caption" sx={{ color: "#94a3b8", textAlign: "center", px: 2, lineHeight: 1.5 }}>
                      Use your camera to capture a photo instantly
                    </Typography>
                  </Box>
                )}
              </Box>
              <Box
                sx={{
                  p: { xs: 1, sm: 1.5 },
                  borderRadius: 1.5,
                  background: alpha("#f0f4ff", 0.6),
                  border: "1px solid rgba(99, 102, 241, 0.2)",
                }}
              >
                <Stack direction="row" alignItems="center" spacing={0.5}>
                  <PhotoCameraIcon fontSize="small" sx={{ color: "#667eea" }} />
                  <Typography variant="body2" sx={{ color: "#0f172a", fontSize: { xs: "0.75rem", sm: "0.8125rem" }, fontWeight: 600 }}>
                    Capture a photo using your device camera and use "Make Presentable" to enhance it. Camera access required.
                  </Typography>
                </Stack>
              </Box>
            </Stack>
          )}

          {avatarTab === 4 && (
            <Stack spacing={2}>
              <Box>
                  {avatarFile && avatarPreview ? (
                  <Stack spacing={2} alignItems="center" sx={{ bgcolor: "#f8fafc", borderRadius: 2, p: { xs: 1.5, sm: 2 } }}>
                    <Box sx={{ position: "relative", display: "inline-block" }}>
                      <Box
                        component="img"
                        src={avatarPreviewBlobUrl || avatarPreview || ""}
                        alt="Avatar preview"
                        sx={{
                          width: { xs: 120, sm: 160 },
                          height: { xs: 120, sm: 160 },
                          objectFit: "cover",
                          borderRadius: 2.5,
                          border: "2px solid #667eea",
                          boxShadow: "0 4px 12px rgba(102, 126, 234, 0.25)",
                        }}
                      />
                      <IconButton
                        size="small"
                        onClick={handleRemoveAvatar}
                        sx={{
                          position: "absolute",
                          top: -8,
                          right: -8,
                          bgcolor: "white",
                          border: "1.5px solid #e2e8f0",
                          boxShadow: "0 2px 4px rgba(15, 23, 42, 0.1)",
                          "&:hover": {
                            bgcolor: "#f8fafc",
                            borderColor: "#dc2626",
                            color: "#dc2626",
                          },
                        }}
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Box>
                    <Stack direction="row" alignItems="center" spacing={1}>
                      <CheckCircleIcon color="primary" fontSize="small" />
                      <Typography variant="body2" sx={{ color: "#475569", fontStyle: "italic" }}>
                        Photo uploaded successfully
                      </Typography>
                    </Stack>

                    {avatarUrl && (
                      <Tooltip
                        title="Transform your uploaded photo into a professional podcast presenter."
                        arrow
                        placement="top"
                      >
                        <Box sx={{ width: "100%", maxWidth: { xs: 200, sm: 280 } }}>
                          <Button
                            onClick={handleMakePresentable}
                            disabled={makingPresentable}
                            variant="contained"
                            startIcon={!makingPresentable ? <AutoAwesomeIcon fontSize="small" /> : <CircularProgress size={14} thickness={5} sx={{ color: "rgba(255,255,255,0.92)" }} />}
                            sx={{
                              width: "100%",
                              textTransform: "none",
                              fontSize: { xs: "0.75rem", sm: "0.875rem" },
                              fontWeight: 600,
                              borderRadius: 2.5,
                              color: "#f8fbff",
                              px: 1.8,
                              border: "1px solid rgba(148, 211, 255, 0.6)",
                              background: "linear-gradient(120deg, #0ea5e9 0%, #2563eb 55%, #1d4ed8 100%)",
                              boxShadow: "0 8px 18px rgba(37, 99, 235, 0.28), inset 0 1px 0 rgba(255,255,255,0.22)",
                              "&:hover": {
                                background: "linear-gradient(120deg, #38bdf8 0%, #2563eb 50%, #1e40af 100%)",
                                boxShadow: "0 12px 24px rgba(29, 78, 216, 0.35), inset 0 1px 0 rgba(255,255,255,0.26)",
                                transform: "translateY(-1px)",
                              },
                              "&.Mui-disabled": {
                                color: "#e2e8f0",
                                borderColor: "rgba(186, 230, 253, 0.7)",
                                background: "linear-gradient(120deg, #0ea5e9 0%, #2563eb 55%, #1d4ed8 100%)",
                                opacity: 0.78,
                              },
                            }}
                          >
                            {makingPresentable ? "Transforming..." : "Make Presentable"}
                          </Button>
                        </Box>
                      </Tooltip>
                    )}
                  </Stack>
                ) : (
                  <Box
                    component="label"
                    sx={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      width: "100%",
                      minHeight: { xs: 160, sm: 200 },
                      border: "2px dashed #cbd5e1",
                      borderRadius: 2.5,
                      bgcolor: "#f8fafc",
                      cursor: "pointer",
                      transition: "all 0.2s",
                      "&:hover": {
                        borderColor: "#667eea",
                        bgcolor: "#f1f5f9",
                        borderWidth: "2.5px",
                        boxShadow: "0 0 0 3px rgba(102, 126, 234, 0.08)",
                      },
                    }}
                  >
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleAvatarChange}
                      style={{ display: "none" }}
                    />
                    <CloudUploadIcon sx={{ color: "#94a3b8", fontSize: { xs: 28, sm: 36 }, mb: 1.5 }} />
                    <Typography variant="body2" sx={{ color: "#64748b", fontWeight: 600, mb: 0.5 }}>
                      Upload Your Photo
                    </Typography>
                    <Typography variant="caption" sx={{ color: "#94a3b8", textAlign: "center", px: 2, lineHeight: 1.5 }}>
                      JPG, PNG, WebP (max 5MB)
                    </Typography>
                  </Box>
                )}
              </Box>
              <Box
                sx={{
                  p: { xs: 1, sm: 1.5 },
                  borderRadius: 1.5,
                  background: alpha("#f0f4ff", 0.6),
                  border: "1px solid rgba(99, 102, 241, 0.2)",
                }}
              >
                <Stack direction="row" alignItems="center" spacing={0.5}>
                  <CloudUploadIcon fontSize="small" sx={{ color: "#667eea" }} />
                  <Typography variant="body2" sx={{ color: "#0f172a", fontSize: { xs: "0.75rem", sm: "0.8125rem" }, fontWeight: 600 }}>
                    Upload a photo and use "Make Presentable" to enhance it into a professional presenter. Supported: JPG, PNG, WebP (max 5MB)
                  </Typography>
                </Stack>
              </Box>
            </Stack>
          )}
        </Box>
      </Stack>

      {/* Camera Selfie Dialog */}
      <CameraSelfie
        open={cameraSelfieOpen}
        onClose={() => setCameraSelfieOpen(false)}
        onCapture={handleCameraSelfie}
      />
    </Box>
  );
};
