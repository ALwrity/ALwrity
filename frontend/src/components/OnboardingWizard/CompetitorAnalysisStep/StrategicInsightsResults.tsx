import React from 'react';
import {
  Box,
  Typography,
  Paper,
  Grid,
  Chip,
  Card,
  CardContent,
  Tooltip,
  useTheme,
  Button,
  List,
  ListItem,
  // ListItemIcon,
  // ListItemText,
  Divider,
  Avatar
} from '@mui/material';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import LightbulbIcon from '@mui/icons-material/Lightbulb';
import WarningIcon from '@mui/icons-material/Warning';
import SpeedIcon from '@mui/icons-material/Speed';
import CheckIcon from '@mui/icons-material/CheckCircle';
import ArrowIcon from '@mui/icons-material/ArrowForward';
import StarIcon from '@mui/icons-material/Star';
import BoltIcon from '@mui/icons-material/Bolt';
import AIIcon from '@mui/icons-material/AutoAwesome';

export interface StrategicInsight {
  type: string;
  insight: string;
  reasoning?: string;
  priority: string;
  estimated_impact: string;
  implementation_time?: string;
}

export interface ContentRecommendation {
  recommendation: string;
  priority: string;
  estimated_traffic: string;
  roi_estimate: string;
}

export interface StrategicInsightsReport {
  week_commencing: string;
  generated_at: string;
  metrics: {
    market_velocity: number;
    user_velocity: number;
  };
  insights: {
    the_big_move: StrategicInsight;
    low_hanging_fruit: ContentRecommendation[];
    threat_alerts: StrategicInsight[];
  };
  raw_data?: any;
}

export interface Props {
  report: StrategicInsightsReport;
  hideCreateContent?: boolean;
}

