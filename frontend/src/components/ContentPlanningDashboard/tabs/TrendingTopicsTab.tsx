import React from 'react';
import {
  Box,
  Grid,
  Paper,
  Typography,
  Chip
} from '@mui/material';
import TrendingIcon from '@mui/icons-material/TrendingUp';
import { useContentPlanningStore } from '../../../stores/contentPlanningStore';

const TrendingTopicsTab: React.FC = () => {
  const { trendingTopics } = useContentPlanningStore();

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>
        Trending Topics
      </Typography>

      <Grid container spacing={3}>
        <Grid item xs={12}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              <TrendingIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
              Trending Topics
            </Typography>
            
            {trendingTopics ? (
              <Box>
                <Typography variant="body1" gutterBottom>
                  Current Trending Topics
                </Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                  {trendingTopics.trending_topics?.map((topic: any, index: number) => (
                    <Chip
                      key={index} 
                      label={topic.name || topic.keyword} 
                      color="primary"
                      variant="outlined"
                    />
                  ))}
                </Box>
              </Box>
            ) : (
              <Box sx={{ textAlign: 'center', py: 4 }}>
                <TrendingIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
                <Typography variant="h6" color="text.secondary" gutterBottom>
                  No trending topics
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Get trending topics for your industry
                </Typography>
              </Box>
            )}
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
};

export default TrendingTopicsTab; 