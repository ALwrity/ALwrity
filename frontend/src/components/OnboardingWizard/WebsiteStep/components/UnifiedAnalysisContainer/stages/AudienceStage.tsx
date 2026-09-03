import React from 'react';
import { Box, Typography } from '@mui/material';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import GroupIcon from '@mui/icons-material/Group';
import TargetAudienceAnalysisSection from '../../TargetAudienceAnalysisSection';
import EnhancedGuidelinesSection from '../../EnhancedGuidelinesSection';
import SectionHeader from '../../SectionHeader';
import KeyInsightsGrid from '../../KeyInsightsGrid';
import { EmptyState } from './SharedComponents';
import type { StyleAnalysis } from '../AnalysisResultsDisplay';
import type { TabKey } from '../types';

interface AudienceStageProps {
  activeTab: TabKey;
  analysis: StyleAnalysis;
  domainName: string;
  isEditable: boolean;
  onUpdate: (section: string, field: string, value: any) => void;
  refineControls?: React.ReactNode;
}

const AudienceStage: React.FC<AudienceStageProps> = ({
  activeTab,
  analysis,
  domainName,
  isEditable,
  onUpdate,
  refineControls,
}) => {
  if (activeTab === 'insights') {
    if (!analysis.target_audience) return <EmptyState message="No audience data available." />;
    return (
      <Box sx={{ p: 2 }}>
        <KeyInsightsGrid
          target_audience={analysis.target_audience}
          filterLabels={['Target Audience', 'Geographic Focus']}
          title="Audience Demographics & Focus"
        />
        <TargetAudienceAnalysisSection
          targetAudience={analysis.target_audience}
          isEditable={false}
          onUpdate={(field, value) => onUpdate('target_audience', field, value)}
        />
      </Box>
    );
  }

  if (activeTab === 'refine_actions') {
    if (!analysis.target_audience) return <EmptyState message="No audience data available." />;
    return (
      <Box sx={{ p: 2 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <SectionHeader
            title="Target Audience Analysis & Actions"
            icon={<GroupIcon sx={{ color: '#10B981' }} />}
            tooltip="Who your content speaks to — demographics, psychographics, and motivations."
            sx={{ mb: 0 }}
          />
          {refineControls}
        </Box>
        <TargetAudienceAnalysisSection
          targetAudience={analysis.target_audience}
          isEditable={isEditable}
          onUpdate={(field, value) => onUpdate('target_audience', field, value)}
          hideHeader={true}
        />
      </Box>
    );
  }

  if (activeTab === 'guidelines') {
    return (
      <Box sx={{ p: 2 }}>
        <SectionHeader title="Style Guidelines" icon={<AutoAwesomeIcon />} />
        <EnhancedGuidelinesSection
          guidelines={{
            audience_considerations: analysis.guidelines?.audience_considerations,
            engagement_tips: analysis.guidelines?.engagement_tips,
          }}
          domainName={domainName}
        />
      </Box>
    );
  }

  return null;
};

export default AudienceStage;
