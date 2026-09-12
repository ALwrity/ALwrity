import React from 'react';
import {
  Box,
  Typography,
  Dialog,
  DialogTitle,
  DialogContent,
  Divider,
  Chip,
  Stack,
} from '@mui/material';
import type { Competitor } from '../WebsiteStep/components';
import { labelify, renderStringList } from './competitorStepUiHelpers';
import { OnboardingDialogCloseButton } from '../common/OnboardingDialogCloseButton';

interface CompetitorHighlightsDialogProps {
  open: boolean;
  competitor: Competitor | null;
  onClose: () => void;
}

export const CompetitorHighlightsDialog: React.FC<CompetitorHighlightsDialogProps> = ({
  open,
  competitor,
  onClose,
}) => (
  <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
    {competitor && (
      <>
        <DialogTitle
          sx={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: 1,
            pr: 1.5,
          }}
        >
          <Box>
            <Typography variant="h6" component="span" fontWeight={700} sx={{ color: '#0B1220' }}>
              {competitor.title || competitor.domain}
            </Typography>
            <Typography variant="caption" component="div" sx={{ color: '#6B7280', mt: 0.5 }}>
              {competitor.domain}
            </Typography>
          </Box>
          <OnboardingDialogCloseButton onClick={onClose} />
        </DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2.5}>
            <Box display="flex" gap={1} flexWrap="wrap">
              <Chip
                size="small"
                label={`${Math.round(competitor.relevance_score * 100)}% match`}
                sx={{ bgcolor: '#f0fdf4', color: '#15803d', fontWeight: 600, border: '1px solid #bbf7d0' }}
              />
              {competitor.competitive_insights?.threat_level && (
                <Chip
                  size="small"
                  label={`Threat: ${competitor.competitive_insights.threat_level}`}
                  sx={{
                    bgcolor:
                      competitor.competitive_insights.threat_level === 'high'
                        ? '#fef2f2'
                        : competitor.competitive_insights.threat_level === 'low'
                          ? '#f0fdf4'
                          : '#fffbeb',
                    color:
                      competitor.competitive_insights.threat_level === 'high'
                        ? '#b91c1c'
                        : competitor.competitive_insights.threat_level === 'low'
                          ? '#15803d'
                          : '#b45309',
                    fontWeight: 600,
                    border: '1px solid',
                    borderColor:
                      competitor.competitive_insights.threat_level === 'high'
                        ? '#fecaca'
                        : competitor.competitive_insights.threat_level === 'low'
                          ? '#bbf7d0'
                          : '#fde68a',
                  }}
                />
              )}
              {competitor.published_date && (
                <Chip
                  size="small"
                  label={`Published: ${new Date(competitor.published_date).toLocaleDateString()}`}
                  variant="outlined"
                  sx={{ fontSize: '0.7rem', height: 22, borderColor: '#E5E7EB', color: '#6B7280' }}
                />
              )}
            </Box>

            {competitor.summary && (
              <Box>
                <Typography variant="subtitle2" fontWeight={700} sx={{ color: '#0B1220', mb: 0.5 }}>
                  Summary
                </Typography>
                <Typography variant="body2" sx={{ color: '#4B5563' }}>{competitor.summary}</Typography>
              </Box>
            )}

            <Box>
              <Typography variant="subtitle2" fontWeight={700} sx={{ color: '#0B1220', mb: 0.5 }}>
                Business & Audience
              </Typography>
              <Box display="flex" gap={1} flexWrap="wrap">
                {competitor.competitive_insights?.business_model &&
                  competitor.competitive_insights.business_model !== 'unknown' && (
                    <Chip
                      size="small"
                      label={`Model: ${competitor.competitive_insights.business_model}`}
                      variant="outlined"
                      sx={{ fontSize: '0.72rem', borderColor: '#d1d5db', color: '#374151' }}
                    />
                  )}
                {competitor.competitive_insights?.target_audience &&
                  competitor.competitive_insights.target_audience !== 'unknown' && (
                    <Chip
                      size="small"
                      label={`Audience: ${competitor.competitive_insights.target_audience}`}
                      variant="outlined"
                      sx={{ fontSize: '0.72rem', borderColor: '#d1d5db', color: '#374151' }}
                    />
                  )}
                {competitor.competitive_insights?.market_share_estimate &&
                  competitor.competitive_insights.market_share_estimate !== 'unknown' && (
                    <Chip
                      size="small"
                      label={`Market share: ${competitor.competitive_insights.market_share_estimate}`}
                      variant="outlined"
                      sx={{ fontSize: '0.72rem', borderColor: '#d1d5db', color: '#374151' }}
                    />
                  )}
              </Box>
            </Box>

            {competitor.competitive_insights?.competitive_strengths &&
              competitor.competitive_insights.competitive_strengths.length > 0 &&
              renderStringList('Competitive Strengths', competitor.competitive_insights.competitive_strengths)}

            {competitor.competitive_insights?.competitive_weaknesses &&
              competitor.competitive_insights.competitive_weaknesses.length > 0 &&
              renderStringList('Competitive Weaknesses', competitor.competitive_insights.competitive_weaknesses)}

            {competitor.competitive_insights?.differentiation_opportunities &&
              competitor.competitive_insights.differentiation_opportunities.length > 0 &&
              renderStringList(
                'Differentiation Opportunities',
                competitor.competitive_insights.differentiation_opportunities
              )}

            {competitor.market_positioning && (
              <Box>
                <Typography variant="subtitle2" fontWeight={700} sx={{ color: '#0B1220', mb: 0.5 }}>
                  Market Positioning
                </Typography>
                <Box display="flex" gap={1} flexWrap="wrap">
                  {Object.entries(competitor.market_positioning)
                    .filter(([, v]) => v && v !== 'unknown')
                    .map(([k, v]) => (
                      <Chip
                        key={k}
                        size="small"
                        label={`${labelify(k)}: ${v}`}
                        variant="outlined"
                        sx={{ fontSize: '0.72rem', borderColor: '#d1d5db', color: '#374151' }}
                      />
                    ))}
                  {(!competitor.market_positioning ||
                    !Object.values(competitor.market_positioning).some((v) => v && v !== 'unknown')) && (
                    <Typography variant="body2" color="text.secondary">
                      No market positioning data available.
                    </Typography>
                  )}
                </Box>
              </Box>
            )}

            {competitor.content_insights && (
              <Box>
                <Typography variant="subtitle2" fontWeight={700} sx={{ color: '#0B1220', mb: 0.5 }}>
                  Content Insights
                </Typography>
                <Box display="flex" gap={1} flexWrap="wrap">
                  {competitor.content_insights.content_focus && (
                    <Chip
                      size="small"
                      label={`Focus: ${competitor.content_insights.content_focus}`}
                      variant="outlined"
                      sx={{ fontSize: '0.72rem', borderColor: '#d1d5db', color: '#374151' }}
                    />
                  )}
                  {competitor.content_insights.target_audience && (
                    <Chip
                      size="small"
                      label={`Audience: ${competitor.content_insights.target_audience}`}
                      variant="outlined"
                      sx={{ fontSize: '0.72rem', borderColor: '#d1d5db', color: '#374151' }}
                    />
                  )}
                  {competitor.content_insights.content_quality && (
                    <Chip
                      size="small"
                      label={`Quality: ${competitor.content_insights.content_quality}`}
                      variant="outlined"
                      sx={{ fontSize: '0.72rem', borderColor: '#d1d5db', color: '#374151' }}
                    />
                  )}
                  {competitor.content_insights.publishing_frequency && (
                    <Chip
                      size="small"
                      label={`Frequency: ${competitor.content_insights.publishing_frequency}`}
                      variant="outlined"
                      sx={{ fontSize: '0.72rem', borderColor: '#d1d5db', color: '#374151' }}
                    />
                  )}
                </Box>
                {competitor.content_insights.content_types &&
                  competitor.content_insights.content_types.length > 0 && (
                    <Typography variant="body2" sx={{ color: '#4B5563', mt: 0.75 }}>
                      <strong>Content types:</strong> {competitor.content_insights.content_types.join(', ')}
                    </Typography>
                  )}
              </Box>
            )}

            <Divider />

            <Box>
              <Typography variant="subtitle2" fontWeight={700} sx={{ color: '#0B1220', mb: 0.5 }}>
                Key Highlights
              </Typography>
              {competitor.highlights && competitor.highlights.length > 0 ? (
                <Box>
                  {competitor.highlights.map((highlight, index) => (
                    <Box
                      key={index}
                      sx={{
                        p: 1.5,
                        mb: 1,
                        border: '1px solid',
                        borderColor: 'divider',
                        borderRadius: 1,
                        backgroundColor: 'background.paper',
                      }}
                    >
                      <Typography variant="body2" color="text.secondary">{highlight}</Typography>
                    </Box>
                  ))}
                </Box>
              ) : (
                <Typography variant="body2" color="text.secondary">No highlights available.</Typography>
              )}
            </Box>

            {competitor.subpages && competitor.subpages.length > 0 && (
              <Box>
                <Typography variant="subtitle2" fontWeight={700} sx={{ color: '#0B1220', mb: 0.5 }}>
                  Subpages ({competitor.subpages.length})
                </Typography>
                <Stack spacing={0.5}>
                  {competitor.subpages.map((sp, i) => (
                    <Typography key={i} variant="body2" sx={{ color: '#4B5563', wordBreak: 'break-all' }}>
                      • {sp}
                    </Typography>
                  ))}
                </Stack>
              </Box>
            )}
          </Stack>
        </DialogContent>
      </>
    )}
  </Dialog>
);
