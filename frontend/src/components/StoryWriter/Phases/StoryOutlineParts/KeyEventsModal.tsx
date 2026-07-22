import React from 'react';
import { Box, Dialog, DialogActions, DialogContent, DialogTitle, Button, Typography } from '@mui/material';
import { renderMarkdown } from '../../../../utils/markdown';
import { modalPaperSx } from './modalStyles';

interface KeyEventsModalProps {
  open: boolean;
  sceneNumber: number;
  events: string[];
  onClose: () => void;
}

const KeyEventsModal: React.FC<KeyEventsModalProps> = ({ open, sceneNumber, events, onClose }) => {
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
      <DialogTitle>Key Events (Scene {sceneNumber})</DialogTitle>
      <DialogContent dividers>
        {events && events.length > 0 ? (
          <Box component="ul" sx={{ pl: 2, mb: 0 }}>
            {events.map((e, idx) => (
              <li key={idx}>
                <Box
                  className="rendered-content"
                  dangerouslySetInnerHTML={{ __html: renderMarkdown(e) }}
                />
              </li>
            ))}
          </Box>
        ) : (
          <Typography variant="body2">No key events provided for this scene.</Typography>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
};

export default KeyEventsModal;

