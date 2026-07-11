import React from 'react';
import { useNavigate } from 'react-router-dom';
import { DashboardRailIconButton } from './DashboardRailIconButton';

export const LibraryRailButton: React.FC = () => {
  const navigate = useNavigate();

  return (
    <DashboardRailIconButton
      label="Library"
      icon="library"
      onClick={() => navigate('/asset-library?source_module=linkedin_writer')}
    />
  );
};
