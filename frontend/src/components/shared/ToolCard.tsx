import React from 'react';
import { 
  Card, 
  CardContent, 
  Typography, 
  Chip, 
  Box, 
  IconButton, 
  Tooltip 
} from '@mui/material';
import StarIcon from '@mui/icons-material/Star';
import StarBorderIcon from '@mui/icons-material/StarBorder';
import LockIcon from '@mui/icons-material/LockOutlined';
import { ToolCardProps } from './types';
import { getStatusConfig } from './utils';

const ToolCard: React.FC<ToolCardProps> = ({
  tool,
  onToolClick,
  isFavorite,
  onToggleFavorite
}) => {
  const config = getStatusConfig(tool.status);
  const isLocked = tool.status === 'premium' || tool.status === 'pro';

  return (
    <Card
      sx={{
        background: 'rgba(255, 255, 255, 0.08)',
        backdropFilter: 'blur(24px)',
        border: '1px solid rgba(255, 255, 255, 0.12)',
        borderRadius: 3,
        cursor: isLocked ? 'not-allowed' : 'pointer',
        transition: 'all 0.3s ease',
        position: 'relative',
        overflow: 'hidden',
        '&:hover': {
          transform: isLocked ? 'none' : 'translateY(-8px) scale(1.02)',
          boxShadow: isLocked ? 'none' : '0 20px 40px rgba(0, 0, 0, 0.3)',
          border: isLocked ? '1px solid rgba(255, 255, 255, 0.12)' : '1px solid rgba(255, 255, 255, 0.2)',
        },
      }}
      onClick={() => { if (!isLocked) onToolClick(tool); }}
    >
      <CardContent sx={{ p: 3 }}>
        {/* Header with Icon and Status */}
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
          <Box sx={{ mr: 2 }}>
            {tool.icon}
          </Box>
          <Box sx={{ flex: 1 }}>
            <Typography variant="h6" sx={{ color: 'white', fontWeight: 600, mb: 0.5 }}>
              {tool.name}
            </Typography>
            <Chip
              label={config.label || tool.status}
              size="small"
              sx={{
                background: `${config.color}20`,
                color: config.color,
                border: `1px solid ${config.color}40`,
                fontWeight: 700,
                fontSize: '0.75rem',
                textTransform: 'capitalize',
              }}
            />
          </Box>
          <Tooltip title={isFavorite ? 'Remove from favorites' : 'Add to favorites'}>
            <IconButton
              onClick={(e) => {
                e.stopPropagation();
                onToggleFavorite(tool.name);
              }}
              sx={{
                color: isFavorite ? '#FFD700' : 'rgba(255, 255, 255, 0.7)',
                '&:hover': {
                  color: isFavorite ? '#FFD700' : 'white',
                },
              }}
            >
              {isFavorite ? <StarIcon /> : <StarBorderIcon />}
            </IconButton>
          </Tooltip>
        </Box>

        {/* Description */}
        <Typography 
          variant="body2" 
          sx={{ 
            color: 'rgba(255, 255, 255, 0.8)', 
            mb: 2,
            lineHeight: 1.6,
            minHeight: '3.2em'
          }}
        >
          {tool.description}
        </Typography>

        {/* Features */}
        {tool.features && tool.features.length > 0 && (
          <Box sx={{ mt: 2 }}>
            <Typography variant="caption" sx={{ color: 'rgba(255, 255, 255, 0.6)', mb: 1, display: 'block' }}>
              Features:
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
              {tool.features.slice(0, 3).map((feature, index) => {
                const isDashboard = tool.name.toLowerCase().includes('dashboard');
                return (
                  <Chip
                    key={index}
                    label={feature}
                    size="small"
                    sx={{
                      background: isDashboard 
                        ? 'linear-gradient(135deg, rgba(156, 39, 176, 0.3) 0%, rgba(123, 31, 162, 0.2) 100%)'
                        : 'rgba(255, 255, 255, 0.1)',
                      color: isDashboard ? 'rgba(255, 255, 255, 0.95)' : 'rgba(255, 255, 255, 0.8)',
                      fontSize: '0.7rem',
                      height: '22px',
                      border: isDashboard ? '1px solid rgba(156, 39, 176, 0.4)' : 'none',
                      fontWeight: isDashboard ? 600 : 400,
                      boxShadow: isDashboard ? '0 2px 8px rgba(156, 39, 176, 0.2)' : 'none',
                      transition: 'all 0.2s ease',
                      '&:hover': isDashboard ? {
                        background: 'linear-gradient(135deg, rgba(156, 39, 176, 0.4) 0%, rgba(123, 31, 162, 0.3) 100%)',
                        transform: 'translateY(-1px)',
                        boxShadow: '0 4px 12px rgba(156, 39, 176, 0.3)',
                      } : {},
                    }}
                  />
                );
              })}
              {tool.features.length > 3 && (
                <Chip
                  label={`+${tool.features.length - 3} more`}
                  size="small"
                  sx={{
                    background: tool.name.toLowerCase().includes('dashboard')
                      ? 'linear-gradient(135deg, rgba(156, 39, 176, 0.2) 0%, rgba(123, 31, 162, 0.1) 100%)'
                      : 'rgba(255, 255, 255, 0.1)',
                    color: tool.name.toLowerCase().includes('dashboard') 
                      ? 'rgba(255, 255, 255, 0.8)' 
                      : 'rgba(255, 255, 255, 0.6)',
                    fontSize: '0.7rem',
                    height: '22px',
                    border: tool.name.toLowerCase().includes('dashboard') ? '1px solid rgba(156, 39, 176, 0.3)' : 'none',
                    fontWeight: tool.name.toLowerCase().includes('dashboard') ? 600 : 400,
                  }}
                />
              )}
            </Box>
          </Box>
        )}
      </CardContent>

      {/* Locked overlay for Premium/Pro */}
      {isLocked && (
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            background: 'linear-gradient(180deg, rgba(0,0,0,0.45) 0%, rgba(0,0,0,0.65) 100%)',
            backdropFilter: 'blur(2px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            pointerEvents: 'none',
          }}
        >
          <Box sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            color: 'rgba(255,255,255,0.95)',
            background: 'rgba(255,255,255,0.08)',
            border: '1px solid rgba(255,255,255,0.25)',
            px: 1.5,
            py: 0.75,
            borderRadius: 2,
            boxShadow: '0 8px 24px rgba(0,0,0,0.35)'
          }}>
            <LockIcon fontSize="small" />
            <Typography variant="body2" sx={{ fontWeight: 700 }}>
              {(config.label || 'Pro') + ' • Locked'}
            </Typography>
          </Box>
        </Box>
      )}
    </Card>
  );
};

export default ToolCard; 