import React from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Tooltip,
  Modal,
  IconButton,
  Chip,
  Stack,
  Divider
} from '@mui/material';
import { styled } from '@mui/material/styles';
import CheckIcon from '@mui/icons-material/CheckCircle';
import WarningIcon from '@mui/icons-material/WarningAmber';
import ErrorIcon from '@mui/icons-material/Error';
import CloseIcon from '@mui/icons-material/Close';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import InfoIcon from '@mui/icons-material/Info';
import { motion } from 'framer-motion';

interface Insight {
  id: string;
  title: string;
  description: string;
  metric: string;
  value: string;
  trend: 'up' | 'down' | 'stable';
  priority: 'low' | 'medium' | 'high' | 'critical';
  category: 'engagement' | 'reach' | 'conversion' | 'seo' | 'content';
  platform: 'facebook' | 'linkedin' | 'twitter' | 'instagram' | 'website';
  detailedAnalysis: string;
  recommendations: string[];
  impact: string;
  timeframe: string;
}

interface AnalyticsData {
  theGood: Insight[];
  theBad: Insight[];
  theUgly: Insight[];
}

interface AnalyticsInsightsProps {
  data?: AnalyticsData; // optional - falls back to mock
  onActionClick?: (action: 'alwrity' | 'ignore', insight: Insight) => void;
}

const ColumnCard = styled(Card)(({ theme }) => ({
  background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.8) 0%, rgba(30, 41, 59, 0.7) 100%)',
  border: '1px solid rgba(148, 163, 184, 0.15)',
  backdropFilter: 'blur(20px)',
  WebkitBackdropFilter: 'blur(20px)',
  borderRadius: theme.spacing(3),
  overflow: 'hidden',
  boxShadow: '0 20px 40px -12px rgba(0, 0, 0, 0.3), 0 0 0 1px rgba(255, 255, 255, 0.05)',
  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
  position: 'relative',
  '&::before': {
    content: '""',
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.02) 0%, rgba(147, 51, 234, 0.01) 100%)',
    zIndex: -1,
  },
  '&:hover': {
    transform: 'translateY(-4px)',
    boxShadow: '0 32px 64px -12px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(255, 255, 255, 0.08)',
    border: '1px solid rgba(148, 163, 184, 0.25)',
  }
}));

// Pill component removed as it's not used

const GradientHeader = styled(Box)<{ gradient: string }>(({ gradient }) => ({
  background: gradient,
  padding: '12px 16px',
  color: 'white',
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  position: 'relative',
  '&::after': {
    content: '""',
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '1px',
    background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.3) 50%, transparent 100%)',
  }
}));

const Badge = styled('span')(({ theme }) => ({
  background: 'rgba(255,255,255,0.2)',
  border: '1px solid rgba(255,255,255,0.4)',
  color: 'white',
  borderRadius: 12,
  padding: '4px 8px',
  fontWeight: 700,
  fontSize: '0.7rem',
  backdropFilter: 'blur(8px)',
  boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
  textShadow: '0 1px 2px rgba(0,0,0,0.3)'
}));


