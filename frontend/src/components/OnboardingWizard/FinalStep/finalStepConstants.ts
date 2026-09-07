export type ConfigCheckStatus = 'pending' | 'running' | 'done';

export interface ConfigCheck {
  label: string;
  status: ConfigCheckStatus;
}

export const FINAL_STEP_CONFIG_CHECKS: Omit<ConfigCheck, 'status'>[] = [
  { label: 'Loading onboarding summary' },
  { label: 'Loading website analysis' },
  { label: 'Loading research preferences & persona' },
  { label: 'Building agent team' },
  { label: 'Validating configuration & capabilities' },
];

export const FINAL_STEP_STEPS_LENGTH = 4;
