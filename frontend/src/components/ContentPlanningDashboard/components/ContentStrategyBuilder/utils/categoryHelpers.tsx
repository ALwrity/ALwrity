import React from 'react';
import BusinessIcon from '@mui/icons-material/Business';
import PeopleIcon from '@mui/icons-material/People';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import ContentIcon from '@mui/icons-material/ContentPaste';
import AnalyticsIcon from '@mui/icons-material/Analytics';
import HelpIcon from '@mui/icons-material/Help';

export const getCategoryIcon = (categoryId: string): React.ReactElement => {
  switch (categoryId) {
    case 'business_context': return <BusinessIcon />;
    case 'audience_intelligence': return <PeopleIcon />;
    case 'competitive_intelligence': return <TrendingUpIcon />;
    case 'content_strategy': return <ContentIcon />;
    case 'performance_analytics': return <AnalyticsIcon />;
    default: return <HelpIcon />;
  }
};

export const getCategoryColor = (categoryId: string): string => {
  switch (categoryId) {
    case 'business_context': return 'primary';
    case 'audience_intelligence': return 'secondary';
    case 'competitive_intelligence': return 'success';
    case 'content_strategy': return 'warning';
    case 'performance_analytics': return 'info';
    default: return 'primary';
  }
};

export const getCategoryName = (categoryId: string): string => {
  return categoryId.split('_').map(word => 
    word.charAt(0).toUpperCase() + word.slice(1)
  ).join(' ');
};

export const getCategoryStatus = (percentage: number) => {
  if (percentage >= 90) return { status: 'Complete', color: 'success' as const };
  if (percentage >= 70) return { status: 'Good', color: 'primary' as const };
  if (percentage >= 50) return { status: 'Fair', color: 'warning' as const };
  return { status: 'Needs Work', color: 'error' as const };
}; 