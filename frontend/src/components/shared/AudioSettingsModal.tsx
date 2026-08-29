import React, { useEffect, useState, useMemo } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Stack,
  Box,
  Typography,
  Slider,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  FormControlLabel,
  Checkbox,
  Tooltip,
  IconButton,
  alpha,
  TextField,
} from "@mui/material";
import HelpOutlineIcon from "@mui/icons-material/HelpOutline";
import CloseIcon from "@mui/icons-material/Close";
import VolumeUp from "@mui/icons-material/VolumeUp";
import { Button } from "@mui/material";

// Import language-aware voice mapping (optional - only used in YouTube Creator context)
let getVoicesForLanguage: ((language?: string) => any[]) | undefined;
import('../../components/YouTubeCreator/constants')
  .then((youtubeConstants) => {
    getVoicesForLanguage = youtubeConstants.getVoicesForLanguage;
  })
  .catch(() => {
    // Not in YouTube Creator context - will use fallback English voices
    getVoicesForLanguage = undefined;
  });

export type AudioGenerationSettings = {
  voiceId: string;
  customVoiceId?: string;
  useVoiceClone?: boolean;
  voiceSampleUrl?: string;
  voiceCloneEngine?: string;
  speed: number;
  volume: number;
  pitch: number;
  emotion: string;
  englishNormalization: boolean;
  sampleRate?: number;
  bitrate: number;
  channel: "1" | "2";
  format: "mp3" | "wav" | "pcm" | "flac";
  languageBoost?: string;
  enableSyncMode: boolean;
};

interface AudioSettingsModalProps {
  open: boolean;
  onClose: () => void;
  onApplySettings: (settings: AudioGenerationSettings) => void;
  initialSettings: AudioGenerationSettings;
  isGenerating?: boolean;
  sceneTitle?: string;
  isRegenerating?: boolean;
  language?: string; // Language code (e.g., 'en', 'es', 'fr') - used to filter voice options
}

// Import language-aware voice mapping (fallback to English voices if not in YouTube Creator context)
// This will be dynamically loaded based on language prop

const EMOTION_OPTIONS = ["happy", "sad", "angry", "fearful", "disgusted", "surprised", "neutral"];

const SAMPLE_RATE_OPTIONS = [8000, 16000, 22050, 24000, 32000, 44100];
const BITRATE_OPTIONS = [32000, 64000, 128000, 256000];
const LANGUAGE_BOOST_OPTIONS = [
  "auto",
  "English",
  "Chinese",
  "Chinese,Yue",
  "Arabic",
  "Russian",
  "Spanish",
  "French",
  "Portuguese",
  "German",
  "Turkish",
  "Dutch",
  "Ukrainian",
  "Vietnamese",
  "Indonesian",
  "Japanese",
  "Italian",
  "Korean",
  "Thai",
  "Polish",
  "Romanian",
  "Greek",
  "Czech",
  "Finnish",
  "Hindi",
];

