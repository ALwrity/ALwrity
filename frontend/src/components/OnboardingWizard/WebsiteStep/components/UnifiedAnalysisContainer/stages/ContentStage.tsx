import React from 'react';
import { Box, Typography } from '@mui/material';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import ArticleIcon from '@mui/icons-material/Article';
import ContentCharacteristicsSection from '../../ContentCharacteristicsSection';
import ContentTypeAnalysisSection from '../../ContentTypeAnalysisSection';
import ContentStrategyInsightsSection from '../../ContentStrategyInsightsSection';
import EnhancedGuidelinesSection from '../../EnhancedGuidelinesSection';
import StyleAnalysisSection from '../../StyleAnalysisSection';
import SectionHeader from '../../SectionHeader';
import KeyInsightsGrid from '../../KeyInsightsGrid';
import { EmptyState } from './SharedComponents';
import type { StyleAnalysis } from '../AnalysisResultsDisplay';
import type { TabKey } from '../types';

interface ContentStageProps {
  activeTab: TabKey;
  analysis: StyleAnalysis;
  domainName: string;
  isEditable: boolean;
  onUpdate: (section: string, field: string, value: any) => void;
  refineControls?: React.ReactNode;
}

const ContentStage: React.FC<ContentStageProps> = ({
  activeTab,
  analysis,
  domainName,
  isEditable,
  onUpdate,
  refineControls,
}) => {
  const hasData = analysis.content_characteristics || analysis.content_type || analysis.content_strategy_insights;

  if (activeTab === 'insights') {
    if (!hasData) return <EmptyState message="No content profile data available." />;
    return (
      <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 3 }}>
        <KeyInsightsGrid
          writing_style={analysis.writing_style}
          content_type={analysis.content_type}
          filterLabels={['Content Complexity', 'Formality Level', 'Engagement Level', 'Primary Type']}
          title="Content Characteristics & Format"
        />
        {analysis.content_characteristics && (
          <ContentCharacteristicsSection
            contentCharacteristics={analysis.content_characteristics}
            isEditable={false}
            onUpdate={(field, value) => onUpdate('content_characteristics', field, value)}
          />
        )}
        {analysis.content_type && (
          <ContentTypeAnalysisSection
            contentType={analysis.content_type}
            isEditable={false}
            onUpdate={(field, value) => onUpdate('content_type', field, value)}
          />
        )}
      </Box>
    );
  }

  if (activeTab === 'refine_actions') {
    if (!hasData) return <EmptyState message="No content profile data available." />;
    const hasTemplates = analysis.content_templates?.length || analysis.headline_formulas?.length || analysis.content_briefs?.length;
    return (
      <Box sx={{ p: 2 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <SectionHeader
            title="Content Profile & Actions"
            icon={<ArticleIcon sx={{ color: '#F59E0B' }} />}
            tooltip="Refine your content characteristics, content types, and strategy insights."
            sx={{ mb: 0 }}
          />
          {refineControls}
        </Box>

        <Box sx={{ mb: 4 }}>
          <StyleAnalysisSection
            patterns={
              analysis.style_patterns &&
              typeof analysis.style_patterns === 'object' &&
              !Array.isArray(analysis.style_patterns) &&
              'patterns' in analysis.style_patterns
                ? (analysis.style_patterns as any).patterns
                : analysis.style_patterns
            }
            consistency={analysis.style_consistency}
            uniqueElements={analysis.unique_elements}
            domainName={domainName}
            isEditable={isEditable}
            onUpdate={onUpdate}
          />
        </Box>

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          {analysis.content_characteristics && (
            <ContentCharacteristicsSection
              contentCharacteristics={analysis.content_characteristics}
              isEditable={isEditable}
              onUpdate={(field, value) => onUpdate('content_characteristics', field, value)}
              hideHeader={true}
            />
          )}
          {analysis.content_type && (
            <ContentTypeAnalysisSection
              contentType={analysis.content_type}
              isEditable={isEditable}
              onUpdate={(field, value) => onUpdate('content_type', field, value)}
              hideHeader={true}
            />
          )}
        </Box>

        {hasTemplates && (
          <Box sx={{ mt: 4, p: 2, border: '1px solid #E2E8F0', borderRadius: 2, bgcolor: '#FFFFFF' }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 2 }}>Content Templates, Formulas & Briefs</Typography>
            {analysis.content_templates && analysis.content_templates.length > 0 && (
              <Box sx={{ mb: 2 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>Content Templates</Typography>
                {analysis.content_templates.slice(0, 2).map((t, i) => (
                  <Box key={i} sx={{ p: 1.5, mb: 1, border: '1px solid #E2E8F0', borderRadius: 2, bgcolor: '#F8FAFC' }}>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>{t.type || t.headline}</Typography>
                    {t.tone_notes && <Typography variant="caption" color="text.secondary">{t.tone_notes}</Typography>}
                  </Box>
                ))}
              </Box>
            )}
            {analysis.headline_formulas && analysis.headline_formulas.length > 0 && (
              <Box sx={{ mb: 2 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>Headline Formulas</Typography>
                {analysis.headline_formulas.slice(0, 4).map((h, i) => (
                  <Box key={i} sx={{ p: 1, mb: 0.5, border: '1px solid #E2E8F0', borderRadius: 1, bgcolor: '#FAFAFA' }}>
                    <Typography variant="caption" sx={{ fontFamily: 'monospace', fontWeight: 600, display: 'block' }}>{h.pattern}</Typography>
                    <Typography variant="caption" color="text.secondary">{h.example}</Typography>
                  </Box>
                ))}
              </Box>
            )}
            {analysis.content_briefs && analysis.content_briefs.length > 0 && (
              <Box>
                <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>Content Briefs</Typography>
                {analysis.content_briefs.slice(0, 3).map((b, i) => (
                  <Box key={i} sx={{ p: 1.5, mb: 1, border: '1px solid #E2E8F0', borderRadius: 2 }}>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>{b.topic}</Typography>
                    <Typography variant="caption" color="text.secondary">~{b.word_count} words · {b.target_audience}</Typography>
                  </Box>
                ))}
              </Box>
            )}
          </Box>
        )}
      </Box>
    );
  }

  if (activeTab === 'guidelines') {
    return (
      <Box sx={{ p: 2 }}>
        <SectionHeader title="Style Guidelines" icon={<AutoAwesomeIcon />} />
        <EnhancedGuidelinesSection
          guidelines={{
            tone_recommendations: analysis.guidelines?.tone_recommendations,
            structure_guidelines: analysis.guidelines?.structure_guidelines,
            vocabulary_suggestions: analysis.guidelines?.vocabulary_suggestions,
          }}
          domainName={domainName}
          avoidElements={analysis.avoid_elements}
        />
      </Box>
    );
  }

  return null;
};

export default ContentStage;
