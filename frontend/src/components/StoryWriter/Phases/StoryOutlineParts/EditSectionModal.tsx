import React from 'react';
import { Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, Paper, TextField, Typography } from '@mui/material';
import { renderMarkdown } from '../../../../utils/markdown';
import { modalPaperSx } from './modalStyles';

import UndoIcon from '@mui/icons-material/Undo';
import RedoIcon from '@mui/icons-material/Redo';

interface EditSectionModalProps {
  open: boolean;
  sceneNumber: number;
  editText: string;
  onChangeEditText: (val: string) => void;
  aiFeedback: string;
  onChangeAiFeedback: (val: string) => void;
  aiLoading: boolean;
  onGenerateSuggestions: () => void;
  suggestions: string[];
  onPickSuggestion: (index: number) => void;
  onClose: () => void;
  onSave: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
  onUndo?: () => void;
  onRedo?: () => void;
}

const EditSectionModal: React.FC<EditSectionModalProps> = ({
  open,
  sceneNumber,
  editText,
  onChangeEditText,
  aiFeedback,
  onChangeAiFeedback,
  aiLoading,
  onGenerateSuggestions,
  suggestions,
  onPickSuggestion,
  onClose,
  onSave,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
}) => {
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
      <DialogTitle>Edit Section (Scene {sceneNumber})</DialogTitle>
      <DialogContent dividers>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <TextField
            label="Section Text"
            value={editText}
            onChange={(e) => onChangeEditText(e.target.value)}
            multiline
            minRows={6}
            fullWidth
          />
          <TextField
            label="Tell Alwrity what to improve (optional)"
            value={aiFeedback}
            onChange={(e) => onChangeAiFeedback(e.target.value)}
            multiline
            minRows={3}
            fullWidth
            helperText="Describe desired changes (tone, pacing, details). Generate to get 2 suggestions."
          />
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
            <Button variant="outlined" onClick={onGenerateSuggestions} disabled={aiLoading}>
              {aiLoading ? 'Generating...' : 'Generate AI Suggestions'}
            </Button>
          </Box>
          {suggestions.length > 0 && (
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2 }}>
              {suggestions.map((s, i) => (
                <Paper key={i} sx={{ p: 2, border: '1px solid rgba(120,90,60,0.2)' }}>
                  <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
                    Suggestion {i + 1}
                  </Typography>
                  <Box
                    className="rendered-content"
                    dangerouslySetInnerHTML={{ __html: renderMarkdown(s) }}
                  />
                  <Box sx={{ mt: 1, display: 'flex', justifyContent: 'flex-end' }}>
                    <Button size="small" variant="text" onClick={() => onPickSuggestion(i)}>
                      Use this
                    </Button>
                  </Box>
                </Paper>
              ))}
            </Box>
          )}
        </Box>
      </DialogContent>
      <DialogActions sx={{ justifyContent: 'space-between' }}>
        <Box sx={{ display: 'flex', gap: 0.5 }}>
          {onUndo && (
            <Button size="small" onClick={onUndo} disabled={!canUndo} startIcon={<UndoIcon />} title="Undo (Ctrl+Z)">
              Undo
            </Button>
          )}
          {onRedo && (
            <Button size="small" onClick={onRedo} disabled={!canRedo} startIcon={<RedoIcon />} title="Redo (Ctrl+Shift+Z)">
              Redo
            </Button>
          )}
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="contained" onClick={onSave}>
            Save & Update
          </Button>
        </Box>
      </DialogActions>
    </Dialog>
  );
};

export default EditSectionModal;