export const StrategicInsightsResults: React.FC<Props> = ({ report, hideCreateContent = false }) => {
  const { insights, metrics, week_commencing } = report;

  const handleCreateContent = (topic: string) => {
    // Logic to redirect to Blog Writer with pre-filled prompt
    const prompt = encodeURIComponent(`Write a high-quality blog post about "${topic}" that outperforms my competitors. Focus on unique value propositions and clear CTAs.`);
    window.location.href = `/blog-writer?prompt=${prompt}`;
  };

  const PriorityChip = ({ priority }: { priority: string }) => {
    const isHigh = priority?.toLowerCase() === 'high';
    return (
      <Chip 
        label={priority} 
        size="small" 
        sx={{ 
          height: 20, 
          fontSize: '0.65rem', 
          fontWeight: 800, 
          bgcolor: isHigh ? '#fee2e2' : '#f1f5f9',
          color: isHigh ? '#b91c1c' : '#475569',
          border: `1px solid ${isHigh ? '#fecaca' : '#e2e8f0'}`,
          ml: 1
        }} 
      />
    );
  };

  return (
    <Box sx={{ mt: 4, animation: 'fadeIn 0.5s ease-out' }}>
      <Box sx={{ mb: 4, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 800, color: '#1e293b', mb: 1, display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <AIIcon sx={{ color: '#8b5cf6', fontSize: 28 }} /> 
            Weekly Strategic Intelligence
          </Typography>
          <Typography variant="body2" sx={{ color: '#64748b' }}>
            AI-generated insights for the week commencing <strong>{new Date(week_commencing).toLocaleDateString()}</strong>.
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Tooltip title="Market velocity indicates how many new pages your competitors are publishing per week.">
            <Paper variant="outlined" sx={{ px: 2, py: 1, bgcolor: '#f8fafc', borderRadius: 2, display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <SpeedIcon sx={{ color: '#64748b', fontSize: 20 }} />
              <Box>
                <Typography variant="caption" display="block" sx={{ color: '#94a3b8', fontWeight: 700, lineHeight: 1 }}>MARKET VELOCITY</Typography>
                <Typography variant="subtitle2" sx={{ color: '#1e293b', fontWeight: 800 }}>{metrics.market_velocity} posts/wk</Typography>
              </Box>
            </Paper>
          </Tooltip>
        </Box>
      </Box>

      <Grid container spacing={3}>
        {/* The Big Move - Hero Insight */}
        <Grid item xs={12}>
          <Card 
            elevation={0}
            sx={{ 
              borderRadius: 4, 
              background: 'linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%)',
              color: 'white',
              position: 'relative',
              overflow: 'hidden'
            }}
          >
            <Box sx={{ position: 'absolute', right: -20, top: -20, opacity: 0.1 }}>
              <BoltIcon sx={{ fontSize: 200 }} />
            </Box>
            <CardContent sx={{ p: 4 }}>
              <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 3 }}>
                <Avatar sx={{ bgcolor: 'rgba(255,255,255,0.2)', width: 56, height: 56 }}>
                  <StarIcon sx={{ fontSize: 32 }} />
                </Avatar>
                <Box sx={{ flex: 1 }}>
                  <Typography variant="overline" sx={{ fontWeight: 800, letterSpacing: 2, opacity: 0.9 }}>
                    THE BIG MOVE
                  </Typography>
                  <Typography variant="h4" sx={{ fontWeight: 800, mb: 2 }}>
                    {insights.the_big_move?.insight || "Analyzing market shifts..."}
                  </Typography>
                  <Typography variant="body1" sx={{ opacity: 0.9, mb: 3, maxWidth: '800px', lineHeight: 1.7 }}>
                    {insights.the_big_move?.reasoning || "We've detected a significant strategic shift in your competitive landscape. Addressing this now will give you a first-mover advantage."}
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 2 }}>
                    <Chip label={`Impact: ${insights.the_big_move?.estimated_impact || 'High'}`} sx={{ bgcolor: 'rgba(255,255,255,0.2)', color: 'white', fontWeight: 700 }} />
                    <Chip label={`Priority: ${insights.the_big_move?.priority || 'Critical'}`} sx={{ bgcolor: 'rgba(255,255,255,0.2)', color: 'white', fontWeight: 700 }} />
                  </Box>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Low Hanging Fruit - Actionable Recommendations */}
        <Grid item xs={12} lg={7}>
          <Paper elevation={0} sx={{ p: 3, borderRadius: 4, border: '1px solid #e2e8f0', bgcolor: '#ffffff', height: '100%' }}>
            <Typography variant="h6" sx={{ fontWeight: 800, color: '#1e293b', mb: 3, display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <LightbulbIcon sx={{ color: '#f59e0b' }} />
              Low-Hanging Fruit
            </Typography>
            <Typography variant="body2" sx={{ color: '#64748b', mb: 3 }}>
              Topics your competitors are starting to cover that you can easily outperform with better content.
            </Typography>
            
            <List disablePadding>
              {insights.low_hanging_fruit?.slice(0, 4).map((rec, idx) => (
                <React.Fragment key={idx}>
                  <ListItem 
                    sx={{ 
                      px: 0, 
                      py: 2,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'flex-start'
                    }}
                  >
                    <Box sx={{ display: 'flex', width: '100%', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                      <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#334155', flex: 1 }}>
                        {rec.recommendation}
                      </Typography>
                      <PriorityChip priority={rec.priority} />
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 3, width: '100%' }}>
                      <Typography variant="caption" sx={{ color: '#94a3b8', display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <TrendingUpIcon sx={{ fontSize: 14 }} /> Traffic: {rec.estimated_traffic}
                      </Typography>
                      <Typography variant="caption" sx={{ color: '#94a3b8', display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <BoltIcon sx={{ fontSize: 14 }} /> ROI: {rec.roi_estimate}
                      </Typography>
                      <Box sx={{ flexGrow: 1 }} />
                      {!hideCreateContent && (
                        <Button 
                          size="small" 
                          variant="text" 
                          endIcon={<ArrowIcon />}
                          onClick={() => handleCreateContent(rec.recommendation)}
                          sx={{ fontWeight: 700, textTransform: 'none' }}
                        >
                          Create Content
                        </Button>
                      )}
                    </Box>
                  </ListItem>
                  {idx < 3 && <Divider />}
                </React.Fragment>
              ))}
            </List>
          </Paper>
        </Grid>

        {/* Threat Alerts */}
        <Grid item xs={12} md={5}>
          <Paper elevation={0} sx={{ p: 3, borderRadius: 4, border: '1px solid #e2e8f0', bgcolor: '#fffcfc', height: '100%' }}>
            <Typography variant="h6" sx={{ fontWeight: 800, color: '#1e293b', mb: 3, display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <WarningIcon sx={{ color: '#ef4444' }} />
              Threat Alerts
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {insights.threat_alerts?.slice(0, 3).map((threat, idx) => (
                <Box 
                  key={idx} 
                  sx={{ 
                    p: 2, 
                    borderRadius: 3, 
                    bgcolor: '#ffffff', 
                    border: '1px solid #fee2e2',
                    borderLeft: '4px solid #ef4444'
                  }}
                >
                  <Typography variant="subtitle2" sx={{ fontWeight: 800, color: '#991b1b', mb: 0.5 }}>
                    {threat.type || 'Competitive Threat'}
                  </Typography>
                  <Typography variant="body2" sx={{ color: '#475569', mb: 1.5, lineHeight: 1.5 }}>
                    {threat.insight}
                  </Typography>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
                    <Chip label={threat.estimated_impact} size="small" sx={{ height: 20, fontSize: '0.65rem', fontWeight: 700, bgcolor: '#fef2f2', color: '#ef4444' }} />
                    <Button size="small" variant="outlined" color="error" sx={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'none' }}>
                      Mitigation Strategy
                    </Button>
                  </Box>
                </Box>
              ))}
              {!insights.threat_alerts?.length && (
                <Box sx={{ textAlign: 'center', py: 4 }}>
                  <CheckIcon sx={{ color: '#10b981', fontSize: 40, mb: 1, opacity: 0.5 }} />
                  <Typography variant="body2" sx={{ color: '#94a3b8' }}>No immediate threats detected this week.</Typography>
                </Box>
              )}
            </Box>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
};
