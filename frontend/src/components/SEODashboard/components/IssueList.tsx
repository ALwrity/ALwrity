import React from 'react';
import { 
  Box, 
  Typography, 
  List, 
  ListItem, 
  ListItemIcon, 
  ListItemText, 
  Button 
} from '@mui/material';
import ErrorIcon from '@mui/icons-material/Error';
import WarningIcon from '@mui/icons-material/Warning';
import InfoIcon from '@mui/icons-material/Info';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import { IssueListProps } from '../../shared/types';

const IssueList: React.FC<IssueListProps> = ({
  issues,
  type,
  onIssueClick,
  onAIAction
}) => {
  if (!issues || issues.length === 0) return null;

  const colors = {
    critical: '#D32F2F', // Softer red instead of bright #F44336
    warning: '#F57C00', // Softer orange instead of bright #FF9800
    recommendation: '#388E3C' // Softer green instead of bright #4CAF50
  };

  const icons = {
    critical: <ErrorIcon sx={{ fontSize: 16, color: colors.critical }} />,
    warning: <WarningIcon sx={{ fontSize: 16, color: colors.warning }} />,
    recommendation: <InfoIcon sx={{ fontSize: 16, color: colors.recommendation }} />
  };

  const typeLabels = {
    critical: 'Critical Issues',
    warning: 'Warnings',
    recommendation: 'Recommendations'
  };

  return (
    <Box sx={{ mt: 1 }}>
      <Typography variant="subtitle2" sx={{ 
        color: colors[type], 
        fontWeight: 600, 
        mb: 1,
        display: 'flex',
        alignItems: 'center',
        gap: 0.5
      }}>
        {icons[type]}
        {typeLabels[type]} ({issues.length})
      </Typography>
      <List dense>
        {issues.slice(0, 3).map((issue, index) => (
          <ListItem 
            key={index} 
            sx={{ 
              p: 1, 
              mb: 0.5, 
              background: 'rgba(255, 255, 255, 0.05)', 
              borderRadius: 1,
              cursor: 'pointer',
              '&:hover': { background: 'rgba(255, 255, 255, 0.1)' }
            }}
            onClick={() => onIssueClick(issue)}
          >
            <ListItemIcon sx={{ minWidth: 32 }}>
              {icons[type]}
            </ListItemIcon>
            <ListItemText 
              primary={issue.message}
              secondary={`Location: ${issue.location}`}
              primaryTypographyProps={{ 
                variant: 'body2', 
                color: colors[type],
                fontWeight: 500
              }}
              secondaryTypographyProps={{ 
                variant: 'caption', 
                color: 'rgba(255, 255, 255, 0.7)'
              }}
            />
            <Button
              size="small"
              variant="outlined"
              startIcon={<PlayArrowIcon />}
              sx={{
                color: colors[type],
                borderColor: colors[type],
                '&:hover': { borderColor: colors[type], backgroundColor: `${colors[type]}20` }
              }}
              onClick={(e) => {
                e.stopPropagation();
                onAIAction(issue.action, issue);
              }}
            >
              Fix with AI
            </Button>
          </ListItem>
        ))}
        {issues.length > 3 && (
          <ListItem sx={{ p: 1 }}>
            <ListItemText 
              primary={`... and ${issues.length - 3} more`}
              primaryTypographyProps={{ 
                variant: 'body2', 
                color: colors[type],
                fontSize: '0.875rem'
              }}
            />
          </ListItem>
        )}
      </List>
    </Box>
  );
};

export default IssueList; 