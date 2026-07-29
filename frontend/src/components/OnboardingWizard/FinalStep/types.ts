export interface OnboardingData {
  apiKeys: Record<string, string>;
  websiteUrl?: string;
  researchPreferences?: any;
  personalizationSettings?: any;
  integrations?: any;
  styleAnalysis?: any;
  personaReadiness?: any;
  canonicalProfile?: any;
}

export interface Capability {
  id: string;
  title: string;
  description: string;
  icon: React.ReactElement;
  unlocked: boolean;
  required?: string[];
}

export interface FinalStepProps {
  onContinue: () => void;
  updateHeaderContent: (content: { title: string; description: string }) => void;
  onboardingType?: string;
}

export interface OnboardingCompletionResult {
  message: string;
  completed_at: string;
  completion_percentage: number;
  persona_generated: boolean;
  scheduled_tasks: string[];
  failed_tasks: Array<{ task: string; error: string }> | null;
}
