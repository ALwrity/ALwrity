/**
 * Recommendations Component
 *
 * Displays actionable SEO recommendations with priority indicators,
 * category tags, and impact descriptions.
 */

import React from 'react';
import {
  Box,
  Typography,
  Paper,
  Chip
} from '@mui/material';
import Lightbulb from '@mui/icons-material/Lightbulb';
import CheckCircle from '@mui/icons-material/CheckCircle';
import Cancel from '@mui/icons-material/Cancel';
import Warning from '@mui/icons-material/Warning';

interface Recommendation {
  category: string;
  priority: 'High' | 'Medium' | 'Low';
  recommendation: string;
  impact: string;
}

interface RecommendationsProps {
  recommendations: Recommendation[];
}

const priorityStyles: Record<string, { color: string; gradient: string }> = {
  High: { color: '#dc2626', gradient: 'linear-gradient(135deg, rgba(248,113,113,0.12), rgba(239,68,68,0.18))' },
  Medium: { color: '#d97706', gradient: 'linear-gradient(135deg, rgba(251,191,36,0.12), rgba(217,119,6,0.16))' },
  Low: { color: '#16a34a', gradient: 'linear-gradient(135deg, rgba(74,222,128,0.12), rgba(22,163,74,0.16))' },
  default: { color: '#475569', gradient: 'linear-gradient(135deg, rgba(148,163,184,0.1), rgba(100,116,139,0.14))' }
};

export const Recommendations: React.FC<RecommendationsProps> = ({ recommendations }) => {
  const getPriorityColor = (priority: string) => priorityStyles[priority]?.color || priorityStyles.default.color;

  const getPriorityIcon = (priority: string) => {
    switch (priority) {
      case 'High':
        return <Cancel sx={{ fontSize: 18 }} />;
      case 'Medium':
        return <Warning sx={{ fontSize: 18 }} />;
      case 'Low':
        return <CheckCircle sx={{ fontSize: 18 }} />;
      default:
        return <Warning sx={{ fontSize: 18 }} />;
    }
  };

  const getChipColor = (priority: string) => {
    switch (priority) {
      case 'High':
        return 'error';
      case 'Medium':
        return 'warning';
      case 'Low':
        return 'success';
      default:
        return 'default';
    }
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
        <Lightbulb sx={{ color: 'primary.main' }} />
        <Typography variant="h6" component="h3" sx={{ fontWeight: 700, letterSpacing: 0.2, color: '#0f172a' }}>
          Actionable Recommendations
        </Typography>
      </Box>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
        {recommendations.map((rec, index) => {
          const styles = priorityStyles[rec.priority] || priorityStyles.default;
          return (
            <Paper
              key={index}
              sx={{
                p: 3,
                background: '#ffffff',
                border: '1px solid #e2e8f0',
                borderRadius: 3,
                boxShadow: '0 16px 36px rgba(15,23,42,0.08)',
                color: '#0f172a'
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}>
                <Box
                  sx={{
                    mt: 0.5,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 32,
                    height: 32,
                    borderRadius: '999px',
                    background: styles.gradient,
                    color: getPriorityColor(rec.priority)
                  }}
                >
                  {getPriorityIcon(rec.priority)}
                </Box>
                <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 1 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
                    <Chip
                      label={rec.category}
                      variant="outlined"
                      size="small"
                      sx={{ borderColor: '#cbd5f5', color: '#475569', fontWeight: 600 }}
                    />
                    <Chip
                      label={rec.priority}
                      color={getChipColor(rec.priority)}
                      size="small"
                      sx={{ fontWeight: 600 }}
                    />
                  </Box>
                  <Typography variant="body1" sx={{ lineHeight: 1.6, color: '#1f2937' }}>
                    {rec.recommendation}
                  </Typography>
                  <Typography variant="caption" sx={{ color: '#64748b' }}>
                    {rec.impact}
                  </Typography>
                </Box>
              </Box>
            </Paper>
          );
        })}
      </Box>
    </Box>
  );
};
