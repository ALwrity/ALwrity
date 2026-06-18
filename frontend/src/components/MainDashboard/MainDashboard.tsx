import React, { useState, useMemo, useCallback } from 'react';
import {
  Box,
  Container,
  Alert,
  Snackbar,
  useTheme
} from '@mui/material';
import Lightbulb from '@mui/icons-material/Lightbulb';
import Storage from '@mui/icons-material/Storage';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@clerk/clerk-react';
import AskAlwrityIcon from '../../assets/images/AskAlwrity-min.ico';
import { SubscriptionGuard } from '../SubscriptionGuard';
import { apiClient } from '../../api/client';

// Shared components
import DashboardHeader from '../shared/DashboardHeader';
import LoadingSkeleton from '../shared/LoadingSkeleton';
import ErrorDisplay from '../shared/ErrorDisplay';
import ContentLifecyclePillars from './ContentLifecyclePillars';
import DashboardOnboardingStatus from './DashboardOnboardingStatus';
import AnalyticsInsights from './components/AnalyticsInsights';
import ToolsModal from './components/ToolsModal';
import EnhancedBillingDashboard from '../billing/EnhancedBillingDashboard';
import CompactSidebar from './components/CompactSidebar';
import TeamHuddleWidget from './components/TeamHuddleWidget';
import ContentGuardianCard from './components/ContentGuardianCard';

// Shared types and utilities
import { Tool } from '../shared/types';
import { getToolsForCategory } from '../shared/utils';

// Zustand stores
import { useDashboardStore } from '../../stores/dashboardStore';
import { useWorkflowStore } from '../../stores/workflowStore';

// Data
import { toolCategories } from '../../data/toolCategories';

