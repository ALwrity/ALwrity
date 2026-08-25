/**
 * IntentHeader Component
 * 
 * Header section of IntentConfirmationPanel with title, confidence badge, and close button.
 */

import React, { useState } from 'react';
import {
  Box,
  Typography,
  Chip,
  IconButton,
  Tooltip,
} from '@mui/material';
import BrainIcon from '@mui/icons-material/Psychology';
import CloseIcon from '@mui/icons-material/Close';
import InfoIcon from '@mui/icons-material/Info';
import { AnalyzeIntentResponse } from '../../../../types/intent.types';

interface IntentHeaderProps {
  intentAnalysis: AnalyzeIntentResponse;
  onDismiss: () => void;
}

export const IntentHeader: React.FC<IntentHeaderProps> = ({
  intentAnalysis,
  onDismiss,
}) => {
  const intent = intentAnalysis.intent;
  const confidence = intent.confidence;
  const isHighConfidence = confidence >= 0.8;
  const confidenceReason = (intentAnalysis as any).confidence_reason || '';
  const greatExample = (intentAnalysis as any).great_example || '';

  return (
    <Box
      sx={{
        p: 2,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: isHighConfidence ? '#f0f9ff' : '#fff7ed',
        borderBottom: '1px solid #e0e0e0',
      }}
    >
      <Box display="flex" alignItems="center" gap={1.5}>
        <BrainIcon sx={{ color: isHighConfidence ? '#10b981' : '#f59e0b' }} />
        <Box>
          <Typography variant="subtitle1" fontWeight={600} color="#333">
            Help ALwrity understand Your Research
          </Typography>
          <Typography variant="caption" color="#666">
            {intentAnalysis.analysis_summary}
          </Typography>
        </Box>
      </Box>
      <Box display="flex" alignItems="center" gap={1}>
        <Tooltip
          title={
            <Box sx={{ p: 1, maxWidth: 300 }}>
              <Typography variant="caption" fontWeight={600} display="block" gutterBottom>
                Confidence: {Math.round(confidence * 100)}%
              </Typography>
              {confidenceReason && (
                <Typography variant="caption" display="block" sx={{ mb: 1 }}>
                  {confidenceReason}
                </Typography>
              )}
              {greatExample && (
                <>
                  <Typography variant="caption" fontWeight={600} display="block" gutterBottom>
                    Great example would be:
                  </Typography>
                  <Typography variant="caption" display="block">
                    {greatExample}
                  </Typography>
                </>
              )}
            </Box>
          }
          arrow
        >
          <Chip
            size="small"
            label={`${Math.round(confidence * 100)}% confident`}
            color={isHighConfidence ? 'success' : 'warning'}
            variant="outlined"
            sx={{
              backgroundColor: '#ffffff',
              cursor: 'help',
            }}
            icon={<InfoIcon fontSize="small" />}
          />
        </Tooltip>
        <IconButton size="small" onClick={onDismiss} sx={{ color: '#666' }}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </Box>
    </Box>
  );
};
