import { useCallback, useRef, useState } from 'react';
import {
  getOnboardingSummary,
  getResearchPreferencesData,
  getWebsiteAnalysisData,
} from '../../../api/onboarding';
import {
  getAgentTeam,
  type AgentTeamCatalogEntry,
  type AgentTeamContextSummary,
  type TeamCertification,
} from '../../../api/agentsTeam';
import { mapFinalStepOnboardingData } from './finalStepDataMapper';
import { validateFinalStepCompletion } from './finalStepValidation';
import {
  FINAL_STEP_CONFIG_CHECKS,
  type ConfigCheck,
  type ConfigCheckStatus,
} from './finalStepConstants';
import type { OnboardingData } from './types';

const LOG_PREFIX = '[FinalStep:load]';

function createInitialConfigChecks(): ConfigCheck[] {
  return FINAL_STEP_CONFIG_CHECKS.map((step) => ({ ...step, status: 'pending' as const }));
}

function extractApiErrorMessage(error: unknown, fallback: string): string {
  const err = error as {
    message?: string;
    response?: { data?: { detail?: string; message?: string } };
  };

  return (
    err.response?.data?.detail ||
    err.response?.data?.message ||
    err.message ||
    fallback
  );
}

export interface UseFinalStepDataOptions {
  onboardingType?: string;
}

export interface UseFinalStepDataResult {
  dataLoading: boolean;
  loadError: string | null;
  onboardingData: OnboardingData;
  validationStatus: { isValid: boolean; missingSteps: string[] } | null;
  configChecks: ConfigCheck[];
  agentTeam: AgentTeamCatalogEntry[];
  agentContextSummary: AgentTeamContextSummary;
  agentCertification: TeamCertification | null;
  agentTeamError: string | null;
  reloadOnboardingData: () => Promise<void>;
}

export function useFinalStepData({
  onboardingType,
}: UseFinalStepDataOptions): UseFinalStepDataResult {
  const [dataLoading, setDataLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [onboardingData, setOnboardingData] = useState<OnboardingData>({});
  const [validationStatus, setValidationStatus] = useState<{
    isValid: boolean;
    missingSteps: string[];
  } | null>(null);
  const [configChecks, setConfigChecks] = useState<ConfigCheck[]>(createInitialConfigChecks);
  const [agentTeam, setAgentTeam] = useState<AgentTeamCatalogEntry[]>([]);
  const [agentContextSummary, setAgentContextSummary] = useState<AgentTeamContextSummary>({});
  const [agentCertification, setAgentCertification] = useState<TeamCertification | null>(null);
  const [agentTeamError, setAgentTeamError] = useState<string | null>(null);
  const loadingRef = useRef(false);

  const markConfigCheck = useCallback((index: number, status: ConfigCheckStatus) => {
    setConfigChecks((prev) =>
      prev.map((check, i) => (i === index ? { ...check, status } : check))
    );
  }, []);

  const reloadOnboardingData = useCallback(async () => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    setDataLoading(true);
    setLoadError(null);
    setConfigChecks(createInitialConfigChecks());

    try {
      markConfigCheck(0, 'running');
      const summary = await getOnboardingSummary();
      markConfigCheck(0, 'done');

      markConfigCheck(1, 'running');
      const websiteAnalysis = await getWebsiteAnalysisData();
      markConfigCheck(1, 'done');

      markConfigCheck(2, 'running');
      const researchPreferences = await getResearchPreferencesData();
      markConfigCheck(2, 'done');

      markConfigCheck(3, 'running');
      try {
        const { agents, contextSummary, certification } = await getAgentTeam();
        setAgentTeam(agents || []);
        setAgentContextSummary(contextSummary || {});
        setAgentCertification(certification || null);
        setAgentTeamError(null);
      } catch (error) {
        console.error(`${LOG_PREFIX} Agent team load failed:`, error);
        setAgentTeam([]);
        setAgentContextSummary({});
        setAgentCertification(null);
        setAgentTeamError(
          extractApiErrorMessage(error, 'Failed to load agent team configuration from the server.')
        );
      }
      markConfigCheck(3, 'done');

      markConfigCheck(4, 'running');
      const mapped = mapFinalStepOnboardingData(
        {
          summary,
          websiteAnalysis,
          researchPreferences,
        },
        onboardingType
      );

      setOnboardingData(mapped.data);

      const validation = validateFinalStepCompletion(mapped.data, onboardingType);
      setValidationStatus(validation);

      if (mapped.errors.length > 0) {
        const message = mapped.errors.map((entry) => entry.message).join(' ');
        setLoadError(message);
        console.warn(`${LOG_PREFIX} API-first load completed with missing data`, mapped.errors);
      } else if (!validation.isValid) {
        setLoadError(
          `Cannot launch yet. Complete these steps first: ${validation.missingSteps.join(', ')}.`
        );
      }

      markConfigCheck(4, 'done');
    } catch (error) {
      console.error(`${LOG_PREFIX} Failed to load onboarding data from API:`, error);
      setLoadError(
        extractApiErrorMessage(
          error,
          'Could not load onboarding data from the server. Check your connection and try again.'
        )
      );
    } finally {
      loadingRef.current = false;
      setDataLoading(false);
    }
  }, [markConfigCheck, onboardingType]);

  return {
    dataLoading,
    loadError,
    onboardingData,
    validationStatus,
    configChecks,
    agentTeam,
    agentContextSummary,
    agentCertification,
    agentTeamError,
    reloadOnboardingData,
  };
}
