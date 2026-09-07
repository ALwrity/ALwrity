const LOG_PREFIX = '[wizardStepValidation]';

export type OnboardingType = 'website' | 'linkedin' | string;

export interface ResolveStepValidationDataInput {
  activeStep: number;
  stepData: unknown;
  competitorDataCollector: (() => unknown) | null;
  stepValidationStates: Record<number, boolean>;
}

/**
 * Resolves the payload used to validate the active wizard step.
 * Step components may report validity via stepValidationStates; otherwise
 * research step invokes the registered data collector.
 */
export function resolveStepValidationData(
  input: ResolveStepValidationDataInput
): unknown {
  const { activeStep, stepData, competitorDataCollector, stepValidationStates } = input;

  if (
    (activeStep === 0 || activeStep === 1 || activeStep === 2) &&
    stepValidationStates[activeStep] !== undefined
  ) {
    return stepValidationStates[activeStep];
  }

  if (activeStep === 1 && typeof competitorDataCollector === 'function') {
    try {
      return competitorDataCollector();
    } catch (err) {
      console.error(`${LOG_PREFIX} competitorDataCollector failed:`, err);
      return stepData;
    }
  }

  return stepData;
}

export function isStepDataValid(
  step: number,
  data: unknown,
  onboardingType: OnboardingType
): boolean {
  if (typeof data === 'boolean') {
    return data;
  }

  const record = (data && typeof data === 'object' ? data : null) as Record<string, unknown> | null;

  switch (step) {
    case 0:
      if (onboardingType === 'linkedin') {
        const integrations = record?.integrations as Record<string, unknown> | undefined;
        const connected = integrations?.connectedPlatforms as string[] | undefined;
        return !!connected?.includes('linkedin');
      }
      {
        const integrations = record?.integrations as Record<string, unknown> | undefined;
        const connected = integrations?.connectedPlatforms as string[] | undefined;
        return !!(
          record &&
          (record.website || record.website_url || connected?.includes('linkedin'))
        );
      }

    case 1:
      if (onboardingType === 'linkedin') {
        return !!(
          record &&
          (record.research_depth || record.content_types || record.growth_summary)
        );
      }
      {
        const competitors = record?.competitors;
        const hasCompetitors = Array.isArray(competitors) && competitors.length > 0;
        return !!(record && (hasCompetitors || record.researchSummary || record.sitemapAnalysis));
      }

    case 2: {
      const hasValidPersonaData =
        !!record?.corePersona &&
        !!record.platformPersonas &&
        typeof record.platformPersonas === 'object' &&
        Object.keys(record.platformPersonas as object).length > 0 &&
        !!record.qualityMetrics;

      if (onboardingType === 'linkedin') {
        return hasValidPersonaData;
      }

      const brandAvatar = record?.brandAvatar as { set?: boolean } | undefined;
      const voiceClone = record?.voiceClone as { set?: boolean } | undefined;
      return hasValidPersonaData && !!brandAvatar?.set && !!voiceClone?.set;
    }

    case 3:
      return true;

    default:
      return false;
  }
}

export function getStepValidationMessage(
  activeStep: number,
  data: unknown,
  onboardingType: OnboardingType,
  isValid: boolean
): string {
  if (isValid) return '';

  if (activeStep === 1 && onboardingType === 'website') {
    return 'Discover competitors or complete research insights to continue.';
  }

  if (activeStep === 2) {
    const record = (data && typeof data === 'object' ? data : null) as Record<string, unknown> | null;
    if (!record?.corePersona) {
      return 'Please generate your Brand Identity (Text) first.';
    }
    if (onboardingType !== 'linkedin' && !(record.brandAvatar as { set?: boolean })?.set) {
      return 'Please generate your Brand Avatar.';
    }
    if (onboardingType !== 'linkedin' && !(record.voiceClone as { set?: boolean })?.set) {
      return 'Please generate your Voice Clone.';
    }
    return 'Complete all personalization steps to continue.';
  }

  return '';
}
