import React, { useState } from 'react';
import {
  Box,
  Tabs,
  Tab,
  Typography
} from '@mui/material';
import AnalyticsIcon from '@mui/icons-material/Analytics';
import TrendingIcon from '@mui/icons-material/TrendingUp';
import SearchIcon from '@mui/icons-material/Search';
import AssessmentIcon from '@mui/icons-material/Assessment';
import BarChartIcon from '@mui/icons-material/BarChart';
import PieChartIcon from '@mui/icons-material/PieChart';
import RefineAnalysisTab from './RefineAnalysisTab';
import ContentOptimizerTab from './ContentOptimizerTab';
import TrendingTopicsTab from './TrendingTopicsTab';
import KeywordResearchTab from './KeywordResearchTab';
import PerformanceAnalyticsTab from './PerformanceAnalyticsTab';
import ContentPillarsTab from './ContentPillarsTab';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`gap-analysis-tabpanel-${index}`}
      aria-labelledby={`gap-analysis-tab-${index}`}
      {...other}
    >
      {value === index && <Box>{children}</Box>}
    </div>
  );
}

const GapAnalysisTab: React.FC = () => {
  const [tabValue, setTabValue] = useState(0);

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>
        Gap Analysis & Optimization
      </Typography>

      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs value={tabValue} onChange={handleTabChange} aria-label="gap analysis tabs">
          <Tab label="Content Optimizer" icon={<AnalyticsIcon />} iconPosition="start" />
          <Tab label="Trending Topics" icon={<TrendingIcon />} iconPosition="start" />
          <Tab label="Keyword Research" icon={<SearchIcon />} iconPosition="start" />
          <Tab label="Performance Analytics" icon={<BarChartIcon />} iconPosition="start" />
          <Tab label="Content Pillars" icon={<PieChartIcon />} iconPosition="start" />
          <Tab label="Refine Analysis" icon={<AssessmentIcon />} iconPosition="start" />
        </Tabs>
      </Box>

      <TabPanel value={tabValue} index={0}>
        <ContentOptimizerTab />
      </TabPanel>

      <TabPanel value={tabValue} index={1}>
        <TrendingTopicsTab />
      </TabPanel>

      <TabPanel value={tabValue} index={2}>
        <KeywordResearchTab />
      </TabPanel>

      <TabPanel value={tabValue} index={3}>
        <PerformanceAnalyticsTab />
      </TabPanel>

      <TabPanel value={tabValue} index={4}>
        <ContentPillarsTab />
      </TabPanel>

      <TabPanel value={tabValue} index={5}>
        <RefineAnalysisTab />
      </TabPanel>
    </Box>
  );
};

export default GapAnalysisTab; 