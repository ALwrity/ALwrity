import React, { useEffect } from 'react';
import {
  Box,
  Fade,
  Typography,
  Paper,
  Chip,
} from '@mui/material';
import {
  ArrowForward as ArrowForwardIcon,
  Analytics as AnalyticsIcon,
  Psychology as PsychologyIcon,
  AutoAwesome as AutoAwesomeIcon,
  CheckCircle as CheckCircleIcon,
} from '@mui/icons-material';
import BenefitsSummary from './common/BenefitsSummary';
import ComingSoonSection from './common/ComingSoonSection';

interface IntegrationsStepProps {
  onContinue: () => void;
  updateHeaderContent: (content: { title: string; description: string }) => void;
}

const IntegrationsStep: React.FC<IntegrationsStepProps> = ({ onContinue, updateHeaderContent }) => {
  useEffect(() => {
    updateHeaderContent({
      title: 'How ALwrity Works',
      description: 'Connect your platforms in Step 1, then learn how our SIF agents analyze your data to deliver weekly content recommendations.'
    });
  }, [updateHeaderContent]);

  return (
    <Box sx={{ width: '100%', maxWidth: '100%', p: { xs: 1, sm: 2, md: 3 } }}>

      {/* Benefits Summary */}
      <Fade in timeout={800}>
        <div>
          <BenefitsSummary />
        </div>
      </Fade>

      {/* Coming Soon Section */}
      <ComingSoonSection />

      {/* Recommendation Panel */}
      <Fade in timeout={1200}>
        <div>
          <Paper 
            elevation={2} 
            sx={{ 
              mt: 2.5, 
              p: { xs: 2, md: 2.5 }, 
              borderRadius: 2,
              background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
              border: '1px solid #e2e8f0'
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2, gap: 1 }}>
              <AutoAwesomeIcon sx={{ color: '#7c3aed' }} />
              <Typography variant="h6" sx={{ fontWeight: 700, color: '#111827' }}>
                How ALwrity's SIF Agents Help You Every Week
              </Typography>
            </Box>
            <Typography variant="body2" sx={{ color: '#334155', mb: 1.5 }}>
              Your connected analytics power a helpful weekly routine. Our SIF agent framework reads real search signals and proposes simple, high‑impact actions for your content—no jargon, just clear next steps.
            </Typography>

            <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', mb: 2 }}>
              <Chip icon={<AnalyticsIcon />} label="Low‑CTR pages" sx={{ bgcolor: '#eef2ff', color: '#312e81', fontWeight: 600 }} />
              <Chip icon={<AnalyticsIcon />} label="Striking‑distance wins" sx={{ bgcolor: '#ecfeff', color: '#075985', fontWeight: 600 }} />
              <Chip icon={<AnalyticsIcon />} label="Declining queries" sx={{ bgcolor: '#f0fdf4', color: '#14532d', fontWeight: 600 }} />
              <Chip icon={<AnalyticsIcon />} label="Cannibalization fixes" sx={{ bgcolor: '#fff7ed', color: '#7c2d12', fontWeight: 600 }} />
            </Box>

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap', mb: 2 }}>
              <Paper elevation={0} sx={{ p: 2, borderRadius: 2, border: '1px solid #e5e7eb', minWidth: 210, textAlign: 'center', bgcolor: '#f9fafb' }}>
                <Typography variant="caption" sx={{ color: '#334155', fontWeight: 700, display: 'block', mb: 1 }}>
                  GSC & Bing Metrics
                </Typography>
                <AnalyticsIcon sx={{ color: '#2563eb' }} />
                <Typography variant="body2" sx={{ color: '#334155', mt: 1 }}>
                  Clicks, impressions, CTR, positions
                </Typography>
              </Paper>
              <ArrowForwardIcon sx={{ color: '#64748b' }} />
              <Paper elevation={0} sx={{ p: 2, borderRadius: 2, border: '1px solid #e5e7eb', minWidth: 210, textAlign: 'center', bgcolor: '#f9fafb' }}>
                <Typography variant="caption" sx={{ color: '#334155', fontWeight: 700, display: 'block', mb: 1 }}>
                  SIF Agents
                </Typography>
                <PsychologyIcon sx={{ color: '#7c3aed' }} />
                <Typography variant="body2" sx={{ color: '#334155', mt: 1 }}>
                  Turns signals into clear suggestions
                </Typography>
              </Paper>
              <ArrowForwardIcon sx={{ color: '#64748b' }} />
              <Paper elevation={0} sx={{ p: 2, borderRadius: 2, border: '1px solid #e5e7eb', minWidth: 210, textAlign: 'center', bgcolor: '#f9fafb' }}>
                <Typography variant="caption" sx={{ color: '#334155', fontWeight: 700, display: 'block', mb: 1 }}>
                  Suggested Actions
                </Typography>
                <AutoAwesomeIcon sx={{ color: '#059669' }} />
                <Typography variant="body2" sx={{ color: '#334155', mt: 1 }}>
                  Better titles/meta, refreshes, consolidations
                </Typography>
              </Paper>
            </Box>

            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
              <Paper elevation={0} sx={{ p: 2, borderRadius: 2, border: '1px solid #e5e7eb', bgcolor: '#f9fafb' }}>
                <Typography variant="subtitle2" sx={{ color: '#111827', fontWeight: 700, mb: 1 }}>
                  Who does what
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.75 }}>
                  <Chip size="small" label="SEO Agent" sx={{ bgcolor: '#eef2ff', color: '#312e81', fontWeight: 700 }} />
                  <Typography variant="body2" sx={{ color: '#334155' }}>
                    Finds low‑CTR pages and striking‑distance queries; suggests title/meta fixes and refreshes.
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Chip size="small" label="Content Agent" sx={{ bgcolor: '#ecfeff', color: '#075985', fontWeight: 700 }} />
                  <Typography variant="body2" sx={{ color: '#334155' }}>
                    Recommends consolidation and internal links from cannibalization; queues refresh topics.
                  </Typography>
                </Box>
              </Paper>
              <Paper elevation={0} sx={{ p: 2, borderRadius: 2, border: '1px solid #e5e7eb', bgcolor: '#f9fafb' }}>
                <Typography variant="subtitle2" sx={{ color: '#111827', fontWeight: 700, mb: 1 }}>
                  What you get
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.75 }}>
                  <CheckCircleIcon sx={{ color: '#16a34a' }} />
                  <Typography variant="body2" sx={{ color: '#334155' }}>
                    Clear, bite‑size fixes that improve visibility and clicks.
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.75 }}>
                  <CheckCircleIcon sx={{ color: '#16a34a' }} />
                  <Typography variant="body2" sx={{ color: '#334155' }}>
                    A weekly rhythm that keeps content fresh and organized.
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <CheckCircleIcon sx={{ color: '#16a34a' }} />
                  <Typography variant="body2" sx={{ color: '#334155' }}>
                    Caching protects your quota; agents use cached insights, not direct API calls.
                  </Typography>
                </Box>
              </Paper>
            </Box>

            <Box sx={{ mt: 2 }}>
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2 }}>
                <Paper elevation={0} sx={{ p: 1.75, borderRadius: 2, border: '1px solid #e5e7eb', bgcolor: '#f9fafb' }}>
                  <Typography variant="subtitle2" sx={{ color: '#111827', fontWeight: 700, mb: 1 }}>
                    Full Flow at a Glance
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, flexWrap: 'wrap' }}>
                    <Paper elevation={0} sx={{ p: 1.25, borderRadius: 2, border: '1px solid #e5e7eb', minWidth: 150, textAlign: 'center', bgcolor: '#ffffff' }}>
                      <Typography variant="caption" sx={{ color: '#334155', fontWeight: 700, display: 'block', mb: 0.5 }}>
                        1. Connect
                      </Typography>
                      <AnalyticsIcon sx={{ color: '#2563eb' }} />
                      <Typography variant="body2" sx={{ color: '#334155', mt: 0.5 }}>
                        GSC & Bing
                      </Typography>
                    </Paper>
                    <ArrowForwardIcon sx={{ color: '#64748b' }} />
                    <Paper elevation={0} sx={{ p: 1.25, borderRadius: 2, border: '1px solid #e5e7eb', minWidth: 150, textAlign: 'center', bgcolor: '#ffffff' }}>
                      <Typography variant="caption" sx={{ color: '#334155', fontWeight: 700, display: 'block', mb: 0.5 }}>
                        2. Cache
                      </Typography>
                      <AutoAwesomeIcon sx={{ color: '#0891b2' }} />
                      <Typography variant="body2" sx={{ color: '#334155', mt: 0.5 }}>
                        Fast, quota‑safe
                      </Typography>
                    </Paper>
                    <ArrowForwardIcon sx={{ color: '#64748b' }} />
                    <Paper elevation={0} sx={{ p: 1.25, borderRadius: 2, border: '1px solid #e5e7eb', minWidth: 150, textAlign: 'center', bgcolor: '#ffffff' }}>
                      <Typography variant="caption" sx={{ color: '#334155', fontWeight: 700, display: 'block', mb: 0.5 }}>
                        3. Analyze
                      </Typography>
                      <PsychologyIcon sx={{ color: '#7c3aed' }} />
                      <Typography variant="body2" sx={{ color: '#334155', mt: 0.5 }}>
                        SIF agents
                      </Typography>
                    </Paper>
                    <ArrowForwardIcon sx={{ color: '#64748b' }} />
                    <Paper elevation={0} sx={{ p: 1.25, borderRadius: 2, border: '1px solid #e5e7eb', minWidth: 150, textAlign: 'center', bgcolor: '#ffffff' }}>
                      <Typography variant="caption" sx={{ color: '#334155', fontWeight: 700, display: 'block', mb: 0.5 }}>
                        4. Suggest
                      </Typography>
                      <AutoAwesomeIcon sx={{ color: '#059669' }} />
                      <Typography variant="body2" sx={{ color: '#334155', mt: 0.5 }}>
                        Clear fixes
                      </Typography>
                    </Paper>
                  </Box>
                </Paper>
              </Box>
            </Box>
          </Paper>
        </div>
      </Fade>
    </Box>
  );
};

export default IntegrationsStep;
