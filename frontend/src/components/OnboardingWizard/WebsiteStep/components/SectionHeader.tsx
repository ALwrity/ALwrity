import React from 'react';
import {
  Box,
  Typography,
  Tooltip,
  IconButton,
  // Popover,
  // Fade,
  // Paper
} from '@mui/material';
import InfoIcon from '@mui/icons-material/Info';

interface SectionHeaderProps {
  title: string;
  icon?: React.ReactNode;
  tooltip?: string | React.ReactNode;
  variant?: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6';
  sx?: any;
}

const SectionHeader: React.FC<SectionHeaderProps> = ({
  title,
  icon,
  tooltip,
  variant = 'h5',
  sx = {}
}) => {
  // const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);

  /* const handlePopoverOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handlePopoverClose = () => {
    setAnchorEl(null);
  };

  const open = Boolean(anchorEl); */

  return (
    <Box 
      sx={{ 
        display: 'flex', 
        alignItems: 'center', 
        gap: 1, 
        mb: 2,
        ...sx 
      }}
    >
      {icon && (
        <Box sx={{ display: 'flex', alignItems: 'center', color: 'primary.main' }}>
          {icon}
        </Box>
      )}
      <Typography 
        variant={variant} 
        sx={{ 
          fontWeight: 700,
          color: '#1a202c',
          display: 'flex',
          alignItems: 'center',
          gap: 1
        }}
      >
        {title}
      </Typography>
      
      <Tooltip 
        title={
          <Box sx={{ p: 1 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5, color: '#fff' }}>
              About this section
            </Typography>
            <Typography variant="body2" sx={{ color: '#f0f0f0' }}>
              {tooltip}
            </Typography>
          </Box>
        } 
        arrow 
        placement="right"
        componentsProps={{
          tooltip: {
            sx: {
              bgcolor: 'rgba(30, 41, 59, 0.95)',
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
              maxWidth: 300,
              p: 1.5,
              borderRadius: 2
            }
          },
          arrow: {
            sx: {
              color: 'rgba(30, 41, 59, 0.95)'
            }
          }
        }}
      >
        <IconButton 
          size="small" 
          sx={{ 
            color: 'text.secondary',
            opacity: 0.7,
            '&:hover': { 
              opacity: 1, 
              color: 'primary.main',
              bgcolor: 'rgba(0,0,0,0.04)' 
            }
          }}
          aria-label="info"
        >
          <InfoIcon fontSize="small" />
        </IconButton>
      </Tooltip>
    </Box>
  );
};

export default SectionHeader;
