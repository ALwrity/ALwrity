import React from 'react';
import { Box } from '@mui/material';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import BusinessIcon from '@mui/icons-material/Business';
import BrandAnalysisSection from '../../BrandAnalysisSection';
import StrategicInsightsSection from '../../StrategicInsightsSection';
import EnhancedGuidelinesSection from '../../EnhancedGuidelinesSection';
import SectionHeader from '../../SectionHeader';
import { EmptyState } from './SharedComponents';
import type { StyleAnalysis } from '../AnalysisResultsDisplay';
import type { TabKey } from '../types';

interface BrandStageProps {
  activeTab: TabKey;
  analysis: StyleAnalysis;
  domainName: string;
  isEditable: boolean;
  onUpdate: (section: string, field: string, value: any) => void;
  refineControls?: React.ReactNode;
}

const BrandStage: React.FC<BrandStageProps> = ({
  activeTab,
  analysis,
  domainName,
  isEditable,
  onUpdate,
  refineControls,
}) => {
  if (activeTab === 'insights') {
    if (!analysis.brand_analysis) return <EmptyState message="No brand analysis data available." />;
    return (
      <Box sx={{ p: 2 }}>
        <BrandAnalysisSection
          brandAnalysis={analysis.brand_analysis}
          isEditable={false}
          onUpdate={(field, value) => onUpdate('brand_analysis', field, value)}
        />
      </Box>
    );
  }

  if (activeTab === 'refine_actions') {
    if (!analysis.brand_analysis) return <EmptyState message="No brand analysis data available." />;
    return (
      <Box sx={{ p: 2 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <SectionHeader
            title="Brand Analysis & Actions"
            icon={<BusinessIcon sx={{ color: '#8B5CF6' }} />}
            tooltip="Brand voice, values, positioning, and competitive differentiation."
            sx={{ mb: 0 }}
          />
          {refineControls}
        </Box>
        <BrandAnalysisSection
          brandAnalysis={analysis.brand_analysis}
          isEditable={isEditable}
          onUpdate={(field, value) => onUpdate('brand_analysis', field, value)}
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
            brand_alignment: analysis.guidelines?.brand_alignment,
            conversion_optimization: analysis.guidelines?.conversion_optimization,
          }}
          domainName={domainName}
          competitiveAngles={analysis.competitive_angles}
        />
      </Box>
    );
  }

  return null;
};

export default BrandStage;
