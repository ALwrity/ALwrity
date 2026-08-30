import React from 'react';
import { Box, Typography, Paper, Chip, CircularProgress, Collapse, IconButton, Button } from '@mui/material';
import LightbulbIcon from '@mui/icons-material/Lightbulb';
import BusinessIcon from '@mui/icons-material/Business';
import ExpandMore from '@mui/icons-material/ExpandMore';
import ExpandLess from '@mui/icons-material/ExpandLess';
import ErrorIcon from '@mui/icons-material/Error';
import RefreshIcon from '@mui/icons-material/Refresh';

export type ContentPillarsStatus = 'complete' | 'failed' | 'pending';

export interface ContentPillarData {
  status?: ContentPillarsStatus;
  error?: string | null;
  timestamp?: string;
  target_company?: {
    domain: string;
    content_pillars: string[];
  };
  competitors?: Array<{
    website: string;
    company_name: string;
    content_pillars: string[];
  }>;
}

interface ContentPillarsSectionProps {
  data: ContentPillarData | null;
  isLoading: boolean;
  error?: string | null;
  onRefresh?: () => void;
}

const SectionHeader: React.FC<{ onRefresh?: () => void; isLoading?: boolean }> = ({ onRefresh, isLoading }) => (
  <Typography variant="h5" fontWeight={600} sx={{ color: '#1a202c', display: 'flex', alignItems: 'center', mb: 2 }}>
    <LightbulbIcon sx={{ mr: 1, color: '#f59e0b' }} />
    Content Pillars
    {onRefresh && (
      <Button
        size="small"
        variant="outlined"
        startIcon={isLoading ? <CircularProgress size={14} /> : <RefreshIcon />}
        onClick={onRefresh}
        disabled={isLoading}
        sx={{
          ml: 2,
          borderColor: '#667eea',
          color: '#667eea',
          textTransform: 'none',
          whiteSpace: 'nowrap',
          '&:hover': { borderColor: '#5a6fd8', bgcolor: 'rgba(102,126,234,0.04)' }
        }}
      >
        {isLoading ? 'Refreshing...' : 'Refresh'}
      </Button>
    )}
  </Typography>
);

function hasPillars(data: ContentPillarData): boolean {
  return !!(
    data.target_company?.content_pillars?.length ||
    data.competitors?.some((c) => c.content_pillars?.length)
  );
}

function getPillarStatus(
  data: ContentPillarData | null,
  _error?: string | null
): ContentPillarsStatus {
  if (!data) return 'pending';
  if (data.status === 'failed' || data.status === 'complete') return data.status;
  // Back-compat payloads predate the status key.
  if (data.error) return 'failed';
  if (hasPillars(data)) return 'complete';
  return 'pending';
}