const mockData: AnalyticsData = {
  theGood: [
    {
      id: 'good-1',
      title: 'LinkedIn Engagement Surge',
      description: 'LinkedIn engagement is up significantly this week.',
      metric: 'Engagement Rate',
      value: '+45%',
      trend: 'up',
      priority: 'high',
      category: 'engagement',
      platform: 'linkedin',
      detailedAnalysis: 'Recent posts on AI topics resonated strongly with your B2B audience.',
      recommendations: ['Post 3x/week on AI trends', 'Engage with comments within 2 hours'],
      impact: 'High lead-gen potential',
      timeframe: 'Last 7 days'
    },
    {
      id: 'good-2',
      title: 'Website Traffic Growth',
      description: 'Organic traffic increased due to improved SEO.',
      metric: 'Organic Traffic',
      value: '+23%',
      trend: 'up',
      priority: 'medium',
      category: 'seo',
      platform: 'website',
      detailedAnalysis: 'Technical fixes and content refresh improved rankings.',
      recommendations: ['Create 2 pillar pages', 'Refresh 5 top posts'],
      impact: 'Improved visibility',
      timeframe: 'Last 30 days'
    },
    {
      id: 'good-3',
      title: 'Top-Performing Post',
      description: 'A recent LinkedIn post outperformed baseline by 2.1x',
      metric: 'Engagement Index',
      value: '2.1x',
      trend: 'up',
      priority: 'medium',
      category: 'engagement',
      platform: 'linkedin',
      detailedAnalysis: 'Carousel format and thought leadership angle worked well.',
      recommendations: ['Use carousel weekly', 'Add CTA to subscribe'],
      impact: 'Audience growth',
      timeframe: 'This week'
    }
  ],
  theBad: [
    {
      id: 'bad-1',
      title: 'Facebook Reach Decline',
      description: 'Facebook post reach dropped this month.',
      metric: 'Reach',
      value: '-18%',
      trend: 'down',
      priority: 'medium',
      category: 'reach',
      platform: 'facebook',
      detailedAnalysis: 'Algorithm change likely impacting page distribution.',
      recommendations: ['Test short video posts', 'Boost first-hour engagement'],
      impact: 'Lower awareness',
      timeframe: 'Last 30 days'
    },
    {
      id: 'bad-2',
      title: 'Email CTR Stagnant',
      description: 'Content CTR plateaued across campaigns.',
      metric: 'CTR',
      value: '0.9%',
      trend: 'stable',
      priority: 'low',
      category: 'content',
      platform: 'website',
      detailedAnalysis: 'Subject lines lack urgency; preview text uninspiring.',
      recommendations: ['A/B test subject lines', 'Add curiosity hook'],
      impact: 'Reduced visits',
      timeframe: 'Last 14 days'
    }
  ],
  theUgly: [
    {
      id: 'ugly-1',
      title: 'Critical SEO Issues',
      description: '15 pages have broken internal links.',
      metric: 'Broken Links',
      value: '15 pages',
      trend: 'down',
      priority: 'critical',
      category: 'seo',
      platform: 'website',
      detailedAnalysis: 'Broken links hurt crawlability and user experience.',
      recommendations: ['Fix links immediately', 'Add automated link checks'],
      impact: 'Severe ranking risk',
      timeframe: 'Ongoing'
    },
    {
      id: 'ugly-2',
      title: 'Declining Conversions',
      description: 'Checkout conversion dropped vs prior month.',
      metric: 'CVR',
      value: '-12%',
      trend: 'down',
      priority: 'high',
      category: 'conversion',
      platform: 'website',
      detailedAnalysis: 'Funnel analysis shows friction on payment step.',
      recommendations: ['Simplify checkout', 'Add alternate payment'],
      impact: 'Direct revenue impact',
      timeframe: 'Last 30 days'
    }
  ]
};

const getGradient = (type: 'good' | 'bad' | 'ugly') => {
  switch (type) {
    case 'good':
      return 'linear-gradient(135deg, rgba(76,175,80,0.55) 0%, rgba(139,195,74,0.55) 100%)';
    case 'bad':
      return 'linear-gradient(135deg, rgba(255,152,0,0.55) 0%, rgba(245,124,0,0.55) 100%)';
    default:
      return 'linear-gradient(135deg, rgba(244,67,54,0.55) 0%, rgba(233,30,99,0.55) 100%)';
  }
};

const getIcon = (type: 'good' | 'bad' | 'ugly') => {
  switch (type) {
    case 'good':
      return <CheckIcon />;
    case 'bad':
      return <WarningIcon />;
    default:
      return <ErrorIcon />;
  }
};

