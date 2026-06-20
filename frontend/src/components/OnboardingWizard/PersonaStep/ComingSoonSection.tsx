import React, { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Grid,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  List,
  ListItem,
  ListItemIcon,
  ListItemText
} from '@mui/material';
import {
  Psychology as PsychologyIcon,
  CheckCircle as CheckIcon
} from '@mui/icons-material';

interface ComingSoonSectionProps {
  contentCalendar?: any[];
  onTestPersona?: () => void;
}

export const ComingSoonSection: React.FC<ComingSoonSectionProps> = ({
  contentCalendar = [],
  onTestPersona
}) => {
  const [openModal, setOpenModal] = useState(false);
  const [selectedFeature, setSelectedFeature] = useState<string | null>(null);

  const features = [
    {
      id: 'test-persona',
      title: 'Test with your data',
      description: 'Try text, voice, image, and video with your brand',
      icon: <PsychologyIcon />,
      status: 'Available',
      color: '#10b981', // Green for available
      details: [
        'Compare text written with and without your brand voice (side-by-side)',
        'Hear your voice clone read a new script in your voice',
        'Generate platform-tuned variations of your brand avatar',
        'Make a talking-head video from your avatar + voice clone',
        'Directly apply your brand voice to any Alwrity tool'
      ]
    }
  ];

  const handleFeatureClick = (featureId: string) => {
    setSelectedFeature(featureId);
    setOpenModal(true);
  };

  const selectedFeatureData = features.find(f => f.id === selectedFeature);

  return (
    <>
      <Box sx={{ mt: 6, mb: 4 }}>
        <Typography 
          variant="h6" 
          sx={{ 
            mb: 3, 
            fontWeight: 700,
            background: 'linear-gradient(45deg, #1e293b 30%, #334155 90%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            display: 'flex',
            alignItems: 'center',
            gap: 1
          }}
        >
          Try it now
        </Typography>
        <Grid container spacing={3}>
          {features.map((feature) => (
            <Grid item xs={12} md={6} key={feature.id}>
              <Card
                sx={{
                  height: '100%',
                  cursor: 'pointer',
                  transition: 'all 0.3s ease',
                  border: '2px solid #e2e8f0',
                  backgroundColor: '#ffffff',
                  '&:hover': {
                    transform: 'translateY(-4px)',
                    boxShadow: '0 12px 30px rgba(0, 0, 0, 0.15)',
                    borderColor: feature.color,
                    '& .feature-icon': {
                      transform: 'scale(1.1)',
                      backgroundColor: `${feature.color}20`
                    }
                  }
                }}
                onClick={() => {
                  if (feature.id === 'test-persona' && onTestPersona) {
                    onTestPersona();
                  } else {
                    handleFeatureClick(feature.id);
                  }
                }}
              >
                <CardContent sx={{ p: 3 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                    <Box
                      className="feature-icon"
                      sx={{
                        p: 2,
                        borderRadius: 3,
                        backgroundColor: `${feature.color}15`,
                        color: feature.color,
                        mr: 2,
                        transition: 'all 0.3s ease',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}
                    >
                      {feature.icon}
                    </Box>
                    <Box sx={{ flex: 1 }}>
                      <Typography variant="h6" sx={{ fontWeight: 700, color: '#1e293b', mb: 1 }}>
                        {feature.title}
                      </Typography>
                      <Chip
                        label={feature.status}
                        size="small"
                        sx={{
                          backgroundColor: `${feature.color}20`,
                          color: feature.color,
                          fontWeight: 600,
                          fontSize: '0.75rem',
                          height: 24,
                          '& .MuiChip-label': {
                            px: 1.5
                          }
                        }}
                      />
                    </Box>
                  </Box>
                  
                  <Typography variant="body1" sx={{ color: '#64748b', mb: 3, lineHeight: 1.6 }}>
                    {feature.description}
                  </Typography>

                  <Button
                    variant={feature.id === 'test-persona' ? 'contained' : 'outlined'}
                    size="medium"
                    sx={{
                      borderColor: feature.color,
                      color: feature.id === 'test-persona' ? '#ffffff' : feature.color,
                      backgroundColor: feature.id === 'test-persona' ? feature.color : 'transparent',
                      fontWeight: 600,
                      px: 3,
                      py: 1,
                      borderRadius: 2,
                      textTransform: 'none',
                      '&:hover': {
                        backgroundColor: feature.id === 'test-persona' ? `${feature.color}cc` : `${feature.color}15`,
                        borderColor: feature.color,
                        transform: 'translateY(-1px)'
                      }
                    }}
                  >
                    {feature.id === 'test-persona' ? 'Test now' : 'Learn More'}
                  </Button>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      </Box>

      {/* Feature Details Modal */}
      <Dialog
        open={openModal}
        onClose={() => setOpenModal(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle sx={{ pb: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 3 }}>
            {selectedFeatureData && (
              <>
                <Box
                  sx={{
                    p: 2,
                    borderRadius: 3,
                    backgroundColor: `${selectedFeatureData.color}20`,
                    color: selectedFeatureData.color,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  {selectedFeatureData.icon}
                </Box>
                <Box>
                  <Typography variant="h5" sx={{ fontWeight: 700, color: '#1e293b', mb: 1 }}>
                    {selectedFeatureData.title}
                  </Typography>
                  <Chip
                    label={selectedFeatureData.status}
                    size="medium"
                    sx={{
                      backgroundColor: `${selectedFeatureData.color}20`,
                      color: selectedFeatureData.color,
                      fontWeight: 600,
                      fontSize: '0.875rem'
                    }}
                  />
                </Box>
              </>
            )}
          </Box>
        </DialogTitle>
        
        <DialogContent>
          {selectedFeatureData && (
            <>
              <Typography variant="body1" sx={{ color: '#64748b', mb: 4, fontSize: '1.1rem', lineHeight: 1.6 }}>
                {selectedFeatureData.description}
              </Typography>

              <Typography variant="h6" sx={{ fontWeight: 700, mb: 3, color: '#1e293b' }}>
                Key Features:
              </Typography>

              <List sx={{ pl: 0 }}>
                {selectedFeatureData.details.map((detail, index) => (
                  <ListItem key={index} sx={{ pl: 0, py: 1 }}>
                    <ListItemIcon sx={{ minWidth: 32 }}>
                      <CheckIcon sx={{ color: selectedFeatureData.color, fontSize: 20 }} />
                    </ListItemIcon>
                    <ListItemText 
                      primary={detail}
                      primaryTypographyProps={{
                        variant: 'body1',
                        color: '#374151',
                        fontWeight: 500
                      }}
                    />
                  </ListItem>
                ))}
              </List>

              {selectedFeatureData.id === 'test-persona' && (
                <Box sx={{ mt: 3, p: 2, backgroundColor: '#f8fafc', borderRadius: 2 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1, color: '#1e293b' }}>
                    How It Works:
                  </Typography>
                  <Typography variant="body2" sx={{ color: '#64748b' }}>
                    Select a topic from your content calendar, then generate content using different personas 
                    to see how your AI adapts its writing style. Compare the results and provide feedback 
                    to continuously improve your persona.
                  </Typography>
                </Box>
              )}
            </>
          )}
        </DialogContent>
        
        <DialogActions sx={{ p: 3, pt: 1 }}>
          <Button 
            onClick={() => setOpenModal(false)}
            variant="outlined"
          >
            Close
          </Button>
          <Button 
            onClick={() => {
              if (selectedFeatureData?.id === 'test-persona' && onTestPersona) {
                onTestPersona();
                setOpenModal(false);
              } else {
                setOpenModal(false);
              }
            }}
            variant="contained"
            sx={{
              backgroundColor: selectedFeatureData?.color || '#3b82f6',
              '&:hover': {
                backgroundColor: selectedFeatureData?.color || '#3b82f6',
                opacity: 0.9
              }
            }}
          >
            {selectedFeatureData?.id === 'test-persona' ? 'Test now' : 'Notify Me When Ready'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default ComingSoonSection;
