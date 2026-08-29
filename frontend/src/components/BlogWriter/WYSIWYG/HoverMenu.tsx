import React from 'react';
import { 
  Menu, 
  MenuItem, 
  ListItemIcon, 
  ListItemText,
  Divider,
  Chip
} from '@mui/material';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import EditIcon from '@mui/icons-material/Edit';
import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import GpsFixedIcon from '@mui/icons-material/GpsFixed';
import BarChartIcon from '@mui/icons-material/BarChart';
import LinkIcon from '@mui/icons-material/Link';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';

interface HoverMenuProps {
  anchorEl: HTMLElement | null;
  open: boolean;
  onClose: () => void;
  type: 'title' | 'section' | 'content';
  onAction: (action: string) => void;
  context?: {
    sectionId?: string;
    hasContent?: boolean;
    sources?: number;
    wordCount?: number;
  };
}

const HoverMenu: React.FC<HoverMenuProps> = ({ 
  anchorEl, 
  open, 
  onClose, 
  type, 
  onAction, 
  context 
}) => {
  const handleAction = (action: string) => {
    onAction(action);
    onClose();
  };

  // Don't render if anchor is invalid
  if (!anchorEl || !open) {
    return null;
  }

  const getTitleMenuItems = () => [
    {
      icon: <AutoAwesomeIcon fontSize="small" />,
      text: 'Generate Alternative Titles',
      action: 'generate-titles',
      description: 'AI-powered title variations'
    },
    {
      icon: <TrendingUpIcon fontSize="small" />,
      text: 'SEO Optimization',
      action: 'seo-optimize',
      description: 'Keyword density and optimization'
    },
    {
      icon: <BarChartIcon fontSize="small" />,
      text: 'A/B Testing',
      action: 'ab-test',
      description: 'Create multiple title versions'
    },
    {
      icon: <GpsFixedIcon fontSize="small" />,
      text: 'Research-Based Titles',
      action: 'research-titles',
      description: 'Titles based on research findings'
    }
  ];

  const getSectionMenuItems = () => [
    {
      icon: <AutoAwesomeIcon fontSize="small" />,
      text: 'Generate Content',
      action: 'generate-content',
      description: 'AI content generation for this section'
    },
    {
      icon: <EditIcon fontSize="small" />,
      text: 'Enhance Section',
      action: 'enhance-section',
      description: 'Improve existing content with AI'
    },
    {
      icon: <AddIcon fontSize="small" />,
      text: 'Add Subsection',
      action: 'add-subsection',
      description: 'Insert new content blocks'
    },
    {
      icon: <CheckCircleIcon fontSize="small" />,
      text: 'Fact Check',
      action: 'fact-check',
      description: 'Verify claims against research data'
    },
    {
      icon: <LinkIcon fontSize="small" />,
      text: 'Source Mapping',
      action: 'source-mapping',
      description: 'Link content to research sources'
    },
    {
      icon: <TrendingUpIcon fontSize="small" />,
      text: 'SEO Analysis',
      action: 'seo-analysis',
      description: 'Section-level SEO optimization'
    }
  ];

  const getContentMenuItems = () => [
    {
      icon: <AutoAwesomeIcon fontSize="small" />,
      text: 'Continue Writing',
      action: 'continue-writing',
      description: 'AI-powered content continuation'
    },
    {
      icon: <EditIcon fontSize="small" />,
      text: 'Improve Clarity',
      action: 'improve-clarity',
      description: 'Enhance readability and flow'
    },
    {
      icon: <AddIcon fontSize="small" />,
      text: 'Add Examples',
      action: 'add-examples',
      description: 'Insert relevant examples and case studies'
    },
    {
      icon: <LinkIcon fontSize="small" />,
      text: 'Cite Sources',
      action: 'cite-sources',
      description: 'Add research-backed citations'
    },
    {
      icon: <TrendingUpIcon fontSize="small" />,
      text: 'Optimize for SEO',
      action: 'optimize-seo',
      description: 'Keyword optimization suggestions'
    }
  ];

  const getMenuItems = () => {
    switch (type) {
      case 'title':
        return getTitleMenuItems();
      case 'section':
        return getSectionMenuItems();
      case 'content':
        return getContentMenuItems();
      default:
        return [];
    }
  };

  const menuItems = getMenuItems();

  return (
    <Menu
      anchorEl={anchorEl}
      open={open}
      onClose={onClose}
      anchorOrigin={{
        vertical: 'bottom',
        horizontal: 'left',
      }}
      transformOrigin={{
        vertical: 'top',
        horizontal: 'left',
      }}
      PaperProps={{
        sx: {
          minWidth: 280,
          maxWidth: 320,
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.12)',
          border: '1px solid rgba(0, 0, 0, 0.08)',
          borderRadius: '12px',
        }
      }}
    >
      {/* Context Information */}
      {context && (
        <>
          <div className="px-4 py-2 bg-gray-50 border-b">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-gray-600 uppercase tracking-wide">
                {type} Actions
              </span>
              {context.wordCount && (
                <Chip 
                  label={`${context.wordCount} words`} 
                  size="small" 
                  variant="outlined" 
                  className="!text-xs"
                />
              )}
            </div>
            {context.sources && (
              <div className="flex items-center gap-1 mt-1">
                <LinkIcon fontSize="small" className="text-gray-400" />
                <span className="text-xs text-gray-500">{context.sources} sources available</span>
              </div>
            )}
          </div>
        </>
      )}

      {/* Menu Items */}
      {menuItems.map((item, index) => (
        <MenuItem
          key={item.action}
          onClick={() => handleAction(item.action)}
          sx={{
            py: 1.5,
            px: 2,
            '&:hover': {
              backgroundColor: 'rgba(79, 70, 229, 0.04)',
            }
          }}
        >
          <ListItemIcon sx={{ minWidth: 36 }}>
            {item.icon}
          </ListItemIcon>
          <ListItemText
            primary={item.text}
            secondary={item.description}
            primaryTypographyProps={{
              fontSize: '14px',
              fontWeight: 500,
              color: 'text.primary'
            }}
            secondaryTypographyProps={{
              fontSize: '12px',
              color: 'text.secondary',
              lineHeight: 1.3
            }}
          />
        </MenuItem>
      ))}

      {/* Additional Actions */}
      {type === 'section' && (
        <>
          <Divider />
          <MenuItem
            onClick={() => handleAction('copy-section')}
            sx={{
              py: 1.5,
              px: 2,
              '&:hover': {
                backgroundColor: 'rgba(79, 70, 229, 0.04)',
              }
            }}
          >
            <ListItemIcon sx={{ minWidth: 36 }}>
              <ContentCopyIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText
              primary="Copy Section"
              secondary="Duplicate this section"
              primaryTypographyProps={{
                fontSize: '14px',
                fontWeight: 500,
                color: 'text.primary'
              }}
              secondaryTypographyProps={{
                fontSize: '12px',
                color: 'text.secondary',
                lineHeight: 1.3
              }}
            />
          </MenuItem>
          <MenuItem
            onClick={() => handleAction('delete-section')}
            sx={{
              py: 1.5,
              px: 2,
              '&:hover': {
                backgroundColor: 'rgba(239, 68, 68, 0.04)',
              }
            }}
          >
            <ListItemIcon sx={{ minWidth: 36 }}>
              <DeleteOutlineIcon fontSize="small" className="text-red-500" />
            </ListItemIcon>
            <ListItemText
              primary="Delete Section"
              secondary="Remove this section permanently"
              primaryTypographyProps={{
                fontSize: '14px',
                fontWeight: 500,
                color: 'text.primary'
              }}
              secondaryTypographyProps={{
                fontSize: '12px',
                color: 'text.secondary',
                lineHeight: 1.3
              }}
            />
          </MenuItem>
        </>
      )}
    </Menu>
  );
};

export default HoverMenu;
