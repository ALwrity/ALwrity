import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  Chip,
  Divider,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Card,
  CardContent,
  Alert,
  LinearProgress
} from '@mui/material';
import HelpIcon from '@mui/icons-material/Help';
import LightbulbIcon from '@mui/icons-material/Lightbulb';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import WarningIcon from '@mui/icons-material/Warning';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import DataUsageIcon from '@mui/icons-material/DataUsage';
import CloseIcon from '@mui/icons-material/Close';
import { useStrategyBuilderStore } from '../../../../stores/strategyBuilderStore';

interface EnhancedTooltipProps {
  fieldId: string;
  open: boolean;
  onClose: () => void;
}

const EnhancedTooltip: React.FC<EnhancedTooltipProps> = ({
  fieldId,
  open,
  onClose
}) => {
  const { autoPopulatedFields, dataSources, confidenceScores } = useStrategyBuilderStore();
  
  // Since getTooltipData is not in strategyBuilderStore, we'll create a simple implementation
  const getTooltipData = (fieldId: string) => {
    // This is a simplified tooltip data implementation
    // In a real scenario, you might want to move this to the strategyBuilderStore
    return {
      title: `About ${fieldId.replace(/_/g, ' ')}`,
      description: `Information about ${fieldId.replace(/_/g, ' ')}`,
      tips: [`Tip for ${fieldId}`],
      confidence_level: confidenceScores?.[fieldId] || 0.8
    };
  };
  
  const tooltipData = getTooltipData(fieldId);
  const isAutoPopulated = !!(autoPopulatedFields && autoPopulatedFields[fieldId]);
  const dataSource = dataSources && dataSources[fieldId];

  // Early return if no tooltip data
  if (!tooltipData) {
    return null;
  }

  const getFieldExamples = (fieldId: string) => {
    const examples: Record<string, string[]> = {
      business_objectives: [
        'Primary: Increase brand awareness by 40%',
        'Secondary: Generate 500 qualified leads per month',
        'Secondary: Improve customer engagement by 25%'
      ],
      target_metrics: [
        'Traffic: 50% increase in organic traffic',
        'Engagement: 3.5+ average time on page',
        'Conversions: 15% improvement in conversion rate'
      ],
      content_budget: [
        'Monthly budget: $5,000 for content creation',
        'Annual budget: $60,000 including tools and team',
        'Per-piece budget: $500 average per content piece'
      ],
      team_size: [
        'Small team: 1-2 content creators',
        'Medium team: 3-5 content creators + manager',
        'Large team: 6+ creators, editors, and strategists'
      ],
      content_preferences: [
        'Formats: Blog posts, videos, infographics',
        'Topics: Technology trends, industry insights',
        'Tone: Professional but approachable'
      ],
      preferred_formats: [
        'Blog Posts: 40% of content mix',
        'Videos: 30% of content mix',
        'Infographics: 20% of content mix',
        'Webinars: 10% of content mix'
      ],
      content_frequency: [
        'Daily: For news and trending topics',
        'Weekly: For in-depth analysis pieces',
        'Bi-weekly: For comprehensive guides',
        'Monthly: For thought leadership content'
      ]
    };
    
    return examples[fieldId] || [
      'Example 1: Provide specific, measurable examples',
      'Example 2: Include both qualitative and quantitative data',
      'Example 3: Align with your business objectives'
    ];
  };

  const getBestPractices = (fieldId: string) => {
    const practices: Record<string, string[]> = {
      business_objectives: [
        'Make objectives SMART (Specific, Measurable, Achievable, Relevant, Time-bound)',
        'Align with overall business goals',
        'Include both primary and secondary objectives',
        'Set realistic but ambitious targets'
      ],
      target_metrics: [
        'Choose metrics that directly impact business outcomes',
        'Include leading and lagging indicators',
        'Set baseline measurements before starting',
        'Track metrics consistently over time'
      ],
      content_preferences: [
        'Base preferences on audience research and analytics',
        'Consider your team\'s content creation capabilities',
        'Balance audience preferences with business goals',
        'Test different formats to find what works best'
      ],
      preferred_formats: [
        'Choose formats that align with your audience\'s consumption habits',
        'Consider your team\'s expertise and resources',
        'Mix different formats to reach different audience segments',
        'Prioritize formats that drive your target metrics'
      ],
      content_frequency: [
        'Set realistic frequency based on team capacity',
        'Consider your audience\'s content consumption patterns',
        'Balance quality with quantity',
        'Allow flexibility for trending topics and opportunities'
      ]
    };
    
    return practices[fieldId] || [
      'Research your audience thoroughly before making decisions',
      'Test and iterate based on performance data',
      'Align all decisions with your business objectives',
      'Consider your team\'s capabilities and resources'
    ];
  };

  const examples = getFieldExamples(fieldId);
  const bestPractices = getBestPractices(fieldId);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 2,
          maxHeight: '80vh'
        }
      }}
    >
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <HelpIcon color="primary" />
          <Typography variant="h6">
            {tooltipData.title}
          </Typography>
          {isAutoPopulated && (
            <Chip
              icon={<AutoAwesomeIcon />}
              label="Auto-populated"
              color="info"
              size="small"
            />
          )}
        </Box>
      </DialogTitle>

      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          {/* Description */}
          <Box>
            <Typography variant="subtitle1" gutterBottom>
              Description
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {tooltipData.description}
            </Typography>
          </Box>

          {/* Data Source Information */}
          {isAutoPopulated && dataSource && (
            <Alert severity="info" icon={<DataUsageIcon />}>
              <Typography variant="body2">
                This field was automatically populated from your onboarding data ({dataSource}).
                You can modify this value if needed.
              </Typography>
            </Alert>
          )}

          {/* Examples */}
          <Box>
            <Typography variant="subtitle1" gutterBottom>
              Examples
            </Typography>
            <List dense>
              {examples.map((example, index) => (
                <ListItem key={index} sx={{ py: 0.5 }}>
                  <ListItemIcon sx={{ minWidth: 32 }}>
                    <CheckCircleIcon color="success" fontSize="small" />
                  </ListItemIcon>
                  <ListItemText 
                    primary={example}
                    primaryTypographyProps={{ variant: 'body2' }}
                  />
                </ListItem>
              ))}
            </List>
          </Box>

          <Divider />

          {/* Best Practices */}
          <Box>
            <Typography variant="subtitle1" gutterBottom>
              Best Practices
            </Typography>
            <List dense>
              {bestPractices.map((practice, index) => (
                <ListItem key={index} sx={{ py: 0.5 }}>
                  <ListItemIcon sx={{ minWidth: 32 }}>
                    <LightbulbIcon color="primary" fontSize="small" />
                  </ListItemIcon>
                  <ListItemText 
                    primary={practice}
                    primaryTypographyProps={{ variant: 'body2' }}
                  />
                </ListItem>
              ))}
            </List>
          </Box>

          {/* Field Importance */}
          <Card variant="outlined">
            <CardContent>
              <Typography variant="subtitle2" gutterBottom>
                Why This Matters
              </Typography>
              <Typography variant="body2" color="text.secondary">
                This information helps create a more targeted and effective content strategy. 
                The more accurate and detailed your inputs, the better our AI can generate 
                personalized recommendations for your specific situation.
              </Typography>
            </CardContent>
          </Card>

          {/* Confidence Level */}
          {tooltipData.confidence_level && (
            <Box>
              <Typography variant="subtitle2" gutterBottom>
                Data Confidence
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <LinearProgress
                  variant="determinate"
                  value={tooltipData.confidence_level * 100}
                  sx={{ flexGrow: 1, height: 8, borderRadius: 4 }}
                />
                <Typography variant="body2" color="text.secondary">
                  {Math.round(tooltipData.confidence_level * 100)}%
                </Typography>
              </Box>
              <Typography variant="caption" color="text.secondary">
                Confidence level based on data quality and source reliability
              </Typography>
            </Box>
          )}
        </Box>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose} startIcon={<CloseIcon />}>
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default EnhancedTooltip; 