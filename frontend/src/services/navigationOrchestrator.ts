import React from 'react';
import { useNavigate } from 'react-router-dom';
import { buildStrategyActivationNavigationState } from '../utils/calendarAutoStart';

export interface StrategyContext {
  strategyId: string;
  strategyData: any;
  activationStatus: 'pending' | 'confirmed' | 'active';
  activationTimestamp: string;
  userPreferences: any;
  strategicIntelligence: any;
}

export interface CalendarContext {
  strategyContext: StrategyContext | null;
  autoPopulatedData: any;
  userModifications: any;
  generationProgress: number;
}

export interface WorkflowProgress {
  currentStep: 'strategy' | 'activation' | 'calendar' | 'generation';
  completedSteps: string[];
  totalSteps: number;
  progressPercentage: number;
}

export interface NavigationState {
  fromStrategy: boolean;
  preservedContext: StrategyContext | null;
  returnPath: string | null;
}

class NavigationOrchestrator {
  private static instance: NavigationOrchestrator;
  private contextStorage: Map<string, any> = new Map();
  private progressTracking: WorkflowProgress = {
    currentStep: 'strategy',
    completedSteps: [],
    totalSteps: 4,
    progressPercentage: 0
  };

  private constructor() {}

  static getInstance(): NavigationOrchestrator {
    if (!NavigationOrchestrator.instance) {
      NavigationOrchestrator.instance = new NavigationOrchestrator();
    }
    return NavigationOrchestrator.instance;
  }

  /**
   * Navigate from strategy activation to calendar wizard
   */
  navigateToCalendarWizard(strategyId: string, strategyContext: StrategyContext): void {
    console.log('🎯 Navigation Orchestrator: Navigating to calendar wizard', { strategyId });
    
    // Preserve strategy context
    this.preserveContext('strategy', strategyContext);
    
    // Update progress
    this.updateProgress('activation');
    
    // Store navigation state
    this.contextStorage.set('navigationState', {
      fromStrategy: true,
      preservedContext: strategyContext,
      returnPath: '/content-planning'
    });
    
    // Also store in session storage for context restoration
    sessionStorage.setItem('strategyCalendarContext', JSON.stringify({
      strategyContext,
      lastUpdated: new Date().toISOString()
    }));
    
    // Navigate to calendar wizard with context
    const navigate = this.getNavigateFunction();
    if (navigate) {
      // Phase 4: use the shared helper so the nav state shape matches what
      // useCalendarAutoStart consumes (strategyId + autoGenerate opt-out).
      const calendarNavState = buildStrategyActivationNavigationState(strategyId, {
        autoGenerate: strategyContext.userPreferences?.autoGenerateCalendar !== false,
      });
      navigate('/content-planning', { 
        state: { 
          ...calendarNavState,
          activeTab: 4, // Create tab (where Calendar Wizard is located)
          strategyContext,
          fromStrategyActivation: true
        }
      });
    }
  }

  /**
   * Preserve context for later restoration
   */
  preserveContext(key: string, context: any): void {
    console.log('💾 Navigation Orchestrator: Preserving context', { key });
    this.contextStorage.set(key, {
      data: context,
      timestamp: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString() // 30 minutes
    });
  }

  /**
   * Restore context by key
   */
  restoreContext(key: string): any | null {
    const stored = this.contextStorage.get(key);
    if (!stored) {
      console.log('⚠️ Navigation Orchestrator: No context found for key', { key });
      return null;
    }

    // Check if context has expired
    if (new Date() > new Date(stored.expiresAt)) {
      console.log('⏰ Navigation Orchestrator: Context expired for key', { key });
      this.contextStorage.delete(key);
      return null;
    }

    console.log('🔄 Navigation Orchestrator: Restoring context', { key });
    return stored.data;
  }

  /**
   * Clear context by key
   */
  clearContext(key: string): void {
    console.log('🗑️ Navigation Orchestrator: Clearing context', { key });
    this.contextStorage.delete(key);
  }

  /**
   * Clear all contexts
   */
  clearAllContexts(): void {
    console.log('🗑️ Navigation Orchestrator: Clearing all contexts');
    this.contextStorage.clear();
  }

