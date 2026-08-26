import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  Grid,
  Card,
  CardContent,
  Chip,
  Avatar,
  Divider,
  Alert,
  CircularProgress
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import BusinessIcon from '@mui/icons-material/Business';
import AssessmentIcon from '@mui/icons-material/Assessment';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import LinkIcon from '@mui/icons-material/Link';
import RefreshIcon from '@mui/icons-material/Refresh';
import { CompetitorAnalysisResponse, refreshCompetitorAnalysis } from '../../api/researchConfig';

interface OnboardingCompetitorModalProps {
  open: boolean;
  onClose: () => void;
  data: CompetitorAnalysisResponse | null;
  loading?: boolean;
  error?: string | null;
  onRefresh?: (newData: CompetitorAnalysisResponse) => void;
}

export const OnboardingCompetitorModal: React.FC<OnboardingCompetitorModalProps> = ({
  open,
  onClose,
  data,
  loading = false,
  error = null,
  onRefresh
}) => {
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);

  if (!data && !loading && !error) {
    return null;
  }

  const competitors = data?.competitors || [];
  const socialMediaAccounts = data?.social_media_accounts || {};
  const researchSummary = data?.research_summary || {};

  const handleRefresh = async () => {
    setRefreshing(true);
    setRefreshError(null);
    
    try {
      const newData = await refreshCompetitorAnalysis();
      if (newData.success && onRefresh) {
        onRefresh(newData);
      } else {
        setRefreshError(newData.error || 'Failed to refresh competitor analysis');
      }
    } catch (err: any) {
      setRefreshError(err.message || 'Failed to refresh competitor analysis');
    } finally {
      setRefreshing(false);
    }
  };

  const avgScore = competitors.length > 0
    ? competitors.reduce((sum, c) => sum + (c.similarity_score || 0), 0) / competitors.length
    : 0;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="lg"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 3,
          background: 'linear-gradient(135deg, #fff 0%, #f8fafc 100%)',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          maxHeight: '90vh'
        }
      }}
    >
      <DialogTitle sx={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between',
        pb: 2,
        borderBottom: '2px solid #e5e7eb'
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <BusinessIcon sx={{ fontSize: 32, color: '#0ea5e9' }} />
          <Box>
            <Typography variant="h5" sx={{ fontWeight: 600, color: '#0f172a' }}>
              Competitive Analysis from Onboarding
            </Typography>
            <Typography variant="body2" sx={{ color: '#64748b', mt: 0.5 }}>
              {loading ? 'Loading...' : `${competitors.length} competitors analyzed`}
            </Typography>
          </Box>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            onClick={handleRefresh}
            disabled={refreshing}
            startIcon={refreshing ? <CircularProgress size={16} /> : <RefreshIcon />}
            variant="outlined"
            size="small"
            sx={{
              minWidth: 'auto',
              borderColor: '#0ea5e9',
              color: '#0ea5e9',
              '&:hover': {
                borderColor: '#0284c7',
                backgroundColor: 'rgba(14, 165, 233, 0.08)'
              },
              '&:disabled': {
                borderColor: '#cbd5e1',
                color: '#94a3b8'
              }
            }}
          >
            {refreshing ? 'Refreshing...' : 'Refresh'}
          </Button>
          <Button onClick={onClose} size="small" sx={{ minWidth: 'auto', p: 1 }}>
            <CloseIcon />
          </Button>
        </Box>
      </DialogTitle>

      <DialogContent sx={{ py: 3, overflowY: 'auto' }}>
        {loading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', py: 8 }}>
            <CircularProgress />
            <Typography variant="body2" sx={{ ml: 2, color: '#64748b' }}>
              Loading competitor data...
            </Typography>
          </Box>
        )}

        {(error || refreshError) && (
          <Alert severity="error" sx={{ mb: 3 }}>
            <Typography variant="body2">{error || refreshError}</Typography>
          </Alert>
        )}

        {!loading && !error && data && (
          <>
            {researchSummary.industry_insights && (
              <Alert 
                severity="info" 
                icon={<AssessmentIcon />}
                sx={{ mb: 3, bgcolor: '#e0f2fe', borderLeft: '4px solid #0ea5e9' }}
              >
                <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
                  Market Insights
                </Typography>
                <Typography variant="body2" sx={{ color: '#1e293b' }}>
                  {researchSummary.industry_insights}
                </Typography>
              </Alert>
            )}

            <Grid container spacing={2} sx={{ mb: 3 }}>
              <Grid item xs={12} sm={4}>
                <Card sx={{ 
                  background: 'linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)',
                  borderLeft: '4px solid #0ea5e9'
                }}>
                  <CardContent>
                    <Typography variant="caption" sx={{ color: '#0369a1', fontWeight: 600 }}>
                      Total Competitors
                    </Typography>
                    <Typography variant="h4" sx={{ color: '#0c4a6e', fontWeight: 700 }}>
                      {competitors.length}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} sm={4}>
                <Card sx={{ 
                  background: 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)',
                  borderLeft: '4px solid #22c55e'
                }}>
                  <CardContent>
                    <Typography variant="caption" sx={{ color: '#15803d', fontWeight: 600 }}>
                      Avg Similarity
                    </Typography>
                    <Typography variant="h4" sx={{ color: '#166534', fontWeight: 700 }}>
                      {Math.round(avgScore * 100)}%
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} sm={4}>
                <Card sx={{ 
                  background: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)',
                  borderLeft: '4px solid #f59e0b'
                }}>
                  <CardContent>
                    <Typography variant="caption" sx={{ color: '#d97706', fontWeight: 600 }}>
                      Social Accounts Found
                    </Typography>
                    <Typography variant="h4" sx={{ color: '#92400e', fontWeight: 700 }}>
                      {Object.keys(socialMediaAccounts).length}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>

            {Object.keys(socialMediaAccounts).length > 0 && (
              <>
                <Typography variant="h6" sx={{ mb: 2, fontWeight: 600, color: '#0f172a' }}>
                  Social Media Accounts
                </Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 3 }}>
                  {Object.entries(socialMediaAccounts).map(([platform, url]) => (
                    <Chip
                      key={platform}
                      icon={<LinkIcon />}
                      label={`${platform}: ${url}`}
                      clickable
                      onClick={() => window.open(url, '_blank')}
                      sx={{
                        bgcolor: '#f8fafc',
                        border: '1px solid #e2e8f0',
                        '&:hover': {
                          bgcolor: '#f1f5f9',
                          borderColor: '#cbd5e1'
                        }
                      }}
                    />
                  ))}
                </Box>
                <Divider sx={{ my: 3 }} />
              </>
            )}

            {competitors.length > 0 ? (
              <>
                <Typography variant="h6" sx={{ mb: 2, fontWeight: 600, color: '#0f172a' }}>
                  Competitors ({competitors.length})
                </Typography>

                <Grid container spacing={3}>
                  {competitors.map((competitor, index) => (
                    <Grid item xs={12} md={6} key={index}>
                      <Card sx={{ 
                        height: '100%',
                        '&:hover': { boxShadow: 4 },
                        transition: 'box-shadow 0.3s'
                      }}>
                        <CardContent>
                          <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2, mb: 2 }}>
                            <Avatar sx={{ width: 40, height: 40, bgcolor: '#0ea5e9' }}>
                              <BusinessIcon />
                            </Avatar>
                            <Box sx={{ flex: 1, minWidth: 0 }}>
                              <Typography 
                                variant="h6" 
                                sx={{ 
                                  fontWeight: 600, 
                                  color: '#0f172a',
                                  mb: 0.5,
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap'
                                }}
                              >
                                {competitor.name || competitor.domain || 'Unknown Competitor'}
                              </Typography>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1, flexWrap: 'wrap' }}>
                                {competitor.similarity_score !== undefined && (
                                  <Chip
                                    label={`Similarity: ${Math.round(competitor.similarity_score * 100)}%`}
                                    size="small"
                                    sx={{ 
                                      bgcolor: competitor.similarity_score > 0.7 
                                        ? '#dcfce7' 
                                        : competitor.similarity_score > 0.5
                                        ? '#fef3c7'
                                        : '#fee2e2',
                                      color: competitor.similarity_score > 0.7 
                                        ? '#166534' 
                                        : competitor.similarity_score > 0.5
                                        ? '#92400e'
                                        : '#991b1b',
                                      fontWeight: 600
                                    }}
                                  />
                                )}
                                {competitor.url && (
                                  <Button
                                    size="small"
                                    endIcon={<OpenInNewIcon />}
                                    href={competitor.url}
                                    target="_blank"
                                    sx={{ textTransform: 'none', fontSize: '0.75rem' }}
                                  >
                                    Visit
                                  </Button>
                                )}
                              </Box>
                            </Box>
                          </Box>

                          {competitor.description && (
                            <Typography 
                              variant="body2" 
                              sx={{ 
                                color: '#64748b', 
                                mb: 2,
                                display: '-webkit-box',
                                WebkitLineClamp: 3,
                                WebkitBoxOrient: 'vertical',
                                overflow: 'hidden'
                              }}
                            >
                              {competitor.description}
                            </Typography>
                          )}

                          {competitor.domain && (
                            <Typography variant="caption" sx={{ color: '#94a3b8', display: 'block' }}>
                              {competitor.domain}
                            </Typography>
                          )}
                        </CardContent>
                      </Card>
                    </Grid>
                  ))}
                </Grid>
              </>
            ) : (
              !loading && (
                <Alert severity="info" sx={{ mt: 2 }}>
                  <Typography variant="body2">
                    No competitor data available. Please complete onboarding step 3 to analyze competitors.
                  </Typography>
                </Alert>
              )
            )}
          </>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 4, py: 2, borderTop: '1px solid #e5e7eb' }}>
        <Button onClick={onClose} variant="contained" sx={{ minWidth: 120 }}>
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
};
