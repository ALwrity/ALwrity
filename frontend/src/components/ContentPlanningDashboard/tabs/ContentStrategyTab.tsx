import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  Alert,
  CircularProgress
} from '@mui/material';
import {
  PlayArrow as PlayArrowIcon,
  AutoAwesome as AutoAwesomeIcon,
  Edit as EditIcon
} from '@mui/icons-material';
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
  const loadAIInsights = useContentPlanningStore(state => state.loadAIInsights);
  const loadAIRecommendations = useContentPlanningStore(state => state.loadAIRecommendations);
  const setLatestGeneratedStrategy = useContentPlanningStore(state => state.setLatestGeneratedStrategy);

  // Real data states
  const [strategyData, setStrategyData] = useState<StrategyData | null>(null);
  const [strategyDataLoading, setStrategyDataLoading] = useState(false);
  const [strategyDataError, setStrategyDataError] = useState<string | null>(null);
  const [dataLoading, setDataLoading] = useState({
    strategies: false,
    insights: false,
    recommendations: false,
    strategicIntelligence: false
  });

  // Strategy status and onboarding
  const [strategyStatus, setStrategyStatus] = useState<'active' | 'inactive' | 'pending' | 'none'>('none');
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [hasCheckedStrategy, setHasCheckedStrategy] = useState(false);

  // Navigation state detection
  const [isFromStrategyBuilder, setIsFromStrategyBuilder] = useState(false);

  // Load data on component mount
  // Note: ProtectedRoute ensures user is authenticated before this component renders
  useEffect(() => {
    loadInitialData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      
      const userId = user?.id ?? null;
      
      // PRIORITY 0: Check cache first for latest generated strategy
      console.log('🔍 PRIORITY 0: Checking cache for latest generated strategy...');
      console.log('🔍 Cache state:', {
        hasCache: !!latestGeneratedStrategy,
        cacheData: latestGeneratedStrategy ? {
          hasStrategicInsights: !!latestGeneratedStrategy.strategic_insights,
          hasCompetitiveAnalysis: !!latestGeneratedStrategy.competitive_analysis,
          hasPerformancePredictions: !!latestGeneratedStrategy.performance_predictions,
          hasImplementationRoadmap: !!latestGeneratedStrategy.implementation_roadmap,
          hasRiskAssessment: !!latestGeneratedStrategy.risk_assessment
        } : null
      });
      if (latestGeneratedStrategy && latestGeneratedStrategy.strategic_insights) {
        console.log('🚀 PRIORITY 0: Found latest generated strategy in cache!');
        console.log('📊 Cached strategy data structure:', {
          hasStrategicInsights: !!latestGeneratedStrategy.strategic_insights,
          hasCompetitiveAnalysis: !!latestGeneratedStrategy.competitive_analysis,
          hasPerformancePredictions: !!latestGeneratedStrategy.performance_predictions,
          hasImplementationRoadmap: !!latestGeneratedStrategy.implementation_roadmap,
          hasRiskAssessment: !!latestGeneratedStrategy.risk_assessment,
          strategyId: latestGeneratedStrategy.id,
          strategyName: latestGeneratedStrategy.name
        });
        setStrategyData(latestGeneratedStrategy);
        
        // Set strategy status to pending for newly generated strategy (needs review)
        setStrategyStatus('pending');
        setShowOnboarding(false);
        console.log('📋 Set strategy status to pending for cached strategy (needs review)');
        console.log('🔄 Strategy Review Workflow: New strategy ready for review - User should see review process');
        
        return;
      } else {
        console.log('❌ PRIORITY 0: No strategy found in cache, proceeding to next priority...');
      }
      
      // PRIORITY 1: If coming from strategy builder, prioritize the latest generated strategy
      if (isFromStrategyBuilder) {
        // Try with exponential backoff to handle rate limits
        for (let attempt = 1; attempt <= 2; attempt++) {
          try {
            console.log(`🔍 PRIORITY 1 (Attempt ${attempt}/2): Trying to get latest generated strategy from polling system...`);
            
            // Add exponential backoff delay for subsequent attempts
            if (attempt > 1) {
              const delay = Math.pow(2, attempt) * 1000; // 2s, 4s delays
              console.log(`⏳ Waiting ${delay}ms before retry...`);
              await new Promise(resolve => setTimeout(resolve, delay));
            }
            
            const latestStrategyResponse = await contentPlanningApi.getLatestGeneratedStrategyWithRetry(Number(userId));
            
            console.log(`🔍 Latest strategy response (attempt ${attempt}):`, latestStrategyResponse);
            
            if (latestStrategyResponse && latestStrategyResponse.strategic_insights) {
              console.log('✅ Found latest generated strategy in polling system');
              console.log('📊 Latest strategy data structure:', {
                hasStrategicInsights: !!latestStrategyResponse.strategic_insights,
                hasCompetitiveAnalysis: !!latestStrategyResponse.competitive_analysis,
                hasPerformancePredictions: !!latestStrategyResponse.performance_predictions,
                hasImplementationRoadmap: !!latestStrategyResponse.implementation_roadmap,
                hasRiskAssessment: !!latestStrategyResponse.risk_assessment,
                strategyId: latestStrategyResponse.id,
                strategyName: latestStrategyResponse.name
              });
              setStrategyData(latestStrategyResponse);
              
              // Cache the strategy since it wasn't cached during generation
              console.log('💾 Caching strategy from polling system since it was not cached during generation');
              setLatestGeneratedStrategy(latestStrategyResponse);
              
              // Set strategy status to pending for newly generated strategy (needs review)
              setStrategyStatus('pending');
              setShowOnboarding(false);
              console.log('📋 Set strategy status to pending for polling system strategy (needs review)');
              
              return;
            } else {
              console.log(`⚠️ Latest strategy response missing strategic_insights (attempt ${attempt}), trying database...`);
              console.log('🔍 Latest strategy response structure:', latestStrategyResponse);
            }
          } catch (pollingError: any) {
            console.log(`⚠️ Error getting latest strategy from polling system (attempt ${attempt}):`, pollingError);
            
            // Check if it's a rate limit error
            if (pollingError?.response?.status === 429) {
              console.log('🚫 Rate limit hit, will retry with longer delay...');
              if (attempt === 2) {
                console.log('❌ Rate limit persists, skipping polling system and trying database...');
                break; // Exit the loop and try database instead
              }
            } else if (attempt === 2) {
              console.log('❌ All attempts failed, continuing to database fallback...');
            }
          }
        }
      }
      
      // PRIORITY 2: Try to get the latest generated strategy from polling system
      try {
        const latestStrategyResponse = await contentPlanningApi.getLatestGeneratedStrategy(Number(userId));
        
        if (latestStrategyResponse && latestStrategyResponse.strategic_insights) {
          setStrategyData(latestStrategyResponse);
          
          // Cache the strategy since it wasn't cached during generation
          console.log('💾 Caching strategy from general polling since it was not cached during generation');
          setLatestGeneratedStrategy(latestStrategyResponse);
          
          // Set strategy status to pending for newly generated strategy (needs review)
          setStrategyStatus('pending');
          setShowOnboarding(false);
          console.log('📋 Set strategy status to pending for general polling strategy (needs review)');
          
          return;
        }
      } catch (pollingError) {
        // Continue to next priority
      }
      
      // PRIORITY 3: If no strategy found in polling system, try to get from database
      console.log('🎯 PRIORITY 3: Checking database for strategies...');
      try {
        const strategiesResponse = await contentPlanningApi.getEnhancedStrategies(Number(userId));
        
        const strategies = strategiesResponse?.data?.strategies || strategiesResponse?.strategies || [];
        
        if (strategies && strategies.length > 0) {
          console.log('🔍 Found strategies in database:', strategies.length);
          
          // Sort strategies by creation date (newest first) to ensure we get the latest
          const sortedStrategies = strategies.sort((a: any, b: any) => {
            const dateA = new Date(a.created_at || a.createdAt || 0);
            const dateB = new Date(b.created_at || b.createdAt || 0);
            return dateB.getTime() - dateA.getTime(); // Descending order (newest first)
          });
          
          console.log('🔍 Sorted strategies by creation date:', sortedStrategies.map((s: any) => ({
            id: s.id,
            name: s.name,
            created_at: s.created_at || s.createdAt,
            has_comprehensive_analysis: !!s.comprehensive_ai_analysis,
            has_ai_recommendations: !!s.ai_recommendations
          })));
          
          // If coming from strategy builder, prioritize strategies with comprehensive_ai_analysis
          if (isFromStrategyBuilder) {
            const latestComprehensiveStrategy = sortedStrategies.find((s: any) => s.comprehensive_ai_analysis);
            if (latestComprehensiveStrategy) {
              console.log('✅ Found latest comprehensive strategy in database:', latestComprehensiveStrategy.id);
              setStrategyData(latestComprehensiveStrategy.comprehensive_ai_analysis);
              
              // Set strategy status to active for existing database strategy
              setStrategyStatus('active');
              setShowOnboarding(false);
              console.log('✅ Set strategy status to active for database comprehensive strategy');
              
              return;
            }
            
            // Fallback to ai_recommendations if comprehensive_ai_analysis not available
            const latestWithRecommendations = sortedStrategies.find((s: any) => s.ai_recommendations);
            if (latestWithRecommendations) {
              console.log('✅ Found latest strategy with ai_recommendations in database:', latestWithRecommendations.id);
              setStrategyData(latestWithRecommendations.ai_recommendations);
              
              // Set strategy status to active for existing database strategy
              setStrategyStatus('active');
              setShowOnboarding(false);
              console.log('✅ Set strategy status to active for database recommendations strategy');
              
              return;
            }
          }
          
          // Get the most recent strategy (first after sorting)
          const latestStrategy = sortedStrategies[0];
          
          if (latestStrategy.comprehensive_ai_analysis) {
            setStrategyData(latestStrategy.comprehensive_ai_analysis);
            
            // Set strategy status to active for existing database strategy
            setStrategyStatus('active');
            setShowOnboarding(false);
            console.log('✅ Set strategy status to active for database latest strategy');
            
            return;
          }
        }
      } catch (dbError: any) {
        console.error('Database error:', dbError);
        
        // Check if it's a rate limit error
        if (dbError?.response?.status === 429) {
          console.log('🚫 Database request also hit rate limit, showing error to user...');
          setStrategyDataError('Server is temporarily overloaded. Please try again in a few moments.');
          return;
        }
      }
      
      // If no strategy data is available
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

  const loadInitialData = async () => {
    try {
      setDataLoading({ strategies: true, insights: true, recommendations: true, strategicIntelligence: true });
      
      // Load strategies first (most important)
      console.log('🔄 Loading strategies...');
      await loadStrategies();
      
      // Add delay between requests to avoid rate limits
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Load AI insights and recommendations sequentially instead of in parallel
      console.log('🔄 Loading AI insights...');
      try {
        await loadAIInsights();
      } catch (error) {
        console.warn('⚠️ Failed to load AI insights:', error);
      }
      
      // Add delay between requests
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      console.log('🔄 Loading AI recommendations...');
      try {
        await loadAIRecommendations();
      } catch (error) {
        console.warn('⚠️ Failed to load AI recommendations:', error);
      }
      
    } catch (error) {
      console.error('Error loading initial data:', error);
    } finally {
      setDataLoading({ strategies: false, insights: false, recommendations: false, strategicIntelligence: false });
    }
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

      {/* Loading indicator for initial data */}
      {Object.values(dataLoading).some(loading => loading) && (
        <Paper sx={{ width: '100%', mb: 3 }}>
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', p: 4 }}>
            <CircularProgress />
            <Typography variant="body2" sx={{ ml: 2, color: 'text.secondary' }}>
              Loading dashboard data...
            </Typography>
          </Box>
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