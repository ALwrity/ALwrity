import React from 'react';
import {
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Typography,
  Box,
  Avatar,
  Chip
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';

interface SectionAccordionProps {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  defaultExpanded?: boolean;
  badge?: string | number;
  subtitle?: string;
  color?: string;
  expanded?: boolean;
  onChange?: (event: React.SyntheticEvent, isExpanded: boolean) => void;
}

/**
 * Reusable accordion component for organizing persona sections
 * Provides consistent styling and behavior across all sections
 */
export const SectionAccordion: React.FC<SectionAccordionProps> = ({
  title,
  icon,
  children,
  defaultExpanded = false,
  badge,
  subtitle,
  color = 'primary.main',
  expanded,
  onChange
}) => {
  return (
    <Accordion
      defaultExpanded={defaultExpanded}
      expanded={expanded}
      onChange={onChange}
      sx={{
        mb: 1.5,
        borderRadius: 2,
        background: '#ffffff',
        border: '1px solid #e2e8f0',
        width: '100%',
        maxWidth: '100%',
        '&:before': {
          display: 'none' // Remove default MUI divider
        },
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
        '&.Mui-expanded': {
          boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
        }
      }}
    >
      <AccordionSummary
        expandIcon={<ExpandMoreIcon />}
        sx={{
          px: 2,
          py: 1.5,
          '&.Mui-expanded': {
            minHeight: 56
          },
          '& .MuiAccordionSummary-content': {
            my: 0,
            '&.Mui-expanded': {
              my: 0
            }
          }
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, width: '100%' }}>
          {/* Icon */}
          {icon && (
            <Avatar
              sx={{
                bgcolor: color,
                width: 32,
                height: 32
              }}
            >
              {icon}
            </Avatar>
          )}

          {/* Title and subtitle */}
          <Box sx={{ flex: 1 }}>
            <Typography variant="h6" fontWeight="600" sx={{ fontSize: '1rem', color: '#1e293b' }}>
              {title}
            </Typography>
            {subtitle && (
              <Typography variant="body2" sx={{ color: '#64748b', fontSize: '0.875rem' }}>
                {subtitle}
              </Typography>
            )}
          </Box>

          {/* Badge */}
          {badge !== undefined && (
            <Chip
              label={badge}
              size="small"
              color="primary"
              sx={{
                fontWeight: 600,
                minWidth: 60
              }}
            />
          )}
        </Box>
      </AccordionSummary>

      <AccordionDetails
        sx={{
          pt: 1,
          pb: 2,
          px: 2,
          backgroundColor: '#ffffff'
        }}
      >
        {children}
      </AccordionDetails>
    </Accordion>
  );
};

export default SectionAccordion;

