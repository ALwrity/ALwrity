import { useEffect, useState } from 'react';

import { getLinkedInProfileFoundation, type LinkedInProfileValidation } from '../../../api/linkedinSocial';
import { useLinkedInSocialConnection } from '../../../hooks/useLinkedInSocialConnection';
import {
  dispatchProfileStrengthUpdated,
  PROFILE_STRENGTH_UPDATED_EVENT,
  type ProfileStrengthUpdatedDetail,
} from '../utils/profileStrengthEvents';
import {
  getDisplayProfileStrengthPercent,
  getProfileStrengthDisplayLabel,
  getProfileStrengthTooltip,
} from '../utils/profileStrengthUtils';

export function useLinkedInStudioProfileStrength() {
  const { connected } = useLinkedInSocialConnection();
  const [profileStrengthPercent, setProfileStrengthPercent] = useState<number | null>(null);
  const [profileValidation, setProfileValidation] = useState<LinkedInProfileValidation | null>(
    null
  );
  const [profileStrengthLoading, setProfileStrengthLoading] = useState(false);

  useEffect(() => {
    if (!connected) {
      setProfileStrengthPercent(null);
      setProfileValidation(null);
      setProfileStrengthLoading(false);
      return;
    }

    let cancelled = false;
    setProfileStrengthLoading(true);

    getLinkedInProfileFoundation()
      .then((data) => {
        if (cancelled) return;
        const validation = data.profile_validation ?? null;
        setProfileValidation(validation);
        setProfileStrengthPercent(getDisplayProfileStrengthPercent(validation));
        if (validation) {
          dispatchProfileStrengthUpdated(validation, data.ai_profile_intelligence ?? null);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setProfileValidation(null);
          setProfileStrengthPercent(null);
        }
      })
      .finally(() => {
        if (!cancelled) setProfileStrengthLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [connected]);

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<ProfileStrengthUpdatedDetail>).detail;
      if (detail?.profileValidation) {
        setProfileValidation(detail.profileValidation);
        setProfileStrengthPercent(getDisplayProfileStrengthPercent(detail.profileValidation));
      }
    };
    window.addEventListener(PROFILE_STRENGTH_UPDATED_EVENT, handler);
    return () => window.removeEventListener(PROFILE_STRENGTH_UPDATED_EVENT, handler);
  }, []);

  return {
    profileStrengthPercent,
    profileStrengthLoading,
    strengthLabel: getProfileStrengthDisplayLabel(profileValidation, profileStrengthPercent),
    strengthTooltip: getProfileStrengthTooltip(profileValidation),
  };
}
