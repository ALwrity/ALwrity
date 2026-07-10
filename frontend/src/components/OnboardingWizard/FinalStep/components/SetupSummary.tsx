import React, { useState } from 'react';
import {
  Box,
  Paper,
  Zoom,
  Grid,
  Typography,
  Card,
  CardContent,
  Chip,
  Tooltip,
  IconButton
} from '@mui/material';
import {
  CheckCircle,
  Security,
  TrendingUp,
  Settings,
  Web,
  Psychology,
  LockOpen,
  Visibility,
  VisibilityOff
} from '@mui/icons-material';
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
  const [showApiKeys, setShowApiKeys] = useState(false);
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
              Setup Summary
            </Typography>
          </Box>
          
          {/* Stats Chips */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
            <Chip 
              label={isLinkedIn ? `${Object.keys(onboardingData.apiKeys).length} AI Providers (optional)` : `${Object.keys(onboardingData.apiKeys).length} AI Providers`}
              color="primary"
              variant="filled"
              size="small"
              icon={<Security />}
            />
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
                  Configuration Details
                </Typography>
                
                <Grid container spacing={2}>
                  {/* API Keys */}
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
                      onClick={() => setExpandedSection(expandedSection === 'api-keys' ? null : 'api-keys')}
                    >
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                        <Security sx={{ color: 'primary.main', fontSize: 18 }} />
                         <Typography variant="subtitle2" sx={{ fontWeight: 600, color: '#000000' }}>
                           API Keys
                         </Typography>
                       </Box>
                       <Typography variant="body2" sx={{ color: '#000000' }}>
                         {Object.keys(onboardingData.apiKeys).length} configured
                       </Typography>
                    </Box>
                  </Grid>

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
                {(expandedSection === 'api-keys' || expandedSection === 'website' || expandedSection === 'research' || expandedSection === 'personalization') && (
                  <Box sx={{ mt: 3 }}>
                    <Paper elevation={0} sx={{ 
                      background: 'rgba(255, 255, 255, 0.9)', 
                      borderRadius: 2,
                      p: 3
                    }}>
                      {/* API Keys Details */}
                      {expandedSection === 'api-keys' && (
                        <Box>
                           <Typography variant="h6" sx={{ fontWeight: 600, mb: 2, display: 'flex', alignItems: 'center', gap: 1, color: '#000000' }}>
                            <Security sx={{ color: 'primary.main' }} />
                            API Keys ({Object.keys(onboardingData.apiKeys).length} configured)
                          </Typography>
                          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                            {Object.entries(onboardingData.apiKeys).map(([provider, key]) => (
                              <Box key={provider} sx={{ 
                                p: 2, 
                                border: '1px solid rgba(0,0,0,0.1)', 
                                borderRadius: 1,
                                background: 'rgba(255,255,255,0.5)'
                              }}>
                                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                                  <Typography variant="subtitle2" sx={{ fontWeight: 600, textTransform: 'capitalize' }}>
                                    {provider}
                                  </Typography>
                                  <Tooltip title={showApiKeys ? 'Hide key' : 'Show key'}>
                                    <IconButton 
                                      size="small" 
                                      onClick={() => setShowApiKeys(!showApiKeys)}
                                    >
                                      {showApiKeys ? <VisibilityOff /> : <Visibility />}
                                    </IconButton>
                                  </Tooltip>
                                </Box>
                                <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                                  {showApiKeys ? key : '••••••••••••••••••••••••••••••••'}
                                </Typography>
                              </Box>
                            ))}
                          </Box>
                        </Box>
                      )}

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
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </Paper>
    </Zoom>
  );
};

export default SetupSummary;