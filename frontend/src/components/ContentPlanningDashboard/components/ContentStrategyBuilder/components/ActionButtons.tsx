import { devLog } from '../../../../../utils/devLogger';
import React, { useRef } from 'react';
import {
  Box,
  Button,
  Tooltip as MuiTooltip
} from '@mui/material';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import SaveIcon from '@mui/icons-material/Save';
import { useUser } from '@clerk/clerk-react';
import { ActionButtonsProps, ActionButtonsBusinessLogicProps } from '../types/contentStrategy.types';
import { useContentPlanningStore } from '../../../../../stores/contentPlanningStore';
import { useStrategyBuilderStore, STRATEGIC_INPUT_FIELDS } from '../../../../../stores/strategyBuilderStore';
import { describeApiError } from '../../../../../services/apiError';

// Business Logic Hook
export const useActionButtonsBusinessLogic = ({
  formData,
  error,
  currentStrategy,
  setAIGenerating,
  setError,
  setCurrentStrategy,
  setSaving,
  setGenerationProgress,
  setEducationalContent,
  setShowEducationalModal,
  validateAllFields,
  getCompletionStats,
  generateAIRecommendations,
  createEnhancedStrategy,
  contentPlanningApi,
  // Phase E #22: tracks the backend's real step (1..8) on every poll.
  setCurrentStep,
  // Phase C #19/#43: notified on every generation-failure path so the
  // builder can offer a Retry CTA that re-runs generation (not autofill).
  onGenerationError
}: ActionButtonsBusinessLogicProps) => {
  
  // Get the content planning store to cache the latest generated strategy
  const { setLatestGeneratedStrategy } = useContentPlanningStore();
  // Resolve the active Clerk user so payloads carry the right tenant id
  // (the previous hardcoded `user_id: 1` was a multi-tenant collision).
  const { user } = useUser();
  // #8: ref-based in-flight guard — the wrapper aiGenerating state alone
  // cannot stop two rapid handleCreateStrategy calls (state lags the click),
  // which would start two polling loops.
  const isGeneratingRef = useRef(false);
  // Phase E #41: AbortController for the in-flight poll — the modal's
  // Cancel button aborts it so a user can stop a generation instead of
  // riding out the 6-minute timeout (Phase B #7 added the signal plumbing).
  const pollAbortRef = useRef<AbortController | null>(null);

  // Phase D item 14 (#12/#15): ONE payload builder shared by Create (polling)
  // and Save, so both paths send the same complete form plus the autofill /
  // personalization metadata the backend was previously losing.
  const buildStrategyPayload = () => {
    const completionStats = getCompletionStats();
    // #13: formData.id is the form-state id (NOT a backend strategy id) —
    // strip it so it can't leak into the payload/DB row.
    const { id: _formStateId, ...cleanFormData } = formData;
    const { autoPopulatedFields, dataSources, inputDataPoints, personalizationData, confidenceScores } =
      useStrategyBuilderStore.getState();
    return {
      ...cleanFormData,
      completion_percentage: completionStats.completion_percentage,
      user_id: user?.id ?? null,
      name: formData.name || 'Enhanced Content Strategy',
      industry: formData.industry || 'General',
      // #15: personalization signals the backend needs for grounded AI output.
      data_source_transparency: {
        auto_populated_fields: autoPopulatedFields,
        data_sources: dataSources,
        input_data_points: inputDataPoints,
        personalization_data: personalizationData,
        confidence_scores: confidenceScores
      }
    };
  };

  const handleCreateStrategy = async () => {
    try {
      if (isGeneratingRef.current) {
        devLog.log('🛑 Generation already in flight, skipping duplicate call');
        return;
      }
      isGeneratingRef.current = true;
      setAIGenerating(true);
      setError(null);

      // Clear any previous cached strategy when starting new generation
      setLatestGeneratedStrategy(null);
      devLog.log('🧹 Cleared previous cached strategy for new generation');

      devLog.log('Starting strategy creation...');

      // Always use the polling-based strategy generation for consistency
      devLog.log('Using polling-based strategy generation...');
      const isValid = validateAllFields();
      devLog.log('Form validation result:', isValid);

      if (isValid) {
        const strategyData = buildStrategyPayload();

        // Phase I #32: log a value-free summary — never the user's data.
        devLog.log(`Creating strategy with ${Object.keys(strategyData).length} fields`);

        // Use polling-based strategy generation with educational content
        await generateStrategyWithPolling(strategyData);
      } else {
        // Phase C #24: name the missing fields instead of a generic banner
        // (the store already tracks them per-field via formErrors).
        const missing = useStrategyBuilderStore.getState().getMissingRequiredFields();
        const fieldList = missing.length > 0 ? ` Missing: ${missing.join(', ')}.` : '';
        setError(`Please fill in all required fields before generating AI insights.${fieldList}`);
        devLog.error('Form validation failed.', { missing });
      }
    } catch (err: any) {
      // Phase C #17: classify into actionable copy instead of dumping the
      // raw error, and notify the builder so it can offer a Retry CTA.
      const msg = describeApiError(err, 'Error generating AI recommendations');
      setError(msg);
      onGenerationError?.(msg);
      devLog.error('Error in handleCreateStrategy:', err);
    } finally {
      isGeneratingRef.current = false;
      setAIGenerating(false);
    }
  };

  const generateStrategyWithPolling = async (strategyData: any) => {
    try {
      devLog.log('🚀 Starting polling-based strategy generation...');
      
      // Initialize progress and educational content. Phase E #22b: NO
      // fabricated detail checklist / time estimate — the real phases are
      // streamed from the backend on the first poll; until then we say so
      // honestly.
      setGenerationProgress(0);
      setEducationalContent({
        title: '🤖 AI-Powered Strategy Generation',
        description: 'Contacting the AI generation service — live progress and phases will stream in here.'
      });
      
      // Show educational modal
      setShowEducationalModal(true);

      // Phase E #41: new AbortController per generation — its signal is
      // handed to the poll loop so Cancel can actually STOP it.
      const controller = new AbortController();
      pollAbortRef.current = controller;

      // Start polling-based strategy generation with the full payload
      // (Phase D #12: form fields + autofill metadata, same as Save sends).
      const generationResult = await contentPlanningApi.startStrategyGenerationPolling(
        Number(strategyData.user_id) || Number(user?.id),
        strategyData.name || 'Enhanced Content Strategy',
        strategyData
      );
      devLog.log('Strategy generation started:', generationResult);
      devLog.log('Generation result structure:', generationResult);
      devLog.log('Generation result.data:', generationResult?.data);
      devLog.log('Generation result.data.task_id:', generationResult?.data?.task_id);

      // Check for task_id in the correct location based on backend response structure
      const taskId = generationResult?.data?.task_id || generationResult?.task_id;
      devLog.log('Task ID extracted:', taskId);

      if (taskId) {
        devLog.log('Task ID received:', taskId);

        // Start polling for status updates
        devLog.log('🎯 Starting polling for task ID:', taskId);
        contentPlanningApi.pollStrategyGeneration(
          taskId,
          // onProgress callback
          (status: any) => {
            devLog.log('📊 Progress update:', status);
            devLog.log('📊 Status structure:', status);

            // Extract the actual task status from the response data
            const taskStatus = status?.data || status;
            devLog.log('📊 Task status:', taskStatus);

            // Update progress
            if (taskStatus.progress !== undefined) {
              devLog.log('📊 Setting progress:', taskStatus.progress);
              setGenerationProgress(taskStatus.progress);

              // Debug: Check if progress reached 100%
              if (taskStatus.progress >= 100) {
                devLog.log('🎯 Progress reached 100% - modal should show "Next" button');
              }
            }

            // Phase E #22: track the backend's REAL step (1..8) so the modal
            // labels phases from the source of truth, not progress/10.
            if (taskStatus.step !== undefined) {
              setCurrentStep?.(taskStatus.step);
            }

            // Update educational content
            if (taskStatus.educational_content) {
              devLog.log('📚 Updating educational content:', taskStatus.educational_content);
              setEducationalContent(taskStatus.educational_content);
            }
            
            // Update message
            if (taskStatus.message) {
              devLog.log('📝 Status message:', taskStatus.message);
            }
            
            // Update phase if available
            if (taskStatus.step) {
              devLog.log('📊 Current step:', taskStatus.step);
            }
          },
          // onComplete callback
          (strategy: any) => {
            devLog.log('✅ Strategy generation completed successfully!');
            setCurrentStrategy(strategy);
            
            // Cache the latest generated strategy in the content planning store
            devLog.log('💾 Attempting to cache strategy:', {
              strategyId: strategy?.id || strategy?.strategy_id,
              strategyName: strategy?.name || strategy?.strategy_name,
              hasStrategicInsights: !!strategy?.strategic_insights,
              hasCompetitiveAnalysis: !!strategy?.competitive_analysis,
              hasPerformancePredictions: !!strategy?.performance_predictions,
              hasImplementationRoadmap: !!strategy?.implementation_roadmap,
              hasRiskAssessment: !!strategy?.risk_assessment
            });
            setLatestGeneratedStrategy(strategy);
            devLog.log('💾 Cached latest generated strategy in store');
            
            // Set progress to 100% when completion is detected
            setGenerationProgress(100);
            devLog.log('🎯 Setting progress to 100% in onComplete callback');
            // Don't close the modal automatically - let user click the button
            // setShowEducationalModal(false); // REMOVED - let user control modal closure
            devLog.log('🎯 Strategy generation complete - modal should stay open for user to click "Next" button');
          },
          // onError callback
          (error: string) => {
            devLog.error('❌ Strategy generation failed:', error);
            const msg = `Strategy generation failed: ${error}. You can retry.`;
            setError(msg);
            onGenerationError?.(msg);
            setShowEducationalModal(false); // Only close on error
          },
          5000, // 5 second polling interval for faster updates
          120, // 10 minutes max (120 * 5 s) — slow providers legitimately need ~6+ min
          // Phase E #41: cancellation signal — the modal's Cancel button
          // aborts this so the loop stops within one poll cycle.
          pollAbortRef.current?.signal,
          // Phase C #43: retry transient polling failures with backoff
          { maxRetries: 3, baseDelayMs: 2000 }
        );

      } else {
        // Phase C #19: the missing-task-id path now explains recovery
        // instead of a dead-end error.
        const msg = 'Failed to start strategy generation. No task ID received. You can retry.';
        setError(msg);
        onGenerationError?.(msg);
        setShowEducationalModal(false);
      }
    } catch (error: any) {
      devLog.error('Error in polling-based strategy generation:', error);
      const msg = describeApiError(error, 'Error in strategy generation');
      setError(msg);
      onGenerationError?.(msg);
      setShowEducationalModal(false);
    }
  };

  const handleSaveStrategy = async () => {
    try {
      setSaving(true);
      setError(null);

      // Phase D #12: same complete payload as the Create path.
      const strategyData = buildStrategyPayload();

      const newStrategy = await createEnhancedStrategy(strategyData);

      // Phase D item 16 (#16): the create response lacks backend-populated
      // fields (comprehensive_ai_analysis, ai_recommendations, etc.) which
      // are persisted on the DB row — re-read the saved strategy so the UI
      // shows them. Fall back to the create response if the reload fails.
      let finalStrategy = newStrategy;
      const strategyId = newStrategy?.id ?? newStrategy?.strategy_id;
      if (strategyId) {
        try {
          const fresh = await contentPlanningApi.getEnhancedStrategy(strategyId);
          if (fresh) finalStrategy = fresh;
        } catch (reloadErr: any) {
          devLog.warn('Post-save reload failed; using create response.', reloadErr);
        }
      }

      setCurrentStrategy(finalStrategy);

      // Update the cache with the saved strategy
      setLatestGeneratedStrategy(finalStrategy);
      devLog.log('💾 Updated cache with saved strategy', { userId: user?.id });

      // Note: success is signalled by the setCurrentStrategy state
      // change above; we deliberately do NOT call setError on the
      // success path (it would trip the red error banner and
      // pollute the error filter).
    } catch (err: any) {
      // Phase C #17: typed copy for save failures (not a generation failure —
      // no onGenerationError here).
      setError(describeApiError(err, 'Error saving strategy'));
    } finally {
      setSaving(false);
    }
  };

  // Phase E #41: the modal's Cancel action — aborts the in-flight poll,
  // closes the modal and resets the generating flags. A cancel is NOT an
  // error: no banner, no setError — the user chose to stop.
  const cancelGeneration = () => {
    devLog.log('🛑 Generation cancelled by user');
    pollAbortRef.current?.abort();
    pollAbortRef.current = null;
    isGeneratingRef.current = false;
    setShowEducationalModal(false);
    setAIGenerating(false);
  };

  return {
    handleCreateStrategy,
    handleSaveStrategy,
    cancelGeneration
  };
};

