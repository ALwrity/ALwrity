import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Chip,
  LinearProgress,
  Button,
} from '@mui/material';
import TrendIcon from '@mui/icons-material/TrendingUp';
import HotIcon from '@mui/icons-material/Whatshot';
import EditNoteIcon from '@mui/icons-material/EditNote';
import { AgentEventItem } from '../../hooks/useAgentHuddleFeed';

interface TrendOpportunity {
  trend_id: string;
  topic: string;
  headline: string;
  source: string;
  urgency: string;
  impact_score: number;
  current_coverage: number;
  recommendation: string;
  suggested_angle: string;
  detected_at: string;
}

interface TrendSignalPayload {
  opportunities: TrendOpportunity[];
  total_detected: number;
  scan_timestamp: string;
}

const urgencyColor = (u: string) => {
  if (u === 'critical') return '#f44336';
  if (u === 'high') return '#ff9800';
  return '#4caf50';
};

const recommendationLabel = (r: string) => {
  if (r === 'create_content' || r === 'create') return 'Create Content';
  return r.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
};

const TrendSignalsPanel: React.FC<{ events: AgentEventItem[] }> = ({ events }) => {
  const navigate = useNavigate();

  const signals = useMemo<TrendSignalPayload | null>(() => {
    const evt = events.find((e) => e.event_type === 'trend_signals');
    if (!evt?.payload) return null;
    return (typeof evt.payload === 'string' ? JSON.parse(evt.payload) : evt.payload) as TrendSignalPayload;
  }, [events]);

  if (!signals?.opportunities?.length) return null;

  const handleCreateContent = (opp: TrendOpportunity) => {
    navigate('/blog-writer', {
      state: {
        trendTopic: opp.topic,
        trendHeadline: opp.headline,
        trendAngle: opp.suggested_angle,
        trendUrgency: opp.urgency,
        trendImpact: opp.impact_score,
        source: 'trend_signals',
      },
    });
  };

  return (
    <Box
      sx={{
        background: 'linear-gradient(180deg, rgba(255,255,255,0.10) 0%, rgba(255,255,255,0.04) 100%)',
        backdropFilter: 'blur(22px)',
        WebkitBackdropFilter: 'blur(22px)',
        border: '1px solid rgba(255,255,255,0.12)',
        borderRadius: 3.5,
        boxShadow: '0 18px 50px rgba(0,0,0,0.25)',
        p: 2.5,
        mb: 2,
      }}
    >
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
        <TrendIcon sx={{ fontSize: 18, color: '#ff9800' }} />
        <Typography variant="h6" sx={{ fontWeight: 700, color: 'rgba(255,255,255,0.95)', fontSize: '0.95rem' }}>
          Trend Signals
        </Typography>
        <Chip
          label={`${signals.total_detected} detected`}
          size="small"
          sx={{ ml: 'auto', height: 20, fontSize: 10, fontWeight: 600, bgcolor: 'rgba(255,152,0,0.15)', color: '#ff9800' }}
        />
      </Box>

      {/* Opportunities */}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        {signals.opportunities.map((opp, i) => (
          <Box
            key={opp.trend_id || i}
            sx={{
              p: 1.25,
              borderRadius: 2,
              bgcolor: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.06)',
              '&:hover': { bgcolor: 'rgba(255,255,255,0.06)' },
            }}
          >
            {/* Headline + urgency */}
            <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, mb: 0.75 }}>
              <HotIcon sx={{ fontSize: 14, color: urgencyColor(opp.urgency), mt: 0.25, flexShrink: 0 }} />
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.85)', fontWeight: 600, lineHeight: 1.3 }}>
                  {opp.headline || opp.topic}
                </Typography>
              </Box>
              <Chip
                label={opp.urgency}
                size="small"
                sx={{
                  height: 18,
                  fontSize: 9,
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  bgcolor: `${urgencyColor(opp.urgency)}22`,
                  color: urgencyColor(opp.urgency),
                  flexShrink: 0,
                }}
              />
            </Box>

            {/* Angle */}
            {opp.suggested_angle && (
              <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.45)', display: 'block', mb: 0.75, lineHeight: 1.4, pl: 3 }}>
                {opp.suggested_angle}
              </Typography>
            )}

            {/* Metrics row */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, pl: 3 }}>
              <Box sx={{ flex: 1 }}>
                <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.3)', fontSize: 9, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  Impact
                </Typography>
                <LinearProgress
                  variant="determinate"
                  value={opp.impact_score * 100}
                  sx={{
                    height: 3,
                    borderRadius: 1.5,
                    bgcolor: 'rgba(255,255,255,0.08)',
                    '& .MuiLinearProgress-bar': {
                      bgcolor: opp.impact_score > 0.7 ? '#ff9800' : '#8b9cf7',
                    },
                  }}
                />
              </Box>
              <Box sx={{ flex: 1 }}>
                <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.3)', fontSize: 9, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  Coverage
                </Typography>
                <LinearProgress
                  variant="determinate"
                  value={opp.current_coverage * 100}
                  sx={{
                    height: 3,
                    borderRadius: 1.5,
                    bgcolor: 'rgba(255,255,255,0.08)',
                    '& .MuiLinearProgress-bar': {
                      bgcolor: opp.current_coverage > 0.7 ? '#4caf50' : opp.current_coverage > 0.3 ? '#ff9800' : '#8b9cf7',
                    },
                  }}
                />
              </Box>
              <Chip
                label={recommendationLabel(opp.recommendation)}
                size="small"
                sx={{ height: 18, fontSize: 9, fontWeight: 600, bgcolor: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.5)' }}
              />
            </Box>

            {/* Action button */}
            {(opp.recommendation === 'create_content' || opp.recommendation === 'create') && (
              <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 0.75, pl: 3 }}>
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<EditNoteIcon sx={{ fontSize: 14 }} />}
                  onClick={() => handleCreateContent(opp)}
                  sx={{
                    textTransform: 'none',
                    fontSize: 10,
                    py: 0.25,
                    px: 1,
                    borderColor: 'rgba(255,152,0,0.3)',
                    color: '#ff9800',
                    '&:hover': {
                      borderColor: '#ff9800',
                      bgcolor: 'rgba(255,152,0,0.08)',
                    },
                  }}
                >
                  Create content from this trend
                </Button>
              </Box>
            )}
          </Box>
        ))}
      </Box>
    </Box>
  );
};

export default TrendSignalsPanel;