import React from 'react';
import { Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, TextField } from '@mui/material';
import { modalPaperSx } from './modalStyles';

interface TitleEditModalProps {
  open: boolean;
  sceneNumber: number;
  value: string;
  onChange: (v: string) => void;
  onClose: () => void;
  onSave: () => void;
}

const TitleEditModal: React.FC<TitleEditModalProps> = ({ open, sceneNumber, value, onChange, onClose, onSave }) => {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: modalPaperSx,
      }}
    >
      <DialogTitle>Edit Scene Title (Scene {sceneNumber})</DialogTitle>
      <DialogContent dividers>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <TextField
            label="Title"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            fullWidth
          />
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={onSave}>Save</Button>
      </DialogActions>
    </Dialog>
  );
};

export default TitleEditModal;