// Main dashboard component
const MainDashboard: React.FC = () => {
  const theme = useTheme();
  const navigate = useNavigate();
  
  // Sidebar state
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);
  
  // Zustand store hooks
  const {
    loading,
    error,
    searchQuery,
    selectedCategory,
    selectedSubCategory,
    favorites,
    snackbar,
    toggleFavorite,
    setSearchQuery,
    setSelectedCategory,
    setSelectedSubCategory,
    showSnackbar,
    hideSnackbar,
  } = useDashboardStore();

  // Workflow store hooks
  const {
    currentWorkflow,
    workflowProgress,
    scheduleStatus,
    isLoading: workflowLoading,
    loadTodayWorkflow,
    generateDailyWorkflow,
    startWorkflow,
    pauseWorkflow,
    stopWorkflow
  } = useWorkflowStore();
  const { userId } = useAuth();

  React.useEffect(() => {
    const initializeWorkflow = async () => {
      try {
        if (!userId) return;
        await loadTodayWorkflow();
      } catch (error) {
        console.warn('Failed to load today workflow:', error);
      }
    };

    initializeWorkflow();
  }, [loadTodayWorkflow, userId]);

  // Debug logging for workflow state (only in development)
  React.useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      console.log('Workflow Debug:', {
        currentWorkflow,
        workflowProgress,
        isWorkflowActive: currentWorkflow?.workflowStatus === 'in_progress',
        workflowStatus: currentWorkflow?.workflowStatus,
        hasWorkflow: !!currentWorkflow
      });
    }
  }, [currentWorkflow, workflowProgress]);

  // SIF indexing health state
  const [sifHealth, setSifHealth] = React.useState<{
    has_task: boolean;
    status: string;
    task?: {
      raw_status: string;
      next_execution: string | null;
      last_success: string | null;
      last_failure: string | null;
      consecutive_failures: number;
    };
    last_run?: {
      status: string | null;
      time: string | null;
      error_message: string | null;
    };
    message?: string;
  } | null>(null);

  // Fetch SIF indexing health on mount and every 60s
  React.useEffect(() => {
    const fetchSifHealth = async () => {
      try {
        const resp = await apiClient.get('/api/seo-dashboard/sif-health');
        setSifHealth(resp.data);
      } catch {
        setSifHealth(null);
      }
    };
    fetchSifHealth();
    const interval = setInterval(fetchSifHealth, 60_000);
    return () => clearInterval(interval);
  }, []);

  // Onboarding background tasks status
  const [onboardingTasks, setOnboardingTasks] = React.useState<{
    tasks: Record<string, { status: string; started_at: string | null; progress_pct: number }>;
    total: number;
    completed_count: number;
    failed_count: number;
    all_done: boolean;
  } | null>(null);
  const [showOnboardingStatus, setShowOnboardingStatus] = React.useState(true);

  React.useEffect(() => {
    const fetchOnboardingTasks = async () => {
      try {
        const res = await apiClient.get('/api/onboarding/tasks/status');
        if (res.data.tasks) {
          setOnboardingTasks(res.data);
          if (res.data.all_done) return;
        }
      } catch {
        setOnboardingTasks(null);
      }
    };
    fetchOnboardingTasks();
    const interval = setInterval(fetchOnboardingTasks, 60000);
    return () => clearInterval(interval);
  }, []);

  // State to track if we need to start a newly generated workflow
  const [shouldStartWorkflow, setShouldStartWorkflow] = React.useState(false);

  // Tools Modal state
  const [toolsModalOpen, setToolsModalOpen] = React.useState(false);
  const [modalCategoryName, setModalCategoryName] = React.useState<string | null>(null);
  const [modalCategory, setModalCategory] = React.useState<any>(null);
  const [searchResults, setSearchResults] = React.useState<Tool[]>([]);

  // Handle workflow start
  const handleStartWorkflow = async () => {
    try {
      if (currentWorkflow) {
        await startWorkflow(currentWorkflow.id);
      } else {
        // Generate workflow first, then mark that we should start it
        await generateDailyWorkflow(userId || 'demo-user');
        setShouldStartWorkflow(true);
      }
    } catch (error) {
      console.error('Failed to start workflow:', error);
    }
  };

  // Auto-start workflow after generation
  React.useEffect(() => {
    if (shouldStartWorkflow && currentWorkflow && currentWorkflow.workflowStatus === 'not_started') {
      const startGeneratedWorkflow = async () => {
        try {
          await startWorkflow(currentWorkflow.id);
          setShouldStartWorkflow(false);
        } catch (error) {
          console.error('Failed to start generated workflow:', error);
          setShouldStartWorkflow(false);
        }
      };
      startGeneratedWorkflow();
    }
  }, [shouldStartWorkflow, currentWorkflow, startWorkflow]);

  // Handle workflow pause
  const handlePauseWorkflow = async () => {
    if (currentWorkflow) {
      try {
        await pauseWorkflow(currentWorkflow.id);
      } catch (error) {
        console.error('Failed to pause workflow:', error);
      }
    }
  };

  // Handle workflow stop
  const handleStopWorkflow = async () => {
    if (currentWorkflow) {
      try {
        await stopWorkflow(currentWorkflow.id);
      } catch (error) {
        console.error('Failed to stop workflow:', error);
      }
    }
  };

  // Resume Plan modal from header In-Progress button
  const handleResumePlanModal = () => {
    // Programmatically click the Plan pillar Today chip
    const planChip = document.querySelector('[data-pillar-id="plan"]');
    if (planChip) {
      (planChip as HTMLElement).click();
    }
  };

  const handleToolClick = useCallback((tool: Tool) => {
    if (process.env.NODE_ENV === 'development') {
      console.log('Navigating to tool:', tool.path);
    }
    if (tool.path) {
      navigate(tool.path);
      return;
    }
    showSnackbar(`Launching ${tool.name}...`, 'info');
  }, [navigate, showSnackbar]);

  // Handle category click to open modal
  const handleCategoryClick = useCallback((categoryName: string | null, categoryData?: any) => {
    setModalCategoryName(categoryName);
    setModalCategory(categoryData);
    setToolsModalOpen(true);
  }, []);

  // Memoize search results computation
  const searchResultsMemo = useMemo(() => {
    if (!searchQuery || searchQuery.length < 2) return [];
    
    // Get all tools from all categories that match search
    const allTools: Tool[] = [];
    Object.values(toolCategories).forEach(category => {
      if (category) {
        const tools = getToolsForCategory(category, null);
        allTools.push(...tools);
      }
    });
    
    const queryLower = searchQuery.toLowerCase();
    return allTools.filter(tool => 
      tool.name.toLowerCase().includes(queryLower) ||
      tool.description.toLowerCase().includes(queryLower) ||
      tool.features.some(feature => feature.toLowerCase().includes(queryLower))
    );
  }, [searchQuery]);

  // Handle search to show results in modal with debouncing
  React.useEffect(() => {
    if (searchQuery && searchQuery.length >= 2) {
      const timeoutId = setTimeout(() => {
        setSearchResults(searchResultsMemo);
        setModalCategoryName(null);
        setModalCategory(null);
        setToolsModalOpen(true);
      }, 500); // 500ms delay

      return () => clearTimeout(timeoutId);
    } else if (searchQuery && searchQuery.length < 2) {
      // Close modal if search query is too short
      setToolsModalOpen(false);
    }
  }, [searchQuery, searchResultsMemo]);

  // Close modal and clear search
  const handleCloseModal = useCallback(() => {
    setToolsModalOpen(false);
    setModalCategoryName(null);
    setModalCategory(null);
    setSearchResults([]);
    if (searchQuery) {
      setSearchQuery('');
    }
  }, [searchQuery, setSearchQuery]);

  // Note: filteredCategories removed as it's not used in the current implementation

  const statusChips = React.useMemo(() => {
    const scheduled = !!scheduleStatus?.scheduled_run_completed;
    const chips = [
      {
        label: scheduled ? 'Scheduled workflow ready' : 'Scheduled workflow pending',
        color: scheduled ? '#22c55e' : '#ef4444',
        icon: <Lightbulb sx={{ color: scheduled ? '#22c55e' : '#ef4444' }} />,
      },
    ];

    if (sifHealth) {
      if (!sifHealth.has_task) {
        chips.push({
          label: 'SIF Index: not scheduled',
          color: '#9e9e9e',
          icon: <Storage sx={{ color: '#9e9e9e' }} />,
        });
      } else {
        const failures = sifHealth.task?.consecutive_failures || 0;
        const lastRunStatus = sifHealth.last_run?.status;
        let label: string;
        let color: string;
        if (sifHealth.status === 'healthy') {
          label = `SIF Index: active${lastRunStatus === 'success' ? '' : ' (pending)'}`;
          color = '#22c55e';
        } else if (sifHealth.status === 'warning') {
          label = `SIF Index: ${failures} failure${failures > 1 ? 's' : ''}`;
          color = '#f59e0b';
        } else {
          label = 'SIF Index: needs attention';
          color = '#ef4444';
        }
        chips.push({
          label,
          color,
          icon: <Storage sx={{ color }} />,
        });
      }
    }

    return chips;
  }, [scheduleStatus, sifHealth]);

  if (loading) {
    return <LoadingSkeleton />;
  }

  if (error) {
    return <ErrorDisplay error={error} />;
  }

  return (
    <Box
      sx={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 50%, #f093fb 100%)',
        padding: theme.spacing(4),
        position: 'relative',
        overflow: 'hidden', // Prevent layout shifts from pseudo-elements
        '&::before': {
          content: '""',
          position: 'fixed', // Changed from absolute to fixed to prevent layout shifts
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'url("data:image/svg+xml,%3Csvg width="80" height="80" viewBox="0 0 80 80" xmlns="http://www.w3.org/2000/svg"%3E%3Cg fill="none" fill-rule="evenodd"%3E%3Cg fill="%23ffffff" fill-opacity="0.03"%3E%3Ccircle cx="40" cy="40" r="3"/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")',
          pointerEvents: 'none',
          willChange: 'transform', // Optimize for animations
        },
        '&::after': {
          content: '""',
          position: 'fixed', // Changed from absolute to fixed to prevent layout shifts
          top: '50%',
          left: '50%',
          width: '600px',
          height: '600px',
          background: 'radial-gradient(circle, rgba(255,255,255,0.1) 0%, transparent 70%)',
          transform: 'translate(-50%, -50%)',
          pointerEvents: 'none',
          zIndex: 0,
          willChange: 'transform', // Optimize for animations
        },
      }}
    >
      <Container 
        maxWidth="xl" 
        sx={{ 
          position: 'relative', 
          zIndex: 1,
        }}
      >
        <AnimatePresence>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            {/* Dashboard Header */}
            <DashboardHeader
              title="Alwrity Content Hub"
              subtitle=""
              statusChips={statusChips}
              customIcon={AskAlwrityIcon}
              workflowControls={{
                onStartWorkflow: handleStartWorkflow,
                onPauseWorkflow: handlePauseWorkflow,
                onStopWorkflow: handleStopWorkflow,
                onResumePlanModal: handleResumePlanModal,
                isWorkflowActive: currentWorkflow?.workflowStatus === 'in_progress',
                completedTasks: workflowProgress?.completedTasks || 0,
                totalTasks: workflowProgress?.totalTasks || 0,
                isLoading: workflowLoading
              }}
            />


            {/* Onboarding status card — outside SubscriptionGuard so all users see scheduling progress */}
            {showOnboardingStatus && onboardingTasks && !onboardingTasks.all_done && (
              <DashboardOnboardingStatus
                {...onboardingTasks}
                onDismiss={() => setShowOnboardingStatus(false)}
              />
            )}

            {/* Subscription Guard - Protect main dashboard content */}
            <SubscriptionGuard
              fallbackMessage="Your subscription is not active. Please upgrade to access the dashboard features."
              showUpgradeButton={true}
            >
              {/* Content Lifecycle Pillars - First Panel */}
              <ContentLifecyclePillars />

            {/* Side-by-side layout for Areas 2 and 3 */}
            <Box sx={{ display: 'flex', gap: 3, mt: 3 }}>
              {/* Area 2: Search Tools Sidebar */}
              <Box sx={{ 
                width: sidebarCollapsed ? 60 : 280,
                transition: 'width 0.3s ease-in-out',
                flexShrink: 0
              }}>
                <CompactSidebar
                  searchQuery={searchQuery}
                  onSearchChange={setSearchQuery}
                  onClearSearch={() => setSearchQuery('')}
                  selectedCategory={selectedCategory}
                  onCategoryChange={setSelectedCategory}
                  selectedSubCategory={selectedSubCategory}
                  onSubCategoryChange={setSelectedSubCategory}
                  toolCategories={toolCategories}
                  onCategoryClick={handleCategoryClick}
                  collapsed={sidebarCollapsed}
                  onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
                  theme={theme}
                  favorites={favorites}
                  onToolClick={handleToolClick}
                />
              </Box>

              {/* Area 3: Analytics and Billing */}
              <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
                {/* Team Huddle Widget - New Addition */}
                <TeamHuddleWidget />

                {/* Content Guardian Audit Card */}
                <ContentGuardianCard />

                {/* Analytics Insights - Good/Bad/Ugly */}
                <AnalyticsInsights />

                {/* Billing & Usage Dashboard */}
                <EnhancedBillingDashboard terminalTheme={true} />
              </Box>
            </Box>

            {/* Tools Modal */}
            <ToolsModal
              open={toolsModalOpen}
              onClose={handleCloseModal}
              categoryName={modalCategoryName || undefined}
              category={modalCategory}
              searchQuery={searchQuery}
              searchResults={searchResults}
              onToolClick={handleToolClick}
              favorites={favorites}
              onToggleFavorite={toggleFavorite}
            />
            </SubscriptionGuard>
          </motion.div>
        </AnimatePresence>

        {/* Enhanced Snackbar for notifications */}
        <Snackbar
          open={snackbar.open}
          autoHideDuration={3000}
          onClose={hideSnackbar}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        >
          <Alert onClose={hideSnackbar} severity={snackbar.severity} sx={{ width: '100%' }}>
            {snackbar.message}
          </Alert>
        </Snackbar>
      </Container>
    </Box>
  );
};

export default MainDashboard; 
