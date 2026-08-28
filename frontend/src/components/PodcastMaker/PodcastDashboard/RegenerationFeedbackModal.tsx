import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  TextField,
  Box,
  Stack,
  Chip,
  alpha,
  IconButton
} from '@mui/material';
import PsychologyIcon from '@mui/icons-material/Psychology';
import CloseIcon from '@mui/icons-material/Close';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import VoiceIcon from '@mui/icons-material/RecordVoiceOver';
import AudienceIcon from '@mui/icons-material/Groups';
import OutlineIcon from '@mui/icons-material/FormatListBulleted';

interface RegenerationFeedbackModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (feedback: string) => void;
  isSubmitting?: boolean;
}

const feedbackOptions = [
  { label: 'Audience is wrong', icon: <AudienceIcon fontSize="small" />, text: 'The target audience is not quite right. It should be more focused on...' },
  { label: 'Too generic', icon: <AutoAwesomeIcon fontSize="small" />, text: 'The analysis feels a bit generic. Can we make it more specific to...' },
  { label: 'Outline needs work', icon: <OutlineIcon fontSize="small" />, text: 'The suggested episode outlines don\'t capture the depth I want. Let\'s try...' },
  { label: 'Wrong tone', icon: <VoiceIcon fontSize="small" />, text: 'The content type and tone don\'t match my brand. I want it to be more...' },
];

export const RegenerationFeedbackModal: React.FC<RegenerationFeedbackModalProps> = ({
  open,
  onClose,
  onConfirm,
  isSubmitting = false
}) => {
  const [feedback, setFeedback] = useState('');

  const handleOptionClick = (text: string) => {
    setFeedback(prev => prev ? `${prev}\n${text}` : text);
  };

  const handleSubmit = () => {
    onConfirm(feedback.trim());
    setFeedback('');
  };

  return (
    <Dialog 
      open={open} 
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 3,
          bgcolor: '#ffffff',
          backgroundImage: 'none'
        }
      }}
    >
      <DialogTitle sx={{ m: 0, p: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Stack direction="row" alignItems="center" spacing={1}>
          <PsychologyIcon sx={{ color: '#4f46e5' }} />
          <Typography variant="h6" fontWeight={800} sx={{ color: '#1e293b' }}>
            Improve AI Analysis
          </Typography>
        </Stack>
        <IconButton onClick={onClose} size="small" sx={{ color: '#64748b' }}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ p: 3, pt: 1 }}>
        <Typography variant="body2" sx={{ color: '#475569', mb: 3 }}>
          Tell us what you'd like to change or improve about the previous analysis. Your feedback will help the AI generate a more accurate plan for your podcast.
        </Typography>

        <Stack spacing={3}>
          <Box>
            <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 600, display: 'block', mb: 1.5 }}>
              QUICK SUGGESTIONS
            </Typography>
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              {feedbackOptions.map((opt) => (
                <Chip
                  key={opt.label}
                  label={opt.label}
                  icon={opt.icon}
                  onClick={() => handleOptionClick(opt.text)}
                  sx={{
                    bgcolor: alpha('#4f46e5', 0.05),
                    color: '#4f46e5',
                    border: '1px solid',
                    borderColor: alpha('#4f46e5', 0.2),
                    fontWeight: 600,
                    '&:hover': {
                      bgcolor: alpha('#4f46e5', 0.1),
                      borderColor: '#4f46e5',
                    }
                  }}
                />
              ))}
            </Stack>
          </Box>

          <TextField
            fullWidth
            multiline
            rows={4}
            placeholder="e.g. Focus more on technical details for developers, or make the tone more humorous and conversational..."
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            variant="outlined"
            autoFocus
            sx={{
              '& .MuiOutlinedInput-root': {
                bgcolor: '#f8fafc',
                borderRadius: 2,
                '& fieldset': { borderColor: '#e2e8f0' },
                '&:hover fieldset': { borderColor: '#cbd5e1' },
                '&.Mui-focused fieldset': { borderColor: '#4f46e5' },
              },
              '& .MuiInputBase-input': {
                color: '#1e293b',
                fontSize: '0.95rem'
              }
            }}
          />
        </Stack>
      </DialogContent>

      <DialogActions sx={{ p: 3, pt: 0 }}>
        <Button 
          onClick={onClose}
          sx={{ color: '#64748b', textTransform: 'none', fontWeight: 600 }}
        >
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={handleSubmit}
          disabled={!feedback.trim() || isSubmitting}
          sx={{
            bgcolor: '#4f46e5',
            color: 'white',
            px: 4,
            borderRadius: 2,
            textTransform: 'none',
            fontWeight: 700,
            '&:hover': { bgcolor: '#4338ca' },
            '&.Mui-disabled': { bgcolor: '#e2e8f0', color: '#94a3b8' }
          }}
        >
          {isSubmitting ? 'Regenerating...' : 'Regenerate Analysis'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
