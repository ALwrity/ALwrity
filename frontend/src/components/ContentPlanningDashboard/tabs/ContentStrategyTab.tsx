import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  Alert,
  CircularProgress
} from '@mui/material';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import EditIcon from '@mui/icons-material/Edit';
import { useLocation, useNavigate } from 'react-router-dom';
import { useContentPlanningStore } from '../../../stores/contentPlanningStore';
import { contentPlanningApi } from '../../../services/contentPlanningApi';
import StrategyIntelligenceTab from '../components/StrategyIntelligence/StrategyIntelligenceTab';
import StrategyOnboardingDialog from '../components/StrategyOnboardingDialog';
import { StrategyData } from '../components/StrategyIntelligence/types/strategy.types';
import { useUser } from '@clerk/clerk-react';

const ContentStrategyTab: React.FC = () => {
  const location = useLocation();
  // Resolve the active Clerk user so the read endpoints (getLatest,
  // getEnhancedStrategies) target the right tenant. The previous
  // `const userId = 1;` was a multi-tenant collision.
  const { user } = useUser();
  const navigate = useNavigate();
  
  // Use selective store subscriptions to prevent unnecessary re-renders
  const strategies = useContentPlanningStore(state => state.strategies);
  const currentStrategy = useContentPlanningStore(state => state.currentStrategy);
  const latestGeneratedStrategy = useContentPlanningStore(state => state.latestGeneratedStrategy);
  const error = useContentPlanningStore(state => state.error);
  const loadStrategies = useContentPlanningStore(state => state.loadStrategies);
  const setLatestGeneratedStrategy = useContentPlanningStore(state => state.setLatestGeneratedStrategy);

  // Real data states
  const [strategyData, setStrategyData] = useState<StrategyData | null>(null);
  const [strategyDataLoading, setStrategyDataLoading] = useState(false);
  const [strategyDataError, setStrategyDataError] = useState<string | null>(null);

  // Strategy status and onboarding
  const [strategyStatus, setStrategyStatus] = useState<'active' | 'inactive' | 'pending' | 'none'>('none');
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [hasCheckedStrategy, setHasCheckedStrategy] = useState(false);

  // Navigation state detection
  const [isFromStrategyBuilder, setIsFromStrategyBuilder] = useState(false);

  // Data is loaded by the dashboard orchestrator — no redundant fetching here.

  // Check if coming from strategy builder
  useEffect(() => {
    const locationState = location.state as any;
    const isFromBuilder = locationState?.fromStrategyBuilder || 
                         locationState?.activeTab === 0 || // Content Strategy tab
                         sessionStorage.getItem('fromStrategyBuilder') === 'true';
    
    console.log('🔍 ContentStrategyTab: Navigation state check:', {
      locationState,
      isFromBuilder,
      sessionStorage: sessionStorage.getItem('fromStrategyBuilder')
    });
    
    setIsFromStrategyBuilder(isFromBuilder);
    
    // Clear the session storage flag after reading it
    if (sessionStorage.getItem('fromStrategyBuilder') === 'true') {
      sessionStorage.removeItem('fromStrategyBuilder');
    }
    
    // Clear the cache when navigating away from strategy builder
    if (!isFromBuilder && latestGeneratedStrategy) {
      console.log('🧹 Clearing latest generated strategy cache (navigating away from strategy builder)');
      // Note: We don't clear the cache here as it might be needed for the current session
    }
  }, [location.state, latestGeneratedStrategy]);

  // Track strategy status changes for debugging (with debounce)
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      console.log('🔄 Strategy Status Changed:', {
        status: strategyStatus,
        hasStrategyData: !!strategyData,
        strategyDataKeys: strategyData ? Object.keys(strategyData) : [],
        isFromStrategyBuilder
      });
    }, 100); // 100ms debounce

    return () => clearTimeout(timeoutId);
  }, [strategyStatus, strategyData, isFromStrategyBuilder]);

  // Check strategy status when strategies are loaded
  useEffect(() => {
    // Handle different response formats
    let strategiesArray: any[] = [];
    
    if (Array.isArray(strategies)) {
      // Direct array
      strategiesArray = strategies;
    } else if (strategies && typeof strategies === 'object' && 'strategies' in strategies && Array.isArray((strategies as any).strategies)) {
      // API response object with strategies array
      strategiesArray = (strategies as any).strategies;
    }
    
    if (strategiesArray.length > 0) {
      checkStrategyStatus();
      
      // Add debounce to prevent rapid successive calls
      const timeoutId = setTimeout(() => {
        loadStrategyData();
      }, 500); // 500ms debounce
      
      return () => clearTimeout(timeoutId);
    } else if (strategiesArray.length === 0 && hasCheckedStrategy) {
      // Only set to 'none' if we've already checked and confirmed no strategies
      setStrategyStatus('none');
      setShowOnboarding(true);
    }
    // If strategiesArray.length === 0 and !hasCheckedStrategy, do nothing (wait for data to load)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [strategies, loadStrategies, isFromStrategyBuilder]);

  const loadStrategyData = async () => {
    // Prevent multiple simultaneous requests
    if (strategyDataLoading) {
      console.log('🔄 Strategy data loading already in progress, skipping...');
      return;
    }
    
    try {
      setStrategyDataLoading(true);
      setStrategyDataError(null);
      
      // Phase 4: Use store data directly instead of making redundant API calls.
      // The orchestrator already loaded strategies with comprehensive_ai_analysis.
      
      // PRIORITY 0: Check cache for latest generated strategy
      if (latestGeneratedStrategy && latestGeneratedStrategy.strategic_insights) {
        console.log('✅ Using cached latest generated strategy');
        setStrategyData(latestGeneratedStrategy);
        setStrategyStatus('pending');
        setShowOnboarding(false);
        return;
      }
      
      // PRIORITY 1: Check if store strategies have comprehensive_ai_analysis
      // Handle different response formats
      let strategiesArray: any[] = [];
      if (Array.isArray(strategies)) {
        strategiesArray = strategies;
      } else if (strategies && typeof strategies === 'object' && 'strategies' in strategies && Array.isArray((strategies as any).strategies)) {
        strategiesArray = (strategies as any).strategies;
      }
      
      if (strategiesArray.length > 0) {
        // Sort by creation date (newest first)
        const sortedStrategies = [...strategiesArray].sort((a: any, b: any) => {
          const dateA = new Date(a.created_at || a.createdAt || 0);
          const dateB = new Date(b.created_at || b.createdAt || 0);
          return dateB.getTime() - dateA.getTime();
        });
        
        // Find the most recent strategy with comprehensive_ai_analysis
        const strategyWithAnalysis = sortedStrategies.find((s: any) => s.comprehensive_ai_analysis);
        
        if (strategyWithAnalysis) {
          console.log('✅ Using strategy from store with comprehensive_ai_analysis');
          setStrategyData(strategyWithAnalysis.comprehensive_ai_analysis);
          setStrategyStatus('active');
          setShowOnboarding(false);
          return;
        }
        
        // Fallback: try ai_recommendations
        const strategyWithRecs = sortedStrategies.find((s: any) => s.ai_recommendations);
        if (strategyWithRecs) {
          console.log('✅ Using strategy from store with ai_recommendations');
          setStrategyData(strategyWithRecs.ai_recommendations);
          setStrategyStatus('active');
          setShowOnboarding(false);
          return;
        }
      }
      
      // No strategy data available
      setStrategyData(null);
      setStrategyDataError('No comprehensive strategy data available. Please generate a strategy first.');
      
    } catch (err: any) {
      console.error('Error loading strategy data:', err);
      setStrategyDataError(err.message || 'Failed to load strategy data');
      setStrategyData(null);
    } finally {
      setStrategyDataLoading(false);
    }
  };

  // Add a timeout to prevent infinite loading
  useEffect(() => {
    if (strategyDataLoading) {
      const timeout = setTimeout(() => {
        console.log('⏰ Strategy data loading timeout, resetting state...');
        setStrategyDataLoading(false);
        setStrategyDataError('Loading timeout. Please refresh the page.');
      }, 30000); // 30 second timeout
      
      return () => clearTimeout(timeout);
    }
  }, [strategyDataLoading]);

  const checkStrategyStatus = () => {
    // Handle different response formats
    let strategiesArray: any[] = [];
    
    if (Array.isArray(strategies)) {
      // Direct array
      strategiesArray = strategies;
    } else if (strategies && typeof strategies === 'object' && 'strategies' in strategies && Array.isArray((strategies as any).strategies)) {
      // API response object with strategies array
      strategiesArray = (strategies as any).strategies;
    }
    
    if (strategiesArray.length > 0) {
      // For now, we'll assume strategies are active if they exist
      // In a real implementation, you would check a status field from the database
      setStrategyStatus('active');
      setShowOnboarding(false);
    } else {
      setStrategyStatus('none');
      setShowOnboarding(true);
    }
    setHasCheckedStrategy(true);
  };

  const handleConfirmStrategy = async () => {
    try {
      // In a real implementation, you would update the strategy status in the database
      setShowOnboarding(false);
      
      // Reload strategies to get updated data
      await loadStrategies();
    } catch (error) {
      console.error('Error activating strategy:', error);
    }
  };

  const handleEditStrategy = () => {
    setShowOnboarding(false);
    // Navigate to Create tab (index 4) to edit strategy
    navigate('/content-planning', { state: { activeTab: 4 } });
  };

  const handleCreateNewStrategy = () => {
    setShowOnboarding(false);
    // Navigate to Create tab (index 4) to create new strategy
    navigate('/content-planning', { state: { activeTab: 4 } });
  };

  const handleCloseOnboarding = () => {
    setShowOnboarding(false);
  };

  return (
    <Box sx={{ p: 3 }}>
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {/* Pending Strategy Status Banner */}
      {strategyStatus === 'pending' && (
        <Alert 
          severity="info" 
          sx={{ mb: 3 }}
          action={
            <Button 
              color="inherit" 
              size="small" 
              onClick={() => setShowOnboarding(true)}
              startIcon={<PlayArrowIcon />}
            >
              Review & Activate
            </Button>
          }
        >
          <Typography variant="body1">
            <strong>Strategy Ready for Review:</strong> Your AI-generated content strategy is ready! Please review all components and confirm to activate your strategy.
          </Typography>
        </Alert>
      )}

      {/* Strategy Status Banner */}
      {strategyStatus === 'inactive' && (
        <Alert 
          severity="warning" 
          sx={{ mb: 3 }}
          action={
            <Button 
              color="inherit" 
              size="small" 
              onClick={() => setShowOnboarding(true)}
              startIcon={<PlayArrowIcon />}
            >
              Activate Strategy
            </Button>
          }
        >
          <Typography variant="body1">
            <strong>Strategy Pending Activation:</strong> Your content strategy is ready but needs to be activated to start your AI-powered content marketing journey.
          </Typography>
        </Alert>
      )}

      {strategyStatus === 'none' && (
        <Alert 
          severity="info" 
          sx={{ mb: 3 }}
          action={
            <Button 
              color="inherit" 
              size="small" 
              onClick={() => setShowOnboarding(true)}
              startIcon={<AutoAwesomeIcon />}
            >
              Create Strategy
            </Button>
          }
        >
          <Typography variant="body1">
            <strong>No Strategy Found:</strong> Let's create your first AI-powered content strategy to start your digital marketing journey.
          </Typography>
        </Alert>
      )}

      {/* Active Strategy Status Banner */}
      {strategyStatus === 'active' && currentStrategy && (
        <Alert 
          severity="success" 
          sx={{ mb: 3 }}
          action={
            <Button 
              color="inherit" 
              size="small" 
              onClick={() => setShowOnboarding(true)}
              startIcon={<EditIcon />}
            >
              Edit Strategy
            </Button>
          }
        >
          <Typography variant="body1">
            <strong>Strategy Active:</strong> Your AI-powered content strategy is active and being monitored. View performance analytics in the Analytics tab.
          </Typography>
        </Alert>
      )}

      {/* Strategic Intelligence - Show for both active and pending strategies */}
      {(strategyStatus === 'active' || strategyStatus === 'pending') && (
        <Paper sx={{ width: '100%', mb: 3 }}>
          {strategyDataLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', p: 4 }}>
              <CircularProgress />
              <Typography variant="body2" sx={{ ml: 2, color: 'text.secondary' }}>
                Loading strategy data...
              </Typography>
            </Box>
          ) : strategyDataError ? (
            <Alert severity="error" sx={{ m: 2 }}>
              {strategyDataError}
            </Alert>
          ) : (
            <StrategyIntelligenceTab 
              strategyData={strategyData}
              loading={strategyDataLoading}
              error={strategyDataError}
              strategyStatus={strategyStatus}
            />
          )}
        </Paper>
      )}

      {/* Strategy Onboarding Dialog */}
      <StrategyOnboardingDialog
        open={showOnboarding}
        onClose={handleCloseOnboarding}
        onConfirmStrategy={handleConfirmStrategy}
        onEditStrategy={handleEditStrategy}
        onCreateNewStrategy={handleCreateNewStrategy}
        currentStrategy={currentStrategy}
        strategyStatus={strategyStatus}
      />
    </Box>
  );
};

export default ContentStrategyTab;