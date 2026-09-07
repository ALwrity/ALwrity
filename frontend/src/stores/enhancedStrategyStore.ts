import { create } from 'zustand';
import { contentPlanningApi } from '../services/contentPlanningApi';

// Import types from strategy builder store to avoid duplication
export type { EnhancedStrategy, StrategicInputField } from './strategyBuilderStore';
export { STRATEGIC_INPUT_FIELDS } from './strategyBuilderStore';

// Enhanced AI Analysis Types
export interface EnhancedAIAnalysis {
  id: string;
  user_id: number;
  strategy_id: string;
  analysis_type: string;
  comprehensive_insights?: any;
  audience_intelligence?: any;
  competitive_intelligence?: any;
  performance_optimization?: any;
  content_calendar_optimization?: any;
  onboarding_data_used?: any;
  data_confidence_scores?: any;
  recommendation_quality_scores?: any;
  processing_time?: number;
  ai_service_status: string;
  prompt_version?: string;
  created_at: string;
  updated_at: string;
}

export interface OnboardingIntegration {
  id: string;
  user_id: number;
  strategy_id: string;
  website_analysis_data?: any;
  research_preferences_data?: any;
  api_keys_data?: any;
  field_mappings?: any;
  auto_populated_fields?: any;
  user_overrides?: any;
  data_quality_scores?: any;
  confidence_levels?: any;
  data_freshness?: any;
  created_at: string;
  updated_at: string;
}

export interface ProgressiveDisclosureStep {
  id: string;
  title: string;
  description: string;
  fields: string[];
  is_complete: boolean;
  is_visible: boolean;
  dependencies: string[];
}

export interface TooltipData {
  field_id: string;
  title: string;
  description: string;
  examples: string[];
  best_practices: string[];
  data_source?: string;
  confidence_level?: number;
}

// Calendar Wizard Types
export interface CalendarConfig {
  id?: string;
  user_id?: number;
  strategy_id?: string;
  calendar_type: string;
  platforms: string[];
  content_mix: Record<string, number>;
  posting_frequency: string;
  optimal_timing: any;
  content_budget?: number;
  team_size?: number;
  target_audience?: any;
  content_pillars?: string[];
  keywords?: string[];
  performance_goals?: any;
  created_at?: string;
  updated_at?: string;
}

export interface WizardStep {
  id: string;
  title: string;
  description: string;
  is_complete: boolean;
  is_visible: boolean;
  validation_rules?: any;
}

export interface ValidationError {
  field: string;
  message: string;
  type: 'error' | 'warning' | 'info';
}

// Enhanced Strategy Store Interface (Focused on non-strategy-builder functionality)
interface EnhancedStrategyStore {
  // AI Analysis State
  aiAnalyses: EnhancedAIAnalysis[];
  aiGenerating: boolean;
  
  // Progressive Disclosure State
  disclosureSteps: ProgressiveDisclosureStep[];
  currentStep: number;
  completedSteps: string[];
  
  // Tooltip State
  tooltips: Record<string, TooltipData>;
  
  // Calendar Wizard State
  calendarConfig: CalendarConfig | null;
  activeStep: number;
  steps: WizardStep[];
  validationErrors: ValidationError[];
  calendarGenerating: boolean;
  calendarGenerationProgress: number;
  
  // Transparency State
  transparencyModalOpen: boolean;
  transparencyGenerationProgress: number;
  currentPhase: string;
  // Phase E #22: the backend's REAL numeric step (1..8) streamed on every
  // poll — the single source for the modal's "Step X of 8" label (the old
  // Math.ceil(progress / 10) derivation mislabeled phases). Deliberately
  // named generation* — the store's currentStep already means the
  // progressive-disclosure wizard step.
  generationStep: number;
  educationalContent: any;
  transparencyMessages: string[];
  transparencyGenerating: boolean;
  
