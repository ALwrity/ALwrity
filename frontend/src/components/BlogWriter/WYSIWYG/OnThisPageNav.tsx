import React, { useState, useEffect, useCallback } from 'react';
import { Paper, Typography, Box, Tooltip } from '@mui/material';
import NavigationIcon from '@mui/icons-material/Navigation';

interface Section {
  id: string | number;
  title: string;
}

interface OnThisPageNavProps {
  title: string;
  introduction: string;
  sections: Section[];
  onNavigate: (sectionId: string | number) => void;
  currentSectionId?: string | number | null;
}

const OnThisPageNav: React.FC<OnThisPageNavProps> = ({
  title,
  introduction,
  sections,
  onNavigate,
  currentSectionId,
}) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  const allItems = React.useMemo(() => {
    const items: Array<{ id: string | number; label: string; type: 'title' | 'intro' | 'section' }> = [];
    
    if (title) {
      items.push({ id: 'title', label: title, type: 'title' });
    }
    if (introduction && introduction.trim()) {
      items.push({ id: 'intro', label: 'Introduction', type: 'intro' });
    }
    sections.forEach((section, index) => {
      items.push({ 
        id: section.id, 
        label: section.title || `Section ${index + 1}`, 
        type: 'section' 
      });
    });
    
    return items;
  }, [title, introduction, sections]);

  if (allItems.length === 0) {
    return null;
  }

  return (
    <Paper
      elevation={0}
      sx={{
        position: 'fixed',
        right: isCollapsed ? 0 : 0,
        top: '50%',
        transform: 'translateY(-50%)',
        zIndex: 1000,
        transition: 'all 0.3s ease',
        borderRadius: isCollapsed ? '12px 0 0 12px' : '12px 0 0 12px',
        border: '1px solid #e2e8f0',
        borderRight: 'none',
        bgcolor: 'rgba(255, 255, 255, 0.95)',
        backdropFilter: 'blur(10px)',
        maxWidth: isCollapsed ? 40 : 240,
        overflow: 'hidden',
        boxShadow: isHovered ? '0 8px 24px rgba(0,0,0,0.12)' : '0 2px 8px rgba(0,0,0,0.08)',
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Toggle Button */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: isCollapsed ? 'center' : 'space-between',
          p: 1,
          borderBottom: '1px solid #e2e8f0',
          cursor: 'pointer',
          bgcolor: '#f8fafc',
        }}
        onClick={() => setIsCollapsed(!isCollapsed)}
      >
        {!isCollapsed && (
          <Typography variant="caption" sx={{ fontWeight: 600, color: '#4f46e5', fontSize: '0.7rem' }}>
            On This Page
          </Typography>
        )}
        <Tooltip title={isCollapsed ? 'Expand' : 'Collapse'}>
          <NavigationIcon
            sx={{
              fontSize: 16,
              color: '#4f46e5',
              transform: isCollapsed ? 'rotate(180deg)' : 'rotate(0deg)',
              transition: 'transform 0.3s ease',
            }}
          />
        </Tooltip>
      </Box>

      {/* Navigation Items */}
      {!isCollapsed && (
        <Box
          sx={{
            p: 1,
            maxHeight: '60vh',
            overflowY: 'auto',
            '&::-webkit-scrollbar': {
              width: 4,
            },
            '&::-webkit-scrollbar-thumb': {
              bgcolor: '#cbd5e1',
              borderRadius: 2,
            },
          }}
        >
          {allItems.map((item, index) => {
            const isActive = currentSectionId === item.id;
            
            return (
              <Box
                key={`${item.type}-${item.id}`}
                onClick={() => onNavigate(item.id)}
                sx={{
                  py: 0.75,
                  px: 1.5,
                  mb: 0.5,
                  borderRadius: 1,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  borderLeft: isActive ? '3px solid #4f46e5' : '3px solid transparent',
                  bgcolor: isActive ? 'rgba(79, 70, 229, 0.08)' : 'transparent',
                  '&:hover': {
                    bgcolor: 'rgba(79, 70, 229, 0.05)',
                    borderLeftColor: '#6366f1',
                  },
                }}
              >
                <Typography
                  variant="caption"
                  sx={{
                    fontSize: '0.75rem',
                    fontWeight: isActive ? 600 : 400,
                    color: isActive ? '#4f46e5' : '#64748b',
                    display: 'block',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {item.type === 'title' && '📝 '}
                  {item.type === 'intro' && '📖 '}
                  {item.label}
                </Typography>
              </Box>
            );
          })}
        </Box>
      )}
    </Paper>
  );
};

export default OnThisPageNav;
