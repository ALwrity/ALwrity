import React from 'react';
import { Box, Typography, Paper, Chip, CircularProgress } from '@mui/material';
import { Lightbulb as LightbulbIcon, Business as BusinessIcon } from '@mui/icons-material';

export interface ContentPillarData {
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
}

export const ContentPillarsSection: React.FC<ContentPillarsSectionProps> = ({ data, isLoading }) => {
  if (isLoading) {
    return (
      <Box mt={3} display="flex" alignItems="center" gap={2}>
        <CircularProgress size={18} />
        <Typography variant="body2" sx={{ color: '#64748b' }}>Discovering content pillars...</Typography>
      </Box>
    );
  }

  if (!data) return null;

  const { target_company, competitors } = data;

  return (
    <Box mt={4} mb={3}>
      <Typography variant="h5" fontWeight={600} sx={{ color: '#1a202c', display: 'flex', alignItems: 'center', mb: 2 }}>
        <LightbulbIcon sx={{ mr: 1, color: '#f59e0b' }} />
        Content Pillars
      </Typography>

      <Box display="grid" gridTemplateColumns={{ xs: '1fr', md: '1fr 1fr' }} gap={3}>
        {/* Target Company */}
        {target_company && (
          <Paper sx={{ p: 2.5, borderRadius: 2, bgcolor: '#fefce8', border: '1px solid #fde68a' }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#92400e', mb: 1.5, display: 'flex', alignItems: 'center', gap: 1 }}>
              🎯 Your Content Strategy
            </Typography>
            <Box display="flex" flexDirection="column" gap={1}>
              {target_company.content_pillars?.map((pillar, i) => (
                <Chip
                  key={i}
                  label={pillar}
                  size="small"
                  sx={{ bgcolor: '#fff', border: '1px solid #fde68a', color: '#92400e', fontWeight: 500, textAlign: 'left', height: 'auto', py: 0.5, '& .MuiChip-label': { whiteSpace: 'normal', lineHeight: 1.4 } }}
                />
              ))}
            </Box>
          </Paper>
        )}

        {/* Competitor Pillars */}
        {competitors && competitors.length > 0 && (
          <Paper sx={{ p: 2.5, borderRadius: 2, bgcolor: '#f8fafc', border: '1px solid #e2e8f0' }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#334155', mb: 1.5, display: 'flex', alignItems: 'center', gap: 1 }}>
              <BusinessIcon sx={{ fontSize: 18 }} />
              Competitor Pillars
            </Typography>
            <Box display="flex" flexDirection="column" gap={2}>
              {competitors.map((comp, i) => (
                <Box key={i}>
                  <Typography variant="caption" sx={{ fontWeight: 700, color: '#64748b', display: 'block', mb: 0.5 }}>
                    📋 {comp.company_name}
                  </Typography>
                  <Box display="flex" flexWrap="wrap" gap={0.5}>
                    {comp.content_pillars?.map((pillar, j) => (
                      <Chip
                        key={j}
                        label={pillar}
                        size="small"
                        variant="outlined"
                        sx={{ bgcolor: '#fff', borderColor: '#cbd5e1', color: '#475569', fontWeight: 500, height: 'auto', py: 0.25, '& .MuiChip-label': { whiteSpace: 'normal', lineHeight: 1.4 } }}
                      />
                    ))}
                  </Box>
                </Box>
              ))}
            </Box>
          </Paper>
        )}
      </Box>
    </Box>
  );
};
