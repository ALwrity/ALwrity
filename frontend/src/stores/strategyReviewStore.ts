import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';

export type ReviewStatus = 'not_reviewed' | 'in_review' | 'reviewed' | 'activated';

export interface StrategyComponent {
  id: string;
  title: string;
  subtitle: string;
  status: ReviewStatus;
  reviewedAt?: Date;
  reviewedBy?: string;
  notes?: string;
}

export interface ReviewState {
  // Review state
  components: StrategyComponent[];
  isReviewing: boolean;
  reviewProgress: number;
  reviewProcessStarted: boolean;
  
  // Actions
  initializeComponents: (components: Omit<StrategyComponent, 'status' | 'reviewedAt' | 'reviewedBy' | 'notes'>[]) => void;
  startReview: (componentId: string) => void;
  completeReview: (componentId: string, notes?: string) => void;
  activateStrategy: () => void;
  resetReview: (componentId: string) => void;
  resetAllReviews: () => void;
  startReviewProcess: () => void;
  updateReviewProgress: () => void;
  getReviewProgress: () => number;
  isAllReviewed: () => boolean;
  isActivated: () => boolean;
  getUnreviewedComponents: () => StrategyComponent[];
  getReviewedComponents: () => StrategyComponent[];
}

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

export const useStrategyReviewStore = create<ReviewState>()(
  devtools(
    persist(
      (set, get) => ({
        // Initial state
        components: [],
        isReviewing: false,
        reviewProgress: 0,
        reviewProcessStarted: false,

        // Initialize components with default review status
        initializeComponents: (components) => {
          console.log('🔧 Initializing strategy components:', components.length);
          const initializedComponents = components.map(component => ({
            ...component,
            status: 'not_reviewed' as ReviewStatus
          }));
          
          set({ components: initializedComponents });
          get().updateReviewProgress();
          console.log('🔧 Components initialized, progress:', get().reviewProgress);
        },

        // Start reviewing a component
        startReview: (componentId: string) => {
          set(state => ({
            isReviewing: true,
            components: state.components.map(comp =>
              comp.id === componentId
                ? { ...comp, status: 'in_review' as ReviewStatus }
                : comp
            )
          }));
        },

        // Complete review for a component
        completeReview: (componentId: string, notes?: string) => {
          console.log('🔧 Completing review for component:', componentId);
          set(state => ({
            isReviewing: false,
            components: state.components.map(comp =>
              comp.id === componentId
                ? {
                    ...comp,
                    status: 'reviewed' as ReviewStatus,
                    reviewedAt: new Date(),
                    reviewedBy: 'current_user', // In real app, get from auth
                    notes
                  }
                : comp
            )
          }));
          
          get().updateReviewProgress();
          console.log('🔧 Review completed, progress:', get().reviewProgress, 'all reviewed:', get().isAllReviewed());
        },

        // Activate strategy - mark all components as activated
        activateStrategy: () => {
          console.log('🔧 Activating strategy - marking all components as activated');
          set(state => ({
            components: state.components.map(comp => ({
              ...comp,
              status: 'activated' as ReviewStatus
            }))
          }));
          
          get().updateReviewProgress();
          console.log('🔧 Strategy activated, all components now have activated status');
        },

        // Reset review for a component
        resetReview: (componentId: string) => {
          set(state => ({
            isReviewing: false,
            components: state.components.map(comp =>
              comp.id === componentId
                ? {
                    ...comp,
                    status: 'not_reviewed' as ReviewStatus,
                    reviewedAt: undefined,
                    reviewedBy: undefined,
                    notes: undefined
                  }
                : comp
            )
          }));
          
          get().updateReviewProgress();
        },

        // Reset all reviews
        resetAllReviews: () => {
          set(state => ({
            isReviewing: false,
            components: state.components.map(comp => ({
              ...comp,
              status: 'not_reviewed' as ReviewStatus,
              reviewedAt: undefined,
              reviewedBy: undefined,
              notes: undefined
            }))
          }));
          
          get().updateReviewProgress();
        },

        // Start review process
        startReviewProcess: () => {
          console.log('🔧 Starting review process - resetting all reviews first');
          // Reset all reviews when starting a new review process
          const { components } = get();
          const resetComponents = components.map(comp => ({
            ...comp,
            status: 'not_reviewed' as ReviewStatus,
            reviewedAt: undefined,
            reviewedBy: undefined,
            notes: undefined
          }));
          
set({ 
          reviewProcessStarted: true,
          isReviewing: false,
          components: resetComponents,
          reviewProgress: 0
        });
          
          console.log('🔧 Review process started with reset components');
        },

        // Update review progress
        updateReviewProgress: () => {
          const { components } = get();
          const reviewedCount = components.filter(comp => comp.status === 'reviewed' || comp.status === 'activated').length;
          const totalCount = components.length;
          const progress = totalCount > 0 ? (reviewedCount / totalCount) * 100 : 0;
          
          set({ reviewProgress: progress });
        },

        // Get review progress percentage
        getReviewProgress: () => {
          return get().reviewProgress;
        },

        // Check if all components are reviewed
        isAllReviewed: () => {
          const { components } = get();
          return components.every(comp => comp.status === 'reviewed' || comp.status === 'activated');
        },

        // Check if strategy is activated
        isActivated: () => {
          const { components } = get();
          return components.every(comp => comp.status === 'activated');
        },

        // Get unreviewed components
        getUnreviewedComponents: () => {
          const { components } = get();
          return components.filter(comp => comp.status !== 'reviewed' && comp.status !== 'activated');
        },

        // Get reviewed components
        getReviewedComponents: () => {
          const { components } = get();
          return components.filter(comp => comp.status === 'reviewed' || comp.status === 'activated');
        }
      }),
      {
        name: 'strategy-review-persist',
        partialize: (state: ReviewState) => ({
          components: state.components,
          reviewProgress: state.reviewProgress,
          reviewProcessStarted: state.reviewProcessStarted
        }),
        onRehydrateStorage: () => (state: ReviewState | undefined) => {
          if (state) {
            console.log('🔧 Rehydrating store state:', { 
              componentsCount: state.components.length, 
              reviewProcessStarted: state.reviewProcessStarted,
              reviewProgress: state.reviewProgress 
            });
            
            // Initialize components if they don't exist
            if (state.components.length === 0) {
              console.log('🔧 No components found during rehydration, initializing...');
              const initializedComponents = STRATEGY_COMPONENTS.map(component => ({
                ...component,
                status: 'not_reviewed' as ReviewStatus
              }));
              state.components = initializedComponents;
            } else {
              // Convert string dates back to Date objects after rehydration
              state.components = state.components.map(comp => ({
                ...comp,
                reviewedAt: comp.reviewedAt ? new Date(comp.reviewedAt) : undefined
              }));
            }
            
            // Recalculate progress when rehydrating from storage
            state.updateReviewProgress();
            console.log('🔧 Store rehydrated successfully');
          }
        }
      }
    ),
    {
      name: 'strategy-review-store',
      enabled: process.env.NODE_ENV === 'development'
    }
  )
);