export const ContentPillarsSection: React.FC<ContentPillarsSectionProps> = ({ data, isLoading, error, onRefresh }) => {
  const [compExpanded, setCompExpanded] = React.useState(true);

  const pillarStatus = getPillarStatus(data, error);
  const failureMessage = String(data?.error || error || 'Content pillar discovery failed');

  if (isLoading) {
    return (
      <Box mt={3} display="flex" alignItems="center" gap={2} p={2} bgcolor="#f8fafc" borderRadius={2}>
        <CircularProgress size={18} />
        <Typography variant="body2" sx={{ color: '#64748b' }}>Discovering content pillars...</Typography>
      </Box>
    );
  }

  if (pillarStatus === 'failed') {
    const isCreditExhausted = failureMessage.toLowerCase().includes('credit') || failureMessage.toLowerCase().includes('402');
    return (
      <Box mt={4} mb={3}>
        <SectionHeader onRefresh={onRefresh} />
        <Paper sx={{ p: 2.5, borderRadius: 2, bgcolor: '#fef2f2', border: '1px solid #fecaca', display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <ErrorIcon sx={{ color: '#ef4444', fontSize: 20, flexShrink: 0 }} />
          <Box flex={1}>
            <Typography variant="body2" sx={{ color: '#991b1b' }}>
              {isCreditExhausted
                ? 'Exa API credits exhausted — top up at dashboard.exa.ai to enable content pillar discovery.'
                : `Content pillar discovery failed: ${failureMessage}`}
            </Typography>
            {data?.timestamp && (
              <Typography variant="caption" sx={{ color: '#b91c1c', display: 'block', mt: 0.5 }}>
                Last attempted {new Date(data.timestamp).toLocaleString()}
              </Typography>
            )}
          </Box>
        </Paper>
        {onRefresh && (
          <Box mt={1}>
            <Button
              size="small"
              variant="text"
              startIcon={<RefreshIcon />}
              onClick={onRefresh}
              disabled={isLoading}
              sx={{ color: '#667eea', textTransform: 'none' }}
            >
              Retry content pillar detection
            </Button>
          </Box>
        )}
      </Box>
    );
  }

  if (pillarStatus === 'pending' || !data) {
    return (
      <Box mt={4} mb={3}>
        <SectionHeader onRefresh={onRefresh} />
        <Paper sx={{ p: 2.5, borderRadius: 2, bgcolor: '#f8fafc', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 80 }}>
          <Typography variant="body2" sx={{ color: '#94a3b8' }}>Content pillar discovery pending — analysis in progress...</Typography>
        </Paper>
      </Box>
    );
  }

  const { target_company, competitors } = data;

  if (!hasPillars(data)) {
    return (
      <Box mt={4} mb={3}>
        <SectionHeader onRefresh={onRefresh} />
        <Paper sx={{ p: 2.5, borderRadius: 2, bgcolor: '#fefce8', border: '1px solid #fde68a', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 80 }}>
          <Typography variant="body2" sx={{ color: '#92400e' }}>Content pillars not yet discovered. AI is analyzing competitors and your website — results will appear here.</Typography>
        </Paper>
      </Box>
    );
  }

  return (
    <Box mt={4} mb={3}>
      <SectionHeader onRefresh={onRefresh} />
      {error && (
        <Paper sx={{ p: 1.5, borderRadius: 2, bgcolor: '#fff7ed', border: '1px solid #fdba74', mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
          <ErrorIcon sx={{ color: '#ea580c', fontSize: 18, flexShrink: 0 }} />
          <Typography variant="caption" sx={{ color: '#9a3412' }}>{error}</Typography>
        </Paper>
      )}

      <Box display="grid" gridTemplateColumns={{ xs: '1fr', md: '1fr 1fr' }} gap={3}>
        {/* Target Company */}
        {target_company?.content_pillars?.length ? (
          <Paper sx={{ p: 2.5, borderRadius: 2, bgcolor: '#fefce8', border: '1px solid #fde68a' }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#92400e', mb: 1.5, display: 'flex', alignItems: 'center', gap: 1 }}>
              🎯 Your {target_company.domain} Content Strategy
            </Typography>
            <Box display="flex" flexDirection="column" gap={1}>
              {target_company.content_pillars.map((pillar, i) => (
                <Chip key={i} label={pillar} size="small"
                  sx={{ bgcolor: '#fff', border: '1px solid #fde68a', color: '#92400e', fontWeight: 500, textAlign: 'left', height: 'auto', py: 0.5, '& .MuiChip-label': { whiteSpace: 'normal', lineHeight: 1.4 } }} />
              ))}
            </Box>
          </Paper>
        ) : (
          <Paper sx={{ p: 2.5, borderRadius: 2, bgcolor: '#f8fafc', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 80 }}>
            <Typography variant="body2" sx={{ color: '#94a3b8' }}>Pillar analysis in progress...</Typography>
          </Paper>
        )}

        {/* Competitor Pillars */}
        {competitors?.length ? (
          <Paper sx={{ p: 2.5, borderRadius: 2, bgcolor: '#f8fafc', border: '1px solid #e2e8f0' }}>
            <Box display="flex" alignItems="center" justifyContent="space-between" mb={1.5}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#334155', display: 'flex', alignItems: 'center', gap: 1 }}>
                <BusinessIcon sx={{ fontSize: 18 }} />
                Competitor Pillars ({competitors.length})
              </Typography>
              <IconButton size="small" onClick={() => setCompExpanded(!compExpanded)}>
                {compExpanded ? <ExpandLess fontSize="small" /> : <ExpandMore fontSize="small" />}
              </IconButton>
            </Box>
            <Collapse in={compExpanded}>
              <Box display="flex" flexDirection="column" gap={2}>
                {competitors.map((comp, i) => (
                  <Box key={i}>
                    <Typography variant="caption" sx={{ fontWeight: 700, color: '#64748b', display: 'block', mb: 0.5 }}>
                      📋 {comp.company_name}
                    </Typography>
                    <Box display="flex" flexWrap="wrap" gap={0.5}>
                      {comp.content_pillars?.length ? comp.content_pillars.map((pillar, j) => (
                        <Chip key={j} label={pillar} size="small" variant="outlined"
                          sx={{ bgcolor: '#fff', borderColor: '#cbd5e1', color: '#475569', fontWeight: 500, height: 'auto', py: 0.25, '& .MuiChip-label': { whiteSpace: 'normal', lineHeight: 1.4 } }} />
                      )) : (
                        <Typography variant="caption" sx={{ color: '#94a3b8' }}>Pillars being analyzed...</Typography>
                      )}
                    </Box>
                  </Box>
                ))}
              </Box>
            </Collapse>
          </Paper>
        ) : (
          <Paper sx={{ p: 2.5, borderRadius: 2, bgcolor: '#f8fafc', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 80 }}>
            <Typography variant="body2" sx={{ color: '#94a3b8' }}>Competitor pillars being analyzed...</Typography>
          </Paper>
        )}
      </Box>
    </Box>
  );
};