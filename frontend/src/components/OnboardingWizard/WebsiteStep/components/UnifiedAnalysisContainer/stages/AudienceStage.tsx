import React from 'react';
import { Box, Typography } from '@mui/material';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import GroupIcon from '@mui/icons-material/Group';
import TargetAudienceAnalysisSection from '../../TargetAudienceAnalysisSection';
import EnhancedGuidelinesSection from '../../EnhancedGuidelinesSection';
import SectionHeader from '../../SectionHeader';
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
    const items = [
      ...(analysis.target_audience?.pain_points ?? []),
      ...(analysis.target_audience?.motivations ?? []),
    ];
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
        {items.length > 0 && (
          <Box sx={{ mt: 3, p: 2, border: '1px solid #E2E8F0', borderRadius: 2, bgcolor: '#FFFFFF' }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1.5, color: '#1E293B' }}>
              Audience Pain Points & Motivations
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {items.map((item, i) => (
                <Box
                  key={i}
                  sx={{
                    py: 0.75,
                    px: 1.5,
                    borderRadius: 1.5,
                    bgcolor: '#F0FDF4',
                    border: '1px solid #BBF7D0',
                  }}
                >
                  <Typography variant="body2" sx={{ color: '#166534', fontWeight: 500 }}>
                    {item}
                  </Typography>
                </Box>
              ))}
            </Box>
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
