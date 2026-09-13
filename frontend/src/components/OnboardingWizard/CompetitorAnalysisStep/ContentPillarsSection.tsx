import React from 'react';
import { Box, Typography, Paper, CircularProgress, Button } from '@mui/material';
import LightbulbIcon from '@mui/icons-material/Lightbulb';
import ErrorIcon from '@mui/icons-material/Error';
import RefreshIcon from '@mui/icons-material/Refresh';
import { ContentPillarsSectionHeader } from './ContentPillarsSectionHeader';
import { ContentPillarsDashboardGrid } from './ContentPillarsDashboardGrid';
import { getContentPillarListMinHeight } from './contentPillarsConstants';

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
  variant?: 'default' | 'dashboard';
}

function hasPillars(data: ContentPillarData): boolean {
  return !!(
    data.target_company?.content_pillars?.length ||
    data.competitors?.some((c) => c.content_pillars?.length)
  );
}

function getPillarStatus(data: ContentPillarData | null, _error?: string | null): ContentPillarsStatus {
  if (!data) return 'pending';
  if (data.status === 'failed' || data.status === 'complete') return data.status;
  if (data.error) return 'failed';
  if (hasPillars(data)) return 'complete';
  return 'pending';
}

const sectionIcon = <LightbulbIcon sx={{ color: '#f59e0b' }} fontSize="small" />;

export const ContentPillarsSection: React.FC<ContentPillarsSectionProps> = ({
  data,
  isLoading,
  error,
  onRefresh,
  variant = 'default',
}) => {
  const outerSx = variant === 'dashboard' ? { mb: 0 } : { mt: 4, mb: 3 };
  const header = (
    <ContentPillarsSectionHeader
      variant={variant}
      icon={sectionIcon}
      onRefresh={onRefresh}
      isLoading={isLoading}
    />
  );

  const pillarStatus = getPillarStatus(data, error);
  const failureMessage = String(data?.error || error || 'Content pillar discovery failed');

  if (isLoading) {
    return (
      <Box sx={outerSx} display="flex" alignItems="center" gap={2} p={2} bgcolor="#f8fafc" borderRadius={2}>
        <CircularProgress size={18} />
        <Typography variant="body2" sx={{ color: '#64748b' }}>Discovering content pillars...</Typography>
      </Box>
    );
  }

  if (pillarStatus === 'failed') {
    const isCreditExhausted =
      failureMessage.toLowerCase().includes('credit') || failureMessage.toLowerCase().includes('402');
    return (
      <Box sx={outerSx}>
        {header}
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
      <Box sx={outerSx}>
        {header}
        <Paper sx={{ p: 2.5, borderRadius: 2, bgcolor: '#f8fafc', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 80 }}>
          <Typography variant="body2" sx={{ color: '#94a3b8' }}>
            Content pillar discovery pending — analysis in progress...
          </Typography>
        </Paper>
      </Box>
    );
  }

  const { target_company, competitors } = data;

  if (!hasPillars(data)) {
    return (
      <Box sx={outerSx}>
        {header}
        <Paper sx={{ p: 2.5, borderRadius: 2, bgcolor: '#fefce8', border: '1px solid #fde68a', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 80 }}>
          <Typography variant="body2" sx={{ color: '#92400e' }}>
            Content pillars not yet discovered. AI is analyzing competitors and your website — results will appear here.
          </Typography>
        </Paper>
      </Box>
    );
  }

  const competitorCards = (competitors || []).filter((comp) => comp.content_pillars?.length);
  const pillarCounts = [
    ...(target_company?.content_pillars?.length ? [target_company.content_pillars.length] : []),
    ...competitorCards.map((comp) => comp.content_pillars.length),
  ];
  const minListHeight = getContentPillarListMinHeight(pillarCounts);

  return (
    <Box sx={outerSx} data-testid="content-pillars-section">
      {header}
      {error && (
        <Paper sx={{ p: 1.5, borderRadius: 2, bgcolor: '#fff7ed', border: '1px solid #fdba74', mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
          <ErrorIcon sx={{ color: '#ea580c', fontSize: 18, flexShrink: 0 }} />
          <Typography variant="caption" sx={{ color: '#9a3412' }}>{error}</Typography>
        </Paper>
      )}

      {(target_company?.content_pillars?.length || competitorCards.length > 0) && (
        <ContentPillarsDashboardGrid
          targetCompany={{
            domain: target_company?.domain || '',
            content_pillars: target_company?.content_pillars || [],
          }}
          competitors={competitorCards}
          minListHeight={minListHeight}
        />
      )}
    </Box>
  );
};
