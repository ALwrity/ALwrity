import React from 'react';
import {
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Chip,
  Box,
  Typography,
  Button,
  IconButton,
  CircularProgress
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import WarningIcon from '@mui/icons-material/Warning';
import VisibilityIcon from '@mui/icons-material/Visibility';
import SchoolIcon from '@mui/icons-material/School';
import { motion } from 'framer-motion';
import { getCategoryIcon, getCategoryName, getCategoryStatus } from '../utils/categoryHelpers';

interface CategoryListProps {
  completionStats: any;
  formData: any;
  STRATEGIC_INPUT_FIELDS: any[];
  activeCategory: string | null;
  reviewedCategories: Set<string>;
  isMarkingReviewed: boolean;
  isNextInSequence: (categoryId: string, allCategories: string[]) => boolean;
  onReviewCategory: (categoryId: string) => void;
  onShowEducationalInfo: (categoryId: string) => void;
}

const CategoryList: React.FC<CategoryListProps> = ({
  completionStats,
  formData,
  STRATEGIC_INPUT_FIELDS,
  activeCategory,
  reviewedCategories,
  isMarkingReviewed,
  isNextInSequence,
  onReviewCategory,
  onShowEducationalInfo
}) => {
  return (
    <List sx={{ p: 0 }}>
      {Object.entries(completionStats.category_completion).map(([categoryId, percentage]) => {
        const categoryName = getCategoryName(categoryId);
        const percentageValue = percentage as number;
        
        // Get category-specific stats
        const categoryFields = STRATEGIC_INPUT_FIELDS.filter(f => f.category === categoryId);
        const filledFields = categoryFields.filter(field => formData[field.id]).length;
        const totalFields = categoryFields.length;
        
        const categoryStatus = getCategoryStatus(percentageValue);
        const isSelected = activeCategory === categoryId;
        const isDefault = Object.keys(completionStats.category_completion)[0] === categoryId;
        const isReviewed = reviewedCategories.has(categoryId);
        
        // Find the next category in sequence for guidance
        const allCategories = Object.keys(completionStats.category_completion);
        const isNextInSequenceCategory = isNextInSequence(categoryId, allCategories);
        
        return (
          <motion.div
            key={categoryId}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3 }}
          >
            <ListItem 
              sx={{ 
                p: 1.25,
                mb: 0.4,
                borderRadius: 2,
                bgcolor: isSelected ? 'action.hover' : isNextInSequenceCategory ? 'rgba(25, 118, 210, 0.08)' : 'transparent',
                border: isSelected ? '2px solid' : isNextInSequenceCategory ? '1px solid' : '1px solid',
                borderColor: isSelected ? 'primary.main' : isNextInSequenceCategory ? 'primary.main' : 'divider',
                flexDirection: 'column',
                alignItems: 'stretch',
                position: 'relative',
                overflow: 'hidden',
                // Futuristic styling
                background: isSelected ? 'linear-gradient(135deg, rgba(102, 126, 234, 0.1) 0%, rgba(118, 75, 162, 0.1) 100%)' : 'transparent',
                backdropFilter: isSelected ? 'blur(10px)' : 'none',
                // Shimmer animation for default category
                '&::before': isDefault && !isSelected ? {
                  content: '""',
                  position: 'absolute',
                  top: 0,
                  left: '-100%',
                  width: '100%',
                  height: '100%',
                  background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent)',
                  animation: 'shimmer 2s infinite',
                  zIndex: 0
                } : {},
                '&:hover': {
                  transform: 'translateY(-1px)',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                  transition: 'all 0.2s ease'
                }
              }}
            >
              {/* Category Header - Compact */}
              <Box sx={{ display: 'flex', alignItems: 'center', width: '100%', mb: 0.4, position: 'relative', zIndex: 1 }}>
                <ListItemIcon sx={{ minWidth: 32 }}>
                  {getCategoryIcon(categoryId)}
                </ListItemIcon>
                <ListItemText
                  primary={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      {categoryName}
                      {isNextInSequenceCategory && (
                        <Chip
                          label="Next"
                          size="small"
                          color="primary"
                          sx={{ 
                            height: 15,
                            fontSize: '0.58rem',
                            '& .MuiChip-label': { px: 0.5 }
                          }}
                        />
                      )}
                    </Box>
                  }
                  secondary={`${Math.round(percentageValue)}% complete`}
                  sx={{ 
                    flex: 1,
                    '& .MuiListItemText-primary': { fontSize: '0.88rem', fontWeight: 500 },
                    '& .MuiListItemText-secondary': { fontSize: '0.68rem' }
                  }}
                />
                <Chip 
                  label={isReviewed ? 'Reviewed' : categoryStatus.status}
                  color={isReviewed ? 'success' : categoryStatus.color}
                  size="small" 
                  sx={{ 
                    mr: 0.5,
                    height: 20,
                    fontSize: '0.6rem',
                    '& .MuiChip-label': { px: 1 }
                  }}
                />
              </Box>
              
              {/* Category Progress Bar - Compact Circular */}
              <Box sx={{ mb: 0.5, position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                <Box sx={{ position: 'relative', display: 'inline-flex' }}>
                  <CircularProgress
                    variant="determinate"
                    value={percentageValue}
                    size={24}
                    thickness={3}
                    sx={{
                      color: 'primary.main',
                      '& .MuiCircularProgress-circle': {
                        strokeLinecap: 'round',
                      }
                    }}
                  />
                  <Box
                    sx={{
                      top: 0,
                      left: 0,
                      bottom: 0,
                      right: 0,
                      position: 'absolute',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Typography
                      variant="caption"
                      component="div"
                      color="text.secondary"
                      sx={{ fontSize: '0.5rem', fontWeight: 'bold' }}
                    >
                      {`${Math.round(percentageValue)}%`}
                    </Typography>
                  </Box>
                </Box>
                <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.6rem' }}>
                  {filledFields}/{totalFields} fields
                </Typography>
              </Box>
              
              {/* Category Actions - Compact */}
              <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'space-between', alignItems: 'center', position: 'relative', zIndex: 1 }}>
                <Box sx={{ display: 'flex', gap: 0.5 }}>
                  {/* Review Button - Compact */}
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={
                      isMarkingReviewed && activeCategory === categoryId ? 
                        <CircularProgress size={14} /> : 
                        <VisibilityIcon sx={{ fontSize: 14 }} />
                    }
                    onClick={() => onReviewCategory(categoryId)}
                    disabled={isMarkingReviewed && activeCategory === categoryId}
                    sx={{ 
                      minWidth: 'auto',
                      height: 24,
                      fontSize: '0.6rem',
                      px: 1,
                      '& .MuiButton-startIcon': { mr: 0.5 }
                    }}
                  >
                    {isMarkingReviewed && activeCategory === categoryId ? 
                      'Marking...' : 
                      (isReviewed ? 'Reviewed' : 'Review')
                    }
                  </Button>
                  
                  {/* Educational Info Button - Compact */}
                  <IconButton
                    size="small"
                    onClick={() => onShowEducationalInfo(categoryId)}
                    sx={{ 
                      color: 'primary.main',
                      width: 24,
                      height: 24,
                      '& .MuiSvgIcon-root': { fontSize: 14 }
                    }}
                  >
                    <SchoolIcon />
                  </IconButton>
                </Box>
                
                {/* Category Status Indicator - Compact */}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
                  {percentageValue >= 90 ? (
                    <CheckCircleIcon color="success" fontSize="small" sx={{ fontSize: 14 }} />
                  ) : percentageValue >= 70 ? (
                    <TrendingUpIcon color="primary" fontSize="small" sx={{ fontSize: 14 }} />
                  ) : (
                    <WarningIcon color="warning" fontSize="small" sx={{ fontSize: 14 }} />
                  )}
                </Box>
              </Box>
            </ListItem>
          </motion.div>
        );
      })}
    </List>
  );
};

export default CategoryList; 