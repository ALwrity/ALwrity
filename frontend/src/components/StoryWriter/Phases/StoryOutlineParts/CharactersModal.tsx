import React from 'react';
import { Box, Dialog, DialogActions, DialogContent, DialogTitle, Button, Chip, Typography } from '@mui/material';
import { modalPaperSx } from './modalStyles';

interface CharactersModalProps {
  open: boolean;
  sceneNumber: number;
  characters: string[];
  onClose: () => void;
}

const CharactersModal: React.FC<CharactersModalProps> = ({ open, sceneNumber, characters, onClose }) => {
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
      <DialogTitle>Characters (Scene {sceneNumber})</DialogTitle>
      <DialogContent dividers>
        {characters && characters.length > 0 ? (
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.25 }}>
            {characters.map((c, idx) => (
              <Chip
                key={idx}
                label={c}
                variant="outlined"
              />
            ))}
          </Box>
        ) : (
          <Typography variant="body2">No characters provided for this scene.</Typography>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
};

export default CharactersModal;

