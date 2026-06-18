import { useCallback } from 'react';
import { useCopilotAction } from "@copilotkit/react-core";
import { contentPlanningApi } from '../../../../services/contentPlanningApi';
import { useStrategyBuilderStore } from '../../../../stores/strategyBuilderStore';
import { useEnhancedStrategyStore } from '../../../../stores/enhancedStrategyStore';

export const useCopilotActions = () => {
  // Hook initialized - actions are available

  // Get store methods for updating form state
  const {
    formData,
    updateFormField,
    validateFormField,
    setError,
    calculateCompletionPercentage,
    getCompletionStats
  } = useStrategyBuilderStore();

  // Get enhanced strategy store methods for transparency modal
  const {
    setTransparencyModalOpen,
    setTransparencyGenerating,
    setTransparencyGenerationProgress,
    setCurrentPhase,
    clearTransparencyMessages,
    addTransparencyMessage,
    setAIGenerating
  } = useEnhancedStrategyStore();

  // Helper function to trigger transparency modal flow (same as handleAIRefresh)
  const triggerTransparencyFlow = async (actionType: string, actionDescription: string) => {
    // Open transparency modal and initialize transparency state
    setTransparencyModalOpen(true);
    setTransparencyGenerating(true);
    setTransparencyGenerationProgress(0);
    setCurrentPhase(`${actionType}_initialization`);
    clearTransparencyMessages();
    addTransparencyMessage(`Starting ${actionDescription}...`);
    
    setAIGenerating(true);

    // Start transparency message polling for visual feedback
    const transparencyMessages = [
      { type: `${actionType}_initialization`, message: `Starting ${actionDescription}...`, progress: 5 },
      { type: `${actionType}_data_collection`, message: 'Collecting and analyzing data sources...', progress: 15 },
      { type: `${actionType}_data_quality`, message: 'Assessing data quality and completeness...', progress: 25 },
      { type: `${actionType}_context_analysis`, message: 'Analyzing business context and strategic framework...', progress: 35 },
      { type: `${actionType}_strategy_generation`, message: 'Generating strategic insights and recommendations...', progress: 45 },
      { type: `${actionType}_field_generation`, message: 'Generating individual strategy input fields...', progress: 55 },
      { type: `${actionType}_quality_validation`, message: 'Validating generated strategy inputs...', progress: 65 },
      { type: `${actionType}_alignment_check`, message: 'Checking strategy alignment and consistency...', progress: 75 },
      { type: `${actionType}_final_review`, message: 'Performing final review and optimization...', progress: 85 },
      { type: `${actionType}_complete`, message: `${actionDescription} completed successfully...`, progress: 95 }
    ];
    
    let messageIndex = 0;
    const transparencyInterval = setInterval(() => {
      if (messageIndex < transparencyMessages.length) {
        const message = transparencyMessages[messageIndex];
        setCurrentPhase(message.type);
        addTransparencyMessage(message.message);
        setTransparencyGenerationProgress(message.progress);
        messageIndex++;
      } else {
        clearInterval(transparencyInterval);
      }
    }, 2000); // Send a message every 2 seconds for better UX

    return { transparencyInterval };
  };

  // Action 1: Test action (no parameters)
  const testAction = useCallback(async () => {
    console.log("🎉 Test action executed successfully!");
    return { 
      success: true, 
      message: "Test action worked! You can now use CopilotKit actions.",
      timestamp: new Date().toISOString(),
      formStatus: {
        completionPercentage: calculateCompletionPercentage(),
        filledFields: Object.keys(formData).filter(key => formData[key]),
        totalFields: 30
      }
    };
  }, [formData, calculateCompletionPercentage]);

  // Action 2: Populate individual field
  const populateStrategyField = useCallback(async ({ fieldId, value, reasoning }: any) => {
    try {
      console.log(`📝 Populating field ${fieldId} with value: ${value}`);
      
      // Call backend API for intelligent field population
      await contentPlanningApi.generateCategoryData(
        'individual_field', 
        `Populate ${fieldId} with: ${value}. Reasoning: ${reasoning || 'User request'}`,
        formData
      );
      
      // Update form state with the new value
      updateFormField(fieldId, value);
      
      // Validate the field after population
      const validation = validateFormField(fieldId);
      
      if (reasoning) {
        console.log(`💭 Reasoning: ${reasoning}`);
      }
      
      return { 
        success: true, 
        message: `Field ${fieldId} populated successfully with: ${value}`,
        fieldId,
        value,
        reasoning,
        validation,
        formStatus: {
          completionPercentage: calculateCompletionPercentage(),
          filledFields: Object.keys(formData).filter(key => formData[key]),
          totalFields: 30
        }
      };
    } catch (error: any) {
      console.error(`❌ Failed to populate field ${fieldId}:`, error);
      setError(`Failed to populate field ${fieldId}: ${error.message}`);
      return { success: false, message: error.message || 'Unknown error' };
    }
  }, [formData, updateFormField, validateFormField, setError, calculateCompletionPercentage]);

  // Action 3: Bulk populate category
  const populateStrategyCategory = useCallback(async ({ category, userDescription }: any) => {
    try {
      console.log(`📊 Populating category ${category} with description: ${userDescription}`);
      
      // Start transparency flow for category population
      const { transparencyInterval } = await triggerTransparencyFlow('category_population', `Category population for ${category}`);
      
      // Call backend API to generate category data
      const response = await contentPlanningApi.generateCategoryData(
        category, 
        userDescription, 
        formData
      );
      
      // Clear the transparency interval since we got the response
      clearInterval(transparencyInterval);
      
      // Update all fields in the category
      const populatedFields: string[] = [];
      if (response.data && response.data.data) {
        Object.entries(response.data.data).forEach(([fieldId, value]) => {
          updateFormField(fieldId, value as string);
          populatedFields.push(fieldId);
        });
      }
      
      // Add final completion message
      addTransparencyMessage(`✅ Category ${category} populated successfully! Generated ${populatedFields.length} fields.`);
      setTransparencyGenerationProgress(100);
      setCurrentPhase('Complete');
      
      // Reset generation state
      setAIGenerating(false);
      setTransparencyGenerating(false);
      
      return { 
        success: true, 
        message: `Category ${category} populated successfully based on: ${userDescription}`,
        category,
        userDescription,
        populatedFields,
        formStatus: {
          completionPercentage: calculateCompletionPercentage(),
          filledFields: Object.keys(formData).filter(key => {
            const value = formData[key];
            return value && typeof value === 'string' && value.trim() !== '';
          }),
          totalFields: 30
        }
      };
    } catch (error: any) {
      console.error(`❌ Failed to populate category ${category}:`, error);
      setError(`Failed to populate category ${category}: ${error.message}`);
      setTransparencyModalOpen(false);
      setAIGenerating(false);
      setTransparencyGenerating(false);
      return { success: false, message: error.message || 'Unknown error' };
    }
  }, [formData, updateFormField, setError, calculateCompletionPercentage, setTransparencyModalOpen, setTransparencyGenerating, setTransparencyGenerationProgress, setCurrentPhase, addTransparencyMessage, setAIGenerating, triggerTransparencyFlow]);

  // Action 4: Validate field
  const validateStrategyField = useCallback(async ({ fieldId }: any) => {
    try {
      console.log(`✅ Validating field ${fieldId}`);
      
      const currentValue = formData[fieldId];
      
      // Call backend API for field validation
      const response = await contentPlanningApi.validateField(fieldId, currentValue);
      
      // Also validate locally
      const localValidation = validateFormField(fieldId);
      
      return { 
        success: true, 
        validation: { 
          isValid: localValidation,
          suggestion: response.data?.suggestion || `Field ${fieldId} looks good! Consider adding more specific details if needed.`,
          confidence: response.data?.confidence || 0.8
        },
        fieldId,
        currentValue,
        formStatus: {
          completionPercentage: calculateCompletionPercentage(),
          filledFields: Object.keys(formData).filter(key => formData[key]),
          totalFields: 30
        }
      };
    } catch (error: any) {
      console.error(`❌ Failed to validate field ${fieldId}:`, error);
      setError(`Failed to validate field ${fieldId}: ${error.message}`);
      return { success: false, message: error.message || 'Unknown error' };
    }
  }, [formData, validateFormField, setError, calculateCompletionPercentage]);

  // Action 5: Review strategy
  const reviewStrategy = useCallback(async () => {
    try {
      console.log("🔍 Reviewing strategy");
      
      // Call backend API for strategy analysis
      const response = await contentPlanningApi.analyzeStrategy(formData);
      
      const completionStats = getCompletionStats();
      
      return { 
        success: true, 
        review: { 
          completeness: calculateCompletionPercentage(),
          suggestions: response.data?.suggestions || [
            "Your strategy looks good overall!",
            "Consider adding more specific target audience details",
            "Include measurable goals and KPIs"
          ],
          missingFields: response.data?.missingFields || [],
          improvements: response.data?.improvements || [],
          categoryProgress: completionStats.category_completion,
          timestamp: new Date().toISOString()
        },
        formStatus: {
          completionPercentage: calculateCompletionPercentage(),
          filledFields: Object.keys(formData).filter(key => formData[key]),
          totalFields: 30
        }
      };
    } catch (error: any) {
      console.error("❌ Failed to review strategy:", error);
      setError(`Failed to review strategy: ${error.message}`);
      return { success: false, message: error.message || 'Unknown error' };
    }
  }, [formData, calculateCompletionPercentage, getCompletionStats, setError]);

  // Action 6: Generate suggestions
  const generateSuggestions = useCallback(async ({ fieldId }: any) => {
    try {
      console.log(`💡 Generating suggestions for field ${fieldId}`);
      
      // Call backend API for field suggestions
      const response = await contentPlanningApi.generateFieldSuggestions(fieldId, formData);
      
      return { 
        success: true, 
        suggestions: response.data?.suggestions || [
          `Suggestion 1 for ${fieldId}: Focus on specific, measurable outcomes`,
          `Suggestion 2 for ${fieldId}: Consider your target audience's pain points`,
          `Suggestion 3 for ${fieldId}: Align with your overall business objectives`
        ],
        reasoning: response.data?.reasoning || `Based on your current strategy context, here are some suggestions for ${fieldId}`,
        confidence: response.data?.confidence || 0.8,
        fieldId,
        formStatus: {
          completionPercentage: calculateCompletionPercentage(),
          filledFields: Object.keys(formData).filter(key => formData[key]),
          totalFields: 30
        }
      };
    } catch (error: any) {
      console.error(`❌ Failed to generate suggestions for ${fieldId}:`, error);
      setError(`Failed to generate suggestions for ${fieldId}: ${error.message}`);
      return { success: false, message: error.message || 'Unknown error' };
    }
  }, [formData, calculateCompletionPercentage, setError]);

  // Action 7: Auto-fill strategy fields (unified DB + AI)
  const autofillStrategyFields = useCallback(async () => {
    try {
      console.log("🔄 Auto-filling strategy fields");
      const response = await contentPlanningApi.autofill();

      if (!response) {
        throw new Error('Invalid response from autofill endpoint');
      }

      const fields = response.fields || {};
      const sources = response.sources || {};
      const inputDataPoints = response.input_data_points || {};

      if (Object.keys(fields).length === 0) {
        setError('Autofill failed to produce strategy fields. Please try again.');
        return { success: false, message: 'No fields generated.' };
      }

      const fieldValues: Record<string, any> = {};
      const confidenceScores: Record<string, number> = {};

      Object.keys(fields).forEach((fieldId) => {
        const fieldData = fields[fieldId];
        if (fieldData && typeof fieldData === 'object' && 'value' in fieldData) {
          fieldValues[fieldId] = fieldData.value;
          if (fieldData.confidence) {
            confidenceScores[fieldId] = fieldData.confidence;
          }
        }
      });

      useStrategyBuilderStore.setState((state) => ({
        autoPopulatedFields: fieldValues,
        dataSources: sources,
        inputDataPoints: inputDataPoints,
        confidenceScores: confidenceScores,
        formData: { ...state.formData, ...fieldValues },
      }));

      return { success: true, message: `Auto-populated ${Object.keys(fieldValues).length} fields` };
    } catch (error: any) {
      console.error("❌ Failed to auto-populate:", error);
      setError(`Autofill failed: ${error.message}`);
      return { success: false, message: error.message || 'Unknown error' };
    }
  }, [formData, setError]);

  // Call useCopilotAction hooks unconditionally - they will handle context availability internally
  // This is the only way to comply with React hooks rules
  (useCopilotAction as unknown as (config: any) => void)({
    name: "testAction",
    description: "A simple test action to verify CopilotKit functionality. Use this to test if the assistant can execute actions and understand the current form state.",
    handler: testAction
  });

  (useCopilotAction as unknown as (config: any) => void)({
    name: "populateStrategyField",
    description: "Intelligently populate a strategy field with contextual data. Use this to fill in specific form fields. The assistant will understand the current form state and provide appropriate values.",
    parameters: [
      { name: "fieldId", type: "string", required: true, description: "The ID of the field to populate (e.g., 'business_objectives', 'target_audience', 'content_goals')" },
      { name: "value", type: "string", required: true, description: "The value to populate the field with" },
      { name: "reasoning", type: "string", required: false, description: "Explanation for why this value was chosen" }
    ],
    handler: populateStrategyField
  });

  (useCopilotAction as unknown as (config: any) => void)({
    name: "populateStrategyCategory",
    description: "Populate all fields in a specific category based on user description. Use this to fill multiple related fields at once. Categories include: 'business_context', 'audience_intelligence', 'competitive_intelligence', 'content_strategy', 'performance_analytics'.",
    parameters: [
      { name: "category", type: "string", required: true, description: "The category of fields to populate (e.g., 'business_context', 'audience_intelligence', 'content_strategy')" },
      { name: "userDescription", type: "string", required: true, description: "User's description of what they want to achieve with this category" }
    ],
    handler: populateStrategyCategory
  });

  (useCopilotAction as unknown as (config: any) => void)({
    name: "validateStrategyField",
    description: "Validate a strategy field and provide improvement suggestions. Use this to check if a field value is appropriate and get suggestions for improvement.",
    parameters: [
      { name: "fieldId", type: "string", required: true, description: "The ID of the field to validate" }
    ],
    handler: validateStrategyField
  });

  (useCopilotAction as unknown as (config: any) => void)({
    name: "reviewStrategy",
    description: "Comprehensive strategy review with AI analysis. Use this to get a complete overview of your strategy's completeness, coherence, and quality. The assistant will analyze all 30 fields and provide detailed feedback.",
    handler: reviewStrategy
  });

  (useCopilotAction as unknown as (config: any) => void)({
    name: "generateSuggestions",
    description: "Generate contextual suggestions for incomplete fields. Use this to get ideas for specific fields based on your current strategy context and onboarding data.",
    parameters: [
      { name: "fieldId", type: "string", required: true, description: "The ID of the field to generate suggestions for" }
    ],
    handler: generateSuggestions
  });

  (useCopilotAction as unknown as (config: any) => void)({
    name: "autofillStrategyFields",
    description: "Auto-fill strategy fields using onboarding data + AI. Use this to automatically fill all strategy fields.",
    handler: autofillStrategyFields
  });

  // Return action handlers for direct use if needed
  return {
    testAction,
    populateStrategyField,
    populateStrategyCategory,
    validateStrategyField,
    reviewStrategy,
    generateSuggestions,
    autofillStrategyFields
  };
};
