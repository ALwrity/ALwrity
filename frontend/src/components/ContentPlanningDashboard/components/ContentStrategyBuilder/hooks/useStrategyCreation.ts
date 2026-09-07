import { useActionButtonsBusinessLogic } from '../components/ActionButtons';

interface UseStrategyCreationProps {
  formData: any;
  error: string | null;
  currentStrategy: any;
  setAIGenerating: (generating: boolean) => void;
  setError: (error: string | null) => void;
  setCurrentStrategy: (strategy: any) => void;
  setSaving: (saving: boolean) => void;
  setGenerationProgress: (progress: number) => void;
  setEducationalContent: (content: any) => void;
  setShowEducationalModal: (show: boolean) => void;
  validateAllFields: () => boolean;
  getCompletionStats: () => any;
  generateAIRecommendations: (strategyId: string) => Promise<void>;
  createEnhancedStrategy: (data: any) => Promise<any>;
  contentPlanningApi: any;
  /** Phase E #22: tracks the backend's real step on every poll. */
  setCurrentStep?: (step: number) => void;
  /** Phase C #19/#43: forwarded to the ActionButtons hook for the retry CTA. */
  onGenerationError?: (message: string) => void;
}

export const useStrategyCreation = ({
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
  setCurrentStep,
  onGenerationError
}: UseStrategyCreationProps) => {
  // Use ActionButtons business logic hook
  const { handleCreateStrategy: originalHandleCreateStrategy, handleSaveStrategy, cancelGeneration } = useActionButtonsBusinessLogic({
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
    setCurrentStep,
    onGenerationError
  });

  return {
    // #29: return the hook's functions directly (NOT wrapped in arrows) so
    // their references stay stable across renders. Wrapping created a fresh
    // function identity every render, which broke downstream ref/effect
    // deps (e.g. useModalManagement's originalHandleCreateStrategyRef sync).
    originalHandleCreateStrategy,
    handleSaveStrategy,
    // Phase E #41: the modal's Cancel button aborts the in-flight poll.
    cancelGeneration
  };
};
