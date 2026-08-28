import React from 'react';
import { 
  Card, 
  CardContent, 
  Typography, 
  Chip, 
  LinearProgress, 
  Collapse, 
  IconButton, 
  Divider,
  Box
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import { CategoryCardProps } from '../../shared/types';
import { getCategoryIcon, getCategoryTitle, getStatusColor } from './seoUtils';
import IssueList from './IssueList';

const CategoryCard: React.FC<CategoryCardProps> = ({
  category,
  data,
  isExpanded,
  onToggle,
  onIssueClick,
  onAIAction
}) => {
  const score = data.score;
  const status = score >= 80 ? 'excellent' : score >= 60 ? 'good' : score >= 40 ? 'needs_improvement' : 'poor';
  
  return (
    <Card
      sx={{
        background: 'rgba(255, 255, 255, 0.08)',
        border: '1px solid rgba(255, 255, 255, 0.15)',
        cursor: 'pointer',
        transition: 'all 0.3s ease',
        mb: 2,
        '&:hover': {
          background: 'rgba(255, 255, 255, 0.12)',
          transform: 'translateY(-2px)',
          boxShadow: '0 8px 25px rgba(0,0,0,0.3)',
        },
      }}
      onClick={() => onToggle(category)}
    >
      <CardContent sx={{ p: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
          {getCategoryIcon(category)}
          <Typography variant="subtitle2" sx={{ color: 'white', ml: 1, flex: 1, fontWeight: 600 }}>
            {getCategoryTitle(category)}
          </Typography>
          <Chip
            label={score}
            size="small"
            sx={{
              backgroundColor: getStatusColor(status),
              color: 'white',
              fontWeight: 600,
              fontSize: '0.75rem',
            }}
          />
        </Box>
        
        <LinearProgress
          variant="determinate"
          value={score}
          sx={{
            height: 4,
            borderRadius: 2,
            backgroundColor: 'rgba(255, 255, 255, 0.1)',
            '& .MuiLinearProgress-bar': {
              backgroundColor: getStatusColor(status),
              borderRadius: 2,
            },
          }}
        />
        
        <IconButton 
          size="small" 
          sx={{ 
            color: 'rgba(255, 255, 255, 0.7)', 
            mt: 1,
            '&:hover': { color: 'white' }
          }}
        >
          {isExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
        </IconButton>
      </CardContent>
      
      <Collapse in={isExpanded}>
        <Divider sx={{ borderColor: 'rgba(255, 255, 255, 0.1)' }} />
        <Box sx={{ p: 2, pt: 1 }}>
          <IssueList 
            issues={data.issues || []} 
            type="critical" 
            onIssueClick={onIssueClick}
            onAIAction={onAIAction}
          />
          <IssueList 
            issues={data.warnings || []} 
            type="warning" 
            onIssueClick={onIssueClick}
            onAIAction={onAIAction}
          />
          <IssueList 
            issues={data.recommendations || []} 
            type="recommendation" 
            onIssueClick={onIssueClick}
            onAIAction={onAIAction}
          />
          
          {/* Show key metrics if available */}
          {data.load_time && (
            <Typography variant="caption" sx={{ color: '#666', display: 'block', mt: 1 }}>
              Load Time: {data.load_time.toFixed(2)}s
            </Typography>
          )}
          {data.word_count && (
            <Typography variant="caption" sx={{ color: '#666', display: 'block' }}>
              Words: {data.word_count}
            </Typography>
          )}
          {data.total_headers !== undefined && (
            <Typography variant="caption" sx={{ color: '#666', display: 'block' }}>
              Security Headers: {data.total_headers}/6
            </Typography>
          )}
        </Box>
      </Collapse>
    </Card>
  );
};

export default CategoryCard; 