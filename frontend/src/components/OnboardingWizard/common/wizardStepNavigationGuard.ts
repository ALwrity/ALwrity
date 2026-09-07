import { buildWebsiteSessionKey } from './onboardingSessionKey';

const LOG_PREFIX = '[wizard:navigation-guard]';

export interface ConnectStepSnapshot {
  sessionKey: string;
}

export interface ProgressNavigationGuardInput {
  onboardingType: string;
  completedFrontier: number;
  /** Highest step index unlocked by backend completion_percentage (inclusive). */
  furthestAccessibleStep: number;
  lastCommitted: ConnectStepSnapshot | null;
  currentConnectPayload: unknown;
}

export interface ProgressNavigationGuardResult {
  blocked: boolean;
  message: string;
}

export function buildConnectStepSnapshot(
  onboardingType: string,
  payload: unknown
): ConnectStepSnapshot | null {
  if (!payload || typeof payload !== 'object') return null;

  const data = payload as Record<string, unknown>;

  if (onboardingType === 'linkedin') {
    const integrations = data.integrations as Record<string, unknown> | undefined;
    const connected = integrations?.connectedPlatforms as string[] | undefined;
    return {
      sessionKey: connected?.includes('linkedin')
        ? 'linkedin:connected'
        : 'linkedin:disconnected',
    };
  }

  const website = String(data.website || data.website_url || '').trim();
  if (!website) return null;

  const analysis =
    data.analysis && typeof data.analysis === 'object'
      ? (data.analysis as { id?: string | number; updated_at?: string })
      : null;

  return {
    sessionKey: buildWebsiteSessionKey(website, analysis),
  };
}

export function hasUncommittedConnectChanges(
  lastCommitted: ConnectStepSnapshot | null,
  current: ConnectStepSnapshot | null,
  completedFrontier: number
): boolean {
  if (completedFrontier < 0) return false;
  if (!lastCommitted || !current) return false;
  return lastCommitted.sessionKey !== current.sessionKey;
}

export function getProgressNavigationBlockMessage(onboardingType: string): string {
  if (onboardingType === 'linkedin') {
    return 'Connect LinkedIn and click Continue before opening later steps.';
  }
  return 'Save your website analysis with Continue before opening later steps.';
}

export function getConnectPayloadForGuard(
  collector: (() => unknown) | null | undefined,
  stepData: unknown
): unknown {
  if (typeof collector === 'function') {
    try {
      const collected = collector();
      if (collected && typeof collected === 'object') {
        const data = collected as Record<string, unknown>;
        if (data.website || data.website_url || data.analysis || data.integrations) {
          return collected;
        }
      }
    } catch (err) {
      console.warn(`${LOG_PREFIX} Connect collector failed:`, err);
    }
  }

  try {
    const storedUrl = localStorage.getItem('website_url');
    const storedAnalysisRaw = localStorage.getItem('website_analysis_data');
    if (storedUrl) {
      let analysis: unknown;
      if (storedAnalysisRaw) {
        try {
          analysis = JSON.parse(storedAnalysisRaw);
        } catch {
          analysis = undefined;
        }
      }
      return { website: storedUrl, analysis };
    }
  } catch (err) {
    console.warn(`${LOG_PREFIX} Failed to read live website storage:`, err);
  }

  if (stepData && typeof stepData === 'object') {
    const data = stepData as Record<string, unknown>;
    if (data.website || data.website_url || data.integrations || data.analysis) {
      return {
        website: data.website || data.website_url,
        analysis: data.analysis,
        integrations: data.integrations,
      };
    }
  }

  return null;
}

/**
 * Progress-bar navigation rules (UX SSOT):
 * - Backend `completion_percentage` unlocks steps 0..furthestAccessibleStep.
 * - Users may move freely among unlocked steps (completed + in-progress).
 * - Footer Continue commits step data via `setCurrentStep` / `complete_step`.
 * - Stale downstream data after a live Connect edit is handled by live-session
 *   invalidation — not by blocking return to an already-unlocked step.
 */
export function shouldBlockProgressNavigation(
  targetStepIndex: number,
  input: ProgressNavigationGuardInput
): ProgressNavigationGuardResult {
  if (targetStepIndex <= input.furthestAccessibleStep) {
    return { blocked: false, message: '' };
  }

  console.log(`${LOG_PREFIX} Blocked progress navigation beyond unlocked frontier`, {
    targetStepIndex,
    furthestAccessibleStep: input.furthestAccessibleStep,
    completedFrontier: input.completedFrontier,
  });

  return {
    blocked: true,
    message: 'Complete earlier steps before opening this one.',
  };
}