// UI Component
const ActionButtons: React.FC<ActionButtonsProps> = ({
  aiGenerating,
  saving,
  reviewProgressPercentage,
  onCreateStrategy,
  onSaveStrategy
}) => {
  // Phase E #25: the Save gate is REQUIRED FIELDS, not just progress —
  // reactive boolean selector (stable identity, no get() trap).
  const allRequiredFieldsComplete = useStrategyBuilderStore((s) => {
    return STRATEGIC_INPUT_FIELDS.every(field => {
      if (!field.required) return true;
      const value = (s.formData as Record<string, any>)[field.id];
      return !!value && !(Array.isArray(value) && value.length === 0);
    });
  });

  return (
    <Box sx={{ mt: 3, display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
      <MuiTooltip
        title={aiGenerating ? 'Track progress in the AI generation window' : 'Creates your strategy and runs an AI deep-dive (2-3 min)'}
        placement="top"
      >
        <span>
          <Button
            variant="outlined"
            startIcon={<AutoAwesomeIcon />}
            onClick={onCreateStrategy}
            disabled={aiGenerating || reviewProgressPercentage < 20}
          >
            {/* #23: the modal owns progress now — the button must not race it. */}
            {aiGenerating ? 'Generating…' : 'Create Strategy with AI'}
          </Button>
        </span>
      </MuiTooltip>

      <MuiTooltip
        title={
          saving
            ? 'Saving your draft...'
            : allRequiredFieldsComplete
              ? 'Saves your form as a draft without AI generation'
              : 'Fill in all required fields to save your draft'
        }
        placement="top"
      >
        <span>
          <Button
            variant="contained"
            startIcon={<SaveIcon />}
            onClick={onSaveStrategy}
            // Phase E #25: gate on required fields, not just progress.
            disabled={saving || reviewProgressPercentage < 10 || !allRequiredFieldsComplete}
          >
            {saving ? 'Saving...' : 'Save Draft'}
          </Button>
        </span>
      </MuiTooltip>
    </Box>
  );
};

export default ActionButtons; 
