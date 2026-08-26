/**
 * TrendsConfigSection Component
 * 
 * Google Trends configuration section with keywords, expected insights, and settings.
 */

import React from 'react';
import {
  Box,
  Typography,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  TextField,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Grid,
  Chip,
  Tooltip,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import TrendIcon from '@mui/icons-material/TrendingUp';
import CheckIcon from '@mui/icons-material/CheckCircle';
import InfoIcon from '@mui/icons-material/Info';
import { AnalyzeIntentResponse } from '../../../../types/intent.types';

interface TrendsConfigSectionProps {
  trendsConfig: NonNullable<AnalyzeIntentResponse['trends_config']>;
}

export const TrendsConfigSection: React.FC<TrendsConfigSectionProps> = ({
  trendsConfig,
}) => {
  return (
    <Accordion
      defaultExpanded={true}
      sx={{
        mb: 2,
        backgroundColor: '#ffffff',
        border: '1px solid #e5e7eb',
        '&:before': { display: 'none' },
        boxShadow: 'none',
      }}
    >
      <AccordionSummary
        expandIcon={<ExpandMoreIcon sx={{ color: '#666' }} />}
        sx={{
          backgroundColor: '#f0fdf4',
          '&:hover': { backgroundColor: '#dcfce7' },
        }}
      >
        <Box display="flex" alignItems="center" gap={1} flex={1}>
          <TrendIcon sx={{ color: '#10b981', fontSize: 20 }} />
          <Typography variant="subtitle2" fontWeight={600} color="#333">
            Google Trends Analysis
          </Typography>
          <Chip
            size="small"
            label="Auto-enabled"
            sx={{
              ml: 1,
              backgroundColor: '#dcfce7',
              color: '#166534',
              fontSize: '0.7rem',
              height: 20,
              fontWeight: 500,
            }}
          />
        </Box>
      </AccordionSummary>
      <AccordionDetails sx={{ p: 2, backgroundColor: '#ffffff' }}>
        {/* Trends Keywords */}
        <Box mb={2}>
          <Typography variant="caption" color="#666" fontWeight={600} gutterBottom display="block">
            Trends Keywords
          </Typography>
          <TextField
            fullWidth
            size="small"
            value={trendsConfig.keywords.join(', ')}
            disabled
            helperText={trendsConfig.keywords_justification}
            sx={{
              backgroundColor: '#f9fafb',
              '& .MuiOutlinedInput-root': {
                '&:hover fieldset': { borderColor: '#10b981' },
                '&.Mui-focused fieldset': { borderColor: '#10b981' },
              },
            }}
          />
        </Box>

        {/* Expected Insights Preview */}
        {trendsConfig.expected_insights.length > 0 && (
          <Box mb={2}>
            <Typography variant="caption" color="#666" fontWeight={600} gutterBottom display="block">
              What Trends Will Uncover:
            </Typography>
            <List dense sx={{ backgroundColor: '#f9fafb', borderRadius: 1, p: 1 }}>
              {trendsConfig.expected_insights.map((insight, idx) => (
                <ListItem key={idx} sx={{ py: 0.5, px: 1 }}>
                  <ListItemIcon sx={{ minWidth: 24 }}>
                    <CheckIcon color="success" fontSize="small" />
                  </ListItemIcon>
                  <ListItemText
                    primary={insight}
                    primaryTypographyProps={{ variant: 'caption', color: '#374151' }}
                  />
                </ListItem>
              ))}
            </List>
          </Box>
        )}

        {/* Settings with Justifications */}
        <Box
          sx={{
            p: 1.5,
            backgroundColor: '#f9fafb',
            borderRadius: 1,
            border: '1px solid #e5e7eb',
          }}
        >
          <Grid container spacing={1}>
            <Grid item xs={6}>
              <Typography variant="caption" color="#666" fontWeight={500} display="block" gutterBottom>
                Timeframe
              </Typography>
              <Box display="flex" alignItems="center" gap={0.5}>
                <Typography variant="body2" fontWeight={500} color="#333">
                  {trendsConfig.timeframe}
                </Typography>
                <Tooltip title={trendsConfig.timeframe_justification} arrow>
                  <InfoIcon sx={{ fontSize: 14, color: '#9ca3af', cursor: 'help' }} />
                </Tooltip>
              </Box>
            </Grid>
            <Grid item xs={6}>
              <Typography variant="caption" color="#666" fontWeight={500} display="block" gutterBottom>
                Region
              </Typography>
              <Box display="flex" alignItems="center" gap={0.5}>
                <Typography variant="body2" fontWeight={500} color="#333">
                  {trendsConfig.geo}
                </Typography>
                <Tooltip title={trendsConfig.geo_justification} arrow>
                  <InfoIcon sx={{ fontSize: 14, color: '#9ca3af', cursor: 'help' }} />
                </Tooltip>
              </Box>
            </Grid>
          </Grid>
        </Box>
      </AccordionDetails>
    </Accordion>
  );
};
