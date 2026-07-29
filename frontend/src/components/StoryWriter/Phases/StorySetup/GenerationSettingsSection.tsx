import React from 'react';
import {
  Box,
  Typography,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Grid,
  TextField,
  MenuItem,
  FormControlLabel,
  Checkbox,
  Slider,
  Chip,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { SectionProps } from './types';
import { textFieldStyles, accordionStyles, selectMenuProps } from './styles';
import { IMAGE_PROVIDERS, AUDIO_PROVIDERS, COMMON_IMAGE_SIZES } from './constants';

export const GenerationSettingsSection: React.FC<SectionProps> = ({ state }) => {
  const imageDisabled = !state.enableIllustration;
  const audioDisabled = !state.enableNarration;
  const videoDisabled = !state.enableVideoNarration;

  const disabledStyles = (disabled: boolean) =>
    disabled
      ? {
          opacity: 0.4,
          pointerEvents: 'none',
        }
      : undefined;

  const renderHeading = (title: string, disabled: boolean) => (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
      <Typography variant="subtitle1" sx={{ fontWeight: 600, color: '#1A1611' }}>
        {title}
      </Typography>
      {disabled && <Chip label="Disabled in Story Setup" size="small" />}
    </Box>
  );

  return (
    <Box sx={{ mt: 4 }}>
      <Typography variant="h6" gutterBottom sx={{ mb: 2, fontWeight: 600 }}>
        Generation Settings
      </Typography>
      <Typography variant="body2" sx={{ mb: 3, color: '#5D4037' }}>
        Configure image, video, and audio generation options for your story.
      </Typography>

      {/* Image Generation Settings */}
      <Accordion sx={accordionStyles} disabled={imageDisabled}>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          {renderHeading('Image Generation Settings', imageDisabled)}
        </AccordionSummary>
        <AccordionDetails sx={disabledStyles(imageDisabled)}>
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                select
                label="Image Provider"
                value={state.imageProvider || ''}
                onChange={(e) => state.setImageProvider(e.target.value || null)}
                helperText="Select the image generation provider. Leave as 'Auto' to use the default."
                sx={textFieldStyles}
                SelectProps={selectMenuProps}
                disabled={imageDisabled}
              >
                {IMAGE_PROVIDERS.map((provider) => (
                  <MenuItem key={provider.value} value={provider.value}>
                    {provider.label}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                select
                label="Image Size"
                value={`${state.imageWidth}x${state.imageHeight}`}
                onChange={(e) => {
                  const [width, height] = e.target.value.split('x').map(Number);
                  state.setImageWidth(width);
                  state.setImageHeight(height);
                }}
                helperText="Select a common image size or set custom dimensions below."
                sx={textFieldStyles}
                SelectProps={selectMenuProps}
                disabled={imageDisabled}
              >
                {COMMON_IMAGE_SIZES.map((size) => (
                  <MenuItem key={`${size.width}x${size.height}`} value={`${size.width}x${size.height}`}>
                    {size.label}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                type="number"
                label="Image Width"
                value={state.imageWidth}
                onChange={(e) => state.setImageWidth(Number(e.target.value))}
                inputProps={{ min: 256, max: 2048, step: 64 }}
                helperText="Image width in pixels (256-2048)"
                sx={textFieldStyles}
                disabled={imageDisabled}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                type="number"
                label="Image Height"
                value={state.imageHeight}
                onChange={(e) => state.setImageHeight(Number(e.target.value))}
                inputProps={{ min: 256, max: 2048, step: 64 }}
                helperText="Image height in pixels (256-2048)"
                sx={textFieldStyles}
                disabled={imageDisabled}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Image Model (Optional)"
                value={state.imageModel || ''}
                onChange={(e) => state.setImageModel(e.target.value || null)}
                placeholder="Leave empty to use default model"
                helperText="Specific model to use for image generation (optional)"
                sx={textFieldStyles}
                disabled={imageDisabled}
              />
            </Grid>
          </Grid>
        </AccordionDetails>
      </Accordion>

      {/* Video Generation Settings */}
      <Accordion sx={accordionStyles} disabled={videoDisabled}>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          {renderHeading('Video Generation Settings', videoDisabled)}
        </AccordionSummary>
        <AccordionDetails sx={disabledStyles(videoDisabled)}>
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                type="number"
                label="Frames Per Second (FPS)"
                value={state.videoFps}
                onChange={(e) => state.setVideoFps(Number(e.target.value))}
                inputProps={{ min: 15, max: 60, step: 1 }}
                helperText="Video frame rate (15-60 fps). Higher values create smoother video but larger files."
                sx={textFieldStyles}
                disabled={videoDisabled}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <Box>
                <Typography variant="body2" gutterBottom>
                  Transition Duration: {state.videoTransitionDuration.toFixed(1)}s
                </Typography>
                <Slider
                  value={state.videoTransitionDuration}
                  onChange={(_, value) => state.setVideoTransitionDuration(value as number)}
                  min={0}
                  max={2}
                  step={0.1}
                  marks={[
                    { value: 0, label: '0s' },
                    { value: 1, label: '1s' },
                    { value: 2, label: '2s' },
                  ]}
                  valueLabelDisplay="auto"
                  disabled={videoDisabled}
                />
                <Typography variant="caption" sx={{ color: '#5D4037' }}>
                  Duration of transitions between scenes in seconds
                </Typography>
              </Box>
            </Grid>
          </Grid>
        </AccordionDetails>
      </Accordion>

      {/* Audio Generation Settings */}
      <Accordion sx={accordionStyles} disabled={audioDisabled}>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          {renderHeading('Audio Generation Settings', audioDisabled)}
        </AccordionSummary>
        <AccordionDetails sx={disabledStyles(audioDisabled)}>
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                select
                label="Audio Provider"
                value={state.audioProvider}
                onChange={(e) => state.setAudioProvider(e.target.value)}
                helperText="Text-to-speech provider for narration"
                sx={textFieldStyles}
                SelectProps={selectMenuProps}
                disabled={audioDisabled}
              >
                {AUDIO_PROVIDERS.map((provider) => (
                  <MenuItem key={provider.value} value={provider.value}>
                    {provider.label}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Language Code"
                value={state.audioLang}
                onChange={(e) => state.setAudioLang(e.target.value)}
                placeholder="en"
                helperText="Language code for text-to-speech (e.g., 'en' for English, 'es' for Spanish)"
                sx={textFieldStyles}
                disabled={audioDisabled}
              />
            </Grid>
            {state.audioProvider === 'gtts' && (
              <Grid item xs={12} md={6}>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={state.audioSlow}
                      onChange={(e) => state.setAudioSlow(e.target.checked)}
                      disabled={audioDisabled}
                    />
                  }
                  label="Slow Speech (gTTS only)"
                />
              </Grid>
            )}
            {state.audioProvider === 'pyttsx3' && (
              <Grid item xs={12} md={6}>
                <Box>
                  <Typography variant="body2" gutterBottom>
                    Speech Rate: {state.audioRate} words/min
                  </Typography>
                  <Slider
                    value={state.audioRate}
                    onChange={(_, value) => state.setAudioRate(value as number)}
                    min={50}
                    max={300}
                    step={10}
                    marks={[
                      { value: 50, label: '50' },
                      { value: 150, label: '150' },
                      { value: 300, label: '300' },
                    ]}
                    valueLabelDisplay="auto"
                    disabled={audioDisabled}
                  />
                  <Typography variant="caption" sx={{ color: '#5D4037' }}>
                    Speech rate in words per minute (pyttsx3 only)
                  </Typography>
                </Box>
              </Grid>
            )}
          </Grid>
        </AccordionDetails>
      </Accordion>
    </Box>
  );
};

