import React, { useMemo, useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Tab,
  Tabs,
  Typography,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import LightbulbOutlinedIcon from '@mui/icons-material/LightbulbOutlined';
import SettingsIcon from '@mui/icons-material/Settings';
import GridViewIcon from '@mui/icons-material/GridView';
import AccountTreeIcon from '@mui/icons-material/AccountTree';
import InsightsIcon from '@mui/icons-material/Insights';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import StorageIcon from '@mui/icons-material/Storage';
import { CompetitorsGrid } from '../WebsiteStep/components';
import { SifIndexingPanel } from '../common/SifIndexingPanel';
import { ContentPillarsSection } from './ContentPillarsSection';
import { BenchmarkInsightsSection } from './BenchmarkInsightsSection';
import { StrategicInsightsSection } from './StrategicInsightsSection';
import { ResearchStepVerticalSubTabs } from './ResearchStepVerticalSubTabs';
import { ResearchStepBackgroundSetupPanel } from './ResearchStepBackgroundSetupPanel';
import { useResearchStepBackgroundSetup } from './useResearchStepBackgroundSetup';
import { getBackgroundSetupTaskSummaryLines } from './researchStepBackgroundSetupConstants';
import type { ResearchStepDashboardProps } from './researchStepDashboardTypes';
import {
  folderTabCardSx,
  folderTabDashboardSpacingSx,
  folderTabHeaderSx,
  folderTabsContainerSx,
  getFolderTabSx,
} from '../WebsiteStep/components/unifiedFolderTabStyles';

const MAIN_TABS = [
  {
    id: 'intelligence',
    title: 'Competitive Intelligence',
    caption: 'Who you compete with and how your content compares',
    icon: SearchIcon,
    color: '#7C3AED',
  },
  {
    id: 'opportunities',
    title: 'Strategic Opportunities',
    caption: 'Action plans, deeper insights, and site indexing status',
    icon: LightbulbOutlinedIcon,
    color: '#F59E0B',
  },
  {
    id: 'automation',
    title: 'Smart Background Setup',
    caption: '',
    icon: SettingsIcon,
    color: '#2563EB',
  },
] as const;

type MainTabId = (typeof MAIN_TABS)[number]['id'];

const INTELLIGENCE_SUBTABS = [
  { id: 'competitors', label: 'Discovered Competitors', icon: <GridViewIcon fontSize="small" /> },
  { id: 'pillars', label: 'Content Pillars', icon: <AccountTreeIcon fontSize="small" /> },
  { id: 'benchmark', label: 'Benchmark Insights', icon: <InsightsIcon fontSize="small" /> },
];

const OPPORTUNITIES_SUBTABS = [
  { id: 'strategic', label: 'Strategic Content Opportunities', icon: <TrendingUpIcon fontSize="small" /> },
  { id: 'sif', label: 'SIF Indexing', icon: <StorageIcon fontSize="small" /> },
];

export const ResearchStepUnifiedDashboard: React.FC<ResearchStepDashboardProps> = (props) => {
  const {
    competitors,
    contentPillars,
    isLoadingPillars,
    pillarsError,
    benchmarkReport,
    isRunningBenchmark,
    sitemapAnalysis,
    isAnalyzingSitemap,
    onShowHighlights,
    onRemoveCompetitor,
    onAddCompetitor,
    onRefreshPillars,
    onRunBenchmark,
    onRefreshStrategy,
    onShowBenchmarks,
    onShowStrategy,
    onShowPublishing,
    onShowStructure,
  } = props;

  const [activeMainTab, setActiveMainTab] = useState<MainTabId>('intelligence');
  const [intelligenceSubTab, setIntelligenceSubTab] = useState('competitors');
  const [opportunitiesSubTab, setOpportunitiesSubTab] = useState('strategic');
  const backgroundSetup = useResearchStepBackgroundSetup(true);

  const automationTabSummary = getBackgroundSetupTaskSummaryLines(backgroundSetup.prefs);

  const mainTabIndex = useMemo(
    () => MAIN_TABS.findIndex((t) => t.id === activeMainTab),
    [activeMainTab]
  );

  const renderIntelligenceContent = () => {
    switch (intelligenceSubTab) {
      case 'competitors':
        return (
          <CompetitorsGrid
            competitors={competitors}
            onShowHighlights={onShowHighlights}
            onRemoveCompetitor={onRemoveCompetitor}
            onAddCompetitor={onAddCompetitor}
          />
        );
      case 'pillars':
        return (
          <ContentPillarsSection
            data={contentPillars}
            isLoading={isLoadingPillars}
            error={pillarsError}
            onRefresh={onRefreshPillars}
          />
        );
      case 'benchmark':
        return (
          <BenchmarkInsightsSection
            report={benchmarkReport}
            onRefresh={onRunBenchmark}
            isRefreshing={isRunningBenchmark}
          />
        );
      default:
        return null;
    }
  };

  const renderOpportunitiesContent = () => {
    if (opportunitiesSubTab === 'sif') {
      return <SifIndexingPanel />;
    }

    if (competitors.length === 0) {
      return (
        <Box sx={{ p: { xs: 2, md: 3 }, textAlign: 'center' }}>
          <Typography variant="body1" color="text.secondary">
            Discover competitors first to unlock strategic content opportunities.
          </Typography>
        </Box>
      );
    }

    return (
      <StrategicInsightsSection
        sitemapAnalysis={sitemapAnalysis}
        isAnalyzingSitemap={isAnalyzingSitemap}
        onRefreshStrategy={onRefreshStrategy}
        onShowBenchmarks={onShowBenchmarks}
        onShowStrategy={onShowStrategy}
        onShowPublishing={onShowPublishing}
        onShowStructure={onShowStructure}
      />
    );
  };

  const renderMainContent = () => {
    if (activeMainTab === 'intelligence') {
      return (
        <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, minHeight: 320 }}>
          <ResearchStepVerticalSubTabs
            items={INTELLIGENCE_SUBTABS}
            activeId={intelligenceSubTab}
            onChange={setIntelligenceSubTab}
          />
          <Box sx={{ flex: 1, p: { xs: 2, md: 3 }, minWidth: 0, animation: 'fadeIn 0.3s ease-in' }}>
            {renderIntelligenceContent()}
          </Box>
        </Box>
      );
    }

    if (activeMainTab === 'opportunities') {
      return (
        <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, minHeight: 320 }}>
          <ResearchStepVerticalSubTabs
            items={OPPORTUNITIES_SUBTABS}
            activeId={opportunitiesSubTab}
            onChange={setOpportunitiesSubTab}
          />
          <Box sx={{ flex: 1, p: { xs: 0, md: 0 }, minWidth: 0, animation: 'fadeIn 0.3s ease-in' }}>
            {renderOpportunitiesContent()}
          </Box>
        </Box>
      );
    }

    return (
      <ResearchStepBackgroundSetupPanel active setup={backgroundSetup} />
    );
  };

  return (
    <Box
      data-testid="research-unified-dashboard"
      sx={{ ...folderTabDashboardSpacingSx(false) }}
    >
      <Card elevation={0} sx={folderTabCardSx}>
        <Box sx={folderTabHeaderSx}>
          <Tabs
            value={mainTabIndex}
            onChange={(_, idx) => setActiveMainTab(MAIN_TABS[idx].id)}
            variant="fullWidth"
            sx={folderTabsContainerSx}
          >
            {MAIN_TABS.map((tab, index) => {
              const Icon = tab.icon;
              const isActive = activeMainTab === tab.id;
              return (
                <Tab
                  key={tab.id}
                  value={index}
                  label={
                    <Box
                      sx={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 0.5,
                        textAlign: 'center',
                        py: 0.5,
                      }}
                    >
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Icon sx={{ color: isActive ? tab.color : '#64748B', fontSize: 20 }} />
                        <Typography
                          variant="subtitle1"
                          sx={{
                            fontWeight: 700,
                            color: isActive ? '#1E293B' : '#475569',
                            lineHeight: 1.2,
                            textTransform: 'none',
                          }}
                        >
                          {tab.title}
                        </Typography>
                      </Box>
                      {tab.id === 'automation' ? (
                        <Box
                          sx={{
                            display: { xs: 'none', md: 'flex' },
                            flexDirection: 'column',
                            gap: 0.25,
                            maxWidth: 360,
                          }}
                        >
                          <Typography
                            variant="caption"
                            sx={{ color: '#64748B', textTransform: 'none', lineHeight: 1.35 }}
                          >
                            {automationTabSummary.line1}
                          </Typography>
                          {automationTabSummary.line2 && (
                            <Typography
                              variant="caption"
                              sx={{ color: '#64748B', textTransform: 'none', lineHeight: 1.35 }}
                            >
                              {automationTabSummary.line2}
                            </Typography>
                          )}
                        </Box>
                      ) : (
                        <Typography
                          variant="caption"
                          sx={{
                            color: '#64748B',
                            textTransform: 'none',
                            display: { xs: 'none', md: 'block' },
                          }}
                        >
                          {tab.caption}
                        </Typography>
                      )}
                    </Box>
                  }
                  sx={getFolderTabSx(isActive, index, MAIN_TABS.length)}
                />
              );
            })}
          </Tabs>
        </Box>

        <CardContent sx={{ p: 0 }}>{renderMainContent()}</CardContent>
      </Card>
    </Box>
  );
};
