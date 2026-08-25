import React, { useState } from 'react';
import {
  Box,
  Tabs,
  Tab,
  Paper,
  Fade,
  useTheme
} from '@mui/material';
import AnalyticsIcon from '@mui/icons-material/Analytics';
import GroupIcon from '@mui/icons-material/Group';
import CategoryIcon from '@mui/icons-material/Category';
import BusinessIcon from '@mui/icons-material/Business';
import LightbulbIcon from '@mui/icons-material/Lightbulb';

import {
  ContentCharacteristicsSection,
  TargetAudienceAnalysisSection,
  ContentTypeAnalysisSection,
  BrandAnalysisSection,
  ContentStrategyInsightsSection
} from './index';

// Define Props Interface
interface CombinedAnalysisSectionProps {
  contentCharacteristics?: any;
  targetAudience?: any;
  contentType?: any;
  brandAnalysis?: any;
  contentStrategyInsights?: any;
  isEditable: boolean;
  onUpdate: (section: string, field: string, value: any) => void;
}

const CombinedAnalysisSection: React.FC<CombinedAnalysisSectionProps> = ({
  contentCharacteristics,
  targetAudience,
  contentType,
  brandAnalysis,
  contentStrategyInsights,
  isEditable,
  onUpdate
}) => {
  const theme = useTheme();
  const [activeTab, setActiveTab] = useState(0);

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
  };

  return (
    <Paper 
      elevation={0} 
      sx={{ 
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
          aria-label="analysis sections tabs"
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
            icon={<AnalyticsIcon />} 
            iconPosition="start" 
            label="Characteristics" 
          />
          <Tab 
            icon={<GroupIcon />} 
            iconPosition="start" 
            label="Audience" 
          />
          <Tab 
            icon={<CategoryIcon />} 
            iconPosition="start" 
            label="Content Type" 
          />
          <Tab 
            icon={<BusinessIcon />} 
            iconPosition="start" 
            label="Brand Identity" 
          />
          <Tab 
            icon={<LightbulbIcon />} 
            iconPosition="start" 
            label="Strategy Insights" 
          />
        </Tabs>
      </Box>

      <Box sx={{ p: 3, minHeight: 400 }}>
        {activeTab === 0 && (
          <Fade in timeout={500}>
            <Box>
              {contentCharacteristics ? (
                <ContentCharacteristicsSection 
                  contentCharacteristics={contentCharacteristics}
                  isEditable={isEditable}
                  onUpdate={(field, value) => onUpdate('content_characteristics', field, value)}
                  hideHeader={true}
                />
              ) : (
                <Box sx={{ p: 3, textAlign: 'center', color: 'text.secondary' }}>
                  No content characteristics data available.
                </Box>
              )}
            </Box>
          </Fade>
        )}
        
        {activeTab === 1 && (
          <Fade in timeout={500}>
            <Box>
              {targetAudience ? (
                <TargetAudienceAnalysisSection 
                  targetAudience={targetAudience}
                  isEditable={isEditable}
                  onUpdate={(field, value) => onUpdate('target_audience', field, value)}
                  hideHeader={true}
                />
              ) : (
                <Box sx={{ p: 3, textAlign: 'center', color: 'text.secondary' }}>
                  No target audience data available.
                </Box>
              )}
            </Box>
          </Fade>
        )}

        {activeTab === 2 && (
          <Fade in timeout={500}>
            <Box>
              {contentType ? (
                <ContentTypeAnalysisSection 
                  contentType={contentType}
                  isEditable={isEditable}
                  onUpdate={(field, value) => onUpdate('content_type', field, value)}
                  hideHeader={true}
                />
              ) : (
                <Box sx={{ p: 3, textAlign: 'center', color: 'text.secondary' }}>
                  No content type data available.
                </Box>
              )}
            </Box>
          </Fade>
        )}

        {activeTab === 3 && (
          <Fade in timeout={500}>
            <Box>
              {brandAnalysis ? (
                <BrandAnalysisSection 
                  brandAnalysis={brandAnalysis}
                  isEditable={isEditable}
                  onUpdate={(field, value) => onUpdate('brand_analysis', field, value)}
                  hideHeader={true}
                />
              ) : (
                <Box sx={{ p: 3, textAlign: 'center', color: 'text.secondary' }}>
                  No brand analysis data available.
                </Box>
              )}
            </Box>
          </Fade>
        )}

        {activeTab === 4 && (
          <Fade in timeout={500}>
            <Box>
              {contentStrategyInsights ? (
                <ContentStrategyInsightsSection 
                  insights={contentStrategyInsights}
                  isEditable={isEditable}
                  onUpdate={(field, value) => onUpdate('content_strategy_insights', field, value)}
                  hideHeader={true}
                />
              ) : (
                <Box sx={{ p: 3, textAlign: 'center', color: 'text.secondary' }}>
                  No content strategy insights available.
                </Box>
              )}
            </Box>
          </Fade>
        )}
      </Box>
    </Paper>
  );
};

export default CombinedAnalysisSection;
