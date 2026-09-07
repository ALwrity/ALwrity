import type { OnboardingData } from './types';

export interface FinalStepValidationResult {
  isValid: boolean;
  missingSteps: string[];
}

function hasPersonaData(data: OnboardingData): boolean {
  const readiness = data.personaReadiness;
  if (readiness && (readiness.isReady || readiness.ready)) {
    return true;
  }

  const settings = data.personalizationSettings;
  if (!settings || typeof settings !== 'object') return false;

  const settingsRecord = settings as Record<string, unknown>;
  if (settingsRecord.persona && Object.keys(settingsRecord.persona as object).length > 0) {
    return true;
  }

  return Object.keys(settings).some(
    (key) => key !== 'writing_style' && key !== 'target_audience' && key !== 'content_focus'
  );
}

function hasResearchPreferences(data: OnboardingData): boolean {
  const prefs = data.researchPreferences;
  if (!prefs || typeof prefs !== 'object') return false;

  const record = prefs as Record<string, unknown>;
  return Boolean(
    record.research_depth ||
      record.content_characteristics ||
      record.content_types ||
      record.growth_summary ||
      Object.keys(record).length > 0
  );
}

function hasWebsiteAnalysis(data: OnboardingData): boolean {
  return Boolean(
    (data.websiteUrl && data.websiteUrl.trim() !== '') ||
      (data.styleAnalysis && Object.keys(data.styleAnalysis).length > 0)
  );
}

export function validateFinalStepCompletion(
  data: OnboardingData,
  onboardingType?: string
): FinalStepValidationResult {
  const missingSteps: string[] = [];
  const isLinkedIn = onboardingType === 'linkedin';

  if (isLinkedIn) {
    if (!hasResearchPreferences(data)) {
      missingSteps.push('LinkedIn Research');
    }
    if (!hasPersonaData(data)) {
      missingSteps.push('LinkedIn Persona');
    }
  } else {
    if (!hasWebsiteAnalysis(data)) {
      missingSteps.push('Website Analysis');
    }
    if (!hasResearchPreferences(data)) {
      missingSteps.push('Research Preferences');
    }
    if (!hasPersonaData(data)) {
      missingSteps.push('Persona Generation');
    }
  }

  return {
    isValid: missingSteps.length === 0,
    missingSteps,
  };
}
