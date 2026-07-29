/** CapturePanel — Screen capture + manual upload tabs.
 *
 * Pure React. Zero ALwrity imports. Uses the MUI pattern found throughout
 * the ALwrity codebase but without importing any internal modules.
 */

import React, { useRef, useCallback } from 'react';
import {
  Box,
  Button,
  Typography,
  Alert,
  Tabs,
  Tab,
  Paper,
} from '@mui/material';
import {
  CameraAlt as CameraIcon,
  CloudUpload as UploadIcon,
} from '@mui/icons-material';
import { useScreenCapture } from './hooks/useScreenCapture';
import type { Frame } from './types';
import { captureFrameMetadata } from './utils';

interface CapturePanelProps {
  frames: Frame[];
  addFrame: (frame: Frame) => void;
  maxFrames: number;
}

export const CapturePanel: React.FC<CapturePanelProps> = ({
  frames,
  addFrame,
  maxFrames,
}) => {
  const [activeTab, setActiveTab] = React.useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { captureFrame, isCapturing, isSupported, supportMessage } =
    useScreenCapture({ frames, addFrame, maxFrames });

  const atMaxFrames = frames.length >= maxFrames;

  // ── Manual upload handler ──────────────────────────────────────────────
  const handleFilesSelected = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const fileList = e.target.files;
      if (!fileList) return;

      const remaining = maxFrames - frames.length;
      const toAdd = Array.from(fileList).slice(0, remaining);

      toAdd.forEach((file) => {
        const img = new Image();
        img.onload = () => {
          addFrame({
            id: crypto.randomUUID(),
            file,
            thumbnail: URL.createObjectURL(file),
            width: img.naturalWidth,
            height: img.naturalHeight,
            metadata: captureFrameMetadata(frames.length + 1),
          });
          URL.revokeObjectURL(img.src);
        };
        img.src = URL.createObjectURL(file);
      });

      // Reset so the same file can be re-selected
      e.target.value = '';
    },
    [addFrame, frames.length, maxFrames],
  );

  // ── Tabs ───────────────────────────────────────────────────────────────
  const tabLabels = isSupported
    ? ['Screen Capture', 'Upload Images']
    : ['Upload Images'];

  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        Add Frames
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Capture screenshots of your UI flow or upload existing images.
        {atMaxFrames && (
          <Alert severity="info" sx={{ mt: 1 }}>
            Maximum {maxFrames} frames reached. Remove some to add more.
          </Alert>
        )}
      </Typography>

      <Tabs
        value={isSupported ? activeTab : 1}
        onChange={(_, v) => setActiveTab(v)}
        sx={{ mb: 2 }}
      >
        {tabLabels.map((label) => (
          <Tab key={label} label={label} />
        ))}
      </Tabs>

      {/* ── Tab 0: Screen Capture ─────────────────────────────────── */}
      {isSupported && activeTab === 0 && (
        <Paper variant="outlined" sx={{ p: 4, textAlign: 'center' }}>
          <CameraIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
          <Typography variant="body1" gutterBottom>
            Click below to capture your current screen or a specific window.
          </Typography>
          <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 2 }}>
            You'll be asked to choose which tab or window to capture.
          </Typography>
          <Button
            variant="contained"
            startIcon={<CameraIcon />}
            onClick={captureFrame}
            disabled={isCapturing || atMaxFrames}
          >
            {isCapturing ? 'Capturing...' : 'Capture Screen'}
          </Button>
          {frames.length > 0 && (
            <Typography variant="caption" display="block" sx={{ mt: 1 }}>
              {frames.length} / {maxFrames} frames captured
            </Typography>
          )}
        </Paper>
      )}

      {/* ── Tab 1 (or only tab): Upload Images ─────────────────────── */}
      {(!isSupported || activeTab === (isSupported ? 1 : 0)) && (
        <Paper variant="outlined" sx={{ p: 4, textAlign: 'center' }}>
          <UploadIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
          <Typography variant="body1" gutterBottom>
            Upload PNG, JPEG, or WebP images
          </Typography>
          <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 2 }}>
            Images wider than 800px will be auto-downscaled during generation.
          </Typography>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            multiple
            onChange={handleFilesSelected}
            style={{ display: 'none' }}
          />
          <Button
            variant="contained"
            startIcon={<UploadIcon />}
            onClick={() => fileInputRef.current?.click()}
            disabled={atMaxFrames}
          >
            Select Images
          </Button>
          {frames.length > 0 && (
            <Typography variant="caption" display="block" sx={{ mt: 1 }}>
              {frames.length} / {maxFrames} frames added
            </Typography>
          )}
        </Paper>
      )}

      {/* ── Unsupported message ────────────────────────────────────── */}
      {!isSupported && (
        <Alert severity="info" sx={{ mt: 2 }}>
          {supportMessage}
        </Alert>
      )}
    </Box>
  );
};
