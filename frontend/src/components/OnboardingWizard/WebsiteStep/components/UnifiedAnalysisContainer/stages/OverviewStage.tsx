import React from 'react';
import { Box, Typography } from '@mui/material';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import KeyInsightsGrid from '../../KeyInsightsGrid';
import EnhancedGuidelinesSection from '../../EnhancedGuidelinesSection';
import SectionHeader from '../../SectionHeader';
import { RecommendedSettingsPanel, StrategicPanel } from './SharedComponents';
import type { StyleAnalysis } from '../AnalysisResultsDisplay';
import type { TabKey } from '../types';

interface OverviewStageProps {
  activeTab: TabKey;
  analysis: StyleAnalysis;
  domainName: string;
  isEditable: boolean;
  onUpdate: (section: string, field: string, value: any) => void;
}

const OverviewStage: React.FC<OverviewStageProps> = ({
  activeTab,
  analysis,
  domainName,
  isEditable,
  onUpdate,
}) => {
  if (activeTab === 'insights') {
    return (
      <Box sx={{ p: 2 }}>
        {analysis.recommended_settings && (
          <Box sx={{ mb: 3 }}>
            <RecommendedSettingsPanel settings={analysis.recommended_settings} />
          </Box>
        )}
        <KeyInsightsGrid
          writing_style={analysis.writing_style}
          target_audience={analysis.target_audience}
          content_type={analysis.content_type}
          confidence={analysis.meta?.confidence}
        />
      </Box>
    );
  }

  if (activeTab === 'refine_actions') {
    return (
      <Box>
        <StrategicPanel
          analysis={analysis}
          isEditable={isEditable}
          onUpdate={onUpdate}
          domainName={domainName}
        />
      </Box>
    );
  }

  if (activeTab === 'guidelines') {
    return (
      <Box sx={{ p: 2 }}>
        <SectionHeader title="Style Guidelines" icon={<AutoAwesomeIcon />} />
        <EnhancedGuidelinesSection
          guidelines={analysis.guidelines || analysis.style_guidelines}
          domainName={domainName}
          bestPractices={analysis.best_practices}
          avoidElements={analysis.avoid_elements}
          contentTemplates={analysis.content_templates}
          headlineFormulas={analysis.headline_formulas}
          contentBriefs={analysis.content_briefs}
          competitiveAngles={analysis.competitive_angles}
        />
      </Box>
    );
  }

  return null;
};

export default OverviewStage;
