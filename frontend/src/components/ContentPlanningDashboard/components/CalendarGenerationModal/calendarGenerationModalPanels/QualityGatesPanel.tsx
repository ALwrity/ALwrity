import React from 'react';
import {
  Paper,
  Typography,
  Box,
  Grid,
  Chip,
  Card,
  Accordion,
  AccordionSummary,
  AccordionDetails
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import WarningIcon from '@mui/icons-material/Warning';
import ErrorIcon from '@mui/icons-material/Error';
import ScheduleIcon from '@mui/icons-material/Schedule';
import ViewModuleIcon from '@mui/icons-material/ViewModule';
import DevicesIcon from '@mui/icons-material/Devices';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import DataUsageIcon from '@mui/icons-material/DataUsage';
import SchoolIcon from '@mui/icons-material/School';

// Import styles
import {
  qualityScoreContainerStyles,
  getQualityScoreBackground,
  qualityScoreInnerStyles
} from '../CalendarGenerationModal.styles';

// Types
interface QualityScores {
  overall: number;
  step1: number;
  step2: number;
  step3: number;
  step4: number;
  step5: number;
  step6: number;
  step7: number;
  step8: number;
  step9: number;
  step10: number;
  step11: number;
  step12: number;
}

interface QualityGatesPanelProps {
  qualityScores: QualityScores;
  stepResults: Record<number, any>;
  currentStep?: number;
}

const QualityGatesPanel: React.FC<QualityGatesPanelProps> = ({ 
  qualityScores, 
  stepResults, 
  currentStep = 1 
}) => {
  
  // Get step-specific quality gates
  const getQualityGatesForStep = (step: number) => {
    const gates = [];
    
    // Phase 1 Quality Gates (Steps 1-3)
    if (step >= 1) {
      gates.push({
        id: 'strategy_alignment',
        title: 'Strategy Alignment',
        description: 'Content strategy alignment with business goals',
        score: qualityScores.step1,
        icon: <SchoolIcon />,
        category: 'Phase 1: Foundation'
      });
    }
    
    if (step >= 2) {
      gates.push({
        id: 'content_quality',
        title: 'Content Gap Analysis',
        description: 'Content gaps and opportunity identification quality',
        score: qualityScores.step2,
        icon: <DataUsageIcon />,
        category: 'Phase 1: Foundation'
      });
    }
    
    if (step >= 3) {
      gates.push({
        id: 'platform_optimization',
        title: 'Audience & Platform Strategy',
        description: 'Platform-specific content optimization and audience alignment',
        score: qualityScores.step3,
        icon: <TrendingUpIcon />,
        category: 'Phase 1: Foundation'
      });
    }
    
    // Phase 2 Quality Gates (Steps 4-6)
    if (step >= 4) {
      gates.push({
        id: 'calendar_framework',
        title: 'Calendar Framework Quality',
        description: 'Calendar structure, timeline optimization, and duration control',
        score: qualityScores.step4,
        icon: <ScheduleIcon />,
        category: 'Phase 2: Structure'
      });
    }
    
    if (step >= 5) {
      gates.push({
        id: 'pillar_distribution',
        title: 'Content Pillar Distribution',
        description: 'Balanced content pillar mapping and theme variety',
        score: qualityScores.step5,
        icon: <ViewModuleIcon />,
        category: 'Phase 2: Structure'
      });
    }
    
    if (step >= 6) {
      gates.push({
        id: 'platform_strategy',
        title: 'Platform-Specific Strategy',
        description: 'Cross-platform coordination and content adaptation quality',
        score: qualityScores.step6,
        icon: <DevicesIcon />,
        category: 'Phase 2: Structure'
      });
    }
    
    return gates;
  };

  const getQualityStatus = (score: number) => {
    if (score >= 0.9) return { label: 'EXCELLENT', color: 'success' as const, icon: <CheckCircleIcon /> };
    if (score >= 0.8) return { label: 'GOOD', color: 'warning' as const, icon: <CheckCircleIcon /> };
    if (score >= 0.7) return { label: 'ACCEPTABLE', color: 'warning' as const, icon: <WarningIcon /> };
    if (score > 0) return { label: 'NEEDS IMPROVEMENT', color: 'error' as const, icon: <ErrorIcon /> };
    return { label: 'PENDING', color: 'default' as const, icon: <ScheduleIcon /> };
  };

  const currentQualityGates = getQualityGatesForStep(currentStep);
  const gatesByCategory = currentQualityGates.reduce((acc, gate) => {
    if (!acc[gate.category]) acc[gate.category] = [];
    acc[gate.category].push(gate);
    return acc;
  }, {} as Record<string, typeof currentQualityGates>);

  return (
    <Paper elevation={1} sx={{ p: 2 }}>
      <Typography variant="h6" gutterBottom>
        Quality Gates & Validation
      </Typography>
      
      <Box mb={3}>
        <Typography variant="body2" color="text.secondary" gutterBottom>
          Quality gates ensure your calendar meets high standards for strategy alignment, content quality, and performance optimization.
          {currentStep <= 6 && (
            <span> Currently showing quality gates through <strong>Step {currentStep}</strong>.</span>
          )}
        </Typography>
      </Box>

      {/* Overall Quality Score */}
      <Box mb={3}>
        <Typography variant="subtitle1" gutterBottom>
          Overall Quality Score
        </Typography>
        <Box display="flex" alignItems="center" gap={2}>
          <Box
            sx={{
              ...qualityScoreContainerStyles,
              background: getQualityScoreBackground(qualityScores.overall)
            }}
          >
            <Box sx={qualityScoreInnerStyles}>
              {Math.round(qualityScores.overall * 100)}%
            </Box>
          </Box>
          <Box>
            <Typography variant="h6">
              {qualityScores.overall >= 0.9 ? 'Excellent' : qualityScores.overall >= 0.8 ? 'Good' : 'Needs Improvement'}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Calendar quality meets {qualityScores.overall >= 0.9 ? 'excellent' : qualityScores.overall >= 0.8 ? 'good' : 'minimum'} standards
            </Typography>
          </Box>
        </Box>
      </Box>

      {/* Phase-Based Quality Gates */}
      <Box mb={3}>
        <Typography variant="subtitle1" gutterBottom>
          Quality Gate Validation by Phase
        </Typography>
        
        {Object.entries(gatesByCategory).map(([category, gates]) => (
          <Accordion key={category} defaultExpanded>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography variant="subtitle2" fontWeight="bold">
                {category} ({gates.length} gates)
              </Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Grid container spacing={2}>
                {gates.map((gate) => {
                  const status = getQualityStatus(gate.score);
                  return (
                    <Grid item xs={12} md={6} key={gate.id}>
                      <Card variant="outlined" sx={{ p: 2 }}>
                        <Box display="flex" alignItems="center" gap={2} mb={1}>
                          <Box sx={{ color: status.color === 'success' ? 'success.main' : status.color === 'error' ? 'error.main' : 'warning.main' }}>
                            {gate.icon}
                          </Box>
                          <Typography variant="subtitle2">{gate.title}</Typography>
                        </Box>
                        <Typography variant="body2" color="text.secondary" gutterBottom>
                          {gate.description}
                        </Typography>
                        <Box display="flex" alignItems="center" gap={1}>
                          <Chip 
                            label={status.label} 
                            size="small" 
                            color={status.color}
                            icon={status.icon}
                          />
                          <Typography variant="caption" color="text.secondary">
                            Score: {gate.score > 0 ? `${Math.round(gate.score * 100)}%` : 'Pending'}
                          </Typography>
                        </Box>
                      </Card>
                    </Grid>
                  );
                })}
              </Grid>
            </AccordionDetails>
          </Accordion>
        ))}
      </Box>

      {/* Phase 2 Specific Quality Recommendations */}
      {currentStep >= 4 && (
        <Box mb={3}>
          <Typography variant="subtitle1" gutterBottom>
            Phase 2 Quality Recommendations
          </Typography>
          
          <Card variant="outlined" sx={{ p: 2 }}>
            <Box component="ul" sx={{ pl: 2, m: 0 }}>
              <Box component="li" mb={1}>
                <Typography variant="body2">
                  <strong>Calendar Framework:</strong> Ensure posting frequency aligns with audience engagement patterns
                </Typography>
              </Box>
              <Box component="li" mb={1}>
                <Typography variant="body2">
                  <strong>Content Pillar Balance:</strong> Maintain 30-40% educational, 25-35% thought leadership content
                </Typography>
              </Box>
              <Box component="li" mb={1}>
                <Typography variant="body2">
                  <strong>Platform Strategy:</strong> Customize content format and timing for each platform's best practices
                </Typography>
              </Box>
              <Box component="li">
                <Typography variant="body2">
                  <strong>Timeline Optimization:</strong> Consider timezone differences for global audiences
                </Typography>
              </Box>
            </Box>
          </Card>
        </Box>
      )}

      {/* Quality Metrics Summary */}
      <Box>
        <Typography variant="subtitle1" gutterBottom>
          Quality Metrics Summary
        </Typography>
        
        <Grid container spacing={2}>
          {currentQualityGates.slice(0, 6).map((gate, index) => (
            <Grid item xs={12} md={2} key={gate.id}>
              <Box textAlign="center" p={2}>
                <Typography 
                  variant="h5" 
                  color={gate.score >= 0.9 ? 'success.main' : gate.score >= 0.8 ? 'warning.main' : gate.score > 0 ? 'error.main' : 'text.secondary'} 
                  gutterBottom
                >
                  {gate.score > 0 ? `${Math.round(gate.score * 100)}%` : '--'}
                </Typography>
                <Typography variant="body2" sx={{ fontSize: '0.75rem' }}>
                  {gate.title}
                </Typography>
              </Box>
            </Grid>
          ))}
        </Grid>
      </Box>
    </Paper>
  );
};

export default QualityGatesPanel;
