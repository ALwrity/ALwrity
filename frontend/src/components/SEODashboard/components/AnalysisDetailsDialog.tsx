import React from 'react';
import { 
  Dialog, 
  DialogTitle, 
  DialogContent, 
  DialogActions, 
  Button, 
  Typography, 
  Grid, 
  Paper, 
  List, 
  ListItem, 
  ListItemIcon, 
  ListItemText 
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { AnalysisDetailsDialogProps } from '../../shared/types';
import { getAnalysisDetails } from './seoUtils';

const AnalysisDetailsDialog: React.FC<AnalysisDetailsDialogProps> = ({
  open,
  onClose
}) => {
  const analysisDetails = getAnalysisDetails();

  return (
    <Dialog 
      open={open} 
      onClose={onClose}
      maxWidth="md"
      fullWidth
    >
      <DialogTitle sx={{ color: 'white', fontWeight: 600 }}>
        📊 SEO Analysis Details
      </DialogTitle>
      <DialogContent>
        <Typography variant="body2" sx={{ color: 'rgba(0, 0, 0, 0.7)', mb: 3 }}>
          Our comprehensive SEO analyzer performs detailed tests across multiple categories to provide you with actionable insights.
        </Typography>
        
        <Grid container spacing={2}>
          {analysisDetails.map((detail, index) => (
            <Grid item xs={12} md={6} key={index}>
              <Paper sx={{ p: 2, background: '#f8f9fa', height: '100%' }}>
                <Typography variant="h6" sx={{ color: '#1976d2', mb: 1, fontWeight: 600 }}>
                  {detail.title}
                </Typography>
                <Typography variant="body2" sx={{ color: 'rgba(0, 0, 0, 0.7)', mb: 2 }}>
                  {detail.description}
                </Typography>
                <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
                  Tests Performed:
                </Typography>
                <List dense>
                  {detail.tests.map((test, testIndex) => (
                    <ListItem key={testIndex} sx={{ py: 0.5 }}>
                      <ListItemIcon sx={{ minWidth: 24 }}>
                        <CheckCircleIcon sx={{ fontSize: 16, color: '#4CAF50' }} />
                      </ListItemIcon>
                      <ListItemText 
                        primary={test}
                        primaryTypographyProps={{ variant: 'body2', fontSize: '0.875rem' }}
                      />
                    </ListItem>
                  ))}
                </List>
              </Paper>
            </Grid>
          ))}
        </Grid>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default AnalysisDetailsDialog; 