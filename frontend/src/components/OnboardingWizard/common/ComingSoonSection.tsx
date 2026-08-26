import React from 'react';
import {
  Box,
  Typography,
  Card,
  Grid,
  Chip,
  Stack,
  Fade
} from '@mui/material';
import ScheduleIcon from '@mui/icons-material/Schedule';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import InstagramIcon from '@mui/icons-material/Instagram';

interface ComingSoonSectionProps {
  title?: string;
  description?: string;
  timeout?: number;
}

const ComingSoonSection: React.FC<ComingSoonSectionProps> = ({ 
  title = "🚀 Coming Soon",
  description = "Advanced integrations and features currently in development",
  timeout = 1400
}) => {
  return (
    <Fade in timeout={timeout}>
      <div>
        <Box sx={{ mb: 4 }}>
        <Typography variant="h6" sx={{ fontWeight: 600, color: '#1e293b', mb: 2 }}>
          {title}
        </Typography>
        <Typography variant="body2" sx={{ color: '#64748b', mb: 3 }}>
          {description}
        </Typography>
        
        <Grid container spacing={2}>
          {/* LinkedIn & Facebook OAuth Approval */}
          <Grid item xs={12} md={6}>
            <Card sx={{ 
              border: '1px solid #e2e8f0',
              backgroundColor: '#ffffff',
              borderRadius: 2,
              p: 2
            }}>
              <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 2 }}>
                <Box sx={{ 
                  width: 40, 
                  height: 40, 
                  borderRadius: 2, 
                  backgroundColor: '#fef3c7',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <ScheduleIcon sx={{ color: '#f59e0b' }} />
                </Box>
                <Box>
                  <Typography variant="subtitle1" sx={{ fontWeight: 600, color: '#1e293b' }}>
                    Social Media OAuth
                  </Typography>
                  <Chip 
                    label="Awaiting Approval" 
                    size="small" 
                    sx={{ 
                      backgroundColor: '#fef3c7',
                      color: '#92400e',
                      border: '1px solid #f59e0b',
                      fontSize: '0.75rem'
                    }}
                  />
                </Box>
              </Stack>
              <Typography variant="body2" sx={{ color: '#64748b', mb: 2 }}>
                LinkedIn and Facebook posting capabilities are pending platform approval for OAuth integration.
              </Typography>
              <Stack direction="row" spacing={1} flexWrap="wrap" gap={1}>
                <Chip 
                  label="LinkedIn Posts" 
                  size="small" 
                  variant="outlined"
                  sx={{ 
                    fontSize: '0.75rem',
                    color: '#475569',
                    borderColor: '#e2e8f0',
                    '&:hover': {
                      backgroundColor: '#f8fafc'
                    }
                  }} 
                />
                <Chip 
                  label="Facebook Posts" 
                  size="small" 
                  variant="outlined"
                  sx={{ 
                    fontSize: '0.75rem',
                    color: '#475569',
                    borderColor: '#e2e8f0',
                    '&:hover': {
                      backgroundColor: '#f8fafc'
                    }
                  }} 
                />
                <Chip 
                  label="Auto-scheduling" 
                  size="small" 
                  variant="outlined"
                  sx={{ 
                    fontSize: '0.75rem',
                    color: '#475569',
                    borderColor: '#e2e8f0',
                    '&:hover': {
                      backgroundColor: '#f8fafc'
                    }
                  }} 
                />
              </Stack>
            </Card>
          </Grid>

          {/* WordPress Development */}
          <Grid item xs={12} md={6}>
            <Card sx={{ 
              border: '1px solid #e2e8f0',
              backgroundColor: '#ffffff',
              borderRadius: 2,
              p: 2
            }}>
              <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 2 }}>
                <Box sx={{ 
                  width: 40, 
                  height: 40, 
                  borderRadius: 2, 
                  backgroundColor: '#f0f9ff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <AutoAwesomeIcon sx={{ color: '#3b82f6' }} />
                </Box>
                <Box>
                  <Typography variant="subtitle1" sx={{ fontWeight: 600, color: '#1e293b' }}>
                    WordPress Integration
                  </Typography>
                  <Chip 
                    label="In Development" 
                    size="small" 
                    sx={{ 
                      backgroundColor: '#f0f9ff',
                      color: '#0c4a6e',
                      border: '1px solid #3b82f6',
                      fontSize: '0.75rem'
                    }}
                  />
                </Box>
              </Stack>
              <Typography variant="body2" sx={{ color: '#64748b', mb: 2 }}>
                Advanced WordPress integration with media management and SEO optimization features.
              </Typography>
              <Stack direction="row" spacing={1} flexWrap="wrap" gap={1}>
                <Chip 
                  label="Media Library" 
                  size="small" 
                  variant="outlined"
                  sx={{ 
                    fontSize: '0.75rem',
                    color: '#475569',
                    borderColor: '#e2e8f0',
                    '&:hover': {
                      backgroundColor: '#f8fafc'
                    }
                  }} 
                />
                <Chip 
                  label="SEO Tools" 
                  size="small" 
                  variant="outlined"
                  sx={{ 
                    fontSize: '0.75rem',
                    color: '#475569',
                    borderColor: '#e2e8f0',
                    '&:hover': {
                      backgroundColor: '#f8fafc'
                    }
                  }} 
                />
                <Chip 
                  label="Auto-publish" 
                  size="small" 
                  variant="outlined"
                  sx={{ 
                    fontSize: '0.75rem',
                    color: '#475569',
                    borderColor: '#e2e8f0',
                    '&:hover': {
                      backgroundColor: '#f8fafc'
                    }
                  }} 
                />
              </Stack>
            </Card>
          </Grid>

          {/* Instagram Planned */}
          <Grid item xs={12}>
            <Card sx={{ 
              border: '1px solid #e2e8f0',
              backgroundColor: '#ffffff',
              borderRadius: 2,
              p: 2
            }}>
              <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 2 }}>
                <Box sx={{ 
                  width: 40, 
                  height: 40, 
                  borderRadius: 2, 
                  backgroundColor: '#f3f4f6',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <InstagramIcon sx={{ color: '#6b7280' }} />
                </Box>
                <Box>
                  <Typography variant="subtitle1" sx={{ fontWeight: 600, color: '#1e293b' }}>
                    Instagram Integration
                  </Typography>
                  <Chip 
                    label="Planned" 
                    size="small" 
                    sx={{ 
                      backgroundColor: '#f3f4f6',
                      color: '#374151',
                      border: '1px solid #9ca3af',
                      fontSize: '0.75rem'
                    }}
                  />
                </Box>
              </Stack>
              <Typography variant="body2" sx={{ color: '#64748b', mb: 2 }}>
                Instagram posting and story creation capabilities are planned for future releases.
              </Typography>
              <Stack direction="row" spacing={1} flexWrap="wrap" gap={1}>
                <Chip 
                  label="Post Creation" 
                  size="small" 
                  variant="outlined"
                  sx={{ 
                    fontSize: '0.75rem',
                    color: '#475569',
                    borderColor: '#e2e8f0',
                    '&:hover': {
                      backgroundColor: '#f8fafc'
                    }
                  }} 
                />
                <Chip 
                  label="Story Posts" 
                  size="small" 
                  variant="outlined"
                  sx={{ 
                    fontSize: '0.75rem',
                    color: '#475569',
                    borderColor: '#e2e8f0',
                    '&:hover': {
                      backgroundColor: '#f8fafc'
                    }
                  }} 
                />
                <Chip 
                  label="Hashtag Optimization" 
                  size="small" 
                  variant="outlined"
                  sx={{ 
                    fontSize: '0.75rem',
                    color: '#475569',
                    borderColor: '#e2e8f0',
                    '&:hover': {
                      backgroundColor: '#f8fafc'
                    }
                  }} 
                />
              </Stack>
            </Card>
          </Grid>
        </Grid>
        </Box>
      </div>
    </Fade>
  );
};

export default ComingSoonSection;
