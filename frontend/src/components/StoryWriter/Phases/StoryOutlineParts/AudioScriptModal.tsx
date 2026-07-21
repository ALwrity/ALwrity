import React from 'react';
import { 
  Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, 
  TextField, Divider, CircularProgress, Typography, Tooltip, IconButton,
  Slider, FormControl, InputLabel, Select, MenuItem, FormHelperText,
  ToggleButtonGroup, ToggleButton 
} from '@mui/material';
import VolumeUpIcon from '@mui/icons-material/VolumeUp';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import { OperationButton } from '../../../shared/OperationButton';
import { modalPaperSx, modalSelectMenuProps } from './modalStyles';

interface AudioScriptModalProps {
  open: boolean;
  sceneNumber: number;
  value: string;
  onChange: (v: string) => void;
  onClose: () => void;
  onSave: () => void;
  // audio settings
  audioProvider: string;
  audioLang: string;
  audioSlow: boolean;
  audioRate: number;
  onChangeProvider: (v: string) => void;
  onChangeLang: (v: string) => void;
  onChangeSlow: (v: boolean) => void;
  onChangeRate: (v: number) => void;
  audioUrl?: string | null;
  // audio generation callbacks - now with full parameters
  onGenerateAI?: (params: {
    text: string;
    voice_id?: string;
    speed?: number;
    volume?: number;
    pitch?: number;
    emotion?: string;
  }) => Promise<void>;
  onGenerateFree?: (text: string) => Promise<void>;
}

// Available voice IDs from WaveSpeed Minimax
const AVAILABLE_VOICES = [
  { value: 'Wise_Woman', label: 'Wise Woman', description: 'Warm, authoritative female voice' },
  { value: 'Friendly_Person', label: 'Friendly Person', description: 'Approachable and conversational' },
  { value: 'Inspirational_girl', label: 'Inspirational Girl', description: 'Energetic and motivating' },
  { value: 'Deep_Voice_Man', label: 'Deep Voice Man', description: 'Rich, deep male voice' },
  { value: 'Calm_Woman', label: 'Calm Woman', description: 'Peaceful and soothing' },
  { value: 'Casual_Guy', label: 'Casual Guy', description: 'Relaxed and informal' },
  { value: 'Lively_Girl', label: 'Lively Girl', description: 'Vibrant and enthusiastic' },
  { value: 'Patient_Man', label: 'Patient Man', description: 'Steady and reassuring' },
  { value: 'Young_Knight', label: 'Young Knight', description: 'Brave and confident' },
  { value: 'Determined_Man', label: 'Determined Man', description: 'Strong and resolute' },
  { value: 'Lovely_Girl', label: 'Lovely Girl', description: 'Sweet and charming' },
  { value: 'Decent_Boy', label: 'Decent Boy', description: 'Polite and well-mannered' },
  { value: 'Imposing_Manner', label: 'Imposing Manner', description: 'Commanding and powerful' },
  { value: 'Elegant_Man', label: 'Elegant Man', description: 'Sophisticated and refined' },
  { value: 'Abbess', label: 'Abbess', description: 'Dignified and wise' },
  { value: 'Sweet_Girl_2', label: 'Sweet Girl 2', description: 'Gentle and kind' },
  { value: 'Exuberant_Girl', label: 'Exuberant Girl', description: 'Joyful and energetic' },
];

const EMOTIONS = [
  { value: 'happy', label: 'Happy', description: 'Cheerful and upbeat tone' },
  { value: 'sad', label: 'Sad', description: 'Melancholic and somber tone' },
  { value: 'angry', label: 'Angry', description: 'Intense and forceful tone' },
  { value: 'fear', label: 'Fear', description: 'Anxious and nervous tone' },
  { value: 'surprised', label: 'Surprised', description: 'Astonished and amazed tone' },
  { value: 'neutral', label: 'Neutral', description: 'Calm and balanced tone (default)' },
];

