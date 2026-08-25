import React from 'react';
import {
  Paper,
  Typography,
  Box,
  IconButton,
  Chip,
  Accordion,
  AccordionSummary,
  AccordionDetails
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import SchoolIcon from '@mui/icons-material/School';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ScheduleIcon from '@mui/icons-material/Schedule';
import ViewModuleIcon from '@mui/icons-material/ViewModule';
import DevicesIcon from '@mui/icons-material/Devices';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import DataUsageIcon from '@mui/icons-material/DataUsage';

interface EducationalPanelProps {
  content: any[];
  currentStep: number;
  isExpanded: boolean;
  onToggleExpanded: () => void;
}

const EducationalPanel: React.FC<EducationalPanelProps> = ({ 
  content, 
  currentStep, 
  isExpanded, 
  onToggleExpanded 
}) => {
  // Step-specific educational content
  const getStepEducationalContent = (step: number) => {
    switch (step) {
      case 1:
        return {
          title: "Content Strategy Analysis",
          description: "Analyzing your business goals, target audience, and content pillars to establish a strategic foundation.",
          tips: [
            "Review your business objectives and KPIs",
            "Identify your target audience personas",
            "Define your core content pillars",
            "Align content with business goals"
          ],
          icon: <SchoolIcon />
        };
      case 2:
        return {
          title: "Gap Analysis & Opportunities",
          description: "Identifying content gaps, keyword opportunities, and competitive insights to optimize your strategy.",
          tips: [
            "Analyze competitor content strategies",
            "Identify high-value keyword opportunities",
            "Find content gaps in your niche",
            "Prioritize opportunities by impact"
          ],
          icon: <DataUsageIcon />
        };
      case 3:
        return {
          title: "Audience & Platform Strategy",
          description: "Developing audience personas and platform-specific strategies for maximum engagement.",
          tips: [
            "Create detailed audience personas",
            "Analyze platform performance metrics",
            "Develop platform-specific content strategies",
            "Optimize for each platform's unique features"
          ],
          icon: <TrendingUpIcon />
        };
      case 4:
        return {
          title: "Calendar Framework & Timeline",
          description: "Building the structural foundation of your content calendar with optimal timing and duration control.",
          tips: [
            "Optimize posting frequency for your audience",
            "Consider timezone and peak engagement hours",
            "Balance content types across the timeline",
            "Ensure strategic alignment with business goals"
          ],
          icon: <ScheduleIcon />
        };
      case 5:
        return {
          title: "Content Pillar Distribution",
          description: "Mapping content pillars across your timeline to ensure balanced and strategic content distribution.",
          tips: [
            "Distribute pillars based on strategic importance",
            "Maintain content variety and freshness",
            "Ensure each pillar gets adequate coverage",
            "Create thematic content clusters"
          ],
          icon: <ViewModuleIcon />
        };
      case 6:
        return {
          title: "Platform-Specific Strategy",
          description: "Optimizing content for each platform's unique characteristics and audience preferences.",
          tips: [
            "Adapt content format for each platform",
            "Optimize posting times per platform",
            "Maintain brand consistency across platforms",
            "Leverage platform-specific features"
          ],
          icon: <DevicesIcon />
        };
      default:
        return {
          title: "Calendar Generation",
          description: "Creating your comprehensive content calendar with strategic alignment and optimization.",
          tips: [
            "Review all generated content",
            "Validate strategic alignment",
            "Check quality scores and recommendations",
            "Customize based on your preferences"
          ],
          icon: <ScheduleIcon />
        };
    }
  };

  const stepContent = getStepEducationalContent(currentStep);

  return (
    <Paper elevation={1} sx={{ p: 2 }}>
      <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
        <Box display="flex" alignItems="center" gap={1}>
          <Typography variant="h6">
            Educational Content
          </Typography>
          <Chip 
            label={`Step ${currentStep}`} 
            size="small" 
            color="primary" 
            icon={stepContent.icon}
          />
        </Box>
        <IconButton onClick={onToggleExpanded} size="small">
          {isExpanded ? <CheckCircleIcon /> : <SchoolIcon />}
        </IconButton>
      </Box>
      
      {isExpanded && (
        <Box>
          <Accordion defaultExpanded>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography variant="subtitle1" fontWeight="bold">
                {stepContent.title}
              </Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                {stepContent.description}
              </Typography>
              
              <Box mt={2}>
                <Typography variant="subtitle2" gutterBottom>
                  Key Tips:
                </Typography>
                <Box display="flex" flexDirection="column" gap={1}>
                  {stepContent.tips.map((tip: string, index: number) => (
                    <Box key={index} display="flex" alignItems="center" gap={1}>
                      <CheckCircleIcon fontSize="small" color="primary" />
                      <Typography variant="body2" color="text.secondary">
                        {tip}
                      </Typography>
                    </Box>
                  ))}
                </Box>
              </Box>
            </AccordionDetails>
          </Accordion>
          
          {/* Additional educational content from backend */}
          {content.length > 0 && content[0].title !== stepContent.title && (
            <Box mt={2}>
              <Typography variant="subtitle2" gutterBottom>
                Additional Insights:
              </Typography>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                {content[0].description}
              </Typography>
              {content[0].tips && content[0].tips.length > 0 && (
                <Box display="flex" flexWrap="wrap" gap={1} mt={1}>
                  {content[0].tips.map((tip: string, index: number) => (
                    <Chip key={index} label={tip} size="small" variant="outlined" />
                  ))}
                </Box>
              )}
            </Box>
          )}
        </Box>
      )}
    </Paper>
  );
};

export default EducationalPanel;
