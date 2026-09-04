import React from 'react';
import { Chip, Tooltip, Box } from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import WarningIcon from '@mui/icons-material/Warning';
import ErrorIcon from '@mui/icons-material/Error';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';

interface GroundingStatusBadgeProps {
  status?: 'validated' | 'partial' | 'error' | string;
  score?: number; // 0-1
  violations?: string[];
}

const GroundingStatusBadge: React.FC<GroundingStatusBadgeProps> = ({ 
  status, 
  score,
  violations = []
}) => {
  const getBadgeConfig = () => {
    switch (status) {
      case 'validated':
        return {
          label: score !== undefined ? `Validated (${Math.round(score * 100)}%)` : 'Validated',
          icon: <CheckCircleIcon />,
          color: 'success' as const,
          tooltip: 'Strategy is well-grounded in your actual data' + 
            (score !== undefined ? ` (score: ${Math.round(score * 100)}%)` : '')
        };

      case 'partial':
        return {
          label: score !== undefined ? `Partial (${Math.round(score * 100)}%)` : 'Partial Validation',
          icon: <WarningIcon />,
          color: 'warning' as const,
          tooltip: 'Strategy has some grounding issues. Some recommendations may not align with your data.' +
            (violations.length > 0 ? `\nViolations: ${violations.join(', ')}` : '')
        };

      case 'error':
        return {
          label: 'Validation Error',
          icon: <ErrorIcon />,
          color: 'error' as const,
          tooltip: 'Grounding validation failed. Strategy may contain ungrounded recommendations.' +
            (violations.length > 0 ? `\nErrors: ${violations.join(', ')}` : '')
        };

      default:
        return {
          label: 'Not validated',
          icon: <HelpOutlineIcon />,
          color: 'default' as const,
          tooltip: 'Strategy has not been validated against your data'
        };
    }
  };

  const config = getBadgeConfig();

  return (
    <Tooltip title={config.tooltip} arrow>
      <Chip
        icon={config.icon}
        label={config.label}
        color={config.color}
        size="small"
        variant="outlined"
      />
    </Tooltip>
  );
};

export default GroundingStatusBadge;