const AudioScriptModal: React.FC<AudioScriptModalProps> = ({
  open, sceneNumber, value, onChange, onClose, onSave,
  audioProvider, audioLang, audioSlow, audioRate,
  onChangeProvider, onChangeLang, onChangeSlow, onChangeRate,
  audioUrl,
  onGenerateAI,
  onGenerateFree,
}) => {
  const [isGeneratingAI, setIsGeneratingAI] = React.useState(false);
  const [isGeneratingFree, setIsGeneratingFree] = React.useState(false);
  const [generateError, setGenerateError] = React.useState<string | null>(null);
  
  // Audio type toggle - default to 'free'
  const [audioType, setAudioType] = React.useState<'free' | 'ai'>('free');
  
  // AI Audio generation parameters with intelligent defaults
  const [voiceId, setVoiceId] = React.useState<string>('Wise_Woman');
  const [customVoiceId, setCustomVoiceId] = React.useState<string>('');
  const [useCustomVoice, setUseCustomVoice] = React.useState<boolean>(false);
  const [emotion, setEmotion] = React.useState<string>('happy');
  const [speed, setSpeed] = React.useState<number>(1.0);
  const [volume, setVolume] = React.useState<number>(1.0);
  const [pitch, setPitch] = React.useState<number>(0.0);

  const handleGenerateAI = async () => {
    if (!onGenerateAI || !value.trim()) {
      return;
    }
    
    setIsGeneratingAI(true);
    setGenerateError(null);
    try {
      await onGenerateAI({
        text: value.trim(),
        voice_id: useCustomVoice ? customVoiceId : voiceId,
        emotion: emotion,
        speed: speed,
        volume: volume,
        pitch: pitch,
      });
      // Optionally close modal after successful generation
      // onClose();
    } catch (err: any) {
      setGenerateError(err?.response?.data?.detail || err?.message || 'Failed to generate AI audio');
    } finally {
      setIsGeneratingAI(false);
    }
  };

  const handleGenerateFree = async () => {
    if (!onGenerateFree || !value.trim()) {
      return;
    }
    
    setIsGeneratingFree(true);
    setGenerateError(null);
    try {
      await onGenerateFree(value.trim());
      // Optionally close modal after successful generation
      // onClose();
    } catch (err: any) {
      setGenerateError(err?.response?.data?.detail || err?.message || 'Failed to generate free audio');
    } finally {
      setIsGeneratingFree(false);
    }
  };
  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: modalPaperSx,
      }}
    >
      <DialogTitle>Edit Audio Narration Script (Scene {sceneNumber})</DialogTitle>
      <DialogContent dividers>
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            gap: 3,
            pt: 1,
            '& .MuiFormLabel-root': { color: '#5D4037', fontWeight: 500 },
            '& .MuiInputBase-root': { 
              color: '#2C2416',
              bgcolor: '#fff',
              '& .MuiOutlinedInput-notchedOutline': {
                borderColor: 'rgba(0, 0, 0, 0.23)',
              },
              '&:hover .MuiOutlinedInput-notchedOutline': {
                borderColor: 'rgba(0, 0, 0, 0.87)',
              },
              '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                borderColor: 'primary.main',
                borderWidth: '2px',
              },
            },
            '& .MuiInputBase-input': {
              color: '#2C2416',
            },
            '& textarea': {
              color: '#2C2416',
            },
            '& .MuiSelect-select': {
              color: '#2C2416',
            },
            '& .MuiFormHelperText-root': {
              color: 'rgba(0, 0, 0, 0.6)',
            },
            '& .MuiMenuItem-root': {
              color: '#2C2416',
            },
          }}
        >
          {audioUrl ? (
            <Box
              sx={{
                p: 1,
                backgroundColor: 'rgba(0,0,0,0.03)',
                borderRadius: 1,
                border: '1px solid rgba(0,0,0,0.06)',
              }}
            >
              <audio controls src={audioUrl || undefined} style={{ width: '100%' }}>
                Your browser does not support the audio element.
              </audio>
            </Box>
          ) : null}
          <TextField
            label="Audio Narration"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            multiline
            minRows={6}
            fullWidth
            placeholder="Enter the narration text for this scene..."
            sx={{
              '& .MuiInputBase-input': {
                color: '#2C2416',
              },
            }}
          />
          
          {generateError && (
            <Box sx={{ color: 'error.main', fontSize: '0.875rem', mt: -1 }}>
              {generateError}
            </Box>
          )}

          <Divider sx={{ my: 1 }} />

          {/* Audio Type Toggle */}
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Box>
              <Typography variant="subtitle2" sx={{ mb: 1.5, fontWeight: 600, color: '#5D4037' }}>
                Audio Type
              </Typography>
              <ToggleButtonGroup
                value={audioType}
                exclusive
                onChange={(_, newValue) => {
                  if (newValue !== null) {
                    setAudioType(newValue);
                    setGenerateError(null);
                  }
                }}
                aria-label="audio type"
                fullWidth
                sx={{
                  '& .MuiToggleButton-root': {
                    textTransform: 'none',
                    borderColor: 'rgba(0, 0, 0, 0.23)',
                    color: '#5D4037',
                    '&.Mui-selected': {
                      backgroundColor: 'primary.main',
                      color: '#fff',
                      '&:hover': {
                        backgroundColor: 'primary.dark',
                      },
                    },
                    '&:hover': {
                      backgroundColor: 'rgba(0, 0, 0, 0.04)',
                    },
                  },
                }}
              >
                <ToggleButton value="free" aria-label="free audio">
                  <VolumeUpIcon sx={{ mr: 1 }} />
                  Free Audio (gTTS)
                </ToggleButton>
                <ToggleButton value="ai" aria-label="ai audio">
                  <SmartToyIcon sx={{ mr: 1 }} />
                  AI Audio (Minimax)
                </ToggleButton>
              </ToggleButtonGroup>
            </Box>

            {/* Generate Button - Context aware based on audio type */}
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
              {audioType === 'ai' && onGenerateAI && (
                <OperationButton
                  operation={{
                    provider: 'audio',
                    model: 'minimax/speech-02-hd',
                    tokens_requested: value.trim().length, // Every character is 1 token
                    operation_type: 'audio_generation',
                    actual_provider_name: 'wavespeed',
                  }}
                  label="Generate AI Audio"
                  variant="contained"
                  size="medium"
                  startIcon={<SmartToyIcon />}
                  showCost={true}
                  checkOnHover={true}
                  checkOnMount={false}
                  onClick={handleGenerateAI}
                  disabled={isGeneratingAI || isGeneratingFree || !value.trim()}
                  loading={isGeneratingAI}
                  sx={{ flex: 1, minWidth: '200px' }}
                />
              )}

              {audioType === 'free' && onGenerateFree && (
                <Button
                  variant="contained"
                  size="medium"
                  startIcon={isGeneratingFree ? <CircularProgress size={16} /> : <VolumeUpIcon />}
                  onClick={handleGenerateFree}
                  disabled={isGeneratingAI || isGeneratingFree || !value.trim()}
                  sx={{ flex: 1, minWidth: '200px' }}
                >
                  {isGeneratingFree ? 'Generating...' : 'Generate Free Audio (gTTS)'}
                </Button>
              )}
            </Box>

            <Divider sx={{ my: 1 }} />

            {/* Settings - Conditionally shown based on audio type */}
            {audioType === 'ai' && (
              <Box>
                <Typography variant="subtitle2" sx={{ mb: 2, fontWeight: 600, color: '#5D4037' }}>
                  AI Audio Generation Settings
                </Typography>
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2 }}>
              {/* Voice Selection */}
              <FormControl fullWidth>
                <InputLabel>Voice</InputLabel>
                <Select
                  value={useCustomVoice ? 'custom' : voiceId}
                  onChange={(e) => {
                    if (e.target.value === 'custom') {
                      setUseCustomVoice(true);
                    } else {
                      setUseCustomVoice(false);
                      setVoiceId(e.target.value);
                    }
                  }}
                  label="Voice"
                  {...modalSelectMenuProps}
                  renderValue={(value) => {
                    if (value === 'custom') {
                      return customVoiceId || 'Custom Voice ID';
                    }
                    const voice = AVAILABLE_VOICES.find(v => v.value === value);
                    return voice ? voice.label : value;
                  }}
                >
                  {AVAILABLE_VOICES.map((voice) => (
                    <MenuItem key={voice.value} value={voice.value}>
                      <Box>
                        <Typography variant="body2" sx={{ fontWeight: 500 }}>
                          {voice.label}
                        </Typography>
                        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                          {voice.description}
                        </Typography>
                      </Box>
                    </MenuItem>
                  ))}
                  <MenuItem value="custom">
                    <Box>
                      <Typography variant="body2" sx={{ fontWeight: 500, fontStyle: 'italic' }}>
                        Custom Voice ID...
                      </Typography>
                      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                        Use a voice ID from voice cloning
                      </Typography>
                    </Box>
                  </MenuItem>
                </Select>
                <FormHelperText>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    Choose a voice that matches your story's tone
                    <Tooltip
                      title={
                        <Box sx={{ p: 0.5 }}>
                          <Typography variant="caption" sx={{ display: 'block', mb: 0.5 }}>
                            Current Voice ID: {voiceId}
                          </Typography>
                          <Typography variant="caption" sx={{ display: 'block', mb: 0.5 }}>
                            You can use system voices above or enter a custom voice ID from voice cloning.
                          </Typography>
                          <Typography variant="caption" sx={{ display: 'block' }}>
                            Learn more:{' '}
                            <a
                              href="https://wavespeed.ai/models/minimax/voice-clone"
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{ color: '#90caf9' }}
                            >
                              Voice Cloning Guide
                            </a>
                          </Typography>
                        </Box>
                      }
                      arrow
                      placement="top"
                    >
                      <InfoOutlinedIcon sx={{ fontSize: '0.875rem', color: 'text.secondary', cursor: 'help' }} />
                    </Tooltip>
                  </Box>
                </FormHelperText>
              </FormControl>
              
              {/* Custom Voice ID Input (shown when custom voice is selected) */}
              {useCustomVoice && (
                <TextField
                  fullWidth
                  label="Custom Voice ID"
                  value={customVoiceId}
                  onChange={(e) => setCustomVoiceId(e.target.value)}
                  helperText="Enter your custom voice ID from voice cloning"
                  placeholder="your-custom-voice-id"
                />
              )}

              {/* Emotion Selection */}
              <FormControl fullWidth>
                <InputLabel>Emotion</InputLabel>
                <Select
                  value={emotion}
                  onChange={(e) => setEmotion(e.target.value)}
                  label="Emotion"
                >
                  {EMOTIONS.map((em) => (
                    <MenuItem key={em.value} value={em.value}>
                      <Box>
                        <Typography variant="body2">{em.label}</Typography>
                        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                          {em.description}
                        </Typography>
                      </Box>
                    </MenuItem>
                  ))}
                </Select>
                <FormHelperText>
                  Select the emotional tone for the narration
                </FormHelperText>
              </FormControl>

              {/* Speed Slider */}
              <Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                  <Typography variant="body2" sx={{ minWidth: '60px' }}>
                    Speed
                  </Typography>
                  <Slider
                    value={speed}
                    onChange={(_, newValue) => setSpeed(newValue as number)}
                    min={0.5}
                    max={2.0}
                    step={0.1}
                    valueLabelDisplay="auto"
                    valueLabelFormat={(value) => `${value}x`}
                    sx={{ flex: 1 }}
                  />
                  <Typography variant="body2" sx={{ minWidth: '40px', textAlign: 'right' }}>
                    {speed.toFixed(1)}x
                  </Typography>
                </Box>
                <FormHelperText>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    Speech speed (0.5x = slow, 1.0x = normal, 2.0x = fast)
                    <Tooltip
                      title="Adjust how fast the narration speaks. 1.0 is normal speed, suitable for most content."
                      arrow
                      placement="top"
                    >
                      <InfoOutlinedIcon sx={{ fontSize: '0.875rem', color: 'text.secondary', cursor: 'help' }} />
                    </Tooltip>
                  </Box>
                </FormHelperText>
              </Box>

              {/* Volume Slider */}
              <Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                  <Typography variant="body2" sx={{ minWidth: '60px' }}>
                    Volume
                  </Typography>
                  <Slider
                    value={volume}
                    onChange={(_, newValue) => setVolume(newValue as number)}
                    min={0.1}
                    max={10.0}
                    step={0.1}
                    valueLabelDisplay="auto"
                    valueLabelFormat={(value) => `${value.toFixed(1)}`}
                    sx={{ flex: 1 }}
                  />
                  <Typography variant="body2" sx={{ minWidth: '40px', textAlign: 'right' }}>
                    {volume.toFixed(1)}
                  </Typography>
                </Box>
                <FormHelperText>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    Audio volume level (0.1 = quiet, 1.0 = normal, 10.0 = loud)
                    <Tooltip
                      title="Control the loudness of the audio. 1.0 is standard volume. Increase for emphasis, decrease for subtlety."
                      arrow
                      placement="top"
                    >
                      <InfoOutlinedIcon sx={{ fontSize: '0.875rem', color: 'text.secondary', cursor: 'help' }} />
                    </Tooltip>
                  </Box>
                </FormHelperText>
              </Box>

              {/* Pitch Slider */}
              <Box sx={{ gridColumn: { xs: '1', md: '1 / -1' } }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                  <Typography variant="body2" sx={{ minWidth: '60px' }}>
                    Pitch
                  </Typography>
                  <Slider
                    value={pitch}
                    onChange={(_, newValue) => setPitch(newValue as number)}
                    min={-12}
                    max={12}
                    step={1}
                    valueLabelDisplay="auto"
                    valueLabelFormat={(value) => `${value > 0 ? '+' : ''}${value}`}
                    marks={[
                      { value: -12, label: '-12' },
                      { value: 0, label: '0' },
                      { value: 12, label: '+12' },
                    ]}
                    sx={{ flex: 1 }}
                  />
                  <Typography variant="body2" sx={{ minWidth: '50px', textAlign: 'right' }}>
                    {pitch > 0 ? '+' : ''}{pitch}
                  </Typography>
                </Box>
                <FormHelperText>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    Voice pitch adjustment (-12 = lower, 0 = normal, +12 = higher)
                    <Tooltip
                      title="Adjust the pitch of the voice. Negative values make the voice deeper, positive values make it higher. 0 keeps the natural voice pitch."
                      arrow
                      placement="top"
                    >
                      <InfoOutlinedIcon sx={{ fontSize: '0.875rem', color: 'text.secondary', cursor: 'help' }} />
                    </Tooltip>
                  </Box>
                </FormHelperText>
              </Box>
            </Box>
              </Box>
            )}

            {audioType === 'free' && (
              <Box>
                <Typography variant="subtitle2" sx={{ mb: 2, fontWeight: 600, color: '#5D4037' }}>
                  Free Audio (gTTS) Settings
                </Typography>
                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2 }}>
                  <TextField
                    select
                    label="Audio Provider"
                    value={audioProvider}
                    onChange={(e) => onChangeProvider(e.target.value)}
                    SelectProps={{ native: true }}
                    helperText="Text-to-speech engine for free audio generation"
                  >
                    <option value="gtts">gTTS (Google Text-to-Speech)</option>
                    <option value="pyttsx3">pyttsx3 (Offline)</option>
                  </TextField>
                  <TextField
                    label="Language"
                    value={audioLang}
                    onChange={(e) => onChangeLang(e.target.value)}
                    helperText="Language code (e.g., en for English, hi for Hindi)"
                    placeholder="en"
                  />
                  <TextField
                    select
                    label="Speech Speed (gTTS)"
                    value={audioSlow ? 'true' : 'false'}
                    onChange={(e) => onChangeSlow(e.target.value === 'true')}
                    SelectProps={{ native: true }}
                    helperText="Whether to speak slowly (useful for clarity)"
                  >
                    <option value="false">Normal Speed</option>
                    <option value="true">Slow Speed</option>
                  </TextField>
                  <TextField
                    type="number"
                    label="Speech Rate (pyttsx3)"
                    value={audioRate}
                    onChange={(e) => onChangeRate(Number(e.target.value))}
                    inputProps={{ min: 50, max: 300, step: 10 }}
                    helperText="Words per minute (50-300, default: 150)"
                  />
                </Box>
              </Box>
            )}
          </Box>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={onSave}>Save</Button>
      </DialogActions>
    </Dialog>
  );
};

export default AudioScriptModal;

