import React, { useEffect, useState, memo } from 'react';
import { Box, CircularProgress, Alert, Typography } from '@mui/material';
import StrategyHeader from './components/StrategyHeader';
import StrategicInsightsCard from './components/StrategicInsightsCard';
import CompetitiveAnalysisCard from './components/CompetitiveAnalysisCard';
import PerformancePredictionsCard from './components/PerformancePredictionsCard';
import ImplementationRoadmapCard from './components/ImplementationRoadmapCard';
import RiskAssessmentCard from './components/RiskAssessmentCard';
import ReviewProgressHeader from './components/ReviewProgressHeader';
import StrategyErrorBoundary from './components/StrategyErrorBoundary';
import { StrategyData } from './types/strategy.types';
import { useStrategyReviewStore } from '../../../../stores/strategyReviewStore';
import { useStrategyBuilderStore } from '../../../../stores/strategyBuilderStore';
import { useNavigationOrchestrator } from '../../../../services/navigationOrchestrator';
import { useStrategyCalendarContext } from '../../../../contexts/StrategyCalendarContext';
import { hasValidData } from './utils/defensiveRendering';
import { createSafeStrategyData, validateStrategyData } from './utils/strategyDataValidator';

interface StrategyIntelligenceTabProps {
  strategyData?: StrategyData | null;
  loading?: boolean;
  error?: string | null;
  strategyStatus?: 'active' | 'inactive' | 'pending' | 'none';
}