export const AudioSettingsModal: React.FC<AudioSettingsModalProps> = ({
  open,
  onClose,
  onApplySettings,
  initialSettings,
  isGenerating = false,
  sceneTitle,
  isRegenerating = false,
  language,
}) => {
  const [settings, setSettings] = useState<AudioGenerationSettings>(initialSettings);

  // Fallback English voices (used when language-aware mapping is not available)
  const ENGLISH_VOICES_FALLBACK = [
    { id: "Wise_Woman", name: "Wise Woman", personality: "Authoritative, trustworthy female voice - perfect for educational content and expert narration" },
    { id: "Friendly_Person", name: "Friendly Person", personality: "Warm, approachable voice - great for welcoming introductions and customer-facing content" },
    { id: "Inspirational_girl", name: "Inspirational Girl", personality: "Motivational, uplifting female voice - ideal for inspirational and motivational content" },
    { id: "Deep_Voice_Man", name: "Deep Voice Man", personality: "Powerful, commanding male voice - excellent for serious topics and authoritative delivery" },
    { id: "Calm_Woman", name: "Calm Woman", personality: "Soothing, composed female voice - perfect for meditation, relaxation, or sensitive topics" },
    { id: "Casual_Guy", name: "Casual Guy", personality: "Relaxed, conversational male voice - great for vlogs, tutorials, and informal content" },
    { id: "Lively_Girl", name: "Lively Girl", personality: "Energetic, enthusiastic female voice - ideal for exciting announcements and upbeat content" },
    { id: "Patient_Man", name: "Patient Man", personality: "Gentle, understanding male voice - perfect for explanations and patient guidance" },
    { id: "Young_Knight", name: "Young Knight", personality: "Brave, confident male voice - great for adventure, gaming, and heroic narratives" },
    { id: "Determined_Man", name: "Determined Man", personality: "Strong, resolute male voice - excellent for motivational speeches and determined delivery" },
    { id: "Lovely_Girl", name: "Lovely Girl", personality: "Sweet, charming female voice - ideal for storytelling and gentle narratives" },
    { id: "Decent_Boy", name: "Decent Boy", personality: "Honest, sincere male voice - perfect for testimonials and personal stories" },
    { id: "Imposing_Manner", name: "Imposing Manner", personality: "Formal, dignified male voice - great for corporate content and official announcements" },
    { id: "Elegant_Man", name: "Elegant Man", personality: "Refined, sophisticated male voice - ideal for luxury, premium content" },
    { id: "Abbess", name: "Abbess", personality: "Spiritual, serene female voice - perfect for meditation, philosophy, or contemplative content" },
    { id: "Sweet_Girl_2", name: "Sweet Girl 2", personality: "Gentle, melodic female voice - excellent for children's content and soft storytelling" },
    { id: "Exuberant_Girl", name: "Exuberant Girl", personality: "Joyful, expressive female voice - ideal for celebrations and happy announcements" },
  ];

  // Get language-specific voices (use language-aware mapping if available, fallback to English)
  const VOICE_OPTIONS = useMemo(() => {
    if (getVoicesForLanguage && language) {
      return getVoicesForLanguage(language);
    }
    return ENGLISH_VOICES_FALLBACK;
  }, [language]);

  const handleApply = () => {
    onApplySettings(settings);
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
          color: "white",
        },
      }}
    >
      <DialogTitle>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 600, mb: 0.5 }}>
              {isRegenerating ? 'Regenerate Audio' : 'Generate Audio'} - Voice Settings
            </Typography>
            {sceneTitle && (
              <Typography variant="body2" sx={{ opacity: 0.8 }}>
                Configure voice settings for "{sceneTitle}"
              </Typography>
            )}
          </Box>
          <IconButton onClick={onClose} size="small" sx={{ color: "rgba(255,255,255,0.7)" }}>
            <CloseIcon />
          </IconButton>
        </Stack>
        <Typography variant="body2" sx={{ opacity: 0.7, mt: 1 }}>
          {isRegenerating
            ? 'Customize voice settings to regenerate your audio narration with different characteristics.'
            : 'Choose voice settings to generate high-quality audio narration for your scene.'
          }
        </Typography>
      </DialogTitle>

      <DialogContent>
        <Stack spacing={3} sx={{ mt: 1 }}>
          {/* Voice Selection */}
          <Box>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                Voice Selection
              </Typography>
              <Tooltip title={
                <Box>
                  <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>
                    Voice Selection Guide
                  </Typography>
                  {language && language !== 'en' && (
                    <Typography variant="caption" sx={{ display: 'block', mb: 0.5, color: '#4ade80' }}>
                      🌍 <strong>Language-specific voices</strong> are shown for {language.toUpperCase()} content. These voices provide native pronunciation and accent.
                    </Typography>
                  )}
                  <Typography variant="caption" sx={{ display: 'block', mb: 0.5 }}>
                    Choose a voice that matches your content's personality and target audience.
                  </Typography>
                  {(!language || language === 'en') && (
                    <>
                      <Typography variant="caption" sx={{ display: 'block', mb: 0.5 }}>
                        • <strong>YouTube/Vlogging</strong>: Casual Guy (default), Friendly Person - conversational and engaging
                      </Typography>
                      <Typography variant="caption" sx={{ display: 'block', mb: 0.5 }}>
                        • <strong>Educational/Tutorials</strong>: Wise Woman, Deep Voice Man - authoritative and trustworthy
                      </Typography>
                      <Typography variant="caption" sx={{ display: 'block', mb: 0.5 }}>
                        • <strong>Motivational</strong>: Inspirational Girl, Determined Man - energetic and inspiring
                      </Typography>
                      <Typography variant="caption" sx={{ display: 'block', mb: 0.5 }}>
                        • <strong>Relaxing/Storytelling</strong>: Calm Woman, Lovely Girl - soothing and gentle
                      </Typography>
                      <Typography variant="caption" sx={{ display: 'block' }}>
                        <strong>Default:</strong> Casual Guy - optimized for engaging YouTube narration.
                      </Typography>
                    </>
                  )}
                </Box>
              } arrow placement="right">
                <IconButton size="small" sx={{ color: "rgba(255,255,255,0.5)" }}>
                  <HelpOutlineIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </Stack>
            {language && language !== 'en' && (
              <Typography variant="caption" sx={{ opacity: 0.8, mb: 1, display: 'block', color: '#4ade80' }}>
                🌍 Showing {language.toUpperCase()} language-specific voices for native pronunciation
              </Typography>
            )}
            <FormControl fullWidth>
              <Select
                value={settings.voiceId}
                onChange={(e) => setSettings({ ...settings, voiceId: e.target.value })}
                sx={{
                  backgroundColor: alpha("#ffffff", 0.1),
                  color: "white",
                  "& .MuiOutlinedInput-notchedOutline": { borderColor: "rgba(255,255,255,0.3)" },
                  "&:hover .MuiOutlinedInput-notchedOutline": { borderColor: "rgba(255,255,255,0.4)" },
                  "&.Mui-focused .MuiOutlinedInput-notchedOutline": { borderColor: "#ffffff" },
                  "& .MuiSvgIcon-root": { color: "rgba(255,255,255,0.7)" },
                }}
              >
                {VOICE_OPTIONS.map((voice) => (
                  <MenuItem key={voice.id} value={voice.id}>
                    <Box>
                      <Typography variant="body2" sx={{ fontWeight: 600, color: "white" }}>
                        {voice.name}
                      </Typography>
                      <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.7)", display: "block", fontSize: "0.7rem" }}>
                        {voice.personality}
                      </Typography>
                    </Box>
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>

          {/* Speed / Volume / Pitch */}
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <Box sx={{ flex: 1 }}>
              <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                  Speaking Speed ({settings.speed.toFixed(2)})
                </Typography>
                <Tooltip title={
                  <Box>
                    <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>
                      Natural Speaking Pace
                    </Typography>
                    <Typography variant="caption" sx={{ display: 'block', mb: 0.5 }}>
                      • <strong>0.8-1.0</strong>: Slow, deliberate (educational, complex topics)
                    </Typography>
                    <Typography variant="caption" sx={{ display: 'block', mb: 0.5 }}>
                      • <strong>1.1-1.2</strong>: Natural, engaging (recommended for YouTube)
                    </Typography>
                    <Typography variant="caption" sx={{ display: 'block', mb: 0.5 }}>
                      • <strong>1.3-1.5</strong>: Fast, energetic (exciting, promotional content)
                    </Typography>
                    <Typography variant="caption" sx={{ display: 'block', mt: 0.5 }}>
                      <strong>Default:</strong> 1.15 - Optimized for engaging YouTube narration.
                    </Typography>
                  </Box>
                } arrow placement="right">
                  <HelpOutlineIcon fontSize="small" sx={{ color: "rgba(255,255,255,0.5)" }} />
                </Tooltip>
              </Stack>
              <Slider
                value={settings.speed}
                min={0.5}
                max={2.0}
                step={0.05}
                onChange={(_, v) => setSettings({ ...settings, speed: v as number })}
                sx={{ color: "#4ade80" }}
              />
              <Typography variant="caption" sx={{ opacity: 0.7 }}>
                0.5 = Slower (narrative) • 1.0 = Normal • 2.0 = Faster (energetic)
              </Typography>
            </Box>

            <Box sx={{ flex: 1 }}>
              <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                  Volume Level ({settings.volume.toFixed(1)})
                </Typography>
                <Tooltip title={
                  <Box>
                    <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>
                      Audio Loudness
                    </Typography>
                    <Typography variant="caption" sx={{ display: 'block', mb: 0.5 }}>
                      • <strong>0.1-0.5</strong>: Very soft, intimate whisper
                    </Typography>
                    <Typography variant="caption" sx={{ display: 'block', mb: 0.5 }}>
                      • <strong>0.8-1.2</strong>: Normal speaking volume
                    </Typography>
                    <Typography variant="caption" sx={{ display: 'block', mb: 0.5 }}>
                      • <strong>1.5-10.0</strong>: Loud, commanding presence
                    </Typography>
                    <Typography variant="caption" sx={{ display: 'block', mt: 0.5 }}>
                      <strong>Note:</strong> Very high volumes may cause distortion.
                    </Typography>
                  </Box>
                } arrow placement="right">
                  <HelpOutlineIcon fontSize="small" sx={{ color: "rgba(255,255,255,0.5)" }} />
                </Tooltip>
              </Stack>
              <Slider
                value={settings.volume}
                min={0.1}
                max={10.0}
                step={0.1}
                onChange={(_, v) => setSettings({ ...settings, volume: v as number })}
                sx={{ color: "#fbbf24" }}
              />
              <Typography variant="caption" sx={{ opacity: 0.7 }}>
                0.1 = Very soft • 1.0 = Normal • 10.0 = Very loud
              </Typography>
            </Box>

            <Box sx={{ flex: 1 }}>
              <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                  Voice Pitch ({settings.pitch})
                </Typography>
                <Tooltip title={
                  <Box>
                    <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>
                      Voice Tone & Character
                    </Typography>
                    <Typography variant="caption" sx={{ display: 'block', mb: 0.5 }}>
                      • <strong>-12 to -6</strong>: Deep, authoritative (male voices, serious content)
                    </Typography>
                    <Typography variant="caption" sx={{ display: 'block', mb: 0.5 }}>
                      • <strong>-2 to +2</strong>: Natural, conversational range
                    </Typography>
                    <Typography variant="caption" sx={{ display: 'block', mb: 0.5 }}>
                      • <strong>+3 to +12</strong>: Bright, energetic (female voices, upbeat content)
                    </Typography>
                    <Typography variant="caption" sx={{ display: 'block', mt: 0.5 }}>
                      <strong>Tip:</strong> Small adjustments (±2) sound most natural.
                    </Typography>
                  </Box>
                } arrow placement="right">
                  <HelpOutlineIcon fontSize="small" sx={{ color: "rgba(255,255,255,0.5)" }} />
                </Tooltip>
              </Stack>
              <Slider
                value={settings.pitch}
                min={-12}
                max={12}
                step={0.5}
                onChange={(_, v) => setSettings({ ...settings, pitch: v as number })}
                sx={{ color: "#f87171" }}
              />
              <Typography variant="caption" sx={{ opacity: 0.7 }}>
                -12 = Very deep • 0 = Normal • +12 = Very high
              </Typography>
            </Box>
          </Stack>

          {/* Emotion */}
          <Box>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                Emotional Delivery
              </Typography>
              <Tooltip title={
                <Box>
                  <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>
                    Voice Emotional Expression
                  </Typography>
                  <Typography variant="caption" sx={{ display: 'block', mb: 0.5 }}>
                    Choose the emotional tone that matches your content:
                  </Typography>
                  <Typography variant="caption" sx={{ display: 'block', mb: 0.5 }}>
                    • <strong>Happy</strong>: Warm, enthusiastic delivery
                  </Typography>
                  <Typography variant="caption" sx={{ display: 'block', mb: 0.5 }}>
                    • <strong>Neutral</strong>: Professional, straightforward tone
                  </Typography>
                  <Typography variant="caption" sx={{ display: 'block', mb: 0.5 }}>
                    • <strong>Sad</strong>: Somber, reflective delivery
                  </Typography>
                  <Typography variant="caption" sx={{ display: 'block', mb: 0.5 }}>
                    • <strong>Angry</strong>: Forceful, urgent tone (use sparingly)
                  </Typography>
                  <Typography variant="caption" sx={{ display: 'block', mt: 0.5 }}>
                    <strong>Recommendation:</strong> Happy/Neutral for most educational content.
                  </Typography>
                </Box>
              } arrow placement="right">
                <IconButton size="small" sx={{ color: "rgba(255,255,255,0.5)" }}>
                  <HelpOutlineIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </Stack>
            <FormControl fullWidth>
              <Select
                value={settings.emotion}
                onChange={(e) => setSettings({ ...settings, emotion: e.target.value })}
                sx={{
                  backgroundColor: alpha("#ffffff", 0.1),
                  color: "white",
                  "& .MuiOutlinedInput-notchedOutline": { borderColor: "rgba(255,255,255,0.3)" },
                  "&:hover .MuiOutlinedInput-notchedOutline": { borderColor: "rgba(255,255,255,0.4)" },
                  "&.Mui-focused .MuiOutlinedInput-notchedOutline": { borderColor: "#ffffff" },
                  "& .MuiSvgIcon-root": { color: "rgba(255,255,255,0.7)" },
                }}
              >
                {EMOTION_OPTIONS.map((emotion) => (
                  <MenuItem key={emotion} value={emotion}>
                    {emotion.charAt(0).toUpperCase() + emotion.slice(1)}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <Typography variant="caption" sx={{ opacity: 0.7, mt: 0.5, display: "block" }}>
              Select the emotional tone. "Happy" provides natural, engaging delivery for most YouTube content.
            </Typography>
          </Box>

          {/* Language & Normalization */}
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <Box sx={{ flex: 1 }}>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={settings.englishNormalization}
                    onChange={(e) => setSettings({ ...settings, englishNormalization: e.target.checked })}
                    sx={{ color: "rgba(255,255,255,0.7)" }}
                  />
                }
                label={
                  <Typography variant="body2" sx={{ color: "white" }}>
                    English text normalization
                  </Typography>
                }
              />
              <Typography variant="caption" sx={{ opacity: 0.7 }}>
                Improves pronunciation of numbers (42 → "forty-two"), dates, currencies, and technical terms. Recommended for most English content.
              </Typography>
            </Box>

            <Box sx={{ flex: 1 }}>
              <TextField
                select
                fullWidth
                label="Language boost"
                value={settings.languageBoost || "auto"}
                onChange={(e) => setSettings({ ...settings, languageBoost: e.target.value })}
                InputLabelProps={{ sx: { color: "rgba(255,255,255,0.7)" } }}
                sx={{
                  "& .MuiOutlinedInput-root": {
                    backgroundColor: alpha("#ffffff", 0.1),
                    color: "white",
                    "& fieldset": { borderColor: "rgba(255,255,255,0.3)" },
                    "&:hover fieldset": { borderColor: "rgba(255,255,255,0.4)" },
                    "&.Mui-focused fieldset": { borderColor: "#ffffff" },
                    "& .MuiSvgIcon-root": { color: "rgba(255,255,255,0.7)" },
                  },
                }}
              >
                {LANGUAGE_BOOST_OPTIONS.map((option) => (
                  <MenuItem key={option} value={option}>
                    {option}
                  </MenuItem>
                ))}
              </TextField>
              <Typography variant="caption" sx={{ opacity: 0.7, mt: 0.5, display: "block" }}>
                Improves pronunciation accuracy for content in specific languages or regional dialects. Use "auto" for automatic detection.
              </Typography>
            </Box>
          </Stack>

          {/* Quality Settings */}
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <Box sx={{ flex: 1 }}>
              <TextField
                select
                fullWidth
                label="Sample rate"
                value={settings.sampleRate || 24000}
                onChange={(e) => setSettings({ ...settings, sampleRate: Number(e.target.value) })}
                InputLabelProps={{ sx: { color: "rgba(255,255,255,0.7)" } }}
                sx={{
                  "& .MuiOutlinedInput-root": {
                    backgroundColor: alpha("#ffffff", 0.1),
                    color: "white",
                    "& fieldset": { borderColor: "rgba(255,255,255,0.3)" },
                    "&:hover fieldset": { borderColor: "rgba(255,255,255,0.4)" },
                    "&.Mui-focused fieldset": { borderColor: "#ffffff" },
                    "& .MuiSvgIcon-root": { color: "rgba(255,255,255,0.7)" },
                  },
                }}
              >
                {SAMPLE_RATE_OPTIONS.map((rate) => (
                  <MenuItem key={rate} value={rate}>
                    {rate} Hz
                  </MenuItem>
                ))}
              </TextField>
              <Typography variant="caption" sx={{ opacity: 0.7, mt: 0.5, display: "block" }}>
                Sample rate affects audio clarity. 24kHz is optimal for voice content - higher values increase file size without noticeable improvement.
              </Typography>
            </Box>

            <Box sx={{ flex: 1 }}>
              <TextField
                select
                fullWidth
                label="Bitrate"
                value={settings.bitrate}
                onChange={(e) => setSettings({ ...settings, bitrate: Number(e.target.value) })}
                InputLabelProps={{ sx: { color: "rgba(255,255,255,0.7)" } }}
                sx={{
                  "& .MuiOutlinedInput-root": {
                    backgroundColor: alpha("#ffffff", 0.1),
                    color: "white",
                    "& fieldset": { borderColor: "rgba(255,255,255,0.3)" },
                    "&:hover fieldset": { borderColor: "rgba(255,255,255,0.4)" },
                    "&.Mui-focused fieldset": { borderColor: "#ffffff" },
                    "& .MuiSvgIcon-root": { color: "rgba(255,255,255,0.7)" },
                  },
                }}
              >
                {BITRATE_OPTIONS.map((bitrate) => (
                  <MenuItem key={bitrate} value={bitrate}>
                    {bitrate / 1000} kbps
                  </MenuItem>
                ))}
              </TextField>
              <Typography variant="caption" sx={{ opacity: 0.7, mt: 0.5, display: "block" }}>
                Audio quality vs file size trade-off. 128kbps provides excellent voice quality with reasonable file sizes.
              </Typography>
            </Box>
          </Stack>

          {/* Format & Channel */}
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <Box sx={{ flex: 1 }}>
              <TextField
                select
                fullWidth
                label="Channel"
                value={settings.channel}
                onChange={(e) => setSettings({ ...settings, channel: e.target.value as "1" | "2" })}
                InputLabelProps={{ sx: { color: "rgba(255,255,255,0.7)" } }}
                sx={{
                  "& .MuiOutlinedInput-root": {
                    backgroundColor: alpha("#ffffff", 0.1),
                    color: "white",
                    "& fieldset": { borderColor: "rgba(255,255,255,0.3)" },
                    "&:hover fieldset": { borderColor: "rgba(255,255,255,0.4)" },
                    "&.Mui-focused fieldset": { borderColor: "#ffffff" },
                    "& .MuiSvgIcon-root": { color: "rgba(255,255,255,0.7)" },
                  },
                }}
              >
                <MenuItem value="1">Mono (smaller files, standard for voice)</MenuItem>
                <MenuItem value="2">Stereo (wider sound, larger files)</MenuItem>
              </TextField>
            </Box>

            <Box sx={{ flex: 1 }}>
              <TextField
                select
                fullWidth
                label="Format"
                value={settings.format}
                onChange={(e) => setSettings({ ...settings, format: e.target.value as "mp3" | "wav" | "pcm" | "flac" })}
                InputLabelProps={{ sx: { color: "rgba(255,255,255,0.7)" } }}
                sx={{
                  "& .MuiOutlinedInput-root": {
                    backgroundColor: alpha("#ffffff", 0.1),
                    color: "white",
                    "& fieldset": { borderColor: "rgba(255,255,255,0.3)" },
                    "&:hover fieldset": { borderColor: "rgba(255,255,255,0.4)" },
                    "&.Mui-focused fieldset": { borderColor: "#ffffff" },
                    "& .MuiSvgIcon-root": { color: "rgba(255,255,255,0.7)" },
                  },
                }}
              >
                <MenuItem value="mp3">MP3 (compressed, widely supported)</MenuItem>
                <MenuItem value="wav">WAV (uncompressed, highest quality)</MenuItem>
                <MenuItem value="pcm">PCM (raw data, specialized use)</MenuItem>
                <MenuItem value="flac">FLAC (lossless, large files)</MenuItem>
              </TextField>
            </Box>
          </Stack>

          {/* Sync Mode */}
          <Box>
            <FormControlLabel
              control={
                <Checkbox
                  checked={settings.enableSyncMode}
                  onChange={(e) => setSettings({ ...settings, enableSyncMode: e.target.checked })}
                  sx={{ color: "rgba(255,255,255,0.7)" }}
                />
              }
              label={
                <Typography variant="body2" sx={{ color: "white" }}>
                  Enable sync mode (recommended)
                </Typography>
              }
            />
            <Typography variant="caption" sx={{ opacity: 0.7 }}>
              When enabled, waits for generation to complete before proceeding. Recommended for reliable audio delivery.
            </Typography>
          </Box>

          {/* Pro Tips */}
          <Box sx={{ mt: 2, p: 2, bgcolor: alpha("#ffffff", 0.05), borderRadius: 1, border: "1px solid rgba(255,255,255,0.1)" }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1, color: "white" }}>
              💡 Human-Like Audio Tips
            </Typography>
            <Typography variant="caption" sx={{ opacity: 0.8, display: "block", mb: 0.5 }}>
              • <strong>Voice Choice</strong>: "Casual_Guy" provides natural, conversational delivery perfect for YouTube
            </Typography>
            <Typography variant="caption" sx={{ opacity: 0.8, display: "block", mb: 0.5 }}>
              • <strong>Speed</strong>: 1.15 provides engaging pace - not too slow, not too fast, just right for viewers
            </Typography>
            <Typography variant="caption" sx={{ opacity: 0.8, display: "block", mb: 0.5 }}>
              • <strong>Emotion</strong>: "Happy" creates natural, positive delivery that keeps viewers engaged
            </Typography>
            <Typography variant="caption" sx={{ opacity: 0.8, display: "block", mb: 0.5 }}>
              • <strong>Quality</strong>: 128kbps MP3 provides professional quality with optimal file sizes
            </Typography>
            <Typography variant="caption" sx={{ opacity: 0.8, display: "block" }}>
              • <strong>Enhancement</strong>: English normalization improves pronunciation of numbers, dates, and technical terms
            </Typography>
          </Box>
        </Stack>
      </DialogContent>

      <DialogActions sx={{ p: 3, pt: 2 }}>
        <Button
          onClick={onClose}
          disabled={isGenerating}
          sx={{ color: "rgba(255,255,255,0.7)" }}
        >
          Cancel
        </Button>
        <Button
          onClick={handleApply}
          variant="contained"
          disabled={isGenerating}
          startIcon={isGenerating ? undefined : <VolumeUp />}
          sx={{
            backgroundColor: "#4ade80",
            "&:hover": { backgroundColor: "#22c55e" },
            "&:disabled": { backgroundColor: "rgba(255,255,255,0.2)" },
          }}
        >
          {isGenerating ? "Generating..." : "Apply Settings & Generate"}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
