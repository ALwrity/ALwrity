/** GifMaker — Standalone GIF creation orchestrator.
 *
 * Imports zero ALwrity-internal modules. No zustand, no Clerk, no apiClient.
 * Parent provides config via props. Drop into any React app.
 */

import React, { useState, useCallback } from 'react';

import {
  Box,
  Stepper,
  Step,
  StepLabel,
  Button,
  Paper,
  Typography,
} from '@mui/material';
import {
  ArrowBack as BackIcon,
  ArrowForward as NextIcon,
} from '@mui/icons-material';

import { CapturePanel } from './CapturePanel';
import { FrameGallery } from './FrameGallery';
import { SettingsPanel } from './SettingsPanel';
import { PreviewPanel } from './PreviewPanel';
import { GifGenerationProvider, useGifGeneration } from './hooks/useGifGeneration';
import type { Frame, GifSettings } from './types';
import { DEFAULT_SETTINGS } from './types';

// ── Props ────────────────────────────────────────────────────────────────────

export interface GifMakerProps {
  /** Base URL for the GIF maker API (default: same-origin) */
  apiBaseUrl?: string;
  /** Optional auth token for X-Gif-Maker-Key header */
  apiKey?: string;
  /** Called after successful GIF generation */
  onGifGenerated?: (blob: Blob) => void;
  /** Max frames per session (default 30) */
  maxFrames?: number;
}

// ── Steps ────────────────────────────────────────────────────────────────────

const STEPS = ['Capture', 'Arrange', 'Settings', 'Generate'];

// ── Inner component (has access to context) ──────────────────────────────────

interface GifMakerInnerProps {
  maxFrames: number;
}

const GifMakerInner: React.FC<GifMakerInnerProps> = ({ maxFrames }) => {
  const [activeStep, setActiveStep] = useState(0);
  const [frames, setFrames] = useState<Frame[]>([]);
  const [settings, setSettings] = useState<GifSettings>(DEFAULT_SETTINGS);
  const { isGenerating, result, error, generate, reset } = useGifGeneration();

  // ── Frame mutations ──────────────────────────────────────────────────
  const addFrame = useCallback(
    (frame: Frame) => {
      setFrames((prev) => (prev.length < maxFrames ? [...prev, frame] : prev));
    },
    [maxFrames],
  );

  const removeFrame = useCallback((id: string) => {
    setFrames((prev) => {
      const frame = prev.find((f) => f.id === id);
      if (frame) URL.revokeObjectURL(frame.thumbnail);
      return prev.filter((f) => f.id !== id);
    });
  }, []);

  const reorderFrames = useCallback((reordered: Frame[]) => {
    setFrames(reordered);
  }, []);

  // ── Navigation ───────────────────────────────────────────────────────
  const canNext = (() => {
    switch (activeStep) {
      case 0: return frames.length >= 2;
      case 1: return frames.length >= 2;
      case 2: return true;
      case 3: return false; // last step
      default: return false;
    }
  })();

  const handleNext = () => setActiveStep((p) => Math.min(p + 1, STEPS.length - 1));
  const handleBack = () => setActiveStep((p) => Math.max(p - 1, 0));

  const handleGenerate = useCallback(async () => {
    try {
      const gifResult = await generate(frames, settings);
      setActiveStep(3); // stay on Generate tab
      // The result is now available via context
    } catch {
      // Error is set in context; UI shows it in PreviewPanel
    }
  }, [generate, frames, settings]);

  const handleReset = useCallback(() => {
    reset();
    // Don't clear frames or settings — user may want to retry
  }, [reset]);

  // ── Render step content ──────────────────────────────────────────────
  const renderStep = () => {
    switch (activeStep) {
      case 0:
        return (
          <CapturePanel
            frames={frames}
            addFrame={addFrame}
            maxFrames={maxFrames}
          />
        );
      case 1:
        return (
          <FrameGallery
            frames={frames}
            onReorder={reorderFrames}
            onRemove={removeFrame}
          />
        );
      case 2:
        return (
          <SettingsPanel
            settings={settings}
            onChange={setSettings}
          />
        );
      case 3:
        return (
          <PreviewPanel
            isGenerating={isGenerating}
            result={result}
            error={error}
            onGenerate={handleGenerate}
            onReset={handleReset}
            canGenerate={frames.length >= 2}
            frameCount={frames.length}
          />
        );
      default:
        return null;
    }
  };

  return (
    <Box>
      {/* Stepper */}
      <Stepper activeStep={activeStep} alternativeLabel sx={{ mb: 4 }}>
        {STEPS.map((label) => (
          <Step key={label}>
            <StepLabel>{label}</StepLabel>
          </Step>
        ))}
      </Stepper>

      {/* Step content */}
      <Paper variant="outlined" sx={{ p: 3, mb: 3 }}>
        {renderStep()}
      </Paper>

      {/* Navigation buttons */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
        <Button
          variant="outlined"
          startIcon={<BackIcon />}
          onClick={handleBack}
          disabled={activeStep === 0}
        >
          Back
        </Button>

        {activeStep < STEPS.length - 1 && (
          <Button
            variant="contained"
            endIcon={<NextIcon />}
            onClick={handleNext}
            disabled={!canNext}
          >
            {activeStep === STEPS.length - 2 ? 'Review & Generate' : 'Next'}
          </Button>
        )}

        {activeStep === STEPS.length - 1 && !result && !isGenerating && (
          <Button
            variant="contained"
            onClick={handleGenerate}
            disabled={!canNext}
          >
            Generate GIF
          </Button>
        )}
      </Box>

      {/* Frame count indicator */}
      {frames.length > 0 && (
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ mt: 2, display: 'block', textAlign: 'center' }}
        >
          {frames.length} frame{frames.length !== 1 ? 's' : ''} · Max {maxFrames}
        </Typography>
      )}
    </Box>
  );
};

// ── Outer component (provides context) ────────────────────────────────────────

export const GifMaker: React.FC<GifMakerProps> = ({
  apiBaseUrl,
  apiKey,
  onGifGenerated,
  maxFrames = 30,
}) => {
  // Wrap in the generation provider so all children can access context
  return (
    <GifGenerationProvider apiBaseUrl={apiBaseUrl} apiKey={apiKey}>
      <GifMakerInner maxFrames={maxFrames} />
    </GifGenerationProvider>
  );
};

export default GifMaker;
