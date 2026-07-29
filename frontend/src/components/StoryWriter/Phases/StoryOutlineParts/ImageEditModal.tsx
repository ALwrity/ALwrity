import React from 'react';
import { Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, TextField, Divider, CircularProgress } from '@mui/material';
import { OperationButton } from '../../../shared/OperationButton';
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';
import RefreshIcon from '@mui/icons-material/Refresh';
import { storyWriterApi } from '../../../../services/storyWriterApi';
import { modalPaperSx } from './modalStyles';

interface ImageEditModalProps {
  open: boolean;
  sceneNumber: number;
  value: string;
  onChange: (v: string) => void;
  onClose: () => void;
  onSave: () => void;
  onRegenerate?: (prompt: string) => Promise<void>;
  imageProvider?: string | null;
  imageWidth?: number;
  imageHeight?: number;
  imageModel?: string | null;
  onOpenAdvancedSettings?: (prompt: string) => void;
}

const ImageEditModal: React.FC<ImageEditModalProps> = ({ 
  open, 
  sceneNumber, 
  value, 
  onChange, 
  onClose, 
  onSave,
  onRegenerate,
  imageProvider,
  imageWidth = 1024,
  imageHeight = 1024,
  imageModel,
  onOpenAdvancedSettings,
}) => {
  const [isRegenerating, setIsRegenerating] = React.useState(false);
  const [regenerateError, setRegenerateError] = React.useState<string | null>(null);
  const [isOptimizing, setIsOptimizing] = React.useState(false);
  const [optimizeError, setOptimizeError] = React.useState<string | null>(null);

  const handleRegenerate = async () => {
    if (!onRegenerate || !value.trim()) {
      return;
    }
    
    setIsRegenerating(true);
    setRegenerateError(null);
    try {
      await onRegenerate(value.trim());
      // Optionally close modal after successful regeneration
      // onClose();
    } catch (err: any) {
      setRegenerateError(err?.response?.data?.detail || err?.message || 'Failed to regenerate image');
    } finally {
      setIsRegenerating(false);
    }
  };

  const handleOptimize = async () => {
    if (!value.trim()) {
      return;
    }
    
    setIsOptimizing(true);
    setOptimizeError(null);
    try {
      const response = await storyWriterApi.optimizePrompt({
        text: value.trim(),
        mode: 'image', // Default to image mode for scene image prompts
        style: 'default', // Could be made configurable in the future
      });
      
      if (response.success && response.optimized_prompt) {
        onChange(response.optimized_prompt);
      } else {
        throw new Error('Optimization returned no result');
      }
    } catch (err: any) {
      const errorMessage = err?.response?.data?.detail || err?.message || 'Failed to optimize prompt';
      setOptimizeError(errorMessage);
      console.error('Failed to optimize prompt:', err);
    } finally {
      setIsOptimizing(false);
    }
  };

  // Determine the model for cost estimation
  // Default to FLUX.1-Krea-dev for HuggingFace, or stability model
  const modelForEstimation = imageModel || (imageProvider === 'stability' ? 'stable-diffusion' : 'black-forest-labs/FLUX.1-Krea-dev');
  const providerForEstimation = imageProvider || 'huggingface';

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
      <DialogTitle>Edit Scene Illustration Prompt (Scene {sceneNumber})</DialogTitle>
      <DialogContent dividers>
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
          }}
        >
          <TextField
            label="Image Prompt"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            multiline
            minRows={5}
            fullWidth
            placeholder="Enter a detailed description of the scene image..."
          />
          
          {(regenerateError || optimizeError) && (
            <Box sx={{ color: 'error.main', fontSize: '0.875rem', mt: -1 }}>
              {regenerateError || optimizeError}
            </Box>
          )}

          <Divider sx={{ my: 1 }} />

          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
            <Button
              variant="outlined"
              size="medium"
              startIcon={isOptimizing ? <CircularProgress size={16} /> : <AutoFixHighIcon />}
              onClick={handleOptimize}
              disabled={isOptimizing || !value.trim() || isRegenerating}
              sx={{ flex: 1, minWidth: '200px' }}
            >
              {isOptimizing ? 'Optimizing...' : 'AI Prompt Optimizer'}
            </Button>

            {onRegenerate && (
              <OperationButton
                operation={{
                  provider: 'stability',
                  model: modelForEstimation,
                  tokens_requested: 0,
                  operation_type: 'image_generation',
                  actual_provider_name: providerForEstimation,
                }}
                label="Regenerate Scene"
                variant="contained"
                size="medium"
                startIcon={<RefreshIcon />}
                showCost={true}
                checkOnHover={true}
                checkOnMount={false}
                onClick={handleRegenerate}
                disabled={isRegenerating || !value.trim()}
                loading={isRegenerating}
                sx={{ flex: 1, minWidth: '200px' }}
              />
            )}
            {onOpenAdvancedSettings && (
              <Button
                variant="text"
                size="medium"
                onClick={() => {
                  if (!value.trim() || isOptimizing || isRegenerating) return;
                  onOpenAdvancedSettings(value.trim());
                }}
                disabled={isOptimizing || isRegenerating || !value.trim()}
                sx={{ minWidth: '200px' }}
              >
                Advanced image settings
              </Button>
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

export default ImageEditModal;

