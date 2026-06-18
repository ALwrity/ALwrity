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
import {
  AutoAwesome as AutoAwesomeIcon,
  Info as InfoIcon
} from '@mui/icons-material';
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
import { useStrategyCreation } from './ContentStrategyBuilder/hooks/useStrategyCreation';

// CopilotKit actions are now initialized at the dashboard level

// Import CopilotKit hooks
import { useCopilotReadable, useCopilotAdditionalInstructions } from "@copilotkit/react-core";

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
import { CopilotSidebar } from '@copilotkit/react-ui';
import { useCopilotActions } from './ContentStrategyBuilder/CopilotActions';

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
    loading,
    error,
    saving,
    currentStrategy,
    updateFormField,
    validateFormField,
    validateAllFields,
    autofillStrategyFields,
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
    setEducationalContent: setStoreEducationalContent,
    addTransparencyMessage,
    clearTransparencyMessages,
    setTransparencyGenerating: setIsGenerating,
    generateAIRecommendations,
    setAIGenerating
  } = useEnhancedStrategyStore();

  // Initialize Copilot actions (component is only rendered when Strategy Builder tab is active)
  useCopilotActions();

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

  // Provide form state context
  useCopilotReadable({
    description: "Current strategy form state and field data. This shows the current state of the 30+ strategy form fields.",
    value: formStateContext
  });

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

  // Provide field definitions context
  useCopilotReadable({
    description: "Strategy field definitions and requirements. This contains all 30+ form fields with their descriptions, requirements, and categories.",
    value: fieldDefinitionsContext
  });

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

  // Provide onboarding data context
  useCopilotReadable({
    description: "User onboarding data for personalization. This contains the user's website analysis, research preferences, and profile information.",
    value: onboardingDataContext
  });

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

  const copilotInstructions = useMemo(() => `
      You are ALwrity's Strategy Assistant, helping users create comprehensive content strategies.
      
      IMPORTANT CONTEXT:
      - You are working with a form that has 30+ strategy fields
      - Current form completion: ${completionPercentage}%
      - Active category: ${activeCategory}
      - Filled fields: ${filledCount}/30
      - Empty fields: ${emptyCount}/30
      
      AVAILABLE ACTIONS:
      - testAction: Test if actions are working
      - populateStrategyField: Fill a specific field
      - populateStrategyCategory: Fill multiple fields in a category
      - validateStrategyField: Check if a field is valid
      - reviewStrategy: Get overall strategy review
      - generateSuggestions: Get suggestions for a field
      - autofillStrategyFields: Auto-fill using onboarding + AI data
      
      SUGGESTIONS CONTEXT:
      - Users can click on suggestion buttons to quickly start common tasks
      - Suggestions are context-aware and change based on form completion
      - Always acknowledge when a user clicks a suggestion and explain what you'll do
      - Provide immediate value when suggestions are used
      
      GUIDELINES:
      - When users ask about "fields", they mean the 30+ strategy form fields
      - Always reference real onboarding data when available
      - Provide specific, actionable suggestions
      - Explain the reasoning behind recommendations
      - Help users understand field relationships
      - Suggest next steps based on current progress
      - Use actual database data, never mock data
      - Be specific about which fields you're referring to
      - When users click suggestions, immediately execute the requested action
      - Provide clear feedback on what you're doing and why
    `, [completionPercentage, activeCategory, filledCount, emptyCount]);

  // Provide dynamic instructions
  useCopilotAdditionalInstructions({
    instructions: copilotInstructions
  });

  // Create a state for educational modal that can be passed to both hooks
  const [showEducationalModal, setShowEducationalModal] = useState(false);
  const [showEnterpriseModal, setShowEnterpriseModal] = useState(false);

  // Persist enterprise modal state across hot reloads
  useEffect(() => {
    const savedModalState = sessionStorage.getItem('showEnterpriseModal');
    if (savedModalState === 'true') {
      console.log('🎯 Restoring enterprise modal state from sessionStorage');
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

  // Use strategy creation hook first
  const { originalHandleCreateStrategy, handleSaveStrategy } = useStrategyCreation({
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
    contentPlanningApi
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
    autoPopulateFromOnboarding: autofillStrategyFields,
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

  // Handle continue with present values
  const handleContinueWithPresent = () => {
    console.log('🎯 Continuing with present autofilled values');
    // This will show the next button and allow user to proceed
  };

  // Determine if we have autofill data
  const hasAutofillData = Object.keys(autoPopulatedFields).length > 0;
  
  // Get last autofill time from session storage or use current time
  const lastAutofillTime = sessionStorage.getItem('lastAutofillTime') || new Date().toISOString();
  
  // Get data source from store
  const dataSource = Object.keys(dataSources).length > 0 ? 'Onboarding Database' : undefined;

  // Log autofill data status for debugging (only log when values actually change)
  const autoPopulatedFieldsCount = Object.keys(autoPopulatedFields).length;
  const dataSourcesCount = Object.keys(dataSources).length;
  const inputDataPointsCount = Object.keys(inputDataPoints).length;
  const personalizationDataCount = Object.keys(personalizationData || {}).length;
  const confidenceScoresCount = Object.keys(confidenceScores).length;

  useEffect(() => {
    // Only log in development and when there's meaningful data change
    if (process.env.NODE_ENV === 'development' && (autoPopulatedFieldsCount > 0 || dataSourcesCount > 0)) {
      console.log('📋 StrategyBuilder: Autofill data status:', {
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
  }, [hasAutofillData, autoPopulatedFieldsCount, dataSourcesCount, inputDataPointsCount, personalizationDataCount, confidenceScoresCount, lastAutofillTime, dataSource]);



  // Enhanced handleCreateStrategy to show enterprise modal
  const handleCreateStrategy = () => {
    console.log('🎯 handleCreateStrategy called');
    console.log('🎯 completionStats.category_completion:', completionStats.category_completion);
    console.log('🎯 reviewedCategories:', reviewedCategories);
    console.log('🎯 Current showEnterpriseModal state:', showEnterpriseModal);
    console.log('🎯 Current aiGenerating state:', aiGenerating);
    
    // Prevent multiple calls
    if (aiGenerating) {
      console.log('🎯 Already generating, skipping duplicate call');
      return;
    }
    
    // Check if all categories are reviewed
    const allCategoriesReviewed = Object.keys(completionStats.category_completion).every(
      category => Array.from(reviewedCategories).includes(category)
    );

    console.log('🎯 allCategoriesReviewed:', allCategoriesReviewed);

    if (allCategoriesReviewed) {
      // Show enterprise modal instead of creating strategy immediately
      console.log('🎯 Showing enterprise modal - setting to true');
      setShowEnterpriseModal(true);
      
      // Add debugging to confirm modal state change
      setTimeout(() => {
        console.log('🎯 Enterprise modal state after setShowEnterpriseModal(true):', showEnterpriseModal);
      }, 0);
      
      // Return early to prevent calling originalHandleCreateStrategy
      return;
    } else {
      // If not all categories reviewed, proceed with original logic
      console.log('🎯 Not all categories reviewed, proceeding with original logic');
      originalHandleCreateStrategy();
    }
  };



  // Removed: Auto-population consent modal (replaced with buttons in HeaderSection)

  // Set default category selection
  useEffect(() => {
    // Only set default category once when component mounts and we have categories
    if (hasSetDefaultCategory.current) {
      console.log('🔍 Default category useEffect: SKIPPED - already set default');
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
      console.warn('Enterprise modal closed while AI is generating');
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

  // Memoize suggestions to prevent unnecessary re-renders
  const suggestions = useMemo(() => {
    const filledFields = Object.keys(formData).filter(key => {
      const value = formData[key];
      return value && typeof value === 'string' && value.trim() !== '';
    }).length;
    const totalFields = Object.keys(STRATEGIC_INPUT_FIELDS).length;
    const emptyFields = totalFields - filledFields;
    const completionPercentage = calculateCompletionPercentage();
    
    // All 7 CopilotKit actions as suggestions
    const allSuggestions = [
      {
        title: "🚀 Auto-populate from onboarding",
        message: "auto populate the strategy fields using my onboarding data with detailed progress tracking"
      },
      {
        title: "📊 Review my strategy",
        message: "review the overall strategy and identify gaps"
      },
      {
        title: "✅ Validate strategy quality",
        message: "validate my strategy fields and suggest improvements"
      },
      {
        title: "💡 Get field suggestions",
        message: "generate contextual suggestions for incomplete fields"
      },
      {
        title: "📝 Fill specific field",
        message: "help me populate a specific strategy field with intelligent data"
      },
      {
        title: "🎯 Populate category",
        message: "fill multiple fields in a specific category based on my description"
      },
      {
        title: "🧪 Test CopilotKit",
        message: "test if all CopilotKit actions are working properly"
      }
    ];

    // Add context-aware dynamic suggestions based on completion
    const dynamicSuggestions = [];

    if (emptyFields > 0) {
      dynamicSuggestions.push({
        title: `🔧 Fill ${emptyFields} empty fields`,
        message: `help me populate the ${emptyFields} remaining empty fields in my strategy`
      });
    }

    // Add category-specific suggestions
    if (activeCategory) {
      dynamicSuggestions.push({
        title: `🎯 Improve ${activeCategory}`,
        message: `generate suggestions for the ${activeCategory} category`
      });
    }

    // Add next steps suggestion for high completion
    if (completionPercentage > 80) {
      dynamicSuggestions.push({
        title: "🚀 Next steps",
        message: "what are the next steps to complete my content strategy?"
      });
    }

    // Combine all suggestions - prioritize dynamic ones first, then all actions
    const combinedSuggestions = [...dynamicSuggestions, ...allSuggestions];
    
    // Return all suggestions (no limit) to show full CopilotKit capabilities
    return combinedSuggestions;
  }, [formData, activeCategory, calculateCompletionPercentage]);

  return (
    <CopilotSidebar
      labels={{
        title: "ALwrity Strategy Assistant",
        initial: "Hi! I'm here to help you build your content strategy. I can auto-populate fields, provide guidance, and ensure your strategy is comprehensive. Check out the suggestions below to see all available actions, or just ask me anything!"
      }}
      suggestions={suggestions}
      observabilityHooks={{
        onChatExpanded: () => console.log("Strategy assistant opened"),
        onMessageSent: (message: any) => console.log("Strategy message sent", { message }),
        onFeedbackGiven: (messageId: string, type: string) => console.log("Strategy feedback", { messageId, type })
      }}
    >
      <Box sx={{ p: 3 }}>
      {/* Header with Title (Region B) - Enhanced with Futuristic Styling */}
                  <HeaderSection
              autoPopulatedFields={autoPopulatedFields}
              dataSources={dataSources}
              inputDataPoints={inputDataPoints}
              personalizationData={personalizationData}
              confidenceScores={confidenceScores}
              loading={loading}
              error={error}
                onAutofill={() => autofillStrategyFields()}
               onRegenerateAI={() => regenerateAIFields()}
               onContinueWithPresent={handleContinueWithPresent}
               onScrollToReview={handleScrollToReview}
               hasAutofillData={hasAutofillData}
               lastAutofillTime={lastAutofillTime}
               dataSource={dataSource}
             />

      {/* Error Alert */}
      <ErrorAlert
        error={error}
        onRetry={() => autofillStrategyFields()}
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
                STRATEGIC_INPUT_FIELDS={STRATEGIC_INPUT_FIELDS}
                onUpdateFormField={updateFormField}
                onValidateFormField={validateFormField}
                onShowTooltip={setShowTooltip}
                onViewDataSource={(fieldId) => {
                  // If a specific field is provided, show field-specific data source info
                  if (fieldId) {
                    console.log('🎯 Viewing data source for field:', fieldId);
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
    </CopilotSidebar>
  );
};

export default ContentStrategyBuilder; 