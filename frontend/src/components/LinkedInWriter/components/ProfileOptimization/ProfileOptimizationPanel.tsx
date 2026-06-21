import React from 'react';

import { ProfileOptimizationIntro } from './ProfileOptimizationIntro';

interface ProfileOptimizationPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

/** Step 0 shell — idle panel hidden; open shows placeholder intro. */
export const ProfileOptimizationPanel: React.FC<ProfileOptimizationPanelProps> = ({
  isOpen,
  onClose,
}) => {
  if (!isOpen) {
    return null;
  }

  return <ProfileOptimizationIntro onClose={onClose} />;
};
