import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import {
  Box,
  Typography,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Stack,
  Button,
  Chip,
  CircularProgress,
  Tooltip,
  alpha,
  IconButton,
  ListItemIcon,
  ListItemText,
  Collapse,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Slider,
} from "@mui/material";
import Mic from '@mui/icons-material/Mic';
import PlayArrow from '@mui/icons-material/PlayArrow';
import Pause from '@mui/icons-material/Pause';
import HelpOutline from '@mui/icons-material/HelpOutline';
import AutoAwesome from '@mui/icons-material/AutoAwesome';
import CheckCircle from '@mui/icons-material/CheckCircle';
import ExpandLess from '@mui/icons-material/ExpandLess';
import ExpandMore from '@mui/icons-material/ExpandMore';
import RestartAlt from '@mui/icons-material/RestartAlt';
import VolumeUp from '@mui/icons-material/VolumeUp';
import Tune from '@mui/icons-material/Tune';
import Close from '@mui/icons-material/Close';
import Male from '@mui/icons-material/Male';
import Female from '@mui/icons-material/Female';
import Category from '@mui/icons-material/Category';
import { getLatestVoiceClone, VoiceCloneResponse } from "../../api/brandAssets";
import { getAuthTokenGetter, getApiUrl } from "../../api/client";
import { VoiceAvatarPlaceholder } from "../OnboardingWizard/PersonalizationStep/components/VoiceAvatarPlaceholder";
import { useVoicePreview } from "./useVoicePreview";
import { useVoiceFiltering } from "./useVoiceFiltering";
import { VoiceClonePanel } from "./VoiceClonePanel";
import {
  VoiceOption,
  VoiceAudioSettings,
  DEFAULT_AUDIO_SETTINGS,
  EMOTION_OPTIONS,
  VOICE_PREVIEW_MAP,
  CATEGORY_OPTIONS,
  PREDEFINED_VOICES,
  CategoryFilter,
  VoiceSelectorGenderFilter,
} from "./voiceConstants";

interface VoiceSelectorProps {
  value: string;
  onChange: (voiceId: string) => void;
  disabled?: boolean;
  showVoiceClone?: boolean;
  compact?: boolean;
  audioSettings?: VoiceAudioSettings;
  onAudioSettingsChange?: (settings: VoiceAudioSettings) => void;
}

export const VOICE_CLONE_ID = "MY_VOICE_CLONE";

