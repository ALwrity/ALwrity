import React from 'react';
import { Box, IconButton, Tooltip, Typography } from '@mui/material';
import InfoIcon from '@mui/icons-material/Info';
import {
  sectionInfoIconButtonSx,
  sectionInfoTooltipArrowSx,
  sectionInfoTooltipSx,
} from './sectionInfoIconStyles';

interface SectionInfoIconProps {
  tooltip?: string;
  heading?: string;
  ariaLabel?: string;
  onClick?: () => void;
  ariaExpanded?: boolean;
}

/** Info icon + tooltip styling shared with Connect Website unified dashboard SectionHeader. */
export const SectionInfoIcon: React.FC<SectionInfoIconProps> = ({
  tooltip,
  heading = 'About this section',
  ariaLabel = 'Section information',
  onClick,
  ariaExpanded,
}) => {
  const iconButton = (
    <IconButton
      size="small"
      aria-label={ariaLabel}
      aria-expanded={ariaExpanded}
      onClick={onClick}
      sx={sectionInfoIconButtonSx}
    >
      <InfoIcon fontSize="small" />
    </IconButton>
  );

  if (!tooltip) {
    return iconButton;
  }

  return (
    <Tooltip
      title={
        <Box sx={{ p: 1 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5, color: '#fff' }}>
            {heading}
          </Typography>
          <Typography variant="body2" sx={{ color: '#f0f0f0' }}>
            {tooltip}
          </Typography>
        </Box>
      }
      arrow
      placement="right"
      componentsProps={{
        tooltip: { sx: sectionInfoTooltipSx },
        arrow: { sx: sectionInfoTooltipArrowSx },
      }}
    >
      {iconButton}
    </Tooltip>
  );
};

export default SectionInfoIcon;
