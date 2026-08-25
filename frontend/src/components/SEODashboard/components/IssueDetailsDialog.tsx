import React from 'react';
import { 
  Dialog, 
  DialogTitle, 
  DialogContent, 
  DialogActions, 
  Button, 
  Typography, 
  Box, 
  Paper 
} from '@mui/material';
import BuildIcon from '@mui/icons-material/Build';
import { IssueDetailsDialogProps } from '../../shared/types';

const IssueDetailsDialog: React.FC<IssueDetailsDialogProps> = ({
  open,
  issue,
  onClose,
  onAIAction
}) => {
  if (!issue) return null;

  return (
    <Dialog 
      open={open} 
      onClose={onClose}
      maxWidth="md"
      fullWidth
    >
      <DialogTitle sx={{ 
        color: issue.type === 'critical' ? '#D32F2F' : 
                 issue.type === 'warning' ? '#F57C00' : '#388E3C',
        fontWeight: 600
      }}>
        {issue.message}
      </DialogTitle>
      <DialogContent>
        <Box sx={{ mb: 2 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
            Location:
          </Typography>
          <Typography variant="body2" sx={{ color: 'rgba(0, 0, 0, 0.7)' }}>
            {issue.location}
          </Typography>
        </Box>
        
        {issue.current_value && (
          <Box sx={{ mb: 2 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
              Current Value:
            </Typography>
            <Typography variant="body2" sx={{ color: 'rgba(0, 0, 0, 0.7)' }}>
              {issue.current_value}
            </Typography>
          </Box>
        )}
        
        <Box sx={{ mb: 2 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
            Recommended Fix:
          </Typography>
          <Typography variant="body2" sx={{ color: 'rgba(0, 0, 0, 0.7)', mb: 1 }}>
            {issue.fix}
          </Typography>
          {issue.code_example && (
            <Paper sx={{ p: 2, background: '#f5f5f5', fontFamily: 'monospace', fontSize: '0.875rem' }}>
              {issue.code_example}
            </Paper>
          )}
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>
          Close
        </Button>
        <Button 
          variant="contained"
          startIcon={<BuildIcon />}
          onClick={() => {
            onAIAction(issue.action, issue);
            onClose();
          }}
          sx={{
            backgroundColor: issue.type === 'critical' ? '#D32F2F' : 
                         issue.type === 'warning' ? '#F57C00' : '#388E3C',
            '&:hover': {
              backgroundColor: issue.type === 'critical' ? '#B71C1C' : 
                           issue.type === 'warning' ? '#F57C00' : '#388E3C'
            }
          }}
        >
          Fix with AI
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default IssueDetailsDialog; 