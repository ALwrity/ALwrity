import { devLog } from '../../../utils/devLogger';
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Paper,
  Typography,
  Button,
  LinearProgress,
  Grid,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions
} from '@mui/material';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import InfoIcon from '@mui/icons-material/Info';
import { useStrategyBuilderStore, STRATEGIC_INPUT_FIELDS } from '../../../stores/strategyBuilderStore';
import { useEnhancedStrategyStore } from '../../../stores/enhancedStrategyStore';
import EnhancedTooltip from './ContentStrategyBuilder/EnhancedTooltip';
import DataSourceTransparency from './DataSourceTransparency';
import StrategyAutofillTransparencyModal from './StrategyAutofillTransparencyModal';
import EnterpriseDatapointsModal from './EnterpriseDatapointsModal';

// Import extracted hooks
import { useCategoryReview } from './ContentStrategyBuilder/hooks/useCategoryReview';
import { useProgressTracking } from './ContentStrategyBuilder/hooks/useProgressTracking';
import { useAutoPopulation } from './ContentStrategyBuilder/hooks/useAutoPopulation';
import { useModalManagement } from './ContentStrategyBuilder/hooks/useModalManagement';
// Removed: useAIRefresh (autofill unified into store's autofillStrategyFields)
import { useEventHandlers } from './ContentStrategyBuilder/hooks/useEventHandlers';
import { canProceedWithCreation } from './ContentStrategyBuilder/utils/reviewGate';
import { getCategoryName } from './ContentStrategyBuilder/utils/categoryHelpers';
import { useStrategyCreation } from './ContentStrategyBuilder/hooks/useStrategyCreation';

// CopilotKit disabled (Phase 5 follow-up): actions preserved for future
// but sidebar, instructions hook, and suggestions array are removed
// to eliminate the build-time dependency and reduce bundle overhead.
// See docs/planning/phased-plan-audit.md for re-enablement plan.

// Import extracted utilities
import { getCategoryIcon, getCategoryColor } from './ContentStrategyBuilder/utils/categoryHelpers';
import { getEducationalContent } from './ContentStrategyBuilder/utils/educationalContent';
import { setupCSSAnimations, cleanupCSSAnimations } from './ContentStrategyBuilder/utils/cssAnimations';

// Import extracted components
import CategoryList from './ContentStrategyBuilder/components/CategoryList';
import ProgressTracker from './ContentStrategyBuilder/components/ProgressTracker';
import HeaderSection from './ContentStrategyBuilder/components/HeaderSection';
import EducationalModal from './ContentStrategyBuilder/components/EducationalModal';
import ActionButtons from './ContentStrategyBuilder/components/ActionButtons';
import StrategyDisplay from './ContentStrategyBuilder/components/StrategyDisplay';
import ErrorAlert from './ContentStrategyBuilder/components/ErrorAlert';
import { contentPlanningApi } from '../../../services/contentPlanningApi';
import CategoryDetailView from './ContentStrategyBuilder/components/CategoryDetailView';
// CopilotKit sidebar and actions removed (Phase 5 follow-up: disable for now)
// import { CopilotSidebar } from '@copilotkit/react-ui';
// import { useCopilotActions } from './ContentStrategyBuilder/CopilotActions';

/** The 5 canonical strategy categories (matches STRATEGIC_INPUT_FIELDS
 *  categories and categoryHelpers). Source of truth for review progress. */
const CANONICAL_CATEGORIES = [
  'business_context',
  'audience_intelligence',
  'competitive_intelligence',
  'content_strategy',
  'performance_analytics',
] as const;

