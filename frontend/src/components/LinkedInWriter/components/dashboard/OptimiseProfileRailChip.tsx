import React from 'react';
import { useLinkedInSocialConnection } from '../../../../hooks/useLinkedInSocialConnection';
import { useLinkedInStudioProfileStrength } from '../../hooks/useLinkedInStudioProfileStrength';
import { OptimiseProfileRailButton } from './OptimiseProfileRailButton';

interface OptimiseProfileRailChipProps {
  /** main = dashboard toolbar pill; tab = mobile studio tab strip */
  variant?: 'main' | 'tab';
}

export const OptimiseProfileRailChip: React.FC<OptimiseProfileRailChipProps> = ({
  variant = 'main',
}) => {
  const { connected } = useLinkedInSocialConnection();
  const {
    profileStrengthPercent,
    profileStrengthLoading,
    strengthLabel,
    strengthTooltip,
  } = useLinkedInStudioProfileStrength();

  const handleOpenOptimiseProfile = () => {
    window.dispatchEvent(new CustomEvent('linkedinwriter:openOptimiseProfile'));
  };

  return (
    <OptimiseProfileRailButton
      variant={variant}
      onClick={handleOpenOptimiseProfile}
      isLoading={profileStrengthLoading}
      profileStrengthPercent={connected ? profileStrengthPercent : null}
      strengthLabel={strengthLabel}
      strengthTooltip={
        connected ? strengthTooltip : 'Connect LinkedIn to optimise your profile'
      }
    />
  );
};
