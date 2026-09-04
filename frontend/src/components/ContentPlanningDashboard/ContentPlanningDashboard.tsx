import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import {
  Box,
  Tabs,
  Tab,
  Typography,
  Container,
  AppBar,
  Toolbar,
  IconButton,
  Alert,
  Drawer,
  Button,
  Badge,
  ThemeProvider,
  createTheme
} from '@mui/material';
import StrategyIcon from '@mui/icons-material/Psychology';
import CalendarIcon from '@mui/icons-material/CalendarToday';
import AnalyticsIcon from '@mui/icons-material/Analytics';
import SearchIcon from '@mui/icons-material/Search';
import AIInsightsIcon from '@mui/icons-material/Lightbulb';
import CloseIcon from '@mui/icons-material/Close';
import CreateIcon from '@mui/icons-material/Add';
import { motion, AnimatePresence } from 'framer-motion';
import ContentStrategyTab from './tabs/ContentStrategyTab';
import CalendarTab from './tabs/CalendarTab';
import AnalyticsTab from './tabs/AnalyticsTab';
import GapAnalysisTab from './tabs/GapAnalysisTab';
import CreateTab from './tabs/CreateTab';
import AIInsightsPanel from './components/AIInsightsPanel';
import SystemStatusIndicator from './components/SystemStatusIndicator';
import ProgressIndicator from './components/ProgressIndicator';
import { useContentPlanningStore } from '../../stores/contentPlanningStore';
import { 
  contentPlanningOrchestrator, 
  DashboardData 
} from '../../services/contentPlanningOrchestrator';
import { StrategyCalendarProvider } from '../../contexts/StrategyCalendarContext';

// CopilotKit actions will be initialized in a separate component

// Scoped light theme for Content Planning - matches ENHANCED_STYLES
const contentPlanningTheme = createTheme({
  palette: {
    mode: 'light',  // Light theme for content-planning
    primary: {
      main: '#667eea',  // Matches ENHANCED_STYLES gradient start
      light: '#a78bfa',
      dark: '#4f46e5',
      contrastText: '#ffffff',
    },
    secondary: {
      main: '#764ba2',  // Matches ENHANCED_STYLES gradient end
      light: '#a78bfa',
      dark: '#5a3d7f',
      contrastText: '#ffffff',
    },
    background: {
      default: '#f5f7fa',  // Light background (matches common light theme)
      paper: '#ffffff',    // White cards (matches ENHANCED_STYLES.card)
    },
    text: {
      primary: '#2c3e50',  // Dark text for headers (matches ENHANCED_STYLES.sectionHeader)
      secondary: '#555',   // Medium gray for secondary text (matches ENHANCED_STYLES.formControl)
    },
    divider: 'rgba(0, 0, 0, 0.1)',  // Light divider (matches ENHANCED_STYLES.card.border)
  },
  typography: {
    fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
    h4: {
      fontWeight: 700,
      letterSpacing: '-0.025em',
      color: '#2c3e50',
    },
    h5: {
      fontWeight: 600,
      letterSpacing: '-0.025em',
      color: '#2c3e50',
    },
    h6: {
      fontWeight: 600,
      letterSpacing: '-0.025em',
      color: '#2c3e50',
    },
    body1: {
      lineHeight: 1.6,
      color: '#333',
    },
    body2: {
      lineHeight: 1.6,
      color: '#555',
    },
  },
  shape: {
    borderRadius: 8,  // Matches ENHANCED_STYLES.card.borderRadius
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          fontWeight: 600,
          borderRadius: 8,
          padding: '10px 24px',
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          backgroundImage: 'none',
          backgroundColor: 'rgba(255, 255, 255, 0.95)',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.1)',
          border: '1px solid rgba(0, 0, 0, 0.1)',
          color: '#333',
        },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          '& .MuiInputLabel-root': {
            color: '#555',
            fontWeight: 500,
            '&.Mui-focused': {
              color: '#667eea',
            },
          },
          '& .MuiOutlinedInput-root': {
            borderRadius: 8,
            color: '#333',
            backgroundColor: 'rgba(255, 255, 255, 0.8)',
            '& fieldset': {
              borderColor: 'rgba(0, 0, 0, 0.2)',
              borderWidth: '2px',
            },
            '&:hover fieldset': {
              borderColor: 'rgba(102, 126, 234, 0.5)',
            },
            '&.Mui-focused fieldset': {
              borderColor: '#667eea',
              borderWidth: '2px',
            },
          },
        },
      },
    },
    MuiFormControl: {
      styleOverrides: {
        root: {
          '& .MuiInputLabel-root': {
            color: '#555',
            fontWeight: 500,
            '&.Mui-focused': {
              color: '#667eea',
            },
          },
          '& .MuiOutlinedInput-root': {
            color: '#333',
            backgroundColor: 'rgba(255, 255, 255, 0.8)',
            '& fieldset': {
              borderColor: 'rgba(0, 0, 0, 0.2)',
              borderWidth: '2px',
            },
            '&:hover fieldset': {
              borderColor: 'rgba(102, 126, 234, 0.5)',
            },
            '&.Mui-focused fieldset': {
              borderColor: '#667eea',
              borderWidth: '2px',
            },
          },
          '& .MuiSelect-icon': {
            color: '#555',
          },
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          backgroundColor: '#ffffff',
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundColor: '#ffffff',
          color: '#2c3e50',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
        },
      },
    },
    MuiTabs: {
      styleOverrides: {
        root: {
          '& .MuiTab-root': {
            color: '#555',
            '&.Mui-selected': {
              color: '#667eea',
            },
          },
          '& .MuiTabs-indicator': {
            backgroundColor: '#667eea',
          },
        },
      },
    },
    MuiCheckbox: {
      styleOverrides: {
        root: {
          color: '#b0b0b0',
          '&.Mui-checked': {
            color: '#667eea',
          },
        },
      },
    },
  },
});

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
      id={`content-planning-tabpanel-${index}`}
      aria-labelledby={`content-planning-tab-${index}`}
      {...other}
    >
      {value === index && (
        <Box sx={{ p: 3 }}>
          {children}
        </Box>
      )}
    </div>
  );
}