const StrategyIntelligenceTab: React.FC<StrategyIntelligenceTabProps> = ({ 
  strategyData, 
  loading = false, 
  error = null,
  strategyStatus = 'none'
}) => {
  // Single-open accordion: only one section card is expanded at a time.
  const [expandedSection, setExpandedSection] = useState<string | null>(null);

  const toggleSection = (id: string) => {
    setExpandedSection(prev => (prev === id ? null : id));
  };

  // Get review process state from store with selective subscription
  const reviewProcessStarted = useStrategyReviewStore(state => state.reviewProcessStarted);
  const startReviewProcess = useStrategyReviewStore(state => state.startReviewProcess);
  const components = useStrategyReviewStore(state => state.components);
  const initializeComponents = useStrategyReviewStore(state => state.initializeComponents);
  const isAllReviewed = useStrategyReviewStore(state => state.isAllReviewed);
  const isActivated = useStrategyReviewStore(state => state.isActivated);
  const resetAllReviews = useStrategyReviewStore(state => state.resetAllReviews);

  // Initialize components if they don't exist
  useEffect(() => {
    if (components.length === 0) {
      console.log('🔧 StrategyIntelligenceTab: Initializing components');
      const STRATEGY_COMPONENTS = [
        {
          id: 'strategic_insights',
          title: 'Strategic Insights',
          subtitle: 'AI-powered market analysis'
        },
        {
          id: 'competitive_analysis',
          title: 'Competitive Analysis',
          subtitle: 'Market positioning insights'
        },
        {
          id: 'performance_predictions',
          title: 'Performance Predictions',
          subtitle: 'ROI and success metrics'
        },
        {
          id: 'implementation_roadmap',
          title: 'Implementation Roadmap',
          subtitle: 'Project timeline and phases'
        },
        {
          id: 'risk_assessment',
          title: 'Risk Assessment',
          subtitle: 'Risk analysis and mitigation'
        }
      ];
      initializeComponents(STRATEGY_COMPONENTS);
    }
  }, [components.length, initializeComponents]);

  // Create safe strategy data for rendering
  const safeStrategyData = createSafeStrategyData(strategyData);

  // Auto-start review process for pending strategies
  useEffect(() => {
    if (strategyStatus === 'pending' && !reviewProcessStarted && safeStrategyData) {
      console.log('🔄 Auto-starting review process for pending strategy');
      console.log('📋 Review Process: Starting review workflow for newly generated strategy');
      console.log('🎯 Strategy Review Workflow: User should now see the review interface');
      startReviewProcess();
    }
  }, [strategyStatus, safeStrategyData, startReviewProcess, reviewProcessStarted]);

  // Log review process state changes (only when important changes occur, with debounce)
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (reviewProcessStarted || strategyStatus === 'pending') {
        console.log('🔄 Review Process State:', {
          strategyStatus,
          reviewProcessStarted,
          hasStrategyData: !!safeStrategyData,
          componentsCount: components.length,
          isAllReviewed: isAllReviewed(),
          isActivated: isActivated()
        });
      }
    }, 150); // 150ms debounce

    return () => clearTimeout(timeoutId);
  }, [strategyStatus, reviewProcessStarted, safeStrategyData, components.length, isAllReviewed, isActivated]);

  // Log when review interface becomes visible
  useEffect(() => {
    if (reviewProcessStarted && safeStrategyData) {
      console.log('🎯 RENDERING: Review interface is now visible to user');
      console.log('📋 Review Interface: User can now review and confirm the strategy');
      console.log('📊 Current Strategy Data:', {
        hasStrategicInsights: !!safeStrategyData.strategic_insights,
        hasCompetitiveAnalysis: !!safeStrategyData.competitive_analysis,
        hasPerformancePredictions: !!safeStrategyData.performance_predictions,
        hasImplementationRoadmap: !!safeStrategyData.implementation_roadmap,
        hasRiskAssessment: !!safeStrategyData.risk_assessment
      });
    }
  }, [reviewProcessStarted, safeStrategyData]);

  // Log when StrategyHeader is rendered with new data
  useEffect(() => {
    if (safeStrategyData) {
      console.log('🎯 RENDERING: StrategyHeader with status:', strategyStatus, 'and confirmed:', strategyStatus === 'active');
    }
  }, [strategyStatus, safeStrategyData]);



  const handleStartReviewProcess = () => {
    console.log('🔄 Manual review process started by user');
    startReviewProcess();
  };

  // Navigate to the calendar wizard with the current strategy context.
  // Shares the same payload as ReviewProgressHeader's calendar generation.
  const { setStrategyContext } = useStrategyCalendarContext();
  const navigationOrchestrator = useNavigationOrchestrator();
  const currentStrategyFromBuilder = useStrategyBuilderStore(state => state.currentStrategy);

  const handleGenerateContentCalendar = () => {
    if (!safeStrategyData) return;
    const actualStrategyData = currentStrategyFromBuilder || safeStrategyData;
    let strategyId = '1';
    if (actualStrategyData && 'id' in actualStrategyData && actualStrategyData.id) {
      strategyId = actualStrategyData.id.toString();
    }
    const strategyContext = {
      strategyId,
      strategyData: actualStrategyData,
      activationStatus: 'active' as const,
      activationTimestamp: new Date().toISOString(),
      userPreferences: {},
      strategicIntelligence: {}
    };
    setStrategyContext(strategyContext);
    navigationOrchestrator.navigateToCalendarWizard(strategyId, strategyContext);
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ m: 2 }}>
        {error}
      </Alert>
    );
  }

  // Validate strategy data before rendering
  const hasValidStrategyData = (data: StrategyData | null): boolean => {
    if (!data) return false;
    
    // Check if the data has meaningful content
    const hasStrategicInsights = hasValidData(data.strategic_insights);
    const hasCompetitiveAnalysis = hasValidData(data.competitive_analysis);
    const hasPerformancePredictions = hasValidData(data.performance_predictions);
    const hasImplementationRoadmap = hasValidData(data.implementation_roadmap);
    const hasRiskAssessment = hasValidData(data.risk_assessment);
    
    // Return true if at least one component has valid data
    return hasStrategicInsights || hasCompetitiveAnalysis || hasPerformancePredictions || 
           hasImplementationRoadmap || hasRiskAssessment;
  };

  if (!safeStrategyData || !hasValidStrategyData(safeStrategyData)) {
    return (
      <Box sx={{ textAlign: 'center', p: 4 }}>
        <Typography variant="h6" color="text.secondary" gutterBottom>
          No Strategy Data Available
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Generate a comprehensive strategy first to view strategic intelligence.
        </Typography>
        {strategyData && (
          <Typography variant="caption" sx={{ display: 'block', mt: 2, color: 'text.secondary' }}>
            Strategy data exists but contains no valid components.
          </Typography>
        )}
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      {/* Header Section */}
      <StrategyHeader 
        strategyData={safeStrategyData} 
        strategyConfirmed={strategyStatus === 'active'}
        strategyStatus={strategyStatus}
        onStartReview={handleStartReviewProcess}
        onGenerateContentCalendar={handleGenerateContentCalendar}
      />

      {/* Review Progress Header - Only shown when review process is started */}
      {reviewProcessStarted && <ReviewProgressHeader strategyData={safeStrategyData} />}

      {/* Strategy Intelligence Cards */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: '1fr',
          gridAutoRows: 'minmax(min-content, auto)',
          gap: 3,
          position: 'relative',
          minHeight: '400px',
          padding: 2,
          '& > *': {
            minHeight: 'fit-content',
            position: 'relative',
            zIndex: 1,
            transition: 'z-index 0.3s ease, transform 0.3s ease',
          },
        }}
      >
        <StrategyErrorBoundary>
          <StrategicInsightsCard
            strategyData={safeStrategyData}
            expanded={expandedSection === 'strategic_insights'}
            onToggle={() => toggleSection('strategic_insights')}
          />
        </StrategyErrorBoundary>
        <StrategyErrorBoundary>
          <CompetitiveAnalysisCard
            strategyData={safeStrategyData}
            expanded={expandedSection === 'competitive_analysis'}
            onToggle={() => toggleSection('competitive_analysis')}
          />
        </StrategyErrorBoundary>
        <StrategyErrorBoundary>
          <PerformancePredictionsCard
            strategyData={safeStrategyData}
            expanded={expandedSection === 'performance_predictions'}
            onToggle={() => toggleSection('performance_predictions')}
          />
        </StrategyErrorBoundary>
        <StrategyErrorBoundary>
          <ImplementationRoadmapCard
            strategyData={safeStrategyData}
            expanded={expandedSection === 'implementation_roadmap'}
            onToggle={() => toggleSection('implementation_roadmap')}
          />
        </StrategyErrorBoundary>
        <StrategyErrorBoundary>
          <RiskAssessmentCard
            strategyData={safeStrategyData}
            expanded={expandedSection === 'risk_assessment'}
            onToggle={() => toggleSection('risk_assessment')}
          />
        </StrategyErrorBoundary>
      </Box>
    </Box>
  );
};

export default memo(StrategyIntelligenceTab); 