  // AI Analysis Actions
  generateAIRecommendations: (strategyId: string) => Promise<void>;
  regenerateAIAnalysis: (strategyId: string, analysisType: string) => Promise<void>;
  setAIGenerating: (generating: boolean) => void;
  
  // Progressive Disclosure Actions
  setCurrentStep: (step: number) => void;
  completeStep: (stepId: string) => void;
  canProceedToDisclosureStep: (stepId: string) => boolean;
  getNextStep: () => ProgressiveDisclosureStep | null;
  getPreviousStep: () => ProgressiveDisclosureStep | null;
  
  // Calendar Wizard Actions
  updateCalendarConfig: (updates: Partial<CalendarConfig>) => void;
  setActiveStep: (step: number) => void;
  validateStep: (step: number) => boolean;
  canProceedToCalendarStep: (step: number) => boolean;
  resetWizard: () => void;
  generateCalendar: (config: CalendarConfig) => Promise<void>;
  setCalendarGenerating: (generating: boolean) => void;
  setCalendarGenerationProgress: (progress: number) => void;
  
  // Data Loading Actions
  loadAIAnalyses: (strategyId: string) => Promise<void>;
  loadOnboardingIntegration: (strategyId: string) => Promise<void>;
  
  // Tooltip Actions
  getTooltipData: (fieldId: string) => TooltipData | null;
  updateTooltipData: (fieldId: string, data: TooltipData) => void;
  
  // Transparency Actions
  setTransparencyModalOpen: (open: boolean) => void;
  setTransparencyGenerationProgress: (progress: number) => void;
  setCurrentPhase: (phase: string) => void;
  setGenerationStep: (step: number) => void;
  setEducationalContent: (content: any) => void;
  addTransparencyMessage: (message: string) => void;
  clearTransparencyMessages: () => void;
  setTransparencyGenerating: (generating: boolean) => void;
}