function a11yProps(index: number) {
  return {
    id: `content-planning-tab-${index}`,
    'aria-controls': `content-planning-tabpanel-${index}`,
  };
}

const ContentPlanningDashboard: React.FC = () => {
  const location = useLocation();
  const [activeTab, setActiveTab] = useState(0);
  const [dashboardData, setDashboardData] = useState<DashboardData>({
    strategies: [],
    gapAnalyses: [],
    aiInsights: [],
    aiRecommendations: [],
    calendarEvents: [],
    healthStatus: {
      backend: false,
      database: false,
      aiServices: false
    }
  });
  const [progressExpanded, setProgressExpanded] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [aiInsightsDrawerOpen, setAiInsightsDrawerOpen] = useState(false);

  const { 
    updateStrategies,
    updateCalendarEvents,
    updateGapAnalyses,
    updateAIInsights
  } = useContentPlanningStore();

  // CopilotKit actions will be initialized in a separate component
  // that's rendered inside the CopilotSidebar context

  // Initialize orchestrator callbacks
  useEffect(() => {
    contentPlanningOrchestrator.setDataUpdateCallback((data) => {
      setDashboardData(prev => ({ ...prev, ...data }));
      
      // Update store with new data
      if (data.strategies) updateStrategies(data.strategies);
      if (data.calendarEvents) updateCalendarEvents(data.calendarEvents);
      if (data.gapAnalyses) updateGapAnalyses(data.gapAnalyses);
      if (data.aiInsights || data.aiRecommendations) {
        updateAIInsights({
          insights: data.aiInsights || [],
          recommendations: data.aiRecommendations || []
        });
      }
    });
  }, [updateStrategies, updateCalendarEvents, updateGapAnalyses, updateAIInsights]);

  // Handle navigation state for active tab
  useEffect(() => {
    if (location.state?.activeTab !== undefined) {
      setActiveTab(location.state.activeTab);
    }
  }, [location.state]);

  // Load dashboard data using orchestrator
  // Note: ProtectedRoute ensures user is authenticated before this component renders
  useEffect(() => {
    let cleanup: (() => void) | undefined;
    
    const loadDashboardData = async () => {
      setLoading(true);
      setError(null);
      
      try {
        const result = await contentPlanningOrchestrator.loadDashboardData();
        cleanup = result.cleanup;
        setLoading(false);
      } catch (error: any) {
        console.error('Error loading dashboard data:', error);
        setError(error.message || 'Failed to load dashboard data');
        setLoading(false);
      }
    };

    // Wrap in try-catch to handle any unexpected errors
    try {
      loadDashboardData();
    } catch (error: any) {
      console.error('Unexpected error in dashboard:', error);
      setError('An unexpected error occurred while loading the dashboard');
      setLoading(false);
    }

    // Cleanup on unmount: close all SSE connections
    return () => {
      if (cleanup) {
        cleanup();
      }
    };
  }, []);

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
  };

  const tabs = [
    { label: 'CONTENT STRATEGY', icon: <StrategyIcon />, component: <ContentStrategyTab /> },
    { label: 'CALENDAR', icon: <CalendarIcon />, component: <CalendarTab /> },
    { label: 'ANALYTICS', icon: <AnalyticsIcon />, component: <AnalyticsTab /> },
    { label: 'GAP ANALYSIS', icon: <SearchIcon />, component: <GapAnalysisTab /> },
    { label: 'CREATE', icon: <CreateIcon />, component: <CreateTab /> }
  ];

  const totalAIItems = (dashboardData.aiInsights?.length || 0) + (dashboardData.aiRecommendations?.length || 0);

  return (
    <ThemeProvider theme={contentPlanningTheme}>
      <StrategyCalendarProvider>
        <Container maxWidth={false} sx={{ height: '100vh', p: 0, bgcolor: 'background.default' }}>
      <AppBar position="static" color="default" elevation={1}>
        <Toolbar>
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            Content Planning Dashboard
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <SystemStatusIndicator />
            
            {/* AI Insights Button with Badge */}
            <motion.div
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <Button
                variant="outlined"
                startIcon={<AIInsightsIcon />}
                onClick={() => setAiInsightsDrawerOpen(true)}
                sx={{
                  borderRadius: 2,
                  textTransform: 'none',
                  fontWeight: 600,
                  borderColor: 'primary.main',
                  color: 'primary.main',
                  '&:hover': {
                    borderColor: 'primary.dark',
                    backgroundColor: 'rgba(102, 126, 234, 0.08)'
                  }
                }}
              >
                <Badge badgeContent={totalAIItems} color="primary" sx={{ mr: 1 }}>
                  AI Insights
                </Badge>
              </Button>
            </motion.div>
          </Box>
        </Toolbar>
      </AppBar>

      {error && (
        <Alert severity="error" sx={{ m: 2 }}>
          {error}
        </Alert>
      )}

      {/* Progress Indicator */}
      {loading && (
        <Box sx={{ m: 2 }}>
          <ProgressIndicator
            expanded={progressExpanded}
            onToggleExpanded={() => setProgressExpanded(!progressExpanded)}
          />
        </Box>
      )}

      {/* Main Content */}
      <Box sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs
            value={activeTab}
            onChange={handleTabChange}
            aria-label="content planning tabs"
            sx={{
              '& .MuiTab-root': {
                textTransform: 'none',
                fontWeight: 600,
                minHeight: 64,
                fontSize: '0.875rem'
              }
            }}
          >
            {tabs.map((tab, index) => (
              <Tab
                key={index}
                label={
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    {tab.icon}
                    {tab.label}
                  </Box>
                }
                {...a11yProps(index)}
              />
            ))}
          </Tabs>
        </Box>

        <Box sx={{ flexGrow: 1, overflow: 'auto' }}>
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
            >
              {tabs.map((tab, index) => (
                <TabPanel key={index} value={activeTab} index={index}>
                  {tab.component}
                </TabPanel>
              ))}
            </motion.div>
          </AnimatePresence>
        </Box>
      </Box>

      {/* AI Insights Drawer */}
      <Drawer
        anchor="right"
        open={aiInsightsDrawerOpen}
        onClose={() => setAiInsightsDrawerOpen(false)}
        PaperProps={{
          sx: {
            width: { xs: '100%', sm: 400 },
            maxWidth: '100vw'
          }
        }}
      >
        <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="h6">AI Insights & Recommendations</Typography>
            <IconButton onClick={() => setAiInsightsDrawerOpen(false)}>
              <CloseIcon />
            </IconButton>
          </Box>
        </Box>
        <AIInsightsPanel />
      </Drawer>
        </Container>
      </StrategyCalendarProvider>
    </ThemeProvider>
  );
};

export default ContentPlanningDashboard; 