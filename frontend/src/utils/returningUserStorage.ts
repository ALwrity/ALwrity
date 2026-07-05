import { getDefaultLandingRoute, shouldSkipOnboarding } from './demoMode';

const HAS_SIGNED_IN_KEY = 'alwrity_has_signed_in';
const FIRST_NAME_KEY = 'alwrity_user_first_name';

export function persistReturningUserProfile(firstName?: string | null): void {
  if (!firstName?.trim()) return;
  localStorage.setItem(FIRST_NAME_KEY, firstName.trim());
  localStorage.setItem(HAS_SIGNED_IN_KEY, 'true');
}

export function hasSignedInBefore(): boolean {
  return localStorage.getItem(HAS_SIGNED_IN_KEY) === 'true';
}

export function getStoredFirstName(): string | null {
  return localStorage.getItem(FIRST_NAME_KEY);
}

export function getPostAuthDestination(): string {
  if (shouldSkipOnboarding()) {
    return getDefaultLandingRoute();
  }

  const onboardingComplete = localStorage.getItem('onboarding_complete') === 'true';
  return onboardingComplete ? '/dashboard' : '/onboarding';
}
