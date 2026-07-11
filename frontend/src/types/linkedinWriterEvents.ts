export interface LinkedInWriterGlobals {
  tempPromptForGeneration?: string;
  lastBrainstormEvent?: CustomEvent;
}

declare global {
  interface WindowEventMap {
    'linkedinwriter:copilotSeedFromPrompt': CustomEvent<{ prompt: string }>;
    'linkedinwriter:runBrainstormIdeas': CustomEvent<{
      prompt?: string;
      seed?: string;
      type?: string;
      forceRefresh?: boolean;
    }>;
    'linkedinwriter:updateDraft': CustomEvent<string>;
    'linkedinwriter:applyEdit': CustomEvent<{ target: string }>;
    'linkedinwriter:loadingStart': CustomEvent<{ action: string; message: string }>;
    'linkedinwriter:loadingEnd': CustomEvent<{ error?: string }>;
    'linkedinwriter:progressInit': CustomEvent<{ steps: Array<{ id: string; label: string }> }>;
    'linkedinwriter:progressStep': CustomEvent<{
      id: string;
      status: 'active' | 'completed' | 'error';
      message?: string;
    }>;
    'linkedinwriter:progressComplete': CustomEvent;
    'linkedinwriter:progressError': CustomEvent<{ id: string; details: string }>;
    'linkedinwriter:updateGroundingData': CustomEvent<{
      researchSources: any[];
      citations: any[];
      qualityMetrics: any;
      groundingEnabled: boolean;
      searchQueries: string[];
    }>;
    'linkedinwriter:showTodaysTasks': CustomEvent;
    'linkedinwriter:updateLinkedInPreferences': CustomEvent;
    'linkedinwriter:openQuickCreate': CustomEvent<{
      type?: string;
      topic?: string;
      key_points?: string;
      target_audience?: string;
      industry?: string;
      post_type?: string;
    }>;
    'linkedinwriter:cancelBrainstorm': CustomEvent;
  }

  interface Window {
    tempPromptForGeneration?: string;
    lastBrainstormEvent?: CustomEvent;
  }
}

export {};
