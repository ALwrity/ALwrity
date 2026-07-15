/** SettingsPanel — Animation settings controls.
 *
 * Duration, end-frame freeze, max-width, palette, and loop controls.
 * Pure React. Zero ALwrity dependencies.
 */

import React from 'react';
import {
  Box,
  Typography,
  Slider,
  Switch,
  FormControlLabel,
  FormControl,
  FormLabel,
  RadioGroup,
  Radio,
  TextField,
  Paper,
  Tooltip,
} from '@mui/material';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import type { GifSettings } from './types';
import { SETTINGS_LIMITS, OPTIMIZE_LABELS, OPTIMIZE_DESCRIPTIONS } from './types';

interface SettingsPanelProps {
  settings: GifSettings;
  onChange: (settings: GifSettings) => void;
}

export const SettingsPanel: React.FC<SettingsPanelProps> = ({
  settings,
  onChange,
}) => {
  const update = (partial: Partial<GifSettings>) => {
    onChange({ ...settings, ...partial });
  };

  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        Animation Settings
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Fine-tune timing, size, and quality of your GIF.
      </Typography>

      {/* Duration per frame */}
      <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 1 }}>
          <Typography variant="body2" fontWeight={500}>
            Duration per frame
          </Typography>
          <Tooltip title="How long each frame is displayed (in milliseconds). Longer = slower animation.">
            <InfoOutlinedIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
          </Tooltip>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Slider
            value={settings.duration}
            onChange={(_, v) => update({ duration: v as number })}
            min={SETTINGS_LIMITS.duration.min}
            max={SETTINGS_LIMITS.duration.max}
            step={SETTINGS_LIMITS.duration.step}
            sx={{ flexGrow: 1 }}
            valueLabelDisplay="auto"
            valueLabelFormat={(v) => `${(v / 1000).toFixed(1)}s`}
          />
          <TextField
            type="number"
            size="small"
            value={settings.duration}
            onChange={(e) => update({ duration: Number(e.target.value) || 1500 })}
            InputProps={{
              sx: { width: 80 },
              endAdornment: (
                <Typography variant="caption" sx={{ ml: 0.5 }}>
                  ms
                </Typography>
              ),
            }}
            inputProps={{
              min: SETTINGS_LIMITS.duration.min,
              max: SETTINGS_LIMITS.duration.max,
              step: SETTINGS_LIMITS.duration.step,
            }}
          />
        </Box>
      </Paper>

      {/* End frame delay */}
      <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 1 }}>
          <Typography variant="body2" fontWeight={500}>
            End frame freeze
          </Typography>
          <Tooltip title="Extra time added to the last frame so viewers can read the final state before the loop restarts.">
            <InfoOutlinedIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
          </Tooltip>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Slider
            value={settings.endFrameDelay}
            onChange={(_, v) => update({ endFrameDelay: v as number })}
            min={SETTINGS_LIMITS.endFrameDelay.min}
            max={SETTINGS_LIMITS.endFrameDelay.max}
            step={SETTINGS_LIMITS.endFrameDelay.step}
            sx={{ flexGrow: 1 }}
            valueLabelDisplay="auto"
            valueLabelFormat={(v) => `${(v / 1000).toFixed(1)}s`}
          />
          <TextField
            type="number"
            size="small"
            value={settings.endFrameDelay}
            onChange={(e) => update({ endFrameDelay: Number(e.target.value) || 0 })}
            InputProps={{
              sx: { width: 80 },
              endAdornment: (
                <Typography variant="caption" sx={{ ml: 0.5 }}>
                  ms
                </Typography>
              ),
            }}
            inputProps={{
              min: SETTINGS_LIMITS.endFrameDelay.min,
              max: SETTINGS_LIMITS.endFrameDelay.max,
              step: SETTINGS_LIMITS.endFrameDelay.step,
            }}
          />
        </Box>
      </Paper>

      {/* Max width */}
      <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 1 }}>
          <Typography variant="body2" fontWeight={500}>
            Max width
          </Typography>
          <Tooltip title="Images wider than this will be proportionally downscaled. Smaller = smaller file.">
            <InfoOutlinedIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
          </Tooltip>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Slider
            value={settings.maxWidth}
            onChange={(_, v) => update({ maxWidth: v as number })}
            min={SETTINGS_LIMITS.maxWidth.min}
            max={SETTINGS_LIMITS.maxWidth.max}
            step={SETTINGS_LIMITS.maxWidth.step}
            sx={{ flexGrow: 1 }}
            valueLabelDisplay="auto"
            valueLabelFormat={(v) => `${v}px`}
          />
          <TextField
            type="number"
            size="small"
            value={settings.maxWidth}
            onChange={(e) => update({ maxWidth: Number(e.target.value) || 800 })}
            InputProps={{
              sx: { width: 80 },
              endAdornment: (
                <Typography variant="caption" sx={{ ml: 0.5 }}>
                  px
                </Typography>
              ),
            }}
            inputProps={{
              min: SETTINGS_LIMITS.maxWidth.min,
              max: SETTINGS_LIMITS.maxWidth.max,
              step: SETTINGS_LIMITS.maxWidth.step,
            }}
          />
        </Box>
      </Paper>

      {/* Toggle switches */}
      <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
        <FormControlLabel
          control={
            <Switch
              checked={settings.loop}
              onChange={(e) => update({ loop: e.target.checked })}
            />
          }
          label={
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <Typography variant="body2">Infinite loop</Typography>
              <Tooltip title="If on, the GIF repeats forever. If off, it plays once then stops.">
                <InfoOutlinedIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
              </Tooltip>
            </Box>
          }
        />
        <FormControlLabel
          control={
            <Switch
              checked={settings.sharedPalette}
              onChange={(e) => update({ sharedPalette: e.target.checked })}
            />
          }
          label={
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <Typography variant="body2">Shared color palette</Typography>
              <Tooltip title="Uses one palette for all frames. Produces smaller files but may reduce color accuracy for very different-looking frames.">
                <InfoOutlinedIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
              </Tooltip>
            </Box>
          }
        />
      </Paper>

      {/* Optimization level */}
      <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 1 }}>
          <Typography variant="body2" fontWeight={500}>
            Compression
          </Typography>
          <Tooltip title="Higher compression = smaller file size, potentially lower quality. Level 1 is safe for all content (visually lossless).">
            <InfoOutlinedIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
          </Tooltip>
        </Box>
        <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1.5 }}>
          Reduce file size by removing duplicate frames and shrinking the color palette.
        </Typography>
        <FormControl component="fieldset" fullWidth>
          <RadioGroup
            value={settings.optimizeLevel}
            onChange={(e) => update({ optimizeLevel: Number(e.target.value) })}
          >
            {[0, 1, 2, 3].map((level) => (
              <Box
                key={level}
                sx={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 1,
                  py: 0.75,
                  px: 1,
                  borderRadius: 1,
                  bgcolor: settings.optimizeLevel === level ? 'action.selected' : 'transparent',
                }}
              >
                <Radio
                  value={level}
                  size="small"
                  sx={{ py: 0 }}
                />
                <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                  <Typography variant="body2">
                    {OPTIMIZE_LABELS[level]}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {OPTIMIZE_DESCRIPTIONS[level]}
                  </Typography>
                </Box>
              </Box>
            ))}
          </RadioGroup>
        </FormControl>
      </Paper>
    </Box>
  );
};
