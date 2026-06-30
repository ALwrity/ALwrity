import type { LinkedInProfileValidation } from '../../../api/linkedinSocial';

export const PROFILE_STRENGTH_UPDATED_EVENT = 'linkedinwriter:profileStrengthUpdated';

export type ProfileStrengthUpdatedDetail = {
  profileValidation: LinkedInProfileValidation;
};

export function dispatchProfileStrengthUpdated(
  profileValidation: LinkedInProfileValidation
): void {
  window.dispatchEvent(
    new CustomEvent<ProfileStrengthUpdatedDetail>(PROFILE_STRENGTH_UPDATED_EVENT, {
      detail: { profileValidation },
    })
  );
}