  /**
   * Update workflow progress
   */
  updateProgress(step: WorkflowProgress['currentStep']): void {
    const steps = ['strategy', 'activation', 'calendar', 'generation'];
    const currentIndex = steps.indexOf(step);
    
    this.progressTracking = {
      currentStep: step,
      completedSteps: steps.slice(0, currentIndex),
      totalSteps: steps.length,
      progressPercentage: ((currentIndex + 1) / steps.length) * 100
    };

    console.log('📊 Navigation Orchestrator: Progress updated', this.progressTracking);
  }

  /**
   * Get current progress
   */
  getProgress(): WorkflowProgress {
    return { ...this.progressTracking };
  }

  /**
   * Track navigation event
   */
  trackNavigation(from: string, to: string, context?: any): void {
    console.log('🧭 Navigation Orchestrator: Navigation tracked', { from, to, hasContext: !!context });
    
    // Store navigation history
    const history = this.contextStorage.get('navigationHistory') || [];
    history.push({
      from,
      to,
      timestamp: new Date().toISOString(),
      context: context ? Object.keys(context) : []
    });
    
    // Keep only last 10 navigation events
    if (history.length > 10) {
      history.splice(0, history.length - 10);
    }
    
    this.contextStorage.set('navigationHistory', history);
  }

  /**
   * Get navigation state
   */
  getNavigationState(): NavigationState | null {
    return this.contextStorage.get('navigationState') || null;
  }

  /**
   * Check if navigation is from strategy activation
   */
  isFromStrategyActivation(): boolean {
    const state = this.getNavigationState();
    return state?.fromStrategy || false;
  }

  /**
   * Get preserved strategy context
   */
  getPreservedStrategyContext(): StrategyContext | null {
    return this.restoreContext('strategy');
  }

  /**
   * Handle strategy activation success
   */
  handleStrategyActivationSuccess(strategyId: string, strategyData: any): void {
    console.log('✅ Navigation Orchestrator: Strategy activation successful', { strategyId });
    
    const strategyContext: StrategyContext = {
      strategyId,
      strategyData,
      activationStatus: 'active',
      activationTimestamp: new Date().toISOString(),
      userPreferences: strategyData.userPreferences || {},
      strategicIntelligence: strategyData.strategicIntelligence || {}
    };

    // Store strategy context for analytics page
    this.preserveContext('strategy', strategyContext);
    
    // Navigate to analytics page first to show monitoring setup
    const navigate = this.getNavigateFunction();
    if (navigate) {
      navigate('/content-planning', { 
        state: { 
          activeTab: 2, // Analytics tab
          strategyContext,
          fromStrategyActivation: true,
          showMonitoringSetup: true
        }
      });
    }
    
    // Also preserve context for calendar wizard navigation
    this.navigateToCalendarWizard(strategyId, strategyContext);
  }

  /**
   * Handle calendar generation completion
   */
  handleCalendarGenerationComplete(calendarData: any): void {
    console.log('✅ Navigation Orchestrator: Calendar generation complete');
    
    // Update progress
    this.updateProgress('generation');
    
    // Clear strategy context as workflow is complete
    this.clearContext('strategy');
    
    // Navigate to calendar view
    const navigate = this.getNavigateFunction();
    if (navigate) {
      navigate('/content-planning', { 
        state: { 
          activeTab: 1, // Calendar tab
          showGeneratedCalendar: true,
          calendarData
        }
      });
    }
  }

  /**
   * Get navigate function (to be set by components)
   */
  private getNavigateFunction(): any {
    // Return the stored navigate function
    return (this as any).navigate;
  }

  /**
   * Set navigate function (called by components)
   */
  setNavigateFunction(navigate: any): void {
    // Store navigate function for internal use
    (this as any).navigate = navigate;
  }
}

// Export singleton instance
export const navigationOrchestrator = NavigationOrchestrator.getInstance();

// Hook for components to use the orchestrator
export const useNavigationOrchestrator = () => {
  const navigate = useNavigate();
  
  // Set navigate function in orchestrator only once
  React.useEffect(() => {
    navigationOrchestrator.setNavigateFunction(navigate);
  }, [navigate]);
  
  return navigationOrchestrator;
};
