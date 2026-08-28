import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  Card,
  CardContent,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Divider,
  Alert,
  IconButton,
  Grid
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import SpeedIcon from '@mui/icons-material/Speed';
import InsightsIcon from '@mui/icons-material/Insights';
import SecurityIcon from '@mui/icons-material/Security';
import RefreshIcon from '@mui/icons-material/Refresh';

interface AutoPopulationConsentModalProps {
  open: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

const AutoPopulationConsentModal: React.FC<AutoPopulationConsentModalProps> = ({
  open,
  onConfirm,
  onCancel
}) => {
  return (
    <Dialog
      open={open}
      onClose={onCancel}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 3,
          background: 'linear-gradient(135deg, rgba(102, 126, 234, 0.05) 0%, rgba(118, 75, 162, 0.05) 100%)'
        }
      }}
    >
      <DialogTitle
        sx={{
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          color: 'white',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          py: 2.5
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <AutoAwesomeIcon sx={{ fontSize: 32 }} />
          <Typography variant="h5" sx={{ fontWeight: 600 }}>
            Auto-Populate Strategy Fields
          </Typography>
        </Box>
        <IconButton
          onClick={onCancel}
          sx={{ color: 'white', '&:hover': { backgroundColor: 'rgba(255, 255, 255, 0.1)' } }}
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ p: 4 }}>
        <Alert severity="info" sx={{ mb: 3, backgroundColor: 'rgba(102, 126, 234, 0.1)' }}>
          <Typography variant="body2" sx={{ fontWeight: 500 }}>
            <strong>Save Time:</strong> We can automatically fill in 30 strategy fields using your onboarding data and AI insights.
          </Typography>
        </Alert>

        <Typography variant="h6" gutterBottom sx={{ fontWeight: 600, color: '#2c3e50', mb: 2 }}>
          What is Auto-Population?
        </Typography>
        <Typography variant="body1" paragraph sx={{ color: '#555', mb: 3 }}>
          Auto-population uses your existing onboarding information (website analysis, research preferences, and business details) 
          combined with AI to intelligently pre-fill all 30 strategy input fields. This saves you time while ensuring your strategy 
          is tailored to your business.
        </Typography>

        <Box sx={{ mb: 3 }}>
          <Typography variant="h6" gutterBottom sx={{ fontWeight: 600, color: '#2c3e50', mb: 2 }}>
            What You Get
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={12} md={6}>
              <Card sx={{ height: '100%', border: '1px solid rgba(102, 126, 234, 0.2)' }}>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                    <SpeedIcon sx={{ color: '#667eea', mr: 1 }} />
                    <Typography variant="h6" sx={{ fontWeight: 600 }}>
                      Instant Setup
                    </Typography>
                  </Box>
                  <Typography variant="body2" color="text.secondary">
                    All 30 fields pre-filled in seconds, ready for your review
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} md={6}>
              <Card sx={{ height: '100%', border: '1px solid rgba(102, 126, 234, 0.2)' }}>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                    <InsightsIcon sx={{ color: '#667eea', mr: 1 }} />
                    <Typography variant="h6" sx={{ fontWeight: 600 }}>
                      AI-Powered Insights
                    </Typography>
                  </Box>
                  <Typography variant="body2" color="text.secondary">
                    Smart recommendations based on your business profile and industry
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} md={6}>
              <Card sx={{ height: '100%', border: '1px solid rgba(102, 126, 234, 0.2)' }}>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                    <SecurityIcon sx={{ color: '#667eea', mr: 1 }} />
                    <Typography variant="h6" sx={{ fontWeight: 600 }}>
                      Your Data, Your Control
                    </Typography>
                  </Box>
                  <Typography variant="body2" color="text.secondary">
                    You can review and edit every field before creating your strategy
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} md={6}>
              <Card sx={{ height: '100%', border: '1px solid rgba(102, 126, 234, 0.2)' }}>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                    <RefreshIcon sx={{ color: '#667eea', mr: 1 }} />
                    <Typography variant="h6" sx={{ fontWeight: 600 }}>
                      Always Editable
                    </Typography>
                  </Box>
                  <Typography variant="body2" color="text.secondary">
                    Change any field at any time or fill them manually if you prefer
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </Box>

        <Divider sx={{ my: 3 }} />

        <Typography variant="h6" gutterBottom sx={{ fontWeight: 600, color: '#2c3e50', mb: 2 }}>
          What Data We Use
        </Typography>
        <List dense>
          <ListItem>
            <ListItemIcon>
              <CheckCircleIcon color="success" />
            </ListItemIcon>
            <ListItemText 
              primary="Website Analysis" 
              secondary="Your website URL, content style, and performance metrics"
            />
          </ListItem>
          <ListItem>
            <ListItemIcon>
              <CheckCircleIcon color="success" />
            </ListItemIcon>
            <ListItemText 
              primary="Research Preferences" 
              secondary="Your content types, target audience, and research depth"
            />
          </ListItem>
          <ListItem>
            <ListItemIcon>
              <CheckCircleIcon color="success" />
            </ListItemIcon>
            <ListItemText 
              primary="Business Details" 
              secondary="Your business size, budget, team size, and timeline"
            />
          </ListItem>
          <ListItem>
            <ListItemIcon>
              <CheckCircleIcon color="success" />
            </ListItemIcon>
            <ListItemText 
              primary="AI Analysis" 
              secondary="Smart insights generated from your data using AI"
            />
          </ListItem>
        </List>

        <Alert severity="warning" sx={{ mt: 3, backgroundColor: 'rgba(255, 152, 0, 0.1)' }}>
          <Typography variant="body2">
            <strong>Note:</strong> Auto-population makes API calls to generate AI-powered field values. 
            You can skip this step and fill the fields manually if you prefer.
          </Typography>
        </Alert>
      </DialogContent>

      <DialogActions sx={{ p: 3, gap: 2, backgroundColor: 'rgba(255, 255, 255, 0.9)' }}>
        <Button
          onClick={onCancel}
          variant="outlined"
          size="large"
          sx={{
            borderColor: '#667eea',
            color: '#667eea',
            '&:hover': {
              borderColor: '#764ba2',
              backgroundColor: 'rgba(102, 126, 234, 0.05)'
            }
          }}
        >
          Skip Auto-Population
        </Button>
        <Button
          onClick={onConfirm}
          variant="contained"
          size="large"
          startIcon={<AutoAwesomeIcon />}
          sx={{
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            '&:hover': {
              background: 'linear-gradient(135deg, #764ba2 0%, #667eea 100%)',
              transform: 'translateY(-2px)',
              boxShadow: '0 4px 12px rgba(102, 126, 234, 0.4)'
            },
            transition: 'all 0.3s ease'
          }}
        >
          Auto-Populate Fields
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default AutoPopulationConsentModal;
