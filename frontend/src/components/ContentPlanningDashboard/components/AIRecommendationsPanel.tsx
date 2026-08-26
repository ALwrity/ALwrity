import React from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  Chip,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Divider,
  LinearProgress,
  Alert,
  IconButton,
  Collapse
} from '@mui/material';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import LightbulbIcon from '@mui/icons-material/Lightbulb';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import PsychologyIcon from '@mui/icons-material/Psychology';
import AnalyticsIcon from '@mui/icons-material/Analytics';
import CalendarIcon from '@mui/icons-material/CalendarToday';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import RefreshIcon from '@mui/icons-material/Refresh';

interface AIRecommendationsPanelProps {
  aiGenerating: boolean;
  onGenerateRecommendations: () => void;
}

const AIRecommendationsPanel: React.FC<AIRecommendationsPanelProps> = ({
  aiGenerating,
  onGenerateRecommendations
}) => {
  const [expanded, setExpanded] = React.useState(true);

  // Mock AI recommendations data (this would come from the store)
  const aiRecommendations = [
    {
      id: '1',
      type: 'comprehensive_strategy',
      title: 'Content Strategy Optimization',
      description: 'Based on your business objectives, we recommend focusing on thought leadership content to establish authority in your industry.',
      confidence: 0.85,
      category: 'Strategy',
      icon: <PsychologyIcon />
    },
    {
      id: '2',
      type: 'audience_intelligence',
      title: 'Audience Targeting',
      description: 'Your audience prefers video content and technical deep-dives. Consider increasing video production by 40%.',
      confidence: 0.78,
      category: 'Audience',
      icon: <TrendingUpIcon />
    },
    {
      id: '3',
      type: 'competitive_intelligence',
      title: 'Competitive Advantage',
      description: 'Your competitors are weak in technical content. This presents an opportunity to differentiate through detailed tutorials.',
      confidence: 0.92,
      category: 'Competition',
      icon: <LightbulbIcon />
    },
    {
      id: '4',
      type: 'performance_optimization',
      title: 'Performance Improvement',
      description: 'Your current content frequency is optimal. Focus on quality over quantity to improve engagement rates.',
      confidence: 0.76,
      category: 'Performance',
      icon: <AnalyticsIcon />
    },
    {
      id: '5',
      type: 'content_calendar_optimization',
      title: 'Publishing Schedule',
      description: 'Publish technical content on Tuesdays and Thursdays when your audience is most engaged.',
      confidence: 0.81,
      category: 'Calendar',
      icon: <CalendarIcon />
    }
  ];

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return 'success';
    if (confidence >= 0.6) return 'warning';
    return 'error';
  };

  const getConfidenceLabel = (confidence: number) => {
    if (confidence >= 0.8) return 'High';
    if (confidence >= 0.6) return 'Medium';
    return 'Low';
  };

  return (
    <Card variant="outlined">
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
          <AutoAwesomeIcon color="primary" />
          <Typography variant="h6">
            AI Recommendations
          </Typography>
          <IconButton
            size="small"
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
          </IconButton>
        </Box>

        <Collapse in={expanded}>
          {/* Generate Button */}
          <Box sx={{ mb: 2 }}>
            <Button
              variant="contained"
              fullWidth
              startIcon={aiGenerating ? undefined : <AutoAwesomeIcon />}
              onClick={onGenerateRecommendations}
              disabled={aiGenerating}
              sx={{ mb: 1 }}
            >
              {aiGenerating ? 'Generating...' : 'Generate AI Insights'}
            </Button>
            
            {aiGenerating && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <LinearProgress sx={{ flexGrow: 1 }} />
                <Typography variant="caption" color="text.secondary">
                  Analyzing...
                </Typography>
              </Box>
            )}
          </Box>

          {/* AI Recommendations List */}
          {aiRecommendations.length > 0 && (
            <Box>
              <Typography variant="subtitle2" gutterBottom>
                Recent Recommendations
              </Typography>
              
              <List dense>
                {aiRecommendations.map((recommendation, index) => (
                  <React.Fragment key={recommendation.id}>
                    <ListItem sx={{ px: 0 }}>
                      <ListItemIcon sx={{ minWidth: 40 }}>
                        {recommendation.icon}
                      </ListItemIcon>
                      <ListItemText
                        primary={
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                            <Typography variant="body2" fontWeight="medium">
                              {recommendation.title}
                            </Typography>
                            <Chip
                              label={recommendation.category}
                              size="small"
                              variant="outlined"
                            />
                            <Chip
                              label={`${Math.round(recommendation.confidence * 100)}% confidence`}
                              size="small"
                              color={getConfidenceColor(recommendation.confidence)}
                            />
                          </Box>
                        }
                        secondary={
                          <Typography variant="body2" color="text.secondary">
                            {recommendation.description}
                          </Typography>
                        }
                      />
                    </ListItem>
                    {index < aiRecommendations.length - 1 && <Divider />}
                  </React.Fragment>
                ))}
              </List>
            </Box>
          )}

          {/* No Recommendations State */}
          {aiRecommendations.length === 0 && !aiGenerating && (
            <Alert severity="info" sx={{ mt: 2 }}>
              <Typography variant="body2">
                Generate AI recommendations to get personalized insights for your content strategy.
              </Typography>
            </Alert>
          )}

          {/* AI Status */}
          <Box sx={{ mt: 2, p: 1, bgcolor: 'background.default', borderRadius: 1 }}>
            <Typography variant="caption" color="text.secondary">
              AI analyzes your inputs to provide personalized recommendations for your content strategy.
            </Typography>
          </Box>
        </Collapse>
      </CardContent>
    </Card>
  );
};

export default AIRecommendationsPanel; 