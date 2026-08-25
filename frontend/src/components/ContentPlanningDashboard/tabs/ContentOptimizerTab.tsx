import React from 'react';
import {
  Box,
  Grid,
  Paper,
  Typography,
  List,
  ListItem,
  ListItemText,
  ListItemIcon
} from '@mui/material';
import AnalyticsIcon from '@mui/icons-material/Analytics';
import LightbulbIcon from '@mui/icons-material/Lightbulb';
import { useContentPlanningStore } from '../../../stores/contentPlanningStore';

const ContentOptimizerTab: React.FC = () => {
  const { contentOptimization } = useContentPlanningStore();

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>
        Content Optimizer
      </Typography>

      <Grid container spacing={3}>
        <Grid item xs={12}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              <AnalyticsIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
              Content Optimization
            </Typography>
            
            {contentOptimization ? (
              <Box>
                <Typography variant="body1" gutterBottom>
                  Optimization Recommendations
                </Typography>
                <List>
                  {contentOptimization.recommendations?.map((rec: any, index: number) => (
                    <ListItem key={index}>
                      <ListItemIcon>
                        <LightbulbIcon color="primary" />
                      </ListItemIcon>
                      <ListItemText 
                        primary={rec.title}
                        secondary={rec.description}
                      />
                    </ListItem>
                  ))}
                </List>
              </Box>
            ) : (
              <Box sx={{ textAlign: 'center', py: 4 }}>
                <AnalyticsIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
                <Typography variant="h6" color="text.secondary" gutterBottom>
                  No optimization data
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Generate content optimization recommendations
                </Typography>
              </Box>
            )}
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
};

export default ContentOptimizerTab; 