import React from 'react';
import { Box, Typography, Button, Alert, Paper, Chip } from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import StrategicInsightsSection from '../../StrategicInsightsSection';
import StyleAnalysisSection from '../../StyleAnalysisSection';
import CrawlResultSections from '../../CrawlResultSections';
import type { StyleAnalysis } from '../../AnalysisResultsDisplay';

export const EmptyState: React.FC<{ message: string }> = ({ message }) => (
  <Box
    data-testid="empty-state"
    sx={{ p: 4, textAlign: 'center', color: 'text.secondary' }}
  >
    <Typography variant="body2">{message}</Typography>
  </Box>
);

export const PlatformConnectionsNudge: React.FC = () => (
  <Box sx={{ mb: 3, p: 2, borderRadius: 2, bgcolor: '#EFF6FF', border: '1px solid #BFDBFE' }}>
    <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 0.5, color: '#1E293B' }}>
      Platform Connections
    </Typography>
    <Typography variant="body2" color="text.secondary">
      Connect your social platforms (LinkedIn, YouTube) using the tabs in the main navigation bar
      to unlock cross-channel content insights.
    </Typography>
  </Box>
);

export const FootprintCrawlPanels: React.FC<{ crawlResult: any; showPlatformNudge?: boolean }> = ({
  crawlResult,
  showPlatformNudge = false,
}) => (
  <Box data-testid="footprint-crawl-panels" sx={{ p: 2 }}>
    {showPlatformNudge && <PlatformConnectionsNudge />}
    <CrawlResultSections crawlResult={crawlResult} />
  </Box>
);

export const NonEditableCTA: React.FC<{ label: string; onRerun?: () => void }> = ({ label, onRerun }) => (
  <Box sx={{ p: 3 }}>
    <Alert severity="info" sx={{ mb: 2 }}>
      {label} data is derived from automated analysis and cannot be edited manually.
    </Alert>
    {onRerun && (
      <Button
        variant="outlined"
        startIcon={<RefreshIcon />}
        onClick={onRerun}
        sx={{ textTransform: 'none' }}
      >
        Re-run Analysis
      </Button>
    )}
  </Box>
);

interface RecommendedSettingsPanelProps {
  settings: StyleAnalysis['recommended_settings'];
}
export const RecommendedSettingsPanel: React.FC<RecommendedSettingsPanelProps> = ({ settings }) => {
  if (!settings) return <EmptyState message="No AI generation settings detected." />;

  const chips: { label: string; value: string }[] = [
    { label: 'Tone', value: settings.writing_tone ?? '' },
    { label: 'Audience', value: settings.target_audience ?? '' },
    { label: 'Type', value: settings.content_type ?? '' },
    { label: 'Creativity', value: settings.creativity_level ?? '' },
    { label: 'Location', value: settings.geographic_location ?? '' },
    { label: 'Industry', value: settings.industry_context ?? '' },
    { label: 'Brand', value: settings.brand_alignment ?? '' },
  ].filter((c) => c.value);

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1, color: '#1E293B' }}>
        AI Generation Settings
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        These settings will be applied when generating content with ALwrity. You can update them by
        switching to the <strong>Insights</strong> tab and enabling Edit Mode.
      </Typography>
      <Paper variant="outlined" sx={{ p: 2 }}>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
          {chips.map((c) => (
            <Chip
              key={c.label}
              size="small"
              label={`${c.label}: ${c.value}`}
              sx={{ bgcolor: '#F1F5F9', border: '1px solid #CBD5E1', fontWeight: 500 }}
            />
          ))}
        </Box>
      </Paper>
    </Box>
  );
};

interface StrategicPanelProps {
  analysis: StyleAnalysis;
  isEditable: boolean;
  onUpdate: (section: string, field: string, value: any) => void;
  domainName: string;
}
export const StrategicPanel: React.FC<StrategicPanelProps> = ({
  analysis,
  isEditable,
  onUpdate,
  domainName,
}) => {
  const stylePatternsInner =
    analysis.style_patterns &&
    typeof analysis.style_patterns === 'object' &&
    !Array.isArray(analysis.style_patterns) &&
    'patterns' in analysis.style_patterns
      ? (analysis.style_patterns as any).patterns
      : analysis.style_patterns;

  return (
    <Box sx={{ p: 2 }}>
      <StrategicInsightsSection
        contentStrategy={
          analysis.content_strategy || analysis.strategic_insights?.content_strategy
        }
        competitiveAdvantages={
          analysis.competitive_advantages || analysis.strategic_insights?.competitive_advantages
        }
        contentCalendarSuggestions={
          analysis.content_calendar_suggestions ||
          analysis.strategic_insights?.content_calendar_suggestions
        }
        aiGenerationTips={
          analysis.ai_generation_tips || analysis.strategic_insights?.ai_generation_tips
        }
        isEditable={isEditable}
        onUpdate={(field, value) => onUpdate('strategic_insights', field, value)}
      />
      <Box sx={{ mt: 3 }}>
        <StyleAnalysisSection
          patterns={stylePatternsInner}
          consistency={analysis.style_consistency}
          uniqueElements={analysis.unique_elements}
          domainName={domainName}
          isEditable={isEditable}
          onUpdate={onUpdate}
        />
      </Box>
    </Box>
  );
};
