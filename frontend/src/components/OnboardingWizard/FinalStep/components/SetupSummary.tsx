import React from 'react';
import {
  Box,
  Paper,
  Zoom,
  Grid,
  Typography,
  Card,
  CardContent,
  Chip,
  Divider
} from '@mui/material';
import CheckCircle from '@mui/icons-material/CheckCircle';
import TrendingUp from '@mui/icons-material/TrendingUp';
import Settings from '@mui/icons-material/Settings';
import Web from '@mui/icons-material/Web';
import Psychology from '@mui/icons-material/Psychology';
import LockOpen from '@mui/icons-material/LockOpen';
import Lock from '@mui/icons-material/Lock';
import { OnboardingData, Capability } from '../types';

interface SetupSummaryProps {
  onboardingData: OnboardingData;
  capabilities: Capability[];
  expandedSection: string | null;
  setExpandedSection: (section: string | null) => void;
  onboardingType?: string;
}

export const SetupSummary: React.FC<SetupSummaryProps> = ({
  onboardingData,
  capabilities,
  expandedSection,
  setExpandedSection,
  onboardingType
}) => {
  const isLinkedIn = onboardingType === 'linkedin';
  const unlockedCapabilities = capabilities.filter(cap => cap.unlocked);

  return (
    <Zoom in={true} timeout={800}>
      <Paper elevation={0} sx={{ 
        p: 4, 
        mb: 4,
        background: 'linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%)',
        border: '1px solid rgba(16, 185, 129, 0.2)',
        borderRadius: 3
      }}>
        {/* Header with Stats Chips */}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 4, flexWrap: 'wrap', gap: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <CheckCircle sx={{ color: 'success.main', fontSize: 32 }} />
            <Typography variant="h4" color="success.main" sx={{ fontWeight: 600 }}>
              Setup Summary & Capabilities
            </Typography>
          </Box>
          
          {/* Stats Chips */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
            <Chip 
              label={`${unlockedCapabilities.length}/${capabilities.length} Capabilities`}
              color="success"
              variant="filled"
              size="small"
              icon={<LockOpen />}
            />
            {/* Only show missing chip if there are actually missing items */}
            {(() => {
              const missingCount = capabilities.length - unlockedCapabilities.length;
              return missingCount > 0 ? (
                <Chip
                  label={`${missingCount} Missing`}
                  color="warning"
                  variant="filled"
                  size="small"
                />
              ) : (
                <Chip
                  label="All Complete"
                  color="success"
                  variant="filled"
                  size="small"
                  icon={<CheckCircle sx={{ fontSize: 16 }} />}
                />
              );
            })()}
          </Box>
        </Box>

        {/* Main Content Grid - Compact Single Card */}
        <Grid container spacing={3}>
          {/* Configuration Details Card */}
          <Grid item xs={12}>
            <Card elevation={0} sx={{ background: 'rgba(255, 255, 255, 0.9)', borderRadius: 2 }}>
              <CardContent sx={{ p: 3 }}>
                {/* Configuration Details Header - Updated for readability */}
                <Typography variant="h6" sx={{ 
                  fontWeight: 600, 
                  mb: 3, 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: 1,
                  color: '#000000 !important'
                }}>
                  <Settings sx={{ color: 'primary.main' }} />
                  Configuration & Capabilities
                </Typography>
                
                <Grid container spacing={2}>
                  {/* Website / LinkedIn Profile Analysis */}
                  <Grid item xs={6} sm={3}>
                    <Box 
                      sx={{ 
                        p: 2, 
                        border: '1px solid rgba(0,0,0,0.1)', 
                        borderRadius: 1,
                        background: 'rgba(255,255,255,0.5)',
                        cursor: 'pointer',
                        '&:hover': { background: 'rgba(255,255,255,0.7)' }
                      }}
                      onClick={() => setExpandedSection(expandedSection === 'website' ? null : 'website')}
                    >
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                        <Web sx={{ color: 'primary.main', fontSize: 18 }} />
                         <Typography variant="subtitle2" sx={{ fontWeight: 600, color: '#000000' }}>
                           {isLinkedIn ? 'LinkedIn Profile' : 'Website Analysis'}
                         </Typography>
                       </Box>
                       <Typography variant="body2" sx={{ color: '#000000' }}>
                         {onboardingData.websiteUrl ? 'Configured' : 'Not set'}
                       </Typography>
                    </Box>
                  </Grid>

                  {/* Research Configuration */}
                  <Grid item xs={6} sm={3}>
                    <Box 
                      sx={{ 
                        p: 2, 
                        border: '1px solid rgba(0,0,0,0.1)', 
                        borderRadius: 1,
                        background: 'rgba(255,255,255,0.5)',
                        cursor: 'pointer',
                        '&:hover': { background: 'rgba(255,255,255,0.7)' }
                      }}
                      onClick={() => setExpandedSection(expandedSection === 'research' ? null : 'research')}
                    >
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                        <TrendingUp sx={{ color: 'primary.main', fontSize: 18 }} />
                         <Typography variant="subtitle2" sx={{ fontWeight: 600, color: '#000000' }}>
                           Research Config
                         </Typography>
                       </Box>
                       <Typography variant="body2" sx={{ color: '#000000' }}>
                         {onboardingData.researchPreferences ? 'Configured' : 'Not set'}
                       </Typography>
                    </Box>
                  </Grid>

                  {/* Personalization */}
                  <Grid item xs={6} sm={3}>
                    <Box 
                      sx={{ 
                        p: 2, 
                        border: '1px solid rgba(0,0,0,0.1)', 
                        borderRadius: 1,
                        background: 'rgba(255,255,255,0.5)',
                        cursor: 'pointer',
                        '&:hover': { background: 'rgba(255,255,255,0.7)' }
                      }}
                      onClick={() => setExpandedSection(expandedSection === 'personalization' ? null : 'personalization')}
                    >
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                        <Psychology sx={{ color: 'primary.main', fontSize: 18 }} />
                         <Typography variant="subtitle2" sx={{ fontWeight: 600, color: '#000000' }}>
                           Personalization
                         </Typography>
                       </Box>
                       <Typography variant="body2" sx={{ color: '#000000' }}>
                         {onboardingData.personalizationSettings ? 'Configured' : 'Not set'}
                       </Typography>
                    </Box>
                  </Grid>
                </Grid>

                {/* Expandable Details */}
                {(expandedSection === 'website' || expandedSection === 'research' || expandedSection === 'personalization') && (
                  <Box sx={{ mt: 3 }}>
                    <Paper elevation={0} sx={{ 
                      background: 'rgba(255, 255, 255, 0.9)', 
                      borderRadius: 2,
                      p: 3
                    }}>
                      {/* Website / LinkedIn Profile Analysis Details */}
                      {expandedSection === 'website' && (
                        <Box>
                           <Typography variant="h6" sx={{ fontWeight: 600, mb: 2, display: 'flex', alignItems: 'center', gap: 1, color: '#000000' }}>
                            <Web sx={{ color: 'primary.main' }} />
                            {isLinkedIn ? 'LinkedIn Profile' : 'Website Analysis'}
                          </Typography>
                          {onboardingData.websiteUrl ? (
                            <Box>
                              <Typography variant="body2" sx={{ mb: 2 }}>
                                <strong>{isLinkedIn ? 'Profile URL:' : 'URL:'}</strong> {onboardingData.websiteUrl}
                              </Typography>
                              {onboardingData.styleAnalysis && !isLinkedIn && (
                                <Typography variant="body2" color="success.main">
                                  ✓ Style analysis completed
                                </Typography>
                              )}
                            </Box>
                          ) : (
                            <Typography variant="body2" color="warning.main">
                              ⚠️ {isLinkedIn ? 'No LinkedIn profile URL configured' : 'No website URL configured'}
                            </Typography>
                          )}
                        </Box>
                      )}

                      {/* Research Configuration Details */}
                      {expandedSection === 'research' && (
                        <Box>
                           <Typography variant="h6" sx={{ fontWeight: 600, mb: 2, display: 'flex', alignItems: 'center', gap: 1, color: '#000000' }}>
                            <TrendingUp sx={{ color: 'primary.main' }} />
                            Research Configuration
                          </Typography>
                          {onboardingData.researchPreferences ? (
                            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                              <Typography variant="body2">
                                <strong>Depth:</strong> {onboardingData.researchPreferences.research_depth}
                              </Typography>
                              <Typography variant="body2">
                                <strong>Content Types:</strong> {onboardingData.researchPreferences.content_types?.join(', ')}
                              </Typography>
                              <Typography variant="body2">
                                <strong>Auto Research:</strong> {onboardingData.researchPreferences.auto_research ? 'Enabled' : 'Disabled'}
                              </Typography>
                            </Box>
                          ) : (
                            <Typography variant="body2" color="warning.main">
                              ⚠️ Research preferences not configured
                            </Typography>
                          )}
                        </Box>
                      )}

                      {/* Personalization Details */}
                      {expandedSection === 'personalization' && (
                        <Box>
                           <Typography variant="h6" sx={{ fontWeight: 600, mb: 2, display: 'flex', alignItems: 'center', gap: 1, color: '#000000' }}>
                            <Psychology sx={{ color: 'primary.main' }} />
                            Personalization
                          </Typography>
                          {onboardingData.personalizationSettings ? (
                            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                              <Typography variant="body2">
                                <strong>Style:</strong> {onboardingData.personalizationSettings.writing_style}
                              </Typography>
                              <Typography variant="body2">
                                <strong>Tone:</strong> {onboardingData.personalizationSettings.tone}
                              </Typography>
                              <Typography variant="body2">
                                <strong>Brand Voice:</strong> {onboardingData.personalizationSettings.brand_voice}
                              </Typography>
                            </Box>
                          ) : (
                            <Typography variant="body2" color="warning.main">
                              ⚠️ Personalization not configured
                            </Typography>
                          )}
                        </Box>
                      )}
                    </Paper>
                  </Box>
                )}

                {/* Capabilities */}
                <Divider sx={{ my: 3 }} />
                <Grid container spacing={2}>
                  {capabilities.map((capability) => (
                    <Grid item xs={12} sm={6} md={4} key={capability.id}>
                      <Card elevation={0} sx={{ 
                        background: capability.unlocked ? 'rgba(255, 255, 255, 0.8)' : 'rgba(0, 0, 0, 0.05)',
                        border: `1px solid ${capability.unlocked ? 'rgba(16, 185, 129, 0.3)' : 'rgba(0, 0, 0, 0.1)'}`,
                        borderRadius: 2,
                        opacity: capability.unlocked ? 1 : 0.6,
                        height: '100%'
                      }}>
                        <CardContent>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                            <Box sx={{
                              width: 40,
                              height: 40,
                              borderRadius: '50%',
                              background: capability.unlocked 
                                ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
                                : 'linear-gradient(135deg, #6b7280 0%, #4b5563 100%)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}>
                              {React.cloneElement(capability.icon, { 
                                sx: { color: 'white', fontSize: 20 } 
                              })}
                            </Box>
                            <Typography variant="subtitle1" sx={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 1, color: '#000000 !important' }}>
                              {capability.title}
                              {capability.unlocked ? (
                                <CheckCircle sx={{ color: 'success.main', fontSize: 16 }} />
                              ) : (
                                <Lock sx={{ color: '#666666 !important', fontSize: 16 }} />
                              )}
                            </Typography>
                          </Box>
                          <Typography variant="body2" sx={{ mb: capability.unlocked ? 0 : 2, color: '#000000 !important' }}>
                            {capability.description}
                          </Typography>
                          {!capability.unlocked && capability.required && (
                            <Typography variant="caption" sx={{ color: '#000000 !important' }}>
                              Requires: {capability.required.join(', ')}
                            </Typography>
                          )}
                        </CardContent>
                      </Card>
                    </Grid>
                  ))}
                </Grid>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </Paper>
    </Zoom>
  );
};

export default SetupSummary;