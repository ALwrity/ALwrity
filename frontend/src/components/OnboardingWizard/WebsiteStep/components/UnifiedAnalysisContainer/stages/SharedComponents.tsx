import React from 'react';
import { Box, Typography, Button, Alert, Paper, Chip } from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import AnalyticsIcon from '@mui/icons-material/Analytics';
import PaletteIcon from '@mui/icons-material/Palette';
import GroupIcon from '@mui/icons-material/Group';
import ArticleIcon from '@mui/icons-material/Article';
import PsychologyIcon from '@mui/icons-material/Psychology';
import ExploreIcon from '@mui/icons-material/Explore';
import BusinessIcon from '@mui/icons-material/Business';
import StrategicInsightsSection from '../../StrategicInsightsSection';
import ContentStrategyInsightsSection from '../../ContentStrategyInsightsSection';
import StyleAnalysisSection from '../../StyleAnalysisSection';
import CrawlResultSections from '../../CrawlResultSections';
import SectionHeader from '../../SectionHeader';
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

  const items = [
    { label: 'Writing Tone', value: settings.writing_tone, icon: <PaletteIcon sx={{ color: '#3B82F6' }} />, bg: '#EFF6FF' },
    { label: 'Target Audience', value: settings.target_audience, icon: <GroupIcon sx={{ color: '#10B981' }} />, bg: '#ECFDF5' },
    { label: 'Content Type', value: settings.content_type, icon: <ArticleIcon sx={{ color: '#F59E0B' }} />, bg: '#FEF3C7' },
    { label: 'Brand Alignment', value: settings.brand_alignment, icon: <AutoAwesomeIcon sx={{ color: '#6366F1' }} />, bg: '#EEF2FF' },
    { label: 'Creativity Level', value: settings.creativity_level, icon: <PsychologyIcon sx={{ color: '#8B5CF6' }} />, bg: '#F5F3FF' },
    { label: 'Industry Context', value: settings.industry_context, icon: <BusinessIcon sx={{ color: '#64748B' }} />, bg: '#F8FAFC' },
    { label: 'Geographic Location', value: settings.geographic_location, icon: <ExploreIcon sx={{ color: '#EC4899' }} />, bg: '#FDF2F8' },
  ].filter((item) => item.value);

  return (
    <Box sx={{ p: 0, mb: 3 }}>
      <SectionHeader
        title="AI Generation Settings"
        icon={<AutoAwesomeIcon sx={{ color: '#6366F1' }} />}
        tooltip="These settings are automatically derived from your website analysis and will be applied when generating content with ALwrity. You can fine-tune other brand parameters under the Refine & Actions tab in Edit Mode."
        sx={{ mb: 2 }}
      />
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: '1fr 1fr' },
          gap: 2,
        }}
      >
        {items.map((item) => (
          <Paper
            key={item.label}
            variant="outlined"
            sx={{
              p: 2,
              display: 'flex',
              alignItems: 'center',
              gap: 2,
              borderRadius: 3,
              bgcolor: '#FFFFFF',
              border: '1px solid #E2E8F0',
              height: '100%',
              width: '100%',
              boxSizing: 'border-box',
              transition: 'all 0.2s ease-in-out',
              '&:hover': {
                borderColor: '#CBD5E1',
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.05)',
                transform: 'translateY(-2px)',
              },
            }}
          >
            <Box
              sx={{
                width: 44,
                height: 44,
                borderRadius: '12px',
                bgcolor: item.bg,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              {item.icon}
            </Box>
            <Box sx={{ minWidth: 0, flex: 1 }}>
              <Typography
                variant="caption"
                sx={{
                  color: '#64748B',
                  fontWeight: 700,
                  fontSize: '0.65rem',
                  letterSpacing: '0.05em',
                  textTransform: 'uppercase',
                  display: 'block',
                  mb: 0.5,
                }}
              >
                {item.label}
              </Typography>
              <Typography
                variant="body2"
                sx={{
                  fontWeight: 600,
                  color: '#1E293B',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {item.value}
              </Typography>
            </Box>
          </Paper>
        ))}
      </Box>
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
      {analysis.content_strategy_insights && (
        <Box sx={{ mt: 4 }}>
          <SectionHeader
            title="SWOT & Content Strategy Insights"
            icon={<AnalyticsIcon sx={{ color: '#F59E0B' }} />}
            tooltip="SWOT analysis (Strengths, Weaknesses, Opportunities, Threats) and recommended improvements for your content strategy."
          />
          <ContentStrategyInsightsSection
            insights={analysis.content_strategy_insights}
            isEditable={isEditable}
            onUpdate={(field, value) => onUpdate('content_strategy_insights', field, value)}
            hideHeader={true}
          />
        </Box>
      )}
    </Box>
  );
};
