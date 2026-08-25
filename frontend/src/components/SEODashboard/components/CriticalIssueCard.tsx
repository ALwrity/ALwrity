import React from 'react';
import { 
  Paper, 
  Typography, 
  Button 
} from '@mui/material';
import BuildIcon from '@mui/icons-material/Build';
import { CriticalIssueCardProps } from '../../shared/types';
import { formatMessage } from './seoUtils';

const CriticalIssueCard: React.FC<CriticalIssueCardProps> = ({
  issue,
  index,
  onClick,
  onAIAction
}) => {
  const { title, details } = formatMessage(issue.message);

  return (
    <Paper sx={{ 
      p: 2, 
      mb: 1,
      background: 'rgba(211, 47, 47, 0.08)',
      border: '1px solid rgba(211, 47, 47, 0.2)',
      cursor: 'pointer',
      '&:hover': { background: 'rgba(211, 47, 47, 0.12)' }
    }}
    onClick={() => onClick(issue)}
    >
      <Typography variant="subtitle2" sx={{ color: '#D32F2F', fontWeight: 600, mb: 1 }}>
        {title}
      </Typography>
      
      {details && (
        <Typography variant="body2" sx={{ 
          color: 'rgba(255, 255, 255, 0.9)', 
          mb: 1,
          fontSize: '0.875rem',
          lineHeight: 1.4,
          wordBreak: 'break-word'
        }}>
          {details}
        </Typography>
      )}
      
      <Typography variant="caption" sx={{ 
        color: 'rgba(255, 255, 255, 0.8)', 
        display: 'block', 
        mb: 1,
        fontSize: '0.75rem'
      }}>
        Location: {issue.location}
      </Typography>
      
      <Button
        size="small"
        variant="contained"
        startIcon={<BuildIcon />}
        sx={{
          backgroundColor: '#D32F2F',
          '&:hover': { backgroundColor: '#B71C1C' }
        }}
        onClick={(e) => {
          e.stopPropagation();
          onAIAction(issue.action, issue);
        }}
      >
        Fix with AI
      </Button>
    </Paper>
  );
};

export default CriticalIssueCard; 