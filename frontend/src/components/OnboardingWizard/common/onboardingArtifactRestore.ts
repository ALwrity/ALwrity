/**
 * Restore vs unlock SSOT for onboarding step artifacts.
 *
 * UNLOCK (stepper, Continue, checkmarks) uses official completion / progress.
 * RESTORE (show saved work, skip API re-runs) uses has_data + website match.
 */

export type OnboardingArtifactStep = 'connect' | 'research' | 'personalization';

export interface ArtifactRestoreContext {
  /** Backend or local cache reports saved artifacts for this step. */
  hasData: boolean;
  /** Artifact website matches the active Connect website session. */
  websiteMatch: boolean;
  /** User chose Analyze New Website / start-fresh — intentional wipe. */
  isStartFreshSession: boolean;
  /** Wizard stepData already carries this step's payload (no merge needed). */
  stepDataAlreadyHasPayload: boolean;
}

/** True when saved artifacts should be merged/shown without re-running APIs. */
export function shouldRestoreStepArtifacts(ctx: ArtifactRestoreContext): boolean {
  if (ctx.isStartFreshSession) return false;
  if (!ctx.hasData) return false;
  if (!ctx.websiteMatch) return false;
  if (ctx.stepDataAlreadyHasPayload) return false;
  return true;
}

/** Skip expensive auto-discovery/generation when artifacts exist for the site. */
export function shouldSkipExpensiveStepRerun(params: {
  hasRestorableArtifacts: boolean;
  isStartFreshSession: boolean;
}): boolean {
  if (params.isStartFreshSession) return false;
  return params.hasRestorableArtifacts;
}