export const VoiceSelector: React.FC<VoiceSelectorProps> = ({
  value,
  onChange,
  disabled = false,
  showVoiceClone = true,
  compact = false,
  audioSettings: externalAudioSettings,
  onAudioSettingsChange,
}) => {
  const [voiceClone, setVoiceClone] = useState<VoiceCloneResponse | null>(null);
  const [loadingVoiceClone, setLoadingVoiceClone] = useState(false);
  const [showVoiceClonePanel, setShowVoiceClonePanel] = useState(false);
  const [voiceCreated, setVoiceCreated] = useState(false);
  const [redoingClone, setRedoingClone] = useState(false);
  const [selectOpen, setSelectOpen] = useState(false);
  const [tuneModalOpen, setTuneModalOpen] = useState(false);
  const [tuneForVoice, setTuneForVoice] = useState<string | null>(null);
  const [localAudioSettings, setLocalAudioSettings] = useState<VoiceAudioSettings>(
    externalAudioSettings || { ...DEFAULT_AUDIO_SETTINGS }
  );
  const [genderFilter, setGenderFilter] = useState<VoiceSelectorGenderFilter>("all");
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>("all");
  const prevVoiceCloneIdRef = useRef<string | null>(null);

  const { playingPreview, handlePreview, stopCurrentAudio } = useVoicePreview();

  const isPreviewing = playingPreview !== null;

  const { voiceOptions, filteredVoices } = useVoiceFiltering({
    showVoiceClone,
    voiceClone,
    value,
    genderFilter,
    categoryFilter,
  });

  const fetchVoiceClone = useCallback(async () => {
    try {
      setLoadingVoiceClone(true);
      const result = await getLatestVoiceClone();
      setVoiceClone(result);
      return result;
    } catch (error) {
      console.error("Failed to fetch voice clone:", error);
      return null;
    } finally {
      setLoadingVoiceClone(false);
    }
  }, []);

  useEffect(() => {
    if (!showVoiceClone) return;
    fetchVoiceClone();
  }, [showVoiceClone]);

  useEffect(() => {
    if (voiceClone?.success && voiceClone.custom_voice_id) {
      const cloneId = voiceClone.custom_voice_id;
      if (prevVoiceCloneIdRef.current !== cloneId) {
        prevVoiceCloneIdRef.current = cloneId;
        if (!value || value === "Wise_Woman") {
          onChange(cloneId);
        }
      }
    }
  }, [voiceClone]);

  const handleChange = (newValue: string) => {
    if (newValue === VOICE_CLONE_ID && voiceClone?.success) {
      onChange(voiceClone.custom_voice_id || VOICE_CLONE_ID);
    } else {
      onChange(newValue);
    }
  };

  const isVoiceCloneSelected = value === VOICE_CLONE_ID || 
    (voiceClone?.success && voiceClone.custom_voice_id && value === voiceClone.custom_voice_id);

  const selectValue = useMemo(() => {
    if (isVoiceCloneSelected) return VOICE_CLONE_ID;
    if (value && voiceOptions.some(v => v.id === value)) return value;
    return voiceOptions.length > 0 ? voiceOptions[0].id : "";
  }, [value, isVoiceCloneSelected, voiceOptions]);

  const selectedVoice = useMemo(() => {
    if (isVoiceCloneSelected) {
      return voiceOptions.find(v => v.id === VOICE_CLONE_ID);
    }
    return voiceOptions.find(v => v.id === value) || voiceOptions[0];
  }, [value, isVoiceCloneSelected, voiceOptions]);

  const handleVoiceSet = useCallback(() => {
    setVoiceCreated(true);
  }, []);

  const handleRedoClone = useCallback(() => {
    setSelectOpen(false);
    setTimeout(() => {
      setRedoingClone(true);
      setShowVoiceClonePanel(true);
      setVoiceCreated(false);
    }, 150);
  }, []);

  const handleDoneWithVoice = useCallback(() => {
    fetchVoiceClone();
    setShowVoiceClonePanel(false);
    setVoiceCreated(false);
    setRedoingClone(false);
  }, []);

  const handleCancelRedo = useCallback(() => {
    setShowVoiceClonePanel(false);
    setRedoingClone(false);
    setVoiceCreated(false);
  }, []);

  const handleTogglePanel = useCallback(() => {
    if (showVoiceClonePanel) {
      setShowVoiceClonePanel(false);
      setVoiceCreated(false);
      setRedoingClone(false);
    } else {
      setShowVoiceClonePanel(true);
      setVoiceCreated(false);
      setRedoingClone(false);
    }
  }, [showVoiceClonePanel]);

  useEffect(() => {
    if (externalAudioSettings) {
      setLocalAudioSettings(externalAudioSettings);
    }
  }, [externalAudioSettings]);

  const hasCustomSettings = externalAudioSettings && (
    externalAudioSettings.speed !== 1.0 ||
    externalAudioSettings.volume !== 1.0 ||
    externalAudioSettings.pitch !== 0 ||
    externalAudioSettings.emotion !== "neutral"
  );

  const handleApplyTune = useCallback(() => {
    if (onAudioSettingsChange) {
      onAudioSettingsChange(localAudioSettings);
    }
    setTuneModalOpen(false);
  }, [localAudioSettings, onAudioSettingsChange]);

  const handleOpenTune = useCallback((voiceId: string) => {
    setTuneForVoice(voiceId);
    setLocalAudioSettings(externalAudioSettings || { ...DEFAULT_AUDIO_SETTINGS });
    setTuneModalOpen(true);
  }, [externalAudioSettings]);

  // Gradient style for Tune icon button
  const tuneButtonSx = useMemo(() => ({
    textTransform: 'none' as const,
    fontSize: "0.68rem",
    fontWeight: 600,
    minWidth: 60,
    py: 0.3,
    borderRadius: 1.5,
    background: "linear-gradient(135deg, rgba(249, 115, 22, 0.08) 0%, rgba(236, 72, 153, 0.08) 100%)",
    color: "#e17055",
    borderColor: "rgba(249, 115, 22, 0.3)",
    "&:hover": {
      background: "linear-gradient(135deg, rgba(249, 115, 22, 0.18) 0%, rgba(236, 72, 153, 0.18) 100%)",
      borderColor: "#f97316",
    },
  }), []);

  if (compact) {
    return (
      <FormControl fullWidth size="small">
        <InputLabel>Voice</InputLabel>
        <Select
          value={selectValue}
          onChange={(e) => handleChange(e.target.value)}
          label="Voice"
          disabled={disabled}
          startAdornment={
            <ListItemIcon sx={{ minWidth: 32 }}>
              <Mic fontSize="small" sx={{ color: isVoiceCloneSelected ? "#667eea" : "inherit" }} />
            </ListItemIcon>
          }
        >
          {voiceOptions.map((voice) => (
            <MenuItem key={voice.id} value={voice.id}>
              <ListItemText 
                primary={voice.name} 
                secondary={voice.isCustom ? "Custom voice clone" : voice.personality?.split(' - ')[0]} 
              />
            </MenuItem>
          ))}
        </Select>
      </FormControl>
    );
  }

  return (
    <Box
      sx={{
        p: 3,
        borderRadius: 3,
        background: "#ffffff",
        border: "1px solid rgba(102, 126, 234, 0.15)",
        boxShadow: "0 4px 20px rgba(102, 126, 234, 0.08)",
        position: "relative",
        overflow: "hidden",
        "&::before": {
          content: '""',
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: "3px",
          background: "linear-gradient(90deg, #667eea 0%, #764ba2 100%)",
        },
      }}
    >
      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
        <Box
          sx={{
            width: 24,
            height: 24,
            borderRadius: "50%",
            background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 2px 8px rgba(102, 126, 234, 0.25)",
          }}
        >
          <Typography sx={{ color: "#fff", fontSize: "0.75rem", fontWeight: 700 }}>4</Typography>
        </Box>
        <Box
          sx={{
            width: 32,
            height: 32,
            borderRadius: 1.5,
            background: "linear-gradient(135deg, rgba(102, 126, 234, 0.12) 0%, rgba(118, 75, 162, 0.12) 100%)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 2px 8px rgba(102, 126, 234, 0.15)",
          }}
        >
          <Mic fontSize="small" sx={{ color: "#667eea" }} />
        </Box>
        <Typography variant="subtitle1" sx={{ fontWeight: 700, color: "#0f172a", fontSize: "1rem" }}>
          Voice Selection
        </Typography>
        {selectedVoice && (
          <Chip
            icon={<Mic sx={{ fontSize: "12px !important" }} />}
            label={`Active: ${selectedVoice.isCustom ? "My Voice Clone" : selectedVoice.name}`}
            size="small"
            sx={{
              background: selectedVoice.isCustom
                ? "linear-gradient(135deg, rgba(16, 185, 129, 0.12) 0%, rgba(5, 150, 105, 0.12) 100%)"
                : "linear-gradient(135deg, rgba(102, 126, 234, 0.12) 0%, rgba(118, 75, 162, 0.12) 100%)",
              color: selectedVoice.isCustom ? "#10b981" : "#6366f1",
              border: `1px solid ${selectedVoice.isCustom ? "rgba(16, 185, 129, 0.25)" : "rgba(99, 102, 241, 0.2)"}`,
              fontWeight: 600,
              fontSize: "0.7rem",
              height: 22,
              "& .MuiChip-icon": { color: selectedVoice.isCustom ? "#10b981" : "#6366f1" },
            }}
          />
        )}
        <Tooltip title="Fine-tune voice speed, pitch, volume & emotion" arrow>
          <IconButton
            size="small"
            onClick={() => {
              setLocalAudioSettings(externalAudioSettings || { ...DEFAULT_AUDIO_SETTINGS });
              setTuneForVoice(null);
              setTuneModalOpen(true);
            }}
            sx={{
              color: hasCustomSettings ? "#667eea" : "#94a3b8",
              background: hasCustomSettings ? "rgba(102, 126, 234, 0.1)" : "transparent",
              "&:hover": { color: "#667eea", background: "rgba(102, 126, 234, 0.08)" },
            }}
          >
            <Tune fontSize="small" />
          </IconButton>
        </Tooltip>
        <Tooltip title="Choose a system voice or your custom cloned voice. Click the play button to hear a preview." arrow>
          <IconButton size="small" sx={{ color: "#94a3b8", "&:hover": { color: "#667eea" } }}>
            <HelpOutline fontSize="small" />
          </IconButton>
        </Tooltip>
        {showVoiceClone && loadingVoiceClone && (
          <CircularProgress size={16} sx={{ ml: 1, color: "#667eea" }} />
        )}
      </Stack>

      <FormControl fullWidth>
        <Select
          open={selectOpen}
          onOpen={() => setSelectOpen(true)}
          onClose={() => setSelectOpen(false)}
          value={selectValue}
          onChange={(e) => {
            handleChange(e.target.value);
            setSelectOpen(false);
          }}
          disabled={disabled}
          renderValue={(selected) => {
            const voice = voiceOptions.find(v => 
              v.id === selected || 
              (selected === VOICE_CLONE_ID && v.isCustom)
            );
            return (
              <Stack direction="row" spacing={1} alignItems="center">
                <VolumeUp fontSize="small" sx={{ color: voice?.isCustom ? "#667eea" : "#64748b" }} />
                <Typography sx={{ fontWeight: 600, color: "#1e293b" }}>{voice?.name}</Typography>
                {voice?.isCustom && (
                  <Chip 
                    label="Cloned" 
                    size="small" 
                    sx={{ 
                      bgcolor: alpha("#667eea", 0.1), 
                      color: "#667eea",
                      height: 20,
                      fontSize: "0.7rem",
                      fontWeight: 600,
                    }} 
                  />
                )}
              </Stack>
            );
          }}
          sx={{
            color: "#1e293b",
            "& .MuiOutlinedInput-notchedOutline": {
              border: "2px solid rgba(102, 126, 234, 0.2)",
            },
            "&:hover .MuiOutlinedInput-notchedOutline": {
              borderColor: "rgba(102, 126, 234, 0.4)",
            },
            "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
              borderColor: "#667eea",
            },
          }}
          MenuProps={{
            PaperProps: {
              sx: {
                maxHeight: 500,
                bgcolor: "#ffffff",
                boxShadow: "0 8px 32px rgba(15, 23, 42, 0.12)",
                border: "2px solid rgba(102, 126, 234, 0.35)",
                borderRadius: 2.5,
                "& .MuiMenuItem-root": {
                  bgcolor: "#ffffff",
                  color: "#1e293b",
                  "&:hover": {
                    bgcolor: "rgba(102, 126, 234, 0.06)",
                  },
                  "&.Mui-selected": {
                    bgcolor: "rgba(102, 126, 234, 0.1)",
                    "&:hover": {
                      bgcolor: "rgba(102, 126, 234, 0.16)",
                    },
                  },
                },
              },
            },
            MenuListProps: {
              sx: {
                bgcolor: "#ffffff",
              },
            },
          }}
        >
          {showVoiceClone && voiceClone?.success && voiceClone.custom_voice_id && (
            <MenuItem value={VOICE_CLONE_ID} sx={{ 
              borderBottom: '1px solid rgba(102, 126, 234, 0.1)', 
              py: 1.5,
              bgcolor: isVoiceCloneSelected ? "rgba(102, 126, 234, 0.06)" : "#ffffff",
            }}>
              <ListItemIcon sx={{ minWidth: 40 }}>
                <AutoAwesome sx={{ color: "#667eea", fontSize: "1.1rem" }} />
              </ListItemIcon>
              <ListItemText 
                primary={
                  <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between" sx={{ width: "100%" }}>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Typography fontWeight={600} sx={{ color: "#667eea" }}>
                        My Voice Clone
                      </Typography>
                      <Chip 
                        icon={<CheckCircle sx={{ fontSize: "14px !important" }} />}
                        label="Active" 
                        size="small" 
                        sx={{ 
                          bgcolor: alpha("#10b981", 0.1), 
                          color: "#10b981",
                          height: 20,
                          fontSize: "0.65rem",
                          fontWeight: 600,
                          '& .MuiChip-icon': { color: "#10b981" }
                        }} 
                      />
                    </Stack>
                    <Stack direction="row" spacing={0.75}>
                      {voiceClone.preview_audio_url && (
                        <Button
                          size="small"
                          variant={playingPreview === VOICE_CLONE_ID ? "contained" : "outlined"}
                          startIcon={playingPreview === VOICE_CLONE_ID ? <Pause /> : <PlayArrow />}
                          onClick={(e) => {
                            e.stopPropagation();
                            handlePreview({ 
                              id: VOICE_CLONE_ID, 
                              name: voiceClone.voice_name || "My Voice Clone",
                              previewUrl: voiceClone.preview_audio_url 
                            });
                          }}
                          disabled={isPreviewing && playingPreview !== VOICE_CLONE_ID}
                          sx={{ 
                            textTransform: 'none',
                            fontSize: "0.7rem",
                            fontWeight: 600,
                            minWidth: 82,
                            py: 0.3,
                            borderRadius: 1.5,
                            ...(playingPreview === VOICE_CLONE_ID ? {
                              background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                              color: "#fff",
                              boxShadow: "0 2px 8px rgba(102, 126, 234, 0.35)",
                              "&:hover": {
                                background: "linear-gradient(135deg, #5a6fd6 0%, #6a4195 100%)",
                              },
                            } : {
                              background: "linear-gradient(135deg, rgba(102, 126, 234, 0.08) 0%, rgba(118, 75, 162, 0.08) 100%)",
                              color: "#667eea",
                              borderColor: "rgba(102, 126, 234, 0.35)",
                              "&:hover": {
                                background: "linear-gradient(135deg, rgba(102, 126, 234, 0.16) 0%, rgba(118, 75, 162, 0.16) 100%)",
                                borderColor: "#667eea",
                              },
                            }),
                          }}
                        >
                          {playingPreview === VOICE_CLONE_ID ? "Stop" : "Preview"}
                        </Button>
                      )}
                      <Button
                        size="small"
                        variant="outlined"
                        startIcon={<RestartAlt sx={{ fontSize: "0.85rem" }} />}
                        onClick={handleRedoClone}
                        sx={{
                          textTransform: 'none',
                          fontSize: "0.68rem",
                          fontWeight: 600,
                          minWidth: 70,
                          py: 0.3,
                          borderRadius: 1.5,
                          background: "linear-gradient(135deg, rgba(249, 115, 22, 0.06) 0%, rgba(234, 88, 12, 0.06) 100%)",
                          color: "#f97316",
                          borderColor: "rgba(249, 115, 22, 0.3)",
                          "&:hover": {
                            background: "linear-gradient(135deg, rgba(249, 115, 22, 0.14) 0%, rgba(234, 88, 12, 0.14) 100%)",
                            borderColor: "#f97316",
                          },
                        }}
                      >
                        Redo
                      </Button>
                    </Stack>
                  </Stack>
                }
                secondary={
                  <Typography variant="caption" sx={{ color: "#64748b", fontSize: "0.72rem", lineHeight: 1.4 }}>
                    Your own voice - cloned from audio sample
                  </Typography>
                }
              />
            </MenuItem>
          )}

          {/* Filter row inside dropdown */}
          <Box
            onClick={(e) => e.stopPropagation()}
            sx={{
              px: 1.5,
              pt: 1.5,
              pb: 0.5,
              borderBottom: "1px solid rgba(102, 126, 234, 0.1)",
              position: "sticky",
              top: 0,
              bgcolor: "#ffffff",
              zIndex: 2,
            }}
          >
            <Stack direction="row" spacing={0.5} alignItems="center" useFlexGap flexWrap="wrap" sx={{ mb: 0.75 }}>
              <Typography variant="caption" sx={{ fontWeight: 700, color: "#94a3b8", fontSize: "0.6rem", textTransform: "uppercase", letterSpacing: "0.08em", mr: 0.25 }}>
                Gender
              </Typography>
              {([["all", "All"], ["male", "♂ M"], ["female", "♀ F"]] as const).map(([val, label]) => (
                <Chip
                  key={val}
                  label={label}
                  size="small"
                  onClick={() => setGenderFilter(val as VoiceSelectorGenderFilter)}
                  variant={genderFilter === val ? "filled" : "outlined"}
                  sx={{
                    height: 22,
                    fontSize: "0.65rem",
                    fontWeight: genderFilter === val ? 700 : 500,
                    background: genderFilter === val
                      ? "linear-gradient(135deg, #667eea 0%, #764ba2 100%)"
                      : "rgba(248, 250, 252, 1)",
                    color: genderFilter === val ? "#ffffff" : "#64748b",
                    border: genderFilter === val
                      ? "1px solid rgba(102, 126, 234, 0.5)"
                      : "1px solid rgba(148, 163, 184, 0.3)",
                    boxShadow: genderFilter === val ? "0 2px 8px rgba(102, 126, 234, 0.3)" : "none",
                    cursor: "pointer",
                    "& .MuiChip-label": {
                      color: "inherit",
                    },
                    "&:hover": {
                      background: genderFilter === val
                        ? "linear-gradient(135deg, #5a6fd6 0%, #6a4195 100%)"
                        : "rgba(102, 126, 234, 0.08)",
                      border: genderFilter === val ? "1px solid rgba(102, 126, 234, 0.6)" : "1px solid rgba(102, 126, 234, 0.3)",
                    },
                    transition: "all 0.15s ease",
                  }}
                />
              ))}
            </Stack>
            <Stack direction="row" spacing={0.5} alignItems="center" useFlexGap flexWrap="wrap">
              <Typography variant="caption" sx={{ fontWeight: 700, color: "#94a3b8", fontSize: "0.6rem", textTransform: "uppercase", letterSpacing: "0.08em", mr: 0.25 }}>
                Use Case
              </Typography>
              {CATEGORY_OPTIONS.map((cat) => (
                <Chip
                  key={cat.value}
                  label={cat.label}
                  size="small"
                  onClick={() => setCategoryFilter(cat.value)}
                  variant={categoryFilter === cat.value ? "filled" : "outlined"}
                  sx={{
                    height: 22,
                    fontSize: "0.65rem",
                    fontWeight: categoryFilter === cat.value ? 700 : 500,
                    background: categoryFilter === cat.value
                      ? "linear-gradient(135deg, #667eea 0%, #764ba2 100%)"
                      : "rgba(248, 250, 252, 1)",
                    color: categoryFilter === cat.value ? "#ffffff" : "#64748b",
                    border: categoryFilter === cat.value
                      ? "1px solid rgba(102, 126, 234, 0.5)"
                      : "1px solid rgba(148, 163, 184, 0.3)",
                    boxShadow: categoryFilter === cat.value ? "0 2px 8px rgba(102, 126, 234, 0.3)" : "none",
                    cursor: "pointer",
                    "& .MuiChip-label": {
                      color: "inherit",
                    },
                    "&:hover": {
                      background: categoryFilter === cat.value
                        ? "linear-gradient(135deg, #5a6fd6 0%, #6a4195 100%)"
                        : "rgba(102, 126, 234, 0.08)",
                      border: categoryFilter === cat.value ? "1px solid rgba(102, 126, 234, 0.6)" : "1px solid rgba(102, 126, 234, 0.3)",
                    },
                    transition: "all 0.15s ease",
                  }}
                />
              ))}
            </Stack>
          </Box>

          <MenuItem disabled sx={{ 
            py: 0.25,
            bgcolor: "#f8fafc !important",
            "&.MuiMenuItem-root": { bgcolor: "#f8fafc !important" },
          }}>
            <Typography variant="caption" sx={{ fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#94a3b8", fontSize: "0.65rem" }}>
              {filteredVoices.length} voice{filteredVoices.length !== 1 ? "s" : ""}
            </Typography>
          </MenuItem>

          {filteredVoices.map((voice) => {
            const isPlaying = playingPreview === voice.id;
            const isDisabled = isPreviewing && !isPlaying;
            const personalityShort = voice.personality?.split(' - ')[0] || '';
            const personalityBest = voice.personality?.split(' - ')[1] || '';

            return (
              <MenuItem 
                key={voice.id} 
                value={voice.id} 
                sx={{ 
                  py: 1,
                  opacity: isDisabled ? 0.45 : 1,
                  transition: "opacity 0.2s ease",
                  pointerEvents: isDisabled ? "none" : "auto",
                }}
              >
                <ListItemText 
                  primary={
                    <Box sx={{ width: "100%" }}>
                      <Stack direction="row" spacing={0.5} alignItems="center" sx={{ mb: 0.25 }}>
                        <Typography sx={{ fontWeight: 500, fontSize: "0.85rem", lineHeight: 1.3 }}>{voice.name}</Typography>
                        {voice.gender && (
                          <Box
                            component="span"
                            sx={{
                              display: "inline-flex",
                              alignItems: "center",
                              justifyContent: "center",
                              minWidth: 16,
                              height: 16,
                              px: 0.5,
                              borderRadius: "3px",
                              fontSize: "0.55rem",
                              fontWeight: 700,
                              lineHeight: 1,
                              bgcolor: voice.gender === "male" ? "rgba(59, 130, 246, 0.12)" : "rgba(236, 72, 153, 0.12)",
                              color: voice.gender === "male" ? "#3b82f6" : "#ec4899",
                              border: `1px solid ${voice.gender === "male" ? "rgba(59, 130, 246, 0.25)" : "rgba(236, 72, 153, 0.25)"}`,
                            }}
                          >
                            {voice.gender === "male" ? "M" : "F"}
                          </Box>
                        )}
                        {voice.category && (
                          <Typography component="span" variant="caption" sx={{ color: "#94a3b8", fontSize: "0.6rem" }}>
                            · {voice.category}
                          </Typography>
                        )}
                      </Stack>
                      {personalityBest ? (
                        <Typography variant="caption" sx={{ color: "#667eea", fontSize: "0.65rem", fontWeight: 500, lineHeight: 1.3, display: "block" }}>
                          {personalityBest.toLowerCase()}
                        </Typography>
                      ) : personalityShort ? (
                        <Typography variant="caption" sx={{ color: "#94a3b8", fontSize: "0.65rem", lineHeight: 1.3, display: "block" }}>
                          {personalityShort}
                        </Typography>
                      ) : null}
                    </Box>
                  }
                />
                <Stack direction="row" spacing={0.5} sx={{ ml: 1, flexShrink: 0 }}>
                  {voice.previewUrl && (
                    <IconButton
                      size="small"
                      onClick={(e) => {
                        e.stopPropagation();
                        handlePreview(voice);
                      }}
                      disabled={isDisabled}
                      sx={{
                        width: 28,
                        height: 28,
                        borderRadius: "6px",
                        ...(isPlaying ? {
                          background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                          color: "#fff",
                          boxShadow: "0 2px 6px rgba(102, 126, 234, 0.35)",
                        } : {
                          background: "linear-gradient(135deg, rgba(102, 126, 234, 0.08) 0%, rgba(118, 75, 162, 0.08) 100%)",
                          color: "#667eea",
                          border: "1px solid rgba(102, 126, 234, 0.25)",
                        }),
                      }}
                    >
                      {isPlaying ? <Pause sx={{ fontSize: "0.85rem" }} /> : <PlayArrow sx={{ fontSize: "0.85rem" }} />}
                    </IconButton>
                  )}
                  <IconButton
                    size="small"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleOpenTune(voice.id);
                    }}
                    sx={{
                      width: 28,
                      height: 28,
                      borderRadius: "6px",
                      background: "linear-gradient(135deg, rgba(249, 115, 22, 0.08) 0%, rgba(236, 72, 153, 0.08) 100%)",
                      color: "#e17055",
                      border: "1px solid rgba(249, 115, 22, 0.2)",
                      "&:hover": {
                        background: "linear-gradient(135deg, rgba(249, 115, 22, 0.18) 0%, rgba(236, 72, 153, 0.18) 100%)",
                        borderColor: "rgba(249, 115, 22, 0.5)",
                      },
                    }}
                  >
                    <Tune sx={{ fontSize: "0.85rem" }} />
                  </IconButton>
                </Stack>
              </MenuItem>
            );
          })}

          {filteredVoices.length === 0 && (
            <MenuItem disabled sx={{ py: 2 }}>
              <ListItemText>
                <Typography variant="body2" sx={{ color: "#94a3b8", textAlign: "center" }}>
                  No voices match the selected filters
                </Typography>
              </ListItemText>
            </MenuItem>
          )}
        </Select>
      </FormControl>

      {selectedVoice?.personality && (
        <Box sx={{ 
          mt: 1.5, 
          p: 1.5, 
          borderRadius: 2,
          background: playingPreview 
            ? "linear-gradient(135deg, rgba(102, 126, 234, 0.08) 0%, rgba(118, 75, 162, 0.08) 100%)"
            : "rgba(248, 250, 252, 0.8)",
          border: playingPreview 
            ? "1px solid rgba(102, 126, 234, 0.2)" 
            : "1px solid rgba(102, 126, 234, 0.1)",
          transition: "all 0.3s ease",
        }}>
          <Stack direction="row" spacing={1} alignItems="center">
            {playingPreview && (
              <Box sx={{ 
                width: 8, height: 8, borderRadius: "50%", bgcolor: "#667eea",
                animation: "pulse 1.5s ease-in-out infinite",
                "@keyframes pulse": {
                  "0%": { opacity: 1, transform: "scale(1)" },
                  "50%": { opacity: 0.5, transform: "scale(1.2)" },
                  "100%": { opacity: 1, transform: "scale(1)" },
                },
              }} />
            )}
            <Box sx={{ flex: 1 }}>
              <Typography variant="body2" sx={{ color: "#0f172a", fontSize: "0.8125rem", fontWeight: 600, lineHeight: 1.4 }}>
                {selectedVoice.isCustom ? "My Voice Clone" : selectedVoice.name}
              </Typography>
              <Typography variant="caption" sx={{ color: playingPreview ? "#4f46e5" : "#64748b", fontSize: "0.75rem", lineHeight: 1.4, fontWeight: playingPreview ? 500 : 400, display: "block" }}>
                {selectedVoice.personality}
              </Typography>
            </Box>
            {playingPreview && (
              <Typography variant="caption" sx={{ color: "#667eea", fontWeight: 600, fontSize: "0.7rem", whiteSpace: "nowrap" }}>
                Playing...
              </Typography>
            )}
          </Stack>
        </Box>
      )}

      {(showVoiceClone && !voiceClone?.success) || redoingClone ? (
        <VoiceClonePanel
          showVoiceClonePanel={showVoiceClonePanel}
          voiceCreated={voiceCreated}
          redoingClone={redoingClone}
          onTogglePanel={handleTogglePanel}
          onVoiceSet={handleVoiceSet}
          onCancelRedo={handleCancelRedo}
          onDoneWithVoice={handleDoneWithVoice}
        />
      ) : null}

      {/* Voice Fine-tune Modal */}
      <Dialog
        open={tuneModalOpen}
        onClose={() => setTuneModalOpen(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 3,
            background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
            color: "white",
          },
        }}
      >
        <DialogTitle>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Stack direction="row" spacing={1} alignItems="center">
              <Tune sx={{ fontSize: "1.25rem" }} />
              <Typography variant="h6" sx={{ fontWeight: 700 }}>
                Fine-tune Voice
              </Typography>
            </Stack>
            <IconButton onClick={() => setTuneModalOpen(false)} size="small" sx={{ color: "rgba(255,255,255,0.7)" }}>
              <Close />
            </IconButton>
          </Stack>
          {tuneForVoice && (
            <Typography variant="body2" sx={{ opacity: 0.8, mt: 0.5 }}>
              Adjusting settings for: <strong>{voiceOptions.find(v => v.id === tuneForVoice)?.name || "selected voice"}</strong>
            </Typography>
          )}
          {!tuneForVoice && (
            <Typography variant="body2" sx={{ opacity: 0.7, mt: 0.5 }}>
              Adjust speed, pitch, volume and emotion for your selected voice.
            </Typography>
          )}
        </DialogTitle>
        <DialogContent>
          <Stack spacing={3} sx={{ mt: 1 }}>
            <Box>
              <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>Speaking Speed</Typography>
                <Chip label={localAudioSettings.speed.toFixed(2)} size="small" sx={{ bgcolor: "rgba(255,255,255,0.15)", color: "white", fontWeight: 600, fontSize: "0.7rem", height: 20 }} />
              </Stack>
              <Slider
                value={localAudioSettings.speed}
                min={0.5}
                max={2.0}
                step={0.05}
                onChange={(_, v) => setLocalAudioSettings(s => ({ ...s, speed: v as number }))}
                sx={{ color: "#4ade80" }}
              />
              <Typography variant="caption" sx={{ opacity: 0.7 }}>0.5 = Slow &bull; 1.0 = Normal &bull; 2.0 = Fast</Typography>
            </Box>
            <Box>
              <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>Volume</Typography>
                <Chip label={localAudioSettings.volume.toFixed(1)} size="small" sx={{ bgcolor: "rgba(255,255,255,0.15)", color: "white", fontWeight: 600, fontSize: "0.7rem", height: 20 }} />
              </Stack>
              <Slider
                value={localAudioSettings.volume}
                min={0.1}
                max={10.0}
                step={0.1}
                onChange={(_, v) => setLocalAudioSettings(s => ({ ...s, volume: v as number }))}
                sx={{ color: "#fbbf24" }}
              />
              <Typography variant="caption" sx={{ opacity: 0.7 }}>0.1 = Very soft &bull; 1.0 = Normal &bull; 10.0 = Very loud</Typography>
            </Box>
            <Box>
              <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>Pitch</Typography>
                <Chip label={localAudioSettings.pitch > 0 ? `+${localAudioSettings.pitch}` : localAudioSettings.pitch} size="small" sx={{ bgcolor: "rgba(255,255,255,0.15)", color: "white", fontWeight: 600, fontSize: "0.7rem", height: 20 }} />
              </Stack>
              <Slider
                value={localAudioSettings.pitch}
                min={-12}
                max={12}
                step={0.5}
                onChange={(_, v) => setLocalAudioSettings(s => ({ ...s, pitch: v as number }))}
                sx={{ color: "#f87171" }}
              />
              <Typography variant="caption" sx={{ opacity: 0.7 }}>-12 = Very deep &bull; 0 = Normal &bull; +12 = Very high</Typography>
            </Box>
            <Box>
              <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>Emotion</Typography>
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                {EMOTION_OPTIONS.map((em) => (
                  <Chip
                    key={em}
                    label={em.charAt(0).toUpperCase() + em.slice(1)}
                    size="small"
                    onClick={() => setLocalAudioSettings(s => ({ ...s, emotion: em }))}
                    sx={{
                      bgcolor: localAudioSettings.emotion === em ? "rgba(255,255,255,0.25)" : "rgba(255,255,255,0.08)",
                      color: "white",
                      fontWeight: localAudioSettings.emotion === em ? 700 : 400,
                      border: localAudioSettings.emotion === em ? "1px solid rgba(255,255,255,0.5)" : "1px solid rgba(255,255,255,0.1)",
                      cursor: "pointer",
                      "&:hover": { bgcolor: "rgba(255,255,255,0.2)" },
                    }}
                  />
                ))}
              </Stack>
            </Box>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button
            onClick={() => {
              setLocalAudioSettings({ ...DEFAULT_AUDIO_SETTINGS });
              if (onAudioSettingsChange) onAudioSettingsChange({ ...DEFAULT_AUDIO_SETTINGS });
              setTuneModalOpen(false);
            }}
            sx={{ color: "rgba(255,255,255,0.7)" }}
          >
            Reset to Defaults
          </Button>
          <Button
            onClick={() => setTuneModalOpen(false)}
            sx={{ color: "rgba(255,255,255,0.7)" }}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleApplyTune}
            startIcon={<Tune sx={{ fontSize: "1rem" }} />}
            sx={{
              bgcolor: "#4ade80",
              color: "#0f172a",
              fontWeight: 700,
              "&:hover": { bgcolor: "#22c55e" },
            }}
          >
            Apply Settings
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default VoiceSelector;