const TrendChip: React.FC<{ trend: Insight['trend'] }> = ({ trend }) => {
  if (trend === 'up') return <Chip size="small" icon={<TrendingUpIcon />} label="Up" sx={{ color: '#4CAF50', background: '#4CAF5022', border: '1px solid #4CAF5044', fontWeight: 700, fontSize: '0.6rem', height: 18 }} />;
  if (trend === 'down') return <Chip size="small" icon={<TrendingDownIcon />} label="Down" sx={{ color: '#F44336', background: '#F4433622', border: '1px solid #F4433644', fontWeight: 700, fontSize: '0.6rem', height: 18 }} />;
  return <Chip size="small" icon={<InfoIcon />} label="Stable" sx={{ color: '#90CAF9', background: '#90CAF922', border: '1px solid #90CAF944', fontWeight: 700, fontSize: '0.6rem', height: 18 }} />;
};

const AnalyticsInsights: React.FC<AnalyticsInsightsProps> = ({ data, onActionClick }) => {
  const [hovered, setHovered] = React.useState<'good' | 'bad' | 'ugly' | null>(null);
  const [open, setOpen] = React.useState(false);
  const [selected, setSelected] = React.useState<Insight | null>(null);

  const insights = data || mockData;

  const columns: Array<{ key: 'good' | 'bad' | 'ugly'; title: string; items: Insight[] }> = [
    { key: 'good', title: 'The Good', items: insights.theGood },
    { key: 'bad', title: 'The Bad', items: insights.theBad },
    { key: 'ugly', title: 'The Ugly', items: insights.theUgly },
  ];

  const handleKnowMore = (insight: Insight) => {
    setSelected(insight);
    setOpen(true);
  };

  const handleClose = () => setOpen(false);

  const handleAction = (action: 'alwrity' | 'ignore') => {
    if (selected && onActionClick) {
      onActionClick(action, selected);
    }
    setOpen(false);
  };

  return (
    <Box sx={{ 
      mt: 1.4, 
      mb: 1.4,
      p: 2.1,
      background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.95) 0%, rgba(30, 41, 59, 0.9) 100%)',
      backdropFilter: 'blur(24px)',
      border: '1px solid rgba(148, 163, 184, 0.1)',
      borderRadius: 4,
      boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(255, 255, 255, 0.05)',
      position: 'relative',
      overflow: 'hidden',
      '&::before': {
        content: '""',
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.03) 0%, rgba(147, 51, 234, 0.02) 100%)',
        zIndex: -1,
      },
    }}>
      <Box sx={{ 
        position: 'relative', 
        overflow: 'hidden',
        mb: 2.1,
        pb: 1.4,
        borderBottom: '1px solid rgba(148, 163, 184, 0.1)',
        '&::after': {
          content: '""',
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: '1px',
          background: 'linear-gradient(90deg, transparent 0%, rgba(59, 130, 246, 0.3) 50%, transparent 100%)',
        }
      }}>
        <Box sx={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between',
          width: '100%'
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <TrendingUpIcon sx={{ color: '#3b82f6', fontSize: '1.5rem' }} />
            <Typography
              variant="h5"
              sx={{
                fontWeight: 800,
                fontSize: '1.4rem',
                color: '#ffffff',
                textShadow: '0 2px 4px rgba(0,0,0,0.3)',
                background: 'linear-gradient(135deg, #ffffff 0%, #e2e8f0 100%)',
                backgroundClip: 'text',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              Today's Analytics Insights
            </Typography>
          </Box>
          
          {/* Chat with Analytics Pro Button - Inline */}
          <Button
            disabled
            variant="contained"
            sx={{
              background: 'linear-gradient(135deg, rgba(148, 163, 184, 0.1) 0%, rgba(100, 116, 139, 0.1) 100%)',
              border: '1px solid rgba(148, 163, 184, 0.2)',
              borderRadius: 2,
              px: 2,
              py: 0.8,
              color: 'rgba(148, 163, 184, 0.6)',
              fontSize: '0.8rem',
              fontWeight: 600,
              textTransform: 'none',
              backdropFilter: 'blur(8px)',
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
              position: 'relative',
              overflow: 'hidden',
              minWidth: 'auto',
              '&::before': {
                content: '""',
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                background: 'linear-gradient(135deg, rgba(148, 163, 184, 0.05) 0%, rgba(100, 116, 139, 0.05) 100%)',
                zIndex: -1,
              },
              '&:hover': {
                background: 'linear-gradient(135deg, rgba(148, 163, 184, 0.1) 0%, rgba(100, 116, 139, 0.1) 100%)',
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
              },
              '&.Mui-disabled': {
                background: 'linear-gradient(135deg, rgba(148, 163, 184, 0.1) 0%, rgba(100, 116, 139, 0.1) 100%)',
                color: 'rgba(148, 163, 184, 0.6)',
                border: '1px solid rgba(148, 163, 184, 0.2)',
              }
            }}
          >
            💬 Chat
            <Chip
              label="Pro"
              size="small"
              sx={{
                ml: 1,
                background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
                color: 'white',
                fontSize: '0.6rem',
                fontWeight: 700,
                height: 18,
                '& .MuiChip-label': {
                  px: 0.8,
                }
              }}
            />
          </Button>
        </Box>
      </Box>
      
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={1}>
        {columns.map((col) => {
          const isHovered = hovered === col.key;
          const visibleItems = isHovered ? col.items : col.items.slice(0, 1);
          const gradient = getGradient(col.key);
          return (
            <motion.div key={col.key} style={{ flex: 1 }} onMouseEnter={() => setHovered(col.key)} onMouseLeave={() => setHovered(null)}>
              <ColumnCard>
                <GradientHeader gradient={gradient}>
                  {getIcon(col.key)}
                  <Typography variant="subtitle1" sx={{ fontWeight: 800, fontSize: '0.9rem' }}>{col.title}</Typography>
                  <Badge>{col.items.length}</Badge>
                </GradientHeader>

                <CardContent sx={{ p: 1.4, '&:last-child': { pb: 1.4 } }}>
                  <Stack spacing={1.05}>
                    {visibleItems.map((insight) => (
                      <Box key={insight.id} sx={{
                        background: 'rgba(15, 23, 42, 0.4)',
                        border: '1px solid rgba(148, 163, 184, 0.1)',
                        borderRadius: 2,
                        p: 1.05,
                        backdropFilter: 'blur(8px)',
                        transition: 'all 0.2s ease-in-out',
                        '&:hover': {
                          background: 'rgba(15, 23, 42, 0.6)',
                          border: '1px solid rgba(148, 163, 184, 0.2)',
                          transform: 'translateY(-1px)',
                          boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
                        }
                      }}>
                        <Stack direction="row" spacing={0.7} alignItems="center" sx={{ mb: 0.7 }}>
                          <Typography variant="body2" sx={{ 
                            color: '#ffffff', 
                            fontWeight: 700, 
                            fontSize: '0.85rem',
                            textShadow: '0 1px 2px rgba(0,0,0,0.3)'
                          }}>
                            {insight.title}
                          </Typography>
                          <TrendChip trend={insight.trend} />
                        </Stack>
                        <Typography variant="body2" sx={{ 
                          color: 'rgba(255,255,255,0.8)', 
                          fontSize: '0.75rem', 
                          lineHeight: 1.4,
                          mb: 0.7
                        }}>
                          {insight.description}
                        </Typography>
                        <Stack direction="row" spacing={0.7} sx={{ mt: 0.7 }}>
                          <Chip size="small" label={`${insight.metric}: ${insight.value}`} sx={{ 
                            color: '#ffffff', 
                            background: 'rgba(59, 130, 246, 0.2)', 
                            border: '1px solid rgba(59, 130, 246, 0.3)', 
                            fontWeight: 700, 
                            fontSize: '0.7rem', 
                            height: 24,
                            backdropFilter: 'blur(8px)'
                          }} />
                          <Chip size="small" label={insight.platform} sx={{ 
                            color: 'rgba(255,255,255,0.9)', 
                            background: 'rgba(148, 163, 184, 0.15)', 
                            border: '1px solid rgba(148, 163, 184, 0.2)',
                            fontSize: '0.7rem', 
                            height: 24,
                            backdropFilter: 'blur(8px)'
                          }} />
                        </Stack>
                      </Box>
                    ))}
                  </Stack>

                  {isHovered && (
                    <Box sx={{ mt: 1, display: 'flex', justifyContent: 'flex-end' }}>
                      <Tooltip title={`Open detailed insights for ${col.title.toLowerCase()}.`}>
                        <span>
                          <Button
                            variant="contained"
                            onClick={() => handleKnowMore(col.items[0])}
                            size="small"
                            sx={{
                              textTransform: 'none',
                              fontWeight: 800,
                              background: gradient,
                              boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                              fontSize: '0.75rem',
                              px: 2,
                              py: 0.5
                            }}
                          >
                            Know More
                          </Button>
                        </span>
                      </Tooltip>
                    </Box>
                  )}
                </CardContent>
              </ColumnCard>
            </motion.div>
          );
        })}
      </Stack>

      <Modal open={open} onClose={handleClose}>
        <Box sx={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: { xs: '92%', md: 900 },
          maxHeight: '80vh',
          overflowY: 'auto',
          background: 'linear-gradient(180deg, rgba(16,24,39,0.92) 0%, rgba(26,33,56,0.92) 100%)',
          border: '1px solid rgba(255,255,255,0.18)',
          borderRadius: 3,
          boxShadow: '0 26px 80px rgba(0,0,0,0.5)'
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', p: 2.5, borderBottom: '1px solid rgba(255,255,255,0.15)' }}>
            <Typography variant="h6" sx={{ color: 'rgba(255,255,255,0.95)', fontWeight: 800 }}>
              {selected?.title}
            </Typography>
            <IconButton onClick={handleClose} sx={{ color: 'rgba(255,255,255,0.85)' }}>
              <CloseIcon />
            </IconButton>
          </Box>

          <CardContent>
            <Stack spacing={1.5}>
              <Typography variant="body1" sx={{ color: 'rgba(255,255,255,0.9)' }}>
                {selected?.detailedAnalysis}
              </Typography>
              <Stack direction="row" spacing={1}>
                <Chip size="small" label={`${selected?.metric}: ${selected?.value}`} sx={{ color: 'rgba(255,255,255,0.95)', background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.24)', fontWeight: 700 }} />
                {selected?.platform && (
                  <Chip size="small" label={selected.platform} sx={{ color: 'rgba(255,255,255,0.85)', background: 'rgba(255,255,255,0.08)' }} />
                )}
                {selected?.impact && (
                  <Chip size="small" label={`Impact: ${selected.impact}`} sx={{ color: 'rgba(255,255,255,0.85)', background: 'rgba(255,255,255,0.08)' }} />
                )}
              </Stack>

              <Divider sx={{ my: 1.5, borderColor: 'rgba(255,255,255,0.15)' }} />
              <Typography variant="subtitle2" sx={{ color: 'rgba(255,255,255,0.9)', fontWeight: 800 }}>
                Recommendations
              </Typography>
              <Stack spacing={0.75}>
                {selected?.recommendations.map((rec, idx) => (
                  <Typography key={idx} variant="body2" sx={{ color: 'rgba(255,255,255,0.8)' }}>• {rec}</Typography>
                ))}
              </Stack>

              <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1.5, mt: 2 }}>
                <Tooltip title="Save this as a memory for ALwrity AI to take action automatically.">
                  <span>
                    <Button variant="contained" color="success" onClick={() => handleAction('alwrity')} sx={{ textTransform: 'none', fontWeight: 800 }}>
                      ALwrity it
                    </Button>
                  </span>
                </Tooltip>
                <Tooltip title="Dismiss for now. You can revisit later in analytics.">
                  <span>
                    <Button variant="outlined" color="inherit" onClick={() => handleAction('ignore')} sx={{ textTransform: 'none', fontWeight: 800 }}>
                      Ignore it
                    </Button>
                  </span>
                </Tooltip>
              </Box>
            </Stack>
          </CardContent>
        </Box>
      </Modal>
    </Box>
  );
};

export default AnalyticsInsights;