/** Format an ISO timestamp as a compact "time ago" label. */
const formatTimeAgo = (iso: string): string => {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const mins = Math.floor((Date.now() - then) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
};

const ContentStrategyBuilder: React.FC = () => {
  const navigate = useNavigate();
  
  // Strategy Builder Store (for form data, validation, auto-population)
  const {
    formData,
    formErrors,
    autoPopulatedFields,
    dataSources,
    inputDataPoints,
    personalizationData,
    confidenceScores,
    pipelineDataQuality,
    loading,
    error,
    saving,
    currentStrategy,
    updateFormField,
    validateFormField,
    validateAllFields,
    autofillStrategyFields,
    ensureAutofillForSession,
    regenerateAIFields,
    createStrategy: createEnhancedStrategy,
    calculateCompletionPercentage,
    getCompletionStats,
    setError,
    setCurrentStrategy,
    setSaving
  } = useStrategyBuilderStore();
  
  // Enhanced Strategy Store (for AI analysis, progressive disclosure, transparency)
  const {
    aiGenerating,
    transparencyModalOpen,
    transparencyGenerationProgress: storeGenerationProgress,
    currentPhase,
    educationalContent: storeEducationalContent,
    transparencyMessages,
    transparencyGenerating: isGenerating,
    setTransparencyModalOpen,
    setTransparencyGenerationProgress: setStoreGenerationProgress,
    setCurrentPhase,
    // Phase E #22: the backend's real step (1..8) for the modal's phase label.
    generationStep: storeGenerationStep,
    setGenerationStep,
    setEducationalContent: setStoreEducationalContent,
    addTransparencyMessage,
    clearTransparencyMessages,
    setTransparencyGenerating: setIsGenerating,
    generateAIRecommendations,
    setAIGenerating
  } = useEnhancedStrategyStore();

  // CopilotKit hooks removed (Phase 5 follow-up: disable component, not load it)
  // useCopilotActions();
  // useCopilotReadable({ ... });
  // useCopilotAdditionalInstructions({ ... });

  // Check if this component is currently visible (active tab)
  const [, setIsVisible] = useState(false);
  
  useEffect(() => {
    // Use a small delay to ensure the component is actually rendered
    const timer = setTimeout(() => {
      setIsVisible(true);
    }, 100);
    
    return () => {
      clearTimeout(timer);
      setIsVisible(false);
    };
  }, []);

  const [, setShowAIRecommendations] = useState(false);
  const [showDataSourceTransparency, setShowDataSourceTransparency] = useState(false);
  const [showAIRecModal, setShowAIRecModal] = useState(false);

  // Ref to track if we've already set the default category
  const hasSetDefaultCategory = useRef(false);

  // Use extracted hooks
  const {
    showTooltip,
    setShowTooltip,
    activeCategory,
    setActiveCategory,
    showEducationalInfo,
    setShowEducationalInfo,
    handleReviewCategory,
    handleShowEducationalInfo
  } = useEventHandlers();

  // Memoize form state context to prevent re-renders
  const formStateContext = useMemo(() => {
    const filledFields = Object.keys(formData).filter(key => {
      const value = formData[key];
      return value && typeof value === 'string' && value.trim() !== '';
    });
    const emptyFields = Object.keys(formData).filter(key => {
      const value = formData[key];
      return !value || typeof value !== 'string' || value.trim() === '';
    });
    return {
      formData,
      completionPercentage: calculateCompletionPercentage(),
      filledFields,
      emptyFields,
      categoryProgress: getCompletionStats().category_completion,
      activeCategory,
      formErrors,
      totalFields: 30,
      filledCount: filledFields.length
    };
  }, [formData, activeCategory, formErrors, calculateCompletionPercentage, getCompletionStats]);

  // CopilotKit readable hooks removed (Phase 5 follow-up: disable for now)
  // The formStateContext, fieldDefinitionsContext, and onboardingDataContext
  // remain available for future re-enablement.
  // useCopilotReadable({ description: ..., value: formStateContext });
  // useCopilotReadable({ description: ..., value: fieldDefinitionsContext });
  // useCopilotReadable({ description: ..., value: onboardingDataContext });

  // Memoize field definitions context to prevent re-renders
  const fieldDefinitionsContext = useMemo(() => {
    return STRATEGIC_INPUT_FIELDS.map(field => ({
      id: field.id,
      label: field.label,
      description: field.description,
      tooltip: field.tooltip,
      required: field.required,
      type: field.type,
      options: field.options,
      category: field.category,
      currentValue: formData[field.id] || null
    }));
  }, [formData]);

  // CopilotKit readable hooks removed (Phase 5 follow-up: disable for now)
  // The field definitions context remains computed for future re-enablement.
  // useCopilotReadable({ description: "...", value: fieldDefinitionsContext });

  // Memoize onboarding data context to prevent re-renders
  const onboardingDataContext = useMemo(() => {
    return {
      websiteAnalysis: personalizationData?.website_analysis,
      researchPreferences: personalizationData?.research_preferences,
      apiKeys: personalizationData?.api_keys,
      userProfile: personalizationData?.user_profile,
      hasOnboardingData: !!personalizationData
    };
  }, [personalizationData]);

  // CopilotKit readable hooks removed (Phase 5 follow-up: disable for now)
  // The onboarding data context remains computed for future re-enablement.
  // useCopilotReadable({ description: "...", value: onboardingDataContext });

  // Memoize instructions to prevent re-renders
  const completionPercentage = calculateCompletionPercentage();
  const filledCount = Object.keys(formData).filter(k => {
    const value = formData[k];
    return value && typeof value === 'string' && value.trim() !== '';
  }).length;
  const emptyCount = Object.keys(formData).filter(k => {
    const value = formData[k];
    return !value || typeof value !== 'string' || value.trim() === '';
  }).length;

  // CopilotKit instructions disabled (Phase 5 follow-up: disable for now,
  // not load component). See docs/planning/phased-plan-audit.md.
  // const copilotInstructions = useMemo(...);  // Disabled
  // useCopilotAdditionalInstructions({ instructions: ... });  // Disabled

  // Create a state for educational modal that can be passed to both hooks
  const [showEducationalModal, setShowEducationalModal] = useState(false);
  const [showEnterpriseModal, setShowEnterpriseModal] = useState(false);

  // Persist enterprise modal state across hot reloads
  useEffect(() => {
    const savedModalState = sessionStorage.getItem('showEnterpriseModal');
    if (savedModalState === 'true') {
      devLog.log('🎯 Restoring enterprise modal state from sessionStorage');
      setShowEnterpriseModal(true);
    }
  }, []);
  
  // Save modal state to sessionStorage when it changes
  useEffect(() => {
    sessionStorage.setItem('showEnterpriseModal', showEnterpriseModal.toString());
  }, [showEnterpriseModal]);
  
  // Cleanup sessionStorage on component unmount
  useEffect(() => {
    return () => {
      // Only clear if we're not in the middle of showing the modal
      if (!showEnterpriseModal) {
        sessionStorage.removeItem('showEnterpriseModal');
      }
    };
  }, [showEnterpriseModal]);

  // Phase C #19/#43: which operation the current error banner belongs to, so
  // the ErrorAlert Retry button re-runs the RIGHT operation (generation
  // failures get a generation retry, autofill failures keep autofill retry).
  const [errorSource, setErrorSource] = useState<'autofill' | 'generation'>('autofill');
  const handleGenerationError = (msg: string) => {
    setErrorSource('generation');
    setError(msg);
  };

  // Use strategy creation hook first
  const { originalHandleCreateStrategy, handleSaveStrategy, cancelGeneration } = useStrategyCreation({
    formData,
    error,
    currentStrategy,
    setAIGenerating,
    setError,
    setCurrentStrategy,
    setSaving,
    setGenerationProgress: setStoreGenerationProgress,
    setEducationalContent: setStoreEducationalContent,
    setShowEducationalModal, // Pass the actual setShowEducationalModal function
    validateAllFields,
    getCompletionStats,
    generateAIRecommendations: (strategyId: string) => generateAIRecommendations(strategyId),
    createEnhancedStrategy,
    contentPlanningApi,
    // Phase E #22: track the backend's real step for the modal's phase label.
    setCurrentStep: setGenerationStep,
    onGenerationError: handleGenerationError
  });

  const {
    handleProceedWithCurrentStrategy,
    handleAddEnterpriseDatapoints
  } = useModalManagement({
    aiGenerating,
    originalHandleCreateStrategy,
    setShowEnterpriseModal
  });

  // getCompletionStats depends on formData, so we include it to recalculate when data changes
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const completionStats = useMemo(() => getCompletionStats(), [formData]);

  // Use extracted hooks
  const {
    reviewedCategories,
    isMarkingReviewed,
    categoryCompletionMessage,
    handleConfirmCategoryReview
  } = useCategoryReview({ completionStats, setError, setActiveCategory });

  const {
    totalCategories,
    reviewedCategoriesCount,
    reviewProgressPercentage,
    // getCategoryProgress, // Unused - commented out to fix linting error
    // getCategoryStatus: getCategoryStatusFromHook, // Unused - commented out to fix linting error
    isNextInSequence
  } = useProgressTracking({ completionStats, reviewedCategories });

  // Pre-fill strategy fields from onboarding data on first mount
  const { autoPopulateAttempted, setAutoPopulateAttempted } = useAutoPopulation({
    ensureStrategyFieldsForSession: ensureAutofillForSession,
    completionStats
  });
  
  // Removed: Auto-population consent state (replaced with buttons in HeaderSection)

  // Add ref for scroll to review section
  const reviewSectionRef = useRef<HTMLDivElement>(null);

  // Handle scroll to review section
  const handleScrollToReview = () => {
    if (reviewSectionRef.current) {
      reviewSectionRef.current.scrollIntoView({ 
        behavior: 'smooth', 
        block: 'start' 
      });
    }
  };

  // Determine if we have autofill data
  const hasAutofillData = Object.keys(autoPopulatedFields).length > 0;

  // Data Quality (Phase 1a): the real pipeline assessment from the /autofill
  // response (overall_score, 0-1 fraction), scaled to percent. Fallback when
  // the pipeline score is unavailable: the fields-ready ratio — honest, and
  // never a fabricated 0% when populated fields exist.
  const dataQualityPercent = useMemo(() => {
    const overall = pipelineDataQuality?.overall_score;
    if (typeof overall === 'number' && overall >= 0) {
      return Math.round(overall * 100);
    }
    if (completionStats.total_fields > 0) {
      return Math.round((completionStats.filled_fields / completionStats.total_fields) * 100);
    }
    return 0;
  }, [pipelineDataQuality, completionStats]);

  // Phase 2: authoritative banner stats.
  // Fields ready counts formData (what the user actually has), not the
  // last autofill response's attribution map — that map shrinks when AI
  // runs replace DB values, which under-reported the old chips.
  const fieldsReady = completionStats.filled_fields;
  const fieldsTotal = completionStats.total_fields;

  // Distinct onboarding sources: dedupe per-field source labels.
  const onboardingSources = useMemo(() => {
    const fromSources = Object.values(dataSources).filter(Boolean);
    if (fromSources.length > 0) {
      return new Set(fromSources).size;
    }
    // Fallback: distinct sources recorded on auto-populated fields.
    return new Set(
      Object.values(autoPopulatedFields)
        .map((f: any) => f?.source)
        .filter(Boolean),
    ).size;
  }, [dataSources, autoPopulatedFields]);

  // Category review progress, intersected with the 5 canonical categories
  // (localStorage may hold stale entries from older category naming).
  const reviewedValid = useMemo(
    () => CANONICAL_CATEGORIES.filter(c => reviewedCategories.has(c)),
    [reviewedCategories],
  );
  const unreviewedCategories = useMemo(
    () => CANONICAL_CATEGORIES.filter(c => !reviewedCategories.has(c)),
    [reviewedCategories],
  );
  const allCategoriesReviewed = unreviewedCategories.length === 0;
  
  // Get last autofill time from session storage - stable across renders
  const lastAutofillTimeRef = useRef<string>(sessionStorage.getItem('lastAutofillTime') || '');
  // Render-scope value for the HeaderSection "last refreshed" display.
  // Must exist at component scope — the logging effect below used to own
  // this name, which crashed the tree with a ReferenceError on render.
  const lastAutofillTime = lastAutofillTimeRef.current || '';

  // Get data source from store
  const dataSource = Object.keys(dataSources).length > 0 ? 'Onboarding Database' : undefined;

  // Log autofill data status for debugging (only log when values actually change)
  const autoPopulatedFieldsCount = Object.keys(autoPopulatedFields).length;
  const dataSourcesCount = Object.keys(dataSources).length;
  const inputDataPointsCount = Object.keys(inputDataPoints).length;
  const personalizationDataCount = Object.keys(personalizationData || {}).length;
  const confidenceScoresCount = Object.keys(confidenceScores).length;

  // Keep the ref in sync when autofill data changes (e.g. after Database
  // Autofill writes a new timestamp), so the display stays accurate.
  useEffect(() => {
    lastAutofillTimeRef.current = sessionStorage.getItem('lastAutofillTime') || '';
  }, [autoPopulatedFieldsCount]);

  // Use a ref to track last logged state - prevents infinite re-renders
  const lastLoggedSignatureRef = useRef<string>('');

  useEffect(() => {
    // Only log in development and when there's meaningful data change
    if (process.env.NODE_ENV === 'development' && (autoPopulatedFieldsCount > 0 || dataSourcesCount > 0)) {
      // Build a stable signature from the actual data (excluding the unstable timestamp)
      const signature = `${autoPopulatedFieldsCount}-${dataSourcesCount}-${inputDataPointsCount}-${personalizationDataCount}-${confidenceScoresCount}-${dataSource}`;
      
      // Only log when the data signature actually changes
      if (signature !== lastLoggedSignatureRef.current) {
        lastLoggedSignatureRef.current = signature;
        devLog.log('📋 StrategyBuilder: Autofill data status:', {
          hasAutofillData,
          autoPopulatedFieldsCount,
          dataSourcesCount,
          inputDataPointsCount,
          personalizationDataCount,
          confidenceScoresCount,
          lastAutofillTime,
          dataSource
        });
      }
    }
  }, [hasAutofillData, autoPopulatedFieldsCount, dataSourcesCount, inputDataPointsCount, personalizationDataCount, confidenceScoresCount, dataSource, lastAutofillTime]);



  // Enhanced handleCreateStrategy to show enterprise modal
  const handleCreateStrategy = () => {
    // Phase I #32: value-free summaries only — categories COUNTED, never
    // dumped (the review-gate banner already names the missing ones above).
    devLog.log('🎯 handleCreateStrategy called');
    devLog.log(`🎯 ${Object.keys(completionStats.category_completion || {}).length} completion categories tracked`);
    devLog.log(`🎯 ${reviewedCategories.size} of ${CANONICAL_CATEGORIES.length} categories reviewed`);
    devLog.log('🎯 Current showEnterpriseModal state:', showEnterpriseModal);
    devLog.log('🎯 Current aiGenerating state:', aiGenerating);

    // Prevent multiple calls
    if (aiGenerating) {
      devLog.log('🎯 Already generating, skipping duplicate call');
      return;
    }

    // Review gate (#40): block creation until every canonical category is
    // reviewed. Missing review surfaces an actionable error and scrolls to
    // the review section instead of silently creating an ungrounded strategy.
    const { canProceed, unreviewed } = canProceedWithCreation(
      reviewedCategories,
      CANONICAL_CATEGORIES
    );
    devLog.log('🎯 reviewGate.canProceed:', canProceed);

    if (!canProceed) {
      devLog.log(`🎯 Blocking creation - ${unreviewed.length} categories unreviewed`);
      const missing = unreviewed.map(getCategoryName).join(', ');
      setError(`Please review all sections before generating your strategy. Unreviewed: ${missing}`);
      handleScrollToReview();
      return;
    }

    // Show enterprise modal instead of creating strategy immediately
    devLog.log('🎯 Showing enterprise modal - setting to true');
    setShowEnterpriseModal(true);

    // Return early to prevent calling originalHandleCreateStrategy
    return;
  };

  // Phase C #43: re-run generation after a failure. Clears the error banner
  // and restores the autofill default so a later autofill failure shows the
  // right retry action again.
  const retryGeneration = () => {
    setError(null);
    setErrorSource('autofill');
    handleCreateStrategy();
  };

  // Phase C #43: autofill failures keep their own retry action.
  const retryAutofill = () => {
    setErrorSource('autofill');
    autofillStrategyFields();
  };



  // Removed: Auto-population consent modal (replaced with buttons in HeaderSection)

  // Set default category selection
  useEffect(() => {
    // Only set default category once when component mounts and we have categories
    if (hasSetDefaultCategory.current) {
      devLog.log('🔍 Default category useEffect: SKIPPED - already set default');
      return;
    }
    
    if (Object.keys(completionStats.category_completion).length > 0) {
      const firstCategory = Object.keys(completionStats.category_completion)[0];
      setActiveCategory(firstCategory);
      hasSetDefaultCategory.current = true;
    }
  }, [completionStats.category_completion, setActiveCategory]); // Added setActiveCategory dependency

  // Monitor enterprise modal state for debugging
  useEffect(() => {
    // If modal was unexpectedly closed, log it
    if (!showEnterpriseModal && aiGenerating) {
      devLog.warn('Enterprise modal closed while AI is generating');
    }
  }, [showEnterpriseModal, aiGenerating]);

  // Note: Removed store monitoring useEffect to prevent infinite re-renders

  // Add CSS keyframes for pulse animation
  useEffect(() => {
    const style = setupCSSAnimations();
    return () => {
      cleanupCSSAnimations(style);
    };
  }, []);



  // Wrapper for the hook function to maintain the same interface
  const handleConfirmCategoryReviewWrapper = () => {
    handleConfirmCategoryReview(activeCategory);
  };

  // CopilotKit suggestions disabled (Phase 5 follow-up: disable for now).
  // See docs/planning/phased-plan-audit.md. Re-enable by restoring
  // the suggestions useMemo and CopilotSidebar JSX wrapper.
  const suggestions: any[] = [];

  return (
    <Box sx={{ p: 3 }}>
      {/* Header with Title (Region B) - Enhanced with Futuristic Styling */}
                  <HeaderSection
              autoPopulatedFields={autoPopulatedFields}
              dataSources={dataSources}
              inputDataPoints={inputDataPoints}
              personalizationData={personalizationData}
              confidenceScores={confidenceScores}
              fieldsReady={fieldsReady}
              fieldsTotal={fieldsTotal}
              dataQuality={dataQualityPercent}
              onboardingSources={onboardingSources}
              refreshedLabel={lastAutofillTime ? formatTimeAgo(lastAutofillTime) : null}
              reviewedCount={reviewedValid.length}
              totalCategories={CANONICAL_CATEGORIES.length}
              allCategoriesReviewed={allCategoriesReviewed}
              unreviewedCategories={[...unreviewedCategories]}
              loading={loading}
              onAutofill={() => autofillStrategyFields()}
              onRegenerateAI={() => regenerateAIFields()}
              onReviewNext={handleScrollToReview}
              onCreateStrategy={handleCreateStrategy}
              lastAutofillTime={lastAutofillTime}
              dataSource={dataSource}
            />

      {/* Error Alert */}
      <ErrorAlert
        error={error}
        onRetry={errorSource === 'generation' ? retryGeneration : retryAutofill}
        onShowDataSourceTransparency={() => setShowDataSourceTransparency(true)}
      />

      {/* Strategy Display and Success Alerts */}
      <StrategyDisplay
        currentStrategy={currentStrategy}
        error={error}
        categoryCompletionMessage={categoryCompletionMessage}
        onViewStrategicIntelligence={() => window.location.href = '/content-planning?tab=strategic-intelligence'}
      />

      <Grid container spacing={3}>
        {/* Category Overview Panel */}
        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 3, height: 'fit-content', position: 'sticky', top: 20, background: 'linear-gradient(180deg, #f7f9fc, #eef3fb)' }}>
            {/* Enhanced Completion Tracker - Integrated into Category List */}
            <ProgressTracker
              reviewProgressPercentage={reviewProgressPercentage}
              reviewedCategoriesCount={reviewedCategoriesCount}
              totalCategories={totalCategories}
              autoPopulatedFields={autoPopulatedFields}
              aiGenerating={aiGenerating}
              onShowAIRecommendations={() => setShowAIRecommendations(true)}
              onShowDataSourceTransparency={() => setShowDataSourceTransparency(true)}
               onRefreshData={() => autofillStrategyFields()}
               onRefreshAI={() => autofillStrategyFields()}
            />

            {/* Category Progress - Compact with Futuristic Styling */}
            <Typography variant="h6" gutterBottom sx={{ mb: 1.5, fontSize: '1rem' }}>
              Category Progress
            </Typography>
            
            <CategoryList
              completionStats={completionStats}
              formData={formData}
              STRATEGIC_INPUT_FIELDS={STRATEGIC_INPUT_FIELDS}
              activeCategory={activeCategory}
              reviewedCategories={reviewedCategories}
              isMarkingReviewed={isMarkingReviewed}
              isNextInSequence={isNextInSequence}
              onReviewCategory={handleReviewCategory}
              onShowEducationalInfo={handleShowEducationalInfo}
            />
            

          </Paper>
        </Grid>

        {/* Main Content Area */}
        <Grid item xs={12} md={8}>
          <Paper sx={{ p: 3, minHeight: '600px', background: 'linear-gradient(180deg, #faf7ff, #f1f0ff)' }}>
            <div ref={reviewSectionRef}>
              <CategoryDetailView
                activeCategory={activeCategory}
                formData={formData}
                formErrors={formErrors}
                autoPopulatedFields={autoPopulatedFields}
                dataSources={dataSources}
                inputDataPoints={inputDataPoints}
                personalizationData={personalizationData}
                completionStats={completionStats}
                reviewedCategories={reviewedCategories}
                isMarkingReviewed={isMarkingReviewed}
                showEducationalInfo={showEducationalInfo}
                // Phase E #42: optimistic UI — fields go read-only while AI
                // generates so users cannot edit beneath a running generation.
                disabledInputs={aiGenerating}
                STRATEGIC_INPUT_FIELDS={STRATEGIC_INPUT_FIELDS}
                onUpdateFormField={updateFormField}
                onValidateFormField={validateFormField}
                onShowTooltip={setShowTooltip}
                onViewDataSource={(fieldId) => {
                  // If a specific field is provided, show field-specific data source info
                  if (fieldId) {
                    devLog.log('🎯 Viewing data source for field:', fieldId);
                    // For now, just open the general data source transparency modal
                    // In the future, this could open a field-specific modal
                    setShowDataSourceTransparency(true);
                  } else {
                    setShowDataSourceTransparency(true);
                  }
                }}
                onConfirmCategoryReview={handleConfirmCategoryReviewWrapper}
                onSetActiveCategory={setActiveCategory}
                onSetShowEducationalInfo={setShowEducationalInfo}
                getCategoryIcon={getCategoryIcon}
                getCategoryColor={getCategoryColor}
                getEducationalContent={getEducationalContent}
              />
            </div>
          </Paper>
        </Grid>
      </Grid>

      {/* Action Buttons */}
      <ActionButtons
        aiGenerating={aiGenerating}
        saving={saving}
        reviewProgressPercentage={reviewProgressPercentage}
        onCreateStrategy={handleCreateStrategy}
        onSaveStrategy={() => handleSaveStrategy()}
      />

      {/* AI Recommendations Modal */}
      <Dialog 
        open={showAIRecModal}
        onClose={() => setShowAIRecModal(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          <Box display="flex" alignItems="center" gap={1}>
            <AutoAwesomeIcon color="primary" />
            AI Recommendations
          </Box>
        </DialogTitle>
        <DialogContent>
          <Typography variant="body1" gutterBottom>
            AI recommendations are being generated for your strategy. This process may take a few minutes.
          </Typography>
          <LinearProgress variant="indeterminate" sx={{ mt: 2 }} />
        </DialogContent>
      </Dialog>

      {/* Enhanced Educational Modal for Strategy Generation */}
      <EducationalModal
        open={showEducationalModal}
        onClose={() => setShowEducationalModal(false)}
        // Phase E #22: the backend's real step (1..8) drives the phase label.
        currentStep={storeGenerationStep}
        // Phase E #41: Cancel aborts the in-flight polling loop.
        onCancel={cancelGeneration}
                educationalContent={storeEducationalContent}      
        generationProgress={storeGenerationProgress}
        onReviewStrategy={() => {
          setShowEducationalModal(false);
          
          // Set flag to indicate coming from strategy builder
          sessionStorage.setItem('fromStrategyBuilder', 'true');
          
          // Navigate to content planning dashboard with Content Strategy tab active
          navigate('/content-planning', { 
            state: { 
              activeTab: 0, // 0 = Content Strategy tab
              fromStrategyBuilder: true 
            }
          });
        }}
      />

      {/* Data Source Transparency Modal */}
      <Dialog 
        open={showDataSourceTransparency} 
        onClose={() => setShowDataSourceTransparency(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <InfoIcon />
            Data Source Transparency
          </Box>
        </DialogTitle>
        <DialogContent>
          <DataSourceTransparency 
            autoPopulatedFields={autoPopulatedFields}
            dataSources={dataSources}
            inputDataPoints={inputDataPoints} // Use real input data points from store
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowDataSourceTransparency(false)}>
            Close
          </Button>
        </DialogActions>
      </Dialog>

      {/* Strategy Autofill Transparency Modal */}
      <StrategyAutofillTransparencyModal
        open={transparencyModalOpen}
        onClose={() => {
          setTransparencyModalOpen(false);
        }}
        autoPopulatedFields={autoPopulatedFields}
        dataSources={dataSources}
        inputDataPoints={inputDataPoints}
        isGenerating={isGenerating}
        generationProgress={storeGenerationProgress}
        currentPhase={currentPhase}
        educationalContent={storeEducationalContent}
        transparencyMessages={transparencyMessages}
        error={error}
      />

      {/* Enterprise Datapoints Modal */}
      <EnterpriseDatapointsModal
        open={showEnterpriseModal}
        onClose={() => {
          setShowEnterpriseModal(false);
          sessionStorage.removeItem('showEnterpriseModal'); // Clear sessionStorage
        }}
        onProceedWithCurrent={handleProceedWithCurrentStrategy}
        onAddEnterpriseDatapoints={handleAddEnterpriseDatapoints}
      />

      {/* Tooltip */}
      {showTooltip && (
        <EnhancedTooltip
          fieldId={showTooltip}
          open={!!showTooltip}
          onClose={() => setShowTooltip(null)}
        />
      )}
    </Box>
  );
};

export default ContentStrategyBuilder; 