// Enhanced Strategy Store Implementation
export const useEnhancedStrategyStore = create<EnhancedStrategyStore>((set, get) => ({
  // AI Analysis State
  aiAnalyses: [],
  aiGenerating: false,
  
  // Progressive Disclosure State
  disclosureSteps: [],
  currentStep: 0,
  completedSteps: [],
  
  // Tooltip State
  tooltips: {},
  
  // Calendar Wizard State
  calendarConfig: null,
  activeStep: 0,
  steps: [],
  validationErrors: [],
  calendarGenerating: false,
  calendarGenerationProgress: 0,
  
  // Transparency State
  transparencyModalOpen: false,
  transparencyGenerationProgress: 0,
  currentPhase: '',
  generationStep: 0,
  educationalContent: null,
  transparencyMessages: [],
  transparencyGenerating: false,
  
  // AI Analysis Actions
  generateAIRecommendations: async (strategyId) => {
    set({ aiGenerating: true });
    try {
      const aiAnalysis = await contentPlanningApi.generateEnhancedAIRecommendations(strategyId);
      set((state) => ({
        aiAnalyses: [...state.aiAnalyses, aiAnalysis],
        aiGenerating: false
      }));
    } catch (error: any) {
      set({ aiGenerating: false });
      throw error;
    }
  },
  
  regenerateAIAnalysis: async (strategyId: string, analysisType: string) => {
    set({ aiGenerating: true });
    try {
      const aiAnalysis = await contentPlanningApi.regenerateAIAnalysis(strategyId, analysisType);
      set((state) => ({
        aiAnalyses: state.aiAnalyses.map(analysis =>
          analysis.strategy_id === strategyId && analysis.analysis_type === analysisType
            ? { ...analysis, ...aiAnalysis }
            : analysis
        ),
        aiGenerating: false
      }));
    } catch (error) {
      set({ aiGenerating: false });
      throw error;
    }
  },
  
  setAIGenerating: (generating) => set({ aiGenerating: generating }),
  
  // Progressive Disclosure Actions
  setCurrentStep: (step) => set({ currentStep: step }),
  
  completeStep: (stepId: string) => {
    set((state) => ({
      completedSteps: [...state.completedSteps, stepId],
      disclosureSteps: state.disclosureSteps.map(step => 
        step.id === stepId ? { ...step, is_complete: true } : step
      )
    }));
  },
  
  canProceedToDisclosureStep: (stepId: string) => {
    const { disclosureSteps, completedSteps } = get();
    const step = disclosureSteps.find(s => s.id === stepId);
    if (!step) return false;
    
    return step.dependencies.every(dep => completedSteps.includes(dep));
  },
  
  getNextStep: () => {
    const { disclosureSteps, currentStep } = get();
    const nextStep = disclosureSteps[currentStep + 1];
    return nextStep && get().canProceedToDisclosureStep(nextStep.id) ? nextStep : null;
  },
  
  getPreviousStep: () => {
    const { disclosureSteps, currentStep } = get();
    return currentStep > 0 ? disclosureSteps[currentStep - 1] : null;
  },
  
  // Calendar Wizard Actions
  updateCalendarConfig: (updates) => {
    set((state) => ({
      calendarConfig: state.calendarConfig ? { ...state.calendarConfig, ...updates } : updates as CalendarConfig
    }));
  },
  
  setActiveStep: (step) => set({ activeStep: step }),
  
  validateStep: (step: number) => {
    // Implement step validation logic
    return true;
  },
  
  canProceedToCalendarStep: (step: number) => {
    // Implement step progression logic
    return true;
  },
  
  resetWizard: () => {
      set({ 
      activeStep: 0,
      validationErrors: [],
      calendarGenerating: false,
      calendarGenerationProgress: 0
    });
  },
  
  generateCalendar: async (config) => {
    set({ calendarGenerating: true, calendarGenerationProgress: 0 });
    try {
      // Implement calendar generation logic
      set({ calendarGenerationProgress: 100, calendarGenerating: false });
    } catch (error) {
      set({ calendarGenerating: false });
      throw error;
    }
  },
  
  setCalendarGenerating: (generating: boolean) => set({ calendarGenerating: generating }),
  
  setCalendarGenerationProgress: (progress: number) => set({ calendarGenerationProgress: progress }),
  
  // Data Loading Actions
  loadAIAnalyses: async (strategyId) => {
    try {
      const analyses = await contentPlanningApi.getEnhancedAIAnalyses(strategyId);
      set({ aiAnalyses: analyses });
    } catch (error: any) {
      console.error('Failed to load AI analyses:', error);
    }
  },
  
  loadOnboardingIntegration: async (strategyId) => {
    try {
      await contentPlanningApi.getOnboardingIntegration(strategyId);
      // Handle onboarding integration data
    } catch (error: any) {
      console.error('Failed to load onboarding integration:', error);
    }
  },
  
  // Tooltip Actions
  getTooltipData: (fieldId) => {
    const { tooltips } = get();
    return tooltips[fieldId] || null;
  },
  
  updateTooltipData: (fieldId, data) => {
    set((state) => ({
      tooltips: { ...state.tooltips, [fieldId]: data }
    }));
  },
  
  // Transparency Actions
  setTransparencyModalOpen: (open: boolean) => set({ transparencyModalOpen: open }),
  
  setTransparencyGenerationProgress: (progress: number) => set({ transparencyGenerationProgress: progress }),
  
  setCurrentPhase: (phase: string) => set({ currentPhase: phase }),
  setGenerationStep: (step: number) => set({ generationStep: step }),
  
  setEducationalContent: (content: any) => set({ educationalContent: content }),
  
  addTransparencyMessage: (message: string) => {
    set((state) => ({
      transparencyMessages: [...state.transparencyMessages, message]
    }));
  },
  
  clearTransparencyMessages: () => set({ transparencyMessages: [] }),
  
  setTransparencyGenerating: (generating: boolean) => set({ transparencyGenerating: generating })
})); 