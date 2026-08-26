import React, { useState } from 'react';
import {
  Box,
  Tabs,
  Tab,
  Paper,
  Fade,
  useTheme
} from '@mui/material';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import PsychologyIcon from '@mui/icons-material/Psychology';

import {
  StrategicInsightsSection,
  StyleAnalysisSection
} from './index';

// Define Props Interface
interface CombinedStrategySectionProps {
  // Strategic Insights Props
  contentStrategy?: string;
  competitiveAdvantages?: string[];
  contentCalendarSuggestions?: string[];
  aiGenerationTips?: string[];
  
  // Style Analysis Props
  stylePatterns?: any;
  styleConsistency?: string;
  uniqueElements?: string[];
  domainName: string;
  
  isEditable: boolean;
  onUpdate: (section: string, field: string, value: any) => void;
}

const CombinedStrategySection: React.FC<CombinedStrategySectionProps> = ({
  contentStrategy,
  competitiveAdvantages,
  contentCalendarSuggestions,
  aiGenerationTips,
  stylePatterns,
  styleConsistency,
  uniqueElements,
  domainName,
  isEditable,
  onUpdate
}) => {
  const theme = useTheme();
  const [activeTab, setActiveTab] = useState(0);

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
  };

  // style_patterns from the API is a wrapper object { patterns, style_consistency, unique_elements }.
  // StyleAnalysisSection expects the inner `patterns` map for its table, with consistency/uniqueElements passed separately.
  const stylePatternsInner =
    stylePatterns && typeof stylePatterns === 'object' && !Array.isArray(stylePatterns) && 'patterns' in stylePatterns
      ? (stylePatterns as any).patterns
      : stylePatterns;

  return (
    <Paper 
      elevation={0} 
      sx={{ 
        mt: 4,
        mb: 4, 
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 2,
        overflow: 'hidden',
        bgcolor: 'white'
      }}
    >
      <Box sx={{ borderBottom: 1, borderColor: 'divider', bgcolor: 'grey.50' }}>
        <Tabs 
          value={activeTab} 
          onChange={handleTabChange} 
          variant="scrollable"
          scrollButtons="auto"
          aria-label="strategy and style tabs"
          sx={{
            '& .MuiTab-root': {
              textTransform: 'none',
              fontWeight: 600,
              minHeight: 64,
              color: 'text.secondary',
              '&.Mui-selected': {
                color: 'primary.main',
              }
            },
            '& .MuiTabs-indicator': {
              height: 3,
              borderRadius: '3px 3px 0 0'
            }
          }}
        >
          <Tab 
            icon={<TrendingUpIcon />} 
            iconPosition="start" 
            label="Strategic Action Plan" 
          />
          <Tab 
            icon={<PsychologyIcon />} 
            iconPosition="start" 
            label={`Style Analysis for ${domainName || 'Your Website'}`} 
          />
        </Tabs>
      </Box>

      <Box sx={{ p: 3, minHeight: 400 }}>
        {activeTab === 0 && (
          <Fade in timeout={500}>
            <Box>
              <StrategicInsightsSection 
                contentStrategy={contentStrategy}
                competitiveAdvantages={competitiveAdvantages}
                contentCalendarSuggestions={contentCalendarSuggestions}
                aiGenerationTips={aiGenerationTips}
                isEditable={isEditable}
                onUpdate={(field, value) => onUpdate('strategic_insights', field, value)}
                hideHeader={true}
              />
            </Box>
          </Fade>
        )}
        
        {activeTab === 1 && (
          <Fade in timeout={500}>
            <Box>
              <StyleAnalysisSection 
                patterns={stylePatternsInner}
                consistency={styleConsistency}
                uniqueElements={uniqueElements}
                domainName={domainName}
                isEditable={isEditable}
                onUpdate={onUpdate}
                hideHeader={true}
              />
            </Box>
          </Fade>
        )}
      </Box>
    </Paper>
  );
};

export default CombinedStrategySection;
