import React from 'react';

import type { LinkedInProfileOptimizationDebug } from '../../../../api/linkedinSocial';
import { ProfileOptimizationIntro } from './ProfileOptimizationIntro';

interface ProfileOptimizationPanelProps {
  isOpen: boolean;
  isLoading?: boolean;
  optimizationDebug?: LinkedInProfileOptimizationDebug | null;
  onClose: () => void;
}

/** Step 1 shell — shows rubric gap summary while loading or after detection. */
export const ProfileOptimizationPanel: React.FC<ProfileOptimizationPanelProps> = ({
  isOpen,
  isLoading = false,
  optimizationDebug,
  onClose,
}) => {
  if (!isOpen) {
    return null;
  }

  return (
    <ProfileOptimizationIntro
      onClose={onClose}
      isLoading={isLoading}
      optimizationDebug={optimizationDebug}
    />
  );
};
