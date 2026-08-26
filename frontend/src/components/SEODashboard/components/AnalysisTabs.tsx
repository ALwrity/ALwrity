import React from 'react';
import { 
  Box, 
  Typography, 
  Tabs, 
  Tab, 
  Badge 
} from '@mui/material';
import ThumbUpIcon from '@mui/icons-material/ThumbUp';
import ThumbDownIcon from '@mui/icons-material/ThumbDown';
import WarningIcon2 from '@mui/icons-material/Warning';
import { AnalysisTabsProps } from '../../shared/types';
import CategoryCard from './CategoryCard';
import TabPanel from './TabPanel';

const AnalysisTabs: React.FC<AnalysisTabsProps> = ({
  categorizedData,
  expandedCategories,
  onToggleCategory,
  onIssueClick,
  onAIAction
}) => {
  const [tabValue, setTabValue] = React.useState(0);

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  return (
    <Box sx={{ width: '100%' }}>
      {/* Styled Tabs */}
      <Box sx={{ 
        borderBottom: 1, 
        borderColor: 'rgba(255, 255, 255, 0.2)',
        mb: 2,
        background: 'rgba(255, 255, 255, 0.03)',
        borderRadius: 2,
        p: 1
      }}>
        <Tabs 
          value={tabValue} 
          onChange={handleTabChange}
          variant="fullWidth"
          sx={{
            '& .MuiTab-root': {
              color: 'rgba(255, 255, 255, 0.7)',
              fontWeight: 600,
              fontSize: '0.875rem',
              textTransform: 'none',
              minHeight: 48,
              '&.Mui-selected': {
                color: 'white',
                background: 'rgba(255, 255, 255, 0.1)',
                borderRadius: 1,
              },
            },
            '& .MuiTabs-indicator': {
              display: 'none',
            },
          }}
        >
          <Tab 
            label={
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <ThumbUpIcon sx={{ color: '#388E3C' }} />
                The Good
                <Badge 
                  badgeContent={categorizedData.good.length} 
                  color="success"
                  sx={{ '& .MuiBadge-badge': { fontSize: '0.7rem' } }}
                />
              </Box>
            } 
          />
          <Tab 
            label={
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <WarningIcon2 sx={{ color: '#F57C00' }} />
                The Bad
                <Badge 
                  badgeContent={categorizedData.bad.length} 
                  color="warning"
                  sx={{ '& .MuiBadge-badge': { fontSize: '0.7rem' } }}
                />
              </Box>
            } 
          />
          <Tab 
            label={
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <ThumbDownIcon sx={{ color: '#D32F2F' }} />
                The Ugly
                <Badge 
                  badgeContent={categorizedData.ugly.length} 
                  color="error"
                  sx={{ '& .MuiBadge-badge': { fontSize: '0.7rem' } }}
                />
              </Box>
            } 
          />
        </Tabs>
      </Box>

      <TabPanel value={tabValue} index={0}>
        <Typography variant="h6" sx={{ color: '#388E3C', mb: 2, fontWeight: 600 }}>
          ✅ Good Performance ({categorizedData.good.length} categories)
        </Typography>
        {categorizedData.good.length > 0 ? (
          categorizedData.good.map(({ category, data }) => 
            <CategoryCard
              key={category}
              category={category}
              data={data}
              isExpanded={expandedCategories.has(category)}
              onToggle={onToggleCategory}
              onIssueClick={onIssueClick}
              onAIAction={onAIAction}
            />
          )
        ) : (
          <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.7)', textAlign: 'center', py: 4 }}>
            No excellent performing categories found
          </Typography>
        )}
      </TabPanel>

      <TabPanel value={tabValue} index={1}>
        <Typography variant="h6" sx={{ color: '#F57C00', mb: 2, fontWeight: 600 }}>
          ⚠️ Needs Improvement ({categorizedData.bad.length} categories)
        </Typography>
        {categorizedData.bad.length > 0 ? (
          categorizedData.bad.map(({ category, data }) => 
            <CategoryCard
              key={category}
              category={category}
              data={data}
              isExpanded={expandedCategories.has(category)}
              onToggle={onToggleCategory}
              onIssueClick={onIssueClick}
              onAIAction={onAIAction}
            />
          )
        ) : (
          <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.7)', textAlign: 'center', py: 4 }}>
            No categories needing improvement
          </Typography>
        )}
      </TabPanel>

      <TabPanel value={tabValue} index={2}>
        <Typography variant="h6" sx={{ color: '#D32F2F', mb: 2, fontWeight: 600 }}>
          ❌ Critical Issues ({categorizedData.ugly.length} categories)
        </Typography>
        {categorizedData.ugly.length > 0 ? (
          categorizedData.ugly.map(({ category, data }) => 
            <CategoryCard
              key={category}
              category={category}
              data={data}
              isExpanded={expandedCategories.has(category)}
              onToggle={onToggleCategory}
              onIssueClick={onIssueClick}
              onAIAction={onAIAction}
            />
          )
        ) : (
          <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.7)', textAlign: 'center', py: 4 }}>
            No critical issues found
          </Typography>
        )}
      </TabPanel>
    </Box>
  );
};

export default AnalysisTabs; 