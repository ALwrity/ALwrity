/** PreviewPanel — GIF preview, metadata display, and download button.
 *
 * Shows the generated GIF in a loop, displays file size and frame count,
 * and provides a download action.
 *
 * Zero ALwrity dependencies.
 */

import React from 'react';
import {
  Box,
  Button,
  Typography,
  Paper,
  CircularProgress,
  Alert,
} from '@mui/material';
import {
  Download as DownloadIcon,
  Refresh as ResetIcon,
} from '@mui/icons-material';
import type { GifResult } from './types';

interface PreviewPanelProps {
  /** True while generation is in flight */
  isGenerating: boolean;
  /** The generation result, or null */
  result: GifResult | null;
  /** Error message from the last failed attempt */
  error: string | null;
  /** Called when the user clicks "Generate" */
  onGenerate: () => void;
  /** Called to reset/clear the current result */
  onReset: () => void;
  /** True if at least 2 frames are loaded (required to generate) */
  canGenerate: boolean;
  /** Number of frames loaded */
  frameCount: number;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export const PreviewPanel: React.FC<PreviewPanelProps> = ({
  isGenerating,
  result,
  error,
  onGenerate,
  onReset,
  canGenerate,
  frameCount,
}) => {
  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        Generate & Preview
      </Typography>

      {/* ── Generate button (when no result yet) ──────────────────── */}
      {!result && !isGenerating && (
        <Paper variant="outlined" sx={{ p: 4, textAlign: 'center' }}>
          <Typography variant="body1" gutterBottom>
            Ready to create your GIF
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            {frameCount} frame{frameCount !== 1 ? 's' : ''} loaded.
            {!canGenerate
              ? ' Add at least 2 frames to generate.'
              : ' Click below to stitch them into an animated GIF.'}
          </Typography>
          <Button
            variant="contained"
            size="large"
            onClick={onGenerate}
            disabled={!canGenerate}
          >
            Generate GIF
          </Button>
        </Paper>
      )}

      {/* ── Loading state ─────────────────────────────────────────── */}
      {isGenerating && (
        <Paper variant="outlined" sx={{ p: 4, textAlign: 'center' }}>
          <CircularProgress size={48} sx={{ mb: 2 }} />
          <Typography variant="body1">Generating your GIF...</Typography>
          <Typography variant="body2" color="text.secondary">
            Stitching {frameCount} frames together
          </Typography>
        </Paper>
      )}

      {/* ── Error state ───────────────────────────────────────────── */}
      {error && !isGenerating && (
        <Alert
          severity="error"
          sx={{ mb: 2 }}
          action={
            <Button color="inherit" size="small" onClick={onReset}>
              Dismiss
            </Button>
          }
        >
          {error}
        </Alert>
      )}

      {/* ── Result preview ────────────────────────────────────────── */}
      {result && !isGenerating && (
        <Box>
          <Paper
            variant="outlined"
            sx={{
              p: 1,
              mb: 2,
              display: 'flex',
              justifyContent: 'center',
              bgcolor: 'grey.900',
              borderRadius: 2,
            }}
          >
            <Box
              component="img"
              src={result.url}
              alt="Animated GIF preview"
              sx={{
                maxWidth: '100%',
                maxHeight: 400,
                objectFit: 'contain',
                borderRadius: 1,
              }}
            />
          </Paper>

          {/* Metadata */}
          <Box
            sx={{
              display: 'flex',
              gap: 3,
              mb: 2,
              flexWrap: 'wrap',
            }}
          >
            <Box>
              <Typography variant="caption" color="text.secondary">
                File size
              </Typography>
              <Typography variant="body2" fontWeight={500}>
                {formatBytes(result.sizeBytes)}
              </Typography>
            </Box>
            <Box>
              <Typography variant="caption" color="text.secondary">
                Frames
              </Typography>
              <Typography variant="body2" fontWeight={500}>
                {result.numFrames}
              </Typography>
            </Box>
          </Box>

          {/* Actions */}
          <Box sx={{ display: 'flex', gap: 2 }}>
            <Button
              variant="contained"
              startIcon={<DownloadIcon />}
              href={result.url}
              download="ui-flow.gif"
            >
              Download GIF
            </Button>
            <Button
              variant="outlined"
              startIcon={<ResetIcon />}
              onClick={onReset}
            >
              Start Over
            </Button>
          </Box>
        </Box>
      )}
    </Box>
  );
};
