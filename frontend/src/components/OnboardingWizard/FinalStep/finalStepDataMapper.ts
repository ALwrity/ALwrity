import type { OnboardingData } from './types';

const LOG_PREFIX = '[FinalStep:data]';

export interface FinalStepApiPayload {
  summary: Record<string, unknown>;
  websiteAnalysis: Record<string, unknown> | null;
  researchPreferences: Record<string, unknown> | null;
}

export interface FinalStepLoadError {
  code: string;
  message: string;
}

export interface FinalStepMappedResult {
  data: OnboardingData;
  errors: FinalStepLoadError[];
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function normalizePersonaReadiness(summary: Record<string, unknown>): OnboardingData['personaReadiness'] {
  const readiness = asRecord(summary.persona_readiness);
  if (!readiness) return undefined;

  const ready = readiness.ready ?? readiness.isReady;
  return {
    ...readiness,
    isReady: Boolean(ready),
  };
}

function hasWebsiteAnalysisData(data: OnboardingData): boolean {
  return Boolean(
    (data.websiteUrl && data.websiteUrl.trim() !== '') ||
      (data.styleAnalysis && Object.keys(data.styleAnalysis).length > 0)
  );
}

function hasResearchPreferencesData(data: OnboardingData): boolean {
  const prefs = data.researchPreferences;
  if (!prefs || typeof prefs !== 'object') return false;
  return (
    Boolean((prefs as Record<string, unknown>).research_depth) ||
    Boolean((prefs as Record<string, unknown>).content_characteristics) ||
    Boolean((prefs as Record<string, unknown>).growth_summary) ||
    Object.keys(prefs).length > 0
  );
}

export function mapFinalStepOnboardingData(
  payload: FinalStepApiPayload,
  onboardingType?: string
): FinalStepMappedResult {
  const summary = payload.summary || {};
  const websiteAnalysis = asRecord(payload.websiteAnalysis) || {};
  const researchPreferences =
    asRecord(payload.researchPreferences) || asRecord(summary.research_preferences);

  const configAndCapabilities = asRecord(summary.configuration_and_capabilities);
  const configurationDetails = asRecord(configAndCapabilities?.configuration_details);

  const data: OnboardingData = {
    websiteUrl:
      (websiteAnalysis.website_url as string | undefined) ||
      (summary.website_url as string | undefined) ||
      undefined,
    researchPreferences: researchPreferences || undefined,
    personalizationSettings: asRecord(summary.personalization_settings) || undefined,
    integrations: configurationDetails || asRecord(summary.integrations) || {},
    styleAnalysis:
      (websiteAnalysis.style_analysis as Record<string, unknown> | undefined) ||
      (summary.style_analysis as Record<string, unknown> | undefined) ||
      undefined,
    personaReadiness: normalizePersonaReadiness(summary),
    canonicalProfile: asRecord(summary.canonical_profile) || undefined,
  };

  const errors: FinalStepLoadError[] = [];
  const isLinkedIn = onboardingType === 'linkedin';

  if (!isLinkedIn && !hasWebsiteAnalysisData(data)) {
    errors.push({
      code: 'website_analysis_missing',
      message:
        'Website analysis is unavailable. Return to Connect Platforms, analyze your website, and continue through Research before launching.',
    });
    console.warn(`${LOG_PREFIX} Website analysis missing from API responses`);
  }

  if (!hasResearchPreferencesData(data)) {
    errors.push({
      code: 'research_preferences_missing',
      message:
        'Research preferences are unavailable. Complete the Research step and click Continue before launching.',
    });
    console.warn(`${LOG_PREFIX} Research preferences missing from API responses`);
  }

  return { data, errors };
}
